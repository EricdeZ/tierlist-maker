# Depicted User Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow Vault Studio cards to be linked to the Discord user they depict, enabling that user to sign unique cards without needing a `linked_player_id`.

**Architecture:** Add nullable `depicted_user_id` FK on `cc_card_templates`, `cc_card_drafts`, and `cc_cards`. Propagate at mint time from template. Add user search + picker in the studio sidebar. Restructure signature upload auth to check `depicted_user_id` before falling back to the existing `linked_player_id` path.

**Tech Stack:** PostgreSQL (Neon), Cloudflare Pages Functions, React 19, Tailwind CSS 4

**Known follow-ups (out of scope for this plan):**
- `handleRequestSignature` in vault.js (line 2117) blocks cards without a `player_id` from getting signature requests. Cards with only `depicted_user_id` (no player def) won't support the request-based flow yet.
- `handlePendingSignatures` in vault.js (line 2131) filters by `linked_player_id` only. Depicted users who aren't linked league players won't see pending requests in their inbox.

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `database/migrations/140-depicted-user.sql` | Migration: add `depicted_user_id` columns |
| Modify | `functions/api/vault-dashboard.js:6-56, 63-99, 101-135, 166-228` | Add search-users action, pass `depicted_user_id` through save/load |
| Modify | `functions/api/vault-signature-upload.js:7-65` | Remove early guard, add `depicted_user_id` auth path |
| Modify | `functions/lib/vault.js:457-473, 759-774` | Propagate `depicted_user_id` at mint time |
| Modify | `src/pages/vault-dashboard/CardCreator.jsx:64-94, 108-147, 401-438, 522-542` | Add `depictedUser` state, persist, pass to sidebar, include in save payload |
| Modify | `src/pages/vault-dashboard/editor/CardSidebar.jsx:163-260` | Add DepictedUserPicker section |
| Modify | `src/services/database.js:1483-1544` | Add `searchUsers` method to vaultDashboardService |

---

### Task 1: Database Migration

**Files:**
- Create: `database/migrations/140-depicted-user.sql`

- [ ] **Step 1: Write migration file**

```sql
-- Add depicted_user_id to card templates, drafts, and card instances
ALTER TABLE cc_card_templates
  ADD COLUMN depicted_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE cc_card_drafts
  ADD COLUMN depicted_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE cc_cards
  ADD COLUMN depicted_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
```

- [ ] **Step 2: Commit**

```bash
git add database/migrations/140-depicted-user.sql
git commit -m "feat(vault): add depicted_user_id column to card templates, drafts, and cards"
```

---

### Task 2: Backend — User Search + Save/Load Changes

**Files:**
- Modify: `functions/api/vault-dashboard.js`
- Modify: `src/services/database.js`

- [ ] **Step 1: Add `search-users` GET action to vault-dashboard.js**

In the GET switch block (line 31), add a new case before the default:

```javascript
case 'search-users': return searchUsers(sql, event)
```

Add the handler function after the existing GET handlers (after line 135):

```javascript
async function searchUsers(sql, event) {
    const { q } = event.queryStringParameters || {}
    if (!q || q.trim().length < 2) return ok({ users: [] })
    const query = q.trim()
    const results = await sql`
        SELECT u.id, u.discord_username, u.discord_avatar, u.discord_id, p.name AS player_name
        FROM users u
        LEFT JOIN players p ON p.id = u.linked_player_id
        WHERE u.discord_username ILIKE ${'%' + query + '%'}
           OR p.name ILIKE ${'%' + query + '%'}
        ORDER BY u.discord_username ASC
        LIMIT 10
    `
    return ok({ users: results })
}
```

- [ ] **Step 2: Update `saveTemplate` to accept and persist `depicted_user_id`**

In `saveTemplate` (line 166), destructure `depicted_user_id` from body:

```javascript
const { id, name, description, card_type, rarity, template_data, depicted_user_id } = body
```

In the UPDATE SQL (lines 176-185), add `depicted_user_id` to the SET clause:

```sql
depicted_user_id = ${depicted_user_id !== undefined ? (depicted_user_id || null) : existing.depicted_user_id},
```

In the INSERT SQL (lines 188-191), add `depicted_user_id` to columns and values:

```sql
INSERT INTO cc_card_templates (name, description, card_type, rarity, template_data, created_by, depicted_user_id)
VALUES (${name}, ${description || null}, ${card_type}, ${rarity}, ${JSON.stringify(template_data)}, ${user.id}, ${depicted_user_id || null})
```

- [ ] **Step 3: Update `saveDraft` to accept and persist `depicted_user_id` with auto-populate**

In `saveDraft` (line 197), destructure `depicted_user_id` from body:

```javascript
const { id, card_type, rarity, template_data, target_player_id, notes, depicted_user_id } = body
```

Before the INSERT/UPDATE block, add auto-populate logic:

```javascript
let resolvedTargetPlayerId = target_player_id || null
if (depicted_user_id && !target_player_id) {
    const [depictedUser] = await sql`SELECT linked_player_id FROM users WHERE id = ${depicted_user_id}`
    if (depictedUser?.linked_player_id) resolvedTargetPlayerId = depictedUser.linked_player_id
}
```

In the UPDATE SQL (lines 207-218), add `depicted_user_id` to the SET clause and use `resolvedTargetPlayerId`:

```javascript
const [row] = await sql`
    UPDATE cc_card_drafts
    SET card_type = ${card_type}, rarity = ${rarity},
        template_data = ${JSON.stringify(template_data)},
        target_player_id = ${resolvedTargetPlayerId},
        depicted_user_id = ${depicted_user_id !== undefined ? (depicted_user_id || null) : existing.depicted_user_id},
        notes = ${notes || null},
        status = ${existing.status === 'rejected' ? 'draft' : existing.status},
        rejection_reason = ${existing.status === 'rejected' ? null : existing.rejection_reason},
        updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
`
```

In the INSERT SQL (lines 221-224), add `depicted_user_id` and use `resolvedTargetPlayerId`:

```javascript
const [row] = await sql`
    INSERT INTO cc_card_drafts (card_type, rarity, template_data, target_player_id, notes, created_by, depicted_user_id)
    VALUES (${card_type}, ${rarity}, ${JSON.stringify(template_data)}, ${resolvedTargetPlayerId}, ${notes || null}, ${user.id}, ${depicted_user_id || null})
    RETURNING *
`
```

- [ ] **Step 4: Update `getTemplate` and `getDraft` to return depicted user info**

In `getTemplate` (line 95), change the SELECT to JOIN users and players for the depicted user:

```javascript
const [row] = await sql`
    SELECT t.*, du.discord_username AS depicted_username, du.discord_avatar AS depicted_avatar,
           du.discord_id AS depicted_discord_id, dp.name AS depicted_player_name
    FROM cc_card_templates t
    LEFT JOIN users du ON du.id = t.depicted_user_id
    LEFT JOIN players dp ON dp.id = du.linked_player_id
    WHERE t.id = ${id}
`
```

In `getDraft` (line 131), same pattern:

```javascript
const [row] = await sql`
    SELECT d.*, du.discord_username AS depicted_username, du.discord_avatar AS depicted_avatar,
           du.discord_id AS depicted_discord_id, dp.name AS depicted_player_name
    FROM cc_card_drafts d
    LEFT JOIN users du ON du.id = d.depicted_user_id
    LEFT JOIN players dp ON dp.id = du.linked_player_id
    WHERE d.id = ${id}
`
```

- [ ] **Step 5: Update `getTemplates` and `getDrafts` list queries to include depicted user info**

In all four list queries (lines 67-88 for templates, 105-123 for drafts), add the depicted user JOINs:

```sql
LEFT JOIN users du ON du.id = t.depicted_user_id
LEFT JOIN players dp ON dp.id = du.linked_player_id
```

And add to each SELECT:

```sql
du.discord_username AS depicted_username, du.discord_avatar AS depicted_avatar,
du.discord_id AS depicted_discord_id, dp.name AS depicted_player_name
```

(Use `d.depicted_user_id` for drafts queries.)

- [ ] **Step 6: Add `searchUsers` to vaultDashboardService in database.js**

In the `vaultDashboardService` object (around line 1483 in `src/services/database.js`), add:

```javascript
async searchUsers(q) {
    return apiCall('vault-dashboard', { action: 'search-users', q })
},
```

- [ ] **Step 7: Commit**

```bash
git add functions/api/vault-dashboard.js src/services/database.js
git commit -m "feat(vault): add depicted_user_id to save/load endpoints and user search"
```

---

### Task 3: Frontend — Depicted User Picker in CardCreator

**Files:**
- Modify: `src/pages/vault-dashboard/CardCreator.jsx`
- Modify: `src/pages/vault-dashboard/editor/CardSidebar.jsx`

- [ ] **Step 1: Add `depictedUser` state to CardCreator.jsx**

After the `cardData` state (line 87), add:

```javascript
// Depicted user link (optional — for signature system)
const [depictedUser, setDepictedUser] = useState(() => saved.current?.depictedUser || null)
```

`depictedUser` shape: `{ id, discord_username, discord_avatar, discord_id, player_name }` or `null`.

- [ ] **Step 2: Include `depictedUser` in localStorage persistence**

Update the useEffect at line 90-94 to include `depictedUser`:

```javascript
const draft = { name, cardType, rarity, elements, border, saveTarget, status, cardData, depictedUser }
```

Add `depictedUser` to the dependency array.

- [ ] **Step 3: Populate `depictedUser` when loading a draft/template from API**

In the load effect (lines 113-147), after setting `cardData` (line 135), add:

```javascript
if (data.depicted_user_id) {
    setDepictedUser({
        id: data.depicted_user_id,
        discord_username: data.depicted_username,
        discord_avatar: data.depicted_avatar,
        discord_id: data.depicted_discord_id,
        player_name: data.depicted_player_name || null,
    })
} else {
    setDepictedUser(null)
}
```

- [ ] **Step 4: Include `depicted_user_id` in save payload**

In `handleSave` (lines 414-418), add `depicted_user_id` to the payload:

```javascript
const payload = {
    name: name || 'Untitled',
    card_type: cardType,
    rarity,
    template_data: templateData,
    depicted_user_id: depictedUser?.id || null,
}
```

Add `depictedUser` to the `useCallback` dependency array (line 438).

- [ ] **Step 5: Clear `depictedUser` on "New Card"**

In `handleNew` (line 446+), add:

```javascript
setDepictedUser(null)
```

- [ ] **Step 6: Pass `depictedUser` and `setDepictedUser` to CardSidebar**

In the CardSidebar JSX (lines 522-542), add two new props:

```jsx
<CardSidebar
    ...existing props...
    depictedUser={depictedUser}
    onDepictedUserChange={(user) => { setDepictedUser(user); setDirty(true) }}
/>
```

- [ ] **Step 7: Add DepictedUserPicker to CardSidebar.jsx**

Add to the component's props destructuring (line 163):

```javascript
depictedUser,
onDepictedUserChange,
```

Add a new section in the sidebar JSX, after the "Card Border" section (after line 238, before the selected element properties). This is a self-contained section with its own search state:

```jsx
{/* Depicted User */}
<DepictedUserPicker user={depictedUser} onChange={onDepictedUserChange} />
```

Add the `DepictedUserPicker` as a component at the top of `CardSidebar.jsx` (before the default export). It needs:

- Local state: `query` (string), `results` (array), `loading` (bool)
- A `useEffect` that debounces `query` changes (300ms) and calls `vaultDashboardService.searchUsers(query)` when >= 2 chars, clears results when < 2 chars
- Renders:
  - If `user` is set: show avatar (16px circle), discord_username, player_name if present, and an X button to clear (`onChange(null)`)
  - If `user` is null: show a text input with placeholder "Link depicted user..."
  - Below input when `results.length > 0`: absolute-positioned dropdown, each row showing avatar + discord_username + player_name (dimmed)
  - Clicking a result calls `onChange(result)`, clears query and results

Discord avatar URL pattern: `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.discord_avatar}.png`

Fallback if no avatar: use a generic user icon or first letter of username.

Import `vaultDashboardService` from `../../../services/database.js` (check if already imported).

Style the section header like existing ones:

```jsx
<h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Depicted User</h3>
```

Style the dropdown to match the dark theme (bg-gray-800, border-gray-700, hover:bg-gray-700).

- [ ] **Step 8: Commit**

```bash
git add src/pages/vault-dashboard/CardCreator.jsx src/pages/vault-dashboard/editor/CardSidebar.jsx
git commit -m "feat(vault): add depicted user picker to card studio sidebar"
```

---

### Task 4: Backend — Signature Upload Auth Update

**Files:**
- Modify: `functions/api/vault-signature-upload.js`

- [ ] **Step 1: Restructure the direct-sign auth flow**

Remove the early `linked_player_id` guard at line 17:

```javascript
// REMOVE this line:
// if (!user.linked_player_id) return json({ error: 'Not a linked player' }, 403)
```

In the direct-sign block (lines 43-65), update the card query to include `depicted_user_id`:

```javascript
const [card] = await sql`
    SELECT c.id, c.owner_id, c.rarity, c.signature_url, c.card_data,
           c.depicted_user_id, d.player_id
    FROM cc_cards c
    LEFT JOIN cc_player_defs d ON c.def_id = d.id
    WHERE c.id = ${directCardId}
`
```

Replace the player ID check (lines 55-58) with a two-path auth check:

```javascript
// Path 1: depicted_user_id matches current user
const isDepictedUser = card.depicted_user_id && card.depicted_user_id === user.id

// Path 2: legacy — linked_player_id matches card's player def
const playerId = card.player_id || card.card_data?._testPlayerId
const isLinkedPlayer = user.linked_player_id && playerId && playerId === user.linked_player_id

if (!isDepictedUser && !isLinkedPlayer) {
    return json({ error: 'You must be the depicted player to direct-sign' }, 403)
}
```

- [ ] **Step 2: Restructure the request-based sign flow**

In the request-based block (lines 67-84), replace the `signer_player_id` check at line 75 with a two-path check:

```javascript
// Look up card's depicted_user_id for alternative auth
const [reqCard] = await sql`SELECT depicted_user_id FROM cc_cards WHERE id = ${req.card_id}`
const isDepictedUser = reqCard?.depicted_user_id && reqCard.depicted_user_id === user.id
const isLinkedSigner = user.linked_player_id && req.signer_player_id === user.linked_player_id

if (!isDepictedUser && !isLinkedSigner) {
    return json({ error: 'Not your request to sign' }, 403)
}
```

- [ ] **Step 3: Commit**

```bash
git add functions/api/vault-signature-upload.js
git commit -m "feat(vault): allow depicted users to sign cards without linked_player_id"
```

---

### Task 5: Backend — Propagate depicted_user_id at Mint Time

**Files:**
- Modify: `functions/lib/vault.js`

- [ ] **Step 1: Add `depicted_user_id` to the pack card INSERT**

In `openPack` (line 457-473), add `depicted_user_id` to the INSERT column list:

```sql
INSERT INTO cc_cards (owner_id, original_owner_id, god_id, god_name, god_class, role, rarity, serial_number, holo_effect, holo_type, image_url, acquired_via, card_type, card_data, def_id, template_id, is_first_edition, depicted_user_id)
```

And in the SELECT values, add after the `is_first_edition` expression (before `RETURNING *`):

```sql
${card.depicted_user_id || null},
```

Note: the `is_first_edition` value is a complex boolean expression ending with `)` — place the new value on the next line before `RETURNING *`.

- [ ] **Step 2: Add `depicted_user_id` to `generateCollectionCard` output**

In `generateCollectionCard` (line 740), update the template query to include `depicted_user_id`:

```javascript
const entries = await sql`
    SELECT t.id, t.name, t.card_type, t.depicted_user_id
    FROM cc_collection_entries e
    JOIN cc_card_templates t ON e.template_id = t.id
    JOIN cc_collections c ON e.collection_id = c.id
    WHERE e.collection_id = ${collectionId}
      AND c.status = 'active'
      AND t.status = 'approved'
`
```

In the return object (line 759), add:

```javascript
depicted_user_id: template.depicted_user_id || null,
```

- [ ] **Step 3: No changes needed for other INSERT locations**

Other INSERT INTO cc_cards locations (`vault.js:1339`, `vault.js:1798`, `vault-admin.js:326`, `vault-admin.js:768`) are for granting/admin-minting and don't have template context. Since `depicted_user_id` is nullable with no NOT NULL constraint, omitting it from those INSERTs defaults to NULL. No changes needed.

- [ ] **Step 4: Commit**

```bash
git add functions/lib/vault.js
git commit -m "feat(vault): propagate depicted_user_id from template to minted cards"
```

---

### Task 6: Manual Testing Checklist

- [ ] **Step 1: Run migration against dev database**

```bash
psql $DATABASE_URL -f database/migrations/140-depicted-user.sql
```

Verify columns exist:

```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'cc_card_templates' AND column_name = 'depicted_user_id';
SELECT column_name FROM information_schema.columns WHERE table_name = 'cc_card_drafts' AND column_name = 'depicted_user_id';
SELECT column_name FROM information_schema.columns WHERE table_name = 'cc_cards' AND column_name = 'depicted_user_id';
```

- [ ] **Step 2: Start dev server and test Studio picker**

```bash
npm start
```

Open Vault Studio. Verify:
1. "Depicted User" section appears in sidebar
2. Typing 2+ chars searches users by Discord name and Smite name
3. Selecting a user shows their avatar + name with an X clear button
4. Saving a draft/template persists the `depicted_user_id`
5. Reloading the draft/template shows the linked user pre-populated
6. Clearing the user and saving removes the link
7. The link survives page refresh (localStorage) before saving

- [ ] **Step 3: Test signature flow**

1. Create a card template with a depicted user set
2. Mint a card from that template (via pack)
3. Verify `cc_cards.depicted_user_id` is populated
4. Log in as the depicted user
5. Verify they can sign the unique card even without `linked_player_id`
6. Verify existing `linked_player_id`-based signing still works

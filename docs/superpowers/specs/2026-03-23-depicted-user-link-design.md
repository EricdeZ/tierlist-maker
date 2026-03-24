# Depicted User Link — Design Spec

## Problem

Vault Studio cards can depict specific people, but there's no way to formally connect a card template or draft to the Discord user it depicts. The signature system for unique cards currently requires `linked_player_id` (league player link), which means non-league users can never sign cards that depict them, and even league players require an indirect chain through `cc_player_defs`.

## Solution

Add an optional `depicted_user_id` column to `cc_card_templates`, `cc_card_drafts`, and `cc_cards`. This creates a direct link between a card design and the Discord user it depicts. The link can be set during creation or added later. The signature system uses this as an alternative auth path — if you're the depicted user, you can sign.

## Database

### Migration

```sql
ALTER TABLE cc_card_templates
  ADD COLUMN depicted_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE cc_card_drafts
  ADD COLUMN depicted_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE cc_cards
  ADD COLUMN depicted_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
```

All columns are nullable. `ON DELETE SET NULL` so card survives if a user is ever deleted.

### Auto-populate target_player_id

When `depicted_user_id` is set on a draft and the depicted user has a `linked_player_id`, auto-populate `cc_card_drafts.target_player_id` with the corresponding league player ID. This maintains backwards compatibility with existing player-based flows.

### Propagation to cc_cards

When cards are minted from a template, copy `depicted_user_id` from the template to the `cc_cards` row. This ensures the signing endpoint can check `depicted_user_id` directly on the card without joining through `template_id` (which is nullable on older cards).

## API Changes

### vault-dashboard.js

**New action: `search-users`** (GET, requires `vault_member`)

Query params: `q` (min 2 chars)

SQL pattern (mirrors vault.js):
```sql
SELECT u.id, u.discord_username, u.discord_avatar, u.discord_id,
       p.name AS player_name
FROM users u
LEFT JOIN players p ON p.id = u.linked_player_id
WHERE u.discord_username ILIKE $query
   OR p.name ILIKE $query
ORDER BY u.discord_username ASC
LIMIT 10
```

Returns all registered users, not just league players. Self-exclusion omitted since an admin may link their own card.

**Modified actions:**

- `save-draft`: Accept optional `depicted_user_id` in body. If set, persist it. If the depicted user has `linked_player_id`, also set `target_player_id`.
- `save-template`: Accept optional `depicted_user_id` in body. Persist it.
- `load-draft` / draft list queries: JOIN to `users` to return `depicted_user_id`, `depicted_username`, `depicted_avatar` alongside the draft data.
- `load-template` / template list queries: Same JOIN for template fetches.

### vault-signature-upload.js

**Modified signing auth check:**

Current flow:
1. Early guard: require `user.linked_player_id` (blocks all non-league users)
2. Check card's player def matches

New flow (remove the early `linked_player_id` guard):
1. Authenticate user
2. Look up the card
3. Check if `cc_cards.depicted_user_id` matches current user's ID → allow signing
4. Otherwise, fall back to existing `linked_player_id` + player def check
5. Either path succeeds → allow signature upload

The early `linked_player_id` guard must be removed/restructured since the whole point is allowing non-league users to sign.

### Vault load endpoints

The vault card detail/load endpoints need to surface `depicted_user_id` on card instances so the frontend can show "Sign Your Card" for depicted users who aren't league players. JOIN through `cc_cards.depicted_user_id` to `users` to get username/avatar.

## UI Changes

### CardCreator Sidebar

Add a "Depicted User" section in the card metadata area of `CardSidebar.jsx`:

- **Search input**: Text field, debounced (300ms), triggers search at 2+ characters
- **Results dropdown**: Shows Discord username + player name (if linked) + Discord avatar
- **Selected state**: Shows the linked user's avatar + name with an "x" clear button
- **Empty state**: Shows "No user linked" placeholder text
- **Persistence**: `depicted_user_id` included in the save payload (`handleSave` in CardCreator.jsx) and in localStorage draft persistence so the link survives page refresh before saving

When loading an existing draft/template that has a `depicted_user_id`, the sidebar shows the linked user pre-populated.

### Permission model

Any `vault_member` can set `depicted_user_id` on their own drafts/templates. This is intentional — vault members are a trusted group with creator access. No additional approval step for linking a depicted user.

## Scope Boundaries

**In scope:**
- `depicted_user_id` column on templates, drafts, and card instances
- Propagation from template → cc_cards at mint time
- User search in vault-dashboard
- Sidebar picker in CardCreator
- Signature auth path update (remove early guard, add depicted_user_id check)
- Surface depicted_user_id on card detail endpoints

**Out of scope:**
- Showing depicted cards on user profiles
- Notifications to depicted users
- Filtering cards by depicted user in admin views

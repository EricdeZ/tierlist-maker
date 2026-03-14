# Vault Banlist Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a vault banlist that silently blocks banned users from the player-facing Card Clash vault (`/vault`), hides vault links in the sidebar, and provides admin UI to manage bans.

**Architecture:** New `cc_vault_bans` table tracks banned users. Ban status is checked at the handler level in `vault.js` (guards all authenticated actions). Ban status is included in the `auth-me` response so the frontend can hide vault links and redirect without extra API calls. Admin panel gets a new "Users" tab with ban/unban controls.

**Tech Stack:** PostgreSQL (Neon), Cloudflare Pages Functions, React 19, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-03-14-vault-banlist-design.md`

---

## Task 1: Database Migration

**Files:**
- Create: `database/migrations/112-vault-bans.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 112-vault-bans.sql
-- Vault banlist: one row per banned user

CREATE TABLE cc_vault_bans (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  banned_by INTEGER NOT NULL REFERENCES users(id),
  banned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: Run the migration against dev database**

```bash
# Connect to dev DB and run the migration
psql "$DATABASE_URL" -f database/migrations/112-vault-bans.sql
```

Expected: `CREATE TABLE`

- [ ] **Step 3: Commit**

```bash
git add database/migrations/112-vault-bans.sql
git commit -m "feat(vault): add cc_vault_bans table for vault banlist"
```

---

## Task 2: Backend — Ban Guard in vault.js

**Files:**
- Modify: `functions/api/vault.js:36` (inside `try` block, before GET/POST switch)

- [ ] **Step 1: Add ban check after requireAuth, before action dispatch**

In `functions/api/vault.js`, insert the ban check at line 36, right after the `try {` and before `if (event.httpMethod === 'GET')`:

```js
  try {
    // Ban check — guards all authenticated actions
    const [ban] = await sql`SELECT 1 FROM cc_vault_bans WHERE user_id = ${user.id}`
    if (ban) return { statusCode: 200, headers, body: JSON.stringify({ vault_banned: true }) }

    if (event.httpMethod === 'GET') {
```

This goes inside the existing `try` block at line 36, before the GET switch at line 37. It returns early with `{ vault_banned: true }` for any authenticated action (load, open-pack, dismantle, etc.) if the user is banned. Unauthenticated actions (`shared-card`, `binder-view`) are dispatched before `requireAuth` at lines 24-29 and are unaffected.

- [ ] **Step 2: Verify the endpoint still works**

```bash
curl -s http://localhost:8788/api/vault?action=load -H "Authorization: Bearer $TOKEN" | head -c 200
```

Expected: Normal vault data response (since the test user isn't banned).

- [ ] **Step 3: Commit**

```bash
git add functions/api/vault.js
git commit -m "feat(vault): add handler-level ban guard to vault.js"
```

---

## Task 3: Backend — Ban/Unban Admin Actions

**Files:**
- Modify: `functions/api/vault-admin.js:31` (add `'users'` query modification)
- Modify: `functions/api/vault-admin.js:40-52` (add POST cases)
- Modify: `functions/api/vault-admin.js:178-206` (modify `handleListUsers` query)

- [ ] **Step 1: Add ban-user and unban-user POST cases**

In `functions/api/vault-admin.js`, add two new cases to the POST switch (around line 51, before the `default`):

```js
        case 'ban-user':           return await handleBanUser(sql, body, user)
        case 'unban-user':         return await handleUnbanUser(sql, body)
```

- [ ] **Step 2: Add the handler functions**

Add these functions at the end of `functions/api/vault-admin.js` (before `export const onRequest`):

```js
// ═══ POST: Ban a user from the vault ═══
async function handleBanUser(sql, body, admin) {
  const { userId } = body
  if (!userId) return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'userId required' }) }

  await sql`
    INSERT INTO cc_vault_bans (user_id, banned_by)
    VALUES (${userId}, ${admin.id})
    ON CONFLICT (user_id) DO NOTHING
  `

  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ success: true }) }
}

// ═══ POST: Unban a user from the vault ═══
async function handleUnbanUser(sql, body) {
  const { userId } = body
  if (!userId) return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'userId required' }) }

  await sql`DELETE FROM cc_vault_bans WHERE user_id = ${userId}`

  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ success: true }) }
}
```

- [ ] **Step 3: Modify handleListUsers to include ban status**

In `functions/api/vault-admin.js`, update the `handleListUsers` function (lines 178-206). Add a LEFT JOIN to `cc_vault_bans` in both query branches:

Change the search branch (lines 185-193):
```js
    users = await sql`
      SELECT s.*, u.discord_name,
             (SELECT COUNT(*)::int FROM cc_cards WHERE owner_id = s.user_id) AS card_count,
             vb.banned_at
      FROM cc_stats s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN cc_vault_bans vb ON vb.user_id = s.user_id
      WHERE u.discord_name ILIKE ${'%' + search + '%'}
      ORDER BY s.elo DESC
      LIMIT ${lim} OFFSET ${off}
    `
```

Change the no-search branch (lines 195-202):
```js
    users = await sql`
      SELECT s.*, u.discord_name,
             (SELECT COUNT(*)::int FROM cc_cards WHERE owner_id = s.user_id) AS card_count,
             vb.banned_at
      FROM cc_stats s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN cc_vault_bans vb ON vb.user_id = s.user_id
      ORDER BY s.elo DESC
      LIMIT ${lim} OFFSET ${off}
    `
```

- [ ] **Step 4: Commit**

```bash
git add functions/api/vault-admin.js
git commit -m "feat(vault): add ban-user/unban-user admin actions and ban status in user list"
```

---

## Task 4: Backend — Ban Status in auth-me

**Files:**
- Modify: `functions/api/auth-me.js:25-40` (hoist getDB, add ban check)
- Modify: `functions/api/auth-me.js:45-56` (add vaultBanned to response)

- [ ] **Step 1: Add ban status to auth-me response**

In `functions/api/auth-me.js`, the existing `const sql = getDB()` is inside the `if (user.linked_player_id)` block at line 26. Hoist it before the `if` block so it can be reused for the ban check. Replace lines 24-40 with:

```js
    const sql = getDB()

    // If user has a linked player, fetch player details + their most recent division
    let linkedPlayer = null
    if (user.linked_player_id) {
        const [player] = await sql`
            SELECT p.id, p.name, p.slug, p.discord_name,
                   l.slug AS league_slug, d.slug AS division_slug
            FROM players p
            LEFT JOIN league_players lp ON lp.player_id = p.id
            LEFT JOIN seasons s ON s.id = lp.season_id
            LEFT JOIN divisions d ON d.id = s.division_id
            LEFT JOIN leagues l ON l.id = s.league_id
            WHERE p.id = ${user.linked_player_id}
            ORDER BY s.is_active DESC NULLS LAST, s.start_date DESC NULLS LAST
            LIMIT 1
        `
        linkedPlayer = player || null
    }

    // Check vault ban status
    const [banRow] = await sql`SELECT 1 FROM cc_vault_bans WHERE user_id = ${user.id}`
```

Then in the response object (line 45), add `vaultBanned`:

```js
    const response = {
        user: {
            id: user.id,
            discord_id: user.discord_id,
            discord_username: user.discord_username,
            discord_avatar: user.discord_avatar,
            role: user.role,
            linked_player_id: user.linked_player_id,
        },
        linkedPlayer,
        permissions,
        vaultBanned: !!banRow,
    }
```

- [ ] **Step 2: Commit**

```bash
git add functions/api/auth-me.js
git commit -m "feat(vault): include vaultBanned in auth-me response"
```

---

## Task 5: Frontend — AuthContext Ban State

**Files:**
- Modify: `src/context/AuthContext.jsx:8` (add state)
- Modify: `src/context/AuthContext.jsx:89-96` (read from response)
- Modify: `src/context/AuthContext.jsx:209-227` (expose in context value)

- [ ] **Step 1: Add vaultBanned state**

In `src/context/AuthContext.jsx`, add a new state variable after line 16 (`notification` state):

```js
    const [vaultBanned, setVaultBanned] = useState(false)
```

- [ ] **Step 2: Read vaultBanned from auth-me response**

In the `fetchUser` success handler (lines 90-96), add after line 96 (`setRealUser`):

```js
                    setVaultBanned(!!data.vaultBanned)
```

Also in the error/logout handlers where state is reset (line 104 area and line 169 area), add:

```js
                    setVaultBanned(false)
```

And in the `logout` callback (around line 172), add:

```js
        setVaultBanned(false)
```

- [ ] **Step 3: Expose vaultBanned in context value**

In the context provider value object (lines 209-227), add `vaultBanned`:

```js
        <AuthContext.Provider value={{
            user,
            linkedPlayer,
            loading,
            token,
            login,
            logout,
            isAdmin,
            avatarUrl,
            permissions,
            hasPermission,
            hasAnyPermission,
            impersonating,
            realUser,
            startImpersonation,
            stopImpersonation,
            notification,
            clearNotification: () => setNotification(null),
            vaultBanned,
        }}>
```

- [ ] **Step 4: Commit**

```bash
git add src/context/AuthContext.jsx
git commit -m "feat(vault): expose vaultBanned from AuthContext"
```

---

## Task 6: Frontend — VaultPage Redirect

**Files:**
- Modify: `src/pages/VaultPage.jsx:67` (add vaultBanned to destructuring)
- Modify: `src/pages/VaultPage.jsx:102-109` (add ban redirect before feature flag check)

- [ ] **Step 1: Add ban redirect**

In `src/pages/VaultPage.jsx`, update the `useAuth()` destructuring at line 67:

```js
    const { user, login, loading, hasPermission, vaultBanned } = useAuth()
```

Add an import for `useNavigate` from react-router-dom (line 3 already imports `useSearchParams`, add `useNavigate`):

```js
import { useSearchParams, useNavigate } from 'react-router-dom'
```

Add the navigate hook and ban redirect after the loading check (after line 71) and before the `!user` check (line 73):

```js
    const navigate = useNavigate()

    useEffect(() => {
        if (vaultBanned) navigate('/', { replace: true })
    }, [vaultBanned, navigate])

    if (vaultBanned) return null
```

This goes right after `if (loading) return null` and before the `!user` check. The `useEffect` handles the actual redirect, and `return null` prevents any flash of content. The hooks (`useNavigate`, `useEffect`) must be called unconditionally before any early returns, so place them before `if (loading)`:

Actually, to follow React hooks rules (no hooks after conditional returns), restructure the top of the function:

```js
export default function VaultPage() {
    const { user, login, loading, hasPermission, vaultBanned } = useAuth()
    const navigate = useNavigate()

    useEffect(() => {
        if (vaultBanned) navigate('/', { replace: true })
    }, [vaultBanned, navigate])

    if (loading) {
        return null
    }

    if (vaultBanned) {
        return null
    }

    if (!user) {
        // ... existing unauthenticated UI
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/VaultPage.jsx
git commit -m "feat(vault): redirect banned users from vault page"
```

---

## Task 7: Frontend — Hide Sidebar Vault Link

**Files:**
- Modify: `src/components/layout/GlobalSidebar.jsx:368` (add vaultBanned condition)

- [ ] **Step 1: Check where useAuth is destructured in GlobalSidebar**

Find the existing `useAuth()` destructuring in GlobalSidebar.jsx and add `vaultBanned` to it.

- [ ] **Step 2: Add vaultBanned to vault link condition**

In `src/components/layout/GlobalSidebar.jsx` at line 368, update the condition:

```js
{(FEATURE_FLAGS.CARD_CLASH_RELEASED || isAdmin || hasPermission('codex_edit')) && !vaultBanned && (
```

Add `vaultBanned` to the existing `useAuth()` destructuring at the top of the component.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/GlobalSidebar.jsx
git commit -m "feat(vault): hide vault sidebar link for banned users"
```

---

## Task 8: Frontend — Admin Ban/Unban Service Methods

**Files:**
- Modify: `src/services/database.js:1284-1286` (add to vaultAdminService)

- [ ] **Step 1: Add banUser and unbanUser to vaultAdminService**

In `src/services/database.js`, add these methods to the `vaultAdminService` object (before the closing `}`):

```js
    async banUser(userId) {
        return apiPost('vault-admin', { action: 'ban-user' }, { userId })
    },
    async unbanUser(userId) {
        return apiPost('vault-admin', { action: 'unban-user' }, { userId })
    },
```

- [ ] **Step 2: Commit**

```bash
git add src/services/database.js
git commit -m "feat(vault): add banUser/unbanUser service methods"
```

---

## Task 9: Frontend — Admin Users Tab

**Files:**
- Create: `src/pages/admin/vault/CCAdminUsers.jsx`
- Modify: `src/pages/admin/VaultAdmin.jsx:1-14` (add import)
- Modify: `src/pages/admin/VaultAdmin.jsx:15-26` (add tab to TABS array)
- Modify: `src/pages/admin/VaultAdmin.jsx:60-70` (add tab content render)

- [ ] **Step 1: Create CCAdminUsers component**

Create `src/pages/admin/vault/CCAdminUsers.jsx`:

```jsx
import { useState, useEffect, useCallback } from 'react'
import { vaultAdminService } from '../../../services/database'

export default function CCAdminUsers() {
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const data = await vaultAdminService.listUsers({ search: search || undefined, limit: 50 })
      setUsers(data.users || [])
    } catch (err) {
      console.error('Failed to load users:', err)
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    const t = setTimeout(fetchUsers, 300)
    return () => clearTimeout(t)
  }, [fetchUsers])

  const toggleBan = async (userId, isBanned) => {
    try {
      if (isBanned) {
        await vaultAdminService.unbanUser(userId)
      } else {
        await vaultAdminService.banUser(userId)
      }
      fetchUsers()
    } catch (err) {
      console.error('Failed to toggle ban:', err)
    }
  }

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Search by name..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full max-w-sm px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[var(--cd-cyan)]/50"
      />

      {loading ? (
        <div className="flex justify-center py-8"><div className="cd-spinner w-6 h-6" /></div>
      ) : users.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">No users found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--color-text-secondary)] uppercase tracking-wider border-b border-white/10">
                <th className="p-3">User</th>
                <th className="p-3">ELO</th>
                <th className="p-3">W/L</th>
                <th className="p-3">Cards</th>
                <th className="p-3">Packs</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.user_id} className="border-b border-white/5">
                  <td className="p-3 font-medium">{u.discord_name}</td>
                  <td className="p-3 font-mono">{u.elo}</td>
                  <td className="p-3 font-mono">{u.wins}/{u.losses}</td>
                  <td className="p-3 font-mono">{u.card_count}</td>
                  <td className="p-3 font-mono">{u.packs_opened}</td>
                  <td className="p-3">
                    {u.banned_at ? (
                      <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-xs font-bold">Banned</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-xs font-bold">Active</span>
                    )}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => toggleBan(u.user_id, !!u.banned_at)}
                      className={`px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                        u.banned_at
                          ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                          : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                      }`}
                    >
                      {u.banned_at ? 'Unban' : 'Ban'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add Users tab to VaultAdmin**

In `src/pages/admin/VaultAdmin.jsx`:

Add the import after line 13:
```js
import CCAdminUsers from './vault/CCAdminUsers'
```

Add a "Users" tab to the TABS array (after the `actions` tab at line 25):
```js
  { key: 'users', label: 'Users', icon: 'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z' },
```

Add the tab content render (in the tab content section, after the last `activeTab ===` check):
```js
      {activeTab === 'users' && <CCAdminUsers />}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/vault/CCAdminUsers.jsx src/pages/admin/VaultAdmin.jsx
git commit -m "feat(vault): add Users tab to vault admin with ban/unban controls"
```

---

## Task 10: Manual Testing

- [ ] **Step 1: Test ban flow end-to-end**

1. Start the dev server: `npm start`
2. Log in as admin, go to `/admin/vault`, click the "Users" tab
3. Search for a test user, click "Ban" — verify the badge changes to "Banned"
4. Open an incognito window, log in as the banned user
5. Verify: sidebar does NOT show "The Vault" link
6. Navigate directly to `/vault` — verify redirect to `/`
7. Go back to admin, click "Unban" — verify the badge changes to "Active"
8. Refresh the banned user's page — verify vault link reappears and `/vault` loads normally

- [ ] **Step 2: Test API hardening**

With a banned user's token, verify all vault API actions return `{ vault_banned: true }`:

```bash
# These should all return vault_banned: true
curl -s "http://localhost:8788/api/vault?action=load" -H "Authorization: Bearer $BANNED_TOKEN"
curl -s -X POST "http://localhost:8788/api/vault?action=open-pack" -H "Authorization: Bearer $BANNED_TOKEN" -H "Content-Type: application/json" -d '{}'
```

Verify public endpoints still work for banned users:
```bash
curl -s "http://localhost:8788/api/vault?action=shared-card&token=sometoken"
```

- [ ] **Step 3: Final commit if any fixes needed**

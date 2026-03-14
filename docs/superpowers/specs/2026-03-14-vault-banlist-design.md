# Vault Banlist Design

## Overview

Banned users are silently excluded from the player-facing Card Clash vault (`/vault`). They don't see vault links in the sidebar and get redirected to `/` if they navigate directly. Public share routes (`/vault/share/:token`, `/vault/binder/:token`) are unaffected. The Vault Studio (`/vault-dashboard`) is unaffected.

## Database

New table `cc_vault_bans` (migration 112):

```sql
CREATE TABLE cc_vault_bans (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  banned_by INTEGER NOT NULL REFERENCES users(id),
  banned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

One row = banned. Delete row = unbanned. No reason field.

## API Changes

### `vault.js` — handler-level ban guard

The ban check goes at the top of the authenticated handler, before the `switch` dispatches to any action. This guards all authenticated actions (`load`, `open-pack`, `send-gift`, `dismantle`, `slot-card`, etc.) in one place and prevents side-effect writes like `ensureStats`/`grantStarterPacks` from firing for banned users.

```js
// After requireAuth, before switch(action)
const [ban] = await sql`SELECT 1 FROM cc_vault_bans WHERE user_id = ${user.id}`
if (ban) return { statusCode: 200, headers, body: JSON.stringify({ vault_banned: true }) }
```

Unauthenticated actions (`shared-card`, `binder-view`) are dispatched before this check and remain unaffected.

### `vault-admin.js` — new actions

**`action=ban-user` (POST)**
- Input: `{ userId }`
- Insert into `cc_vault_bans` with `banned_by` set to the admin's user ID
- Uses `ON CONFLICT DO NOTHING` (idempotent)
- Requires `cardclash_manage`

**`action=unban-user` (POST)**
- Input: `{ userId }`
- Delete from `cc_vault_bans` where `user_id` matches
- Requires `cardclash_manage`

**`action=users` (GET) — modify existing**
- Left join `cc_vault_bans` to include `banned_at` in the user list response
- Frontend uses presence of `banned_at` to show ban status
- Note: the existing query only shows users with `cc_stats` rows. Banned users without stats won't appear, but this is acceptable — banning someone who never opened the vault is an unlikely edge case, and they can be unbanned via direct API call if needed.

### `functions/api/auth-me.js` — add ban status

Include `vault_banned` in the existing `auth-me` response by left-joining `cc_vault_bans`. This piggybacks on an already-required auth call, adding zero extra network requests. The sidebar and vault page both have access to this via `AuthContext`.

```js
// In the auth-me query, add:
LEFT JOIN cc_vault_bans vb ON vb.user_id = u.id
// Include in response:
vault_banned: !!row.banned_at
```

## Frontend Changes

### `AuthContext`

Store `vaultBanned` from the `auth-me` response. Expose via `useAuth()`. This makes ban status available app-wide without extra API calls.

### `VaultPage.jsx`

Check ban status from `AuthContext` before rendering `VaultProvider`, so the vault data load never fires for banned users:

```js
const { user, vaultBanned } = useAuth()

if (vaultBanned) {
  navigate('/', { replace: true })
  return null
}
```

Silent redirect. No message, no flash of vault content.

### `GlobalSidebar.jsx`

The vault link (line ~369) — add `!vaultBanned` to the existing visibility condition:

```js
{(FEATURE_FLAGS.CARD_CLASH_RELEASED || isAdmin || hasPermission('codex_edit')) && !vaultBanned && (
  <SidebarLink to="/vault" ...>
```

`vaultBanned` comes from `useAuth()`, which is already available in the sidebar.

### Vault Admin Panel

In the existing users list, add a ban/unban button per user row. Shows a red badge or indicator when a user is banned. Clicking toggles the ban via `ban-user` / `unban-user` actions.

## What's NOT affected

- `/vault/share/:token` — public, no auth, no ban check
- `/vault/binder/:token` — public, no auth, no ban check
- `/vault-dashboard/*` — separate permission system (`vault_member`), unaffected
- `/admin/vault` — admin panel, unaffected (admins manage bans here)

## Edge Cases

- Banning a user who doesn't have a `cc_stats` row yet: works fine, `cc_vault_bans` references `users(id)` not `cc_stats`
- Banning a user who is already banned: `ON CONFLICT DO NOTHING`, idempotent
- Unbanning a user who isn't banned: delete returns 0 rows, no error
- User is on `/vault` when banned: next API call or page refresh will trigger redirect
- Ban status in sidebar updates on next page refresh (auth-me re-fetch)

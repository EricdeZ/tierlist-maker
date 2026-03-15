# Vault Avatar R2 Migration

**Date**: 2026-03-15
**Status**: Draft

## Problem

Player card avatars in The Vault use Discord CDN URLs (`cdn.discordapp.com/avatars/{id}/{hash}.webp`). These URLs break when users change their Discord avatar because the hash changes. This means cards pulled weeks ago can show broken images. The system also depends on Discord CDN availability and offers no permanence guarantee for trading card imagery.

Additionally, at least 6 SQL queries and 3 JS formatters construct Discord CDN URLs inline rather than reading the stored `avatar_url` from `cc_player_defs`. This duplication means the URL pattern is scattered across the codebase.

## Solution

Snapshot Discord avatars to Cloudflare R2 at player def generation time. Each card captures the player's avatar as it was when the def was created — like a real trading card. The existing R2 infrastructure (bucket, serving endpoint, upload utilities) handles storage and delivery. All inline Discord URL construction for card images is replaced by reading `d.avatar_url` from the def.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| When to snapshot | At def generation (`upsertPlayerDef`) | Natural snapshot moment alongside team, role, stats |
| Update policy | Snapshot once, skip if R2 URL already exists | Trading card permanence; new season defs get fresh snapshots naturally |
| Migration | Backfill all existing defs | Clean cutover, no dual-path URL logic |
| Failure handling | Leave `avatar_url` NULL | Frontend fallback chain (god art / initials) already handles this |
| R2 prefix | `vault-assets/avatars/` | Reuses existing `vault-assets/` allowed prefix |

## Architecture

### R2 Key Format

```
vault-assets/avatars/{player_id}-{season_id}.webp
```

Under the existing `vault-assets/` prefix (already in `ALLOWED_PREFIXES`). Scoped by season so different season defs for the same player don't collide. Each season's card is its own snapshot.

### Stable Avatar URL

`buildImageUrl()` appends a cache-busting `v=${Date.now()}` timestamp, which makes URLs non-deterministic. For avatars, use a stable URL builder:

```javascript
export function buildStableImageUrl(key) {
  return `/api/r2-image?key=${encodeURIComponent(key)}`
}
```

No cache-busting parameter — the R2 key is immutable (snapshot once), so the URL should be stable. This allows detecting "already migrated" by checking if `avatar_url` starts with `/api/r2-image`.

### New Helper: `uploadAvatarFromUrl`

Added to `functions/lib/r2.js`:

```javascript
export async function uploadAvatarFromUrl(bucket, sourceUrl, key) {
  const res = await fetch(sourceUrl)
  if (!res.ok) return null
  const bytes = new Uint8Array(await res.arrayBuffer())
  if (bytes.length === 0 || bytes.length > MAX_SIZE) return null
  const contentType = res.headers.get('content-type') || 'image/webp'
  if (!ALLOWED_TYPES.includes(contentType)) return null
  if (!validateMagicBytes(bytes, contentType)) return null
  await bucket.put(key, bytes, { httpMetadata: { contentType } })
  return buildStableImageUrl(key)
}
```

Fetches an image from a URL, validates it (size, type, magic bytes), uploads to R2, and returns the stable API-served URL. Returns `null` on any failure.

### Modified: `upsertPlayerDef` in `vault-defs.js`

Current flow:
1. Query user's Discord ID + avatar hash
2. Build Discord CDN URL -> store in `avatar_url`

New flow:
1. Query user's Discord ID + avatar hash
2. Check if existing def already has an R2 URL (starts with `/api/r2-image`) — if so, skip upload (snapshot once)
3. Build Discord CDN URL
4. Call `uploadAvatarFromUrl(bucket, discordUrl, 'vault-assets/avatars/{playerId}-{seasonId}.webp')`
5. Store the returned R2 URL in `avatar_url` (or NULL on failure)

On the UPDATE path, `avatar_url` is only overwritten if the existing value is not already an R2 URL. This enforces the "snapshot once" policy.

The function signature gains a `bucket` parameter (R2 binding), threaded down from the calling endpoint. Both `generatePlayerDefs()` and `generateSelectedDefs()` must thread the bucket through to `upsertPlayerDef()`.

### Modified: `user-preferences.js` — Avatar Toggle

**Disabling** (`allow_discord_avatar = false`):
- Current: Sets `avatar_url = NULL` on `cc_player_defs` where URL matches Discord CDN pattern; clears `image_url` on `cc_cards` where URL matches Discord CDN pattern
- New: Both queries match either Discord CDN pattern OR R2 avatar pattern (`/api/r2-image%`)
- R2 objects are NOT deleted (tiny, orphaned, harmless — avoids needing the bucket binding in this endpoint)

**Enabling** (`allow_discord_avatar = true`):
- Current: Reconstructs Discord CDN URL and sets it on matching defs
- New: Same behavior — sets the Discord CDN URL directly. The next def regeneration will snapshot it to R2.
- **Chosen approach**: Keep it simple. No R2 upload in the preferences endpoint.

### Eliminating Inline Discord URL Construction

The core cleanup: multiple SQL queries and JS formatters construct Discord CDN URLs inline for **card images** instead of reading `d.avatar_url`. After migration, `d.avatar_url` is the canonical source for card images. All these sites must be updated.

**SQL queries that construct Discord URLs inline (replace with `d.avatar_url`):**

| File | Location | Current Pattern |
|------|----------|-----------------|
| `vault.js` | Recent pulls (~line 598) | SQL CASE building Discord URL from joined users table |
| `vault.js` | `handleCollectionSet` (~line 658) | SQL CASE preferring live Discord URL over `d.avatar_url` |
| `vault.js` | `handleCollectionSearch` (~line 702) | Same "prefer live Discord" pattern |

All of these should be simplified to:
```sql
CASE WHEN COALESCE(up.allow_discord_avatar, true) THEN d.avatar_url ELSE NULL END AS avatar_url
```

**`handleSharedCard` (~line 473)** is a special case: it queries `players` joined to `users` directly and does not query `cc_player_defs`. Since a player can have multiple defs across seasons, this endpoint should join to `cc_player_defs` and pick the most recent season's def to get the R2 avatar URL:
```sql
LEFT JOIN cc_player_defs d ON d.player_id = p.id
  AND d.avatar_url IS NOT NULL
ORDER BY d.season_id DESC LIMIT 1
```

**JS formatters that construct Discord URLs inline:**

| File | Function | Line |
|------|----------|------|
| `vault.js` | `formatCard()` | ~2006 |
| `trading.js` | `formatTradeCard()` | ~262 |
| `marketplace.js` | `formatListing()` | ~249 |

These formatters check `player_discord_id`/`player_discord_avatar` and build Discord CDN URLs for player card images. After migration, they should read from the def's stored `avatar_url` (already the R2 URL). The `imageUrl` for player cards becomes simply `row.avatar_url || ''`.

**SQL queries feeding `formatCard()` also need updating.** These currently SELECT `player_discord_id`/`player_discord_avatar` from joined users tables. They should instead SELECT `d.avatar_url` (and respect `allow_discord_avatar`). The affected SQL queries:
- Main collection query (vault.js)
- Binder cards — own binder (~line 1823)
- Binder cards — shared binder (~line 1865)

**What stays on Discord CDN (user profile avatars, NOT card images):**
- `trading.js` `avatarUrl()` helper (line 277) — trade partner avatars (64px)
- `marketplace.js` `sellerAvatar` (line 235) — seller profile avatars (64px)
- `bounty.js` — bounty creator/gift avatars
- `vault-dashboard.js` — binder owner avatars
- `forge.js` `discordAvatarUrl` (line 282) — player profile avatars on stock listings
- `vault.js` gift system avatars — sender/recipient identity

These are user identity avatars, not trading card images. They stay on Discord CDN.

### Bounty Endpoint

`bounty.js` has COALESCE logic: `COALESCE(pd.avatar_url, discord_cdn_fallback)`. After migration, `pd.avatar_url` will be an R2 URL for defs that have one, and the Discord CDN fallback only fires for defs where R2 upload failed (NULL). This is the correct behavior — no changes needed to bounty.js.

### Backfill Migration

Added as a new action to `vault-admin.js`: `action=backfill-avatars`.

1. Query: `SELECT id, player_id, season_id, avatar_url FROM cc_player_defs WHERE avatar_url LIKE 'https://cdn.discordapp.com/%'`
2. Process in batches of 25 (cursor-based pagination via `id > lastId ORDER BY id LIMIT 25`)
3. For each row:
   - Fetch the Discord image
   - Upload to R2 as `vault-assets/avatars/{player_id}-{season_id}.webp`
   - Update `avatar_url` to the stable R2 URL
   - Track success/failure counts
4. Return `{ migrated, failed, remaining }` — caller re-invokes until `remaining = 0`
5. After all defs are migrated, run:
   ```sql
   UPDATE cc_cards c SET image_url = d.avatar_url
   FROM cc_player_defs d
   WHERE c.def_id = d.id
     AND c.card_type = 'player'
     AND (c.image_url LIKE 'https://cdn.discordapp.com/%' OR c.image_url = '' OR c.image_url IS NULL)
     AND d.avatar_url IS NOT NULL
   ```
   This catches cards with Discord URLs, empty strings (formatters set `''` on failure), and NULLs.

### Frontend

**No changes needed.** All components consume `avatarUrl` as an opaque URL string. Switching from `https://cdn.discordapp.com/...` to `/api/r2-image?key=...` is transparent. The R2 serving endpoint already returns proper `Content-Type` and 1-year immutable cache headers.

## Files Changed

| File | Change |
|------|--------|
| `functions/lib/r2.js` | Add `buildStableImageUrl()`, add `uploadAvatarFromUrl()` |
| `functions/lib/vault-defs.js` | `upsertPlayerDef` gains `bucket` param, uploads avatar to R2, skip if already R2 URL. `generatePlayerDefs` and `generateSelectedDefs` thread bucket param. |
| `functions/api/vault-admin.js` | Thread `env.TEAM_ICONS` bucket to def generation calls, add `backfill-avatars` action |
| `functions/api/vault.js` | Replace 4 inline Discord URL constructions with `d.avatar_url`; update `formatCard()` to use stored URL |
| `functions/api/trading.js` | Update `formatTradeCard()` card imageUrl to use stored URL instead of inline Discord construction |
| `functions/api/marketplace.js` | Update `formatListing()` card imageUrl to use stored URL instead of inline Discord construction |
| `functions/api/user-preferences.js` | Update disable pattern to also match R2 URLs (`/api/r2-image%`) |

## What Doesn't Change

- `cc_player_defs` schema — still uses `avatar_url` TEXT column
- Frontend components — consume URL opaquely
- Fallback chain — NULL avatar -> god card art -> initials
- User profile avatars (trading partners, sellers, bounty creators, binder owners) — these aren't card images, stay on Discord CDN
- R2 serving endpoint (`r2-image.js`) — already handles `vault-assets/` prefix
- `bounty.js` — COALESCE logic already prefers `pd.avatar_url`, falls back correctly
- Gift system avatars in `vault.js` — user identity, not card images

## Edge Cases

- **User has no Discord avatar**: `avatar_url` stays NULL, fallback chain handles it
- **Discord CDN down during def generation**: fetch fails, `avatar_url` stays NULL
- **User disables avatar after R2 snapshot**: `avatar_url` cleared to NULL, R2 object orphaned (negligible storage)
- **User re-enables avatar**: Gets Discord CDN URL until next def generation snapshots to R2
- **Same player, multiple seasons**: Different R2 keys (`{player_id}-{season_id}`), each season is its own snapshot
- **Def re-generated for existing player**: R2 URL already present, upload skipped (snapshot once)
- **Backfill hits Discord CDN rate limit or timeout**: Cursor-based batching, caller re-invokes with remaining count
- **`cc_cards.image_url` is empty string**: Backfill WHERE clause handles `= ''` and `IS NULL`

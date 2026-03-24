# Vault Database Query Optimization

## Problem

Neon billing shows 399 GB network transfer ($29.91) and 140 compute hours ($14.91) per month. `pg_stat_statements` reveals the passion balance endpoint accounts for ~48% of all database traffic — ~2.4M calls generating ~16.8M queries. Root causes:

1. `PassionContext` fires `refreshBalance()` on every route navigation (7 queries each)
2. Each balance call is 7 separate HTTP round-trips to Neon
3. `refreshBalanceWithRetry()` in VaultContext doubles every balance call (immediate + 3s delayed retry)
4. Backend fires `getVaultStats()` + `pushChallengeProgress()` (7-10 queries) after every vault action
5. Static vault API endpoints have no cache headers despite returning identical data for all users

## Evidence

Top application queries from `pg_stat_statements`:

| Query | Calls |
|-------|-------|
| `SELECT ... FROM users` (auth) | 5,034,412 |
| `INSERT INTO passion_balances ON CONFLICT` | 3,712,079 |
| `SELECT balance FROM passion_balances` | 2,480,133 |
| `INSERT INTO ember_balances ON CONFLICT` | 2,466,315 |
| `SELECT COUNT(*) FROM user_challenges` (total) | 2,413,969 |
| `SELECT balance, total_earned... FROM passion_balances` | 2,369,622 |
| `SELECT EXISTS(discord_guild_members)` | 2,217,723 |
| `SELECT balance... FROM ember_balances` | 2,176,489 |
| `SELECT COUNT(*) FROM user_challenges` (vault) | 1,274,769 |

## Changes

### 1. Throttle PassionContext Route-Change Refresh

**File:** `src/context/PassionContext.jsx`

Add a `lastRefreshTime` ref. The route-change `useEffect` (line 79-82) skips the call if last refresh was <30s ago. Action-triggered manual refreshes (e.g., after `claimDaily`) always execute immediately.

`refreshBalance()` sets `lastRefreshTime.current = Date.now()` on each call.

**Exception:** Add an optional `force` parameter to `refreshBalance(force = false)`. When `force` is true, skip the staleness check. The challenges page component calls `refreshBalance(true)` on mount so challenge counts are always accurate when the user is looking at them.

**Impact:** ~90% reduction in passion balance calls. From ~2.4M to ~240K calls/month.

### 2. Consolidate Passion Balance Queries into Single CTE

**File:** `functions/api/passion.js` — `getBalance()` function

Replace 7 separate queries with a single CTE:

```sql
WITH ensure_passion AS (
  INSERT INTO passion_balances (user_id) VALUES ($1)
  ON CONFLICT (user_id) DO NOTHING RETURNING 1
), ensure_ember AS (
  INSERT INTO ember_balances (user_id) VALUES ($1)
  ON CONFLICT (user_id) DO NOTHING RETURNING 1
), pb AS (
  SELECT balance, total_earned, total_spent,
         last_daily_claim, current_streak, longest_streak
  FROM passion_balances WHERE user_id = $1
), eb AS (
  SELECT balance, last_daily_claim, current_streak, longest_streak,
         conversions_today, last_conversion_date::text
  FROM ember_balances WHERE user_id = $1
), claimable AS (
  SELECT COUNT(*) as total_count,
         COUNT(*) FILTER (WHERE c.category = 'vault') as vault_count
  FROM user_challenges uc
  JOIN challenges c ON c.id = uc.challenge_id
  WHERE uc.user_id = $1
    AND uc.completed = false
    AND uc.current_value >= c.target_value
    AND c.is_active = true
), discord AS (
  SELECT EXISTS(
    SELECT 1 FROM discord_guild_members dgm
    JOIN users u ON u.discord_id = dgm.discord_id
    WHERE u.id = $1
  ) as in_discord
)
SELECT
  pb.balance AS passion_balance,
  pb.total_earned, pb.total_spent,
  pb.last_daily_claim AS passion_last_claim,
  pb.current_streak AS passion_streak,
  pb.longest_streak AS passion_longest_streak,
  eb.balance AS ember_balance,
  eb.last_daily_claim AS ember_last_claim,
  eb.current_streak AS ember_streak,
  eb.longest_streak AS ember_longest_streak,
  eb.conversions_today, eb.last_conversion_date,
  claimable.total_count, claimable.vault_count,
  discord.in_discord
FROM pb, eb, claimable, discord
```

Column aliases are required because `pb` and `eb` share column names (`balance`, `last_daily_claim`, `current_streak`, `longest_streak`) — the Neon driver returns a flat object, so duplicates would silently overwrite.

This merges the two `user_challenges COUNT` queries (previously 2.4M + 1.3M calls) into one with `FILTER`. Each balance call drops from 7 HTTP round-trips to 1.

The `ensureEmberBalance` import from `functions/lib/ember.js` becomes unused in `passion.js` after this change — remove it.

**Impact:** Each remaining balance call costs 1 query instead of 7. Combined with throttle: ~240K queries/month instead of ~16.8M.

### 3. Remove 3s Delayed Retry from refreshBalanceWithRetry

**File:** `src/pages/vault/VaultContext.jsx`

Remove the `setTimeout` 3s retry from `refreshBalanceWithRetry()`. Currently it calls `refreshBalance()` twice (now + 3s) after every vault action. The retry existed to catch fire-and-forget challenge progress updates on the backend.

Replace with: single immediate call only. The 30s route-change throttle (Section 1) will pick up any challenge progress on the next natural refresh.

**Counterbalance:** When the user navigates to the challenges page/tab, force a fresh `refreshBalance()` that bypasses the 30s throttle. This ensures challenge counts are accurate when the user is actively looking at them.

**Impact:** Halves passion balance calls from vault actions.

### 4. Backend Challenge Push Cooldown

**Files:** `functions/api/vault.js`, new migration for `cc_stats.last_challenge_push`

Add a `last_challenge_push` timestamptz column to `cc_stats`. Before running the `getVaultStats()` + `pushChallengeProgress()` fire-and-forget chain, check if the last push was <10s ago. If so, skip.

Use an atomic UPDATE-RETURNING to avoid the race condition where two concurrent requests both read a stale timestamp and both proceed:

```js
async function maybePushChallenges(sql, userId) {
    const [claimed] = await sql`
        UPDATE cc_stats
        SET last_challenge_push = NOW()
        WHERE user_id = ${userId}
          AND (last_challenge_push IS NULL OR last_challenge_push < NOW() - INTERVAL '10 seconds')
        RETURNING 1
    `
    if (!claimed) return // Another request pushed recently — skip
    const stats = await getVaultStats(sql, userId)
    return pushChallengeProgress(sql, userId, stats)
}
```

If the UPDATE returns a row, proceed with the push. If it returns nothing, another request pushed within the last 10s — skip. This is atomic and race-free. Note: `ensureStats(sql, userId)` must be called before `maybePushChallenges` at call sites where the `cc_stats` row may not exist yet (the UPDATE would match zero rows for a missing user, correctly falling through to skip — but we want to push for first-time users). Existing call sites already call `ensureStats` before the challenge push, so no change needed at those sites.

Replace all 11 `getVaultStats().then(pushChallengeProgress)` call sites in `vault.js` with `maybePushChallenges()`.

**Impact:** Rapid-fire actions (opening multiple packs, bulk dismantles) fire the challenge chain once per 10s window instead of per action. Saves 7-10 queries per skipped push. ~60-70% reduction in challenge-related queries.

### 5. Cache Headers for Static Vault API Endpoints

**File:** `functions/api/vault.js`

Add `Cache-Control` headers to three read-only, non-personalized endpoints:

| Action | Cache Header |
|--------|-------------|
| `collection-catalog` | `public, max-age=3600` (1 hour) |
| `collection-set` | `public, max-age=3600` (1 hour) |
| `definition-overrides` | `public, max-age=1800` (30 min) |

These are not scoped to the requesting user. The data is mutable (e.g., player avatars can change), but changes are infrequent enough that a 30-60 minute cache is acceptable. The browser caches the response and avoids hitting the backend entirely on repeat visits.

**Hard constraint:** Never cache HTML responses (index.html). These headers apply only to API JSON endpoints.

**Impact:** Moderate — each cached hit saves 1 query + 1 auth query. The catalog is hit once per collection page load.

## Migration

```sql
ALTER TABLE cc_stats ADD COLUMN IF NOT EXISTS last_challenge_push timestamptz;
```

## Files Changed

| File | Change |
|------|--------|
| `src/context/PassionContext.jsx` | Add 30s throttle on route-change refresh |
| `src/pages/vault/VaultContext.jsx` | Remove 3s delayed retry |
| `functions/api/passion.js` | Consolidate `getBalance()` to single CTE |
| `functions/api/vault.js` | Add `maybePushChallenges()`, cache headers on 3 endpoints |
| `database/migrations/XXX-challenge-push-cooldown.sql` | Add `last_challenge_push` column |
| Challenges page component | Force refresh on mount (bypass throttle) |

## Expected Total Impact

| Metric | Before | After | Reduction |
|--------|--------|-------|-----------|
| Passion balance calls/month | ~2.4M | ~240K | ~90% |
| Queries per balance call | 7 | 1 | ~86% |
| Challenge push chains/month | ~1M+ | ~300K | ~70% |
| Queries per challenge push | 7-10 | 7-10 (when not skipped) | — |
| **Estimated total query reduction** | | | **~75-80%** |

## UX Impact

- Badge counts may be up to 30s stale during routine navigation — unnoticeable
- Challenges page always shows fresh data (forced refresh on mount)
- Challenge progress during rapid actions updates on the first action in each 10s window; subsequent actions in that window are caught on the next push
- Collection catalog/set data may be up to 1hr stale after admin changes — acceptable for metadata
- No impact on action responsiveness — all changes are to background/refresh logic

## Rollback

All five changes are independently revertable. If any single change causes issues, it can be reverted without affecting the others. The migration (Section 4) adds a nullable column with no default, so rolling back the code change is sufficient — the column can stay.

## Not In Scope

- Auth query optimization (1-2 queries per request — acceptable overhead)
- Vault `action=load` query consolidation (22 queries but only fires once per session)
- Frontend state management library (React Query, SWR) — manual approach is working fine
- N+1 fixes in admin endpoints (low traffic, admin-only)

# Vault Database Query Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce Neon database query volume by ~75-80% by throttling the passion balance endpoint, consolidating queries into a single CTE, removing redundant retries, adding backend challenge push cooldowns, and caching static vault API responses.

**Architecture:** Five independent changes targeting the top query sources identified via `pg_stat_statements`. Frontend throttling (PassionContext 30s cooldown + VaultContext retry removal) cuts call frequency. Backend CTE consolidation cuts per-call cost from 7 queries to 1. Backend cooldown deduplicates rapid-fire challenge pushes. Cache headers eliminate repeated fetches of static data.

**Tech Stack:** React 19, Cloudflare Pages Functions, PostgreSQL on Neon (`@neondatabase/serverless`), neon() tagged template literals

**Spec:** `docs/superpowers/specs/2026-03-24-vault-db-optimization-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/context/PassionContext.jsx` | Modify | Add 30s throttle + `force` param to `refreshBalance` |
| `src/pages/vault/VaultContext.jsx` | Modify | Remove 3s delayed retry, simplify `refreshBalanceWithRetry` |
| `src/pages/Challenges.jsx` | Modify | Force-refresh balance on mount |
| `functions/api/passion.js` | Modify | Replace 7-query `getBalance` with single CTE |
| `functions/api/vault.js` | Modify | Add `maybePushChallenges()`, replace 11 call sites, add cache headers |
| `database/migrations/143-challenge-push-cooldown.sql` | Create | Add `last_challenge_push` column to `cc_stats` |

---

### Task 1: Throttle PassionContext Route-Change Refresh

**Files:**
- Modify: `src/context/PassionContext.jsx:25-82`

- [ ] **Step 1: Add `lastRefreshTime` ref and `force` parameter**

In `PassionContext.jsx`, add a ref after `initialLoadDone` (line 25) and modify `refreshBalance`:

```jsx
// After line 25:
const lastRefreshTime = useRef(0)

// Replace refreshBalance (lines 30-50) with:
const refreshBalance = useCallback(async (force = false) => {
    if (!user) return
    if (!force && Date.now() - lastRefreshTime.current < 30000) return
    lastRefreshTime.current = Date.now()
    try {
        const data = await passionService.getBalance()
        setBalance(data.balance)
        setTotalEarned(data.totalEarned)
        setCurrentStreak(data.currentStreak)
        setLongestStreak(data.longestStreak)
        setCanClaimDaily(data.canClaimDaily)
        setLastDailyClaim(data.lastDailyClaim || null)
        setClaimableCount(data.claimableCount || 0)
        setVaultClaimableCount(data.vaultClaimableCount || 0)
        setInDiscord(!!data.inDiscord)
        if (data.ember) setEmber(prev => {
            if (prev.balance === data.ember.balance && prev.currentStreak === data.ember.currentStreak && prev.canClaimDaily === data.ember.canClaimDaily && prev.lastDailyClaim === data.ember.lastDailyClaim) return prev
            return data.ember
        })
    } catch (err) {
        console.error('Failed to fetch passion balance:', err)
    }
}, [user])
```

The route-change effect (lines 79-82) stays the same — it calls `refreshBalance()` without `force`, so it's subject to the 30s throttle. The initial load effect (line 72) also calls without `force` but will always pass since `lastRefreshTime` starts at 0.

- [ ] **Step 2: Verify app starts and navigates without errors**

Run: `npm start`

Navigate between a few pages. Open browser devtools Network tab, filter for `passion`. Confirm that rapid navigations (<30s apart) do NOT fire `/api/passion?action=balance`. Confirm the first load still fires.

- [ ] **Step 3: Commit**

```bash
git add src/context/PassionContext.jsx
git commit -m "perf: throttle PassionContext route-change refresh to 30s cooldown"
```

---

### Task 2: Remove 3s Delayed Retry from VaultContext

**Files:**
- Modify: `src/pages/vault/VaultContext.jsx:61-69`

- [ ] **Step 1: Simplify `refreshBalanceWithRetry` to single immediate call**

In `VaultContext.jsx`, replace lines 61-69:

```jsx
// Remove delayedRefreshTimer ref (line 61) and the setTimeout logic (lines 63-68)
// Remove the cleanup effect (line 69)
// Replace with:

// Single immediate balance refresh — no delayed retry
const refreshBalanceWithRetry = useCallback(() => {
    passionCtxRef.current?.refreshBalance?.()
}, [])
```

Delete these lines entirely:
- Line 61: `const delayedRefreshTimer = useRef(null)`
- Lines 63-68: The old `refreshBalanceWithRetry` with setTimeout
- Line 69: `useEffect(() => () => clearTimeout(delayedRefreshTimer.current), [])`

- [ ] **Step 2: Verify vault actions still update balance**

Run: `npm start`

Navigate to the vault, open a pack. Confirm the Cores/Passion balance updates in the UI after the action. The balance should update once (immediately), not twice.

- [ ] **Step 3: Commit**

```bash
git add src/pages/vault/VaultContext.jsx
git commit -m "perf: remove 3s delayed balance retry from VaultContext"
```

---

### Task 3: Force-Refresh Balance on Challenges Page Mount

**Files:**
- Modify: `src/pages/Challenges.jsx:1-10,289`

- [ ] **Step 1: Add force-refresh useEffect**

In `Challenges.jsx`, the component already imports `usePassion` (line 3). Add a force refresh on mount after the existing `loadChallenges` effect (line 289):

First, add `refreshBalance` to the existing `usePassion()` destructuring at line 275:

```jsx
// Before (line 275):
const { updateFromClaim, challengeNotifications } = usePassion()
// After:
const { updateFromClaim, challengeNotifications, refreshBalance } = usePassion()
```

Then add a force-refresh useEffect after the existing `loadChallenges` effect (line 289):

```jsx
useEffect(() => {
    refreshBalance(true) // bypass 30s throttle
}, []) // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 2: Verify challenges page shows fresh data**

Run: `npm start`

Navigate to challenges page. Confirm Network tab shows a `/api/passion?action=balance` request fires even if you just navigated from another page <30s ago.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Challenges.jsx
git commit -m "perf: force-refresh balance on challenges page mount"
```

---

### Task 4: Consolidate Passion Balance into Single CTE

**Files:**
- Modify: `functions/api/passion.js:70-160`

- [ ] **Step 1: Replace `getBalance` function body**

In `passion.js`, replace the entire `getBalance` function (lines 70-160+) with the consolidated CTE version. The response JSON shape must remain identical.

```js
async function getBalance(sql, user) {
    const [row] = await sql`
        WITH ensure_passion AS (
            INSERT INTO passion_balances (user_id) VALUES (${user.id})
            ON CONFLICT (user_id) DO NOTHING RETURNING 1
        ), ensure_ember AS (
            INSERT INTO ember_balances (user_id) VALUES (${user.id})
            ON CONFLICT (user_id) DO NOTHING RETURNING 1
        ), pb AS (
            SELECT balance, total_earned, total_spent,
                   last_daily_claim, current_streak, longest_streak
            FROM passion_balances WHERE user_id = ${user.id}
        ), eb AS (
            SELECT balance, last_daily_claim, current_streak, longest_streak,
                   conversions_today, last_conversion_date::text
            FROM ember_balances WHERE user_id = ${user.id}
        ), claimable AS (
            SELECT COUNT(*) as total_count,
                   COUNT(*) FILTER (WHERE c.category = 'vault') as vault_count
            FROM user_challenges uc
            JOIN challenges c ON c.id = uc.challenge_id
            WHERE uc.user_id = ${user.id}
              AND uc.completed = false
              AND uc.current_value >= c.target_value
              AND c.is_active = true
        ), discord AS (
            SELECT EXISTS(
                SELECT 1 FROM discord_guild_members dgm
                JOIN users u ON u.discord_id = dgm.discord_id
                WHERE u.id = ${user.id}
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
    `

    const rank = getRank(row.total_earned)
    const nextRank = getNextRank(row.total_earned)

    const now = new Date()
    const todayUTC = now.toISOString().slice(0, 10)
    const lastClaimDate = row.passion_last_claim
        ? new Date(row.passion_last_claim).toISOString().slice(0, 10)
        : null
    const canClaimDaily = lastClaimDate !== todayUTC

    // Ember daily claim check
    const emberLastClaim = row.ember_last_claim
        ? new Date(row.ember_last_claim).toISOString().slice(0, 10)
        : null
    const lastConvDate = row.last_conversion_date || null
    let emberConversionsToday = row.conversions_today || 0
    if (lastConvDate && lastConvDate !== todayUTC) {
        emberConversionsToday = 0
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            balance: row.passion_balance,
            totalEarned: row.total_earned,
            totalSpent: row.total_spent,
            currentStreak: row.passion_streak,
            longestStreak: row.passion_longest_streak,
            canClaimDaily,
            claimableCount: parseInt(row.total_count),
            vaultClaimableCount: parseInt(row.vault_count),
            inDiscord: row.in_discord,
            lastDailyClaim: row.passion_last_claim,
            rank: { name: rank.name, division: rank.division, display: formatRank(rank) },
            nextRank: nextRank
                ? { name: nextRank.name, division: nextRank.division, display: formatRank(nextRank), passionNeeded: nextRank.passionNeeded }
                : null,
            ember: {
                balance: row.ember_balance,
                currentStreak: row.ember_streak,
                longestStreak: row.ember_longest_streak,
                canClaimDaily: emberLastClaim !== todayUTC,
                lastDailyClaim: row.ember_last_claim,
                conversionsToday: emberConversionsToday,
                nextConversionCost: getConversionCost(emberConversionsToday),
                conversionEmberAmount: EMBER_RULES.conversion_ember_amount,
                conversionMultiplier: EMBER_RULES.conversion_multiplier,
                conversionBaseCost: EMBER_RULES.conversion_base_passion,
            },
        }),
    }
}
```

- [ ] **Step 2: Remove unused `ensureEmberBalance` import**

In `passion.js` line 13, remove `ensureEmberBalance` from the import:

```js
// Before:
import { ensureEmberBalance, getConversionCost, EMBER_RULES } from '../lib/ember.js'
// After:
import { getConversionCost, EMBER_RULES } from '../lib/ember.js'
```

Check if `ensureEmberBalance` is used elsewhere in this file (e.g., in `claimDaily` or `earn`). Only remove from import if it's truly unused after the `getBalance` change.

- [ ] **Step 3: Verify the balance endpoint returns correct data**

Run: `npm start`

Open the vault or any page that shows passion/ember balance. Confirm all values display correctly: passion balance, ember balance, streaks, daily claim status, claimable challenge counts, discord membership badge.

Compare the response JSON in devtools Network tab against what the old version returned — the shape must be identical.

- [ ] **Step 4: Commit**

```bash
git add functions/api/passion.js
git commit -m "perf: consolidate passion balance from 7 queries to single CTE"
```

---

### Task 5: Add Database Migration for Challenge Push Cooldown

**Files:**
- Create: `database/migrations/143-challenge-push-cooldown.sql`

- [ ] **Step 1: Create migration file**

```sql
ALTER TABLE cc_stats ADD COLUMN IF NOT EXISTS last_challenge_push timestamptz;
```

- [ ] **Step 2: Run migration against the database**

Run via psql using the DATABASE_URL from `.dev.vars`:

```bash
psql "$DATABASE_URL" -f database/migrations/143-challenge-push-cooldown.sql
```

Expected: `ALTER TABLE` with no errors.

- [ ] **Step 3: Commit**

```bash
git add database/migrations/143-challenge-push-cooldown.sql
git commit -m "feat: add last_challenge_push column to cc_stats"
```

---

### Task 6: Add Backend Challenge Push Cooldown

**Files:**
- Modify: `functions/api/vault.js` — lines 413, 509, 593, 1282, 1371, 1634, 2024, 2039, 2053, 2067, 2092

- [ ] **Step 1: Add `maybePushChallenges` helper function**

Near the top of `vault.js`, after the imports and before the handler, add:

```js
async function maybePushChallenges(sql, userId) {
    try {
        const [claimed] = await sql`
            UPDATE cc_stats
            SET last_challenge_push = NOW()
            WHERE user_id = ${userId}
              AND (last_challenge_push IS NULL OR last_challenge_push < NOW() - INTERVAL '10 seconds')
            RETURNING 1
        `
        if (!claimed) return
        const stats = await getVaultStats(sql, userId)
        return pushChallengeProgress(sql, userId, stats)
    } catch (err) {
        console.error('Challenge push failed:', err)
    }
}
```

- [ ] **Step 2: Replace all 11 fire-and-forget call sites**

Find and replace each occurrence of the pattern:

```js
// Old pattern (appears at 11 locations):
getVaultStats(sql, user.id)
    .then(stats => pushChallengeProgress(sql, user.id, stats))
    .catch(err => console.error('Vault challenge push failed:', err))
```

Replace with:

```js
maybePushChallenges(sql, user.id)
```

Find all 11 sites by searching for `getVaultStats(sql,` in `vault.js`. Each is a 3-line block. Replace each with the single-line `maybePushChallenges(sql, user.id)`.

Note: Some call sites pass a different user ID (e.g., trade acceptance pushes for both `trade.player_a_id` and `trade.player_b_id`). Check each site and preserve the correct user ID argument.

- [ ] **Step 3: Verify vault actions still work**

Run: `npm start`

Open a pack. Confirm cards appear normally. Open a second pack quickly (<10s). Confirm it works. The challenge push should only fire for the first pack.

- [ ] **Step 4: Commit**

```bash
git add functions/api/vault.js
git commit -m "perf: add 10s cooldown to vault challenge push to reduce rapid-fire queries"
```

---

### Task 7: Add Cache Headers to Static Vault Endpoints

**Files:**
- Modify: `functions/api/vault.js` — `handleCollectionCatalog`, `handleCollectionSet`, `handleDefinitionOverrides`

- [ ] **Step 1: Add cache headers to `handleCollectionCatalog` response**

Find the return statement in `handleCollectionCatalog` (line 769). Change `headers` to include cache-control:

```js
// Before:
return { statusCode: 200, headers, body: JSON.stringify({ playerSets }) }
// After:
return { statusCode: 200, headers: { ...headers, 'Cache-Control': 'public, max-age=3600' }, body: JSON.stringify({ playerSets }) }
```

- [ ] **Step 2: Add cache headers to `handleCollectionSet` response**

Find the return statement in `handleCollectionSet` (line 966). Same change:

```js
// Before:
return { statusCode: 200, headers, body: JSON.stringify({ cards }) }
// After:
return { statusCode: 200, headers: { ...headers, 'Cache-Control': 'public, max-age=3600' }, body: JSON.stringify({ cards }) }
```

- [ ] **Step 3: Add cache headers to `handleDefinitionOverrides` response**

Find the return statement in `handleDefinitionOverrides` (line 1566). Same change:

```js
// Before:
return { statusCode: 200, headers, body: JSON.stringify({ overrides: map }) }
// After:
return { statusCode: 200, headers: { ...headers, 'Cache-Control': 'public, max-age=1800' }, body: JSON.stringify({ overrides: map }) }
```

- [ ] **Step 4: Verify cache headers in devtools**

Run: `npm start`

Navigate to the vault collection page. In devtools Network tab, find the requests to `vault?action=collection-catalog`, `vault?action=collection-set`, and `vault?action=definition-overrides`. Confirm each has the correct `Cache-Control` header in the response.

- [ ] **Step 5: Commit**

```bash
git add functions/api/vault.js
git commit -m "perf: add cache headers to static vault API endpoints"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Full smoke test**

Run: `npm start`

Test this complete flow:
1. Login → verify passion balance loads
2. Navigate between pages rapidly → verify no balance request on each navigation (check devtools Network)
3. Open vault → verify collection loads, pack types show
4. Open a pack → verify cards appear, balance updates
5. Open another pack quickly → verify it works (challenge push cooldown is transparent)
6. Dismantle cards → verify balance updates
7. Navigate to challenges page → verify a fresh balance request fires (force refresh)
8. Browse collection sets → verify data loads and subsequent visits use cached responses

- [ ] **Step 2: Commit any fixes if needed**

If any issues were found in step 1, fix and commit individually with descriptive messages.

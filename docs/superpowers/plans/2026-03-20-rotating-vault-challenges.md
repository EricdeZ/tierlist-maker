# Rotating Vault Challenges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add daily/weekly/monthly rotating challenges to the vault, randomly assigned per-player from a template pool, awarding Cores and challenge-packs.

**Architecture:** New `cc_challenge_templates` and `cc_challenge_assignments` tables store the challenge pool and per-user state. The existing `pushChallengeProgress()` pipeline is extended to also update rotating assignments using delta-based progress (current stat - baseline snapshot). Assignment rolling happens lazily on page load.

**Tech Stack:** PostgreSQL (Neon), Cloudflare Pages Functions, React 19, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-03-20-rotating-vault-challenges-design.md`

---

## File Structure

| File | Role |
|------|------|
| `database/migrations/128-rotating-challenges.sql` | New tables + seed data |
| `functions/lib/rotating-challenges.js` | Core logic: period calculation, assignment rolling, progress update, claiming |
| `functions/api/challenges.js` | Add `action=rotating` (GET) and `action=claim-rotating` (POST) routes |
| `functions/lib/challenges.js` | Extend `pushChallengeProgress()` to call rotating progress updater |
| `src/services/database.js` | Add `getRotating()` and `claimRotating()` to `challengeService` |
| `src/pages/vault/CCChallenges.jsx` | Add rotating challenges section above permanent challenges |

---

### Task 1: Database Migration

**Files:**
- Create: `database/migrations/128-rotating-challenges.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Rotating challenge template pool
CREATE TABLE cc_challenge_templates (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    cadence TEXT NOT NULL CHECK (cadence IN ('daily', 'weekly', 'monthly')),
    reward_type TEXT NOT NULL CHECK (reward_type IN ('cores', 'pack', 'mixed')),
    reward_cores INTEGER,
    reward_packs INTEGER DEFAULT 1,
    stat_key TEXT NOT NULL,
    target_value INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Per-user challenge assignments
CREATE TABLE cc_challenge_assignments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    template_id INTEGER NOT NULL REFERENCES cc_challenge_templates(id),
    cadence TEXT NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    baseline_value INTEGER NOT NULL DEFAULT 0,
    current_value INTEGER NOT NULL DEFAULT 0,
    completed BOOLEAN DEFAULT false,
    claimed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, template_id, period_start)
);

CREATE INDEX idx_cc_challenge_assignments_active
    ON cc_challenge_assignments (user_id, period_end)
    WHERE claimed = false;

CREATE INDEX idx_cc_challenge_assignments_period
    ON cc_challenge_assignments (user_id, cadence, period_start);

-- Ensure challenge-pack exists (user may have already created it)
INSERT INTO cc_pack_types (id, name, description, cost, cards_per_pack, guarantees, category, enabled, sort_order)
VALUES ('challenge-pack', 'Challenge Pack', 'Awarded from rotating challenges', 0, 3, '{"rare": 1}', 'reward', true, 999)
ON CONFLICT (id) DO NOTHING;

-- Seed daily templates (4 cores, 3 pack, 3 mixed — pool to pick from)
INSERT INTO cc_challenge_templates (title, description, cadence, reward_type, reward_cores, reward_packs, stat_key, target_value) VALUES
-- Daily cores
('Quick Opener', 'Open 2 packs today', 'daily', 'cores', 15, NULL, 'packs_opened', 2),
('Daily Dismantler', 'Dismantle 5 cards today', 'daily', 'cores', 10, NULL, 'cards_dismantled', 5),
('Core Collector', 'Claim your daily Cores', 'daily', 'cores', 10, NULL, 'daily_cores_claimed', 1),
('Converter', 'Convert Passion to Cores twice', 'daily', 'cores', 20, NULL, 'cores_converted', 2),
-- Daily pack
('Pack Prize', 'Open 3 packs today', 'daily', 'pack', NULL, 1, 'packs_opened', 3),
('Trade for Packs', 'Complete a trade today', 'daily', 'pack', NULL, 1, 'trades_completed', 1),
('Market Seller', 'Sell 2 cards on the marketplace', 'daily', 'pack', NULL, 1, 'marketplace_sold', 2),
-- Daily mixed
('Lucky Opener', 'Open 4 packs today', 'daily', 'mixed', 10, 1, 'packs_opened', 4),
('Generous Trader', 'Send a gift pack', 'daily', 'mixed', 10, 1, 'gifts_sent', 1),
('Salvage & Earn', 'Dismantle 8 cards today', 'daily', 'mixed', 15, 1, 'cards_dismantled', 8),
-- Weekly cores
('Weekly Opener', 'Open 10 packs this week', 'weekly', 'cores', 40, NULL, 'packs_opened', 10),
('Marketplace Regular', 'Sell 8 cards this week', 'weekly', 'cores', 35, NULL, 'marketplace_sold', 8),
('Dismantle Spree', 'Dismantle 25 cards this week', 'weekly', 'cores', 30, NULL, 'cards_dismantled', 25),
('Core Hoarder', 'Claim daily Cores 5 times', 'weekly', 'cores', 50, NULL, 'daily_cores_claimed', 5),
-- Weekly pack
('Trade Master', 'Complete 3 trades this week', 'weekly', 'pack', NULL, 2, 'trades_completed', 3),
('Gift Giver', 'Send 3 gift packs this week', 'weekly', 'pack', NULL, 2, 'gifts_sent', 3),
-- Weekly mixed
('Big Spender', 'Open 15 packs this week', 'weekly', 'mixed', 30, 2, 'packs_opened', 15),
('Social Butterfly', 'Send 2 gift packs this week', 'weekly', 'mixed', 25, 1, 'gifts_sent', 2),
-- Monthly cores
('Monthly Marathon', 'Open 40 packs this month', 'monthly', 'cores', 100, NULL, 'packs_opened', 40),
('Market Mogul', 'Sell 30 cards this month', 'monthly', 'cores', 80, NULL, 'marketplace_sold', 30),
-- Monthly pack
('Salvage King', 'Dismantle 80 cards this month', 'monthly', 'pack', NULL, 3, 'cards_dismantled', 80),
('Bounty Hunter', 'Earn 200 Cores from bounties', 'monthly', 'pack', NULL, 3, 'bounty_cores_earned', 200),
-- Monthly mixed
('Pack Legend', 'Open 60 packs this month', 'monthly', 'mixed', 75, 3, 'packs_opened', 60),
('Trading Empire', 'Complete 10 trades this month', 'monthly', 'mixed', 60, 2, 'trades_completed', 10),
('Core Machine', 'Convert Passion 20 times this month', 'monthly', 'mixed', 50, 2, 'cores_converted', 20);
```

- [ ] **Step 2: Run the migration against the database**

Run: `psql $DATABASE_URL -f database/migrations/128-rotating-challenges.sql`
Expected: Tables created, 25 templates seeded.

- [ ] **Step 3: Commit**

```bash
git add database/migrations/128-rotating-challenges.sql
git commit -m "feat(vault): add rotating challenge tables and seed templates"
```

---

### Task 2: Core Backend Logic — `rotating-challenges.js`

**Files:**
- Create: `functions/lib/rotating-challenges.js`

**Reference files to read first:**
- `functions/lib/challenges.js` — existing `pushChallengeProgress()`, `getVaultStats()`, `VAULT_KEYS`
- `functions/lib/ember.js` — `grantEmber()` signature: `(sql, userId, type, amount, description, referenceId = null)`
- `functions/lib/db.js` — `transaction()` helper, `getDB()`
- `functions/api/vault.js:411` — pack inventory insert pattern: `INSERT INTO cc_pack_inventory (user_id, pack_type_id, source) VALUES (...)`

- [ ] **Step 1: Create `functions/lib/rotating-challenges.js` with period helpers**

```js
// Rotating challenge system — assignment, progress, claiming

const CADENCE_SLOTS = {
    daily:   { cores: 1, pack: 1, mixed: 1 },  // 3 total
    weekly:  { cores: 2, pack: 1, mixed: 1 },  // 4 total
    monthly: { cores: 1, pack: 1, mixed: 1 },  // 3 total
}

const CADENCES = ['daily', 'weekly', 'monthly']

// 1-hour grace period for claiming after period ends
const GRACE_MS = 60 * 60 * 1000

/**
 * Calculate period boundaries for a cadence at a given time.
 * All periods use UTC midnight boundaries.
 */
export function getPeriod(cadence, now = new Date()) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

    if (cadence === 'daily') {
        const start = d
        const end = new Date(start.getTime() + 86400000)
        return { start, end }
    }

    if (cadence === 'weekly') {
        // Monday 00:00 UTC
        const day = d.getUTCDay()
        const diff = day === 0 ? 6 : day - 1 // Monday = 0
        const start = new Date(d.getTime() - diff * 86400000)
        const end = new Date(start.getTime() + 7 * 86400000)
        return { start, end }
    }

    if (cadence === 'monthly') {
        const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
        const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
        return { start, end }
    }

    throw new Error(`Invalid cadence: ${cadence}`)
}

export { CADENCE_SLOTS, CADENCES, GRACE_MS }
```

- [ ] **Step 2: Add `rollAssignments()` function**

Append to `functions/lib/rotating-challenges.js`:

```js
/**
 * Ensure the user has rotating challenge assignments for all current periods.
 * Rolls new random assignments for any cadence missing in the current period.
 *
 * @param {object} sql - neon tagged template connection
 * @param {number} userId
 * @param {object} currentStats - user's current vault stats (for baseline snapshots)
 * @returns {Promise<void>}
 */
export async function rollAssignments(sql, userId, currentStats) {
    for (const cadence of CADENCES) {
        const { start, end } = getPeriod(cadence)

        // Check if assignments already exist for this period
        const existing = await sql`
            SELECT 1 FROM cc_challenge_assignments
            WHERE user_id = ${userId} AND cadence = ${cadence}
              AND period_start = ${start}
            LIMIT 1
        `
        if (existing.length > 0) continue

        const slots = CADENCE_SLOTS[cadence]

        // Get available templates grouped by reward_type
        const templates = await sql`
            SELECT id, stat_key, reward_type
            FROM cc_challenge_templates
            WHERE cadence = ${cadence} AND is_active = true
        `

        const byType = { cores: [], pack: [], mixed: [] }
        for (const t of templates) {
            if (byType[t.reward_type]) byType[t.reward_type].push(t)
        }

        // Random selection per reward_type
        const selected = []
        for (const [type, count] of Object.entries(slots)) {
            const pool = byType[type] || []
            const shuffled = pool.sort(() => Math.random() - 0.5)
            selected.push(...shuffled.slice(0, count))
        }

        if (selected.length === 0) continue

        // Batch insert assignments with baseline values
        const userIds = selected.map(() => userId)
        const templateIds = selected.map(t => t.id)
        const cadences = selected.map(() => cadence)
        const starts = selected.map(() => start)
        const ends = selected.map(() => end)
        const baselines = selected.map(t => Number(currentStats[t.stat_key] || 0))

        await sql`
            INSERT INTO cc_challenge_assignments
                (user_id, template_id, cadence, period_start, period_end, baseline_value)
            SELECT
                unnest(${userIds}::int[]),
                unnest(${templateIds}::int[]),
                unnest(${cadences}::text[]),
                unnest(${starts}::timestamptz[]),
                unnest(${ends}::timestamptz[]),
                unnest(${baselines}::int[])
            ON CONFLICT (user_id, template_id, period_start) DO NOTHING
        `
    }
}
```

- [ ] **Step 3: Add `getRotatingChallenges()` function**

Append to `functions/lib/rotating-challenges.js`:

```js
/**
 * Get all active rotating challenge assignments for a user.
 * Groups by cadence with reset timestamps.
 *
 * @param {object} sql
 * @param {number} userId
 * @returns {Promise<object>} { daily: { challenges, resetsAt }, weekly: {...}, monthly: {...} }
 */
export async function getRotatingChallenges(sql, userId) {
    const now = new Date()

    const rows = await sql`
        SELECT a.id as assignment_id, a.cadence, a.period_end,
               a.baseline_value, a.current_value, a.completed, a.claimed,
               t.title, t.description, t.reward_type, t.reward_cores,
               t.reward_packs, t.stat_key, t.target_value
        FROM cc_challenge_assignments a
        JOIN cc_challenge_templates t ON t.id = a.template_id
        WHERE a.user_id = ${userId}
          AND a.period_end > ${new Date(now.getTime() - GRACE_MS)}
          AND a.period_start <= ${now}
        ORDER BY a.cadence, a.id
    `

    const result = {}
    for (const cadence of CADENCES) {
        const { end } = getPeriod(cadence, now)
        const challenges = rows
            .filter(r => r.cadence === cadence)
            .map(r => ({
                assignmentId: r.assignment_id,
                title: r.title,
                description: r.description,
                rewardType: r.reward_type,
                rewardCores: r.reward_cores,
                rewardPacks: r.reward_packs,
                statKey: r.stat_key,
                targetValue: r.target_value,
                currentValue: r.current_value,
                completed: r.completed,
                claimed: r.claimed,
                progress: Math.min(r.current_value / r.target_value, 1),
                expired: new Date(r.period_end) <= now,
            }))
        result[cadence] = { challenges, resetsAt: end.toISOString() }
    }

    return result
}
```

- [ ] **Step 4: Add `updateRotatingProgress()` function**

Append to `functions/lib/rotating-challenges.js`:

```js
/**
 * Update rotating challenge progress based on current stat values.
 * Called from pushChallengeProgress() after permanent challenge updates.
 *
 * @param {object} sql
 * @param {number} userId
 * @param {object} currentStats - { stat_key: currentValue, ... }
 * @returns {Promise<Array>} newly claimable rotating challenges
 */
export async function updateRotatingProgress(sql, userId, currentStats) {
    const statKeys = Object.keys(currentStats)
    if (statKeys.length === 0) return []

    const now = new Date()

    // Get active, unclaimed assignments matching incoming stat keys
    const assignments = await sql`
        SELECT a.id, a.baseline_value, a.current_value, a.completed,
               t.stat_key, t.target_value, t.title
        FROM cc_challenge_assignments a
        JOIN cc_challenge_templates t ON t.id = a.template_id
        WHERE a.user_id = ${userId}
          AND a.period_end > ${now}
          AND a.claimed = false
          AND t.stat_key = ANY(${statKeys})
    `

    if (assignments.length === 0) return []

    const newlyClaimable = []
    const updateIds = []
    const updateValues = []
    const completeIds = []

    for (const a of assignments) {
        const currentStat = Number(currentStats[a.stat_key] || 0)
        const delta = Math.max(0, currentStat - a.baseline_value)

        if (delta !== a.current_value) {
            updateIds.push(a.id)
            updateValues.push(delta)
        }

        if (delta >= a.target_value && !a.completed) {
            completeIds.push(a.id)
            newlyClaimable.push({
                id: a.id,
                title: a.title,
                category: 'vault',
                isRotating: true,
            })
        }
    }

    // Batch update current_value
    if (updateIds.length > 0) {
        await sql`
            UPDATE cc_challenge_assignments
            SET current_value = data.val
            FROM (SELECT unnest(${updateIds}::int[]) AS id, unnest(${updateValues}::int[]) AS val) data
            WHERE cc_challenge_assignments.id = data.id
        `
    }

    // Batch mark completed
    if (completeIds.length > 0) {
        await sql`
            UPDATE cc_challenge_assignments
            SET completed = true
            WHERE id = ANY(${completeIds})
        `
    }

    return newlyClaimable
}
```

- [ ] **Step 5: Add `claimRotatingChallenge()` function**

Append to `functions/lib/rotating-challenges.js`:

```js
import { grantEmber } from './ember.js'
import { transaction } from './db.js'
```

Move this import to the top of the file, then append:

```js
/**
 * Claim a completed rotating challenge. Awards Cores and/or packs.
 * Wrapped in a transaction for atomicity (mixed rewards grant two resources).
 *
 * @param {number} userId
 * @param {number} assignmentId
 * @returns {Promise<object>} { success, coresEarned, packsEarned, emberBalance }
 */
export async function claimRotatingChallenge(userId, assignmentId) {
    const now = new Date()

    return await transaction(async (sql) => {
        // Lock and validate the assignment
        const [assignment] = await sql`
            SELECT a.id, a.completed, a.claimed, a.period_end,
                   t.title, t.reward_type, t.reward_cores, t.reward_packs
            FROM cc_challenge_assignments a
            JOIN cc_challenge_templates t ON t.id = a.template_id
            WHERE a.id = ${assignmentId} AND a.user_id = ${userId}
            FOR UPDATE
        `

        if (!assignment) throw new Error('Assignment not found')
        if (!assignment.completed) throw new Error('Challenge not yet complete')
        if (assignment.claimed) throw new Error('Already claimed')

        // Check expiry with grace period
        const expiry = new Date(new Date(assignment.period_end).getTime() + GRACE_MS)
        if (now > expiry) throw new Error('Challenge expired')

        // Mark claimed
        await sql`
            UPDATE cc_challenge_assignments SET claimed = true
            WHERE id = ${assignmentId}
        `

        let coresEarned = 0
        let packsEarned = 0

        // Grant Cores
        if ((assignment.reward_type === 'cores' || assignment.reward_type === 'mixed') && assignment.reward_cores > 0) {
            await grantEmber(sql, userId, 'rotating_challenge', assignment.reward_cores,
                `Rotating: ${assignment.title}`, String(assignmentId))
            coresEarned = assignment.reward_cores
        }

        // Grant packs
        if ((assignment.reward_type === 'pack' || assignment.reward_type === 'mixed') && assignment.reward_packs > 0) {
            await sql`
                INSERT INTO cc_pack_inventory (user_id, pack_type_id, source)
                SELECT ${userId}, 'challenge-pack', 'challenge'
                FROM generate_series(1, ${assignment.reward_packs})
            `
            packsEarned = assignment.reward_packs
        }

        // Get updated ember balance
        const [balanceRow] = await sql`
            SELECT balance FROM ember_balances WHERE user_id = ${userId}
        `

        return {
            success: true,
            coresEarned,
            packsEarned,
            emberBalance: balanceRow?.balance || 0,
        }
    })
}
```

- [ ] **Step 6: Commit**

```bash
git add functions/lib/rotating-challenges.js
git commit -m "feat(vault): add rotating challenge core logic — periods, rolling, progress, claiming"
```

---

### Task 3: Extend `pushChallengeProgress()` to Update Rotating Assignments

**Files:**
- Modify: `functions/lib/challenges.js:1-6` (imports) and `functions/lib/challenges.js:54-96` (`pushChallengeProgress` function)

**Reference:** Read `functions/lib/rotating-challenges.js` (just created in Task 2) for the `updateRotatingProgress` export.

- [ ] **Step 1: Add import at top of `functions/lib/challenges.js`**

After the existing import line (`import { revokePassion } from './passion.js'`), add:

```js
import { updateRotatingProgress } from './rotating-challenges.js'
```

- [ ] **Step 2: Extend `pushChallengeProgress()` to also update rotating assignments**

At the end of the `pushChallengeProgress` function, before the `return newlyClaimable` line (line 95), add:

```js
    // Also update rotating challenge progress
    try {
        const rotatingClaimable = await updateRotatingProgress(sql, userId, currentStats)
        newlyClaimable.push(...rotatingClaimable)
    } catch (err) {
        console.error('Rotating challenge progress update failed:', err)
    }
```

- [ ] **Step 3: Commit**

```bash
git add functions/lib/challenges.js
git commit -m "feat(vault): extend pushChallengeProgress to update rotating assignments"
```

---

### Task 4: API Endpoint — GET `action=rotating` and POST `action=claim-rotating`

**Files:**
- Modify: `functions/api/challenges.js:1-6` (imports), `functions/api/challenges.js:14-42` (route handler)

**Reference files to read first:**
- `functions/api/challenges.js` — full file for route structure and existing patterns
- `functions/lib/rotating-challenges.js` — `rollAssignments`, `getRotatingChallenges`, `claimRotatingChallenge`
- `functions/lib/challenges.js` — `getVaultStats` for baseline snapshots

- [ ] **Step 1: Add imports to `functions/api/challenges.js`**

After the existing imports at the top, add:

```js
import { rollAssignments, getRotatingChallenges, claimRotatingChallenge, updateRotatingProgress } from '../lib/rotating-challenges.js'
import { getVaultStats } from '../lib/challenges.js'
```

- [ ] **Step 2: Add GET `action=rotating` route**

In the GET handler section (line 17-20), change:

```js
        if (event.httpMethod === 'GET') {
            // Auth is optional for GET — unauthenticated users see challenges without progress
            const user = await requireAuth(event)
            return await listChallenges(sql, user)
        }
```

to:

```js
        if (event.httpMethod === 'GET') {
            if (action === 'rotating') {
                const user = await requireAuth(event)
                if (!user) {
                    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Login required' }) }
                }
                return await handleGetRotating(sql, user)
            }
            // Auth is optional for GET — unauthenticated users see challenges without progress
            const user = await requireAuth(event)
            return await listChallenges(sql, user)
        }
```

- [ ] **Step 3: Add POST `action=claim-rotating` route**

In the POST switch statement (line 30-34), add a case before `default`:

```js
                case 'claim-rotating':
                    return await handleClaimRotating(sql, user, event)
```

- [ ] **Step 4: Implement `handleGetRotating()` function**

Add after the existing `listChallenges` function (after line 230):

```js
// ═══════════════════════════════════════════════════
// GET: Rotating challenges — roll if needed, return current
// ═══════════════════════════════════════════════════
async function handleGetRotating(sql, user) {
    // Get current vault stats for baseline snapshots when rolling new assignments
    let vaultStats = {}
    try {
        vaultStats = await getVaultStats(sql, user.id)
    } catch (err) {
        console.error('Failed to get vault stats for rotating baseline:', err)
    }

    // Roll new assignments for any cadence missing in current period
    await rollAssignments(sql, user.id, vaultStats)

    // Refresh progress with latest stats
    await updateRotatingProgress(sql, user.id, vaultStats)

    // Get all current assignments
    const rotating = await getRotatingChallenges(sql, user.id)

    return { statusCode: 200, headers, body: JSON.stringify(rotating) }
}
```

- [ ] **Step 5: Implement `handleClaimRotating()` function**

Add after `handleGetRotating`:

```js
// ═══════════════════════════════════════════════════
// POST: Claim a completed rotating challenge
// ═══════════════════════════════════════════════════
async function handleClaimRotating(sql, user, event) {
    const body = event.body ? JSON.parse(event.body) : {}
    const { assignmentId } = body

    if (!assignmentId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'assignmentId is required' }) }
    }

    try {
        const result = await claimRotatingChallenge(user.id, assignmentId)
        return { statusCode: 200, headers, body: JSON.stringify(result) }
    } catch (err) {
        const msg = err.message
        if (msg === 'Assignment not found') {
            return { statusCode: 404, headers, body: JSON.stringify({ error: msg }) }
        }
        if (msg === 'Already claimed' || msg === 'Challenge not yet complete' || msg === 'Challenge expired') {
            return { statusCode: 400, headers, body: JSON.stringify({ error: msg }) }
        }
        throw err
    }
}
```

- [ ] **Step 6: Commit**

```bash
git add functions/api/challenges.js
git commit -m "feat(vault): add rotating challenge API routes — GET rotating + POST claim-rotating"
```

---

### Task 5: Frontend Service Methods

**Files:**
- Modify: `src/services/database.js:310-317` (challengeService)

**Reference:** Read `src/services/database.js:310-330` for the existing `challengeService` pattern.

- [ ] **Step 1: Add `getRotating()` and `claimRotating()` to `challengeService`**

After the existing `claim` method (line 317), add:

```js
    async getRotating() {
        return apiCall('challenges', { action: 'rotating' })
    },

    async claimRotating(assignmentId) {
        return apiPost('challenges', { action: 'claim-rotating' }, { assignmentId })
    },
```

- [ ] **Step 2: Commit**

```bash
git add src/services/database.js
git commit -m "feat(vault): add rotating challenge service methods"
```

---

### Task 6: Frontend UI — Rotating Challenges Section

**Files:**
- Modify: `src/pages/vault/CCChallenges.jsx`

**Reference files to read first:**
- `src/pages/vault/CCChallenges.jsx` — full file for existing card style, animations, claim flow
- `src/context/PassionContext.jsx` — `updateEmber`, `addChallengeNotification` for reward feedback
- `src/assets/ember.png` — existing Cores icon path

- [ ] **Step 1: Add rotating challenge state and data loading**

In `CCChallenges`, add new state and a loader. After the existing state declarations (lines 31-35), add:

```jsx
const [rotatingData, setRotatingData] = useState(null)
const [rotatingLoading, setRotatingLoading] = useState(true)
const [rotatingClaimingId, setRotatingClaimingId] = useState(null)
const [rotatingJustClaimed, setRotatingJustClaimed] = useState({})
```

After the existing `loadChallenges` useCallback (line 38-43), add:

```jsx
const loadRotating = useCallback(() => {
    if (!user) {
        setRotatingLoading(false)
        return Promise.resolve()
    }
    return challengeService.getRotating()
        .then(data => setRotatingData(data))
        .catch(err => console.error('Failed to load rotating challenges:', err))
        .finally(() => setRotatingLoading(false))
}, [user])
```

Update the initial load useEffect (line 45) to also load rotating:

```jsx
useEffect(() => { loadChallenges(); loadRotating() }, [loadChallenges, loadRotating])
```

Update the 60s polling useEffect (lines 48-53) to also refresh rotating:

```jsx
useEffect(() => {
    const id = setInterval(() => {
        if (document.visibilityState === 'visible') { loadChallenges(); loadRotating() }
    }, 60_000)
    return () => clearInterval(id)
}, [loadChallenges, loadRotating])
```

Update the `handleRefresh` (lines 55-58):

```jsx
const handleRefresh = () => {
    setRefreshing(true)
    Promise.all([loadChallenges(), loadRotating()]).finally(() => setRefreshing(false))
}
```

Update the challenge notification effect (lines 60-62) to also reload rotating:

```jsx
useEffect(() => {
    if (challengeNotifications.length > 0) { loadChallenges(); loadRotating() }
}, [challengeNotifications.length, loadChallenges, loadRotating])
```

- [ ] **Step 2: Add rotating challenge claim handler**

After `handleClaim` (line 94-114), add:

```jsx
const handleClaimRotating = async (assignmentId, buttonEl) => {
    setRotatingClaimingId(assignmentId)
    try {
        const result = await challengeService.claimRotating(assignmentId)
        if (result.success) {
            spawnFlyingEmber(buttonEl)
            if (result.coresEarned > 0) {
                setTimeout(() => updateEmber({ balance: result.emberBalance }), 700)
            }
            setRotatingJustClaimed(prev => ({
                ...prev,
                [assignmentId]: { cores: result.coresEarned, packs: result.packsEarned }
            }))
            setTimeout(() => {
                const scrollY = window.scrollY
                loadRotating().then(() => {
                    requestAnimationFrame(() => window.scrollTo(0, scrollY))
                })
            }, 900)
        }
    } catch (err) {
        console.error('Failed to claim rotating challenge:', err)
    } finally {
        setRotatingClaimingId(null)
    }
}
```

Note: `updateEmber` needs to be destructured from `usePassion()`. Update the existing destructure (line 30) to include it:

```jsx
const { updateFromClaim, challengeNotifications, updateEmber } = usePassion()
```

- [ ] **Step 3: Add `RotatingSection` component and countdown timer**

Add these new components after the `spawnFlyingEmber` function (after line 375):

```jsx
function useCountdown(targetIso) {
    const [timeLeft, setTimeLeft] = useState('')
    useEffect(() => {
        const update = () => {
            const diff = new Date(targetIso) - Date.now()
            if (diff <= 0) { setTimeLeft('Resetting...'); return }
            const h = Math.floor(diff / 3600000)
            const m = Math.floor((diff % 3600000) / 60000)
            if (h >= 24) {
                const d = Math.floor(h / 24)
                setTimeLeft(`${d}d ${h % 24}h`)
            } else {
                setTimeLeft(`${h}h ${m}m`)
            }
        }
        update()
        const id = setInterval(update, 60000)
        return () => clearInterval(id)
    }, [targetIso])
    return timeLeft
}


function RotatingSection({ data, claimingId, justClaimed, onClaim, isLoggedIn }) {
    const [activeTab, setActiveTab] = useState('daily')
    if (!data) return null

    const tabs = [
        { key: 'daily', label: 'Daily' },
        { key: 'weekly', label: 'Weekly' },
        { key: 'monthly', label: 'Monthly' },
    ]

    const current = data[activeTab]
    if (!current) return null

    return (
        <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
                <h2 className="cd-head text-lg font-bold text-[var(--cd-gold)] tracking-wider">
                    Rotating Challenges
                </h2>
            </div>

            {/* Cadence tabs */}
            <div className="flex gap-1.5 mb-4">
                {tabs.map(tab => {
                    const isActive = activeTab === tab.key
                    const tabData = data[tab.key]
                    const claimableCount = tabData?.challenges?.filter(c => c.completed && !c.claimed && !c.expired).length || 0
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`
                                px-3 py-1.5 rounded-lg text-xs font-bold cd-head tracking-wider transition-all cursor-pointer
                                ${isActive
                                    ? 'bg-[var(--cd-gold)]/20 text-[var(--cd-gold)] border border-[var(--cd-gold)]/40'
                                    : 'bg-white/[0.04] text-white/40 border border-white/[0.06] hover:text-white/60 hover:bg-white/[0.06]'
                                }
                            `}
                        >
                            {tab.label}
                            {claimableCount > 0 && (
                                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-[var(--cd-gold)]/30' : 'bg-white/10'}`}>
                                    {claimableCount}
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Timer */}
            <RotatingTimer resetsAt={current.resetsAt} />

            {/* Challenge cards */}
            {current.challenges.length === 0 ? (
                <div className="text-center py-8 text-white/30 cd-head tracking-wider text-sm">
                    No rotating challenges available yet.
                </div>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                    {current.challenges.map((ch, i) => (
                        <RotatingChallengeCard
                            key={ch.assignmentId}
                            challenge={ch}
                            index={i}
                            claimingId={claimingId}
                            justClaimed={justClaimed[ch.assignmentId]}
                            onClaim={onClaim}
                            isLoggedIn={isLoggedIn}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}


function RotatingTimer({ resetsAt }) {
    const timeLeft = useCountdown(resetsAt)
    return (
        <div className="flex items-center gap-1.5 mb-3 text-[11px] text-white/40">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Resets in {timeLeft}</span>
        </div>
    )
}
```

- [ ] **Step 4: Add `RotatingChallengeCard` component**

Add after `RotatingTimer`:

```jsx
function RotatingChallengeCard({ challenge: ch, index, claimingId, justClaimed, onClaim, isLoggedIn }) {
    const pct = Math.round(ch.progress * 100)
    const isClaiming = claimingId === ch.assignmentId
    const isClaimable = isLoggedIn && ch.completed && !ch.claimed && !ch.expired && !justClaimed

    // Color based on reward type
    const accentColor = ch.rewardType === 'cores' ? 'var(--cd-cyan)'
        : ch.rewardType === 'pack' ? 'var(--cd-gold)'
        : '#a78bfa' // purple for mixed

    return (
        <div
            className={`
                relative cd-panel cd-corners rounded-xl overflow-hidden transition-all duration-300
                ${ch.claimed ? 'opacity-50' : ''}
                ${ch.expired && !ch.claimed ? 'opacity-40' : ''}
            `}
            style={{
                borderLeftWidth: '3px',
                borderLeftColor: accentColor,
                animation: `vault-card-enter 0.4s ease-out ${index * 0.08}s both`,
                ...(justClaimed ? { animation: 'vault-claim-glow 1.2s ease-out' } : {}),
            }}
        >
            {isClaimable && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div
                        className="absolute inset-0 w-1/3"
                        style={{
                            background: `linear-gradient(90deg, transparent, ${accentColor}10, transparent)`,
                            animation: 'vault-shimmer 4s ease-in-out infinite',
                        }}
                    />
                </div>
            )}

            <div className="relative p-4">
                <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="min-w-0">
                        <h3 className="font-bold text-sm cd-head text-[var(--cd-text)] leading-tight">{ch.title}</h3>
                        <p className="text-[11px] text-white/40 leading-relaxed mt-0.5">{ch.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 mt-0.5">
                        <RotatingRewardDisplay challenge={ch} />
                    </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3">
                    <div className="flex justify-between items-baseline text-[10px] mb-1">
                        <span className="text-white/40 tabular-nums">
                            {ch.currentValue?.toLocaleString()} / {ch.targetValue?.toLocaleString()}
                        </span>
                        <span className={`font-bold tabular-nums ${pct >= 100 ? 'text-[var(--cd-cyan)]' : 'text-white/40'}`}>
                            {pct}%
                        </span>
                    </div>
                    <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                                width: `${pct}%`,
                                background: ch.claimed
                                    ? 'rgba(74, 222, 128, 0.5)'
                                    : `linear-gradient(90deg, ${accentColor}99, ${accentColor})`,
                                animation: 'vault-progress-fill 0.8s ease-out',
                            }}
                        />
                    </div>
                </div>

                {isClaimable && (
                    <button
                        onClick={(e) => onClaim(ch.assignmentId, e.currentTarget)}
                        disabled={isClaiming}
                        className="mt-3 w-full py-2 rounded-lg font-bold text-xs cd-head tracking-wider transition-all disabled:opacity-50 cursor-pointer cd-btn-solid cd-btn-action"
                    >
                        {isClaiming ? 'Claiming...' : 'Claim Reward'}
                    </button>
                )}

                {justClaimed && (
                    <div className="mt-3 flex items-center justify-center gap-3 py-2 rounded-lg bg-[var(--cd-cyan)]/[0.06] border border-[var(--cd-cyan)]/20">
                        {justClaimed.cores > 0 && (
                            <div className="flex items-center gap-1">
                                <img src={emberIcon} alt="" className="w-3.5 h-3.5" />
                                <span className="text-xs font-bold text-[var(--cd-cyan)]">+{justClaimed.cores}</span>
                            </div>
                        )}
                        {justClaimed.packs > 0 && (
                            <div className="flex items-center gap-1">
                                <span className="text-xs">📦</span>
                                <span className="text-xs font-bold text-[var(--cd-gold)]">+{justClaimed.packs} pack{justClaimed.packs > 1 ? 's' : ''}</span>
                            </div>
                        )}
                        <span className="text-xs text-white/50">Claimed!</span>
                    </div>
                )}

                {ch.claimed && !justClaimed && (
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-green-400/60">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span>Claimed</span>
                    </div>
                )}

                {ch.expired && !ch.claimed && (
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-red-400/60">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <span>Expired</span>
                    </div>
                )}
            </div>
        </div>
    )
}
```

- [ ] **Step 5: Add `RotatingRewardDisplay` component**

Add after `RotatingChallengeCard`:

```jsx
function RotatingRewardDisplay({ challenge: ch }) {
    return (
        <>
            {ch.rewardCores > 0 && (
                <div className="flex items-center gap-0.5">
                    <span className="text-xs font-bold text-[var(--cd-cyan)] cd-text-glow">+{ch.rewardCores}</span>
                    <img src={emberIcon} alt="" className="w-3.5 h-3.5 cd-icon-glow" />
                </div>
            )}
            {ch.rewardPacks > 0 && (
                <div className="flex items-center gap-0.5">
                    <span className="text-xs font-bold text-[var(--cd-gold)]">+{ch.rewardPacks}</span>
                    <span className="text-xs">📦</span>
                </div>
            )}
        </>
    )
}
```

- [ ] **Step 6: Render `RotatingSection` in the main component return**

In the `CCChallenges` component's return JSX (line 134), add the `RotatingSection` at the top of the `max-w-2xl` container, right before the existing header div:

```jsx
{user && (
    <RotatingSection
        data={rotatingData}
        claimingId={rotatingClaimingId}
        justClaimed={rotatingJustClaimed}
        onClaim={handleClaimRotating}
        isLoggedIn={!!user}
    />
)}
```

This goes right after `<div className="max-w-2xl mx-auto">` and before `<div className="mb-6 flex items-start justify-between">`.

- [ ] **Step 7: Commit**

```bash
git add src/pages/vault/CCChallenges.jsx
git commit -m "feat(vault): add rotating challenges UI with countdown timers and claim flow"
```

---

### Task 7: Manual Testing Checklist

- [ ] **Step 1: Start dev server and verify the migration ran**

Run: `npm start`
Navigate to the vault Challenges tab. Should see the "Rotating Challenges" section above the existing permanent challenges with daily/weekly/monthly tabs.

- [ ] **Step 2: Verify assignment rolling**

On first load, daily/weekly/monthly tabs should each show the correct number of challenges (3/4/3). Refresh — same challenges should persist (not re-rolled).

- [ ] **Step 3: Verify progress tracking**

Open a pack. Go back to challenges. The "packs_opened" challenges should show updated progress (delta from baseline).

- [ ] **Step 4: Verify claiming**

If a challenge is complete, click "Claim Reward". Cores should animate to the balance icon. Packs should appear in inventory. The challenge should show "Claimed".

- [ ] **Step 5: Verify countdown timer**

The timer should show time remaining until next reset and update every minute.

- [ ] **Step 6: Verify period reset**

After midnight UTC, daily challenges should re-roll with new random selections. Previous day's claimed challenges should no longer appear.

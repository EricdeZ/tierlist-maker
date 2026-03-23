import { grantEmber } from './ember.js'
import { transaction } from './db.js'

const CADENCE_SLOTS = {
    daily:   { cores: 1, pack: 1, mixed: 1 },  // 3 total
    weekly:  { cores: 2, pack: 1, mixed: 1 },  // 4 total
    monthly: { cores: 1, pack: 1, mixed: 1 },  // 3 total
}

const CADENCES = ['daily', 'weekly', 'monthly']

// 1-hour grace period for claiming after period ends
const GRACE_MS = 60 * 60 * 1000

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

// Compute period-start baselines for all trackable stats.
// Transaction-based stats use timestamp-filtered queries so the baseline reflects
// the stat value at the START of the period, regardless of when rollAssignments is called.
// Counter-only stats (packs_opened, cards_dismantled, income_collections) read current
// cc_stats values — off by at most 1 action, but never 0 from missing history.
// (cc_pack_opens was added recently and lacks backfilled data, so cc_stats is more reliable.)
async function getBaselineStats(sql, userId, periodStart) {
    const [row] = await sql`
      WITH
        ember_base AS (
          SELECT
            COUNT(*) FILTER (WHERE type = 'daily_claim')::int AS daily_cores_claimed,
            COUNT(*) FILTER (WHERE type = 'passion_convert')::int AS cores_converted,
            COALESCE(SUM(amount) FILTER (WHERE type = 'bounty_reward'), 0)::int AS bounty_cores_earned
          FROM ember_transactions
          WHERE user_id = ${userId} AND created_at < ${periodStart}
        ),
        trades_base AS (
          SELECT COUNT(DISTINCT CASE WHEN player_a_id = ${userId} THEN player_b_id ELSE player_a_id END)::int AS trades_completed,
                 COUNT(*)::int AS trades_count
          FROM cc_trades
          WHERE (player_a_id = ${userId} OR player_b_id = ${userId})
            AND status = 'completed' AND completed_at < ${periodStart}
        ),
        market_base AS (
          SELECT COUNT(DISTINCT buyer_id)::int AS marketplace_sold,
                 COUNT(*)::int AS marketplace_sold_count
          FROM cc_market_listings
          WHERE seller_id = ${userId} AND status = 'sold' AND sold_at < ${periodStart}
        ),
        gifts_base AS (
          SELECT COUNT(*)::int AS gifts_sent FROM cc_gifts
          WHERE sender_id = ${userId} AND created_at < ${periodStart}
        ),
        counter_base AS (
          SELECT COALESCE(packs_opened, 0)::int AS packs_opened,
                 COALESCE(cards_dismantled, 0)::int AS cards_dismantled,
                 COALESCE(legendary_cards_dismantled, 0)::int AS legendary_cards_dismantled,
                 COALESCE(income_collections, 0)::int AS income_collections
          FROM cc_stats WHERE user_id = ${userId}
        )
      SELECT e.*, t.trades_completed, t.trades_count, m.marketplace_sold, m.marketplace_sold_count,
             g.gifts_sent, c.packs_opened, c.cards_dismantled, c.legendary_cards_dismantled, c.income_collections
      FROM ember_base e, trades_base t, market_base m, gifts_base g
      LEFT JOIN counter_base c ON true
    `

    return {
        daily_cores_claimed: row?.daily_cores_claimed ?? 0,
        cores_converted: row?.cores_converted ?? 0,
        trades_completed: row?.trades_completed ?? 0,
        trades_count: row?.trades_count ?? 0,
        marketplace_sold: row?.marketplace_sold ?? 0,
        marketplace_sold_count: row?.marketplace_sold_count ?? 0,
        gifts_sent: row?.gifts_sent ?? 0,
        bounty_cores_earned: row?.bounty_cores_earned ?? 0,
        packs_opened: row?.packs_opened ?? 0,
        cards_dismantled: row?.cards_dismantled ?? 0,
        legendary_cards_dismantled: row?.legendary_cards_dismantled ?? 0,
        income_collected: row?.income_collections ?? 0,
    }
}

export async function rollAssignments(sql, userId, currentStats) {
    const periods = CADENCES.map(c => ({ cadence: c, ...getPeriod(c) }))
    const periodStarts = periods.map(p => p.start)

    // Batch check: which cadences already have assignments for this period?
    const existing = await sql`
        SELECT DISTINCT cadence FROM cc_challenge_assignments
        WHERE user_id = ${userId}
          AND (cadence, period_start) IN (
            SELECT unnest(${CADENCES}::text[]), unnest(${periodStarts}::timestamptz[])
          )
    `
    const existingSet = new Set(existing.map(r => r.cadence))
    const needed = periods.filter(p => !existingSet.has(p.cadence))
    if (needed.length === 0) return

    // Batch fetch: all templates for needed cadences
    const neededCadences = needed.map(p => p.cadence)
    const templates = await sql`
        SELECT id, stat_key, reward_type, cadence
        FROM cc_challenge_templates
        WHERE cadence = ANY(${neededCadences}) AND is_active = true
    `

    // Group templates by cadence → reward_type, select per cadence
    const allUserIds = [], allTemplateIds = [], allCadences = [], allStarts = [], allEnds = [], allBaselines = []
    const baselineCache = {}

    for (const { cadence, start, end } of needed) {
        const slots = CADENCE_SLOTS[cadence]
        const byType = { cores: [], pack: [], mixed: [] }
        for (const t of templates) {
            if (t.cadence === cadence && byType[t.reward_type]) byType[t.reward_type].push(t)
        }

        const selected = []
        for (const [type, count] of Object.entries(slots)) {
            const pool = byType[type] || []
            const shuffled = [...pool].sort(() => Math.random() - 0.5)
            selected.push(...shuffled.slice(0, count))
        }
        if (selected.length === 0) continue

        // Get baselines (1 CTE query per distinct period start)
        const startKey = start.toISOString()
        if (!baselineCache[startKey]) {
            baselineCache[startKey] = await getBaselineStats(sql, userId, start)
        }
        const timeBaselines = baselineCache[startKey]

        for (const t of selected) {
            allUserIds.push(userId)
            allTemplateIds.push(t.id)
            allCadences.push(cadence)
            allStarts.push(start)
            allEnds.push(end)
            allBaselines.push(
                t.stat_key in timeBaselines ? timeBaselines[t.stat_key] : Number(currentStats[t.stat_key] || 0)
            )
        }
    }

    if (allTemplateIds.length === 0) return

    // Single batch insert for all cadences
    await sql`
        INSERT INTO cc_challenge_assignments
            (user_id, template_id, cadence, period_start, period_end, baseline_value)
        SELECT
            unnest(${allUserIds}::int[]),
            unnest(${allTemplateIds}::int[]),
            unnest(${allCadences}::text[]),
            unnest(${allStarts}::timestamptz[]),
            unnest(${allEnds}::timestamptz[]),
            unnest(${allBaselines}::int[])
        ON CONFLICT (user_id, template_id, period_start) DO NOTHING
    `
}

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
                expired: new Date(r.period_end).getTime() + GRACE_MS <= now.getTime(),
            }))
        result[cadence] = { challenges, resetsAt: end.toISOString() }
    }

    return result
}

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

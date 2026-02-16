import { adapt } from '../lib/adapter.js'
import { getDB, headers } from '../lib/db.js'
import { requireAuth } from '../lib/auth.js'
import { grantPassion, getRank, getNextRank, formatRank } from '../lib/passion.js'
import { PERF_KEYS, recalcSingleUserChallenges, pushChallengeProgress } from '../lib/challenges.js'

const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const sql = getDB()
    const { action } = event.queryStringParameters || {}

    try {
        if (event.httpMethod === 'GET') {
            // Auth is optional for GET — unauthenticated users see challenges without progress
            const user = await requireAuth(event)
            return await listChallenges(sql, user)
        }

        // POST requires auth
        const user = await requireAuth(event)
        if (!user) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
        }

        if (event.httpMethod === 'POST') {
            switch (action) {
                case 'claim':
                    return await claimChallenge(sql, user, event)
                default:
                    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
            }
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    } catch (error) {
        console.error('challenges error:', error)
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) }
    }
}


// ═══════════════════════════════════════════════════
// GET: List all active challenges with user progress
// ═══════════════════════════════════════════════════
async function listChallenges(sql, user) {
    // Unauthenticated: return challenges without user progress
    if (!user) {
        const challenges = await sql`
            SELECT id, title, description, category, type, reward,
                   target_value, stat_key, repeat_cooldown,
                   tier, gives_badge, badge_label
            FROM challenges
            WHERE is_active = true
            ORDER BY sort_order, id
        `

        const grouped = {}
        for (const ch of challenges) {
            if (!grouped[ch.tier]) grouped[ch.tier] = []
            grouped[ch.tier].push({
                id: ch.id, title: ch.title, description: ch.description,
                category: ch.category, type: ch.type, reward: ch.reward,
                targetValue: ch.target_value, statKey: ch.stat_key,
                tier: ch.tier, givesBadge: ch.gives_badge, badgeLabel: ch.badge_label,
                currentValue: 0, completed: false, completedAt: null,
                lastCompletedAt: null, canRepeat: false, claimable: false, progress: 0,
            })
        }

        return { statusCode: 200, headers, body: JSON.stringify({ challenges: grouped, claimableCount: 0 }) }
    }

    // Lazy recalc: if user has a linked player, check for invalidated or new challenges.
    // Sentinel current_value = -1 means data was invalidated by a match submit/delete/edit.
    // NULL means a new challenge was added that the user hasn't been calculated for yet.
    try {
        if (user.linked_player_id) {
            const stale = await sql`
                SELECT c.id FROM challenges c
                LEFT JOIN user_challenges uc ON uc.challenge_id = c.id AND uc.user_id = ${user.id}
                WHERE c.is_active = true
                  AND c.stat_key = ANY(${PERF_KEYS})
                  AND (uc.current_value IS NULL OR uc.current_value < 0)
                LIMIT 1
            `
            if (stale.length > 0) {
                await recalcSingleUserChallenges(sql, user.id, user.linked_player_id)
            }
        }
    } catch (err) {
        console.error('Challenge recalc failed:', err)
    }

    const challenges = await sql`
        SELECT c.id, c.title, c.description, c.category, c.type, c.reward,
               c.target_value, c.stat_key, c.repeat_cooldown,
               c.tier, c.gives_badge, c.badge_label,
               COALESCE(uc.current_value, 0) as current_value,
               COALESCE(uc.completed, false) as completed,
               uc.completed_at, uc.last_completed_at
        FROM challenges c
        LEFT JOIN user_challenges uc ON uc.challenge_id = c.id AND uc.user_id = ${user.id}
        WHERE c.is_active = true
        ORDER BY c.sort_order, c.id
    `

    // Group by tier
    const grouped = {}
    let claimableCount = 0

    for (const ch of challenges) {
        if (!grouped[ch.tier]) grouped[ch.tier] = []

        const claimable = !ch.completed && Number(ch.current_value) >= Number(ch.target_value)

        // For repeatable challenges, check if cooldown has elapsed
        let canRepeat = false
        if (ch.type === 'repeatable' && ch.completed && ch.last_completed_at && ch.repeat_cooldown) {
            canRepeat = true
        }

        if (claimable) claimableCount++

        grouped[ch.tier].push({
            id: ch.id,
            title: ch.title,
            description: ch.description,
            category: ch.category,
            type: ch.type,
            reward: ch.reward,
            targetValue: ch.target_value,
            statKey: ch.stat_key,
            tier: ch.tier,
            givesBadge: ch.gives_badge,
            badgeLabel: ch.badge_label,
            currentValue: ch.current_value,
            completed: ch.completed,
            completedAt: ch.completed_at,
            lastCompletedAt: ch.last_completed_at,
            canRepeat,
            claimable,
            progress: Math.min(ch.current_value / ch.target_value, 1),
        })
    }

    return { statusCode: 200, headers, body: JSON.stringify({ challenges: grouped, claimableCount }) }
}


// ═══════════════════════════════════════════════════
// POST: Claim a completed challenge
// ═══════════════════════════════════════════════════
async function claimChallenge(sql, user, event) {
    const body = event.body ? JSON.parse(event.body) : {}
    const { challengeId } = body

    if (!challengeId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'challengeId is required' }) }
    }

    // Get challenge
    const [challenge] = await sql`
        SELECT id, title, reward, target_value, type, gives_badge, badge_label
        FROM challenges
        WHERE id = ${challengeId} AND is_active = true
    `
    if (!challenge) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Challenge not found' }) }
    }

    // Get user progress
    const [uc] = await sql`
        SELECT current_value, completed FROM user_challenges
        WHERE user_id = ${user.id} AND challenge_id = ${challengeId}
    `
    if (!uc) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'No progress on this challenge' }) }
    }
    if (uc.completed) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Already claimed' }) }
    }
    if (uc.current_value < challenge.target_value) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Challenge not yet complete' }) }
    }

    // Get current balance for rank-up check
    const [pb] = await sql`
        SELECT total_earned FROM passion_balances WHERE user_id = ${user.id}
    `
    const oldRank = getRank(pb?.total_earned || 0)

    // Mark as completed
    const now = new Date()
    await sql`
        UPDATE user_challenges SET
            completed = true,
            completed_at = COALESCE(completed_at, ${now}),
            last_completed_at = ${now}
        WHERE user_id = ${user.id} AND challenge_id = ${challengeId}
    `

    // Grant passion
    const result = await grantPassion(sql, user.id, 'challenge_complete', challenge.reward,
        `Challenge: ${challenge.title}`, String(challenge.id))

    const newRank = getRank(result.totalEarned)
    const rankedUp = formatRank(oldRank) !== formatRank(newRank)

    // Push total_earned challenge progress (claiming grants passion which may unlock meta-challenges)
    pushChallengeProgress(sql, user.id, { total_earned: Number(result.totalEarned) })
        .catch(err => console.error('Challenge push (total_earned) failed:', err))

    // Get remaining claimable count
    const [{ count: claimableCount }] = await sql`
        SELECT COUNT(*) as count FROM user_challenges uc
        JOIN challenges c ON c.id = uc.challenge_id
        WHERE uc.user_id = ${user.id}
          AND uc.completed = false
          AND uc.current_value >= c.target_value
          AND c.is_active = true
    `

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            earned: challenge.reward,
            balance: result.balance,
            totalEarned: result.totalEarned,
            rank: { name: newRank.name, division: newRank.division, display: formatRank(newRank) },
            rankedUp,
            claimableCount: parseInt(claimableCount),
            badge: challenge.gives_badge ? { label: challenge.badge_label } : null,
        }),
    }
}

export const onRequest = adapt(handler)

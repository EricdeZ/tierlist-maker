import { adapt } from '../lib/adapter.js'
import { getDB, headers } from '../lib/db.js'
import { requireAuth } from '../lib/auth.js'
import { grantPassion, getRank, getNextRank, formatRank } from '../lib/passion.js'
import { grantEmber } from '../lib/ember.js'
import { PERF_KEYS, SCRIM_KEYS, REFERRAL_KEYS, FORGE_KEYS, DISCORD_KEYS, recalcSingleUserChallenges, recalcScrimChallenges, recalcReferralChallenges, recalcForgeChallenges, recalcDiscordChallenges, recalcVaultChallenges, pushChallengeProgress } from '../lib/challenges.js'

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
            SELECT id, title, description, category, type, reward, ember_reward,
                   target_value, stat_key, repeat_cooldown,
                   tier, gives_badge, badge_label
            FROM challenges
            WHERE is_active = true
            ORDER BY sort_order, id
        `

        // Fetch holders for unique challenges
        const uniqueHolders = await getUniqueHolders(sql)

        const grouped = {}
        for (const ch of challenges) {
            if (!grouped[ch.tier]) grouped[ch.tier] = []
            grouped[ch.tier].push({
                id: ch.id, title: ch.title, description: ch.description,
                category: ch.category, type: ch.type, reward: ch.reward,
                emberReward: ch.ember_reward || 0,
                targetValue: ch.target_value, statKey: ch.stat_key,
                tier: ch.tier, givesBadge: ch.gives_badge, badgeLabel: ch.badge_label,
                currentValue: 0, completed: false, completedAt: null,
                lastCompletedAt: null, canRepeat: false, claimable: false, progress: 0,
                holders: uniqueHolders[ch.id] || null,
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

    // Always recalc scrim challenges (cheap query, catches missed pushes)
    try {
        await recalcScrimChallenges(sql, user.id)
    } catch (err) {
        console.error('Scrim challenge recalc failed:', err)
    }

    // Lazy recalc for referral challenges (all authenticated users)
    try {
        const referralStale = await sql`
            SELECT c.id FROM challenges c
            LEFT JOIN user_challenges uc ON uc.challenge_id = c.id AND uc.user_id = ${user.id}
            WHERE c.is_active = true
              AND c.stat_key = ANY(${REFERRAL_KEYS})
              AND (uc.current_value IS NULL OR uc.current_value < 0)
            LIMIT 1
        `
        if (referralStale.length > 0) {
            await recalcReferralChallenges(sql, user.id)
        }
    } catch (err) {
        console.error('Referral challenge recalc failed:', err)
    }

    // Lazy recalc for forge challenges (all authenticated users)
    try {
        const forgeStale = await sql`
            SELECT c.id FROM challenges c
            LEFT JOIN user_challenges uc ON uc.challenge_id = c.id AND uc.user_id = ${user.id}
            WHERE c.is_active = true
              AND c.stat_key = ANY(${FORGE_KEYS})
              AND (uc.current_value IS NULL OR uc.current_value < 0)
            LIMIT 1
        `
        if (forgeStale.length > 0) {
            await recalcForgeChallenges(sql, user.id)
        }
    } catch (err) {
        console.error('Forge challenge recalc failed:', err)
    }

    // Lazy recalc for Discord challenges (all authenticated users)
    try {
        const discordStale = await sql`
            SELECT c.id FROM challenges c
            LEFT JOIN user_challenges uc ON uc.challenge_id = c.id AND uc.user_id = ${user.id}
            WHERE c.is_active = true
              AND c.stat_key = ANY(${DISCORD_KEYS})
              AND (uc.current_value IS NULL OR uc.current_value < 0)
            LIMIT 1
        `
        if (discordStale.length > 0) {
            await recalcDiscordChallenges(sql, user.id)
        }
    } catch (err) {
        console.error('Discord challenge recalc failed:', err)
    }

    // Always recalc vault challenges (catches missed fire-and-forget pushes)
    try {
        await recalcVaultChallenges(sql, user.id)
    } catch (err) {
        console.error('Vault challenge recalc failed:', err)
    }

    const challenges = await sql`
        SELECT c.id, c.title, c.description, c.category, c.type, c.reward, c.ember_reward,
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

    // Fetch holders for unique challenges
    const uniqueHolders = await getUniqueHolders(sql)

    // Group by tier
    const grouped = {}
    let claimableCount = 0

    for (const ch of challenges) {
        if (!grouped[ch.tier]) grouped[ch.tier] = []

        const holders = uniqueHolders[ch.id] || null
        const isGrandfathered = holders?.some(h => h.userId === user.id)
        const takenByOther = ch.tier === 'unique' && holders?.length > 0 && !isGrandfathered

        const claimable = !takenByOther && !ch.completed && Number(ch.current_value) >= Number(ch.target_value)

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
            emberReward: ch.ember_reward || 0,
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
            holders,
        })
    }

    return { statusCode: 200, headers, body: JSON.stringify({ challenges: grouped, claimableCount }) }
}


// ═══════════════════════════════════════════════════
// Unique challenge holders — who claimed each one
// ═══════════════════════════════════════════════════
async function getUniqueHolders(sql) {
    const rows = await sql`
        SELECT uc.challenge_id, u.id as user_id, u.discord_username, u.discord_avatar, u.discord_id, uc.completed_at
        FROM user_challenges uc
        JOIN challenges c ON c.id = uc.challenge_id
        JOIN users u ON u.id = uc.user_id
        WHERE c.tier = 'unique' AND c.is_active = true AND uc.completed = true
        ORDER BY uc.completed_at ASC
    `
    const map = {}
    for (const r of rows) {
        if (!map[r.challenge_id]) map[r.challenge_id] = []
        map[r.challenge_id].push({
            userId: r.user_id,
            username: r.discord_username,
            avatar: r.discord_avatar,
            discordId: r.discord_id,
            claimedAt: r.completed_at,
        })
    }
    return map
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
        SELECT id, title, reward, ember_reward, target_value, type, tier, gives_badge, badge_label
        FROM challenges
        WHERE id = ${challengeId} AND is_active = true
    `
    if (!challenge) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Challenge not found' }) }
    }

    // Unique challenges: no new claims once someone holds it (existing holders are grandfathered)
    if (challenge.tier === 'unique') {
        const [alreadyHeld] = await sql`
            SELECT 1 FROM user_challenges
            WHERE challenge_id = ${challengeId} AND completed = true AND user_id = ${user.id}
        `
        if (!alreadyHeld) {
            const [taken] = await sql`
                SELECT 1 FROM user_challenges
                WHERE challenge_id = ${challengeId} AND completed = true
            `
            if (taken) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'This unique challenge has already been claimed' }) }
            }
        }
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

    // Grant ember if challenge has ember_reward
    let emberEarned = 0
    if (challenge.ember_reward && challenge.ember_reward > 0) {
        await grantEmber(sql, user.id, 'challenge_complete', challenge.ember_reward,
            `Challenge: ${challenge.title}`, String(challenge.id))
        emberEarned = challenge.ember_reward
    }

    const newRank = getRank(result.totalEarned)
    const rankedUp = formatRank(oldRank) !== formatRank(newRank)

    // Push total_earned challenge progress (claiming grants passion which may unlock meta-challenges)
    pushChallengeProgress(sql, user.id, { total_earned: Number(result.totalEarned) })
        .catch(err => console.error('Challenge push (total_earned) failed:', err))

    // Get remaining claimable counts (all + vault-only)
    const [[{ count: claimableCount }], [{ count: vaultClaimableCount }]] = await Promise.all([
        sql`
            SELECT COUNT(*) as count FROM user_challenges uc
            JOIN challenges c ON c.id = uc.challenge_id
            WHERE uc.user_id = ${user.id}
              AND uc.completed = false
              AND uc.current_value >= c.target_value
              AND c.is_active = true
        `,
        sql`
            SELECT COUNT(*) as count FROM user_challenges uc
            JOIN challenges c ON c.id = uc.challenge_id
            WHERE uc.user_id = ${user.id}
              AND uc.completed = false
              AND uc.current_value >= c.target_value
              AND c.is_active = true
              AND c.category = 'vault'
        `,
    ])

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            earned: challenge.reward,
            emberEarned,
            balance: result.balance,
            totalEarned: result.totalEarned,
            rank: { name: newRank.name, division: newRank.division, display: formatRank(newRank) },
            rankedUp,
            claimableCount: parseInt(claimableCount),
            vaultClaimableCount: parseInt(vaultClaimableCount),
            badge: challenge.gives_badge ? { label: challenge.badge_label } : null,
        }),
    }
}

export const onRequest = adapt(handler)

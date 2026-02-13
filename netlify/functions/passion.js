import { getDB, headers, adminHeaders } from './lib/db.js'
import { requireAuth } from './lib/auth.js'
import {
    grantPassion,
    checkCooldown,
    getRank,
    getNextRank,
    formatRank,
    EARNING_RULES,
} from './lib/passion.js'
import { pushChallengeProgress } from './lib/challenges.js'

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const { action } = event.queryStringParameters || {}
    const sql = getDB()

    try {
        // ─── Public: leaderboard ───
        if (event.httpMethod === 'GET' && action === 'leaderboard') {
            const { period } = event.queryStringParameters || {}
            return await getLeaderboard(sql, period)
        }

        // All other actions require auth
        const user = await requireAuth(event)
        if (!user) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
        }

        if (event.httpMethod === 'GET') {
            switch (action) {
                case 'balance':
                    return await getBalance(sql, user)
                case 'transactions':
                    return await getTransactions(sql, user, event)
                default:
                    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
            }
        }

        if (event.httpMethod === 'POST') {
            const body = event.body ? JSON.parse(event.body) : {}
            switch (action) {
                case 'claim-daily':
                    return await claimDaily(sql, user)
                case 'earn':
                    return await earn(sql, user, body)
                default:
                    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
            }
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    } catch (error) {
        console.error('passion error:', error)
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) }
    }
}


// ═══════════════════════════════════════════════════
// GET: User balance + rank info
// ═══════════════════════════════════════════════════
async function getBalance(sql, user) {
    // Ensure balance row exists
    await sql`
        INSERT INTO passion_balances (user_id)
        VALUES (${user.id})
        ON CONFLICT (user_id) DO NOTHING
    `

    const [pb] = await sql`
        SELECT balance, total_earned, total_spent,
               last_daily_claim, current_streak, longest_streak
        FROM passion_balances WHERE user_id = ${user.id}
    `

    const rank = getRank(pb.total_earned)
    const nextRank = getNextRank(pb.total_earned)

    // Check if daily claim is available
    const now = new Date()
    const todayUTC = now.toISOString().slice(0, 10)
    const lastClaimDate = pb.last_daily_claim
        ? new Date(pb.last_daily_claim).toISOString().slice(0, 10)
        : null
    const canClaimDaily = lastClaimDate !== todayUTC

    // Count claimable challenges
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
            balance: pb.balance,
            totalEarned: pb.total_earned,
            totalSpent: pb.total_spent,
            currentStreak: pb.current_streak,
            longestStreak: pb.longest_streak,
            canClaimDaily,
            claimableCount: parseInt(claimableCount),
            lastDailyClaim: pb.last_daily_claim,
            rank: { name: rank.name, division: rank.division, display: formatRank(rank) },
            nextRank: nextRank
                ? { name: nextRank.name, division: nextRank.division, display: formatRank(nextRank), passionNeeded: nextRank.passionNeeded }
                : null,
        }),
    }
}


// ═══════════════════════════════════════════════════
// GET: Public leaderboard
// ═══════════════════════════════════════════════════
async function getLeaderboard(sql, period) {
    if (period === 'recent') {
        // Recent: sum positive transactions from last 30 days
        const rows = await sql`
            SELECT pt.user_id,
                   SUM(pt.amount)::integer as recent_earned,
                   pb.total_earned, pb.current_streak,
                   u.discord_username, u.discord_avatar, u.discord_id,
                   p.slug AS player_slug
            FROM passion_transactions pt
            JOIN users u ON u.id = pt.user_id
            LEFT JOIN passion_balances pb ON pb.user_id = pt.user_id
            LEFT JOIN players p ON p.id = u.linked_player_id
            WHERE pt.amount > 0 AND pt.created_at >= NOW() - INTERVAL '14 days'
            GROUP BY pt.user_id, pb.total_earned, pb.current_streak,
                     u.discord_username, u.discord_avatar, u.discord_id, p.slug
            ORDER BY recent_earned DESC
            LIMIT 50
        `

        const leaderboard = rows.map((row, i) => {
            const rank = getRank(row.total_earned || 0)
            return {
                position: i + 1,
                userId: row.user_id,
                discordUsername: row.discord_username,
                discordAvatar: row.discord_avatar,
                discordId: row.discord_id,
                playerSlug: row.player_slug || null,
                totalEarned: row.total_earned || 0,
                recentEarned: row.recent_earned,
                currentStreak: row.current_streak || 0,
                rank: { name: rank.name, division: rank.division, display: formatRank(rank) },
            }
        })

        return { statusCode: 200, headers, body: JSON.stringify({ leaderboard, period: 'recent' }) }
    }

    // Lifetime (default)
    const rows = await sql`
        SELECT pb.user_id, pb.total_earned, pb.current_streak,
               u.discord_username, u.discord_avatar, u.discord_id,
               p.slug AS player_slug
        FROM passion_balances pb
        JOIN users u ON u.id = pb.user_id
        LEFT JOIN players p ON p.id = u.linked_player_id
        WHERE pb.total_earned > 0
        ORDER BY pb.total_earned DESC
        LIMIT 50
    `

    const leaderboard = rows.map((row, i) => {
        const rank = getRank(row.total_earned)
        return {
            position: i + 1,
            userId: row.user_id,
            discordUsername: row.discord_username,
            discordAvatar: row.discord_avatar,
            discordId: row.discord_id,
            playerSlug: row.player_slug || null,
            totalEarned: row.total_earned,
            currentStreak: row.current_streak,
            rank: { name: rank.name, division: rank.division, display: formatRank(rank) },
        }
    })

    return { statusCode: 200, headers, body: JSON.stringify({ leaderboard, period: 'lifetime' }) }
}


// ═══════════════════════════════════════════════════
// GET: User's recent transactions
// ═══════════════════════════════════════════════════
async function getTransactions(sql, user, event) {
    const { limit = '50', offset = '0' } = event.queryStringParameters || {}
    const lim = Math.min(parseInt(limit) || 50, 100)
    const off = parseInt(offset) || 0

    const rows = await sql`
        SELECT id, amount, type, description, reference_id, created_at
        FROM passion_transactions
        WHERE user_id = ${user.id}
        ORDER BY created_at DESC
        LIMIT ${lim} OFFSET ${off}
    `

    return { statusCode: 200, headers, body: JSON.stringify({ transactions: rows }) }
}


// ═══════════════════════════════════════════════════
// POST: Claim daily login reward
// ═══════════════════════════════════════════════════
async function claimDaily(sql, user) {
    // Ensure balance row exists
    await sql`
        INSERT INTO passion_balances (user_id)
        VALUES (${user.id})
        ON CONFLICT (user_id) DO NOTHING
    `

    const [pb] = await sql`
        SELECT total_earned, last_daily_claim, current_streak
        FROM passion_balances WHERE user_id = ${user.id}
    `

    const now = new Date()
    const todayUTC = now.toISOString().slice(0, 10)
    const lastClaimDate = pb.last_daily_claim
        ? new Date(pb.last_daily_claim).toISOString().slice(0, 10)
        : null

    if (lastClaimDate === todayUTC) {
        // Calculate next claim time (midnight UTC)
        const tomorrow = new Date(todayUTC + 'T00:00:00Z')
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ alreadyClaimed: true, nextClaimAt: tomorrow.toISOString() }),
        }
    }

    // Calculate streak
    const yesterdayUTC = new Date(now)
    yesterdayUTC.setUTCDate(yesterdayUTC.getUTCDate() - 1)
    const yesterdayStr = yesterdayUTC.toISOString().slice(0, 10)

    let newStreak
    if (lastClaimDate === yesterdayStr) {
        newStreak = pb.current_streak + 1
    } else {
        newStreak = 1 // Streak broken or first claim
    }

    // Calculate amounts
    const baseAmount = EARNING_RULES.daily_login.amount
    const streakBonus = Math.min((newStreak - 1) * EARNING_RULES.streak_bonus.perDay, EARNING_RULES.streak_bonus.cap)
    const totalAmount = baseAmount + streakBonus

    const oldRank = getRank(pb.total_earned)

    // Grant passion
    const result = await grantPassion(sql, user.id, 'daily_login', totalAmount,
        streakBonus > 0
            ? `Daily login (${newStreak}-day streak, +${streakBonus} bonus)`
            : 'Daily login'
    )

    // Update streak and claim time
    await sql`
        UPDATE passion_balances SET
            last_daily_claim = ${now},
            current_streak = ${newStreak},
            longest_streak = GREATEST(longest_streak, ${newStreak})
        WHERE user_id = ${user.id}
    `

    const newRank = getRank(result.totalEarned)
    const rankedUp = formatRank(oldRank) !== formatRank(newRank)

    // Push challenge progress and capture newly claimable
    const [{ count: dailyLogins }] = await sql`
        SELECT COUNT(*)::integer as count FROM passion_transactions
        WHERE user_id = ${user.id} AND type = 'daily_login'
    `
    let newlyClaimable = []
    try {
        newlyClaimable = await pushChallengeProgress(sql, user.id, {
            daily_logins: dailyLogins,
            login_streak: newStreak,
            total_earned: Number(result.totalEarned),
        })
    } catch (err) {
        console.error('Challenge push (daily) failed:', err)
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            earned: totalAmount,
            baseAmount,
            streakBonus,
            streak: newStreak,
            balance: result.balance,
            totalEarned: result.totalEarned,
            rank: { name: newRank.name, division: newRank.division, display: formatRank(newRank) },
            rankedUp,
            nextRank: getNextRank(result.totalEarned),
            newlyClaimable,
        }),
    }
}


// ═══════════════════════════════════════════════════
// POST: Track user actions (tier list save, draft complete)
// Records a 0-amount transaction for challenge progress tracking.
// Passion is earned only by claiming challenges.
// ═══════════════════════════════════════════════════
async function earn(sql, user, body) {
    const { type, referenceId } = body

    if (!type) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'type is required' }) }
    }

    const ALLOWED_TYPES = ['tier_list_save', 'draft_complete']
    if (!ALLOWED_TYPES.includes(type)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown earn type: ${type}` }) }
    }

    // Cooldown check — prevents inflating challenge progress counts
    const rule = EARNING_RULES[type]
    if (rule?.cooldownMs) {
        const onCooldown = await checkCooldown(sql, user.id, type, rule.cooldownMs)
        if (onCooldown) {
            return { statusCode: 200, headers, body: JSON.stringify({ tracked: false, reason: 'cooldown' }) }
        }
    }

    // Log a 0-amount transaction purely for activity tracking
    await sql`
        INSERT INTO passion_transactions (user_id, amount, type, description, reference_id)
        VALUES (${user.id}, 0, ${type}, ${type === 'tier_list_save' ? 'Saved tier list' : 'Completed a draft'}, ${referenceId})
    `

    // Push challenge progress and capture newly claimable
    const statKey = type === 'tier_list_save' ? 'tier_lists_created' : 'drafts_completed'
    const [{ count }] = await sql`
        SELECT COUNT(*)::integer as count FROM passion_transactions
        WHERE user_id = ${user.id} AND type = ${type}
    `
    let newlyClaimable = []
    try {
        newlyClaimable = await pushChallengeProgress(sql, user.id, { [statKey]: count })
    } catch (err) {
        console.error(`Challenge push (${type}) failed:`, err)
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ tracked: true, newlyClaimable }),
    }
}

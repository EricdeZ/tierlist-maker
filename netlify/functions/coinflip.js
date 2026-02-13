import { getDB, headers } from './lib/db.js'
import { requireAuth } from './lib/auth.js'
import { getRank, formatRank } from './lib/passion.js'

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const { action } = event.queryStringParameters || {}
    const sql = getDB()

    try {
        // ─── Public: leaderboard ───
        if (event.httpMethod === 'GET' && action === 'leaderboard') {
            return await getLeaderboard(sql)
        }

        // All other actions require auth
        const user = await requireAuth(event)
        if (!user) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
        }

        if (event.httpMethod === 'GET') {
            switch (action) {
                case 'my-stats':
                    return await getMyStats(sql, user)
                default:
                    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
            }
        }

        if (event.httpMethod === 'POST') {
            switch (action) {
                case 'flip':
                    return await handleFlip(sql, user)
                default:
                    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
            }
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    } catch (error) {
        console.error('coinflip error:', error)
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) }
    }
}


// ═══════════════════════════════════════════════════
// POST: Server-authoritative coin flip
// ═══════════════════════════════════════════════════
async function handleFlip(sql, user) {
    // Ensure passion balance row exists
    await sql`
        INSERT INTO passion_balances (user_id)
        VALUES (${user.id})
        ON CONFLICT (user_id) DO NOTHING
    `

    // Check balance — need at least 1 passion to flip
    const [pb] = await sql`
        SELECT balance FROM passion_balances WHERE user_id = ${user.id}
    `
    if (pb.balance < 1) {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ error: 'insufficient_balance', balance: pb.balance }),
        }
    }

    // Server decides the outcome
    const result = Math.random() < 0.5 ? 'heads' : 'tails'

    // Ensure coinflip_streaks row exists
    await sql`
        INSERT INTO coinflip_streaks (user_id)
        VALUES (${user.id})
        ON CONFLICT (user_id) DO NOTHING
    `

    let stats
    if (result === 'heads') {
        // Heads: increment streak, update best, +1 balance
        ;[stats] = await sql`
            UPDATE coinflip_streaks SET
                current_streak = current_streak + 1,
                best_streak = GREATEST(best_streak, current_streak + 1),
                best_streak_at = CASE WHEN current_streak + 1 > best_streak THEN NOW() ELSE best_streak_at END,
                total_flips = total_flips + 1,
                total_heads = total_heads + 1,
                last_flip_at = NOW(),
                updated_at = NOW()
            WHERE user_id = ${user.id}
            RETURNING current_streak, best_streak, total_flips, total_heads
        `
        await sql`
            UPDATE passion_balances SET balance = balance + 1
            WHERE user_id = ${user.id}
        `
    } else {
        // Tails: reset streak, -1 balance
        ;[stats] = await sql`
            UPDATE coinflip_streaks SET
                current_streak = 0,
                total_flips = total_flips + 1,
                last_flip_at = NOW(),
                updated_at = NOW()
            WHERE user_id = ${user.id}
            RETURNING current_streak, best_streak, total_flips, total_heads
        `
        await sql`
            UPDATE passion_balances SET balance = balance - 1
            WHERE user_id = ${user.id}
        `
    }

    // Fetch updated balance
    const [updated] = await sql`
        SELECT balance FROM passion_balances WHERE user_id = ${user.id}
    `

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            result,
            currentStreak: stats.current_streak,
            bestStreak: stats.best_streak,
            totalFlips: stats.total_flips,
            totalHeads: stats.total_heads,
            balance: updated.balance,
        }),
    }
}


// ═══════════════════════════════════════════════════
// GET: User's coinflip stats
// ═══════════════════════════════════════════════════
async function getMyStats(sql, user) {
    const [stats] = await sql`
        SELECT current_streak, best_streak, total_flips, total_heads
        FROM coinflip_streaks
        WHERE user_id = ${user.id}
    `

    if (!stats) {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                currentStreak: 0,
                bestStreak: 0,
                totalFlips: 0,
                totalHeads: 0,
            }),
        }
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            currentStreak: stats.current_streak,
            bestStreak: stats.best_streak,
            totalFlips: stats.total_flips,
            totalHeads: stats.total_heads,
        }),
    }
}


// ═══════════════════════════════════════════════════
// GET: Public streak leaderboard
// ═══════════════════════════════════════════════════
async function getLeaderboard(sql) {
    const rows = await sql`
        SELECT cs.user_id, cs.best_streak, cs.total_flips, cs.total_heads,
               u.discord_username, u.discord_avatar, u.discord_id,
               COALESCE(pb.total_earned, 0) as total_earned
        FROM coinflip_streaks cs
        JOIN users u ON u.id = cs.user_id
        LEFT JOIN passion_balances pb ON pb.user_id = cs.user_id
        WHERE cs.best_streak > 0
        ORDER BY cs.best_streak DESC, cs.best_streak_at DESC NULLS LAST, cs.total_heads DESC
        LIMIT 25
    `

    const leaderboard = rows.map((row, i) => {
        const rank = getRank(row.total_earned || 0)
        return {
            position: i + 1,
            userId: row.user_id,
            discordUsername: row.discord_username,
            discordAvatar: row.discord_avatar,
            discordId: row.discord_id,
            bestStreak: row.best_streak,
            totalFlips: row.total_flips,
            totalHeads: row.total_heads,
            totalEarned: row.total_earned || 0,
            rank: { name: rank.name, division: rank.division, display: formatRank(rank) },
        }
    })

    return { statusCode: 200, headers, body: JSON.stringify({ leaderboard }) }
}

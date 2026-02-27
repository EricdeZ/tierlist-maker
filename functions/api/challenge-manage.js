import { adapt } from '../lib/adapter.js'
import { getDB, adminHeaders as headers } from '../lib/db.js'
import { requirePermission } from '../lib/auth.js'
import { logAudit } from '../lib/audit.js'
import { recalcMatchChallenges, catchupAllUsers } from '../lib/challenges.js'

const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const admin = await requirePermission(event, 'league_manage')
    if (!admin) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const sql = getDB()

    try {
        // ─── GET: list all challenges (including inactive) ───
        if (event.httpMethod === 'GET') {
            const challenges = await sql`
                SELECT id, title, description, category, type, reward,
                       target_value, stat_key, repeat_cooldown, is_active,
                       sort_order, tier, gives_badge, badge_label, created_at
                FROM challenges
                ORDER BY sort_order, id
            `
            return { statusCode: 200, headers, body: JSON.stringify({ challenges }) }
        }

        // ─── POST: mutations ───
        if (event.httpMethod === 'POST') {
            if (!event.body) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Request body required' }) }
            }
            const body = JSON.parse(event.body)

            switch (body.action) {
                case 'create':
                    return await createChallenge(sql, body, admin)
                case 'update':
                    return await updateChallenge(sql, body, admin)
                case 'toggle':
                    return await toggleChallenge(sql, body, admin)
                case 'delete':
                    return await deleteChallenge(sql, body, admin)
                case 'reset-my-challenges':
                    return await resetMyChallenges(sql, admin)
                case 'recalc-all':
                    return await recalcAllChallenges(sql, admin, event)
                case 'catchup-all':
                    return await catchupAllChallengesHandler(sql, admin, event)
                default:
                    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${body.action}` }) }
            }
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    } catch (error) {
        console.error('challenge-manage error:', error)
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) }
    }
}


// ═══════════════════════════════════════════════════
// Create a challenge
// ═══════════════════════════════════════════════════
async function createChallenge(sql, body, admin) {
    const { title, description, category, type, reward, target_value, stat_key, repeat_cooldown, sort_order, tier, gives_badge, badge_label } = body

    if (!title || !stat_key || !target_value) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'title, stat_key, and target_value are required' }) }
    }

    const validCategories = ['engagement', 'league', 'performance', 'social']
    const validTypes = ['one_time', 'repeatable']
    const validTiers = ['daily', 'clay', 'amber', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'obsidian', 'master', 'demigod', 'deity']

    const [created] = await sql`
        INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, repeat_cooldown, sort_order, tier, gives_badge, badge_label)
        VALUES (
            ${title},
            ${description || null},
            ${validCategories.includes(category) ? category : 'engagement'},
            ${validTypes.includes(type) ? type : 'one_time'},
            ${reward || 10},
            ${target_value},
            ${stat_key},
            ${repeat_cooldown || null},
            ${sort_order || 0},
            ${validTiers.includes(tier) ? tier : 'daily'},
            ${gives_badge || false},
            ${badge_label || null}
        )
        RETURNING id
    `

    await logAudit(sql, admin, {
        action: 'create-challenge', endpoint: 'challenge-manage',
        targetType: 'challenge', targetId: created.id,
        details: { title, category, type, reward, target_value, stat_key, tier, gives_badge },
    })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, id: created.id }) }
}


// ═══════════════════════════════════════════════════
// Update a challenge
// ═══════════════════════════════════════════════════
async function updateChallenge(sql, body, admin) {
    const { id, title, description, category, type, reward, target_value, stat_key, repeat_cooldown, sort_order, tier, gives_badge, badge_label } = body

    if (!id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    }

    await sql`
        UPDATE challenges SET
            title = COALESCE(${title || null}, title),
            description = COALESCE(${description !== undefined ? description : null}, description),
            category = COALESCE(${category || null}, category),
            type = COALESCE(${type || null}, type),
            reward = COALESCE(${reward || null}, reward),
            target_value = COALESCE(${target_value || null}, target_value),
            stat_key = COALESCE(${stat_key || null}, stat_key),
            repeat_cooldown = ${repeat_cooldown !== undefined ? (repeat_cooldown || null) : sql`repeat_cooldown`},
            sort_order = COALESCE(${sort_order !== undefined ? sort_order : null}, sort_order),
            tier = COALESCE(${tier || null}, tier),
            gives_badge = ${gives_badge !== undefined ? gives_badge : sql`gives_badge`},
            badge_label = ${badge_label !== undefined ? (badge_label || null) : sql`badge_label`}
        WHERE id = ${id}
    `

    await logAudit(sql, admin, {
        action: 'update-challenge', endpoint: 'challenge-manage',
        targetType: 'challenge', targetId: id,
        details: { title, category, type, reward, target_value, stat_key, tier, gives_badge },
    })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}


// ═══════════════════════════════════════════════════
// Toggle active/inactive
// ═══════════════════════════════════════════════════
async function toggleChallenge(sql, body, admin) {
    const { id } = body
    if (!id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    }

    const [updated] = await sql`
        UPDATE challenges SET is_active = NOT is_active
        WHERE id = ${id}
        RETURNING is_active
    `

    await logAudit(sql, admin, {
        action: updated.is_active ? 'activate-challenge' : 'deactivate-challenge',
        endpoint: 'challenge-manage',
        targetType: 'challenge', targetId: id,
    })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, isActive: updated.is_active }) }
}


// ═══════════════════════════════════════════════════
// Delete a challenge (hard delete)
// ═══════════════════════════════════════════════════
async function deleteChallenge(sql, body, admin) {
    const { id } = body
    if (!id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    }

    await sql`DELETE FROM challenges WHERE id = ${id}`

    await logAudit(sql, admin, {
        action: 'delete-challenge', endpoint: 'challenge-manage',
        targetType: 'challenge', targetId: id,
    })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}


// ═══════════════════════════════════════════════════
// Full passion reset for the calling user (Owner only)
// Resets: challenges, all transactions, balance, streak, daily claim
// ═══════════════════════════════════════════════════
async function resetMyChallenges(sql, admin) {
    // Delete all user_challenges progress
    await sql`DELETE FROM user_challenges WHERE user_id = ${admin.id}`

    // Delete ALL passion transactions
    await sql`DELETE FROM passion_transactions WHERE user_id = ${admin.id}`

    // Reset balance, streak, and daily claim to zero
    await sql`
        UPDATE passion_balances SET
            balance = 0,
            total_earned = 0,
            total_spent = 0,
            last_daily_claim = NULL,
            current_streak = 0,
            longest_streak = 0,
            updated_at = NOW()
        WHERE user_id = ${admin.id}
    `

    await logAudit(sql, admin, {
        action: 'reset-my-challenges', endpoint: 'challenge-manage',
        details: { fullReset: true },
    })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}

// ═══════════════════════════════════════════════════
// Recalculate ALL challenge progress for ALL users (Owner only)
// ═══════════════════════════════════════════════════
async function recalcAllChallenges(sql, admin, event) {
    // Owner-only: require permission_manage
    const owner = await requirePermission(event, 'permission_manage')
    if (!owner) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Owner only' }) }
    }

    // Find all users with linked players
    const users = await sql`
        SELECT id as user_id, linked_player_id
        FROM users
        WHERE linked_player_id IS NOT NULL
    `

    if (users.length === 0) {
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, updated: 0 }) }
    }

    // Recalculate using the same function that handles revocations
    await recalcMatchChallenges(sql, users)

    await logAudit(sql, admin, {
        action: 'recalc-all-challenges', endpoint: 'challenge-manage',
        details: { usersProcessed: users.length },
    })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, updated: users.length }) }
}

// ═══════════════════════════════════════════════════
// Catch up challenge progress for ALL users (give only, no revocations)
// ═══════════════════════════════════════════════════
async function catchupAllChallengesHandler(sql, admin) {
    const users = await sql`
        SELECT id as user_id, linked_player_id
        FROM users
        WHERE linked_player_id IS NOT NULL
    `

    const result = await catchupAllUsers(sql, users)

    await logAudit(sql, admin, {
        action: 'catchup-all-challenges', endpoint: 'challenge-manage',
        details: { usersProcessed: result.updated, newlyClaimable: result.claimable },
    })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, ...result }) }
}

export const onRequest = adapt(handler)

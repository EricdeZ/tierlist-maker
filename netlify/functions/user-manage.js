/* global process */
import { getDB, adminHeaders as headers } from './lib/db.js'
import { requirePermission } from './lib/auth.js'
import { logAudit } from './lib/audit.js'

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const admin = await requirePermission(event, 'user_manage')
    if (!admin) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const sql = getDB()

    try {
        // ─── GET: List all users with linked player info ───
        if (event.httpMethod === 'GET') {
            const users = await sql`
                SELECT
                    u.id, u.discord_id, u.discord_username, u.discord_avatar,
                    u.role, u.linked_player_id, u.created_at, u.updated_at,
                    p.name as player_name, p.slug as player_slug
                FROM users u
                LEFT JOIN players p ON u.linked_player_id = p.id
                ORDER BY u.created_at ASC
            `
            return { statusCode: 200, headers, body: JSON.stringify({ users }) }
        }

        // ─── POST: Actions ───
        if (event.httpMethod !== 'POST') {
            return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
        }
        if (!event.body) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Request body required' }) }
        }

        let body
        try { body = JSON.parse(event.body) } catch {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }
        }

        switch (body.action) {
            case 'set-role':
                return await setRole(sql, admin, body)
            case 'link-player':
                return await linkPlayer(sql, admin, body)
            case 'unlink-player':
                return await unlinkPlayer(sql, admin, body)
            default:
                return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${body.action}` }) }
        }
    } catch (error) {
        console.error('User manage error:', error)
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || 'Internal server error' }),
        }
    }
}

/**
 * Promote or demote a user's role.
 * Cannot change your own role.
 */
async function setRole(sql, admin, { user_id, role }) {
    if (!user_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'user_id required' }) }
    }
    if (!role || !['user', 'admin'].includes(role)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'role must be "user" or "admin"' }) }
    }
    if (admin.id === user_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Cannot change your own role' }) }
    }

    const [updated] = await sql`
        UPDATE users SET role = ${role}, updated_at = NOW()
        WHERE id = ${user_id}
        RETURNING id, discord_username, role
    `

    if (!updated) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'User not found' }) }
    }

    await logAudit(sql, admin, { action: 'set-role', endpoint: 'user-manage', targetType: 'user', targetId: user_id, details: { role, username: updated.discord_username } })

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, user: updated }),
    }
}

/**
 * Admin links a user to a player profile.
 * Validates no other user is already linked to that player.
 * Backfills discord_id on the player record.
 */
async function linkPlayer(sql, admin, { user_id, player_id }) {
    if (!user_id || !player_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'user_id and player_id required' }) }
    }

    // Check if another user is already linked to this player
    const [alreadyLinked] = await sql`
        SELECT id, discord_username FROM users
        WHERE linked_player_id = ${player_id} AND id != ${user_id}
        LIMIT 1
    `
    if (alreadyLinked) {
        return {
            statusCode: 409,
            headers,
            body: JSON.stringify({
                error: `Player is already linked to user "${alreadyLinked.discord_username}"`,
            }),
        }
    }

    const [updated] = await sql`
        UPDATE users SET linked_player_id = ${player_id}, updated_at = NOW()
        WHERE id = ${user_id}
        RETURNING id, discord_id, discord_username, linked_player_id
    `

    if (!updated) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'User not found' }) }
    }

    // Backfill discord_id on the player record
    await sql`
        UPDATE players SET discord_id = ${updated.discord_id}, updated_at = NOW()
        WHERE id = ${player_id}
    `

    await logAudit(sql, admin, { action: 'link-player', endpoint: 'user-manage', targetType: 'user', targetId: user_id, details: { player_id } })

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, user: updated }),
    }
}

/**
 * Admin unlinks a user from their player profile.
 */
async function unlinkPlayer(sql, admin, { user_id }) {
    if (!user_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'user_id required' }) }
    }

    const [updated] = await sql`
        UPDATE users SET linked_player_id = NULL, updated_at = NOW()
        WHERE id = ${user_id}
        RETURNING id, discord_username, linked_player_id
    `

    if (!updated) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'User not found' }) }
    }

    await logAudit(sql, admin, { action: 'unlink-player', endpoint: 'user-manage', targetType: 'user', targetId: user_id, details: { username: updated.discord_username } })

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, user: updated }),
    }
}

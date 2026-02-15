import { adapt } from '../lib/adapter.js'
// Returns current authenticated user info
import { getDB, headers } from '../lib/db.js'
import { requireAuth, getUserPermissions } from '../lib/auth.js'

const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    }

    const user = await requireAuth(event)
    if (!user) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid or expired token' }) }
    }

    // If user has a linked player, fetch player details + their most recent division
    let linkedPlayer = null
    if (user.linked_player_id) {
        const sql = getDB()
        const [player] = await sql`
            SELECT p.id, p.name, p.slug, p.discord_name,
                   l.slug AS league_slug, d.slug AS division_slug
            FROM players p
            LEFT JOIN league_players lp ON lp.player_id = p.id
            LEFT JOIN seasons s ON s.id = lp.season_id
            LEFT JOIN divisions d ON d.id = s.division_id
            LEFT JOIN leagues l ON l.id = s.league_id
            WHERE p.id = ${user.linked_player_id}
            ORDER BY s.is_active DESC NULLS LAST, s.start_date DESC NULLS LAST
            LIMIT 1
        `
        linkedPlayer = player || null
    }

    // Fetch RBAC permissions
    const permissions = await getUserPermissions(user.id)

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            user: {
                id: user.id,
                discord_id: user.discord_id,
                discord_username: user.discord_username,
                discord_avatar: user.discord_avatar,
                role: user.role,
                linked_player_id: user.linked_player_id,
            },
            linkedPlayer,
            permissions,
        }),
    }
}

export const onRequest = adapt(handler)

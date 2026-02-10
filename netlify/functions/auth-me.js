// netlify/functions/auth-me.js
// Returns current authenticated user info
import { getDB, headers } from './lib/db.js'
import { requireAuth } from './lib/auth.js'

export const handler = async (event) => {
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

    // If user has a linked player, fetch player details
    let linkedPlayer = null
    if (user.linked_player_id) {
        const sql = getDB()
        const [player] = await sql`
            SELECT id, name, slug, discord_name
            FROM players WHERE id = ${user.linked_player_id}
        `
        linkedPlayer = player || null
    }

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
        }),
    }
}

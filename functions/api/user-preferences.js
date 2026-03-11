import { adapt } from '../lib/adapter.js'
import { getDB, headers, getHeaders, handleCors } from '../lib/db.js'
import { requireAuth } from '../lib/auth.js'

const handler = async (event) => {
    const cors = handleCors(event)
    if (cors) return cors

    const user = await requireAuth(event)
    if (!user) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const sql = getDB()

    if (event.httpMethod === 'GET') {
        const [prefs] = await sql`
            SELECT allow_discord_avatar
            FROM user_preferences
            WHERE user_id = ${user.id}
        `
        return {
            statusCode: 200,
            headers: getHeaders(event),
            body: JSON.stringify({
                allow_discord_avatar: prefs?.allow_discord_avatar ?? true,
            }),
        }
    }

    if (event.httpMethod === 'POST') {
        if (!event.body) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Request body required' }) }
        }

        let body
        try {
            body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body
        } catch {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }
        }

        const { allow_discord_avatar } = body
        if (typeof allow_discord_avatar !== 'boolean') {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'allow_discord_avatar must be a boolean' }) }
        }

        await sql`
            INSERT INTO user_preferences (user_id, allow_discord_avatar)
            VALUES (${user.id}, ${allow_discord_avatar})
            ON CONFLICT (user_id)
            DO UPDATE SET allow_discord_avatar = ${allow_discord_avatar}, updated_at = NOW()
        `

        // Propagate to card system: update cc_player_defs and cc_cards
        const [linked] = await sql`
            SELECT linked_player_id FROM users WHERE id = ${user.id}
        `
        if (linked?.linked_player_id) {
            const playerId = linked.linked_player_id
            if (allow_discord_avatar) {
                // Re-enable: set avatar_url from current Discord info
                await sql`
                    UPDATE cc_player_defs SET avatar_url = (
                        SELECT 'https://cdn.discordapp.com/avatars/' || u.discord_id || '/' || u.discord_avatar || '.webp?size=256'
                        FROM users u WHERE u.id = ${user.id} AND u.discord_id IS NOT NULL AND u.discord_avatar IS NOT NULL
                    ), updated_at = NOW()
                    WHERE player_id = ${playerId}
                `
                // Update cc_cards image_url for player cards that had it cleared
                await sql`
                    UPDATE cc_cards SET image_url = d.avatar_url
                    FROM cc_player_defs d
                    WHERE cc_cards.def_id = d.id
                      AND cc_cards.card_type = 'player'
                      AND d.player_id = ${playerId}
                      AND d.avatar_url IS NOT NULL
                      AND (cc_cards.image_url IS NULL OR cc_cards.image_url = '')
                `
            } else {
                // Disable: clear Discord avatar from defs and cards
                await sql`
                    UPDATE cc_player_defs SET avatar_url = NULL, updated_at = NOW()
                    WHERE player_id = ${playerId}
                      AND avatar_url LIKE 'https://cdn.discordapp.com/avatars/%'
                `
                await sql`
                    UPDATE cc_cards SET image_url = ''
                    WHERE card_type = 'player'
                      AND def_id IN (SELECT id FROM cc_player_defs WHERE player_id = ${playerId})
                      AND image_url LIKE 'https://cdn.discordapp.com/avatars/%'
                `
            }
        }

        return {
            statusCode: 200,
            headers: getHeaders(event),
            body: JSON.stringify({ allow_discord_avatar }),
        }
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
}

export const onRequest = adapt(handler)

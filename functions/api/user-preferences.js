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

        return {
            statusCode: 200,
            headers: getHeaders(event),
            body: JSON.stringify({ allow_discord_avatar }),
        }
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
}

export const onRequest = adapt(handler)

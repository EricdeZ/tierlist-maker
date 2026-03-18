import { adapt } from '../lib/adapter.js'
import { getDB, handleCors, getHeaders, headers } from '../lib/db.js'

const handler = async (event) => {
    const cors = handleCors(event)
    if (cors) return cors

    const sql = getDB()

    try {
        if (event.httpMethod === 'GET') {
            const { slug } = event.queryStringParameters || {}

            if (slug) {
                const [tournament] = await sql`
                    SELECT id, name, slug, description, draft_date, game_dates,
                           signups_open, status, discord_invite_url, created_at
                    FROM tournaments
                    WHERE slug = ${slug}
                `
                if (!tournament) {
                    return {
                        statusCode: 404,
                        headers: getHeaders(event),
                        body: JSON.stringify({ error: 'Tournament not found' }),
                    }
                }
                return {
                    statusCode: 200,
                    headers: getHeaders(event),
                    body: JSON.stringify(tournament),
                }
            }

            // List all non-completed tournaments
            const tournaments = await sql`
                SELECT id, name, slug, description, draft_date, game_dates,
                       signups_open, status, discord_invite_url, created_at
                FROM tournaments
                WHERE status != 'completed'
                ORDER BY created_at DESC
            `
            return {
                statusCode: 200,
                headers: getHeaders(event),
                body: JSON.stringify(tournaments),
            }
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    } catch (error) {
        console.error('Tournaments error:', error)
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) }
    }
}

export const onRequest = adapt(handler)

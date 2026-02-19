import { adapt } from '../lib/adapter.js'
import { getDB, handleCors, getHeaders, headers } from '../lib/db.js'

const handler = async (event) => {
    const cors = handleCors(event)
    if (cors) return cors
    const sql = getDB()

    try {
        if (event.httpMethod === 'GET') {
            const { action } = event.queryStringParameters || {}

            // Top player per god (most games played on that god)
            if (action === 'top-players') {
                const rows = await sql`
                    SELECT DISTINCT ON (g.id)
                        g.id as god_id,
                        p.name as player_name,
                        p.slug as player_slug,
                        COUNT(*) as games
                    FROM player_game_stats pgs
                    JOIN league_players lp ON pgs.league_player_id = lp.id
                    JOIN players p ON lp.player_id = p.id
                    JOIN gods g ON LOWER(g.name) = LOWER(pgs.god_played)
                    GROUP BY g.id, p.id, p.name, p.slug
                    ORDER BY g.id, COUNT(*) DESC
                `
                const topPlayers = {}
                for (const r of rows) {
                    topPlayers[r.god_id] = { playerName: r.player_name, playerSlug: r.player_slug, games: Number(r.games) }
                }
                return {
                    statusCode: 200,
                    headers: getHeaders(event),
                    body: JSON.stringify({ topPlayers }),
                }
            }

            const gods = await sql`
                SELECT id, name, slug, image_url
                FROM gods
                ORDER BY name
            `

            return {
                statusCode: 200,
                headers: getHeaders(event),
                body: JSON.stringify(gods),
            }
        }

        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' }),
        }
    } catch (error) {
        console.error('Database error:', error)
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' }),
        }
    }
}

export const onRequest = adapt(handler)

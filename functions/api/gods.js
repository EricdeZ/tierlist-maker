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
                // Get the top player for each god that has been played
                const rows = await sql`
                    SELECT DISTINCT ON (ranked.god_id)
                        ranked.god_id,
                        ranked.player_name,
                        ranked.player_slug,
                        ranked.games
                    FROM (
                        SELECT
                            g.id as god_id,
                            p.name as player_name,
                            p.slug as player_slug,
                            COUNT(*) as games
                        FROM player_game_stats pgs
                        JOIN league_players lp ON pgs.league_player_id = lp.id
                        JOIN players p ON lp.player_id = p.id
                        JOIN gods g ON LOWER(g.name) = LOWER(pgs.god_played)
                        GROUP BY g.id, p.id, p.name, p.slug
                    ) ranked
                    ORDER BY ranked.god_id, ranked.games DESC
                `
                // Get a random player as fallback for gods never played
                const fallbackRows = await sql`
                    SELECT name, slug FROM players ORDER BY RANDOM() LIMIT 1
                `
                const fallback = fallbackRows.length > 0
                    ? { playerName: fallbackRows[0].name, playerSlug: fallbackRows[0].slug, games: 0 }
                    : null

                const topPlayers = {}
                for (const r of rows) {
                    topPlayers[r.god_id] = { playerName: r.player_name, playerSlug: r.player_slug, games: Number(r.games) }
                }

                // Fill in fallback for all gods
                if (fallback) {
                    const allGods = await sql`SELECT id FROM gods`
                    for (const g of allGods) {
                        if (!topPlayers[g.id]) {
                            topPlayers[g.id] = fallback
                        }
                    }
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

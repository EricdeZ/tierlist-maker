import { adapt } from '../lib/adapter.js'
import {getDB, handleCors, headers, getHeaders} from '../lib/db.js'

const handler = async (event, context) => {
    const cors = handleCors(event)
    if (cors) return cors
    const sql = getDB()
    const { seasonId, playerId } = event.queryStringParameters || {}

    try {
        if (event.httpMethod === 'GET') {

            // Get all players in a season (exclude subs)
            if (seasonId && !playerId) {
                const players = await sql`
                    SELECT
                        p.id,
                        p.name,
                        p.slug,
                        p.tracker_url,
                        lp.role,
                        lp.secondary_role,
                        lp.is_active,
                        lp.roster_status,
                        t.id as team_id,
                        t.name as team_name,
                        t.color as team_color,
                        t.slug as team_slug
                    FROM league_players lp
                    JOIN players p ON lp.player_id = p.id
                    LEFT JOIN teams t ON lp.team_id = t.id
                    WHERE lp.season_id = ${seasonId}
                      AND lp.is_active = true
                      AND lp.roster_status != 'sub'
                    ORDER BY t.name, CASE WHEN lp.roster_status = 'captain' THEN 0 ELSE 1 END, p.name
                `

                return {
                    statusCode: 200,
                    headers: getHeaders(event),
                    body: JSON.stringify(players),
                }
            }

            // Get player stats
            if (seasonId && playerId) {
                const [player] = await sql`
                    SELECT 
                        p.id,
                        p.name,
                        p.slug,
                        p.tracker_url,
                        lp.role,
                        lp.secondary_role,
                        t.name as team_name,
                        t.color as team_color
                    FROM league_players lp
                    JOIN players p ON lp.player_id = p.id
                    LEFT JOIN teams t ON lp.team_id = t.id
                    WHERE lp.season_id = ${seasonId} AND p.id = ${playerId}
                `

                return {
                    statusCode: 200,
                    headers: getHeaders(event),
                    body: JSON.stringify(player || {}),
                }
            }
        }

        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid parameters' }),
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

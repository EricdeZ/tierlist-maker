import { getDB, headers } from './lib/db.js'

export const handler = async (event, context) => {
    const sql = getDB()
    const { leagueId, playerId } = event.queryStringParameters || {}

    try {
        if (event.httpMethod === 'GET') {

            // Get all players in a league
            if (leagueId && !playerId) {
                const players = await sql`
          SELECT 
            p.id,
            p.name,
            p.slug,
            p.tracker_url,
            lp.role,
            lp.is_active,
            lp.season,
            t.id as team_id,
            t.name as team_name,
            t.color as team_color,
            t.slug as team_slug
          FROM league_players lp
          JOIN players p ON lp.player_id = p.id
          LEFT JOIN teams t ON lp.team_id = t.id
          WHERE lp.league_id = ${leagueId} AND lp.is_active = true
          ORDER BY t.name, p.name
        `

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify(players),
                }
            }

            // Get player stats - simplified since we may not have game stats yet
            if (leagueId && playerId) {
                const [player] = await sql`
          SELECT 
            p.id,
            p.name,
            p.slug,
            p.tracker_url,
            lp.role,
            t.name as team_name,
            t.color as team_color
          FROM league_players lp
          JOIN players p ON lp.player_id = p.id
          LEFT JOIN teams t ON lp.team_id = t.id
          WHERE lp.league_id = ${leagueId} AND p.id = ${playerId}
        `

                // Return basic player info for now - stats calculation can come later
                return {
                    statusCode: 200,
                    headers,
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
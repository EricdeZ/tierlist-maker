import { getDB, headers } from './lib/db.js'

export const handler = async (event, context) => {
    const sql = getDB()
    const { leagueId } = event.queryStringParameters || {}

    try {
        if (event.httpMethod === 'GET' && leagueId) {
            const teams = await sql`
        SELECT 
          t.*,
          COUNT(lp.id) as player_count
        FROM teams t
        LEFT JOIN league_players lp ON t.id = lp.team_id AND lp.is_active = true
        WHERE t.league_id = ${leagueId}
        GROUP BY t.id
        ORDER BY t.name
      `

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(teams),
            }
        }

        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'leagueId parameter required' }),
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
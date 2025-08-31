import { getDB, headers } from './lib/db.js'

export const handler = async (event, context) => {
    const sql = getDB()
    const { leagueId, limit } = event.queryStringParameters || {}

    try {
        if (event.httpMethod === 'GET' && leagueId) {
            const matches = await sql`
        SELECT 
          m.*,
          t1.name as team1_name,
          t1.color as team1_color,
          t1.slug as team1_slug,
          t2.name as team2_name,
          t2.color as team2_color,
          t2.slug as team2_slug,
          tw.name as winner_name,
          tw.color as winner_color,
          COUNT(g.id) as games_count
        FROM matches m
        JOIN teams t1 ON m.team1_id = t1.id
        JOIN teams t2 ON m.team2_id = t2.id
        LEFT JOIN teams tw ON m.winner_team_id = tw.id
        LEFT JOIN games g ON m.id = g.match_id
        WHERE m.league_id = ${leagueId}
        GROUP BY m.id, t1.id, t2.id, tw.id
        ORDER BY m.date DESC, m.created_at DESC
        ${limit ? sql`LIMIT ${parseInt(limit)}` : sql``}
      `

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(matches),
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
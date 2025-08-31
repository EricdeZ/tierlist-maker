import { getDB, headers } from './lib/db.js'

export const handler = async (event, context) => {
    const sql = getDB()
    const { leagueId } = event.queryStringParameters || {}

    try {
        if (event.httpMethod === 'GET' && leagueId) {
            const [stats] = await sql`
        SELECT 
          COUNT(DISTINCT m.id) as total_matches,
          COUNT(DISTINCT g.id) as total_games,
          COUNT(DISTINCT lp.player_id) as total_players,
          COUNT(DISTINCT t.id) as total_teams,
          COALESCE(SUM(pgs.kills), 0) as total_kills,
          COALESCE(SUM(pgs.deaths), 0) as total_deaths,
          COALESCE(SUM(pgs.assists), 0) as total_assists,
          COALESCE(SUM(pgs.damage), 0) as total_damage
        FROM matches m
        LEFT JOIN games g ON m.id = g.match_id AND g.is_completed = true
        LEFT JOIN teams t ON (m.team1_id = t.id OR m.team2_id = t.id)
        LEFT JOIN league_players lp ON t.id = lp.team_id AND lp.league_id = m.league_id
        LEFT JOIN player_game_stats pgs ON g.id = pgs.game_id
        WHERE m.league_id = ${leagueId}
      `

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(stats || {}),
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
import { getDB, headers } from './lib/db.js'

export const handler = async (event, context) => {
    const sql = getDB()
    const { leagueId } = event.queryStringParameters || {}

    try {
        if (event.httpMethod === 'GET' && leagueId) {
            // Basic stats using only columns that exist
            const [matchStats] = await sql`
        SELECT 
          COUNT(m.id) as total_matches,
          COUNT(g.id) as total_games
        FROM matches m
        LEFT JOIN games g ON m.id = g.match_id AND g.is_completed = true
        WHERE m.league_id = ${leagueId}
      `

            const [teamStats] = await sql`
        SELECT COUNT(id) as total_teams
        FROM teams 
        WHERE league_id = ${leagueId}
      `

            const [playerStats] = await sql`
        SELECT COUNT(id) as total_players
        FROM league_players 
        WHERE league_id = ${leagueId} AND is_active = true
      `

            // Combine results
            const stats = {
                total_matches: matchStats.total_matches || 0,
                total_games: matchStats.total_games || 0,
                total_teams: teamStats.total_teams || 0,
                total_players: playerStats.total_players || 0,
                total_kills: 0, // Will add when we have game stats
                total_deaths: 0,
                total_assists: 0,
                total_damage: 0
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(stats),
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
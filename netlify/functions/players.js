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

            // Get player stats
            if (leagueId && playerId) {
                const [summary] = await sql`
          SELECT 
            COUNT(pgs.id) as games_played,
            SUM(pgs.kills) as total_kills,
            SUM(pgs.deaths) as total_deaths,
            SUM(pgs.assists) as total_assists,
            SUM(pgs.damage) as total_damage,
            SUM(pgs.mitigated) as total_mitigated,
            AVG(pgs.kills::numeric) as avg_kills,
            AVG(pgs.deaths::numeric) as avg_deaths,
            AVG(pgs.assists::numeric) as avg_assists,
            AVG(pgs.damage::numeric) as avg_damage,
            CASE 
              WHEN SUM(pgs.deaths) = 0 THEN SUM(pgs.kills) + (SUM(pgs.assists)::numeric / 2)
              ELSE (SUM(pgs.kills) + (SUM(pgs.assists)::numeric / 2)) / SUM(pgs.deaths)::numeric
            END as kda_ratio
          FROM player_game_stats pgs
          JOIN games g ON pgs.game_id = g.id
          JOIN matches m ON g.match_id = m.id
          JOIN league_players lp ON pgs.league_player_id = lp.id
          WHERE lp.player_id = ${playerId} 
            AND m.league_id = ${leagueId}
            AND g.is_completed = true
        `

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify(summary || {}),
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
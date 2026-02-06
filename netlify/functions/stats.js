import { getDB, headers } from './lib/db.js'

export const handler = async (event, context) => {
    const sql = getDB()
    const { seasonId, type } = event.queryStringParameters || {}

    try {
        if (event.httpMethod === 'GET' && seasonId) {

            // Player stats endpoint - detailed per-player statistics
            if (type === 'players') {
                const playerStats = await sql`
                    SELECT 
                        p.id,
                        p.name,
                        p.tracker_url,
                        lp.role,
                        lp.secondary_role,
                        t.name as team_name,
                        t.color as team_color,
                        COUNT(DISTINCT pgs.game_id) as games_played,
                        COALESCE(SUM(pgs.kills), 0) as total_kills,
                        COALESCE(SUM(pgs.deaths), 0) as total_deaths,
                        COALESCE(SUM(pgs.assists), 0) as total_assists,
                        COALESCE(SUM(pgs.damage), 0) as total_damage,
                        COALESCE(SUM(pgs.mitigated), 0) as total_mitigated,
                        COALESCE(AVG(pgs.kills), 0) as avg_kills,
                        COALESCE(AVG(pgs.deaths), 0) as avg_deaths,
                        COALESCE(AVG(pgs.assists), 0) as avg_assists,
                        COALESCE(AVG(pgs.damage), 0) as avg_damage,
                        COALESCE(AVG(pgs.mitigated), 0) as avg_mitigated,
                        COUNT(DISTINCT CASE 
                            WHEN g.winner_team_id = lp.team_id 
                            THEN pgs.game_id 
                        END) as wins,
                        COUNT(DISTINCT pgs.game_id) as total_games_for_winrate
                    FROM league_players lp
                    JOIN players p ON lp.player_id = p.id
                    LEFT JOIN teams t ON lp.team_id = t.id
                    LEFT JOIN player_game_stats pgs ON pgs.league_player_id = lp.id
                    LEFT JOIN games g ON pgs.game_id = g.id AND g.is_completed = true
                    LEFT JOIN matches m ON g.match_id = m.id
                    WHERE lp.season_id = ${seasonId} 
                      AND lp.is_active = true
                      AND (m.season_id = ${seasonId} OR pgs.game_id IS NULL)
                    GROUP BY p.id, p.name, p.tracker_url, lp.role, lp.secondary_role, t.name, t.color, lp.team_id
                    ORDER BY total_kills DESC
                `

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify(playerStats),
                }
            }

            // Season overview stats (default)
            const [matchStats] = await sql`
                SELECT 
                    COUNT(m.id) as total_matches,
                    COUNT(g.id) as total_games
                FROM matches m
                LEFT JOIN games g ON m.id = g.match_id AND g.is_completed = true
                WHERE m.season_id = ${seasonId}
            `

            const [teamStats] = await sql`
                SELECT COUNT(id) as total_teams
                FROM teams 
                WHERE season_id = ${seasonId}
            `

            const [playerStats] = await sql`
                SELECT COUNT(id) as total_players
                FROM league_players 
                WHERE season_id = ${seasonId} AND is_active = true
            `

            // Get player game stats if available
            const [gameStats] = await sql`
                SELECT 
                    COALESCE(SUM(pgs.kills), 0) as total_kills,
                    COALESCE(SUM(pgs.deaths), 0) as total_deaths,
                    COALESCE(SUM(pgs.assists), 0) as total_assists,
                    COALESCE(SUM(pgs.damage), 0) as total_damage
                FROM player_game_stats pgs
                JOIN games g ON pgs.game_id = g.id
                JOIN matches m ON g.match_id = m.id
                WHERE m.season_id = ${seasonId}
            `

            // Combine results
            const stats = {
                total_matches: matchStats.total_matches || 0,
                total_games: matchStats.total_games || 0,
                total_teams: teamStats.total_teams || 0,
                total_players: playerStats.total_players || 0,
                total_kills: gameStats?.total_kills || 0,
                total_deaths: gameStats?.total_deaths || 0,
                total_assists: gameStats?.total_assists || 0,
                total_damage: gameStats?.total_damage || 0
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
            body: JSON.stringify({ error: 'seasonId parameter required' }),
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
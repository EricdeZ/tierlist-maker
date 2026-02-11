import { getDB, headers, handleCors } from './lib/db.js'

export const handler = async (event) => {
    const cors = handleCors(event)
    if (cors) return cors

    const sql = getDB()
    const { seasonId, type, playerId } = event.queryStringParameters || {}

    try {
        if (event.httpMethod === 'GET' && seasonId) {

            // Per-game stats for a specific player
            if (type === 'player-games' && playerId) {
                const games = await sql`
                    SELECT
                        g.id as game_id,
                        g.game_number,
                        m.id as match_id,
                        m.date,
                        m.week,
                        m.best_of,
                        m.team1_id,
                        m.team2_id,
                        t1.name as team1_name,
                        t1.color as team1_color,
                        t1.slug as team1_slug,
                        t2.name as team2_name,
                        t2.color as team2_color,
                        t2.slug as team2_slug,
                        g.winner_team_id,
                        pgs.kills,
                        pgs.deaths,
                        pgs.assists,
                        pgs.damage,
                        pgs.mitigated,
                        pgs.god_played,
                        pgs.team_side,
                        CASE pgs.team_side
                            WHEN 1 THEN m.team1_id
                            WHEN 2 THEN m.team2_id
                        END as player_team_id
                    FROM player_game_stats pgs
                    JOIN league_players lp ON pgs.league_player_id = lp.id
                    JOIN games g ON pgs.game_id = g.id AND g.is_completed = true
                    JOIN matches m ON g.match_id = m.id
                    JOIN teams t1 ON m.team1_id = t1.id
                    JOIN teams t2 ON m.team2_id = t2.id
                    WHERE lp.player_id = ${playerId}
                      AND lp.season_id = ${seasonId}
                    ORDER BY m.date DESC, g.game_number
                `

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify(games),
                }
            }

            // Player stats endpoint - detailed per-player statistics (exclude subs)
            if (type === 'players') {
                const playerStats = await sql`
                    WITH player_agg AS (
                        SELECT
                            pgs.league_player_id,
                            COUNT(DISTINCT pgs.game_id) as games_played,
                            COALESCE(SUM(pgs.kills), 0) as total_kills,
                            COALESCE(SUM(pgs.deaths), 0) as total_deaths,
                            COALESCE(SUM(pgs.assists), 0) as total_assists,
                            COALESCE(SUM(NULLIF(pgs.damage, 0)), 0) as total_damage,
                            COALESCE(SUM(NULLIF(pgs.mitigated, 0)), 0) as total_mitigated,
                            COALESCE(AVG(pgs.kills), 0) as avg_kills,
                            COALESCE(AVG(pgs.deaths), 0) as avg_deaths,
                            COALESCE(AVG(pgs.assists), 0) as avg_assists,
                            COALESCE(AVG(NULLIF(pgs.damage, 0)), 0) as avg_damage,
                            COALESCE(AVG(NULLIF(pgs.mitigated, 0)), 0) as avg_mitigated,
                            COUNT(DISTINCT pgs.game_id) FILTER (
                                WHERE g.winner_team_id = CASE pgs.team_side
                                    WHEN 1 THEN m.team1_id
                                    WHEN 2 THEN m.team2_id
                                END
                            ) as wins
                        FROM player_game_stats pgs
                        JOIN games g ON pgs.game_id = g.id AND g.is_completed = true
                        JOIN matches m ON g.match_id = m.id
                        GROUP BY pgs.league_player_id
                    )
                    SELECT
                        p.id,
                        p.name,
                        p.tracker_url,
                        lp.role,
                        lp.secondary_role,
                        t.name as team_name,
                        t.color as team_color,
                        COALESCE(pa.games_played, 0) as games_played,
                        COALESCE(pa.total_kills, 0) as total_kills,
                        COALESCE(pa.total_deaths, 0) as total_deaths,
                        COALESCE(pa.total_assists, 0) as total_assists,
                        COALESCE(pa.total_damage, 0) as total_damage,
                        COALESCE(pa.total_mitigated, 0) as total_mitigated,
                        COALESCE(pa.avg_kills, 0) as avg_kills,
                        COALESCE(pa.avg_deaths, 0) as avg_deaths,
                        COALESCE(pa.avg_assists, 0) as avg_assists,
                        COALESCE(pa.avg_damage, 0) as avg_damage,
                        COALESCE(pa.avg_mitigated, 0) as avg_mitigated,
                        COALESCE(pa.wins, 0) as wins,
                        COALESCE(pa.games_played, 0) as total_games_for_winrate
                    FROM league_players lp
                    JOIN players p ON lp.player_id = p.id
                    LEFT JOIN teams t ON lp.team_id = t.id
                    LEFT JOIN player_agg pa ON pa.league_player_id = lp.id
                    WHERE lp.season_id = ${seasonId}
                      AND lp.is_active = true
                      AND LOWER(lp.role) != 'sub'
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
                  AND m.is_completed = true
            `

            const [teamStats] = await sql`
                SELECT COUNT(id) as total_teams
                FROM teams 
                WHERE season_id = ${seasonId}
            `

            const [playerStats] = await sql`
                SELECT COUNT(id) as total_players
                FROM league_players 
                WHERE season_id = ${seasonId} 
                  AND is_active = true
                  AND LOWER(role) != 'sub'
            `

            const [gameStats] = await sql`
                SELECT
                    COALESCE(SUM(pgs.kills), 0) as total_kills,
                    COALESCE(SUM(pgs.deaths), 0) as total_deaths,
                    COALESCE(SUM(pgs.assists), 0) as total_assists,
                    COALESCE(SUM(NULLIF(pgs.damage, 0)), 0) as total_damage
                FROM player_game_stats pgs
                JOIN games g ON pgs.game_id = g.id
                JOIN matches m ON g.match_id = m.id
                WHERE m.season_id = ${seasonId}
            `

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
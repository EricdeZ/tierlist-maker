import { getDB, handleCors, headers } from './lib/db.js'

export const handler = async (event) => {
    const cors = handleCors(event)
    if (cors) return cors

    const sql = getDB()
    const { matchId } = event.queryStringParameters || {}

    try {
        if (event.httpMethod === 'GET' && matchId) {
            // 1. Get the match itself
            const [match] = await sql`
                SELECT
                    m.id,
                    m.season_id,
                    m.date,
                    m.team1_id,
                    m.team2_id,
                    m.winner_team_id,
                    m.match_type,
                    m.week,
                    m.best_of,
                    m.is_completed,
                    m.created_at,
                    t1.name as team1_name,
                    t1.color as team1_color,
                    t1.slug as team1_slug,
                    t2.name as team2_name,
                    t2.color as team2_color,
                    t2.slug as team2_slug,
                    tw.name as winner_name,
                    tw.color as winner_color
                FROM matches m
                JOIN teams t1 ON m.team1_id = t1.id
                JOIN teams t2 ON m.team2_id = t2.id
                LEFT JOIN teams tw ON m.winner_team_id = tw.id
                WHERE m.id = ${matchId}
            `

            if (!match) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ error: 'Match not found' }),
                }
            }

            // 2. Get all games for this match
            const games = await sql`
                SELECT
                    g.id,
                    g.game_number,
                    g.winner_team_id,
                    g.is_completed,
                    COALESCE(g.is_forfeit, false) as is_forfeit,
                    tw.name as winner_name,
                    tw.color as winner_color
                FROM games g
                LEFT JOIN teams tw ON g.winner_team_id = tw.id
                WHERE g.match_id = ${matchId}
                ORDER BY g.game_number
            `

            // 3. Get player stats for all games in this match
            const playerStats = await sql`
                SELECT
                    pgs.game_id,
                    pgs.team_side,
                    pgs.god_played,
                    pgs.kills,
                    pgs.deaths,
                    pgs.assists,
                    pgs.damage,
                    pgs.mitigated,
                    p.id as player_id,
                    p.name as player_name,
                    p.slug as player_slug,
                    lp.role,
                    lp.team_id
                FROM player_game_stats pgs
                JOIN league_players lp ON pgs.league_player_id = lp.id
                JOIN players p ON lp.player_id = p.id
                JOIN games g ON pgs.game_id = g.id
                WHERE g.match_id = ${matchId}
                ORDER BY pgs.team_side, p.name
            `

            // 4. Group player stats by game
            const gamesWithStats = games.map(game => {
                const gamePlayerStats = playerStats.filter(ps => ps.game_id === game.id)

                // team_side 1 = order (team1), team_side 2 = chaos (team2)
                const team1Players = gamePlayerStats
                    .filter(ps => ps.team_side === 1)
                    .map(ps => ({
                        player_id: ps.player_id,
                        player_name: ps.player_name,
                        player_slug: ps.player_slug,
                        role: ps.role,
                        god_played: ps.god_played,
                        kills: ps.kills,
                        deaths: ps.deaths,
                        assists: ps.assists,
                        damage: ps.damage,
                        mitigated: ps.mitigated,
                    }))

                const team2Players = gamePlayerStats
                    .filter(ps => ps.team_side === 2)
                    .map(ps => ({
                        player_id: ps.player_id,
                        player_name: ps.player_name,
                        player_slug: ps.player_slug,
                        role: ps.role,
                        god_played: ps.god_played,
                        kills: ps.kills,
                        deaths: ps.deaths,
                        assists: ps.assists,
                        damage: ps.damage,
                        mitigated: ps.mitigated,
                    }))

                // Compute team totals
                const sum = (arr, key) => arr.reduce((s, p) => s + (p[key] || 0), 0)

                return {
                    ...game,
                    team1_players: team1Players,
                    team2_players: team2Players,
                    team1_totals: {
                        kills: sum(team1Players, 'kills'),
                        deaths: sum(team1Players, 'deaths'),
                        assists: sum(team1Players, 'assists'),
                        damage: sum(team1Players, 'damage'),
                        mitigated: sum(team1Players, 'mitigated'),
                    },
                    team2_totals: {
                        kills: sum(team2Players, 'kills'),
                        deaths: sum(team2Players, 'deaths'),
                        assists: sum(team2Players, 'assists'),
                        damage: sum(team2Players, 'damage'),
                        mitigated: sum(team2Players, 'mitigated'),
                    },
                }
            })

            // 5. Compute series score
            const team1GameWins = games.filter(g => g.winner_team_id === match.team1_id).length
            const team2GameWins = games.filter(g => g.winner_team_id === match.team2_id).length

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    ...match,
                    team1_game_wins: team1GameWins,
                    team2_game_wins: team2GameWins,
                    games: gamesWithStats,
                }),
            }
        }

        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'matchId parameter required' }),
        }
    } catch (error) {
        console.error('Match detail error:', error)
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' }),
        }
    }
}

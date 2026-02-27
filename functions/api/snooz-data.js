import { adapt } from '../lib/adapter.js'
import { getDB, handleCors, getHeaders } from '../lib/db.js'

const handler = async (event) => {
    const cors = handleCors(event)
    if (cors) return cors
    const sql = getDB()
    const { week, divisionSlug } = event.queryStringParameters || {}

    try {
        if (event.httpMethod !== 'GET') {
            return { statusCode: 405, headers: getHeaders(event), body: JSON.stringify({ error: 'Method not allowed' }) }
        }

        const [league] = await sql`SELECT id, name, slug, color FROM leagues WHERE slug = 'osl'`
        if (!league) {
            return { statusCode: 404, headers: getHeaders(event), body: JSON.stringify({ error: 'OSL league not found' }) }
        }

        const divisions = await sql`
            SELECT d.id, d.name, d.slug, d.tier, s.id as season_id, s.name as season_name
            FROM divisions d
            JOIN seasons s ON s.division_id = d.id AND s.is_active = true
            WHERE d.league_id = ${league.id}
            ORDER BY d.tier ASC
        `

        if (divisions.length === 0) {
            return { statusCode: 200, headers: getHeaders(event), body: JSON.stringify({ league, divisions: [], matches: [], standings: [], playerStats: [], allPlayers: [] }) }
        }

        const activeDivision = (divisionSlug && divisions.find(d => d.slug === divisionSlug)) || divisions[0]
        const seasonId = activeDivision.season_id

        const scheduledMatches = week ? await sql`
            SELECT
                sm.id, sm.season_id, sm.scheduled_date as date,
                sm.team1_id, sm.team2_id, sm.week, sm.best_of, sm.status,
                t1.name as team1_name, t1.color as team1_color, t1.slug as team1_slug, t1.logo_url as team1_logo,
                t2.name as team2_name, t2.color as team2_color, t2.slug as team2_slug, t2.logo_url as team2_logo
            FROM scheduled_matches sm
            JOIN teams t1 ON sm.team1_id = t1.id
            JOIN teams t2 ON sm.team2_id = t2.id
            WHERE sm.season_id = ${seasonId}
              AND sm.week = ${parseInt(week)}
            ORDER BY sm.scheduled_date ASC, sm.id ASC
        ` : []

        const completedMatches = week ? await sql`
            SELECT
                m.id, m.season_id, m.date, m.team1_id, m.team2_id,
                m.winner_team_id, m.week, m.best_of, m.is_completed,
                t1.name as team1_name, t1.color as team1_color, t1.slug as team1_slug, t1.logo_url as team1_logo,
                t2.name as team2_name, t2.color as team2_color, t2.slug as team2_slug, t2.logo_url as team2_logo,
                tw.name as winner_name
            FROM matches m
            JOIN teams t1 ON m.team1_id = t1.id
            JOIN teams t2 ON m.team2_id = t2.id
            LEFT JOIN teams tw ON m.winner_team_id = tw.id
            WHERE m.season_id = ${seasonId}
              AND m.week = ${parseInt(week)}
            ORDER BY m.date ASC
        ` : []

        // Standings with full team info
        const standings = await sql`
            SELECT
                t.id as team_id, t.name as team_name, t.color as team_color, t.slug as team_slug, t.logo_url as team_logo,
                COUNT(DISTINCT m.id) FILTER (WHERE m.winner_team_id = t.id) as wins,
                COUNT(DISTINCT m.id) FILTER (WHERE m.is_completed AND m.winner_team_id IS NOT NULL AND m.winner_team_id != t.id) as losses,
                COUNT(DISTINCT g.id) FILTER (WHERE g.is_completed AND g.winner_team_id = t.id) as game_wins,
                COUNT(DISTINCT g.id) FILTER (WHERE g.is_completed AND g.winner_team_id IS NOT NULL AND g.winner_team_id != t.id) as game_losses
            FROM teams t
            LEFT JOIN matches m
                ON m.season_id = ${seasonId}
                AND m.is_completed = true
                AND (m.team1_id = t.id OR m.team2_id = t.id)
            LEFT JOIN games g
                ON g.match_id = m.id
                AND g.is_completed = true
                AND (m.team1_id = t.id OR m.team2_id = t.id)
            WHERE t.season_id = ${seasonId}
            GROUP BY t.id, t.name, t.color, t.slug, t.logo_url
            ORDER BY COUNT(DISTINCT m.id) FILTER (WHERE m.winner_team_id = t.id) DESC, COUNT(DISTINCT m.id) FILTER (WHERE m.is_completed AND m.winner_team_id IS NOT NULL AND m.winner_team_id != t.id) ASC
        `

        // All player stats for the season (for team drill-down + ticker)
        const allPlayers = await sql`
            WITH stats AS (
                SELECT
                    pgs.league_player_id,
                    COUNT(pgs.id) as games_played,
                    SUM(pgs.kills) as total_kills,
                    SUM(pgs.deaths) as total_deaths,
                    SUM(pgs.assists) as total_assists,
                    SUM(COALESCE(NULLIF(pgs.damage, 0), 0)) as total_damage,
                    SUM(COALESCE(NULLIF(pgs.mitigated, 0), 0)) as total_mitigated,
                    AVG(pgs.kills) as avg_kills,
                    AVG(pgs.deaths) as avg_deaths,
                    AVG(pgs.assists) as avg_assists,
                    AVG(NULLIF(pgs.damage, 0)) as avg_damage,
                    AVG(NULLIF(pgs.mitigated, 0)) as avg_mitigated,
                    COUNT(DISTINCT pgs.game_id) FILTER (
                        WHERE g.winner_team_id = CASE pgs.team_side
                            WHEN 1 THEN m.team1_id
                            WHEN 2 THEN m.team2_id
                        END
                    ) as wins
                FROM player_game_stats pgs
                JOIN games g ON pgs.game_id = g.id AND g.is_completed = true
                JOIN matches m ON g.match_id = m.id
                WHERE m.season_id = ${seasonId}
                GROUP BY pgs.league_player_id
            )
            SELECT
                p.id, p.name, p.slug,
                lp.role, lp.secondary_role, lp.roster_status, lp.team_id,
                t.name as team_name, t.color as team_color, t.slug as team_slug,
                s.games_played, s.total_kills, s.total_deaths, s.total_assists,
                s.total_damage, s.total_mitigated,
                s.avg_kills, s.avg_deaths, s.avg_assists, s.avg_damage, s.avg_mitigated,
                s.wins
            FROM league_players lp
            JOIN players p ON lp.player_id = p.id
            JOIN teams t ON lp.team_id = t.id
            LEFT JOIN stats s ON s.league_player_id = lp.id
            WHERE lp.season_id = ${seasonId}
              AND lp.is_active = true
              AND lp.roster_status != 'sub'
            ORDER BY t.name ASC, lp.roster_status ASC, p.name ASC
        `

        // Top KDA for ticker (derived from allPlayers, pick top 30 with games)
        const tickerPlayers = allPlayers
            .filter(p => p.games_played >= 2)
            .map(p => {
                const k = Number(p.avg_kills) || 0
                const d = Number(p.avg_deaths) || 0
                const a = Number(p.avg_assists) || 0
                const kda = d > 0 ? (k + a / 2) / d : k + a / 2
                return { ...p, kda }
            })
            .sort((a, b) => b.kda - a.kda)
            .slice(0, 30)

        return {
            statusCode: 200,
            headers: getHeaders(event),
            body: JSON.stringify({
                league,
                divisions: divisions.map(d => ({ id: d.id, name: d.name, slug: d.slug, tier: d.tier, season_id: d.season_id, season_name: d.season_name })),
                activeDivision: { id: activeDivision.id, name: activeDivision.name, slug: activeDivision.slug, tier: activeDivision.tier, season_id: activeDivision.season_id },
                matches: [...completedMatches, ...scheduledMatches],
                standings,
                allPlayers,
                tickerPlayers,
            }),
        }
    } catch (error) {
        console.error('Snooz data error:', error.message, error.stack)
        return { statusCode: 500, headers: getHeaders(event), body: JSON.stringify({ error: 'Internal server error' }) }
    }
}

export const onRequest = adapt(handler)

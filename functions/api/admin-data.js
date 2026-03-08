import { adapt } from '../lib/adapter.js'
import { getDB, adminHeaders as headers } from '../lib/db.js'
import { requirePermission, getAllowedLeagueIds, leagueFilter } from '../lib/auth.js'

const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const admin = await requirePermission(event, 'match_report')
    if (!admin) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const sql = getDB()

    try {
        // Determine which leagues this user can access for match_report
        const allowed = await getAllowedLeagueIds(admin.id, 'match_report')
        const lf = leagueFilter(sql, allowed)

        // Fetch seasons with their league/division info (filtered by allowed leagues)
        const seasons = await sql`
            SELECT
                s.id as season_id, s.name as season_name, s.is_active,
                d.id as division_id, d.name as division_name, d.slug as division_slug,
                l.id as league_id, l.name as league_name, l.slug as league_slug
            FROM seasons s
            JOIN divisions d ON s.division_id = d.id
            JOIN leagues l ON d.league_id = l.id
            WHERE true ${lf}
            ORDER BY l.name, d.name, s.name
        `

        const teams = await sql`
            SELECT
                t.id as team_id, t.name as team_name, t.slug as team_slug, t.color,
                t.season_id
            FROM teams t
            JOIN seasons s ON t.season_id = s.id
            JOIN divisions d ON s.division_id = d.id
            JOIN leagues l ON d.league_id = l.id
            WHERE true ${lf}
            ORDER BY t.name
        `

        const matches = await sql`
            SELECT
                m.id, m.season_id, m.team1_id, m.team2_id, m.winner_team_id,
                m.date, m.week, m.best_of, m.is_completed,
                t1.name as team1_name, t2.name as team2_name
            FROM matches m
            JOIN teams t1 ON m.team1_id = t1.id
            JOIN teams t2 ON m.team2_id = t2.id
            JOIN seasons s ON m.season_id = s.id
            JOIN divisions d ON s.division_id = d.id
            JOIN leagues l ON d.league_id = l.id
            WHERE true ${lf}
            ORDER BY m.date DESC
        `

        // Players on rosters (filtered by allowed leagues)
        const players = await sql`
            SELECT
                p.id as player_id, p.name, p.slug,
                lp.id as league_player_id, lp.team_id, lp.season_id, lp.role, lp.roster_status,
                t.name as team_name, t.color as team_color, t.slug as team_slug
            FROM league_players lp
            JOIN players p ON lp.player_id = p.id
            LEFT JOIN teams t ON lp.team_id = t.id
            JOIN seasons s ON lp.season_id = s.id
            JOIN divisions d ON s.division_id = d.id
            JOIN leagues l ON d.league_id = l.id
            WHERE lp.is_active = true ${lf}
            ORDER BY p.name
        `

        // Global players for sub matching (unfiltered reference data)
        const globalPlayers = await sql`
            SELECT id as player_id, name, slug, main_role, secondary_role, discord_name
            FROM players
            ORDER BY name
        `

        // Player aliases for name resolution (unfiltered reference data)
        const aliases = await sql`
            SELECT pa.id as alias_id, pa.player_id, pa.alias
            FROM player_aliases pa
            ORDER BY pa.player_id, pa.alias
        `

        // Last recorded role_played per league_player (for prefilling in match reports)
        const lastRoles = await sql`
            SELECT DISTINCT ON (pgs.league_player_id)
                pgs.league_player_id,
                pgs.role_played
            FROM player_game_stats pgs
            JOIN games g ON pgs.game_id = g.id
            JOIN matches m ON g.match_id = m.id
            WHERE pgs.role_played IS NOT NULL
            ORDER BY pgs.league_player_id, m.date DESC, g.id DESC
        `

        // All gods for autocomplete in match review (unfiltered reference data)
        const gods = await sql`
            SELECT id, name, slug, image_url
            FROM gods
            ORDER BY name
        `

        // Scheduled matches (pending) for linking during match report (filtered)
        const scheduledMatches = await sql`
            SELECT sm.id, sm.season_id, sm.team1_id, sm.team2_id,
                   sm.best_of, sm.scheduled_date, sm.week, sm.status,
                   sm.stage_id, sm.group_id, sm.round_id,
                   t1.name as team1_name, t1.color as team1_color,
                   t2.name as team2_name, t2.color as team2_color,
                   ss.name as stage_name, sg.name as group_name, sr.name as round_name
            FROM scheduled_matches sm
            LEFT JOIN teams t1 ON sm.team1_id = t1.id
            LEFT JOIN teams t2 ON sm.team2_id = t2.id
            JOIN seasons s ON sm.season_id = s.id
            JOIN divisions d ON s.division_id = d.id
            JOIN leagues l ON d.league_id = l.id
            LEFT JOIN season_stages ss ON sm.stage_id = ss.id
            LEFT JOIN stage_groups sg ON sm.group_id = sg.id
            LEFT JOIN stage_rounds sr ON sm.round_id = sr.id
            WHERE sm.status = 'scheduled' ${lf}
            ORDER BY ss.sort_order ASC NULLS LAST, sr.sort_order ASC NULLS LAST, sm.scheduled_date ASC
        `

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ seasons, teams, matches, players, globalPlayers, aliases, gods, scheduledMatches, lastRoles }),
        }
    } catch (error) {
        console.error('Admin data error:', error)
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' }),
        }
    }
}
export const onRequest = adapt(handler)

import { getDB, adminHeaders as headers } from './lib/db.js'
import { requireAdmin } from './lib/auth.js'

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const admin = await requireAdmin(event)
    if (!admin) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const sql = getDB()

    try {
        // Fetch all active seasons with their league/division/team info
        const seasons = await sql`
            SELECT 
                s.id as season_id, s.name as season_name, s.is_active,
                d.id as division_id, d.name as division_name, d.slug as division_slug,
                l.id as league_id, l.name as league_name, l.slug as league_slug
            FROM seasons s
            JOIN divisions d ON s.division_id = d.id
            JOIN leagues l ON d.league_id = l.id
            WHERE s.is_active = true
            ORDER BY l.name, d.name, s.name
        `

        const teams = await sql`
            SELECT
                t.id as team_id, t.name as team_name, t.slug as team_slug, t.color,
                t.season_id
            FROM teams t
            JOIN seasons s ON t.season_id = s.id
            WHERE s.is_active = true
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
            WHERE m.season_id IN (SELECT id FROM seasons WHERE is_active = true)
            ORDER BY m.date DESC
        `

        // All players across all active seasons (for player name search)
        const players = await sql`
            SELECT 
                p.id as player_id, p.name, p.slug,
                lp.id as league_player_id, lp.team_id, lp.season_id, lp.role,
                t.name as team_name, t.color as team_color
            FROM league_players lp
            JOIN players p ON lp.player_id = p.id
            LEFT JOIN teams t ON lp.team_id = t.id
            JOIN seasons s ON lp.season_id = s.id
            WHERE s.is_active = true AND lp.is_active = true
            ORDER BY p.name
        `

        // Also get global players (not on active rosters) for sub matching
        const globalPlayers = await sql`
            SELECT id as player_id, name, slug
            FROM players
            ORDER BY name
        `

        // Player aliases for name resolution
        const aliases = await sql`
            SELECT pa.id as alias_id, pa.player_id, pa.alias
            FROM player_aliases pa
            ORDER BY pa.player_id, pa.alias
        `

        // All gods for autocomplete in match review
        const gods = await sql`
            SELECT id, name, slug, image_url
            FROM gods
            ORDER BY name
        `

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ seasons, teams, matches, players, globalPlayers, aliases, gods }),
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
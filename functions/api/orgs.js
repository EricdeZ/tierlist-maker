import { adapt } from '../lib/adapter.js'
import { getDB, handleCors, getHeaders } from '../lib/db.js'

const handler = async (event) => {
    const cors = handleCors(event)
    if (cors) return cors

    const sql = getDB()
    const { slug } = event.queryStringParameters || {}

    try {
        // Single org by slug — includes teams with win rates
        if (slug) {
            const [org] = await sql`
                SELECT id, name, slug, color FROM organizations WHERE slug = ${slug}
            `
            if (!org) {
                return { statusCode: 404, headers: getHeaders(event), body: JSON.stringify({ error: 'Organization not found' }) }
            }

            // Get all teams in this org with win/loss records
            const teams = await sql`
                SELECT
                    t.id,
                    t.name,
                    t.slug,
                    t.color,
                    t.season_id,
                    s.name as season_name,
                    d.name as division_name,
                    d.slug as division_slug,
                    l.name as league_name,
                    l.slug as league_slug,
                    l.color as league_color,
                    COALESCE(SUM(CASE WHEN m.is_completed THEN 1 ELSE 0 END), 0) as games_played,
                    COALESCE(SUM(CASE WHEN m.winner_team_id = t.id THEN 1 ELSE 0 END), 0) as wins,
                    COALESCE(SUM(CASE WHEN m.is_completed AND m.winner_team_id != t.id THEN 1 ELSE 0 END), 0) as losses
                FROM teams t
                JOIN seasons s ON t.season_id = s.id
                JOIN divisions d ON s.division_id = d.id
                JOIN leagues l ON s.league_id = l.id
                LEFT JOIN matches m ON (m.team1_id = t.id OR m.team2_id = t.id)
                WHERE t.organization_id = ${org.id}
                GROUP BY t.id, t.name, t.slug, t.color, t.season_id,
                         s.name, s.start_date, d.name, d.slug, l.name, l.slug, l.color
                ORDER BY s.start_date DESC NULLS LAST, d.name, t.name
            `

            // Calculate overall org stats
            const totalWins = teams.reduce((s, t) => s + Number(t.wins), 0)
            const totalGames = teams.reduce((s, t) => s + Number(t.games_played), 0)
            const overallWinRate = totalGames > 0 ? (totalWins / totalGames * 100) : 0

            return {
                statusCode: 200,
                headers: getHeaders(event),
                body: JSON.stringify({ ...org, teams, totalWins, totalGames, overallWinRate }),
            }
        }

        // List all orgs (for admin or browse)
        const orgs = await sql`
            SELECT
                o.id, o.name, o.slug, o.color,
                COUNT(DISTINCT t.id) as team_count
            FROM organizations o
            LEFT JOIN teams t ON t.organization_id = o.id
            GROUP BY o.id, o.name, o.slug, o.color
            ORDER BY o.name
        `

        return {
            statusCode: 200,
            headers: getHeaders(event),
            body: JSON.stringify(orgs),
        }
    } catch (error) {
        console.error('Orgs error:', error)
        return { statusCode: 500, headers: getHeaders(event), body: JSON.stringify({ error: error.message || 'Internal server error' }) }
    }
}

export const onRequest = adapt(handler)

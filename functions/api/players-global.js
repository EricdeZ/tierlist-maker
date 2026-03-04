import { adapt } from '../lib/adapter.js'
import { getDB, headers, getHeaders, handleCors } from '../lib/db.js'

const handler = async (event) => {
    const cors = handleCors(event)
    if (cors) return cors

    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    }

    const sql = getDB()
    const { q, type } = event.queryStringParameters || {}

    try {
        // Names-only mode — lightweight list for background decoration
        if (type === 'names') {
            const names = await sql`
                SELECT DISTINCT p.name
                FROM players p
                JOIN league_players lp ON lp.player_id = p.id
                ORDER BY p.name
            `
            return {
                statusCode: 200,
                headers: getHeaders(event),
                body: JSON.stringify(names.map(r => r.name)),
            }
        }

        // Search mode
        if (q && q.trim().length >= 1) {
            const term = `%${q.trim()}%`
            const results = await sql`
                SELECT DISTINCT ON (p.id)
                    p.id,
                    p.name,
                    p.slug,
                    p.discord_name,
                    p.main_role,
                    t.name AS team_name,
                    t.color AS team_color,
                    l.name AS league_name,
                    l.slug AS league_slug,
                    l.color AS league_color
                FROM players p
                JOIN league_players lp ON lp.player_id = p.id
                LEFT JOIN teams t ON lp.team_id = t.id
                LEFT JOIN seasons s ON lp.season_id = s.id
                LEFT JOIN divisions d ON s.division_id = d.id
                LEFT JOIN leagues l ON d.league_id = l.id
                WHERE p.name ILIKE ${term} OR p.discord_name ILIKE ${term}
                ORDER BY p.id, s.start_date DESC NULLS LAST
                LIMIT 10
            `

            return {
                statusCode: 200,
                headers: getHeaders(event),
                body: JSON.stringify(results),
            }
        }

        // Default: aggregate stats
        const [playerCount] = await sql`
            SELECT COUNT(DISTINCT p.id) AS total
            FROM players p
            JOIN league_players lp ON lp.player_id = p.id
        `

        const [gameStats] = await sql`
            SELECT
                COUNT(DISTINCT pgs.game_id) AS total_games,
                COALESCE(SUM(pgs.kills), 0) AS total_kills,
                COALESCE(SUM(pgs.deaths), 0) AS total_deaths,
                COALESCE(SUM(pgs.assists), 0) AS total_assists,
                COALESCE(SUM(NULLIF(pgs.damage, 0)), 0) AS total_damage,
                COALESCE(SUM(NULLIF(pgs.mitigated, 0)), 0) AS total_mitigated
            FROM player_game_stats pgs
            JOIN games g ON pgs.game_id = g.id AND g.is_completed = true
        `

        const [matchCount] = await sql`
            SELECT COUNT(id) AS total FROM matches WHERE is_completed = true
        `

        return {
            statusCode: 200,
            headers: getHeaders(event),
            body: JSON.stringify({
                total_players: Number(playerCount.total),
                total_games: Number(gameStats.total_games),
                total_matches: Number(matchCount.total),
                total_kills: Number(gameStats.total_kills),
                total_deaths: Number(gameStats.total_deaths),
                total_assists: Number(gameStats.total_assists),
                total_damage: Number(gameStats.total_damage),
                total_mitigated: Number(gameStats.total_mitigated),
            }),
        }
    } catch (error) {
        console.error('players-global error:', error)
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' }),
        }
    }
}

export const onRequest = adapt(handler)

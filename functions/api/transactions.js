import { adapt } from '../lib/adapter.js'
import { getDB, headers, getHeaders, handleCors } from '../lib/db.js'

const TX_COLUMNS = `
    rt.id, rt.type, rt.player_name,
    rt.from_team_name, rt.to_team_name,
    rt.from_team_id, rt.to_team_id,
    rt.source, rt.created_at,
    ft.color as from_team_color, ft.slug as from_team_slug, ft.logo_url as from_team_logo,
    tt.color as to_team_color, tt.slug as to_team_slug, tt.logo_url as to_team_logo,
    s.name as season_name, d.name as division_name, d.slug as division_slug,
    l.name as league_name, l.slug as league_slug
`

const handler = async (event) => {
    const cors = handleCors(event)
    if (cors) return cors

    const sql = getDB()
    const { divisionId, leagueId, limit } = event.queryStringParameters || {}

    try {
        if (event.httpMethod !== 'GET') {
            return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
        }

        const cap = Math.min(parseInt(limit) || 100, 200)

        // By division (active season only)
        if (divisionId) {
            const transactions = await sql`
                SELECT ${sql.unsafe(TX_COLUMNS)}
                FROM roster_transactions rt
                LEFT JOIN teams ft ON ft.id = rt.from_team_id
                LEFT JOIN teams tt ON tt.id = rt.to_team_id
                JOIN seasons s ON s.id = rt.season_id
                JOIN divisions d ON d.id = s.division_id
                JOIN leagues l ON l.id = d.league_id
                WHERE d.id = ${divisionId} AND s.is_active = true
                ORDER BY rt.created_at DESC
                LIMIT ${cap}
            `
            return { statusCode: 200, headers: getHeaders(event), body: JSON.stringify(transactions) }
        }

        // By league (active seasons only)
        if (leagueId) {
            const transactions = await sql`
                SELECT ${sql.unsafe(TX_COLUMNS)}
                FROM roster_transactions rt
                LEFT JOIN teams ft ON ft.id = rt.from_team_id
                LEFT JOIN teams tt ON tt.id = rt.to_team_id
                JOIN seasons s ON s.id = rt.season_id
                JOIN divisions d ON d.id = s.division_id
                JOIN leagues l ON l.id = d.league_id
                WHERE l.id = ${leagueId} AND s.is_active = true
                ORDER BY rt.created_at DESC
                LIMIT ${cap}
            `
            return { statusCode: 200, headers: getHeaders(event), body: JSON.stringify(transactions) }
        }

        // Recent across all (active seasons only)
        const transactions = await sql`
            SELECT ${sql.unsafe(TX_COLUMNS)}
            FROM roster_transactions rt
            LEFT JOIN teams ft ON ft.id = rt.from_team_id
            LEFT JOIN teams tt ON tt.id = rt.to_team_id
            JOIN seasons s ON s.id = rt.season_id
            JOIN divisions d ON d.id = s.division_id
            JOIN leagues l ON l.id = d.league_id
            WHERE s.is_active = true
            ORDER BY rt.created_at DESC
            LIMIT ${cap}
        `
        return { statusCode: 200, headers: getHeaders(event), body: JSON.stringify(transactions) }

    } catch (error) {
        console.error('Transactions error:', error)
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) }
    }
}
export const onRequest = adapt(handler)

import { adapt } from '../lib/adapter.js'
import {getDB, handleCors, headers, getHeaders} from '../lib/db.js'

const handler = async (event, context) => {
    const cors = handleCors(event)
    if (cors) return cors
    const sql = getDB()
    const { seasonId } = event.queryStringParameters || {}

    try {
        if (event.httpMethod === 'GET' && seasonId) {
            const teams = await sql`
                SELECT
                    t.id,
                    t.season_id,
                    t.name,
                    t.color,
                    t.slug,
                    t.logo_url,
                    t.organization_id,
                    o.name as org_name,
                    o.slug as org_slug,
                    o.color as org_color,
                    COUNT(lp.id) as player_count
                FROM teams t
                LEFT JOIN league_players lp
                    ON t.id = lp.team_id
                    AND lp.is_active = true
                    AND lp.roster_status != 'sub'
                LEFT JOIN organizations o ON t.organization_id = o.id
                WHERE t.season_id = ${seasonId}
                GROUP BY t.id, t.season_id, t.name, t.color, t.slug, t.logo_url,
                         t.organization_id, o.name, o.slug, o.color
                ORDER BY t.name
            `

            return {
                statusCode: 200,
                headers: getHeaders(event),
                body: JSON.stringify(teams),
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
export const onRequest = adapt(handler)

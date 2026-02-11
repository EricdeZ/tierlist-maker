import {getDB, handleCors, headers, getHeaders} from './lib/db.js'

export const handler = async (event, context) => {
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
                    COUNT(lp.id) as player_count
                FROM teams t
                LEFT JOIN league_players lp 
                    ON t.id = lp.team_id 
                    AND lp.is_active = true
                    AND LOWER(lp.role) != 'sub'
                WHERE t.season_id = ${seasonId}
                GROUP BY t.id, t.season_id, t.name, t.color, t.slug
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
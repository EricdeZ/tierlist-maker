import { getDB, headers } from './lib/db.js'

export const handler = async (event, context) => {
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
                LEFT JOIN league_players lp ON t.id = lp.team_id AND lp.is_active = true
                WHERE t.season_id = ${seasonId}
                GROUP BY t.id, t.season_id, t.name, t.color, t.slug
                ORDER BY t.name
            `

            return {
                statusCode: 200,
                headers,
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
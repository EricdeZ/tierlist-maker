import { getDB, headers, getHeaders, handleCors } from './lib/db.js'

export const handler = async (event) => {
    const cors = handleCors(event)
    if (cors) return cors

    const sql = getDB()
    const { seasonId } = event.queryStringParameters || {}

    try {
        if (event.httpMethod === 'GET' && seasonId) {
            const standings = await sql`
                SELECT
                    t.id,
                    t.name,
                    t.color,
                    t.slug,
                    COUNT(DISTINCT m.id) FILTER (WHERE m.is_completed) as matches_played,
                    COUNT(DISTINCT m.id) FILTER (WHERE m.winner_team_id = t.id) as match_wins,
                    COUNT(DISTINCT m.id) FILTER (WHERE m.is_completed AND m.winner_team_id IS NOT NULL AND m.winner_team_id != t.id) as match_losses,
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
                GROUP BY t.id, t.name, t.color, t.slug
                ORDER BY match_wins DESC, game_wins DESC, match_losses ASC
            `

            return {
                statusCode: 200,
                headers: getHeaders(event),
                body: JSON.stringify(standings),
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
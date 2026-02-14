/* global process */
import {getDB, handleCors, headers, getHeaders} from './lib/db.js'

export const handler = async (event, context) => {

    const cors = handleCors(event)
    if (cors) return cors

    const sql = getDB()

    try {
        if (event.httpMethod === 'GET') {
            const { slug } = event.queryStringParameters || {}

            // Get single league with divisions and seasons
            if (slug) {
                const [league] = await sql`
                    SELECT id, name, slug, description, discord_url, color
                    FROM leagues
                    WHERE slug = ${slug}
                `

                if (!league) {
                    return {
                        statusCode: 404,
                        headers: getHeaders(event),
                        body: JSON.stringify({ error: 'League not found' }),
                    }
                }

                // Get divisions and seasons for this league
                const divisions = await sql`
                    SELECT
                        d.id,
                        d.name,
                        d.tier,
                        d.slug,
                        COALESCE(
                            json_agg(
                                json_build_object(
                                    'id', s.id,
                                    'name', s.name,
                                    'slug', s.slug,
                                    'is_active', s.is_active,
                                    'start_date', s.start_date,
                                    'end_date', s.end_date
                                ) ORDER BY s.start_date DESC
                            ) FILTER (WHERE s.id IS NOT NULL),
                            '[]'::json
                        ) as seasons
                    FROM divisions d
                    LEFT JOIN seasons s ON s.division_id = d.id
                    WHERE d.league_id = ${league.id}
                    GROUP BY d.id, d.name, d.tier, d.slug
                    ORDER BY d.tier
                `

                // Get team/player stats per division (active seasons only)
                const divisionStats = await sql`
                    SELECT
                        d.id as division_id,
                        COUNT(DISTINCT t.id)::int as team_count,
                        COUNT(DISTINCT lp.id)::int as player_count,
                        COALESCE(
                            json_agg(
                                DISTINCT jsonb_build_object('slug', t.slug, 'name', t.name)
                            ) FILTER (WHERE t.id IS NOT NULL),
                            '[]'::json
                        ) as teams
                    FROM divisions d
                    INNER JOIN seasons s ON s.division_id = d.id AND s.is_active = true
                    LEFT JOIN teams t ON t.season_id = s.id
                    LEFT JOIN league_players lp ON lp.team_id = t.id AND lp.season_id = s.id AND lp.is_active = true
                    WHERE d.league_id = ${league.id}
                    GROUP BY d.id
                `

                const statsMap = Object.fromEntries(divisionStats.map(s => [s.division_id, s]))
                const enrichedDivisions = divisions.map(d => ({
                    ...d,
                    team_count: statsMap[d.id]?.team_count || 0,
                    player_count: statsMap[d.id]?.player_count || 0,
                    teams: statsMap[d.id]?.teams || [],
                }))

                return {
                    statusCode: 200,
                    headers: getHeaders(event),
                    body: JSON.stringify({ ...league, divisions: enrichedDivisions }),
                }
            }

            // Get all leagues (basic info)
            const leagues = await sql`
                SELECT id, name, slug, description, discord_url, color
                FROM leagues
                ORDER BY name
            `

            return {
                statusCode: 200,
                headers: getHeaders(event),
                body: JSON.stringify(leagues),
            }
        }

        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' }),
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
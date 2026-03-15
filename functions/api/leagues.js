import { adapt } from '../lib/adapter.js'
import {getDB, handleCors, headers, getHeaders} from '../lib/db.js'

const handler = async (event, context) => {

    const cors = handleCors(event)
    if (cors) return cors

    const sql = getDB()

    try {
        if (event.httpMethod === 'GET') {
            const { slug } = event.queryStringParameters || {}

            // Get single league with divisions and seasons
            if (slug) {
                const [league] = await sql`
                    SELECT id, name, slug, description, discord_url, color, slogan, promotional_text, image_url
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

                // Get team/player stats per division (active season preferred, falls back to most recent)
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
                    INNER JOIN LATERAL (
                        SELECT s.id
                        FROM seasons s
                        WHERE s.division_id = d.id
                        ORDER BY s.is_active DESC, s.start_date DESC NULLS LAST
                        LIMIT 1
                    ) best_season ON true
                    LEFT JOIN teams t ON t.season_id = best_season.id
                    LEFT JOIN league_players lp ON lp.team_id = t.id AND lp.season_id = best_season.id AND lp.is_active = true
                    WHERE d.league_id = ${league.id}
                    GROUP BY d.id
                `

                const statsMap = Object.fromEntries(divisionStats.map(s => [s.division_id, s]))

                // Fetch division tags
                const divTags = await sql`
                    SELECT id, division_id, label, show_on_league
                    FROM division_tags
                    WHERE division_id = ANY(${divisions.map(d => d.id)})
                    ORDER BY id
                `
                const tagsByDiv = {}
                const leagueTags = []
                const seenLeagueTags = new Set()
                for (const t of divTags) {
                    if (!tagsByDiv[t.division_id]) tagsByDiv[t.division_id] = []
                    tagsByDiv[t.division_id].push({ label: t.label, show_on_league: t.show_on_league })
                    if (t.show_on_league && !seenLeagueTags.has(t.label)) {
                        seenLeagueTags.add(t.label)
                        leagueTags.push(t.label)
                    }
                }

                const enrichedDivisions = divisions.map(d => ({
                    ...d,
                    team_count: statsMap[d.id]?.team_count || 0,
                    player_count: statsMap[d.id]?.player_count || 0,
                    teams: statsMap[d.id]?.teams || [],
                    tags: tagsByDiv[d.id] || [],
                }))

                return {
                    statusCode: 200,
                    headers: getHeaders(event),
                    body: JSON.stringify({ ...league, divisions: enrichedDivisions, league_tags: leagueTags }),
                }
            }

            // Get all leagues (basic info)
            const leagues = await sql`
                SELECT id, name, slug, description, discord_url, color, slogan, promotional_text, image_url
                FROM leagues
                ORDER BY name
            `

            // Fetch league-level tags (show_on_league=true) grouped by league
            const allLeagueTags = await sql`
                SELECT DISTINCT d.league_id, dt.label
                FROM division_tags dt
                JOIN divisions d ON d.id = dt.division_id
                WHERE dt.show_on_league = true
                ORDER BY d.league_id, dt.label
            `
            const leagueTagMap = {}
            for (const t of allLeagueTags) {
                if (!leagueTagMap[t.league_id]) leagueTagMap[t.league_id] = []
                leagueTagMap[t.league_id].push(t.label)
            }

            const enrichedLeagues = leagues.map(l => ({
                ...l,
                league_tags: leagueTagMap[l.id] || [],
            }))

            return {
                statusCode: 200,
                headers: getHeaders(event),
                body: JSON.stringify(enrichedLeagues),
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
export const onRequest = adapt(handler)

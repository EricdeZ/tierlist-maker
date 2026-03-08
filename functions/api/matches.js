import { adapt } from '../lib/adapter.js'
import {getDB, handleCors, headers, getHeaders} from '../lib/db.js'

const handler = async (event, context) => {
    const cors = handleCors(event)
    if (cors) return cors
    const sql = getDB()
    const { seasonId, limit } = event.queryStringParameters || {}

    try {
        if (event.httpMethod === 'GET' && seasonId) {
            // Completed matches from matches table
            const completed = await sql`
                SELECT
                    m.id,
                    m.season_id,
                    m.date,
                    m.team1_id,
                    m.team2_id,
                    m.winner_team_id,
                    m.match_type,
                    m.week,
                    m.best_of,
                    m.is_completed,
                    m.stage_id,
                    m.group_id,
                    m.round_id,
                    m.created_at,
                    m.updated_at,
                    t1.name as team1_name,
                    t1.color as team1_color,
                    t1.slug as team1_slug,
                    t2.name as team2_name,
                    t2.color as team2_color,
                    t2.slug as team2_slug,
                    tw.name as winner_name,
                    tw.color as winner_color,
                    ss.name as stage_name,
                    sg.name as group_name,
                    sr.name as round_name,
                    COUNT(g.id) as games_count
                FROM matches m
                JOIN teams t1 ON m.team1_id = t1.id
                JOIN teams t2 ON m.team2_id = t2.id
                LEFT JOIN teams tw ON m.winner_team_id = tw.id
                LEFT JOIN games g ON m.id = g.match_id
                LEFT JOIN season_stages ss ON m.stage_id = ss.id
                LEFT JOIN stage_groups sg ON m.group_id = sg.id
                LEFT JOIN stage_rounds sr ON m.round_id = sr.id
                WHERE m.season_id = ${seasonId}
                GROUP BY m.id, m.season_id, m.date, m.team1_id, m.team2_id, m.winner_team_id,
                         m.match_type, m.week, m.best_of, m.is_completed,
                         m.stage_id, m.group_id, m.round_id,
                         m.created_at, m.updated_at, t1.id, t1.name, t1.color, t1.slug,
                         t2.id, t2.name, t2.color, t2.slug, tw.name, tw.color,
                         ss.name, sg.name, sr.name
                ORDER BY m.date DESC
                ${limit ? sql`LIMIT ${parseInt(limit)}` : sql``}
            `

            // Scheduled (upcoming) matches — not yet played
            const scheduled = limit ? [] : await sql`
                SELECT
                    sm.id,
                    sm.season_id,
                    sm.scheduled_date as date,
                    sm.team1_id,
                    sm.team2_id,
                    NULL as winner_team_id,
                    'regular' as match_type,
                    sm.week,
                    sm.best_of,
                    false as is_completed,
                    sm.stage_id,
                    sm.group_id,
                    sm.round_id,
                    sm.created_at,
                    sm.created_at as updated_at,
                    t1.name as team1_name,
                    t1.color as team1_color,
                    t1.slug as team1_slug,
                    t2.name as team2_name,
                    t2.color as team2_color,
                    t2.slug as team2_slug,
                    NULL as winner_name,
                    NULL as winner_color,
                    ss.name as stage_name,
                    sg.name as group_name,
                    sr.name as round_name,
                    0 as games_count
                FROM scheduled_matches sm
                LEFT JOIN teams t1 ON sm.team1_id = t1.id
                LEFT JOIN teams t2 ON sm.team2_id = t2.id
                LEFT JOIN season_stages ss ON sm.stage_id = ss.id
                LEFT JOIN stage_groups sg ON sm.group_id = sg.id
                LEFT JOIN stage_rounds sr ON sm.round_id = sr.id
                WHERE sm.season_id = ${seasonId}
                  AND sm.status = 'scheduled'
                ORDER BY ss.sort_order ASC NULLS LAST, sr.sort_order ASC NULLS LAST,
                         sm.scheduled_date ASC
            `

            const matches = [...completed, ...scheduled]

            // Fetch stages if any exist for this season (for grouping)
            const stages = await sql`
                SELECT id, name, slug, stage_type, sort_order, status, settings
                FROM season_stages WHERE season_id = ${seasonId}
                ORDER BY sort_order
            `

            return {
                statusCode: 200,
                headers: getHeaders(event),
                body: JSON.stringify(stages.length > 0 ? { matches, stages } : matches),
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

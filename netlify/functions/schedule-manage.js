import { getDB, adminHeaders as headers } from './lib/db.js'
import { requirePermission } from './lib/auth.js'
import { logAudit } from './lib/audit.js'
import { refundPredictions } from './lib/predictions.js'

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const admin = await requirePermission(event, 'match_schedule')
    if (!admin) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const sql = getDB()

    try {
        // ─── GET: list seasons, teams, and scheduled matches ───
        if (event.httpMethod === 'GET') {
            const { seasonId } = event.queryStringParameters || {}

            const [seasons, teams] = await Promise.all([
                sql`
                    SELECT s.id as season_id, s.name as season_name, s.is_active,
                           d.name as division_name, l.name as league_name
                    FROM seasons s
                    JOIN divisions d ON s.division_id = d.id
                    JOIN leagues l ON d.league_id = l.id
                    WHERE s.is_active = true
                    ORDER BY l.name, d.name, s.name
                `,
                sql`
                    SELECT t.id as team_id, t.name as team_name, t.color, t.season_id
                    FROM teams t
                    JOIN seasons s ON t.season_id = s.id
                    WHERE s.is_active = true
                    ORDER BY t.name
                `,
            ])

            let scheduledMatches = []
            if (seasonId) {
                scheduledMatches = await sql`
                    SELECT sm.id, sm.season_id, sm.team1_id, sm.team2_id,
                           sm.best_of, sm.scheduled_date, sm.week, sm.status,
                           sm.created_at, sm.updated_at,
                           t1.name as team1_name, t1.color as team1_color, t1.slug as team1_slug,
                           t2.name as team2_name, t2.color as team2_color, t2.slug as team2_slug
                    FROM scheduled_matches sm
                    JOIN teams t1 ON sm.team1_id = t1.id
                    JOIN teams t2 ON sm.team2_id = t2.id
                    WHERE sm.season_id = ${seasonId}
                    ORDER BY sm.scheduled_date ASC, sm.week ASC NULLS LAST, sm.id ASC
                `
            }

            return { statusCode: 200, headers, body: JSON.stringify({ seasons, teams, scheduledMatches }) }
        }

        // ─── POST: mutations ───
        if (event.httpMethod === 'POST') {
            if (!event.body) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Request body required' }) }
            }
            const body = JSON.parse(event.body)

            switch (body.action) {
                case 'create':
                    return await createMatch(sql, body, admin)
                case 'update':
                    return await updateMatch(sql, body, admin)
                case 'update-status':
                    return await updateStatus(sql, body, admin)
                case 'delete':
                    return await deleteMatch(sql, body, admin)
                default:
                    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${body.action}` }) }
            }
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    } catch (error) {
        console.error('schedule-manage error:', error)
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) }
    }
}


// ═══════════════════════════════════════════════════
// POST: Create a scheduled match
// ═══════════════════════════════════════════════════
async function createMatch(sql, body, admin) {
    const { season_id, team1_id, team2_id, best_of, scheduled_date, week } = body

    if (!season_id || !team1_id || !team2_id || !scheduled_date) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'season_id, team1_id, team2_id, and scheduled_date are required' }) }
    }
    if (String(team1_id) === String(team2_id)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Teams must be different' }) }
    }

    // Validate teams belong to the season
    const validTeams = await sql`
        SELECT id FROM teams WHERE id IN (${team1_id}, ${team2_id}) AND season_id = ${season_id}
    `
    if (validTeams.length < 2) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'One or both teams do not belong to the selected season' }) }
    }

    const [created] = await sql`
        INSERT INTO scheduled_matches (season_id, team1_id, team2_id, best_of, scheduled_date, week, created_by)
        VALUES (${season_id}, ${team1_id}, ${team2_id}, ${best_of || 1}, ${scheduled_date}, ${week || null}, ${admin.id})
        RETURNING id
    `

    await logAudit(sql, admin, {
        action: 'create-scheduled-match', endpoint: 'schedule-manage',
        targetType: 'scheduled_match', targetId: created.id,
        details: { season_id, team1_id, team2_id, best_of, scheduled_date, week }
    })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Match scheduled', id: created.id }) }
}


// ═══════════════════════════════════════════════════
// POST: Update a scheduled match
// ═══════════════════════════════════════════════════
async function updateMatch(sql, body, admin) {
    const { id, team1_id, team2_id, best_of, scheduled_date, week } = body

    if (!id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    }
    if (team1_id && team2_id && String(team1_id) === String(team2_id)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Teams must be different' }) }
    }

    await sql`
        UPDATE scheduled_matches SET
            team1_id = COALESCE(${team1_id || null}, team1_id),
            team2_id = COALESCE(${team2_id || null}, team2_id),
            best_of = COALESCE(${best_of || null}, best_of),
            scheduled_date = COALESCE(${scheduled_date || null}, scheduled_date),
            week = ${week !== undefined ? (week || null) : sql`week`},
            updated_at = NOW()
        WHERE id = ${id}
    `

    await logAudit(sql, admin, {
        action: 'update-scheduled-match', endpoint: 'schedule-manage',
        targetType: 'scheduled_match', targetId: id,
        details: { team1_id, team2_id, best_of, scheduled_date, week }
    })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Match updated' }) }
}


// ═══════════════════════════════════════════════════
// POST: Update match status
// ═══════════════════════════════════════════════════
async function updateStatus(sql, body, admin) {
    const { id, status } = body

    if (!id || !status) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'id and status required' }) }
    }

    const validStatuses = ['scheduled', 'completed', 'cancelled']
    if (!validStatuses.includes(status)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: `Invalid status. Must be: ${validStatuses.join(', ')}` }) }
    }

    await sql`
        UPDATE scheduled_matches SET status = ${status}, updated_at = NOW()
        WHERE id = ${id}
    `

    // Refund prediction wagers if match is cancelled
    if (status === 'cancelled') {
        refundPredictions(sql, id)
            .catch(err => console.error('Prediction refund failed:', err))
    }

    await logAudit(sql, admin, {
        action: 'update-scheduled-match-status', endpoint: 'schedule-manage',
        targetType: 'scheduled_match', targetId: id,
        details: { status }
    })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: `Status updated to ${status}` }) }
}


// ═══════════════════════════════════════════════════
// POST: Delete a scheduled match
// ═══════════════════════════════════════════════════
async function deleteMatch(sql, body, admin) {
    const { id } = body

    if (!id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    }

    await sql`DELETE FROM scheduled_matches WHERE id = ${id}`

    await logAudit(sql, admin, {
        action: 'delete-scheduled-match', endpoint: 'schedule-manage',
        targetType: 'scheduled_match', targetId: id,
    })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Scheduled match deleted' }) }
}

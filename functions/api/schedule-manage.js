import { adapt } from '../lib/adapter.js'
import { getDB, adminHeaders as headers } from '../lib/db.js'
import { requirePermission, getAllowedLeagueIds, leagueFilter, getLeagueIdFromSeason } from '../lib/auth.js'
import { logAudit } from '../lib/audit.js'
import { refundPredictions } from '../lib/predictions.js'
import { advanceFromMatch } from '../lib/advancement.js'

const handler = async (event) => {
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
            const allowed = await getAllowedLeagueIds(admin.id, 'match_schedule')
            const lf = leagueFilter(sql, allowed)

            const [seasons, teams] = await Promise.all([
                sql`
                    SELECT s.id as season_id, s.name as season_name, s.is_active,
                           d.name as division_name, l.name as league_name
                    FROM seasons s
                    JOIN divisions d ON s.division_id = d.id
                    JOIN leagues l ON d.league_id = l.id
                    WHERE true ${lf}
                    ORDER BY l.name, d.name, s.name
                `,
                sql`
                    SELECT t.id as team_id, t.name as team_name, t.color, t.season_id
                    FROM teams t
                    JOIN seasons s ON t.season_id = s.id
                    JOIN divisions d ON s.division_id = d.id
                    JOIN leagues l ON d.league_id = l.id
                    WHERE true ${lf}
                    ORDER BY t.name
                `,
            ])

            let scheduledMatches = []
            if (seasonId) {
                scheduledMatches = await sql`
                    SELECT sm.id, sm.season_id, sm.team1_id, sm.team2_id,
                           sm.best_of, sm.scheduled_date, sm.week, sm.status,
                           sm.stage_id, sm.group_id, sm.round_id,
                           sm.bracket_position, sm.team1_source, sm.team2_source,
                           sm.created_at, sm.updated_at,
                           t1.name as team1_name, t1.color as team1_color, t1.slug as team1_slug,
                           t2.name as team2_name, t2.color as team2_color, t2.slug as team2_slug,
                           ss.name as stage_name, sg.name as group_name, sr.name as round_name
                    FROM scheduled_matches sm
                    LEFT JOIN teams t1 ON sm.team1_id = t1.id
                    LEFT JOIN teams t2 ON sm.team2_id = t2.id
                    LEFT JOIN season_stages ss ON sm.stage_id = ss.id
                    LEFT JOIN stage_groups sg ON sm.group_id = sg.id
                    LEFT JOIN stage_rounds sr ON sm.round_id = sr.id
                    WHERE sm.season_id = ${seasonId}
                    ORDER BY ss.sort_order ASC NULLS LAST, sr.sort_order ASC NULLS LAST,
                             sm.scheduled_date ASC, sm.week ASC NULLS LAST, sm.id ASC
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
                    return await createMatch(sql, body, admin, event)
                case 'update':
                    return await updateMatch(sql, body, admin, event)
                case 'update-status':
                    return await updateStatus(sql, body, admin, event)
                case 'delete':
                    return await deleteMatch(sql, body, admin, event)
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
async function createMatch(sql, body, admin, event) {
    const { season_id, team1_id, team2_id, best_of, scheduled_date, week,
            stage_id, group_id, round_id, bracket_position, team1_source, team2_source } = body

    if (!season_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'season_id is required' }) }
    }

    // Bracket matches can have null teams (resolved later via sources)
    const hasTeams = team1_id && team2_id
    if (!hasTeams && !team1_source && !team2_source && !scheduled_date) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Either teams or slot sources are required' }) }
    }

    const leagueId = await getLeagueIdFromSeason(season_id)
    if (!await requirePermission(event, 'match_schedule', leagueId)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission for this league' }) }
    }
    if (team1_id && team2_id && String(team1_id) === String(team2_id)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Teams must be different' }) }
    }

    // Validate teams belong to the season (if provided)
    if (hasTeams) {
        const validTeams = await sql`
            SELECT id FROM teams WHERE id IN (${team1_id}, ${team2_id}) AND season_id = ${season_id}
        `
        if (validTeams.length < 2) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'One or both teams do not belong to the selected season' }) }
        }
    }

    const [created] = await sql`
        INSERT INTO scheduled_matches (
            season_id, team1_id, team2_id, best_of, scheduled_date, week, created_by,
            stage_id, group_id, round_id, bracket_position, team1_source, team2_source
        )
        VALUES (
            ${season_id}, ${team1_id || null}, ${team2_id || null},
            ${best_of || 1}, ${scheduled_date || null}, ${week || null}, ${admin.id},
            ${stage_id || null}, ${group_id || null}, ${round_id || null},
            ${bracket_position ?? null},
            ${team1_source ? JSON.stringify(team1_source) : null},
            ${team2_source ? JSON.stringify(team2_source) : null}
        )
        RETURNING id
    `

    await logAudit(sql, admin, {
        action: 'create-scheduled-match', endpoint: 'schedule-manage',
        targetType: 'scheduled_match', targetId: created.id,
        details: { season_id, team1_id, team2_id, best_of, scheduled_date, week, stage_id, group_id, round_id }
    })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Match scheduled', id: created.id }) }
}


// ═══════════════════════════════════════════════════
// POST: Update a scheduled match
// ═══════════════════════════════════════════════════
async function updateMatch(sql, body, admin, event) {
    const { id, team1_id, team2_id, best_of, scheduled_date, week,
            stage_id, group_id, round_id, bracket_position, team1_source, team2_source } = body

    if (!id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    }

    const [sm] = await sql`SELECT s.league_id FROM scheduled_matches sm JOIN seasons s ON sm.season_id = s.id WHERE sm.id = ${id}`
    if (!sm || !await requirePermission(event, 'match_schedule', sm.league_id)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission for this league' }) }
    }
    if (team1_id && team2_id && String(team1_id) === String(team2_id)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Teams must be different' }) }
    }

    await sql`
        UPDATE scheduled_matches SET
            team1_id = ${team1_id !== undefined ? (team1_id || null) : sql`team1_id`},
            team2_id = ${team2_id !== undefined ? (team2_id || null) : sql`team2_id`},
            best_of = COALESCE(${best_of || null}, best_of),
            scheduled_date = ${scheduled_date !== undefined ? (scheduled_date || null) : sql`scheduled_date`},
            week = ${week !== undefined ? (week || null) : sql`week`},
            stage_id = ${stage_id !== undefined ? (stage_id || null) : sql`stage_id`},
            group_id = ${group_id !== undefined ? (group_id || null) : sql`group_id`},
            round_id = ${round_id !== undefined ? (round_id || null) : sql`round_id`},
            bracket_position = ${bracket_position !== undefined ? (bracket_position ?? null) : sql`bracket_position`},
            team1_source = ${team1_source !== undefined ? (team1_source ? JSON.stringify(team1_source) : null) : sql`team1_source`},
            team2_source = ${team2_source !== undefined ? (team2_source ? JSON.stringify(team2_source) : null) : sql`team2_source`},
            updated_at = NOW()
        WHERE id = ${id}
    `

    await logAudit(sql, admin, {
        action: 'update-scheduled-match', endpoint: 'schedule-manage',
        targetType: 'scheduled_match', targetId: id,
        details: { team1_id, team2_id, best_of, scheduled_date, week, stage_id, group_id, round_id }
    })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Match updated' }) }
}


// ═══════════════════════════════════════════════════
// POST: Update match status
// ═══════════════════════════════════════════════════
async function updateStatus(sql, body, admin, event) {
    const { id, status } = body

    if (!id || !status) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'id and status required' }) }
    }

    const [sm] = await sql`SELECT s.league_id FROM scheduled_matches sm JOIN seasons s ON sm.season_id = s.id WHERE sm.id = ${id}`
    if (!sm || !await requirePermission(event, 'match_schedule', sm.league_id)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission for this league' }) }
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

    // Trigger bracket advancement when a match is completed
    if (status === 'completed') {
        event.waitUntil(
            advanceFromMatch(sql, id)
                .catch(err => console.error('Bracket advancement failed:', err))
        )
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
async function deleteMatch(sql, body, admin, event) {
    const { id } = body

    if (!id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    }

    const [sm] = await sql`SELECT s.league_id FROM scheduled_matches sm JOIN seasons s ON sm.season_id = s.id WHERE sm.id = ${id}`
    if (!sm || !await requirePermission(event, 'match_schedule', sm.league_id)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission for this league' }) }
    }

    await sql`DELETE FROM scheduled_matches WHERE id = ${id}`

    await logAudit(sql, admin, {
        action: 'delete-scheduled-match', endpoint: 'schedule-manage',
        targetType: 'scheduled_match', targetId: id,
    })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Scheduled match deleted' }) }
}

export const onRequest = adapt(handler)

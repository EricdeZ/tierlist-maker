import { adapt } from '../lib/adapter.js'
import { getDB, headers, adminHeaders } from '../lib/db.js'
import { requireAuth, requirePermission } from '../lib/auth.js'
import { logAudit } from '../lib/audit.js'

const DAILY_LIMIT = 5
const COOLDOWN_MS = 24 * 60 * 60 * 1000
const MIN_DETAILS = 20
const VALID_CATEGORIES = ['wrong_score', 'wrong_stats', 'wrong_god', 'missing_data', 'other']

const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: adminHeaders, body: '' }
    }

    const sql = getDB()

    try {
        if (event.httpMethod === 'GET') {
            const { check, match_id, status } = event.queryStringParameters || {}

            // User eligibility check
            if (check === 'true' && match_id) {
                const user = await requireAuth(event)
                if (!user) {
                    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
                }

                const cutoff = new Date(Date.now() - COOLDOWN_MS).toISOString()

                const [dailyCount] = await sql`
                    SELECT COUNT(*)::int as count FROM data_reports
                    WHERE user_id = ${user.id} AND created_at > ${cutoff}
                `

                const [matchCooldown] = await sql`
                    SELECT 1 FROM data_reports
                    WHERE user_id = ${user.id} AND match_id = ${match_id} AND created_at > ${cutoff}
                    LIMIT 1
                `

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        canReport: dailyCount.count < DAILY_LIMIT && !matchCooldown,
                        dailyRemaining: Math.max(0, DAILY_LIMIT - dailyCount.count),
                        matchCooldown: !!matchCooldown,
                    }),
                }
            }

            // Admin: list reports
            const admin = await requirePermission(event, 'league_manage')
            if (!admin) {
                return { statusCode: 401, headers: adminHeaders, body: JSON.stringify({ error: 'Unauthorized' }) }
            }

            const statusFilter = status || 'pending'

            const reports = statusFilter === 'all'
                ? await sql`
                    SELECT dr.*,
                           u.discord_username as reporter_name, u.discord_id as reporter_discord_id, u.discord_avatar as reporter_avatar,
                           t1.name as team1_name, t2.name as team2_name,
                           l.slug as league_slug, d.slug as division_slug,
                           resolver.discord_username as resolved_by_name
                    FROM data_reports dr
                    JOIN users u ON dr.user_id = u.id
                    JOIN matches m ON dr.match_id = m.id
                    JOIN seasons s ON m.season_id = s.id
                    JOIN divisions d ON s.division_id = d.id
                    JOIN leagues l ON d.league_id = l.id
                    JOIN teams t1 ON m.team1_id = t1.id
                    JOIN teams t2 ON m.team2_id = t2.id
                    LEFT JOIN users resolver ON dr.resolved_by = resolver.id
                    ORDER BY CASE WHEN dr.status = 'pending' THEN 0 ELSE 1 END, dr.created_at DESC
                `
                : await sql`
                    SELECT dr.*,
                           u.discord_username as reporter_name, u.discord_id as reporter_discord_id, u.discord_avatar as reporter_avatar,
                           t1.name as team1_name, t2.name as team2_name,
                           l.slug as league_slug, d.slug as division_slug,
                           resolver.discord_username as resolved_by_name
                    FROM data_reports dr
                    JOIN users u ON dr.user_id = u.id
                    JOIN matches m ON dr.match_id = m.id
                    JOIN seasons s ON m.season_id = s.id
                    JOIN divisions d ON s.division_id = d.id
                    JOIN leagues l ON d.league_id = l.id
                    JOIN teams t1 ON m.team1_id = t1.id
                    JOIN teams t2 ON m.team2_id = t2.id
                    LEFT JOIN users resolver ON dr.resolved_by = resolver.id
                    WHERE dr.status = ${statusFilter}
                    ORDER BY dr.created_at DESC
                `

            return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ reports }) }
        }

        if (event.httpMethod !== 'POST') {
            return { statusCode: 405, headers: adminHeaders, body: JSON.stringify({ error: 'Method not allowed' }) }
        }
        if (!event.body) {
            return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'Request body required' }) }
        }

        let body
        try { body = JSON.parse(event.body) } catch {
            return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'Invalid JSON' }) }
        }

        switch (body.action) {
            case 'submit':
                return await submitReport(sql, event, body)
            case 'resolve':
                return await resolveReport(sql, event, body)
            default:
                return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: `Unknown action: ${body.action}` }) }
        }
    } catch (error) {
        console.error('Data reports error:', error)
        return {
            statusCode: 500,
            headers: adminHeaders,
            body: JSON.stringify({ error: error.message || 'Internal server error' }),
        }
    }
}

async function submitReport(sql, event, { match_id, category, details }) {
    const user = await requireAuth(event)
    if (!user) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    if (!match_id || !category || !details) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'match_id, category, and details are required' }) }
    }
    if (!VALID_CATEGORIES.includes(category)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid category' }) }
    }
    if (details.trim().length < MIN_DETAILS) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: `Details must be at least ${MIN_DETAILS} characters` }) }
    }

    const cutoff = new Date(Date.now() - COOLDOWN_MS).toISOString()

    // Check daily limit
    const [dailyCount] = await sql`
        SELECT COUNT(*)::int as count FROM data_reports
        WHERE user_id = ${user.id} AND created_at > ${cutoff}
    `
    if (dailyCount.count >= DAILY_LIMIT) {
        return { statusCode: 429, headers, body: JSON.stringify({ error: 'Daily report limit reached. Try again tomorrow.' }) }
    }

    // Check match cooldown
    const [matchCooldown] = await sql`
        SELECT 1 FROM data_reports
        WHERE user_id = ${user.id} AND match_id = ${match_id} AND created_at > ${cutoff}
        LIMIT 1
    `
    if (matchCooldown) {
        return { statusCode: 429, headers, body: JSON.stringify({ error: 'You already reported this match recently. Please wait 24 hours.' }) }
    }

    // Verify match exists
    const [match] = await sql`SELECT id FROM matches WHERE id = ${match_id} LIMIT 1`
    if (!match) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Match not found' }) }
    }

    const [report] = await sql`
        INSERT INTO data_reports (user_id, match_id, category, details)
        VALUES (${user.id}, ${match_id}, ${category}, ${details.trim()})
        RETURNING id, created_at
    `

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, report_id: report.id }),
    }
}

async function resolveReport(sql, event, { report_id, status, admin_note }) {
    const admin = await requirePermission(event, 'league_manage')
    if (!admin) {
        return { statusCode: 401, headers: adminHeaders, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    if (!report_id) {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'report_id required' }) }
    }
    if (!status || !['resolved', 'dismissed'].includes(status)) {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'status must be "resolved" or "dismissed"' }) }
    }

    const [report] = await sql`
        SELECT id, status as current_status, match_id FROM data_reports WHERE id = ${report_id}
    `
    if (!report) {
        return { statusCode: 404, headers: adminHeaders, body: JSON.stringify({ error: 'Report not found' }) }
    }
    if (report.current_status !== 'pending') {
        return { statusCode: 409, headers: adminHeaders, body: JSON.stringify({ error: `Report is already ${report.current_status}` }) }
    }

    const [updated] = await sql`
        UPDATE data_reports
        SET status = ${status}, resolved_by = ${admin.id}, resolved_at = NOW(),
            admin_note = ${admin_note || null}
        WHERE id = ${report_id}
        RETURNING id, status, resolved_at
    `

    logAudit(sql, admin, {
        action: 'resolve-data-report',
        endpoint: 'data-reports',
        targetType: 'data_report',
        targetId: report_id,
        details: { status, admin_note, match_id: report.match_id },
    }).catch(() => {})

    return {
        statusCode: 200,
        headers: adminHeaders,
        body: JSON.stringify({ success: true, report: updated }),
    }
}

export const onRequest = adapt(handler)

/* global process */
import { getDB, adminHeaders as headers } from './lib/db.js'
import { requirePermission } from './lib/auth.js'

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    // Only users with audit_log_view permission can access this
    const admin = await requirePermission(event, 'audit_log_view', null)
    if (!admin) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const sql = getDB()

    try {
        if (event.httpMethod === 'GET') {
            const qs = event.queryStringParameters || {}
            const page = Math.max(1, parseInt(qs.page) || 1)
            const limit = Math.min(100, Math.max(10, parseInt(qs.limit) || 50))
            const offset = (page - 1) * limit

            // Build filter conditions
            const conditions = []

            if (qs.endpoint) {
                conditions.push(sql`a.endpoint = ${qs.endpoint}`)
            }
            if (qs.action) {
                conditions.push(sql`a.action ILIKE ${'%' + qs.action + '%'}`)
            }
            if (qs.username) {
                conditions.push(sql`a.username ILIKE ${'%' + qs.username + '%'}`)
            }
            if (qs.from) {
                conditions.push(sql`a.created_at >= ${qs.from}`)
            }
            if (qs.to) {
                conditions.push(sql`a.created_at <= ${qs.to}`)
            }

            const where = conditions.length > 0
                ? sql`WHERE ${conditions.reduce((a, b) => sql`${a} AND ${b}`)}`
                : sql``

            const [countResult, rows] = await Promise.all([
                sql`SELECT COUNT(*)::int as total FROM audit_log a ${where}`,
                sql`
                    SELECT a.id, a.user_id, a.username, a.action, a.endpoint,
                           a.league_id, a.target_type, a.target_id, a.details,
                           a.created_at,
                           l.name as league_name
                    FROM audit_log a
                    LEFT JOIN leagues l ON l.id = a.league_id
                    ${where}
                    ORDER BY a.created_at DESC
                    LIMIT ${limit} OFFSET ${offset}
                `,
            ])

            // Get distinct endpoints and usernames for filter dropdowns
            const [endpoints, usernames] = await Promise.all([
                sql`SELECT DISTINCT endpoint FROM audit_log ORDER BY endpoint`,
                sql`SELECT DISTINCT username FROM audit_log WHERE username IS NOT NULL ORDER BY username`,
            ])

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    rows,
                    total: countResult[0].total,
                    page,
                    limit,
                    totalPages: Math.ceil(countResult[0].total / limit),
                    filters: {
                        endpoints: endpoints.map(r => r.endpoint),
                        usernames: usernames.map(r => r.username),
                    },
                }),
            }
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    } catch (err) {
        console.error('audit-log error:', err)
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
    }
}

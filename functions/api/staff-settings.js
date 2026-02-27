import { adapt } from '../lib/adapter.js'
import { getDB, adminHeaders as headers } from '../lib/db.js'
import { requireAdmin } from '../lib/auth.js'

const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const admin = await requireAdmin(event)
    if (!admin) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const sql = getDB()

    try {
        if (event.httpMethod === 'GET') {
            // Get leagues this user is League Staff for
            const leagues = await sql`
                SELECT DISTINCT l.id, l.name, l.slug
                FROM user_roles ur
                JOIN roles r ON r.id = ur.role_id AND r.name = 'League Staff' AND r.is_system = true
                JOIN leagues l ON l.id = ur.league_id
                WHERE ur.user_id = ${admin.id} AND ur.league_id IS NOT NULL
                ORDER BY l.name ASC
            `

            // Get current notification prefs
            const prefs = await sql`
                SELECT league_id, notify_match_report, notify_data_report
                FROM staff_notification_prefs
                WHERE user_id = ${admin.id}
            `

            // Get division assignments (display only)
            const divisions = await sql`
                SELECT sda.user_role_id, sda.division_id, d.name as division_name, d.league_id
                FROM staff_division_access sda
                JOIN divisions d ON d.id = sda.division_id
                JOIN user_roles ur ON ur.id = sda.user_role_id
                WHERE ur.user_id = ${admin.id}
                ORDER BY d.league_id, d.tier ASC NULLS LAST, d.name ASC
            `

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ leagues, prefs, divisions }),
            }
        }

        if (event.httpMethod !== 'POST') {
            return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
        }
        if (!event.body) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Request body required' }) }
        }

        let body
        try { body = JSON.parse(event.body) } catch {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }
        }

        if (body.action === 'update-prefs') {
            const { league_id, notify_match_report, notify_data_report } = body

            // Validate user is League Staff for this league
            if (league_id !== null) {
                const [hasRole] = await sql`
                    SELECT 1 FROM user_roles ur
                    JOIN roles r ON r.id = ur.role_id AND r.name = 'League Staff' AND r.is_system = true
                    WHERE ur.user_id = ${admin.id} AND ur.league_id = ${league_id}
                    LIMIT 1
                `
                if (!hasRole) {
                    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Not League Staff for this league' }) }
                }
            }

            await sql`
                INSERT INTO staff_notification_prefs (user_id, league_id, notify_match_report, notify_data_report)
                VALUES (
                    ${admin.id},
                    ${league_id},
                    ${notify_match_report ?? true},
                    ${notify_data_report ?? true}
                )
                ON CONFLICT (user_id, league_id) DO UPDATE SET
                    notify_match_report = EXCLUDED.notify_match_report,
                    notify_data_report = EXCLUDED.notify_data_report,
                    updated_at = NOW()
            `

            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
        }

        return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${body.action}` }) }
    } catch (error) {
        console.error('Staff settings error:', error)
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message || 'Internal server error' }) }
    }
}

export const onRequest = adapt(handler)

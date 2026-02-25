import { adapt } from '../lib/adapter.js'
import { getDB, adminHeaders as headers } from '../lib/db.js'
import { requirePermission, getAllowedLeagueIds } from '../lib/auth.js'
import { logAudit } from '../lib/audit.js'

const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const admin = await requirePermission(event, 'league_staff_manage')
    if (!admin) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const sql = getDB()

    try {
        // ─── GET: leagues + staff ───
        if (event.httpMethod === 'GET') {
            const allowedLeagueIds = await getAllowedLeagueIds(admin.id, 'league_staff_manage')

            const leagues = allowedLeagueIds === null
                ? await sql`SELECT id, name, slug FROM leagues ORDER BY name ASC`
                : allowedLeagueIds.length > 0
                    ? await sql`SELECT id, name, slug FROM leagues WHERE id = ANY(${allowedLeagueIds}) ORDER BY name ASC`
                    : []

            const [staffRole] = await sql`SELECT id FROM roles WHERE name = 'League Staff' AND is_system = true`

            const leagueIds = leagues.map(l => l.id)

            const staff = staffRole && leagueIds.length > 0 ? await sql`
                SELECT ur.id as assignment_id, ur.user_id, ur.league_id, ur.created_at,
                       u.discord_username, u.discord_avatar, u.discord_id,
                       gb.discord_username as granted_by_username
                FROM user_roles ur
                JOIN users u ON u.id = ur.user_id
                LEFT JOIN users gb ON gb.id = ur.granted_by
                WHERE ur.role_id = ${staffRole.id}
                  AND ur.league_id = ANY(${leagueIds})
                ORDER BY u.discord_username ASC
            ` : []

            // Also fetch league-scoped admins — users with league_manage for specific leagues (not global)
            const admins = leagueIds.length > 0 ? await sql`
                SELECT DISTINCT ON (u.id, ur.league_id)
                       ur.user_id, ur.league_id, ur.created_at,
                       u.discord_username, u.discord_avatar, u.discord_id,
                       r.name as role_name
                FROM user_roles ur
                JOIN users u ON u.id = ur.user_id
                JOIN roles r ON r.id = ur.role_id
                JOIN role_permissions rp ON rp.role_id = ur.role_id
                WHERE rp.permission_key = 'league_manage'
                  AND ur.league_id = ANY(${leagueIds})
                  ${staffRole ? sql`AND ur.role_id != ${staffRole.id}` : sql``}
                ORDER BY u.id, ur.league_id, r.is_system DESC
            ` : []

            return { statusCode: 200, headers, body: JSON.stringify({ leagues, staff, admins }) }
        }

        // ─── POST: actions ───
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

        switch (body.action) {
            case 'search-users': {
                const q = body.query?.trim()
                if (!q || q.length < 2) {
                    return { statusCode: 200, headers, body: JSON.stringify({ users: [] }) }
                }
                const users = await sql`
                    SELECT id, discord_username, discord_avatar, discord_id
                    FROM users
                    WHERE discord_username ILIKE ${'%' + q + '%'}
                    ORDER BY discord_username ASC
                    LIMIT 20
                `
                return { statusCode: 200, headers, body: JSON.stringify({ users }) }
            }

            case 'add-staff': {
                const { user_id, league_id } = body
                if (!user_id || !league_id) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'user_id and league_id required' }) }
                }

                const canManage = await requirePermission(event, 'league_staff_manage', league_id)
                if (!canManage) {
                    return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission for this league' }) }
                }

                const [staffRole] = await sql`SELECT id FROM roles WHERE name = 'League Staff' AND is_system = true`
                if (!staffRole) {
                    return { statusCode: 500, headers, body: JSON.stringify({ error: 'League Staff role not found' }) }
                }

                const [existing] = await sql`
                    SELECT id FROM user_roles
                    WHERE user_id = ${user_id} AND role_id = ${staffRole.id} AND league_id = ${league_id}
                    LIMIT 1
                `
                if (existing) {
                    return { statusCode: 409, headers, body: JSON.stringify({ error: 'User is already staff for this league' }) }
                }

                if (user_id === admin.id) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Cannot add yourself as staff' }) }
                }

                const [assignment] = await sql`
                    INSERT INTO user_roles (user_id, role_id, league_id, granted_by)
                    VALUES (${user_id}, ${staffRole.id}, ${league_id}, ${admin.id})
                    RETURNING id, user_id, role_id, league_id, created_at
                `

                await logAudit(sql, admin, {
                    action: 'add-staff',
                    endpoint: 'league-staff',
                    leagueId: league_id,
                    targetType: 'user_role',
                    targetId: assignment.id,
                    details: { user_id, league_id },
                })

                return { statusCode: 200, headers, body: JSON.stringify({ success: true, assignment }) }
            }

            case 'remove-staff': {
                const { assignment_id } = body
                if (!assignment_id) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'assignment_id required' }) }
                }

                const [staffRole] = await sql`SELECT id FROM roles WHERE name = 'League Staff' AND is_system = true`
                if (!staffRole) {
                    return { statusCode: 500, headers, body: JSON.stringify({ error: 'League Staff role not found' }) }
                }

                const [assignment] = await sql`
                    SELECT ur.id, ur.user_id, ur.league_id
                    FROM user_roles ur
                    WHERE ur.id = ${assignment_id} AND ur.role_id = ${staffRole.id}
                `
                if (!assignment) {
                    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Staff assignment not found' }) }
                }

                const canManage = await requirePermission(event, 'league_staff_manage', assignment.league_id)
                if (!canManage) {
                    return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission for this league' }) }
                }

                await sql`DELETE FROM user_roles WHERE id = ${assignment_id}`

                await logAudit(sql, admin, {
                    action: 'remove-staff',
                    endpoint: 'league-staff',
                    leagueId: assignment.league_id,
                    targetType: 'user_role',
                    targetId: assignment_id,
                    details: { user_id: assignment.user_id, league_id: assignment.league_id },
                })

                return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
            }

            default:
                return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${body.action}` }) }
        }
    } catch (error) {
        console.error('League staff error:', error)
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message || 'Internal server error' }) }
    }
}

export const onRequest = adapt(handler)

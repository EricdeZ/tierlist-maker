import { adapt } from '../lib/adapter.js'
import { getDB, adminHeaders as headers, transaction } from '../lib/db.js'
import { requirePermission } from '../lib/auth.js'
import { logAudit } from '../lib/audit.js'

// Known permission keys with metadata
const PERMISSION_KEYS = [
    { key: 'match_report',      label: 'Match Report',      description: 'Create match reports from screenshots', scopeable: true },
    { key: 'roster_manage',     label: 'Roster Manage',     description: 'Edit rosters, transfer/drop/add players', scopeable: true },
    { key: 'match_manage',      label: 'Match Manage',      description: 'Edit or delete existing match data', scopeable: true },
    { key: 'match_manage_own',  label: 'Match Manage (Own)', description: 'Edit or delete only matches you reported', scopeable: true },
    { key: 'match_schedule',    label: 'Match Schedule',    description: 'Create and manage match schedules', scopeable: true },
    { key: 'player_manage',     label: 'Player Manage',     description: 'Edit players, bulk enroll', scopeable: false },
    { key: 'league_manage',     label: 'League Manage',     description: 'Create/edit leagues, divisions, seasons, teams', scopeable: true },
    { key: 'user_manage',       label: 'User Manage',       description: 'Manage Discord-authenticated users', scopeable: false },
    { key: 'claim_manage',      label: 'Claim Manage',      description: 'Review player claim requests', scopeable: false },
    { key: 'permission_manage', label: 'Permission Manage', description: 'Create roles, assign permissions to users', scopeable: false },
    { key: 'audit_log_view',   label: 'Audit Log',         description: 'View the audit log of all admin actions', scopeable: false },
    { key: 'league_preview',   label: 'League Preview',    description: 'View inactive seasons before they go live', scopeable: true },
    { key: 'codex_edit',       label: 'Codex Editor',      description: 'Access and edit the Codex', scopeable: false },
]

const VALID_KEYS = PERMISSION_KEYS.map(p => p.key)

const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    // Only users with permission_manage (globally) can access this endpoint
    const admin = await requirePermission(event, 'permission_manage', null)
    if (!admin) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const sql = getDB()

    try {
        // ─── GET: Return all RBAC data ───
        if (event.httpMethod === 'GET') {
            const [roles, allPermissions, userRoles, users, leagues] = await Promise.all([
                sql`SELECT id, name, description, is_system, created_at FROM roles ORDER BY is_system DESC, name ASC`,
                sql`SELECT id, role_id, permission_key FROM role_permissions ORDER BY role_id, permission_key`,
                sql`
                    SELECT ur.id, ur.user_id, ur.role_id, ur.league_id, ur.granted_by, ur.created_at,
                           u.discord_username, u.discord_avatar, u.discord_id,
                           r.name as role_name,
                           l.name as league_name,
                           gb.discord_username as granted_by_username
                    FROM user_roles ur
                    JOIN users u ON u.id = ur.user_id
                    JOIN roles r ON r.id = ur.role_id
                    LEFT JOIN leagues l ON l.id = ur.league_id
                    LEFT JOIN users gb ON gb.id = ur.granted_by
                    ORDER BY u.discord_username ASC, r.name ASC
                `,
                sql`SELECT id, discord_id, discord_username, discord_avatar FROM users ORDER BY discord_username ASC`,
                sql`SELECT id, name, slug FROM leagues ORDER BY name ASC`,
            ])

            // Attach permissions array to each role
            const rolesWithPerms = roles.map(r => ({
                ...r,
                permissions: allPermissions
                    .filter(p => p.role_id === r.id)
                    .map(p => p.permission_key),
            }))

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    roles: rolesWithPerms,
                    userRoles,
                    users,
                    leagues,
                    permissionKeys: PERMISSION_KEYS,
                }),
            }
        }

        // ─── POST: Actions ───
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
            case 'create-role':
                return await createRole(sql, body, admin)
            case 'update-role':
                return await updateRole(sql, body, admin)
            case 'delete-role':
                return await deleteRole(sql, body, admin)
            case 'set-role-permissions':
                return await setRolePermissions(sql, body, admin)
            case 'assign-role':
                return await assignRole(sql, admin, body)
            case 'revoke-role':
                return await revokeRole(sql, body, admin)
            default:
                return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${body.action}` }) }
        }
    } catch (error) {
        console.error('Permission manage error:', error)
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || 'Internal server error' }),
        }
    }
}

// ─── Create a new custom role ───
async function createRole(sql, { name, description }, admin) {
    if (!name?.trim()) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Role name is required' }) }
    }

    const [existing] = await sql`SELECT id FROM roles WHERE LOWER(name) = LOWER(${name.trim()}) LIMIT 1`
    if (existing) {
        return { statusCode: 409, headers, body: JSON.stringify({ error: `A role named "${name.trim()}" already exists` }) }
    }

    const [role] = await sql`
        INSERT INTO roles (name, description, is_system)
        VALUES (${name.trim()}, ${description?.trim() || null}, false)
        RETURNING id, name, description, is_system, created_at
    `

    await logAudit(sql, admin, { action: 'create-role', endpoint: 'permission-manage', targetType: 'role', targetId: role.id, details: { name: role.name } })

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, role }),
    }
}

// ─── Update role name/description ───
async function updateRole(sql, { role_id, name, description }, admin) {
    if (!role_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'role_id is required' }) }
    }

    const [role] = await sql`SELECT id, is_system FROM roles WHERE id = ${role_id}`
    if (!role) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Role not found' }) }
    }

    if (role.is_system && name) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Cannot rename system roles' }) }
    }

    const updates = {}
    if (name?.trim() && !role.is_system) updates.name = name.trim()
    if (description !== undefined) updates.description = description?.trim() || null

    const [updated] = await sql`
        UPDATE roles SET
            name = COALESCE(${updates.name || null}, name),
            description = ${updates.description !== undefined ? updates.description : sql`description`}
        WHERE id = ${role_id}
        RETURNING id, name, description, is_system, created_at
    `

    await logAudit(sql, admin, { action: 'update-role', endpoint: 'permission-manage', targetType: 'role', targetId: role_id, details: { name, description } })

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, role: updated }),
    }
}

// ─── Delete a custom role ───
async function deleteRole(sql, { role_id }, admin) {
    if (!role_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'role_id is required' }) }
    }

    const [role] = await sql`SELECT id, name, is_system FROM roles WHERE id = ${role_id}`
    if (!role) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Role not found' }) }
    }

    if (role.is_system) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Cannot delete system roles' }) }
    }

    await sql`DELETE FROM roles WHERE id = ${role_id}`

    await logAudit(sql, admin, { action: 'delete-role', endpoint: 'permission-manage', targetType: 'role', targetId: role_id, details: { name: role.name } })

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, deleted: role.name }),
    }
}

// ─── Set all permissions for a role (replace) ───
async function setRolePermissions(sql, { role_id, permissions }, admin) {
    if (!role_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'role_id is required' }) }
    }
    if (!Array.isArray(permissions)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'permissions must be an array' }) }
    }

    // Validate all keys
    const invalid = permissions.filter(k => !VALID_KEYS.includes(k))
    if (invalid.length) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: `Invalid permission keys: ${invalid.join(', ')}` }) }
    }

    const [role] = await sql`SELECT id, name, is_system FROM roles WHERE id = ${role_id}`
    if (!role) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Role not found' }) }
    }

    // Owner must always have permission_manage and audit_log_view
    if (role.name === 'Owner') {
        const required = ['permission_manage', 'audit_log_view']
        const missing = required.filter(k => !permissions.includes(k))
        if (missing.length) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: `Owner role must retain: ${missing.join(', ')}` }) }
        }
    }

    // Replace permissions in a transaction
    await transaction(async (tx) => {
        await tx`DELETE FROM role_permissions WHERE role_id = ${role_id}`
        for (const key of permissions) {
            await tx`INSERT INTO role_permissions (role_id, permission_key) VALUES (${role_id}, ${key})`
        }
    })

    await logAudit(sql, admin, { action: 'set-role-permissions', endpoint: 'permission-manage', targetType: 'role', targetId: role_id, details: { permissions, role_name: role.name } })

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, role_id, permissions }),
    }
}

// ─── Assign a role to a user ───
async function assignRole(sql, admin, { user_id, role_id, league_id }) {
    if (!user_id || !role_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'user_id and role_id are required' }) }
    }

    // Validate user exists
    const [user] = await sql`SELECT id FROM users WHERE id = ${user_id}`
    if (!user) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'User not found' }) }
    }

    // Validate role exists
    const [role] = await sql`SELECT id FROM roles WHERE id = ${role_id}`
    if (!role) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Role not found' }) }
    }

    // Validate league if scoped
    if (league_id) {
        const [league] = await sql`SELECT id FROM leagues WHERE id = ${league_id}`
        if (!league) {
            return { statusCode: 404, headers, body: JSON.stringify({ error: 'League not found' }) }
        }
    }

    const leagueVal = league_id || null

    // Check for existing assignment
    const existing = leagueVal
        ? await sql`SELECT id FROM user_roles WHERE user_id = ${user_id} AND role_id = ${role_id} AND league_id = ${leagueVal} LIMIT 1`
        : await sql`SELECT id FROM user_roles WHERE user_id = ${user_id} AND role_id = ${role_id} AND league_id IS NULL LIMIT 1`

    if (existing.length > 0) {
        return { statusCode: 409, headers, body: JSON.stringify({ error: 'This role assignment already exists' }) }
    }

    const [assignment] = await sql`
        INSERT INTO user_roles (user_id, role_id, league_id, granted_by)
        VALUES (${user_id}, ${role_id}, ${leagueVal}, ${admin.id})
        RETURNING id, user_id, role_id, league_id, granted_by, created_at
    `

    await logAudit(sql, admin, { action: 'assign-role', endpoint: 'permission-manage', targetType: 'user_role', targetId: assignment.id, details: { user_id, role_id, league_id: leagueVal } })

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, assignment }),
    }
}

// ─── Revoke a user-role assignment ───
async function revokeRole(sql, { user_role_id }, admin) {
    if (!user_role_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'user_role_id is required' }) }
    }

    const [assignment] = await sql`
        SELECT ur.id, ur.user_id, ur.role_id, ur.league_id, r.name as role_name
        FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.id = ${user_role_id}
    `
    if (!assignment) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Assignment not found' }) }
    }

    // Prevent revoking the last Owner assignment (lockout prevention)
    if (assignment.role_name === 'Owner') {
        const [count] = await sql`
            SELECT COUNT(*)::int as c FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE r.name = 'Owner'
        `
        if (count.c <= 1) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Cannot revoke the last Owner assignment. At least one Owner must remain.' }) }
        }
    }

    await sql`DELETE FROM user_roles WHERE id = ${user_role_id}`

    await logAudit(sql, admin, { action: 'revoke-role', endpoint: 'permission-manage', targetType: 'user_role', targetId: user_role_id, details: { user_id: assignment.user_id, role_name: assignment.role_name, league_id: assignment.league_id } })

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, revoked: user_role_id }),
    }
}

export const onRequest = adapt(handler)

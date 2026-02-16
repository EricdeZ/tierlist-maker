import { adapt } from '../lib/adapter.js'
import { getDB, adminHeaders as headers } from '../lib/db.js'
import { requirePermission } from '../lib/auth.js'
import { logAudit } from '../lib/audit.js'

function slugify(str) {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item'
}

const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const admin = await requirePermission(event, 'league_manage')
    if (!admin) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const sql = getDB()

    try {
        // GET: List all orgs with their teams
        if (event.httpMethod === 'GET') {
            const orgs = await sql`
                SELECT id, name, slug, color, created_at FROM organizations ORDER BY name
            `
            const teams = await sql`
                SELECT t.id, t.name, t.slug, t.color, t.season_id, t.organization_id,
                       s.name as season_name, d.name as division_name, l.name as league_name
                FROM teams t
                JOIN seasons s ON t.season_id = s.id
                JOIN divisions d ON s.division_id = d.id
                JOIN leagues l ON s.league_id = l.id
                ORDER BY t.name
            `
            return { statusCode: 200, headers, body: JSON.stringify({ orgs, teams }) }
        }

        // POST: CRUD actions
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
            case 'create': return await createOrg(sql, body, admin)
            case 'update': return await updateOrg(sql, body, admin)
            case 'delete': return await deleteOrg(sql, body, admin)
            case 'assign-team': return await assignTeam(sql, body, admin)
            case 'unassign-team': return await unassignTeam(sql, body, admin)
            default:
                return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${body.action}` }) }
        }
    } catch (error) {
        console.error('Org manage error:', error)
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message || 'Internal server error' }) }
    }
}

async function createOrg(sql, { name, color }, admin) {
    if (!name?.trim()) return { statusCode: 400, headers, body: JSON.stringify({ error: 'name required' }) }
    const slug = slugify(name.trim())
    const [row] = await sql`
        INSERT INTO organizations (name, slug, color)
        VALUES (${name.trim()}, ${slug}, ${color || null})
        RETURNING *
    `
    await logAudit(sql, admin, { action: 'create-org', endpoint: 'org-manage', targetType: 'organization', targetId: row.id, details: { name: row.name } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, org: row }) }
}

async function updateOrg(sql, { id, name, slug, color }, admin) {
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    const [row] = await sql`
        UPDATE organizations SET
            name = COALESCE(${name || null}, name),
            slug = COALESCE(${slug || null}, slug),
            color = COALESCE(${color || null}, color),
            updated_at = NOW()
        WHERE id = ${id} RETURNING *
    `
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Organization not found' }) }
    await logAudit(sql, admin, { action: 'update-org', endpoint: 'org-manage', targetType: 'organization', targetId: id, details: { name, slug, color } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, org: row }) }
}

async function deleteOrg(sql, { id }, admin) {
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    // Unlink teams first
    await sql`UPDATE teams SET organization_id = NULL WHERE organization_id = ${id}`
    const [row] = await sql`DELETE FROM organizations WHERE id = ${id} RETURNING id, name`
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Organization not found' }) }
    await logAudit(sql, admin, { action: 'delete-org', endpoint: 'org-manage', targetType: 'organization', targetId: id, details: { name: row.name } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, deleted: row }) }
}

async function assignTeam(sql, { team_id, org_id }, admin) {
    if (!team_id || !org_id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'team_id and org_id required' }) }
    const [row] = await sql`
        UPDATE teams SET organization_id = ${org_id}, updated_at = NOW()
        WHERE id = ${team_id} RETURNING id, name, organization_id
    `
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Team not found' }) }
    await logAudit(sql, admin, { action: 'assign-team-org', endpoint: 'org-manage', targetType: 'team', targetId: team_id, details: { org_id } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, team: row }) }
}

async function unassignTeam(sql, { team_id }, admin) {
    if (!team_id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'team_id required' }) }
    const [row] = await sql`
        UPDATE teams SET organization_id = NULL, updated_at = NOW()
        WHERE id = ${team_id} RETURNING id, name, organization_id
    `
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Team not found' }) }
    await logAudit(sql, admin, { action: 'unassign-team-org', endpoint: 'org-manage', targetType: 'team', targetId: team_id, details: {} })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, team: row }) }
}

export const onRequest = adapt(handler)

import { adapt } from '../lib/adapter.js'
import { getDB, adminHeaders as headers } from '../lib/db.js'
import { requirePermission } from '../lib/auth.js'
import { logAudit } from '../lib/audit.js'
import { deleteR2Object } from '../lib/r2.js'

function slugify(str) {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item'
}

const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const admin = await requirePermission(event, 'team_manage')
    if (!admin) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const sql = getDB()

    try {
        // ─── GET: Hierarchy for season picker + teams with player counts ───
        if (event.httpMethod === 'GET') {
            const leagues = await sql`SELECT id, name, slug FROM leagues ORDER BY name`
            const divisions = await sql`SELECT id, league_id, name, tier, slug FROM divisions ORDER BY tier, name`
            const seasons = await sql`
                SELECT id, league_id, division_id, name, slug, is_active
                FROM seasons ORDER BY start_date DESC NULLS LAST, name
            `
            const teams = await sql`
                SELECT t.id, t.season_id, t.name, t.color, t.slug, t.logo_url
                FROM teams t ORDER BY t.name
            `
            const teamPlayerCounts = await sql`
                SELECT t.id as team_id, COUNT(lp.id) as player_count
                FROM teams t
                LEFT JOIN league_players lp ON lp.team_id = t.id AND lp.is_active = true
                GROUP BY t.id
            `

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ leagues, divisions, seasons, teams, teamPlayerCounts }),
            }
        }

        // ─── POST: Team CRUD ───
        if (event.httpMethod !== 'POST') {
            return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
        }

        const body = JSON.parse(event.body)
        const { action } = body

        switch (action) {
            case 'create-team':  return await createTeam(sql, body, admin)
            case 'update-team':  return await updateTeam(sql, body, admin)
            case 'delete-team':  return await deleteTeam(sql, body, admin, event.env)
            case 'copy-teams':   return await copyTeams(sql, body, admin)
            default:
                return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
        }
    } catch (error) {
        console.error('Team manage error:', error)
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message || 'Internal server error' }) }
    }
}

async function createTeam(sql, { season_id, name, color }, admin) {
    if (!season_id || !name?.trim() || !color?.trim()) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'season_id, name, and color required' }) }
    }
    const slug = slugify(name.trim())
    const [row] = await sql`
        INSERT INTO teams (season_id, name, color, slug)
        VALUES (${season_id}, ${name.trim()}, ${color.trim()}, ${slug})
        RETURNING *
    `
    await logAudit(sql, admin, { action: 'create-team', endpoint: 'team-manage', targetType: 'team', targetId: row.id, details: { name: row.name, season_id } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, team: row }) }
}

async function updateTeam(sql, { id, name, color, slug }, admin) {
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    const [row] = await sql`
        UPDATE teams SET
            name = COALESCE(${name || null}, name),
            color = COALESCE(${color || null}, color),
            slug = COALESCE(${slug || null}, slug),
            updated_at = NOW()
        WHERE id = ${id} RETURNING *
    `
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Team not found' }) }
    await logAudit(sql, admin, { action: 'update-team', endpoint: 'team-manage', targetType: 'team', targetId: id, details: { name, color, slug } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, team: row }) }
}

async function copyTeams(sql, { source_season_id, target_season_id, team_ids }, admin) {
    if (!source_season_id || !target_season_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'source_season_id and target_season_id required' }) }
    }
    if (source_season_id === target_season_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Source and target season must be different' }) }
    }
    let sourceTeams
    if (team_ids?.length) {
        sourceTeams = await sql`
            SELECT name, color, logo_url FROM teams WHERE season_id = ${source_season_id} AND id = ANY(${team_ids}) ORDER BY name
        `
    } else {
        sourceTeams = await sql`
            SELECT name, color, logo_url FROM teams WHERE season_id = ${source_season_id} ORDER BY name
        `
    }
    if (sourceTeams.length === 0) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'No teams found to copy' }) }
    }
    const created = []
    for (const t of sourceTeams) {
        const slug = slugify(t.name)
        const [row] = await sql`
            INSERT INTO teams (season_id, name, color, slug, logo_url)
            VALUES (${target_season_id}, ${t.name}, ${t.color}, ${slug}, ${t.logo_url || null})
            RETURNING *
        `
        created.push(row)
    }
    await logAudit(sql, admin, { action: 'copy-teams', endpoint: 'team-manage', targetType: 'season', targetId: target_season_id, details: { source_season_id, count: created.length } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, teams: created, count: created.length }) }
}

async function deleteTeam(sql, { id }, admin, env) {
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    const [hasPlayers] = await sql`SELECT 1 FROM league_players WHERE team_id = ${id} LIMIT 1`
    if (hasPlayers) {
        return { statusCode: 409, headers, body: JSON.stringify({ error: 'Cannot delete team that has players. Remove players first.' }) }
    }
    const [hasMatches] = await sql`SELECT 1 FROM matches WHERE team1_id = ${id} OR team2_id = ${id} LIMIT 1`
    if (hasMatches) {
        return { statusCode: 409, headers, body: JSON.stringify({ error: 'Cannot delete team that has matches.' }) }
    }
    const [row] = await sql`DELETE FROM teams WHERE id = ${id} RETURNING id, name, logo_url`
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Team not found' }) }

    // Clean up R2 icon if it exists
    if (row.logo_url && env?.TEAM_ICONS) {
        try { await deleteR2Object(env.TEAM_ICONS, row.logo_url) } catch { /* best-effort */ }
    }

    await logAudit(sql, admin, { action: 'delete-team', endpoint: 'team-manage', targetType: 'team', targetId: id, details: { name: row.name } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, deleted: row }) }
}

export const onRequest = adapt(handler)

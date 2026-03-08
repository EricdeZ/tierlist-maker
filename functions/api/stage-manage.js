import { adapt } from '../lib/adapter.js'
import { getDB, adminHeaders as headers } from '../lib/db.js'
import { requirePermission, getLeagueIdFromSeason } from '../lib/auth.js'
import { logAudit } from '../lib/audit.js'
import { advanceFromGroupStandings } from '../lib/advancement.js'

function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Find sibling stages with the same slug across all active seasons in the same league
async function getSiblingStages(sql, stageId) {
    return sql`
        SELECT ss2.id as stage_id, ss2.season_id
        FROM season_stages ss
        JOIN seasons s ON ss.season_id = s.id
        JOIN divisions d ON s.division_id = d.id
        JOIN seasons s2 ON s2.division_id IN (SELECT d2.id FROM divisions d2 WHERE d2.league_id = d.league_id)
        JOIN season_stages ss2 ON ss2.season_id = s2.id AND ss2.slug = ss.slug
        WHERE ss.id = ${stageId} AND s2.is_active = true
    `
}

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
        if (event.httpMethod === 'GET') {
            return await handleGet(sql, event, admin)
        }

        if (event.httpMethod === 'POST') {
            if (!event.body) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Request body required' }) }
            }
            const body = JSON.parse(event.body)

            switch (body.action) {
                case 'create-stage': return await createStage(sql, body, admin, event)
                case 'create-stage-league-wide': return await createStageLeagueWide(sql, body, admin, event)
                case 'update-stage': return await updateStage(sql, body, admin, event)
                case 'delete-stage': return await deleteStage(sql, body, admin, event)
                case 'create-group': return await createGroup(sql, body, admin, event)
                case 'create-group-league-wide': return await createGroupLeagueWide(sql, body, admin, event)
                case 'update-group': return await updateGroup(sql, body, admin, event)
                case 'delete-group': return await deleteGroup(sql, body, admin, event)
                case 'set-group-teams': return await setGroupTeams(sql, body, admin, event)
                case 'create-round': return await createRound(sql, body, admin, event)
                case 'create-round-league-wide': return await createRoundLeagueWide(sql, body, admin, event)
                case 'update-round': return await updateRound(sql, body, admin, event)
                case 'delete-round': return await deleteRound(sql, body, admin, event)
                default:
                    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${body.action}` }) }
            }
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    } catch (error) {
        console.error('stage-manage error:', error)
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) }
    }
}


// ─── GET: stages, groups, rounds, group teams for a season ───
async function handleGet(sql, event) {
    const { seasonId } = event.queryStringParameters || {}
    if (!seasonId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'seasonId required' }) }
    }

    const leagueId = await getLeagueIdFromSeason(seasonId)
    if (!await requirePermission(event, 'match_schedule', leagueId)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission for this league' }) }
    }

    const [stages, groups, groupTeams, rounds] = await Promise.all([
        sql`SELECT * FROM season_stages WHERE season_id = ${seasonId} ORDER BY sort_order`,
        sql`
            SELECT sg.* FROM stage_groups sg
            JOIN season_stages ss ON sg.stage_id = ss.id
            WHERE ss.season_id = ${seasonId}
            ORDER BY sg.stage_id, sg.sort_order
        `,
        sql`
            SELECT sgt.*, t.name as team_name, t.color as team_color, t.slug as team_slug
            FROM stage_group_teams sgt
            JOIN teams t ON sgt.team_id = t.id
            JOIN stage_groups sg ON sgt.group_id = sg.id
            JOIN season_stages ss ON sg.stage_id = ss.id
            WHERE ss.season_id = ${seasonId}
            ORDER BY sgt.group_id, sgt.seed NULLS LAST, t.name
        `,
        sql`
            SELECT sr.* FROM stage_rounds sr
            JOIN season_stages ss ON sr.stage_id = ss.id
            WHERE ss.season_id = ${seasonId}
            ORDER BY sr.stage_id, sr.sort_order
        `,
    ])

    return { statusCode: 200, headers, body: JSON.stringify({ stages, groups, groupTeams, rounds }) }
}


// ═══════════════════════════════════════════════════
// STAGES
// ═══════════════════════════════════════════════════

async function createStage(sql, body, admin, event) {
    const { season_id, name, stage_type, sort_order, settings } = body
    if (!season_id || !name) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'season_id and name required' }) }
    }

    const leagueId = await getLeagueIdFromSeason(season_id)
    if (!await requirePermission(event, 'match_schedule', leagueId)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission for this league' }) }
    }

    const slug = slugify(name)
    const [created] = await sql`
        INSERT INTO season_stages (season_id, name, slug, stage_type, sort_order, settings)
        VALUES (${season_id}, ${name}, ${slug}, ${stage_type || null}, ${sort_order ?? 0}, ${JSON.stringify(settings || {})})
        RETURNING *
    `

    await logAudit(sql, admin, {
        action: 'create-stage', endpoint: 'stage-manage',
        targetType: 'season_stage', targetId: created.id,
        details: { season_id, name, stage_type }
    })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, stage: created }) }
}

async function createStageLeagueWide(sql, body, admin, event) {
    const { season_id, name, stage_type, sort_order, settings } = body
    if (!season_id || !name) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'season_id and name required' }) }
    }

    const leagueId = await getLeagueIdFromSeason(season_id)
    if (!await requirePermission(event, 'match_schedule', leagueId)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission for this league' }) }
    }

    // Find all active seasons in the same league
    const siblingSeasons = await sql`
        SELECT s.id as season_id FROM seasons s
        JOIN divisions d ON s.division_id = d.id
        WHERE d.league_id = ${leagueId} AND s.is_active = true
    `

    const slug = slugify(name)
    const created = []
    for (const s of siblingSeasons) {
        // Skip if this season already has a stage with this slug
        const [existing] = await sql`
            SELECT id FROM season_stages WHERE season_id = ${s.season_id} AND slug = ${slug}
        `
        if (existing) continue

        const [row] = await sql`
            INSERT INTO season_stages (season_id, name, slug, stage_type, sort_order, settings)
            VALUES (${s.season_id}, ${name}, ${slug}, ${stage_type || null}, ${sort_order ?? 0}, ${JSON.stringify(settings || {})})
            RETURNING *
        `
        created.push(row)
    }

    await logAudit(sql, admin, {
        action: 'create-stage-league-wide', endpoint: 'stage-manage',
        targetType: 'season_stage', targetId: null,
        details: { league_id: leagueId, name, stage_type, seasons_count: created.length }
    })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, created_count: created.length }) }
}

async function updateStage(sql, body, admin, event) {
    const { id, name, stage_type, sort_order, status, settings } = body
    if (!id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    }

    const [stage] = await sql`
        SELECT ss.id, s.league_id, ss.status as old_status
        FROM season_stages ss JOIN seasons s ON ss.season_id = s.id WHERE ss.id = ${id}
    `
    if (!stage || !await requirePermission(event, 'match_schedule', stage.league_id)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission' }) }
    }

    const slug = name ? slugify(name) : undefined

    await sql`
        UPDATE season_stages SET
            name = COALESCE(${name || null}, name),
            slug = COALESCE(${slug || null}, slug),
            stage_type = ${stage_type !== undefined ? (stage_type || null) : sql`stage_type`},
            sort_order = COALESCE(${sort_order ?? null}, sort_order),
            status = COALESCE(${status || null}, status),
            settings = COALESCE(${settings ? JSON.stringify(settings) : null}::jsonb, settings)
        WHERE id = ${id}
    `

    // If stage is being marked completed, trigger group standing advancement
    if (status === 'completed' && stage.old_status !== 'completed') {
        event.waitUntil(
            advanceFromGroupStandings(sql, id)
                .catch(err => console.error('Group advancement failed:', err))
        )
    }

    await logAudit(sql, admin, {
        action: 'update-stage', endpoint: 'stage-manage',
        targetType: 'season_stage', targetId: id,
        details: { name, stage_type, sort_order, status }
    })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}

async function deleteStage(sql, body, admin, event) {
    const { id } = body
    if (!id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    }

    const [stage] = await sql`
        SELECT ss.id, s.league_id FROM season_stages ss JOIN seasons s ON ss.season_id = s.id WHERE ss.id = ${id}
    `
    if (!stage || !await requirePermission(event, 'match_schedule', stage.league_id)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission' }) }
    }

    // Unlink scheduled_matches before deleting (ON DELETE SET NULL handles this, but be explicit)
    await sql`UPDATE scheduled_matches SET stage_id = NULL, group_id = NULL, round_id = NULL WHERE stage_id = ${id}`
    await sql`UPDATE matches SET stage_id = NULL, group_id = NULL, round_id = NULL WHERE stage_id = ${id}`
    await sql`DELETE FROM season_stages WHERE id = ${id}`

    await logAudit(sql, admin, {
        action: 'delete-stage', endpoint: 'stage-manage',
        targetType: 'season_stage', targetId: id,
    })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}


// ═══════════════════════════════════════════════════
// GROUPS
// ═══════════════════════════════════════════════════

async function createGroup(sql, body, admin, event) {
    const { stage_id, name, group_type, sort_order, settings } = body
    if (!stage_id || !name) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'stage_id and name required' }) }
    }

    const [stage] = await sql`
        SELECT ss.id, s.league_id FROM season_stages ss JOIN seasons s ON ss.season_id = s.id WHERE ss.id = ${stage_id}
    `
    if (!stage || !await requirePermission(event, 'match_schedule', stage.league_id)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission' }) }
    }

    const slug = slugify(name)
    const [created] = await sql`
        INSERT INTO stage_groups (stage_id, name, slug, group_type, sort_order, settings)
        VALUES (${stage_id}, ${name}, ${slug}, ${group_type || 'default'}, ${sort_order ?? 0}, ${JSON.stringify(settings || {})})
        RETURNING *
    `

    await logAudit(sql, admin, {
        action: 'create-group', endpoint: 'stage-manage',
        targetType: 'stage_group', targetId: created.id,
        details: { stage_id, name, group_type }
    })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, group: created }) }
}

async function createGroupLeagueWide(sql, body, admin, event) {
    const { stage_id, name, group_type, sort_order, settings } = body
    if (!stage_id || !name) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'stage_id and name required' }) }
    }

    const [stage] = await sql`
        SELECT ss.id, s.league_id FROM season_stages ss JOIN seasons s ON ss.season_id = s.id WHERE ss.id = ${stage_id}
    `
    if (!stage || !await requirePermission(event, 'match_schedule', stage.league_id)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission' }) }
    }

    const siblings = await getSiblingStages(sql, stage_id)
    const slug = slugify(name)
    let count = 0
    for (const sib of siblings) {
        const [existing] = await sql`
            SELECT id FROM stage_groups WHERE stage_id = ${sib.stage_id} AND slug = ${slug}
        `
        if (existing) continue
        await sql`
            INSERT INTO stage_groups (stage_id, name, slug, group_type, sort_order, settings)
            VALUES (${sib.stage_id}, ${name}, ${slug}, ${group_type || 'default'}, ${sort_order ?? 0}, ${JSON.stringify(settings || {})})
        `
        count++
    }

    await logAudit(sql, admin, {
        action: 'create-group-league-wide', endpoint: 'stage-manage',
        targetType: 'stage_group', targetId: null,
        details: { stage_id, name, created_count: count }
    })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, created_count: count }) }
}

async function updateGroup(sql, body, admin, event) {
    const { id, name, group_type, sort_order, settings } = body
    if (!id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    }

    const [group] = await sql`
        SELECT sg.id, s.league_id FROM stage_groups sg
        JOIN season_stages ss ON sg.stage_id = ss.id
        JOIN seasons s ON ss.season_id = s.id
        WHERE sg.id = ${id}
    `
    if (!group || !await requirePermission(event, 'match_schedule', group.league_id)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission' }) }
    }

    const slug = name ? slugify(name) : undefined
    await sql`
        UPDATE stage_groups SET
            name = COALESCE(${name || null}, name),
            slug = COALESCE(${slug || null}, slug),
            group_type = COALESCE(${group_type || null}, group_type),
            sort_order = COALESCE(${sort_order ?? null}, sort_order),
            settings = COALESCE(${settings ? JSON.stringify(settings) : null}::jsonb, settings)
        WHERE id = ${id}
    `

    await logAudit(sql, admin, {
        action: 'update-group', endpoint: 'stage-manage',
        targetType: 'stage_group', targetId: id,
        details: { name, group_type, sort_order }
    })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}

async function deleteGroup(sql, body, admin, event) {
    const { id } = body
    if (!id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    }

    const [group] = await sql`
        SELECT sg.id, s.league_id FROM stage_groups sg
        JOIN season_stages ss ON sg.stage_id = ss.id
        JOIN seasons s ON ss.season_id = s.id
        WHERE sg.id = ${id}
    `
    if (!group || !await requirePermission(event, 'match_schedule', group.league_id)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission' }) }
    }

    await sql`UPDATE scheduled_matches SET group_id = NULL WHERE group_id = ${id}`
    await sql`UPDATE matches SET group_id = NULL WHERE group_id = ${id}`
    await sql`DELETE FROM stage_groups WHERE id = ${id}`

    await logAudit(sql, admin, {
        action: 'delete-group', endpoint: 'stage-manage',
        targetType: 'stage_group', targetId: id,
    })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}


// ═══════════════════════════════════════════════════
// GROUP TEAMS (bulk set)
// ═══════════════════════════════════════════════════

async function setGroupTeams(sql, body, admin, event) {
    const { group_id, teams } = body
    if (!group_id || !Array.isArray(teams)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'group_id and teams[] required' }) }
    }

    const [group] = await sql`
        SELECT sg.id, s.league_id FROM stage_groups sg
        JOIN season_stages ss ON sg.stage_id = ss.id
        JOIN seasons s ON ss.season_id = s.id
        WHERE sg.id = ${group_id}
    `
    if (!group || !await requirePermission(event, 'match_schedule', group.league_id)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission' }) }
    }

    // Replace all team assignments for this group
    await sql`DELETE FROM stage_group_teams WHERE group_id = ${group_id}`

    if (teams.length > 0) {
        for (const t of teams) {
            await sql`
                INSERT INTO stage_group_teams (group_id, team_id, seed)
                VALUES (${group_id}, ${t.team_id}, ${t.seed ?? null})
            `
        }
    }

    await logAudit(sql, admin, {
        action: 'set-group-teams', endpoint: 'stage-manage',
        targetType: 'stage_group', targetId: group_id,
        details: { team_count: teams.length }
    })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}


// ═══════════════════════════════════════════════════
// ROUNDS
// ═══════════════════════════════════════════════════

async function createRound(sql, body, admin, event) {
    const { stage_id, name, round_number, sort_order, best_of_override, scheduled_date } = body
    if (!stage_id || !name || round_number == null) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'stage_id, name, and round_number required' }) }
    }

    const [stage] = await sql`
        SELECT ss.id, s.league_id FROM season_stages ss JOIN seasons s ON ss.season_id = s.id WHERE ss.id = ${stage_id}
    `
    if (!stage || !await requirePermission(event, 'match_schedule', stage.league_id)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission' }) }
    }

    const [created] = await sql`
        INSERT INTO stage_rounds (stage_id, name, round_number, sort_order, best_of_override, scheduled_date)
        VALUES (${stage_id}, ${name}, ${round_number}, ${sort_order ?? round_number}, ${best_of_override ?? null}, ${scheduled_date || null})
        RETURNING *
    `

    await logAudit(sql, admin, {
        action: 'create-round', endpoint: 'stage-manage',
        targetType: 'stage_round', targetId: created.id,
        details: { stage_id, name, round_number }
    })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, round: created }) }
}

async function createRoundLeagueWide(sql, body, admin, event) {
    const { stage_id, name, round_number, sort_order, best_of_override, scheduled_date } = body
    if (!stage_id || !name || round_number == null) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'stage_id, name, and round_number required' }) }
    }

    const [stage] = await sql`
        SELECT ss.id, s.league_id FROM season_stages ss JOIN seasons s ON ss.season_id = s.id WHERE ss.id = ${stage_id}
    `
    if (!stage || !await requirePermission(event, 'match_schedule', stage.league_id)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission' }) }
    }

    const siblings = await getSiblingStages(sql, stage_id)
    let count = 0
    for (const sib of siblings) {
        const [existing] = await sql`
            SELECT id FROM stage_rounds WHERE stage_id = ${sib.stage_id} AND round_number = ${round_number}
        `
        if (existing) continue
        await sql`
            INSERT INTO stage_rounds (stage_id, name, round_number, sort_order, best_of_override, scheduled_date)
            VALUES (${sib.stage_id}, ${name}, ${round_number}, ${sort_order ?? round_number}, ${best_of_override ?? null}, ${scheduled_date || null})
        `
        count++
    }

    await logAudit(sql, admin, {
        action: 'create-round-league-wide', endpoint: 'stage-manage',
        targetType: 'stage_round', targetId: null,
        details: { stage_id, name, round_number, created_count: count }
    })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, created_count: count }) }
}

async function updateRound(sql, body, admin, event) {
    const { id, name, round_number, sort_order, best_of_override, scheduled_date } = body
    if (!id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    }

    const [round] = await sql`
        SELECT sr.id, s.league_id FROM stage_rounds sr
        JOIN season_stages ss ON sr.stage_id = ss.id
        JOIN seasons s ON ss.season_id = s.id
        WHERE sr.id = ${id}
    `
    if (!round || !await requirePermission(event, 'match_schedule', round.league_id)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission' }) }
    }

    await sql`
        UPDATE stage_rounds SET
            name = COALESCE(${name || null}, name),
            round_number = COALESCE(${round_number ?? null}, round_number),
            sort_order = COALESCE(${sort_order ?? null}, sort_order),
            best_of_override = ${best_of_override !== undefined ? (best_of_override || null) : sql`best_of_override`},
            scheduled_date = ${scheduled_date !== undefined ? (scheduled_date || null) : sql`scheduled_date`}
        WHERE id = ${id}
    `

    await logAudit(sql, admin, {
        action: 'update-round', endpoint: 'stage-manage',
        targetType: 'stage_round', targetId: id,
        details: { name, round_number }
    })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}

async function deleteRound(sql, body, admin, event) {
    const { id } = body
    if (!id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    }

    const [round] = await sql`
        SELECT sr.id, s.league_id FROM stage_rounds sr
        JOIN season_stages ss ON sr.stage_id = ss.id
        JOIN seasons s ON ss.season_id = s.id
        WHERE sr.id = ${id}
    `
    if (!round || !await requirePermission(event, 'match_schedule', round.league_id)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission' }) }
    }

    await sql`UPDATE scheduled_matches SET round_id = NULL WHERE round_id = ${id}`
    await sql`UPDATE matches SET round_id = NULL WHERE round_id = ${id}`
    await sql`DELETE FROM stage_rounds WHERE id = ${id}`

    await logAudit(sql, admin, {
        action: 'delete-round', endpoint: 'stage-manage',
        targetType: 'stage_round', targetId: id,
    })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}

export const onRequest = adapt(handler)

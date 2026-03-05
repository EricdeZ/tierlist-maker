import { adapt } from '../lib/adapter.js'
import { getDB, adminHeaders, transaction } from '../lib/db.js'
import { requirePermission } from '../lib/auth.js'
import { deleteOpenScrimsForCommunityTeam, expireStale } from '../lib/scrim.js'

const err = (msg, code = 400) => ({
    statusCode: code, headers: adminHeaders, body: JSON.stringify({ error: msg }),
})

const ok = (data) => ({
    statusCode: 200, headers: adminHeaders, body: JSON.stringify(data),
})

const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: adminHeaders, body: '' }
    }

    const user = await requirePermission(event, 'league_manage')
    if (!user) return err('Unauthorized', 401)

    const sql = getDB()
    const params = event.queryStringParameters || {}
    const { action } = params

    try {
        if (event.httpMethod === 'GET') {
            switch (action) {
                case 'teams': return await handleListTeams(sql, params)
                case 'team-detail': return await handleTeamDetail(sql, params)
                case 'scrims': return await handleListScrims(sql, params)
                case 'scrim-stats': return await handleScrimStats(sql)
                case 'team-stats': return await handleTeamStats(sql)
                default: return err(`Unknown action: ${action}`)
            }
        }

        if (event.httpMethod === 'POST') {
            const body = event.body ? JSON.parse(event.body) : {}
            switch (action) {
                case 'edit-team': return await handleEditTeam(sql, body)
                case 'delete-team': return await handleDeleteTeam(sql, event, body)
                case 'cancel-scrim': return await handleCancelScrim(sql, body)
                case 'resolve-dispute': return await handleResolveDispute(sql, body)
                default: return err(`Unknown action: ${action}`)
            }
        }

        return err('Method not allowed', 405)
    } catch (error) {
        console.error('admin-community error:', error)
        return { statusCode: 500, headers: adminHeaders, body: JSON.stringify({ error: error.message }) }
    }
}

// ═══════════════════════════════════════════════════
// GET handlers
// ═══════════════════════════════════════════════════

async function handleListTeams(sql, params) {
    const { search, tier } = params

    let where = sql`WHERE 1=1`
    if (tier) where = sql`${where} AND ct.skill_tier = ${Number(tier)}`
    if (search) where = sql`${where} AND ct.name ILIKE ${'%' + search + '%'}`

    const teams = await sql`
        SELECT ct.*,
               u.discord_username AS owner_username,
               u.discord_avatar AS owner_avatar,
               u.discord_id AS owner_discord_id,
               (SELECT COUNT(*) FROM community_team_members m WHERE m.team_id = ct.id AND m.status = 'active') AS member_count
        FROM community_teams ct
        LEFT JOIN users u ON u.id = ct.owner_user_id
        ${where}
        ORDER BY ct.created_at DESC
    `

    return ok({ teams })
}

async function handleTeamDetail(sql, params) {
    const { id } = params
    if (!id) return err('Missing team id')

    const [team] = await sql`
        SELECT ct.*,
               u.discord_username AS owner_username,
               u.discord_avatar AS owner_avatar,
               u.discord_id AS owner_discord_id
        FROM community_teams ct
        LEFT JOIN users u ON u.id = ct.owner_user_id
        WHERE ct.id = ${Number(id)}
    `
    if (!team) return err('Team not found', 404)

    const members = await sql`
        SELECT m.*, u.discord_username, u.discord_avatar, u.discord_id
        FROM community_team_members m
        JOIN users u ON u.id = m.user_id
        WHERE m.team_id = ${team.id} AND m.status = 'active'
        ORDER BY m.role = 'captain' DESC, m.joined_at ASC
    `

    const pendingInvites = await sql`
        SELECT i.*,
               fu.discord_username AS from_username,
               tu.discord_username AS to_username
        FROM community_team_invitations i
        LEFT JOIN users fu ON fu.id = i.from_user_id
        LEFT JOIN users tu ON tu.id = i.to_user_id
        WHERE i.team_id = ${team.id} AND i.status = 'pending'
        ORDER BY i.created_at DESC
    `

    return ok({ team, members, pendingInvites })
}

async function handleListScrims(sql, params) {
    await expireStale(sql)
    const { status, limit: rawLimit, offset: rawOffset } = params
    const limit = Math.min(Number(rawLimit) || 50, 200)
    const offset = Number(rawOffset) || 0

    let statusFilter = sql``
    if (status && status !== 'all') {
        statusFilter = sql`AND sr.status = ${status}`
    }

    const scrims = await sql`
        SELECT sr.*,
               -- posting team info (handles both league teams with positive IDs and community teams with negative IDs)
               CASE WHEN sr.team_id < 0 THEN ct_post.name ELSE t_post.name END AS team_name,
               CASE WHEN sr.team_id < 0 THEN ct_post.logo_url ELSE t_post.logo_url END AS team_logo,
               CASE WHEN sr.team_id < 0 THEN 'community' ELSE 'league' END AS team_type,
               u_post.discord_username AS poster_username,
               -- accepted team info
               CASE WHEN sr.accepted_team_id < 0 THEN ct_acc.name ELSE t_acc.name END AS accepted_team_name,
               CASE WHEN sr.accepted_team_id < 0 THEN ct_acc.logo_url ELSE t_acc.logo_url END AS accepted_team_logo,
               u_acc.discord_username AS acceptor_username,
               -- challenged team info
               CASE WHEN sr.challenged_team_id < 0 THEN ct_chal.name ELSE t_chal.name END AS challenged_team_name,
               -- division info for league teams
               d.name AS division_name,
               l.name AS league_name
        FROM scrim_requests sr
        LEFT JOIN teams t_post ON sr.team_id > 0 AND t_post.id = sr.team_id
        LEFT JOIN community_teams ct_post ON sr.team_id < 0 AND ct_post.id = ABS(sr.team_id)
        LEFT JOIN users u_post ON u_post.id = sr.user_id
        LEFT JOIN teams t_acc ON sr.accepted_team_id > 0 AND t_acc.id = sr.accepted_team_id
        LEFT JOIN community_teams ct_acc ON sr.accepted_team_id < 0 AND ct_acc.id = ABS(sr.accepted_team_id)
        LEFT JOIN users u_acc ON u_acc.id = sr.accepted_user_id
        LEFT JOIN teams t_chal ON sr.challenged_team_id > 0 AND t_chal.id = sr.challenged_team_id
        LEFT JOIN community_teams ct_chal ON sr.challenged_team_id < 0 AND ct_chal.id = ABS(sr.challenged_team_id)
        LEFT JOIN seasons s ON t_post.season_id = s.id
        LEFT JOIN divisions d ON s.division_id = d.id
        LEFT JOIN leagues l ON d.league_id = l.id
        WHERE 1=1 ${statusFilter}
        ORDER BY sr.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
    `

    const [{ total }] = await sql`
        SELECT COUNT(*) AS total FROM scrim_requests sr WHERE 1=1 ${statusFilter}
    `

    return ok({ scrims, total: Number(total) })
}

async function handleScrimStats(sql) {
    await expireStale(sql)
    const [stats] = await sql`
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'open') AS open_count,
            COUNT(*) FILTER (WHERE status = 'accepted') AS accepted_count,
            COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_count,
            COUNT(*) FILTER (WHERE status = 'expired') AS expired_count,
            COUNT(*) FILTER (WHERE outcome = 'disputed') AS disputed_count,
            COUNT(*) FILTER (WHERE outcome = 'completed') AS completed_count,
            COUNT(*) FILTER (WHERE outcome = 'no_show') AS no_show_count,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS last_7_days,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') AS last_30_days
        FROM scrim_requests
    `

    return ok({ stats })
}

async function handleTeamStats(sql) {
    const [stats] = await sql`
        SELECT
            COUNT(*) AS total_teams,
            COUNT(*) FILTER (WHERE (SELECT COUNT(*) FROM community_team_members m WHERE m.team_id = ct.id AND m.status = 'active') >= 5) AS roster_ready,
            AVG((SELECT COUNT(*) FROM community_team_members m WHERE m.team_id = ct.id AND m.status = 'active'))::numeric(3,1) AS avg_members
        FROM community_teams ct
    `

    const tierCounts = await sql`
        SELECT skill_tier, COUNT(*) AS count
        FROM community_teams
        GROUP BY skill_tier
        ORDER BY skill_tier
    `

    return ok({ stats, tierCounts })
}

// ═══════════════════════════════════════════════════
// POST handlers
// ═══════════════════════════════════════════════════

async function handleEditTeam(sql, body) {
    const { id, name, skill_tier, color } = body
    if (!id) return err('Missing team id')

    const updates = []
    const vals = {}

    if (name !== undefined) {
        if (!name.trim()) return err('Name cannot be empty')
        vals.name = name.trim()
    }
    if (skill_tier !== undefined) {
        const tier = Number(skill_tier)
        if (tier < 1 || tier > 5) return err('Skill tier must be 1-5')
        vals.skill_tier = tier
    }
    if (color !== undefined) {
        vals.color = color || null
    }

    if (Object.keys(vals).length === 0) return err('Nothing to update')

    // Build dynamic update
    const setClauses = Object.entries(vals).map(([k, v]) => sql`${sql(k)} = ${v}`)

    await sql`
        UPDATE community_teams
        SET ${sql(vals)}, updated_at = NOW()
        WHERE id = ${Number(id)}
    `

    return ok({ success: true })
}

async function handleDeleteTeam(sql, event, body) {
    const { id } = body
    if (!id) return err('Missing team id')

    const [team] = await sql`SELECT id, name FROM community_teams WHERE id = ${Number(id)}`
    if (!team) return err('Team not found', 404)

    await transaction(event, async (tx) => {
        // Cancel open scrims for this community team
        await tx`
            UPDATE scrim_requests
            SET status = 'cancelled', updated_at = NOW()
            WHERE (team_id = ${-Number(id)} OR accepted_team_id = ${-Number(id)} OR challenged_team_id = ${-Number(id)})
              AND status IN ('open', 'accepted')
        `
        // Delete invitations
        await tx`DELETE FROM community_team_invitations WHERE team_id = ${Number(id)}`
        // Delete members
        await tx`DELETE FROM community_team_members WHERE team_id = ${Number(id)}`
        // Delete team
        await tx`DELETE FROM community_teams WHERE id = ${Number(id)}`
    })

    return ok({ success: true, deleted: team.name })
}

async function handleCancelScrim(sql, body) {
    const { id } = body
    if (!id) return err('Missing scrim id')

    const [scrim] = await sql`
        SELECT id, status FROM scrim_requests WHERE id = ${Number(id)}
    `
    if (!scrim) return err('Scrim not found', 404)
    if (scrim.status === 'cancelled') return err('Already cancelled')

    await sql`
        UPDATE scrim_requests
        SET status = 'cancelled', updated_at = NOW()
        WHERE id = ${Number(id)}
    `

    return ok({ success: true })
}

async function handleResolveDispute(sql, body) {
    const { id, outcome } = body
    if (!id) return err('Missing scrim id')
    if (!['completed', 'no_show', 'cancelled'].includes(outcome)) {
        return err('Invalid outcome — must be completed, no_show, or cancelled')
    }

    const [scrim] = await sql`
        SELECT id, outcome FROM scrim_requests WHERE id = ${Number(id)}
    `
    if (!scrim) return err('Scrim not found', 404)

    if (outcome === 'cancelled') {
        await sql`
            UPDATE scrim_requests
            SET status = 'cancelled', outcome = NULL, outcome_dispute_at = NULL, updated_at = NOW()
            WHERE id = ${Number(id)}
        `
    } else {
        await sql`
            UPDATE scrim_requests
            SET outcome = ${outcome}, outcome_dispute_at = NULL, updated_at = NOW()
            WHERE id = ${Number(id)}
        `
    }

    return ok({ success: true })
}

export const onRequest = adapt(handler)

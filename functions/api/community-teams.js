import { adapt } from '../lib/adapter.js'
import { getDB, headers, adminHeaders, transaction } from '../lib/db.js'
import { requireAuth } from '../lib/auth.js'
import { deleteOpenScrimsForCommunityTeam, getCommunityTeamMemberCount } from '../lib/scrim.js'

function slugify(str) {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'team'
}

function generateInviteCode() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let code = ''
    for (let i = 0; i < 12; i++) {
        code += chars[Math.floor(Math.random() * chars.length)]
    }
    return code
}

const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const sql = getDB()
    const params = event.queryStringParameters || {}
    const { action } = params

    try {
        if (event.httpMethod === 'GET') {
            switch (action) {
                case 'my-teams':
                    return await handleMyTeams(sql, event)
                case 'team':
                    return await handleGetTeam(sql, params)
                case 'browse':
                    return await handleBrowse(sql, params)
                case 'search-users':
                    return await handleSearchUsers(sql, event, params)
                case 'pending':
                    return await handlePending(sql, event)
                case 'pending-count':
                    return await handlePendingCount(sql, event)
                case 'preview-link':
                    return await handlePreviewLink(sql, params)
                case 'divisions-by-tier':
                    return await handleDivisionsByTier(sql, params)
                case 'league-teams':
                    return await handleLeagueTeams(sql, event)
                default:
                    return err(`Unknown action: ${action}`, 400)
            }
        }

        const user = await requireAuth(event)
        if (!user) {
            return { statusCode: 401, headers: adminHeaders, body: JSON.stringify({ error: 'Unauthorized' }) }
        }

        if (event.httpMethod === 'POST') {
            const body = event.body ? JSON.parse(event.body) : {}
            switch (action) {
                case 'create':
                    return await handleCreate(sql, user, body)
                case 'update':
                    return await handleUpdate(sql, user, body)
                case 'invite':
                    return await handleInvite(sql, user, body)
                case 'generate-link':
                    return await handleGenerateLink(sql, user, body)
                case 'join-link':
                    return await handleJoinLink(sql, user, body)
                case 'request':
                    return await handleRequest(sql, user, body)
                case 'respond':
                    return await handleRespond(sql, user, body)
                case 'leave':
                    return await handleLeave(sql, user, body)
                case 'kick':
                    return await handleKick(sql, user, body)
                case 'disband':
                    return await handleDisband(sql, user, body)
                default:
                    return err(`Unknown action: ${action}`, 400)
            }
        }

        return err('Method not allowed', 405)
    } catch (error) {
        console.error('community-teams error:', error)
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) }
    }
}


// ═══════════════════════════════════════════════════
// GET handlers
// ═══════════════════════════════════════════════════

async function handleMyTeams(sql, event) {
    const user = await requireAuth(event)
    if (!user) return err('Unauthorized', 401)

    const teams = await sql`
        SELECT ct.id, ct.name, ct.slug, ct.logo_url, ct.color, ct.skill_tier, ct.owner_user_id, ct.created_at,
               ctm.role, ctm.joined_at,
               (SELECT COUNT(*) FROM community_team_members m WHERE m.team_id = ct.id AND m.status = 'active') AS member_count
        FROM community_team_members ctm
        JOIN community_teams ct ON ct.id = ctm.team_id
        WHERE ctm.user_id = ${user.id} AND ctm.status = 'active'
        ORDER BY ctm.role = 'captain' DESC, ct.name
    `

    // Fetch members for each team
    const teamIds = teams.map(t => t.id)
    let members = []
    if (teamIds.length > 0) {
        members = await sql`
            SELECT ctm.team_id, ctm.user_id, ctm.role,
                   u.discord_username, u.discord_avatar, u.discord_id,
                   p.name AS player_name, p.slug AS player_slug
            FROM community_team_members ctm
            JOIN users u ON u.id = ctm.user_id
            LEFT JOIN players p ON p.id = u.linked_player_id
            WHERE ctm.team_id = ANY(${teamIds}) AND ctm.status = 'active'
            ORDER BY ctm.role = 'captain' DESC, u.discord_username
        `
    }

    const membersByTeam = {}
    for (const m of members) {
        if (!membersByTeam[m.team_id]) membersByTeam[m.team_id] = []
        membersByTeam[m.team_id].push(m)
    }

    const enriched = teams.map(t => ({
        ...t,
        members: membersByTeam[t.id] || [],
    }))

    return ok({ teams: enriched })
}

async function handleGetTeam(sql, params) {
    const { id, slug } = params
    if (!id && !slug) return err('id or slug required', 400)

    const [team] = id
        ? await sql`SELECT * FROM community_teams WHERE id = ${Number(id)}`
        : await sql`SELECT * FROM community_teams WHERE slug = ${slug}`
    if (!team) return err('Team not found', 404)

    const members = await sql`
        SELECT ctm.id, ctm.user_id, ctm.role, ctm.joined_at,
               u.discord_username, u.discord_avatar, u.discord_id,
               p.name AS player_name, p.slug AS player_slug
        FROM community_team_members ctm
        JOIN users u ON u.id = ctm.user_id
        LEFT JOIN players p ON p.id = u.linked_player_id
        WHERE ctm.team_id = ${team.id} AND ctm.status = 'active'
        ORDER BY ctm.role = 'captain' DESC, ctm.joined_at
    `
    return ok({ team, members })
}

async function handleBrowse(sql, params) {
    const { tier } = params
    const tierFilter = tier ? sql`AND ct.skill_tier = ${Number(tier)}` : sql``

    const teams = await sql`
        SELECT ct.id, ct.name, ct.slug, ct.logo_url, ct.color, ct.skill_tier, ct.created_at,
               u.discord_username AS owner_name,
               (SELECT COUNT(*) FROM community_team_members m WHERE m.team_id = ct.id AND m.status = 'active') AS member_count
        FROM community_teams ct
        JOIN users u ON u.id = ct.owner_user_id
        WHERE 1=1 ${tierFilter}
        ORDER BY ct.created_at DESC
        LIMIT 100
    `
    return ok({ teams })
}

async function handleSearchUsers(sql, event, params) {
    const user = await requireAuth(event)
    if (!user) return err('Unauthorized', 401)

    const q = (params.q || '').trim()
    if (q.length < 2) return ok({ users: [] })

    const pattern = `%${q}%`
    const users = await sql`
        SELECT DISTINCT u.id, u.discord_username, u.discord_avatar, u.discord_id,
               p.name AS player_name, p.slug AS player_slug
        FROM users u
        LEFT JOIN players p ON p.id = u.linked_player_id
        WHERE (u.discord_username ILIKE ${pattern} OR p.name ILIKE ${pattern})
          AND u.id != ${user.id}
        ORDER BY u.discord_username
        LIMIT 20
    `
    return ok({ users })
}

async function handlePending(sql, event) {
    const user = await requireAuth(event)
    if (!user) return err('Unauthorized', 401)

    // Invites sent TO this user
    const invites = await sql`
        SELECT cti.id, cti.team_id, cti.type, cti.status, cti.created_at,
               ct.name AS team_name, ct.slug AS team_slug, ct.logo_url AS team_logo, ct.skill_tier,
               u.discord_username AS from_username, u.discord_avatar AS from_avatar, u.discord_id AS from_discord_id
        FROM community_team_invitations cti
        JOIN community_teams ct ON ct.id = cti.team_id
        JOIN users u ON u.id = cti.from_user_id
        WHERE cti.to_user_id = ${user.id} AND cti.status = 'pending' AND cti.type = 'invite'
        ORDER BY cti.created_at DESC
    `

    // Requests sent BY this user
    const outgoingRequests = await sql`
        SELECT cti.id, cti.team_id, cti.type, cti.status, cti.created_at,
               ct.name AS team_name, ct.slug AS team_slug, ct.logo_url AS team_logo, ct.skill_tier
        FROM community_team_invitations cti
        JOIN community_teams ct ON ct.id = cti.team_id
        WHERE cti.from_user_id = ${user.id} AND cti.status = 'pending' AND cti.type = 'request'
        ORDER BY cti.created_at DESC
    `

    // Requests TO teams this user captains
    const captainTeamIds = await sql`
        SELECT team_id FROM community_team_members
        WHERE user_id = ${user.id} AND role = 'captain' AND status = 'active'
    `
    let incomingRequests = []
    if (captainTeamIds.length > 0) {
        const ids = captainTeamIds.map(r => r.team_id)
        incomingRequests = await sql`
            SELECT cti.id, cti.team_id, cti.type, cti.status, cti.created_at,
                   ct.name AS team_name, ct.slug AS team_slug,
                   u.discord_username AS from_username, u.discord_avatar AS from_avatar, u.discord_id AS from_discord_id,
                   p.name AS from_player_name
            FROM community_team_invitations cti
            JOIN community_teams ct ON ct.id = cti.team_id
            JOIN users u ON u.id = cti.from_user_id
            LEFT JOIN players p ON p.id = u.linked_player_id
            WHERE cti.team_id = ANY(${ids}) AND cti.status = 'pending' AND cti.type = 'request'
            ORDER BY cti.created_at DESC
        `
    }

    // Enrich with team members for all referenced teams
    const allTeamIds = [...new Set([
        ...invites.map(i => i.team_id),
        ...outgoingRequests.map(r => r.team_id),
        ...incomingRequests.map(r => r.team_id),
    ])]
    let membersByTeam = {}
    if (allTeamIds.length > 0) {
        const members = await sql`
            SELECT ctm.team_id, ctm.role,
                   u.discord_username, u.discord_avatar, u.discord_id,
                   p.name AS player_name, p.slug AS player_slug
            FROM community_team_members ctm
            JOIN users u ON u.id = ctm.user_id
            LEFT JOIN players p ON p.id = u.linked_player_id
            WHERE ctm.team_id = ANY(${allTeamIds}) AND ctm.status = 'active'
            ORDER BY ctm.role = 'captain' DESC, u.discord_username
        `
        for (const m of members) {
            if (!membersByTeam[m.team_id]) membersByTeam[m.team_id] = []
            membersByTeam[m.team_id].push(m)
        }
    }
    const enrich = (items) => items.map(item => ({ ...item, members: membersByTeam[item.team_id] || [] }))

    return ok({ invites: enrich(invites), outgoingRequests: enrich(outgoingRequests), incomingRequests: enrich(incomingRequests) })
}

async function handlePendingCount(sql, event) {
    const user = await requireAuth(event)
    if (!user) return err('Unauthorized', 401)

    // Count invites to this user + requests to teams they captain
    const [{ count: inviteCount }] = await sql`
        SELECT COUNT(*)::int AS count FROM community_team_invitations
        WHERE to_user_id = ${user.id} AND status = 'pending' AND type = 'invite'
    `
    const captainTeamIds = await sql`
        SELECT team_id FROM community_team_members
        WHERE user_id = ${user.id} AND role = 'captain' AND status = 'active'
    `
    let requestCount = 0
    if (captainTeamIds.length > 0) {
        const ids = captainTeamIds.map(r => r.team_id)
        const [{ count }] = await sql`
            SELECT COUNT(*)::int AS count FROM community_team_invitations
            WHERE team_id = ANY(${ids}) AND status = 'pending' AND type = 'request'
        `
        requestCount = count
    }

    return ok({ count: inviteCount + requestCount })
}

async function handleDivisionsByTier(sql, params) {
    const { tier } = params
    if (!tier) return err('tier required', 400)

    const divisions = await sql`
        SELECT d.id, d.name, d.slug, d.tier, d.description,
               l.name AS league_name, l.slug AS league_slug,
               s.name AS season_name, s.is_active
        FROM divisions d
        JOIN leagues l ON l.id = d.league_id
        LEFT JOIN seasons s ON s.division_id = d.id AND s.is_active = true
        WHERE d.tier = ${Number(tier)}
        ORDER BY l.name, d.name
    `
    return ok({ divisions })
}

async function handleLeagueTeams(sql, event) {
    const user = await requireAuth(event)
    if (!user) return err('Unauthorized', 401)

    const teams = await sql`
        SELECT lp.team_id AS id, t.name, t.slug, t.logo_url, t.color,
               lp.roster_status AS role, lp.is_active,
               t.season_id, s.name AS season_name,
               d.name AS division_name, d.tier AS division_tier, d.slug AS division_slug,
               l.id AS league_id, l.name AS league_name, l.slug AS league_slug
        FROM league_players lp
        JOIN teams t ON t.id = lp.team_id
        JOIN seasons s ON s.id = t.season_id
        JOIN divisions d ON d.id = s.division_id
        JOIN leagues l ON l.id = s.league_id
        WHERE lp.player_id = (SELECT linked_player_id FROM users WHERE id = ${user.id})
          AND lp.is_active = true AND s.is_active = true
        ORDER BY lp.roster_status = 'captain' DESC, l.name, d.tier
    `

    // Fetch member counts + members for each team
    const teamIds = teams.map(t => t.id)
    let members = []
    if (teamIds.length > 0) {
        members = await sql`
            SELECT lp.team_id, lp.roster_status, p.name AS player_name, p.slug AS player_slug,
                   u.discord_username, u.discord_avatar, u.discord_id
            FROM league_players lp
            JOIN players p ON p.id = lp.player_id
            LEFT JOIN users u ON u.linked_player_id = p.id
            WHERE lp.team_id = ANY(${teamIds}) AND lp.is_active = true
              AND lp.roster_status IN ('captain', 'member')
            ORDER BY lp.roster_status = 'captain' DESC, p.name
        `
    }

    const membersByTeam = {}
    for (const m of members) {
        if (!membersByTeam[m.team_id]) membersByTeam[m.team_id] = []
        membersByTeam[m.team_id].push(m)
    }

    const enriched = teams.map(t => ({
        ...t,
        member_count: (membersByTeam[t.id] || []).length,
        members: membersByTeam[t.id] || [],
        is_league: true,
    }))

    return ok({ teams: enriched })
}


// ═══════════════════════════════════════════════════
// POST handlers
// ═══════════════════════════════════════════════════

async function handleCreate(sql, user, body) {
    const name = (body.name || '').trim()
    if (name.length < 2 || name.length > 50) {
        return postErr('Team name must be 2-50 characters')
    }
    const skillTier = Number(body.skill_tier)
    if (!skillTier || skillTier < 1 || skillTier > 5) {
        return postErr('Skill tier must be 1-5')
    }

    // Check user doesn't already captain a community team
    const [existingCaptain] = await sql`
        SELECT ct.name FROM community_team_members ctm
        JOIN community_teams ct ON ct.id = ctm.team_id
        WHERE ctm.user_id = ${user.id} AND ctm.role = 'captain' AND ctm.status = 'active'
    `
    if (existingCaptain) {
        return postErr(`You already captain "${existingCaptain.name}". You can only captain one team.`)
    }

    // Generate unique slug
    let base = slugify(name)
    let slug = base
    let attempt = 1
    while (true) {
        const [existing] = await sql`SELECT 1 FROM community_teams WHERE slug = ${slug}`
        if (!existing) break
        attempt++
        slug = `${base}-${attempt}`
        if (attempt > 20) return postErr('Could not generate a unique slug. Try a different name.')
    }

    const color = (body.color || '#6366f1').match(/^#[0-9a-fA-F]{6}$/) ? body.color : '#6366f1'

    const team = await transaction(async (tx) => {
        const [row] = await tx`
            INSERT INTO community_teams (name, slug, skill_tier, owner_user_id, color)
            VALUES (${name}, ${slug}, ${skillTier}, ${user.id}, ${color})
            RETURNING *
        `
        await tx`
            INSERT INTO community_team_members (team_id, user_id, role, status)
            VALUES (${row.id}, ${user.id}, 'captain', 'active')
        `
        return row
    })

    return postOk({ team })
}

async function handleUpdate(sql, user, body) {
    const teamId = Number(body.team_id)
    if (!teamId) return postErr('team_id required')

    const [captain] = await sql`
        SELECT 1 FROM community_team_members
        WHERE team_id = ${teamId} AND user_id = ${user.id} AND role = 'captain' AND status = 'active'
    `
    if (!captain) return postErr('You are not the captain of this team')

    const updates = {}
    if (body.name !== undefined) {
        const name = (body.name || '').trim()
        if (name.length < 2 || name.length > 50) return postErr('Team name must be 2-50 characters')
        updates.name = name
    }
    if (body.skill_tier !== undefined) {
        const tier = Number(body.skill_tier)
        if (!tier || tier < 1 || tier > 5) return postErr('Skill tier must be 1-5')
        updates.skill_tier = tier
    }
    if (body.color !== undefined) {
        if (!/^#[0-9a-fA-F]{6}$/.test(body.color)) return postErr('Invalid color format')
        updates.color = body.color
    }
    if (Object.keys(updates).length === 0) return postErr('Nothing to update')

    if (updates.name !== undefined) await sql`UPDATE community_teams SET name = ${updates.name}, updated_at = NOW() WHERE id = ${teamId}`
    if (updates.skill_tier !== undefined) await sql`UPDATE community_teams SET skill_tier = ${updates.skill_tier}, updated_at = NOW() WHERE id = ${teamId}`
    if (updates.color !== undefined) await sql`UPDATE community_teams SET color = ${updates.color}, updated_at = NOW() WHERE id = ${teamId}`

    const [team] = await sql`SELECT * FROM community_teams WHERE id = ${teamId}`
    return postOk({ team })
}

async function handleInvite(sql, user, body) {
    const teamId = Number(body.team_id)
    const targetUserId = Number(body.user_id)
    if (!teamId || !targetUserId) return postErr('team_id and user_id required')

    const [captain] = await sql`
        SELECT 1 FROM community_team_members
        WHERE team_id = ${teamId} AND user_id = ${user.id} AND role = 'captain' AND status = 'active'
    `
    if (!captain) return postErr('You are not the captain of this team')

    const [alreadyMember] = await sql`
        SELECT 1 FROM community_team_members
        WHERE team_id = ${teamId} AND user_id = ${targetUserId} AND status = 'active'
    `
    if (alreadyMember) return postErr('User is already a member of this team')

    const [targetUser] = await sql`SELECT id FROM users WHERE id = ${targetUserId}`
    if (!targetUser) return postErr('User not found')

    // Upsert: if a declined invite exists, reset it to pending
    await sql`
        INSERT INTO community_team_invitations (team_id, type, from_user_id, to_user_id, status)
        VALUES (${teamId}, 'invite', ${user.id}, ${targetUserId}, 'pending')
        ON CONFLICT (team_id, to_user_id, type) WHERE status = 'pending' AND to_user_id IS NOT NULL
        DO NOTHING
    `

    return postOk({ success: true })
}

async function handleGenerateLink(sql, user, body) {
    const teamId = Number(body.team_id)
    if (!teamId) return postErr('team_id required')

    const [captain] = await sql`
        SELECT 1 FROM community_team_members
        WHERE team_id = ${teamId} AND user_id = ${user.id} AND role = 'captain' AND status = 'active'
    `
    if (!captain) return postErr('You are not the captain of this team')

    // Check for existing active link invite
    const [existing] = await sql`
        SELECT invite_code FROM community_team_invitations
        WHERE team_id = ${teamId} AND type = 'link' AND status = 'pending'
        LIMIT 1
    `
    if (existing) return postOk({ invite_code: existing.invite_code })

    const code = generateInviteCode()
    await sql`
        INSERT INTO community_team_invitations (team_id, type, from_user_id, invite_code, status)
        VALUES (${teamId}, 'link', ${user.id}, ${code}, 'pending')
    `
    return postOk({ invite_code: code })
}

async function handlePreviewLink(sql, params) {
    const code = (params.code || '').trim()
    if (!code) return err('code required', 400)

    const [invite] = await sql`
        SELECT cti.id, cti.team_id FROM community_team_invitations cti
        WHERE cti.invite_code = ${code} AND cti.type = 'link' AND cti.status = 'pending'
    `
    if (!invite) return err('Invalid or expired invite link', 404)

    const [team] = await sql`
        SELECT id, name, slug, logo_url, color, skill_tier
        FROM community_teams WHERE id = ${invite.team_id}
    `
    if (!team) return err('Team not found', 404)

    const members = await sql`
        SELECT ctm.role, u.discord_username, u.discord_avatar, u.discord_id,
               p.name AS player_name, p.slug AS player_slug
        FROM community_team_members ctm
        JOIN users u ON u.id = ctm.user_id
        LEFT JOIN players p ON p.id = u.linked_player_id
        WHERE ctm.team_id = ${team.id} AND ctm.status = 'active'
        ORDER BY ctm.role = 'captain' DESC, u.discord_username
    `

    return ok({ team: { ...team, members } })
}

async function handleJoinLink(sql, user, body) {
    const code = (body.code || '').trim()
    if (!code) return postErr('Invite code required')

    const [invite] = await sql`
        SELECT cti.id, cti.team_id FROM community_team_invitations cti
        WHERE cti.invite_code = ${code} AND cti.type = 'link' AND cti.status = 'pending'
    `
    if (!invite) return postErr('Invalid or expired invite link')

    const [alreadyMember] = await sql`
        SELECT 1 FROM community_team_members
        WHERE team_id = ${invite.team_id} AND user_id = ${user.id} AND status = 'active'
    `
    if (alreadyMember) return postErr('You are already a member of this team')

    // Add user as member (upsert in case they left before)
    await sql`
        INSERT INTO community_team_members (team_id, user_id, role, status)
        VALUES (${invite.team_id}, ${user.id}, 'member', 'active')
        ON CONFLICT (team_id, user_id)
        DO UPDATE SET status = 'active', role = 'member', joined_at = NOW()
    `

    const [team] = await sql`SELECT name, slug FROM community_teams WHERE id = ${invite.team_id}`
    return postOk({ success: true, team_name: team?.name, team_slug: team?.slug })
}

async function handleRequest(sql, user, body) {
    const teamId = Number(body.team_id)
    if (!teamId) return postErr('team_id required')

    const [team] = await sql`SELECT id FROM community_teams WHERE id = ${teamId}`
    if (!team) return postErr('Team not found')

    const [alreadyMember] = await sql`
        SELECT 1 FROM community_team_members
        WHERE team_id = ${teamId} AND user_id = ${user.id} AND status = 'active'
    `
    if (alreadyMember) return postErr('You are already a member of this team')

    await sql`
        INSERT INTO community_team_invitations (team_id, type, from_user_id, to_user_id, status)
        VALUES (${teamId}, 'request', ${user.id}, ${user.id}, 'pending')
        ON CONFLICT (team_id, to_user_id, type) WHERE status = 'pending' AND to_user_id IS NOT NULL
        DO NOTHING
    `

    return postOk({ success: true })
}

async function handleRespond(sql, user, body) {
    const invitationId = Number(body.invitation_id)
    const accept = body.accept === true
    if (!invitationId) return postErr('invitation_id required')

    const [invite] = await sql`
        SELECT * FROM community_team_invitations WHERE id = ${invitationId} AND status = 'pending'
    `
    if (!invite) return postErr('Invitation not found or already responded')

    // For invite type: only the target user can respond
    if (invite.type === 'invite') {
        if (invite.to_user_id !== user.id) return postErr('You cannot respond to this invitation')
    }
    // For request type: only the team captain can respond
    if (invite.type === 'request') {
        const [captain] = await sql`
            SELECT 1 FROM community_team_members
            WHERE team_id = ${invite.team_id} AND user_id = ${user.id} AND role = 'captain' AND status = 'active'
        `
        if (!captain) return postErr('Only the team captain can respond to join requests')
    }

    if (accept) {
        const joiningUserId = invite.type === 'invite' ? invite.to_user_id : invite.from_user_id

        await transaction(async (tx) => {
            await tx`
                UPDATE community_team_invitations
                SET status = 'accepted', responded_at = NOW()
                WHERE id = ${invitationId}
            `
            await tx`
                INSERT INTO community_team_members (team_id, user_id, role, status)
                VALUES (${invite.team_id}, ${joiningUserId}, 'member', 'active')
                ON CONFLICT (team_id, user_id)
                DO UPDATE SET status = 'active', role = 'member', joined_at = NOW()
            `
        })
    } else {
        await sql`
            UPDATE community_team_invitations
            SET status = 'declined', responded_at = NOW()
            WHERE id = ${invitationId}
        `
    }

    return postOk({ success: true })
}

async function handleLeave(sql, user, body) {
    const teamId = Number(body.team_id)
    if (!teamId) return postErr('team_id required')

    const [membership] = await sql`
        SELECT role FROM community_team_members
        WHERE team_id = ${teamId} AND user_id = ${user.id} AND status = 'active'
    `
    if (!membership) return postErr('You are not a member of this team')
    if (membership.role === 'captain') return postErr('Captains cannot leave. Disband the team instead.')

    await sql`
        UPDATE community_team_members
        SET status = 'left'
        WHERE team_id = ${teamId} AND user_id = ${user.id}
    `

    // If team drops below minimum, delete their open scrim requests
    const count = await getCommunityTeamMemberCount(sql, teamId)
    let scrimsDeleted = 0
    if (count < 5) {
        scrimsDeleted = await deleteOpenScrimsForCommunityTeam(sql, teamId)
    }

    return postOk({ success: true, scrimsDeleted })
}

async function handleKick(sql, user, body) {
    const teamId = Number(body.team_id)
    const targetUserId = Number(body.user_id)
    if (!teamId || !targetUserId) return postErr('team_id and user_id required')

    // Verify caller is captain
    const [captain] = await sql`
        SELECT 1 FROM community_team_members
        WHERE team_id = ${teamId} AND user_id = ${user.id} AND role = 'captain' AND status = 'active'
    `
    if (!captain) return postErr('Only the team captain can kick members')

    // Cannot kick yourself
    if (targetUserId === user.id) return postErr('Cannot kick yourself')

    // Verify target is an active member
    const [target] = await sql`
        SELECT role FROM community_team_members
        WHERE team_id = ${teamId} AND user_id = ${targetUserId} AND status = 'active'
    `
    if (!target) return postErr('User is not an active member of this team')
    if (target.role === 'captain') return postErr('Cannot kick the captain')

    await sql`
        UPDATE community_team_members
        SET status = 'left'
        WHERE team_id = ${teamId} AND user_id = ${targetUserId}
    `

    // If team drops below minimum, delete their open scrim requests
    const count = await getCommunityTeamMemberCount(sql, teamId)
    let scrimsDeleted = 0
    if (count < 5) {
        scrimsDeleted = await deleteOpenScrimsForCommunityTeam(sql, teamId)
    }

    return postOk({ success: true, scrimsDeleted })
}

async function handleDisband(sql, user, body) {
    const teamId = Number(body.team_id)
    if (!teamId) return postErr('team_id required')

    const [team] = await sql`
        SELECT id, owner_user_id FROM community_teams WHERE id = ${teamId}
    `
    if (!team) return postErr('Team not found')
    if (team.owner_user_id !== user.id) return postErr('Only the team owner can disband')

    // Clean up open scrim requests before deleting team (no FK to cascade)
    await deleteOpenScrimsForCommunityTeam(sql, teamId)

    await sql`DELETE FROM community_teams WHERE id = ${teamId}`
    return postOk({ success: true })
}


// ═══════════════════════════════════════════════════
// Response helpers
// ═══════════════════════════════════════════════════

function ok(data) {
    return { statusCode: 200, headers, body: JSON.stringify(data) }
}

function err(message, status = 400) {
    return { statusCode: status, headers, body: JSON.stringify({ error: message }) }
}

function postOk(data) {
    return { statusCode: 200, headers: adminHeaders, body: JSON.stringify(data) }
}

function postErr(message, status = 400) {
    return { statusCode: status, headers: adminHeaders, body: JSON.stringify({ error: message }) }
}


export const onRequest = adapt(handler)

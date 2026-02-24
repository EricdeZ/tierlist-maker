import { adapt } from '../lib/adapter.js'
import { getDB, headers, adminHeaders } from '../lib/db.js'
import { requireAuth, requirePermission } from '../lib/auth.js'
import { sendDM } from '../lib/discord.js'

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
                case 'list':
                    return await listScrims(sql, params)
                case 'my-scrims':
                    return await getMyScrims(sql, event)
                case 'incoming':
                    return await getIncoming(sql, event)
                case 'captain-teams':
                    return await getCaptainTeamsAction(sql, event)
                case 'all-teams':
                    return await getAllActiveTeams(sql)
                case 'team-reliability':
                    return await getTeamReliability(sql, params)
                case 'blacklist':
                    return await getBlacklist(sql, event)
                case 'search-users':
                    return await searchUsers(sql, event, params)
                default:
                    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
            }
        }

        // POST requires auth
        const user = await requireAuth(event)
        if (!user) {
            return { statusCode: 401, headers: adminHeaders, body: JSON.stringify({ error: 'Unauthorized' }) }
        }

        if (event.httpMethod === 'POST') {
            const body = event.body ? JSON.parse(event.body) : {}

            switch (action) {
                case 'create':
                    return await createScrim(sql, user, body)
                case 'accept':
                    return await acceptScrim(sql, user, body, event.waitUntil)
                case 'cancel':
                    return await cancelScrim(sql, user, body)
                case 'decline':
                    return await declineScrim(sql, user, body)
                case 'report-outcome':
                    return await reportOutcome(sql, user, body)
                case 'dispute-outcome':
                    return await disputeOutcome(sql, user, body)
                case 'blacklist-add':
                    return await addToBlacklist(sql, user, body)
                case 'blacklist-remove':
                    return await removeFromBlacklist(sql, user, body)
                default:
                    return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
            }
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    } catch (error) {
        console.error('scrim error:', error)
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) }
    }
}


// ═══════════════════════════════════════════════════
// Helper: Get teams where user is an active captain
// ═══════════════════════════════════════════════════
async function getCaptainTeams(sql, userId) {
    return sql`
        SELECT lp.team_id, t.name as team_name, t.slug as team_slug, t.logo_url as team_logo, t.color as team_color,
               t.season_id, s.name as season_name,
               d.name as division_name, d.tier as division_tier, d.slug as division_slug,
               l.id as league_id, l.name as league_name, l.slug as league_slug
        FROM league_players lp
        JOIN teams t ON t.id = lp.team_id
        JOIN seasons s ON s.id = t.season_id
        JOIN divisions d ON d.id = s.division_id
        JOIN leagues l ON l.id = s.league_id
        WHERE lp.player_id = (SELECT linked_player_id FROM users WHERE id = ${userId})
          AND lp.is_captain = true AND lp.is_active = true AND s.is_active = true
    `
}


// ═══════════════════════════════════════════════════
// Helper: Get all teams where user is an active member
// ═══════════════════════════════════════════════════
async function getMyTeams(sql, userId) {
    return sql`
        SELECT lp.team_id, t.name as team_name, t.slug as team_slug, t.logo_url as team_logo, t.color as team_color,
               t.season_id, s.name as season_name,
               d.name as division_name, d.tier as division_tier, d.slug as division_slug,
               l.id as league_id, l.name as league_name, l.slug as league_slug
        FROM league_players lp
        JOIN teams t ON t.id = lp.team_id
        JOIN seasons s ON s.id = t.season_id
        JOIN divisions d ON d.id = s.division_id
        JOIN leagues l ON l.id = s.league_id
        WHERE lp.player_id = (SELECT linked_player_id FROM users WHERE id = ${userId})
          AND lp.is_active = true AND s.is_active = true
    `
}


// ═══════════════════════════════════════════════════
// Helper: Check if user has scrim_manage permission
// ═══════════════════════════════════════════════════
async function hasScrimManagePermission(sql, userId) {
    const [has] = await sql`
        SELECT 1 FROM user_roles ur
        JOIN role_permissions rp ON rp.role_id = ur.role_id
        WHERE ur.user_id = ${userId}
          AND rp.permission_key = 'scrim_manage'
        LIMIT 1
    `
    return !!has
}


// ═══════════════════════════════════════════════════
// Helper: Get all active teams (for scrim_manage users)
// ═══════════════════════════════════════════════════
async function getAllActiveTeamsForScrimManage(sql) {
    return sql`
        SELECT t.id as team_id, t.name as team_name, t.slug as team_slug, t.logo_url as team_logo, t.color as team_color,
               t.season_id, s.name as season_name,
               d.name as division_name, d.tier as division_tier, d.slug as division_slug,
               l.id as league_id, l.name as league_name, l.slug as league_slug
        FROM teams t
        JOIN seasons s ON s.id = t.season_id
        JOIN divisions d ON d.id = s.division_id
        JOIN leagues l ON l.id = s.league_id
        WHERE s.is_active = true
        ORDER BY l.name, d.tier NULLS LAST, t.name
    `
}


// ═══════════════════════════════════════════════════
// Helper: Get eligible teams (captain OR scrim_manage)
// ═══════════════════════════════════════════════════
async function getEligibleTeams(sql, userId) {
    const captainTeams = await getCaptainTeams(sql, userId)
    const hasPermission = await hasScrimManagePermission(sql, userId)

    if (!hasPermission) return captainTeams

    // scrim_manage users get all active teams
    const allTeams = await getAllActiveTeamsForScrimManage(sql)
    const seen = new Set(captainTeams.map(t => t.team_id))
    for (const t of allTeams) {
        if (!seen.has(t.team_id)) {
            captainTeams.push(t)
            seen.add(t.team_id)
        }
    }
    return captainTeams
}


// ═══════════════════════════════════════════════════
// Shared: scrim list query with team/league/division joins
// ═══════════════════════════════════════════════════
const SCRIM_SELECT = `
    sr.id, sr.team_id, sr.user_id, sr.challenged_team_id,
    sr.scheduled_date, sr.pick_mode, sr.banned_content_league,
    sr.notes, sr.status, sr.acceptable_tiers, sr.accepted_team_id, sr.accepted_user_id,
    sr.accepted_at, sr.created_at, sr.updated_at,
    sr.outcome, sr.outcome_reported_by, sr.outcome_reported_at,
    sr.outcome_disputed, sr.outcome_dispute_deadline,
    t.name as team_name, t.slug as team_slug, t.logo_url as team_logo, t.color as team_color,
    d.name as division_name, d.tier as division_tier,
    l.name as league_name, l.slug as league_slug,
    u.discord_username as posted_by
`

function formatScrim(row) {
    return {
        id: row.id,
        userId: row.user_id,
        teamId: row.team_id,
        teamName: row.team_name,
        teamSlug: row.team_slug,
        teamLogo: row.team_logo,
        teamColor: row.team_color,
        divisionName: row.division_name,
        divisionTier: row.division_tier,
        divisionSlug: row.division_slug || null,
        leagueName: row.league_name,
        leagueSlug: row.league_slug,
        postedBy: row.posted_by,
        challengedTeamId: row.challenged_team_id,
        challengedTeamName: row.challenged_team_name || null,
        challengedTeamSlug: row.challenged_team_slug || null,
        challengedTeamLogo: row.challenged_team_logo || null,
        challengedTeamColor: row.challenged_team_color || null,
        challengedDivisionName: row.challenged_division_name || null,
        challengedDivisionSlug: row.challenged_division_slug || null,
        challengedLeagueName: row.challenged_league_name || null,
        scheduledDate: row.scheduled_date,
        pickMode: row.pick_mode,
        bannedContentLeague: row.banned_content_league,
        notes: row.notes,
        status: row.status,
        acceptedTeamId: row.accepted_team_id,
        acceptedTeamName: row.accepted_team_name || null,
        acceptedTeamSlug: row.accepted_team_slug || null,
        acceptedTeamLogo: row.accepted_team_logo || null,
        acceptedTeamColor: row.accepted_team_color || null,
        acceptedDivisionName: row.accepted_division_name || null,
        acceptedDivisionTier: row.accepted_division_tier || null,
        acceptedDivisionSlug: row.accepted_division_slug || null,
        acceptedLeagueName: row.accepted_league_name || null,
        acceptableTiers: row.acceptable_tiers || null,
        acceptedAt: row.accepted_at,
        createdAt: row.created_at,
        outcome: row.outcome || null,
        outcomeReportedBy: row.outcome_reported_by || null,
        outcomeReportedAt: row.outcome_reported_at || null,
        outcomeDisputed: row.outcome_disputed || false,
        outcomeDisputeDeadline: row.outcome_dispute_deadline || null,
    }
}


// ═══════════════════════════════════════════════════
// GET: List open scrims (public)
// ═══════════════════════════════════════════════════
async function listScrims(sql, params) {
    const { league_id, division_tier } = params

    const filters = []
    if (league_id) filters.push(sql`l.id = ${league_id}`)
    if (division_tier) filters.push(sql`d.tier = ${division_tier}`)

    const where = filters.length > 0
        ? sql`AND ${filters.reduce((a, b) => sql`${a} AND ${b}`)}`
        : sql``

    const scrims = await sql`
        SELECT
            sr.id, sr.team_id, sr.user_id, sr.challenged_team_id,
            sr.scheduled_date, sr.pick_mode, sr.banned_content_league,
            sr.notes, sr.status, sr.acceptable_tiers, sr.accepted_team_id, sr.accepted_user_id,
            sr.accepted_at, sr.created_at, sr.updated_at,
            t.name as team_name, t.slug as team_slug, t.logo_url as team_logo, t.color as team_color,
            d.name as division_name, d.tier as division_tier, d.slug as division_slug,
            l.name as league_name, l.slug as league_slug,
            u.discord_username as posted_by,
            ct.name as challenged_team_name, ct.slug as challenged_team_slug,
            ct.logo_url as challenged_team_logo, ct.color as challenged_team_color,
            cd.name as challenged_division_name, cd.slug as challenged_division_slug,
            cl.name as challenged_league_name
        FROM scrim_requests sr
        JOIN teams t ON t.id = sr.team_id
        JOIN seasons s ON s.id = t.season_id
        JOIN divisions d ON d.id = s.division_id
        JOIN leagues l ON l.id = s.league_id
        JOIN users u ON u.id = sr.user_id
        LEFT JOIN teams ct ON ct.id = sr.challenged_team_id
        LEFT JOIN seasons cs ON cs.id = ct.season_id
        LEFT JOIN divisions cd ON cd.id = cs.division_id
        LEFT JOIN leagues cl ON cl.id = cs.league_id
        WHERE sr.status = 'open'
          AND sr.scheduled_date > NOW()
          AND sr.challenged_team_id IS NULL
          ${where}
        ORDER BY sr.scheduled_date ASC
    `

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ scrims: scrims.map(formatScrim) }),
    }
}


// ═══════════════════════════════════════════════════
// GET: User's team scrims (auth required)
// ═══════════════════════════════════════════════════
async function getMyScrims(sql, event) {
    const user = await requireAuth(event)
    if (!user) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const [captainTeams, myTeams] = await Promise.all([
        getEligibleTeams(sql, user.id),
        getMyTeams(sql, user.id),
    ])

    // Merge captain + member team IDs for querying scrims
    const allTeamIdSet = new Set([
        ...captainTeams.map(t => t.team_id),
        ...myTeams.map(t => t.team_id),
    ])
    const teamIds = [...allTeamIdSet]

    if (teamIds.length === 0) {
        return { statusCode: 200, headers, body: JSON.stringify({ scrims: [], captainTeams: [], myTeams: [] }) }
    }

    const scrims = await sql`
        SELECT
            sr.id, sr.team_id, sr.user_id, sr.challenged_team_id,
            sr.scheduled_date, sr.pick_mode, sr.banned_content_league,
            sr.notes, sr.status, sr.acceptable_tiers, sr.accepted_team_id, sr.accepted_user_id,
            sr.accepted_at, sr.created_at, sr.updated_at,
            sr.outcome, sr.outcome_reported_by, sr.outcome_reported_at,
            sr.outcome_disputed, sr.outcome_dispute_deadline,
            t.name as team_name, t.slug as team_slug, t.logo_url as team_logo, t.color as team_color,
            d.name as division_name, d.tier as division_tier, d.slug as division_slug,
            l.name as league_name, l.slug as league_slug,
            u.discord_username as posted_by,
            ct.name as challenged_team_name, ct.slug as challenged_team_slug,
            ct.logo_url as challenged_team_logo, ct.color as challenged_team_color,
            cd.name as challenged_division_name, cd.slug as challenged_division_slug,
            cl.name as challenged_league_name,
            at2.name as accepted_team_name, at2.slug as accepted_team_slug,
            at2.logo_url as accepted_team_logo, at2.color as accepted_team_color,
            ad.name as accepted_division_name, ad.tier as accepted_division_tier, ad.slug as accepted_division_slug,
            al.name as accepted_league_name
        FROM scrim_requests sr
        JOIN teams t ON t.id = sr.team_id
        JOIN seasons s ON s.id = t.season_id
        JOIN divisions d ON d.id = s.division_id
        JOIN leagues l ON l.id = s.league_id
        JOIN users u ON u.id = sr.user_id
        LEFT JOIN teams ct ON ct.id = sr.challenged_team_id
        LEFT JOIN seasons cs ON cs.id = ct.season_id
        LEFT JOIN divisions cd ON cd.id = cs.division_id
        LEFT JOIN leagues cl ON cl.id = cs.league_id
        LEFT JOIN teams at2 ON at2.id = sr.accepted_team_id
        LEFT JOIN seasons as2 ON as2.id = at2.season_id
        LEFT JOIN divisions ad ON ad.id = as2.division_id
        LEFT JOIN leagues al ON al.id = as2.league_id
        WHERE sr.team_id = ANY(${teamIds})
           OR sr.challenged_team_id = ANY(${teamIds})
           OR sr.accepted_team_id = ANY(${teamIds})
        ORDER BY sr.scheduled_date DESC
    `

    // Fetch blacklist data for client-side filtering
    const [blockedByMe, blockedMe] = await Promise.all([
        sql`SELECT team_id, blocked_team_id FROM scrim_blacklist WHERE team_id = ANY(${teamIds})`,
        sql`SELECT team_id, blocked_team_id FROM scrim_blacklist WHERE blocked_team_id = ANY(${teamIds})`,
    ])

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            scrims: scrims.map(formatScrim),
            captainTeams: captainTeams.map(t => ({
                teamId: t.team_id,
                teamName: t.team_name,
                teamSlug: t.team_slug,
                teamLogo: t.team_logo,
                teamColor: t.team_color,
                divisionName: t.division_name,
                divisionTier: t.division_tier,
                leagueName: t.league_name,
                leagueSlug: t.league_slug,
            })),
            myTeams: myTeams.map(t => ({
                teamId: t.team_id,
                teamName: t.team_name,
                teamSlug: t.team_slug,
                teamLogo: t.team_logo,
                divisionName: t.division_name,
                divisionTier: t.division_tier,
                leagueName: t.league_name,
                leagueSlug: t.league_slug,
            })),
            blockedByMe: blockedByMe.map(b => ({ teamId: b.team_id, blockedTeamId: b.blocked_team_id })),
            blockedMe: blockedMe.map(b => ({ teamId: b.team_id, blockedTeamId: b.blocked_team_id })),
        }),
    }
}


// ═══════════════════════════════════════════════════
// GET: Incoming challenges for user's captain teams
// ═══════════════════════════════════════════════════
async function getIncoming(sql, event) {
    const user = await requireAuth(event)
    if (!user) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const captainTeams = await getEligibleTeams(sql, user.id)
    if (captainTeams.length === 0) {
        return { statusCode: 200, headers, body: JSON.stringify({ scrims: [] }) }
    }

    const teamIds = captainTeams.map(t => t.team_id)

    const scrims = await sql`
        SELECT
            sr.id, sr.team_id, sr.user_id, sr.challenged_team_id,
            sr.scheduled_date, sr.pick_mode, sr.banned_content_league,
            sr.notes, sr.status, sr.acceptable_tiers, sr.accepted_team_id, sr.accepted_user_id,
            sr.accepted_at, sr.created_at, sr.updated_at,
            t.name as team_name, t.slug as team_slug, t.logo_url as team_logo, t.color as team_color,
            d.name as division_name, d.tier as division_tier, d.slug as division_slug,
            l.name as league_name, l.slug as league_slug,
            u.discord_username as posted_by,
            ct.name as challenged_team_name, ct.slug as challenged_team_slug,
            ct.logo_url as challenged_team_logo, ct.color as challenged_team_color,
            cd.name as challenged_division_name, cd.slug as challenged_division_slug,
            cl.name as challenged_league_name
        FROM scrim_requests sr
        JOIN teams t ON t.id = sr.team_id
        JOIN seasons s ON s.id = t.season_id
        JOIN divisions d ON d.id = s.division_id
        JOIN leagues l ON l.id = s.league_id
        JOIN users u ON u.id = sr.user_id
        LEFT JOIN teams ct ON ct.id = sr.challenged_team_id
        LEFT JOIN seasons cs ON cs.id = ct.season_id
        LEFT JOIN divisions cd ON cd.id = cs.division_id
        LEFT JOIN leagues cl ON cl.id = cs.league_id
        WHERE sr.challenged_team_id = ANY(${teamIds})
          AND sr.status = 'open'
          AND sr.scheduled_date > NOW()
        ORDER BY sr.scheduled_date ASC
    `

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ scrims: scrims.map(formatScrim) }),
    }
}


// ═══════════════════════════════════════════════════
// GET: User's captain teams (auth required)
// ═══════════════════════════════════════════════════
async function getCaptainTeamsAction(sql, event) {
    const user = await requireAuth(event)
    if (!user) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const teams = await getEligibleTeams(sql, user.id)

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            captainTeams: teams.map(t => ({
                teamId: t.team_id,
                teamName: t.team_name,
                teamSlug: t.team_slug,
                teamLogo: t.team_logo,
                teamColor: t.team_color,
                divisionName: t.division_name,
                divisionTier: t.division_tier,
                divisionSlug: t.division_slug,
                leagueName: t.league_name,
                leagueSlug: t.league_slug,
            })),
        }),
    }
}


// ═══════════════════════════════════════════════════
// GET: All active teams (for challenge team picker)
// ═══════════════════════════════════════════════════
async function getAllActiveTeams(sql) {
    const teams = await sql`
        SELECT t.id, t.name, t.slug, t.logo_url, t.color,
               d.name as division_name, d.tier as division_tier,
               l.name as league_name, l.slug as league_slug
        FROM teams t
        JOIN seasons s ON s.id = t.season_id
        JOIN divisions d ON d.id = s.division_id
        JOIN leagues l ON l.id = s.league_id
        WHERE s.is_active = true
        ORDER BY l.name, d.tier NULLS LAST, t.name
    `

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            teams: teams.map(t => ({
                id: t.id,
                name: t.name,
                slug: t.slug,
                logoUrl: t.logo_url,
                color: t.color,
                divisionName: t.division_name,
                divisionTier: t.division_tier,
                leagueName: t.league_name,
                leagueSlug: t.league_slug,
            })),
        }),
    }
}


// ═══════════════════════════════════════════════════
// POST: Create a scrim request
// ═══════════════════════════════════════════════════
async function createScrim(sql, user, body) {
    const { team_id, scheduled_date, pick_mode, banned_content_league, notes, challenged_team_id, acceptable_tiers } = body

    if (!team_id || !scheduled_date) {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'team_id and scheduled_date are required' }) }
    }

    const validModes = ['regular', 'fearless', 'fearless_picks', 'fearless_bans']
    if (pick_mode && !validModes.includes(pick_mode)) {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: `Invalid pick_mode. Must be one of: ${validModes.join(', ')}` }) }
    }

    // Verify user is captain or has scrim_manage permission
    const captainTeams = await getEligibleTeams(sql, user.id)
    const isEligible = captainTeams.some(t => t.team_id === team_id)
    if (!isEligible) {
        return { statusCode: 403, headers: adminHeaders, body: JSON.stringify({ error: 'You are not a captain of this team' }) }
    }

    // Validate scheduled_date is in the future
    if (new Date(scheduled_date) <= new Date()) {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'Scheduled date must be in the future' }) }
    }

    // If challenging a specific team, validate it exists and is different
    if (challenged_team_id) {
        if (challenged_team_id === team_id) {
            return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'Cannot challenge your own team' }) }
        }
        const [target] = await sql`
            SELECT t.id FROM teams t
            JOIN seasons s ON s.id = t.season_id
            WHERE t.id = ${challenged_team_id} AND s.is_active = true
        `
        if (!target) {
            return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'Challenged team not found or not in an active season' }) }
        }

        // Check blacklist in both directions for direct challenges
        const [isBlocked] = await sql`
            SELECT 1 FROM scrim_blacklist
            WHERE (team_id = ${team_id} AND blocked_team_id = ${challenged_team_id})
               OR (team_id = ${challenged_team_id} AND blocked_team_id = ${team_id})
            LIMIT 1
        `
        if (isBlocked) {
            return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'Cannot challenge this team (blacklisted)' }) }
        }
    }

    // Validate acceptable_tiers if provided
    if (acceptable_tiers) {
        if (!Array.isArray(acceptable_tiers) || !acceptable_tiers.every(t => Number.isInteger(t) && t >= 1 && t <= 5)) {
            return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'acceptable_tiers must be an array of integers 1-5' }) }
        }
    }

    const [created] = await sql`
        INSERT INTO scrim_requests (team_id, user_id, challenged_team_id, scheduled_date, pick_mode, banned_content_league, notes, acceptable_tiers)
        VALUES (${team_id}, ${user.id}, ${challenged_team_id || null}, ${scheduled_date}, ${pick_mode || 'regular'}, ${banned_content_league || null}, ${notes || null}, ${acceptable_tiers ? JSON.stringify(acceptable_tiers) : null})
        RETURNING id, status, created_at
    `

    return {
        statusCode: 200,
        headers: adminHeaders,
        body: JSON.stringify({ success: true, scrim: created }),
    }
}


// ═══════════════════════════════════════════════════
// POST: Accept a scrim request
// ═══════════════════════════════════════════════════
async function acceptScrim(sql, user, body, waitUntil) {
    const { scrim_id, team_id } = body

    if (!scrim_id || !team_id) {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'scrim_id and team_id are required' }) }
    }

    // Verify user is captain or has scrim_manage permission
    const captainTeams = await getEligibleTeams(sql, user.id)
    const isEligible = captainTeams.some(t => t.team_id === team_id)
    if (!isEligible) {
        return { statusCode: 403, headers: adminHeaders, body: JSON.stringify({ error: 'You are not a captain of this team' }) }
    }

    // Get the scrim
    const [scrim] = await sql`
        SELECT id, team_id, challenged_team_id, status, scheduled_date
        FROM scrim_requests WHERE id = ${scrim_id}
    `
    if (!scrim) {
        return { statusCode: 404, headers: adminHeaders, body: JSON.stringify({ error: 'Scrim request not found' }) }
    }
    if (scrim.status !== 'open') {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'This scrim is no longer open' }) }
    }
    if (new Date(scrim.scheduled_date) <= new Date()) {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'This scrim has expired' }) }
    }
    if (scrim.team_id === team_id) {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'Cannot accept your own scrim request' }) }
    }
    // If it's a direct challenge, only the challenged team can accept
    if (scrim.challenged_team_id && scrim.challenged_team_id !== team_id) {
        return { statusCode: 403, headers: adminHeaders, body: JSON.stringify({ error: 'This challenge was not sent to your team' }) }
    }

    // Check blacklist: if posting team has blocked accepting team
    const [blocked] = await sql`
        SELECT 1 FROM scrim_blacklist
        WHERE team_id = ${scrim.team_id} AND blocked_team_id = ${team_id}
        LIMIT 1
    `
    if (blocked) {
        return { statusCode: 403, headers: adminHeaders, body: JSON.stringify({ error: 'This team has blocked you from accepting their scrims' }) }
    }

    const [updated] = await sql`
        UPDATE scrim_requests
        SET status = 'accepted', accepted_team_id = ${team_id}, accepted_user_id = ${user.id},
            accepted_at = NOW(), updated_at = NOW()
        WHERE id = ${scrim_id} AND status = 'open'
        RETURNING id, status, accepted_at
    `

    if (!updated) {
        return { statusCode: 409, headers: adminHeaders, body: JSON.stringify({ error: 'Scrim was already accepted or cancelled' }) }
    }

    // DM both captains — register with waitUntil so CF doesn't kill the context before it finishes
    waitUntil(notifyScrimAccepted(sql, scrim_id, team_id).catch(() => {}))

    return {
        statusCode: 200,
        headers: adminHeaders,
        body: JSON.stringify({ success: true, scrim: updated }),
    }
}


// ═══════════════════════════════════════════════════
// Helper: DM both captains when a scrim is accepted
// ═══════════════════════════════════════════════════
const RANK_LABELS = { 1: 'Deity', 2: 'Demigod', 3: 'Master', 4: 'Obsidian', 5: 'Diamond' }
const PICK_MODE_LABELS = { regular: 'Regular', fearless: 'Fearless', fearless_picks: 'Fearless Picks', fearless_bans: 'Fearless Bans' }

function formatDateEST(date) {
    return new Date(date).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        weekday: 'short', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
    }) + ' EST'
}

async function notifyScrimAccepted(sql, scrimId, accepterTeamId) {
    try {
        const [row] = await sql`
            SELECT
                sr.scheduled_date, sr.pick_mode, sr.banned_content_league, sr.notes,
                pt.name AS poster_team, pd.name AS poster_div, pd.tier AS poster_tier, pl.name AS poster_league,
                pu.discord_id AS poster_discord_id,
                at2.name AS accepter_team, ad.name AS accepter_div, ad.tier AS accepter_tier, al.name AS accepter_league,
                au.discord_id AS accepter_discord_id
            FROM scrim_requests sr
            JOIN teams pt ON pt.id = sr.team_id
            JOIN seasons ps ON ps.id = pt.season_id
            JOIN divisions pd ON pd.id = ps.division_id
            JOIN leagues pl ON pl.id = ps.league_id
            JOIN users pu ON pu.id = sr.user_id
            JOIN teams at2 ON at2.id = sr.accepted_team_id
            JOIN seasons as2 ON as2.id = at2.season_id
            JOIN divisions ad ON ad.id = as2.division_id
            JOIN leagues al ON al.id = as2.league_id
            JOIN users au ON au.id = sr.accepted_user_id
            WHERE sr.id = ${scrimId}
        `
        if (!row) return

        const dateStr = formatDateEST(row.scheduled_date)
        const mode = PICK_MODE_LABELS[row.pick_mode] || row.pick_mode
        const posterTier = row.poster_tier ? ` (${RANK_LABELS[row.poster_tier] || 'Tier ' + row.poster_tier})` : ''
        const accepterTier = row.accepter_tier ? ` (${RANK_LABELS[row.accepter_tier] || 'Tier ' + row.accepter_tier})` : ''

        const buildEmbed = (title, description, myTeam, myLeague, myDiv, opponentTeam, opponentLeague, opponentDiv) => {
            const fields = [
                { name: '\u{1F3F0} Your Team', value: myTeam, inline: true },
                { name: '\u{1F3C6} League', value: myLeague, inline: true },
                { name: '\u{1F4CA} Division', value: myDiv, inline: true },
                { name: '\u200B', value: '───', inline: false },
                { name: '\u{1F3F0} Opponent', value: opponentTeam, inline: true },
                { name: '\u{1F3C6} League', value: opponentLeague, inline: true },
                { name: '\u{1F4CA} Division', value: opponentDiv, inline: true },
                { name: '\u200B', value: '───', inline: false },
                { name: '\u{1F4C5} Date', value: dateStr, inline: true },
                { name: '\u{1F3AE} Mode', value: mode, inline: true },
            ]
            if (row.banned_content_league) {
                fields.push({ name: '\u{1F6AB} Bans', value: row.banned_content_league, inline: true })
            }
            if (row.notes) {
                fields.push({ name: '\u{1F4DD} Notes', value: row.notes, inline: false })
            }
            return {
                title,
                description,
                color: 0x2d8212,
                fields,
                footer: { text: '\u26A0\uFE0F Repeated no-shows will affect your reliability score and may prevent you from scheduling future scrims.' },
                url: 'https://smitecomp.com/scrims',
            }
        }

        // DM the poster
        if (row.poster_discord_id) {
            const embed = buildEmbed(
                '\u2694\uFE0F Scrim Accepted!',
                'Your scrim request has been accepted!',
                row.poster_team, row.poster_league, `${row.poster_div}${posterTier}`,
                row.accepter_team, row.accepter_league, `${row.accepter_div}${accepterTier}`,
            )
            await sendDM(row.poster_discord_id, { embeds: [embed] })
        }

        // DM the accepter
        if (row.accepter_discord_id) {
            const embed = buildEmbed(
                '\u2694\uFE0F Challenge Accepted!',
                "You've accepted a scrim challenge!",
                row.accepter_team, row.accepter_league, `${row.accepter_div}${accepterTier}`,
                row.poster_team, row.poster_league, `${row.poster_div}${posterTier}`,
            )
            await sendDM(row.accepter_discord_id, { embeds: [embed] })
        }
    } catch (err) {
        console.error('notifyScrimAccepted error:', err.message || err)
    }
}


// ═══════════════════════════════════════════════════
// POST: Cancel own scrim request
// ═══════════════════════════════════════════════════
async function cancelScrim(sql, user, body) {
    const { scrim_id } = body

    if (!scrim_id) {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'scrim_id is required' }) }
    }

    const [scrim] = await sql`
        SELECT id, team_id, status FROM scrim_requests WHERE id = ${scrim_id}
    `
    if (!scrim) {
        return { statusCode: 404, headers: adminHeaders, body: JSON.stringify({ error: 'Scrim request not found' }) }
    }
    if (scrim.status !== 'open') {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'Can only cancel open scrim requests' }) }
    }

    // Verify user is captain or has scrim_manage permission
    const captainTeams = await getEligibleTeams(sql, user.id)
    const isEligible = captainTeams.some(t => t.team_id === scrim.team_id)
    if (!isEligible) {
        return { statusCode: 403, headers: adminHeaders, body: JSON.stringify({ error: 'You are not a captain of the posting team' }) }
    }

    await sql`
        UPDATE scrim_requests SET status = 'cancelled', updated_at = NOW()
        WHERE id = ${scrim_id}
    `

    return {
        statusCode: 200,
        headers: adminHeaders,
        body: JSON.stringify({ success: true }),
    }
}


// ═══════════════════════════════════════════════════
// POST: Decline a direct challenge
// ═══════════════════════════════════════════════════
async function declineScrim(sql, user, body) {
    const { scrim_id } = body

    if (!scrim_id) {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'scrim_id is required' }) }
    }

    const [scrim] = await sql`
        SELECT id, challenged_team_id, status FROM scrim_requests WHERE id = ${scrim_id}
    `
    if (!scrim) {
        return { statusCode: 404, headers: adminHeaders, body: JSON.stringify({ error: 'Scrim request not found' }) }
    }
    if (scrim.status !== 'open') {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'Can only decline open challenges' }) }
    }
    if (!scrim.challenged_team_id) {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'This is not a direct challenge' }) }
    }

    // Verify user is captain or has scrim_manage permission
    const captainTeams = await getEligibleTeams(sql, user.id)
    const isEligible = captainTeams.some(t => t.team_id === scrim.challenged_team_id)
    if (!isEligible) {
        return { statusCode: 403, headers: adminHeaders, body: JSON.stringify({ error: 'You are not a captain of the challenged team' }) }
    }

    await sql`
        UPDATE scrim_requests SET status = 'cancelled', updated_at = NOW()
        WHERE id = ${scrim_id}
    `

    return {
        statusCode: 200,
        headers: adminHeaders,
        body: JSON.stringify({ success: true }),
    }
}


// ═══════════════════════════════════════════════════
// POST: Report scrim outcome (completed or no-show)
// ═══════════════════════════════════════════════════
async function reportOutcome(sql, user, body) {
    const { scrim_id, outcome } = body

    if (!scrim_id || !outcome) {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'scrim_id and outcome required' }) }
    }
    if (!['completed', 'no_show_self', 'no_show_opponent'].includes(outcome)) {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'outcome must be completed, no_show_self, or no_show_opponent' }) }
    }

    const [scrim] = await sql`
        SELECT id, team_id, accepted_team_id, status, scheduled_date, outcome
        FROM scrim_requests WHERE id = ${scrim_id}
    `
    if (!scrim) {
        return { statusCode: 404, headers: adminHeaders, body: JSON.stringify({ error: 'Scrim not found' }) }
    }
    if (scrim.status !== 'accepted') {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'Can only report outcomes for accepted scrims' }) }
    }
    if (scrim.outcome) {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'Outcome already reported' }) }
    }
    if (new Date(scrim.scheduled_date) > new Date()) {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'Cannot report before scheduled time' }) }
    }

    // Determine which team the reporter belongs to
    const captainTeams = await getEligibleTeams(sql, user.id)
    const reporterTeamIds = captainTeams.map(t => t.team_id)

    const isPosterTeam = reporterTeamIds.includes(scrim.team_id)
    const isAccepterTeam = reporterTeamIds.includes(scrim.accepted_team_id)

    if (!isPosterTeam && !isAccepterTeam) {
        return { statusCode: 403, headers: adminHeaders, body: JSON.stringify({ error: 'You are not a captain of either team in this scrim' }) }
    }

    let dbOutcome = null
    let newStatus = null

    if (outcome === 'completed') {
        dbOutcome = 'completed'
        newStatus = 'completed'
    } else if (outcome === 'no_show_self') {
        // Self-admission: reporter's team no-showed — no dispute window needed
        if (isPosterTeam && !isAccepterTeam) {
            dbOutcome = 'no_show_by_poster'
        } else if (isAccepterTeam && !isPosterTeam) {
            dbOutcome = 'no_show_by_accepter'
        } else {
            // Captain of both teams — use poster side by default for self-admission
            dbOutcome = 'no_show_by_poster'
        }
        newStatus = 'no_show'
    } else {
        // no_show_opponent: reporter accuses the OTHER team — 24h dispute window
        if (isPosterTeam && !isAccepterTeam) {
            dbOutcome = 'no_show_by_accepter'
        } else if (isAccepterTeam && !isPosterTeam) {
            dbOutcome = 'no_show_by_poster'
        } else {
            // Captain of both teams — use accepter side by default for opponent accusation
            dbOutcome = 'no_show_by_accepter'
        }
        newStatus = 'no_show'
    }

    // Only set dispute deadline when accusing the opponent (not self-admission)
    const disputeDeadline = outcome === 'no_show_opponent' ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null

    await sql`
        UPDATE scrim_requests
        SET status = ${newStatus},
            outcome = ${dbOutcome},
            outcome_reported_by = ${user.id},
            outcome_reported_at = NOW(),
            outcome_dispute_deadline = ${disputeDeadline},
            updated_at = NOW()
        WHERE id = ${scrim_id}
    `

    return {
        statusCode: 200,
        headers: adminHeaders,
        body: JSON.stringify({ success: true }),
    }
}


// ═══════════════════════════════════════════════════
// POST: Dispute a no-show outcome (24h window)
// ═══════════════════════════════════════════════════
async function disputeOutcome(sql, user, body) {
    const { scrim_id } = body

    if (!scrim_id) {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'scrim_id required' }) }
    }

    const [scrim] = await sql`
        SELECT id, team_id, accepted_team_id, status, outcome,
               outcome_disputed, outcome_dispute_deadline
        FROM scrim_requests WHERE id = ${scrim_id}
    `
    if (!scrim) {
        return { statusCode: 404, headers: adminHeaders, body: JSON.stringify({ error: 'Scrim not found' }) }
    }
    if (scrim.status !== 'no_show') {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'Can only dispute no-show outcomes' }) }
    }
    if (scrim.outcome_disputed) {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'Already disputed' }) }
    }
    if (new Date(scrim.outcome_dispute_deadline) < new Date()) {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'Dispute window has closed (24h after report)' }) }
    }

    // Only the accused team can dispute
    const accusedTeamId = scrim.outcome === 'no_show_by_poster' ? scrim.team_id : scrim.accepted_team_id
    const captainTeams = await getEligibleTeams(sql, user.id)
    const isAccusedCaptain = captainTeams.some(t => t.team_id === accusedTeamId)

    if (!isAccusedCaptain) {
        return { statusCode: 403, headers: adminHeaders, body: JSON.stringify({ error: 'Only the accused team can dispute' }) }
    }

    await sql`
        UPDATE scrim_requests
        SET status = 'disputed',
            outcome_disputed = true,
            updated_at = NOW()
        WHERE id = ${scrim_id}
    `

    return {
        statusCode: 200,
        headers: adminHeaders,
        body: JSON.stringify({ success: true }),
    }
}


// ═══════════════════════════════════════════════════
// GET: Team reliability scores
// ═══════════════════════════════════════════════════
async function getTeamReliability(sql, params) {
    const { team_ids } = params
    if (!team_ids) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'team_ids required' }) }
    }

    const ids = team_ids.split(',').map(Number).filter(n => !isNaN(n))
    if (ids.length === 0) {
        return { statusCode: 200, headers, body: JSON.stringify({ reliability: {} }) }
    }

    const rows = await sql`
        WITH expanded AS (
            SELECT
                sr.id,
                sr.status,
                sr.outcome,
                sr.outcome_disputed,
                sr.outcome_dispute_deadline,
                unnest(ARRAY[sr.team_id, sr.accepted_team_id]) AS involved_team_id,
                CASE
                    WHEN sr.outcome = 'no_show_by_poster' THEN sr.team_id
                    WHEN sr.outcome = 'no_show_by_accepter' THEN sr.accepted_team_id
                    ELSE NULL
                END AS accused_team_id
            FROM scrim_requests sr
            WHERE sr.accepted_team_id IS NOT NULL
              AND sr.status IN ('completed', 'no_show')
        )
        SELECT
            involved_team_id,
            COUNT(*) FILTER (WHERE status = 'completed') AS scrims_completed,
            COUNT(*) FILTER (
                WHERE status = 'no_show'
                AND outcome_disputed = false
                AND outcome_dispute_deadline < NOW()
                AND accused_team_id = involved_team_id
            ) AS confirmed_no_shows
        FROM expanded
        WHERE involved_team_id = ANY(${ids})
        GROUP BY involved_team_id
    `

    const reliability = {}
    for (const id of ids) {
        const row = rows.find(r => r.involved_team_id === id)
        if (!row || (Number(row.scrims_completed) + Number(row.confirmed_no_shows)) === 0) {
            reliability[id] = { completed: 0, noShows: 0, score: null }
        } else {
            const total = Number(row.scrims_completed) + Number(row.confirmed_no_shows)
            reliability[id] = {
                completed: Number(row.scrims_completed),
                noShows: Number(row.confirmed_no_shows),
                score: Math.round((Number(row.scrims_completed) / total) * 100),
            }
        }
    }

    return { statusCode: 200, headers, body: JSON.stringify({ reliability }) }
}


// ═══════════════════════════════════════════════════
// GET: User's blacklist (auth required)
// ═══════════════════════════════════════════════════
async function getBlacklist(sql, event) {
    const user = await requireAuth(event)
    if (!user) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const captainTeams = await getEligibleTeams(sql, user.id)
    if (captainTeams.length === 0) {
        return { statusCode: 200, headers, body: JSON.stringify({ blacklist: [] }) }
    }

    const teamIds = captainTeams.map(t => t.team_id)

    const entries = await sql`
        SELECT sb.id, sb.team_id, sb.blocked_team_id, sb.created_at,
               t.name as blocked_team_name, t.slug as blocked_team_slug,
               t.logo_url as blocked_team_logo, t.color as blocked_team_color,
               d.name as blocked_division_name, d.tier as blocked_division_tier,
               l.name as blocked_league_name
        FROM scrim_blacklist sb
        JOIN teams t ON t.id = sb.blocked_team_id
        JOIN seasons s ON s.id = t.season_id
        JOIN divisions d ON d.id = s.division_id
        JOIN leagues l ON l.id = s.league_id
        WHERE sb.team_id = ANY(${teamIds})
        ORDER BY sb.created_at DESC
    `

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            blacklist: entries.map(e => ({
                id: e.id,
                teamId: e.team_id,
                blockedTeamId: e.blocked_team_id,
                blockedTeamName: e.blocked_team_name,
                blockedTeamSlug: e.blocked_team_slug,
                blockedTeamLogo: e.blocked_team_logo,
                blockedTeamColor: e.blocked_team_color,
                blockedDivisionName: e.blocked_division_name,
                blockedDivisionTier: e.blocked_division_tier,
                blockedLeagueName: e.blocked_league_name,
                createdAt: e.created_at,
            })),
        }),
    }
}


// ═══════════════════════════════════════════════════
// POST: Add team to blacklist
// ═══════════════════════════════════════════════════
async function addToBlacklist(sql, user, body) {
    const { team_id, blocked_team_id } = body

    if (!team_id || !blocked_team_id) {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'team_id and blocked_team_id required' }) }
    }
    if (team_id === blocked_team_id) {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'Cannot block your own team' }) }
    }

    const captainTeams = await getEligibleTeams(sql, user.id)
    if (!captainTeams.some(t => t.team_id === team_id)) {
        return { statusCode: 403, headers: adminHeaders, body: JSON.stringify({ error: 'You are not a captain of this team' }) }
    }

    const [target] = await sql`
        SELECT t.id FROM teams t
        JOIN seasons s ON s.id = t.season_id
        WHERE t.id = ${blocked_team_id} AND s.is_active = true
    `
    if (!target) {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'Target team not found' }) }
    }

    await sql`
        INSERT INTO scrim_blacklist (team_id, blocked_team_id)
        VALUES (${team_id}, ${blocked_team_id})
        ON CONFLICT DO NOTHING
    `

    return {
        statusCode: 200,
        headers: adminHeaders,
        body: JSON.stringify({ success: true }),
    }
}


// ═══════════════════════════════════════════════════
// POST: Remove team from blacklist
// ═══════════════════════════════════════════════════
async function removeFromBlacklist(sql, user, body) {
    const { team_id, blocked_team_id } = body

    if (!team_id || !blocked_team_id) {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'team_id and blocked_team_id required' }) }
    }

    const captainTeams = await getEligibleTeams(sql, user.id)
    if (!captainTeams.some(t => t.team_id === team_id)) {
        return { statusCode: 403, headers: adminHeaders, body: JSON.stringify({ error: 'You are not a captain of this team' }) }
    }

    await sql`
        DELETE FROM scrim_blacklist
        WHERE team_id = ${team_id} AND blocked_team_id = ${blocked_team_id}
    `

    return {
        statusCode: 200,
        headers: adminHeaders,
        body: JSON.stringify({ success: true }),
    }
}


// ═══════════════════════════════════════════════════
// GET: Search users (Owner only — for impersonation)
// ═══════════════════════════════════════════════════
async function searchUsers(sql, event, params) {
    const user = await requirePermission(event, 'permission_manage')
    if (!user) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const { q } = params
    const users = q
        ? await sql`
            SELECT id, discord_username, discord_avatar, linked_player_id
            FROM users
            WHERE discord_username ILIKE ${'%' + q + '%'}
            ORDER BY discord_username ASC
            LIMIT 20
        `
        : await sql`
            SELECT id, discord_username, discord_avatar, linked_player_id
            FROM users
            ORDER BY discord_username ASC
            LIMIT 20
        `

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            users: users.map(u => ({
                id: u.id,
                discordUsername: u.discord_username,
                discordAvatar: u.discord_avatar,
                linkedPlayerId: u.linked_player_id,
            })),
        }),
    }
}


export const onRequest = adapt(handler)

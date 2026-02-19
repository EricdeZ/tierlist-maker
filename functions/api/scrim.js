import { adapt } from '../lib/adapter.js'
import { getDB, headers, adminHeaders } from '../lib/db.js'
import { requireAuth } from '../lib/auth.js'

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
                    return await acceptScrim(sql, user, body)
                case 'cancel':
                    return await cancelScrim(sql, user, body)
                case 'decline':
                    return await declineScrim(sql, user, body)
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
        SELECT lp.team_id, t.name as team_name, t.slug as team_slug, t.logo_url as team_logo,
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
// Shared: scrim list query with team/league/division joins
// ═══════════════════════════════════════════════════
const SCRIM_SELECT = `
    sr.id, sr.team_id, sr.user_id, sr.challenged_team_id,
    sr.scheduled_date, sr.pick_mode, sr.banned_content_league,
    sr.notes, sr.status, sr.accepted_team_id, sr.accepted_user_id,
    sr.accepted_at, sr.created_at, sr.updated_at,
    t.name as team_name, t.slug as team_slug, t.logo_url as team_logo, t.color as team_color,
    d.name as division_name, d.tier as division_tier,
    l.name as league_name, l.slug as league_slug,
    u.discord_username as posted_by
`

function formatScrim(row) {
    return {
        id: row.id,
        teamId: row.team_id,
        teamName: row.team_name,
        teamSlug: row.team_slug,
        teamLogo: row.team_logo,
        teamColor: row.team_color,
        divisionName: row.division_name,
        divisionTier: row.division_tier,
        leagueName: row.league_name,
        leagueSlug: row.league_slug,
        postedBy: row.posted_by,
        challengedTeamId: row.challenged_team_id,
        challengedTeamName: row.challenged_team_name || null,
        challengedTeamSlug: row.challenged_team_slug || null,
        challengedTeamLogo: row.challenged_team_logo || null,
        challengedTeamColor: row.challenged_team_color || null,
        challengedDivisionName: row.challenged_division_name || null,
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
        acceptedAt: row.accepted_at,
        createdAt: row.created_at,
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
            sr.notes, sr.status, sr.accepted_team_id, sr.accepted_user_id,
            sr.accepted_at, sr.created_at, sr.updated_at,
            t.name as team_name, t.slug as team_slug, t.logo_url as team_logo, t.color as team_color,
            d.name as division_name, d.tier as division_tier,
            l.name as league_name, l.slug as league_slug,
            u.discord_username as posted_by,
            ct.name as challenged_team_name, ct.slug as challenged_team_slug,
            ct.logo_url as challenged_team_logo, ct.color as challenged_team_color,
            cd.name as challenged_division_name,
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

    const captainTeams = await getCaptainTeams(sql, user.id)
    if (captainTeams.length === 0) {
        return { statusCode: 200, headers, body: JSON.stringify({ scrims: [], captainTeams: [] }) }
    }

    const teamIds = captainTeams.map(t => t.team_id)

    const scrims = await sql`
        SELECT
            sr.id, sr.team_id, sr.user_id, sr.challenged_team_id,
            sr.scheduled_date, sr.pick_mode, sr.banned_content_league,
            sr.notes, sr.status, sr.accepted_team_id, sr.accepted_user_id,
            sr.accepted_at, sr.created_at, sr.updated_at,
            t.name as team_name, t.slug as team_slug, t.logo_url as team_logo, t.color as team_color,
            d.name as division_name, d.tier as division_tier,
            l.name as league_name, l.slug as league_slug,
            u.discord_username as posted_by,
            ct.name as challenged_team_name, ct.slug as challenged_team_slug,
            ct.logo_url as challenged_team_logo, ct.color as challenged_team_color,
            cd.name as challenged_division_name,
            cl.name as challenged_league_name,
            at2.name as accepted_team_name, at2.slug as accepted_team_slug,
            at2.logo_url as accepted_team_logo, at2.color as accepted_team_color
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
        WHERE sr.team_id = ANY(${teamIds})
           OR sr.challenged_team_id = ANY(${teamIds})
           OR sr.accepted_team_id = ANY(${teamIds})
        ORDER BY sr.scheduled_date DESC
    `

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
                divisionName: t.division_name,
                divisionTier: t.division_tier,
                leagueName: t.league_name,
                leagueSlug: t.league_slug,
            })),
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

    const captainTeams = await getCaptainTeams(sql, user.id)
    if (captainTeams.length === 0) {
        return { statusCode: 200, headers, body: JSON.stringify({ scrims: [] }) }
    }

    const teamIds = captainTeams.map(t => t.team_id)

    const scrims = await sql`
        SELECT
            sr.id, sr.team_id, sr.user_id, sr.challenged_team_id,
            sr.scheduled_date, sr.pick_mode, sr.banned_content_league,
            sr.notes, sr.status, sr.accepted_team_id, sr.accepted_user_id,
            sr.accepted_at, sr.created_at, sr.updated_at,
            t.name as team_name, t.slug as team_slug, t.logo_url as team_logo, t.color as team_color,
            d.name as division_name, d.tier as division_tier,
            l.name as league_name, l.slug as league_slug,
            u.discord_username as posted_by,
            ct.name as challenged_team_name, ct.slug as challenged_team_slug,
            ct.logo_url as challenged_team_logo, ct.color as challenged_team_color,
            cd.name as challenged_division_name,
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

    const teams = await getCaptainTeams(sql, user.id)

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            captainTeams: teams.map(t => ({
                teamId: t.team_id,
                teamName: t.team_name,
                teamSlug: t.team_slug,
                teamLogo: t.team_logo,
                divisionName: t.division_name,
                divisionTier: t.division_tier,
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
    const { team_id, scheduled_date, pick_mode, banned_content_league, notes, challenged_team_id } = body

    if (!team_id || !scheduled_date) {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'team_id and scheduled_date are required' }) }
    }

    const validModes = ['regular', 'fearless', 'fearless_picks', 'fearless_bans']
    if (pick_mode && !validModes.includes(pick_mode)) {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: `Invalid pick_mode. Must be one of: ${validModes.join(', ')}` }) }
    }

    // Verify user is captain of team_id
    const captainTeams = await getCaptainTeams(sql, user.id)
    const isCaptain = captainTeams.some(t => t.team_id === team_id)
    if (!isCaptain) {
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
    }

    const [created] = await sql`
        INSERT INTO scrim_requests (team_id, user_id, challenged_team_id, scheduled_date, pick_mode, banned_content_league, notes)
        VALUES (${team_id}, ${user.id}, ${challenged_team_id || null}, ${scheduled_date}, ${pick_mode || 'regular'}, ${banned_content_league || null}, ${notes || null})
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
async function acceptScrim(sql, user, body) {
    const { scrim_id, team_id } = body

    if (!scrim_id || !team_id) {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'scrim_id and team_id are required' }) }
    }

    // Verify user is captain of accepting team
    const captainTeams = await getCaptainTeams(sql, user.id)
    const isCaptain = captainTeams.some(t => t.team_id === team_id)
    if (!isCaptain) {
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

    return {
        statusCode: 200,
        headers: adminHeaders,
        body: JSON.stringify({ success: true, scrim: updated }),
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

    // Verify user is captain of the posting team
    const captainTeams = await getCaptainTeams(sql, user.id)
    const isCaptain = captainTeams.some(t => t.team_id === scrim.team_id)
    if (!isCaptain) {
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

    // Verify user is captain of the challenged team
    const captainTeams = await getCaptainTeams(sql, user.id)
    const isCaptain = captainTeams.some(t => t.team_id === scrim.challenged_team_id)
    if (!isCaptain) {
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


export const onRequest = adapt(handler)

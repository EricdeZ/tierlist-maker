// functions/lib/scrim.js — Shared helpers, queries, and business logic for scrim endpoints
import { sendDM, sendDMWithReturn, fetchChannelMessages } from './discord.js'

// ═══════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════
export const RANK_LABELS = { 1: 'Deity', 2: 'Demigod', 3: 'Master', 4: 'Obsidian', 5: 'Diamond' }
export const PICK_MODE_LABELS = { regular: 'Regular', fearless: 'Fearless', fearless_picks: 'Fearless Picks', fearless_bans: 'Fearless Bans' }
const VALID_PICK_MODES = ['regular', 'fearless', 'fearless_picks', 'fearless_bans']
const VALID_REGIONS = ['NA', 'EU']


// ═══════════════════════════════════════════════════
// Utility: format date as EST string
// ═══════════════════════════════════════════════════
export function formatDateEST(date) {
    return new Date(date).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        weekday: 'short', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
    }) + ' EST'
}


// ═══════════════════════════════════════════════════
// Formatter: DB row → API response shape
// ═══════════════════════════════════════════════════
export function formatScrim(row) {
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
        region: row.region || 'NA',
        requiresConfirmation: row.requires_confirmation || false,
        acceptableTiers: row.acceptable_tiers || null,
        acceptableDivisions: row.acceptable_divisions || null,
        acceptedTeamId: row.accepted_team_id,
        acceptedTeamName: row.accepted_team_name || null,
        acceptedTeamSlug: row.accepted_team_slug || null,
        acceptedTeamLogo: row.accepted_team_logo || null,
        acceptedTeamColor: row.accepted_team_color || null,
        acceptedDivisionName: row.accepted_division_name || null,
        acceptedDivisionTier: row.accepted_division_tier || null,
        acceptedDivisionSlug: row.accepted_division_slug || null,
        acceptedLeagueName: row.accepted_league_name || null,
        acceptedAt: row.accepted_at,
        pendingTeamId: row.pending_team_id || null,
        pendingTeamName: row.pending_team_name || null,
        pendingTeamSlug: row.pending_team_slug || null,
        pendingTeamLogo: row.pending_team_logo || null,
        pendingTeamColor: row.pending_team_color || null,
        pendingDivisionName: row.pending_division_name || null,
        pendingDivisionTier: row.pending_division_tier || null,
        pendingLeagueName: row.pending_league_name || null,
        pendingAt: row.pending_at || null,
        createdAt: row.created_at,
        outcome: row.outcome || null,
        outcomeReportedBy: row.outcome_reported_by || null,
        outcomeReportedAt: row.outcome_reported_at || null,
        outcomeDisputed: row.outcome_disputed || false,
        outcomeDisputeDeadline: row.outcome_dispute_deadline || null,
    }
}

export function formatTeamForResponse(t) {
    return {
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
    }
}


// ═══════════════════════════════════════════════════
// Query: Get teams where user is an active captain
// ═══════════════════════════════════════════════════
export async function getCaptainTeams(sql, userId) {
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
// Query: Get all teams where user is an active member
// ═══════════════════════════════════════════════════
export async function getMyTeams(sql, userId) {
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
// Query: Check if user has scrim_manage permission
// ═══════════════════════════════════════════════════
export async function hasScrimManagePermission(sql, userId) {
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
// Query: Get all active teams (for scrim_manage users)
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
export async function getEligibleTeams(sql, userId) {
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
// Discord: DM both captains when a scrim is accepted
// ═══════════════════════════════════════════════════
export async function notifyScrimAccepted(sql, scrimId, accepterTeamId) {
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
// Discord: Send confirmation DM to poster's captain
// ═══════════════════════════════════════════════════
export async function sendConfirmationDM(sql, scrimId, pendingTeamId) {
    try {
        const [row] = await sql`
            SELECT
                sr.scheduled_date, sr.pick_mode, sr.banned_content_league,
                pt.name AS poster_team, pu.discord_id AS poster_discord_id,
                pnt.name AS pending_team, pnd.name AS pending_div, pnd.tier AS pending_tier,
                pnl.name AS pending_league
            FROM scrim_requests sr
            JOIN teams pt ON pt.id = sr.team_id
            JOIN users pu ON pu.id = sr.user_id
            JOIN teams pnt ON pnt.id = sr.pending_team_id
            JOIN seasons pns ON pns.id = pnt.season_id
            JOIN divisions pnd ON pnd.id = pns.division_id
            JOIN leagues pnl ON pnl.id = pns.league_id
            WHERE sr.id = ${scrimId}
        `
        if (!row || !row.poster_discord_id) return

        const dateStr = formatDateEST(row.scheduled_date)
        const tierLabel = row.pending_tier ? ` (${RANK_LABELS[row.pending_tier] || 'Tier ' + row.pending_tier})` : ''
        const mode = PICK_MODE_LABELS[row.pick_mode] || row.pick_mode

        const result = await sendDMWithReturn(row.poster_discord_id, {
            embeds: [{
                title: '\u{1F514} Scrim Acceptance Request',
                description: `**${row.pending_team}** from ${row.pending_league} — ${row.pending_div}${tierLabel} wants to accept your scrim.`,
                color: 0xf0a830,
                fields: [
                    { name: '\u{1F4C5} Date', value: dateStr, inline: true },
                    { name: '\u{1F3AE} Mode', value: mode, inline: true },
                    ...(row.banned_content_league ? [{ name: '\u{1F6AB} Bans', value: row.banned_content_league, inline: true }] : []),
                ],
                footer: { text: 'Reply Accept/Yes to confirm, or Decline/No to deny. You can also confirm at smitecomp.com/scrims' },
                url: 'https://smitecomp.com/scrims',
            }],
        })

        // Store DM channel/message IDs for polling
        if (result?.channelId && result?.messageId) {
            await sql`
                UPDATE scrim_requests
                SET dm_channel_id = ${result.channelId},
                    confirmation_dm_id = ${result.messageId}
                WHERE id = ${scrimId}
            `
        }
    } catch (err) {
        console.error('sendConfirmationDM error:', err.message || err)
    }
}


// ═══════════════════════════════════════════════════
// GET handlers
// ═══════════════════════════════════════════════════

export async function listScrims(sql, params) {
    const { league_id, division_tier, region, division_id } = params

    const filters = []
    if (league_id) filters.push(sql`l.id = ${league_id}`)
    if (division_tier) filters.push(sql`d.tier = ${division_tier}`)
    if (region) filters.push(sql`sr.region = ${region}`)
    if (division_id) filters.push(sql`d.id = ${Number(division_id)}`)

    const where = filters.length > 0
        ? sql`AND ${filters.reduce((a, b) => sql`${a} AND ${b}`)}`
        : sql``

    const scrims = await sql`
        SELECT
            sr.id, sr.team_id, sr.user_id, sr.challenged_team_id,
            sr.scheduled_date, sr.pick_mode, sr.banned_content_league,
            sr.notes, sr.status, sr.acceptable_tiers, sr.acceptable_divisions,
            sr.region, sr.requires_confirmation,
            sr.accepted_team_id, sr.accepted_user_id,
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

    return scrims.map(formatScrim)
}


export async function fetchMyScrims(sql, userId) {
    const [captainTeams, myTeams] = await Promise.all([
        getEligibleTeams(sql, userId),
        getMyTeams(sql, userId),
    ])

    // Merge captain + member team IDs for querying scrims
    const allTeamIdSet = new Set([
        ...captainTeams.map(t => t.team_id),
        ...myTeams.map(t => t.team_id),
    ])
    const teamIds = [...allTeamIdSet]

    if (teamIds.length === 0) {
        return { scrims: [], captainTeams: [], myTeams: [], blockedByMe: [], blockedMe: [] }
    }

    const scrims = await sql`
        SELECT
            sr.id, sr.team_id, sr.user_id, sr.challenged_team_id,
            sr.scheduled_date, sr.pick_mode, sr.banned_content_league,
            sr.notes, sr.status, sr.acceptable_tiers, sr.acceptable_divisions,
            sr.region, sr.requires_confirmation,
            sr.pending_team_id, sr.pending_user_id, sr.pending_at,
            sr.accepted_team_id, sr.accepted_user_id,
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
            al.name as accepted_league_name,
            pnt.name as pending_team_name, pnt.slug as pending_team_slug,
            pnt.logo_url as pending_team_logo, pnt.color as pending_team_color,
            pnd.name as pending_division_name, pnd.tier as pending_division_tier,
            pnl.name as pending_league_name
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
        LEFT JOIN teams pnt ON pnt.id = sr.pending_team_id
        LEFT JOIN seasons pns ON pns.id = pnt.season_id
        LEFT JOIN divisions pnd ON pnd.id = pns.division_id
        LEFT JOIN leagues pnl ON pnl.id = pns.league_id
        WHERE sr.team_id = ANY(${teamIds})
           OR sr.challenged_team_id = ANY(${teamIds})
           OR sr.accepted_team_id = ANY(${teamIds})
           OR sr.pending_team_id = ANY(${teamIds})
        ORDER BY sr.scheduled_date DESC
    `

    // Fetch blacklist data for client-side filtering
    const [blockedByMe, blockedMe] = await Promise.all([
        sql`SELECT team_id, blocked_team_id FROM scrim_blacklist WHERE team_id = ANY(${teamIds})`,
        sql`SELECT team_id, blocked_team_id FROM scrim_blacklist WHERE blocked_team_id = ANY(${teamIds})`,
    ])

    return {
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
    }
}


export async function fetchIncoming(sql, userId) {
    const captainTeams = await getEligibleTeams(sql, userId)
    if (captainTeams.length === 0) {
        return []
    }

    const teamIds = captainTeams.map(t => t.team_id)

    const scrims = await sql`
        SELECT
            sr.id, sr.team_id, sr.user_id, sr.challenged_team_id,
            sr.scheduled_date, sr.pick_mode, sr.banned_content_league,
            sr.notes, sr.status, sr.acceptable_tiers, sr.acceptable_divisions,
            sr.region, sr.requires_confirmation,
            sr.accepted_team_id, sr.accepted_user_id,
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

    return scrims.map(formatScrim)
}


export async function fetchAllActiveTeams(sql) {
    const teams = await sql`
        SELECT t.id, t.name, t.slug, t.logo_url, t.color,
               d.id as division_id, d.name as division_name, d.tier as division_tier,
               l.id as league_id, l.name as league_name, l.slug as league_slug
        FROM teams t
        JOIN seasons s ON s.id = t.season_id
        JOIN divisions d ON d.id = s.division_id
        JOIN leagues l ON l.id = s.league_id
        WHERE s.is_active = true
        ORDER BY l.name, d.tier NULLS LAST, t.name
    `

    return teams.map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        logoUrl: t.logo_url,
        color: t.color,
        divisionId: t.division_id,
        divisionName: t.division_name,
        divisionTier: t.division_tier,
        leagueId: t.league_id,
        leagueName: t.league_name,
        leagueSlug: t.league_slug,
    }))
}


export async function fetchTeamReliability(sql, params) {
    const { team_ids } = params
    if (!team_ids) {
        return null // signal to caller that team_ids is missing
    }

    const ids = team_ids.split(',').map(Number).filter(n => !isNaN(n))
    if (ids.length === 0) {
        return {}
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

    return reliability
}


export async function fetchBlacklist(sql, userId) {
    const captainTeams = await getEligibleTeams(sql, userId)
    if (captainTeams.length === 0) {
        return []
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

    return entries.map(e => ({
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
    }))
}


export async function fetchActiveDivisions(sql) {
    const divisions = await sql`
        SELECT DISTINCT d.id, d.name, d.tier, d.slug,
               l.id as league_id, l.name as league_name, l.slug as league_slug
        FROM divisions d
        JOIN seasons s ON s.division_id = d.id
        JOIN leagues l ON l.id = d.league_id
        WHERE s.is_active = true
        ORDER BY l.name, d.tier NULLS LAST, d.name
    `

    return divisions.map(d => ({
        id: d.id,
        name: d.name,
        tier: d.tier,
        slug: d.slug,
        leagueId: d.league_id,
        leagueName: d.league_name,
        leagueSlug: d.league_slug,
    }))
}


export async function searchUsersQuery(sql, q) {
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

    return users.map(u => ({
        id: u.id,
        discordUsername: u.discord_username,
        discordAvatar: u.discord_avatar,
        linkedPlayerId: u.linked_player_id,
    }))
}


export async function pollDMConfirmations(sql, userId) {
    const captainTeams = await getEligibleTeams(sql, userId)
    if (captainTeams.length === 0) {
        return 0
    }

    const teamIds = captainTeams.map(t => t.team_id)

    const pendingScrims = await sql`
        SELECT id, dm_channel_id, confirmation_dm_id, team_id,
               pending_team_id, pending_user_id
        FROM scrim_requests
        WHERE status = 'pending_confirmation'
          AND team_id = ANY(${teamIds})
          AND dm_channel_id IS NOT NULL
          AND confirmation_dm_id IS NOT NULL
    `

    let processed = 0
    const ACCEPT_KEYWORDS = ['accept', 'yes', 'y', 'confirm']
    const DECLINE_KEYWORDS = ['decline', 'deny', 'no', 'n', 'reject']

    for (const scrim of pendingScrims) {
        try {
            const messages = await fetchChannelMessages(scrim.dm_channel_id, scrim.confirmation_dm_id, 10)

            for (const msg of messages) {
                if (msg.author?.bot) continue
                const content = (msg.content || '').trim().toLowerCase()

                if (ACCEPT_KEYWORDS.includes(content)) {
                    await sql`
                        UPDATE scrim_requests
                        SET status = 'accepted',
                            accepted_team_id = pending_team_id,
                            accepted_user_id = pending_user_id,
                            accepted_at = NOW(),
                            pending_team_id = NULL, pending_user_id = NULL, pending_at = NULL,
                            dm_channel_id = NULL, confirmation_dm_id = NULL,
                            updated_at = NOW()
                        WHERE id = ${scrim.id} AND status = 'pending_confirmation'
                    `
                    await notifyScrimAccepted(sql, scrim.id, scrim.pending_team_id).catch(() => {})
                    processed++
                    break
                } else if (DECLINE_KEYWORDS.includes(content)) {
                    // Get pending user's discord_id for notification
                    const [pendingUser] = await sql`
                        SELECT discord_id FROM users WHERE id = ${scrim.pending_user_id}
                    `
                    await sql`
                        UPDATE scrim_requests
                        SET status = 'open',
                            pending_team_id = NULL, pending_user_id = NULL, pending_at = NULL,
                            dm_channel_id = NULL, confirmation_dm_id = NULL,
                            updated_at = NOW()
                        WHERE id = ${scrim.id} AND status = 'pending_confirmation'
                    `
                    if (pendingUser?.discord_id) {
                        await sendDM(pendingUser.discord_id, {
                            embeds: [{
                                title: '\u274C Scrim Request Declined',
                                description: 'The team captain declined your scrim acceptance via Discord DM.',
                                color: 0xcc3333,
                                url: 'https://smitecomp.com/scrims',
                            }],
                        }).catch(() => {})
                    }
                    processed++
                    break
                }
            }
        } catch (err) {
            console.error(`check-dm-confirmations error for scrim ${scrim.id}:`, err.message)
        }
    }

    return processed
}


// ═══════════════════════════════════════════════════
// POST handlers
// ═══════════════════════════════════════════════════

export async function createScrim(sql, user, body) {
    const { team_id, scheduled_date, pick_mode, banned_content_league, notes,
            challenged_team_id, acceptable_tiers, acceptable_divisions,
            region, requires_confirmation } = body

    if (!team_id || !scheduled_date) {
        return { error: 'team_id and scheduled_date are required', status: 400 }
    }

    if (pick_mode && !VALID_PICK_MODES.includes(pick_mode)) {
        return { error: `Invalid pick_mode. Must be one of: ${VALID_PICK_MODES.join(', ')}`, status: 400 }
    }

    if (region && !VALID_REGIONS.includes(region)) {
        return { error: 'region must be NA or EU', status: 400 }
    }

    // Mutual exclusivity: tiers vs divisions
    if (acceptable_tiers && acceptable_divisions) {
        return { error: 'Cannot set both acceptable_tiers and acceptable_divisions', status: 400 }
    }

    // Verify user is captain or has scrim_manage permission
    const captainTeams = await getEligibleTeams(sql, user.id)
    const isEligible = captainTeams.some(t => t.team_id === team_id)
    if (!isEligible) {
        return { error: 'You are not a captain of this team', status: 403 }
    }

    // Default region: EU for Tanuki, NA for everything else
    const team = captainTeams.find(t => t.team_id === team_id)
    const effectiveRegion = region || (team?.league_slug === 'tanuki-smite-league' ? 'EU' : 'NA')

    // Validate scheduled_date is in the future
    if (new Date(scheduled_date) <= new Date()) {
        return { error: 'Scheduled date must be in the future', status: 400 }
    }

    // If challenging a specific team, validate it exists and is different
    if (challenged_team_id) {
        if (challenged_team_id === team_id) {
            return { error: 'Cannot challenge your own team', status: 400 }
        }
        const [target] = await sql`
            SELECT t.id FROM teams t
            JOIN seasons s ON s.id = t.season_id
            WHERE t.id = ${challenged_team_id} AND s.is_active = true
        `
        if (!target) {
            return { error: 'Challenged team not found or not in an active season', status: 400 }
        }

        // Check blacklist in both directions for direct challenges
        const [isBlocked] = await sql`
            SELECT 1 FROM scrim_blacklist
            WHERE (team_id = ${team_id} AND blocked_team_id = ${challenged_team_id})
               OR (team_id = ${challenged_team_id} AND blocked_team_id = ${team_id})
            LIMIT 1
        `
        if (isBlocked) {
            return { error: 'Cannot challenge this team (blacklisted)', status: 400 }
        }
    }

    // Validate acceptable_tiers if provided
    if (acceptable_tiers) {
        if (!Array.isArray(acceptable_tiers) || !acceptable_tiers.every(t => Number.isInteger(t) && t >= 1 && t <= 5)) {
            return { error: 'acceptable_tiers must be an array of integers 1-5', status: 400 }
        }
    }

    // Validate acceptable_divisions if provided
    if (acceptable_divisions) {
        if (!Array.isArray(acceptable_divisions) || !acceptable_divisions.every(d => Number.isInteger(d) && d > 0)) {
            return { error: 'acceptable_divisions must be an array of positive integers', status: 400 }
        }
        const validDivs = await sql`
            SELECT DISTINCT d.id FROM divisions d
            JOIN seasons s ON s.division_id = d.id
            WHERE d.id = ANY(${acceptable_divisions}) AND s.is_active = true
        `
        if (validDivs.length !== new Set(acceptable_divisions).size) {
            return { error: 'One or more division IDs are invalid or have no active season', status: 400 }
        }
    }

    const [created] = await sql`
        INSERT INTO scrim_requests (
            team_id, user_id, challenged_team_id, scheduled_date, pick_mode,
            banned_content_league, notes, acceptable_tiers, acceptable_divisions,
            region, requires_confirmation
        ) VALUES (
            ${team_id}, ${user.id}, ${challenged_team_id || null}, ${scheduled_date},
            ${pick_mode || 'regular'}, ${banned_content_league || null}, ${notes || null},
            ${acceptable_tiers ? JSON.stringify(acceptable_tiers) : null},
            ${acceptable_divisions ? JSON.stringify(acceptable_divisions) : null},
            ${effectiveRegion}, ${!!requires_confirmation}
        )
        RETURNING id, status, created_at
    `

    return { success: true, scrim: created }
}


export async function acceptScrim(sql, user, body, waitUntil) {
    const { scrim_id, team_id } = body

    if (!scrim_id || !team_id) {
        return { error: 'scrim_id and team_id are required', status: 400 }
    }

    // Verify user is captain or has scrim_manage permission
    const captainTeams = await getEligibleTeams(sql, user.id)
    const isEligible = captainTeams.some(t => t.team_id === team_id)
    if (!isEligible) {
        return { error: 'You are not a captain of this team', status: 403 }
    }

    // Get the scrim
    const [scrim] = await sql`
        SELECT id, team_id, challenged_team_id, status, scheduled_date,
               acceptable_tiers, acceptable_divisions, requires_confirmation
        FROM scrim_requests WHERE id = ${scrim_id}
    `
    if (!scrim) {
        return { error: 'Scrim request not found', status: 404 }
    }
    if (scrim.status !== 'open') {
        return { error: 'This scrim is no longer open', status: 400 }
    }
    if (new Date(scrim.scheduled_date) <= new Date()) {
        return { error: 'This scrim has expired', status: 400 }
    }
    if (scrim.team_id === team_id) {
        return { error: 'Cannot accept your own scrim request', status: 400 }
    }
    // If it's a direct challenge, only the challenged team can accept
    if (scrim.challenged_team_id && scrim.challenged_team_id !== team_id) {
        return { error: 'This challenge was not sent to your team', status: 403 }
    }

    // Validate acceptable_tiers (server-side enforcement)
    if (scrim.acceptable_tiers) {
        const [acceptingTeam] = await sql`
            SELECT d.tier as division_tier FROM teams t
            JOIN seasons s ON s.id = t.season_id
            JOIN divisions d ON d.id = s.division_id
            WHERE t.id = ${team_id}
        `
        if (!acceptingTeam || !scrim.acceptable_tiers.includes(acceptingTeam.division_tier)) {
            return { error: 'Your tier is not accepted for this scrim', status: 403 }
        }
    }

    // Validate acceptable_divisions (server-side enforcement)
    if (scrim.acceptable_divisions) {
        const [acceptingTeam] = await sql`
            SELECT d.id as division_id FROM teams t
            JOIN seasons s ON s.id = t.season_id
            JOIN divisions d ON d.id = s.division_id
            WHERE t.id = ${team_id}
        `
        if (!acceptingTeam || !scrim.acceptable_divisions.includes(acceptingTeam.division_id)) {
            return { error: 'Your division is not accepted for this scrim', status: 403 }
        }
    }

    // Check blacklist: if posting team has blocked accepting team
    const [blocked] = await sql`
        SELECT 1 FROM scrim_blacklist
        WHERE team_id = ${scrim.team_id} AND blocked_team_id = ${team_id}
        LIMIT 1
    `
    if (blocked) {
        return { error: 'This team has blocked you from accepting their scrims', status: 403 }
    }

    // Confirmation flow: if requires_confirmation, set to pending instead of accepted
    if (scrim.requires_confirmation) {
        const [pending] = await sql`
            UPDATE scrim_requests
            SET status = 'pending_confirmation',
                pending_team_id = ${team_id}, pending_user_id = ${user.id},
                pending_at = NOW(), updated_at = NOW()
            WHERE id = ${scrim_id} AND status = 'open'
            RETURNING id, status
        `
        if (!pending) {
            return { error: 'Scrim was already accepted or cancelled', status: 409 }
        }

        // Send confirmation DM to poster's captain
        waitUntil(sendConfirmationDM(sql, scrim_id, team_id).catch(() => {}))

        return { success: true, pendingConfirmation: true, scrim: pending }
    }

    const [updated] = await sql`
        UPDATE scrim_requests
        SET status = 'accepted', accepted_team_id = ${team_id}, accepted_user_id = ${user.id},
            accepted_at = NOW(), updated_at = NOW()
        WHERE id = ${scrim_id} AND status = 'open'
        RETURNING id, status, accepted_at
    `

    if (!updated) {
        return { error: 'Scrim was already accepted or cancelled', status: 409 }
    }

    // DM both captains — register with waitUntil so CF doesn't kill the context before it finishes
    waitUntil(notifyScrimAccepted(sql, scrim_id, team_id).catch(() => {}))

    return { success: true, scrim: updated }
}


export async function cancelScrim(sql, user, body) {
    const { scrim_id } = body

    if (!scrim_id) {
        return { error: 'scrim_id is required', status: 400 }
    }

    const [scrim] = await sql`
        SELECT id, team_id, status FROM scrim_requests WHERE id = ${scrim_id}
    `
    if (!scrim) {
        return { error: 'Scrim request not found', status: 404 }
    }
    if (scrim.status !== 'open' && scrim.status !== 'pending_confirmation') {
        return { error: 'Can only cancel open or pending scrim requests', status: 400 }
    }

    // Verify user is captain or has scrim_manage permission
    const captainTeams = await getEligibleTeams(sql, user.id)
    const isEligible = captainTeams.some(t => t.team_id === scrim.team_id)
    if (!isEligible) {
        return { error: 'You are not a captain of the posting team', status: 403 }
    }

    await sql`
        UPDATE scrim_requests
        SET status = 'cancelled',
            pending_team_id = NULL, pending_user_id = NULL, pending_at = NULL,
            dm_channel_id = NULL, confirmation_dm_id = NULL,
            updated_at = NOW()
        WHERE id = ${scrim_id}
    `

    return { success: true }
}


export async function declineScrim(sql, user, body) {
    const { scrim_id } = body

    if (!scrim_id) {
        return { error: 'scrim_id is required', status: 400 }
    }

    const [scrim] = await sql`
        SELECT id, challenged_team_id, status FROM scrim_requests WHERE id = ${scrim_id}
    `
    if (!scrim) {
        return { error: 'Scrim request not found', status: 404 }
    }
    if (scrim.status !== 'open') {
        return { error: 'Can only decline open challenges', status: 400 }
    }
    if (!scrim.challenged_team_id) {
        return { error: 'This is not a direct challenge', status: 400 }
    }

    // Verify user is captain or has scrim_manage permission
    const captainTeams = await getEligibleTeams(sql, user.id)
    const isEligible = captainTeams.some(t => t.team_id === scrim.challenged_team_id)
    if (!isEligible) {
        return { error: 'You are not a captain of the challenged team', status: 403 }
    }

    await sql`
        UPDATE scrim_requests SET status = 'cancelled', updated_at = NOW()
        WHERE id = ${scrim_id}
    `

    return { success: true }
}


export async function reportOutcome(sql, user, body) {
    const { scrim_id, outcome } = body

    if (!scrim_id || !outcome) {
        return { error: 'scrim_id and outcome required', status: 400 }
    }
    if (!['completed', 'no_show_self', 'no_show_opponent'].includes(outcome)) {
        return { error: 'outcome must be completed, no_show_self, or no_show_opponent', status: 400 }
    }

    const [scrim] = await sql`
        SELECT id, team_id, accepted_team_id, status, scheduled_date, outcome
        FROM scrim_requests WHERE id = ${scrim_id}
    `
    if (!scrim) {
        return { error: 'Scrim not found', status: 404 }
    }
    if (scrim.status !== 'accepted') {
        return { error: 'Can only report outcomes for accepted scrims', status: 400 }
    }
    if (scrim.outcome) {
        return { error: 'Outcome already reported', status: 400 }
    }
    if (new Date(scrim.scheduled_date) > new Date()) {
        return { error: 'Cannot report before scheduled time', status: 400 }
    }

    // Determine which team the reporter belongs to
    const captainTeams = await getEligibleTeams(sql, user.id)
    const reporterTeamIds = captainTeams.map(t => t.team_id)

    const isPosterTeam = reporterTeamIds.includes(scrim.team_id)
    const isAccepterTeam = reporterTeamIds.includes(scrim.accepted_team_id)

    if (!isPosterTeam && !isAccepterTeam) {
        return { error: 'You are not a captain of either team in this scrim', status: 403 }
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

    return { success: true }
}


export async function disputeOutcome(sql, user, body) {
    const { scrim_id } = body

    if (!scrim_id) {
        return { error: 'scrim_id required', status: 400 }
    }

    const [scrim] = await sql`
        SELECT id, team_id, accepted_team_id, status, outcome,
               outcome_disputed, outcome_dispute_deadline
        FROM scrim_requests WHERE id = ${scrim_id}
    `
    if (!scrim) {
        return { error: 'Scrim not found', status: 404 }
    }
    if (scrim.status !== 'no_show') {
        return { error: 'Can only dispute no-show outcomes', status: 400 }
    }
    if (scrim.outcome_disputed) {
        return { error: 'Already disputed', status: 400 }
    }
    if (new Date(scrim.outcome_dispute_deadline) < new Date()) {
        return { error: 'Dispute window has closed (24h after report)', status: 400 }
    }

    // Only the accused team can dispute
    const accusedTeamId = scrim.outcome === 'no_show_by_poster' ? scrim.team_id : scrim.accepted_team_id
    const captainTeams = await getEligibleTeams(sql, user.id)
    const isAccusedCaptain = captainTeams.some(t => t.team_id === accusedTeamId)

    if (!isAccusedCaptain) {
        return { error: 'Only the accused team can dispute', status: 403 }
    }

    await sql`
        UPDATE scrim_requests
        SET status = 'disputed',
            outcome_disputed = true,
            updated_at = NOW()
        WHERE id = ${scrim_id}
    `

    return { success: true }
}


export async function addToBlacklist(sql, user, body) {
    const { team_id, blocked_team_id } = body

    if (!team_id || !blocked_team_id) {
        return { error: 'team_id and blocked_team_id required', status: 400 }
    }
    if (team_id === blocked_team_id) {
        return { error: 'Cannot block your own team', status: 400 }
    }

    const captainTeams = await getEligibleTeams(sql, user.id)
    if (!captainTeams.some(t => t.team_id === team_id)) {
        return { error: 'You are not a captain of this team', status: 403 }
    }

    const [target] = await sql`
        SELECT t.id FROM teams t
        JOIN seasons s ON s.id = t.season_id
        WHERE t.id = ${blocked_team_id} AND s.is_active = true
    `
    if (!target) {
        return { error: 'Target team not found', status: 400 }
    }

    await sql`
        INSERT INTO scrim_blacklist (team_id, blocked_team_id)
        VALUES (${team_id}, ${blocked_team_id})
        ON CONFLICT DO NOTHING
    `

    return { success: true }
}


export async function removeFromBlacklist(sql, user, body) {
    const { team_id, blocked_team_id } = body

    if (!team_id || !blocked_team_id) {
        return { error: 'team_id and blocked_team_id required', status: 400 }
    }

    const captainTeams = await getEligibleTeams(sql, user.id)
    if (!captainTeams.some(t => t.team_id === team_id)) {
        return { error: 'You are not a captain of this team', status: 403 }
    }

    await sql`
        DELETE FROM scrim_blacklist
        WHERE team_id = ${team_id} AND blocked_team_id = ${blocked_team_id}
    `

    return { success: true }
}


export async function confirmAccept(sql, user, body, waitUntil) {
    const { scrim_id } = body
    if (!scrim_id) {
        return { error: 'scrim_id is required', status: 400 }
    }

    const [scrim] = await sql`
        SELECT id, team_id, user_id, pending_team_id, pending_user_id, status
        FROM scrim_requests WHERE id = ${scrim_id}
    `
    if (!scrim) {
        return { error: 'Scrim not found', status: 404 }
    }
    if (scrim.status !== 'pending_confirmation') {
        return { error: 'Scrim is not pending confirmation', status: 400 }
    }

    // Only the poster's captain can confirm
    const captainTeams = await getEligibleTeams(sql, user.id)
    if (!captainTeams.some(t => t.team_id === scrim.team_id)) {
        return { error: 'Only the posting team captain can confirm', status: 403 }
    }

    const [updated] = await sql`
        UPDATE scrim_requests
        SET status = 'accepted',
            accepted_team_id = pending_team_id,
            accepted_user_id = pending_user_id,
            accepted_at = NOW(),
            pending_team_id = NULL, pending_user_id = NULL, pending_at = NULL,
            dm_channel_id = NULL, confirmation_dm_id = NULL,
            updated_at = NOW()
        WHERE id = ${scrim_id} AND status = 'pending_confirmation'
        RETURNING id, status, accepted_at, accepted_team_id
    `

    if (!updated) {
        return { error: 'Scrim was already confirmed or cancelled', status: 409 }
    }

    // Notify both captains
    waitUntil(notifyScrimAccepted(sql, scrim_id, updated.accepted_team_id).catch(() => {}))

    return { success: true, scrim: updated }
}


export async function denyAccept(sql, user, body, waitUntil) {
    const { scrim_id } = body
    if (!scrim_id) {
        return { error: 'scrim_id is required', status: 400 }
    }

    const [scrim] = await sql`
        SELECT sr.id, sr.team_id, sr.pending_team_id, sr.pending_user_id, sr.status,
               pu.discord_id as pending_discord_id
        FROM scrim_requests sr
        LEFT JOIN users pu ON pu.id = sr.pending_user_id
        WHERE sr.id = ${scrim_id}
    `
    if (!scrim) {
        return { error: 'Scrim not found', status: 404 }
    }
    if (scrim.status !== 'pending_confirmation') {
        return { error: 'Scrim is not pending confirmation', status: 400 }
    }

    // Only the poster's captain can deny
    const captainTeams = await getEligibleTeams(sql, user.id)
    if (!captainTeams.some(t => t.team_id === scrim.team_id)) {
        return { error: 'Only the posting team captain can deny', status: 403 }
    }

    await sql`
        UPDATE scrim_requests
        SET status = 'open',
            pending_team_id = NULL, pending_user_id = NULL, pending_at = NULL,
            dm_channel_id = NULL, confirmation_dm_id = NULL,
            updated_at = NOW()
        WHERE id = ${scrim_id} AND status = 'pending_confirmation'
    `

    // DM the denied team's captain
    if (scrim.pending_discord_id) {
        waitUntil(sendDM(scrim.pending_discord_id, {
            embeds: [{
                title: '\u274C Scrim Request Declined',
                description: 'The team captain has declined your scrim acceptance request. The scrim is back to open status.',
                color: 0xcc3333,
                url: 'https://smitecomp.com/scrims',
            }],
        }).catch(() => {}))
    }

    return { success: true }
}

import { adapt } from '../lib/adapter.js'
import { getDB, adminHeaders as headers } from '../lib/db.js'
import { requirePermission, getAllowedLeagueIds, leagueFilter, getLeagueIdFromTeam } from '../lib/auth.js'
import { logAudit } from '../lib/audit.js'
import { fetchMessage, pollChannel, reactToMessage, fetchGuildRoles, fetchGuildMembers, sendDM } from '../lib/discord.js'
import { autoMatchQueueItems } from '../lib/discord-match.js'


const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const admin = await requirePermission(event, 'match_report')
    if (!admin) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const sql = getDB()
    const allowed = await getAllowedLeagueIds(admin.id, 'match_report')
    const lf = leagueFilter(sql, allowed)
    const isGlobal = allowed === null

    try {
        // ─── GET ───
        if (event.httpMethod === 'GET') {
            const params = event.queryStringParameters || {}
            switch (params.action) {
                case 'queue':              return await getQueue(sql, params, lf)
                case 'channels':           return await getChannels(sql, lf)
                case 'stats':              return await getStats(sql, lf)
                case 'guild-roles':        return await getGuildRoles(params)
                case 'team-role-mappings': return await getTeamRoleMappings(sql, params)
                case 'mapping-summary':    return await getMappingSummary(sql, lf)
                case 'ready-matches':      return await getReadyMatches(sql, lf)
                case 'match-review':       return await getMatchReview(sql, lf)
                case 'member-sync-status': return await getMemberSyncStatus(sql, lf)
                case 'discord-activity':   return await getDiscordActivity(sql, lf, allowed)
                default:
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) }
            }
        }

        // ─── POST ───
        if (event.httpMethod === 'POST') {
            if (!event.body) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Request body required' }) }
            }
            const body = JSON.parse(event.body)

            switch (body.action) {
                case 'add-channel':
                    if (!isGlobal) return { statusCode: 403, headers, body: JSON.stringify({ error: 'Global permission required for channel configuration' }) }
                    return await addChannel(sql, body, admin)
                case 'remove-channel':
                    if (!isGlobal) return { statusCode: 403, headers, body: JSON.stringify({ error: 'Global permission required for channel configuration' }) }
                    return await removeChannel(sql, body, admin)
                case 'update-status':  return await updateQueueStatus(sql, body, admin, allowed)
                case 'mark-used':      return await markUsed(sql, body, admin, allowed)
                case 'fetch-images':   return await fetchImages(sql, body, allowed)
                case 'poll-now':
                    if (!isGlobal) return { statusCode: 403, headers, body: JSON.stringify({ error: 'Global permission required for polling' }) }
                    return await pollNow(sql, admin, event.waitUntil)
                case 'map-team-role':          return await mapTeamRole(sql, body, admin, event)
                case 'update-suggested-match': return await updateSuggestedMatch(sql, body, admin, allowed)
                case 'skip-channel-pending':   return await skipChannelPending(sql, body, admin)
                case 'match-now':              return await matchNow(sql, admin, allowed, body.divisionIds || null)
                case 'send-test-dm':
                    if (!isGlobal) return { statusCode: 403, headers, body: JSON.stringify({ error: 'Global permission required for DMs' }) }
                    return await sendTestDM(sql, body, admin)
                default:
                    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${body.action}` }) }
            }
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    } catch (error) {
        console.error('discord-queue error:', error)
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) }
    }
}


// ═══════════════════════════════════════════════════
// GET: Pending queue items
// ═══════════════════════════════════════════════════
async function getQueue(sql, params, lf) {
    const { channelId, divisionId, status, suggestedMatchId } = params
    const filterStatus = status || 'pending'

    const items = await sql`
        SELECT dq.id, dq.message_id, dq.attachment_id, dq.attachment_filename,
               dq.attachment_url, dq.attachment_size, dq.attachment_width, dq.attachment_height,
               dq.message_content, dq.author_id, dq.author_name, dq.message_timestamp,
               dq.status, dq.suggested_match_id, dq.created_at,
               dc.channel_name, dc.guild_name, dc.division_id,
               d.name as division_name, l.name as league_name
        FROM discord_queue dq
        JOIN discord_channels dc ON dq.channel_id = dc.id
        JOIN divisions d ON dc.division_id = d.id
        JOIN leagues l ON d.league_id = l.id
        WHERE dq.status = ${filterStatus}
        ${lf}
        ${channelId ? sql`AND dc.id = ${parseInt(channelId)}` : sql``}
        ${divisionId ? sql`AND dc.division_id = ${parseInt(divisionId)}` : sql``}
        ${suggestedMatchId ? sql`AND dq.suggested_match_id = ${parseInt(suggestedMatchId)}` : sql``}
        ORDER BY dq.message_timestamp DESC
        LIMIT 200
    `

    return { statusCode: 200, headers, body: JSON.stringify({ items }) }
}


// ═══════════════════════════════════════════════════
// GET: Configured channels
// ═══════════════════════════════════════════════════
async function getChannels(sql, lf) {
    const channels = await sql`
        SELECT dc.id, dc.channel_id, dc.channel_name, dc.guild_id, dc.guild_name,
               dc.division_id, dc.is_active, dc.last_message_id, dc.last_polled_at,
               dc.created_at,
               d.name as division_name, l.name as league_name,
               (SELECT COUNT(*) FROM discord_queue dq WHERE dq.channel_id = dc.id AND dq.status = 'pending') as pending_count
        FROM discord_channels dc
        JOIN divisions d ON dc.division_id = d.id
        JOIN leagues l ON d.league_id = l.id
        WHERE true ${lf}
        ORDER BY l.name, d.name
    `

    return { statusCode: 200, headers, body: JSON.stringify({ channels }) }
}


// ═══════════════════════════════════════════════════
// GET: Queue stats
// ═══════════════════════════════════════════════════
async function getStats(sql, lf) {
    const stats = await sql`
        SELECT dc.id as channel_id, dc.channel_name, dc.guild_name,
               d.name as division_name,
               COUNT(*) FILTER (WHERE dq.status = 'pending') as pending,
               COUNT(*) FILTER (WHERE dq.status = 'used') as used,
               COUNT(*) FILTER (WHERE dq.status = 'skipped') as skipped
        FROM discord_channels dc
        JOIN divisions d ON dc.division_id = d.id
        JOIN leagues l ON d.league_id = l.id
        LEFT JOIN discord_queue dq ON dq.channel_id = dc.id
        WHERE dc.is_active = true ${lf}
        GROUP BY dc.id, dc.channel_name, dc.guild_name, d.name
        ORDER BY d.name
    `

    return { statusCode: 200, headers, body: JSON.stringify({ stats }) }
}


// ═══════════════════════════════════════════════════
// POST: Add a Discord channel mapping
// ═══════════════════════════════════════════════════
async function addChannel(sql, body, admin) {
    const { channel_id, channel_name, guild_id, guild_name, division_id, notification_webhook_url } = body

    if (!channel_id || !guild_id || !division_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'channel_id, guild_id, and division_id are required' }) }
    }

    const [created] = await sql`
        INSERT INTO discord_channels (channel_id, channel_name, guild_id, guild_name, division_id, notification_webhook_url, created_by)
        VALUES (${channel_id}, ${channel_name || null}, ${guild_id}, ${guild_name || null}, ${division_id}, ${notification_webhook_url || null}, ${admin.id})
        ON CONFLICT (channel_id) DO UPDATE SET
            channel_name = COALESCE(EXCLUDED.channel_name, discord_channels.channel_name),
            guild_name = COALESCE(EXCLUDED.guild_name, discord_channels.guild_name),
            division_id = EXCLUDED.division_id,
            notification_webhook_url = EXCLUDED.notification_webhook_url,
            is_active = true,
            updated_at = NOW()
        RETURNING id
    `

    await logAudit(sql, admin, {
        action: 'add-discord-channel', endpoint: 'discord-queue',
        targetType: 'discord_channel', targetId: created.id,
        details: { channel_id, channel_name, guild_id, guild_name, division_id },
    })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, id: created.id }) }
}


// ═══════════════════════════════════════════════════
// POST: Remove (delete) a channel
// ═══════════════════════════════════════════════════
async function removeChannel(sql, body, admin) {
    const { id } = body
    if (!id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    }

    await sql`DELETE FROM discord_channels WHERE id = ${id}`

    await logAudit(sql, admin, {
        action: 'remove-discord-channel', endpoint: 'discord-queue',
        targetType: 'discord_channel', targetId: id,
    })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}


// ═══════════════════════════════════════════════════
// POST: Update queue item status (skip / reset)
// ═══════════════════════════════════════════════════
async function updateQueueStatus(sql, body, admin, allowedLeagues) {
    const { queue_item_ids, status } = body

    if (!queue_item_ids?.length || !status) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'queue_item_ids and status required' }) }
    }

    const allowedStatuses = ['pending', 'skipped']
    if (!allowedStatuses.includes(status)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: `Status must be: ${allowedStatuses.join(', ')}` }) }
    }

    // For league-scoped users, only update items in their leagues
    if (allowedLeagues !== null) {
        await sql`
            UPDATE discord_queue dq
            SET status = ${status}, processed_by = ${admin.id}, processed_at = NOW()
            FROM discord_channels dc
            JOIN divisions d ON dc.division_id = d.id
            WHERE dq.channel_id = dc.id
              AND d.league_id = ANY(${allowedLeagues})
              AND dq.id = ANY(${queue_item_ids})
        `
    } else {
        await sql`
            UPDATE discord_queue
            SET status = ${status}, processed_by = ${admin.id}, processed_at = NOW()
            WHERE id = ANY(${queue_item_ids})
        `
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, updated: queue_item_ids.length }) }
}


// ═══════════════════════════════════════════════════
// POST: Skip all pending items for a channel (Owner only)
// ═══════════════════════════════════════════════════
async function skipChannelPending(sql, body, admin) {
    const { channel_id } = body

    if (!channel_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'channel_id required' }) }
    }

    // Owner check: must have permission_manage
    const [isOwner] = await sql`
        SELECT 1 FROM user_roles ur
        JOIN role_permissions rp ON rp.role_id = ur.role_id
        WHERE ur.user_id = ${admin.id}
          AND rp.permission_key = 'permission_manage'
        LIMIT 1
    `
    if (!isOwner) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Owner permission required' }) }
    }

    const result = await sql`
        UPDATE discord_queue
        SET status = 'skipped', processed_by = ${admin.id}, processed_at = NOW()
        WHERE channel_id = ${channel_id} AND status = 'pending'
    `

    logAudit(sql, admin, { action: 'skip-channel-pending', details: { channel_id, skipped: result.count } }).catch(() => {})

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, skipped: result.count }) }
}


// ═══════════════════════════════════════════════════
// POST: Mark queue items as used (after match submission)
// ═══════════════════════════════════════════════════
async function markUsed(sql, body, admin, allowedLeagues) {
    const { queue_item_ids, match_id } = body

    if (!queue_item_ids?.length) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'queue_item_ids required' }) }
    }

    // Get Discord channel/message IDs before updating, so we can react
    const items = await sql`
        SELECT DISTINCT dq.message_id, dc.channel_id as discord_channel_id
        FROM discord_queue dq
        JOIN discord_channels dc ON dq.channel_id = dc.id
        JOIN divisions d ON dc.division_id = d.id
        WHERE dq.id = ANY(${queue_item_ids})
        ${allowedLeagues !== null ? sql`AND d.league_id = ANY(${allowedLeagues})` : sql``}
    `

    if (allowedLeagues !== null) {
        await sql`
            UPDATE discord_queue dq
            SET status = 'used',
                used_in_match_id = ${match_id || null},
                processed_by = ${admin.id},
                processed_at = NOW()
            FROM discord_channels dc
            JOIN divisions d ON dc.division_id = d.id
            WHERE dq.channel_id = dc.id
              AND d.league_id = ANY(${allowedLeagues})
              AND dq.id = ANY(${queue_item_ids})
        `
    } else {
        await sql`
            UPDATE discord_queue
            SET status = 'used',
                used_in_match_id = ${match_id || null},
                processed_by = ${admin.id},
                processed_at = NOW()
            WHERE id = ANY(${queue_item_ids})
        `
    }

    // React to original Discord messages with 🤖 (fire-and-forget)
    for (const item of items) {
        reactToMessage(item.discord_channel_id, item.message_id).catch(() => {})
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}


// ═══════════════════════════════════════════════════
// POST: Fetch fresh images from Discord (base64)
// ═══════════════════════════════════════════════════
async function fetchImages(sql, body, allowedLeagues) {
    const { queue_item_ids } = body

    if (!queue_item_ids?.length) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'queue_item_ids required' }) }
    }

    // Get queue items with channel info (filtered by allowed leagues)
    const items = await sql`
        SELECT dq.id, dq.message_id, dq.attachment_id, dq.attachment_filename,
               dc.channel_id as discord_channel_id
        FROM discord_queue dq
        JOIN discord_channels dc ON dq.channel_id = dc.id
        JOIN divisions d ON dc.division_id = d.id
        WHERE dq.id = ANY(${queue_item_ids})
        ${allowedLeagues !== null ? sql`AND d.league_id = ANY(${allowedLeagues})` : sql``}
    `

    // Group by message to minimize Discord API calls
    const byMessage = {}
    for (const item of items) {
        if (!byMessage[item.message_id]) {
            byMessage[item.message_id] = { discord_channel_id: item.discord_channel_id, items: [] }
        }
        byMessage[item.message_id].items.push(item)
    }

    const images = []

    for (const [messageId, group] of Object.entries(byMessage)) {
        let message
        try {
            message = await fetchMessage(group.discord_channel_id, messageId)
        } catch (err) {
            for (const item of group.items) {
                images.push({ queue_item_id: item.id, error: err.message })
            }
            continue
        }

        for (const item of group.items) {
            const attachment = message.attachments?.find(a => a.id === item.attachment_id)
            if (!attachment) {
                images.push({ queue_item_id: item.id, error: 'Attachment not found (may have been deleted)' })
                continue
            }

            try {
                const imgRes = await fetch(attachment.url)
                if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status}`)

                const buffer = await imgRes.arrayBuffer()
                const base64 = Buffer.from(buffer).toString('base64')

                images.push({
                    queue_item_id: item.id,
                    data: base64,
                    media_type: attachment.content_type || 'image/png',
                    filename: attachment.filename,
                    width: attachment.width,
                    height: attachment.height,
                })
            } catch (err) {
                images.push({ queue_item_id: item.id, error: `Image download failed: ${err.message}` })
            }
        }
    }

    // Sort by queue_item_id (auto-increment, so chronological) to preserve game order
    images.sort((a, b) => a.queue_item_id - b.queue_item_id)

    return { statusCode: 200, headers, body: JSON.stringify({ images }) }
}


// ═══════════════════════════════════════════════════
// GET: Fetch Discord guild roles (for team-role mapping UI)
// ═══════════════════════════════════════════════════
async function getGuildRoles(params) {
    const { guildId } = params
    if (!guildId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'guildId required' }) }
    }

    const allRoles = await fetchGuildRoles(guildId)

    // Filter out @everyone, bot roles (managed), and high-position admin roles
    const filtered = allRoles
        .filter(r => r.name !== '@everyone' && !r.managed)
        .sort((a, b) => b.position - a.position)
        .map(r => ({ id: r.id, name: r.name, color: r.color }))

    return { statusCode: 200, headers, body: JSON.stringify({ roles: filtered }) }
}


// ═══════════════════════════════════════════════════
// GET: Team-role mappings for a season
// ═══════════════════════════════════════════════════
async function getTeamRoleMappings(sql, params) {
    const { seasonId } = params
    if (!seasonId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'seasonId required' }) }
    }

    const teams = await sql`
        SELECT t.id, t.name, t.color, t.slug, t.discord_role_id,
               s.division_id, d.name as division_name
        FROM teams t
        JOIN seasons s ON t.season_id = s.id
        JOIN divisions d ON s.division_id = d.id
        WHERE t.season_id = ${parseInt(seasonId)}
        ORDER BY t.name
    `

    return { statusCode: 200, headers, body: JSON.stringify({ teams }) }
}


// ═══════════════════════════════════════════════════
// GET: Mapping summary — per-division team role mapping counts
// ═══════════════════════════════════════════════════
async function getMappingSummary(sql, lf) {
    const rows = await sql`
        SELECT d.name as division_name, l.name as league_name, s.name as season_name,
               COUNT(*)::int as total,
               COUNT(t.discord_role_id)::int as mapped
        FROM teams t
        JOIN seasons s ON t.season_id = s.id
        JOIN divisions d ON s.division_id = d.id
        JOIN leagues l ON d.league_id = l.id
        WHERE s.is_active = true ${lf}
        GROUP BY l.name, d.name, s.name
        ORDER BY l.name, d.name
    `

    return { statusCode: 200, headers, body: JSON.stringify({ divisions: rows }) }
}


// ═══════════════════════════════════════════════════
// POST: Map a Discord role to a team
// ═══════════════════════════════════════════════════
async function mapTeamRole(sql, body, admin, event) {
    const { team_id, discord_role_id } = body

    if (!team_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'team_id required' }) }
    }

    const leagueId = await getLeagueIdFromTeam(team_id)
    if (!await requirePermission(event, 'match_report', leagueId)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission for this league' }) }
    }

    // discord_role_id can be null (to unmap)
    await sql`
        UPDATE teams
        SET discord_role_id = ${discord_role_id || null}, updated_at = NOW()
        WHERE id = ${team_id}
    `

    await logAudit(sql, admin, {
        action: 'map-team-role', endpoint: 'discord-queue',
        targetType: 'team', targetId: team_id,
        details: { discord_role_id },
    })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}


// ═══════════════════════════════════════════════════
// GET: Scheduled matches with pending screenshots (ready to report)
// ═══════════════════════════════════════════════════
async function getReadyMatches(sql, lf) {
    const matches = await sql`
        SELECT sm.id, sm.season_id, sm.team1_id, sm.team2_id,
               sm.scheduled_date, sm.week, sm.best_of,
               sm.stage_id, sm.group_id, sm.round_id,
               sm.locked_by, sm.locked_at,
               lock_user.discord_username as locked_by_name,
               t1.name as team1_name, t1.color as team1_color,
               t2.name as team2_name, t2.color as team2_color,
               d.name as division_name, l.name as league_name,
               ss.name as stage_name, sg.name as group_name, sr.name as round_name,
               COUNT(dq.id)::int as screenshot_count,
               MIN(dq.message_timestamp) as first_screenshot_at,
               MAX(dq.message_timestamp) as last_screenshot_at,
               MIN(CASE dq.match_confidence
                   WHEN 'low' THEN 1 WHEN 'medium' THEN 2 WHEN 'high' THEN 3
                   ELSE 0 END) as confidence_rank,
               CASE MIN(CASE dq.match_confidence
                   WHEN 'low' THEN 1 WHEN 'medium' THEN 2 WHEN 'high' THEN 3
                   ELSE 0 END)
                   WHEN 1 THEN 'low' WHEN 2 THEN 'medium' WHEN 3 THEN 'high'
                   ELSE 'unknown' END as match_confidence
        FROM scheduled_matches sm
        LEFT JOIN teams t1 ON sm.team1_id = t1.id
        LEFT JOIN teams t2 ON sm.team2_id = t2.id
        JOIN seasons s ON sm.season_id = s.id
        JOIN divisions d ON s.division_id = d.id
        JOIN leagues l ON d.league_id = l.id
        LEFT JOIN users lock_user ON sm.locked_by = lock_user.id
        LEFT JOIN season_stages ss ON sm.stage_id = ss.id
        LEFT JOIN stage_groups sg ON sm.group_id = sg.id
        LEFT JOIN stage_rounds sr ON sm.round_id = sr.id
        JOIN discord_queue dq ON dq.suggested_match_id = sm.id AND dq.status = 'pending'
        WHERE sm.status = 'scheduled' ${lf}
        GROUP BY sm.id, sm.season_id, sm.team1_id, sm.team2_id,
                 sm.scheduled_date, sm.week, sm.best_of,
                 sm.stage_id, sm.group_id, sm.round_id,
                 sm.locked_by, sm.locked_at, lock_user.discord_username,
                 t1.name, t1.color, t2.name, t2.color,
                 d.name, l.name,
                 ss.name, sg.name, sr.name
        ORDER BY MIN(CASE dq.match_confidence
                     WHEN 'low' THEN 1 WHEN 'medium' THEN 2 WHEN 'high' THEN 3
                     ELSE 0 END) ASC,
                 sm.scheduled_date DESC
    `

    return { statusCode: 200, headers, body: JSON.stringify({ matches }) }
}


// ═══════════════════════════════════════════════════
// POST: Trigger immediate poll
// ═══════════════════════════════════════════════════
async function pollNow(sql, admin, waitUntil) {
    const channels = await sql`SELECT * FROM discord_channels WHERE is_active = true`

    if (!channels.length) {
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'No active channels', results: [] }) }
    }

    // Fetch guild roles + members once per unique guild
    const guildRolesMap = {}
    const guildMembers = {}
    const uniqueGuildIds = [...new Set(channels.map(c => c.guild_id))]

    for (const guildId of uniqueGuildIds) {
        try {
            const roles = await fetchGuildRoles(guildId)
            guildRolesMap[guildId] = new Map(roles.map(r => [r.id, r.name]))
        } catch {
            guildRolesMap[guildId] = new Map()
        }
        try {
            guildMembers[guildId] = await fetchGuildMembers(guildId)
        } catch {
            guildMembers[guildId] = []
        }
    }

    const results = []
    for (const channel of channels) {
        try {
            const roles = guildRolesMap[channel.guild_id] || new Map()
            const result = await pollChannel(sql, channel, roles)
            results.push({ channelId: channel.channel_id, channelName: channel.channel_name, ...result })

            // Auto-match new items — register with waitUntil so CF doesn't kill the context before it finishes
            if (result.newItemIds?.length) {
                waitUntil(autoMatchQueueItems(
                    sql, result.newItemIds, channel,
                    guildMembers[channel.guild_id] || [],
                ).catch(() => {}))
            }
        } catch (err) {
            results.push({ channelId: channel.channel_id, channelName: channel.channel_name, error: err.message })
        }
    }

    await logAudit(sql, admin, {
        action: 'discord-poll-now', endpoint: 'discord-queue',
        details: { channels: results.length, newImages: results.reduce((s, r) => s + (r.newImages || 0), 0) },
    })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, results }) }
}

// ═══════════════════════════════════════════════════
// POST: Re-run auto-matching on all unmatched pending items
// ═══════════════════════════════════════════════════
async function matchNow(sql, admin, allowedLeagues, divisionIds) {
    // Get all pending unmatched items grouped by channel (filtered by allowed leagues + optional divisions)
    const items = await sql`
        SELECT dq.id, dq.channel_id
        FROM discord_queue dq
        JOIN discord_channels dc ON dq.channel_id = dc.id
        JOIN divisions d ON dc.division_id = d.id
        WHERE dq.status = 'pending' AND dq.suggested_match_id IS NULL
        ${allowedLeagues !== null ? sql`AND d.league_id = ANY(${allowedLeagues})` : sql``}
        ${divisionIds ? sql`AND dc.division_id = ANY(${divisionIds})` : sql``}
    `

    if (!items.length) {
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, matched: 0, message: 'No unmatched items' }) }
    }

    // Group item IDs by channel
    const byChannel = {}
    for (const item of items) {
        if (!byChannel[item.channel_id]) byChannel[item.channel_id] = []
        byChannel[item.channel_id].push(item.id)
    }

    // Get channel info for each channel
    const channelIds = Object.keys(byChannel).map(Number)
    const channels = await sql`
        SELECT dc.*, d.name as division_name
        FROM discord_channels dc
        JOIN divisions d ON dc.division_id = d.id
        WHERE dc.id = ANY(${channelIds})
    `

    // Fetch guild members once per unique guild
    const guildMembers = {}
    const uniqueGuildIds = [...new Set(channels.map(c => c.guild_id))]
    for (const guildId of uniqueGuildIds) {
        try {
            guildMembers[guildId] = await fetchGuildMembers(guildId)
        } catch {
            guildMembers[guildId] = []
        }
    }

    let totalMatched = 0
    for (const channel of channels) {
        const itemIds = byChannel[channel.id]
        if (!itemIds?.length) continue

        try {
            await autoMatchQueueItems(sql, itemIds, channel, guildMembers[channel.guild_id] || [])
            // Count how many got matched
            const [{ count }] = await sql`
                SELECT COUNT(*)::int as count FROM discord_queue
                WHERE id = ANY(${itemIds}) AND suggested_match_id IS NOT NULL
            `
            totalMatched += count
        } catch (err) {
            console.error(`match-now: channel ${channel.id} failed:`, err.message)
        }
    }

    logAudit(sql, admin, {
        action: 'discord-match-now', endpoint: 'discord-queue',
        details: { unmatched: items.length, matched: totalMatched },
    }).catch(() => {})

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, total: items.length, matched: totalMatched }) }
}

// ═══════════════════════════════════════════════════
// GET: Match review — unmatched + matched queue items
// ═══════════════════════════════════════════════════
async function getMatchReview(sql, lf) {
    // Unmatched pending items (no suggested_match_id)
    const unmatched = await sql`
        SELECT dq.id, dq.attachment_filename, dq.author_name, dq.author_id,
               dq.message_content, dq.message_timestamp, dq.attachment_url,
               dc.channel_name, dc.division_id,
               d.name as division_name, l.name as league_name
        FROM discord_queue dq
        JOIN discord_channels dc ON dq.channel_id = dc.id
        JOIN divisions d ON dc.division_id = d.id
        JOIN leagues l ON d.league_id = l.id
        WHERE dq.status = 'pending' AND dq.suggested_match_id IS NULL ${lf}
        ORDER BY dq.message_timestamp DESC
        LIMIT 100
    `

    // Matched pending items grouped by scheduled match
    const matched = await sql`
        SELECT sm.id as match_id, sm.team1_id, sm.team2_id,
               sm.scheduled_date, sm.week, sm.season_id,
               t1.name as team1_name, t1.color as team1_color,
               t2.name as team2_name, t2.color as team2_color,
               d.name as division_name,
               COUNT(dq.id)::int as screenshot_count,
               json_agg(json_build_object(
                   'id', dq.id,
                   'author_name', dq.author_name,
                   'attachment_filename', dq.attachment_filename,
                   'message_timestamp', dq.message_timestamp,
                   'match_confidence', dq.match_confidence
               ) ORDER BY dq.message_timestamp) as items
        FROM discord_queue dq
        JOIN scheduled_matches sm ON dq.suggested_match_id = sm.id
        JOIN teams t1 ON sm.team1_id = t1.id
        JOIN teams t2 ON sm.team2_id = t2.id
        JOIN seasons s ON sm.season_id = s.id
        JOIN divisions d ON s.division_id = d.id
        JOIN leagues l ON d.league_id = l.id
        WHERE dq.status = 'pending' ${lf}
        GROUP BY sm.id, sm.team1_id, sm.team2_id, sm.scheduled_date, sm.week,
                 sm.season_id, t1.name, t1.color, t2.name, t2.color, d.name
        ORDER BY sm.scheduled_date DESC
    `

    // Get scheduled matches for manual assignment dropdown
    const scheduledMatches = await sql`
        SELECT sm.id, sm.team1_id, sm.team2_id, sm.scheduled_date, sm.week,
               t1.name as team1_name, t2.name as team2_name,
               d.name as division_name,
               ss.name as stage_name, sg.name as group_name, sr.name as round_name
        FROM scheduled_matches sm
        LEFT JOIN teams t1 ON sm.team1_id = t1.id
        LEFT JOIN teams t2 ON sm.team2_id = t2.id
        JOIN seasons s ON sm.season_id = s.id
        JOIN divisions d ON s.division_id = d.id
        JOIN leagues l ON d.league_id = l.id
        LEFT JOIN season_stages ss ON sm.stage_id = ss.id
        LEFT JOIN stage_groups sg ON sm.group_id = sg.id
        LEFT JOIN stage_rounds sr ON sm.round_id = sr.id
        WHERE sm.status = 'scheduled' ${lf}
        ORDER BY d.name, ss.sort_order NULLS FIRST, sm.scheduled_date DESC
    `

    return { statusCode: 200, headers, body: JSON.stringify({ unmatched, matched, scheduledMatches }) }
}


// ═══════════════════════════════════════════════════
// GET: Member sync status — players with/without discord mapping
// ═══════════════════════════════════════════════════
async function getMemberSyncStatus(sql, lf) {
    // Teams with discord roles + their players' discord link status
    const teamPlayers = await sql`
        SELECT t.id as team_id, t.name as team_name, t.color, t.discord_role_id,
               p.id as player_id, p.name as player_name, p.discord_id, p.discord_name,
               d.name as division_name, s.id as season_id
        FROM teams t
        JOIN seasons s ON t.season_id = s.id AND s.is_active = true
        JOIN divisions d ON s.division_id = d.id
        JOIN leagues l ON d.league_id = l.id
        LEFT JOIN league_players lp ON lp.team_id = t.id
        LEFT JOIN players p ON lp.player_id = p.id
        WHERE t.discord_role_id IS NOT NULL ${lf}
        ORDER BY d.name, t.name, p.name
    `

    // Summary stats (filtered to user's allowed leagues)
    const summary = await sql`
        SELECT
            COUNT(DISTINCT t.id)::int as teams_with_roles,
            COUNT(DISTINCT CASE WHEN p.discord_id IS NOT NULL OR p.discord_name IS NOT NULL THEN p.id END)::int as players_linked,
            COUNT(DISTINCT CASE WHEN p.discord_id IS NULL AND p.discord_name IS NULL AND p.id IS NOT NULL THEN p.id END)::int as players_unlinked
        FROM teams t
        JOIN seasons s ON t.season_id = s.id AND s.is_active = true
        JOIN divisions d ON s.division_id = d.id
        JOIN leagues l ON d.league_id = l.id
        LEFT JOIN league_players lp ON lp.team_id = t.id
        LEFT JOIN players p ON lp.player_id = p.id
        WHERE t.discord_role_id IS NOT NULL ${lf}
    `

    return { statusCode: 200, headers, body: JSON.stringify({ teamPlayers, summary: summary[0] }) }
}


// ═══════════════════════════════════════════════════
// GET: Recent discord-related audit log entries
// ═══════════════════════════════════════════════════
async function getDiscordActivity(sql, lf, allowed) {
    const entries = await sql`
        SELECT al.id, al.user_id, al.action, al.endpoint, al.target_type,
               al.target_id, al.details, al.created_at,
               u.discord_username as admin_name
        FROM audit_log al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.endpoint = 'discord-queue'
        ${allowed !== null ? sql`AND (al.league_id IS NULL OR al.league_id = ANY(${allowed}))` : sql``}
        ORDER BY al.created_at DESC
        LIMIT 50
    `

    return { statusCode: 200, headers, body: JSON.stringify({ entries }) }
}


// ═══════════════════════════════════════════════════
// POST: Manually assign/change suggested_match_id on queue items
// ═══════════════════════════════════════════════════
async function updateSuggestedMatch(sql, body, admin, allowedLeagues) {
    const { queue_item_ids, scheduled_match_id } = body

    if (!queue_item_ids?.length) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'queue_item_ids required' }) }
    }

    // scheduled_match_id can be null (to unlink)
    if (allowedLeagues !== null) {
        await sql`
            UPDATE discord_queue dq
            SET suggested_match_id = ${scheduled_match_id || null}
            FROM discord_channels dc
            JOIN divisions d ON dc.division_id = d.id
            WHERE dq.channel_id = dc.id
              AND d.league_id = ANY(${allowedLeagues})
              AND dq.id = ANY(${queue_item_ids}) AND dq.status = 'pending'
        `
    } else {
        await sql`
            UPDATE discord_queue
            SET suggested_match_id = ${scheduled_match_id || null}
            WHERE id = ANY(${queue_item_ids}) AND status = 'pending'
        `
    }

    await logAudit(sql, admin, {
        action: 'update-suggested-match', endpoint: 'discord-queue',
        details: { queue_item_ids, scheduled_match_id },
    })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}


// ═══════════════════════════════════════════════════
// POST: Send a test DM to a Discord user
// ═══════════════════════════════════════════════════
async function sendTestDM(sql, body, admin) {
    const { discord_user_id, message } = body

    if (!discord_user_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'discord_user_id required' }) }
    }

    const testMessage = message?.trim() || 'This is a test DM from the SMITE 2 Companion bot. If you received this, DMs are working correctly!'

    await sendDM(discord_user_id, {
        embeds: [{
            title: '🤖 Bot DM Test',
            description: testMessage,
            color: 0x5865f2,
            footer: { text: `Sent by ${admin.discord_username || admin.id}` },
            timestamp: new Date().toISOString(),
        }],
    })

    await logAudit(sql, admin, {
        action: 'send-test-dm', endpoint: 'discord-queue',
        details: { discord_user_id },
    })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}


export const onRequest = adapt(handler)

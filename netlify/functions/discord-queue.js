/* global process */
import { getDB, adminHeaders as headers } from './lib/db.js'
import { requirePermission } from './lib/auth.js'
import { logAudit } from './lib/audit.js'
import { fetchMessage, pollChannel } from './lib/discord.js'

export const config = {
    maxDuration: 60,
}

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const admin = await requirePermission(event, 'match_report')
    if (!admin) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const sql = getDB()

    try {
        // ─── GET ───
        if (event.httpMethod === 'GET') {
            const params = event.queryStringParameters || {}
            switch (params.action) {
                case 'queue':    return await getQueue(sql, params)
                case 'channels': return await getChannels(sql)
                case 'stats':    return await getStats(sql)
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
                case 'add-channel':    return await addChannel(sql, body, admin)
                case 'remove-channel': return await removeChannel(sql, body, admin)
                case 'update-status':  return await updateQueueStatus(sql, body, admin)
                case 'mark-used':      return await markUsed(sql, body, admin)
                case 'fetch-images':   return await fetchImages(sql, body)
                case 'poll-now':       return await pollNow(sql, admin)
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
async function getQueue(sql, params) {
    const { channelId, divisionId, status } = params
    const filterStatus = status || 'pending'

    const items = await sql`
        SELECT dq.id, dq.message_id, dq.attachment_id, dq.attachment_filename,
               dq.attachment_url, dq.attachment_size, dq.attachment_width, dq.attachment_height,
               dq.message_content, dq.author_name, dq.message_timestamp,
               dq.status, dq.created_at,
               dc.channel_name, dc.guild_name, dc.division_id,
               d.name as division_name, l.name as league_name
        FROM discord_queue dq
        JOIN discord_channels dc ON dq.channel_id = dc.id
        JOIN divisions d ON dc.division_id = d.id
        JOIN leagues l ON d.league_id = l.id
        WHERE dq.status = ${filterStatus}
        ${channelId ? sql`AND dc.id = ${parseInt(channelId)}` : sql``}
        ${divisionId ? sql`AND dc.division_id = ${parseInt(divisionId)}` : sql``}
        ORDER BY dq.message_timestamp DESC
        LIMIT 200
    `

    return { statusCode: 200, headers, body: JSON.stringify({ items }) }
}


// ═══════════════════════════════════════════════════
// GET: Configured channels
// ═══════════════════════════════════════════════════
async function getChannels(sql) {
    const channels = await sql`
        SELECT dc.id, dc.channel_id, dc.channel_name, dc.guild_id, dc.guild_name,
               dc.division_id, dc.is_active, dc.last_message_id, dc.last_polled_at,
               dc.created_at,
               d.name as division_name, l.name as league_name,
               (SELECT COUNT(*) FROM discord_queue dq WHERE dq.channel_id = dc.id AND dq.status = 'pending') as pending_count
        FROM discord_channels dc
        JOIN divisions d ON dc.division_id = d.id
        JOIN leagues l ON d.league_id = l.id
        ORDER BY l.name, d.name
    `

    return { statusCode: 200, headers, body: JSON.stringify({ channels }) }
}


// ═══════════════════════════════════════════════════
// GET: Queue stats
// ═══════════════════════════════════════════════════
async function getStats(sql) {
    const stats = await sql`
        SELECT dc.id as channel_id, dc.channel_name, dc.guild_name,
               d.name as division_name,
               COUNT(*) FILTER (WHERE dq.status = 'pending') as pending,
               COUNT(*) FILTER (WHERE dq.status = 'used') as used,
               COUNT(*) FILTER (WHERE dq.status = 'skipped') as skipped
        FROM discord_channels dc
        JOIN divisions d ON dc.division_id = d.id
        LEFT JOIN discord_queue dq ON dq.channel_id = dc.id
        WHERE dc.is_active = true
        GROUP BY dc.id, dc.channel_name, dc.guild_name, d.name
        ORDER BY d.name
    `

    return { statusCode: 200, headers, body: JSON.stringify({ stats }) }
}


// ═══════════════════════════════════════════════════
// POST: Add a Discord channel mapping
// ═══════════════════════════════════════════════════
async function addChannel(sql, body, admin) {
    const { channel_id, channel_name, guild_id, guild_name, division_id } = body

    if (!channel_id || !guild_id || !division_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'channel_id, guild_id, and division_id are required' }) }
    }

    const [created] = await sql`
        INSERT INTO discord_channels (channel_id, channel_name, guild_id, guild_name, division_id, created_by)
        VALUES (${channel_id}, ${channel_name || null}, ${guild_id}, ${guild_name || null}, ${division_id}, ${admin.id})
        ON CONFLICT (channel_id) DO UPDATE SET
            channel_name = COALESCE(EXCLUDED.channel_name, discord_channels.channel_name),
            guild_name = COALESCE(EXCLUDED.guild_name, discord_channels.guild_name),
            division_id = EXCLUDED.division_id,
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
// POST: Remove (deactivate) a channel
// ═══════════════════════════════════════════════════
async function removeChannel(sql, body, admin) {
    const { id } = body
    if (!id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    }

    await sql`
        UPDATE discord_channels SET is_active = false, updated_at = NOW()
        WHERE id = ${id}
    `

    await logAudit(sql, admin, {
        action: 'remove-discord-channel', endpoint: 'discord-queue',
        targetType: 'discord_channel', targetId: id,
    })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}


// ═══════════════════════════════════════════════════
// POST: Update queue item status (skip / reset)
// ═══════════════════════════════════════════════════
async function updateQueueStatus(sql, body, admin) {
    const { queue_item_ids, status } = body

    if (!queue_item_ids?.length || !status) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'queue_item_ids and status required' }) }
    }

    const allowed = ['pending', 'skipped']
    if (!allowed.includes(status)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: `Status must be: ${allowed.join(', ')}` }) }
    }

    await sql`
        UPDATE discord_queue
        SET status = ${status}, processed_by = ${admin.id}, processed_at = NOW()
        WHERE id = ANY(${queue_item_ids})
    `

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, updated: queue_item_ids.length }) }
}


// ═══════════════════════════════════════════════════
// POST: Mark queue items as used (after match submission)
// ═══════════════════════════════════════════════════
async function markUsed(sql, body, admin) {
    const { queue_item_ids, match_id } = body

    if (!queue_item_ids?.length) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'queue_item_ids required' }) }
    }

    await sql`
        UPDATE discord_queue
        SET status = 'used',
            used_in_match_id = ${match_id || null},
            processed_by = ${admin.id},
            processed_at = NOW()
        WHERE id = ANY(${queue_item_ids})
    `

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}


// ═══════════════════════════════════════════════════
// POST: Fetch fresh images from Discord (base64)
// ═══════════════════════════════════════════════════
async function fetchImages(sql, body) {
    const { queue_item_ids } = body

    if (!queue_item_ids?.length) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'queue_item_ids required' }) }
    }

    // Get queue items with channel info
    const items = await sql`
        SELECT dq.id, dq.message_id, dq.attachment_id, dq.attachment_filename,
               dc.channel_id as discord_channel_id
        FROM discord_queue dq
        JOIN discord_channels dc ON dq.channel_id = dc.id
        WHERE dq.id = ANY(${queue_item_ids})
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

    return { statusCode: 200, headers, body: JSON.stringify({ images }) }
}


// ═══════════════════════════════════════════════════
// POST: Trigger immediate poll
// ═══════════════════════════════════════════════════
async function pollNow(sql, admin) {
    const channels = await sql`SELECT * FROM discord_channels WHERE is_active = true`

    if (!channels.length) {
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'No active channels', results: [] }) }
    }

    const results = []
    for (const channel of channels) {
        try {
            const result = await pollChannel(sql, channel)
            results.push({ channelId: channel.channel_id, channelName: channel.channel_name, ...result })
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

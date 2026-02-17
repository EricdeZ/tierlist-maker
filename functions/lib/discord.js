/* global process */
const DISCORD_API = 'https://discord.com/api/v10'

export function getDiscordHeaders() {
    const botToken = process.env.DISCORD_BOT_TOKEN
    if (!botToken) throw new Error('DISCORD_BOT_TOKEN not configured')
    return { Authorization: `Bot ${botToken}` }
}

export async function fetchChannelMessages(channelId, afterId, limit = 100) {
    const url = new URL(`${DISCORD_API}/channels/${channelId}/messages`)
    url.searchParams.set('limit', String(limit))
    if (afterId) url.searchParams.set('after', afterId)

    const res = await fetch(url, { headers: getDiscordHeaders() })
    if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Discord API ${res.status}: ${text.slice(0, 200)}`)
    }
    return res.json()
}

export async function fetchMessage(channelId, messageId) {
    const res = await fetch(
        `${DISCORD_API}/channels/${channelId}/messages/${messageId}`,
        { headers: getDiscordHeaders() },
    )
    if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Discord API ${res.status}: ${text.slice(0, 200)}`)
    }
    return res.json()
}

/**
 * React to a Discord message with an emoji. Fire-and-forget.
 */
export async function reactToMessage(channelId, messageId, emoji = '🤖') {
    const encoded = encodeURIComponent(emoji)
    const res = await fetch(
        `${DISCORD_API}/channels/${channelId}/messages/${messageId}/reactions/${encoded}/@me`,
        { method: 'PUT', headers: getDiscordHeaders() },
    )
    if (!res.ok) {
        const text = await res.text().catch(() => '')
        console.error(`Discord react failed ${res.status}: ${text.slice(0, 200)}`)
    }
}

/**
 * Fetch all roles for a guild.
 * Returns array of { id, name, color, position }.
 */
export async function fetchGuildRoles(guildId) {
    const res = await fetch(
        `${DISCORD_API}/guilds/${guildId}/roles`,
        { headers: getDiscordHeaders() },
    )
    if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Discord API ${res.status}: ${text.slice(0, 200)}`)
    }
    return res.json()
}

/**
 * Fetch guild members with pagination.
 * Returns array of member objects with user.id and roles[].
 * Requires GUILD_MEMBERS privileged intent.
 */
export async function fetchGuildMembers(guildId, limit = 1000) {
    const allMembers = []
    let afterId = '0'

    while (allMembers.length < limit) {
        const batchSize = Math.min(1000, limit - allMembers.length)
        const url = new URL(`${DISCORD_API}/guilds/${guildId}/members`)
        url.searchParams.set('limit', String(batchSize))
        url.searchParams.set('after', afterId)

        const res = await fetch(url, { headers: getDiscordHeaders() })
        if (!res.ok) {
            const text = await res.text().catch(() => '')
            throw new Error(`Discord API ${res.status}: ${text.slice(0, 200)}`)
        }

        const batch = await res.json()
        if (!batch.length) break

        allMembers.push(...batch)
        afterId = batch[batch.length - 1].user.id

        if (batch.length < batchSize) break // no more pages
    }

    return allMembers
}

/**
 * Replace Discord role mentions (<@&ROLE_ID>) with readable @RoleName.
 * @param {string} content - Raw message content
 * @param {Map<string, string>} rolesMap - Map of roleId → roleName
 * @returns {string} Content with resolved role mentions
 */
export function resolveRoleMentions(content, rolesMap) {
    if (!content || !rolesMap) return content
    return content.replace(/<@&(\d+)>/g, (match, roleId) => {
        const name = rolesMap.get(roleId)
        return name ? `@${name}` : match
    })
}

/**
 * Send a message to a Discord webhook.
 * @param {string} webhookUrl - Full Discord webhook URL
 * @param {object} options - { content, embeds }
 */
export async function sendWebhook(webhookUrl, { content, embeds }) {
    const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, embeds }),
    })
    if (!res.ok) {
        const text = await res.text().catch(() => '')
        console.error(`Discord webhook failed ${res.status}: ${text.slice(0, 200)}`)
    }
}

function isImageAttachment(att) {
    return (
        att.content_type?.startsWith('image/') ||
        /\.(png|jpg|jpeg|gif|webp)$/i.test(att.filename || '')
    )
}

/**
 * Poll a single Discord channel for new image-containing messages.
 * Inserts new attachments into discord_queue with ON CONFLICT DO NOTHING.
 * @param {object} sql - Database connection
 * @param {object} channel - discord_channels row
 * @param {Map<string, string>} [guildRoles] - Optional Map of roleId → roleName for mention resolution
 * @returns {{ totalMessages: number, newImages: number, newItemIds: number[] }}
 */
export async function pollChannel(sql, channel, guildRoles) {
    let afterId = channel.last_message_id
    let highestId = afterId
    let totalMessages = 0
    let newImages = 0
    const newItemIds = []

    // Build fallback role→name map from team discord_role_ids for this division
    // Used when guild roles fetch fails (guildRoles is empty)
    let teamRoleFallback = null
    if (!guildRoles || guildRoles.size === 0) {
        const teamRoles = await sql`
            SELECT t.discord_role_id, t.name
            FROM teams t
            JOIN seasons s ON t.season_id = s.id
            WHERE s.division_id = ${channel.division_id} AND s.is_active = true
              AND t.discord_role_id IS NOT NULL
        `
        if (teamRoles.length) {
            teamRoleFallback = new Map(teamRoles.map(r => [r.discord_role_id, r.name]))
        }
    }
    const roleMap = (guildRoles && guildRoles.size > 0) ? guildRoles : teamRoleFallback

    // Discord "after" returns messages with id > afterId, sorted ascending (oldest first).
    // We paginate by taking the last (newest) id from each batch as the new afterId.
    while (totalMessages < 500) {
        const messages = await fetchChannelMessages(channel.channel_id, afterId)
        if (!messages.length) break

        // messages come sorted ascending when using "after", so last = newest
        const newestInBatch = messages[messages.length - 1].id
        if (!highestId || BigInt(newestInBatch) > BigInt(highestId)) {
            highestId = newestInBatch
        }

        for (const msg of messages) {
            // Resolve role mentions in message content
            // Uses guild roles if available, falls back to team role IDs → team names
            const resolvedContent = resolveRoleMentions(
                (msg.content || '').substring(0, 2000),
                roleMap,
            )

            // Collect images from direct attachments + forwarded message snapshots
            const directImages = (msg.attachments || []).filter(isImageAttachment)
            const snapshotImages = (msg.message_snapshots || [])
                .flatMap(s => (s.message?.attachments || []).filter(isImageAttachment))
            const images = [...directImages, ...snapshotImages]
            for (const att of images) {
                const result = await sql`
                    INSERT INTO discord_queue (
                        channel_id, message_id, attachment_id,
                        attachment_filename, attachment_url,
                        attachment_size, attachment_width, attachment_height,
                        message_content, author_id, author_name,
                        message_timestamp
                    ) VALUES (
                        ${channel.id}, ${msg.id}, ${att.id},
                        ${att.filename}, ${att.url},
                        ${att.size || null}, ${att.width || null}, ${att.height || null},
                        ${resolvedContent},
                        ${msg.author?.id || null}, ${msg.author?.username || null},
                        ${msg.timestamp}
                    )
                    ON CONFLICT (message_id, attachment_id) DO NOTHING
                    RETURNING id
                `
                if (result.length) {
                    newImages++
                    newItemIds.push(result[0].id)
                }
            }
        }

        totalMessages += messages.length
        if (messages.length < 100) break // no more pages
        afterId = newestInBatch
    }

    // Update poll cursor
    if (highestId && highestId !== channel.last_message_id) {
        await sql`
            UPDATE discord_channels
            SET last_message_id = ${highestId}, last_polled_at = NOW(), updated_at = NOW()
            WHERE id = ${channel.id}
        `
    }

    return { totalMessages, newImages, newItemIds }
}

/**
 * Find the most recent message in a channel that parses as a valid ban list.
 * Returns the Discord message object, or null if none found.
 */
async function findBanListMessage(channelId) {
    // Without 'after', Discord returns the most recent messages (newest first)
    const messages = await fetchChannelMessages(channelId, null, 50)
    for (const msg of messages) {
        const parsed = parseBanListText(msg.content || '')
        if (parsed.sections.length > 0) return msg
    }
    return null
}

/**
 * Sync a single banned-content message from Discord.
 * Tries the stored message_id first; if it fails (deleted), scans the channel
 * for the most recent message that looks like a ban list.
 */
export async function syncBanList(sql, config) {
    let msg

    // Try fetching the stored message first
    if (config.message_id) {
        try {
            msg = await fetchMessage(config.channel_id, config.message_id)
        } catch {
            // Message was likely deleted — fall through to channel scan
            console.log(`syncBanList: stored message ${config.message_id} not found, scanning channel`)
        }
    }

    // If no message found (no message_id stored, or fetch failed), scan the channel
    if (!msg) {
        msg = await findBanListMessage(config.channel_id)
        if (!msg) throw new Error('No ban list message found in channel')
    }

    const parsed = parseBanListText(msg.content || '')

    await sql`
        INSERT INTO banned_content (league_id, channel_id, message_id, raw_content, parsed_data, last_synced_at)
        VALUES (${config.league_id}, ${config.channel_id}, ${msg.id}, ${msg.content}, ${JSON.stringify(parsed)}, NOW())
        ON CONFLICT (league_id) DO UPDATE SET
            message_id = EXCLUDED.message_id,
            raw_content = EXCLUDED.raw_content,
            parsed_data = EXCLUDED.parsed_data,
            last_synced_at = NOW(),
            updated_at = NOW()
    `
}

// Inline parser (same logic as src/utils/banListParser.js, kept here to avoid cross-directory imports)
const KNOWN_HEADERS = [
    'item bans', 'relic bans', 'god bans', 'aspect bans',
    'bug abuse', 'pick at your own risk', 'skin bans', 'notes',
]

function stripMarkdown(text) {
    return text
        .replace(/\*\*\__(.*?)__\*\*/g, '$1')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/__(.*?)__/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/~~(.*?)~~/g, '$1')
        .replace(/`(.*?)`/g, '$1')
}

function parseBanListText(text) {
    if (!text) return { title: null, updated: null, sections: [] }

    const lines = text.split('\n').map(l => l.trim())
    const sections = []
    let title = null
    let updated = null
    let currentSection = null

    for (const rawLine of lines) {
        if (!rawLine) continue
        const line = stripMarkdown(rawLine).trim()
        if (!line) continue
        if (/^updated\s+\d/i.test(line)) {
            updated = line.replace(/^updated\s+/i, '').trim()
            continue
        }
        const lower = line.replace(/:$/, '').trim().toLowerCase()
        if (line.endsWith(':') || KNOWN_HEADERS.includes(lower)) {
            currentSection = { name: line.replace(/:$/, '').trim(), items: [] }
            sections.push(currentSection)
            continue
        }
        if (!currentSection) {
            if (!title) title = line
            continue
        }
        currentSection.items.push(line)
    }

    return { title, updated, sections }
}

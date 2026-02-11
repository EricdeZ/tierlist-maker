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

function isImageAttachment(att) {
    return (
        att.content_type?.startsWith('image/') ||
        /\.(png|jpg|jpeg|gif|webp)$/i.test(att.filename || '')
    )
}

/**
 * Poll a single Discord channel for new image-containing messages.
 * Inserts new attachments into discord_queue with ON CONFLICT DO NOTHING.
 * Returns { totalMessages, newImages }.
 */
export async function pollChannel(sql, channel) {
    let afterId = channel.last_message_id
    let highestId = afterId
    let totalMessages = 0
    let newImages = 0

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
            const images = (msg.attachments || []).filter(isImageAttachment)
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
                        ${(msg.content || '').substring(0, 2000)},
                        ${msg.author?.id || null}, ${msg.author?.username || null},
                        ${msg.timestamp}
                    )
                    ON CONFLICT (message_id, attachment_id) DO NOTHING
                    RETURNING id
                `
                if (result.length) newImages++
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

    return { totalMessages, newImages }
}

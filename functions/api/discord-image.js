import { adapt } from '../lib/adapter.js'
import { getDB, adminHeaders as headers } from '../lib/db.js'
import { requirePermission } from '../lib/auth.js'
import { fetchMessage } from '../lib/discord.js'


const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    }

    // Support token via query param (for <img> tags that can't send headers)
    const params = event.queryStringParameters || {}
    if (params.token && !event.headers.authorization) {
        event.headers.authorization = `Bearer ${params.token}`
    }

    const admin = await requirePermission(event, 'match_report')
    if (!admin) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const { queueId } = params
    if (!queueId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'queueId required' }) }
    }

    const sql = getDB()

    try {
        // Look up queue item + channel info
        const [item] = await sql`
            SELECT dq.message_id, dq.attachment_id, dc.channel_id as discord_channel_id
            FROM discord_queue dq
            JOIN discord_channels dc ON dq.channel_id = dc.id
            WHERE dq.id = ${parseInt(queueId)}
        `

        if (!item) {
            return { statusCode: 404, headers, body: JSON.stringify({ error: 'Queue item not found' }) }
        }

        // Fetch fresh message from Discord API
        const message = await fetchMessage(item.discord_channel_id, item.message_id)

        // Find the attachment in the fresh message
        const allAttachments = [
            ...(message.attachments || []),
            ...(message.message_snapshots || []).flatMap(s => s.message?.attachments || []),
        ]
        const attachment = allAttachments.find(a => a.id === item.attachment_id)

        if (!attachment) {
            return { statusCode: 404, headers, body: JSON.stringify({ error: 'Attachment not found (may have been deleted)' }) }
        }

        // Proxy the image through to the client
        const imgRes = await fetch(attachment.url)
        if (!imgRes.ok) {
            return { statusCode: 502, headers, body: JSON.stringify({ error: `Discord CDN returned ${imgRes.status}` }) }
        }

        const imageHeaders = {
            'Content-Type': attachment.content_type || 'image/png',
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        }

        return {
            statusCode: 200,
            headers: imageHeaders,
            // Return raw body — adapter will wrap in Response
            rawBody: imgRes,
        }
    } catch (error) {
        console.error('discord-image error:', error)
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) }
    }
}


// Custom adapter that handles streaming image responses
export async function onRequest(context) {
    const { request, env } = context

    // Populate process.env from Cloudflare env bindings
    for (const [key, value] of Object.entries(env)) {
        if (typeof value === 'string') {
            process.env[key] = value
        }
    }

    const url = new URL(request.url)
    const queryStringParameters = {}
    for (const [key, value] of url.searchParams) {
        queryStringParameters[key] = value
    }

    const headers = {}
    for (const [key, value] of request.headers) {
        headers[key.toLowerCase()] = value
    }

    const event = {
        httpMethod: request.method,
        headers,
        queryStringParameters,
        body: null,
        path: url.pathname,
        rawUrl: request.url,
    }

    const result = await handler(event)

    // If rawBody is a fetch Response, stream it through with our headers
    if (result.rawBody && result.rawBody instanceof Response) {
        return new Response(result.rawBody.body, {
            status: result.statusCode || 200,
            headers: result.headers || {},
        })
    }

    return new Response(result.body || '', {
        status: result.statusCode || 200,
        headers: result.headers || {},
    })
}

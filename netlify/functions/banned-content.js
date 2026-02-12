/* global process */
import { getDB, headers, adminHeaders, getHeaders, handleCors } from './lib/db.js'
import { requirePermission } from './lib/auth.js'
import { logAudit } from './lib/audit.js'
import { fetchMessage, syncBanList } from './lib/discord.js'

export const handler = async (event) => {
    // ─── GET (public): return ban list for a league ───
    if (event.httpMethod === 'GET') {
        const cors = handleCors(event)
        if (cors) return cors

        const sql = getDB()
        const { leagueId } = event.queryStringParameters || {}

        if (!leagueId) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'leagueId required' }) }
        }

        try {
            const [banList] = await sql`
                SELECT parsed_data, last_synced_at
                FROM banned_content
                WHERE league_id = ${parseInt(leagueId)}
            `

            return {
                statusCode: 200,
                headers: getHeaders(event),
                body: JSON.stringify({ banList: banList || null }),
            }
        } catch (error) {
            console.error('banned-content GET error:', error)
            return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) }
        }
    }

    // ─── OPTIONS (admin CORS) ───
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: adminHeaders, body: '' }
    }

    // ─── POST (admin): manage banned content ───
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    }

    const admin = await requirePermission(event, 'league_manage')
    if (!admin) {
        return { statusCode: 401, headers: adminHeaders, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const sql = getDB()

    try {
        if (!event.body) {
            return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'Request body required' }) }
        }
        const body = JSON.parse(event.body)

        switch (body.action) {
            case 'configure': return await configure(sql, body, admin)
            case 'sync':      return await sync(sql, body, admin)
            case 'list':      return await list(sql)
            case 'remove':    return await remove(sql, body, admin)
            default:
                return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: `Unknown action: ${body.action}` }) }
        }
    } catch (error) {
        console.error('banned-content POST error:', error)
        return { statusCode: 500, headers: adminHeaders, body: JSON.stringify({ error: error.message }) }
    }
}


// ═══════════════════════════════════════════════════
// POST: Configure channel + message for a league
// ═══════════════════════════════════════════════════
async function configure(sql, body, admin) {
    const { league_id, channel_id, message_id } = body

    if (!league_id || !channel_id || !message_id) {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'league_id, channel_id, and message_id required' }) }
    }

    // Verify message exists by fetching it
    let msg
    try {
        msg = await fetchMessage(channel_id, message_id)
    } catch (err) {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: `Failed to fetch Discord message: ${err.message}` }) }
    }

    // Sync immediately
    await syncBanList(sql, { league_id, channel_id, message_id })

    await logAudit(sql, admin, {
        action: 'configure-banned-content', endpoint: 'banned-content',
        leagueId: league_id,
        targetType: 'banned_content',
        details: { channel_id, message_id },
    })

    return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ success: true }) }
}


// ═══════════════════════════════════════════════════
// POST: Sync (re-fetch) ban list from Discord
// ═══════════════════════════════════════════════════
async function sync(sql, body, admin) {
    const { league_id } = body

    const configs = league_id
        ? await sql`SELECT * FROM banned_content WHERE league_id = ${league_id} AND channel_id IS NOT NULL AND message_id IS NOT NULL`
        : await sql`SELECT * FROM banned_content WHERE channel_id IS NOT NULL AND message_id IS NOT NULL`

    const results = []
    for (const config of configs) {
        try {
            await syncBanList(sql, config)
            results.push({ leagueId: config.league_id, success: true })
        } catch (err) {
            results.push({ leagueId: config.league_id, error: err.message })
        }
    }

    await logAudit(sql, admin, {
        action: 'sync-banned-content', endpoint: 'banned-content',
        leagueId: league_id || null,
        details: { results },
    })

    return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ success: true, results }) }
}


// ═══════════════════════════════════════════════════
// POST: List all configured ban lists
// ═══════════════════════════════════════════════════
async function list(sql) {
    const configs = await sql`
        SELECT bc.id, bc.league_id, bc.channel_id, bc.message_id,
               bc.last_synced_at, bc.parsed_data,
               l.name as league_name, l.slug as league_slug
        FROM banned_content bc
        JOIN leagues l ON bc.league_id = l.id
        ORDER BY l.name
    `

    return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ configs }) }
}


// ═══════════════════════════════════════════════════
// POST: Remove ban list config for a league
// ═══════════════════════════════════════════════════
async function remove(sql, body, admin) {
    const { league_id } = body
    if (!league_id) {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'league_id required' }) }
    }

    await sql`DELETE FROM banned_content WHERE league_id = ${league_id}`

    await logAudit(sql, admin, {
        action: 'remove-banned-content', endpoint: 'banned-content',
        leagueId: league_id,
        targetType: 'banned_content',
    })

    return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ success: true }) }
}

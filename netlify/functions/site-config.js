import { getDB, headers, adminHeaders, getHeaders, handleCors } from './lib/db.js'
import { requirePermission } from './lib/auth.js'
import { logAudit } from './lib/audit.js'

const ALLOWED_KEYS = ['featured_stream_channel', 'featured_stream_title']

export const handler = async (event) => {
    // ─── GET (public): read config values ───
    if (event.httpMethod === 'GET') {
        const cors = handleCors(event)
        if (cors) return cors

        const sql = getDB()
        const { keys } = event.queryStringParameters || {}

        if (!keys) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'keys parameter required' }) }
        }

        try {
            const keyList = keys.split(',').map(k => k.trim()).filter(Boolean)
            const rows = await sql`
                SELECT key, value FROM site_config WHERE key = ANY(${keyList})
            `
            const config = {}
            for (const row of rows) config[row.key] = row.value

            return {
                statusCode: 200,
                headers: getHeaders(event),
                body: JSON.stringify({ config }),
            }
        } catch (error) {
            console.error('site-config GET error:', error)
            return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) }
        }
    }

    // ─── OPTIONS (admin CORS) ───
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: adminHeaders, body: '' }
    }

    // ─── POST (admin): set config values ───
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

        if (!body.key || !ALLOWED_KEYS.includes(body.key)) {
            return {
                statusCode: 400,
                headers: adminHeaders,
                body: JSON.stringify({ error: `Invalid key. Allowed: ${ALLOWED_KEYS.join(', ')}` }),
            }
        }

        const value = (body.value ?? '').trim()

        await sql`
            INSERT INTO site_config (key, value, updated_at, updated_by)
            VALUES (${body.key}, ${value}, NOW(), ${admin.id})
            ON CONFLICT (key) DO UPDATE SET
                value = ${value},
                updated_at = NOW(),
                updated_by = ${admin.id}
        `

        logAudit(sql, admin, {
            action: 'update-site-config',
            endpoint: 'site-config',
            targetType: 'config',
            details: { key: body.key, value },
        })

        return {
            statusCode: 200,
            headers: adminHeaders,
            body: JSON.stringify({ success: true, key: body.key, value }),
        }
    } catch (error) {
        console.error('site-config POST error:', error)
        return { statusCode: 500, headers: adminHeaders, body: JSON.stringify({ error: error.message || 'Internal server error' }) }
    }
}

import { adapt } from '../lib/adapter.js'
import { getDB, adminHeaders as headers } from '../lib/db.js'
import { requireAuth, requirePermission } from '../lib/auth.js'
import { logAudit } from '../lib/audit.js'

const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    if (event.httpMethod === 'GET') {
        const admin = await requirePermission(event, 'feedback_manage')
        if (!admin) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
        }

        const sql = getDB()
        const rows = await sql`
            SELECT id, user_id, username, category, message, created_at
            FROM feedback
            ORDER BY created_at DESC
        `
        return { statusCode: 200, headers, body: JSON.stringify({ feedback: rows }) }
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    }

    let body
    try { body = JSON.parse(event.body) } catch {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }
    }

    // Admin delete action
    if (body.action === 'delete') {
        const admin = await requirePermission(event, 'feedback_manage')
        if (!admin) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
        }

        if (!body.id) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing feedback id' }) }
        }

        const sql = getDB()
        await sql`DELETE FROM feedback WHERE id = ${body.id}`

        await logAudit(sql, admin, {
            action: 'delete-feedback',
            endpoint: 'feedback',
            targetType: 'feedback',
            targetId: body.id,
        })

        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
    }

    // Submit feedback (any authenticated user)
    const user = await requireAuth(event)
    if (!user) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const { category, message } = body
    if (!category || !message) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Category and message are required' }) }
    }

    if (!['bug', 'feature', 'general'].includes(category)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid category' }) }
    }

    if (message.length > 5000) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Message too long (max 5000 characters)' }) }
    }

    const sql = getDB()
    const [row] = await sql`
        INSERT INTO feedback (user_id, username, category, message)
        VALUES (${user.id}, ${user.discord_username}, ${category}, ${message})
        RETURNING id, created_at
    `

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, id: row.id }) }
}

export const onRequest = adapt(handler)

import { adapt } from '../lib/adapter.js'
import { getDB, adminHeaders as headers } from '../lib/db.js'
import { requirePermission } from '../lib/auth.js'
import { logAudit } from '../lib/audit.js'
import { grantPassion } from '../lib/passion.js'

const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    }

    const admin = await requirePermission(event, 'permission_manage')
    if (!admin) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const sql = getDB()
    const body = JSON.parse(event.body)
    const { userId, amount, reason } = body

    if (!userId || !amount || typeof amount !== 'number' || amount === 0) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'userId and non-zero amount required' }) }
    }

    // Look up target user
    const [target] = await sql`SELECT id, discord_username FROM users WHERE id = ${userId}`
    if (!target) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'User not found' }) }
    }

    // Grant with lifetimeAmount=0 so it doesn't affect rank or leaderboard
    const description = reason || `Admin grant by ${admin.discord_username}`
    const result = await grantPassion(sql, userId, 'admin_grant', amount, description, null, 0)

    await logAudit(sql, admin, {
        action: 'passion-grant',
        endpoint: 'passion-admin',
        targetType: 'user',
        targetId: userId,
        details: { amount, reason, targetUsername: target.discord_username },
    })

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            targetUsername: target.discord_username,
            amount,
            newBalance: result.balance,
        }),
    }
}

export const onRequestPost = adapt(handler)
export const onRequestOptions = adapt(handler)

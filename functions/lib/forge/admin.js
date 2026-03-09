// Fantasy Forge — Admin POST handlers for market status toggling and liquidation.

import { headers } from '../db.js'
import { requirePermission } from '../auth.js'
import { logAudit } from '../audit.js'
import { liquidateMarket } from './helpers.js'


// ═══════════════════════════════════════════════════
// POST: Toggle market status (open/closed) — Owner only
// ═══════════════════════════════════════════════════
export async function adminToggleStatus(sql, event, user, body) {
    const admin = await requirePermission(event, 'permission_manage')
    if (!admin) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const { seasonId, status } = body
    if (!seasonId || !['open', 'closed'].includes(status)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'seasonId and status (open|closed) are required' }) }
    }

    const [market] = await sql`
        SELECT id, status FROM forge_markets WHERE season_id = ${seasonId}
    `
    if (!market) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'No market found for this season' }) }
    }
    if (market.status === 'liquidated') {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Cannot toggle a liquidated market' }) }
    }

    await sql`
        UPDATE forge_markets SET status = ${status} WHERE id = ${market.id}
    `

    await logAudit(sql, admin, {
        action: `forge-market-${status}`,
        endpoint: 'forge',
        targetType: 'forge_market',
        targetId: market.id,
        details: { seasonId, newStatus: status },
    })

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, status }),
    }
}


// ═══════════════════════════════════════════════════
// POST: Admin liquidate a market
// ═══════════════════════════════════════════════════
export async function adminLiquidate(sql, event, user, body) {
    const admin = await requirePermission(event, 'league_manage')
    if (!admin) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const { seasonId } = body
    if (!seasonId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'seasonId is required' }) }
    }

    const [market] = await sql`
        SELECT id, status FROM forge_markets WHERE season_id = ${seasonId}
    `
    if (!market) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'No market found for this season' }) }
    }
    if (market.status === 'liquidated') {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Market is already liquidated' }) }
    }

    await liquidateMarket(sql, market.id)

    await logAudit(sql, admin, {
        action: 'liquidate-market',
        endpoint: 'forge',
        targetType: 'forge_market',
        targetId: market.id,
        details: { seasonId },
    })

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'Market liquidated' }),
    }
}

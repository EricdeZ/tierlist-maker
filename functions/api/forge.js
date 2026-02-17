import { adapt } from '../lib/adapter.js'
import { getDB, headers, getHeaders, transaction } from '../lib/db.js'
import { requireAuth, requirePermission } from '../lib/auth.js'
import { pushChallengeProgress } from '../lib/challenges.js'
import { logAudit } from '../lib/audit.js'
import {
    FORGE_CONFIG,
    ensureMarket,
    ensurePlayerSparks,
    executeFuel,
    executeCool,
    liquidateMarket,
} from '../lib/forge.js'

const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const sql = getDB()
    const params = event.queryStringParameters || {}
    const { action } = params

    try {
        // All actions require auth
        const user = await requireAuth(event)
        if (!user) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
        }

        if (event.httpMethod === 'GET') {
            switch (action) {
                case 'market':
                    return await getMarket(sql, user, params, event)
                case 'portfolio':
                    return await getPortfolio(sql, user, params)
                case 'leaderboard':
                    return await getLeaderboard(sql, params)
                case 'history':
                    return await getHistory(sql, params)
                default:
                    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
            }
        }

        if (event.httpMethod === 'POST') {
            const body = event.body ? JSON.parse(event.body) : {}

            switch (action) {
                case 'fuel':
                    return await fuel(sql, user, body)
                case 'cool':
                    return await cool(sql, user, body)
                case 'liquidate':
                    return await adminLiquidate(sql, event, user, body)
                default:
                    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
            }
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    } catch (error) {
        console.error('forge error:', error)
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) }
    }
}


// ═══════════════════════════════════════════════════
// GET: Market overview — all player sparks + user holdings
// ═══════════════════════════════════════════════════
async function getMarket(sql, user, params, event) {
    const { seasonId } = params
    if (!seasonId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'seasonId is required' }) }
    }

    // Ensure market and player sparks exist
    const market = await ensureMarket(sql, seasonId)
    await ensurePlayerSparks(sql, market.id, seasonId)

    // Get all player sparks with player/team info
    const sparks = await sql`
        SELECT
            ps.id as spark_id, ps.current_price, ps.total_sparks, ps.perf_multiplier,
            ps.last_perf_update, ps.updated_at,
            p.name as player_name, p.slug as player_slug,
            lp.role, lp.team_id,
            t.name as team_name, t.slug as team_slug, t.color as team_color
        FROM player_sparks ps
        JOIN league_players lp ON ps.league_player_id = lp.id
        JOIN players p ON lp.player_id = p.id
        JOIN teams t ON lp.team_id = t.id
        WHERE ps.market_id = ${market.id}
          AND lp.is_active = true
          AND LOWER(COALESCE(lp.role, '')) != 'sub'
        ORDER BY ps.current_price DESC
    `

    // Get user's holdings for this market
    const sparkIds = sparks.map(s => s.spark_id)
    let userHoldings = []
    if (sparkIds.length > 0) {
        userHoldings = await sql`
            SELECT spark_id, sparks, total_invested
            FROM spark_holdings
            WHERE user_id = ${user.id} AND spark_id = ANY(${sparkIds})
        `
    }

    // Build holdings map
    const holdingsMap = {}
    for (const h of userHoldings) {
        holdingsMap[h.spark_id] = {
            sparks: h.sparks,
            totalInvested: Number(h.total_invested),
        }
    }

    // Get 24h price change from history
    const priceChanges = sparkIds.length > 0 ? await sql`
        SELECT DISTINCT ON (spark_id) spark_id, price
        FROM spark_price_history
        WHERE spark_id = ANY(${sparkIds})
          AND created_at <= NOW() - INTERVAL '24 hours'
        ORDER BY spark_id, created_at DESC
    ` : []

    const priceChangeMap = {}
    for (const pc of priceChanges) {
        priceChangeMap[pc.spark_id] = Number(pc.price)
    }

    const result = sparks.map(s => {
        const holding = holdingsMap[s.spark_id] || null
        const price24hAgo = priceChangeMap[s.spark_id]
        const currentPrice = Number(s.current_price)
        const priceChange = price24hAgo
            ? Math.round((currentPrice - price24hAgo) / price24hAgo * 10000) / 100
            : null

        return {
            sparkId: s.spark_id,
            playerName: s.player_name,
            playerSlug: s.player_slug,
            role: s.role,
            teamId: s.team_id,
            teamName: s.team_name,
            teamSlug: s.team_slug,
            teamColor: s.team_color,
            currentPrice,
            totalSparks: s.total_sparks,
            perfMultiplier: Number(s.perf_multiplier),
            priceChange24h: priceChange,
            holding,
        }
    })

    return {
        statusCode: 200,
        headers: getHeaders(event),
        body: JSON.stringify({
            market: {
                id: market.id,
                seasonId: market.season_id,
                status: market.status,
                basePrice: market.base_price,
            },
            players: result,
        }),
    }
}


// ═══════════════════════════════════════════════════
// GET: User's portfolio with P&L
// ═══════════════════════════════════════════════════
async function getPortfolio(sql, user, params) {
    const { seasonId } = params
    if (!seasonId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'seasonId is required' }) }
    }

    const [market] = await sql`
        SELECT id FROM forge_markets WHERE season_id = ${seasonId}
    `
    if (!market) {
        return { statusCode: 200, headers, body: JSON.stringify({ holdings: [], stats: null }) }
    }

    // Get holdings with player/price info
    const holdings = await sql`
        SELECT
            sh.spark_id, sh.sparks, sh.total_invested,
            ps.current_price, ps.total_sparks, ps.perf_multiplier,
            p.name as player_name, p.slug as player_slug,
            lp.role,
            t.name as team_name, t.slug as team_slug, t.color as team_color
        FROM spark_holdings sh
        JOIN player_sparks ps ON sh.spark_id = ps.id
        JOIN league_players lp ON ps.league_player_id = lp.id
        JOIN players p ON lp.player_id = p.id
        JOIN teams t ON lp.team_id = t.id
        WHERE sh.user_id = ${user.id} AND ps.market_id = ${market.id}
        ORDER BY (sh.sparks * ps.current_price) DESC
    `

    let totalValue = 0
    let totalInvested = 0

    const holdingsList = holdings.map(h => {
        const currentPrice = Number(h.current_price)
        const invested = Number(h.total_invested)
        const value = Math.round(currentPrice * h.sparks)
        const avgBuyPrice = h.sparks > 0 ? invested / h.sparks : 0
        const unrealizedPL = value - Math.round(invested)

        totalValue += value
        totalInvested += invested

        return {
            sparkId: h.spark_id,
            playerName: h.player_name,
            playerSlug: h.player_slug,
            role: h.role,
            teamName: h.team_name,
            teamSlug: h.team_slug,
            teamColor: h.team_color,
            sparks: h.sparks,
            avgBuyPrice: Math.round(avgBuyPrice * 100) / 100,
            currentPrice,
            currentValue: value,
            totalInvested: Math.round(invested),
            unrealizedPL,
        }
    })

    // Get realized P&L from cool transactions
    const [realized] = await sql`
        SELECT
            COALESCE(SUM(st.total_cost), 0)::integer as total_cooled,
            COALESCE(SUM(
                st.total_cost - (sh_cost.avg_cost * st.sparks)
            ), 0)::integer as realized_profit
        FROM spark_transactions st
        LEFT JOIN LATERAL (
            SELECT CASE WHEN sh.sparks > 0
                THEN sh.total_invested / sh.sparks
                ELSE 0 END as avg_cost
            FROM spark_holdings sh
            WHERE sh.user_id = ${user.id} AND sh.spark_id = st.spark_id
        ) sh_cost ON true
        WHERE st.user_id = ${user.id}
          AND st.type = 'cool'
          AND st.spark_id IN (SELECT ps.id FROM player_sparks ps WHERE ps.market_id = ${market.id})
    `

    // Recent transactions for this market
    const transactions = await sql`
        SELECT
            st.id, st.type, st.sparks, st.price_per_spark, st.total_cost, st.created_at,
            p.name as player_name
        FROM spark_transactions st
        JOIN player_sparks ps ON st.spark_id = ps.id
        JOIN league_players lp ON ps.league_player_id = lp.id
        JOIN players p ON lp.player_id = p.id
        WHERE st.user_id = ${user.id} AND ps.market_id = ${market.id}
        ORDER BY st.created_at DESC
        LIMIT 20
    `

    const totalPL = Math.round(totalValue - totalInvested)
    const plPct = totalInvested > 0 ? Math.round(totalPL / totalInvested * 10000) / 100 : 0

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            holdings: holdingsList,
            stats: {
                totalValue: Math.round(totalValue),
                totalInvested: Math.round(totalInvested),
                unrealizedPL: totalPL,
                plPercent: plPct,
                holdingCount: holdings.length,
            },
            transactions: transactions.map(t => ({
                id: t.id,
                type: t.type,
                sparks: t.sparks,
                pricePerSpark: Number(t.price_per_spark),
                totalCost: t.total_cost,
                playerName: t.player_name,
                createdAt: t.created_at,
            })),
        }),
    }
}


// ═══════════════════════════════════════════════════
// GET: Leaderboard — top investors by portfolio value
// ═══════════════════════════════════════════════════
async function getLeaderboard(sql, params) {
    const { seasonId } = params
    if (!seasonId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'seasonId is required' }) }
    }

    const [market] = await sql`
        SELECT id FROM forge_markets WHERE season_id = ${seasonId}
    `
    if (!market) {
        return { statusCode: 200, headers, body: JSON.stringify({ leaderboard: [] }) }
    }

    const leaders = await sql`
        SELECT
            sh.user_id,
            u.discord_username,
            u.discord_avatar,
            u.discord_id,
            pl.slug as player_slug,
            SUM(sh.sparks * ps.current_price)::integer as portfolio_value,
            SUM(sh.total_invested)::integer as total_invested,
            COUNT(DISTINCT sh.spark_id)::integer as holdings_count,
            SUM(sh.sparks)::integer as total_sparks
        FROM spark_holdings sh
        JOIN player_sparks ps ON sh.spark_id = ps.id
        JOIN users u ON sh.user_id = u.id
        LEFT JOIN players pl ON u.linked_player_id = pl.id
        WHERE ps.market_id = ${market.id} AND sh.sparks > 0
        GROUP BY sh.user_id, u.discord_username, u.discord_avatar, u.discord_id, pl.slug
        ORDER BY portfolio_value DESC
        LIMIT 50
    `

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            leaderboard: leaders.map((l, i) => ({
                position: i + 1,
                userId: l.user_id,
                username: l.discord_username,
                avatar: l.discord_avatar,
                discordId: l.discord_id,
                playerSlug: l.player_slug,
                portfolioValue: l.portfolio_value,
                totalInvested: l.total_invested,
                holdingsCount: l.holdings_count,
                totalSparks: l.total_sparks,
                pl: l.portfolio_value - l.total_invested,
            })),
        }),
    }
}


// ═══════════════════════════════════════════════════
// GET: Price history for a player spark
// ═══════════════════════════════════════════════════
async function getHistory(sql, params) {
    const { sparkId } = params
    if (!sparkId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'sparkId is required' }) }
    }

    const history = await sql`
        SELECT price, trigger, created_at
        FROM spark_price_history
        WHERE spark_id = ${sparkId}
        ORDER BY created_at ASC
    `

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            history: history.map(h => ({
                price: Number(h.price),
                trigger: h.trigger,
                createdAt: h.created_at,
            })),
        }),
    }
}


// ═══════════════════════════════════════════════════
// POST: Fuel (buy) Sparks
// ═══════════════════════════════════════════════════
async function fuel(sql, user, body) {
    const { sparkId, sparks: rawSparks } = body
    const numSparks = parseInt(rawSparks)

    if (!sparkId || !numSparks || numSparks < 1) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'sparkId and sparks (>= 1) are required' }) }
    }
    if (numSparks > 10) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Maximum 10 Sparks per transaction' }) }
    }

    try {
        const result = await transaction(async (tx) => {
            return await executeFuel(tx, user.id, sparkId, numSparks)
        })

        // Push challenge progress (fire-and-forget)
        const [{ count: fuelCount }] = await sql`
            SELECT COUNT(*)::integer as count FROM spark_transactions
            WHERE user_id = ${user.id} AND type = 'fuel'
        `
        pushChallengeProgress(sql, user.id, { sparks_fueled: fuelCount })
            .catch(err => console.error('Challenge push (fuel) failed:', err))

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                newPrice: result.newPrice,
                totalCost: result.totalCost,
                holding: result.holding,
            }),
        }
    } catch (err) {
        if (err.message.includes('Insufficient') || err.message.includes('not open')) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: err.message }) }
        }
        throw err
    }
}


// ═══════════════════════════════════════════════════
// POST: Cool (sell) Sparks
// ═══════════════════════════════════════════════════
async function cool(sql, user, body) {
    const { sparkId, sparks: rawSparks } = body
    const numSparks = parseInt(rawSparks)

    if (!sparkId || !numSparks || numSparks < 1) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'sparkId and sparks (>= 1) are required' }) }
    }

    try {
        const result = await transaction(async (tx) => {
            return await executeCool(tx, user.id, sparkId, numSparks)
        })

        // Push challenge progress (fire-and-forget)
        const [{ count: coolCount }] = await sql`
            SELECT COUNT(*)::integer as count FROM spark_transactions
            WHERE user_id = ${user.id} AND type IN ('cool', 'liquidate')
        `
        const stats = { sparks_cooled: coolCount }
        if (result.profit > 0) {
            // Sum all realized profit for the user
            const [{ total }] = await sql`
                SELECT COALESCE(SUM(
                    CASE WHEN st.type IN ('cool', 'liquidate')
                    THEN st.total_cost ELSE 0 END
                ), 0)::integer as total
                FROM spark_transactions st
                WHERE st.user_id = ${user.id} AND st.type IN ('cool', 'liquidate')
            `
            // Rough total profit = total cool proceeds - total fuel costs
            const [{ invested }] = await sql`
                SELECT COALESCE(SUM(st.total_cost), 0)::integer as invested
                FROM spark_transactions st
                WHERE st.user_id = ${user.id} AND st.type = 'fuel'
            `
            const netProfit = Math.max(total - invested, 0)
            stats.forge_profit = netProfit
        }
        pushChallengeProgress(sql, user.id, stats)
            .catch(err => console.error('Challenge push (cool) failed:', err))

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                newPrice: result.newPrice,
                grossProceeds: result.grossProceeds,
                coolingTax: result.coolingTax,
                netProceeds: result.netProceeds,
                profit: result.profit,
                holding: result.holding,
            }),
        }
    } catch (err) {
        if (err.message.includes('Not enough') || err.message.includes('not open') || err.message.includes('not found')) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: err.message }) }
        }
        throw err
    }
}


// ═══════════════════════════════════════════════════
// POST: Admin liquidate a market
// ═══════════════════════════════════════════════════
async function adminLiquidate(sql, event, user, body) {
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


export const onRequest = adapt(handler)

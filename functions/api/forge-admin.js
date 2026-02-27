import { adapt } from '../lib/adapter.js'
import { getDB, adminHeaders } from '../lib/db.js'
import { requirePermission } from '../lib/auth.js'

const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: adminHeaders, body: '' }
    }

    const owner = await requirePermission(event, 'permission_manage')
    if (!owner) {
        return { statusCode: 401, headers: adminHeaders, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const sql = getDB()
    const params = event.queryStringParameters || {}
    const { action } = params

    try {
        if (event.httpMethod === 'GET') {
            if (action === 'holdings') return await getHoldings(sql, params)
            if (action === 'activity') return await getActivity(sql, params)
            if (action === 'markets') return await getMarkets(sql)
            return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
        }

        return { statusCode: 405, headers: adminHeaders, body: JSON.stringify({ error: 'Method not allowed' }) }
    } catch (err) {
        console.error('forge-admin error:', err)
        return { statusCode: 500, headers: adminHeaders, body: JSON.stringify({ error: err.message }) }
    }
}

async function getMarkets(sql) {
    const markets = await sql`
        SELECT fm.id as market_id, fm.status, fm.season_id,
               s.name as season_name,
               d.name as division_name, d.slug as division_slug,
               l.name as league_name, l.slug as league_slug
        FROM forge_markets fm
        JOIN seasons s ON fm.season_id = s.id
        JOIN divisions d ON s.division_id = d.id
        JOIN leagues l ON d.league_id = l.id
        ORDER BY fm.status = 'open' DESC, fm.created_at DESC
    `
    return { statusCode: 200, headers: adminHeaders, body: JSON.stringify(markets) }
}

async function getHoldings(sql, params) {
    const { marketId } = params

    const whereClause = marketId
        ? sql`AND ps.market_id = ${marketId}`
        : sql`AND fm.status = 'open'`

    const holdings = await sql`
        SELECT
            sh.sparks,
            sh.tutorial_sparks,
            sh.referral_sparks,
            sh.total_invested,
            ps.current_price,
            ps.total_sparks as player_total_sparks,
            ps.perf_multiplier,
            u.discord_username,
            u.discord_avatar,
            u.discord_id,
            p.name as player_name,
            p.slug as player_slug,
            t.name as team_name,
            t.color as team_color,
            t.slug as team_slug,
            lp.role,
            d.name as division_name,
            l.slug as league_slug
        FROM spark_holdings sh
        JOIN users u ON sh.user_id = u.id
        JOIN player_sparks ps ON sh.spark_id = ps.id
        JOIN forge_markets fm ON ps.market_id = fm.id
        JOIN league_players lp ON ps.league_player_id = lp.id
        JOIN players p ON lp.player_id = p.id
        JOIN teams t ON lp.team_id = t.id
        JOIN seasons s ON fm.season_id = s.id
        JOIN divisions d ON s.division_id = d.id
        JOIN leagues l ON d.league_id = l.id
        WHERE sh.sparks > 0 ${whereClause}
        ORDER BY (sh.sparks * ps.current_price) DESC
    `

    return { statusCode: 200, headers: adminHeaders, body: JSON.stringify(holdings) }
}

async function getActivity(sql, params) {
    const { marketId, type, limit: limitParam, offset: offsetParam } = params
    const limit = Math.min(parseInt(limitParam) || 50, 200)
    const offset = parseInt(offsetParam) || 0

    const whereMarket = marketId
        ? sql`AND ps.market_id = ${marketId}`
        : sql`AND fm.status = 'open'`

    const whereType = type
        ? sql`AND st.type = ${type}`
        : sql``

    const activity = await sql`
        SELECT
            st.id,
            st.type,
            st.sparks,
            st.price_per_spark,
            st.total_cost,
            st.created_at,
            u.discord_username,
            u.discord_avatar,
            u.discord_id,
            p.name as player_name,
            p.slug as player_slug,
            t.name as team_name,
            t.color as team_color,
            lp.role,
            d.name as division_name,
            l.slug as league_slug
        FROM spark_transactions st
        JOIN users u ON st.user_id = u.id
        JOIN player_sparks ps ON st.spark_id = ps.id
        JOIN forge_markets fm ON ps.market_id = fm.id
        JOIN league_players lp ON ps.league_player_id = lp.id
        JOIN players p ON lp.player_id = p.id
        JOIN teams t ON lp.team_id = t.id
        JOIN seasons s ON fm.season_id = s.id
        JOIN divisions d ON s.division_id = d.id
        JOIN leagues l ON d.league_id = l.id
        WHERE 1=1 ${whereMarket} ${whereType}
        ORDER BY st.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
    `

    return { statusCode: 200, headers: adminHeaders, body: JSON.stringify(activity) }
}

export const onRequest = adapt(handler)

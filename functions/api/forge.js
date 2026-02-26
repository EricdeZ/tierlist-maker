import { adapt } from '../lib/adapter.js'
import { getDB, headers, getHeaders, transaction } from '../lib/db.js'
import { requireAuth, requirePermission } from '../lib/auth.js'
import { pushChallengeProgress } from '../lib/challenges.js'
import { logAudit } from '../lib/audit.js'
import {
    FORGE_CONFIG,
    calcPrice,
    ensureMarket,
    ensurePlayerSparks,
    executeFuel,
    executeCool,
    liquidateMarket,
} from '../lib/forge.js'
import { grantPassion } from '../lib/passion.js'
import { processForgeReferral } from '../lib/referrals.js'

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
                case 'market-statuses':
                    return await getMarketStatuses(sql)
                case 'portfolio':
                    return await getPortfolio(sql, user, params)
                case 'leaderboard':
                    return await getLeaderboard(sql, params)
                case 'history':
                    return await getHistory(sql, params)
                case 'batch-history':
                    return await getBatchHistory(sql, params)
                case 'tutorial-status':
                    return await getTutorialStatus(sql, user, params)
                case 'portfolio-timeline':
                    return await getPortfolioTimeline(sql, user, params)
                default:
                    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
            }
        }

        if (event.httpMethod === 'POST') {
            const body = event.body ? JSON.parse(event.body) : {}

            switch (action) {
                case 'fuel':
                    return await fuel(sql, user, body, event)
                case 'cool':
                    return await cool(sql, user, body, event)
                case 'toggle-status':
                    return await adminToggleStatus(sql, event, user, body)
                case 'liquidate':
                    return await adminLiquidate(sql, event, user, body)
                case 'tutorial-fuel':
                    return await tutorialFuel(sql, user, body, event)
                case 'claim-forge-referral':
                    return await claimForgeReferral(sql, user, body)
                case 'referral-fuel':
                    return await referralFuel(sql, user, body, event)
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

    // Track daily Forge visit for challenge progress (background, survives response)
    event.waitUntil(trackForgeVisit(sql, user.id).catch(() => {}))

    // Get all player sparks with player/team info + most-played god image
    const sparks = await sql`
        SELECT
            ps.id as spark_id, ps.current_price, ps.total_sparks, ps.perf_multiplier,
            ps.last_perf_update, ps.updated_at,
            p.name as player_name, p.slug as player_slug,
            lp.role, lp.team_id,
            t.name as team_name, t.slug as team_slug, t.color as team_color,
            mpg.god_image_url,
            u_avatar.discord_id as player_discord_id,
            u_avatar.discord_avatar as player_discord_avatar,
            u_avatar.id as user_id_linked,
            cs.best_streak,
            pstats.games_played, pstats.wins, pstats.avg_kills, pstats.avg_deaths, pstats.avg_assists
        FROM player_sparks ps
        JOIN league_players lp ON ps.league_player_id = lp.id
        JOIN players p ON lp.player_id = p.id
        JOIN teams t ON lp.team_id = t.id
        LEFT JOIN LATERAL (
            SELECT g.image_url as god_image_url
            FROM player_game_stats pgs
            JOIN gods g ON LOWER(g.name) = LOWER(pgs.god_played)
            WHERE pgs.league_player_id = lp.id
              AND pgs.god_played IS NOT NULL
            GROUP BY g.image_url
            ORDER BY COUNT(*) DESC
            LIMIT 1
        ) mpg ON true
        LEFT JOIN LATERAL (
            SELECT
                COUNT(DISTINCT pgs.game_id)::integer as games_played,
                COUNT(DISTINCT pgs.game_id) FILTER (
                    WHERE g.winner_team_id = CASE pgs.team_side WHEN 1 THEN m.team1_id WHEN 2 THEN m.team2_id END
                )::integer as wins,
                COALESCE(AVG(pgs.kills), 0) as avg_kills,
                COALESCE(AVG(pgs.deaths), 0) as avg_deaths,
                COALESCE(AVG(pgs.assists), 0) as avg_assists
            FROM player_game_stats pgs
            JOIN games g ON pgs.game_id = g.id AND g.is_completed = true
            JOIN matches m ON g.match_id = m.id
            WHERE pgs.league_player_id = lp.id
        ) pstats ON true
        LEFT JOIN users u_avatar ON u_avatar.linked_player_id = p.id
        LEFT JOIN coinflip_streaks cs ON cs.user_id = u_avatar.id
        WHERE ps.market_id = ${market.id}
          AND lp.is_active = true
          AND lp.roster_status != 'sub'
        ORDER BY ps.current_price DESC
    `

    // Get user's holdings for this market
    const sparkIds = sparks.map(s => s.spark_id)
    let userHoldings = []
    if (sparkIds.length > 0) {
        userHoldings = await sql`
            SELECT spark_id, sparks, total_invested, tutorial_sparks
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
            tutorialSparks: h.tutorial_sparks || 0,
        }
    }

    // Get 24h and 7d price changes from history
    const [priceChanges24h, priceChanges7d] = sparkIds.length > 0 ? await Promise.all([
        sql`
            SELECT DISTINCT ON (spark_id) spark_id, price
            FROM spark_price_history
            WHERE spark_id = ANY(${sparkIds})
              AND created_at <= NOW() - INTERVAL '24 hours'
            ORDER BY spark_id, created_at DESC
        `,
        sql`
            SELECT DISTINCT ON (spark_id) spark_id, price
            FROM spark_price_history
            WHERE spark_id = ANY(${sparkIds})
              AND created_at <= NOW() - INTERVAL '7 days'
            ORDER BY spark_id, created_at DESC
        `,
    ]) : [[], []]

    const priceChangeMap = {}
    for (const pc of priceChanges24h) {
        priceChangeMap[pc.spark_id] = Number(pc.price)
    }

    const priceChange7dMap = {}
    for (const pc of priceChanges7d) {
        priceChange7dMap[pc.spark_id] = Number(pc.price)
    }

    // Get user's team for this season (to prevent self-trading)
    const [userTeamRow] = await sql`
        SELECT lp.team_id
        FROM league_players lp
        JOIN teams t ON t.id = lp.team_id
        WHERE lp.player_id = (SELECT linked_player_id FROM users WHERE id = ${user.id})
          AND lp.is_active = true
          AND t.season_id = ${seasonId}
        LIMIT 1
    `
    const userTeamId = userTeamRow?.team_id || null

    // Count free Starter Sparks remaining across all markets in this league
    const [{ total_used: freeUsed }] = await sql`
        SELECT COALESCE(SUM(st.sparks), 0)::integer as total_used
        FROM spark_transactions st
        JOIN player_sparks ps ON st.spark_id = ps.id
        WHERE st.user_id = ${user.id}
          AND st.type = 'tutorial_fuel'
          AND ps.market_id IN (
              SELECT fm.id FROM forge_markets fm
              JOIN seasons s ON fm.season_id = s.id
              WHERE s.league_id = (SELECT league_id FROM seasons WHERE id = ${seasonId})
          )
    `
    const freeSparksRemaining = Math.max(0, 3 - freeUsed)

    // Check referral sparks available
    const [{ forge_referral_sparks: referralSparksAvailable }] = await sql`
        SELECT forge_referral_sparks FROM users WHERE id = ${user.id}
    `

    const result = sparks.map(s => {
        const holding = holdingsMap[s.spark_id] || null
        const price24hAgo = priceChangeMap[s.spark_id]
        const price7dAgo = priceChange7dMap[s.spark_id]
        const currentPrice = Number(s.current_price)
        const priceChange = price24hAgo
            ? Math.round((currentPrice - price24hAgo) / price24hAgo * 10000) / 100
            : null
        const priceChange7d = price7dAgo
            ? Math.round((currentPrice - price7dAgo) / price7dAgo * 10000) / 100
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
            priceChange7d,
            holding,
            godImageUrl: s.god_image_url || null,
            discordAvatarUrl: s.player_discord_id && s.player_discord_avatar
                ? `https://cdn.discordapp.com/avatars/${s.player_discord_id}/${s.player_discord_avatar}.png?size=64`
                : null,
            isConnected: s.user_id_linked != null,
            bestStreak: s.best_streak || 0,
            gamesPlayed: s.games_played || 0,
            wins: s.wins || 0,
            avgKills: Number(s.avg_kills) || 0,
            avgDeaths: Number(s.avg_deaths) || 0,
            avgAssists: Number(s.avg_assists) || 0,
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
            userTeamId,
            freeSparksRemaining,
            referralSparksAvailable: referralSparksAvailable || 0,
        }),
    }
}


// ═══════════════════════════════════════════════════
// GET: All market statuses (lightweight, for season dropdown filtering)
// ═══════════════════════════════════════════════════
async function getMarketStatuses(sql) {
    const rows = await sql`
        SELECT season_id, status FROM forge_markets
    `
    const statuses = {}
    for (const r of rows) {
        statuses[r.season_id] = r.status
    }
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ statuses }),
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
            sh.spark_id, sh.sparks, sh.total_invested, sh.tutorial_sparks,
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
        const tutorialSparks = h.tutorial_sparks || 0
        const coolableSparks = h.sparks - tutorialSparks

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
            tutorialSparks,
            coolableSparks,
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
// GET: Portfolio timeline — reconstruct portfolio worth + cost basis over time
// Replays user transactions against price history to build accurate dual series
// ═══════════════════════════════════════════════════
async function getPortfolioTimeline(sql, user, params) {
    const { seasonId } = params
    if (!seasonId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'seasonId is required' }) }
    }

    const [market] = await sql`
        SELECT id FROM forge_markets WHERE season_id = ${seasonId}
    `
    if (!market) {
        return { statusCode: 200, headers, body: JSON.stringify({ timeline: [] }) }
    }

    // 1. Get all user transactions for this market
    const txns = await sql`
        SELECT st.spark_id, st.type, st.sparks, st.total_cost, st.created_at,
               p.name as player_name
        FROM spark_transactions st
        JOIN player_sparks ps ON st.spark_id = ps.id
        JOIN league_players lp ON ps.league_player_id = lp.id
        JOIN players p ON lp.player_id = p.id
        WHERE st.user_id = ${user.id} AND ps.market_id = ${market.id}
        ORDER BY st.created_at ASC
    `

    if (txns.length === 0) {
        return { statusCode: 200, headers, body: JSON.stringify({ timeline: [] }) }
    }

    // Collect all sparkIds the user ever interacted with
    const sparkIdSet = new Set(txns.map(t => t.spark_id))
    const sparkIds = [...sparkIdSet]

    // 2. Get price history for all relevant sparks
    const priceHistory = await sql`
        SELECT spark_id, price, trigger, created_at
        FROM spark_price_history
        WHERE spark_id = ANY(${sparkIds})
        ORDER BY created_at ASC
    `

    // 3. Get player names for price history events (for sparkIds we already know)
    const sparkPlayerNames = {}
    for (const t of txns) {
        sparkPlayerNames[t.spark_id] = t.player_name
    }

    // 4. Merge transactions and price events into one chronological stream
    const events = []

    for (const t of txns) {
        events.push({
            time: new Date(t.created_at),
            kind: 'txn',
            sparkId: t.spark_id,
            type: t.type,
            sparks: t.sparks,
            totalCost: t.total_cost,
            playerName: t.player_name,
        })
    }

    for (const p of priceHistory) {
        events.push({
            time: new Date(p.created_at),
            kind: 'price',
            sparkId: p.spark_id,
            price: Number(p.price),
            trigger: p.trigger,
            playerName: sparkPlayerNames[p.spark_id] || null,
        })
    }

    // Sort chronologically (txns before price events at same timestamp so position updates first)
    events.sort((a, b) => {
        const dt = a.time - b.time
        if (dt !== 0) return dt
        return (a.kind === 'txn' ? 0 : 1) - (b.kind === 'txn' ? 0 : 1)
    })

    // 5. Replay forward
    const positions = {}   // sparkId → numSparks held
    const lastPrice = {}   // sparkId → latest known price
    let costBasis = 0      // cumulative: fuel adds cost, cool subtracts proceeds

    const timeline = []

    for (const ev of events) {
        if (ev.kind === 'txn') {
            const isBuy = ev.type === 'fuel' || ev.type === 'tutorial_fuel' || ev.type === 'referral_fuel'
            const isSell = ev.type === 'cool' || ev.type === 'liquidate'

            if (isBuy) {
                positions[ev.sparkId] = (positions[ev.sparkId] || 0) + ev.sparks
                costBasis += ev.totalCost
            } else if (isSell) {
                positions[ev.sparkId] = Math.max(0, (positions[ev.sparkId] || 0) - ev.sparks)
                costBasis -= ev.totalCost
            }
        }

        if (ev.kind === 'price') {
            lastPrice[ev.sparkId] = ev.price
        }

        // Only emit timeline points after the user has at least one position
        const hasPosition = Object.values(positions).some(n => n > 0)
        if (!hasPosition && costBasis <= 0) continue

        // Calculate current portfolio worth
        let worth = 0
        for (const sid of sparkIds) {
            const qty = positions[sid] || 0
            const price = lastPrice[sid] || 0
            worth += qty * price
        }

        timeline.push({
            t: ev.time.toISOString(),
            worth: Math.round(worth),
            basis: Math.max(0, Math.round(costBasis)),
            trigger: ev.kind === 'txn' ? ev.type : ev.trigger,
            playerName: ev.playerName,
        })
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ timeline }),
    }
}


// ═══════════════════════════════════════════════════
// GET: Leaderboard — top investors by total profit
// Profit = current holdings value + realized proceeds (cool/liquidate) − all fuel costs (incl. tutorial)
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
        WITH user_transactions AS (
            SELECT
                st.user_id,
                COALESCE(SUM(CASE WHEN st.type IN ('cool', 'liquidate') THEN st.total_cost ELSE 0 END), 0) as realized_proceeds,
                COALESCE(SUM(CASE WHEN st.type IN ('fuel', 'tutorial_fuel', 'referral_fuel') THEN st.total_cost ELSE 0 END), 0) as fuel_costs
            FROM spark_transactions st
            JOIN player_sparks ps ON st.spark_id = ps.id
            WHERE ps.market_id = ${market.id}
            GROUP BY st.user_id
        ),
        user_holdings AS (
            SELECT
                sh.user_id,
                SUM(sh.sparks * ps.current_price)::integer as portfolio_value,
                COUNT(DISTINCT sh.spark_id)::integer as holdings_count,
                SUM(sh.sparks)::integer as total_sparks
            FROM spark_holdings sh
            JOIN player_sparks ps ON sh.spark_id = ps.id
            WHERE ps.market_id = ${market.id} AND sh.sparks > 0
            GROUP BY sh.user_id
        )
        SELECT
            COALESCE(uh.user_id, ut.user_id) as user_id,
            u.discord_username,
            u.discord_avatar,
            u.discord_id,
            pl.slug as player_slug,
            COALESCE(uh.portfolio_value, 0)::integer as portfolio_value,
            COALESCE(uh.holdings_count, 0)::integer as holdings_count,
            COALESCE(uh.total_sparks, 0)::integer as total_sparks,
            (COALESCE(uh.portfolio_value, 0) + COALESCE(ut.realized_proceeds, 0) - COALESCE(ut.fuel_costs, 0))::integer as total_profit
        FROM user_holdings uh
        FULL OUTER JOIN user_transactions ut ON uh.user_id = ut.user_id
        JOIN users u ON COALESCE(uh.user_id, ut.user_id) = u.id
        LEFT JOIN players pl ON u.linked_player_id = pl.id
        ORDER BY total_profit DESC
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
                holdingsCount: l.holdings_count,
                totalSparks: l.total_sparks,
                totalProfit: l.total_profit,
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

async function getBatchHistory(sql, params) {
    const { sparkIds } = params
    if (!sparkIds) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'sparkIds is required' }) }
    }

    const ids = sparkIds.split(',').map(Number).filter(n => n > 0)
    if (ids.length === 0 || ids.length > 50) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Provide 1-50 valid sparkIds' }) }
    }

    const rows = await sql`
        SELECT spark_id, price, trigger, created_at
        FROM spark_price_history
        WHERE spark_id = ANY(${ids})
        ORDER BY spark_id, created_at ASC
    `

    const histories = {}
    for (const r of rows) {
        const sid = r.spark_id
        if (!histories[sid]) histories[sid] = []
        histories[sid].push({
            price: Number(r.price),
            trigger: r.trigger,
            createdAt: r.created_at,
        })
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ histories }),
    }
}


// ═══════════════════════════════════════════════════
// POST: Fuel (buy) Sparks
// ═══════════════════════════════════════════════════
async function fuel(sql, user, body, event) {
    const { sparkId, sparks: rawSparks } = body
    const numSparks = parseInt(rawSparks)

    if (!sparkId || !numSparks || numSparks < 1) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'sparkId and sparks (>= 1) are required' }) }
    }
    if (numSparks > 10) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Maximum 10 Sparks per transaction' }) }
    }

    // Prevent trading own team's players
    const [ownTeamCheck] = await sql`
        SELECT 1 FROM player_sparks ps
        JOIN league_players lp ON ps.league_player_id = lp.id
        WHERE ps.id = ${sparkId}
          AND lp.team_id IN (
              SELECT lp2.team_id FROM league_players lp2
              JOIN teams t ON t.id = lp2.team_id
              WHERE lp2.player_id = (SELECT linked_player_id FROM users WHERE id = ${user.id})
                AND lp2.is_active = true
          )
    `
    if (ownTeamCheck) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'You cannot fuel players on your own team' }) }
    }

    try {
        const result = await transaction(async (tx) => {
            return await executeFuel(tx, user.id, sparkId, numSparks)
        })

        // Push challenge progress (background, survives response)
        event.waitUntil(
            (async () => {
                const [{ count: fuelCount }] = await sql`
                    SELECT COUNT(*)::integer as count FROM spark_transactions
                    WHERE user_id = ${user.id} AND type IN ('fuel', 'tutorial_fuel', 'referral_fuel')
                `
                await pushChallengeProgress(sql, user.id, { sparks_fueled: fuelCount })
            })().catch(err => console.error('Challenge push (fuel) failed:', err))
        )

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
async function cool(sql, user, body, event) {
    const { sparkId, sparks: rawSparks } = body
    const numSparks = parseInt(rawSparks)

    if (!sparkId || !numSparks || numSparks < 1) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'sparkId and sparks (>= 1) are required' }) }
    }

    // Prevent trading own team's players
    const [ownTeamCoolCheck] = await sql`
        SELECT 1 FROM player_sparks ps
        JOIN league_players lp ON ps.league_player_id = lp.id
        WHERE ps.id = ${sparkId}
          AND lp.team_id IN (
              SELECT lp2.team_id FROM league_players lp2
              JOIN teams t ON t.id = lp2.team_id
              WHERE lp2.player_id = (SELECT linked_player_id FROM users WHERE id = ${user.id})
                AND lp2.is_active = true
          )
    `
    if (ownTeamCoolCheck) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'You cannot cool players on your own team' }) }
    }

    try {
        const result = await transaction(async (tx) => {
            return await executeCool(tx, user.id, sparkId, numSparks)
        })

        // Push challenge progress (background, survives response)
        event.waitUntil(
            (async () => {
                const [{ count: coolCount }] = await sql`
                    SELECT COUNT(*)::integer as count FROM spark_transactions
                    WHERE user_id = ${user.id} AND type IN ('cool', 'liquidate')
                `
                const stats = { sparks_cooled: coolCount }
                if (result.profit > 0) {
                    const [{ total }] = await sql`
                        SELECT COALESCE(SUM(
                            CASE WHEN st.type IN ('cool', 'liquidate')
                            THEN st.total_cost ELSE 0 END
                        ), 0)::integer as total
                        FROM spark_transactions st
                        WHERE st.user_id = ${user.id} AND st.type IN ('cool', 'liquidate')
                    `
                    const [{ invested }] = await sql`
                        SELECT COALESCE(SUM(st.total_cost), 0)::integer as invested
                        FROM spark_transactions st
                        WHERE st.user_id = ${user.id} AND st.type IN ('fuel', 'tutorial_fuel', 'referral_fuel')
                    `
                    const netProfit = Math.max(total - invested, 0)
                    stats.forge_profit = netProfit
                }
                await pushChallengeProgress(sql, user.id, stats)
            })().catch(err => console.error('Challenge push (cool) failed:', err))
        )

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
// ═══════════════════════════════════════════════════
// POST: Toggle market status (open/closed) — Owner only
// ═══════════════════════════════════════════════════
async function adminToggleStatus(sql, event, user, body) {
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


// ═══════════════════════════════════════════════════
// GET: Tutorial status — check if user has completed the forge tutorial
// Scoped per league: 3 free Starter Sparks shared across all divisions in the league
// ═══════════════════════════════════════════════════
async function getTutorialStatus(sql, user, params) {
    const { seasonId } = params
    if (!seasonId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'seasonId is required' }) }
    }

    // Find all markets in the same league as the requested season
    const leagueMarkets = await sql`
        SELECT fm.id FROM forge_markets fm
        JOIN seasons s ON fm.season_id = s.id
        WHERE s.league_id = (SELECT league_id FROM seasons WHERE id = ${seasonId})
    `
    if (!leagueMarkets.length) {
        return { statusCode: 200, headers, body: JSON.stringify({ completed: false, freeSparksRemaining: 3 }) }
    }

    const marketIds = leagueMarkets.map(m => m.id)

    const [done] = await sql`
        SELECT 1 FROM passion_transactions
        WHERE user_id = ${user.id} AND type = 'forge_tutorial_grant'
          AND reference_id = ANY(${marketIds.map(String)})
        LIMIT 1
    `

    // Also consider tutorial done if user owns any sparks in this league
    const [ownsSparks] = !done ? await sql`
        SELECT 1 FROM spark_holdings sh
        JOIN player_sparks ps ON sh.spark_id = ps.id
        WHERE sh.user_id = ${user.id}
          AND ps.market_id = ANY(${marketIds})
          AND sh.sparks > 0
        LIMIT 1
    ` : [null]

    // Count free sparks used across all markets in the league
    const [{ total_used }] = await sql`
        SELECT COALESCE(SUM(st.sparks), 0)::integer as total_used
        FROM spark_transactions st
        JOIN player_sparks ps ON st.spark_id = ps.id
        WHERE st.user_id = ${user.id}
          AND st.type = 'tutorial_fuel'
          AND ps.market_id = ANY(${marketIds})
    `

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            completed: !!(done || ownsSparks),
            freeSparksRemaining: Math.max(0, 3 - total_used),
        }),
    }
}


// ═══════════════════════════════════════════════════
// POST: Tutorial fuel — grant 1 free Starter Spark (up to 3 per league)
// First call sets tutorial completion marker; subsequent calls just grant free sparks
// ═══════════════════════════════════════════════════
async function tutorialFuel(sql, user, body, event) {
    const { sparkId } = body
    if (!sparkId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'sparkId is required' }) }
    }

    const MAX_FREE_SPARKS = 3

    try {
        const result = await transaction(async (tx) => {
            // Lock player_sparks row
            const [stock] = await tx`
                SELECT id, current_price, total_sparks, perf_multiplier, market_id
                FROM player_sparks WHERE id = ${sparkId} FOR UPDATE
            `
            if (!stock) throw new Error('Player spark not found')

            // Check market is open
            const [market] = await tx`
                SELECT status, base_price FROM forge_markets WHERE id = ${stock.market_id}
            `
            if (!market || market.status !== 'open') throw new Error('Market is not open')

            // Find all markets in the same league
            const leagueMarkets = await tx`
                SELECT fm.id FROM forge_markets fm
                JOIN seasons s ON fm.season_id = s.id
                WHERE s.league_id = (
                    SELECT s2.league_id FROM forge_markets fm2
                    JOIN seasons s2 ON fm2.season_id = s2.id
                    WHERE fm2.id = ${stock.market_id}
                )
            `
            const leagueMarketIds = leagueMarkets.map(m => m.id)

            // Count free sparks already used across all markets in this league
            const [{ total_used }] = await tx`
                SELECT COALESCE(SUM(st.sparks), 0)::integer as total_used
                FROM spark_transactions st
                JOIN player_sparks ps ON st.spark_id = ps.id
                WHERE st.user_id = ${user.id}
                  AND st.type = 'tutorial_fuel'
                  AND ps.market_id = ANY(${leagueMarketIds})
            `
            if (total_used >= MAX_FREE_SPARKS) {
                throw new Error('All Starter Sparks have been used')
            }

            // Check own-team restriction
            const [ownTeamCheck] = await tx`
                SELECT 1 FROM player_sparks ps_check
                JOIN league_players lp ON ps_check.league_player_id = lp.id
                WHERE ps_check.id = ${sparkId}
                  AND lp.team_id IN (
                      SELECT lp2.team_id FROM league_players lp2
                      JOIN teams t ON t.id = lp2.team_id
                      WHERE lp2.player_id = (SELECT linked_player_id FROM users WHERE id = ${user.id})
                        AND lp2.is_active = true
                  )
            `
            if (ownTeamCheck) throw new Error('You cannot fuel players on your own team')

            // Calculate theoretical cost for 1 spark — used as cost basis
            const price = calcPrice(market.base_price, Number(stock.perf_multiplier), stock.total_sparks)
            const theoreticalCost = Math.round(price)

            // Update player_sparks (bonding curve updates normally)
            const newTotalSparks = stock.total_sparks + 1
            const newPrice = calcPrice(market.base_price, Number(stock.perf_multiplier), newTotalSparks)
            await tx`
                UPDATE player_sparks SET
                    total_sparks = ${newTotalSparks},
                    current_price = ${newPrice},
                    updated_at = NOW()
                WHERE id = ${sparkId}
            `

            // Upsert holding — tutorial_sparks are non-coolable, cost basis = theoretical price
            await tx`
                INSERT INTO spark_holdings (user_id, spark_id, sparks, total_invested, tutorial_sparks)
                VALUES (${user.id}, ${sparkId}, 1, ${theoreticalCost}, 1)
                ON CONFLICT (user_id, spark_id) DO UPDATE SET
                    sparks = spark_holdings.sparks + 1,
                    total_invested = spark_holdings.total_invested + ${theoreticalCost},
                    tutorial_sparks = spark_holdings.tutorial_sparks + 1,
                    updated_at = NOW()
            `

            // Record transaction with type 'tutorial_fuel'
            await tx`
                INSERT INTO spark_transactions (user_id, spark_id, type, sparks, price_per_spark, total_cost)
                VALUES (${user.id}, ${sparkId}, 'tutorial_fuel', 1, ${newPrice}, ${theoreticalCost})
            `

            // Price history snapshot
            await tx`
                INSERT INTO spark_price_history (spark_id, price, trigger)
                VALUES (${sparkId}, ${newPrice}, 'fuel')
            `

            // Set completion marker only on first use (tutorial completion)
            const isFirstUse = total_used === 0
            if (isFirstUse) {
                await grantPassion(tx, user.id, 'forge_tutorial_grant', 0,
                    'Forge tutorial: Starter Spark granted', String(stock.market_id))
            }

            const freeSparksRemaining = MAX_FREE_SPARKS - total_used - 1
            return { newPrice: Number(newPrice), theoreticalCost, sparks: 1, freeSparksRemaining, isFirstUse }
        })

        // Push challenge progress (background, survives response)
        event.waitUntil(
            (async () => {
                const [{ count: fuelCount }] = await sql`
                    SELECT COUNT(*)::integer as count FROM spark_transactions
                    WHERE user_id = ${user.id} AND type IN ('fuel', 'tutorial_fuel', 'referral_fuel')
                `
                const stats = { sparks_fueled: fuelCount }
                if (result.isFirstUse) stats.forge_tutorial_completed = 1
                await pushChallengeProgress(sql, user.id, stats)
            })().catch(err => console.error('Challenge push (tutorial fuel) failed:', err))
        )

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                newPrice: result.newPrice,
                savedCost: result.theoreticalCost,
                sparks: result.sparks,
                freeSparksRemaining: result.freeSparksRemaining,
            }),
        }
    } catch (err) {
        if (err.message.includes('not found') || err.message.includes('not open') || err.message.includes('Starter Sparks') || err.message.includes('own team')) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: err.message }) }
        }
        throw err
    }
}


// ═══════════════════════════════════════════════════
// Claim a forge referral (links referrer, grants both users 1 free Spark)
// ═══════════════════════════════════════════════════
async function claimForgeReferral(sql, user, body) {
    const { refCode } = body
    if (!refCode) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'refCode is required' }) }
    }

    const [referrer] = await sql`
        SELECT id FROM users WHERE referral_code = ${refCode}
    `
    if (!referrer) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid referral code' }) }
    }

    const result = await processForgeReferral(sql, referrer.id, user.id)
    if (!result) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Already have a Forge referrer or cannot self-refer' }) }
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'Forge referral claimed! You both earned 1 free Spark.' }),
    }
}


// ═══════════════════════════════════════════════════
// Use a referral Spark (mirrors tutorialFuel but uses referral_sparks)
// ═══════════════════════════════════════════════════
async function referralFuel(sql, user, body, event) {
    const { sparkId } = body
    if (!sparkId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'sparkId is required' }) }
    }

    try {
        const result = await transaction(async (tx) => {
            // Check user has referral sparks available
            const [u] = await tx`
                SELECT forge_referral_sparks FROM users WHERE id = ${user.id} FOR UPDATE
            `
            if (!u || u.forge_referral_sparks <= 0) {
                throw new Error('No referral Sparks available')
            }

            // Lock player_sparks row
            const [stock] = await tx`
                SELECT id, current_price, total_sparks, perf_multiplier, market_id
                FROM player_sparks WHERE id = ${sparkId} FOR UPDATE
            `
            if (!stock) throw new Error('Player spark not found')

            // Check market is open
            const [market] = await tx`
                SELECT status, base_price FROM forge_markets WHERE id = ${stock.market_id}
            `
            if (!market || market.status !== 'open') throw new Error('Market is not open')

            // Check own-team restriction
            const [ownTeamRefCheck] = await tx`
                SELECT 1 FROM player_sparks ps_check
                JOIN league_players lp ON ps_check.league_player_id = lp.id
                WHERE ps_check.id = ${sparkId}
                  AND lp.team_id IN (
                      SELECT lp2.team_id FROM league_players lp2
                      WHERE lp2.player_id = (SELECT linked_player_id FROM users WHERE id = ${user.id})
                        AND lp2.is_active = true
                  )
            `
            if (ownTeamRefCheck) throw new Error('You cannot fuel players on your own team')

            // Calculate theoretical cost for 1 spark (cost basis)
            const price = calcPrice(market.base_price, Number(stock.perf_multiplier), stock.total_sparks)
            const theoreticalCost = Math.round(price)

            // Update player_sparks (bonding curve updates normally)
            const newTotalSparks = stock.total_sparks + 1
            const newPrice = calcPrice(market.base_price, Number(stock.perf_multiplier), newTotalSparks)
            await tx`
                UPDATE player_sparks SET
                    total_sparks = ${newTotalSparks},
                    current_price = ${newPrice},
                    updated_at = NOW()
                WHERE id = ${sparkId}
            `

            // Upsert holding — referral_sparks are non-coolable
            await tx`
                INSERT INTO spark_holdings (user_id, spark_id, sparks, total_invested, referral_sparks)
                VALUES (${user.id}, ${sparkId}, 1, ${theoreticalCost}, 1)
                ON CONFLICT (user_id, spark_id) DO UPDATE SET
                    sparks = spark_holdings.sparks + 1,
                    total_invested = spark_holdings.total_invested + ${theoreticalCost},
                    referral_sparks = spark_holdings.referral_sparks + 1,
                    updated_at = NOW()
            `

            // Record transaction
            await tx`
                INSERT INTO spark_transactions (user_id, spark_id, type, sparks, price_per_spark, total_cost)
                VALUES (${user.id}, ${sparkId}, 'referral_fuel', 1, ${newPrice}, ${theoreticalCost})
            `

            // Price history snapshot
            await tx`
                INSERT INTO spark_price_history (spark_id, price, trigger)
                VALUES (${sparkId}, ${newPrice}, 'fuel')
            `

            // Decrement user's referral sparks
            await tx`
                UPDATE users SET forge_referral_sparks = forge_referral_sparks - 1
                WHERE id = ${user.id}
            `

            return { newPrice: Number(newPrice), theoreticalCost }
        })

        // Push challenge progress (background)
        event.waitUntil(
            (async () => {
                const [{ count: fuelCount }] = await sql`
                    SELECT COUNT(*)::integer as count FROM spark_transactions
                    WHERE user_id = ${user.id} AND type IN ('fuel', 'tutorial_fuel', 'referral_fuel')
                `
                await pushChallengeProgress(sql, user.id, { sparks_fueled: fuelCount })
            })().catch(err => console.error('Challenge push (referral fuel) failed:', err))
        )

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                newPrice: result.newPrice,
                savedCost: result.theoreticalCost,
                sparks: 1,
            }),
        }
    } catch (err) {
        if (err.message.includes('not found') || err.message.includes('not open') || err.message.includes('No referral') || err.message.includes('own team')) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: err.message }) }
        }
        throw err
    }
}


// ═══════════════════════════════════════════════════
// Helper: Track daily Forge visit + holding days for challenges
// Uses 0-amount passion_transactions as visit markers (daily cooldown)
// ═══════════════════════════════════════════════════
async function trackForgeVisit(sql, userId) {
    // Check if already visited today
    const [visited] = await sql`
        SELECT 1 FROM passion_transactions
        WHERE user_id = ${userId} AND type = 'forge_daily_visit'
          AND created_at >= CURRENT_DATE
        LIMIT 1
    `
    if (visited) return

    // Record today's visit
    await grantPassion(sql, userId, 'forge_daily_visit', 0, 'Forge visit')

    // Count total distinct visit days
    const [{ count: visitDays }] = await sql`
        SELECT COUNT(DISTINCT DATE(created_at))::integer as count
        FROM passion_transactions
        WHERE user_id = ${userId} AND type = 'forge_daily_visit'
    `

    const stats = { forge_days_visited: visitDays }

    // If user has any holdings, also count as a holding day
    const [hasHoldings] = await sql`
        SELECT 1 FROM spark_holdings WHERE user_id = ${userId} AND sparks > 0 LIMIT 1
    `
    if (hasHoldings) {
        // Record holding day marker
        await grantPassion(sql, userId, 'forge_holding_day', 0, 'Forge holding day')

        const [{ count: holdingDays }] = await sql`
            SELECT COUNT(DISTINCT DATE(created_at))::integer as count
            FROM passion_transactions
            WHERE user_id = ${userId} AND type = 'forge_holding_day'
        `
        stats.forge_days_holding = holdingDays
    }

    // Push challenge progress
    await pushChallengeProgress(sql, userId, stats)
}


export const onRequest = adapt(handler)

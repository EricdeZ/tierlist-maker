// Fantasy Forge — GET handlers for market data, portfolio, leaderboard, and price history.

import { headers, getHeaders } from '../db.js'
import { pushChallengeProgress } from '../challenges.js'
import {
    calcPrice,
    decaySellPressure,
    ensureMarket,
    ensurePlayerSparks,
    loadForgeConfig,
} from './helpers.js'
import { grantPassion } from '../passion.js'


// ═══════════════════════════════════════════════════
// GET: Market overview — all player sparks + user holdings
// ═══════════════════════════════════════════════════
export async function getMarket(sql, user, params, event) {
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
            ps.sell_pressure, ps.sell_pressure_updated_at,
            ps.last_perf_update, ps.updated_at,
            p.name as player_name, p.slug as player_slug,
            lp.role, lp.team_id, lp.is_active,
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
          AND lp.roster_status != 'sub'
          AND (lp.is_active = true OR ps.total_sparks > 0)
        ORDER BY ps.current_price DESC
    `

    // Get user's holdings for this market
    const sparkIds = sparks.map(s => s.spark_id)
    let userHoldings = []
    if (sparkIds.length > 0) {
        userHoldings = await sql`
            SELECT spark_id, sparks, total_invested, tutorial_sparks, referral_sparks
            FROM spark_holdings
            WHERE user_id = ${user.id} AND spark_id = ANY(${sparkIds})
        `
    }

    // Build holdings map
    const holdingsMap = {}
    for (const h of userHoldings) {
        const tutorialSparks = h.tutorial_sparks || 0
        const referralSparks = h.referral_sparks || 0
        holdingsMap[h.spark_id] = {
            sparks: h.sparks,
            totalInvested: Number(h.total_invested),
            tutorialSparks,
            referralSparks,
            coolableSparks: h.sparks - tutorialSparks - referralSparks,
        }
    }

    // Get 24h and 7d price changes from history
    // Falls back to earliest available price when no entry exists before the cutoff
    const [priceChanges24h, priceChanges7d] = sparkIds.length > 0 ? await Promise.all([
        sql`
            SELECT DISTINCT ON (spark_id) spark_id, price
            FROM spark_price_history
            WHERE spark_id = ANY(${sparkIds})
            ORDER BY spark_id,
              CASE WHEN created_at <= NOW() - INTERVAL '24 hours' THEN 0 ELSE 1 END,
              CASE WHEN created_at <= NOW() - INTERVAL '24 hours'
                   THEN -extract(epoch FROM created_at)
                   ELSE extract(epoch FROM created_at) END
        `,
        sql`
            SELECT DISTINCT ON (spark_id) spark_id, price
            FROM spark_price_history
            WHERE spark_id = ANY(${sparkIds})
            ORDER BY spark_id,
              CASE WHEN created_at <= NOW() - INTERVAL '7 days' THEN 0 ELSE 1 END,
              CASE WHEN created_at <= NOW() - INTERVAL '7 days'
                   THEN -extract(epoch FROM created_at)
                   ELSE extract(epoch FROM created_at) END
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

    // Load lock flags for frontend
    const forgeConfig = await loadForgeConfig(sql)

    const result = sparks.map(s => {
        const holding = holdingsMap[s.spark_id] || null
        const price24hAgo = priceChangeMap[s.spark_id]
        const price7dAgo = priceChange7dMap[s.spark_id]
        // Compute real-time price with decayed sell pressure
        const dp = decaySellPressure(Number(s.sell_pressure), s.sell_pressure_updated_at)
        const currentPrice = Math.round(calcPrice(market.base_price, Number(s.perf_multiplier), s.total_sparks, dp) * 100) / 100
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
            isFreeAgent: !s.is_active,
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
                fuelingLocked: forgeConfig.FUELING_LOCKED,
                coolingLocked: forgeConfig.COOLING_LOCKED,
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
export async function getMarketStatuses(sql) {
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
export async function getPortfolio(sql, user, params) {
    const { seasonId } = params
    if (!seasonId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'seasonId is required' }) }
    }

    const [market] = await sql`
        SELECT id, base_price FROM forge_markets WHERE season_id = ${seasonId}
    `
    if (!market) {
        return { statusCode: 200, headers, body: JSON.stringify({ holdings: [], stats: null }) }
    }

    // Get holdings with player/price info
    const holdings = await sql`
        SELECT
            sh.spark_id, sh.sparks, sh.total_invested, sh.tutorial_sparks, sh.referral_sparks,
            ps.current_price, ps.total_sparks, ps.perf_multiplier,
            ps.sell_pressure, ps.sell_pressure_updated_at,
            p.name as player_name, p.slug as player_slug,
            lp.role, lp.is_active,
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
        // Compute real-time price with decayed sell pressure
        const dp = decaySellPressure(Number(h.sell_pressure), h.sell_pressure_updated_at)
        const currentPrice = Math.round(calcPrice(market.base_price, Number(h.perf_multiplier), h.total_sparks, dp) * 100) / 100
        const invested = Number(h.total_invested)
        const value = Math.round(currentPrice * h.sparks)
        const avgBuyPrice = h.sparks > 0 ? invested / h.sparks : 0
        const unrealizedPL = value - Math.round(invested)
        const tutorialSparks = h.tutorial_sparks || 0
        const referralSparks = h.referral_sparks || 0
        const coolableSparks = h.sparks - tutorialSparks - referralSparks

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
            isFreeAgent: !h.is_active,
            sparks: h.sparks,
            tutorialSparks,
            referralSparks,
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
export async function getPortfolioTimeline(sql, user, params) {
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
    const positions = {}   // sparkId -> numSparks held
    const lastPrice = {}   // sparkId -> latest known price
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
// Profit = current holdings value + realized proceeds (cool/liquidate) - all fuel costs (incl. tutorial)
// ═══════════════════════════════════════════════════
export async function getLeaderboard(sql, params) {
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
                COALESCE(SUM(CASE WHEN st.type = 'fuel' THEN st.total_cost ELSE 0 END), 0) as regular_fuel_costs,
                COALESCE(SUM(CASE WHEN st.type IN ('tutorial_fuel', 'referral_fuel') THEN st.total_cost ELSE 0 END), 0) as free_fuel_costs
            FROM spark_transactions st
            JOIN player_sparks ps ON st.spark_id = ps.id
            WHERE ps.market_id = ${market.id}
            GROUP BY st.user_id
        ),
        user_holdings AS (
            SELECT
                sh.user_id,
                SUM(sh.sparks * ps.current_price)::integer as portfolio_value,
                SUM(GREATEST(
                    sh.sparks * 10,
                    sh.sparks * fm.base_price * ps.perf_multiplier * (
                        1 + 0.02 * (ps.total_sparks::numeric - 1.5 * sh.sparks - 0.5)
                    )
                ))::integer as sell_value,
                COALESCE(SUM(sh.total_invested), 0)::integer as remaining_invested,
                COUNT(DISTINCT sh.spark_id)::integer as holdings_count,
                SUM(sh.sparks)::integer as total_sparks
            FROM spark_holdings sh
            JOIN player_sparks ps ON sh.spark_id = ps.id
            JOIN forge_markets fm ON ps.market_id = fm.id
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
            (
                COALESCE(uh.sell_value, 0)
                - COALESCE(ut.regular_fuel_costs, 0)
                - COALESCE(ut.free_fuel_costs, 0)
                + COALESCE(ut.realized_proceeds, 0)
            )::integer as total_profit,
            (
                COALESCE(ut.realized_proceeds, 0)
                - COALESCE(ut.regular_fuel_costs, 0)
                - COALESCE(ut.free_fuel_costs, 0)
                + COALESCE(uh.remaining_invested, 0)
            )::integer as realized_profit
        FROM user_holdings uh
        FULL OUTER JOIN user_transactions ut ON uh.user_id = ut.user_id
        JOIN users u ON COALESCE(uh.user_id, ut.user_id) = u.id
        LEFT JOIN players pl ON u.linked_player_id = pl.id
    `

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            leaderboard: leaders
                .sort((a, b) => b.total_profit - a.total_profit)
                .map((l, i) => ({
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
                realizedProfit: l.realized_profit,
            })),
        }),
    }
}


// ═══════════════════════════════════════════════════
// GET: Price history for a player spark
// ═══════════════════════════════════════════════════
export async function getHistory(sql, params) {
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

export async function getBatchHistory(sql, params) {
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

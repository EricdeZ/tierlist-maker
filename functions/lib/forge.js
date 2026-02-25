// Fantasy Forge — core helpers for the player investment market.

import { grantPassion } from './passion.js'
import { pushChallengeProgress } from './challenges.js'

// ═══════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════
export const FORGE_CONFIG = {
    BASE_PRICE: 50,
    SUPPLY_FACTOR: 0.01,       // 1% price increase per outstanding Spark
    COOLING_TAX: 0.10,         // 10% fee on selling
    PRICE_FLOOR: 10,
    PERF_DAMPENING: 0.50,      // how aggressively each game adjusts multiplier
    PERF_CLAMP_MIN: 0.5,
    PERF_CLAMP_MAX: 2.0,
    DECAY_HALF_LIFE: 7,        // days for 50% recency decay on role averages
}

const ROLE_WEIGHTS = {
    support: { kills: 0.15, deaths: 0.05, assists: 0.25, kp: 0.25, mitigated: 0.20, damage: 0.10 },
    adc:     { kills: 0.25, deaths: 0.30, assists: 0.20, kp: 0.05, damage: 0.20 },
    mid:     { kills: 0.20, deaths: 0.25, assists: 0.10, kp: 0.10, damage: 0.35 },
    jungle:  { kills: 0.30, deaths: 0.20, assists: 0.10, kp: 0.25, mitigated: 0.05, damage: 0.10 },
    solo:    { kills: 0.15, deaths: 0.15, assists: 0.05, kp: 0.15, mitigated: 0.30, damage: 0.20 },
}
const DEFAULT_WEIGHTS = { kills: 0.20, deaths: 0.20, assists: 0.15, kp: 0.15, mitigated: 0.15, damage: 0.15 }

// ═══════════════════════════════════════════════════
// Price calculation
// ═══════════════════════════════════════════════════

/**
 * Calculate price from the bonding curve.
 * price = basePrice × perfMultiplier × (1 + supplyFactor × totalSparks)
 * Enforces a price floor.
 */
export function calcPrice(basePrice, perfMultiplier, totalSparks) {
    const raw = basePrice * perfMultiplier * (1 + FORGE_CONFIG.SUPPLY_FACTOR * totalSparks)
    return Math.max(raw, FORGE_CONFIG.PRICE_FLOOR)
}

// ═══════════════════════════════════════════════════
// Performance scoring
// ═══════════════════════════════════════════════════

/**
 * Calculate a composite performance score normalized to 1.0 for average.
 * Each stat is normalized against role averages, then weighted by role-specific weights.
 * Deaths are inverted (fewer deaths = higher score).
 *
 * @param {{ kills: number, deaths: number, assists: number, kp: number, damage: number, mitigated: number }} stats
 * @param {{ avgKills: number, avgDeaths: number, avgAssists: number, avgKp: number, avgDamage: number, avgMitigated: number }} roleAvgs
 * @param {string} role - lowercase role name
 * @returns {number} score centered around 1.0
 */
export function calcCompositeScore(stats, roleAvgs, role) {
    const w = ROLE_WEIGHTS[role] || DEFAULT_WEIGHTS

    const normKills     = roleAvgs.avgKills     > 0 ? stats.kills     / roleAvgs.avgKills     : 1.0
    const normAssists   = roleAvgs.avgAssists   > 0 ? stats.assists   / roleAvgs.avgAssists   : 1.0
    const normKp        = roleAvgs.avgKp        > 0 ? stats.kp        / roleAvgs.avgKp        : 1.0
    const normDamage    = roleAvgs.avgDamage    > 0 ? stats.damage    / roleAvgs.avgDamage    : 1.0
    const normMitigated = roleAvgs.avgMitigated > 0 ? stats.mitigated / roleAvgs.avgMitigated : 1.0

    // Deaths inverted: fewer deaths = higher score. Floor at 0.5 to avoid infinity, cap at 3.0.
    const playerDeaths = Math.max(stats.deaths, 0.5)
    const normDeaths = roleAvgs.avgDeaths > 0
        ? Math.min(roleAvgs.avgDeaths / playerDeaths, 3.0)
        : 1.0

    return (w.kills     || 0) * normKills
         + (w.deaths    || 0) * normDeaths
         + (w.assists   || 0) * normAssists
         + (w.kp        || 0) * normKp
         + (w.damage    || 0) * normDamage
         + (w.mitigated || 0) * normMitigated
}


// ═══════════════════════════════════════════════════
// Market initialization
// ═══════════════════════════════════════════════════

/**
 * Find or create a forge market for a season.
 * Returns the market row.
 */
export async function ensureMarket(sql, seasonId) {
    const [existing] = await sql`
        SELECT * FROM forge_markets WHERE season_id = ${seasonId}
    `
    if (existing) return existing

    const [created] = await sql`
        INSERT INTO forge_markets (season_id)
        VALUES (${seasonId})
        ON CONFLICT (season_id) DO UPDATE SET season_id = forge_markets.season_id
        RETURNING *
    `
    return created
}

/**
 * Ensure player_sparks rows exist for all active league_players in a season.
 * Creates rows with initial price and logs an 'init' price history entry.
 */
export async function ensurePlayerSparks(sql, marketId, seasonId) {
    // Find league_players without a corresponding player_sparks row
    const missing = await sql`
        SELECT lp.id as league_player_id
        FROM league_players lp
        WHERE lp.season_id = ${seasonId}
          AND lp.is_active = true
          AND NOT EXISTS (
              SELECT 1 FROM player_sparks ps
              WHERE ps.market_id = ${marketId} AND ps.league_player_id = lp.id
          )
    `

    if (missing.length === 0) return

    for (const { league_player_id } of missing) {
        const [spark] = await sql`
            INSERT INTO player_sparks (market_id, league_player_id, current_price)
            VALUES (${marketId}, ${league_player_id}, ${FORGE_CONFIG.BASE_PRICE})
            ON CONFLICT (market_id, league_player_id) DO NOTHING
            RETURNING id, current_price
        `
        if (spark) {
            await sql`
                INSERT INTO spark_price_history (spark_id, price, trigger)
                VALUES (${spark.id}, ${spark.current_price}, 'init')
            `
        }
    }
}

// ═══════════════════════════════════════════════════
// Trade execution
// ═══════════════════════════════════════════════════

/**
 * Execute a Fuel (buy) order inside a transaction.
 *
 * @param {function} tx - transaction tagged template
 * @param {number} userId
 * @param {number} sparkId - player_sparks.id
 * @param {number} numSparks - number of Sparks to buy
 * @returns {{ newPrice, totalCost, holding }}
 */
export async function executeFuel(tx, userId, sparkId, numSparks) {
    // Lock the player_sparks row
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

    // Calculate cost: each Spark costs the current price at time of purchase
    // For multiple Sparks, price increases with each one (stepped)
    let totalCost = 0
    let currentSparks = stock.total_sparks
    for (let i = 0; i < numSparks; i++) {
        const price = calcPrice(market.base_price, Number(stock.perf_multiplier), currentSparks)
        totalCost += Math.round(price)
        currentSparks++
    }

    // Check user balance
    const [balance] = await tx`
        SELECT balance FROM passion_balances WHERE user_id = ${userId}
    `
    if (!balance || balance.balance < totalCost) {
        throw new Error('Insufficient Passion balance')
    }

    // Deduct Passion
    await grantPassion(tx, userId, 'forge_fuel', -totalCost,
        `Fueled player (${numSparks} Spark${numSparks > 1 ? 's' : ''})`, String(sparkId))

    // Update player_sparks
    const newTotalSparks = stock.total_sparks + numSparks
    const newPrice = calcPrice(market.base_price, Number(stock.perf_multiplier), newTotalSparks)
    await tx`
        UPDATE player_sparks SET
            total_sparks = ${newTotalSparks},
            current_price = ${newPrice},
            updated_at = NOW()
        WHERE id = ${sparkId}
    `

    // Upsert holding
    await tx`
        INSERT INTO spark_holdings (user_id, spark_id, sparks, total_invested)
        VALUES (${userId}, ${sparkId}, ${numSparks}, ${totalCost})
        ON CONFLICT (user_id, spark_id) DO UPDATE SET
            sparks = spark_holdings.sparks + ${numSparks},
            total_invested = spark_holdings.total_invested + ${totalCost},
            updated_at = NOW()
    `

    // Record transaction
    await tx`
        INSERT INTO spark_transactions (user_id, spark_id, type, sparks, price_per_spark, total_cost)
        VALUES (${userId}, ${sparkId}, 'fuel', ${numSparks}, ${newPrice}, ${totalCost})
    `

    // Price history snapshot
    await tx`
        INSERT INTO spark_price_history (spark_id, price, trigger)
        VALUES (${sparkId}, ${newPrice}, 'fuel')
    `

    // Get updated holding
    const [holding] = await tx`
        SELECT sparks, total_invested FROM spark_holdings
        WHERE user_id = ${userId} AND spark_id = ${sparkId}
    `

    return { newPrice: Number(newPrice), totalCost, holding }
}

/**
 * Execute a Cool (sell) order inside a transaction.
 * Applies the 10% cooling tax.
 *
 * @param {function} tx - transaction tagged template
 * @param {number} userId
 * @param {number} sparkId - player_sparks.id
 * @param {number} numSparks - number of Sparks to sell
 * @returns {{ newPrice, grossProceeds, coolingTax, netProceeds, holding, profit }}
 */
export async function executeCool(tx, userId, sparkId, numSparks) {
    // Lock the player_sparks row
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

    // Check user holds enough (excluding non-coolable tutorial + referral Sparks)
    const [holding] = await tx`
        SELECT sparks, total_invested, tutorial_sparks, referral_sparks FROM spark_holdings
        WHERE user_id = ${userId} AND spark_id = ${sparkId}
        FOR UPDATE
    `
    if (!holding || holding.sparks < numSparks) {
        throw new Error('Not enough Sparks to cool')
    }
    const freeSparks = (holding.tutorial_sparks || 0) + (holding.referral_sparks || 0)
    const coolableSparks = holding.sparks - freeSparks
    if (numSparks > coolableSparks) {
        throw new Error(coolableSparks > 0
            ? `Only ${coolableSparks} Sparks can be cooled (${freeSparks} are free Sparks)`
            : 'Free Sparks cannot be cooled')
    }

    // Calculate proceeds: each Spark sold at decreasing price (stepped)
    let grossProceeds = 0
    let currentSparks = stock.total_sparks
    for (let i = 0; i < numSparks; i++) {
        currentSparks--
        const price = calcPrice(market.base_price, Number(stock.perf_multiplier), currentSparks)
        grossProceeds += Math.round(price)
    }

    // Apply cooling tax
    const coolingTax = Math.round(grossProceeds * FORGE_CONFIG.COOLING_TAX)
    const netProceeds = grossProceeds - coolingTax

    // Calculate profit for this sale (proportional cost basis)
    const costBasis = Number(holding.total_invested) * (numSparks / holding.sparks)
    const profit = netProceeds - Math.round(costBasis)

    // Grant Passion (net of tax)
    await grantPassion(tx, userId, 'forge_cool', netProceeds,
        `Cooled player (${numSparks} Spark${numSparks > 1 ? 's' : ''}, ${coolingTax} tax)`, String(sparkId))

    // Update player_sparks
    const newTotalSparks = stock.total_sparks - numSparks
    const newPrice = calcPrice(market.base_price, Number(stock.perf_multiplier), newTotalSparks)
    await tx`
        UPDATE player_sparks SET
            total_sparks = ${newTotalSparks},
            current_price = ${newPrice},
            updated_at = NOW()
        WHERE id = ${sparkId}
    `

    // Update or delete holding
    const remainingSparks = holding.sparks - numSparks
    const remainingInvested = Number(holding.total_invested) - costBasis
    if (remainingSparks <= 0) {
        await tx`DELETE FROM spark_holdings WHERE user_id = ${userId} AND spark_id = ${sparkId}`
    } else {
        await tx`
            UPDATE spark_holdings SET
                sparks = ${remainingSparks},
                total_invested = ${Math.max(remainingInvested, 0)},
                updated_at = NOW()
            WHERE user_id = ${userId} AND spark_id = ${sparkId}
        `
    }

    // Record transaction
    await tx`
        INSERT INTO spark_transactions (user_id, spark_id, type, sparks, price_per_spark, total_cost)
        VALUES (${userId}, ${sparkId}, 'cool', ${numSparks}, ${newPrice}, ${netProceeds})
    `

    // Price history snapshot
    await tx`
        INSERT INTO spark_price_history (spark_id, price, trigger)
        VALUES (${sparkId}, ${newPrice}, 'cool')
    `

    // Updated holding (or null if fully cooled)
    const updatedHolding = remainingSparks > 0
        ? { sparks: remainingSparks, totalInvested: Math.max(remainingInvested, 0) }
        : null

    return { newPrice: Number(newPrice), grossProceeds, coolingTax, netProceeds, holding: updatedHolding, profit }
}

// ═══════════════════════════════════════════════════
// Performance update after match
// ═══════════════════════════════════════════════════

/**
 * Thin wrapper: resolves seasonId from matchId then runs full recalc.
 * Called fire-and-forget from admin-write.js after match submission.
 */
export async function updateForgeAfterMatch(sql, matchId) {
    const [match] = await sql`SELECT season_id FROM matches WHERE id = ${matchId}`
    if (!match) return
    await recalcForgePerformance(sql, match.season_id)
}

/**
 * Full-season performance recalculation.
 * Replays all games chronologically for every player who has played,
 * building up perf_multiplier from 1.0 game by game.
 * Role averages are season-wide, recency-weighted (50% decay per week).
 */
export async function recalcForgePerformance(sql, seasonId) {
    const [market] = await sql`
        SELECT id, base_price, status FROM forge_markets WHERE season_id = ${seasonId}
    `
    if (!market || market.status !== 'open') return

    const halfLife = FORGE_CONFIG.DECAY_HALF_LIFE

    // Query 1: Recency-weighted role averages (all roles in one query)
    const roleAvgRows = await sql`
        WITH team_kills AS (
            SELECT pgs_tk.game_id, pgs_tk.team_side, SUM(pgs_tk.kills) as total_kills
            FROM player_game_stats pgs_tk
            JOIN games g_tk ON pgs_tk.game_id = g_tk.id AND g_tk.is_completed = true
            JOIN matches m_tk ON g_tk.match_id = m_tk.id
            JOIN league_players lp_tk ON pgs_tk.league_player_id = lp_tk.id
            WHERE lp_tk.season_id = ${seasonId}
            GROUP BY pgs_tk.game_id, pgs_tk.team_side
        )
        SELECT
            LOWER(COALESCE(pgs.role_played, lp.role)) as role,
            SUM(pgs.kills * POWER(0.5, (CURRENT_DATE - m.date) / ${halfLife}::numeric))
                / NULLIF(SUM(POWER(0.5, (CURRENT_DATE - m.date) / ${halfLife}::numeric)), 0) as avg_kills,
            SUM(pgs.deaths * POWER(0.5, (CURRENT_DATE - m.date) / ${halfLife}::numeric))
                / NULLIF(SUM(POWER(0.5, (CURRENT_DATE - m.date) / ${halfLife}::numeric)), 0) as avg_deaths,
            SUM(pgs.assists * POWER(0.5, (CURRENT_DATE - m.date) / ${halfLife}::numeric))
                / NULLIF(SUM(POWER(0.5, (CURRENT_DATE - m.date) / ${halfLife}::numeric)), 0) as avg_assists,
            SUM(
                CASE WHEN tk.total_kills > 0
                    THEN (pgs.kills + pgs.assists)::numeric / tk.total_kills * POWER(0.5, (CURRENT_DATE - m.date) / ${halfLife}::numeric)
                    ELSE 0
                END
            ) / NULLIF(SUM(POWER(0.5, (CURRENT_DATE - m.date) / ${halfLife}::numeric)), 0) as avg_kp,
            SUM(COALESCE(NULLIF(pgs.damage, 0), 0) * POWER(0.5, (CURRENT_DATE - m.date) / ${halfLife}::numeric))
                / NULLIF(SUM(POWER(0.5, (CURRENT_DATE - m.date) / ${halfLife}::numeric)), 0) as avg_damage,
            SUM(COALESCE(NULLIF(pgs.mitigated, 0), 0) * POWER(0.5, (CURRENT_DATE - m.date) / ${halfLife}::numeric))
                / NULLIF(SUM(POWER(0.5, (CURRENT_DATE - m.date) / ${halfLife}::numeric)), 0) as avg_mitigated
        FROM player_game_stats pgs
        JOIN league_players lp ON pgs.league_player_id = lp.id
        JOIN games g ON pgs.game_id = g.id AND g.is_completed = true
        JOIN matches m ON g.match_id = m.id
        JOIN team_kills tk ON tk.game_id = pgs.game_id AND tk.team_side = pgs.team_side
        WHERE lp.season_id = ${seasonId}
          AND lp.roster_status != 'sub'
          AND COALESCE(pgs.role_played, lp.role) IS NOT NULL
          AND LOWER(COALESCE(pgs.role_played, lp.role)) != 'fill'
        GROUP BY LOWER(COALESCE(pgs.role_played, lp.role))
    `

    const roleAvgMap = {}
    for (const r of roleAvgRows) {
        if (!r.role) continue
        roleAvgMap[r.role] = {
            avgKills:     Number(r.avg_kills)     || 1.0,
            avgDeaths:    Number(r.avg_deaths)     || 1.0,
            avgAssists:   Number(r.avg_assists)    || 1.0,
            avgKp:        Number(r.avg_kp)         || 0.5,
            avgDamage:    Number(r.avg_damage)     || 1.0,
            avgMitigated: Number(r.avg_mitigated)  || 1.0,
        }
    }

    if (Object.keys(roleAvgMap).length === 0) return

    // Query 2: All player game stats for the season, ordered chronologically
    const allGames = await sql`
        WITH team_kills AS (
            SELECT pgs_tk.game_id, pgs_tk.team_side, SUM(pgs_tk.kills) as total_kills
            FROM player_game_stats pgs_tk
            JOIN games g_tk ON pgs_tk.game_id = g_tk.id AND g_tk.is_completed = true
            JOIN matches m_tk ON g_tk.match_id = m_tk.id
            JOIN league_players lp_tk ON pgs_tk.league_player_id = lp_tk.id
            WHERE lp_tk.season_id = ${seasonId}
            GROUP BY pgs_tk.game_id, pgs_tk.team_side
        )
        SELECT
            pgs.league_player_id,
            LOWER(COALESCE(pgs.role_played, lp.role)) as role,
            pgs.kills, pgs.deaths, pgs.assists,
            COALESCE(NULLIF(pgs.damage, 0), 0) as damage,
            COALESCE(NULLIF(pgs.mitigated, 0), 0) as mitigated,
            CASE WHEN tk.total_kills > 0
                THEN (pgs.kills + pgs.assists)::numeric / tk.total_kills
                ELSE 0
            END as kp,
            m.date as match_date
        FROM player_game_stats pgs
        JOIN league_players lp ON pgs.league_player_id = lp.id
        JOIN games g ON pgs.game_id = g.id AND g.is_completed = true
        JOIN matches m ON g.match_id = m.id
        JOIN team_kills tk ON tk.game_id = pgs.game_id AND tk.team_side = pgs.team_side
        WHERE lp.season_id = ${seasonId}
          AND lp.roster_status != 'sub'
          AND COALESCE(pgs.role_played, lp.role) IS NOT NULL
          AND LOWER(COALESCE(pgs.role_played, lp.role)) != 'fill'
        ORDER BY m.date ASC, g.id ASC
    `

    if (allGames.length === 0) return

    // Group games by player
    const playerGamesMap = new Map()
    for (const game of allGames) {
        if (!playerGamesMap.has(game.league_player_id)) {
            playerGamesMap.set(game.league_player_id, [])
        }
        playerGamesMap.get(game.league_player_id).push(game)
    }

    // Get all spark rows for this market (for batch updates)
    const sparks = await sql`
        SELECT id, league_player_id, total_sparks
        FROM player_sparks WHERE market_id = ${market.id}
    `
    const sparkMap = new Map(sparks.map(s => [s.league_player_id, s]))

    // Replay each player's season and collect updates
    const updates = []

    for (const [lpId, games] of playerGamesMap) {
        const spark = sparkMap.get(lpId)
        if (!spark) continue

        let multiplier = 1.0

        for (const game of games) {
            const avgs = roleAvgMap[game.role]
            if (!avgs) continue

            const score = calcCompositeScore(
                {
                    kills:     Number(game.kills),
                    deaths:    Number(game.deaths),
                    assists:   Number(game.assists),
                    kp:        Number(game.kp),
                    damage:    Number(game.damage),
                    mitigated: Number(game.mitigated),
                },
                avgs,
                game.role
            )

            const expected = Math.max(multiplier, 0.1)
            const ratio = score / expected
            multiplier = multiplier * (1 + FORGE_CONFIG.PERF_DAMPENING * (ratio - 1))
            multiplier = Math.max(FORGE_CONFIG.PERF_CLAMP_MIN, Math.min(multiplier, FORGE_CONFIG.PERF_CLAMP_MAX))
        }

        const newPrice = calcPrice(market.base_price, multiplier, spark.total_sparks)
        updates.push({ sparkId: spark.id, multiplier, newPrice })
    }

    if (updates.length === 0) return

    // Batch UPDATE all player_sparks
    const sparkIds = updates.map(u => u.sparkId)
    const multipliers = updates.map(u => u.multiplier)
    const prices = updates.map(u => u.newPrice)

    await sql`
        UPDATE player_sparks AS ps SET
            perf_multiplier = v.mult,
            current_price = v.price,
            last_perf_update = NOW(),
            updated_at = NOW()
        FROM (
            SELECT UNNEST(${sparkIds}::int[]) AS id,
                   UNNEST(${multipliers}::numeric[]) AS mult,
                   UNNEST(${prices}::numeric[]) AS price
        ) AS v
        WHERE ps.id = v.id
    `

    // Batch INSERT price history
    const historySparkIds = updates.map(u => u.sparkId)
    const historyPrices = updates.map(u => u.newPrice)

    await sql`
        INSERT INTO spark_price_history (spark_id, price, trigger)
        SELECT UNNEST(${historySparkIds}::int[]), UNNEST(${historyPrices}::numeric[]), 'performance'
    `

    // Track forge_perf_updates_held for users with holdings in this market
    try {
        const holdingUsers = await sql`
            SELECT DISTINCT sh.user_id
            FROM spark_holdings sh
            JOIN player_sparks ps ON sh.spark_id = ps.id
            WHERE ps.market_id = ${market.id} AND sh.sparks > 0
        `
        for (const u of holdingUsers) {
            await grantPassion(sql, u.user_id, 'forge_perf_update', 0, 'Perf update while holding')
            const [{ count }] = await sql`
                SELECT COUNT(*)::integer as count FROM passion_transactions
                WHERE user_id = ${u.user_id} AND type = 'forge_perf_update'
            `
            await pushChallengeProgress(sql, u.user_id, { forge_perf_updates_held: count })
        }
    } catch (err) {
        console.error('Forge perf update challenge tracking failed:', err)
    }
}

// ═══════════════════════════════════════════════════
// Market liquidation
// ═══════════════════════════════════════════════════

/**
 * Liquidate all holdings in a market.
 * Auto-sells at current prices with NO cooling tax.
 * Grants Passion to each holder, records transactions, clears holdings.
 */
export async function liquidateMarket(sql, marketId) {
    // Set market to closed (prevents new trades)
    await sql`
        UPDATE forge_markets SET status = 'closed' WHERE id = ${marketId} AND status = 'open'
    `

    // Get all holdings with their spark info
    const holdings = await sql`
        SELECT sh.id, sh.user_id, sh.spark_id, sh.sparks, sh.total_invested,
               sh.tutorial_sparks, sh.referral_sparks, ps.current_price
        FROM spark_holdings sh
        JOIN player_sparks ps ON sh.spark_id = ps.id
        WHERE ps.market_id = ${marketId} AND sh.sparks > 0
    `

    for (const h of holdings) {
        const price = Number(h.current_price)
        const tutorialSparks = h.tutorial_sparks || 0
        const referralSparks = h.referral_sparks || 0
        const freeSparks = tutorialSparks + referralSparks
        const regularSparks = h.sparks - freeSparks

        // Regular Sparks: full liquidation value (no tax)
        const regularProceeds = Math.round(price * regularSparks)

        // Free Sparks (tutorial + referral): profit only (current value minus cost basis)
        const freeValue = Math.round(price * freeSparks)
        const freeCostBasis = h.sparks > 0
            ? Math.round(Number(h.total_invested) * (freeSparks / h.sparks))
            : 0
        const freeProfit = Math.max(0, freeValue - freeCostBasis)

        const proceeds = regularProceeds + freeProfit
        const totalProfit = proceeds - Math.round(Number(h.total_invested)) + freeCostBasis

        // Grant Passion (no tax on liquidation)
        if (proceeds > 0) {
            const freeLabel = [
                tutorialSparks && `${tutorialSparks} tutorial`,
                referralSparks && `${referralSparks} referral`,
            ].filter(Boolean).join(', ')
            await grantPassion(sql, h.user_id, 'forge_liquidate', proceeds,
                `Season ended — auto-liquidated ${h.sparks} Spark${h.sparks > 1 ? 's' : ''}${freeLabel ? ` (${freeLabel})` : ''}`, String(h.spark_id))
        }

        // Record transaction
        await sql`
            INSERT INTO spark_transactions (user_id, spark_id, type, sparks, price_per_spark, total_cost)
            VALUES (${h.user_id}, ${h.spark_id}, 'liquidate', ${h.sparks}, ${h.current_price}, ${proceeds})
        `

        // Delete holding
        await sql`DELETE FROM spark_holdings WHERE id = ${h.id}`

        // Push challenge progress
        try {
            const stats = { sparks_cooled: h.sparks }
            if (totalProfit > 0) stats.forge_profit = totalProfit
            await pushChallengeProgress(sql, h.user_id, stats)
        } catch (err) {
            console.error(`Challenge push (liquidation) failed for user ${h.user_id}:`, err)
        }
    }

    // Mark as liquidated
    await sql`
        UPDATE forge_markets SET status = 'liquidated', closed_at = NOW()
        WHERE id = ${marketId}
    `
}

/**
 * Convenience wrapper: liquidate by season_id instead of market_id.
 */
export async function liquidateMarketBySeason(sql, seasonId) {
    const [market] = await sql`
        SELECT id, status FROM forge_markets WHERE season_id = ${seasonId}
    `
    if (!market || market.status === 'liquidated') return
    await liquidateMarket(sql, market.id)
}

// Fantasy Forge — core helpers for the player investment market.

import { grantPassion } from './passion.js'
import { pushChallengeProgress } from './challenges.js'

// ═══════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════
export const FORGE_CONFIG = {
    BASE_PRICE: 100,
    SUPPLY_FACTOR: 0.01,       // 1% price increase per outstanding Spark
    COOLING_TAX: 0.10,         // 10% fee on selling
    PRICE_FLOOR: 10,
    PERF_DAMPENING: 0.15,      // how aggressively performance adjusts multiplier
    PERF_CLAMP_MIN: 0.5,
    PERF_CLAMP_MAX: 2.0,
}

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
 * Uses the app's KDA formula: (K + A/2) / max(D, 1).
 * Composite: KDA (40%) + Damage (30%) + Mitigated (30%), each divided by role average.
 *
 * @param {number} kills
 * @param {number} deaths
 * @param {number} assists
 * @param {number} damage
 * @param {number} mitigated
 * @param {{ avgKda: number, avgDamage: number, avgMitigated: number }} roleAvgs
 * @returns {number} score centered around 1.0
 */
export function calcCompositeScore(kills, deaths, assists, damage, mitigated, roleAvgs) {
    const kda = (kills + assists / 2) / Math.max(deaths, 1)
    const normKda = roleAvgs.avgKda > 0 ? kda / roleAvgs.avgKda : 1.0
    const normDamage = roleAvgs.avgDamage > 0 ? damage / roleAvgs.avgDamage : 1.0
    const normMitigated = roleAvgs.avgMitigated > 0 ? mitigated / roleAvgs.avgMitigated : 1.0

    return normKda * 0.4 + normDamage * 0.3 + normMitigated * 0.3
}

/**
 * Update a player's performance multiplier using price-relative adjustment.
 * Players at higher prices need proportionally better stats to maintain value.
 *
 * @param {number} currentPrice
 * @param {number} basePrice
 * @param {number} actualScore - composite score (1.0 = average)
 * @param {number} oldMultiplier
 * @returns {number} clamped new multiplier
 */
export function updatePerfMultiplier(currentPrice, basePrice, actualScore, oldMultiplier) {
    const expectedScore = Math.max(currentPrice / basePrice, 0.1)
    const ratio = actualScore / expectedScore
    const adjustment = (ratio - 1.0) * FORGE_CONFIG.PERF_DAMPENING
    const raw = oldMultiplier * (1 + adjustment)
    return Math.max(FORGE_CONFIG.PERF_CLAMP_MIN, Math.min(raw, FORGE_CONFIG.PERF_CLAMP_MAX))
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

    // Check user holds enough
    const [holding] = await tx`
        SELECT sparks, total_invested FROM spark_holdings
        WHERE user_id = ${userId} AND spark_id = ${sparkId}
        FOR UPDATE
    `
    if (!holding || holding.sparks < numSparks) {
        throw new Error('Not enough Sparks to cool')
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
 * Recalculate perf_multiplier for all players in a match
 * using price-relative weekly role comparison.
 *
 * Called fire-and-forget from admin-write.js after match submission.
 */
export async function updateForgeAfterMatch(sql, matchId) {
    // Get the match's season and week
    const [match] = await sql`
        SELECT m.season_id, sm.week
        FROM matches m
        LEFT JOIN scheduled_matches sm ON sm.match_id = m.id
        WHERE m.id = ${matchId}
    `
    if (!match) return

    // Find the forge market for this season
    const [market] = await sql`
        SELECT id, base_price, status FROM forge_markets WHERE season_id = ${match.season_id}
    `
    if (!market || market.status !== 'open') return

    // Get all games in this match
    const games = await sql`
        SELECT id FROM games WHERE match_id = ${matchId} AND is_completed = true
    `
    if (games.length === 0) return

    const gameIds = games.map(g => g.id)

    // Get player stats from these games with their roles
    const playerStats = await sql`
        SELECT
            pgs.league_player_id,
            lp.role,
            AVG(pgs.kills)::numeric as avg_kills,
            AVG(pgs.deaths)::numeric as avg_deaths,
            AVG(pgs.assists)::numeric as avg_assists,
            AVG(COALESCE(NULLIF(pgs.damage, 0), 0))::numeric as avg_damage,
            AVG(COALESCE(NULLIF(pgs.mitigated, 0), 0))::numeric as avg_mitigated
        FROM player_game_stats pgs
        JOIN league_players lp ON pgs.league_player_id = lp.id
        WHERE pgs.game_id = ANY(${gameIds})
        GROUP BY pgs.league_player_id, lp.role
    `

    if (playerStats.length === 0) return

    // Collect unique roles
    const roles = [...new Set(playerStats.map(p => (p.role || '').toLowerCase()))]

    // For each role, get this week's stats across all matches for role averages
    for (const role of roles) {
        if (!role || role === 'sub') continue

        // Get all game stats for this role this week in this season
        const weekFilter = match.week != null
            ? sql`AND sm.week = ${match.week}`
            : sql`AND m.date >= (CURRENT_DATE - INTERVAL '7 days')`

        const roleStats = await sql`
            SELECT
                AVG((pgs.kills + pgs.assists / 2.0) / GREATEST(pgs.deaths, 1))::numeric as avg_kda,
                AVG(COALESCE(NULLIF(pgs.damage, 0), 0))::numeric as avg_damage,
                AVG(COALESCE(NULLIF(pgs.mitigated, 0), 0))::numeric as avg_mitigated
            FROM player_game_stats pgs
            JOIN league_players lp ON pgs.league_player_id = lp.id
            JOIN games g ON pgs.game_id = g.id AND g.is_completed = true
            JOIN matches m ON g.match_id = m.id
            LEFT JOIN scheduled_matches sm ON sm.match_id = m.id
            WHERE lp.season_id = ${match.season_id}
              AND LOWER(COALESCE(lp.role, '')) = ${role}
              ${weekFilter}
        `

        const roleAvgs = {
            avgKda: Number(roleStats[0]?.avg_kda) || 1.0,
            avgDamage: Number(roleStats[0]?.avg_damage) || 1.0,
            avgMitigated: Number(roleStats[0]?.avg_mitigated) || 1.0,
        }

        // Update each player in this role from this match
        const playersInRole = playerStats.filter(p => (p.role || '').toLowerCase() === role)

        for (const player of playersInRole) {
            const actualScore = calcCompositeScore(
                Number(player.avg_kills),
                Number(player.avg_deaths),
                Number(player.avg_assists),
                Number(player.avg_damage),
                Number(player.avg_mitigated),
                roleAvgs
            )

            // Get current spark row
            const [spark] = await sql`
                SELECT id, current_price, total_sparks, perf_multiplier
                FROM player_sparks
                WHERE market_id = ${market.id} AND league_player_id = ${player.league_player_id}
            `
            if (!spark) continue

            const newMultiplier = updatePerfMultiplier(
                Number(spark.current_price),
                market.base_price,
                actualScore,
                Number(spark.perf_multiplier)
            )

            const newPrice = calcPrice(market.base_price, newMultiplier, spark.total_sparks)

            await sql`
                UPDATE player_sparks SET
                    perf_multiplier = ${newMultiplier},
                    current_price = ${newPrice},
                    last_perf_update = NOW(),
                    updated_at = NOW()
                WHERE id = ${spark.id}
            `

            await sql`
                INSERT INTO spark_price_history (spark_id, price, trigger)
                VALUES (${spark.id}, ${newPrice}, 'performance')
            `
        }
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
               ps.current_price
        FROM spark_holdings sh
        JOIN player_sparks ps ON sh.spark_id = ps.id
        WHERE ps.market_id = ${marketId} AND sh.sparks > 0
    `

    for (const h of holdings) {
        const proceeds = Math.round(Number(h.current_price) * h.sparks)
        const profit = proceeds - Math.round(Number(h.total_invested))

        // Grant Passion (no tax on liquidation)
        await grantPassion(sql, h.user_id, 'forge_liquidate', proceeds,
            `Season ended — auto-liquidated ${h.sparks} Spark${h.sparks > 1 ? 's' : ''}`, String(h.spark_id))

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
            if (profit > 0) stats.forge_profit = profit
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

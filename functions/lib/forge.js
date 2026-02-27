// Fantasy Forge — core helpers for the player investment market.

import { grantPassion } from './passion.js'
import { pushChallengeProgress } from './challenges.js'

// ═══════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════
export const FORGE_CONFIG = {
    BASE_PRICE: 50,
    SUPPLY_FACTOR: 0.02,       // 2% price increase per outstanding Spark
    COOLING_TAX: 0.10,         // 10% fee on selling
    PRICE_FLOOR: 10,
    SELL_PRESSURE_HALF_LIFE: 1, // days for sell pressure to halve
    SELL_PRESSURE_FACTOR: 0.02, // price depression per unit of sell pressure
}

// Performance tuning defaults (overridden by forge_config DB table when available)
const PERF_DEFAULTS = {
    GAME_DECAY: 0.75,          // per-game regression toward 1.0
    SUPPLY_WEIGHT: 0.01,       // how much supply mutes score deviation
    INACTIVITY_DECAY: 0.85,    // per-week multiplicative decay for inactive players
    PERF_FLOOR: 0.10,          // hard floor on multiplier
    PERF_CEILING: 2.50,        // soft ceiling asymptote
    COMPRESS_K: 0.65,          // compression aggressiveness above 1.0
    OPPONENT_WEIGHT: 0.30,     // how much opponent quality affects score
    TEAMMATE_WEIGHT: 0.15,     // how much teammate quality affects score (inverse — strong team = slight penalty)
    GOD_WEIGHT: 0.10,          // how much god meta affects score
    WIN_BONUS: 0.05,           // flat multiplier boost for winning the game
    DECAY_HALF_LIFE: 7,        // days for 50% recency decay on role averages
    PERFORMANCE_APPROVAL: true, // when true, updates queue for approval instead of applying
}

const MS_PER_DAY = 86400000

/**
 * Load performance config from forge_config table, falling back to defaults.
 */
export async function loadForgeConfig(sql) {
    try {
        const [row] = await sql`SELECT * FROM forge_config LIMIT 1`
        if (!row) return { ...PERF_DEFAULTS }
        return {
            GAME_DECAY:      Number(row.game_decay)      || PERF_DEFAULTS.GAME_DECAY,
            SUPPLY_WEIGHT:   Number(row.supply_weight)    || PERF_DEFAULTS.SUPPLY_WEIGHT,
            INACTIVITY_DECAY: Number(row.inactivity_decay) || PERF_DEFAULTS.INACTIVITY_DECAY,
            PERF_FLOOR:      Number(row.perf_floor)       || PERF_DEFAULTS.PERF_FLOOR,
            PERF_CEILING:    Number(row.perf_ceiling)     || PERF_DEFAULTS.PERF_CEILING,
            COMPRESS_K:      Number(row.compress_k)       || PERF_DEFAULTS.COMPRESS_K,
            OPPONENT_WEIGHT: Number(row.opponent_weight)  || PERF_DEFAULTS.OPPONENT_WEIGHT,
            TEAMMATE_WEIGHT: Number(row.teammate_weight)  || PERF_DEFAULTS.TEAMMATE_WEIGHT,
            GOD_WEIGHT:      Number(row.god_weight)       || PERF_DEFAULTS.GOD_WEIGHT,
            WIN_BONUS:       Number(row.win_bonus)        || PERF_DEFAULTS.WIN_BONUS,
            DECAY_HALF_LIFE: Number(row.decay_half_life)  || PERF_DEFAULTS.DECAY_HALF_LIFE,
            SELL_PRESSURE_HALF_LIFE: Number(row.sell_pressure_half_life) || FORGE_CONFIG.SELL_PRESSURE_HALF_LIFE,
            SELL_PRESSURE_FACTOR: Number(row.sell_pressure_factor) || FORGE_CONFIG.SELL_PRESSURE_FACTOR,
            PERFORMANCE_APPROVAL: row.performance_approval ?? PERF_DEFAULTS.PERFORMANCE_APPROVAL,
        }
    } catch {
        return { ...PERF_DEFAULTS }
    }
}

/**
 * Asymmetric multiplier compression.
 * Above 1.0: exponential curve toward ceiling (gains compress).
 * Below 1.0: raw pass-through to hard floor (losses hit full force).
 */
function compressMultiplier(raw, cfg) {
    if (raw >= 1.0) {
        return 1 + (cfg.PERF_CEILING - 1) * (1 - Math.exp(-cfg.COMPRESS_K * (raw - 1)))
    }
    return Math.max(raw, cfg.PERF_FLOOR)
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
 * Decay sell pressure based on elapsed time since last update.
 * Half-life decay: pressure × 0.5^(elapsedDays / halfLife)
 */
export function decaySellPressure(pressure, updatedAt) {
    if (!pressure || pressure <= 0) return 0
    if (!updatedAt) return pressure
    const elapsedDays = (Date.now() - new Date(updatedAt).getTime()) / MS_PER_DAY
    if (elapsedDays <= 0) return pressure
    const halfLife = FORGE_CONFIG.SELL_PRESSURE_HALF_LIFE || 2
    const decayed = pressure * Math.pow(0.5, elapsedDays / halfLife)
    return decayed < 0.01 ? 0 : decayed
}

/**
 * Calculate price from the bonding curve.
 * price = basePrice × perfMultiplier × (1 + supplyFactor × totalSparks - sellPressureFactor × sellPressure)
 * Enforces a price floor.
 */
export function calcPrice(basePrice, perfMultiplier, totalSparks, sellPressure = 0) {
    const raw = basePrice * perfMultiplier * (1 + FORGE_CONFIG.SUPPLY_FACTOR * totalSparks - FORGE_CONFIG.SELL_PRESSURE_FACTOR * sellPressure)
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
        SELECT id, current_price, total_sparks, perf_multiplier, market_id,
               sell_pressure, sell_pressure_updated_at
        FROM player_sparks WHERE id = ${sparkId} FOR UPDATE
    `
    if (!stock) throw new Error('Player spark not found')

    // Check market is open
    const [market] = await tx`
        SELECT status, base_price FROM forge_markets WHERE id = ${stock.market_id}
    `
    if (!market || market.status !== 'open') throw new Error('Market is not open')

    // Decay sell pressure to current time
    const currentPressure = decaySellPressure(Number(stock.sell_pressure), stock.sell_pressure_updated_at)

    // Calculate cost: each Spark costs the current price at time of purchase
    // For multiple Sparks, price increases with each one (stepped)
    let totalCost = 0
    let currentSparks = stock.total_sparks
    for (let i = 0; i < numSparks; i++) {
        const price = calcPrice(market.base_price, Number(stock.perf_multiplier), currentSparks, currentPressure)
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

    // Update player_sparks — buying absorbs sell pressure (heals the dip)
    const newTotalSparks = stock.total_sparks + numSparks
    const healedPressure = Math.max(0, currentPressure - numSparks)
    const newPrice = calcPrice(market.base_price, Number(stock.perf_multiplier), newTotalSparks, healedPressure)
    await tx`
        UPDATE player_sparks SET
            total_sparks = ${newTotalSparks},
            current_price = ${newPrice},
            sell_pressure = ${healedPressure},
            sell_pressure_updated_at = ${healedPressure > 0 ? new Date() : null},
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
        SELECT id, current_price, total_sparks, perf_multiplier, market_id,
               sell_pressure, sell_pressure_updated_at
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

    // Decay existing sell pressure, then add new pressure from this sell
    const decayedPressure = decaySellPressure(Number(stock.sell_pressure), stock.sell_pressure_updated_at)
    const newPressure = decayedPressure + numSparks

    // Calculate proceeds: each Spark sold at decreasing price (stepped)
    // Use the NEW sell pressure so sellers feel the impact immediately
    let grossProceeds = 0
    let currentSparks = stock.total_sparks
    for (let i = 0; i < numSparks; i++) {
        currentSparks--
        const price = calcPrice(market.base_price, Number(stock.perf_multiplier), currentSparks, newPressure)
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

    // Update player_sparks (store new sell pressure)
    const newTotalSparks = stock.total_sparks - numSparks
    const newPrice = calcPrice(market.base_price, Number(stock.perf_multiplier), newTotalSparks, newPressure)
    await tx`
        UPDATE player_sparks SET
            total_sparks = ${newTotalSparks},
            current_price = ${newPrice},
            sell_pressure = ${newPressure},
            sell_pressure_updated_at = NOW(),
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
 * building up perf_multiplier from 1.0 game by game using compounding heat.
 *
 * Features:
 * - Supply-weighted expectations (popular players are harder to pump)
 * - Asymmetric compression (soft ceiling, hard floor — Forge is a Passion drain)
 * - Inactivity decay (non-playing players trend toward the floor)
 * - Opponent quality factor (beating strong teams counts for more)
 * - God meta factor (strong gods raise expectations)
 * - All tuning constants loaded from forge_config DB table
 */
export async function recalcForgePerformance(sql, seasonId) {
    const [market] = await sql`
        SELECT id, base_price, status, created_at FROM forge_markets WHERE season_id = ${seasonId}
    `
    if (!market || market.status !== 'open') return

    const cfg = await loadForgeConfig(sql)
    const halfLife = cfg.DECAY_HALF_LIFE

    // Apply DB-configurable sell pressure params to FORGE_CONFIG
    FORGE_CONFIG.SELL_PRESSURE_HALF_LIFE = cfg.SELL_PRESSURE_HALF_LIFE
    FORGE_CONFIG.SELL_PRESSURE_FACTOR = cfg.SELL_PRESSURE_FACTOR

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

    // Query 2: All player game stats + game_id, team_side, god_played for opponent/god factors
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
            g.id as game_id,
            pgs.team_side,
            LOWER(COALESCE(pgs.role_played, lp.role)) as role,
            pgs.god_played,
            pgs.kills, pgs.deaths, pgs.assists,
            COALESCE(NULLIF(pgs.damage, 0), 0) as damage,
            COALESCE(NULLIF(pgs.mitigated, 0), 0) as mitigated,
            CASE WHEN tk.total_kills > 0
                THEN (pgs.kills + pgs.assists)::numeric / tk.total_kills
                ELSE 0
            END as kp,
            m.date as match_date,
            CASE WHEN (pgs.team_side = 1 AND g.winner_team_id = m.team1_id)
                   OR (pgs.team_side = 2 AND g.winner_team_id = m.team2_id)
                 THEN true ELSE false
            END as won
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

    // ── Pre-computation: player strengths, god averages, opponent lookup ──

    // Group games by player
    const playerGamesMap = new Map()
    for (const game of allGames) {
        if (!playerGamesMap.has(game.league_player_id)) {
            playerGamesMap.set(game.league_player_id, [])
        }
        playerGamesMap.get(game.league_player_id).push(game)
    }

    const now = Date.now()

    // Pre-compute per-player recency-weighted composite score (for opponent factor)
    const playerStrengthMap = new Map()
    for (const [lpId, games] of playerGamesMap) {
        let totalWeight = 0, weightedScore = 0
        for (const game of games) {
            const avgs = roleAvgMap[game.role]
            if (!avgs) continue
            const score = calcCompositeScore(
                { kills: Number(game.kills), deaths: Number(game.deaths), assists: Number(game.assists),
                  kp: Number(game.kp), damage: Number(game.damage), mitigated: Number(game.mitigated) },
                avgs, game.role
            )
            const daysAgo = (now - new Date(game.match_date).getTime()) / MS_PER_DAY
            const weight = Math.pow(0.5, daysAgo / halfLife)
            weightedScore += score * weight
            totalWeight += weight
        }
        playerStrengthMap.set(lpId, totalWeight > 0 ? weightedScore / totalWeight : 1.0)
    }

    // Pre-compute per-god-per-role recency-weighted composite score (for god meta factor)
    const godScores = {}  // "godName:role" -> { totalWeight, weightedScore }
    for (const game of allGames) {
        const godName = (game.god_played || '').toLowerCase().trim()
        if (!godName) continue
        const avgs = roleAvgMap[game.role]
        if (!avgs) continue
        const score = calcCompositeScore(
            { kills: Number(game.kills), deaths: Number(game.deaths), assists: Number(game.assists),
              kp: Number(game.kp), damage: Number(game.damage), mitigated: Number(game.mitigated) },
            avgs, game.role
        )
        const daysAgo = (now - new Date(game.match_date).getTime()) / MS_PER_DAY
        const weight = Math.pow(0.5, daysAgo / halfLife)
        const godKey = `${godName}:${game.role}`
        if (!godScores[godKey]) godScores[godKey] = { totalWeight: 0, weightedScore: 0 }
        godScores[godKey].totalWeight += weight
        godScores[godKey].weightedScore += score * weight
    }
    const godAvgMap = {}
    for (const [key, data] of Object.entries(godScores)) {
        godAvgMap[key] = data.totalWeight > 0 ? data.weightedScore / data.totalWeight : 1.0
    }

    // Build opponent lookup: for each (game_id, team_side), list of opposing player IDs
    const gameTeamPlayers = new Map()  // "gameId:teamSide" -> [league_player_id, ...]
    for (const game of allGames) {
        const key = `${game.game_id}:${game.team_side}`
        if (!gameTeamPlayers.has(key)) gameTeamPlayers.set(key, [])
        gameTeamPlayers.get(key).push(game.league_player_id)
    }

    function getTeamStrength(gameId, teamSide, excludeLpId) {
        const players = gameTeamPlayers.get(`${gameId}:${teamSide}`) || []
        const teammates = excludeLpId ? players.filter(id => id !== excludeLpId) : players
        if (teammates.length === 0) return 1.0
        let sum = 0
        for (const lpId of teammates) sum += (playerStrengthMap.get(lpId) || 1.0)
        return sum / teammates.length
    }

    // ── Get spark rows for batch updates ──

    const sparks = await sql`
        SELECT id, league_player_id, total_sparks, sell_pressure, sell_pressure_updated_at
        FROM player_sparks WHERE market_id = ${market.id}
    `
    const sparkMap = new Map(sparks.map(s => [s.league_player_id, s]))

    // ── Replay each player's season with compounding heat ──

    const updates = []
    const processedSparkIds = new Set()
    const seasonStartDate = new Date(allGames[0].match_date).getTime()

    for (const [lpId, games] of playerGamesMap) {
        const spark = sparkMap.get(lpId)
        if (!spark) continue
        processedSparkIds.add(spark.id)

        let multiplier = 1.0
        let lastGameTime = null

        for (const game of games) {
            const avgs = roleAvgMap[game.role]
            if (!avgs) continue

            const gameTime = new Date(game.match_date).getTime()

            // 1. Inactivity decay between games (multiplicative — trends toward floor)
            if (lastGameTime !== null) {
                const dayGap = (gameTime - lastGameTime) / MS_PER_DAY
                const weeksGap = Math.floor(dayGap / 7)
                if (weeksGap > 0) {
                    multiplier = compressMultiplier(
                        multiplier * Math.pow(cfg.INACTIVITY_DECAY, weeksGap), cfg
                    )
                }
            }

            // 2. Per-game regression toward 1.0
            const decayed = 1 + (multiplier - 1) * cfg.GAME_DECAY

            // 3. Raw composite score
            const rawScore = calcCompositeScore(
                { kills: Number(game.kills), deaths: Number(game.deaths), assists: Number(game.assists),
                  kp: Number(game.kp), damage: Number(game.damage), mitigated: Number(game.mitigated) },
                avgs, game.role
            )

            // 4. Supply-dampened heat
            const heat = 1 + (rawScore - 1) / (1 + cfg.SUPPLY_WEIGHT * spark.total_sparks)

            // 5. Opponent quality factor (strong opponents = boost)
            const oppSide = game.team_side === 1 ? 2 : 1
            const oppStrength = getTeamStrength(game.game_id, oppSide)
            const oppFactor = 1 + cfg.OPPONENT_WEIGHT * (oppStrength - 1)

            // 6. Teammate quality factor (strong teammates = slight penalty, you're being carried)
            const teamStrength = getTeamStrength(game.game_id, game.team_side, lpId)
            const teamFactor = 1 + cfg.TEAMMATE_WEIGHT * (1.0 - teamStrength)

            // 7. God meta factor — compare your score to the god+role average
            const godName = (game.god_played || '').toLowerCase().trim()
            const godRoleAvg = godAvgMap[`${godName}:${game.role}`] || 1.0
            const godFactor = 1 + cfg.GOD_WEIGHT * (rawScore / godRoleAvg - 1)

            // 8. Win bonus
            const winFactor = game.won ? 1 + cfg.WIN_BONUS : 1.0

            // 9. Compound + compress
            multiplier = compressMultiplier(decayed * heat * oppFactor * teamFactor * godFactor * winFactor, cfg)
            lastGameTime = gameTime
        }

        // 8. Final inactivity decay (last game → today)
        if (lastGameTime !== null) {
            const daysSinceLast = (now - lastGameTime) / MS_PER_DAY
            const weeksInactive = Math.floor(daysSinceLast / 7)
            if (weeksInactive > 0) {
                multiplier = compressMultiplier(
                    multiplier * Math.pow(cfg.INACTIVITY_DECAY, weeksInactive), cfg
                )
            }
        }

        const dp = decaySellPressure(Number(spark.sell_pressure), spark.sell_pressure_updated_at)
        const newPrice = calcPrice(market.base_price, multiplier, spark.total_sparks, dp)
        updates.push({ sparkId: spark.id, multiplier, newPrice, decayedPressure: dp })
    }

    // 9. Process 0-game players: inactivity decay from season start
    for (const spark of sparks) {
        if (processedSparkIds.has(spark.id)) continue
        const daysSinceStart = (now - seasonStartDate) / MS_PER_DAY
        const weeksInactive = Math.floor(daysSinceStart / 7)
        if (weeksInactive <= 0) continue
        const multiplier = compressMultiplier(
            Math.pow(cfg.INACTIVITY_DECAY, weeksInactive), cfg
        )
        const dp = decaySellPressure(Number(spark.sell_pressure), spark.sell_pressure_updated_at)
        const newPrice = calcPrice(market.base_price, multiplier, spark.total_sparks, dp)
        updates.push({ sparkId: spark.id, multiplier, newPrice, decayedPressure: dp })
    }

    if (updates.length === 0) return

    // ── Approval gate: queue or apply immediately ──

    if (cfg.PERFORMANCE_APPROVAL) {
        // Delete any existing pending rows for this market (full replay = replace)
        await sql`DELETE FROM forge_pending_updates WHERE market_id = ${market.id}`

        // Fetch current multiplier/price and player names for display
        const currentSparks = await sql`
            SELECT ps.id, ps.perf_multiplier, ps.current_price,
                   COALESCE(u.display_name, u.username, 'Unknown') as player_name
            FROM player_sparks ps
            JOIN league_players lp ON ps.league_player_id = lp.id
            JOIN users u ON lp.user_id = u.id
            WHERE ps.market_id = ${market.id}
        `
        const currentMap = new Map(currentSparks.map(s => [s.id, s]))

        // Batch insert pending updates
        const pSparkIds = updates.map(u => u.sparkId)
        const pMarketIds = updates.map(() => market.id)
        const pNames = updates.map(u => currentMap.get(u.sparkId)?.player_name || 'Unknown')
        const pOldMults = updates.map(u => Number(currentMap.get(u.sparkId)?.perf_multiplier) || 1.0)
        const pNewMults = updates.map(u => u.multiplier)
        const pOldPrices = updates.map(u => Number(currentMap.get(u.sparkId)?.current_price) || 0)
        const pNewPrices = updates.map(u => u.newPrice)

        await sql`
            INSERT INTO forge_pending_updates (market_id, spark_id, player_name, old_multiplier, new_multiplier, old_price, new_price)
            SELECT
                UNNEST(${pMarketIds}::int[]),
                UNNEST(${pSparkIds}::int[]),
                UNNEST(${pNames}::text[]),
                UNNEST(${pOldMults}::numeric[]),
                UNNEST(${pNewMults}::numeric[]),
                UNNEST(${pOldPrices}::numeric[]),
                UNNEST(${pNewPrices}::numeric[])
        `
        return // Skip applying — wait for admin approval
    }

    // ── Apply immediately (approval off) ──

    // Batch UPDATE all player_sparks (also persist decayed sell pressure)
    const sparkIds = updates.map(u => u.sparkId)
    const multipliers = updates.map(u => u.multiplier)
    const prices = updates.map(u => u.newPrice)
    const pressures = updates.map(u => u.decayedPressure)

    await sql`
        UPDATE player_sparks AS ps SET
            perf_multiplier = v.mult,
            current_price = v.price,
            sell_pressure = v.sp,
            sell_pressure_updated_at = CASE WHEN v.sp > 0 THEN NOW() ELSE NULL END,
            last_perf_update = NOW(),
            updated_at = NOW()
        FROM (
            SELECT UNNEST(${sparkIds}::int[]) AS id,
                   UNNEST(${multipliers}::numeric[]) AS mult,
                   UNNEST(${prices}::numeric[]) AS price,
                   UNNEST(${pressures}::numeric[]) AS sp
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

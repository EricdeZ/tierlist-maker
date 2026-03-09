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
    EXPECTATION_WEIGHT: 0.002, // raises expected baseline per outstanding spark
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

/** Truncate a timestamp to midnight UTC (for comparing timestamptz against date columns) */
function toMidnightUTC(ms) {
    return ms - (ms % MS_PER_DAY)
}

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
            EXPECTATION_WEIGHT: Number(row.expectation_weight) ?? PERF_DEFAULTS.EXPECTATION_WEIGHT,
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
            FUELING_LOCKED: row.fueling_locked ?? false,
            COOLING_LOCKED: row.cooling_locked ?? false,
        }
    } catch {
        return { ...PERF_DEFAULTS }
    }
}

/**
 * Load time-versioned per-game config snapshots, sorted by effective_from ASC.
 * Each snapshot contains the 6 per-game scoring weights that were in effect from that time.
 */
export async function loadForgeConfigHistory(sql) {
    try {
        const rows = await sql`
            SELECT effective_from, expectation_weight, supply_weight,
                   opponent_weight, teammate_weight, god_weight, win_bonus,
                   inactivity_decay, game_decay
            FROM forge_config_history
            ORDER BY effective_from ASC
        `
        if (rows.length === 0) {
            return [{ effectiveFrom: 0, EXPECTATION_WEIGHT: PERF_DEFAULTS.EXPECTATION_WEIGHT,
                SUPPLY_WEIGHT: PERF_DEFAULTS.SUPPLY_WEIGHT, OPPONENT_WEIGHT: PERF_DEFAULTS.OPPONENT_WEIGHT,
                TEAMMATE_WEIGHT: PERF_DEFAULTS.TEAMMATE_WEIGHT, GOD_WEIGHT: PERF_DEFAULTS.GOD_WEIGHT,
                WIN_BONUS: PERF_DEFAULTS.WIN_BONUS,
                INACTIVITY_DECAY: PERF_DEFAULTS.INACTIVITY_DECAY, GAME_DECAY: PERF_DEFAULTS.GAME_DECAY }]
        }
        return rows.map(r => ({
            effectiveFrom: new Date(r.effective_from).getTime(),
            EXPECTATION_WEIGHT: Number(r.expectation_weight),
            SUPPLY_WEIGHT: Number(r.supply_weight),
            OPPONENT_WEIGHT: Number(r.opponent_weight),
            TEAMMATE_WEIGHT: Number(r.teammate_weight),
            GOD_WEIGHT: Number(r.god_weight),
            WIN_BONUS: Number(r.win_bonus),
            INACTIVITY_DECAY: Number(r.inactivity_decay),
            GAME_DECAY: Number(r.game_decay),
        }))
    } catch {
        return [{ effectiveFrom: 0, EXPECTATION_WEIGHT: PERF_DEFAULTS.EXPECTATION_WEIGHT,
            SUPPLY_WEIGHT: PERF_DEFAULTS.SUPPLY_WEIGHT, OPPONENT_WEIGHT: PERF_DEFAULTS.OPPONENT_WEIGHT,
            TEAMMATE_WEIGHT: PERF_DEFAULTS.TEAMMATE_WEIGHT, GOD_WEIGHT: PERF_DEFAULTS.GOD_WEIGHT,
            WIN_BONUS: PERF_DEFAULTS.WIN_BONUS,
            INACTIVITY_DECAY: PERF_DEFAULTS.INACTIVITY_DECAY, GAME_DECAY: PERF_DEFAULTS.GAME_DECAY }]
    }
}

function getCfgAtTime(configHistory, gameTimeMs, fallbackCfg) {
    // Find the first approval that happened AFTER this game — that approval locked in config for it.
    // If no approval exists after the game, use fallbackCfg (current live config).
    for (const entry of configHistory) {
        if (entry.effectiveFrom > gameTimeMs) return entry
    }
    return fallbackCfg
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
          AND lp.roster_status != 'sub'
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

    // Backfill any sparks missing init entries (e.g. from race conditions)
    await sql`
        INSERT INTO spark_price_history (spark_id, price, trigger, created_at)
        SELECT ps.id, fm.base_price, 'init', ps.created_at
        FROM player_sparks ps
        JOIN forge_markets fm ON ps.market_id = fm.id
        WHERE ps.market_id = ${marketId}
          AND NOT EXISTS (
              SELECT 1 FROM spark_price_history sph
              WHERE sph.spark_id = ps.id AND sph.trigger = 'init'
          )
    `
}

/**
 * Find and relink sparks attached to sub league_players to the same player's
 * non-sub LP in the same season. Merges holdings if the non-sub LP already
 * has a spark. Deletes empty sub sparks with no holdings.
 * When dryRun=true, returns a preview of what would happen without making changes.
 */
export async function cleanupSubSparks(sql, dryRun = false) {
    if (dryRun) {
        // Single query preview — no per-row loops
        const preview = await sql`
            SELECT ps.id as "sparkId", ps.league_player_id as "subLpId", ps.market_id,
                   ps.total_sparks, p.name as "playerName", t_sub.name as "subTeam",
                   main_lp.id as "targetLpId", main_lp.roster_status as "targetStatus",
                   t_main.name as "targetTeam",
                   COALESCE(holdings.cnt, 0)::integer as holdings,
                   CASE
                       WHEN main_lp.id IS NULL THEN 'orphaned'
                       WHEN COALESCE(holdings.cnt, 0) = 0 THEN 'delete'
                       ELSE 'move'
                   END as action
            FROM player_sparks ps
            JOIN league_players lp ON ps.league_player_id = lp.id
            JOIN players p ON lp.player_id = p.id
            LEFT JOIN teams t_sub ON lp.team_id = t_sub.id
            JOIN forge_markets fm ON ps.market_id = fm.id
            LEFT JOIN LATERAL (
                SELECT lp2.id, lp2.roster_status, lp2.team_id
                FROM league_players lp2
                WHERE lp2.player_id = lp.player_id
                  AND lp2.season_id = lp.season_id
                  AND lp2.roster_status != 'sub'
                  AND lp2.is_active = true
                ORDER BY CASE lp2.roster_status WHEN 'captain' THEN 0 WHEN 'co_captain' THEN 1 ELSE 2 END
                LIMIT 1
            ) main_lp ON true
            LEFT JOIN teams t_main ON main_lp.team_id = t_main.id
            LEFT JOIN LATERAL (
                SELECT COUNT(*)::integer as cnt FROM spark_holdings sh
                WHERE sh.spark_id = ps.id AND sh.sparks > 0
            ) holdings ON true
            WHERE lp.roster_status = 'sub'
            ORDER BY p.name
        `
        return { preview: preview.map(r => ({ ...r, totalSparks: Number(r.total_sparks) })) }
    }

    // Find all sparks on sub league_players
    const subSparks = await sql`
        SELECT ps.id as spark_id, ps.league_player_id as sub_lp_id, ps.market_id,
               ps.total_sparks, ps.perf_multiplier, ps.current_price,
               ps.sell_pressure, ps.sell_pressure_updated_at,
               lp.player_id, lp.season_id,
               fm.base_price
        FROM player_sparks ps
        JOIN league_players lp ON ps.league_player_id = lp.id
        JOIN forge_markets fm ON ps.market_id = fm.id
        WHERE lp.roster_status = 'sub'
    `
    if (subSparks.length === 0) return { moved: 0, deleted: 0, orphaned: 0 }

    let moved = 0, deleted = 0, orphaned = 0

    for (const sub of subSparks) {
        const [mainLp] = await sql`
            SELECT id FROM league_players
            WHERE player_id = ${sub.player_id}
              AND season_id = ${sub.season_id}
              AND roster_status != 'sub'
              AND is_active = true
            ORDER BY CASE roster_status WHEN 'captain' THEN 0 WHEN 'co_captain' THEN 1 ELSE 2 END
            LIMIT 1
        `

        if (!mainLp) { orphaned++; continue }

        const [holdingCount] = await sql`
            SELECT COUNT(*) as cnt FROM spark_holdings WHERE spark_id = ${sub.spark_id} AND sparks > 0
        `

        if (Number(holdingCount.cnt) === 0) {
            await sql`DELETE FROM spark_price_history WHERE spark_id = ${sub.spark_id}`
            await sql`DELETE FROM forge_pending_updates WHERE spark_id = ${sub.spark_id}`
            await sql`DELETE FROM player_sparks WHERE id = ${sub.spark_id}`
            deleted++
            continue
        }

        // Has holdings — move to main LP
        {
            let [mainSpark] = await sql`
                SELECT id, total_sparks, sell_pressure, sell_pressure_updated_at
                FROM player_sparks
                WHERE league_player_id = ${mainLp.id} AND market_id = ${sub.market_id}
            `
            if (!mainSpark) {
                [mainSpark] = await sql`
                    INSERT INTO player_sparks (market_id, league_player_id, current_price)
                    VALUES (${sub.market_id}, ${mainLp.id}, ${sub.base_price})
                    ON CONFLICT (market_id, league_player_id) DO NOTHING
                    RETURNING id, total_sparks, sell_pressure, sell_pressure_updated_at
                `
                if (!mainSpark) {
                    [mainSpark] = await sql`
                        SELECT id, total_sparks, sell_pressure, sell_pressure_updated_at
                        FROM player_sparks
                        WHERE league_player_id = ${mainLp.id} AND market_id = ${sub.market_id}
                    `
                }
                await sql`
                    INSERT INTO spark_price_history (spark_id, price, trigger)
                    VALUES (${mainSpark.id}, ${sub.base_price}, 'init')
                `
            }

            await sql`UPDATE spark_holdings SET spark_id = ${mainSpark.id} WHERE spark_id = ${sub.spark_id}`
            await sql`UPDATE spark_transactions SET spark_id = ${mainSpark.id} WHERE spark_id = ${sub.spark_id}`
            await sql`UPDATE spark_price_history SET spark_id = ${mainSpark.id} WHERE spark_id = ${sub.spark_id}`
            await sql`
                UPDATE player_sparks
                SET total_sparks = total_sparks + ${sub.total_sparks},
                    sell_pressure = sell_pressure + ${Number(sub.sell_pressure) || 0},
                    updated_at = NOW()
                WHERE id = ${mainSpark.id}
            `
            await sql`DELETE FROM forge_pending_updates WHERE spark_id = ${sub.spark_id}`
            await sql`DELETE FROM player_sparks WHERE id = ${sub.spark_id}`
        }
        moved++
    }

    return { moved, deleted, orphaned }
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
        SELECT sparks, total_invested, tutorial_sparks, referral_sparks FROM spark_holdings
        WHERE user_id = ${userId} AND spark_id = ${sparkId}
    `
    if (holding) {
        holding.tutorialSparks = holding.tutorial_sparks || 0
        holding.referralSparks = holding.referral_sparks || 0
        holding.coolableSparks = holding.sparks - holding.tutorialSparks - holding.referralSparks
    }

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

    // Grant Passion (net of tax) — only profit counts toward lifetime/leaderboard
    await grantPassion(tx, userId, 'forge_cool', netProceeds,
        `Cooled player (${numSparks} Spark${numSparks > 1 ? 's' : ''}, ${coolingTax} tax)`, String(sparkId),
        Math.max(0, profit))

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
    let updatedHolding = null
    if (remainingSparks > 0) {
        const tutorialSparks = holding.tutorial_sparks || 0
        const referralSparks = holding.referral_sparks || 0
        updatedHolding = {
            sparks: remainingSparks,
            totalInvested: Math.max(remainingInvested, 0),
            tutorialSparks,
            referralSparks,
            coolableSparks: remainingSparks - tutorialSparks - referralSparks,
        }
    }

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
 * Shared game replay logic used by both recalcForgePerformance and getPlayerBreakdown.
 * Groups post-forge games into sets (matches), applies inactivity decay, game decay,
 * heat with expectation weight, opponent/teammate/god/win factors, and compression.
 *
 * Returns { multiplier, trace, finalInactivityDecay, hasGames }
 */
function replayPlayerGames({ games, spark, cfg, configHistory, marketStartTime, roleAvgMap, godAvgMap, getTeamStrength, now, lpId, gameTeamPlayers, playerStrengthMap, gamePlayerNames, teamMatchDates }) {
    const halfLife = cfg.DECAY_HALF_LIFE
    let multiplier = 1.0
    let lastGameTime = null
    let hasGames = false
    const trace = []

    // Group post-forge games into sets (matches)
    const sets = []
    let currentSet = null
    const playerMatchIds = new Set()
    const skippedGames = []
    for (const game of games) {
        const gameTime = new Date(game.match_date).getTime()
        if (gameTime < marketStartTime) {
            skippedGames.push({ date: game.match_date, god: game.god_played, matchId: game.match_id, reason: 'before_market' })
            continue
        }
        const avgs = roleAvgMap[game.role]
        if (!avgs) {
            skippedGames.push({ date: game.match_date, god: game.god_played, matchId: game.match_id, reason: 'no_role_avg', role: game.role })
            continue
        }
        playerMatchIds.add(game.match_id)
        if (!currentSet || currentSet.matchId !== game.match_id) {
            currentSet = { matchId: game.match_id, gameData: [], gameTime }
            sets.push(currentSet)
        }
        currentSet.gameData.push({ game, avgs })
    }

    // Team matches this player missed (for inactivity decay), only after they joined the team
    const allTeamMatches = teamMatchDates ? (teamMatchDates.get(spark.team_id) || []) : []
    const joinedAt = spark.team_joined_at ? new Date(spark.team_joined_at).getTime() : 0
    const teamMatches = joinedAt > 0 ? allTeamMatches.filter(m => m.date >= joinedAt) : allTeamMatches

    for (const set of sets) {
        hasGames = true
        const gameTime = set.gameTime
        const multBeforeSet = multiplier

        // 1. Inactivity decay between sets (only for team matches the player missed)
        const setSnap = getCfgAtTime(configHistory, gameTime, cfg)
        let inactivityApplied = null
        if (lastGameTime !== null) {
            const missedMatches = teamMatches.filter(m => m.date > lastGameTime && m.date < gameTime && !playerMatchIds.has(m.matchId)).length
            if (missedMatches > 0) {
                const factor = Math.pow(setSnap.INACTIVITY_DECAY, missedMatches)
                multiplier = compressMultiplier(multiplier * factor, cfg)
                inactivityApplied = { weeks: missedMatches, factor, multAfter: multiplier }
            }
        }

        // 2. Per-set regression toward 1.0
        const decayed = 1 + (multiplier - 1) * setSnap.GAME_DECAY

        // 3. Calculate per-game factors and average them across the set
        const setEntries = []
        let factorSum = 0
        for (const { game, avgs } of set.gameData) {
            const gameTimeMs = new Date(game.match_date).getTime()
            const snap = getCfgAtTime(configHistory, gameTimeMs, cfg)

            const rawScore = calcCompositeScore(
                { kills: Number(game.kills), deaths: Number(game.deaths), assists: Number(game.assists),
                  kp: Number(game.kp), damage: Number(game.damage), mitigated: Number(game.mitigated) },
                avgs, game.role
            )
            const expected = 1 + snap.EXPECTATION_WEIGHT * spark.total_sparks
            const denom = 1 + snap.SUPPLY_WEIGHT * spark.total_sparks
            const heat = 1 + (rawScore - expected) / denom
            const heatWithoutExp = 1 + (rawScore - 1) / denom
            const expImpact = heatWithoutExp !== 0 ? (heat / heatWithoutExp - 1) : 0

            const oppSide = game.team_side === 1 ? 2 : 1
            const oppStrength = getTeamStrength(game.game_id, oppSide)
            const oppFactor = 1 + snap.OPPONENT_WEIGHT * (oppStrength - 1)
            const teamStrength = getTeamStrength(game.game_id, game.team_side, lpId)
            const teamFactor = 1 + snap.TEAMMATE_WEIGHT * (1.0 - teamStrength)
            const godName = (game.god_played || '').toLowerCase().trim()
            const godRoleAvg = godAvgMap[`${godName}:${game.role}`] || 1.0
            const godFactor = 1 + snap.GOD_WEIGHT * (rawScore / godRoleAvg - 1)
            const winFactor = game.won ? 1 + snap.WIN_BONUS : 1 - snap.WIN_BONUS

            const gameFactor = heat * oppFactor * teamFactor * godFactor * winFactor
            factorSum += gameFactor

            // Build trace entry if display maps are provided
            if (gameTeamPlayers && gamePlayerNames) {
                const w = ROLE_WEIGHTS[game.role] || DEFAULT_WEIGHTS
                const normKills = avgs.avgKills > 0 ? Number(game.kills) / avgs.avgKills : 1.0
                const playerDeaths = Math.max(Number(game.deaths), 0.5)
                const normDeaths = avgs.avgDeaths > 0 ? Math.min(avgs.avgDeaths / playerDeaths, 3.0) : 1.0
                const normAssists = avgs.avgAssists > 0 ? Number(game.assists) / avgs.avgAssists : 1.0
                const normKp = avgs.avgKp > 0 ? Number(game.kp) / avgs.avgKp : 1.0
                const normDamage = avgs.avgDamage > 0 ? Number(game.damage) / avgs.avgDamage : 1.0
                const normMitigated = avgs.avgMitigated > 0 ? Number(game.mitigated) / avgs.avgMitigated : 1.0

                const oppPlayers = (gameTeamPlayers.get(`${game.game_id}:${oppSide}`) || [])
                    .map(id => ({ name: gamePlayerNames.get(id) || '?', strength: playerStrengthMap.get(id) || 1.0 }))
                const teamPlayers = (gameTeamPlayers.get(`${game.game_id}:${game.team_side}`) || [])
                    .filter(id => id !== lpId)
                    .map(id => ({ name: gamePlayerNames.get(id) || '?', strength: playerStrengthMap.get(id) || 1.0 }))

                setEntries.push({
                    date: game.match_date, god: game.god_played, role: game.role, won: game.won,
                    stats: { kills: Number(game.kills), deaths: Number(game.deaths), assists: Number(game.assists),
                             kp: Number(game.kp), damage: Number(game.damage), mitigated: Number(game.mitigated) },
                    roleAvgs: avgs, multiplierBefore: multBeforeSet, rawScore, expected,
                    expectationWeight: snap.EXPECTATION_WEIGHT, expImpact,
                    statBreakdown: {
                        kills:     { norm: normKills, weight: w.kills || 0, contribution: (w.kills || 0) * normKills },
                        deaths:    { norm: normDeaths, weight: w.deaths || 0, contribution: (w.deaths || 0) * normDeaths },
                        assists:   { norm: normAssists, weight: w.assists || 0, contribution: (w.assists || 0) * normAssists },
                        kp:        { norm: normKp, weight: w.kp || 0, contribution: (w.kp || 0) * normKp },
                        damage:    { norm: normDamage, weight: w.damage || 0, contribution: (w.damage || 0) * normDamage },
                        mitigated: { norm: normMitigated, weight: w.mitigated || 0, contribution: (w.mitigated || 0) * normMitigated },
                    },
                    heat,
                    opponent: { avgStrength: oppStrength, factor: oppFactor, players: oppPlayers },
                    teammate: { avgStrength: teamStrength, factor: teamFactor, players: teamPlayers },
                    godMeta: { godAvg: godRoleAvg, factor: godFactor },
                    winFactor, gameFactor,
                })
            }
        }

        const avgFactor = factorSum / set.gameData.length
        const preCompression = decayed * avgFactor
        multiplier = compressMultiplier(preCompression, cfg)

        // Annotate trace entries with set info
        for (let i = 0; i < setEntries.length; i++) {
            const entry = setEntries[i]
            entry.setGameCount = setEntries.length
            entry.setPosition = i + 1
            entry.isLastInSet = (i === setEntries.length - 1)
            entry.inactivityDecay = (i === 0) ? inactivityApplied : null
            entry.gameDecay = { before: multBeforeSet, after: decayed }
            entry.setAvgFactor = avgFactor
            entry.preCompression = preCompression
            entry.multiplierAfter = multiplier
            trace.push(entry)
        }

        lastGameTime = gameTime
    }

    // Final inactivity decay (only for team matches missed since player's last game)
    let finalInactivityDecay = null
    if (lastGameTime !== null) {
        const missedSinceLast = teamMatches.filter(m => m.date > lastGameTime && !playerMatchIds.has(m.matchId)).length
        if (missedSinceLast > 0) {
            const before = multiplier
            multiplier = compressMultiplier(multiplier * Math.pow(cfg.INACTIVITY_DECAY, missedSinceLast), cfg)
            finalInactivityDecay = { weeks: missedSinceLast, before, after: multiplier }
        }
    }

    return { multiplier, trace, finalInactivityDecay, hasGames, skippedGames }
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
    if (!market) return { status: 'skipped', reason: 'no_market', detail: `No forge market for season ${seasonId}` }
    if (market.status !== 'open') return { status: 'skipped', reason: 'market_closed', detail: `Market status is '${market.status}'` }

    const cfg = await loadForgeConfig(sql)
    const configHistory = await loadForgeConfigHistory(sql)
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

    if (Object.keys(roleAvgMap).length === 0) return { status: 'skipped', reason: 'no_role_averages', detail: 'No valid role averages found (all players may be subs or have no role set)' }

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
            m.id as match_id,
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

    if (allGames.length === 0) return { status: 'skipped', reason: 'no_games', detail: 'No completed games found for this season (players may all be subs or have no role)' }

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
        SELECT ps.id, ps.league_player_id, ps.total_sparks, ps.sell_pressure, ps.sell_pressure_updated_at,
               lp.team_id, lp.is_active, lp.player_id,
               COALESCE(lp.joined_date, rt.transfer_date) as team_joined_at
        FROM player_sparks ps
        JOIN league_players lp ON ps.league_player_id = lp.id
        LEFT JOIN LATERAL (
            SELECT created_at as transfer_date
            FROM roster_transactions
            WHERE player_id = lp.player_id AND to_team_id = lp.team_id
            ORDER BY created_at DESC LIMIT 1
        ) rt ON true
        WHERE ps.market_id = ${market.id}
          AND lp.roster_status != 'sub'
    `

    // All completed non-forfeit matches this season, grouped by team → sorted match dates
    const teamMatchRows = await sql`
        SELECT m.id, m.team1_id, m.team2_id, m.date
        FROM matches m
        WHERE m.season_id = ${seasonId} AND m.is_completed = true
          AND NOT EXISTS (
              SELECT 1 FROM games g
              WHERE g.match_id = m.id AND g.is_forfeit = true
          )
        ORDER BY m.date ASC
    `
    const teamMatchDates = new Map()
    for (const m of teamMatchRows) {
        const entry = { matchId: m.id, date: new Date(m.date).getTime() }
        for (const tid of [m.team1_id, m.team2_id]) {
            if (!teamMatchDates.has(tid)) teamMatchDates.set(tid, [])
            teamMatchDates.get(tid).push(entry)
        }
    }
    const teamsWithGames = new Set(teamMatchDates.keys())

    // Player transfer history for counting missed matches on previous teams
    const transferRows = await sql`
        SELECT rt.player_id, rt.from_team_id, rt.to_team_id, rt.created_at
        FROM roster_transactions rt
        WHERE rt.season_id = ${seasonId} AND rt.type = 'transfer'
        ORDER BY rt.created_at ASC
    `
    // Build per-player transfer timeline: player_id → [{fromTeam, toTeam, date}]
    const playerTransfers = new Map()
    for (const rt of transferRows) {
        if (!playerTransfers.has(rt.player_id)) playerTransfers.set(rt.player_id, [])
        playerTransfers.get(rt.player_id).push({
            fromTeam: rt.from_team_id,
            toTeam: rt.to_team_id,
            date: new Date(rt.created_at).getTime(),
        })
    }

    const sparkMap = new Map(sparks.map(s => [s.league_player_id, s]))

    // ── Replay each player's games with compounding heat ──
    // Only games AFTER the forge market opened affect multipliers.
    // Pre-forge games still feed role averages, god expectations, and opponent quality above.

    const updates = []
    const processedSparkIds = new Set()
    const marketStartTime = toMidnightUTC(new Date(market.created_at).getTime())

    for (const [lpId, games] of playerGamesMap) {
        const spark = sparkMap.get(lpId)
        if (!spark) continue

        const result = replayPlayerGames({
            games, spark, cfg, configHistory, marketStartTime, roleAvgMap, godAvgMap, getTeamStrength, now, lpId, teamMatchDates,
        })

        // Only mark as processed if they have post-forge games.
        // Players with only pre-forge games fall through to the no-games loop for benched detection.
        if (!result.hasGames) continue

        processedSparkIds.add(spark.id)
        const multiplier = result.multiplier
        const dp = decaySellPressure(Number(spark.sell_pressure), spark.sell_pressure_updated_at)
        const newPrice = calcPrice(market.base_price, multiplier, spark.total_sparks, dp)
        updates.push({ sparkId: spark.id, multiplier, newPrice, decayedPressure: dp })
    }

    // Process players with sparks but no games in the season
    // Only decay free agents (is_active=false) or benched players (team played but player wasn't in any game)
    for (const spark of sparks) {
        if (processedSparkIds.has(spark.id)) continue
        const isFreeAgent = !spark.is_active
        let multiplier = 1.0
        if (isFreeAgent) {
            const daysSinceMarket = (now - marketStartTime) / MS_PER_DAY
            const weeksInactive = Math.floor(daysSinceMarket / 7)
            if (weeksInactive > 0) {
                multiplier = compressMultiplier(Math.pow(cfg.INACTIVITY_DECAY, weeksInactive), cfg)
            }
        } else if (spark.is_active) {
            // Count missed matches across all teams the player has been on
            let matchesMissed = 0
            const transfers = playerTransfers.get(spark.player_id) || []
            if (transfers.length > 0) {
                // Build team stints from transfer history
                // First stint: on fromTeam of first transfer, from market start to first transfer
                const firstTransfer = transfers[0]
                const prevTeamMatches = teamMatchDates.get(firstTransfer.fromTeam) || []
                matchesMissed += prevTeamMatches.filter(m => m.date >= marketStartTime && m.date < firstTransfer.date).length
                // Middle stints: between consecutive transfers
                for (let i = 0; i < transfers.length - 1; i++) {
                    const midMatches = teamMatchDates.get(transfers[i].toTeam) || []
                    matchesMissed += midMatches.filter(m => m.date >= transfers[i].date && m.date < transfers[i + 1].date).length
                }
                // Current team: from last transfer to now
                const lastTransfer = transfers[transfers.length - 1]
                const curMatches = teamMatchDates.get(spark.team_id) || []
                matchesMissed += curMatches.filter(m => m.date >= lastTransfer.date).length
            } else {
                // No transfers — simple case: count all team matches since market opened
                const teamMatches = teamMatchDates.get(spark.team_id) || []
                matchesMissed = teamMatches.filter(m => m.date >= marketStartTime).length
            }
            if (matchesMissed > 0) {
                multiplier = compressMultiplier(Math.pow(cfg.INACTIVITY_DECAY, matchesMissed), cfg)
            }
        }
        const dp = decaySellPressure(Number(spark.sell_pressure), spark.sell_pressure_updated_at)
        const newPrice = calcPrice(market.base_price, multiplier, spark.total_sparks, dp)
        updates.push({ sparkId: spark.id, multiplier, newPrice, decayedPressure: dp })
    }

    if (updates.length === 0) return { status: 'skipped', reason: 'no_updates', detail: `No spark records found for this market` }

    // ── Approval gate: queue or apply immediately ──

    if (cfg.PERFORMANCE_APPROVAL) {
        // Delete any existing pending rows for this market (full replay = replace)
        await sql`DELETE FROM forge_pending_updates WHERE market_id = ${market.id}`

        // Fetch current multiplier/price and player names for display
        const currentSparks = await sql`
            SELECT ps.id, ps.perf_multiplier, ps.current_price,
                   COALESCE(p.name, 'Unknown') as player_name
            FROM player_sparks ps
            JOIN league_players lp ON ps.league_player_id = lp.id
            JOIN players p ON lp.player_id = p.id
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

        const recalcAt = new Date(now).toISOString()
        await sql`
            INSERT INTO forge_pending_updates (market_id, spark_id, player_name, old_multiplier, new_multiplier, old_price, new_price, recalc_at)
            SELECT
                UNNEST(${pMarketIds}::int[]),
                UNNEST(${pSparkIds}::int[]),
                UNNEST(${pNames}::text[]),
                UNNEST(${pOldMults}::numeric[]),
                UNNEST(${pNewMults}::numeric[]),
                UNNEST(${pOldPrices}::numeric[]),
                UNNEST(${pNewPrices}::numeric[]),
                ${recalcAt}::timestamptz
        `
        return { status: 'queued', updates: updates.length, approval: true } // Skip applying — wait for admin approval
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

    return { status: 'applied', updates: updates.length, approval: false }
}


// ═══════════════════════════════════════════════════
// Per-player breakdown (admin detail view)
// ═══════════════════════════════════════════════════

/**
 * Replay scoring for a single player and return per-game breakdown with all intermediate factors.
 * Read-only — does not write to the database.
 */
export async function getPlayerBreakdown(sql, sparkId, recalcAt) {
    const [spark] = await sql`
        SELECT ps.id, ps.league_player_id, ps.total_sparks, ps.market_id,
               ps.sell_pressure, ps.sell_pressure_updated_at, ps.perf_multiplier,
               ps.current_price, fm.base_price, fm.created_at as market_created_at,
               fm.season_id, COALESCE(p.name, 'Unknown') as player_name,
               LOWER(COALESCE(lp.role, 'fill')) as player_role,
               lp.team_id,
               COALESCE(lp.joined_date, rt.transfer_date) as team_joined_at
        FROM player_sparks ps
        JOIN forge_markets fm ON ps.market_id = fm.id
        JOIN league_players lp ON ps.league_player_id = lp.id
        LEFT JOIN LATERAL (
            SELECT created_at as transfer_date
            FROM roster_transactions
            WHERE player_id = lp.player_id AND to_team_id = lp.team_id
            ORDER BY created_at DESC LIMIT 1
        ) rt ON true
        JOIN players p ON lp.player_id = p.id
        WHERE ps.id = ${sparkId}
    `
    if (!spark) return null

    const cfg = await loadForgeConfig(sql)
    const configHistory = await loadForgeConfigHistory(sql)
    const halfLife = cfg.DECAY_HALF_LIFE
    const seasonId = spark.season_id
    const lpId = spark.league_player_id

    // Role averages (same query as recalc)
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
            avgKills: Number(r.avg_kills) || 1.0,
            avgDeaths: Number(r.avg_deaths) || 1.0,
            avgAssists: Number(r.avg_assists) || 1.0,
            avgKp: Number(r.avg_kp) || 0.5,
            avgDamage: Number(r.avg_damage) || 1.0,
            avgMitigated: Number(r.avg_mitigated) || 1.0,
        }
    }

    // All games for season (needed for opponent/teammate/god context)
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
            m.id as match_id,
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
            END as won,
            COALESCE(p.name, 'Unknown') as player_name
        FROM player_game_stats pgs
        JOIN league_players lp ON pgs.league_player_id = lp.id
        JOIN players p ON lp.player_id = p.id
        JOIN games g ON pgs.game_id = g.id AND g.is_completed = true
        JOIN matches m ON g.match_id = m.id
        JOIN team_kills tk ON tk.game_id = pgs.game_id AND tk.team_side = pgs.team_side
        WHERE lp.season_id = ${seasonId}
          AND lp.roster_status != 'sub'
          AND COALESCE(pgs.role_played, lp.role) IS NOT NULL
          AND LOWER(COALESCE(pgs.role_played, lp.role)) != 'fill'
        ORDER BY m.date ASC, g.id ASC
    `

    // Pre-compute maps (same as recalc)
    const playerGamesMap = new Map()
    for (const game of allGames) {
        if (!playerGamesMap.has(game.league_player_id)) playerGamesMap.set(game.league_player_id, [])
        playerGamesMap.get(game.league_player_id).push(game)
    }

    const now = recalcAt ? new Date(recalcAt).getTime() : Date.now()

    const playerStrengthMap = new Map()
    for (const [pid, games] of playerGamesMap) {
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
        playerStrengthMap.set(pid, totalWeight > 0 ? weightedScore / totalWeight : 1.0)
    }

    const godScores = {}
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

    const gameTeamPlayers = new Map()
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
        for (const id of teammates) sum += (playerStrengthMap.get(id) || 1.0)
        return sum / teammates.length
    }

    // Build opponent name lookup for display
    const gamePlayerNames = new Map()
    for (const game of allGames) {
        gamePlayerNames.set(game.league_player_id, game.player_name)
    }

    // Team match dates for inactivity decay (only decay for missed non-forfeit team matches)
    const teamMatchRows = await sql`
        SELECT m.id, m.team1_id, m.team2_id, m.date
        FROM matches m
        WHERE m.season_id = ${seasonId} AND m.is_completed = true
          AND NOT EXISTS (
              SELECT 1 FROM games g
              WHERE g.match_id = m.id AND g.is_forfeit = true
          )
        ORDER BY m.date ASC
    `
    const teamMatchDates = new Map()
    for (const m of teamMatchRows) {
        const entry = { matchId: m.id, date: new Date(m.date).getTime() }
        for (const tid of [m.team1_id, m.team2_id]) {
            if (!teamMatchDates.has(tid)) teamMatchDates.set(tid, [])
            teamMatchDates.get(tid).push(entry)
        }
    }

    // Replay this player's games with full trace
    const playerGames = playerGamesMap.get(lpId) || []
    const marketStartTime = toMidnightUTC(new Date(spark.market_created_at).getTime())

    // Count total raw games in SQL results for this player (before JS-level filters)
    const totalRawGames = playerGames.length

    // Diagnostic: if no SQL games, check why
    let diagnostic = null
    if (totalRawGames === 0) {
        const [diag] = await sql`
            SELECT
                lp.id as lp_id,
                lp.roster_status,
                lp.role as lp_role,
                lp.season_id as lp_season_id,
                ${seasonId}::int as market_season_id,
                (SELECT COUNT(*) FROM player_game_stats pgs WHERE pgs.league_player_id = lp.id) as total_pgs_rows,
                (SELECT COUNT(*) FROM player_game_stats pgs
                    JOIN games g ON pgs.game_id = g.id
                    WHERE pgs.league_player_id = lp.id AND g.is_completed = true) as completed_game_rows,
                (SELECT COUNT(*) FROM player_game_stats pgs
                    JOIN games g ON pgs.game_id = g.id
                    WHERE pgs.league_player_id = lp.id AND g.is_completed = false) as incomplete_game_rows,
                (SELECT string_agg(DISTINCT LOWER(COALESCE(pgs.role_played, lp2.role)), ', ')
                    FROM player_game_stats pgs
                    JOIN league_players lp2 ON pgs.league_player_id = lp2.id
                    WHERE pgs.league_player_id = lp.id) as roles_in_games,
                (SELECT COUNT(*) FROM player_game_stats pgs
                    JOIN games g ON pgs.game_id = g.id AND g.is_completed = true
                    JOIN matches m ON g.match_id = m.id
                    WHERE pgs.league_player_id = lp.id
                      AND m.season_id = ${seasonId}) as games_in_correct_season
            FROM league_players lp
            WHERE lp.id = ${lpId}
        `
        if (diag) {
            diagnostic = {
                leaguePlayerId: diag.lp_id,
                rosterStatus: diag.roster_status,
                lpRole: diag.lp_role,
                lpSeasonId: diag.lp_season_id,
                marketSeasonId: diag.market_season_id,
                totalPgsRows: Number(diag.total_pgs_rows),
                completedGameRows: Number(diag.completed_game_rows),
                incompleteGameRows: Number(diag.incomplete_game_rows),
                rolesInGames: diag.roles_in_games,
                gamesInCorrectSeason: Number(diag.games_in_correct_season),
            }
        }
    }

    const result = replayPlayerGames({
        games: playerGames, spark, cfg, configHistory, marketStartTime, roleAvgMap, godAvgMap, getTeamStrength, now, lpId,
        gameTeamPlayers, playerStrengthMap, gamePlayerNames, teamMatchDates,
    })

    return {
        player: { name: spark.player_name, role: spark.player_role, totalSparks: spark.total_sparks },
        roleAvgs: roleAvgMap,
        config: {
            GAME_DECAY: cfg.GAME_DECAY, SUPPLY_WEIGHT: cfg.SUPPLY_WEIGHT,
            EXPECTATION_WEIGHT: cfg.EXPECTATION_WEIGHT,
            INACTIVITY_DECAY: cfg.INACTIVITY_DECAY, OPPONENT_WEIGHT: cfg.OPPONENT_WEIGHT,
            TEAMMATE_WEIGHT: cfg.TEAMMATE_WEIGHT, GOD_WEIGHT: cfg.GOD_WEIGHT,
            WIN_BONUS: cfg.WIN_BONUS, PERF_CEILING: cfg.PERF_CEILING,
            COMPRESS_K: cfg.COMPRESS_K, PERF_FLOOR: cfg.PERF_FLOOR,
        },
        games: result.trace,
        skippedGames: result.skippedGames,
        totalRawGames,
        diagnostic,
        marketOpenDate: new Date(marketStartTime).toISOString().split('T')[0],
        finalInactivityDecay: result.finalInactivityDecay,
        finalMultiplier: result.multiplier,
    }
}


// ═══════════════════════════════════════════════════
// Player merge — relink & auto-sell holdings
// ═══════════════════════════════════════════════════

/**
 * Handle forge holdings when a source league_player is being deleted during merge.
 * Non-illegal holdings get relinked to the target spark.
 * Illegal holdings (own-team) get auto-sold with cooling tax + sell pressure.
 * Illegal free sparks get refunded at current price (no tax) and deleted.
 *
 * @param {function} tx - transaction tagged template
 * @param {number} sourceLpId - league_player being deleted
 * @param {number} targetLpId - league_player being kept
 * @returns {{ relinked, sold, refunded } | null}
 */
export async function mergeForgeHoldings(tx, sourceLpId, targetLpId) {
    const [sourceSpark] = await tx`
        SELECT ps.id, ps.current_price, ps.total_sparks, ps.perf_multiplier,
               ps.market_id, ps.sell_pressure, ps.sell_pressure_updated_at,
               fm.base_price, fm.status
        FROM player_sparks ps
        JOIN forge_markets fm ON ps.market_id = fm.id
        WHERE ps.league_player_id = ${sourceLpId}
    `
    if (!sourceSpark || sourceSpark.status !== 'open') return null

    // Find or create target spark in the same market (skip if target is a sub)
    const [targetLpCheck] = await tx`SELECT roster_status FROM league_players WHERE id = ${targetLpId}`
    if (targetLpCheck?.roster_status === 'sub') return null

    let [targetSpark] = await tx`
        SELECT id, total_sparks, sell_pressure, sell_pressure_updated_at, perf_multiplier
        FROM player_sparks
        WHERE league_player_id = ${targetLpId} AND market_id = ${sourceSpark.market_id}
        FOR UPDATE
    `
    if (!targetSpark) {
        [targetSpark] = await tx`
            INSERT INTO player_sparks (market_id, league_player_id, current_price)
            VALUES (${sourceSpark.market_id}, ${targetLpId}, ${sourceSpark.base_price})
            ON CONFLICT (market_id, league_player_id) DO NOTHING
            RETURNING id, total_sparks, sell_pressure, sell_pressure_updated_at, perf_multiplier
        `
        if (!targetSpark) {
            [targetSpark] = await tx`
                SELECT id, total_sparks, sell_pressure, sell_pressure_updated_at, perf_multiplier
                FROM player_sparks
                WHERE league_player_id = ${targetLpId} AND market_id = ${sourceSpark.market_id}
                FOR UPDATE
            `
        }
        await tx`
            INSERT INTO spark_price_history (spark_id, price, trigger)
            VALUES (${targetSpark.id}, ${sourceSpark.base_price}, 'init')
        `
    }

    const [targetLp] = await tx`SELECT team_id FROM league_players WHERE id = ${targetLpId}`

    const holdings = await tx`
        SELECT sh.id, sh.user_id, sh.spark_id, sh.sparks, sh.total_invested,
               sh.tutorial_sparks, sh.referral_sparks
        FROM spark_holdings sh
        WHERE sh.spark_id = ${sourceSpark.id} AND sh.sparks > 0
    `
    if (holdings.length === 0) return { relinked: 0, sold: 0, refunded: 0 }

    let relinked = 0, sold = 0, refunded = 0
    let totalSellPressure = 0
    let totalRelinkedSparks = 0

    const sourceDecayedPressure = decaySellPressure(Number(sourceSpark.sell_pressure), sourceSpark.sell_pressure_updated_at)
    let runningSourceSparks = sourceSpark.total_sparks
    let runningSellPressure = sourceDecayedPressure

    for (const h of holdings) {
        // Check if holder is on the target player's team
        let isIllegal = false
        if (targetLp?.team_id) {
            const [check] = await tx`
                SELECT 1 FROM league_players lp
                JOIN users u ON u.linked_player_id = lp.player_id
                WHERE u.id = ${h.user_id}
                  AND lp.team_id = ${targetLp.team_id}
                  AND lp.is_active = true
                LIMIT 1
            `
            isIllegal = !!check
        }

        const freeSparks = (h.tutorial_sparks || 0) + (h.referral_sparks || 0)
        const regularSparks = h.sparks - freeSparks

        if (!isIllegal) {
            // Relink to target spark
            const [existing] = await tx`
                SELECT id, sparks, total_invested, tutorial_sparks, referral_sparks
                FROM spark_holdings
                WHERE user_id = ${h.user_id} AND spark_id = ${targetSpark.id}
            `

            if (existing) {
                await tx`
                    UPDATE spark_holdings SET
                        sparks = sparks + ${h.sparks},
                        total_invested = total_invested + ${Number(h.total_invested)},
                        tutorial_sparks = COALESCE(tutorial_sparks, 0) + ${h.tutorial_sparks || 0},
                        referral_sparks = COALESCE(referral_sparks, 0) + ${h.referral_sparks || 0},
                        updated_at = NOW()
                    WHERE id = ${existing.id}
                `
                await tx`DELETE FROM spark_holdings WHERE id = ${h.id}`
            } else {
                await tx`
                    UPDATE spark_holdings SET spark_id = ${targetSpark.id}, updated_at = NOW()
                    WHERE id = ${h.id}
                `
            }

            totalRelinkedSparks += h.sparks
            relinked++
        } else {
            // Illegal — auto-sell regular sparks with cooling tax + sell pressure
            if (regularSparks > 0) {
                runningSellPressure += regularSparks
                let grossProceeds = 0
                for (let i = 0; i < regularSparks; i++) {
                    runningSourceSparks--
                    const price = calcPrice(sourceSpark.base_price, Number(sourceSpark.perf_multiplier), runningSourceSparks, runningSellPressure)
                    grossProceeds += Math.round(price)
                }

                const coolingTax = Math.round(grossProceeds * FORGE_CONFIG.COOLING_TAX)
                const netProceeds = grossProceeds - coolingTax
                const costBasis = Number(h.total_invested) * (regularSparks / h.sparks)
                const profit = netProceeds - Math.round(costBasis)

                if (netProceeds > 0) {
                    await grantPassion(tx, h.user_id, 'forge_cool', netProceeds,
                        `Auto-sold ${regularSparks} Spark${regularSparks > 1 ? 's' : ''} (player merge, ${coolingTax} tax)`,
                        String(targetSpark.id), Math.max(0, profit))
                }

                // Record on target spark for persistence (source will be cascade-deleted)
                const avgPrice = regularSparks > 0 ? (grossProceeds / regularSparks).toFixed(2) : 0
                await tx`
                    INSERT INTO spark_transactions (user_id, spark_id, type, sparks, price_per_spark, total_cost)
                    VALUES (${h.user_id}, ${targetSpark.id}, 'cool', ${regularSparks}, ${avgPrice}, ${netProceeds})
                `

                totalSellPressure += regularSparks
                sold += regularSparks
            }

            if (freeSparks > 0) {
                const refundValue = Math.round(Number(sourceSpark.current_price) * freeSparks)
                if (refundValue > 0) {
                    await grantPassion(tx, h.user_id, 'forge_merge_refund', refundValue,
                        `Refunded ${freeSparks} free Spark${freeSparks > 1 ? 's' : ''} (player merge)`,
                        String(targetSpark.id), 0)
                }
                refunded += freeSparks
            }

            await tx`DELETE FROM spark_holdings WHERE id = ${h.id}`
        }
    }

    // Update target spark with relinked supply + sell pressure from auto-sells
    if (totalRelinkedSparks > 0 || totalSellPressure > 0) {
        const newTotalSparks = targetSpark.total_sparks + totalRelinkedSparks
        const targetDecayed = decaySellPressure(Number(targetSpark.sell_pressure || 0), targetSpark.sell_pressure_updated_at)
        const newPressure = targetDecayed + totalSellPressure
        const newPrice = calcPrice(sourceSpark.base_price, Number(targetSpark.perf_multiplier), newTotalSparks, newPressure)

        await tx`
            UPDATE player_sparks SET
                total_sparks = ${newTotalSparks},
                current_price = ${newPrice},
                sell_pressure = ${newPressure},
                sell_pressure_updated_at = NOW(),
                updated_at = NOW()
            WHERE id = ${targetSpark.id}
        `

        await tx`
            INSERT INTO spark_price_history (spark_id, price, trigger)
            VALUES (${targetSpark.id}, ${newPrice}, 'cool')
        `
    }

    return { relinked, sold, refunded }
}

/**
 * Auto-sell any holdings a user has in players on their own team.
 * Called after linked_player_id changes (e.g., player merge).
 * Regular sparks use normal cool mechanics (tax + sell pressure).
 * Free sparks get refunded at current price and removed.
 *
 * @param {function} tx - transaction tagged template
 * @param {number} userId
 * @returns {{ sold, refunded } | null}
 */
export async function sellOwnTeamHoldings(tx, userId) {
    const [user] = await tx`SELECT linked_player_id FROM users WHERE id = ${userId}`
    if (!user?.linked_player_id) return null

    // Use subquery instead of ANY(array) to avoid array parameter serialization issues with tx
    const illegal = await tx`
        SELECT sh.id, sh.user_id, sh.spark_id, sh.sparks, sh.total_invested,
               sh.tutorial_sparks, sh.referral_sparks, ps.current_price
        FROM spark_holdings sh
        JOIN player_sparks ps ON sh.spark_id = ps.id
        JOIN forge_markets fm ON ps.market_id = fm.id
        JOIN league_players lp ON ps.league_player_id = lp.id
        WHERE sh.user_id = ${userId}
          AND sh.sparks > 0
          AND fm.status = 'open'
          AND lp.team_id IN (
              SELECT DISTINCT lp2.team_id FROM league_players lp2
              WHERE lp2.player_id = ${user.linked_player_id} AND lp2.is_active = true
          )
    `
    if (illegal.length === 0) return null

    let sold = 0, refunded = 0

    for (const h of illegal) {
        const freeSparks = (h.tutorial_sparks || 0) + (h.referral_sparks || 0)
        const regularSparks = h.sparks - freeSparks

        if (regularSparks > 0) {
            await executeCool(tx, userId, h.spark_id, regularSparks)
            sold += regularSparks
        }

        if (freeSparks > 0) {
            const tutorialCount = h.tutorial_sparks || 0
            const referralCount = h.referral_sparks || 0

            // Return tutorial sparks by deleting their transaction records
            // (freeSparksRemaining is calculated as 3 - count of tutorial_fuel txns)
            if (tutorialCount > 0) {
                await tx`
                    DELETE FROM spark_transactions
                    WHERE id IN (
                        SELECT id FROM spark_transactions
                        WHERE user_id = ${userId} AND spark_id = ${h.spark_id}
                          AND type = 'tutorial_fuel'
                        ORDER BY created_at DESC
                        LIMIT ${tutorialCount}
                    )
                `
            }

            // Return referral sparks to the user's available pool
            if (referralCount > 0) {
                await tx`
                    UPDATE users SET forge_referral_sparks = forge_referral_sparks + ${referralCount}
                    WHERE id = ${userId}
                `
                await tx`
                    DELETE FROM spark_transactions
                    WHERE id IN (
                        SELECT id FROM spark_transactions
                        WHERE user_id = ${userId} AND spark_id = ${h.spark_id}
                          AND type = 'referral_fuel'
                        ORDER BY created_at DESC
                        LIMIT ${referralCount}
                    )
                `
            }

            // Reduce total_sparks on the player_sparks row
            await tx`
                UPDATE player_sparks SET
                    total_sparks = total_sparks - ${freeSparks},
                    updated_at = NOW()
                WHERE id = ${h.spark_id}
            `

            // Remove free sparks from holding (or delete it entirely)
            const [remaining] = await tx`
                SELECT id, sparks FROM spark_holdings
                WHERE user_id = ${userId} AND spark_id = ${h.spark_id}
            `
            if (remaining) {
                if (remaining.sparks <= freeSparks) {
                    await tx`DELETE FROM spark_holdings WHERE id = ${remaining.id}`
                } else {
                    const freeCostBasis = h.sparks > 0 ? Number(h.total_invested) * (freeSparks / h.sparks) : 0
                    await tx`
                        UPDATE spark_holdings SET
                            sparks = sparks - ${freeSparks},
                            tutorial_sparks = 0,
                            referral_sparks = 0,
                            total_invested = GREATEST(0, total_invested - ${freeCostBasis}),
                            updated_at = NOW()
                        WHERE id = ${remaining.id}
                    `
                }
            }

            refunded += freeSparks
        }
    }

    return { sold, refunded }
}

/**
 * After a player changes teams (transfer or pickup), auto-sell any
 * Forge holdings that are now illegal under the own-team rule.
 * Checks both the transferred player's user AND users on the destination team.
 * Must be called within a transaction, AFTER the team change is applied.
 *
 * @param {function} tx - transaction tagged template
 * @param {number} playerId - players.id of the moved player
 * @param {number} newTeamId - the destination team ID
 * @returns {{ sold, refunded } | null}
 */
export async function cleanupForgeAfterTeamChange(tx, playerId, newTeamId) {
    // 1. The transferred player's linked user (now on a new team, may hold stock of new teammates)
    const [transferredUser] = await tx`
        SELECT id FROM users WHERE linked_player_id = ${playerId}
    `

    // 2. All users on the destination team (may hold stock of the transferred player)
    const teamUsers = await tx`
        SELECT DISTINCT u.id FROM users u
        JOIN league_players lp ON lp.player_id = u.linked_player_id
        WHERE lp.team_id = ${newTeamId} AND lp.is_active = true
          AND u.linked_player_id IS NOT NULL
    `

    const userIds = new Set(teamUsers.map(u => u.id))
    if (transferredUser) userIds.add(transferredUser.id)
    if (userIds.size === 0) return null

    let totalSold = 0, totalRefunded = 0
    for (const userId of userIds) {
        const result = await sellOwnTeamHoldings(tx, userId)
        if (result) {
            totalSold += result.sold
            totalRefunded += result.refunded
        }
    }

    return totalSold > 0 || totalRefunded > 0 ? { sold: totalSold, refunded: totalRefunded } : null
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

        // Grant Passion (no tax on liquidation) — only profit counts toward lifetime/leaderboard
        if (proceeds > 0) {
            const freeLabel = [
                tutorialSparks && `${tutorialSparks} tutorial`,
                referralSparks && `${referralSparks} referral`,
            ].filter(Boolean).join(', ')
            await grantPassion(sql, h.user_id, 'forge_liquidate', proceeds,
                `Season ended — auto-liquidated ${h.sparks} Spark${h.sparks > 1 ? 's' : ''}${freeLabel ? ` (${freeLabel})` : ''}`, String(h.spark_id),
                Math.max(0, totalProfit))
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
            const [{ realized }] = await sql`
                WITH txns AS (
                    SELECT
                        COALESCE(SUM(CASE WHEN type IN ('cool', 'liquidate') THEN total_cost ELSE 0 END), 0) as proceeds,
                        COALESCE(SUM(CASE WHEN type IN ('fuel', 'tutorial_fuel', 'referral_fuel') THEN total_cost ELSE 0 END), 0) as costs
                    FROM spark_transactions WHERE user_id = ${h.user_id}
                ), holds AS (
                    SELECT COALESCE(SUM(total_invested), 0) as remaining
                    FROM spark_holdings WHERE user_id = ${h.user_id} AND sparks > 0
                )
                SELECT (txns.proceeds - txns.costs + holds.remaining)::integer as realized
                FROM txns, holds
            `
            await pushChallengeProgress(sql, h.user_id, { sparks_cooled: h.sparks, forge_profit: realized })
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

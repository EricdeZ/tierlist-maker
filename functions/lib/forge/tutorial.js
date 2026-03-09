// Fantasy Forge — Tutorial status check and free Starter Spark granting.

import { headers } from '../db.js'
import { transaction } from '../db.js'
import { pushChallengeProgress } from '../challenges.js'
import {
    calcPrice,
    decaySellPressure,
    loadForgeConfig,
} from './helpers.js'
import { grantPassion } from '../passion.js'


// ═══════════════════════════════════════════════════
// GET: Tutorial status — check if user has completed the forge tutorial
// Scoped per league: 3 free Starter Sparks shared across all divisions in the league
// ═══════════════════════════════════════════════════
export async function getTutorialStatus(sql, user, params) {
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
export async function tutorialFuel(sql, user, body, event) {
    const { sparkId } = body
    if (!sparkId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'sparkId is required' }) }
    }

    // Check fueling lock
    const cfg = await loadForgeConfig(sql)
    if (cfg.FUELING_LOCKED) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Fueling is currently locked' }) }
    }

    const MAX_FREE_SPARKS = 3

    try {
        const result = await transaction(async (tx) => {
            // Lock player_sparks row
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
            const dp = decaySellPressure(Number(stock.sell_pressure), stock.sell_pressure_updated_at)
            const price = calcPrice(market.base_price, Number(stock.perf_multiplier), stock.total_sparks, dp)
            const theoreticalCost = Math.round(price)

            // Update player_sparks (bonding curve updates normally, persist decayed sell pressure)
            const newTotalSparks = stock.total_sparks + 1
            const newPrice = calcPrice(market.base_price, Number(stock.perf_multiplier), newTotalSparks, dp)
            await tx`
                UPDATE player_sparks SET
                    total_sparks = ${newTotalSparks},
                    current_price = ${newPrice},
                    sell_pressure = ${dp},
                    sell_pressure_updated_at = ${dp > 0 ? new Date() : null},
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
                const stats = { sparks_fueled: fuelCount, starter_sparks_used: 3 - result.freeSparksRemaining }
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

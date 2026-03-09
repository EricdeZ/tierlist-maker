// Fantasy Forge — Referral claim and referral Spark fuel handlers.

import { headers } from '../db.js'
import { transaction } from '../db.js'
import { pushChallengeProgress } from '../challenges.js'
import {
    calcPrice,
    decaySellPressure,
    loadForgeConfig,
} from './helpers.js'
import { processForgeReferral } from '../referrals.js'


// ═══════════════════════════════════════════════════
// Claim a forge referral (links referrer, grants both users 1 free Spark)
// ═══════════════════════════════════════════════════
export async function claimForgeReferral(sql, user, body) {
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
export async function referralFuel(sql, user, body, event) {
    const { sparkId } = body
    if (!sparkId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'sparkId is required' }) }
    }

    // Check fueling lock
    const cfg = await loadForgeConfig(sql)
    if (cfg.FUELING_LOCKED) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Fueling is currently locked' }) }
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

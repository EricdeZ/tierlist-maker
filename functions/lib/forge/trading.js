// Fantasy Forge — POST handlers for fuel (buy) and cool (sell) trades.

import { headers } from '../db.js'
import { transaction } from '../db.js'
import { pushChallengeProgress } from '../challenges.js'
import {
    executeFuel,
    executeCool,
    loadForgeConfig,
} from './helpers.js'


// ═══════════════════════════════════════════════════
// POST: Fuel (buy) Sparks
// ═══════════════════════════════════════════════════
export async function fuel(sql, user, body, event) {
    const { sparkId, sparks: rawSparks } = body
    const numSparks = parseInt(rawSparks)

    if (!sparkId || !numSparks || numSparks < 1) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'sparkId and sparks (>= 1) are required' }) }
    }
    if (numSparks > 10) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Maximum 10 Sparks per transaction' }) }
    }

    // Check fueling lock
    const cfg = await loadForgeConfig(sql)
    if (cfg.FUELING_LOCKED) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Fueling is currently locked' }) }
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
export async function cool(sql, user, body, event) {
    const { sparkId, sparks: rawSparks } = body
    const numSparks = parseInt(rawSparks)

    if (!sparkId || !numSparks || numSparks < 1) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'sparkId and sparks (>= 1) are required' }) }
    }

    // Check cooling lock
    const cfg = await loadForgeConfig(sql)
    if (cfg.COOLING_LOCKED) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Cooling is currently locked' }) }
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
                const [{ realized }] = await sql`
                    WITH txns AS (
                        SELECT
                            COALESCE(SUM(CASE WHEN type IN ('cool', 'liquidate') THEN total_cost ELSE 0 END), 0) as proceeds,
                            COALESCE(SUM(CASE WHEN type IN ('fuel', 'tutorial_fuel', 'referral_fuel') THEN total_cost ELSE 0 END), 0) as costs
                        FROM spark_transactions WHERE user_id = ${user.id}
                    ), holds AS (
                        SELECT COALESCE(SUM(total_invested), 0) as remaining
                        FROM spark_holdings WHERE user_id = ${user.id} AND sparks > 0
                    )
                    SELECT (txns.proceeds - txns.costs + holds.remaining)::integer as realized
                    FROM txns, holds
                `
                stats.forge_profit = realized
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

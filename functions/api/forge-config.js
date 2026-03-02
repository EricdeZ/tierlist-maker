import { adapt } from '../lib/adapter.js'
import { getDB, adminHeaders } from '../lib/db.js'
import { requirePermission } from '../lib/auth.js'
import { grantPassion } from '../lib/passion.js'
import { pushChallengeProgress } from '../lib/challenges.js'
import { recalcForgePerformance, getPlayerBreakdown } from '../lib/forge.js'

const NUMERIC_KEYS = [
    'game_decay', 'supply_weight', 'expectation_weight', 'inactivity_decay',
    'perf_floor', 'perf_ceiling', 'compress_k',
    'opponent_weight', 'teammate_weight', 'god_weight',
    'win_bonus', 'decay_half_life',
    'sell_pressure_half_life', 'sell_pressure_factor',
]

const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: adminHeaders, body: '' }
    }

    const sql = getDB()
    const params = event.queryStringParameters || {}
    const action = params.action

    try {
        // Pending/approve/reject actions: league_manage (global admin)
        // Config read/write: permission_manage (owner)
        if (action === 'pending' || action === 'approve' || action === 'reject' || action === 'recalc' || action === 'player-detail') {
            const admin = await requirePermission(event, 'league_manage')
            if (!admin) {
                return { statusCode: 401, headers: adminHeaders, body: JSON.stringify({ error: 'Unauthorized' }) }
            }
        } else {
            const owner = await requirePermission(event, 'permission_manage')
            if (!owner) {
                return { statusCode: 401, headers: adminHeaders, body: JSON.stringify({ error: 'Unauthorized' }) }
            }
        }

        // ── GET actions ──
        if (event.httpMethod === 'GET') {
            if (action === 'pending') {
                const pending = await sql`
                    SELECT * FROM forge_pending_updates ORDER BY player_name ASC
                `
                return { statusCode: 200, headers: adminHeaders, body: JSON.stringify(pending) }
            }

            if (action === 'player-detail') {
                const sparkId = Number(params.spark_id)
                if (!sparkId) return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'spark_id required' }) }
                const breakdown = await getPlayerBreakdown(sql, sparkId)
                if (!breakdown) return { statusCode: 404, headers: adminHeaders, body: JSON.stringify({ error: 'Player not found' }) }
                return { statusCode: 200, headers: adminHeaders, body: JSON.stringify(breakdown) }
            }

            const [config] = await sql`SELECT * FROM forge_config LIMIT 1`
            if (!config) {
                await sql`INSERT INTO forge_config DEFAULT VALUES ON CONFLICT DO NOTHING`
                const [fresh] = await sql`SELECT * FROM forge_config LIMIT 1`
                return { statusCode: 200, headers: adminHeaders, body: JSON.stringify(fresh) }
            }
            return { statusCode: 200, headers: adminHeaders, body: JSON.stringify(config) }
        }

        // ── POST actions ──
        if (event.httpMethod === 'POST') {
            if (action === 'approve') {
                const pending = await sql`SELECT * FROM forge_pending_updates`
                if (pending.length === 0) {
                    return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ applied: 0 }) }
                }

                // Batch update player_sparks
                const sparkIds = pending.map(p => p.spark_id)
                const multipliers = pending.map(p => Number(p.new_multiplier))
                const prices = pending.map(p => Number(p.new_price))

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

                // Batch insert price history
                await sql`
                    INSERT INTO spark_price_history (spark_id, price, trigger)
                    SELECT UNNEST(${sparkIds}::int[]), UNNEST(${prices}::numeric[]), 'performance'
                `

                // Clear pending
                await sql`DELETE FROM forge_pending_updates`

                // Track challenge progress for holders (fire-and-forget — don't block response)
                const marketIds = [...new Set(pending.map(p => p.market_id))]
                event.waitUntil((async () => {
                    try {
                        for (const marketId of marketIds) {
                            const holdingUsers = await sql`
                                SELECT DISTINCT sh.user_id
                                FROM spark_holdings sh
                                JOIN player_sparks ps ON sh.spark_id = ps.id
                                WHERE ps.market_id = ${marketId} AND sh.sparks > 0
                            `
                            for (const u of holdingUsers) {
                                await grantPassion(sql, u.user_id, 'forge_perf_update', 0, 'Perf update while holding')
                                const [{ count }] = await sql`
                                    SELECT COUNT(*)::integer as count FROM passion_transactions
                                    WHERE user_id = ${u.user_id} AND type = 'forge_perf_update'
                                `
                                await pushChallengeProgress(sql, u.user_id, { forge_perf_updates_held: count })
                            }
                        }
                    } catch (err) {
                        console.error('Forge approval challenge tracking failed:', err)
                    }
                })())

                return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ applied: pending.length }) }
            }

            if (action === 'reject') {
                await sql`DELETE FROM forge_pending_updates`
                return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ rejected: true }) }
            }

            if (action === 'recalc') {
                const body = event.body ? JSON.parse(event.body) : {}
                let seasonId = body.season_id
                if (!seasonId) {
                    // Find the season with an open forge market
                    const [openMarket] = await sql`
                        SELECT season_id FROM forge_markets WHERE status = 'open' ORDER BY created_at DESC LIMIT 1
                    `
                    if (!openMarket) {
                        return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ status: 'skipped', reason: 'no_open_market', detail: 'No open forge market found' }) }
                    }
                    seasonId = openMarket.season_id
                }
                const result = await recalcForgePerformance(sql, seasonId)
                return { statusCode: 200, headers: adminHeaders, body: JSON.stringify(result || { status: 'unknown' }) }
            }

            // ── Config update (owner only) ──
            const body = event.body ? JSON.parse(event.body) : {}

            const [current] = await sql`SELECT * FROM forge_config LIMIT 1`
            if (!current) {
                return { statusCode: 500, headers: adminHeaders, body: JSON.stringify({ error: 'Config not initialized' }) }
            }

            let hasUpdates = false
            const merged = {}
            for (const key of NUMERIC_KEYS) {
                if (body[key] !== undefined) {
                    const val = Number(body[key])
                    if (isNaN(val) || val < 0) {
                        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: `Invalid value for ${key}` }) }
                    }
                    merged[key] = val
                    if (val !== Number(current[key])) hasUpdates = true
                } else {
                    merged[key] = Number(current[key])
                }
            }

            // Handle boolean fields
            if (body.performance_approval !== undefined) {
                const val = !!body.performance_approval
                merged.performance_approval = val
                if (val !== current.performance_approval) hasUpdates = true
            } else {
                merged.performance_approval = current.performance_approval
            }

            for (const boolKey of ['fueling_locked', 'cooling_locked']) {
                if (body[boolKey] !== undefined) {
                    const val = !!body[boolKey]
                    merged[boolKey] = val
                    if (val !== current[boolKey]) hasUpdates = true
                } else {
                    merged[boolKey] = current[boolKey]
                }
            }

            if (!hasUpdates) {
                return { statusCode: 200, headers: adminHeaders, body: JSON.stringify(current) }
            }

            await sql`
                UPDATE forge_config SET
                    game_decay = ${merged.game_decay},
                    supply_weight = ${merged.supply_weight},
                    expectation_weight = ${merged.expectation_weight},
                    inactivity_decay = ${merged.inactivity_decay},
                    perf_floor = ${merged.perf_floor},
                    perf_ceiling = ${merged.perf_ceiling},
                    compress_k = ${merged.compress_k},
                    opponent_weight = ${merged.opponent_weight},
                    teammate_weight = ${merged.teammate_weight},
                    god_weight = ${merged.god_weight},
                    win_bonus = ${merged.win_bonus},
                    decay_half_life = ${merged.decay_half_life},
                    sell_pressure_half_life = ${merged.sell_pressure_half_life},
                    sell_pressure_factor = ${merged.sell_pressure_factor},
                    performance_approval = ${merged.performance_approval},
                    fueling_locked = ${merged.fueling_locked},
                    cooling_locked = ${merged.cooling_locked},
                    updated_at = NOW()
                WHERE id = 1
            `

            const [updated] = await sql`SELECT * FROM forge_config LIMIT 1`
            return { statusCode: 200, headers: adminHeaders, body: JSON.stringify(updated) }
        }

        return { statusCode: 405, headers: adminHeaders, body: JSON.stringify({ error: 'Method not allowed' }) }
    } catch (error) {
        console.error('forge-config error:', error)
        return { statusCode: 500, headers: adminHeaders, body: JSON.stringify({ error: error.message }) }
    }
}

export const onRequestGet = adapt(handler)
export const onRequestPost = adapt(handler)
export const onRequestOptions = adapt(handler)

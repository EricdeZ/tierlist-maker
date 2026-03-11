import { adapt } from '../lib/adapter.js'
import { getDB, headers } from '../lib/db.js'
import { requireAuth } from '../lib/auth.js'
import { grantPassion } from '../lib/passion.js'
import { ensureEmberBalance, grantEmber, getConversionCost, EMBER_RULES } from '../lib/ember.js'
import { pushChallengeProgress, getVaultStats } from '../lib/challenges.js'

const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const user = await requireAuth(event)
    if (!user) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Login required' }) }
    }

    const { action } = event.queryStringParameters || {}
    const sql = getDB()

    try {
        if (event.httpMethod === 'GET') {
            switch (action) {
                case 'balance': return await getBalance(sql, user)
                default: return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
            }
        }

        if (event.httpMethod === 'POST') {
            switch (action) {
                case 'claim-daily': return await claimDaily(sql, user)
                case 'convert': return await convertPassion(sql, user)
                default: return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
            }
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    } catch (error) {
        console.error('ember error:', error)
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) }
    }
}

// ═══ GET: Ember balance ═══
async function getBalance(sql, user) {
    await ensureEmberBalance(sql, user.id)

    const [eb] = await sql`
        SELECT balance, last_daily_claim, current_streak, longest_streak,
               conversions_today, last_conversion_date::text
        FROM ember_balances WHERE user_id = ${user.id}
    `

    const now = new Date()
    const todayUTC = now.toISOString().slice(0, 10)
    const lastClaimDate = eb.last_daily_claim
        ? new Date(eb.last_daily_claim).toISOString().slice(0, 10)
        : null
    const canClaimDaily = lastClaimDate !== todayUTC

    // Reset conversions_today if it's a new day
    const lastConvDate = eb.last_conversion_date || null
    let conversionsToday = eb.conversions_today || 0
    if (lastConvDate && lastConvDate !== todayUTC) {
        conversionsToday = 0
    }

    const nextConversionCost = getConversionCost(conversionsToday)

    return {
        statusCode: 200, headers,
        body: JSON.stringify({
            balance: eb.balance,
            currentStreak: eb.current_streak,
            longestStreak: eb.longest_streak,
            canClaimDaily,
            lastDailyClaim: eb.last_daily_claim,
            conversionsToday,
            nextConversionCost,
            conversionEmberAmount: EMBER_RULES.conversion_ember_amount,
            conversionMultiplier: EMBER_RULES.conversion_multiplier,
            conversionBaseCost: EMBER_RULES.conversion_base_passion,
        }),
    }
}

// ═══ POST: Claim daily ember ═══
async function claimDaily(sql, user) {
    await ensureEmberBalance(sql, user.id)

    const [eb] = await sql`
        SELECT last_daily_claim, current_streak FROM ember_balances WHERE user_id = ${user.id}
    `

    const now = new Date()
    const todayUTC = now.toISOString().slice(0, 10)
    const lastClaimDate = eb.last_daily_claim
        ? new Date(eb.last_daily_claim).toISOString().slice(0, 10)
        : null

    if (lastClaimDate === todayUTC) {
        return { statusCode: 200, headers, body: JSON.stringify({ alreadyClaimed: true }) }
    }

    // Calculate streak
    const yesterdayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1))
        .toISOString().slice(0, 10)
    const newStreak = lastClaimDate === yesterdayUTC ? (eb.current_streak || 0) + 1 : 1

    // Calculate reward
    const { daily_base, streak_bonus_per_day, streak_bonus_cap } = EMBER_RULES
    const streakBonus = Math.min((newStreak - 1) * streak_bonus_per_day, streak_bonus_cap)
    const totalAmount = daily_base + streakBonus

    // Grant ember
    const { balance } = await grantEmber(sql, user.id, 'daily_claim', totalAmount,
        `Daily Ember (streak: ${newStreak})`)

    // Update streak and claim timestamp
    await sql`
        UPDATE ember_balances SET
            last_daily_claim = ${now},
            current_streak = ${newStreak},
            longest_streak = GREATEST(longest_streak, ${newStreak})
        WHERE user_id = ${user.id}
    `

    // Push vault challenge progress (fire-and-forget)
    getVaultStats(sql, user.id)
        .then(stats => pushChallengeProgress(sql, user.id, stats))
        .catch(err => console.error('Vault challenge push (daily) failed:', err))

    return {
        statusCode: 200, headers,
        body: JSON.stringify({
            earned: totalAmount,
            baseAmount: daily_base,
            streakBonus,
            streak: newStreak,
            balance,
        }),
    }
}

// ═══ POST: Convert Passion → Ember ═══
async function convertPassion(sql, user) {
    await ensureEmberBalance(sql, user.id)

    const [eb] = await sql`
        SELECT conversions_today, last_conversion_date::text FROM ember_balances WHERE user_id = ${user.id}
    `

    const now = new Date()
    const todayUTC = now.toISOString().slice(0, 10)

    // Reset daily conversions if new day
    const lastConvDate = eb.last_conversion_date || null
    let conversionsToday = eb.conversions_today || 0
    if (lastConvDate && lastConvDate !== todayUTC) {
        conversionsToday = 0
    }

    const passionCost = getConversionCost(conversionsToday)
    const emberGain = EMBER_RULES.conversion_ember_amount

    // Check passion balance
    const [pb] = await sql`SELECT balance FROM passion_balances WHERE user_id = ${user.id}`
    if (!pb || pb.balance < passionCost) {
        return { statusCode: 400, headers, body: JSON.stringify({
            error: 'Not enough Passion',
            needed: passionCost,
            have: pb?.balance || 0,
        }) }
    }

    // Deduct passion
    await grantPassion(sql, user.id, 'ember_convert', -passionCost,
        `Converted to ${emberGain} Ember (rate: ${passionCost} Passion)`)

    // Grant ember
    const { balance: emberBalance } = await grantEmber(sql, user.id, 'passion_convert', emberGain,
        `Converted from ${passionCost} Passion`)

    // Increment daily conversion counter
    const newConversions = conversionsToday + 1
    await sql`
        UPDATE ember_balances SET
            conversions_today = ${newConversions},
            last_conversion_date = ${todayUTC}
        WHERE user_id = ${user.id}
    `

    // Get updated passion balance
    const [updatedPb] = await sql`SELECT balance FROM passion_balances WHERE user_id = ${user.id}`

    const nextCost = getConversionCost(newConversions)

    // Push vault challenge progress (fire-and-forget)
    getVaultStats(sql, user.id)
        .then(stats => pushChallengeProgress(sql, user.id, stats))
        .catch(err => console.error('Vault challenge push (convert) failed:', err))

    return {
        statusCode: 200, headers,
        body: JSON.stringify({
            passionSpent: passionCost,
            emberGained: emberGain,
            emberBalance,
            passionBalance: updatedPb.balance,
            conversionsToday: newConversions,
            nextConversionCost: nextCost,
        }),
    }
}

export const onRequest = adapt(handler)

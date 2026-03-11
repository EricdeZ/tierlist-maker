// Ember currency system — Card Clash fuel
// Daily claim, Passion→Ember conversion with exponential rate increase

export const EMBER_RULES = {
    daily_base: 25,
    streak_bonus_per_day: 1,
    streak_bonus_cap: 10,
    conversion_base_passion: 50,  // 50 passion per 10 ember at base rate
    conversion_ember_amount: 10,  // each conversion gives 10 ember
    conversion_multiplier: 1.3,   // exponential increase per conversion per day
}

/**
 * Get the passion cost for the next conversion given how many have been done today.
 */
export function getConversionCost(conversionsDone) {
    const { conversion_base_passion, conversion_multiplier } = EMBER_RULES
    return Math.round(conversion_base_passion * Math.pow(conversion_multiplier, conversionsDone))
}

/**
 * Ensure ember_balances row exists for a user.
 */
export async function ensureEmberBalance(sql, userId) {
    await sql`
        INSERT INTO ember_balances (user_id)
        VALUES (${userId})
        ON CONFLICT (user_id) DO NOTHING
    `
}

/**
 * Grant or deduct ember atomically.
 */
export async function grantEmber(sql, userId, type, amount, description, referenceId = null) {
    await ensureEmberBalance(sql, userId)

    await sql`
        INSERT INTO ember_transactions (user_id, amount, type, description, reference_id)
        VALUES (${userId}, ${amount}, ${type}, ${description}, ${referenceId})
    `

    const [updated] = await sql`
        UPDATE ember_balances SET
            balance = balance + ${amount},
            updated_at = NOW()
        WHERE user_id = ${userId}
        RETURNING balance
    `

    return { balance: updated.balance }
}

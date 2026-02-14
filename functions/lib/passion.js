// netlify/functions/lib/passion.js
// Shared helpers for the passion coin system.

// ═══════════════════════════════════════════════════
// Earning rules
// ═══════════════════════════════════════════════════
export const EARNING_RULES = {
    daily_login:    { amount: 10, cooldownMs: null },      // controlled by calendar day, not cooldown
    streak_bonus:   { perDay: 2, cap: 20 },                // +2 per consecutive day, max +20
    tier_list_save: { amount: 0, cooldownMs: 24 * 60 * 60 * 1000 }, // tracking only, once per day
    draft_complete: { amount: 0, cooldownMs: 24 * 60 * 60 * 1000 }, // tracking only, once per day
}

// Rank thresholds (server-side copy without images)
export const RANK_THRESHOLDS = [
    { minPassion: 0,    name: 'Clay',     division: null },
    { minPassion: 200,  name: 'Amber',    division: 'III' },
    { minPassion: 400,  name: 'Amber',    division: 'II' },
    { minPassion: 600,  name: 'Amber',    division: 'I' },
    { minPassion: 800,  name: 'Bronze',   division: 'III' },
    { minPassion: 1000, name: 'Bronze',   division: 'II' },
    { minPassion: 1200, name: 'Bronze',   division: 'I' },
    { minPassion: 1400, name: 'Silver',   division: 'III' },
    { minPassion: 1600, name: 'Silver',   division: 'II' },
    { minPassion: 1800, name: 'Silver',   division: 'I' },
    { minPassion: 2000, name: 'Gold',     division: 'III' },
    { minPassion: 2200, name: 'Gold',     division: 'II' },
    { minPassion: 2400, name: 'Gold',     division: 'I' },
    { minPassion: 2600, name: 'Platinum', division: 'III' },
    { minPassion: 2800, name: 'Platinum', division: 'II' },
    { minPassion: 3000, name: 'Platinum', division: 'I' },
    { minPassion: 3200, name: 'Diamond',  division: 'III' },
    { minPassion: 3400, name: 'Diamond',  division: 'II' },
    { minPassion: 3600, name: 'Diamond',  division: 'I' },
    { minPassion: 3800, name: 'Obsidian', division: 'III' },
    { minPassion: 4000, name: 'Obsidian', division: 'II' },
    { minPassion: 4200, name: 'Obsidian', division: 'I' },
    { minPassion: 4400, name: 'Master',   division: 'III' },
    { minPassion: 4600, name: 'Master',   division: 'II' },
    { minPassion: 4800, name: 'Master',   division: 'I' },
    { minPassion: 5000, name: 'Demigod',  division: null },
    { minPassion: 5500, name: 'Deity',    division: null },
]

/**
 * Get rank from total earned (server-side, no images).
 */
export function getRank(totalEarned) {
    let rank = RANK_THRESHOLDS[0]
    for (const t of RANK_THRESHOLDS) {
        if (totalEarned >= t.minPassion) rank = t
        else break
    }
    return rank
}

/**
 * Get next rank info or null if at max.
 */
export function getNextRank(totalEarned) {
    for (const t of RANK_THRESHOLDS) {
        if (totalEarned < t.minPassion) {
            return { ...t, passionNeeded: t.minPassion - totalEarned }
        }
    }
    return null
}

export function formatRank(rank) {
    if (!rank) return 'Unranked'
    return rank.division ? `${rank.name} ${rank.division}` : rank.name
}

// ═══════════════════════════════════════════════════
// Core helper: grant passion atomically
// ═══════════════════════════════════════════════════

/**
 * Grant or deduct passion for a user.
 * Inserts a transaction and updates the balance atomically.
 *
 * @param {object} sql - postgres connection
 * @param {number} userId
 * @param {string} type - transaction type
 * @param {number} amount - positive to earn, negative to spend
 * @param {string} description
 * @param {string|null} referenceId
 * @returns {{ balance, totalEarned, totalSpent }} updated balances
 */
export async function grantPassion(sql, userId, type, amount, description, referenceId = null) {
    // Ensure the balance row exists
    await sql`
        INSERT INTO passion_balances (user_id)
        VALUES (${userId})
        ON CONFLICT (user_id) DO NOTHING
    `

    // Insert the transaction
    await sql`
        INSERT INTO passion_transactions (user_id, amount, type, description, reference_id)
        VALUES (${userId}, ${amount}, ${type}, ${description}, ${referenceId})
    `

    // Update balance
    const earnDelta = amount > 0 ? amount : 0
    const spendDelta = amount < 0 ? Math.abs(amount) : 0

    const [updated] = await sql`
        UPDATE passion_balances SET
            balance = balance + ${amount},
            total_earned = total_earned + ${earnDelta},
            total_spent = total_spent + ${spendDelta},
            updated_at = NOW()
        WHERE user_id = ${userId}
        RETURNING balance, total_earned, total_spent
    `

    return {
        balance: updated.balance,
        totalEarned: updated.total_earned,
        totalSpent: updated.total_spent,
    }
}

// ═══════════════════════════════════════════════════
// Cooldown checker
// ═══════════════════════════════════════════════════

/**
 * Check if a user has already performed a transaction type within the cooldown window.
 * @param {object} sql
 * @param {number} userId
 * @param {string} type - transaction type to check
 * @param {number} cooldownMs - milliseconds
 * @returns {boolean} true if on cooldown (action NOT allowed)
 */
export async function checkCooldown(sql, userId, type, cooldownMs) {
    const cutoff = new Date(Date.now() - cooldownMs)
    const [recent] = await sql`
        SELECT 1 FROM passion_transactions
        WHERE user_id = ${userId}
          AND type = ${type}
          AND created_at > ${cutoff}
        LIMIT 1
    `
    return !!recent
}

/**
 * Check if a user has ever performed a transaction of a given type.
 */
export async function hasEverEarned(sql, userId, type) {
    const [row] = await sql`
        SELECT 1 FROM passion_transactions
        WHERE user_id = ${userId} AND type = ${type}
        LIMIT 1
    `
    return !!row
}

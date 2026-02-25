import { grantPassion } from './passion.js'
import { pushChallengeProgress } from './challenges.js'

const REFERRAL_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'

export function generateReferralCode() {
    let code = ''
    for (let i = 0; i < 8; i++) {
        code += REFERRAL_CHARS[Math.floor(Math.random() * REFERRAL_CHARS.length)]
    }
    return code
}

/**
 * Process a website referral during signup.
 * Grants 25 Passion to referrer, 50 to referee.
 * Returns null if already referred or self-referral.
 */
export async function processWebsiteReferral(sql, referrerId, refereeId) {
    if (referrerId === refereeId) return null

    const [existing] = await sql`
        SELECT 1 FROM referrals WHERE referee_id = ${refereeId} AND type = 'website'
    `
    if (existing) return null

    await sql`
        INSERT INTO referrals (referrer_id, referee_id, type, rewarded)
        VALUES (${referrerId}, ${refereeId}, 'website', true)
    `

    await grantPassion(sql, refereeId, 'referral_website_referee', 50,
        'Welcome bonus: referred by a friend', String(referrerId))
    await grantPassion(sql, referrerId, 'referral_website_referrer', 25,
        'Referral reward: friend signed up', String(refereeId))

    // Push challenge progress for referrer
    const [{ count }] = await sql`
        SELECT COUNT(*)::integer as count FROM referrals
        WHERE referrer_id = ${referrerId}
    `
    await pushChallengeProgress(sql, referrerId, { friends_referred: count })

    return { referrerReward: 25, refereeReward: 50 }
}

/**
 * Process a forge referral.
 * Grants 1 free Spark to both referrer and referee.
 * Returns false if already referred or self-referral.
 */
export async function processForgeReferral(sql, referrerId, refereeId) {
    if (referrerId === refereeId) return false

    const [existing] = await sql`
        SELECT 1 FROM referrals WHERE referee_id = ${refereeId} AND type = 'forge'
    `
    if (existing) return false

    await sql`
        INSERT INTO referrals (referrer_id, referee_id, type, rewarded)
        VALUES (${referrerId}, ${refereeId}, 'forge', true)
    `

    // Grant 1 free spark to both users
    await sql`
        UPDATE users SET forge_referral_sparks = forge_referral_sparks + 1
        WHERE id IN (${referrerId}, ${refereeId})
    `

    // Push challenge progress for referrer
    const [{ count }] = await sql`
        SELECT COUNT(*)::integer as count FROM referrals
        WHERE referrer_id = ${referrerId}
    `
    await pushChallengeProgress(sql, referrerId, { friends_referred: count })

    return true
}

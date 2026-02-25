import { adapt } from '../lib/adapter.js'
import { getDB, headers } from '../lib/db.js'
import { requireAuth } from '../lib/auth.js'
import { processWebsiteReferral, processForgeReferral } from '../lib/referrals.js'

const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const sql = getDB()
    const params = event.queryStringParameters || {}
    const { action } = params

    try {
        if (event.httpMethod === 'GET') {
            switch (action) {
                case 'my-stats':
                    return await getMyStats(sql, event)
                case 'validate-code':
                    return await validateCode(sql, params)
                default:
                    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
            }
        }

        if (event.httpMethod === 'POST') {
            const body = event.body ? JSON.parse(event.body) : {}
            switch (action) {
                case 'claim':
                    return await claimReferral(sql, event, body)
                default:
                    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
            }
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    } catch (error) {
        console.error('referrals error:', error)
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) }
    }
}

async function getMyStats(sql, event) {
    const user = await requireAuth(event)
    if (!user) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const [counts, passionEarned, referredBy, recentReferrals] = await Promise.all([
        sql`
            SELECT
                COUNT(*) FILTER (WHERE type = 'website')::integer as website_referrals,
                COUNT(*) FILTER (WHERE type = 'forge')::integer as forge_referrals
            FROM referrals WHERE referrer_id = ${user.id}
        `,
        sql`
            SELECT COALESCE(SUM(amount), 0)::integer as total
            FROM passion_transactions
            WHERE user_id = ${user.id} AND type = 'referral_website_referrer'
        `,
        sql`
            SELECT r.type, u.discord_username, r.created_at
            FROM referrals r
            JOIN users u ON u.id = r.referrer_id
            WHERE r.referee_id = ${user.id}
        `,
        sql`
            SELECT u.discord_username, r.type, r.created_at
            FROM referrals r
            JOIN users u ON u.id = r.referee_id
            WHERE r.referrer_id = ${user.id}
            ORDER BY r.created_at DESC
            LIMIT 20
        `,
    ])

    const referredByMap = {}
    for (const row of referredBy) {
        referredByMap[row.type] = { username: row.discord_username, at: row.created_at }
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            referralCode: user.referral_code,
            websiteReferrals: counts[0].website_referrals,
            forgeReferrals: counts[0].forge_referrals,
            totalPassionEarned: passionEarned[0].total,
            referredBy: referredByMap,
            recentReferrals: recentReferrals.map(r => ({
                username: r.discord_username,
                type: r.type,
                createdAt: r.created_at,
            })),
        }),
    }
}

async function validateCode(sql, params) {
    const { code } = params
    if (!code) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'code is required' }) }
    }

    const [user] = await sql`
        SELECT discord_username FROM users WHERE referral_code = ${code}
    `

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify(user
            ? { valid: true, username: user.discord_username }
            : { valid: false }
        ),
    }
}

async function claimReferral(sql, event, body) {
    const user = await requireAuth(event)
    if (!user) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const { code, type } = body
    if (!code || !type || !['website', 'forge'].includes(type)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'code and type (website|forge) are required' }) }
    }

    const [referrer] = await sql`
        SELECT id FROM users WHERE referral_code = ${code}
    `
    if (!referrer) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid referral code' }) }
    }

    if (type === 'website') {
        const result = await processWebsiteReferral(sql, referrer.id, user.id)
        if (!result) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Already have a website referrer or cannot self-refer' }) }
        }
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, referrerUsername: (await sql`SELECT discord_username FROM users WHERE id = ${referrer.id}`)[0].discord_username }) }
    } else {
        const result = await processForgeReferral(sql, referrer.id, user.id)
        if (!result) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Already have a Forge referrer or cannot self-refer' }) }
        }
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, referrerUsername: (await sql`SELECT discord_username FROM users WHERE id = ${referrer.id}`)[0].discord_username }) }
    }
}

export const onRequest = adapt(handler)

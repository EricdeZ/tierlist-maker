import { adapt } from '../lib/adapter.js'
import { getDB, headers } from '../lib/db.js'
import { requireAuth, requirePermission } from '../lib/auth.js'
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
                case 'admin-top':
                    return await adminTop(sql, event)
                case 'admin-search':
                    return await adminSearch(sql, event, params)
                case 'admin-referrals':
                    return await adminReferrals(sql, event, params)
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
        const [ref] = await sql`SELECT discord_username FROM users WHERE id = ${referrer.id}`
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, referrerUsername: ref?.discord_username }) }
    } else {
        const result = await processForgeReferral(sql, referrer.id, user.id)
        if (!result) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Already have a Forge referrer or cannot self-refer' }) }
        }
        const [ref] = await sql`SELECT discord_username FROM users WHERE id = ${referrer.id}`
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, referrerUsername: ref?.discord_username }) }
    }
}

async function adminTop(sql, event) {
    await requirePermission(event, 'league_manage')
    const top = await sql`
        SELECT u.id, u.discord_username, u.referral_code,
            COUNT(*)::integer as referral_count,
            COUNT(*) FILTER (WHERE r.type = 'website')::integer as website_count,
            COUNT(*) FILTER (WHERE r.type = 'forge')::integer as forge_count
        FROM referrals r
        JOIN users u ON u.id = r.referrer_id
        GROUP BY u.id, u.discord_username, u.referral_code
        ORDER BY referral_count DESC
        LIMIT 10
    `
    return { statusCode: 200, headers, body: JSON.stringify({ top }) }
}

async function adminSearch(sql, event, params) {
    await requirePermission(event, 'league_manage')
    const q = (params.q || '').trim()
    if (!q || q.length < 2) {
        return { statusCode: 200, headers, body: JSON.stringify({ users: [] }) }
    }
    const users = await sql`
        SELECT id, discord_username, referral_code,
            (SELECT COUNT(*)::integer FROM referrals WHERE referrer_id = users.id) as referral_count
        FROM users
        WHERE discord_username ILIKE ${'%' + q + '%'}
        ORDER BY referral_count DESC, discord_username
        LIMIT 20
    `
    return { statusCode: 200, headers, body: JSON.stringify({ users }) }
}

async function adminReferrals(sql, event, params) {
    await requirePermission(event, 'league_manage')
    const userId = parseInt(params.userId)
    if (!userId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'userId is required' }) }
    }
    const [referrer, referrals] = await Promise.all([
        sql`
            SELECT id, discord_username, referral_code, created_at
            FROM users WHERE id = ${userId}
        `,
        sql`
            SELECT r.id, r.type, r.rewarded, r.created_at,
                u.discord_username as referee_username, u.id as referee_id
            FROM referrals r
            JOIN users u ON u.id = r.referee_id
            WHERE r.referrer_id = ${userId}
            ORDER BY r.created_at DESC
        `,
    ])
    if (!referrer[0]) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'User not found' }) }
    }
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            user: referrer[0],
            referrals: referrals.map(r => ({
                id: r.id,
                type: r.type,
                rewarded: r.rewarded,
                createdAt: r.created_at,
                refereeUsername: r.referee_username,
                refereeId: r.referee_id,
            })),
        }),
    }
}

export const onRequest = adapt(handler)

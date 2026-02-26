import { adapt } from '../lib/adapter.js'
// Discord OAuth2 callback handler
import { getDB, headers } from '../lib/db.js'
import { signToken } from '../lib/auth.js'
import { pushChallengeProgress } from '../lib/challenges.js'
import { generateReferralCode, processWebsiteReferral } from '../lib/referrals.js'

const handler = async (event) => {
    const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID
    const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET
    const ADMIN_DISCORD_ID = process.env.ADMIN_DISCORD_ID
    const FALLBACK_URL = process.env.URL || 'http://localhost:8788'
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const code = event.queryStringParameters?.code
    const rawState = event.queryStringParameters?.state || '/'

    // State may be a full URL (origin + path) or just a path (legacy)
    let FRONTEND_URL = FALLBACK_URL
    let returnPath = '/'
    try {
        const parsed = new URL(rawState)
        FRONTEND_URL = parsed.origin
        returnPath = parsed.pathname + parsed.search
    } catch {
        // Legacy: state is just a path
        returnPath = rawState
    }

    // Derive redirect_uri from the state origin so it matches what the frontend sent to Discord.
    // Only fall back to env var when state was a legacy plain path (no origin).
    const DISCORD_REDIRECT_URI = (FRONTEND_URL !== FALLBACK_URL)
        ? `${FRONTEND_URL}/api/auth-callback`
        : (process.env.DISCORD_REDIRECT_URI || `${FALLBACK_URL}/api/auth-callback`)
    if (!code) {
        return redirectWithError(FRONTEND_URL, 'Missing authorization code')
    }

    try {
        // 1. Exchange code for access token
        const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: DISCORD_REDIRECT_URI,
                client_id: DISCORD_CLIENT_ID,
                client_secret: DISCORD_CLIENT_SECRET,
            }),
        })

        if (!tokenRes.ok) {
            const err = await tokenRes.text()
            console.error('Discord token exchange failed:', err)
            console.error('redirect_uri used:', DISCORD_REDIRECT_URI)
            return redirectWithError(FRONTEND_URL, `Discord token exchange failed: ${err}`)
        }

        const tokenData = await tokenRes.json()

        // 2. Fetch user info from Discord
        const userRes = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        })

        if (!userRes.ok) {
            return redirectWithError(FRONTEND_URL, 'Failed to fetch Discord profile')
        }

        const discordUser = await userRes.json()
        const { id: discordId, username, avatar } = discordUser

        const sql = getDB()

        // Extract referral code from returnPath (if present) and strip it
        let refCode = null
        try {
            const returnUrl = new URL(returnPath, 'http://localhost')
            refCode = returnUrl.searchParams.get('ref')
            if (refCode) {
                returnUrl.searchParams.delete('ref')
                returnPath = returnUrl.pathname + (returnUrl.search || '')
            }
        } catch { /* ignore parse errors */ }

        // 3. Upsert user in database (CTE detects new vs returning)
        const referralCode = generateReferralCode()
        const [user] = await sql`
            WITH existing AS (
                SELECT id FROM users WHERE discord_id = ${discordId}
            ),
            upserted AS (
                INSERT INTO users (discord_id, discord_username, discord_avatar, referral_code)
                VALUES (${discordId}, ${username}, ${avatar}, ${referralCode})
                ON CONFLICT (discord_id) DO UPDATE SET
                    discord_username = EXCLUDED.discord_username,
                    discord_avatar = EXCLUDED.discord_avatar,
                    updated_at = NOW()
                RETURNING *
            )
            SELECT u.*, (e.id IS NULL) as is_new_user
            FROM upserted u
            LEFT JOIN existing e ON true
        `

        // 4. Bootstrap admin if discord_id matches env var
        if (ADMIN_DISCORD_ID && discordId === ADMIN_DISCORD_ID && user.role === 'user') {
            await sql`UPDATE users SET role = 'admin', updated_at = NOW() WHERE id = ${user.id}`
            user.role = 'admin'
        }

        // 4b. Bootstrap Owner RBAC role for the admin discord ID
        if (ADMIN_DISCORD_ID && discordId === ADMIN_DISCORD_ID) {
            const [ownerRole] = await sql`SELECT id FROM roles WHERE name = 'Owner' LIMIT 1`
            if (ownerRole) {
                await sql`
                    INSERT INTO user_roles (user_id, role_id, league_id, granted_by)
                    VALUES (${user.id}, ${ownerRole.id}, NULL, ${user.id})
                    ON CONFLICT DO NOTHING
                `
            }
        }

        // 5. Push discord_linked challenge progress (fire-and-forget)
        pushChallengeProgress(sql, user.id, { discord_linked: 1 })
            .catch(err => console.error('Challenge push (discord_linked) failed:', err))

        // 5b. Process website referral if valid ref code (processWebsiteReferral handles duplicates/self-refer)
        if (refCode) {
            event.waitUntil(
                (async () => {
                    const [referrer] = await sql`
                        SELECT id FROM users WHERE referral_code = ${refCode}
                    `
                    if (referrer) {
                        await processWebsiteReferral(sql, referrer.id, user.id)
                    }
                })().catch(err => console.error('Website referral processing failed:', err))
            )
        }

        // 6. Auto-match player profile if not already linked
        if (!user.linked_player_id) {
            // Try matching by discord_id first, then by discord_name
            const [matchedPlayer] = await sql`
                SELECT id FROM players
                WHERE discord_id = ${discordId}
                   OR LOWER(discord_name) = LOWER(${username})
                LIMIT 1
            `

            if (matchedPlayer) {
                await sql`
                    UPDATE users SET linked_player_id = ${matchedPlayer.id}, updated_at = NOW()
                    WHERE id = ${user.id}
                `
                // Backfill discord_id on the player record
                await sql`
                    UPDATE players SET discord_id = ${discordId}, updated_at = NOW()
                    WHERE id = ${matchedPlayer.id} AND (discord_id IS NULL OR discord_id = '')
                `
                user.linked_player_id = matchedPlayer.id
            }
        }

        // 7. Sign JWT and redirect to frontend (back to the page they were on)
        const jwt = await signToken(user)
        const separator = returnPath.includes('?') ? '&' : '?'
        return {
            statusCode: 302,
            headers: {
                Location: `${FRONTEND_URL}${returnPath}${separator}auth_token=${jwt}`,
                'Cache-Control': 'no-cache',
            },
            body: '',
        }

    } catch (err) {
        console.error('Auth callback error:', err)
        return redirectWithError(FRONTEND_URL, 'Authentication failed')
    }
}

function redirectWithError(frontendUrl, message) {
    return {
        statusCode: 302,
        headers: {
            Location: `${frontendUrl}/?auth_error=${encodeURIComponent(message)}`,
            'Cache-Control': 'no-cache',
        },
        body: '',
    }
}

export const onRequest = adapt(handler)

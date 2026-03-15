import { adapt } from '../lib/adapter.js'
// Returns current authenticated user info
import { getDB, headers } from '../lib/db.js'
import { resolveUser, getUserPermissions } from '../lib/auth.js'

const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    }

    const resolved = await resolveUser(event)
    if (!resolved) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid or expired token' }) }
    }

    const { user, realUser } = resolved
    const impersonating = user.id !== realUser.id

    // If user has a linked player, fetch player details + their most recent division
    const sql = getDB()
    let linkedPlayer = null
    if (user.linked_player_id) {
        const [player] = await sql`
            SELECT p.id, p.name, p.slug, p.discord_name,
                   l.slug AS league_slug, d.slug AS division_slug, d.tier AS division_tier
            FROM players p
            LEFT JOIN league_players lp ON lp.player_id = p.id
            LEFT JOIN seasons s ON s.id = lp.season_id
            LEFT JOIN divisions d ON d.id = s.division_id
            LEFT JOIN leagues l ON l.id = s.league_id
            WHERE p.id = ${user.linked_player_id}
            ORDER BY s.is_active DESC NULLS LAST, s.start_date DESC NULLS LAST
            LIMIT 1
        `
        linkedPlayer = player || null
    }

    // Fetch RBAC permissions for the effective user (impersonated if applicable)
    const permissions = await getUserPermissions(user.id)

    // Check vault ban status
    const [banRow] = await sql`SELECT 1 FROM cc_vault_bans WHERE user_id = ${user.id}`

    const response = {
        user: {
            id: user.id,
            discord_id: user.discord_id,
            discord_username: user.discord_username,
            discord_avatar: user.discord_avatar,
            role: user.role,
            linked_player_id: user.linked_player_id,
        },
        linkedPlayer,
        permissions,
        vaultBanned: !!banRow,
    }

    if (impersonating) {
        response.impersonating = true
        response.realUser = {
            id: realUser.id,
            discord_id: realUser.discord_id,
            discord_username: realUser.discord_username,
            discord_avatar: realUser.discord_avatar,
        }
    }

    // Background refresh Discord avatar via bot API (fire-and-forget)
    event.waitUntil(refreshDiscordAvatar(realUser))

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify(response),
    }
}

async function refreshDiscordAvatar(user) {
    try {
        const botToken = process.env.DISCORD_BOT_TOKEN
        if (!botToken || !user.discord_id) return

        const res = await fetch(`https://discord.com/api/v10/users/${user.discord_id}`, {
            headers: { Authorization: `Bot ${botToken}` },
        })
        if (!res.ok) return

        const discordUser = await res.json()
        const newAvatar = discordUser.avatar || null
        const newUsername = discordUser.username || user.discord_username

        // Only update if something changed
        if (newAvatar !== user.discord_avatar || newUsername !== user.discord_username) {
            const sql = getDB()
            await sql`
                UPDATE users
                SET discord_avatar = ${newAvatar}, discord_username = ${newUsername}, updated_at = NOW()
                WHERE id = ${user.id}
            `
        }
    } catch {
        // Silently ignore — this is best-effort
    }
}

export const onRequest = adapt(handler)

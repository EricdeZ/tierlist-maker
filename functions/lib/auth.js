// functions/lib/auth.js — Cloudflare Workers compatible (jose)
import { SignJWT, jwtVerify } from 'jose'
import { getDB } from './db.js'

const getSecret = () => new TextEncoder().encode(process.env.JWT_SECRET)

/**
 * Verify a JWT from the Authorization header.
 * Returns decoded payload { userId, discordId, role } or null.
 */
export async function verifyAuth(event) {
    const authHeader = event.headers.authorization || event.headers.Authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null

    try {
        const token = authHeader.slice(7)
        const { payload } = await jwtVerify(token, getSecret())
        return payload
    } catch {
        return null
    }
}

/**
 * Verify JWT and confirm the user is an admin (re-checks DB).
 * Accepts users with role='admin' OR users with any RBAC role assignment.
 * Returns the full user row or null.
 */
export async function requireAdmin(event) {
    const payload = await verifyAuth(event)
    if (!payload) return null

    const sql = getDB()
    const [user] = await sql`
        SELECT id, discord_id, discord_username, discord_avatar, role, linked_player_id
        FROM users WHERE id = ${payload.userId}
    `
    if (!user) return null

    // Legacy admin check
    if (user.role === 'admin') return user

    // RBAC check: user has any role assignment
    const [hasRole] = await sql`
        SELECT 1 FROM user_roles WHERE user_id = ${user.id} LIMIT 1
    `
    if (hasRole) return user

    return null
}

/**
 * Verify JWT and return the user row (any role).
 * Returns the full user row or null.
 */
export async function requireAuth(event) {
    const payload = await verifyAuth(event)
    if (!payload) return null

    const sql = getDB()
    const [user] = await sql`
        SELECT id, discord_id, discord_username, discord_avatar, role, linked_player_id
        FROM users WHERE id = ${payload.userId}
    `
    return user || null
}

/**
 * Verify JWT and check that the user has a specific permission,
 * optionally scoped to a league.
 */
export async function requirePermission(event, permissionKey, leagueId = null) {
    const payload = await verifyAuth(event)
    if (!payload) return null

    const sql = getDB()
    const [user] = await sql`
        SELECT id, discord_id, discord_username, discord_avatar, role, linked_player_id
        FROM users WHERE id = ${payload.userId}
    `
    if (!user) return null

    const [hasPermission] = await sql`
        SELECT 1 FROM user_roles ur
        JOIN role_permissions rp ON rp.role_id = ur.role_id
        WHERE ur.user_id = ${user.id}
          AND rp.permission_key = ${permissionKey}
          AND (ur.league_id IS NULL ${leagueId ? sql`OR ur.league_id = ${leagueId}` : sql``})
        LIMIT 1
    `

    if (!hasPermission) return null
    return user
}

/**
 * Try multiple permission keys in order. Returns { user, permissionKey }
 * for the first match, or null if none matched.
 */
export async function requireAnyPermission(event, permissionKeys, leagueId = null) {
    const payload = await verifyAuth(event)
    if (!payload) return null

    const sql = getDB()
    const [user] = await sql`
        SELECT id, discord_id, discord_username, discord_avatar, role, linked_player_id
        FROM users WHERE id = ${payload.userId}
    `
    if (!user) return null

    for (const permissionKey of permissionKeys) {
        const [has] = await sql`
            SELECT 1 FROM user_roles ur
            JOIN role_permissions rp ON rp.role_id = ur.role_id
            WHERE ur.user_id = ${user.id}
              AND rp.permission_key = ${permissionKey}
              AND (ur.league_id IS NULL ${leagueId ? sql`OR ur.league_id = ${leagueId}` : sql``})
            LIMIT 1
        `
        if (has) return { user, permissionKey }
    }

    return null
}

/**
 * Get all effective permissions for a user.
 * Returns { global: [...keys], byLeague: { leagueId: [...keys] } }
 */
export async function getUserPermissions(userId) {
    const sql = getDB()
    const rows = await sql`
        SELECT DISTINCT rp.permission_key, ur.league_id
        FROM user_roles ur
        JOIN role_permissions rp ON rp.role_id = ur.role_id
        WHERE ur.user_id = ${userId}
    `

    const global = []
    const byLeague = {}

    for (const row of rows) {
        if (row.league_id === null) {
            if (!global.includes(row.permission_key)) {
                global.push(row.permission_key)
            }
        } else {
            const lid = String(row.league_id)
            if (!byLeague[lid]) byLeague[lid] = []
            if (!byLeague[lid].includes(row.permission_key)) {
                byLeague[lid].push(row.permission_key)
            }
        }
    }

    return { global, byLeague }
}

/**
 * Resolve league ID from a season ID.
 */
export async function getLeagueIdFromSeason(seasonId) {
    if (!seasonId) return null
    const sql = getDB()
    const [row] = await sql`SELECT league_id FROM seasons WHERE id = ${seasonId} LIMIT 1`
    return row?.league_id || null
}

/**
 * Resolve league ID from a division ID.
 */
export async function getLeagueIdFromDivision(divisionId) {
    if (!divisionId) return null
    const sql = getDB()
    const [row] = await sql`SELECT league_id FROM divisions WHERE id = ${divisionId} LIMIT 1`
    return row?.league_id || null
}

/**
 * Resolve league ID from a team ID (team → season → league).
 */
export async function getLeagueIdFromTeam(teamId) {
    if (!teamId) return null
    const sql = getDB()
    const [row] = await sql`
        SELECT s.league_id FROM teams t
        JOIN seasons s ON t.season_id = s.id
        WHERE t.id = ${teamId} LIMIT 1
    `
    return row?.league_id || null
}

/**
 * Resolve league ID from a match ID (match → season → league).
 */
export async function getLeagueIdFromMatch(matchId) {
    if (!matchId) return null
    const sql = getDB()
    const [row] = await sql`
        SELECT s.league_id FROM matches m
        JOIN seasons s ON m.season_id = s.id
        WHERE m.id = ${matchId} LIMIT 1
    `
    return row?.league_id || null
}

/**
 * Resolve league ID from a league_player ID (league_player → season → league).
 */
export async function getLeagueIdFromLeaguePlayer(leaguePlayerId) {
    if (!leaguePlayerId) return null
    const sql = getDB()
    const [row] = await sql`
        SELECT s.league_id FROM league_players lp
        JOIN seasons s ON lp.season_id = s.id
        WHERE lp.id = ${leaguePlayerId} LIMIT 1
    `
    return row?.league_id || null
}

/**
 * Sign a JWT for a user record.
 */
export async function signToken(user) {
    return await new SignJWT({ userId: user.id, discordId: user.discord_id, role: user.role })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('7d')
        .sign(getSecret())
}

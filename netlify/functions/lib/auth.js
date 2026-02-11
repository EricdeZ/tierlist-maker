// netlify/functions/lib/auth.js
import jwt from 'jsonwebtoken'
import { getDB } from './db.js'

const JWT_SECRET = process.env.JWT_SECRET

/**
 * Verify a JWT from the Authorization header.
 * Returns decoded payload { userId, discordId, role } or null.
 */
export function verifyAuth(event) {
    const authHeader = event.headers.authorization || event.headers.Authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null

    try {
        const token = authHeader.slice(7)
        return jwt.verify(token, JWT_SECRET)
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
    const payload = verifyAuth(event)
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
    const payload = verifyAuth(event)
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
 *
 * @param {Object} event - Netlify function event
 * @param {string} permissionKey - e.g. 'match_report', 'roster_manage'
 * @param {number|null} leagueId - If provided, also accepts league-scoped permissions.
 *                                  If null, only global permissions match.
 * @returns {Object|null} - User row if authorized, null otherwise
 */
export async function requirePermission(event, permissionKey, leagueId = null) {
    const payload = verifyAuth(event)
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
 * Useful for permission checks on league-scoped endpoints.
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
export function signToken(user) {
    return jwt.sign(
        { userId: user.id, discordId: user.discord_id, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
    )
}

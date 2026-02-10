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
    if (!user || user.role !== 'admin') return null
    return user
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
 * Sign a JWT for a user record.
 */
export function signToken(user) {
    return jwt.sign(
        { userId: user.id, discordId: user.discord_id, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
    )
}

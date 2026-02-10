/* global process */
import { getDB, adminHeaders, headers } from './lib/db.js'
import { requireAuth, requireAdmin } from './lib/auth.js'

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: adminHeaders, body: '' }
    }

    const sql = getDB()

    try {
        // ─── GET: List claims ───
        if (event.httpMethod === 'GET') {
            const user = await requireAuth(event)
            if (!user) {
                return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
            }

            if (user.role === 'admin') {
                // Admin sees all pending claims with user + player info
                const claims = await sql`
                    SELECT
                        cr.id, cr.user_id, cr.player_id, cr.status,
                        cr.message, cr.admin_note, cr.resolved_by,
                        cr.created_at, cr.resolved_at,
                        u.discord_username, u.discord_id as user_discord_id, u.discord_avatar,
                        p.name as player_name, p.slug as player_slug
                    FROM claim_requests cr
                    JOIN users u ON cr.user_id = u.id
                    JOIN players p ON cr.player_id = p.id
                    WHERE cr.status = 'pending'
                    ORDER BY cr.created_at ASC
                `
                return { statusCode: 200, headers, body: JSON.stringify({ claims }) }
            }

            // Regular user sees their own claims (all statuses)
            const claims = await sql`
                SELECT
                    cr.id, cr.user_id, cr.player_id, cr.status,
                    cr.message, cr.admin_note, cr.resolved_by,
                    cr.created_at, cr.resolved_at,
                    u.discord_username, u.discord_id as user_discord_id,
                    p.name as player_name, p.slug as player_slug
                FROM claim_requests cr
                JOIN users u ON cr.user_id = u.id
                JOIN players p ON cr.player_id = p.id
                WHERE cr.user_id = ${user.id}
                ORDER BY cr.created_at DESC
            `
            return { statusCode: 200, headers, body: JSON.stringify({ claims }) }
        }

        // ─── POST: Actions ───
        if (event.httpMethod !== 'POST') {
            return { statusCode: 405, headers: adminHeaders, body: JSON.stringify({ error: 'Method not allowed' }) }
        }
        if (!event.body) {
            return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'Request body required' }) }
        }

        let body
        try { body = JSON.parse(event.body) } catch {
            return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'Invalid JSON' }) }
        }

        switch (body.action) {
            case 'submit-claim':
                return await submitClaim(sql, event, body)
            case 'resolve-claim':
                return await resolveClaim(sql, event, body)
            default:
                return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: `Unknown action: ${body.action}` }) }
        }
    } catch (error) {
        console.error('Claim manage error:', error)
        return {
            statusCode: 500,
            headers: adminHeaders,
            body: JSON.stringify({ error: error.message || 'Internal server error' }),
        }
    }
}

/**
 * Submit a claim for a player profile.
 * Requires authentication (any user).
 */
async function submitClaim(sql, event, { player_id, message }) {
    const user = await requireAuth(event)
    if (!user) {
        return { statusCode: 401, headers: adminHeaders, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    if (!player_id) {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'player_id required' }) }
    }

    // User already has a linked player
    if (user.linked_player_id) {
        return {
            statusCode: 409,
            headers: adminHeaders,
            body: JSON.stringify({ error: 'You are already linked to a player profile' }),
        }
    }

    // Check if another user is already linked to this player
    const [alreadyLinked] = await sql`
        SELECT id, discord_username FROM users
        WHERE linked_player_id = ${player_id} AND id != ${user.id}
        LIMIT 1
    `
    if (alreadyLinked) {
        return {
            statusCode: 409,
            headers: adminHeaders,
            body: JSON.stringify({ error: 'Another user is already linked to this player' }),
        }
    }

    // Check if user already has a pending claim for this player
    const [existingClaim] = await sql`
        SELECT id FROM claim_requests
        WHERE user_id = ${user.id} AND player_id = ${player_id} AND status = 'pending'
        LIMIT 1
    `
    if (existingClaim) {
        return {
            statusCode: 409,
            headers: adminHeaders,
            body: JSON.stringify({ error: 'You already have a pending claim for this player' }),
        }
    }

    const [claim] = await sql`
        INSERT INTO claim_requests (user_id, player_id, status, message)
        VALUES (${user.id}, ${player_id}, 'pending', ${message || null})
        RETURNING id, user_id, player_id, status, message, created_at
    `

    return {
        statusCode: 200,
        headers: adminHeaders,
        body: JSON.stringify({ success: true, claim }),
    }
}

/**
 * Approve or deny a claim request.
 * Requires admin.
 */
async function resolveClaim(sql, event, { claim_id, status, admin_note }) {
    const admin = await requireAdmin(event)
    if (!admin) {
        return { statusCode: 401, headers: adminHeaders, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    if (!claim_id) {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'claim_id required' }) }
    }
    if (!status || !['approved', 'denied'].includes(status)) {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'status must be "approved" or "denied"' }) }
    }

    // Fetch the claim
    const [claim] = await sql`
        SELECT id, user_id, player_id, status as current_status
        FROM claim_requests WHERE id = ${claim_id}
    `
    if (!claim) {
        return { statusCode: 404, headers: adminHeaders, body: JSON.stringify({ error: 'Claim not found' }) }
    }
    if (claim.current_status !== 'pending') {
        return { statusCode: 409, headers: adminHeaders, body: JSON.stringify({ error: `Claim is already ${claim.current_status}` }) }
    }

    // Update the claim
    const [updated] = await sql`
        UPDATE claim_requests
        SET status = ${status}, resolved_by = ${admin.id}, resolved_at = NOW(),
            admin_note = ${admin_note || null}
        WHERE id = ${claim_id}
        RETURNING id, user_id, player_id, status, admin_note, resolved_by, resolved_at
    `

    // If approved, link user to the player and backfill discord_id
    if (status === 'approved') {
        await sql`
            UPDATE users SET linked_player_id = ${claim.player_id}, updated_at = NOW()
            WHERE id = ${claim.user_id}
        `

        // Get the user's discord_id to backfill on the player record
        const [claimUser] = await sql`
            SELECT discord_id FROM users WHERE id = ${claim.user_id}
        `
        if (claimUser) {
            await sql`
                UPDATE players SET discord_id = ${claimUser.discord_id}, updated_at = NOW()
                WHERE id = ${claim.player_id}
            `
        }
    }

    return {
        statusCode: 200,
        headers: adminHeaders,
        body: JSON.stringify({ success: true, claim: updated }),
    }
}

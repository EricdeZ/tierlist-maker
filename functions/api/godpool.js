import { adapt } from '../lib/adapter.js'
import { getDB, headers, getHeaders, handleCors } from '../lib/db.js'
import { requireAuth, verifyAuth } from '../lib/auth.js'

const VALID_TIERS = ['S', 'A', 'B', 'C', 'D', 'F']
const VALID_VISIBILITY = ['private', 'team', 'public']

const handler = async (event) => {
    const cors = handleCors(event)
    if (cors) return cors

    const sql = getDB()

    try {
        if (event.httpMethod === 'GET') {
            return await getGodpool(sql, event)
        }

        if (event.httpMethod === 'POST') {
            const user = await requireAuth(event)
            if (!user) {
                return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
            }

            const body = event.body ? JSON.parse(event.body) : {}

            switch (body.action) {
                case 'save':
                    return await saveGodpool(sql, user, body)
                case 'delete':
                    return await deleteGodpool(sql, user)
                default:
                    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${body.action}` }) }
            }
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    } catch (error) {
        console.error('godpool error:', error)
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) }
    }
}


// ═══════════════════════════════════════════════════
// GET: Fetch a player's godpool tier list (visibility-aware)
// ═══════════════════════════════════════════════════
async function getGodpool(sql, event) {
    const { playerSlug } = event.queryStringParameters || {}
    if (!playerSlug) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'playerSlug is required' }) }
    }

    // Find user by player slug
    const [owner] = await sql`
        SELECT u.id AS user_id, p.id AS player_id
        FROM players p
        JOIN users u ON u.linked_player_id = p.id
        WHERE p.slug = ${playerSlug}
    `

    if (!owner) {
        return {
            statusCode: 200,
            headers: getHeaders(event),
            body: JSON.stringify({ tierlist: null }),
        }
    }

    // Fetch tier list
    const [tierlist] = await sql`
        SELECT tiers, visibility, updated_at
        FROM godpool_tierlists
        WHERE user_id = ${owner.user_id}
    `

    if (!tierlist) {
        return {
            statusCode: 200,
            headers: getHeaders(event),
            body: JSON.stringify({ tierlist: null }),
        }
    }

    // Check visibility
    const viewer = await verifyAuth(event)
    const viewerUserId = viewer?.userId || null

    if (tierlist.visibility === 'public') {
        // Everyone can see
    } else if (tierlist.visibility === 'private') {
        if (viewerUserId !== owner.user_id) {
            return {
                statusCode: 200,
                headers: getHeaders(event),
                body: JSON.stringify({ tierlist: null }),
            }
        }
    } else if (tierlist.visibility === 'team') {
        // Owner can always see their own
        if (viewerUserId !== owner.user_id) {
            if (!viewerUserId) {
                return {
                    statusCode: 200,
                    headers: getHeaders(event),
                    body: JSON.stringify({ tierlist: null }),
                }
            }

            // Check if viewer shares a team with the owner in any active season
            // AND the owner's role is NOT 'Sub' (case-insensitive)
            const [viewerUser] = await sql`
                SELECT linked_player_id FROM users WHERE id = ${viewerUserId}
            `

            if (!viewerUser?.linked_player_id) {
                return {
                    statusCode: 200,
                    headers: getHeaders(event),
                    body: JSON.stringify({ tierlist: null }),
                }
            }

            const [shared] = await sql`
                SELECT 1
                FROM league_players owner_lp
                JOIN seasons s ON s.id = owner_lp.season_id AND s.is_active = true
                JOIN league_players viewer_lp
                    ON viewer_lp.team_id = owner_lp.team_id
                    AND viewer_lp.season_id = owner_lp.season_id
                    AND viewer_lp.player_id = ${viewerUser.linked_player_id}
                WHERE owner_lp.player_id = ${owner.player_id}
                  AND owner_lp.roster_status != 'sub'
                LIMIT 1
            `

            if (!shared) {
                return {
                    statusCode: 200,
                    headers: getHeaders(event),
                    body: JSON.stringify({ tierlist: null }),
                }
            }
        }
    }

    return {
        statusCode: 200,
        headers: getHeaders(event),
        body: JSON.stringify({
            tierlist: {
                tiers: tierlist.tiers,
                visibility: tierlist.visibility,
                updatedAt: tierlist.updated_at,
            },
        }),
    }
}


// ═══════════════════════════════════════════════════
// POST: Save/upsert godpool tier list
// ═══════════════════════════════════════════════════
async function saveGodpool(sql, user, body) {
    const { tiers, visibility } = body

    if (!tiers || typeof tiers !== 'object') {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'tiers is required' }) }
    }

    // Validate visibility
    if (!VALID_VISIBILITY.includes(visibility)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: `visibility must be one of: ${VALID_VISIBILITY.join(', ')}` }) }
    }

    // Validate tiers shape: each key must be a valid tier with an array of integers
    const cleanTiers = {}
    for (const tier of VALID_TIERS) {
        if (Array.isArray(tiers[tier])) {
            cleanTiers[tier] = tiers[tier].filter(id => typeof id === 'number' && Number.isInteger(id))
        } else {
            cleanTiers[tier] = []
        }
    }

    // Must have at least one god placed
    const totalPlaced = VALID_TIERS.reduce((sum, t) => sum + cleanTiers[t].length, 0)
    if (totalPlaced === 0) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Tier list must have at least one god' }) }
    }

    await sql`
        INSERT INTO godpool_tierlists (user_id, tiers, visibility, updated_at)
        VALUES (${user.id}, ${JSON.stringify(cleanTiers)}, ${visibility}, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
            tiers = ${JSON.stringify(cleanTiers)},
            visibility = ${visibility},
            updated_at = NOW()
    `

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true }),
    }
}


// ═══════════════════════════════════════════════════
// POST: Delete godpool tier list
// ═══════════════════════════════════════════════════
async function deleteGodpool(sql, user) {
    await sql`DELETE FROM godpool_tierlists WHERE user_id = ${user.id}`

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true }),
    }
}

export const onRequest = adapt(handler)

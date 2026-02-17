import { adapt } from '../lib/adapter.js'
import { getDB, headers, adminHeaders, getHeaders, handleCors } from '../lib/db.js'
import { requireAuth, requirePermission } from '../lib/auth.js'
import { grantPassion } from '../lib/passion.js'
import { logAudit } from '../lib/audit.js'

const SESSION_DURATION_MS = 60 * 60 * 1000 // 1 hour
const HEARTBEAT_MIN_INTERVAL_S = 50 // minimum seconds between heartbeats
const HEARTBEAT_CREDIT_S = 60 // seconds credited per heartbeat
const BADGE_COST = 4000

const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        const cors = handleCors(event)
        if (cors) return cors
        return { statusCode: 204, headers: adminHeaders, body: '' }
    }

    const { action } = event.queryStringParameters || {}
    const sql = getDB()

    try {
        if (event.httpMethod === 'GET') {
            switch (action) {
                case 'current':
                    return await getCurrent(sql, event)
                case 'queue':
                    return await getQueue(sql, event)
                case 'my-status': {
                    const user = await requireAuth(event)
                    if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
                    return await getMyStatus(sql, user)
                }
                default:
                    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
            }
        }

        if (event.httpMethod === 'POST') {
            const body = event.body ? JSON.parse(event.body) : {}

            // Heartbeat is public (no auth) for simplicity — validated by streamer_id
            if (action === 'heartbeat') {
                return await heartbeat(sql, body)
            }

            // Admin actions
            if (action?.startsWith('admin-')) {
                const admin = await requirePermission(event, 'league_manage')
                if (!admin) {
                    return { statusCode: 401, headers: adminHeaders, body: JSON.stringify({ error: 'Unauthorized' }) }
                }
                switch (action) {
                    case 'admin-swap':
                        return await adminSwap(sql, admin, body)
                    case 'admin-edit':
                        return await adminEdit(sql, admin, body)
                    case 'admin-add':
                        return await adminAdd(sql, admin, body)
                    case 'admin-remove':
                        return await adminRemove(sql, admin, body)
                    default:
                        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: `Unknown admin action: ${action}` }) }
                }
            }

            // User actions require auth
            const user = await requireAuth(event)
            if (!user) {
                return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
            }

            switch (action) {
                case 'register':
                    return await register(sql, user, body)
                case 'update-channel':
                    return await updateChannel(sql, user, body)
                case 'deactivate':
                    return await deactivate(sql, user)
                case 'reactivate':
                    return await reactivate(sql, user)
                default:
                    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
            }
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    } catch (error) {
        console.error('featured-streamer error:', error)
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message || 'Internal server error' }) }
    }
}


// ═══════════════════════════════════════════════════
// Selection algorithm helpers
// ═══════════════════════════════════════════════════

async function finalizeExpiredSession(sql) {
    // Find current streamer whose session has expired
    const [current] = await sql`
        SELECT id, current_session_start
        FROM featured_streamers
        WHERE current_session_start IS NOT NULL
    `
    if (!current) return null

    const elapsed = Date.now() - new Date(current.current_session_start).getTime()
    if (elapsed < SESSION_DURATION_MS) return current

    // Session expired — clear it (featured time already tracked via heartbeats)
    await sql`
        UPDATE featured_streamers
        SET current_session_start = NULL
        WHERE id = ${current.id}
    `
    return null
}

async function pickNextStreamer(sql) {
    // Fairness: lowest ratio of featured_seconds / time_since_purchase
    const [next] = await sql`
        SELECT id, user_id, twitch_channel, total_featured_seconds, created_at
        FROM featured_streamers
        WHERE is_active = true
        ORDER BY
            total_featured_seconds::float / GREATEST(EXTRACT(EPOCH FROM (NOW() - created_at)), 3600) ASC,
            created_at ASC
        LIMIT 1
    `
    if (!next) return null

    await sql`
        UPDATE featured_streamers
        SET current_session_start = NOW()
        WHERE id = ${next.id}
    `
    return { ...next, current_session_start: new Date() }
}


// ═══════════════════════════════════════════════════
// GET: Current featured streamer
// ═══════════════════════════════════════════════════

async function getCurrent(sql, event) {
    // Check for active session
    let current = await finalizeExpiredSession(sql)

    if (current) {
        // Session still active — fetch full row
        const [row] = await sql`
            SELECT fs.id, fs.user_id, fs.twitch_channel, fs.current_session_start,
                   u.discord_username
            FROM featured_streamers fs
            JOIN users u ON u.id = fs.user_id
            WHERE fs.id = ${current.id}
        `
        if (row) {
            const sessionStart = new Date(row.current_session_start)
            const remaining = Math.max(0, SESSION_DURATION_MS - (Date.now() - sessionStart.getTime()))

            return {
                statusCode: 200,
                headers: { ...getHeaders(event), 'Cache-Control': 'public, max-age=60' },
                body: JSON.stringify({
                    active: true,
                    streamerId: row.id,
                    userId: row.user_id,
                    channel: row.twitch_channel,
                    displayName: row.discord_username,
                    sessionStart: row.current_session_start,
                    sessionRemaining: Math.round(remaining / 1000),
                }),
            }
        }
    }

    // No active session — pick next
    const next = await pickNextStreamer(sql)
    if (!next) {
        return {
            statusCode: 200,
            headers: { ...getHeaders(event), 'Cache-Control': 'public, max-age=60' },
            body: JSON.stringify({ active: false }),
        }
    }

    const [user] = await sql`
        SELECT discord_username FROM users WHERE id = ${next.user_id}
    `

    return {
        statusCode: 200,
        headers: { ...getHeaders(event), 'Cache-Control': 'public, max-age=60' },
        body: JSON.stringify({
            active: true,
            streamerId: next.id,
            userId: next.user_id,
            channel: next.twitch_channel,
            displayName: user?.discord_username || 'Unknown',
            sessionStart: next.current_session_start,
            sessionRemaining: Math.round(SESSION_DURATION_MS / 1000),
        }),
    }
}


// ═══════════════════════════════════════════════════
// GET: Queue
// ═══════════════════════════════════════════════════

async function getQueue(sql, event) {
    const rows = await sql`
        SELECT fs.id, fs.user_id, fs.twitch_channel, fs.total_featured_seconds,
               fs.is_active, fs.current_session_start, fs.created_at,
               u.discord_username
        FROM featured_streamers fs
        JOIN users u ON u.id = fs.user_id
        WHERE fs.is_active = true
        ORDER BY
            fs.total_featured_seconds::float / GREATEST(EXTRACT(EPOCH FROM (NOW() - fs.created_at)), 3600) ASC,
            fs.created_at ASC
    `

    return {
        statusCode: 200,
        headers: getHeaders(event),
        body: JSON.stringify({
            queue: rows.map((r, i) => ({
                position: i + 1,
                streamerId: r.id,
                userId: r.user_id,
                channel: r.twitch_channel,
                displayName: r.discord_username,
                totalFeaturedSeconds: r.total_featured_seconds,
                isCurrent: !!r.current_session_start,
                createdAt: r.created_at,
            })),
        }),
    }
}


// ═══════════════════════════════════════════════════
// GET: My status (does the current user own the badge?)
// ═══════════════════════════════════════════════════

async function getMyStatus(sql, user) {
    const [row] = await sql`
        SELECT id, twitch_channel, total_featured_seconds, is_active, created_at
        FROM featured_streamers
        WHERE user_id = ${user.id}
    `

    if (!row) {
        return { statusCode: 200, headers, body: JSON.stringify({ owned: false }) }
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            owned: true,
            streamerId: row.id,
            channel: row.twitch_channel,
            totalFeaturedSeconds: row.total_featured_seconds,
            isActive: row.is_active,
            createdAt: row.created_at,
        }),
    }
}


// ═══════════════════════════════════════════════════
// POST: Heartbeat (live time tracking)
// ═══════════════════════════════════════════════════

async function heartbeat(sql, body) {
    const { streamer_id } = body
    if (!streamer_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'streamer_id required' }) }
    }

    // Verify this is the currently featured streamer
    const [row] = await sql`
        SELECT id, last_heartbeat, current_session_start
        FROM featured_streamers
        WHERE id = ${streamer_id}
          AND current_session_start IS NOT NULL
    `

    if (!row) {
        return { statusCode: 200, headers, body: JSON.stringify({ accepted: false, reason: 'not_current' }) }
    }

    // Rate limit: ignore if last heartbeat was < 50s ago
    if (row.last_heartbeat) {
        const elapsed = (Date.now() - new Date(row.last_heartbeat).getTime()) / 1000
        if (elapsed < HEARTBEAT_MIN_INTERVAL_S) {
            return { statusCode: 200, headers, body: JSON.stringify({ accepted: false, reason: 'too_soon' }) }
        }
    }

    await sql`
        UPDATE featured_streamers
        SET total_featured_seconds = total_featured_seconds + ${HEARTBEAT_CREDIT_S},
            last_heartbeat = NOW()
        WHERE id = ${streamer_id}
    `

    return { statusCode: 200, headers, body: JSON.stringify({ accepted: true }) }
}


// ═══════════════════════════════════════════════════
// POST: Register (buy badge)
// ═══════════════════════════════════════════════════

async function register(sql, user, body) {
    const { twitch_channel } = body
    if (!twitch_channel?.trim()) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'twitch_channel is required' }) }
    }

    // Check if already registered
    const [existing] = await sql`
        SELECT id FROM featured_streamers WHERE user_id = ${user.id}
    `
    if (existing) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Already registered as a Featured Streamer' }) }
    }

    // Check balance
    const [balance] = await sql`
        SELECT balance FROM passion_balances WHERE user_id = ${user.id}
    `
    if (!balance || balance.balance < BADGE_COST) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: `Insufficient Passion. Need ${BADGE_COST}, have ${balance?.balance || 0}` }) }
    }

    // Deduct Passion
    await grantPassion(sql, user.id, 'featured_streamer', -BADGE_COST, 'Featured Streamer badge purchase')

    // Insert into queue
    await sql`
        INSERT INTO featured_streamers (user_id, twitch_channel)
        VALUES (${user.id}, ${twitch_channel.trim()})
    `

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'Featured Streamer badge purchased!' }),
    }
}


// ═══════════════════════════════════════════════════
// POST: Update channel name (free)
// ═══════════════════════════════════════════════════

async function updateChannel(sql, user, body) {
    const { twitch_channel } = body
    if (!twitch_channel?.trim()) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'twitch_channel is required' }) }
    }

    const [row] = await sql`
        UPDATE featured_streamers
        SET twitch_channel = ${twitch_channel.trim()}
        WHERE user_id = ${user.id}
        RETURNING id
    `

    if (!row) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not registered as a Featured Streamer' }) }
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}


// ═══════════════════════════════════════════════════
// POST: Deactivate / Reactivate
// ═══════════════════════════════════════════════════

async function deactivate(sql, user) {
    await sql`
        UPDATE featured_streamers
        SET is_active = false, current_session_start = NULL
        WHERE user_id = ${user.id}
    `
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}

async function reactivate(sql, user) {
    const [row] = await sql`
        UPDATE featured_streamers
        SET is_active = true
        WHERE user_id = ${user.id}
        RETURNING id
    `
    if (!row) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not registered as a Featured Streamer' }) }
    }
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}


// ═══════════════════════════════════════════════════
// Admin actions
// ═══════════════════════════════════════════════════

async function adminSwap(sql, admin, body) {
    const { streamer_id } = body
    if (!streamer_id) {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'streamer_id required' }) }
    }

    // Clear any current session
    await sql`
        UPDATE featured_streamers
        SET current_session_start = NULL
        WHERE current_session_start IS NOT NULL
    `

    // Set the chosen streamer as current
    const [row] = await sql`
        UPDATE featured_streamers
        SET current_session_start = NOW()
        WHERE id = ${streamer_id} AND is_active = true
        RETURNING id, twitch_channel
    `

    if (!row) {
        return { statusCode: 404, headers: adminHeaders, body: JSON.stringify({ error: 'Streamer not found or inactive' }) }
    }

    logAudit(sql, admin, {
        action: 'featured-streamer-swap',
        endpoint: 'featured-streamer',
        targetType: 'featured_streamer',
        targetId: streamer_id,
        details: { channel: row.twitch_channel },
    })

    return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ success: true, channel: row.twitch_channel }) }
}

async function adminEdit(sql, admin, body) {
    const { streamer_id, twitch_channel, is_active, total_featured_seconds } = body
    if (!streamer_id) {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'streamer_id required' }) }
    }

    const updates = []
    const values = {}

    if (twitch_channel !== undefined) {
        updates.push('twitch_channel')
        values.twitch_channel = twitch_channel.trim()
    }
    if (is_active !== undefined) {
        updates.push('is_active')
        values.is_active = !!is_active
    }
    if (total_featured_seconds !== undefined) {
        updates.push('total_featured_seconds')
        values.total_featured_seconds = Math.max(0, parseInt(total_featured_seconds) || 0)
    }

    if (updates.length === 0) {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'Nothing to update' }) }
    }

    // Build update dynamically
    let row
    if (values.twitch_channel !== undefined && values.is_active !== undefined && values.total_featured_seconds !== undefined) {
        [row] = await sql`
            UPDATE featured_streamers SET twitch_channel = ${values.twitch_channel}, is_active = ${values.is_active}, total_featured_seconds = ${values.total_featured_seconds}
            WHERE id = ${streamer_id} RETURNING id
        `
    } else if (values.twitch_channel !== undefined && values.is_active !== undefined) {
        [row] = await sql`
            UPDATE featured_streamers SET twitch_channel = ${values.twitch_channel}, is_active = ${values.is_active}
            WHERE id = ${streamer_id} RETURNING id
        `
    } else if (values.twitch_channel !== undefined && values.total_featured_seconds !== undefined) {
        [row] = await sql`
            UPDATE featured_streamers SET twitch_channel = ${values.twitch_channel}, total_featured_seconds = ${values.total_featured_seconds}
            WHERE id = ${streamer_id} RETURNING id
        `
    } else if (values.is_active !== undefined && values.total_featured_seconds !== undefined) {
        [row] = await sql`
            UPDATE featured_streamers SET is_active = ${values.is_active}, total_featured_seconds = ${values.total_featured_seconds}
            WHERE id = ${streamer_id} RETURNING id
        `
    } else if (values.twitch_channel !== undefined) {
        [row] = await sql`
            UPDATE featured_streamers SET twitch_channel = ${values.twitch_channel}
            WHERE id = ${streamer_id} RETURNING id
        `
    } else if (values.is_active !== undefined) {
        [row] = await sql`
            UPDATE featured_streamers SET is_active = ${values.is_active}
            WHERE id = ${streamer_id} RETURNING id
        `
    } else {
        [row] = await sql`
            UPDATE featured_streamers SET total_featured_seconds = ${values.total_featured_seconds}
            WHERE id = ${streamer_id} RETURNING id
        `
    }

    if (!row) {
        return { statusCode: 404, headers: adminHeaders, body: JSON.stringify({ error: 'Streamer not found' }) }
    }

    logAudit(sql, admin, {
        action: 'featured-streamer-edit',
        endpoint: 'featured-streamer',
        targetType: 'featured_streamer',
        targetId: streamer_id,
        details: values,
    })

    return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ success: true }) }
}

async function adminAdd(sql, admin, body) {
    const { user_id, twitch_channel } = body
    if (!user_id || !twitch_channel?.trim()) {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'user_id and twitch_channel required' }) }
    }

    try {
        await sql`
            INSERT INTO featured_streamers (user_id, twitch_channel)
            VALUES (${user_id}, ${twitch_channel.trim()})
        `
    } catch (err) {
        if (err.message?.includes('unique') || err.message?.includes('duplicate')) {
            return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'User already registered' }) }
        }
        throw err
    }

    logAudit(sql, admin, {
        action: 'featured-streamer-add',
        endpoint: 'featured-streamer',
        targetType: 'featured_streamer',
        details: { user_id, twitch_channel: twitch_channel.trim() },
    })

    return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ success: true }) }
}

async function adminRemove(sql, admin, body) {
    const { streamer_id } = body
    if (!streamer_id) {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'streamer_id required' }) }
    }

    const [row] = await sql`
        DELETE FROM featured_streamers WHERE id = ${streamer_id} RETURNING id, twitch_channel, user_id
    `

    if (!row) {
        return { statusCode: 404, headers: adminHeaders, body: JSON.stringify({ error: 'Streamer not found' }) }
    }

    logAudit(sql, admin, {
        action: 'featured-streamer-remove',
        endpoint: 'featured-streamer',
        targetType: 'featured_streamer',
        targetId: streamer_id,
        details: { channel: row.twitch_channel, user_id: row.user_id },
    })

    return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ success: true }) }
}

export const onRequest = adapt(handler)

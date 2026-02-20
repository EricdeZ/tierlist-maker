import { adapt } from '../lib/adapter.js'
import { getDB, headers } from '../lib/db.js'
import { requireAuth } from '../lib/auth.js'
import { getRank, formatRank } from '../lib/passion.js'

const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const { action } = event.queryStringParameters || {}
    const sql = getDB()

    try {
        // ─── Public: leaderboard ───
        if (event.httpMethod === 'GET' && action === 'leaderboard') {
            return await getLeaderboard(sql)
        }

        // All other actions require auth
        const user = await requireAuth(event)
        if (!user) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
        }

        if (event.httpMethod === 'GET') {
            switch (action) {
                case 'my-stats':
                    return await getMyStats(sql, user)
                default:
                    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
            }
        }

        if (event.httpMethod === 'POST') {
            const body = event.body ? JSON.parse(event.body) : {}
            switch (action) {
                case 'start':
                    return await startSession(sql, user)
                case 'heartbeat':
                    return await handleHeartbeat(sql, user, body)
                case 'submit':
                    return await submitScore(sql, user, body)
                default:
                    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
            }
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    } catch (error) {
        console.error('smiterunner error:', error)
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) }
    }
}


// ═══════════════════════════════════════════════════
// POST: Start a new game session
// ═══════════════════════════════════════════════════
async function startSession(sql, user) {
    const sessionToken = crypto.randomUUID()

    const [session] = await sql`
        INSERT INTO smiterunner_sessions (user_id, session_token)
        VALUES (${user.id}, ${sessionToken})
        RETURNING session_token, started_at
    `

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            sessionToken: session.session_token,
            startedAt: session.started_at,
        }),
    }
}


// ═══════════════════════════════════════════════════
// POST: Record a heartbeat checkpoint during gameplay
// ═══════════════════════════════════════════════════
async function handleHeartbeat(sql, user, body) {
    const { sessionToken, ticks } = body
    if (!sessionToken || typeof ticks !== 'number' || ticks < 0) {
        return { statusCode: 200, headers, body: JSON.stringify({ error: 'invalid_heartbeat' }) }
    }

    // Verify session belongs to user and hasn't been submitted yet
    const [session] = await sql`
        SELECT id, submitted_at FROM smiterunner_sessions
        WHERE session_token = ${sessionToken} AND user_id = ${user.id}
    `
    if (!session) {
        return { statusCode: 200, headers, body: JSON.stringify({ error: 'invalid_session' }) }
    }
    if (session.submitted_at) {
        return { statusCode: 200, headers, body: JSON.stringify({ error: 'session_already_submitted' }) }
    }

    // Append heartbeat to JSONB array
    const checkpoint = { ticks, serverTime: new Date().toISOString() }
    await sql`
        UPDATE smiterunner_sessions
        SET heartbeats = heartbeats || ${JSON.stringify(checkpoint)}::jsonb
        WHERE id = ${session.id}
    `

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) }
}


// ═══════════════════════════════════════════════════
// POST: Submit final score with anti-cheat validation
// ═══════════════════════════════════════════════════
async function submitScore(sql, user, body) {
    const { sessionToken, score, ticks } = body

    if (!sessionToken || typeof score !== 'number' || typeof ticks !== 'number') {
        return { statusCode: 200, headers, body: JSON.stringify({ error: 'invalid_submission' }) }
    }

    // 1. Session exists and belongs to user
    const [session] = await sql`
        SELECT id, user_id, started_at, submitted_at, heartbeats
        FROM smiterunner_sessions
        WHERE session_token = ${sessionToken} AND user_id = ${user.id}
    `
    if (!session) {
        return { statusCode: 200, headers, body: JSON.stringify({ error: 'invalid_session' }) }
    }

    // 2. Not already submitted
    if (session.submitted_at) {
        return { statusCode: 200, headers, body: JSON.stringify({ error: 'session_already_submitted' }) }
    }

    // 3. Server recomputes score from ticks
    const expectedScore = Math.floor(ticks / 5)
    if (score !== expectedScore) {
        await markInvalid(sql, session.id)
        return { statusCode: 200, headers, body: JSON.stringify({ error: 'score_mismatch' }) }
    }

    // 4. Sanity cap
    if (score >= 100000 || ticks < 0) {
        await markInvalid(sql, session.id)
        return { statusCode: 200, headers, body: JSON.stringify({ error: 'score_out_of_range' }) }
    }

    // 5. Wall-clock plausibility
    const elapsedMs = Date.now() - new Date(session.started_at).getTime()
    const expectedMs = (ticks / 60) * 1000
    if (elapsedMs < expectedMs * 0.7) {
        await markInvalid(sql, session.id)
        return { statusCode: 200, headers, body: JSON.stringify({ error: 'time_implausible' }) }
    }

    // 6. Heartbeat chain validation
    const heartbeats = session.heartbeats || []
    if (score > 50 && heartbeats.length < 1) {
        await markInvalid(sql, session.id)
        return { statusCode: 200, headers, body: JSON.stringify({ error: 'missing_heartbeats' }) }
    }

    if (heartbeats.length > 0) {
        const validation = validateHeartbeats(heartbeats, ticks, session.started_at)
        if (!validation.valid) {
            await markInvalid(sql, session.id)
            return { statusCode: 200, headers, body: JSON.stringify({ error: validation.reason }) }
        }
    }

    // ─── All checks passed ───

    // Get previous best before upsert
    const [existing] = await sql`
        SELECT best_score FROM smiterunner_scores WHERE user_id = ${user.id}
    `
    const previousBest = existing?.best_score || 0

    // Mark session as submitted
    await sql`
        UPDATE smiterunner_sessions
        SET submitted_at = NOW(), score = ${score}, ticks = ${ticks}
        WHERE id = ${session.id}
    `

    // Upsert best score
    await sql`
        INSERT INTO smiterunner_scores (user_id, best_score, best_ticks, total_runs, best_score_at, updated_at)
        VALUES (${user.id}, ${score}, ${ticks}, 1, NOW(), NOW())
        ON CONFLICT (user_id) DO UPDATE SET
            total_runs = smiterunner_scores.total_runs + 1,
            best_score = GREATEST(smiterunner_scores.best_score, ${score}),
            best_ticks = CASE WHEN ${score} > smiterunner_scores.best_score THEN ${ticks} ELSE smiterunner_scores.best_ticks END,
            best_score_at = CASE WHEN ${score} > smiterunner_scores.best_score THEN NOW() ELSE smiterunner_scores.best_score_at END,
            updated_at = NOW()
    `

    // Fetch updated stats
    const [updated] = await sql`
        SELECT best_score, total_runs FROM smiterunner_scores WHERE user_id = ${user.id}
    `

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            score,
            isNewBest: score > previousBest,
            bestScore: updated.best_score,
            totalRuns: updated.total_runs,
        }),
    }
}


// ═══════════════════════════════════════════════════
// Heartbeat chain validation
// ═══════════════════════════════════════════════════
function validateHeartbeats(heartbeats, finalTicks, sessionStartedAt) {
    const startTime = new Date(sessionStartedAt).getTime()

    let prevTicks = 0
    let prevTime = startTime

    for (let i = 0; i < heartbeats.length; i++) {
        const hb = heartbeats[i]
        const hbTime = new Date(hb.serverTime).getTime()
        const hbTicks = hb.ticks

        // Ticks must be monotonically increasing
        if (hbTicks <= prevTicks && i > 0) {
            return { valid: false, reason: 'heartbeat_ticks_not_increasing' }
        }

        // Check tick rate between checkpoints (~60 ticks/sec, allow 30-90 range)
        const timeDeltaS = (hbTime - prevTime) / 1000
        if (timeDeltaS > 0.5) { // only check if enough time has passed
            const tickDelta = hbTicks - prevTicks
            const tickRate = tickDelta / timeDeltaS
            if (tickRate < 30 || tickRate > 90) {
                return { valid: false, reason: 'heartbeat_tick_rate_implausible' }
            }
        }

        prevTicks = hbTicks
        prevTime = hbTime
    }

    // Final ticks must be >= last heartbeat ticks
    if (finalTicks < prevTicks) {
        return { valid: false, reason: 'final_ticks_less_than_heartbeat' }
    }

    return { valid: true }
}


// ═══════════════════════════════════════════════════
// Helper: mark session as invalid
// ═══════════════════════════════════════════════════
async function markInvalid(sql, sessionId) {
    await sql`
        UPDATE smiterunner_sessions
        SET is_valid = false, submitted_at = NOW()
        WHERE id = ${sessionId}
    `
}


// ═══════════════════════════════════════════════════
// GET: User's personal stats
// ═══════════════════════════════════════════════════
async function getMyStats(sql, user) {
    const [stats] = await sql`
        SELECT best_score, best_ticks, total_runs, best_score_at
        FROM smiterunner_scores
        WHERE user_id = ${user.id}
    `

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            bestScore: stats?.best_score || 0,
            bestTicks: stats?.best_ticks || 0,
            totalRuns: stats?.total_runs || 0,
            bestScoreAt: stats?.best_score_at || null,
        }),
    }
}


// ═══════════════════════════════════════════════════
// GET: Public leaderboard (top 15)
// ═══════════════════════════════════════════════════
async function getLeaderboard(sql) {
    const rows = await sql`
        SELECT s.user_id, s.best_score, s.best_ticks, s.total_runs,
               u.discord_username, u.discord_avatar, u.discord_id,
               COALESCE(pb.total_earned, 0) as total_earned,
               p.slug as player_slug
        FROM smiterunner_scores s
        JOIN users u ON u.id = s.user_id
        LEFT JOIN passion_balances pb ON pb.user_id = s.user_id
        LEFT JOIN players p ON p.id = u.linked_player_id
        WHERE s.best_score > 0
        ORDER BY s.best_score DESC, s.best_score_at ASC
        LIMIT 15
    `

    const leaderboard = rows.map((row, i) => {
        const rank = getRank(row.total_earned || 0)
        return {
            position: i + 1,
            userId: row.user_id,
            discordUsername: row.discord_username,
            discordAvatar: row.discord_avatar,
            discordId: row.discord_id,
            bestScore: row.best_score,
            totalRuns: row.total_runs,
            totalEarned: row.total_earned || 0,
            playerSlug: row.player_slug || null,
            rank: { name: rank.name, division: rank.division, display: formatRank(rank) },
        }
    })

    return { statusCode: 200, headers, body: JSON.stringify({ leaderboard }) }
}


export const onRequest = adapt(handler)

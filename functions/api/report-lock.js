/* global process */
import { adapt } from '../lib/adapter.js'
import { getDB, adminHeaders as headers, transaction } from '../lib/db.js'
import { requirePermission } from '../lib/auth.js'
import { sendChannelMessage } from '../lib/discord.js'

const LOCK_TTL_MS = 10 * 60 * 1000 // 10 minutes
const SILENT = 4096 // SUPPRESS_NOTIFICATIONS flag

function isExpired(lockedAt) {
    return !lockedAt || (Date.now() - new Date(lockedAt).getTime()) > LOCK_TTL_MS
}

function matchLabel(sm) {
    const week = sm.week ? ` (Week ${sm.week})` : ''
    return `**${sm.team1_name || 'TBD'}** vs **${sm.team2_name || 'TBD'}**${week}`
}

async function notifyChannel(content) {
    const channelId = process.env.DISCORD_REPORT_CHANNEL_ID
    if (!channelId) return
    sendChannelMessage(channelId, { content, flags: SILENT }).catch(() => {})
}

const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const admin = await requirePermission(event, 'match_report')
    if (!admin) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const sql = getDB()

    // GET — list active locks or check specific match
    if (event.httpMethod === 'GET') {
        const { scheduled_match_id } = event.queryStringParameters || {}

        if (scheduled_match_id) {
            const [lock] = await sql`
                SELECT sm.id, sm.locked_by, sm.locked_at,
                       u.discord_username as locked_by_name,
                       t1.name as team1_name, t2.name as team2_name, sm.week
                FROM scheduled_matches sm
                LEFT JOIN users u ON sm.locked_by = u.id
                LEFT JOIN teams t1 ON sm.team1_id = t1.id
                LEFT JOIN teams t2 ON sm.team2_id = t2.id
                WHERE sm.id = ${scheduled_match_id}
            `
            if (!lock) {
                return { statusCode: 404, headers, body: JSON.stringify({ error: 'Match not found' }) }
            }
            const active = lock.locked_by && !isExpired(lock.locked_at)
            return {
                statusCode: 200, headers,
                body: JSON.stringify({
                    locked: active,
                    locked_by: active ? lock.locked_by : null,
                    locked_by_name: active ? lock.locked_by_name : null,
                    locked_at: active ? lock.locked_at : null,
                    is_mine: active && lock.locked_by === admin.id,
                }),
            }
        }

        // List all active locks
        const locks = await sql`
            SELECT sm.id as scheduled_match_id, sm.locked_by, sm.locked_at,
                   u.discord_username as locked_by_name,
                   t1.name as team1_name, t2.name as team2_name, sm.week
            FROM scheduled_matches sm
            JOIN users u ON sm.locked_by = u.id
            LEFT JOIN teams t1 ON sm.team1_id = t1.id
            LEFT JOIN teams t2 ON sm.team2_id = t2.id
            WHERE sm.locked_by IS NOT NULL
              AND sm.status = 'scheduled'
              AND sm.locked_at > NOW() - INTERVAL '10 minutes'
        `
        return { statusCode: 200, headers, body: JSON.stringify({ locks }) }
    }

    // POST — acquire, release, refresh
    if (event.httpMethod === 'POST') {
        const body = JSON.parse(event.body || '{}')
        const { action, scheduled_match_id } = body

        if (!scheduled_match_id) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'scheduled_match_id required' }) }
        }

        if (action === 'acquire') {
            const result = await transaction(async (tx) => {
                const [sm] = await tx`
                    SELECT sm.id, sm.locked_by, sm.locked_at, sm.status,
                           t1.name as team1_name, t2.name as team2_name, sm.week,
                           u.discord_username as locked_by_name
                    FROM scheduled_matches sm
                    LEFT JOIN teams t1 ON sm.team1_id = t1.id
                    LEFT JOIN teams t2 ON sm.team2_id = t2.id
                    LEFT JOIN users u ON sm.locked_by = u.id
                    WHERE sm.id = ${scheduled_match_id}
                    FOR UPDATE
                `
                if (!sm) throw Object.assign(new Error('Match not found'), { status: 404 })
                if (sm.status !== 'scheduled') throw Object.assign(new Error('Match is not scheduled'), { status: 400 })

                // Already locked by someone else and not expired
                if (sm.locked_by && sm.locked_by !== admin.id && !isExpired(sm.locked_at)) {
                    return {
                        locked: true,
                        locked_by: sm.locked_by,
                        locked_by_name: sm.locked_by_name,
                        locked_at: sm.locked_at,
                        conflict: true,
                    }
                }

                // Acquire (or refresh own lock)
                await tx`
                    UPDATE scheduled_matches
                    SET locked_by = ${admin.id}, locked_at = NOW()
                    WHERE id = ${scheduled_match_id}
                `

                return {
                    locked: true,
                    locked_by: admin.id,
                    locked_by_name: admin.discord_username,
                    is_mine: true,
                    team1_name: sm.team1_name,
                    team2_name: sm.team2_name,
                    week: sm.week,
                }
            })

            if (result.conflict) {
                return {
                    statusCode: 409, headers,
                    body: JSON.stringify({ error: `Locked by ${result.locked_by_name}`, ...result }),
                }
            }

            // Notify Discord
            event.waitUntil(
                notifyChannel(`**${admin.discord_username}** is currently reporting ${matchLabel(result)}`)
            )

            return { statusCode: 200, headers, body: JSON.stringify({ success: true, ...result }) }
        }

        if (action === 'release') {
            const [sm] = await sql`
                SELECT sm.id, sm.locked_by, sm.locked_at,
                       t1.name as team1_name, t2.name as team2_name, sm.week
                FROM scheduled_matches sm
                LEFT JOIN teams t1 ON sm.team1_id = t1.id
                LEFT JOIN teams t2 ON sm.team2_id = t2.id
                WHERE sm.id = ${scheduled_match_id}
            `
            if (!sm) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Match not found' }) }

            // Only the locking user can release (or if lock is expired)
            if (sm.locked_by && sm.locked_by !== admin.id && !isExpired(sm.locked_at)) {
                return { statusCode: 403, headers, body: JSON.stringify({ error: 'Not your lock' }) }
            }

            await sql`
                UPDATE scheduled_matches
                SET locked_by = NULL, locked_at = NULL
                WHERE id = ${scheduled_match_id}
            `

            event.waitUntil(
                notifyChannel(`**${admin.discord_username}** cancelled reporting ${matchLabel(sm)}`)
            )

            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
        }

        if (action === 'refresh') {
            const [sm] = await sql`
                SELECT locked_by FROM scheduled_matches WHERE id = ${scheduled_match_id}
            `
            if (!sm || sm.locked_by !== admin.id) {
                return { statusCode: 403, headers, body: JSON.stringify({ error: 'Not your lock' }) }
            }

            await sql`
                UPDATE scheduled_matches
                SET locked_at = NOW()
                WHERE id = ${scheduled_match_id} AND locked_by = ${admin.id}
            `

            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
        }

        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) }
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
}

export const onRequest = adapt(handler)

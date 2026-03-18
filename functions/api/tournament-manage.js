import { adapt } from '../lib/adapter.js'
import { getDB, handleCors, adminHeaders as headers } from '../lib/db.js'
import { requirePermission } from '../lib/auth.js'
import { logAudit } from '../lib/audit.js'

const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const admin = await requirePermission(event, 'tournament_manage')
    if (!admin) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const sql = getDB()

    try {
        if (event.httpMethod === 'GET') {
            const { tournamentId } = event.queryStringParameters || {}

            // List all tournaments for admin
            if (!tournamentId) {
                const tournaments = await sql`
                    SELECT t.*, u.discord_username as created_by_name,
                           (SELECT count(*) FROM tournament_signups WHERE tournament_id = t.id) as signup_count,
                           (SELECT count(*) FROM tournament_signups WHERE tournament_id = t.id AND status = 'pending') as pending_count
                    FROM tournaments t
                    LEFT JOIN users u ON u.id = t.created_by
                    ORDER BY t.created_at DESC
                `
                return { statusCode: 200, headers, body: JSON.stringify(tournaments) }
            }

            // Get signups for a specific tournament
            const signups = await sql`
                SELECT ts.*,
                       u.discord_username, u.discord_avatar, u.discord_id,
                       p.name as player_name, p.tracker_url as player_tracker_url
                FROM tournament_signups ts
                JOIN users u ON u.id = ts.user_id
                LEFT JOIN players p ON p.id = ts.player_id
                WHERE ts.tournament_id = ${tournamentId}
                ORDER BY ts.created_at ASC
            `

            const [tournament] = await sql`
                SELECT * FROM tournaments WHERE id = ${tournamentId}
            `

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ tournament, signups }),
            }
        }

        if (event.httpMethod === 'POST') {
            const body = event.body ? JSON.parse(event.body) : {}
            const { action } = body

            if (action === 'create') {
                const { name, slug, description, draftDate, gameDates, discordInviteUrl } = body
                if (!name || !slug) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'name and slug are required' }) }
                }

                const [tournament] = await sql`
                    INSERT INTO tournaments (name, slug, description, draft_date, game_dates, discord_invite_url, created_by)
                    VALUES (${name}, ${slug}, ${description || null}, ${draftDate || null},
                            ${JSON.stringify(gameDates || [])}, ${discordInviteUrl || null}, ${admin.id})
                    RETURNING *
                `

                await logAudit(sql, admin, {
                    action: 'create-tournament', endpoint: 'tournament-manage',
                    targetType: 'tournament', targetId: tournament.id,
                    details: { name, slug },
                })

                return { statusCode: 200, headers, body: JSON.stringify({ tournament }) }
            }

            if (action === 'update') {
                const { tournamentId, name, slug, description, draftDate, gameDates, discordInviteUrl } = body
                if (!tournamentId) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'tournamentId is required' }) }
                }

                // Fetch current, then merge — allows clearing fields to null
                const [current] = await sql`SELECT * FROM tournaments WHERE id = ${tournamentId}`
                if (!current) {
                    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Tournament not found' }) }
                }

                const merged = {
                    name: name !== undefined ? name : current.name,
                    slug: slug !== undefined ? slug : current.slug,
                    description: description !== undefined ? description : current.description,
                    draft_date: draftDate !== undefined ? (draftDate || null) : current.draft_date,
                    game_dates: gameDates !== undefined ? JSON.stringify(gameDates) : JSON.stringify(current.game_dates || []),
                    discord_invite_url: discordInviteUrl !== undefined ? (discordInviteUrl || null) : current.discord_invite_url,
                }

                const [tournament] = await sql`
                    UPDATE tournaments SET
                        name = ${merged.name},
                        slug = ${merged.slug},
                        description = ${merged.description},
                        draft_date = ${merged.draft_date},
                        game_dates = ${merged.game_dates}::jsonb,
                        discord_invite_url = ${merged.discord_invite_url},
                        updated_at = now()
                    WHERE id = ${tournamentId}
                    RETURNING *
                `

                await logAudit(sql, admin, {
                    action: 'update-tournament', endpoint: 'tournament-manage',
                    targetType: 'tournament', targetId: tournamentId,
                    details: { name, slug },
                })

                return { statusCode: 200, headers, body: JSON.stringify({ tournament }) }
            }

            if (action === 'toggle-signups') {
                const { tournamentId } = body
                if (!tournamentId) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'tournamentId is required' }) }
                }

                const [tournament] = await sql`
                    UPDATE tournaments SET signups_open = NOT signups_open, updated_at = now()
                    WHERE id = ${tournamentId} RETURNING *
                `

                if (!tournament) {
                    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Tournament not found' }) }
                }

                await logAudit(sql, admin, {
                    action: 'toggle-signups', endpoint: 'tournament-manage',
                    targetType: 'tournament', targetId: tournamentId,
                    details: { signups_open: tournament.signups_open },
                })

                return { statusCode: 200, headers, body: JSON.stringify({ tournament }) }
            }

            if (action === 'update-status') {
                const { tournamentId, status } = body
                if (!tournamentId || !status) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'tournamentId and status are required' }) }
                }
                if (!['upcoming', 'in_progress', 'completed'].includes(status)) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid status' }) }
                }

                const [tournament] = await sql`
                    UPDATE tournaments SET status = ${status}, updated_at = now()
                    WHERE id = ${tournamentId} RETURNING *
                `

                if (!tournament) {
                    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Tournament not found' }) }
                }

                await logAudit(sql, admin, {
                    action: 'update-tournament-status', endpoint: 'tournament-manage',
                    targetType: 'tournament', targetId: tournamentId,
                    details: { status },
                })

                return { statusCode: 200, headers, body: JSON.stringify({ tournament }) }
            }

            if (action === 'review-signup') {
                const { signupId, status } = body
                if (!signupId || !status) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'signupId and status are required' }) }
                }
                if (!['approved', 'rejected'].includes(status)) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Status must be approved or rejected' }) }
                }

                const [signup] = await sql`
                    UPDATE tournament_signups SET
                        status = ${status},
                        reviewed_by = ${admin.id},
                        reviewed_at = now(),
                        updated_at = now()
                    WHERE id = ${signupId}
                    RETURNING *
                `

                if (!signup) {
                    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Signup not found' }) }
                }

                await logAudit(sql, admin, {
                    action: 'review-tournament-signup', endpoint: 'tournament-manage',
                    targetType: 'tournament_signup', targetId: signupId,
                    details: { status, tournament_id: signup.tournament_id },
                })

                return { statusCode: 200, headers, body: JSON.stringify({ signup }) }
            }

            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) }
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    } catch (error) {
        console.error('Tournament manage error:', error)
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) }
    }
}

export const onRequest = adapt(handler)

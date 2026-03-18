import { adapt } from '../lib/adapter.js'
import { getDB, handleCors, headers } from '../lib/db.js'
import { requireAuth } from '../lib/auth.js'

const handler = async (event) => {
    const cors = handleCors(event)
    if (cors) return cors

    const sql = getDB()

    try {
        const user = await requireAuth(event)
        if (!user) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
        }

        if (event.httpMethod === 'GET') {
            const { tournamentId } = event.queryStringParameters || {}
            if (!tournamentId) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'tournamentId required' }) }
            }

            const [signup] = await sql`
                SELECT ts.*, p.name as linked_player_name, p.tracker_url as linked_tracker_url
                FROM tournament_signups ts
                LEFT JOIN players p ON p.id = ts.player_id
                WHERE ts.tournament_id = ${tournamentId} AND ts.user_id = ${user.id}
            `

            // Also return linked player info for pre-filling the form
            let linkedPlayer = null
            if (user.linked_player_id) {
                const [p] = await sql`
                    SELECT id, name, tracker_url FROM players WHERE id = ${user.linked_player_id}
                `
                linkedPlayer = p || null
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ signup: signup || null, linkedPlayer }),
            }
        }

        if (event.httpMethod === 'POST') {
            const body = event.body ? JSON.parse(event.body) : {}
            const { action } = body

            if (action === 'signup') {
                const { tournamentId, smiteName, trackerUrl, applyingAsCaptain, availableGameDates, availableDraftDate } = body

                if (!tournamentId || !smiteName) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'tournamentId and smiteName are required' }) }
                }

                // Check tournament exists and signups are open
                const [tournament] = await sql`
                    SELECT id, signups_open, game_dates FROM tournaments WHERE id = ${tournamentId}
                `
                if (!tournament) {
                    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Tournament not found' }) }
                }
                if (!tournament.signups_open) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Signups are not open for this tournament' }) }
                }

                // Check for existing signup
                const [existing] = await sql`
                    SELECT id FROM tournament_signups
                    WHERE tournament_id = ${tournamentId} AND user_id = ${user.id}
                `
                if (existing) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'You have already signed up for this tournament' }) }
                }

                // Captain must be available for draft
                if (applyingAsCaptain && !availableDraftDate) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Captains must be available for the draft date' }) }
                }

                // Determine player_id — only auto-link if user has linked_player_id AND name matches
                let playerId = null
                let finalTrackerUrl = trackerUrl || null

                if (user.linked_player_id) {
                    const [linkedPlayer] = await sql`
                        SELECT id, name, tracker_url FROM players WHERE id = ${user.linked_player_id}
                    `
                    if (linkedPlayer && linkedPlayer.name.toLowerCase() === smiteName.toLowerCase()) {
                        playerId = linkedPlayer.id
                        finalTrackerUrl = linkedPlayer.tracker_url
                    }
                }

                // If no player linked and no tracker provided, require it
                if (!playerId && !finalTrackerUrl) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Tracker URL is required when not matching an existing player' }) }
                }

                const [signup] = await sql`
                    INSERT INTO tournament_signups (
                        tournament_id, user_id, player_id, smite_name, tracker_url,
                        applying_as_captain, available_game_dates, available_draft_date
                    ) VALUES (
                        ${tournamentId}, ${user.id}, ${playerId}, ${smiteName}, ${finalTrackerUrl},
                        ${!!applyingAsCaptain}, ${JSON.stringify(availableGameDates || [])}, ${!!availableDraftDate}
                    ) RETURNING *
                `

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ signup }),
                }
            }

            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) }
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    } catch (error) {
        console.error('Tournament signup error:', error)
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) }
    }
}

export const onRequest = adapt(handler)

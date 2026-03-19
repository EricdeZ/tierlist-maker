import { adapt } from '../lib/adapter.js'
import { getDB, handleCors, headers, transaction } from '../lib/db.js'
import { requireAuth } from '../lib/auth.js'
import { grantEmber } from '../lib/ember.js'

const MAX_PLAYS = 5
const MAX_EGGS = 200
const MIN_PLAY_INTERVAL_MS = 110000

const handler = async (event) => {
    const cors = handleCors(event)
    if (cors) return cors

    const user = await requireAuth(event)
    if (!user) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Login required' }) }
    }

    try {
        if (event.httpMethod === 'GET') {
            const { tournamentId } = event.queryStringParameters || {}
            if (!tournamentId) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'tournamentId required' }) }
            }

            const sql = getDB()
            const plays = await sql`
                SELECT COUNT(*)::int AS plays_used
                FROM tournament_egg_hunts
                WHERE user_id = ${user.id} AND tournament_id = ${parseInt(tournamentId)}
            `
            const playsUsed = plays[0]?.plays_used || 0

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ playsUsed, playsRemaining: MAX_PLAYS - playsUsed }),
            }
        }

        if (event.httpMethod === 'POST') {
            const body = event.body ? JSON.parse(event.body) : {}
            const { tournamentId, eggsCollected } = body
            if (!tournamentId || eggsCollected == null) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'tournamentId and eggsCollected required' }) }
            }

            const eggs = Math.min(Math.max(0, Math.floor(eggsCollected)), MAX_EGGS)

            const result = await transaction(async (tx) => {
                const [tournament] = await tx`SELECT id FROM tournaments WHERE id = ${parseInt(tournamentId)}`
                if (!tournament) throw new Error('Tournament not found')

                const plays = await tx`
                    SELECT COUNT(*)::int AS plays_used, MAX(played_at) AS last_played
                    FROM tournament_egg_hunts
                    WHERE user_id = ${user.id} AND tournament_id = ${tournament.id}
                `
                const playsUsed = plays[0]?.plays_used || 0
                if (playsUsed >= MAX_PLAYS) throw new Error('No plays remaining')

                const lastPlayed = plays[0]?.last_played
                if (lastPlayed && (Date.now() - new Date(lastPlayed).getTime()) < MIN_PLAY_INTERVAL_MS) {
                    throw new Error('Please wait before playing again')
                }

                const [hunt] = await tx`
                    INSERT INTO tournament_egg_hunts (user_id, tournament_id, eggs_collected, cores_awarded)
                    VALUES (${user.id}, ${tournament.id}, ${eggs}, ${eggs})
                    RETURNING id
                `

                if (eggs > 0) {
                    await grantEmber(tx, user.id, 'egg_hunt', eggs, `Easter egg hunt: ${eggs} eggs`, hunt.id)
                }

                return { coresAwarded: eggs, playsRemaining: MAX_PLAYS - playsUsed - 1 }
            })

            return { statusCode: 200, headers, body: JSON.stringify(result) }
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    } catch (error) {
        console.error('Tournament egg hunt error:', error)
        const status = error.message.includes('No plays') || error.message.includes('Please wait') ? 400 : 500
        return { statusCode: status, headers, body: JSON.stringify({ error: error.message }) }
    }
}

export const onRequest = adapt(handler)

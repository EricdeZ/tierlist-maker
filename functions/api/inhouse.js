import { adapt } from '../lib/adapter.js'
import { getDB, headers } from '../lib/db.js'
import { requireAuth } from '../lib/auth.js'
import {
    listLobbies,
    getLobbyDetail,
    getDraftState,
    getLeaderboard,
    getPlayerStats,
    getMyLobbies,
    createLobby,
    joinLobby,
    leaveLobby,
    kickPlayer,
    cancelLobby,
    setCaptains,
    startDraft,
    draftPick,
    startVoting,
    castVote,
} from '../lib/inhouse.js'

const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const sql = getDB()
    const params = event.queryStringParameters || {}
    const { action } = params

    try {
        if (event.httpMethod === 'GET') {
            switch (action) {
                case 'list':
                    return ok(await listLobbies(sql, params))
                case 'detail': {
                    if (!params.lobbyId) return bad('lobbyId is required')
                    const user = await requireAuth(event)
                    const detail = await getLobbyDetail(sql, Number(params.lobbyId), user?.id)
                    if (!detail) return notFound('Lobby not found')
                    return ok(detail)
                }
                case 'draft-state': {
                    const user = await requireAuth(event)
                    if (!user) return unauth()
                    if (!params.lobbyId) return bad('lobbyId is required')
                    const state = await getDraftState(sql, Number(params.lobbyId))
                    if (!state) return notFound('Lobby not found')
                    return ok(state)
                }
                case 'leaderboard':
                    return ok(await getLeaderboard(sql, params))
                case 'my-stats': {
                    const user = await requireAuth(event)
                    if (!user) return unauth()
                    const stats = await getPlayerStats(sql, user.id)
                    return ok(stats || { wins: 0, losses: 0, games: 0, streak: 0, bestStreak: 0, recentGames: [] })
                }
                case 'player-stats': {
                    if (!params.userId) return bad('userId is required')
                    const stats = await getPlayerStats(sql, Number(params.userId))
                    return ok(stats || { wins: 0, losses: 0, games: 0, streak: 0, bestStreak: 0, recentGames: [] })
                }
                case 'my-lobbies': {
                    const user = await requireAuth(event)
                    if (!user) return unauth()
                    return ok(await getMyLobbies(sql, user.id))
                }
                default:
                    return bad(`Unknown action: ${action}`)
            }
        }

        if (event.httpMethod === 'POST') {
            const user = await requireAuth(event)
            if (!user) return unauth()

            const body = event.body ? JSON.parse(event.body) : {}

            switch (action) {
                case 'create':
                    return ok(await createLobby(sql, user, body))
                case 'join':
                    return ok(await joinLobby(sql, user, body))
                case 'leave':
                    return ok(await leaveLobby(sql, user, body))
                case 'kick':
                    return ok(await kickPlayer(sql, user, body))
                case 'cancel':
                    return ok(await cancelLobby(sql, user, body))
                case 'set-captains':
                    return ok(await setCaptains(sql, user, body))
                case 'start-draft':
                    return ok(await startDraft(sql, user, body))
                case 'draft-pick':
                    return ok(await draftPick(sql, user, body))
                case 'start-voting':
                    return ok(await startVoting(sql, user, body))
                case 'vote':
                    return ok(await castVote(sql, user, body))
                default:
                    return bad(`Unknown action: ${action}`)
            }
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    } catch (error) {
        console.error('inhouse error:', error)
        const msg = error.message
        if (msg.includes('required') || msg.includes('must be') || msg.includes('Cannot') ||
            msg.includes('not found') || msg.includes('not your') || msg.includes('Only') ||
            msg.includes('full') || msg.includes('not in') || msg.includes('not accepting') ||
            msg.includes('already')) {
            return bad(msg)
        }
        return { statusCode: 500, headers, body: JSON.stringify({ error: msg }) }
    }
}

function ok(data) {
    return { statusCode: 200, headers, body: JSON.stringify(data) }
}
function bad(msg) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: msg }) }
}
function unauth() {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
}
function notFound(msg) {
    return { statusCode: 404, headers, body: JSON.stringify({ error: msg }) }
}

export const onRequest = adapt(handler)

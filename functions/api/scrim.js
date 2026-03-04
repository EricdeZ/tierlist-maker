import { adapt } from '../lib/adapter.js'
import { getDB, headers, adminHeaders } from '../lib/db.js'
import { requireAuth, requirePermission } from '../lib/auth.js'
import { pushChallengeProgress, getScrimStats } from '../lib/challenges.js'
import {
    listScrims, fetchMyScrims, fetchIncoming, getEligibleTeams,
    fetchAllActiveTeams, fetchTeamReliability, fetchBlacklist,
    searchUsersQuery, fetchActiveDivisions, pollDMConfirmations,
    formatTeamForResponse,
    createScrim, updateScrim, acceptScrim, cancelScrim, declineScrim,
    reportOutcome, disputeOutcome,
    addToBlacklist, removeFromBlacklist,
    confirmAccept, denyAccept,
} from '../lib/scrim.js'

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
                    return ok(await listScrims(sql, params), 'scrims')
                case 'my-scrims':
                    return await handleMyScrims(sql, event)
                case 'incoming':
                    return await handleIncoming(sql, event)
                case 'captain-teams':
                    return await handleCaptainTeams(sql, event)
                case 'all-teams':
                    return ok(await fetchAllActiveTeams(sql), 'teams')
                case 'team-reliability':
                    return await handleTeamReliability(sql, params)
                case 'blacklist':
                    return await handleBlacklist(sql, event)
                case 'search-users':
                    return await handleSearchUsers(sql, event, params)
                case 'active-divisions':
                    return ok(await fetchActiveDivisions(sql), 'divisions')
                case 'check-dm-confirmations':
                    return await handleCheckDMConfirmations(sql, event)
                default:
                    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
            }
        }

        // POST requires auth
        const user = await requireAuth(event)
        if (!user) {
            return { statusCode: 401, headers: adminHeaders, body: JSON.stringify({ error: 'Unauthorized' }) }
        }

        if (event.httpMethod === 'POST') {
            const body = event.body ? JSON.parse(event.body) : {}

            switch (action) {
                case 'create': {
                    const result = await createScrim(sql, user, body)
                    if (!result.error) {
                        const push = getScrimStats(sql, user.id).then(stats =>
                            pushChallengeProgress(sql, user.id, stats)
                        ).catch(err => console.error('Scrim challenge push failed:', err))
                        if (event.waitUntil) event.waitUntil(push)
                    }
                    return postResult(result)
                }
                case 'update':
                    return postResult(await updateScrim(sql, user, body))
                case 'accept':
                    return postResult(await acceptScrim(sql, user, body, event.waitUntil))
                case 'cancel':
                    return postResult(await cancelScrim(sql, user, body))
                case 'decline':
                    return postResult(await declineScrim(sql, user, body))
                case 'report-outcome': {
                    const result = await reportOutcome(sql, user, body)
                    if (!result.error && body.outcome === 'completed') {
                        const push = getScrimStats(sql, user.id).then(stats =>
                            pushChallengeProgress(sql, user.id, stats)
                        ).catch(err => console.error('Scrim challenge push failed:', err))
                        if (event.waitUntil) event.waitUntil(push)
                    }
                    return postResult(result)
                }
                case 'dispute-outcome':
                    return postResult(await disputeOutcome(sql, user, body))
                case 'blacklist-add':
                    return postResult(await addToBlacklist(sql, user, body))
                case 'blacklist-remove':
                    return postResult(await removeFromBlacklist(sql, user, body))
                case 'confirm-accept':
                    return postResult(await confirmAccept(sql, user, body, event.waitUntil))
                case 'deny-accept':
                    return postResult(await denyAccept(sql, user, body, event.waitUntil))
                default:
                    return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
            }
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    } catch (error) {
        console.error('scrim error:', error)
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) }
    }
}


// ═══════════════════════════════════════════════════
// GET handler wrappers (auth + response formatting)
// ═══════════════════════════════════════════════════

async function handleMyScrims(sql, event) {
    const user = await requireAuth(event)
    if (!user) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }
    const data = await fetchMyScrims(sql, user.id)
    return { statusCode: 200, headers, body: JSON.stringify(data) }
}

async function handleIncoming(sql, event) {
    const user = await requireAuth(event)
    if (!user) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }
    const scrims = await fetchIncoming(sql, user.id)
    return { statusCode: 200, headers, body: JSON.stringify({ scrims }) }
}

async function handleCaptainTeams(sql, event) {
    const user = await requireAuth(event)
    if (!user) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }
    const teams = await getEligibleTeams(sql, user.id)
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ captainTeams: teams.map(formatTeamForResponse) }),
    }
}

async function handleTeamReliability(sql, params) {
    const reliability = await fetchTeamReliability(sql, params)
    if (reliability === null) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'team_ids required' }) }
    }
    return { statusCode: 200, headers, body: JSON.stringify({ reliability }) }
}

async function handleBlacklist(sql, event) {
    const user = await requireAuth(event)
    if (!user) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }
    const blacklist = await fetchBlacklist(sql, user.id)
    return { statusCode: 200, headers, body: JSON.stringify({ blacklist }) }
}

async function handleSearchUsers(sql, event, params) {
    const user = await requirePermission(event, 'permission_manage')
    if (!user) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }
    const users = await searchUsersQuery(sql, params.q)
    return { statusCode: 200, headers, body: JSON.stringify({ users }) }
}

async function handleCheckDMConfirmations(sql, event) {
    const user = await requireAuth(event)
    if (!user) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }
    const processed = await pollDMConfirmations(sql, user.id)
    return { statusCode: 200, headers, body: JSON.stringify({ processed }) }
}


// ═══════════════════════════════════════════════════
// Response helpers
// ═══════════════════════════════════════════════════

function ok(data, key) {
    return { statusCode: 200, headers, body: JSON.stringify({ [key]: data }) }
}

function postResult(result) {
    if (result.error) {
        return {
            statusCode: result.status || 400,
            headers: adminHeaders,
            body: JSON.stringify({ error: result.error }),
        }
    }
    return {
        statusCode: 200,
        headers: adminHeaders,
        body: JSON.stringify(result),
    }
}


export const onRequest = adapt(handler)

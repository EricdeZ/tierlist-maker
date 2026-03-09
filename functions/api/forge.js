import { adapt } from '../lib/adapter.js'
import { getDB, headers } from '../lib/db.js'
import { requireAuth } from '../lib/auth.js'
import { getMarket, getMarketStatuses, getPortfolio, getPortfolioTimeline, getLeaderboard, getHistory, getBatchHistory } from '../lib/forge/market.js'
import { fuel, cool } from '../lib/forge/trading.js'
import { adminToggleStatus, adminLiquidate } from '../lib/forge/admin.js'
import { getTutorialStatus, tutorialFuel } from '../lib/forge/tutorial.js'
import { claimForgeReferral, referralFuel } from '../lib/forge/referral.js'

const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const sql = getDB()
    const params = event.queryStringParameters || {}
    const { action } = params

    try {
        // All actions require auth
        const user = await requireAuth(event)
        if (!user) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
        }

        if (event.httpMethod === 'GET') {
            switch (action) {
                case 'market':
                    return await getMarket(sql, user, params, event)
                case 'market-statuses':
                    return await getMarketStatuses(sql)
                case 'portfolio':
                    return await getPortfolio(sql, user, params)
                case 'leaderboard':
                    return await getLeaderboard(sql, params)
                case 'history':
                    return await getHistory(sql, params)
                case 'batch-history':
                    return await getBatchHistory(sql, params)
                case 'tutorial-status':
                    return await getTutorialStatus(sql, user, params)
                case 'portfolio-timeline':
                    return await getPortfolioTimeline(sql, user, params)
                default:
                    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
            }
        }

        if (event.httpMethod === 'POST') {
            const body = event.body ? JSON.parse(event.body) : {}

            switch (action) {
                case 'fuel':
                    return await fuel(sql, user, body, event)
                case 'cool':
                    return await cool(sql, user, body, event)
                case 'toggle-status':
                    return await adminToggleStatus(sql, event, user, body)
                case 'liquidate':
                    return await adminLiquidate(sql, event, user, body)
                case 'tutorial-fuel':
                    return await tutorialFuel(sql, user, body, event)
                case 'claim-forge-referral':
                    return await claimForgeReferral(sql, user, body)
                case 'referral-fuel':
                    return await referralFuel(sql, user, body, event)
                default:
                    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
            }
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    } catch (error) {
        console.error('forge error:', error)
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) }
    }
}


export const onRequest = adapt(handler)

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock all dependencies before importing the handler
vi.mock('../../adapter.js', () => ({
    adapt: (handler) => handler,
}))

vi.mock('../../db.js', () => ({
    getDB: vi.fn(() => 'mock-sql'),
    headers: { 'Content-Type': 'application/json' },
    getHeaders: vi.fn(() => ({ 'Content-Type': 'application/json' })),
    transaction: vi.fn(),
}))

vi.mock('../../auth.js', () => ({
    requireAuth: vi.fn(),
    requirePermission: vi.fn(),
}))

// Mock all handler modules
vi.mock('../market.js', () => ({
    getMarket: vi.fn(async () => ({ statusCode: 200, body: '{"action":"market"}' })),
    getMarketStatuses: vi.fn(async () => ({ statusCode: 200, body: '{"action":"market-statuses"}' })),
    getPortfolio: vi.fn(async () => ({ statusCode: 200, body: '{"action":"portfolio"}' })),
    getPortfolioTimeline: vi.fn(async () => ({ statusCode: 200, body: '{"action":"portfolio-timeline"}' })),
    getLeaderboard: vi.fn(async () => ({ statusCode: 200, body: '{"action":"leaderboard"}' })),
    getHistory: vi.fn(async () => ({ statusCode: 200, body: '{"action":"history"}' })),
    getBatchHistory: vi.fn(async () => ({ statusCode: 200, body: '{"action":"batch-history"}' })),
}))

vi.mock('../trading.js', () => ({
    fuel: vi.fn(async () => ({ statusCode: 200, body: '{"action":"fuel"}' })),
    cool: vi.fn(async () => ({ statusCode: 200, body: '{"action":"cool"}' })),
}))

vi.mock('../admin.js', () => ({
    adminToggleStatus: vi.fn(async () => ({ statusCode: 200, body: '{"action":"toggle-status"}' })),
    adminLiquidate: vi.fn(async () => ({ statusCode: 200, body: '{"action":"liquidate"}' })),
}))

vi.mock('../tutorial.js', () => ({
    getTutorialStatus: vi.fn(async () => ({ statusCode: 200, body: '{"action":"tutorial-status"}' })),
    tutorialFuel: vi.fn(async () => ({ statusCode: 200, body: '{"action":"tutorial-fuel"}' })),
}))

vi.mock('../referral.js', () => ({
    claimForgeReferral: vi.fn(async () => ({ statusCode: 200, body: '{"action":"claim-forge-referral"}' })),
    referralFuel: vi.fn(async () => ({ statusCode: 200, body: '{"action":"referral-fuel"}' })),
}))

import { onRequest } from '../../../api/forge.js'
import { requireAuth } from '../../auth.js'
import { getMarket, getMarketStatuses, getPortfolio, getPortfolioTimeline, getLeaderboard, getHistory, getBatchHistory } from '../market.js'
import { fuel, cool } from '../trading.js'
import { adminToggleStatus, adminLiquidate } from '../admin.js'
import { getTutorialStatus, tutorialFuel } from '../tutorial.js'
import { claimForgeReferral, referralFuel } from '../referral.js'

const mockUser = { id: 1, discord_username: 'testuser' }

function makeEvent(method, action, body = null) {
    return {
        httpMethod: method,
        queryStringParameters: { action },
        body: body ? JSON.stringify(body) : null,
    }
}

describe('forge router', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        requireAuth.mockResolvedValue(mockUser)
    })

    it('returns 204 for OPTIONS', async () => {
        const res = await onRequest({ httpMethod: 'OPTIONS', queryStringParameters: {} })
        expect(res.statusCode).toBe(204)
    })

    it('returns 401 when auth fails', async () => {
        requireAuth.mockResolvedValue(null)
        const res = await onRequest(makeEvent('GET', 'market'))
        expect(res.statusCode).toBe(401)
    })

    it('returns 405 for unsupported methods', async () => {
        const res = await onRequest(makeEvent('DELETE', 'market'))
        expect(res.statusCode).toBe(405)
    })

    it('returns 400 for unknown GET action', async () => {
        const res = await onRequest(makeEvent('GET', 'nonexistent'))
        expect(res.statusCode).toBe(400)
        expect(JSON.parse(res.body).error).toContain('Unknown action')
    })

    it('returns 400 for unknown POST action', async () => {
        const res = await onRequest(makeEvent('POST', 'nonexistent'))
        expect(res.statusCode).toBe(400)
        expect(JSON.parse(res.body).error).toContain('Unknown action')
    })

    // GET action dispatch tests
    const getActions = [
        ['market', getMarket],
        ['market-statuses', getMarketStatuses],
        ['portfolio', getPortfolio],
        ['portfolio-timeline', getPortfolioTimeline],
        ['leaderboard', getLeaderboard],
        ['history', getHistory],
        ['batch-history', getBatchHistory],
        ['tutorial-status', getTutorialStatus],
    ]

    for (const [action, handler] of getActions) {
        it(`dispatches GET action="${action}" to correct handler`, async () => {
            const event = makeEvent('GET', action)
            const res = await onRequest(event)
            expect(res.statusCode).toBe(200)
            expect(handler).toHaveBeenCalledTimes(1)
            expect(JSON.parse(res.body).action).toBe(action)
        })
    }

    // POST action dispatch tests
    const postActions = [
        ['fuel', fuel],
        ['cool', cool],
        ['toggle-status', adminToggleStatus],
        ['liquidate', adminLiquidate],
        ['tutorial-fuel', tutorialFuel],
        ['claim-forge-referral', claimForgeReferral],
        ['referral-fuel', referralFuel],
    ]

    for (const [action, handler] of postActions) {
        it(`dispatches POST action="${action}" to correct handler`, async () => {
            const event = makeEvent('POST', action, { sparkId: 1 })
            const res = await onRequest(event)
            expect(res.statusCode).toBe(200)
            expect(handler).toHaveBeenCalledTimes(1)
            expect(JSON.parse(res.body).action).toBe(action)
        })
    }

    it('passes sql, user, params, and event to GET handlers', async () => {
        const event = makeEvent('GET', 'market')
        await onRequest(event)
        const [sql, user, params, ev] = getMarket.mock.calls[0]
        expect(sql).toBe('mock-sql')
        expect(user).toEqual(mockUser)
        expect(params.action).toBe('market')
        expect(ev).toBe(event)
    })

    it('passes sql, user, body, and event to POST handlers', async () => {
        const event = makeEvent('POST', 'fuel', { sparkId: 42, sparks: 3 })
        await onRequest(event)
        const [sql, user, body, ev] = fuel.mock.calls[0]
        expect(sql).toBe('mock-sql')
        expect(user).toEqual(mockUser)
        expect(body).toEqual({ sparkId: 42, sparks: 3 })
        expect(ev).toBe(event)
    })

    it('catches handler errors and returns 500', async () => {
        getMarket.mockRejectedValueOnce(new Error('DB exploded'))
        const res = await onRequest(makeEvent('GET', 'market'))
        expect(res.statusCode).toBe(500)
        expect(JSON.parse(res.body).error).toBe('DB exploded')
    })
})

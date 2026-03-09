import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
vi.mock('../../db.js', () => ({
    headers: { 'Content-Type': 'application/json' },
    getHeaders: vi.fn(() => ({ 'Content-Type': 'application/json' })),
    transaction: vi.fn(),
}))

vi.mock('../../challenges.js', () => ({
    pushChallengeProgress: vi.fn(),
}))

vi.mock('../../passion.js', () => ({
    grantPassion: vi.fn(),
}))

vi.mock('../../auth.js', () => ({
    requirePermission: vi.fn(),
}))

vi.mock('../../audit.js', () => ({
    logAudit: vi.fn(),
}))

vi.mock('../../referrals.js', () => ({
    processForgeReferral: vi.fn(),
}))

vi.mock('../helpers.js', () => ({
    calcPrice: vi.fn((base, mult, sparks) => base * mult * (1 + 0.02 * sparks)),
    decaySellPressure: vi.fn(() => 0),
    ensureMarket: vi.fn(),
    ensurePlayerSparks: vi.fn(),
    executeFuel: vi.fn(),
    executeCool: vi.fn(),
    liquidateMarket: vi.fn(),
    loadForgeConfig: vi.fn(async () => ({
        FUELING_LOCKED: false,
        COOLING_LOCKED: false,
    })),
}))


describe('market handlers', () => {
    let getMarketStatuses, getHistory, getBatchHistory

    beforeEach(async () => {
        vi.clearAllMocks()
        const mod = await import('../market.js')
        getMarketStatuses = mod.getMarketStatuses
        getHistory = mod.getHistory
        getBatchHistory = mod.getBatchHistory
    })

    describe('getMarketStatuses', () => {
        it('returns market statuses keyed by season_id', async () => {
            const sql = vi.fn(async () => [
                { season_id: 1, status: 'open' },
                { season_id: 2, status: 'closed' },
            ])

            const res = await getMarketStatuses(sql)
            expect(res.statusCode).toBe(200)
            const body = JSON.parse(res.body)
            expect(body.statuses).toEqual({ 1: 'open', 2: 'closed' })
        })

        it('returns empty statuses when no markets exist', async () => {
            const sql = vi.fn(async () => [])
            const res = await getMarketStatuses(sql)
            expect(res.statusCode).toBe(200)
            expect(JSON.parse(res.body).statuses).toEqual({})
        })
    })

    describe('getHistory', () => {
        it('returns 400 when sparkId is missing', async () => {
            const sql = vi.fn()
            const res = await getHistory(sql, {})
            expect(res.statusCode).toBe(400)
            expect(JSON.parse(res.body).error).toContain('sparkId is required')
        })

        it('returns price history for a spark', async () => {
            const sql = vi.fn(async () => [
                { price: '50.00', trigger: 'init', created_at: '2024-01-01T00:00:00Z' },
                { price: '55.50', trigger: 'fuel', created_at: '2024-01-02T00:00:00Z' },
            ])
            const res = await getHistory(sql, { sparkId: '1' })
            expect(res.statusCode).toBe(200)
            const body = JSON.parse(res.body)
            expect(body.history).toHaveLength(2)
            expect(body.history[0].price).toBe(50)
            expect(body.history[1].price).toBe(55.5)
            expect(body.history[0].trigger).toBe('init')
        })
    })

    describe('getBatchHistory', () => {
        it('returns 400 when sparkIds is missing', async () => {
            const sql = vi.fn()
            const res = await getBatchHistory(sql, {})
            expect(res.statusCode).toBe(400)
        })

        it('returns 400 when too many sparkIds', async () => {
            const ids = Array.from({ length: 51 }, (_, i) => i + 1).join(',')
            const sql = vi.fn()
            const res = await getBatchHistory(sql, { sparkIds: ids })
            expect(res.statusCode).toBe(400)
            expect(JSON.parse(res.body).error).toContain('1-50')
        })

        it('groups history by sparkId', async () => {
            const sql = vi.fn(async () => [
                { spark_id: 1, price: '50.00', trigger: 'init', created_at: '2024-01-01T00:00:00Z' },
                { spark_id: 1, price: '55.00', trigger: 'fuel', created_at: '2024-01-02T00:00:00Z' },
                { spark_id: 2, price: '60.00', trigger: 'init', created_at: '2024-01-01T00:00:00Z' },
            ])
            const res = await getBatchHistory(sql, { sparkIds: '1,2' })
            expect(res.statusCode).toBe(200)
            const body = JSON.parse(res.body)
            expect(body.histories[1]).toHaveLength(2)
            expect(body.histories[2]).toHaveLength(1)
        })
    })
})


describe('admin handlers', () => {
    let adminToggleStatus, adminLiquidate
    let requirePermission, logAudit, liquidateMarket

    beforeEach(async () => {
        vi.clearAllMocks()
        const adminMod = await import('../admin.js')
        adminToggleStatus = adminMod.adminToggleStatus
        adminLiquidate = adminMod.adminLiquidate

        const authMod = await import('../../auth.js')
        requirePermission = authMod.requirePermission

        const auditMod = await import('../../audit.js')
        logAudit = auditMod.logAudit

        const helperMod = await import('../helpers.js')
        liquidateMarket = helperMod.liquidateMarket
    })

    describe('adminToggleStatus', () => {
        it('returns 401 when not authorized', async () => {
            requirePermission.mockResolvedValue(null)
            const sql = vi.fn()
            const res = await adminToggleStatus(sql, {}, {}, { seasonId: 1, status: 'closed' })
            expect(res.statusCode).toBe(401)
        })

        it('returns 400 for invalid status', async () => {
            requirePermission.mockResolvedValue({ id: 1 })
            const sql = vi.fn()
            const res = await adminToggleStatus(sql, {}, {}, { seasonId: 1, status: 'invalid' })
            expect(res.statusCode).toBe(400)
        })

        it('returns 404 when market not found', async () => {
            requirePermission.mockResolvedValue({ id: 1 })
            const sql = vi.fn(async () => [])
            const res = await adminToggleStatus(sql, {}, {}, { seasonId: 1, status: 'closed' })
            expect(res.statusCode).toBe(404)
        })

        it('toggles market status and logs audit', async () => {
            requirePermission.mockResolvedValue({ id: 1, discord_username: 'admin' })
            const sql = vi.fn()
            // First call: SELECT market
            sql.mockResolvedValueOnce([{ id: 10, status: 'open' }])
            // Second call: UPDATE
            sql.mockResolvedValueOnce([])

            const res = await adminToggleStatus(sql, {}, {}, { seasonId: 1, status: 'closed' })
            expect(res.statusCode).toBe(200)
            expect(JSON.parse(res.body).success).toBe(true)
            expect(logAudit).toHaveBeenCalledTimes(1)
        })

        it('rejects toggling a liquidated market', async () => {
            requirePermission.mockResolvedValue({ id: 1 })
            const sql = vi.fn(async () => [{ id: 10, status: 'liquidated' }])
            const res = await adminToggleStatus(sql, {}, {}, { seasonId: 1, status: 'open' })
            expect(res.statusCode).toBe(400)
            expect(JSON.parse(res.body).error).toContain('liquidated')
        })
    })

    describe('adminLiquidate', () => {
        it('returns 401 when not authorized', async () => {
            requirePermission.mockResolvedValue(null)
            const sql = vi.fn()
            const res = await adminLiquidate(sql, {}, {}, { seasonId: 1 })
            expect(res.statusCode).toBe(401)
        })

        it('returns 400 when seasonId missing', async () => {
            requirePermission.mockResolvedValue({ id: 1 })
            const sql = vi.fn()
            const res = await adminLiquidate(sql, {}, {}, {})
            expect(res.statusCode).toBe(400)
        })

        it('calls liquidateMarket and logs audit', async () => {
            requirePermission.mockResolvedValue({ id: 1, discord_username: 'admin' })
            const sql = vi.fn(async () => [{ id: 10, status: 'open' }])

            const res = await adminLiquidate(sql, {}, {}, { seasonId: 1 })
            expect(res.statusCode).toBe(200)
            expect(liquidateMarket).toHaveBeenCalledWith(sql, 10)
            expect(logAudit).toHaveBeenCalledTimes(1)
        })
    })
})


describe('trading handlers', () => {
    let fuel, cool
    let loadForgeConfig, executeFuel, executeCool
    let transaction

    beforeEach(async () => {
        vi.clearAllMocks()
        const tradingMod = await import('../trading.js')
        fuel = tradingMod.fuel
        cool = tradingMod.cool

        const helperMod = await import('../helpers.js')
        loadForgeConfig = helperMod.loadForgeConfig
        executeFuel = helperMod.executeFuel
        executeCool = helperMod.executeCool

        const dbMod = await import('../../db.js')
        transaction = dbMod.transaction
    })

    describe('fuel', () => {
        const user = { id: 1 }
        const event = { waitUntil: vi.fn() }

        it('returns 400 when sparkId is missing', async () => {
            const sql = vi.fn()
            const res = await fuel(sql, user, {}, event)
            expect(res.statusCode).toBe(400)
        })

        it('returns 400 when sparks > 10', async () => {
            const sql = vi.fn()
            const res = await fuel(sql, user, { sparkId: 1, sparks: 11 }, event)
            expect(res.statusCode).toBe(400)
            expect(JSON.parse(res.body).error).toContain('Maximum 10')
        })

        it('returns 400 when fueling is locked', async () => {
            loadForgeConfig.mockResolvedValueOnce({ FUELING_LOCKED: true })
            const sql = vi.fn()
            const res = await fuel(sql, user, { sparkId: 1, sparks: 1 }, event)
            expect(res.statusCode).toBe(400)
            expect(JSON.parse(res.body).error).toContain('locked')
        })

        it('returns 400 when trading own team player', async () => {
            const sql = vi.fn(async () => [{ '?column?': 1 }])
            const res = await fuel(sql, user, { sparkId: 1, sparks: 1 }, event)
            expect(res.statusCode).toBe(400)
            expect(JSON.parse(res.body).error).toContain('own team')
        })

        it('executes fuel and returns result', async () => {
            // sql returns nothing for own-team check
            const sql = vi.fn(async () => [])
            executeFuel.mockResolvedValueOnce({ newPrice: 55, totalCost: 100, holding: { sparks: 2 } })
            transaction.mockImplementation(async (fn) => fn(vi.fn()))

            const res = await fuel(sql, user, { sparkId: 1, sparks: 2 }, event)
            expect(res.statusCode).toBe(200)
            const body = JSON.parse(res.body)
            expect(body.success).toBe(true)
            expect(body.newPrice).toBe(55)
            expect(body.totalCost).toBe(100)
        })
    })

    describe('cool', () => {
        const user = { id: 1 }
        const event = { waitUntil: vi.fn() }

        it('returns 400 when sparkId is missing', async () => {
            const sql = vi.fn()
            const res = await cool(sql, user, {}, event)
            expect(res.statusCode).toBe(400)
        })

        it('returns 400 when cooling is locked', async () => {
            loadForgeConfig.mockResolvedValueOnce({ COOLING_LOCKED: true })
            const sql = vi.fn()
            const res = await cool(sql, user, { sparkId: 1, sparks: 1 }, event)
            expect(res.statusCode).toBe(400)
            expect(JSON.parse(res.body).error).toContain('locked')
        })

        it('executes cool and returns result', async () => {
            const sql = vi.fn(async () => [])
            executeCool.mockResolvedValueOnce({
                newPrice: 48, grossProceeds: 100, coolingTax: 10,
                netProceeds: 90, profit: 40, holding: null,
            })
            transaction.mockImplementation(async (fn) => fn(vi.fn()))

            const res = await cool(sql, user, { sparkId: 1, sparks: 1 }, event)
            expect(res.statusCode).toBe(200)
            const body = JSON.parse(res.body)
            expect(body.success).toBe(true)
            expect(body.coolingTax).toBe(10)
            expect(body.netProceeds).toBe(90)
        })
    })
})


describe('referral handlers', () => {
    let claimForgeReferral
    let processForgeReferral

    beforeEach(async () => {
        vi.clearAllMocks()
        const mod = await import('../referral.js')
        claimForgeReferral = mod.claimForgeReferral

        const refMod = await import('../../referrals.js')
        processForgeReferral = refMod.processForgeReferral
    })

    describe('claimForgeReferral', () => {
        it('returns 400 when refCode is missing', async () => {
            const sql = vi.fn()
            const res = await claimForgeReferral(sql, { id: 1 }, {})
            expect(res.statusCode).toBe(400)
        })

        it('returns 400 for invalid referral code', async () => {
            const sql = vi.fn(async () => [])
            const res = await claimForgeReferral(sql, { id: 1 }, { refCode: 'BAD' })
            expect(res.statusCode).toBe(400)
            expect(JSON.parse(res.body).error).toContain('Invalid')
        })

        it('returns 400 when already referred', async () => {
            const sql = vi.fn(async () => [{ id: 2 }])
            processForgeReferral.mockResolvedValue(null)
            const res = await claimForgeReferral(sql, { id: 1 }, { refCode: 'ABC123' })
            expect(res.statusCode).toBe(400)
            expect(JSON.parse(res.body).error).toContain('Already')
        })

        it('returns success on valid claim', async () => {
            const sql = vi.fn(async () => [{ id: 2 }])
            processForgeReferral.mockResolvedValue(true)
            const res = await claimForgeReferral(sql, { id: 1 }, { refCode: 'ABC123' })
            expect(res.statusCode).toBe(200)
            expect(JSON.parse(res.body).success).toBe(true)
        })
    })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Test the CTE response mapping — that aliased column names are correctly
// mapped to the JSON response shape, avoiding column name collisions.

const mockSql = vi.fn()
const mockRequireAuth = vi.fn()

vi.mock('../../lib/db.js', () => ({
    getDB: () => mockSql,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
}))

vi.mock('../../lib/auth.js', () => ({
    requireAuth: (...args) => mockRequireAuth(...args),
}))

vi.mock('../../lib/passion.js', () => ({
    grantPassion: vi.fn(),
    checkCooldown: vi.fn(),
    getRank: (earned) => ({ name: earned >= 800 ? 'Bronze' : 'Clay', division: earned >= 800 ? 'III' : null }),
    getNextRank: (earned) => earned < 800 ? { name: 'Bronze', division: 'III', minPassion: 800, passionNeeded: 800 - earned } : null,
    formatRank: (r) => r.division ? `${r.name} ${r.division}` : r.name,
    EARNING_RULES: {},
}))

vi.mock('../../lib/challenges.js', () => ({
    pushChallengeProgress: vi.fn(),
}))

vi.mock('../../lib/ember.js', () => ({
    getConversionCost: (count) => 100 + count * 50,
    EMBER_RULES: {
        conversion_ember_amount: 10,
        conversion_multiplier: 1.5,
        conversion_base_passion: 100,
    },
}))

vi.mock('../../lib/adapter.js', () => ({
    adapt: (handler) => handler,
}))

// CTE row with aliased columns — simulates what neon() returns
const mockCTERow = {
    passion_balance: 500,
    total_earned: 850,
    total_spent: 100,
    passion_last_claim: '2026-03-08T00:00:00Z',
    passion_streak: 3,
    passion_longest_streak: 7,
    ember_balance: 200,
    ember_last_claim: null,
    ember_streak: 2,
    ember_longest_streak: 5,
    conversions_today: 1,
    last_conversion_date: '2026-03-09',
    total_count: '2',
    vault_count: '1',
    in_discord: true,
}

beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ id: 42 })
    mockSql.mockResolvedValue([mockCTERow])
})

describe('passion balance endpoint — CTE response mapping', () => {
    it('returns correct response shape from CTE query', async () => {
        const mod = await import('../passion.js')
        const handler = mod.onRequest

        const event = {
            httpMethod: 'GET',
            queryStringParameters: { action: 'balance' },
        }

        const response = await handler(event)
        const body = JSON.parse(response.body)

        // Passion fields
        expect(body.balance).toBe(500)
        expect(body.totalEarned).toBe(850)
        expect(body.totalSpent).toBe(100)
        expect(body.currentStreak).toBe(3)
        expect(body.longestStreak).toBe(7)
        expect(body.lastDailyClaim).toBe('2026-03-08T00:00:00Z')
        expect(body.claimableCount).toBe(2)
        expect(body.vaultClaimableCount).toBe(1)
        expect(body.inDiscord).toBe(true)

        // Ember fields
        expect(body.ember).toBeDefined()
        expect(body.ember.balance).toBe(200)
        expect(body.ember.currentStreak).toBe(2)
        expect(body.ember.longestStreak).toBe(5)
        // conversionsToday resets to 0 when last_conversion_date is not today
        expect(body.ember.conversionsToday).toBe(0)

        // Static config fields from EMBER_RULES
        expect(body.ember.conversionEmberAmount).toBe(10)
        expect(body.ember.conversionMultiplier).toBe(1.5)
        expect(body.ember.conversionBaseCost).toBe(100)
        expect(body.ember.nextConversionCost).toBe(100) // getConversionCost(0) = 100 + 0*50

        // Rank fields
        expect(body.rank).toBeDefined()
        expect(body.rank.name).toBe('Bronze')
        expect(body.nextRank).toBeDefined()

        expect(typeof body.canClaimDaily).toBe('boolean')
        expect(typeof body.ember.canClaimDaily).toBe('boolean')
    })

    it('only makes one sql call (single CTE)', async () => {
        const mod = await import('../passion.js')
        const handler = mod.onRequest

        const event = {
            httpMethod: 'GET',
            queryStringParameters: { action: 'balance' },
        }

        await handler(event)
        expect(mockSql).toHaveBeenCalledTimes(1)
    })

    it('maps passion and ember balances without column name collision', async () => {
        const mod = await import('../passion.js')
        const handler = mod.onRequest

        const event = {
            httpMethod: 'GET',
            queryStringParameters: { action: 'balance' },
        }

        const response = await handler(event)
        const body = JSON.parse(response.body)

        // The critical test: passion balance and ember balance must be different
        // If aliasing is broken, one would overwrite the other.
        expect(body.balance).toBe(500)       // passion
        expect(body.ember.balance).toBe(200) // ember
        expect(body.balance).not.toBe(body.ember.balance)

        // Same for streaks
        expect(body.currentStreak).toBe(3)       // passion
        expect(body.ember.currentStreak).toBe(2) // ember
        expect(body.currentStreak).not.toBe(body.ember.currentStreak)

        // And longest streaks
        expect(body.longestStreak).toBe(7)           // passion
        expect(body.ember.longestStreak).toBe(5)     // ember
    })
})

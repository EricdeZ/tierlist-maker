import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the core module — we want to verify service methods call the right endpoints
const mockApiCall = vi.fn().mockResolvedValue({})
const mockApiPost = vi.fn().mockResolvedValue({})

vi.mock('../core', () => ({
    API_BASE: '/api',
    apiCall: (...args: any[]) => mockApiCall(...args),
    apiPost: (...args: any[]) => mockApiPost(...args),
}))

import { matchService, statsService } from '../matches'
import { leagueService, teamService, playerService, standingsService, profileService, globalPlayerService } from '../league'
import { passionService, coinflipService, challengeService } from '../passion'
import { forgeService, referralService, predictionsService } from '../forge'
import { orgService, scrimService, communityTeamService } from '../community'

beforeEach(() => {
    mockApiCall.mockClear()
    mockApiPost.mockClear()
})

// ── Matches ──

describe('matchService', () => {
    it('getAllBySeason calls apiCall with matches endpoint', async () => {
        mockApiCall.mockResolvedValue({ matches: [] })
        await matchService.getAllBySeason(5)
        expect(mockApiCall).toHaveBeenCalledWith('matches', { seasonId: 5 })
    })

    it('getAllBySeason passes limit when provided', async () => {
        mockApiCall.mockResolvedValue({ matches: [] })
        await matchService.getAllBySeason(5, 10)
        expect(mockApiCall).toHaveBeenCalledWith('matches', { seasonId: 5, limit: 10 })
    })

    it('getAllBySeason handles array response', async () => {
        const matches = [{ id: 1 }, { id: 2 }]
        mockApiCall.mockResolvedValue(matches)
        const result = await matchService.getAllBySeason(5)
        expect(result).toEqual(matches)
    })

    it('getById calls apiCall with match-detail endpoint', async () => {
        await matchService.getById(42)
        expect(mockApiCall).toHaveBeenCalledWith('match-detail', { matchId: 42 })
    })
})

describe('statsService', () => {
    it('getPlayerStats calls apiCall with players type', async () => {
        await statsService.getPlayerStats(10)
        expect(mockApiCall).toHaveBeenCalledWith('stats', { seasonId: 10, type: 'players' })
    })

    it('getPlayerGameStats includes playerId', async () => {
        await statsService.getPlayerGameStats(10, 99)
        expect(mockApiCall).toHaveBeenCalledWith('stats', { seasonId: 10, type: 'player-games', playerId: 99 })
    })
})

// ── League ──

describe('leagueService', () => {
    it('getAll calls apiCall with leagues endpoint', async () => {
        await leagueService.getAll()
        expect(mockApiCall).toHaveBeenCalledWith('leagues')
    })

    it('getBySlug passes slug parameter', async () => {
        await leagueService.getBySlug('agl')
        expect(mockApiCall).toHaveBeenCalledWith('leagues', { slug: 'agl' })
    })
})

describe('teamService', () => {
    it('getAllBySeason calls apiCall with teams endpoint', async () => {
        await teamService.getAllBySeason(7)
        expect(mockApiCall).toHaveBeenCalledWith('teams', { seasonId: 7 })
    })
})

describe('playerService', () => {
    it('getAllBySeason calls apiCall with players endpoint', async () => {
        await playerService.getAllBySeason(3)
        expect(mockApiCall).toHaveBeenCalledWith('players', { seasonId: 3 })
    })

    it('getPlayerSummaryStats includes playerId', async () => {
        await playerService.getPlayerSummaryStats(55, 3)
        expect(mockApiCall).toHaveBeenCalledWith('players', { seasonId: 3, playerId: 55 })
    })
})

// ── Passion ──

describe('passionService', () => {
    it('getBalance calls apiCall with balance action', async () => {
        await passionService.getBalance()
        expect(mockApiCall).toHaveBeenCalledWith('passion', { action: 'balance' })
    })

    it('claimDaily calls apiPost with claim-daily action', async () => {
        await passionService.claimDaily()
        expect(mockApiPost).toHaveBeenCalledWith('passion', { action: 'claim-daily' })
    })

    it('getLeaderboard defaults to recent period', async () => {
        await passionService.getLeaderboard()
        expect(mockApiCall).toHaveBeenCalledWith('passion', { action: 'leaderboard', period: 'recent' })
    })
})

describe('coinflipService', () => {
    it('flip calls apiPost with flip action', async () => {
        await coinflipService.flip()
        expect(mockApiPost).toHaveBeenCalledWith('coinflip', { action: 'flip' })
    })

    it('getLeaderboard calls apiCall', async () => {
        await coinflipService.getLeaderboard()
        expect(mockApiCall).toHaveBeenCalledWith('coinflip', { action: 'leaderboard' })
    })
})

describe('challengeService', () => {
    it('getAll calls apiCall with challenges endpoint', async () => {
        await challengeService.getAll()
        expect(mockApiCall).toHaveBeenCalledWith('challenges')
    })

    it('claim calls apiPost with challenge id', async () => {
        await challengeService.claim(5)
        expect(mockApiPost).toHaveBeenCalledWith('challenges', { action: 'claim' }, { challengeId: 5 })
    })
})

// ── Forge ──

describe('forgeService', () => {
    it('getMarket calls apiCall with market action', async () => {
        await forgeService.getMarket(10)
        expect(mockApiCall).toHaveBeenCalledWith('forge', { action: 'market', seasonId: 10 })
    })

    it('fuel calls apiPost with sparkId and sparks', async () => {
        await forgeService.fuel(7, 100)
        expect(mockApiPost).toHaveBeenCalledWith('forge', { action: 'fuel' }, { sparkId: 7, sparks: 100 })
    })

    it('cool calls apiPost with sparkId and sparks', async () => {
        await forgeService.cool(7, 50)
        expect(mockApiPost).toHaveBeenCalledWith('forge', { action: 'cool' }, { sparkId: 7, sparks: 50 })
    })

    it('getPortfolio calls apiCall with portfolio action', async () => {
        await forgeService.getPortfolio(10)
        expect(mockApiCall).toHaveBeenCalledWith('forge', { action: 'portfolio', seasonId: 10 })
    })
})

describe('referralService', () => {
    it('getMyStats calls apiCall with my-stats action', async () => {
        await referralService.getMyStats()
        expect(mockApiCall).toHaveBeenCalledWith('referrals', { action: 'my-stats' })
    })

    it('claimReferral calls apiPost with code and type', async () => {
        await referralService.claimReferral('ABC123', 'signup')
        expect(mockApiPost).toHaveBeenCalledWith('referrals', { action: 'claim' }, { code: 'ABC123', type: 'signup' })
    })
})

describe('predictionsService', () => {
    it('getUpcoming calls apiCall with upcoming action', async () => {
        await predictionsService.getUpcoming({ seasonId: 5 })
        expect(mockApiCall).toHaveBeenCalledWith('predictions', { action: 'upcoming', seasonId: 5 })
    })

    it('predict calls apiPost with prediction data', async () => {
        const data = { scheduledMatchId: 1, teamId: 2, amount: 50 }
        await predictionsService.predict(data)
        expect(mockApiPost).toHaveBeenCalledWith('predictions', { action: 'predict' }, data)
    })
})

// ── Community ──

describe('orgService', () => {
    it('getBySlug calls apiCall with slug', async () => {
        await orgService.getBySlug('my-org')
        expect(mockApiCall).toHaveBeenCalledWith('orgs', { slug: 'my-org' })
    })

    it('getAll calls apiCall with orgs endpoint', async () => {
        await orgService.getAll()
        expect(mockApiCall).toHaveBeenCalledWith('orgs')
    })

    it('create calls apiPost with create action', async () => {
        await orgService.create({ name: 'TestOrg', slug: 'test-org' })
        expect(mockApiPost).toHaveBeenCalledWith('org-manage', {}, { action: 'create', name: 'TestOrg', slug: 'test-org' })
    })
})

describe('scrimService', () => {
    it('list calls apiCall with list action', async () => {
        await scrimService.list({ status: 'open' })
        expect(mockApiCall).toHaveBeenCalledWith('scrim', { action: 'list', status: 'open' })
    })

    it('create calls apiPost with create action', async () => {
        const data = { team_id: 1, mode: 'ranked' }
        await scrimService.create(data)
        expect(mockApiPost).toHaveBeenCalledWith('scrim', { action: 'create' }, data)
    })

    it('cancel calls apiPost with scrim id', async () => {
        await scrimService.cancel(99)
        expect(mockApiPost).toHaveBeenCalledWith('scrim', { action: 'cancel' }, { scrim_id: 99 })
    })
})

describe('communityTeamService', () => {
    it('getMyTeams calls apiCall with my-teams action', async () => {
        await communityTeamService.getMyTeams()
        expect(mockApiCall).toHaveBeenCalledWith('community-teams', { action: 'my-teams' })
    })

    it('create calls apiPost with create action', async () => {
        const data = { name: 'MyTeam', tag: 'MT' }
        await communityTeamService.create(data)
        expect(mockApiPost).toHaveBeenCalledWith('community-teams', { action: 'create' }, data)
    })

    it('searchUsers calls apiCall with query', async () => {
        await communityTeamService.searchUsers('john')
        expect(mockApiCall).toHaveBeenCalledWith('community-teams', { action: 'search-users', q: 'john' })
    })
})

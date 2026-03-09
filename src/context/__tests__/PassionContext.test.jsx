import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// vi.hoisted runs before vi.mock hoisting — safe to reference in factories
const { authState, mockPassionService, mockEmberService } = vi.hoisted(() => ({
    authState: { user: null, loading: false },
    mockPassionService: {
        getBalance: vi.fn(),
        claimDaily: vi.fn(),
        earn: vi.fn(),
    },
    mockEmberService: {
        claimDaily: vi.fn(),
    },
}))

vi.mock('../AuthContext', () => ({
    useAuth: () => authState,
}))

vi.mock('../../services/database', () => ({
    passionService: mockPassionService,
    emberService: mockEmberService,
}))

vi.mock('../../config/ranks', async () => {
    const RANK_THRESHOLDS = [
        { minPassion: 0,    name: 'Clay',    division: null,  image: null },
        { minPassion: 200,  name: 'Amber',   division: 'III', image: null },
        { minPassion: 400,  name: 'Amber',   division: 'II',  image: null },
        { minPassion: 600,  name: 'Amber',   division: 'I',   image: null },
        { minPassion: 800,  name: 'Bronze',  division: 'III', image: null },
        { minPassion: 1000, name: 'Bronze',  division: 'II',  image: null },
        { minPassion: 5000, name: 'Demigod', division: null,  image: null },
        { minPassion: 5500, name: 'Deity',   division: null,  image: null },
    ]

    function getRank(totalEarned) {
        let rank = RANK_THRESHOLDS[0]
        for (const threshold of RANK_THRESHOLDS) {
            if (totalEarned >= threshold.minPassion) {
                rank = threshold
            } else {
                break
            }
        }
        return rank
    }

    function getNextRank(totalEarned) {
        for (let i = 0; i < RANK_THRESHOLDS.length; i++) {
            if (totalEarned < RANK_THRESHOLDS[i].minPassion) {
                return {
                    ...RANK_THRESHOLDS[i],
                    passionNeeded: RANK_THRESHOLDS[i].minPassion - totalEarned,
                }
            }
        }
        return null
    }

    return { RANK_THRESHOLDS, getRank, getNextRank }
})

import { PassionProvider, usePassion } from '../PassionContext'
import { getRank, getNextRank } from '../../config/ranks'

function wrapper({ children }) {
    return (
        <MemoryRouter>
            <PassionProvider>{children}</PassionProvider>
        </MemoryRouter>
    )
}

const defaultBalanceResponse = {
    balance: 500,
    totalEarned: 850,
    currentStreak: 3,
    longestStreak: 7,
    canClaimDaily: true,
    lastDailyClaim: '2026-03-08T00:00:00Z',
    claimableCount: 2,
    inDiscord: true,
    ember: { balance: 100, currentStreak: 2, canClaimDaily: true, lastDailyClaim: null },
}

beforeEach(() => {
    vi.clearAllMocks()
    authState.user = null
    authState.loading = false
    mockPassionService.getBalance.mockResolvedValue(defaultBalanceResponse)
})

describe('PassionContext', () => {
    // 1. Initial state
    describe('initial state', () => {
        it('has balance 0, loading true (while auth loading), no rank-up info', () => {
            authState.loading = true
            const { result } = renderHook(() => usePassion(), { wrapper })

            expect(result.current.balance).toBe(0)
            expect(result.current.loading).toBe(true)
            expect(result.current.rankUpInfo).toBeNull()
            expect(result.current.totalEarned).toBe(0)
            expect(result.current.currentStreak).toBe(0)
            expect(result.current.canClaimDaily).toBe(false)
            expect(result.current.challengeNotifications).toEqual([])
        })

        it('sets loading false when no user and auth not loading', async () => {
            const { result } = renderHook(() => usePassion(), { wrapper })
            await waitFor(() => expect(result.current.loading).toBe(false))
            expect(result.current.balance).toBe(0)
        })
    })

    // 2. Balance fetch on user login
    describe('balance fetch on user login', () => {
        it('fetches passion and ember balances when user is present', async () => {
            authState.user = { id: 1, username: 'testuser' }

            const { result } = renderHook(() => usePassion(), { wrapper })

            await waitFor(() => expect(result.current.loading).toBe(false))

            expect(mockPassionService.getBalance).toHaveBeenCalledOnce()
            expect(result.current.balance).toBe(500)
            expect(result.current.totalEarned).toBe(850)
            expect(result.current.currentStreak).toBe(3)
            expect(result.current.longestStreak).toBe(7)
            expect(result.current.canClaimDaily).toBe(true)
            expect(result.current.lastDailyClaim).toBe('2026-03-08T00:00:00Z')
            expect(result.current.claimableCount).toBe(2)
            expect(result.current.inDiscord).toBe(true)
            expect(result.current.ember).toEqual({
                balance: 100,
                currentStreak: 2,
                canClaimDaily: true,
                lastDailyClaim: null,
            })
        })

        it('handles API error gracefully on balance fetch', async () => {
            authState.user = { id: 1 }
            mockPassionService.getBalance.mockRejectedValueOnce(new Error('Network error'))

            const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {})
            const { result } = renderHook(() => usePassion(), { wrapper })

            await waitFor(() => expect(result.current.loading).toBe(false))

            expect(result.current.balance).toBe(0)
            consoleErr.mockRestore()
        })
    })

    // 3. Balance reset on logout
    describe('balance reset on logout', () => {
        it('resets all state to defaults when user becomes null', async () => {
            authState.user = { id: 1 }
            const { result, rerender } = renderHook(() => usePassion(), { wrapper })

            await waitFor(() => expect(result.current.loading).toBe(false))
            expect(result.current.balance).toBe(500)

            authState.user = null
            rerender()

            await waitFor(() => expect(result.current.balance).toBe(0))
            expect(result.current.totalEarned).toBe(0)
            expect(result.current.currentStreak).toBe(0)
            expect(result.current.longestStreak).toBe(0)
            expect(result.current.canClaimDaily).toBe(false)
            expect(result.current.lastDailyClaim).toBeNull()
            expect(result.current.claimableCount).toBe(0)
            expect(result.current.inDiscord).toBe(false)
            expect(result.current.ember).toEqual({
                balance: 0,
                currentStreak: 0,
                canClaimDaily: false,
                lastDailyClaim: null,
            })
        })
    })

    // 4. claimDaily
    describe('claimDaily', () => {
        it('calls passionService.claimDaily and updates balance + streak', async () => {
            authState.user = { id: 1 }
            const claimResult = {
                balance: 550,
                totalEarned: 900,
                streak: 4,
                rankedUp: false,
            }
            mockPassionService.claimDaily.mockResolvedValue(claimResult)

            const { result } = renderHook(() => usePassion(), { wrapper })
            await waitFor(() => expect(result.current.loading).toBe(false))

            let claimResponse
            await act(async () => {
                claimResponse = await result.current.claimDaily()
            })

            expect(mockPassionService.claimDaily).toHaveBeenCalledOnce()
            expect(claimResponse).toEqual(claimResult)
            expect(result.current.balance).toBe(550)
            expect(result.current.totalEarned).toBe(900)
            expect(result.current.currentStreak).toBe(4)
            expect(result.current.canClaimDaily).toBe(false)
        })

        it('returns result without updating state when alreadyClaimed', async () => {
            authState.user = { id: 1 }
            mockPassionService.claimDaily.mockResolvedValue({ alreadyClaimed: true })

            const { result } = renderHook(() => usePassion(), { wrapper })
            await waitFor(() => expect(result.current.loading).toBe(false))

            const originalBalance = result.current.balance
            let claimResponse
            await act(async () => {
                claimResponse = await result.current.claimDaily()
            })

            expect(claimResponse.alreadyClaimed).toBe(true)
            expect(result.current.balance).toBe(originalBalance)
        })

        it('returns null when no user', async () => {
            const { result } = renderHook(() => usePassion(), { wrapper })
            await waitFor(() => expect(result.current.loading).toBe(false))

            let claimResponse
            await act(async () => {
                claimResponse = await result.current.claimDaily()
            })

            expect(claimResponse).toBeNull()
            expect(mockPassionService.claimDaily).not.toHaveBeenCalled()
        })

        it('triggers rank-up when result has rankedUp', async () => {
            authState.user = { id: 1 }
            mockPassionService.claimDaily.mockResolvedValue({
                balance: 1050,
                totalEarned: 1050,
                streak: 5,
                rankedUp: true,
                rank: { name: 'Bronze', division: 'II' },
            })

            const { result } = renderHook(() => usePassion(), { wrapper })
            await waitFor(() => expect(result.current.loading).toBe(false))

            await act(async () => {
                await result.current.claimDaily()
            })

            expect(result.current.rankUpInfo).toEqual({
                rank: { name: 'Bronze', division: 'II' },
            })
        })

        it('adds challenge notifications when newlyClaimable is present', async () => {
            authState.user = { id: 1 }
            mockPassionService.claimDaily.mockResolvedValue({
                balance: 600,
                totalEarned: 950,
                streak: 4,
                rankedUp: false,
                newlyClaimable: [
                    { id: 1, name: 'First Steps' },
                    { id: 2, name: 'Streak Master' },
                ],
            })

            const { result } = renderHook(() => usePassion(), { wrapper })
            await waitFor(() => expect(result.current.loading).toBe(false))

            await act(async () => {
                await result.current.claimDaily()
            })

            expect(result.current.challengeNotifications).toHaveLength(2)
            expect(result.current.challengeNotifications[0]).toMatchObject({ id: 1, name: 'First Steps' })
            expect(result.current.challengeNotifications[1]).toMatchObject({ id: 2, name: 'Streak Master' })
            expect(result.current.challengeNotifications[0].notifId).toBeDefined()
        })
    })

    // 5. claimEmberDaily
    describe('claimEmberDaily', () => {
        it('calls emberService.claimDaily and updates ember state', async () => {
            authState.user = { id: 1 }
            mockEmberService.claimDaily.mockResolvedValue({
                balance: 150,
                streak: 3,
            })

            const { result } = renderHook(() => usePassion(), { wrapper })
            await waitFor(() => expect(result.current.loading).toBe(false))

            let claimResponse
            await act(async () => {
                claimResponse = await result.current.claimEmberDaily()
            })

            expect(mockEmberService.claimDaily).toHaveBeenCalledOnce()
            expect(claimResponse).toEqual({ balance: 150, streak: 3 })
            expect(result.current.ember.balance).toBe(150)
            expect(result.current.ember.currentStreak).toBe(3)
            expect(result.current.ember.canClaimDaily).toBe(false)
        })

        it('returns result without updating state when alreadyClaimed', async () => {
            authState.user = { id: 1 }
            mockEmberService.claimDaily.mockResolvedValue({ alreadyClaimed: true })

            const { result } = renderHook(() => usePassion(), { wrapper })
            await waitFor(() => expect(result.current.loading).toBe(false))

            const originalEmber = result.current.ember
            let claimResponse
            await act(async () => {
                claimResponse = await result.current.claimEmberDaily()
            })

            expect(claimResponse.alreadyClaimed).toBe(true)
            expect(result.current.ember.canClaimDaily).toBe(originalEmber.canClaimDaily)
        })

        it('returns null when no user', async () => {
            const { result } = renderHook(() => usePassion(), { wrapper })
            await waitFor(() => expect(result.current.loading).toBe(false))

            let response
            await act(async () => {
                response = await result.current.claimEmberDaily()
            })

            expect(response).toBeNull()
            expect(mockEmberService.claimDaily).not.toHaveBeenCalled()
        })
    })

    // 6. trackAction
    describe('trackAction', () => {
        it('calls passionService.earn with type and referenceId', async () => {
            authState.user = { id: 1 }
            mockPassionService.earn.mockResolvedValue({ earned: 10 })

            const { result } = renderHook(() => usePassion(), { wrapper })
            await waitFor(() => expect(result.current.loading).toBe(false))

            let trackResult
            await act(async () => {
                trackResult = await result.current.trackAction('tier_list_created', 'ref-123')
            })

            expect(mockPassionService.earn).toHaveBeenCalledWith('tier_list_created', 'ref-123')
            expect(trackResult).toEqual({ earned: 10 })
        })

        it('uses null referenceId by default', async () => {
            authState.user = { id: 1 }
            mockPassionService.earn.mockResolvedValue({ earned: 5 })

            const { result } = renderHook(() => usePassion(), { wrapper })
            await waitFor(() => expect(result.current.loading).toBe(false))

            await act(async () => {
                await result.current.trackAction('page_visit')
            })

            expect(mockPassionService.earn).toHaveBeenCalledWith('page_visit', null)
        })

        it('adds challenge notifications from trackAction result', async () => {
            authState.user = { id: 1 }
            mockPassionService.earn.mockResolvedValue({
                earned: 10,
                newlyClaimable: [{ id: 5, name: 'Explorer' }],
            })

            const { result } = renderHook(() => usePassion(), { wrapper })
            await waitFor(() => expect(result.current.loading).toBe(false))

            await act(async () => {
                await result.current.trackAction('page_visit')
            })

            expect(result.current.challengeNotifications).toHaveLength(1)
            expect(result.current.challengeNotifications[0]).toMatchObject({ id: 5, name: 'Explorer' })
        })

        it('returns null when no user', async () => {
            const { result } = renderHook(() => usePassion(), { wrapper })
            await waitFor(() => expect(result.current.loading).toBe(false))

            let response
            await act(async () => {
                response = await result.current.trackAction('page_visit')
            })

            expect(response).toBeNull()
        })
    })

    // 7. Rank calculation
    describe('rank calculation', () => {
        it('getRank returns Clay for 0 earned', () => {
            expect(getRank(0)).toMatchObject({ name: 'Clay', minPassion: 0 })
        })

        it('getRank returns Amber III for 200 earned', () => {
            expect(getRank(200)).toMatchObject({ name: 'Amber', division: 'III' })
        })

        it('getRank returns Bronze III for 850 earned (between thresholds)', () => {
            expect(getRank(850)).toMatchObject({ name: 'Bronze', division: 'III', minPassion: 800 })
        })

        it('getRank returns Deity for max passion', () => {
            expect(getRank(5500)).toMatchObject({ name: 'Deity' })
        })

        it('getNextRank returns next threshold and passionNeeded', () => {
            const next = getNextRank(150)
            expect(next).toMatchObject({ name: 'Amber', division: 'III', minPassion: 200, passionNeeded: 50 })
        })

        it('getNextRank returns null at max rank', () => {
            expect(getNextRank(5500)).toBeNull()
        })

        it('context exposes computed rank and nextRank from totalEarned', async () => {
            authState.user = { id: 1 }
            mockPassionService.getBalance.mockResolvedValue({
                ...defaultBalanceResponse,
                totalEarned: 850,
            })

            const { result } = renderHook(() => usePassion(), { wrapper })
            await waitFor(() => expect(result.current.loading).toBe(false))

            expect(result.current.rank).toMatchObject({ name: 'Bronze', division: 'III' })
            expect(result.current.nextRank).toMatchObject({ name: 'Bronze', division: 'II', passionNeeded: 150 })
        })
    })

    // 8. Rank-up notification
    describe('rank-up notification', () => {
        it('rankUpInfo is set when claimDaily returns rankedUp', async () => {
            authState.user = { id: 1 }
            mockPassionService.claimDaily.mockResolvedValue({
                balance: 1100,
                totalEarned: 1100,
                streak: 5,
                rankedUp: true,
                rank: { name: 'Bronze', division: 'II' },
            })

            const { result } = renderHook(() => usePassion(), { wrapper })
            await waitFor(() => expect(result.current.loading).toBe(false))

            await act(async () => {
                await result.current.claimDaily()
            })

            expect(result.current.rankUpInfo).toEqual({ rank: { name: 'Bronze', division: 'II' } })
        })

        it('dismissRankUp clears rankUpInfo', async () => {
            authState.user = { id: 1 }
            mockPassionService.claimDaily.mockResolvedValue({
                balance: 1100,
                totalEarned: 1100,
                streak: 5,
                rankedUp: true,
                rank: { name: 'Bronze', division: 'II' },
            })

            const { result } = renderHook(() => usePassion(), { wrapper })
            await waitFor(() => expect(result.current.loading).toBe(false))

            await act(async () => {
                await result.current.claimDaily()
            })
            expect(result.current.rankUpInfo).not.toBeNull()

            act(() => {
                result.current.dismissRankUp()
            })

            expect(result.current.rankUpInfo).toBeNull()
        })

        it('triggerRankUp sets rankUpInfo with overrideRank', () => {
            authState.user = null
            const { result } = renderHook(() => usePassion(), { wrapper })

            act(() => {
                result.current.triggerRankUp({ name: 'Gold', division: 'I' })
            })

            expect(result.current.rankUpInfo).toEqual({
                overrideRank: { name: 'Gold', division: 'I' },
            })
        })
    })

    // 9. Challenge notifications
    describe('challenge notifications', () => {
        it('addChallengeNotification adds notifications with unique notifIds', () => {
            const { result } = renderHook(() => usePassion(), { wrapper })

            act(() => {
                result.current.addChallengeNotification([
                    { id: 1, name: 'Challenge A' },
                    { id: 2, name: 'Challenge B' },
                ])
            })

            expect(result.current.challengeNotifications).toHaveLength(2)
            const ids = result.current.challengeNotifications.map(n => n.notifId)
            expect(new Set(ids).size).toBe(2)
        })

        it('addChallengeNotification does nothing for empty/null input', () => {
            const { result } = renderHook(() => usePassion(), { wrapper })

            act(() => {
                result.current.addChallengeNotification(null)
            })
            expect(result.current.challengeNotifications).toHaveLength(0)

            act(() => {
                result.current.addChallengeNotification([])
            })
            expect(result.current.challengeNotifications).toHaveLength(0)
        })

        it('dismissChallengeNotification removes by notifId', () => {
            const { result } = renderHook(() => usePassion(), { wrapper })

            act(() => {
                result.current.addChallengeNotification([
                    { id: 1, name: 'A' },
                    { id: 2, name: 'B' },
                ])
            })

            const notifIdToRemove = result.current.challengeNotifications[0].notifId
            act(() => {
                result.current.dismissChallengeNotification(notifIdToRemove)
            })

            expect(result.current.challengeNotifications).toHaveLength(1)
            expect(result.current.challengeNotifications[0]).toMatchObject({ id: 2, name: 'B' })
        })
    })

    // 10. usePassion outside provider
    describe('usePassion outside provider', () => {
        it('throws an error when used outside PassionProvider', () => {
            expect(() => {
                renderHook(() => usePassion())
            }).toThrow('usePassion must be used within a PassionProvider')
        })
    })
})

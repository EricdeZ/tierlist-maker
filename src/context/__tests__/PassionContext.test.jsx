import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

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

vi.mock('../../config/ranks', () => ({
    getRank: (earned) => ({ name: earned >= 800 ? 'Bronze' : 'Clay', division: earned >= 800 ? 'III' : null }),
    getNextRank: (earned) => earned < 800 ? { name: 'Bronze', division: 'III', passionNeeded: 800 - earned } : null,
}))

import { PassionProvider, usePassion } from '../PassionContext'

function wrapper({ children }) {
    return (
        <MemoryRouter>
            <PassionProvider>{children}</PassionProvider>
        </MemoryRouter>
    )
}

const defaultBalance = {
    balance: 500,
    totalEarned: 850,
    currentStreak: 3,
    longestStreak: 7,
    canClaimDaily: true,
    lastDailyClaim: '2026-03-08T00:00:00Z',
    claimableCount: 2,
    vaultClaimableCount: 1,
    inDiscord: true,
    ember: { balance: 100, currentStreak: 2, canClaimDaily: true, lastDailyClaim: null },
}

beforeEach(() => {
    vi.clearAllMocks()
    authState.user = null
    authState.loading = false
    mockPassionService.getBalance.mockResolvedValue(defaultBalance)
})

describe('PassionContext — throttle behavior', () => {
    it('fetches balance on initial login', async () => {
        authState.user = { id: 1 }
        const { result } = renderHook(() => usePassion(), { wrapper })

        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(mockPassionService.getBalance).toHaveBeenCalledOnce()
        expect(result.current.balance).toBe(500)
    })

    it('refreshBalance() skips when called again immediately (throttle)', async () => {
        authState.user = { id: 1 }
        const { result } = renderHook(() => usePassion(), { wrapper })

        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(mockPassionService.getBalance).toHaveBeenCalledTimes(1)

        // Call again immediately — should be throttled
        await act(async () => {
            await result.current.refreshBalance()
        })
        expect(mockPassionService.getBalance).toHaveBeenCalledTimes(1) // Still 1 — skipped
    })

    it('refreshBalance(true) bypasses the throttle', async () => {
        authState.user = { id: 1 }
        const { result } = renderHook(() => usePassion(), { wrapper })

        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(mockPassionService.getBalance).toHaveBeenCalledTimes(1)

        // Force refresh immediately — should NOT be throttled
        await act(async () => {
            await result.current.refreshBalance(true)
        })
        expect(mockPassionService.getBalance).toHaveBeenCalledTimes(2)
    })

    it('resets throttle timer on logout so re-login always fetches', async () => {
        authState.user = { id: 1 }
        const { result, rerender } = renderHook(() => usePassion(), { wrapper })

        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(mockPassionService.getBalance).toHaveBeenCalledTimes(1)

        // Logout
        authState.user = null
        rerender()
        await waitFor(() => expect(result.current.balance).toBe(0))

        // Re-login immediately (within 30s) — should still fetch because timer was reset
        authState.user = { id: 2 }
        rerender()
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(mockPassionService.getBalance).toHaveBeenCalledTimes(2)
    })

    it('does not fetch when user is null', async () => {
        const { result } = renderHook(() => usePassion(), { wrapper })
        await waitFor(() => expect(result.current.loading).toBe(false))

        await act(async () => {
            await result.current.refreshBalance()
        })
        expect(mockPassionService.getBalance).not.toHaveBeenCalled()
    })

    it('does not fetch when user is null even with force=true', async () => {
        const { result } = renderHook(() => usePassion(), { wrapper })
        await waitFor(() => expect(result.current.loading).toBe(false))

        await act(async () => {
            await result.current.refreshBalance(true)
        })
        expect(mockPassionService.getBalance).not.toHaveBeenCalled()
    })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const mockRefreshBalance = vi.fn()

const { mockVaultService } = vi.hoisted(() => ({
    mockVaultService: {
        load: vi.fn(),
        getDefinitionOverrides: vi.fn(),
        loadGifts: vi.fn(),
        loadStartingFive: vi.fn(),
        loadBinder: vi.fn(),
        pendingReveal: vi.fn(),
    },
}))

vi.mock('../../../context/AuthContext', () => ({
    useAuth: () => ({ user: { id: 1 } }),
}))

vi.mock('../../../context/PassionContext', () => ({
    usePassion: () => ({
        balance: 500,
        ember: { balance: 100 },
        refreshBalance: mockRefreshBalance,
        claimEmberDaily: vi.fn(),
    }),
}))

vi.mock('../../../services/database', () => ({
    vaultService: mockVaultService,
    emberService: { convert: vi.fn() },
}))

import { VaultProvider, useVault } from '../VaultContext'

function wrapper({ children }) {
    return <VaultProvider>{children}</VaultProvider>
}

const defaultLoadResponse = {
    collection: [{ id: 1, name: 'Card 1' }],
    stats: { packsOpened: 5 },
    packTypes: [{ id: 1, name: 'Standard' }],
    salePacks: [],
    pendingTradeCount: 0,
    matchTradeCount: 0,
    matchTradePendingCount: 0,
    pendingSignatureCount: 0,
    pendingApprovalCount: 0,
    inventory: [],
    lockedCardIds: [],
    lockedPackIds: [],
    rotationPacks: [],
    templateCache: {},
}

beforeEach(() => {
    vi.clearAllMocks()
    mockVaultService.load.mockResolvedValue(defaultLoadResponse)
    mockVaultService.getDefinitionOverrides.mockResolvedValue({ overrides: {} })
    mockVaultService.loadGifts.mockResolvedValue({ sent: [], received: [], giftsRemaining: 5, giftInventory: [], unseenCount: 0 })
    mockVaultService.loadStartingFive.mockResolvedValue(null)
    mockVaultService.loadBinder.mockResolvedValue({ binder: null, cards: [] })
    mockVaultService.pendingReveal.mockResolvedValue({ pending: null })
})

describe('VaultContext — refreshBalanceWithRetry removal', () => {
    it('calls refreshBalance exactly once (no delayed retry)', async () => {
        const { result } = renderHook(() => useVault(), { wrapper })

        await waitFor(() => expect(result.current.loaded).toBe(true))

        act(() => {
            result.current.refreshBalance()
        })

        expect(mockRefreshBalance).toHaveBeenCalledTimes(1)

        // Wait past the old 3s timeout to confirm no delayed call fires
        await new Promise(r => setTimeout(r, 50))
        expect(mockRefreshBalance).toHaveBeenCalledTimes(1)
    })

    it('loads vault data on mount', async () => {
        const { result } = renderHook(() => useVault(), { wrapper })

        await waitFor(() => expect(result.current.loaded).toBe(true))
        expect(mockVaultService.load).toHaveBeenCalledOnce()
        expect(result.current.collection).toHaveLength(1)
        expect(result.current.stats.packsOpened).toBe(5)
    })
})

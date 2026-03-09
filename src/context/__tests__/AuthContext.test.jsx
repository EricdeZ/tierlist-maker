import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// Mock database.js exports used by AuthContext
const mockSetImpersonation = vi.fn()
const mockClearImpersonation = vi.fn()
const mockClaimReferral = vi.fn()

vi.mock('../../services/database.js', () => ({
    setImpersonation: (...args) => mockSetImpersonation(...args),
    clearImpersonation: (...args) => mockClearImpersonation(...args),
    referralService: {
        claimReferral: (...args) => mockClaimReferral(...args),
    },
}))

import { AuthProvider, useAuth } from '../AuthContext'

// Save the real location so we can restore it
const realLocation = window.location

function mockLocation(overrides = {}) {
    delete window.location
    window.location = {
        ...realLocation,
        search: '',
        pathname: '/',
        origin: 'http://localhost',
        href: 'http://localhost/',
        ...overrides,
    }
}

function wrapper({ children }) {
    return <AuthProvider>{children}</AuthProvider>
}

beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    mockSetImpersonation.mockClear()
    mockClearImpersonation.mockClear()
    mockClaimReferral.mockClear()
    // Default: no URL params
    mockLocation()
    window.history.replaceState = vi.fn()
    // Default: fetch rejects (no token scenario)
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('no fetch'))
})

afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    // Restore real location
    window.location = realLocation
})

// ---- 1. Token capture from URL ----
describe('Token capture from URL', () => {
    it('captures auth_token from URL and stores in localStorage', async () => {
        mockLocation({ search: '?auth_token=abc123' })
        // Token capture triggers a fetch — mock it to succeed so the catch handler doesn't clear it
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                user: { id: '1', username: 'test' },
                linkedPlayer: null,
                permissions: { global: [], byLeague: {} },
            }),
        })

        const { result } = renderHook(() => useAuth(), { wrapper })
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(localStorage.getItem('auth_token')).toBe('abc123')
        expect(result.current.token).toBe('abc123')
    })

    it('captures referral code from URL and stores as pending_referral', async () => {
        mockLocation({ search: '?ref=FRIEND42' })

        const { result } = renderHook(() => useAuth(), { wrapper })
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(localStorage.getItem('pending_referral')).toBe('FRIEND42')
    })

    it('captures forge_ref from URL and stores as pending_forge_referral', async () => {
        mockLocation({ search: '?forge_ref=FORGE99' })

        const { result } = renderHook(() => useAuth(), { wrapper })
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(localStorage.getItem('pending_forge_referral')).toBe('FORGE99')
    })
})

// ---- 2. Token cleanup ----
describe('Token cleanup', () => {
    it('removes auth_token from URL after capture', async () => {
        mockLocation({ search: '?auth_token=abc123' })

        const { result } = renderHook(() => useAuth(), { wrapper })
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(window.history.replaceState).toHaveBeenCalled()
        const call = window.history.replaceState.mock.calls[0]
        // The cleaned URL should not contain auth_token
        expect(call[2]).not.toContain('auth_token')
    })

    it('preserves other URL params when removing auth_token', async () => {
        mockLocation({ search: '?auth_token=abc123&other=keep' })

        const { result } = renderHook(() => useAuth(), { wrapper })
        await waitFor(() => expect(result.current.loading).toBe(false))

        const call = window.history.replaceState.mock.calls[0]
        expect(call[2]).toContain('other=keep')
        expect(call[2]).not.toContain('auth_token')
    })

    it('removes ref param from URL after capture', async () => {
        mockLocation({ search: '?ref=ABC' })

        const { result } = renderHook(() => useAuth(), { wrapper })
        await waitFor(() => expect(result.current.loading).toBe(false))

        const call = window.history.replaceState.mock.calls[0]
        expect(call[2]).not.toContain('ref=')
    })
})

// ---- 3. User fetch ----
describe('User fetch', () => {
    it('fetches /api/auth-me with Bearer token when token exists', async () => {
        localStorage.setItem('auth_token', 'mytoken')
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                user: { id: '1', username: 'testuser', discord_id: '123', discord_avatar: 'av' },
                linkedPlayer: null,
                permissions: { global: ['match_report'], byLeague: {} },
            }),
        })

        const { result } = renderHook(() => useAuth(), { wrapper })
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(globalThis.fetch).toHaveBeenCalledWith('/api/auth-me', {
            headers: { Authorization: 'Bearer mytoken' },
        })
        expect(result.current.user).toEqual({ id: '1', username: 'testuser', discord_id: '123', discord_avatar: 'av' })
        expect(result.current.linkedPlayer).toBeNull()
    })

    it('sends X-Impersonate header when impersonating', async () => {
        localStorage.setItem('auth_token', 'mytoken')
        localStorage.setItem('impersonate_user_id', '42')
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                user: { id: '42', username: 'impersonated' },
                linkedPlayer: null,
                permissions: { global: [], byLeague: {} },
                impersonating: true,
                realUser: { id: '1', username: 'admin' },
            }),
        })

        const { result } = renderHook(() => useAuth(), { wrapper })
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(globalThis.fetch).toHaveBeenCalledWith('/api/auth-me', {
            headers: {
                Authorization: 'Bearer mytoken',
                'X-Impersonate': '42',
            },
        })
        expect(result.current.impersonating).toBe(true)
        expect(result.current.realUser).toEqual({ id: '1', username: 'admin' })
    })

    it('sets loading to false and user to null when no token', async () => {
        const { result } = renderHook(() => useAuth(), { wrapper })
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.user).toBeNull()
        expect(result.current.token).toBeNull()
    })
})

// ---- 4. Permission checks ----
describe('hasPermission', () => {
    const authMeResponse = (perms) => ({
        ok: true,
        json: () => Promise.resolve({
            user: { id: '1', username: 'test' },
            linkedPlayer: null,
            permissions: perms,
        }),
    })

    it('returns true for global permissions (null leagueId)', async () => {
        localStorage.setItem('auth_token', 'tok')
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            authMeResponse({ global: ['match_report', 'roster_manage'], byLeague: {} })
        )

        const { result } = renderHook(() => useAuth(), { wrapper })
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.hasPermission('match_report')).toBe(true)
        expect(result.current.hasPermission('roster_manage')).toBe(true)
    })

    it('returns true for league-scoped permissions matching leagueId', async () => {
        localStorage.setItem('auth_token', 'tok')
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            authMeResponse({ global: [], byLeague: { '5': ['match_report'] } })
        )

        const { result } = renderHook(() => useAuth(), { wrapper })
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.hasPermission('match_report', 5)).toBe(true)
    })

    it('returns false for missing permissions', async () => {
        localStorage.setItem('auth_token', 'tok')
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            authMeResponse({ global: ['match_report'], byLeague: {} })
        )

        const { result } = renderHook(() => useAuth(), { wrapper })
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.hasPermission('league_manage')).toBe(false)
    })

    it('returns false for league-scoped permission with wrong leagueId', async () => {
        localStorage.setItem('auth_token', 'tok')
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            authMeResponse({ global: [], byLeague: { '5': ['match_report'] } })
        )

        const { result } = renderHook(() => useAuth(), { wrapper })
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.hasPermission('match_report', 99)).toBe(false)
    })

    it('returns false when not logged in', async () => {
        // No token set
        const { result } = renderHook(() => useAuth(), { wrapper })
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.hasPermission('match_report')).toBe(false)
    })

    it('global permission matches even when leagueId is passed', async () => {
        localStorage.setItem('auth_token', 'tok')
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            authMeResponse({ global: ['match_report'], byLeague: {} })
        )

        const { result } = renderHook(() => useAuth(), { wrapper })
        await waitFor(() => expect(result.current.loading).toBe(false))

        // Global perms apply regardless of leagueId
        expect(result.current.hasPermission('match_report', 5)).toBe(true)
    })
})

// ---- 5. hasAnyPermission ----
describe('hasAnyPermission', () => {
    it('returns true when user has at least one global permission', async () => {
        localStorage.setItem('auth_token', 'tok')
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                user: { id: '1', username: 'test' },
                linkedPlayer: null,
                permissions: { global: ['match_report'], byLeague: {} },
            }),
        })

        const { result } = renderHook(() => useAuth(), { wrapper })
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.hasAnyPermission).toBe(true)
    })

    it('returns true when user has at least one league-scoped permission', async () => {
        localStorage.setItem('auth_token', 'tok')
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                user: { id: '1', username: 'test' },
                linkedPlayer: null,
                permissions: { global: [], byLeague: { '3': ['roster_manage'] } },
            }),
        })

        const { result } = renderHook(() => useAuth(), { wrapper })
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.hasAnyPermission).toBe(true)
    })

    it('returns false when user has no permissions', async () => {
        localStorage.setItem('auth_token', 'tok')
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                user: { id: '1', username: 'test' },
                linkedPlayer: null,
                permissions: { global: [], byLeague: {} },
            }),
        })

        const { result } = renderHook(() => useAuth(), { wrapper })
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.hasAnyPermission).toBe(false)
    })

    it('returns false when not logged in', async () => {
        const { result } = renderHook(() => useAuth(), { wrapper })
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.hasAnyPermission).toBe(false)
    })
})

// ---- 6. Login ----
describe('login', () => {
    it('redirects to Discord OAuth URL with correct params', async () => {
        import.meta.env.VITE_DISCORD_CLIENT_ID = 'test-client-id'

        const { result } = renderHook(() => useAuth(), { wrapper })
        await waitFor(() => expect(result.current.loading).toBe(false))

        act(() => result.current.login())

        // login() sets window.location.href — on our mock object, that means the property is now the URL string
        expect(window.location.href).toContain('discord.com/api/oauth2/authorize')
        expect(window.location.href).toContain('client_id=test-client-id')
        expect(window.location.href).toContain('response_type=code')
        expect(window.location.href).toContain('scope=identify')

        delete import.meta.env.VITE_DISCORD_CLIENT_ID
    })

    it('does not redirect when VITE_DISCORD_CLIENT_ID is not set', async () => {
        delete import.meta.env.VITE_DISCORD_CLIENT_ID

        const { result } = renderHook(() => useAuth(), { wrapper })
        await waitFor(() => expect(result.current.loading).toBe(false))

        const hrefBefore = window.location.href

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        act(() => result.current.login())

        // href should not have changed
        expect(window.location.href).toBe(hrefBefore)
        consoleSpy.mockRestore()
    })
})

// ---- 7. Logout ----
describe('logout', () => {
    it('clears token from localStorage and resets user state', async () => {
        localStorage.setItem('auth_token', 'tok')
        localStorage.setItem('impersonate_user_id', '42')
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                user: { id: '1', username: 'test' },
                linkedPlayer: null,
                permissions: { global: ['match_report'], byLeague: {} },
                impersonating: true,
                realUser: { id: '1', username: 'admin' },
            }),
        })

        const { result } = renderHook(() => useAuth(), { wrapper })
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.user).not.toBeNull()

        act(() => result.current.logout())

        expect(localStorage.getItem('auth_token')).toBeNull()
        expect(localStorage.getItem('impersonate_user_id')).toBeNull()
        expect(result.current.user).toBeNull()
        expect(result.current.token).toBeNull()
        expect(result.current.permissions).toEqual({ global: [], byLeague: {} })
        expect(result.current.impersonating).toBe(false)
        expect(result.current.realUser).toBeNull()
        expect(mockClearImpersonation).toHaveBeenCalled()
    })
})

// ---- 8. Impersonation ----
describe('Impersonation', () => {
    it('startImpersonation sets impersonate_user_id in localStorage and syncs to database.js', async () => {
        localStorage.setItem('auth_token', 'tok')
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                user: { id: '1', username: 'admin' },
                linkedPlayer: null,
                permissions: { global: ['permission_manage'], byLeague: {} },
            }),
        })

        const { result } = renderHook(() => useAuth(), { wrapper })
        await waitFor(() => expect(result.current.loading).toBe(false))

        // Re-mock fetch for the impersonation re-fetch
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                user: { id: '99', username: 'target' },
                linkedPlayer: null,
                permissions: { global: [], byLeague: {} },
                impersonating: true,
                realUser: { id: '1', username: 'admin' },
            }),
        })

        act(() => result.current.startImpersonation('99'))

        expect(localStorage.getItem('impersonate_user_id')).toBe('99')
        await waitFor(() => expect(mockSetImpersonation).toHaveBeenCalledWith('99'))
    })

    it('stopImpersonation clears impersonate_user_id from localStorage', async () => {
        localStorage.setItem('auth_token', 'tok')
        localStorage.setItem('impersonate_user_id', '42')
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                user: { id: '42', username: 'impersonated' },
                linkedPlayer: null,
                permissions: { global: [], byLeague: {} },
                impersonating: true,
                realUser: { id: '1', username: 'admin' },
            }),
        })

        const { result } = renderHook(() => useAuth(), { wrapper })
        await waitFor(() => expect(result.current.loading).toBe(false))

        // Re-mock fetch for the stop re-fetch
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                user: { id: '1', username: 'admin' },
                linkedPlayer: null,
                permissions: { global: ['permission_manage'], byLeague: {} },
            }),
        })

        act(() => result.current.stopImpersonation())

        expect(localStorage.getItem('impersonate_user_id')).toBeNull()
        await waitFor(() => expect(mockClearImpersonation).toHaveBeenCalled())
    })
})

// ---- 9. Error handling ----
describe('Error handling', () => {
    it('clears token and user when auth-me returns 401', async () => {
        localStorage.setItem('auth_token', 'expired-token')
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: false,
            status: 401,
        })

        const { result } = renderHook(() => useAuth(), { wrapper })
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.user).toBeNull()
        expect(result.current.token).toBeNull()
        expect(localStorage.getItem('auth_token')).toBeNull()
    })

    it('clears token and user when fetch throws network error', async () => {
        localStorage.setItem('auth_token', 'some-token')
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))

        const { result } = renderHook(() => useAuth(), { wrapper })
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.user).toBeNull()
        expect(result.current.token).toBeNull()
        expect(localStorage.getItem('auth_token')).toBeNull()
    })

    it('resets permissions when auth-me fails', async () => {
        localStorage.setItem('auth_token', 'bad')
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('fail'))

        const { result } = renderHook(() => useAuth(), { wrapper })
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.permissions).toEqual({ global: [], byLeague: {} })
        expect(result.current.hasAnyPermission).toBe(false)
    })
})

// ---- 10. useAuth outside provider ----
describe('useAuth outside provider', () => {
    it('throws error when used outside AuthProvider', () => {
        expect(() => {
            renderHook(() => useAuth())
        }).toThrow('useAuth must be used within an AuthProvider')
    })
})

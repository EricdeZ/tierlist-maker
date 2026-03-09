import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiCall, apiPost, setImpersonation, clearImpersonation, getImpersonation } from '../core'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function jsonResponse(data: any, ok = true, statusText = 'OK') {
    return Promise.resolve({
        ok,
        statusText,
        json: () => Promise.resolve(data),
    })
}

beforeEach(() => {
    mockFetch.mockReset()
    clearImpersonation()
    localStorage.clear()
})

describe('apiCall', () => {
    it('makes GET request with correct URL', async () => {
        mockFetch.mockReturnValue(jsonResponse({ ok: true }))
        const result = await apiCall('leagues')
        expect(mockFetch).toHaveBeenCalledTimes(1)
        const url = new URL(mockFetch.mock.calls[0][0])
        expect(url.pathname).toBe('/api/leagues')
        expect(result).toEqual({ ok: true })
    })

    it('appends query params, skipping null/undefined', async () => {
        mockFetch.mockReturnValue(jsonResponse({}))
        await apiCall('players', { seasonId: 5, role: null, name: undefined, team: 'Alpha' })
        const url = new URL(mockFetch.mock.calls[0][0])
        expect(url.searchParams.get('seasonId')).toBe('5')
        expect(url.searchParams.get('team')).toBe('Alpha')
        expect(url.searchParams.has('role')).toBe(false)
        expect(url.searchParams.has('name')).toBe(false)
    })

    it('includes auth token when present', async () => {
        localStorage.setItem('auth_token', 'test-jwt-token')
        mockFetch.mockReturnValue(jsonResponse({}))
        await apiCall('leagues')
        const headers = mockFetch.mock.calls[0][1].headers
        expect(headers.Authorization).toBe('Bearer test-jwt-token')
    })

    it('includes impersonation header when set', async () => {
        setImpersonation('user-42')
        mockFetch.mockReturnValue(jsonResponse({}))
        await apiCall('leagues')
        const headers = mockFetch.mock.calls[0][1].headers
        expect(headers['X-Impersonate']).toBe('user-42')
    })

    it('throws on non-ok response with server error message', async () => {
        mockFetch.mockReturnValue(jsonResponse({ error: 'Not authorized' }, false, 'Forbidden'))
        await expect(apiCall('admin')).rejects.toThrow('Not authorized')
    })

    it('throws with statusText when no JSON error', async () => {
        mockFetch.mockReturnValue(Promise.resolve({
            ok: false,
            statusText: 'Internal Server Error',
            json: () => Promise.reject(new Error('no json')),
        }))
        await expect(apiCall('broken')).rejects.toThrow('API call failed: Internal Server Error')
    })

    it('deduplicates in-flight GET requests to same URL', async () => {
        mockFetch.mockReturnValue(jsonResponse({ data: 'shared' }))
        const [r1, r2] = await Promise.all([
            apiCall('leagues'),
            apiCall('leagues'),
        ])
        expect(mockFetch).toHaveBeenCalledTimes(1)
        expect(r1).toEqual(r2)
    })

    it('does NOT deduplicate requests with different params', async () => {
        mockFetch.mockReturnValue(jsonResponse({}))
        await Promise.all([
            apiCall('players', { seasonId: 1 }),
            apiCall('players', { seasonId: 2 }),
        ])
        expect(mockFetch).toHaveBeenCalledTimes(2)
    })
})

describe('apiPost', () => {
    it('makes POST request with JSON body', async () => {
        mockFetch.mockReturnValue(jsonResponse({ created: true }))
        const result = await apiPost('teams', {}, { name: 'Alpha', color: '#ff0' })
        expect(mockFetch).toHaveBeenCalledTimes(1)
        const [url, opts] = mockFetch.mock.calls[0]
        expect(new URL(url).pathname).toBe('/api/teams')
        expect(opts.method).toBe('POST')
        expect(opts.headers['Content-Type']).toBe('application/json')
        expect(JSON.parse(opts.body)).toEqual({ name: 'Alpha', color: '#ff0' })
        expect(result).toEqual({ created: true })
    })

    it('includes auth and impersonation headers', async () => {
        localStorage.setItem('auth_token', 'my-token')
        setImpersonation('user-99')
        mockFetch.mockReturnValue(jsonResponse({}))
        await apiPost('action', {}, {})
        const headers = mockFetch.mock.calls[0][1].headers
        expect(headers.Authorization).toBe('Bearer my-token')
        expect(headers['X-Impersonate']).toBe('user-99')
    })

    it('appends query params to POST URL', async () => {
        mockFetch.mockReturnValue(jsonResponse({}))
        await apiPost('action', { action: 'create' }, { name: 'x' })
        const url = new URL(mockFetch.mock.calls[0][0])
        expect(url.searchParams.get('action')).toBe('create')
    })

    it('throws on non-ok response', async () => {
        mockFetch.mockReturnValue(jsonResponse({ error: 'Bad request' }, false, 'Bad Request'))
        await expect(apiPost('bad', {}, {})).rejects.toThrow('Bad request')
    })
})

describe('impersonation', () => {
    it('get/set/clear cycle works', () => {
        expect(getImpersonation()).toBeNull()
        setImpersonation('user-1')
        expect(getImpersonation()).toBe('user-1')
        clearImpersonation()
        expect(getImpersonation()).toBeNull()
    })
})

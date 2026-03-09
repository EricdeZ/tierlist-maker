import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { adminFetch, getAuthHeaders } from '../adminApi'

const realLocation = window.location

beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    // Replace window.location with a mutable object so adminFetch can assign href
    delete (window as any).location
    ;(window as any).location = {
        ...realLocation,
        href: 'http://localhost/',
        origin: 'http://localhost',
        pathname: '/',
        search: '',
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
    } as Response)
})

afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    ;(window as any).location = realLocation
})

// ---- 1. getAuthHeaders ----
describe('getAuthHeaders', () => {
    it('includes Content-Type by default', () => {
        const headers = getAuthHeaders()
        expect(headers['Content-Type']).toBe('application/json')
    })

    it('includes Bearer token when auth_token is present', () => {
        localStorage.setItem('auth_token', 'mytoken')
        const headers = getAuthHeaders()
        expect(headers['Authorization']).toBe('Bearer mytoken')
    })

    it('does not include Authorization when no token', () => {
        const headers = getAuthHeaders()
        expect(headers).not.toHaveProperty('Authorization')
    })

    it('includes X-Impersonate when impersonate_user_id is set', () => {
        localStorage.setItem('impersonate_user_id', '42')
        const headers = getAuthHeaders()
        expect(headers['X-Impersonate']).toBe('42')
    })

    it('does not include X-Impersonate when not set', () => {
        const headers = getAuthHeaders()
        expect(headers).not.toHaveProperty('X-Impersonate')
    })

    it('includes both token and impersonate headers when both set', () => {
        localStorage.setItem('auth_token', 'tok')
        localStorage.setItem('impersonate_user_id', '99')
        const headers = getAuthHeaders()
        expect(headers['Authorization']).toBe('Bearer tok')
        expect(headers['X-Impersonate']).toBe('99')
    })
})

// ---- 2. adminFetch ----
describe('adminFetch', () => {
    it('makes request to correct URL', async () => {
        await adminFetch('league-manage')

        expect(globalThis.fetch).toHaveBeenCalledTimes(1)
        const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
        expect(url.toString()).toContain('/api/league-manage')
    })

    it('defaults to POST method', async () => {
        await adminFetch('league-manage')

        const [, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
        expect(options.method).toBe('POST')
    })

    it('sends JSON body when provided', async () => {
        await adminFetch('league-manage', { body: { name: 'Test League' } })

        const [, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
        expect(options.body).toBe(JSON.stringify({ name: 'Test League' }))
    })

    it('sends no body when not provided', async () => {
        await adminFetch('league-manage')

        const [, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
        expect(options.body).toBeUndefined()
    })

    it('includes auth headers', async () => {
        localStorage.setItem('auth_token', 'tok123')
        localStorage.setItem('impersonate_user_id', '7')

        await adminFetch('league-manage')

        const [, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
        expect(options.headers['Authorization']).toBe('Bearer tok123')
        expect(options.headers['X-Impersonate']).toBe('7')
    })

    it('returns parsed JSON on success', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ data: [1, 2, 3] }),
        } as Response)

        const result = await adminFetch('some-endpoint')
        expect(result).toEqual({ data: [1, 2, 3] })
    })
})

// ---- 3. 401 handling ----
describe('401 handling', () => {
    it('clears auth_token from localStorage on 401', async () => {
        localStorage.setItem('auth_token', 'expired')
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
        } as Response)

        await expect(adminFetch('protected')).rejects.toThrow('Authentication expired')
        expect(localStorage.getItem('auth_token')).toBeNull()
    })

    it('redirects to /?login=expired on 401', async () => {
        localStorage.setItem('auth_token', 'expired')
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
        } as Response)

        await expect(adminFetch('protected')).rejects.toThrow()
        expect(window.location.href).toBe('/?login=expired')
    })
})

// ---- 4. Error extraction ----
describe('Error extraction', () => {
    it('extracts error message from JSON response body', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: false,
            status: 400,
            statusText: 'Bad Request',
            json: () => Promise.resolve({ error: 'League name is required' }),
        } as unknown as Response)

        await expect(adminFetch('league-manage')).rejects.toThrow('League name is required')
    })

    it('falls back to statusText when JSON parsing fails', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            json: () => Promise.reject(new Error('not json')),
        } as unknown as Response)

        // The catch returns { error: response.statusText }, so err.error = statusText
        await expect(adminFetch('league-manage')).rejects.toThrow('Internal Server Error')
    })

    it('falls back to statusText when JSON has no error field', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: false,
            status: 422,
            statusText: 'Unprocessable Entity',
            json: () => Promise.resolve({ message: 'something else' }),
        } as unknown as Response)

        await expect(adminFetch('league-manage')).rejects.toThrow('API call failed: Unprocessable Entity')
    })
})

// ---- 5. Param encoding ----
describe('Param encoding', () => {
    it('appends query params to URL', async () => {
        await adminFetch('search', { params: { q: 'hello world', page: '2' } })

        const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
        const urlStr = url.toString()
        expect(urlStr).toContain('q=hello')
        expect(urlStr).toContain('page=2')
    })

    it('filters out null params', async () => {
        await adminFetch('search', { params: { q: 'test', empty: null } })

        const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
        const urlStr = url.toString()
        expect(urlStr).toContain('q=test')
        expect(urlStr).not.toContain('empty')
    })

    it('filters out undefined params', async () => {
        await adminFetch('search', { params: { q: 'test', missing: undefined } })

        const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
        const urlStr = url.toString()
        expect(urlStr).toContain('q=test')
        expect(urlStr).not.toContain('missing')
    })

    it('handles special characters in params', async () => {
        await adminFetch('search', { params: { q: 'a&b=c' } })

        const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
        const parsed = new URL(url.toString())
        expect(parsed.searchParams.get('q')).toBe('a&b=c')
    })

    it('works with no params', async () => {
        await adminFetch('simple')

        const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
        const urlStr = url.toString()
        expect(urlStr).toContain('/api/simple')
        expect(urlStr).not.toContain('?')
    })
})

export const API_BASE = '/api'

// Owner impersonation support
let _impersonateUserId: string | null = null
export function setImpersonation(userId: string) { _impersonateUserId = userId }
export function clearImpersonation() { _impersonateUserId = null }
export function getImpersonation() { return _impersonateUserId }

// In-flight GET request deduplication — simultaneous calls to the same URL share one fetch
const _inflight = new Map<string, Promise<any>>()

export const apiCall = async (endpoint: string, params: Record<string, any> = {}): Promise<any> => {
    const url = new URL(`${API_BASE}/${endpoint}`, window.location.origin)
    Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
            url.searchParams.append(key, params[key])
        }
    })

    const cacheKey = url.toString()
    if (_inflight.has(cacheKey)) return _inflight.get(cacheKey)

    const token = localStorage.getItem('auth_token')
    const hdrs: Record<string, string> = {}
    if (token) hdrs.Authorization = `Bearer ${token}`
    if (_impersonateUserId) hdrs['X-Impersonate'] = String(_impersonateUserId)

    const promise = fetch(url.toString(), {
        headers: Object.keys(hdrs).length > 0 ? hdrs : undefined,
    }).then(async response => {
        if (!response.ok) {
            let message = `API call failed: ${response.statusText}`
            try {
                const data = await response.json()
                if (data.error) message = data.error
            } catch {}
            throw new Error(message)
        }
        return response.json()
    }).finally(() => {
        _inflight.delete(cacheKey)
    })

    _inflight.set(cacheKey, promise)
    return promise
}

export const apiPost = async (endpoint: string, params: Record<string, any> = {}, body: any = {}): Promise<any> => {
    const url = new URL(`${API_BASE}/${endpoint}`, window.location.origin)
    Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
            url.searchParams.append(key, params[key])
        }
    })

    const token = localStorage.getItem('auth_token')
    const hdrs: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) hdrs.Authorization = `Bearer ${token}`
    if (_impersonateUserId) hdrs['X-Impersonate'] = String(_impersonateUserId)

    const response = await fetch(url.toString(), {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify(body),
    })

    if (!response.ok) {
        let message = `API call failed: ${response.statusText}`
        try {
            const data = await response.json()
            if (data.error) message = data.error
        } catch {}
        throw new Error(message)
    }

    return response.json()
}

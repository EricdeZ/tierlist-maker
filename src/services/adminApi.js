// src/services/adminApi.js
// Authenticated fetch helper for admin endpoints

const API_BASE = import.meta.env.VITE_API_URL || '/api'

/**
 * Fetch wrapper that attaches the auth token from localStorage.
 * Use this for all admin API calls instead of raw fetch().
 */
export async function adminFetch(endpoint, options = {}) {
    const token = localStorage.getItem('auth_token')
    const { method = 'POST', body, params } = options

    const url = new URL(`${API_BASE}/${endpoint}`, window.location.origin)
    if (params) {
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null) {
                url.searchParams.append(key, params[key])
            }
        })
    }

    const headers = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const impId = localStorage.getItem('impersonate_user_id')
    if (impId) headers['X-Impersonate'] = impId

    const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    })

    if (response.status === 401) {
        localStorage.removeItem('auth_token')
        window.location.href = '/?login=expired'
        throw new Error('Authentication expired')
    }

    if (!response.ok) {
        const err = await response.json().catch(() => ({ error: response.statusText }))
        throw new Error(err.error || `API call failed: ${response.statusText}`)
    }

    return response.json()
}

/**
 * Get the auth headers object for use with raw fetch() calls
 * (for admin pages that need more control over the request).
 */
export function getAuthHeaders() {
    const token = localStorage.getItem('auth_token')
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const impId = localStorage.getItem('impersonate_user_id')
    if (impId) headers['X-Impersonate'] = impId
    return headers
}

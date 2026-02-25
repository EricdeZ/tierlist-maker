// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { setImpersonation, clearImpersonation } from '../services/database.js'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [linkedPlayer, setLinkedPlayer] = useState(null)
    const [permissions, setPermissions] = useState({ global: [], byLeague: {} })
    const [loading, setLoading] = useState(true)
    const [token, setToken] = useState(() => localStorage.getItem('auth_token'))
    const [impersonating, setImpersonating] = useState(false)
    const [realUser, setRealUser] = useState(null)
    const [impersonateId, setImpersonateId] = useState(() => localStorage.getItem('impersonate_user_id'))

    // On mount: check URL for auth_token (from OAuth redirect)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const urlToken = params.get('auth_token')
        const authError = params.get('auth_error')

        if (urlToken) {
            console.log('[Auth] Token received from OAuth redirect')
            localStorage.setItem('auth_token', urlToken)
            setToken(urlToken)
            // Clean URL
            params.delete('auth_token')
            const clean = params.toString()
            window.history.replaceState({}, '', window.location.pathname + (clean ? `?${clean}` : ''))
        }

        if (authError) {
            console.error('Auth error:', decodeURIComponent(authError))
            alert(`Login failed: ${decodeURIComponent(authError)}`)
            params.delete('auth_error')
            const clean = params.toString()
            window.history.replaceState({}, '', window.location.pathname + (clean ? `?${clean}` : ''))
        }

        // Capture referral codes from URL and persist in localStorage
        const refCode = params.get('ref')
        if (refCode) {
            localStorage.setItem('pending_referral', refCode)
            params.delete('ref')
            const clean = params.toString()
            window.history.replaceState({}, '', window.location.pathname + (clean ? `?${clean}` : ''))
        }
        const forgeRefCode = params.get('forge_ref')
        if (forgeRefCode) {
            localStorage.setItem('pending_forge_referral', forgeRefCode)
            params.delete('forge_ref')
            const clean = params.toString()
            window.history.replaceState({}, '', window.location.pathname + (clean ? `?${clean}` : ''))
        }
    }, [])

    // Sync database.js impersonation on mount and when impersonateId changes
    useEffect(() => {
        if (impersonateId) {
            setImpersonation(impersonateId)
        } else {
            clearImpersonation()
        }
    }, [impersonateId])

    // Whenever token or impersonateId changes, fetch user info
    useEffect(() => {
        if (!token) {
            setUser(null)
            setLinkedPlayer(null)
            setPermissions({ global: [], byLeague: {} })
            setImpersonating(false)
            setRealUser(null)
            setLoading(false)
            return
        }

        let cancelled = false

        const fetchUser = async () => {
            try {
                const headers = { Authorization: `Bearer ${token}` }
                if (impersonateId) headers['X-Impersonate'] = impersonateId

                const res = await fetch('/api/auth-me', { headers })
                if (!res.ok) throw new Error('Invalid token')
                const data = await res.json()
                if (!cancelled) {
                    console.log('[AuthContext] auth-me response:', data)
                    setUser(data.user)
                    setLinkedPlayer(data.linkedPlayer)
                    setPermissions(data.permissions || { global: [], byLeague: {} })
                    setImpersonating(!!data.impersonating)
                    setRealUser(data.realUser || null)
                }
            } catch {
                if (!cancelled) {
                    localStorage.removeItem('auth_token')
                    setToken(null)
                    setUser(null)
                    setLinkedPlayer(null)
                    setPermissions({ global: [], byLeague: {} })
                    setImpersonating(false)
                    setRealUser(null)
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        fetchUser()
        return () => { cancelled = true }
    }, [token, impersonateId])

    const login = useCallback(() => {
        const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID
        if (!clientId) {
            console.error('Discord OAuth not configured')
            return
        }
        // Derive redirect_uri from current origin so it always matches the callback
        const redirectUri = `${window.location.origin}/api/auth-callback`
        // Pass origin + path as state so callback redirects back to the correct host
        let returnPath = window.location.pathname + window.location.search

        // Thread pending referral code through OAuth state
        const pendingRef = localStorage.getItem('pending_referral')
        if (pendingRef) {
            const sep = returnPath.includes('?') ? '&' : '?'
            returnPath += `${sep}ref=${pendingRef}`
            localStorage.removeItem('pending_referral')
        }

        const state = encodeURIComponent(window.location.origin + returnPath)
        const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify&state=${state}`
        window.location.href = url
    }, [])

    const logout = useCallback(() => {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('impersonate_user_id')
        clearImpersonation()
        setToken(null)
        setUser(null)
        setLinkedPlayer(null)
        setPermissions({ global: [], byLeague: {} })
        setImpersonating(false)
        setRealUser(null)
        setImpersonateId(null)
    }, [])

    const startImpersonation = useCallback((userId) => {
        localStorage.setItem('impersonate_user_id', String(userId))
        setImpersonateId(String(userId))
    }, [])

    const stopImpersonation = useCallback(() => {
        localStorage.removeItem('impersonate_user_id')
        setImpersonateId(null)
    }, [])

    const isAdmin = user?.role === 'admin'

    // Check if user has a specific permission, optionally for a league
    const hasPermission = useCallback((permissionKey, leagueId = null) => {
        if (permissions.global.includes(permissionKey)) return true
        if (leagueId) {
            const leaguePerms = permissions.byLeague[String(leagueId)]
            if (leaguePerms?.includes(permissionKey)) return true
        }
        return false
    }, [permissions])

    // True if user has any RBAC role assignment
    const hasAnyPermission = useMemo(() =>
        permissions.global.length > 0 ||
        Object.values(permissions.byLeague).some(perms => perms.length > 0),
    [permissions])

    // Get Discord avatar URL
    const avatarUrl = user?.discord_avatar
        ? `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.discord_avatar}.png?size=64`
        : null

    return (
        <AuthContext.Provider value={{
            user,
            linkedPlayer,
            loading,
            token,
            login,
            logout,
            isAdmin,
            avatarUrl,
            permissions,
            hasPermission,
            hasAnyPermission,
            impersonating,
            realUser,
            startImpersonation,
            stopImpersonation,
        }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => {
    const ctx = useContext(AuthContext)
    if (ctx === null) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return ctx
}

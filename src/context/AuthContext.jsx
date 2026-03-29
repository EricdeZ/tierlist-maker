// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { setImpersonation, clearImpersonation, referralService, vaultService } from '../services/database.js'

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
    const [notification, setNotification] = useState(null)
    const [vaultBanned, setVaultBanned] = useState(false)

    // Device fingerprint tracking for alt detection
    const trackDevice = useCallback((userId) => {
        try {
            const DEVICE_KEY = 'X3Zk'   // btoa('_vd')
            const HISTORY_KEY = 'X3Zw'  // btoa('_vp')

            let deviceId = localStorage.getItem(DEVICE_KEY)
            if (!deviceId) {
                deviceId = crypto.randomUUID()
                localStorage.setItem(DEVICE_KEY, deviceId)
            }

            let history = []
            try {
                history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
                if (!Array.isArray(history)) history = []
            } catch { history = [] }

            const encoded = btoa(String(userId))
            const isNew = !history.includes(encoded)

            const previousIds = isNew && history.length > 0
                ? history.map(h => { try { return atob(h) } catch { return null } }).filter(Boolean)
                : null

            if (isNew) {
                history.push(encoded)
                localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
            }

            vaultService.logDevice(deviceId, previousIds).catch(() => {})
        } catch {
            // Never let tracking break the login flow
        }
    }, [])

    // On mount: check URL for auth_token (from OAuth redirect)
    useEffect(() => {
        // Auto-auth on tunnel domain
        if (window.location.hostname.endsWith('.trycloudflare.com') && !localStorage.getItem('auth_token')) {
            const tunnelToken = import.meta.env.VITE_TUNNEL_AUTH_TOKEN
            if (tunnelToken) {
                localStorage.setItem('auth_token', tunnelToken)
                setToken(tunnelToken)
            }
        }

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
            setVaultBanned(false)
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
                    setVaultBanned(!!data.vaultBanned)
                    if (!data.impersonating) trackDevice(data.user.id)
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
                    setVaultBanned(false)
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        fetchUser()
        return () => { cancelled = true }
    }, [token, impersonateId, trackDevice])

    // Auto-claim pending website referral for already-logged-in users
    useEffect(() => {
        if (!user) return
        const pendingRef = localStorage.getItem('pending_referral')
        if (!pendingRef) return
        localStorage.removeItem('pending_referral')
        referralService.claimReferral(pendingRef, 'website')
            .then(() => setNotification('Referral claimed! You earned 50 Passion as a welcome bonus.'))
            .catch(() => {}) // silently ignore (already referred, self-refer, etc.)
    }, [user])

    // Show notification for referrals claimed during OAuth signup flow
    useEffect(() => {
        if (!user) return
        const flag = localStorage.getItem('referral_claimed_via_oauth')
        if (!flag) return
        localStorage.removeItem('referral_claimed_via_oauth')
        setNotification('Referral claimed! You earned 50 Passion as a welcome bonus.')
    }, [user])

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
            localStorage.setItem('referral_claimed_via_oauth', '1')
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
        setVaultBanned(false)
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
            vaultBanned,
            notification,
            clearNotification: () => setNotification(null),
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

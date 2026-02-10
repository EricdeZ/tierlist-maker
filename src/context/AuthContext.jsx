// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [linkedPlayer, setLinkedPlayer] = useState(null)
    const [loading, setLoading] = useState(true)
    const [token, setToken] = useState(() => localStorage.getItem('auth_token'))

    // On mount: check URL for auth_token (from OAuth redirect)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const urlToken = params.get('auth_token')
        const authError = params.get('auth_error')

        if (urlToken) {
            localStorage.setItem('auth_token', urlToken)
            setToken(urlToken)
            // Clean URL
            params.delete('auth_token')
            const clean = params.toString()
            window.history.replaceState({}, '', window.location.pathname + (clean ? `?${clean}` : ''))
        }

        if (authError) {
            console.error('Auth error:', authError)
            params.delete('auth_error')
            const clean = params.toString()
            window.history.replaceState({}, '', window.location.pathname + (clean ? `?${clean}` : ''))
        }
    }, [])

    // Whenever token changes, fetch user info
    useEffect(() => {
        if (!token) {
            setUser(null)
            setLinkedPlayer(null)
            setLoading(false)
            return
        }

        let cancelled = false

        const fetchUser = async () => {
            try {
                const res = await fetch('/.netlify/functions/auth-me', {
                    headers: { Authorization: `Bearer ${token}` },
                })
                if (!res.ok) throw new Error('Invalid token')
                const data = await res.json()
                if (!cancelled) {
                    setUser(data.user)
                    setLinkedPlayer(data.linkedPlayer)
                }
            } catch {
                if (!cancelled) {
                    localStorage.removeItem('auth_token')
                    setToken(null)
                    setUser(null)
                    setLinkedPlayer(null)
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        fetchUser()
        return () => { cancelled = true }
    }, [token])

    const login = useCallback(() => {
        const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID
        const redirectUri = import.meta.env.VITE_DISCORD_REDIRECT_URI
        if (!clientId || !redirectUri) {
            console.error('Discord OAuth not configured')
            return
        }
        const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify`
        window.location.href = url
    }, [])

    const logout = useCallback(() => {
        localStorage.removeItem('auth_token')
        setToken(null)
        setUser(null)
        setLinkedPlayer(null)
    }, [])

    const isAdmin = user?.role === 'admin'

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

import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Settings, Shield, Loader2 } from 'lucide-react'

const apiCall = async (endpoint, params = {}) => {
    const qs = new URLSearchParams(params).toString()
    const token = localStorage.getItem('auth_token')
    const res = await fetch(`/api/${endpoint}${qs ? `?${qs}` : ''}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    return res.json()
}

const apiPost = async (endpoint, body) => {
    const token = localStorage.getItem('auth_token')
    const res = await fetch(`/api/${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
    })
    return res.json()
}

export default function CCSettings() {
    const { user } = useAuth()
    const [allowAvatar, setAllowAvatar] = useState(true)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!user) return
        apiCall('user-preferences').then((data) => {
            setAllowAvatar(data.allow_discord_avatar ?? true)
            setLoading(false)
        }).catch(() => setLoading(false))
    }, [user])

    const toggleAvatar = async () => {
        const newValue = !allowAvatar
        setSaving(true)
        setAllowAvatar(newValue)
        await apiPost('user-preferences', { allow_discord_avatar: newValue })
        setSaving(false)
    }

    if (!user) {
        return (
            <div className="text-center py-20 text-[var(--cd-text-dim)]">
                <Settings className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-bold cd-head">Sign in to access settings</p>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="cd-spinner w-8 h-8" />
            </div>
        )
    }

    return (
        <div className="max-w-lg mx-auto p-6">
            <div className="mb-6 cd-section-accent pb-3">
                <h1 className="text-2xl font-bold text-[var(--cd-text)] cd-head">Settings</h1>
            </div>

            <div className="cd-panel cd-corners rounded-xl p-5 relative overflow-hidden">
                <div className="cd-data-overlay" />
                <div className="relative z-1">
                    <div className="flex items-start gap-3 mb-4">
                        <Shield className="w-5 h-5 text-[var(--cd-cyan)] mt-0.5 shrink-0" />
                        <div>
                            <h3 className="text-sm font-bold text-[var(--cd-text)] cd-head">Profile Picture on Cards</h3>
                            <p className="text-xs text-[var(--cd-text-mid)] mt-1 leading-relaxed">
                                SmiteComp uses your Discord profile picture on your player trading cards.
                                If you don't want your image to be used, untick the option below.
                                Your most played god's artwork will be shown instead, or your initials if you have no recorded games.
                            </p>
                        </div>
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer group mt-4 p-3 rounded-lg hover:bg-white/[0.02] transition-colors">
                        <div className="relative">
                            <input
                                type="checkbox"
                                checked={allowAvatar}
                                onChange={toggleAvatar}
                                disabled={saving}
                                className="sr-only peer"
                            />
                            <div className="w-10 h-5 rounded-full bg-[var(--cd-edge)] border border-[var(--cd-border)] peer-checked:bg-[var(--cd-cyan)]/20 peer-checked:border-[var(--cd-cyan)]/50 transition-all" />
                            <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-[var(--cd-text-dim)] peer-checked:bg-[var(--cd-cyan)] peer-checked:translate-x-5 transition-all shadow-sm" />
                        </div>
                        <span className="text-sm text-[var(--cd-text)] font-medium">
                            Allow my Discord profile picture on my card
                        </span>
                        {saving && <Loader2 className="w-3.5 h-3.5 text-[var(--cd-cyan)] animate-spin ml-auto" />}
                    </label>
                </div>
            </div>
        </div>
    )
}

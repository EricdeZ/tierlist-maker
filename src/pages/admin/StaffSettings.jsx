import { useState, useEffect, useCallback } from 'react'
import { Settings, BellRing, BellOff } from 'lucide-react'
import { getAuthHeaders } from '../../services/adminApi.js'
import PageTitle from '../../components/PageTitle'

const API = import.meta.env.VITE_API_URL || '/api'

const NOTIFICATION_TYPES = [
    { key: 'notify_match_report', label: 'Match reports ready', description: 'DM when screenshots are matched to a scheduled match' },
    { key: 'notify_data_report', label: 'New data reports', description: 'DM when a user submits a data issue report' },
]

export default function StaffSettings() {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [toast, setToast] = useState(null)

    const showToast = useCallback((type, message) => {
        const id = Date.now()
        setToast({ type, message, id })
        setTimeout(() => setToast(prev => prev?.id === id ? null : prev), 4000)
    }, [])

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch(`${API}/staff-settings`, { headers: getAuthHeaders() })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            setData(await res.json())
        } catch (e) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    const getPrefs = (leagueId) => {
        const pref = data?.prefs?.find(p => p.league_id === leagueId)
        return {
            notify_match_report: pref?.notify_match_report ?? true,
            notify_data_report: pref?.notify_data_report ?? true,
        }
    }

    const handleToggle = async (leagueId, key, currentValue) => {
        // Optimistic update
        setData(prev => {
            const existing = prev.prefs.find(p => p.league_id === leagueId)
            if (existing) {
                return {
                    ...prev,
                    prefs: prev.prefs.map(p => p.league_id === leagueId ? { ...p, [key]: !currentValue } : p),
                }
            }
            return {
                ...prev,
                prefs: [...prev.prefs, { league_id: leagueId, notify_match_report: true, notify_data_report: true, [key]: !currentValue }],
            }
        })

        try {
            const prefs = getPrefs(leagueId)
            const res = await fetch(`${API}/staff-settings`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    action: 'update-prefs',
                    league_id: leagueId,
                    ...prefs,
                    [key]: !currentValue,
                }),
            })
            const d = await res.json()
            if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`)
        } catch (e) {
            showToast('error', e.message)
            fetchData() // revert
        }
    }

    const getDivisions = (leagueId) => {
        return (data?.divisions || []).filter(d => d.league_id === leagueId)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-16">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-(--color-accent)" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="max-w-3xl mx-auto px-4 py-8">
                <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-6 text-center">
                    <p className="text-red-400 font-medium">Failed to load: {error}</p>
                    <button onClick={() => { setError(null); setLoading(true); fetchData() }}
                        className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm text-white transition-colors">
                        Retry
                    </button>
                </div>
            </div>
        )
    }

    const leagueRows = data?.leagues || []

    if (!leagueRows.length) {
        return (
            <div className="max-w-3xl mx-auto px-4 py-8">
                <PageTitle title="My Settings" noindex />
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400">
                        <Settings className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-(--color-text)">My Settings</h1>
                        <p className="text-sm text-(--color-text-secondary)">Manage your notification preferences</p>
                    </div>
                </div>
                <div className="text-center py-12 text-(--color-text-secondary)">
                    No league assignments found. Settings will appear once you're added as staff.
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-3xl mx-auto px-4 py-8">
            <PageTitle title="My Settings" noindex />

            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium text-white
                    ${toast.type === 'error' ? 'bg-red-900/90 border border-red-500/30' : 'bg-green-900/90 border border-green-500/30'}`}>
                    {toast.message}
                </div>
            )}

            <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400">
                    <Settings className="w-6 h-6" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-(--color-text)">My Settings</h1>
                    <p className="text-sm text-(--color-text-secondary)">Manage your notification preferences</p>
                </div>
            </div>

            <div className="space-y-4">
                {leagueRows.map(league => {
                    const prefs = getPrefs(league.id)
                    const divs = league.id ? getDivisions(league.id) : []

                    return (
                        <div key={league.id ?? 'global'}
                            className="rounded-xl bg-(--color-secondary) border border-white/5 p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h2 className="text-sm font-semibold text-(--color-text)">{league.name}</h2>
                                    {divs.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {divs.map(d => (
                                                <span key={d.division_id}
                                                    className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300/80">
                                                    {d.division_name}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                {NOTIFICATION_TYPES.map(({ key, label, description }) => {
                                    const enabled = prefs[key]
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => handleToggle(league.id, key, enabled)}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left"
                                        >
                                            <div className={`p-1.5 rounded-lg ${enabled ? 'text-green-400 bg-green-500/10' : 'text-(--color-text-secondary) bg-white/5'}`}>
                                                {enabled ? <BellRing className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-(--color-text)">{label}</div>
                                                <div className="text-xs text-(--color-text-secondary)">{description}</div>
                                            </div>
                                            <div className={`w-9 h-5 rounded-full relative transition-colors ${enabled ? 'bg-green-500' : 'bg-white/10'}`}>
                                                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

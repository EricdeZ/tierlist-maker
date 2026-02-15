// src/pages/admin/BannedContentManager.jsx
import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Home, RefreshCw } from 'lucide-react'
import { getAuthHeaders } from '../../services/adminApi.js'
import PageTitle from '../../components/PageTitle'

const API = import.meta.env.VITE_API_URL || '/api'

export default function BannedContentManager() {
    const [configs, setConfigs] = useState([])
    const [leagues, setLeagues] = useState([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [form, setForm] = useState({ league_id: '', channel_id: '', message_id: '' })
    const [saving, setSaving] = useState(false)
    const [syncing, setSyncing] = useState(null) // league_id or 'all'
    const [toast, setToast] = useState(null)

    const showToast = useCallback((type, message) => {
        const id = Date.now()
        setToast({ type, message, id })
        setTimeout(() => setToast(prev => prev?.id === id ? null : prev), 4000)
    }, [])

    const loadData = useCallback(async () => {
        try {
            const [configRes, leagueRes] = await Promise.all([
                fetch(`${API}/banned-content`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ action: 'list' }),
                }).then(r => r.json()),
                fetch(`${API}/league-manage`, { headers: getAuthHeaders() }).then(r => r.json()),
            ])
            setConfigs(configRes.configs || [])
            setLeagues(leagueRes.leagues || [])
        } catch (err) {
            showToast('error', err.message)
        } finally {
            setLoading(false)
        }
    }, [showToast])

    useEffect(() => { loadData() }, [loadData])

    const handleConfigure = async () => {
        if (!form.league_id || !form.channel_id) {
            showToast('error', 'League and Channel ID are required')
            return
        }
        setSaving(true)
        try {
            const res = await fetch(`${API}/banned-content`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    action: 'configure',
                    league_id: parseInt(form.league_id),
                    channel_id: form.channel_id.trim(),
                    ...(form.message_id.trim() && { message_id: form.message_id.trim() }),
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            showToast('success', 'Configured and synced')
            setShowForm(false)
            setForm({ league_id: '', channel_id: '', message_id: '' })
            loadData()
        } catch (err) {
            showToast('error', err.message)
        } finally {
            setSaving(false)
        }
    }

    const handleSync = async (leagueId = null) => {
        setSyncing(leagueId || 'all')
        try {
            const res = await fetch(`${API}/banned-content`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ action: 'sync', ...(leagueId && { league_id: leagueId }) }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            showToast('success', 'Sync complete')
            loadData()
        } catch (err) {
            showToast('error', err.message)
        } finally {
            setSyncing(null)
        }
    }

    const handleRemove = async (leagueId) => {
        if (!confirm('Remove banned content configuration for this league?')) return
        try {
            const res = await fetch(`${API}/banned-content`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ action: 'remove', league_id: leagueId }),
            })
            if (!res.ok) throw new Error((await res.json()).error)
            showToast('success', 'Removed')
            loadData()
        } catch (err) {
            showToast('error', err.message)
        }
    }

    // Leagues not yet configured
    const unconfiguredLeagues = leagues.filter(l => !configs.some(c => c.league_id === l.id))

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100">
            <PageTitle title="Banned Content Manager" noindex />

            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg border text-sm ${
                    toast.type === 'success' ? 'bg-green-900/90 border-green-600 text-green-200' : 'bg-red-900/90 border-red-600 text-red-200'
                }`}>
                    {toast.message}
                </div>
            )}

            {/* Header */}
            <div className="bg-gray-900/80 border-b border-gray-800 px-4 py-3">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link to="/admin" className="text-gray-400 hover:text-gray-200 transition">
                            <Home className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-lg font-semibold">Banned Content</h1>
                            <p className="text-xs text-gray-500">Sync ban lists from Discord channels</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {configs.length > 0 && (
                            <button
                                onClick={() => handleSync()}
                                disabled={syncing}
                                className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 transition flex items-center gap-1.5"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${syncing === 'all' ? 'animate-spin' : ''}`} />
                                Sync All
                            </button>
                        )}
                        <button
                            onClick={() => setShowForm(true)}
                            className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-sm text-white font-medium transition"
                        >
                            + Configure
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto p-4 space-y-4">
                {/* Configured leagues */}
                {configs.map(config => (
                    <div key={config.id} className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-100">{config.league_name}</h3>
                                <p className="text-sm text-gray-500 mt-0.5">
                                    Channel: <span className="text-gray-400 font-mono text-xs">{config.channel_id}</span>
                                    {' · '}
                                    Message: <span className="text-gray-400 font-mono text-xs">{config.message_id}</span>
                                </p>
                                {config.last_synced_at && (
                                    <p className="text-xs text-green-500 mt-1">
                                        Last synced: {new Date(config.last_synced_at).toLocaleString()}
                                    </p>
                                )}
                                {/* Preview */}
                                {config.parsed_data?.sections?.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {config.parsed_data.sections.filter(s => s.items?.length > 0).map(s => (
                                            <span key={s.name} className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded">
                                                {s.name}: {s.items.length}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <button
                                    onClick={() => handleSync(config.league_id)}
                                    disabled={syncing}
                                    className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 transition"
                                    title="Sync now"
                                >
                                    <RefreshCw className={`w-4 h-4 ${syncing === config.league_id ? 'animate-spin' : ''}`} />
                                </button>
                                <button
                                    onClick={() => handleRemove(config.league_id)}
                                    className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm hover:bg-red-500/20 transition"
                                >
                                    Remove
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {configs.length === 0 && (
                    <div className="text-center text-gray-500 py-12">
                        No ban lists configured yet. Click &quot;+ Configure&quot; to add one.
                    </div>
                )}
            </div>

            {/* Configure modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setShowForm(false)}>
                    <div className="bg-gray-900 rounded-xl border border-gray-700 p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-semibold text-gray-100 mb-4">Configure Ban List Channel</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">League</label>
                                <select
                                    value={form.league_id}
                                    onChange={e => setForm({ ...form, league_id: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100"
                                >
                                    <option value="">Select league...</option>
                                    {unconfiguredLeagues.map(l => (
                                        <option key={l.id} value={l.id}>{l.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Discord Channel ID</label>
                                <input
                                    type="text"
                                    value={form.channel_id}
                                    onChange={e => setForm({ ...form, channel_id: e.target.value })}
                                    placeholder="Right-click channel → Copy Channel ID"
                                    className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 placeholder:text-gray-600"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Discord Message ID <span className="text-gray-500 font-normal">(optional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={form.message_id}
                                    onChange={e => setForm({ ...form, message_id: e.target.value })}
                                    placeholder="Leave blank to auto-detect from channel"
                                    className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 placeholder:text-gray-600"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    If left blank, the most recent ban list message in the channel will be used automatically.
                                    This also handles leagues that delete and re-post their ban list.
                                </p>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setShowForm(false)}
                                    className="flex-1 px-4 py-2 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfigure}
                                    disabled={saving}
                                    className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition disabled:opacity-50"
                                >
                                    {saving ? 'Configuring...' : 'Configure & Sync'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

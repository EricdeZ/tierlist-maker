// src/pages/admin/DiscordQueue.jsx
import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Home } from 'lucide-react'
import { getAuthHeaders } from '../../services/adminApi.js'
import PageTitle from '../../components/PageTitle'

const API = import.meta.env.VITE_API_URL || '/.netlify/functions'

export default function DiscordQueue() {
    const navigate = useNavigate()

    // ─── State ───
    const [channels, setChannels] = useState([])
    const [queueItems, setQueueItems] = useState([])
    const [divisions, setDivisions] = useState([])
    const [loading, setLoading] = useState(true)
    const [queueLoading, setQueueLoading] = useState(false)
    const [selected, setSelected] = useState({}) // { [itemId]: true }
    const [filterDivision, setFilterDivision] = useState('')
    const [showChannelForm, setShowChannelForm] = useState(false)
    const [channelForm, setChannelForm] = useState({ channel_id: '', channel_name: '', guild_id: '', guild_name: '', division_id: '' })
    const [saving, setSaving] = useState(false)
    const [polling, setPolling] = useState(false)
    const [fetchingImages, setFetchingImages] = useState(false)
    const [toast, setToast] = useState(null)

    const showToast = useCallback((type, message) => {
        const id = Date.now()
        setToast({ type, message, id })
        setTimeout(() => setToast(prev => prev?.id === id ? null : prev), 4000)
    }, [])

    // ─── Fetch channels + divisions on mount ───
    useEffect(() => {
        Promise.all([
            fetch(`${API}/discord-queue?action=channels`, { headers: getAuthHeaders() }).then(r => r.json()),
            fetch(`${API}/admin-data`, { headers: getAuthHeaders() }).then(r => r.json()),
        ])
            .then(([channelData, adminData]) => {
                setChannels(channelData.channels || [])
                // Build unique divisions from admin-data seasons
                const divMap = {}
                for (const s of (adminData.seasons || [])) {
                    divMap[s.division_id] = { id: s.division_id, name: s.division_name, league: s.league_name }
                }
                setDivisions(Object.values(divMap))
            })
            .catch(err => showToast('error', err.message))
            .finally(() => setLoading(false))
    }, [showToast])

    // ─── Fetch queue items ───
    const fetchQueue = useCallback(async () => {
        setQueueLoading(true)
        try {
            const params = new URLSearchParams({ action: 'queue' })
            if (filterDivision) params.set('divisionId', filterDivision)
            const res = await fetch(`${API}/discord-queue?${params}`, { headers: getAuthHeaders() })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const data = await res.json()
            setQueueItems(data.items || [])
            setSelected({})
        } catch (err) {
            showToast('error', err.message)
        } finally {
            setQueueLoading(false)
        }
    }, [filterDivision, showToast])

    useEffect(() => { fetchQueue() }, [fetchQueue])

    // ─── Channel config actions ───
    const addChannel = async () => {
        if (!channelForm.channel_id || !channelForm.guild_id || !channelForm.division_id) {
            showToast('error', 'Channel ID, Server ID, and Division are required')
            return
        }
        setSaving(true)
        try {
            const res = await fetch(`${API}/discord-queue`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ action: 'add-channel', ...channelForm, division_id: parseInt(channelForm.division_id) }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            showToast('success', 'Channel added')
            setShowChannelForm(false)
            setChannelForm({ channel_id: '', channel_name: '', guild_id: '', guild_name: '', division_id: '' })
            // Refresh channels
            const chRes = await fetch(`${API}/discord-queue?action=channels`, { headers: getAuthHeaders() })
            setChannels((await chRes.json()).channels || [])
        } catch (err) {
            showToast('error', err.message)
        } finally {
            setSaving(false)
        }
    }

    const removeChannel = async (id) => {
        try {
            const res = await fetch(`${API}/discord-queue`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ action: 'remove-channel', id }),
            })
            if (!res.ok) throw new Error((await res.json()).error)
            showToast('success', 'Channel deactivated')
            setChannels(prev => prev.filter(c => c.id !== id))
        } catch (err) {
            showToast('error', err.message)
        }
    }

    // ─── Poll Now ───
    const pollNow = async () => {
        setPolling(true)
        try {
            const res = await fetch(`${API}/discord-queue`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ action: 'poll-now' }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            const results = data.results || []
            const totalNew = results.reduce((s, r) => s + (r.newImages || 0), 0)
            const totalMsgs = results.reduce((s, r) => s + (r.totalMessages || 0), 0)
            const errors = results.filter(r => r.error)

            if (errors.length) {
                showToast('error', `Poll errors: ${errors.map(e => `${e.channelName || e.channelId}: ${e.error}`).join('; ')}`)
            } else {
                showToast('success', `Poll complete — ${totalNew} new image${totalNew !== 1 ? 's' : ''} from ${totalMsgs} message${totalMsgs !== 1 ? 's' : ''}`)
            }
            fetchQueue()
            // Refresh channels for updated poll times
            const chRes = await fetch(`${API}/discord-queue?action=channels`, { headers: getAuthHeaders() })
            setChannels((await chRes.json()).channels || [])
        } catch (err) {
            showToast('error', `Poll failed: ${err.message}`)
        } finally {
            setPolling(false)
        }
    }

    // ─── Selection helpers ───
    const selectedIds = Object.keys(selected).filter(k => selected[k]).map(Number)
    const selectedCount = selectedIds.length

    const toggleSelect = (id) => {
        setSelected(prev => ({ ...prev, [id]: !prev[id] }))
    }

    const selectAll = () => {
        if (selectedCount === queueItems.length) {
            setSelected({})
        } else {
            const all = {}
            for (const item of queueItems) all[item.id] = true
            setSelected(all)
        }
    }

    // ─── Send to Match Report ───
    const sendToMatchReport = async () => {
        if (!selectedCount) return
        setFetchingImages(true)
        try {
            const res = await fetch(`${API}/discord-queue`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ action: 'fetch-images', queue_item_ids: selectedIds }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            const images = (data.images || []).filter(img => img.data)
            const errors = (data.images || []).filter(img => img.error)

            if (!images.length) {
                throw new Error(errors.length ? errors[0].error : 'No images could be fetched')
            }

            if (errors.length) {
                showToast('error', `${errors.length} image(s) could not be fetched`)
            }

            // Gather message text from selected items for match text
            const selectedItems = queueItems.filter(q => selected[q.id])
            const texts = [...new Set(selectedItems.map(q => q.message_content).filter(Boolean))]
            const combinedText = texts.join('\n').trim()

            navigate('/admin/matchreport', {
                state: {
                    discordImages: images,
                    discordText: combinedText,
                    discordQueueItemIds: selectedIds,
                },
            })
        } catch (err) {
            showToast('error', err.message)
        } finally {
            setFetchingImages(false)
        }
    }

    // ─── Skip selected ───
    const skipSelected = async () => {
        if (!selectedCount) return
        try {
            const res = await fetch(`${API}/discord-queue`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ action: 'update-status', queue_item_ids: selectedIds, status: 'skipped' }),
            })
            if (!res.ok) throw new Error((await res.json()).error)
            showToast('success', `${selectedCount} item(s) skipped`)
            fetchQueue()
        } catch (err) {
            showToast('error', err.message)
        }
    }

    // ─── Render ───
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100">
            <PageTitle title="Discord Queue" />

            {/* Header */}
            <div className="bg-gray-900/80 border-b border-gray-800 px-4 py-3">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link to="/admin" className="text-gray-400 hover:text-gray-200 transition">
                            <Home className="w-5 h-5" />
                        </Link>
                        <h1 className="text-lg font-semibold">Discord Queue</h1>
                    </div>
                    <button
                        onClick={pollNow}
                        disabled={polling}
                        className="px-3 py-1.5 text-sm rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-wait transition"
                    >
                        {polling ? 'Polling...' : 'Poll Now'}
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-4 space-y-6">
                {/* Toast */}
                {toast && (
                    <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg border text-sm transition-all ${
                        toast.type === 'success' ? 'bg-green-900/90 border-green-600 text-green-200' : 'bg-red-900/90 border-red-600 text-red-200'
                    }`}>
                        {toast.message}
                    </div>
                )}

                {/* ═══ Channel Configuration ═══ */}
                <section className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Configured Channels</h2>
                        <button
                            onClick={() => setShowChannelForm(!showChannelForm)}
                            className="text-xs px-3 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 transition"
                        >
                            {showChannelForm ? 'Cancel' : '+ Add Channel'}
                        </button>
                    </div>

                    {/* Add channel form */}
                    {showChannelForm && (
                        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 mb-4 space-y-3">
                            <p className="text-xs text-gray-400 mb-2">
                                Enable Discord Developer Mode (Settings &gt; Advanced) to copy IDs by right-clicking channels/servers.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <input
                                    type="text" placeholder="Channel ID *"
                                    value={channelForm.channel_id}
                                    onChange={e => setChannelForm(p => ({ ...p, channel_id: e.target.value }))}
                                    className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                                />
                                <input
                                    type="text" placeholder="Channel Name (optional)"
                                    value={channelForm.channel_name}
                                    onChange={e => setChannelForm(p => ({ ...p, channel_name: e.target.value }))}
                                    className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                                />
                                <input
                                    type="text" placeholder="Server (Guild) ID *"
                                    value={channelForm.guild_id}
                                    onChange={e => setChannelForm(p => ({ ...p, guild_id: e.target.value }))}
                                    className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                                />
                                <input
                                    type="text" placeholder="Server Name (optional)"
                                    value={channelForm.guild_name}
                                    onChange={e => setChannelForm(p => ({ ...p, guild_name: e.target.value }))}
                                    className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                                />
                            </div>
                            <select
                                value={channelForm.division_id}
                                onChange={e => setChannelForm(p => ({ ...p, division_id: e.target.value }))}
                                className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm w-full focus:border-purple-500 focus:outline-none"
                            >
                                <option value="">Select Division *</option>
                                {divisions.map(d => (
                                    <option key={d.id} value={d.id}>{d.league} — {d.name}</option>
                                ))}
                            </select>
                            <button
                                onClick={addChannel}
                                disabled={saving}
                                className="px-4 py-2 text-sm rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition"
                            >
                                {saving ? 'Saving...' : 'Add Channel'}
                            </button>
                        </div>
                    )}

                    {/* Channel list */}
                    {channels.length === 0 ? (
                        <p className="text-sm text-gray-500">No channels configured. Add a Discord channel to start collecting screenshots.</p>
                    ) : (
                        <div className="space-y-2">
                            {channels.map(ch => (
                                <div key={ch.id} className="flex items-center justify-between bg-gray-800/40 border border-gray-700/50 rounded-lg px-3 py-2">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ch.is_active ? 'bg-green-500' : 'bg-gray-600'}`} />
                                        <div className="min-w-0">
                                            <div className="text-sm font-medium truncate">
                                                {ch.guild_name || ch.guild_id} / #{ch.channel_name || ch.channel_id}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {ch.league_name} — {ch.division_name}
                                                {ch.pending_count > 0 && (
                                                    <span className="ml-2 text-yellow-400">{ch.pending_count} pending</span>
                                                )}
                                                {ch.last_polled_at && (
                                                    <span className="ml-2">Last polled: {new Date(ch.last_polled_at).toLocaleString()}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => removeChannel(ch.id)}
                                        className="text-xs px-2 py-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* ═══ Queue ═══ */}
                <section className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
                    {/* Queue header */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Pending Screenshots</h2>
                            <span className="text-xs text-gray-500">
                                {queueItems.length} item{queueItems.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                value={filterDivision}
                                onChange={e => setFilterDivision(e.target.value)}
                                className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs focus:border-purple-500 focus:outline-none"
                            >
                                <option value="">All Divisions</option>
                                {divisions.map(d => (
                                    <option key={d.id} value={d.id}>{d.league} — {d.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Actions bar */}
                    {queueItems.length > 0 && (
                        <div className="flex items-center gap-2 mb-4 flex-wrap">
                            <button
                                onClick={selectAll}
                                className="text-xs px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 transition"
                            >
                                {selectedCount === queueItems.length ? 'Deselect All' : 'Select All'}
                            </button>
                            {selectedCount > 0 && (
                                <>
                                    <span className="text-xs text-gray-400">{selectedCount} selected</span>
                                    <button
                                        onClick={sendToMatchReport}
                                        disabled={fetchingImages}
                                        className="text-xs px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-wait font-medium transition"
                                    >
                                        {fetchingImages ? 'Fetching Images...' : `Send to Match Report (${selectedCount})`}
                                    </button>
                                    <button
                                        onClick={skipSelected}
                                        className="text-xs px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition"
                                    >
                                        Skip
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {/* Queue grid */}
                    {queueLoading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-purple-500" />
                        </div>
                    ) : queueItems.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <p className="text-sm">No pending screenshots</p>
                            <p className="text-xs mt-1">Configure channels above and click "Poll Now" to fetch screenshots from Discord</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {queueItems.map(item => (
                                <div
                                    key={item.id}
                                    onClick={() => toggleSelect(item.id)}
                                    className={`relative cursor-pointer rounded-lg border overflow-hidden transition-all ${
                                        selected[item.id]
                                            ? 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-500/5'
                                            : 'border-gray-700 hover:border-gray-600 bg-gray-800/40'
                                    }`}
                                >
                                    {/* Checkbox */}
                                    <div className="absolute top-2 left-2 z-10">
                                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                                            selected[item.id]
                                                ? 'bg-blue-600 border-blue-600'
                                                : 'border-gray-500 bg-gray-900/60'
                                        }`}>
                                            {selected[item.id] && (
                                                <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M2 6l3 3 5-5" />
                                                </svg>
                                            )}
                                        </div>
                                    </div>

                                    {/* Thumbnail */}
                                    <div className="aspect-video bg-gray-900 flex items-center justify-center overflow-hidden">
                                        <img
                                            src={item.attachment_url}
                                            alt={item.attachment_filename || 'Screenshot'}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                            onError={e => {
                                                e.target.style.display = 'none'
                                                e.target.parentElement.innerHTML = '<span class="text-xs text-gray-600">Preview unavailable</span>'
                                            }}
                                        />
                                    </div>

                                    {/* Info */}
                                    <div className="p-2 space-y-1">
                                        <div className="text-xs text-gray-400 truncate">
                                            {item.author_name || 'Unknown'}
                                        </div>
                                        {item.message_content && (
                                            <div className="text-xs text-gray-500 truncate">
                                                {item.message_content}
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-purple-400 truncate">
                                                {item.division_name}
                                            </span>
                                            <span className="text-[10px] text-gray-600">
                                                {formatTimestamp(item.message_timestamp)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    )
}

function formatTimestamp(ts) {
    if (!ts) return ''
    const d = new Date(ts)
    const now = new Date()
    const diffMs = now - d
    const diffHrs = diffMs / (1000 * 60 * 60)

    if (diffHrs < 1) return `${Math.round(diffMs / 60000)}m ago`
    if (diffHrs < 24) return `${Math.round(diffHrs)}h ago`
    if (diffHrs < 168) return `${Math.round(diffHrs / 24)}d ago`
    return d.toLocaleDateString()
}

// src/pages/admin/DiscordQueue.jsx — Channel configuration + Test DM
import { useState, useEffect, useCallback } from 'react'
import { getAuthHeaders } from '../../services/adminApi.js'
import { useAuth } from '../../context/AuthContext'
import PageTitle from '../../components/PageTitle'

const API = import.meta.env.VITE_API_URL || '/api'

export default function DiscordQueue() {
    const { hasPermission, permissions } = useAuth()
    const isOwner = hasPermission('permission_manage')
    const isGlobalAdmin = permissions.global.includes('match_report')
    const [channels, setChannels] = useState([])
    const [divisions, setDivisions] = useState([])
    const [loading, setLoading] = useState(true)
    const [showChannelForm, setShowChannelForm] = useState(false)
    const [channelForm, setChannelForm] = useState({ channel_id: '', channel_name: '', guild_id: '', guild_name: '', division_id: '', notification_webhook_url: '' })
    const [saving, setSaving] = useState(false)
    const [polling, setPolling] = useState(false)
    const [toast, setToast] = useState(null)

    // Test DM state
    const [testDmUserId, setTestDmUserId] = useState('')
    const [testDmMessage, setTestDmMessage] = useState('')
    const [testDmSending, setTestDmSending] = useState(false)

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
                const divMap = {}
                for (const s of (adminData.seasons || [])) {
                    divMap[s.division_id] = { id: s.division_id, name: s.division_name, league: s.league_name }
                }
                setDivisions(Object.values(divMap))
            })
            .catch(err => showToast('error', err.message))
            .finally(() => setLoading(false))
    }, [showToast])

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
            setChannelForm({ channel_id: '', channel_name: '', guild_id: '', guild_name: '', division_id: '', notification_webhook_url: '' })
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
            const chRes = await fetch(`${API}/discord-queue?action=channels`, { headers: getAuthHeaders() })
            setChannels((await chRes.json()).channels || [])
        } catch (err) {
            showToast('error', `Poll failed: ${err.message}`)
        } finally {
            setPolling(false)
        }
    }

    // ─── Test DM ───
    const sendTestDM = async () => {
        if (!testDmUserId.trim()) {
            showToast('error', 'Discord User ID is required')
            return
        }
        setTestDmSending(true)
        try {
            const res = await fetch(`${API}/discord-queue`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ action: 'send-test-dm', discord_user_id: testDmUserId.trim(), message: testDmMessage.trim() || undefined }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            showToast('success', 'Test DM sent (if the user has DMs enabled)')
            setTestDmUserId('')
            setTestDmMessage('')
        } catch (err) {
            showToast('error', `DM failed: ${err.message}`)
        } finally {
            setTestDmSending(false)
        }
    }

    // ─── Skip All Pending (Owner only) ───
    const skipChannelPending = async (ch) => {
        if (!confirm(`Skip all ${ch.pending_count} pending screenshots for #${ch.channel_name || ch.channel_id}?`)) return
        try {
            const res = await fetch(`${API}/discord-queue`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ action: 'skip-channel-pending', channel_id: ch.id }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            showToast('success', `Skipped ${data.skipped} pending screenshot${data.skipped !== 1 ? 's' : ''}`)
            const chRes = await fetch(`${API}/discord-queue?action=channels`, { headers: getAuthHeaders() })
            setChannels((await chRes.json()).channels || [])
        } catch (err) {
            showToast('error', `Skip failed: ${err.message}`)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100">
            <PageTitle title="Discord Configuration" noindex />

            <div className="max-w-7xl mx-auto p-4 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-semibold">Discord Configuration</h1>
                        <p className="text-xs text-gray-500">Channel connections and auto-match settings</p>
                    </div>
                    {isGlobalAdmin && (
                        <button
                            onClick={pollNow}
                            disabled={polling}
                            className="px-3 py-1.5 text-sm rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-wait transition"
                        >
                            {polling ? 'Polling...' : 'Poll Now'}
                        </button>
                    )}
                </div>
                {/* Toast */}
                {toast && (
                    <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg border text-sm transition-all ${
                        toast.type === 'success' ? 'bg-green-900/90 border-green-600 text-green-200' : 'bg-red-900/90 border-red-600 text-red-200'
                    }`}>
                        {toast.message}
                    </div>
                )}

                {/* ═══ Channel Configuration (global admins only) ═══ */}
                {isGlobalAdmin && <section className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
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
                            <input
                                type="text" placeholder="Notification Webhook URL (optional)"
                                value={channelForm.notification_webhook_url}
                                onChange={e => setChannelForm(p => ({ ...p, notification_webhook_url: e.target.value }))}
                                className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm w-full focus:border-purple-500 focus:outline-none"
                            />
                            <p className="text-[10px] text-gray-500">
                                Webhook receives notifications when screenshots are auto-matched to scheduled matches.
                            </p>
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
                                    <div className="flex items-center gap-1 shrink-0">
                                        {isOwner && ch.pending_count > 0 && (
                                            <button
                                                onClick={() => skipChannelPending(ch)}
                                                className="text-xs px-2 py-1 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10 rounded transition"
                                            >
                                                Skip All
                                            </button>
                                        )}
                                        <button
                                            onClick={() => removeChannel(ch.id)}
                                            className="text-xs px-2 py-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>}

                {/* ═══ Test DM (global admins only) ═══ */}
                {isGlobalAdmin && <section className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
                    <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Test Bot DM</h2>
                    <p className="text-xs text-gray-500 mb-3">
                        Send a test DM via the bot to verify DM delivery is working. Enable Discord Developer Mode (Settings &gt; Advanced) to copy a User ID by right-clicking a user.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <input
                            type="text"
                            placeholder="Discord User ID *"
                            value={testDmUserId}
                            onChange={e => setTestDmUserId(e.target.value)}
                            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:outline-none w-48 flex-shrink-0"
                        />
                        <input
                            type="text"
                            placeholder="Custom message (optional)"
                            value={testDmMessage}
                            onChange={e => setTestDmMessage(e.target.value)}
                            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:outline-none flex-1"
                        />
                        <button
                            onClick={sendTestDM}
                            disabled={testDmSending || !testDmUserId.trim()}
                            className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex-shrink-0"
                        >
                            {testDmSending ? 'Sending...' : 'Send Test DM'}
                        </button>
                    </div>
                </section>}
            </div>
        </div>
    )
}

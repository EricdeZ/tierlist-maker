// src/pages/admin/DiscordQueue.jsx — Channel configuration + Team role mapping
import { useState, useEffect, useCallback, useMemo } from 'react'
import { getAuthHeaders } from '../../services/adminApi.js'
import { useAuth } from '../../context/AuthContext'
import PageTitle from '../../components/PageTitle'

const API = import.meta.env.VITE_API_URL || '/api'

export default function DiscordQueue() {
    const { hasPermission } = useAuth()
    const isOwner = hasPermission('permission_manage')
    const [channels, setChannels] = useState([])
    const [divisions, setDivisions] = useState([])
    const [seasons, setSeasons] = useState([])
    const [loading, setLoading] = useState(true)
    const [showChannelForm, setShowChannelForm] = useState(false)
    const [channelForm, setChannelForm] = useState({ channel_id: '', channel_name: '', guild_id: '', guild_name: '', division_id: '', notification_webhook_url: '' })
    const [saving, setSaving] = useState(false)
    const [polling, setPolling] = useState(false)
    const [toast, setToast] = useState(null)

    // Team role mapping state
    const [selectedSeasonId, setSelectedSeasonId] = useState(null)
    const [teamMappings, setTeamMappings] = useState([]) // teams with discord_role_id
    const [guildRoles, setGuildRoles] = useState([])      // available Discord roles
    const [mappingChanges, setMappingChanges] = useState({}) // { teamId: roleId }
    const [mappingSaving, setMappingSaving] = useState(false)
    const [loadingMappings, setLoadingMappings] = useState(false)
    const [extraGuildId, setExtraGuildId] = useState('')
    const [mappingSummary, setMappingSummary] = useState([])  // per-division counts

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
            fetch(`${API}/discord-queue?action=mapping-summary`, { headers: getAuthHeaders() }).then(r => r.json()),
        ])
            .then(([channelData, adminData, summaryData]) => {
                setChannels(channelData.channels || [])
                setMappingSummary(summaryData.divisions || [])
                const divMap = {}
                const seasonList = []
                for (const s of (adminData.seasons || [])) {
                    divMap[s.division_id] = { id: s.division_id, name: s.division_name, league: s.league_name }
                    seasonList.push(s)
                }
                setDivisions(Object.values(divMap))
                setSeasons(seasonList)
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

    // ─── Team Role Mapping ───
    const loadTeamMappings = useCallback(async (seasonId) => {
        if (!seasonId) {
            setTeamMappings([])
            setMappingChanges({})
            return
        }
        setLoadingMappings(true)
        try {
            const res = await fetch(`${API}/discord-queue?action=team-role-mappings&seasonId=${seasonId}`, { headers: getAuthHeaders() })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setTeamMappings(data.teams || [])
            setMappingChanges({})
        } catch (err) {
            showToast('error', `Failed to load mappings: ${err.message}`)
        } finally {
            setLoadingMappings(false)
        }
    }, [showToast])

    // Fetch guild roles scoped to the selected season's league + extra guild ID
    const loadGuildRoles = useCallback(async () => {
        const selectedSeason = seasons.find(s => s.season_id === selectedSeasonId)
        const leagueName = selectedSeason?.league_name

        // Only use guilds from channels belonging to the same league
        const leagueChannels = leagueName
            ? channels.filter(c => c.guild_id && c.league_name === leagueName)
            : channels.filter(c => c.guild_id)
        const guildIds = [...new Set(leagueChannels.map(c => c.guild_id))]
        if (extraGuildId.trim()) guildIds.push(extraGuildId.trim())
        const unique = [...new Set(guildIds)]

        const allRoles = []
        const seenIds = new Set()
        for (const guildId of unique) {
            try {
                const rolesRes = await fetch(`${API}/discord-queue?action=guild-roles&guildId=${guildId}`, { headers: getAuthHeaders() })
                const rolesData = await rolesRes.json()
                if (rolesRes.ok) {
                    const guildName = channels.find(c => c.guild_id === guildId)?.guild_name || guildId
                    for (const role of (rolesData.roles || [])) {
                        if (!seenIds.has(role.id)) {
                            seenIds.add(role.id)
                            allRoles.push({ ...role, guild: guildName })
                        }
                    }
                }
            } catch {}
        }
        setGuildRoles(allRoles)
    }, [channels, seasons, selectedSeasonId, extraGuildId])

    useEffect(() => {
        if (selectedSeasonId) loadTeamMappings(selectedSeasonId)
    }, [selectedSeasonId, loadTeamMappings])

    useEffect(() => {
        if (selectedSeasonId) loadGuildRoles()
    }, [selectedSeasonId, loadGuildRoles])

    const handleRoleChange = (teamId, roleId) => {
        setMappingChanges(prev => ({ ...prev, [teamId]: roleId }))
    }

    const saveMappings = async () => {
        const entries = Object.entries(mappingChanges)
        if (!entries.length) return
        setMappingSaving(true)
        try {
            for (const [teamId, roleId] of entries) {
                const res = await fetch(`${API}/discord-queue`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ action: 'map-team-role', team_id: parseInt(teamId), discord_role_id: roleId || null }),
                })
                if (!res.ok) throw new Error((await res.json()).error)
            }
            showToast('success', `${entries.length} mapping${entries.length > 1 ? 's' : ''} saved`)
            setMappingChanges({})
            loadTeamMappings(selectedSeasonId)
        } catch (err) {
            showToast('error', `Save failed: ${err.message}`)
        } finally {
            setMappingSaving(false)
        }
    }

    const autoMatchByName = () => {
        if (!guildRoles.length || !teamMappings.length) return
        const changes = {}
        for (const team of teamMappings) {
            if (team.discord_role_id) continue // already mapped
            const teamLower = team.name.toLowerCase()
            const matches = guildRoles.filter(r => r.name.toLowerCase().includes(teamLower))
            if (matches.length === 1) {
                changes[team.id] = matches[0].id
            } else if (matches.length > 1 && team.division_name) {
                // Disambiguate using division suffix (first letter + D, e.g. Crete → CD)
                const suffix = (team.division_name[0] + 'D').toLowerCase()
                const suffixMatch = matches.find(r => r.name.toLowerCase().endsWith(suffix))
                if (suffixMatch) changes[team.id] = suffixMatch.id
            }
        }
        if (Object.keys(changes).length) {
            setMappingChanges(prev => ({ ...prev, ...changes }))
            showToast('success', `Auto-matched ${Object.keys(changes).length} team${Object.keys(changes).length > 1 ? 's' : ''}. Review and save.`)
        } else {
            showToast('error', 'No auto-matches found')
        }
    }

    // Merge current mappings with pending changes for display
    const displayMappings = useMemo(() => {
        return teamMappings.map(t => ({
            ...t,
            effectiveRoleId: mappingChanges[t.id] !== undefined ? mappingChanges[t.id] : t.discord_role_id,
            hasChange: mappingChanges[t.id] !== undefined,
        }))
    }, [teamMappings, mappingChanges])

    const pendingChangeCount = Object.keys(mappingChanges).length
    const mappedCount = displayMappings.filter(t => t.effectiveRoleId).length
    const totalCount = displayMappings.length

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
                        <p className="text-xs text-gray-500">Channels, team role mapping, and auto-match settings</p>
                    </div>
                    <button
                        onClick={pollNow}
                        disabled={polling}
                        className="px-3 py-1.5 text-sm rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-wait transition"
                    >
                        {polling ? 'Polling...' : 'Poll Now'}
                    </button>
                </div>
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
                </section>

                {/* ═══ Team Role Mapping ═══ */}
                <section className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Team Role Mapping</h2>
                            <p className="text-xs text-gray-500 mt-0.5">Link Discord roles to teams for automatic screenshot-to-match matching</p>
                        </div>
                        {totalCount > 0 && (
                            <div className="text-xs text-gray-400">
                                <span className={mappedCount === totalCount ? 'text-green-400' : 'text-yellow-400'}>
                                    {mappedCount}/{totalCount} mapped
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Season selector */}
                    <select
                        value={selectedSeasonId || ''}
                        onChange={e => setSelectedSeasonId(e.target.value ? parseInt(e.target.value) : null)}
                        className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm w-full focus:border-purple-500 focus:outline-none mb-3"
                    >
                        <option value="">Select a season to configure team mappings...</option>
                        {seasons.map(s => (
                            <option key={s.season_id} value={s.season_id}>
                                {s.league_name} — {s.division_name} — {s.season_name}{s.is_active ? '' : ' (inactive)'}
                            </option>
                        ))}
                    </select>

                    {/* Summary when no season selected */}
                    {!selectedSeasonId && mappingSummary.length > 0 && (
                        <div className="space-y-1.5">
                            {mappingSummary.map((d, i) => (
                                <div key={i} className="flex items-center justify-between bg-gray-800/40 border border-gray-700/50 rounded-lg px-3 py-2">
                                    <span className="text-sm text-gray-300">
                                        {d.league_name} — {d.division_name}
                                    </span>
                                    <span className={`text-xs font-medium ${d.mapped === d.total ? 'text-green-400' : d.mapped > 0 ? 'text-yellow-400' : 'text-gray-500'}`}>
                                        {d.mapped}/{d.total} mapped
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Extra guild ID for servers without configured channels */}
                    {selectedSeasonId && (
                        <input
                            type="text"
                            value={extraGuildId}
                            onChange={e => setExtraGuildId(e.target.value)}
                            placeholder="Additional Server ID (for servers without configured channels)"
                            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm w-full focus:border-purple-500 focus:outline-none mb-3"
                        />
                    )}

                    {loadingMappings && (
                        <div className="flex justify-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-blue-500" />
                        </div>
                    )}

                    {selectedSeasonId && !loadingMappings && displayMappings.length > 0 && (
                        <>
                            {/* Action buttons */}
                            <div className="flex items-center gap-2 mb-3">
                                <button
                                    onClick={autoMatchByName}
                                    className="text-xs px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 transition"
                                >
                                    Auto-match by name
                                </button>
                                {pendingChangeCount > 0 && (
                                    <button
                                        onClick={saveMappings}
                                        disabled={mappingSaving}
                                        className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition"
                                    >
                                        {mappingSaving ? 'Saving...' : `Save ${pendingChangeCount} change${pendingChangeCount > 1 ? 's' : ''}`}
                                    </button>
                                )}
                            </div>

                            {/* Mapping rows */}
                            <div className="space-y-2">
                                {displayMappings.map(team => (
                                    <div
                                        key={team.id}
                                        className={`flex items-center gap-3 bg-gray-800/40 border rounded-lg px-3 py-2 ${
                                            team.hasChange ? 'border-blue-500/50' :
                                            team.effectiveRoleId ? 'border-gray-700/50' : 'border-yellow-600/30'
                                        }`}
                                    >
                                        {/* Status dot */}
                                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                            team.effectiveRoleId ? 'bg-green-500' : 'bg-yellow-500'
                                        }`} />

                                        {/* Team name + color */}
                                        <div className="flex items-center gap-2 min-w-0 w-48 flex-shrink-0">
                                            <span
                                                className="w-3 h-3 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: team.color }}
                                            />
                                            <span className="text-sm font-medium truncate">{team.name}</span>
                                        </div>

                                        {/* Arrow */}
                                        <span className="text-gray-600 flex-shrink-0">&rarr;</span>

                                        {/* Role dropdown */}
                                        <select
                                            value={team.effectiveRoleId || ''}
                                            onChange={e => handleRoleChange(team.id, e.target.value || null)}
                                            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-sm focus:border-purple-500 focus:outline-none"
                                        >
                                            <option value="">-- Not mapped --</option>
                                            {guildRoles.map(r => (
                                                <option key={r.id} value={r.id}>{r.name}{r.guild ? ` (${r.guild})` : ''}</option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {selectedSeasonId && !loadingMappings && displayMappings.length === 0 && (
                        <p className="text-sm text-gray-500 py-2">No teams found for this season.</p>
                    )}
                </section>
            </div>
        </div>
    )
}

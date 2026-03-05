// src/pages/admin/DiscordRosterSync.jsx — Team role mapping + roster sync from Discord
import { useState, useEffect, useCallback, useMemo } from 'react'
import { getAuthHeaders } from '../../services/adminApi.js'
import { useAuth } from '../../context/AuthContext'
import PageTitle from '../../components/PageTitle'

const API = import.meta.env.VITE_API_URL || '/api'

const MATCH_LABELS = {
    discord_id: 'ID',
    discord_name: 'name',
    player_name: 'smite',
    fuzzy: 'fuzzy',
}

const TYPE_STYLES = {
    promote:  { label: 'PROMOTE',  color: 'text-green-400',  bg: 'bg-green-900/40 text-green-400' },
    demote:   { label: 'DEMOTE',   color: 'text-orange-400', bg: 'bg-orange-900/40 text-orange-400' },
    transfer: { label: 'TRANSFER', color: 'text-blue-400',   bg: 'bg-blue-900/40 text-blue-400' },
    pickup:   { label: 'PICKUP',   color: 'text-cyan-400',   bg: 'bg-cyan-900/40 text-cyan-400' },
    drop:     { label: 'DROP',     color: 'text-red-400',    bg: 'bg-red-900/40 text-red-400' },
    'set-captain':    { label: 'CAPTAIN',  color: 'text-yellow-400', bg: 'bg-yellow-900/40 text-yellow-400' },
    reactivate:       { label: 'REACTIVATE', color: 'text-emerald-400', bg: 'bg-emerald-900/40 text-emerald-400' },
    'create-and-add': { label: 'CREATED',  color: 'text-purple-400', bg: 'bg-purple-900/40 text-purple-400' },
}

function TypeBadge({ type, className = '' }) {
    const style = TYPE_STYLES[type] || { label: type, bg: 'bg-gray-700/50 text-gray-400' }
    return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase ${style.bg} ${className}`}>{style.label}</span>
}

function relativeTime(dateStr) {
    const now = Date.now()
    const diff = now - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    return new Date(dateStr).toLocaleDateString()
}

export default function DiscordRosterSync() {
    useAuth() // auth context required for admin page
    const [loading, setLoading] = useState(true)
    const [toast, setToast] = useState(null)

    // Shared data
    const [channels, setChannels] = useState([])
    const [seasons, setSeasons] = useState([])

    // Team role mapping state
    const [selectedSeasonId, setSelectedSeasonId] = useState(null)
    const [teamMappings, setTeamMappings] = useState([])
    const [guildRoles, setGuildRoles] = useState([])
    const [mappingChanges, setMappingChanges] = useState({})
    const [mappingSaving, setMappingSaving] = useState(false)
    const [loadingMappings, setLoadingMappings] = useState(false)
    const [extraGuildId, setExtraGuildId] = useState('')
    const [mappingSummary, setMappingSummary] = useState([])

    // Roster sync state
    const [syncPreview, setSyncPreview] = useState(null)
    const [syncing, setSyncing] = useState(false)
    const [applying, setApplying] = useState(false)
    const [excluded, setExcluded] = useState(new Set()) // keys toggled off

    // Section collapse state
    const [mappingOpen, setMappingOpen] = useState(false)

    // Transaction history state
    const [transactions, setTransactions] = useState([])
    const [txLoading, setTxLoading] = useState(false)
    const [txTotal, setTxTotal] = useState(0)

    const showToast = useCallback((type, message) => {
        const id = Date.now()
        setToast({ type, message, id })
        setTimeout(() => setToast(prev => prev?.id === id ? null : prev), 4000)
    }, [])

    // ─── Fetch channels + seasons on mount ───
    useEffect(() => {
        Promise.all([
            fetch(`${API}/discord-queue?action=channels`, { headers: getAuthHeaders() }).then(r => r.json()),
            fetch(`${API}/admin-data`, { headers: getAuthHeaders() }).then(r => r.json()),
            fetch(`${API}/discord-queue?action=mapping-summary`, { headers: getAuthHeaders() }).then(r => r.json()),
        ])
            .then(([channelData, adminData, summaryData]) => {
                setChannels(channelData.channels || [])
                setMappingSummary(summaryData.divisions || [])
                setSeasons(adminData.seasons || [])
            })
            .catch(err => showToast('error', err.message))
            .finally(() => setLoading(false))
    }, [showToast])

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

    const loadGuildRoles = useCallback(async () => {
        const selectedSeason = seasons.find(s => s.season_id === selectedSeasonId)
        const leagueName = selectedSeason?.league_name

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
            } catch { /* ignore individual guild fetch failures */ }
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
            if (team.discord_role_id) continue
            const teamLower = team.name.toLowerCase()
            const matches = guildRoles.filter(r => r.name.toLowerCase().includes(teamLower))
            if (matches.length === 1) {
                changes[team.id] = matches[0].id
            } else if (matches.length > 1 && team.division_name) {
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

    // ─── Roster Sync ───
    const previewSync = async () => {
        if (!selectedSeasonId) {
            showToast('error', 'Select a season first')
            return
        }
        setSyncing(true)
        setSyncPreview(null)
        setExcluded(new Set())
        try {
            const res = await fetch(`${API}/roster-sync`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ action: 'preview', seasonId: selectedSeasonId }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setSyncPreview(data)
            // Default-exclude fuzzy matches
            const fuzzyKeys = new Set()
            for (const team of (data.teams || [])) {
                for (const ch of (team.changes || [])) {
                    if (ch.matchMethod === 'fuzzy') fuzzyKeys.add(changeKey(ch))
                }
            }
            setExcluded(fuzzyKeys)
        } catch (err) {
            showToast('error', `Preview failed: ${err.message}`)
        } finally {
            setSyncing(false)
        }
    }

    // Unique key for a change (handles both LP-based and pickup-based)
    const changeKey = (ch) => {
        if (ch.type === 'pickup') return `pickup-${ch.discordId}`
        return `lp-${ch.leaguePlayerId}`
    }

    const toggleChange = (key) => {
        setExcluded(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    // Collect all changes across teams + pickups
    const allChanges = useMemo(() => {
        if (!syncPreview) return []
        const teamChanges = syncPreview.teams.flatMap(t => t.changes || [])
        const pickupChanges = syncPreview.pickups || []
        return [...teamChanges, ...pickupChanges]
    }, [syncPreview])

    const includedChanges = useMemo(() => {
        return allChanges.filter(ch => !excluded.has(changeKey(ch)))
    }, [allChanges, excluded])

    const includedPromotes = includedChanges.filter(ch => ch.type === 'promote').length
    const includedDemotes = includedChanges.filter(ch => ch.type === 'demote').length
    const includedTransfers = includedChanges.filter(ch => ch.type === 'transfer').length
    const includedPickups = includedChanges.filter(ch => ch.type === 'pickup').length

    const applySync = async () => {
        if (!selectedSeasonId || !includedChanges.length) return
        setApplying(true)
        try {
            const updates = includedChanges.map(ch => {
                if (ch.type === 'promote' || ch.type === 'demote') {
                    return { type: ch.type, leaguePlayerId: ch.leaguePlayerId, newStatus: ch.to }
                }
                if (ch.type === 'transfer') {
                    return { type: 'transfer', leaguePlayerId: ch.leaguePlayerId, newTeamId: ch.toTeamId }
                }
                if (ch.type === 'pickup') {
                    return {
                        type: 'pickup', playerId: ch.playerId, toTeamId: ch.toTeamId,
                        existingLpId: ch.existingLpId, isReactivation: ch.isReactivation,
                        role: ch.role,
                    }
                }
                return null
            }).filter(Boolean)

            const res = await fetch(`${API}/roster-sync`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ action: 'apply', seasonId: selectedSeasonId, updates }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            const parts = []
            if (data.promotes) parts.push(`${data.promotes} promoted`)
            if (data.demotes) parts.push(`${data.demotes} demoted`)
            if (data.transfers) parts.push(`${data.transfers} transferred`)
            if (data.pickups) parts.push(`${data.pickups} picked up`)
            showToast('success', `Applied: ${parts.join(', ')}`)

            // Re-preview + refresh transactions
            previewSync()
            loadTransactions()
        } catch (err) {
            showToast('error', `Apply failed: ${err.message}`)
        } finally {
            setApplying(false)
        }
    }

    // ─── Transaction History ───
    const loadTransactions = useCallback(async (offset = 0) => {
        if (!selectedSeasonId) return
        setTxLoading(true)
        try {
            const res = await fetch(
                `${API}/roster-sync?seasonId=${selectedSeasonId}&limit=50&offset=${offset}`,
                { headers: getAuthHeaders() }
            )
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            if (offset === 0) {
                setTransactions(data.transactions || [])
            } else {
                setTransactions(prev => [...prev, ...(data.transactions || [])])
            }
            setTxTotal(data.total || 0)
        } catch (err) {
            showToast('error', `Failed to load transactions: ${err.message}`)
        } finally {
            setTxLoading(false)
        }
    }, [selectedSeasonId, showToast])

    useEffect(() => {
        if (selectedSeasonId) loadTransactions()
        else { setTransactions([]); setTxTotal(0) }
    }, [selectedSeasonId, loadTransactions])

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100">
            <PageTitle title="Discord Roster Sync" noindex />

            <div className="max-w-7xl mx-auto p-4 space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-lg font-semibold">Discord Roster Sync</h1>
                    <p className="text-xs text-gray-500">Map Discord roles to teams, then sync rosters based on role membership</p>
                </div>

                {/* Toast */}
                {toast && (
                    <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg border text-sm transition-all ${
                        toast.type === 'success' ? 'bg-green-900/90 border-green-600 text-green-200' : 'bg-red-900/90 border-red-600 text-red-200'
                    }`}>
                        {toast.message}
                    </div>
                )}

                {/* Season selector */}
                <select
                    value={selectedSeasonId || ''}
                    onChange={e => {
                        setSelectedSeasonId(e.target.value ? parseInt(e.target.value) : null)
                        setSyncPreview(null)
                        setExcluded(new Set())
                    }}
                    className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm w-full max-w-xl focus:border-purple-500 focus:outline-none"
                >
                    <option value="">Select a season...</option>
                    {seasons.map(s => (
                        <option key={s.season_id} value={s.season_id}>
                            {s.league_name} — {s.division_name} — {s.season_name}{s.is_active ? '' : ' (inactive)'}
                        </option>
                    ))}
                </select>

                {/* ═══ Team Role Mapping ═══ */}
                <section className="bg-gray-900/60 border border-gray-800 rounded-xl">
                    <button
                        onClick={() => setMappingOpen(prev => !prev)}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.02] transition-colors rounded-xl"
                    >
                        <div>
                            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Team Role Mapping</h2>
                            <p className="text-xs text-gray-500 mt-0.5">Link Discord roles to teams for roster syncing and screenshot matching</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            {totalCount > 0 && (
                                <span className={`text-xs ${mappedCount === totalCount ? 'text-green-400' : 'text-yellow-400'}`}>
                                    {mappedCount}/{totalCount} mapped
                                </span>
                            )}
                            <svg className={`w-4 h-4 text-gray-500 transition-transform ${mappingOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </button>

                    {mappingOpen && <div className="px-4 pb-4 space-y-3">
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

                    {/* Extra guild ID */}
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

                            <div className="space-y-2">
                                {displayMappings.map(team => (
                                    <div
                                        key={team.id}
                                        className={`flex items-center gap-3 bg-gray-800/40 border rounded-lg px-3 py-2 ${
                                            team.hasChange ? 'border-blue-500/50' :
                                            team.effectiveRoleId ? 'border-gray-700/50' : 'border-yellow-600/30'
                                        }`}
                                    >
                                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                            team.effectiveRoleId ? 'bg-green-500' : 'bg-yellow-500'
                                        }`} />
                                        <div className="flex items-center gap-2 min-w-0 w-48 flex-shrink-0">
                                            <span
                                                className="w-3 h-3 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: team.color }}
                                            />
                                            <span className="text-sm font-medium truncate">{team.name}</span>
                                        </div>
                                        <span className="text-gray-600 flex-shrink-0">&rarr;</span>
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
                    </div>}
                </section>

                {/* ═══ Roster Sync ═══ */}
                <section className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Roster Sync</h2>
                            <p className="text-xs text-gray-500 mt-0.5">Sync rosters from Discord role membership. Detects promotions, demotions, transfers, and pickups.</p>
                        </div>
                        <button
                            onClick={previewSync}
                            disabled={!selectedSeasonId || syncing}
                            className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            {syncing ? 'Loading...' : 'Preview Sync'}
                        </button>
                    </div>

                    {!selectedSeasonId && (
                        <p className="text-sm text-gray-500 py-2">Select a season above to preview roster sync.</p>
                    )}

                    {/* Sync Preview Results */}
                    {syncPreview && (
                        <div className="space-y-4">
                            {/* Summary bar */}
                            <div className="flex flex-wrap items-center gap-4 bg-gray-800/60 rounded-lg px-4 py-3">
                                {includedPromotes > 0 && (
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                                        <span className="text-sm text-green-400 font-medium">{includedPromotes} promote{includedPromotes !== 1 ? 's' : ''}</span>
                                    </div>
                                )}
                                {includedDemotes > 0 && (
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                                        <span className="text-sm text-orange-400 font-medium">{includedDemotes} demote{includedDemotes !== 1 ? 's' : ''}</span>
                                    </div>
                                )}
                                {includedTransfers > 0 && (
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                                        <span className="text-sm text-blue-400 font-medium">{includedTransfers} transfer{includedTransfers !== 1 ? 's' : ''}</span>
                                    </div>
                                )}
                                {includedPickups > 0 && (
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                                        <span className="text-sm text-cyan-400 font-medium">{includedPickups} pickup{includedPickups !== 1 ? 's' : ''}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-gray-500" />
                                    <span className="text-sm text-gray-400">{syncPreview.summary.unchanged} unchanged</span>
                                </div>
                                {excluded.size > 0 && (
                                    <span className="text-xs text-gray-500">
                                        ({excluded.size} excluded)
                                    </span>
                                )}
                            </div>

                            {/* Team changes */}
                            {syncPreview.teams.filter(t => t.changes.length > 0).map(team => {
                                const teamIncluded = team.changes.filter(ch => !excluded.has(changeKey(ch))).length
                                return (
                                    <div key={team.teamId} className="bg-gray-800/40 border border-gray-700/50 rounded-lg overflow-hidden">
                                        <div className="px-3 py-2 border-b border-gray-700/50 flex items-center justify-between">
                                            <span className="text-sm font-semibold">{team.teamName}</span>
                                            <span className="text-xs text-gray-500">
                                                {teamIncluded}/{team.changes.length} selected, {team.unchanged} unchanged
                                            </span>
                                        </div>
                                        <div className="divide-y divide-gray-700/30">
                                            {team.changes.map((ch) => {
                                                const key = changeKey(ch)
                                                const isExcluded = excluded.has(key)
                                                return (
                                                    <label
                                                        key={key}
                                                        className={`px-3 py-1.5 flex items-center gap-3 text-sm cursor-pointer hover:bg-white/[0.02] transition-colors ${
                                                            isExcluded ? 'opacity-40' : ''
                                                        }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={!isExcluded}
                                                            onChange={() => toggleChange(key)}
                                                            className="rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-emerald-500/30 focus:ring-offset-0 shrink-0"
                                                        />
                                                        <TypeBadge type={ch.type} className="w-18 text-center shrink-0" />
                                                        <span className="text-gray-300 min-w-0 truncate">{ch.playerName}</span>
                                                        {ch.type === 'transfer' ? (
                                                            <span className="text-gray-500 text-xs shrink-0">
                                                                {ch.fromTeamName} &rarr; {ch.toTeamName}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-600 text-xs shrink-0">{ch.from} &rarr; {ch.to}</span>
                                                        )}
                                                        {ch.matchMethod && (
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                                                                ch.matchMethod === 'fuzzy'
                                                                    ? 'bg-yellow-900/40 text-yellow-400'
                                                                    : 'bg-gray-700/50 text-gray-500'
                                                            }`}>
                                                                {MATCH_LABELS[ch.matchMethod] || ch.matchMethod}
                                                            </span>
                                                        )}
                                                    </label>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}

                            {/* Pickup suggestions */}
                            {(syncPreview.pickups?.length > 0) && (
                                <div className="bg-cyan-900/10 border border-cyan-700/30 rounded-lg overflow-hidden">
                                    <div className="px-3 py-2 border-b border-cyan-700/30 flex items-center justify-between">
                                        <h3 className="text-sm font-semibold text-cyan-400">
                                            Suggested Pickups
                                        </h3>
                                        <span className="text-xs text-gray-500">
                                            {syncPreview.pickups.filter(p => !excluded.has(changeKey(p))).length}/{syncPreview.pickups.length} selected
                                        </span>
                                    </div>
                                    <div className="divide-y divide-cyan-800/20">
                                        {syncPreview.pickups.map(p => {
                                            const key = changeKey(p)
                                            const isExcluded = excluded.has(key)
                                            return (
                                                <label
                                                    key={key}
                                                    className={`px-3 py-1.5 flex items-center gap-3 text-sm cursor-pointer hover:bg-white/[0.02] transition-colors ${
                                                        isExcluded ? 'opacity-40' : ''
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={!isExcluded}
                                                        onChange={() => toggleChange(key)}
                                                        className="rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500/30 focus:ring-offset-0 shrink-0"
                                                    />
                                                    <TypeBadge type="pickup" className="shrink-0" />
                                                    <span className="text-gray-300 min-w-0 truncate">{p.playerName}</span>
                                                    <span className="text-gray-500 text-xs shrink-0">&rarr; {p.toTeamName}</span>
                                                    <span className="text-gray-600 text-xs shrink-0">({p.discordName})</span>
                                                    {p.isReactivation && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-400 shrink-0">reactivation</span>
                                                    )}
                                                </label>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Skipped teams */}
                            {syncPreview.teams.filter(t => t.skipped).length > 0 && (
                                <div className="text-xs text-gray-500">
                                    {syncPreview.teams.filter(t => t.skipped).length} team{syncPreview.teams.filter(t => t.skipped).length !== 1 ? 's' : ''} skipped (no Discord role mapped)
                                </div>
                            )}

                            {/* Unmatched Discord members */}
                            {syncPreview.unmatched.length > 0 && (
                                <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-3">
                                    <h3 className="text-xs font-semibold text-yellow-400 uppercase tracking-wider mb-2">
                                        Unmatched Discord Members ({syncPreview.unmatched.length})
                                    </h3>
                                    <p className="text-xs text-gray-400 mb-2">
                                        These users have a team Discord role but couldn't be matched to a player.
                                    </p>
                                    <div className="space-y-1">
                                        {syncPreview.unmatched.map((u, i) => (
                                            <div key={i} className="text-xs text-gray-300 flex items-center gap-2">
                                                <span>{u.discordName}</span>
                                                <span className="text-gray-600">&rarr; {u.teamName}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* No changes */}
                            {allChanges.length === 0 && (
                                <div className="text-center py-4 text-sm text-gray-500">
                                    All rosters are already in sync.
                                </div>
                            )}

                            {/* Apply button */}
                            {includedChanges.length > 0 && (
                                <button
                                    onClick={applySync}
                                    disabled={applying}
                                    className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm font-semibold transition"
                                >
                                    {applying ? 'Applying...' : `Apply ${includedChanges.length} Change${includedChanges.length !== 1 ? 's' : ''}`}
                                </button>
                            )}
                        </div>
                    )}
                </section>

                {/* ═══ Transaction History ═══ */}
                <section className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Transaction History</h2>
                            <p className="text-xs text-gray-500 mt-0.5">All roster changes from Discord sync and manual admin actions</p>
                        </div>
                        {txTotal > 0 && (
                            <span className="text-xs text-gray-500">{txTotal} total</span>
                        )}
                    </div>

                    {!selectedSeasonId && (
                        <p className="text-sm text-gray-500 py-2">Select a season to view transaction history.</p>
                    )}

                    {selectedSeasonId && txLoading && transactions.length === 0 && (
                        <div className="flex justify-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-blue-500" />
                        </div>
                    )}

                    {selectedSeasonId && transactions.length === 0 && !txLoading && (
                        <p className="text-sm text-gray-500 py-2">No transactions recorded yet.</p>
                    )}

                    {transactions.length > 0 && (
                        <div className="space-y-1">
                            {transactions.map(tx => (
                                <div key={tx.id} className="flex items-center gap-3 bg-gray-800/30 rounded-lg px-3 py-2 text-sm">
                                    <span className="text-xs text-gray-500 w-16 shrink-0">{relativeTime(tx.created_at)}</span>
                                    <TypeBadge type={tx.type} className="shrink-0" />
                                    <span className="text-gray-200 font-medium min-w-0 truncate">{tx.player_name}</span>
                                    <span className="text-gray-500 text-xs shrink-0">
                                        {tx.from_team_name && tx.to_team_name && tx.from_team_name !== tx.to_team_name
                                            ? <>{tx.from_team_name} &rarr; {tx.to_team_name}</>
                                            : tx.to_team_name || tx.from_team_name || ''}
                                    </span>
                                    {tx.from_status && tx.to_status && tx.from_status !== tx.to_status && (
                                        <span className="text-gray-600 text-xs shrink-0">{tx.from_status} &rarr; {tx.to_status}</span>
                                    )}
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                                        tx.source === 'discord_sync' ? 'bg-indigo-900/40 text-indigo-400' : 'bg-gray-700/50 text-gray-500'
                                    }`}>
                                        {tx.source === 'discord_sync' ? 'sync' : 'manual'}
                                    </span>
                                    <span className="text-xs text-gray-600 shrink-0 ml-auto">{tx.admin_username}</span>
                                </div>
                            ))}

                            {txTotal > transactions.length && (
                                <button
                                    onClick={() => loadTransactions(transactions.length)}
                                    disabled={txLoading}
                                    className="w-full py-2 text-xs text-gray-400 hover:text-gray-300 transition"
                                >
                                    {txLoading ? 'Loading...' : `Load more (${txTotal - transactions.length} remaining)`}
                                </button>
                            )}
                        </div>
                    )}
                </section>
            </div>
        </div>
    )
}

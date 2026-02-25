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

export default function DiscordRosterSync() {
    const { hasPermission } = useAuth()
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
    const [excluded, setExcluded] = useState(new Set()) // leaguePlayerIds toggled off

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
            const fuzzyIds = new Set()
            for (const team of (data.teams || [])) {
                for (const ch of (team.changes || [])) {
                    if (ch.matchMethod === 'fuzzy') fuzzyIds.add(ch.leaguePlayerId)
                }
            }
            setExcluded(fuzzyIds)
        } catch (err) {
            showToast('error', `Preview failed: ${err.message}`)
        } finally {
            setSyncing(false)
        }
    }

    const toggleChange = (leaguePlayerId) => {
        setExcluded(prev => {
            const next = new Set(prev)
            if (next.has(leaguePlayerId)) next.delete(leaguePlayerId)
            else next.add(leaguePlayerId)
            return next
        })
    }

    // Collect all changes across teams, compute included counts
    const allChanges = useMemo(() => {
        if (!syncPreview) return []
        return syncPreview.teams.flatMap(t => t.changes || [])
    }, [syncPreview])

    const includedChanges = useMemo(() => {
        return allChanges.filter(ch => !excluded.has(ch.leaguePlayerId))
    }, [allChanges, excluded])

    const includedPromotes = includedChanges.filter(ch => ch.type === 'promote').length
    const includedDemotes = includedChanges.filter(ch => ch.type === 'demote').length

    const applySync = async () => {
        if (!selectedSeasonId || !includedChanges.length) return
        setApplying(true)
        try {
            const updates = includedChanges.map(ch => ({
                leaguePlayerId: ch.leaguePlayerId,
                newStatus: ch.to,
            }))
            const res = await fetch(`${API}/roster-sync`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ action: 'apply', seasonId: selectedSeasonId, updates }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            showToast('success', `Applied: ${data.promotes} promoted, ${data.demotes} demoted`)
            // Re-preview to show updated state
            previewSync()
        } catch (err) {
            showToast('error', `Apply failed: ${err.message}`)
        } finally {
            setApplying(false)
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

                {/* Season selector — shared by both sections */}
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
                <section className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Team Role Mapping</h2>
                            <p className="text-xs text-gray-500 mt-0.5">Link Discord roles to teams for roster syncing and screenshot matching</p>
                        </div>
                        {totalCount > 0 && (
                            <div className="text-xs text-gray-400">
                                <span className={mappedCount === totalCount ? 'text-green-400' : 'text-yellow-400'}>
                                    {mappedCount}/{totalCount} mapped
                                </span>
                            </div>
                        )}
                    </div>

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
                </section>

                {/* ═══ Roster Sync ═══ */}
                <section className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Roster Sync</h2>
                            <p className="text-xs text-gray-500 mt-0.5">Sync roster_status from Discord role membership. Captains are never touched.</p>
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
                            <div className="flex items-center gap-4 bg-gray-800/60 rounded-lg px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                                    <span className="text-sm text-green-400 font-medium">{includedPromotes} promote{includedPromotes !== 1 ? 's' : ''}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                                    <span className="text-sm text-orange-400 font-medium">{includedDemotes} demote{includedDemotes !== 1 ? 's' : ''}</span>
                                </div>
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
                                const teamIncluded = team.changes.filter(ch => !excluded.has(ch.leaguePlayerId)).length
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
                                                const isExcluded = excluded.has(ch.leaguePlayerId)
                                                return (
                                                    <label
                                                        key={ch.leaguePlayerId}
                                                        className={`px-3 py-1.5 flex items-center gap-3 text-sm cursor-pointer hover:bg-white/[0.02] transition-colors ${
                                                            isExcluded ? 'opacity-40' : ''
                                                        }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={!isExcluded}
                                                            onChange={() => toggleChange(ch.leaguePlayerId)}
                                                            className="rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-emerald-500/30 focus:ring-offset-0 shrink-0"
                                                        />
                                                        <span className={`w-16 text-xs font-medium shrink-0 ${
                                                            ch.type === 'promote' ? 'text-green-400' : 'text-orange-400'
                                                        }`}>
                                                            {ch.type === 'promote' ? 'PROMOTE' : 'DEMOTE'}
                                                        </span>
                                                        <span className="text-gray-300 min-w-0 truncate">{ch.playerName}</span>
                                                        <span className="text-gray-600 text-xs shrink-0">{ch.from} → {ch.to}</span>
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
                                                <span className="text-gray-600">→ {u.teamName}</span>
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
            </div>
        </div>
    )
}

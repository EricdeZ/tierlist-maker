// src/pages/admin/PlayerManager.jsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { ExternalLink, Download, Search, X, ChevronDown, ChevronRight, Check, Users, Tag, Plus, Trash2, Merge, AlertTriangle } from 'lucide-react'
import { PlayerManagerHelp } from '../../components/admin/AdminHelp'
import { getAuthHeaders } from '../../services/adminApi.js'

const API = import.meta.env.VITE_API_URL || '/api'

export default function PlayerManager() {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    // Filters
    const [search, setSearch] = useState('')
    const [filterSeason, setFilterSeason] = useState('all') // 'all' | 'active' | 'free' | season_id
    const [filterTeam, setFilterTeam] = useState('all')
    const [filterRole, setFilterRole] = useState('all')
    const [sortCol, setSortCol] = useState('name')
    const [sortDir, setSortDir] = useState('asc')

    // Selection for bulk ops
    const [selected, setSelected] = useState(new Set())

    // Enrollment modal
    const [showEnroll, setShowEnroll] = useState(false)
    const [enrollSeasonId, setEnrollSeasonId] = useState('')
    const [enrollTeamId, setEnrollTeamId] = useState('')
    const [enrollRole, setEnrollRole] = useState('')
    const [enrolling, setEnrolling] = useState(false)

    // Edit modal
    const [editPlayer, setEditPlayer] = useState(null) // { id, name, discord_name, tracker_url }
    const [editSaving, setEditSaving] = useState(false)

    // Alias modal
    const [aliasPlayer, setAliasPlayer] = useState(null) // enriched player object
    const [aliasSaving, setAliasSaving] = useState(false)

    // Merge modal
    const [showMerge, setShowMerge] = useState(false)
    const [merging, setMerging] = useState(false)

    // Expanded player row
    const [expandedId, setExpandedId] = useState(null)

    // Toast
    const [toast, setToast] = useState(null)
    const showToast = useCallback((type, message) => {
        const id = Date.now()
        setToast({ type, message, id })
        setTimeout(() => setToast(prev => prev?.id === id ? null : prev), 4000)
    }, [])

    // ─── Fetch data ───
    const fetchData = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch(`${API}/player-manage`, { headers: getAuthHeaders() })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const d = await res.json()
            setData(d)
        } catch (e) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    // ─── Derived: build enriched player list ───
    const { enrichedPlayers, activeSeasons, allTeams } = useMemo(() => {
        if (!data) return { enrichedPlayers: [], activeSeasons: [], allTeams: [] }

        const rostersByPlayer = {}
        for (const r of data.rosters) {
            if (!rostersByPlayer[r.player_id]) rostersByPlayer[r.player_id] = []
            rostersByPlayer[r.player_id].push(r)
        }

        const gameCountMap = {}
        for (const gc of data.gameCounts) {
            gameCountMap[gc.league_player_id] = parseInt(gc.games_played)
        }

        const aliasesByPlayer = {}
        for (const a of data.aliases) {
            if (!aliasesByPlayer[a.player_id]) aliasesByPlayer[a.player_id] = []
            aliasesByPlayer[a.player_id].push(a)
        }

        const enriched = data.players.map(p => {
            const rosters = rostersByPlayer[p.id] || []
            const aliases = aliasesByPlayer[p.id] || []
            const activeRosters = rosters.filter(r => r.is_active && r.season_is_active)
            const totalGames = rosters.reduce((sum, r) => sum + (gameCountMap[r.league_player_id] || 0), 0)

            // Current team/season (prefer active season)
            const current = activeRosters[0] || rosters[0] || null

            return {
                ...p,
                rosters,
                aliases,
                activeRosters,
                totalGames,
                current,
                currentTeam: current?.team_name || null,
                currentRole: current?.role || null,
                currentSeason: current?.season_name || null,
                currentLeague: current?.league_name || null,
                isFreeAgent: activeRosters.length === 0,
                seasonsPlayed: [...new Set(rosters.map(r => r.season_id))].length,
                gameCountMap,
            }
        })

        const activeSeasons = data.seasons.filter(s => s.is_active)
        return { enrichedPlayers: enriched, activeSeasons, allTeams: data.teams }
    }, [data])

    // ─── Filtered + sorted ───
    const filteredPlayers = useMemo(() => {
        let list = enrichedPlayers

        // Text search
        if (search.trim()) {
            const q = search.toLowerCase()
            list = list.filter(p =>
                p.name.toLowerCase().includes(q) ||
                p.discord_name?.toLowerCase().includes(q) ||
                p.aliases.some(a => a.alias.toLowerCase().includes(q))
            )
        }

        // Season filter
        if (filterSeason === 'active') {
            list = list.filter(p => p.activeRosters.length > 0)
        } else if (filterSeason === 'free') {
            list = list.filter(p => p.isFreeAgent)
        } else if (filterSeason !== 'all') {
            const sid = parseInt(filterSeason)
            list = list.filter(p => p.rosters.some(r => r.season_id === sid))
        }

        // Team filter
        if (filterTeam !== 'all') {
            const tid = parseInt(filterTeam)
            list = list.filter(p => p.rosters.some(r => r.team_id === tid && r.is_active))
        }

        // Role filter
        if (filterRole !== 'all') {
            list = list.filter(p => p.currentRole?.toLowerCase() === filterRole.toLowerCase())
        }

        // Sort
        list = [...list].sort((a, b) => {
            let av, bv
            switch (sortCol) {
                case 'name': av = a.name.toLowerCase(); bv = b.name.toLowerCase(); break
                case 'team': av = a.currentTeam?.toLowerCase() || 'zzz'; bv = b.currentTeam?.toLowerCase() || 'zzz'; break
                case 'role': av = a.currentRole?.toLowerCase() || 'zzz'; bv = b.currentRole?.toLowerCase() || 'zzz'; break
                case 'games': av = a.totalGames; bv = b.totalGames; break
                case 'seasons': av = a.seasonsPlayed; bv = b.seasonsPlayed; break
                case 'discord': av = a.discord_name?.toLowerCase() || 'zzz'; bv = b.discord_name?.toLowerCase() || 'zzz'; break
                case 'aliases': av = a.aliases.length; bv = b.aliases.length; break
                default: av = a.name.toLowerCase(); bv = b.name.toLowerCase()
            }
            if (av < bv) return sortDir === 'asc' ? -1 : 1
            if (av > bv) return sortDir === 'asc' ? 1 : -1
            return 0
        })

        return list
    }, [enrichedPlayers, search, filterSeason, filterTeam, filterRole, sortCol, sortDir])

    // ─── Teams for current season filter ───
    const teamsForFilter = useMemo(() => {
        if (filterSeason === 'all' || filterSeason === 'active' || filterSeason === 'free') {
            // Show teams from all active seasons
            return allTeams.filter(t => data?.seasons.some(s => s.season_id === t.season_id && s.is_active))
        }
        return allTeams.filter(t => t.season_id === parseInt(filterSeason))
    }, [filterSeason, allTeams, data])

    // ─── Selection helpers ───
    const toggleSelect = (id) => {
        setSelected(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }
    const selectAll = () => {
        if (selected.size === filteredPlayers.length) {
            setSelected(new Set())
        } else {
            setSelected(new Set(filteredPlayers.map(p => p.id)))
        }
    }

    // ─── Sorting ───
    const handleSort = (col) => {
        if (sortCol === col) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        } else {
            setSortCol(col)
            setSortDir('asc')
        }
    }
    const SortIcon = ({ col }) => {
        if (sortCol !== col) return <ChevronDown className="w-3 h-3 opacity-30" />
        return <ChevronDown className={`w-3 h-3 transition-transform ${sortDir === 'desc' ? 'rotate-180' : ''}`} />
    }

    // ─── Bulk enroll ───
    const handleBulkEnroll = async () => {
        if (!enrollSeasonId || !enrollTeamId || selected.size === 0) return
        setEnrolling(true)
        try {
            const res = await fetch(`${API}/player-manage`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    action: 'bulk-enroll-season',
                    player_ids: [...selected],
                    season_id: parseInt(enrollSeasonId),
                    team_id: parseInt(enrollTeamId),
                    role: enrollRole || null,
                }),
            })
            const result = await res.json()
            if (!res.ok) throw new Error(result.error)
            showToast('success', `Enrolled ${result.enrolled}, reactivated ${result.reactivated}, skipped ${result.skipped}`)
            setShowEnroll(false)
            setSelected(new Set())
            fetchData()
        } catch (e) {
            showToast('error', e.message)
        } finally {
            setEnrolling(false)
        }
    }

    // ─── Edit player info ───
    const handleSaveInfo = async () => {
        if (!editPlayer) return
        setEditSaving(true)
        try {
            const res = await fetch(`${API}/player-manage`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    action: 'update-player-info',
                    player_id: editPlayer.id,
                    discord_name: editPlayer.discord_name || null,
                    tracker_url: editPlayer.tracker_url || null,
                    main_role: editPlayer.main_role || null,
                    secondary_role: editPlayer.secondary_role || null,
                }),
            })
            const result = await res.json()
            if (!res.ok) throw new Error(result.error)
            showToast('success', `Updated ${editPlayer.name}`)
            setEditPlayer(null)
            fetchData()
        } catch (e) {
            showToast('error', e.message)
        } finally {
            setEditSaving(false)
        }
    }

    // Keep aliasPlayer in sync after data refresh
    useEffect(() => {
        if (aliasPlayer && enrichedPlayers.length > 0) {
            const updated = enrichedPlayers.find(p => p.id === aliasPlayer.id)
            if (updated) setAliasPlayer(updated)
        }
    }, [enrichedPlayers])

    // ─── Alias management (calls roster-manage endpoint) ───
    const handleAddAlias = async (playerId, alias) => {
        setAliasSaving(true)
        try {
            const res = await fetch(`${API}/roster-manage`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ action: 'add-alias', player_id: playerId, alias }),
            })
            const result = await res.json()
            if (!res.ok) throw new Error(result.error)
            showToast('success', `Added alias "${alias}"`)
            fetchData()
        } catch (e) {
            showToast('error', e.message)
        } finally {
            setAliasSaving(false)
        }
    }

    const handleRemoveAlias = async (aliasId, aliasName) => {
        setAliasSaving(true)
        try {
            const res = await fetch(`${API}/roster-manage`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ action: 'remove-alias', alias_id: aliasId }),
            })
            const result = await res.json()
            if (!res.ok) throw new Error(result.error)
            showToast('success', `Removed alias "${aliasName}"`)
            fetchData()
        } catch (e) {
            showToast('error', e.message)
        } finally {
            setAliasSaving(false)
        }
    }

    // ─── Merge players (calls roster-manage endpoint) ───
    const handleMerge = async (sourceId, targetId) => {
        setMerging(true)
        try {
            const res = await fetch(`${API}/roster-manage`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    action: 'merge-player',
                    source_player_id: sourceId,
                    target_player_id: targetId,
                }),
            })
            const result = await res.json()
            if (!res.ok) throw new Error(result.error)
            showToast('success', `Merged "${result.source_name}" into "${result.target_name}" — ${result.stats_reassigned || 0} stats moved`)
            setShowMerge(false)
            fetchData()
        } catch (e) {
            showToast('error', e.message)
        } finally {
            setMerging(false)
        }
    }

    // ─── Export CSV ───
    const handleExportCSV = () => {
        const header = ['Name', 'Discord', 'Tracker URL', 'Team', 'Role', 'Season', 'League', 'Games Played', 'Aliases']
        const rows = filteredPlayers.map(p => [
            p.name,
            p.discord_name || '',
            p.tracker_url || '',
            p.currentTeam || 'Free Agent',
            p.currentRole || '',
            p.currentSeason || '',
            p.currentLeague || '',
            p.totalGames,
            p.aliases.map(a => a.alias).join('; '),
        ])
        const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `players-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    // ─── Teams for enrollment modal ───
    const enrollTeams = useMemo(() => {
        if (!enrollSeasonId) return []
        return allTeams.filter(t => t.season_id === parseInt(enrollSeasonId))
    }, [enrollSeasonId, allTeams])

    // ─── Loading state ───
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-2 border-[var(--color-accent)] border-t-transparent mx-auto mb-4" />
                    <p className="text-[var(--color-text-secondary)]">Loading player data...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="max-w-7xl mx-auto py-8 px-4">
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
                    Failed to load player data: {error}
                </div>
            </div>
        )
    }

    const allChecked = filteredPlayers.length > 0 && selected.size === filteredPlayers.length

    return (
        <div className="max-w-[1400px] mx-auto pb-8 px-4">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-[100] max-w-sm px-4 py-3 rounded-lg shadow-xl border text-sm font-medium ${
                    toast.type === 'success' ? 'bg-green-500/15 border-green-500/30 text-green-400' : 'bg-red-500/15 border-red-500/30 text-red-400'
                }`}>
                    <div className="flex items-start gap-2">
                        <span className="shrink-0">{toast.type === 'success' ? '\u2713' : '\u2715'}</span>
                        <span>{toast.message}</span>
                        <button onClick={() => setToast(null)} className="ml-auto shrink-0 opacity-60 hover:opacity-100">{'\u2715'}</button>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="mb-6">
                <h1 className="font-heading text-2xl font-bold text-[var(--color-text)]">Player Manager</h1>
                <p className="text-[var(--color-text-secondary)] text-sm mt-1">
                    {enrichedPlayers.length} players · {enrichedPlayers.filter(p => !p.isFreeAgent).length} rostered · {enrichedPlayers.filter(p => p.isFreeAgent).length} free agents
                </p>
            </div>

            <PlayerManagerHelp />

            {/* Filters bar */}
            <div className="bg-[var(--color-secondary)] border border-white/10 rounded-xl p-4 mb-4">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search name, discord, or alias..."
                            className="w-full pl-9 pr-8 py-2 rounded-lg text-sm border"
                            style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.1)' }}
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Season filter */}
                    <select
                        value={filterSeason}
                        onChange={e => { setFilterSeason(e.target.value); setFilterTeam('all') }}
                        className="rounded-lg px-3 py-2 text-sm border"
                        style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.1)' }}
                    >
                        <option value="all">All Players</option>
                        <option value="active">Active Season Only</option>
                        <option value="free">Free Agents</option>
                        {data?.seasons.map(s => (
                            <option key={s.season_id} value={s.season_id}>
                                {s.league_name} / {s.division_name} — {s.season_name}
                            </option>
                        ))}
                    </select>

                    {/* Team filter */}
                    {teamsForFilter.length > 0 && (
                        <select
                            value={filterTeam}
                            onChange={e => setFilterTeam(e.target.value)}
                            className="rounded-lg px-3 py-2 text-sm border"
                            style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.1)' }}
                        >
                            <option value="all">All Teams</option>
                            {teamsForFilter.map(t => (
                                <option key={t.team_id} value={t.team_id}>{t.team_name}</option>
                            ))}
                        </select>
                    )}

                    {/* Role filter */}
                    <select
                        value={filterRole}
                        onChange={e => setFilterRole(e.target.value)}
                        className="rounded-lg px-3 py-2 text-sm border"
                        style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.1)' }}
                    >
                        <option value="all">All Roles</option>
                        {['Solo', 'Jungle', 'Mid', 'Support', 'ADC', 'Sub', 'Fill'].map(r => (
                            <option key={r} value={r}>{r === 'Sub' ? 'Rule 0-Sub' : r}</option>
                        ))}
                    </select>

                    {/* Merge */}
                    <button
                        onClick={() => setShowMerge(true)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                        title="Merge duplicate players"
                    >
                        <Merge className="w-4 h-4" />
                        Merge
                    </button>

                    {/* Export */}
                    <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                        title="Export filtered players to CSV"
                    >
                        <Download className="w-4 h-4" />
                        CSV
                    </button>
                </div>
            </div>

            {/* Bulk actions bar */}
            {selected.size > 0 && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 mb-4 flex items-center justify-between">
                    <span className="text-sm text-blue-400 font-medium">
                        {selected.size} player{selected.size !== 1 ? 's' : ''} selected
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowEnroll(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                        >
                            <Users className="w-4 h-4" />
                            Enroll in Season
                        </button>
                        <button
                            onClick={() => setSelected(new Set())}
                            className="px-3 py-1.5 rounded-lg text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/5 transition-colors"
                        >
                            Clear
                        </button>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="border border-white/10 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-[var(--color-secondary)] border-b border-white/10">
                                <th className="px-3 py-2.5 text-left w-10">
                                    <input
                                        type="checkbox"
                                        checked={allChecked}
                                        onChange={selectAll}
                                        className="rounded"
                                    />
                                </th>
                                <SortHeader col="name" label="Player" current={sortCol} dir={sortDir} onSort={handleSort} />
                                <SortHeader col="discord" label="Discord" current={sortCol} dir={sortDir} onSort={handleSort} />
                                <SortHeader col="team" label="Team" current={sortCol} dir={sortDir} onSort={handleSort} />
                                <SortHeader col="role" label="Role" current={sortCol} dir={sortDir} onSort={handleSort} />
                                <SortHeader col="seasons" label="Seasons" current={sortCol} dir={sortDir} onSort={handleSort} />
                                <SortHeader col="games" label="Games" current={sortCol} dir={sortDir} onSort={handleSort} />
                                <SortHeader col="aliases" label="Aliases" current={sortCol} dir={sortDir} onSort={handleSort} />
                                <th className="px-3 py-2.5 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase">Links</th>
                                <th className="px-3 py-2.5 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase w-10"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPlayers.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="px-4 py-8 text-center text-[var(--color-text-secondary)]">
                                        No players match your filters.
                                    </td>
                                </tr>
                            ) : filteredPlayers.map(p => (
                                <PlayerRow
                                    key={p.id}
                                    player={p}
                                    isSelected={selected.has(p.id)}
                                    isExpanded={expandedId === p.id}
                                    onToggleSelect={() => toggleSelect(p.id)}
                                    onToggleExpand={() => setExpandedId(prev => prev === p.id ? null : p.id)}
                                    onEdit={() => setEditPlayer({ id: p.id, name: p.name, discord_name: p.discord_name || '', tracker_url: p.tracker_url || '', main_role: p.main_role || '', secondary_role: p.secondary_role || '' })}
                                    onOpenAliases={() => setAliasPlayer(p)}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <p className="text-xs text-[var(--color-text-secondary)] mt-3 text-right">
                Showing {filteredPlayers.length} of {enrichedPlayers.length} players
            </p>

            {/* Enrollment Modal */}
            {showEnroll && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
                    <div className="rounded-xl border border-white/10 shadow-2xl max-w-md w-full p-6" style={{ backgroundColor: 'var(--color-secondary)' }}>
                        <h3 className="text-sm font-bold text-[var(--color-text)] mb-1">Enroll {selected.size} Player{selected.size !== 1 ? 's' : ''} in Season</h3>
                        <p className="text-xs text-[var(--color-text-secondary)] mb-4">
                            Creates roster entries for the selected players. Players already in that season will be skipped.
                        </p>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Target Season</label>
                                <select
                                    value={enrollSeasonId}
                                    onChange={e => { setEnrollSeasonId(e.target.value); setEnrollTeamId('') }}
                                    className="w-full rounded-lg px-3 py-2 text-sm border"
                                    style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.1)' }}
                                >
                                    <option value="">— Select Season —</option>
                                    {data?.seasons.map(s => (
                                        <option key={s.season_id} value={s.season_id}>
                                            {s.league_name} / {s.division_name} — {s.season_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Target Team</label>
                                <select
                                    value={enrollTeamId}
                                    onChange={e => setEnrollTeamId(e.target.value)}
                                    className="w-full rounded-lg px-3 py-2 text-sm border"
                                    style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.1)' }}
                                    disabled={!enrollSeasonId}
                                >
                                    <option value="">— Select Team —</option>
                                    {enrollTeams.map(t => (
                                        <option key={t.team_id} value={t.team_id}>{t.team_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Default Role</label>
                                <select
                                    value={enrollRole}
                                    onChange={e => setEnrollRole(e.target.value)}
                                    className="w-full rounded-lg px-3 py-2 text-sm border"
                                    style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.1)' }}
                                >
                                    <option value="">Use Player Defaults</option>
                                    {['fill', 'solo', 'jungle', 'mid', 'support', 'adc', 'sub'].map(r => (
                                        <option key={r} value={r}>{r === 'sub' ? 'Rule 0-Sub' : r.charAt(0).toUpperCase() + r.slice(1)}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-5">
                            <button
                                onClick={() => setShowEnroll(false)}
                                className="px-3 py-1.5 rounded-lg text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/5"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleBulkEnroll}
                                disabled={enrolling || !enrollSeasonId || !enrollTeamId}
                                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                {enrolling ? 'Enrolling...' : `Enroll ${selected.size} Player${selected.size !== 1 ? 's' : ''}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Info Modal */}
            {editPlayer && (
                <EditInfoModal
                    player={editPlayer}
                    onChange={setEditPlayer}
                    onSave={handleSaveInfo}
                    onClose={() => setEditPlayer(null)}
                    saving={editSaving}
                />
            )}

            {/* Alias Modal */}
            {aliasPlayer && (
                <AliasModal
                    player={aliasPlayer}
                    onAdd={handleAddAlias}
                    onRemove={handleRemoveAlias}
                    onClose={() => setAliasPlayer(null)}
                    saving={aliasSaving}
                />
            )}

            {/* Merge Modal */}
            {showMerge && (
                <MergeModal
                    players={enrichedPlayers}
                    onClose={() => setShowMerge(false)}
                    onMerge={handleMerge}
                    merging={merging}
                />
            )}
        </div>
    )
}

// ═══════════════════════════════════════════════════
// SORT HEADER
// ═══════════════════════════════════════════════════
function SortHeader({ col, label, current, dir, onSort }) {
    const isActive = current === col
    return (
        <th
            className="px-3 py-2.5 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase cursor-pointer select-none hover:text-[var(--color-text)] transition-colors"
            onClick={() => onSort(col)}
        >
            <span className="flex items-center gap-1">
                {label}
                <ChevronDown className={`w-3 h-3 transition-transform ${isActive ? '' : 'opacity-30'} ${isActive && dir === 'desc' ? 'rotate-180' : ''}`} />
            </span>
        </th>
    )
}

// ═══════════════════════════════════════════════════
// PLAYER ROW
// ═══════════════════════════════════════════════════
function PlayerRow({ player: p, isSelected, isExpanded, onToggleSelect, onToggleExpand, onEdit, onOpenAliases }) {
    const roleColors = {
        solo: 'bg-orange-500/20 text-orange-400',
        jungle: 'bg-red-500/20 text-red-400',
        mid: 'bg-blue-500/20 text-blue-400',
        support: 'bg-green-500/20 text-green-400',
        adc: 'bg-purple-500/20 text-purple-400',
        sub: 'bg-gray-500/20 text-gray-400',
        fill: 'bg-gray-500/20 text-gray-400',
    }

    return (
        <>
            <tr className={`border-b border-white/5 transition-colors ${isSelected ? 'bg-blue-500/5' : 'hover:bg-white/[0.02]'}`}>
                <td className="px-3 py-2">
                    <input type="checkbox" checked={isSelected} onChange={onToggleSelect} className="rounded" />
                </td>
                <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                        <button onClick={onToggleExpand} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
                            {isExpanded
                                ? <ChevronDown className="w-3.5 h-3.5" />
                                : <ChevronRight className="w-3.5 h-3.5" />
                            }
                        </button>
                        <span className="font-medium text-[var(--color-text)]">{p.name}</span>
                        {p.main_role && (
                            <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-medium opacity-60 ${roleColors[p.main_role.toLowerCase()] || roleColors.fill}`}
                                title={`Default: ${p.main_role}${p.secondary_role ? ` / ${p.secondary_role}` : ''}`}
                            >
                                {p.main_role}{p.secondary_role ? `/${p.secondary_role}` : ''}
                            </span>
                        )}
                        {p.isFreeAgent && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 font-medium">FA</span>
                        )}
                    </div>
                </td>
                <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                    {p.discord_name || <span className="opacity-30">—</span>}
                </td>
                <td className="px-3 py-2">
                    {p.currentTeam ? (
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: p.current?.team_color || '#666' }} />
                            <span className="text-[var(--color-text)]">{p.currentTeam}</span>
                        </span>
                    ) : (
                        <span className="text-[var(--color-text-secondary)] opacity-50">—</span>
                    )}
                </td>
                <td className="px-3 py-2">
                    {p.currentRole ? (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${roleColors[p.currentRole.toLowerCase()] || roleColors.fill}`}>
                            {p.currentRole}
                        </span>
                    ) : <span className="text-[var(--color-text-secondary)] opacity-30">—</span>}
                </td>
                <td className="px-3 py-2 text-[var(--color-text-secondary)] tabular-nums">{p.seasonsPlayed}</td>
                <td className="px-3 py-2 text-[var(--color-text-secondary)] tabular-nums">{p.totalGames}</td>
                <td className="px-3 py-2">
                    <button
                        onClick={onOpenAliases}
                        className="flex items-center gap-1.5 text-xs group"
                        title={p.aliases.length > 0 ? p.aliases.map(a => a.alias).join(', ') : 'No aliases — click to add'}
                    >
                        <Tag className="w-3 h-3 text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)] transition-colors" />
                        {p.aliases.length > 0 ? (
                            <span className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)] transition-colors tabular-nums">
                                {p.aliases.length}
                            </span>
                        ) : (
                            <span className="text-[var(--color-text-secondary)] opacity-30 group-hover:opacity-100 group-hover:text-[var(--color-accent)] transition-all">
                                0
                            </span>
                        )}
                    </button>
                </td>
                <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                        {p.tracker_url && (
                            <a
                                href={p.tracker_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors"
                                title="Tracker.gg Profile"
                            >
                                <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                        )}
                    </div>
                </td>
                <td className="px-3 py-2">
                    <button
                        onClick={onEdit}
                        className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors"
                        title="Edit player info"
                    >
                        Edit
                    </button>
                </td>
            </tr>

            {/* Expanded detail */}
            {isExpanded && (
                <tr className="border-b border-white/5">
                    <td colSpan={10} className="px-4 py-3 bg-white/[0.01]">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Contact info */}
                            <div>
                                <h4 className="text-xs font-medium text-[var(--color-text-secondary)] uppercase mb-2">Contact & Links</h4>
                                <div className="space-y-1.5 text-sm">
                                    <div className="flex gap-2">
                                        <span className="text-[var(--color-text-secondary)] w-20 shrink-0">Discord:</span>
                                        <span className="text-[var(--color-text)]">{p.discord_name || <span className="opacity-30">Not set</span>}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className="text-[var(--color-text-secondary)] w-20 shrink-0">Tracker:</span>
                                        {p.tracker_url ? (
                                            <a href={p.tracker_url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] hover:underline truncate">
                                                {p.tracker_url.replace(/^https?:\/\//, '')}
                                            </a>
                                        ) : <span className="text-[var(--color-text)] opacity-30">Not set</span>}
                                    </div>
                                    {p.aliases.length > 0 && (
                                        <div className="flex gap-2">
                                            <span className="text-[var(--color-text-secondary)] w-20 shrink-0">Aliases:</span>
                                            <span className="text-[var(--color-text)] flex flex-wrap gap-1">
                                                {p.aliases.map(a => (
                                                    <span key={a.alias_id} className="text-xs px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                                                        {a.alias}
                                                    </span>
                                                ))}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Season history */}
                            <div>
                                <h4 className="text-xs font-medium text-[var(--color-text-secondary)] uppercase mb-2">Season History</h4>
                                <div className="space-y-1">
                                    {p.rosters.length === 0 ? (
                                        <p className="text-xs text-[var(--color-text-secondary)] opacity-50">No roster history</p>
                                    ) : p.rosters.map(r => (
                                        <div key={r.league_player_id} className="flex items-center gap-2 text-xs">
                                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.is_active && r.season_is_active ? 'bg-green-400' : 'bg-gray-500'}`} />
                                            <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: r.team_color || '#666' }} />
                                            <span className="text-[var(--color-text)]">{r.team_name}</span>
                                            <span className="text-[var(--color-text-secondary)]">·</span>
                                            <span className="text-[var(--color-text-secondary)]">{r.league_name} {r.division_name} {r.season_name}</span>
                                            {r.role && <span className="text-[var(--color-text-secondary)]">({r.role === 'Sub' ? 'Rule 0-Sub' : r.role})</span>}
                                            <span className="text-[var(--color-text-secondary)] tabular-nums">{p.gameCountMap[r.league_player_id] || 0}g</span>
                                            {!r.is_active && <span className="text-red-400/60 text-[10px]">dropped</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    )
}

// ═══════════════════════════════════════════════════
// EDIT INFO MODAL
// ═══════════════════════════════════════════════════
function EditInfoModal({ player, onChange, onSave, onClose, saving }) {
    const inputRef = useRef(null)
    useEffect(() => { inputRef.current?.focus() }, [])

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div className="rounded-xl border border-white/10 shadow-2xl max-w-md w-full p-6" style={{ backgroundColor: 'var(--color-secondary)' }}>
                <h3 className="text-sm font-bold text-[var(--color-text)] mb-4">
                    Edit — {player.name}
                </h3>

                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Discord Username</label>
                        <input
                            ref={inputRef}
                            type="text"
                            value={player.discord_name}
                            onChange={e => onChange({ ...player, discord_name: e.target.value })}
                            placeholder="e.g. username#1234"
                            className="w-full rounded-lg px-3 py-2 text-sm border"
                            style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.1)' }}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Tracker.gg URL</label>
                        <input
                            type="text"
                            value={player.tracker_url}
                            onChange={e => onChange({ ...player, tracker_url: e.target.value })}
                            placeholder="https://tracker.gg/smite/profile/..."
                            className="w-full rounded-lg px-3 py-2 text-sm border"
                            style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.1)' }}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Main Role</label>
                            <select
                                value={player.main_role}
                                onChange={e => onChange({ ...player, main_role: e.target.value })}
                                className="w-full rounded-lg px-3 py-2 text-sm border"
                                style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.1)' }}
                            >
                                <option value="">None</option>
                                {['Solo', 'Jungle', 'Mid', 'Support', 'ADC'].map(r => (
                                    <option key={r} value={r.toLowerCase()}>{r}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Secondary Role</label>
                            <select
                                value={player.secondary_role}
                                onChange={e => onChange({ ...player, secondary_role: e.target.value })}
                                className="w-full rounded-lg px-3 py-2 text-sm border"
                                style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.1)' }}
                            >
                                <option value="">None</option>
                                {['Solo', 'Jungle', 'Mid', 'Support', 'ADC'].map(r => (
                                    <option key={r} value={r.toLowerCase()}>{r}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 mt-5">
                    <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/5">
                        Cancel
                    </button>
                    <button
                        onClick={onSave}
                        disabled={saving}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 transition-colors"
                    >
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════
// ALIAS MODAL
// ═══════════════════════════════════════════════════
function AliasModal({ player, onAdd, onRemove, onClose, saving }) {
    const [newAlias, setNewAlias] = useState('')
    const [editingId, setEditingId] = useState(null)
    const [editValue, setEditValue] = useState('')
    const inputRef = useRef(null)
    useEffect(() => { inputRef.current?.focus() }, [])

    const handleAdd = () => {
        const trimmed = newAlias.trim()
        if (trimmed.length < 2) return
        if (trimmed.toLowerCase() === player.name.toLowerCase()) return
        onAdd(player.id, trimmed)
        setNewAlias('')
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleAdd()
    }

    const startEdit = (alias) => {
        setEditingId(alias.alias_id)
        setEditValue(alias.alias)
    }

    const handleSaveEdit = async () => {
        const trimmed = editValue.trim()
        if (trimmed.length < 2 || trimmed.toLowerCase() === player.name.toLowerCase()) {
            setEditingId(null)
            return
        }
        const alias = player.aliases.find(a => a.alias_id === editingId)
        if (!alias || trimmed === alias.alias) {
            setEditingId(null)
            return
        }
        // Remove old, add new
        await onRemove(editingId, alias.alias)
        await onAdd(player.id, trimmed)
        setEditingId(null)
        setEditValue('')
    }

    const handleEditKeyDown = (e) => {
        if (e.key === 'Enter') handleSaveEdit()
        if (e.key === 'Escape') setEditingId(null)
    }

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div className="rounded-xl border border-white/10 shadow-2xl max-w-md w-full p-6" style={{ backgroundColor: 'var(--color-secondary)' }}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-[var(--color-text)]">
                        Aliases — {player.name}
                    </h3>
                    <span className="text-xs text-[var(--color-text-secondary)] tabular-nums">
                        {player.aliases.length} alias{player.aliases.length !== 1 ? 'es' : ''}
                    </span>
                </div>

                {/* Existing aliases */}
                <div className="space-y-1.5 mb-4">
                    {player.aliases.length === 0 ? (
                        <p className="text-xs text-[var(--color-text-secondary)] opacity-50 py-2">No aliases yet. Add one below.</p>
                    ) : player.aliases.map(a => (
                        <div key={a.alias_id} className="flex items-center gap-2 group">
                            {editingId === a.alias_id ? (
                                <>
                                    <input
                                        type="text"
                                        value={editValue}
                                        onChange={e => setEditValue(e.target.value)}
                                        onKeyDown={handleEditKeyDown}
                                        onBlur={() => setEditingId(null)}
                                        autoFocus
                                        className="flex-1 rounded-lg px-2.5 py-1.5 text-sm border"
                                        style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.2)' }}
                                    />
                                    <button
                                        onMouseDown={e => e.preventDefault()}
                                        onClick={handleSaveEdit}
                                        className="text-green-400 hover:text-green-300 transition-colors p-1"
                                        title="Save"
                                    >
                                        <Check className="w-3.5 h-3.5" />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <span
                                        className="flex-1 text-sm text-[var(--color-text)] px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 cursor-pointer hover:border-white/20 transition-colors"
                                        onClick={() => startEdit(a)}
                                        title="Click to edit"
                                    >
                                        {a.alias}
                                    </span>
                                    <button
                                        onClick={() => onRemove(a.alias_id, a.alias)}
                                        disabled={saving}
                                        className="text-[var(--color-text-secondary)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1 disabled:opacity-30"
                                        title="Remove alias"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </>
                            )}
                        </div>
                    ))}
                </div>

                {/* Add new alias */}
                <div className="flex items-center gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={newAlias}
                        onChange={e => setNewAlias(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Add new alias..."
                        className="flex-1 rounded-lg px-3 py-2 text-sm border"
                        style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.1)' }}
                    />
                    <button
                        onClick={handleAdd}
                        disabled={saving || newAlias.trim().length < 2}
                        className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Add
                    </button>
                </div>

                <div className="flex justify-end mt-5">
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/5 transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════
// MERGE MODAL
// ═══════════════════════════════════════════════════
function MergeModal({ players, onClose, onMerge, merging }) {
    const [sourceQuery, setSourceQuery] = useState('')
    const [targetQuery, setTargetQuery] = useState('')
    const [sourcePlayer, setSourcePlayer] = useState(null)
    const [targetPlayer, setTargetPlayer] = useState(null)
    const [showSourceDropdown, setShowSourceDropdown] = useState(false)
    const [showTargetDropdown, setShowTargetDropdown] = useState(false)
    const [confirmed, setConfirmed] = useState(false)
    const sourceRef = useRef(null)
    const targetRef = useRef(null)

    useEffect(() => {
        const handler = (e) => {
            if (sourceRef.current && !sourceRef.current.contains(e.target)) setShowSourceDropdown(false)
            if (targetRef.current && !targetRef.current.contains(e.target)) setShowTargetDropdown(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const filterPlayers = (query, excludeId) => {
        const q = query.trim().toLowerCase()
        if (q.length < 2) return []
        return players
            .filter(p => {
                if (excludeId && p.id === excludeId) return false
                return p.name.toLowerCase().includes(q) ||
                    p.aliases.some(a => a.alias.toLowerCase().includes(q))
            })
            .slice(0, 10)
    }

    const sourceResults = filterPlayers(sourceQuery, targetPlayer?.id)
    const targetResults = filterPlayers(targetQuery, sourcePlayer?.id)

    const handleMerge = () => {
        if (!sourcePlayer || !targetPlayer) return
        onMerge(sourcePlayer.id, targetPlayer.id)
    }

    const renderSearchField = (config) => {
        const { label, labelColor, borderColor, bgColor, player, query, setQuery, setPlayer, showDropdown, setShowDropdown, results, fieldRef, focusColor } = config
        return (
            <div ref={fieldRef} className="relative">
                <label className={`block text-xs font-medium ${labelColor} mb-1`}>{label}</label>
                {player ? (
                    <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${bgColor} border ${borderColor}`}>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-[var(--color-text)]">{player.name}</span>
                            {player.aliases.length > 0 && (
                                <span className="text-[10px] text-[var(--color-text-secondary)]">
                                    ({player.aliases.length} alias{player.aliases.length !== 1 ? 'es' : ''})
                                </span>
                            )}
                            {player.totalGames > 0 && (
                                <span className="text-[10px] text-[var(--color-text-secondary)]">
                                    {player.totalGames}g
                                </span>
                            )}
                        </div>
                        <button
                            onClick={() => { setPlayer(null); setQuery(''); setConfirmed(false) }}
                            className={`text-xs ${labelColor} hover:opacity-75`}
                        >
                            ✕
                        </button>
                    </div>
                ) : (
                    <>
                        <input
                            type="text"
                            value={query}
                            onChange={e => { setQuery(e.target.value); setShowDropdown(true); setConfirmed(false) }}
                            onFocus={() => setShowDropdown(true)}
                            placeholder="Search player name or alias..."
                            className={`w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-1 ${focusColor}`}
                            style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.1)' }}
                        />
                        {showDropdown && results.length > 0 && (
                            <div
                                className="absolute z-50 top-full left-0 mt-1 w-full border rounded-lg shadow-xl max-h-48 overflow-y-auto"
                                style={{ backgroundColor: 'var(--color-primary)', borderColor: 'rgba(255,255,255,0.1)' }}
                            >
                                {results.map(p => (
                                    <button
                                        key={p.id}
                                        onMouseDown={e => e.preventDefault()}
                                        onClick={() => { setPlayer(p); setShowDropdown(false); setQuery('') }}
                                        className="w-full text-left px-3 py-1.5 text-xs text-[var(--color-text)] hover:bg-white/5 transition-colors flex items-center justify-between"
                                    >
                                        <span>{p.name}</span>
                                        <span className="text-[var(--color-text-secondary)] text-[10px]">
                                            {p.totalGames}g · {p.seasonsPlayed}s
                                            {p.aliases.length > 0 && ` · ${p.aliases.length} alias`}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div className="rounded-xl border border-white/10 shadow-2xl max-w-md w-full" style={{ backgroundColor: 'var(--color-secondary)' }}>
                {/* Header */}
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-bold text-[var(--color-text)] flex items-center gap-2">
                            <Merge className="w-4 h-4" />
                            Merge Players
                        </h3>
                        <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
                            Merge a duplicate player's stats and aliases into the real player
                        </p>
                    </div>
                    <button onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] text-lg">✕</button>
                </div>

                <div className="px-5 py-4 space-y-4">
                    {renderSearchField({
                        label: 'Duplicate Player (will be deleted)',
                        labelColor: 'text-red-400',
                        borderColor: 'border-red-500/20',
                        bgColor: 'bg-red-500/10',
                        focusColor: 'focus:ring-red-500/50',
                        player: sourcePlayer,
                        query: sourceQuery,
                        setQuery: setSourceQuery,
                        setPlayer: setSourcePlayer,
                        showDropdown: showSourceDropdown,
                        setShowDropdown: setShowSourceDropdown,
                        results: sourceResults,
                        fieldRef: sourceRef,
                    })}

                    <div className="text-center text-[var(--color-text-secondary)] text-lg">↓ merge into ↓</div>

                    {renderSearchField({
                        label: 'Real Player (will keep)',
                        labelColor: 'text-green-400',
                        borderColor: 'border-green-500/20',
                        bgColor: 'bg-green-500/10',
                        focusColor: 'focus:ring-green-500/50',
                        player: targetPlayer,
                        query: targetQuery,
                        setQuery: setTargetQuery,
                        setPlayer: setTargetPlayer,
                        showDropdown: showTargetDropdown,
                        setShowDropdown: setShowTargetDropdown,
                        results: targetResults,
                        fieldRef: targetRef,
                    })}

                    {/* Summary & confirm */}
                    {sourcePlayer && targetPlayer && (
                        <div className="border-t border-white/10 pt-3 space-y-3">
                            <div className="text-xs text-[var(--color-text-secondary)] bg-white/5 rounded-lg px-3 py-2 space-y-1">
                                <div>
                                    <strong className="text-red-400">{sourcePlayer.name}</strong> will be deleted.
                                    All their stats ({sourcePlayer.totalGames} games) will be moved to <strong className="text-green-400">{targetPlayer.name}</strong>.
                                </div>
                                <div className="text-[10px]">
                                    "{sourcePlayer.name}" will be saved as an alias.
                                    {sourcePlayer.aliases.length > 0 && ` ${sourcePlayer.aliases.length} existing alias${sourcePlayer.aliases.length !== 1 ? 'es' : ''} will also transfer.`}
                                </div>
                            </div>

                            <div className="flex items-start gap-2 text-[10px] text-yellow-400/80 bg-yellow-500/5 rounded-lg px-3 py-2">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                <span>This action cannot be undone. Make sure you have the right players selected.</span>
                            </div>

                            {!confirmed ? (
                                <button
                                    onClick={() => setConfirmed(true)}
                                    className="w-full py-2.5 rounded-lg text-sm font-semibold bg-yellow-600 text-white hover:bg-yellow-500 transition-colors"
                                >
                                    Confirm Merge
                                </button>
                            ) : (
                                <button
                                    onClick={handleMerge}
                                    disabled={merging}
                                    className="w-full py-2.5 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
                                >
                                    {merging ? 'Merging...' : 'Yes, Merge & Delete Duplicate'}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

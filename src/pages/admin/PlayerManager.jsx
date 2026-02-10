// src/pages/admin/PlayerManager.jsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Home, ExternalLink, Download, Search, X, ChevronDown, ChevronRight, Check, Users } from 'lucide-react'
import { PlayerManagerHelp } from '../../components/admin/AdminHelp'

const API = import.meta.env.VITE_API_URL || '/.netlify/functions'

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
    const [enrollRole, setEnrollRole] = useState('fill')
    const [enrolling, setEnrolling] = useState(false)

    // Edit modal
    const [editPlayer, setEditPlayer] = useState(null) // { id, name, discord_name, tracker_url }
    const [editSaving, setEditSaving] = useState(false)

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
            const res = await fetch(`${API}/player-manage`)
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'bulk-enroll-season',
                    player_ids: [...selected],
                    season_id: parseInt(enrollSeasonId),
                    team_id: parseInt(enrollTeamId),
                    role: enrollRole,
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update-player-info',
                    player_id: editPlayer.id,
                    discord_name: editPlayer.discord_name || null,
                    tracker_url: editPlayer.tracker_url || null,
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
        <div className="max-w-[1400px] mx-auto py-8 px-4">
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
            <div className="flex items-center justify-between mb-6">
                <div>
                    <p className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">
                        <Link to="/admin" className="hover:text-[var(--color-accent)] transition-colors">Admin</Link>
                    </p>
                    <h1 className="font-heading text-2xl font-bold text-[var(--color-text)]">Player Manager</h1>
                    <p className="text-[var(--color-text-secondary)] text-sm mt-1">
                        {enrichedPlayers.length} players · {enrichedPlayers.filter(p => !p.isFreeAgent).length} rostered · {enrichedPlayers.filter(p => p.isFreeAgent).length} free agents
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Link to="/admin" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors">
                        ← Dashboard
                    </Link>
                    <Link to="/admin/matchreport" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors">
                        Match Report
                    </Link>
                    <Link to="/admin/rosters" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors">
                        Rosters
                    </Link>
                    <Link to="/admin/leagues" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors">
                        Leagues
                    </Link>
                    <Link to="/" className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-white/5 transition-colors" title="Home">
                        <Home className="w-4 h-4" />
                    </Link>
                </div>
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
                            <option key={r} value={r}>{r}</option>
                        ))}
                    </select>

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
                                <th className="px-3 py-2.5 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase">Links</th>
                                <th className="px-3 py-2.5 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase w-10"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPlayers.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-4 py-8 text-center text-[var(--color-text-secondary)]">
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
                                    onEdit={() => setEditPlayer({ id: p.id, name: p.name, discord_name: p.discord_name || '', tracker_url: p.tracker_url || '' })}
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
                                    {['fill', 'solo', 'jungle', 'mid', 'support', 'adc', 'sub'].map(r => (
                                        <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
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
function PlayerRow({ player: p, isSelected, isExpanded, onToggleSelect, onToggleExpand, onEdit }) {
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
                        {p.isFreeAgent && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 font-medium">FA</span>
                        )}
                        {p.aliases.length > 0 && (
                            <span className="text-[10px] text-[var(--color-text-secondary)]" title={p.aliases.map(a => a.alias).join(', ')}>
                                aka {p.aliases[0].alias}{p.aliases.length > 1 ? ` +${p.aliases.length - 1}` : ''}
                            </span>
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
                    <td colSpan={9} className="px-4 py-3 bg-white/[0.01]">
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
                                            <span className="text-[var(--color-text-secondary)]">{r.league_name} {r.season_name}</span>
                                            {r.role && <span className="text-[var(--color-text-secondary)]">({r.role})</span>}
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

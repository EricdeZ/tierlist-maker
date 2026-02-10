// src/pages/admin/RosterManager.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Home } from 'lucide-react'
import { RosterManagerHelp } from '../../components/admin/AdminHelp'

const API = import.meta.env.VITE_API_URL || '/.netlify/functions'
const STORAGE_KEY = 'smite2_roster_admin'

const ROLES = ['Solo', 'Jungle', 'Mid', 'Support', 'ADC', 'Sub', 'Fill']

// ─── Persistence ───
function loadState() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
    } catch {
        return {}
    }
}
function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export default function RosterManager() {
    const [adminData, setAdminData] = useState(null)
    const [adminLoading, setAdminLoading] = useState(true)
    const [adminError, setAdminError] = useState(null)

    // Selected season from localStorage
    const [selectedSeasonId, setSelectedSeasonId] = useState(() => loadState().selectedSeasonId || null)


    // Operation state
    const [opLoading, setOpLoading] = useState({}) // { [key]: true }
    const [toast, setToast] = useState(null) // { type: 'success'|'error', message, id }

    // Drag state
    const [draggedPlayer, setDraggedPlayer] = useState(null)
    const [dragOverTeam, setDragOverTeam] = useState(null)
    const [dragOverPlayer, setDragOverPlayer] = useState(null)

    // Batch changes state
    const [pendingChanges, setPendingChanges] = useState([])
    const [localRosters, setLocalRosters] = useState([])
    const [saving, setSaving] = useState(false)

    // Add player modal
    const [addModal, setAddModal] = useState(null) // { teamId, teamName }

    // Confirmation modal
    const [confirmModal, setConfirmModal] = useState(null)

    // Alias modal
    const [aliasModal, setAliasModal] = useState(null) // { playerId, playerName }

    // Rename modal
    const [renameModal, setRenameModal] = useState(null) // { playerId, playerName }

    // Merge modal
    const [showMerge, setShowMerge] = useState(false)

    // ─── Fetch admin data ───
    const fetchData = useCallback(async () => {
        setAdminLoading(true)
        setAdminError(null)
        try {
            const res = await fetch(`${API}/admin-data`)
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const data = await res.json()
            setAdminData(data)

            // Auto-select first season if none selected
            if (!selectedSeasonId && data.seasons?.length > 0) {
                setSelectedSeasonId(data.seasons[0].season_id)
            }
        } catch (e) {
            setAdminError(e.message)
        } finally {
            setAdminLoading(false)
        }
    }, [selectedSeasonId])

    useEffect(() => { fetchData() }, [])

    // Persist selected season
    useEffect(() => {
        saveState({ selectedSeasonId })
    }, [selectedSeasonId])

    // ─── Toast helper ───
    const showToast = useCallback((type, message) => {
        const id = Date.now()
        setToast({ type, message, id })
        setTimeout(() => setToast(prev => prev?.id === id ? null : prev), 4000)
    }, [])

    // ─── API call helper ───
    const rosterAction = useCallback(async (opKey, payload) => {
        setOpLoading(prev => ({ ...prev, [opKey]: true }))
        try {
            const res = await fetch(`${API}/roster-manage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
            showToast('success', data.message || 'Done!')
            // Refresh data after successful operation
            await fetchData()
            return data
        } catch (err) {
            showToast('error', err.message)
            throw err
        } finally {
            setOpLoading(prev => ({ ...prev, [opKey]: false }))
        }
    }, [fetchData, showToast])

    // ─── Derived data ───
    const seasons = adminData?.seasons || []
    const uniqueSeasons = seasons.reduce((acc, s) => {
        if (!acc.find(x => x.season_id === s.season_id)) {
            acc.push(s)
        }
        return acc
    }, [])

    const selectedSeason = uniqueSeasons.find(s => String(s.season_id) === String(selectedSeasonId))

    // Teams for selected season
    const seasonTeams = (adminData?.teams || []).filter(
        t => String(t.season_id) === String(selectedSeasonId)
    )

    // Players for selected season (active + inactive for showing dropped)
    const seasonPlayers = (adminData?.players || []).filter(
        p => String(p.season_id) === String(selectedSeasonId)
    )

    // Build team rosters
    const teamRosters = seasonTeams.map(team => {
        const activePlayers = seasonPlayers.filter(
            p => String(p.team_id) === String(team.team_id) && p.is_active !== false
        )
        return { ...team, players: activePlayers }
    })

    // Dropped players (inactive in this season) — need a separate query or derive from data
    // For now we'll track via the adminData.players which includes is_active
    // Note: admin-data only returns is_active=true players. We'll need to show a note about this.

    // Global players for "add player" search
    const globalPlayers = adminData?.globalPlayers || []

    // ─── Sync local rosters from server data ───
    useEffect(() => {
        setLocalRosters(structuredClone(teamRosters))
        setPendingChanges([])
    }, [adminData, selectedSeasonId])

    // ─── Warn on unsaved tab close/refresh ───
    useEffect(() => {
        if (pendingChanges.length === 0) return
        const handler = (e) => { e.preventDefault(); e.returnValue = '' }
        window.addEventListener('beforeunload', handler)
        return () => window.removeEventListener('beforeunload', handler)
    }, [pendingChanges.length])

    // ─── Guard in-app links when unsaved changes exist ───
    const guardNavigation = (e) => {
        if (pendingChanges.length > 0) {
            if (!window.confirm(`You have ${pendingChanges.length} unsaved change${pendingChanges.length !== 1 ? 's' : ''}. Leave without saving?`)) {
                e.preventDefault()
            }
        }
    }

    // ─── Auto-scroll while dragging near viewport edges ───
    useEffect(() => {
        if (!draggedPlayer) return
        const handleDragOverScroll = (e) => {
            const threshold = 80
            const speed = 15
            const y = e.clientY
            if (y < threshold) {
                window.scrollBy(0, -speed)
            } else if (y > window.innerHeight - threshold) {
                window.scrollBy(0, speed)
            }
        }
        document.addEventListener('dragover', handleDragOverScroll)
        return () => document.removeEventListener('dragover', handleDragOverScroll)
    }, [draggedPlayer])

    // ─── Drag & Drop handlers ───
    const handleDragStart = (e, player, fromTeamId) => {
        setDraggedPlayer({ ...player, fromTeamId })
        e.dataTransfer.effectAllowed = 'move'
        // For Firefox compatibility
        e.dataTransfer.setData('text/plain', player.league_player_id)
    }

    const handleDragOver = (e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
    }

    const handleDragEnter = (e, teamId) => {
        e.preventDefault()
        setDragOverTeam(teamId)
    }

    const handleDragLeave = (e, teamId) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
            if (dragOverTeam === teamId) setDragOverTeam(null)
        }
    }

    const handleDrop = (e, targetTeamId) => {
        e.preventDefault()
        setDragOverTeam(null)
        setDragOverPlayer(null)

        if (!draggedPlayer) return
        if (String(draggedPlayer.team_id) === String(targetTeamId)) {
            setDraggedPlayer(null)
            return
        }

        const targetTeam = seasonTeams.find(t => String(t.team_id) === String(targetTeamId))

        // Add pending transfer
        setPendingChanges(prev => [...prev, {
            id: crypto.randomUUID(),
            type: 'transfer',
            league_player_id: draggedPlayer.league_player_id,
            new_team_id: parseInt(targetTeamId),
            description: `Transfer ${draggedPlayer.name} to ${targetTeam?.team_name}`,
        }])

        // Update local rosters optimistically
        setLocalRosters(prev => {
            const next = structuredClone(prev)
            const fromTeam = next.find(t => String(t.team_id) === String(draggedPlayer.team_id))
            const toTeam = next.find(t => String(t.team_id) === String(targetTeamId))
            if (fromTeam && toTeam) {
                const idx = fromTeam.players.findIndex(p => p.league_player_id === draggedPlayer.league_player_id)
                if (idx >= 0) {
                    const [moved] = fromTeam.players.splice(idx, 1)
                    moved.team_id = targetTeamId
                    toTeam.players.push(moved)
                }
            }
            return next
        })

        setDraggedPlayer(null)
    }

    // ─── Drop on player (swap) ───
    const handleDropOnPlayer = (targetPlayer) => {
        if (!draggedPlayer) return
        if (draggedPlayer.league_player_id === targetPlayer.league_player_id) return
        if (String(draggedPlayer.team_id) === String(targetPlayer.team_id)) return

        const targetTeam = seasonTeams.find(t => String(t.team_id) === String(targetPlayer.team_id))
        const fromTeam = seasonTeams.find(t => String(t.team_id) === String(draggedPlayer.team_id))

        // Two pending transfers for the swap
        setPendingChanges(prev => [...prev,
            {
                id: crypto.randomUUID(),
                type: 'transfer',
                league_player_id: draggedPlayer.league_player_id,
                new_team_id: parseInt(targetPlayer.team_id),
                description: `Transfer ${draggedPlayer.name} to ${targetTeam?.team_name}`,
            },
            {
                id: crypto.randomUUID(),
                type: 'transfer',
                league_player_id: targetPlayer.league_player_id,
                new_team_id: parseInt(draggedPlayer.fromTeamId),
                description: `Transfer ${targetPlayer.name} to ${fromTeam?.team_name}`,
            },
        ])

        // Update local rosters optimistically
        setLocalRosters(prev => {
            const next = structuredClone(prev)
            const teamA = next.find(t => String(t.team_id) === String(draggedPlayer.fromTeamId))
            const teamB = next.find(t => String(t.team_id) === String(targetPlayer.team_id))
            if (teamA && teamB) {
                const idxA = teamA.players.findIndex(p => p.league_player_id === draggedPlayer.league_player_id)
                const idxB = teamB.players.findIndex(p => p.league_player_id === targetPlayer.league_player_id)
                if (idxA >= 0 && idxB >= 0) {
                    const playerA = teamA.players[idxA]
                    const playerB = teamB.players[idxB]
                    playerA.team_id = targetPlayer.team_id
                    playerB.team_id = draggedPlayer.fromTeamId
                    teamA.players[idxA] = playerB
                    teamB.players[idxB] = playerA
                }
            }
            return next
        })

        setDraggedPlayer(null)
        setDragOverTeam(null)
        setDragOverPlayer(null)
    }

    const handleDragEnd = () => {
        setDraggedPlayer(null)
        setDragOverTeam(null)
        setDragOverPlayer(null)
    }

    // ─── Role change (pending) ───
    const handleRoleChange = (leaguePlayerId, playerName, newRole) => {
        setPendingChanges(prev => [...prev, {
            id: crypto.randomUUID(),
            type: 'role-change',
            league_player_id: leaguePlayerId,
            role: newRole,
            description: `Change ${playerName} role to ${newRole}`,
        }])

        setLocalRosters(prev => {
            const next = structuredClone(prev)
            for (const team of next) {
                const player = team.players.find(p => p.league_player_id === leaguePlayerId)
                if (player) { player.role = newRole; break }
            }
            return next
        })
    }

    // ─── Drop player ───
    const handleDropPlayer = (leaguePlayerId, playerName, teamName) => {
        setConfirmModal({
            title: 'Drop Player',
            message: `Remove ${playerName} from ${teamName}? They will be deactivated from the roster but their stats will remain.`,
            confirmLabel: 'Drop Player',
            confirmColor: 'red',
            onConfirm: async () => {
                setConfirmModal(null)
                try {
                    await rosterAction(`drop_${leaguePlayerId}`, {
                        action: 'drop-player',
                        league_player_id: leaguePlayerId,
                    })
                    showToast('success', `${playerName} dropped from ${teamName}`)
                } catch {
                    // Error already toasted
                }
            },
        })
    }

    // ─── Save / Discard pending changes ───
    const handleSave = async () => {
        setSaving(true)
        let successCount = 0
        const errors = []

        for (const change of pendingChanges) {
            try {
                const payload = change.type === 'transfer'
                    ? { action: 'transfer-player', league_player_id: change.league_player_id, new_team_id: change.new_team_id }
                    : { action: 'change-role', league_player_id: change.league_player_id, role: change.role }

                const res = await fetch(`${API}/roster-manage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}))
                    throw new Error(data.error || `Failed: ${change.description}`)
                }
                successCount++
            } catch (err) {
                errors.push({ change, error: err.message })
            }
        }

        if (errors.length === 0) {
            showToast('success', `All ${successCount} change${successCount !== 1 ? 's' : ''} saved!`)
        } else {
            showToast('error', `${errors.length} of ${pendingChanges.length} changes failed`)
        }

        await fetchData()
        setSaving(false)
    }

    const handleDiscard = () => {
        setPendingChanges([])
        setLocalRosters(structuredClone(teamRosters))
    }

    // ─── Loading / Error states ───
    if (adminLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-2 border-[var(--color-accent)] border-t-transparent mx-auto mb-4" />
                    <p className="text-[var(--color-text-secondary)]">Loading roster data...</p>
                </div>
            </div>
        )
    }

    if (adminError) {
        return (
            <div className="max-w-2xl mx-auto py-16 px-4">
                <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-8 text-center">
                    <div className="text-4xl mb-4">⚠️</div>
                    <h2 className="text-xl font-bold text-red-400 mb-3">Failed to Load Data</h2>
                    <p className="text-red-300/80 mb-6">{adminError}</p>
                    <button
                        onClick={fetchData}
                        className="px-5 py-2.5 rounded-lg bg-red-500/20 text-red-400 font-semibold hover:bg-red-500/30 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-7xl mx-auto py-8 px-4">
            {/* Toast */}
            {toast && (
                <div
                    className={`fixed top-4 right-4 z-[100] max-w-sm px-4 py-3 rounded-lg shadow-xl border text-sm font-medium transition-all animate-[slideIn_0.3s_ease-out] ${
                        toast.type === 'success'
                            ? 'bg-green-500/15 border-green-500/30 text-green-400'
                            : 'bg-red-500/15 border-red-500/30 text-red-400'
                    }`}
                >
                    <div className="flex items-start gap-2">
                        <span className="shrink-0">{toast.type === 'success' ? '✓' : '✕'}</span>
                        <span>{toast.message}</span>
                        <button
                            onClick={() => setToast(null)}
                            className="ml-auto shrink-0 opacity-60 hover:opacity-100"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {confirmModal && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
                    <div
                        className="rounded-xl border border-white/10 shadow-2xl max-w-sm w-full p-6"
                        style={{ backgroundColor: 'var(--color-secondary)' }}
                    >
                        <h3 className="text-lg font-bold text-[var(--color-text)] mb-2">{confirmModal.title}</h3>
                        <p className="text-sm text-[var(--color-text-secondary)] mb-6">{confirmModal.message}</p>
                        <div className="flex items-center gap-3 justify-end">
                            <button
                                onClick={() => setConfirmModal(null)}
                                className="px-4 py-2 rounded-lg text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/5 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmModal.onConfirm}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors ${
                                    confirmModal.confirmColor === 'red'
                                        ? 'bg-red-600 hover:bg-red-500'
                                        : 'bg-blue-600 hover:bg-blue-500'
                                }`}
                            >
                                {confirmModal.confirmLabel}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Player Modal */}
            {addModal && (
                <AddPlayerModal
                    teamId={addModal.teamId}
                    teamName={addModal.teamName}
                    teamColor={addModal.teamColor}
                    seasonId={selectedSeasonId}
                    globalPlayers={globalPlayers}
                    seasonPlayers={seasonPlayers}
                    onClose={() => setAddModal(null)}
                    onAddExisting={async (playerId, role) => {
                        try {
                            await rosterAction(`add_${playerId}`, {
                                action: 'add-player-to-team',
                                player_id: playerId,
                                team_id: addModal.teamId,
                                season_id: parseInt(selectedSeasonId),
                                role,
                            })
                            showToast('success', `Player added to ${addModal.teamName}`)
                            setAddModal(null)
                        } catch {
                            // Error already toasted
                        }
                    }}
                    onCreateNew={async (name, role) => {
                        try {
                            await rosterAction(`create_${name}`, {
                                action: 'create-and-add-player',
                                name,
                                team_id: addModal.teamId,
                                season_id: parseInt(selectedSeasonId),
                                role,
                            })
                            showToast('success', `${name} created and added to ${addModal.teamName}`)
                            setAddModal(null)
                        } catch {
                            // Error already toasted
                        }
                    }}
                    opLoading={opLoading}
                />
            )}

            {/* Alias Modal */}
            {aliasModal && (
                <AliasModal
                    playerId={aliasModal.playerId}
                    playerName={aliasModal.playerName}
                    aliases={(adminData?.aliases || []).filter(a => a.player_id === aliasModal.playerId)}
                    onClose={() => setAliasModal(null)}
                    onAddAlias={async (alias) => {
                        await rosterAction(`alias_add_${alias}`, {
                            action: 'add-alias',
                            player_id: aliasModal.playerId,
                            alias,
                        })
                    }}
                    onRemoveAlias={async (aliasId) => {
                        await rosterAction(`alias_rm_${aliasId}`, {
                            action: 'remove-alias',
                            alias_id: aliasId,
                        })
                    }}
                    opLoading={opLoading}
                />
            )}

            {/* Rename Modal */}
            {renameModal && (
                <RenameModal
                    playerId={renameModal.playerId}
                    playerName={renameModal.playerName}
                    onClose={() => setRenameModal(null)}
                    onRename={async (newName, saveOldAsAlias) => {
                        await rosterAction(`rename_${renameModal.playerId}`, {
                            action: 'rename-player',
                            player_id: renameModal.playerId,
                            new_name: newName,
                            save_old_as_alias: saveOldAsAlias,
                        })
                        setRenameModal(null)
                    }}
                    opLoading={opLoading}
                />
            )}

            {/* Merge Modal */}
            {showMerge && (
                <MergeModal
                    globalPlayers={globalPlayers}
                    onClose={() => setShowMerge(false)}
                    onMerge={async (sourceId, targetId) => {
                        await rosterAction(`merge_${sourceId}_${targetId}`, {
                            action: 'merge-player',
                            source_player_id: sourceId,
                            target_player_id: targetId,
                        })
                        setShowMerge(false)
                    }}
                    opLoading={opLoading}
                />
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <p className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">
                        <Link to="/admin" onClick={guardNavigation} className="hover:text-[var(--color-accent)] transition-colors">Admin</Link>
                    </p>
                    <h1 className="font-heading text-2xl font-bold text-[var(--color-text)]">
                        Roster Manager
                    </h1>
                    <p className="text-[var(--color-text-secondary)] text-sm mt-1">
                        Drag players between teams to transfer · Click role to change · Manage your rosters
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowMerge(true)}
                        className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/10 transition-colors border border-white/10"
                    >
                        Merge Players
                    </button>
                    <Link to="/admin" onClick={guardNavigation} className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors">
                        ← Dashboard
                    </Link>
                    <Link to="/admin/matchreport" onClick={guardNavigation} className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors">
                        Match Report
                    </Link>
                    <Link to="/admin/matches" onClick={guardNavigation} className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors">
                        Match Manager
                    </Link>
                    <Link to="/admin/players" onClick={guardNavigation} className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors">
                        Players
                    </Link>
                    <Link to="/" onClick={guardNavigation} className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-white/5 transition-colors" title="Home">
                        <Home className="w-4 h-4" />
                    </Link>
                </div>
            </div>

            <RosterManagerHelp />

            {/* Season Selector */}
            <div className="bg-[var(--color-secondary)] border border-white/10 rounded-xl p-4 mb-6">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                            Season
                        </label>
                        <select
                            value={selectedSeasonId || ''}
                            onChange={e => setSelectedSeasonId(e.target.value || null)}
                            className="w-full rounded-lg px-3 py-2 text-sm border"
                            style={{
                                backgroundColor: 'var(--color-primary)',
                                color: 'var(--color-text)',
                                borderColor: 'rgba(255,255,255,0.1)',
                            }}
                        >
                            <option value="">— Select Season —</option>
                            {uniqueSeasons.map(s => (
                                <option key={s.season_id} value={s.season_id}>
                                    {s.league_name} / {s.division_name} — {s.season_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {selectedSeason && (
                        <div className="flex items-center gap-4 text-sm">
                            <span className="text-[var(--color-text-secondary)]">
                                {seasonTeams.length} teams · {seasonPlayers.length} players
                            </span>
                            <button
                                onClick={fetchData}
                                className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/10 transition-colors"
                            >
                                ↻ Refresh
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* No season selected */}
            {!selectedSeasonId && (
                <div className="text-center py-20">
                    <div className="text-5xl mb-4 opacity-50">📋</div>
                    <h3 className="text-lg font-semibold text-[var(--color-text)] mb-2">Select a Season</h3>
                    <p className="text-[var(--color-text-secondary)] text-sm">
                        Choose a season above to manage its team rosters.
                    </p>
                </div>
            )}

            {/* Team Cards Grid */}
            {selectedSeasonId && (
                <div className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 ${pendingChanges.length > 0 ? 'pb-20' : ''}`}>
                    {localRosters.map(team => (
                        <TeamCard
                            key={team.team_id}
                            team={team}
                            isDragOver={String(dragOverTeam) === String(team.team_id)}
                            hasDraggedPlayer={!!draggedPlayer}
                            isSameTeam={draggedPlayer && String(draggedPlayer.team_id) === String(team.team_id)}
                            dragOverPlayer={dragOverPlayer}
                            opLoading={opLoading}
                            onDragStart={handleDragStart}
                            onDragOver={handleDragOver}
                            onDragEnter={(e) => handleDragEnter(e, team.team_id)}
                            onDragLeave={(e) => handleDragLeave(e, team.team_id)}
                            onDrop={(e) => handleDrop(e, team.team_id)}
                            onDragEnd={handleDragEnd}
                            onDropOnPlayer={handleDropOnPlayer}
                            onSetDragOverPlayer={setDragOverPlayer}
                            onRoleChange={handleRoleChange}
                            onDropPlayer={handleDropPlayer}
                            onManageAliases={(playerId, playerName) => setAliasModal({ playerId, playerName })}
                            onRenamePlayer={(playerId, playerName) => setRenameModal({ playerId, playerName })}
                            onAddPlayer={() => setAddModal({
                                teamId: team.team_id,
                                teamName: team.team_name,
                                teamColor: team.color,
                            })}
                        />
                    ))}
                </div>
            )}

            {/* Save / Discard bar */}
            {pendingChanges.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 px-6 py-3 flex items-center justify-between shadow-xl"
                     style={{ backgroundColor: 'var(--color-secondary)' }}>
                    <div className="text-sm">
                        <span className="font-bold text-[var(--color-accent)]">{pendingChanges.length}</span>
                        <span className="text-[var(--color-text-secondary)]"> unsaved change{pendingChanges.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleDiscard}
                            disabled={saving}
                            className="px-4 py-2 rounded-lg text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/5 transition-colors disabled:opacity-50"
                        >
                            Discard
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-5 py-2 rounded-lg text-sm font-semibold bg-[var(--color-accent)] text-[var(--color-primary)] hover:opacity-90 disabled:opacity-50 transition-opacity"
                        >
                            {saving ? 'Saving...' : `Save ${pendingChanges.length} Change${pendingChanges.length !== 1 ? 's' : ''}`}
                        </button>
                    </div>
                </div>
            )}

            {selectedSeasonId && localRosters.length === 0 && (
                <div className="text-center py-20">
                    <div className="text-5xl mb-4 opacity-50">🏟️</div>
                    <h3 className="text-lg font-semibold text-[var(--color-text)] mb-2">No Teams Found</h3>
                    <p className="text-[var(--color-text-secondary)] text-sm">
                        This season has no teams yet.
                    </p>
                </div>
            )}

            {/* Inline keyframes for toast animation */}
            <style>{`
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>
        </div>
    )
}


// ═══════════════════════════════════════════════════
// TEAM CARD
// ═══════════════════════════════════════════════════
function TeamCard({
    team, isDragOver, hasDraggedPlayer, isSameTeam, dragOverPlayer, opLoading,
    onDragStart, onDragOver, onDragEnter, onDragLeave, onDrop, onDragEnd,
    onDropOnPlayer, onSetDragOverPlayer,
    onRoleChange, onDropPlayer, onManageAliases, onRenamePlayer, onAddPlayer,
}) {
    const isValidTarget = hasDraggedPlayer && !isSameTeam

    return (
        <div
            className={`rounded-xl border overflow-hidden transition-all duration-200 ${
                isDragOver && isValidTarget
                    ? 'border-blue-400/50 bg-blue-500/5 scale-[1.02] shadow-lg shadow-blue-500/10'
                    : isSameTeam && hasDraggedPlayer
                        ? 'border-white/5 opacity-60'
                        : 'border-white/10'
            }`}
            style={{ backgroundColor: 'var(--color-secondary)' }}
            onDragOver={onDragOver}
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            {/* Team color bar */}
            <div className="h-1.5" style={{ backgroundColor: team.color }} />

            {/* Team header */}
            <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: team.color }} />
                    <h3 className="font-heading text-base font-bold text-[var(--color-text)]">
                        {team.team_name}
                    </h3>
                </div>
                <span className="text-xs text-[var(--color-text-secondary)]">
                    {team.players.length} players
                </span>
            </div>

            {/* Player list */}
            <div className="px-3 pb-2 space-y-1 min-h-[120px]">
                {team.players.map(player => (
                    <PlayerRow
                        key={player.league_player_id}
                        player={player}
                        teamId={team.team_id}
                        teamName={team.team_name}
                        teamColor={team.color}
                        isDragOverTarget={dragOverPlayer === player.league_player_id}
                        hasDraggedPlayer={hasDraggedPlayer}
                        isLoading={
                            opLoading[`role_${player.league_player_id}`] ||
                            opLoading[`drop_${player.league_player_id}`] ||
                            opLoading[`transfer_${player.league_player_id}`]
                        }
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                        onDropOnPlayer={onDropOnPlayer}
                        onSetDragOverPlayer={onSetDragOverPlayer}
                        onRoleChange={onRoleChange}
                        onDropPlayer={onDropPlayer}
                        onManageAliases={onManageAliases}
                        onRenamePlayer={onRenamePlayer}
                    />
                ))}

                {team.players.length === 0 && (
                    <div className="text-center py-6 text-sm text-[var(--color-text-secondary)]/50 italic">
                        No active players
                    </div>
                )}

                {/* Drop zone hint when dragging */}
                {isDragOver && isValidTarget && (
                    <div className="border-2 border-dashed border-blue-400/40 rounded-lg p-3 text-center text-xs text-blue-400/80 bg-blue-500/5">
                        Drop to transfer here
                    </div>
                )}
            </div>

            {/* Add player button */}
            <div className="px-3 pb-3">
                <button
                    onClick={onAddPlayer}
                    className="w-full py-2 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] border border-dashed border-white/10 hover:border-[var(--color-accent)]/40 hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/5 transition-all"
                >
                    + Add Player
                </button>
            </div>
        </div>
    )
}


// ═══════════════════════════════════════════════════
// PLAYER ROW (inside team card)
// ═══════════════════════════════════════════════════
function PlayerRow({ player, teamId, teamName, teamColor, isDragOverTarget, hasDraggedPlayer, isLoading, onDragStart, onDragEnd, onDropOnPlayer, onSetDragOverPlayer, onRoleChange, onDropPlayer, onManageAliases, onRenamePlayer }) {
    const [showActions, setShowActions] = useState(false)
    const actionsRef = useRef(null)

    useEffect(() => {
        if (!showActions) return
        const handler = (e) => {
            if (actionsRef.current && !actionsRef.current.contains(e.target)) {
                setShowActions(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [showActions])

    return (
        <div
            className={`group relative flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-grab active:cursor-grabbing transition-all ${
                isLoading ? 'opacity-50 pointer-events-none' :
                isDragOverTarget && hasDraggedPlayer ? 'bg-blue-500/15 ring-1 ring-blue-400/40' :
                'hover:bg-white/5'
            }`}
            draggable={!isLoading}
            onDragStart={(e) => onDragStart(e, player, teamId)}
            onDragEnd={onDragEnd}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move' }}
            onDragEnter={(e) => { e.stopPropagation(); onSetDragOverPlayer(player.league_player_id) }}
            onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) {
                    onSetDragOverPlayer(null)
                }
            }}
            onDrop={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onSetDragOverPlayer(null)
                onDropOnPlayer(player)
            }}
        >
            {/* Drag handle indicator */}
            <div className="w-4 flex flex-col items-center gap-[2px] opacity-0 group-hover:opacity-40 transition-opacity shrink-0">
                <span className="w-1 h-1 rounded-full bg-[var(--color-text)]" />
                <span className="w-1 h-1 rounded-full bg-[var(--color-text)]" />
                <span className="w-1 h-1 rounded-full bg-[var(--color-text)]" />
            </div>

            {/* Player name */}
            <span className="text-sm text-[var(--color-text)] flex-1 truncate" title={player.name}>
                {player.name}
            </span>

            {/* Role badge */}
            <RoleBadge
                role={player.role}
                leaguePlayerId={player.league_player_id}
                playerName={player.name}
                onRoleChange={onRoleChange}
            />

            {/* Actions menu */}
            <div className="relative" ref={actionsRef}>
                <button
                    onClick={() => setShowActions(!showActions)}
                    className="w-6 h-6 flex items-center justify-center rounded text-[var(--color-text-secondary)] opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-white/10 transition-all text-xs"
                >
                    ⋮
                </button>

                {showActions && (
                    <div
                        className="absolute right-0 top-full mt-1 z-40 w-40 rounded-lg border shadow-xl overflow-hidden"
                        style={{
                            backgroundColor: 'var(--color-primary)',
                            borderColor: 'rgba(255,255,255,0.1)',
                        }}
                    >
                        <button
                            onClick={() => {
                                setShowActions(false)
                                onRenamePlayer(player.player_id, player.name)
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-[var(--color-text-secondary)] hover:bg-white/5 transition-colors flex items-center gap-2"
                        >
                            <span>✏</span> Rename
                        </button>
                        <button
                            onClick={() => {
                                setShowActions(false)
                                onManageAliases(player.player_id, player.name)
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-[var(--color-text-secondary)] hover:bg-white/5 transition-colors flex items-center gap-2"
                        >
                            <span>↔</span> Manage Aliases
                        </button>
                        <button
                            onClick={() => {
                                setShowActions(false)
                                onDropPlayer(player.league_player_id, player.name, teamName)
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                        >
                            <span>🚫</span> Drop from Roster
                        </button>
                    </div>
                )}
            </div>

            {/* Loading spinner */}
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-[var(--color-secondary)]/80">
                    <div className="w-4 h-4 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                </div>
            )}
        </div>
    )
}


// ═══════════════════════════════════════════════════
// ROLE BADGE (click to edit inline)
// ═══════════════════════════════════════════════════
function RoleBadge({ role, leaguePlayerId, playerName, onRoleChange }) {
    const [editing, setEditing] = useState(false)
    const ref = useRef(null)

    useEffect(() => {
        if (!editing) return
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setEditing(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [editing])

    const roleColors = {
        solo: 'bg-amber-500/20 text-amber-400',
        jungle: 'bg-green-500/20 text-green-400',
        mid: 'bg-blue-500/20 text-blue-400',
        support: 'bg-purple-500/20 text-purple-400',
        adc: 'bg-red-500/20 text-red-400',
        sub: 'bg-white/10 text-[var(--color-text-secondary)]',
        fill: 'bg-white/10 text-[var(--color-text-secondary)]',
    }

    const roleLower = (role || 'fill').toLowerCase()
    const colorClass = roleColors[roleLower] || roleColors.fill

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setEditing(!editing)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 transition-opacity hover:opacity-80 ${colorClass}`}
                title="Click to change role"
            >
                {role || 'Fill'}
            </button>

            {editing && (
                <div
                    className="absolute right-0 top-full mt-1 z-40 w-32 rounded-lg border shadow-xl overflow-hidden"
                    style={{
                        backgroundColor: 'var(--color-primary)',
                        borderColor: 'rgba(255,255,255,0.1)',
                    }}
                >
                    {ROLES.map(r => (
                        <button
                            key={r}
                            onClick={() => {
                                setEditing(false)
                                if (r.toLowerCase() !== roleLower) {
                                    onRoleChange(leaguePlayerId, playerName, r)
                                }
                            }}
                            className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center justify-between ${
                                r.toLowerCase() === roleLower
                                    ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-semibold'
                                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/5'
                            }`}
                        >
                            <span>{r}</span>
                            {r.toLowerCase() === roleLower && <span>✓</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}


// ═══════════════════════════════════════════════════
// ADD PLAYER MODAL
// ═══════════════════════════════════════════════════
function AddPlayerModal({ teamName, teamColor, seasonId, globalPlayers, seasonPlayers, onClose, onAddExisting, onCreateNew, opLoading }) {
    const [mode, setMode] = useState('search') // 'search' | 'create'
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedRole, setSelectedRole] = useState('Fill')
    const [newPlayerName, setNewPlayerName] = useState('')
    const [error, setError] = useState(null)
    const inputRef = useRef(null)

    useEffect(() => {
        inputRef.current?.focus()
    }, [mode])

    // Players already on a roster this season
    const rosteredPlayerIds = new Set(seasonPlayers.map(p => p.player_id))

    // Filter global players
    const searchResults = searchQuery.trim().length >= 2
        ? globalPlayers
            .filter(p => {
                const q = searchQuery.trim().toLowerCase()
                return p.name.toLowerCase().includes(q)
            })
            .map(p => ({
                ...p,
                is_rostered: rosteredPlayerIds.has(p.player_id),
                roster_info: seasonPlayers.find(sp => sp.player_id === p.player_id),
            }))
            .slice(0, 15)
        : []

    const isAnyLoading = Object.values(opLoading).some(Boolean)

    const handleAddExisting = (player) => {
        if (player.is_rostered) {
            setError(`${player.name} is already on a roster this season. Use the transfer drag-and-drop instead.`)
            return
        }
        setError(null)
        onAddExisting(player.player_id, selectedRole)
    }

    const handleCreateNew = () => {
        const trimmed = newPlayerName.trim()
        if (!trimmed) {
            setError('Please enter a player name.')
            return
        }
        if (trimmed.length < 2) {
            setError('Player name must be at least 2 characters.')
            return
        }
        setError(null)
        onCreateNew(trimmed, selectedRole)
    }

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div
                className="rounded-xl border border-white/10 shadow-2xl max-w-md w-full overflow-hidden"
                style={{ backgroundColor: 'var(--color-secondary)' }}
            >
                {/* Header */}
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: teamColor }} />
                        <h3 className="text-base font-bold text-[var(--color-text)]">
                            Add Player to {teamName}
                        </h3>
                    </div>
                    <button onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] text-lg">✕</button>
                </div>

                {/* Mode tabs */}
                <div className="flex border-b border-white/10">
                    <button
                        onClick={() => { setMode('search'); setError(null) }}
                        className={`flex-1 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                            mode === 'search'
                                ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]'
                                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                        }`}
                    >
                        Search Existing
                    </button>
                    <button
                        onClick={() => { setMode('create'); setError(null) }}
                        className={`flex-1 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                            mode === 'create'
                                ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]'
                                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                        }`}
                    >
                        Create New
                    </button>
                </div>

                {/* Error */}
                {error && (
                    <div className="mx-5 mt-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-start gap-2">
                        <span className="shrink-0 mt-0.5">⚠</span>
                        <span>{error}</span>
                    </div>
                )}

                {/* Role selector (shared) */}
                <div className="px-5 pt-4 pb-2">
                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                        Role
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                        {ROLES.map(r => (
                            <button
                                key={r}
                                onClick={() => setSelectedRole(r)}
                                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                                    selectedRole === r
                                        ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/30'
                                        : 'bg-white/5 text-[var(--color-text-secondary)] hover:bg-white/10'
                                }`}
                            >
                                {r}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Search mode */}
                {mode === 'search' && (
                    <div className="px-5 pb-5 pt-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchQuery}
                            onChange={e => { setSearchQuery(e.target.value); setError(null) }}
                            placeholder="Search by player name..."
                            className="w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/50"
                            style={{
                                backgroundColor: 'var(--color-primary)',
                                color: 'var(--color-text)',
                                borderColor: 'rgba(255,255,255,0.1)',
                            }}
                        />

                        {searchQuery.trim().length >= 2 && (
                            <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-white/10">
                                {searchResults.length === 0 ? (
                                    <div className="px-3 py-4 text-center text-xs text-[var(--color-text-secondary)]">
                                        No players found for "{searchQuery}". Try the "Create New" tab.
                                    </div>
                                ) : (
                                    searchResults.map(player => (
                                        <button
                                            key={player.player_id}
                                            onClick={() => handleAddExisting(player)}
                                            disabled={isAnyLoading}
                                            className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors border-b border-white/5 last:border-b-0 ${
                                                player.is_rostered
                                                    ? 'opacity-40 cursor-not-allowed'
                                                    : 'hover:bg-[var(--color-accent)]/10 cursor-pointer'
                                            }`}
                                        >
                                            <div>
                                                <span className="text-[var(--color-text)]">{player.name}</span>
                                                {player.is_rostered && (
                                                    <span className="ml-2 text-[10px] text-yellow-400/80">
                                                        (on {player.roster_info?.team_name || 'a team'})
                                                    </span>
                                                )}
                                            </div>
                                            {!player.is_rostered && (
                                                <span className="text-[10px] text-[var(--color-accent)] font-semibold shrink-0">+ ADD</span>
                                            )}
                                        </button>
                                    ))
                                )}
                            </div>
                        )}

                        {searchQuery.trim().length > 0 && searchQuery.trim().length < 2 && (
                            <p className="mt-2 text-xs text-[var(--color-text-secondary)] text-center">
                                Type at least 2 characters to search
                            </p>
                        )}
                    </div>
                )}

                {/* Create mode */}
                {mode === 'create' && (
                    <div className="px-5 pb-5 pt-2">
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                            Player Name
                        </label>
                        <input
                            ref={inputRef}
                            type="text"
                            value={newPlayerName}
                            onChange={e => { setNewPlayerName(e.target.value); setError(null) }}
                            onKeyDown={e => e.key === 'Enter' && handleCreateNew()}
                            placeholder="Enter new player name..."
                            className="w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/50 mb-4"
                            style={{
                                backgroundColor: 'var(--color-primary)',
                                color: 'var(--color-text)',
                                borderColor: 'rgba(255,255,255,0.1)',
                            }}
                        />

                        <button
                            onClick={handleCreateNew}
                            disabled={isAnyLoading || !newPlayerName.trim()}
                            className="w-full py-2.5 rounded-lg text-sm font-semibold bg-[var(--color-accent)] text-[var(--color-primary)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                        >
                            {isAnyLoading ? 'Creating...' : `Create & Add to ${teamName}`}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}


// ═══════════════════════════════════════════════════
// ALIAS MODAL
// ═══════════════════════════════════════════════════
function AliasModal({ playerName, aliases, onClose, onAddAlias, onRemoveAlias, opLoading }) {
    const [newAlias, setNewAlias] = useState('')
    const [error, setError] = useState(null)
    const inputRef = useRef(null)

    useEffect(() => { inputRef.current?.focus() }, [])

    const isAnyLoading = Object.values(opLoading).some(Boolean)

    const handleAdd = async () => {
        const trimmed = newAlias.trim()
        if (!trimmed) { setError('Enter an alias'); return }
        if (trimmed.length < 2) { setError('Alias must be at least 2 characters'); return }
        if (trimmed.toLowerCase() === playerName.toLowerCase()) { setError('Alias cannot be the same as the player name'); return }
        setError(null)
        try {
            await onAddAlias(trimmed)
            setNewAlias('')
        } catch {
            // Error shown via toast
        }
    }

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div
                className="rounded-xl border border-white/10 shadow-2xl max-w-sm w-full overflow-hidden"
                style={{ backgroundColor: 'var(--color-secondary)' }}
            >
                {/* Header */}
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-bold text-[var(--color-text)]">
                            Aliases for {playerName}
                        </h3>
                        <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
                            Old names that should resolve to this player
                        </p>
                    </div>
                    <button onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] text-lg">✕</button>
                </div>

                {/* Existing aliases */}
                <div className="px-5 py-3">
                    {aliases.length === 0 ? (
                        <p className="text-xs text-[var(--color-text-secondary)] text-center py-3 italic">
                            No aliases yet
                        </p>
                    ) : (
                        <div className="space-y-1.5">
                            {aliases.map(a => (
                                <div key={a.alias_id} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/5 group">
                                    <span className="text-sm text-[var(--color-text)]">{a.alias}</span>
                                    <button
                                        onClick={() => onRemoveAlias(a.alias_id)}
                                        disabled={isAnyLoading}
                                        className="text-xs text-red-400/60 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-30"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Add new alias */}
                <div className="px-5 pb-4 border-t border-white/10 pt-3">
                    {error && (
                        <div className="mb-2 px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-[10px] text-red-400">
                            {error}
                        </div>
                    )}
                    <div className="flex gap-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={newAlias}
                            onChange={e => { setNewAlias(e.target.value); setError(null) }}
                            onKeyDown={e => e.key === 'Enter' && handleAdd()}
                            placeholder="Add old name..."
                            className="flex-1 rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/50"
                            style={{
                                backgroundColor: 'var(--color-primary)',
                                color: 'var(--color-text)',
                                borderColor: 'rgba(255,255,255,0.1)',
                            }}
                        />
                        <button
                            onClick={handleAdd}
                            disabled={isAnyLoading || !newAlias.trim()}
                            className="px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--color-accent)] text-[var(--color-primary)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity shrink-0"
                        >
                            Add
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}


// ═══════════════════════════════════════════════════
// RENAME MODAL
// ═══════════════════════════════════════════════════
function RenameModal({ playerId, playerName, onClose, onRename, opLoading }) {
    const [newName, setNewName] = useState(playerName)
    const [saveAlias, setSaveAlias] = useState(true)
    const [error, setError] = useState(null)
    const inputRef = useRef(null)

    useEffect(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
    }, [])

    const isAnyLoading = Object.values(opLoading).some(Boolean)

    const handleRename = async () => {
        const trimmed = newName.trim()
        if (!trimmed) { setError('Enter a name'); return }
        if (trimmed.length < 2) { setError('Name must be at least 2 characters'); return }
        if (trimmed === playerName) { onClose(); return }
        setError(null)
        try {
            await onRename(trimmed, saveAlias)
        } catch {
            // Error shown via toast
        }
    }

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div
                className="rounded-xl border border-white/10 shadow-2xl max-w-sm w-full overflow-hidden"
                style={{ backgroundColor: 'var(--color-secondary)' }}
            >
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                    <h3 className="text-base font-bold text-[var(--color-text)]">
                        Rename Player
                    </h3>
                    <button onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] text-lg">✕</button>
                </div>

                <div className="px-5 py-4 space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                            Current: <span className="text-[var(--color-text)]">{playerName}</span>
                        </label>
                        <input
                            ref={inputRef}
                            type="text"
                            value={newName}
                            onChange={e => { setNewName(e.target.value); setError(null) }}
                            onKeyDown={e => e.key === 'Enter' && handleRename()}
                            placeholder="New name..."
                            className="w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/50"
                            style={{
                                backgroundColor: 'var(--color-primary)',
                                color: 'var(--color-text)',
                                borderColor: 'rgba(255,255,255,0.1)',
                            }}
                        />
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={saveAlias}
                            onChange={e => setSaveAlias(e.target.checked)}
                            className="rounded accent-[var(--color-accent)]"
                        />
                        <span className="text-xs text-[var(--color-text-secondary)]">
                            Save "{playerName}" as an alias
                        </span>
                    </label>

                    {error && (
                        <div className="px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-[10px] text-red-400">
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleRename}
                        disabled={isAnyLoading || !newName.trim() || newName.trim() === playerName}
                        className="w-full py-2.5 rounded-lg text-sm font-semibold bg-[var(--color-accent)] text-[var(--color-primary)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                    >
                        {isAnyLoading ? 'Renaming...' : 'Rename'}
                    </button>
                </div>
            </div>
        </div>
    )
}


// ═══════════════════════════════════════════════════
// MERGE MODAL
// ═══════════════════════════════════════════════════
function MergeModal({ globalPlayers, onClose, onMerge, opLoading }) {
    const [sourceQuery, setSourceQuery] = useState('')
    const [targetQuery, setTargetQuery] = useState('')
    const [sourcePlayer, setSourcePlayer] = useState(null)
    const [targetPlayer, setTargetPlayer] = useState(null)
    const [showSourceDropdown, setShowSourceDropdown] = useState(false)
    const [showTargetDropdown, setShowTargetDropdown] = useState(false)
    const [confirmed, setConfirmed] = useState(false)
    const sourceRef = useRef(null)
    const targetRef = useRef(null)

    const isAnyLoading = Object.values(opLoading).some(Boolean)

    // Click-outside handlers
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
        return globalPlayers
            .filter(p => p.name.toLowerCase().includes(q) && (!excludeId || p.player_id !== excludeId))
            .slice(0, 10)
    }

    const sourceResults = filterPlayers(sourceQuery, targetPlayer?.player_id)
    const targetResults = filterPlayers(targetQuery, sourcePlayer?.player_id)

    const handleMerge = async () => {
        if (!sourcePlayer || !targetPlayer) return
        try {
            await onMerge(sourcePlayer.player_id, targetPlayer.player_id)
        } catch {
            // Error shown via toast
        }
    }

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div
                className="rounded-xl border border-white/10 shadow-2xl max-w-md w-full"
                style={{ backgroundColor: 'var(--color-secondary)' }}
            >
                {/* Header */}
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-bold text-[var(--color-text)]">Merge Players</h3>
                        <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
                            Merge a duplicate player's stats into the real player
                        </p>
                    </div>
                    <button onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] text-lg">✕</button>
                </div>

                <div className="px-5 py-4 space-y-4">
                    {/* Source player (duplicate) */}
                    <div ref={sourceRef} className="relative">
                        <label className="block text-xs font-medium text-red-400 mb-1">
                            Duplicate Player (will be deleted)
                        </label>
                        {sourcePlayer ? (
                            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                                <span className="text-sm text-[var(--color-text)]">{sourcePlayer.name}</span>
                                <button onClick={() => { setSourcePlayer(null); setSourceQuery(''); setConfirmed(false) }}
                                        className="text-xs text-red-400 hover:text-red-300">✕</button>
                            </div>
                        ) : (
                            <>
                                <input
                                    type="text"
                                    value={sourceQuery}
                                    onChange={e => { setSourceQuery(e.target.value); setShowSourceDropdown(true); setConfirmed(false) }}
                                    onFocus={() => setShowSourceDropdown(true)}
                                    placeholder="Search duplicate player..."
                                    className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-1 focus:ring-red-500/50"
                                    style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.1)' }}
                                />
                                {showSourceDropdown && sourceResults.length > 0 && (
                                    <div className="absolute z-50 top-full left-0 mt-1 w-full border rounded-lg shadow-xl max-h-40 overflow-y-auto"
                                         style={{ backgroundColor: 'var(--color-primary)', borderColor: 'rgba(255,255,255,0.1)' }}>
                                        {sourceResults.map(p => (
                                            <button key={p.player_id}
                                                    onMouseDown={e => e.preventDefault()}
                                                    onClick={() => { setSourcePlayer(p); setShowSourceDropdown(false); setSourceQuery('') }}
                                                    className="w-full text-left px-3 py-1.5 text-xs text-[var(--color-text)] hover:bg-white/5 transition-colors">
                                                {p.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Arrow */}
                    <div className="text-center text-[var(--color-text-secondary)] text-lg">↓ merge into ↓</div>

                    {/* Target player (real) */}
                    <div ref={targetRef} className="relative">
                        <label className="block text-xs font-medium text-green-400 mb-1">
                            Real Player (will keep)
                        </label>
                        {targetPlayer ? (
                            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
                                <span className="text-sm text-[var(--color-text)]">{targetPlayer.name}</span>
                                <button onClick={() => { setTargetPlayer(null); setTargetQuery(''); setConfirmed(false) }}
                                        className="text-xs text-green-400 hover:text-green-300">✕</button>
                            </div>
                        ) : (
                            <>
                                <input
                                    type="text"
                                    value={targetQuery}
                                    onChange={e => { setTargetQuery(e.target.value); setShowTargetDropdown(true); setConfirmed(false) }}
                                    onFocus={() => setShowTargetDropdown(true)}
                                    placeholder="Search real player..."
                                    className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-1 focus:ring-green-500/50"
                                    style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.1)' }}
                                />
                                {showTargetDropdown && targetResults.length > 0 && (
                                    <div className="absolute z-50 top-full left-0 mt-1 w-full border rounded-lg shadow-xl max-h-40 overflow-y-auto"
                                         style={{ backgroundColor: 'var(--color-primary)', borderColor: 'rgba(255,255,255,0.1)' }}>
                                        {targetResults.map(p => (
                                            <button key={p.player_id}
                                                    onMouseDown={e => e.preventDefault()}
                                                    onClick={() => { setTargetPlayer(p); setShowTargetDropdown(false); setTargetQuery('') }}
                                                    className="w-full text-left px-3 py-1.5 text-xs text-[var(--color-text)] hover:bg-white/5 transition-colors">
                                                {p.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Summary & confirm */}
                    {sourcePlayer && targetPlayer && (
                        <div className="border-t border-white/10 pt-3 space-y-3">
                            <div className="text-xs text-[var(--color-text-secondary)] bg-white/5 rounded-lg px-3 py-2">
                                <strong className="text-red-400">{sourcePlayer.name}</strong> will be deleted.
                                All their stats will be moved to <strong className="text-green-400">{targetPlayer.name}</strong>.
                                <br /><span className="text-[10px]">"{sourcePlayer.name}" will be saved as an alias.</span>
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
                                    disabled={isAnyLoading}
                                    className="w-full py-2.5 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
                                >
                                    {isAnyLoading ? 'Merging...' : 'Yes, Merge & Delete Duplicate'}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

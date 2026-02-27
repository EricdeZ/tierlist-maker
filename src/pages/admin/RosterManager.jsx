// src/pages/admin/RosterManager.jsx
import { useState, useEffect, useCallback, useMemo } from 'react'
import { RosterManagerHelp } from '../../components/admin/AdminHelp'
import { getAuthHeaders } from '../../services/adminApi.js'
import { API, playerSort, loadState, saveState } from './roster/constants'
import { TeamCard } from './roster/TeamCard'
import { AddPlayerModal } from './roster/AddPlayerModal'
import { PlayerPoolPanel } from './roster/PlayerPoolPanel'
import { AliasModal } from './roster/AliasModal'
import { RenameModal } from './roster/RenameModal'
import { MergeModal } from './roster/MergeModal'
import { ConfirmModal } from './roster/ConfirmModal'
import { Toast } from './roster/Toast'
import { SaveBar } from './roster/SaveBar'

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

    // Modal state
    const [addModal, setAddModal] = useState(null) // { teamId, teamName, teamColor }
    const [confirmModal, setConfirmModal] = useState(null)
    const [aliasModal, setAliasModal] = useState(null) // { playerId, playerName }
    const [renameModal, setRenameModal] = useState(null) // { playerId, playerName }
    const [showMerge, setShowMerge] = useState(false)

    // Player pool panel
    const [showPool, setShowPool] = useState(false)
    const [poolSearch, setPoolSearch] = useState('')

    // Show Rule 0-Subs toggle
    const [showSubs, setShowSubs] = useState(false)

    // ─── Fetch admin data ───
    const fetchData = useCallback(async () => {
        setAdminLoading(true)
        setAdminError(null)
        try {
            const res = await fetch(`${API}/admin-data`, { headers: getAuthHeaders() })
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
                headers: getAuthHeaders(),
                body: JSON.stringify(payload),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
            showToast('success', data.message || 'Done!')
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

    const seasonTeams = (adminData?.teams || []).filter(
        t => String(t.season_id) === String(selectedSeasonId)
    )

    const seasonPlayers = (adminData?.players || []).filter(
        p => String(p.season_id) === String(selectedSeasonId)
    )

    const teamRosters = seasonTeams.map(team => {
        const activePlayers = seasonPlayers.filter(
            p => String(p.team_id) === String(team.team_id) && p.is_active !== false
        )
        return { ...team, players: activePlayers.sort(playerSort) }
    })

    const globalPlayers = adminData?.globalPlayers || []

    const leagueRosteredPlayerIds = useMemo(() => {
        if (!selectedSeason || !adminData) return new Set()
        const leagueId = selectedSeason.league_id
        const leagueSeasonIds = new Set(
            seasons.filter(s => String(s.league_id) === String(leagueId)).map(s => s.season_id)
        )
        return new Set(
            (adminData.players || [])
                .filter(p => leagueSeasonIds.has(p.season_id) && p.roster_status !== 'sub')
                .map(p => p.player_id)
        )
    }, [selectedSeason, adminData, seasons])

    const poolPlayers = useMemo(() => {
        const pendingAddIds = new Set(
            pendingChanges.filter(c => c.type === 'add').map(c => c.player_id)
        )
        return globalPlayers
            .filter(p => !leagueRosteredPlayerIds.has(p.player_id) && !pendingAddIds.has(p.player_id))
            .sort((a, b) => a.name.localeCompare(b.name))
    }, [leagueRosteredPlayerIds, globalPlayers, pendingChanges])

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

    // ─── Helper: add player to team as pending change ───
    const addPlayerToTeamPending = (player, targetTeamId, role) => {
        const targetTeam = seasonTeams.find(t => String(t.team_id) === String(targetTeamId))
        const effectiveRole = role || player.main_role || 'fill'

        setPendingChanges(prev => [...prev, {
            id: crypto.randomUUID(),
            type: 'add',
            player_id: player.player_id,
            player_name: player.name,
            team_id: parseInt(targetTeamId),
            role: effectiveRole,
            description: `Add ${player.name} to ${targetTeam?.team_name}`,
        }])

        setLocalRosters(prev => {
            const next = structuredClone(prev)
            const team = next.find(t => String(t.team_id) === String(targetTeamId))
            if (team) {
                team.players.push({
                    league_player_id: `pending-${player.player_id}`,
                    player_id: player.player_id,
                    name: player.name,
                    slug: player.slug,
                    team_id: parseInt(targetTeamId),
                    role: effectiveRole,
                    main_role: player.main_role,
                    secondary_role: player.secondary_role,
                    is_pending: true,
                })
                team.players.sort(playerSort)
            }
            return next
        })
    }

    // ─── Drag & Drop handlers ───
    const handleDragStart = (e, player, fromTeamId) => {
        setDraggedPlayer({ ...player, fromTeamId })
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', player.league_player_id || player.player_id)
    }

    const handlePoolDragStart = (e, player) => {
        setDraggedPlayer({ ...player, fromPool: true })
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', `pool-${player.player_id}`)
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

        // Pool drop: add player to team
        if (draggedPlayer.fromPool) {
            addPlayerToTeamPending(draggedPlayer, targetTeamId)
            setDraggedPlayer(null)
            return
        }

        if (String(draggedPlayer.team_id) === String(targetTeamId)) {
            setDraggedPlayer(null)
            return
        }

        const targetTeam = seasonTeams.find(t => String(t.team_id) === String(targetTeamId))

        setPendingChanges(prev => [...prev, {
            id: crypto.randomUUID(),
            type: 'transfer',
            league_player_id: draggedPlayer.league_player_id,
            new_team_id: parseInt(targetTeamId),
            description: `Transfer ${draggedPlayer.name} to ${targetTeam?.team_name}`,
        }])

        setLocalRosters(prev => {
            const next = structuredClone(prev)
            const fromTeam = next.find(t => String(t.team_id) === String(draggedPlayer.team_id))
            const toTeam = next.find(t => String(t.team_id) === String(targetTeamId))
            if (fromTeam && toTeam) {
                const idx = fromTeam.players.findIndex(p => p.league_player_id === draggedPlayer.league_player_id)
                if (idx >= 0) {
                    const [moved] = fromTeam.players.splice(idx, 1)
                    moved.team_id = targetTeamId
                    moved.roster_status = 'member'
                    toTeam.players.push(moved)
                    toTeam.players.sort(playerSort)
                }
            }
            return next
        })

        setDraggedPlayer(null)
    }

    // ─── Drop on player (swap, or pool add) ───
    const handleDropOnPlayer = (targetPlayer) => {
        if (!draggedPlayer) return

        if (draggedPlayer.fromPool) {
            addPlayerToTeamPending(draggedPlayer, targetPlayer.team_id)
            setDraggedPlayer(null)
            setDragOverPlayer(null)
            return
        }

        if (draggedPlayer.league_player_id === targetPlayer.league_player_id) return
        if (String(draggedPlayer.team_id) === String(targetPlayer.team_id)) return

        const targetTeam = seasonTeams.find(t => String(t.team_id) === String(targetPlayer.team_id))
        const fromTeam = seasonTeams.find(t => String(t.team_id) === String(draggedPlayer.team_id))

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
                    playerA.roster_status = 'member'
                    playerB.team_id = draggedPlayer.fromTeamId
                    playerB.roster_status = 'member'
                    teamA.players[idxA] = playerB
                    teamB.players[idxB] = playerA
                    teamA.players.sort(playerSort)
                    teamB.players.sort(playerSort)
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

    // ─── Set captain (pending) ───
    const handleSetCaptain = (leaguePlayerId, playerName, teamId) => {
        setPendingChanges(prev => [
            ...prev.filter(c => !(c.type === 'set-captain' && String(c.team_id) === String(teamId))),
            {
                id: crypto.randomUUID(),
                type: 'set-captain',
                league_player_id: leaguePlayerId,
                team_id: teamId,
                description: `Set ${playerName} as captain`,
            },
        ])

        setLocalRosters(prev => {
            const next = structuredClone(prev)
            const team = next.find(t => String(t.team_id) === String(teamId))
            if (team) {
                team.players.forEach(p => { if (p.roster_status === 'captain') p.roster_status = 'member' })
                const player = team.players.find(p => p.league_player_id === leaguePlayerId)
                if (player) player.roster_status = 'captain'
                team.players.sort(playerSort)
            }
            return next
        })
    }

    // ─── Remove pending add ───
    const handleRemovePendingAdd = (playerId, playerName) => {
        setPendingChanges(prev => prev.filter(c => !(c.type === 'add' && c.player_id === playerId)))
        setLocalRosters(prev => {
            const next = structuredClone(prev)
            for (const team of next) {
                team.players = team.players.filter(p => p.league_player_id !== `pending-${playerId}`)
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

    // ─── Promote sub to member ───
    const handlePromoteSub = (leaguePlayerId, playerName, teamName) => {
        setConfirmModal({
            title: 'Promote to Member',
            message: `Promote ${playerName} from Rule 0-Sub to a full member on ${teamName}?`,
            confirmLabel: 'Promote',
            confirmColor: 'green',
            onConfirm: async () => {
                setConfirmModal(null)
                try {
                    await rosterAction(`promote_${leaguePlayerId}`, {
                        action: 'promote-sub',
                        league_player_id: leaguePlayerId,
                    })
                    showToast('success', `${playerName} promoted to member`)
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
                let payload
                if (change.type === 'transfer') {
                    payload = { action: 'transfer-player', league_player_id: change.league_player_id, new_team_id: change.new_team_id }
                } else if (change.type === 'add') {
                    payload = { action: 'add-player-to-team', player_id: change.player_id, team_id: change.team_id, season_id: parseInt(selectedSeasonId), role: change.role }
                } else if (change.type === 'set-captain') {
                    payload = { action: 'set-captain', league_player_id: change.league_player_id }
                } else {
                    payload = { action: 'change-role', league_player_id: change.league_player_id, role: change.role }
                }

                const res = await fetch(`${API}/roster-manage`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
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
        <div className="max-w-7xl mx-auto pb-8 px-4">
            {/* Toast */}
            {toast && (
                <Toast toast={toast} onDismiss={() => setToast(null)} />
            )}

            {/* Confirmation Modal */}
            {confirmModal && (
                <ConfirmModal confirmModal={confirmModal} onClose={() => setConfirmModal(null)} />
            )}

            {/* Add Player Modal */}
            {addModal && (
                <AddPlayerModal
                    teamId={addModal.teamId}
                    teamName={addModal.teamName}
                    teamColor={addModal.teamColor}
                    seasonId={selectedSeasonId}
                    globalPlayers={globalPlayers}
                    leagueRosteredPlayerIds={leagueRosteredPlayerIds}
                    pendingChanges={pendingChanges}
                    onClose={() => setAddModal(null)}
                    onAddExisting={(player, role) => {
                        addPlayerToTeamPending(player, addModal.teamId, role)
                    }}
                    onCreateNew={async (name, role) => {
                        try {
                            const data = await rosterAction(`create_${name}`, {
                                action: 'create-and-add-player',
                                name,
                                team_id: addModal.teamId,
                                season_id: parseInt(selectedSeasonId),
                                role,
                                main_role: role?.toLowerCase(),
                            })
                            showToast('success', `${name} created and added to ${addModal.teamName}`)
                            return data
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

            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="font-heading text-2xl font-bold text-[var(--color-text)]">
                        Roster Manager
                    </h1>
                    <p className="text-[var(--color-text-secondary)] text-sm mt-1">
                        Drag players between teams to transfer · Click role to change · Manage your rosters
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {selectedSeasonId && (
                        <>
                            <button
                                onClick={() => setShowSubs(!showSubs)}
                                className={`px-3 py-1.5 rounded-lg text-xs transition-colors border ${
                                    showSubs
                                        ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border-[var(--color-accent)]/30'
                                        : 'bg-white/5 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/10 border-white/10'
                                }`}
                            >
                                Rule 0-Subs
                            </button>
                            <button
                                onClick={() => setShowPool(!showPool)}
                                className={`px-3 py-1.5 rounded-lg text-xs transition-colors border ${
                                    showPool
                                        ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border-[var(--color-accent)]/30'
                                        : 'bg-white/5 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/10 border-white/10'
                                }`}
                            >
                                Player Pool{poolPlayers.length > 0 ? ` (${poolPlayers.length})` : ''}
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => setShowMerge(true)}
                        className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/10 transition-colors border border-white/10"
                    >
                        Merge Players
                    </button>
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
                            showSubs={showSubs}
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
                            onSetCaptain={handleSetCaptain}
                            onDropPlayer={handleDropPlayer}
                            onPromoteSub={handlePromoteSub}
                            onRemovePendingAdd={handleRemovePendingAdd}
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
                <SaveBar
                    pendingChanges={pendingChanges}
                    saving={saving}
                    onDiscard={handleDiscard}
                    onSave={handleSave}
                />
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

            {/* Player Pool Panel */}
            {showPool && selectedSeasonId && (
                <PlayerPoolPanel
                    allPlayers={globalPlayers}
                    leagueRosteredPlayerIds={leagueRosteredPlayerIds}
                    pendingChanges={pendingChanges}
                    search={poolSearch}
                    onSearchChange={setPoolSearch}
                    onDragStart={handlePoolDragStart}
                    onDragEnd={handleDragEnd}
                    onClose={() => setShowPool(false)}
                />
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

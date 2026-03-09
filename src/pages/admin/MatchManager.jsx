// src/pages/admin/MatchManager.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MatchManagerHelp } from '../../components/admin/AdminHelp'
import BaseModal from '../../components/BaseModal'
import { getAuthHeaders } from '../../services/adminApi.js'
import { API, SEASON_KEY } from './match-manager/constants'
import MatchEditor from './match-manager/MatchEditor'

export default function MatchManager() {
    const { matchId: urlMatchId } = useParams()
    const navigate = useNavigate()
    const [adminData, setAdminData] = useState(null)
    const [adminLoading, setAdminLoading] = useState(true)
    const [selectedSeasonId, setSelectedSeasonId] = useState(() => {
        try { return parseInt(localStorage.getItem(SEASON_KEY)) || null }
        catch { return null }
    })

    const [matches, setMatches] = useState([])
    const [matchesLoading, setMatchesLoading] = useState(false)
    const [stageData, setStageData] = useState({ stages: [], groups: [], rounds: [] })
    const [selectedMatchIds, setSelectedMatchIds] = useState(new Set())
    const [bulkStage, setBulkStage] = useState({ stage_id: '', group_id: '', round_id: '' })
    const [bulkSaving, setBulkSaving] = useState(false)
    const [expandedMatchId, setExpandedMatchId] = useState(null)
    const [matchDetail, setMatchDetail] = useState(null)
    const [detailLoading, setDetailLoading] = useState(false)

    // Edit state — local copy of match detail being edited
    const [editData, setEditData] = useState(null)
    const [saving, setSaving] = useState({})

    const [toast, setToast] = useState(null)
    const [confirmModal, setConfirmModal] = useState(null)

    // ─── Fetch admin data (seasons, teams, players, gods) ───
    useEffect(() => {
        fetch(`${API}/admin-data`, { headers: getAuthHeaders() })
            .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
            .then(data => {
                setAdminData(data)
                if (!selectedSeasonId && data.seasons?.length) {
                    setSelectedSeasonId(data.seasons[0].season_id)
                }
            })
            .catch(() => {})
            .finally(() => setAdminLoading(false))
    }, [])

    // Persist season selection (shared with AdminDashboard)
    const handleSeasonChange = (id) => {
        const parsed = id ? parseInt(id) : null
        setSelectedSeasonId(parsed)
        if (parsed) localStorage.setItem(SEASON_KEY, String(parsed))
        else localStorage.removeItem(SEASON_KEY)
    }

    // ─── Fetch matches for season ───
    const fetchMatches = useCallback(async (seasonId) => {
        if (!seasonId) { setMatches([]); return }
        setMatchesLoading(true)
        try {
            const res = await fetch(`${API}/admin-match-manage?seasonId=${seasonId}`, { headers: getAuthHeaders() })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const data = await res.json()
            setMatches(data.matches || [])
        } catch {
            setMatches([])
        } finally {
            setMatchesLoading(false)
        }
    }, [])

    // ─── Fetch stage data for season ───
    const fetchStageData = useCallback(async (seasonId) => {
        if (!seasonId) { setStageData({ stages: [], groups: [], rounds: [] }); return }
        try {
            const res = await fetch(`${API}/stage-manage?seasonId=${seasonId}`, { headers: getAuthHeaders() })
            if (!res.ok) return
            const data = await res.json()
            setStageData({ stages: data.stages || [], groups: data.groups || [], rounds: data.rounds || [] })
        } catch {
            setStageData({ stages: [], groups: [], rounds: [] })
        }
    }, [])

    useEffect(() => {
        if (selectedSeasonId) {
            fetchMatches(selectedSeasonId)
            fetchStageData(selectedSeasonId)
        }
    }, [selectedSeasonId, fetchMatches, fetchStageData])

    // ─── Deep-link: auto-expand match from URL param ───
    const deepLinkHandled = useRef(false)
    useEffect(() => {
        if (!urlMatchId || !adminData || deepLinkHandled.current) return
        deepLinkHandled.current = true
        const id = parseInt(urlMatchId)
        if (!id) return
        ;(async () => {
            try {
                const res = await fetch(`${API}/admin-match-manage?matchId=${id}`, { headers: getAuthHeaders() })
                if (!res.ok) return
                const data = await res.json()
                if (data.season_id && data.season_id !== selectedSeasonId) {
                    handleSeasonChange(data.season_id)
                }
                setExpandedMatchId(id)
                setMatchDetail(data)
                setEditData(JSON.parse(JSON.stringify(data)))
            } catch {}
        })()
    }, [urlMatchId, adminData])

    // ─── Fetch match detail ───
    const fetchDetail = useCallback(async (matchId) => {
        setDetailLoading(true)
        try {
            const res = await fetch(`${API}/admin-match-manage?matchId=${matchId}`, { headers: getAuthHeaders() })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const data = await res.json()
            setMatchDetail(data)
            setEditData(JSON.parse(JSON.stringify(data))) // deep clone for editing
        } catch {
            setMatchDetail(null)
            setEditData(null)
        } finally {
            setDetailLoading(false)
        }
    }, [])

    const toggleMatch = useCallback((matchId) => {
        if (expandedMatchId === matchId) {
            setExpandedMatchId(null)
            setMatchDetail(null)
            setEditData(null)
            navigate('/admin/matches', { replace: true })
        } else {
            setExpandedMatchId(matchId)
            fetchDetail(matchId)
            navigate(`/admin/matches/${matchId}`, { replace: true })
        }
    }, [expandedMatchId, fetchDetail, navigate])

    // ─── Toast ───
    const showToast = useCallback((type, message) => {
        const id = Date.now()
        setToast({ type, message, id })
        setTimeout(() => setToast(prev => prev?.id === id ? null : prev), 4000)
    }, [])

    // ─── API action ───
    const doAction = useCallback(async (payload) => {
        const res = await fetch(`${API}/admin-match-manage`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
        return data
    }, [])

    // ─── Delete match ───
    const handleDeleteMatch = useCallback((matchId) => {
        setConfirmModal({
            title: 'Delete Match',
            message: 'This will permanently delete this match, all its games, and all player stats. This cannot be undone.',
            danger: true,
            onConfirm: async () => {
                setConfirmModal(null)
                try {
                    await doAction({ action: 'delete-match', match_id: matchId })
                    showToast('success', 'Match deleted')
                    setExpandedMatchId(null)
                    setMatchDetail(null)
                    setEditData(null)
                    fetchMatches(selectedSeasonId)
                } catch (err) {
                    showToast('error', err.message)
                }
            },
        })
    }, [doAction, showToast, fetchMatches, selectedSeasonId])

    // ─── Delete game ───
    const handleDeleteGame = useCallback((gameId, matchId) => {
        setConfirmModal({
            title: 'Delete Game',
            message: 'This will permanently delete this game and all its player stats.',
            danger: true,
            onConfirm: async () => {
                setConfirmModal(null)
                try {
                    await doAction({ action: 'delete-game', game_id: gameId, match_id: matchId })
                    showToast('success', 'Game deleted')
                    fetchDetail(matchId)
                    fetchMatches(selectedSeasonId)
                } catch (err) {
                    showToast('error', err.message)
                }
            },
        })
    }, [doAction, showToast, fetchDetail, fetchMatches, selectedSeasonId])

    // ─── Update match fields ───
    const handleUpdateMatch = useCallback(async (matchId, updates) => {
        setSaving(prev => ({ ...prev, match: true }))
        try {
            await doAction({ action: 'update-match', match_id: matchId, ...updates })
            showToast('success', 'Match updated')
            fetchDetail(matchId)
            fetchMatches(selectedSeasonId)
        } catch (err) {
            showToast('error', err.message)
        } finally {
            setSaving(prev => ({ ...prev, match: false }))
        }
    }, [doAction, showToast, fetchDetail, fetchMatches, selectedSeasonId])

    // ─── Bulk assign stage ───
    const handleBulkAssignStage = useCallback(async () => {
        if (selectedMatchIds.size === 0) return
        setBulkSaving(true)
        try {
            await doAction({
                action: 'bulk-assign-stage',
                match_ids: [...selectedMatchIds],
                stage_id: bulkStage.stage_id || null,
                group_id: bulkStage.group_id || null,
                round_id: bulkStage.round_id || null,
            })
            showToast('success', `${selectedMatchIds.size} match(es) assigned`)
            setSelectedMatchIds(new Set())
            setBulkStage({ stage_id: '', group_id: '', round_id: '' })
            fetchMatches(selectedSeasonId)
        } catch (err) {
            showToast('error', err.message)
        } finally {
            setBulkSaving(false)
        }
    }, [doAction, showToast, fetchMatches, selectedSeasonId, selectedMatchIds, bulkStage])

    // ─── Save game (bulk) ───
    const handleSaveGame = useCallback(async (gameId, matchId, game) => {
        setSaving(prev => ({ ...prev, [gameId]: true }))
        try {
            const players = [...(game.team1_players || []), ...(game.team2_players || [])].map(p => ({
                league_player_id: p.league_player_id,
                team_side: p.team_side,
                god_played: p.god_played,
                role_played: p.role_played || null,
                kills: p.kills || 0,
                deaths: p.deaths || 0,
                assists: p.assists || 0,
                damage: p.damage || null,
                mitigated: p.mitigated || null,
                gpm: p.gpm || null,
                structure_damage: p.structure_damage || null,
                self_healing: p.self_healing || null,
                ally_healing: p.ally_healing || null,
            }))

            await doAction({
                action: 'save-game',
                game_id: gameId,
                match_id: matchId,
                winner_team_id: game.winner_team_id,
                players,
            })
            showToast('success', `Game ${game.game_number} saved`)
            fetchDetail(matchId)
            fetchMatches(selectedSeasonId)
        } catch (err) {
            showToast('error', err.message)
        } finally {
            setSaving(prev => ({ ...prev, [gameId]: false }))
        }
    }, [doAction, showToast, fetchDetail, fetchMatches, selectedSeasonId])

    // ─── Transfer match ───
    const handleTransferMatch = useCallback(async (matchId, targetSeasonId) => {
        setSaving(prev => ({ ...prev, transfer: true }))
        try {
            await doAction({ action: 'transfer-match', match_id: matchId, target_season_id: targetSeasonId })
            showToast('success', 'Match transferred')
            setExpandedMatchId(null)
            setMatchDetail(null)
            setEditData(null)
            fetchMatches(selectedSeasonId)
        } catch (err) {
            showToast('error', err.message)
        } finally {
            setSaving(prev => ({ ...prev, transfer: false }))
        }
    }, [doAction, showToast, fetchMatches, selectedSeasonId])

    // ─── Edit helpers ───
    const updateEditGame = useCallback((gameIdx, updater) => {
        setEditData(prev => {
            if (!prev) return prev
            const games = [...prev.games]
            games[gameIdx] = typeof updater === 'function' ? updater(games[gameIdx]) : { ...games[gameIdx], ...updater }
            return { ...prev, games }
        })
    }, [])

    const updateEditPlayer = useCallback((gameIdx, side, playerIdx, updates) => {
        updateEditGame(gameIdx, game => {
            const key = side === 1 ? 'team1_players' : 'team2_players'
            const players = [...game[key]]
            players[playerIdx] = { ...players[playerIdx], ...updates }
            return { ...game, [key]: players }
        })
    }, [updateEditGame])

    // ─── Derived data ───
    const seasons = adminData?.seasons || []
    const teamsForSeason = adminData?.teams?.filter(t => String(t.season_id) === String(selectedSeasonId)) || []
    const gods = adminData?.gods || []

    if (adminLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-2 border-[var(--color-accent)] border-t-transparent mx-auto mb-4" />
                    <p className="text-[var(--color-text-secondary)]">Loading match data...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-7xl mx-auto pb-8 px-4">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-[100] max-w-sm px-4 py-3 rounded-lg shadow-xl border text-sm font-medium transition-all ${
                    toast.type === 'success' ? 'bg-green-500/15 border-green-500/30 text-green-400' : 'bg-red-500/15 border-red-500/30 text-red-400'
                }`}>
                    <div className="flex items-start gap-2">
                        <span className="shrink-0">{toast.type === 'success' ? '\u2713' : '\u2715'}</span>
                        <span>{toast.message}</span>
                        <button onClick={() => setToast(null)} className="ml-auto shrink-0 opacity-60 hover:opacity-100">{'\u2715'}</button>
                    </div>
                </div>
            )}

            {/* Confirm Modal */}
            {confirmModal && (
                <BaseModal onClose={() => setConfirmModal(null)} maxWidth="max-w-sm" className="p-6">
                        <h3 className="text-sm font-bold text-[var(--color-text)] mb-2">{confirmModal.title}</h3>
                        <p className="text-xs text-[var(--color-text-secondary)] mb-4">{confirmModal.message}</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setConfirmModal(null)}
                                    className="px-3 py-1.5 rounded-lg text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/5">
                                Cancel
                            </button>
                            <button onClick={confirmModal.onConfirm}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-white ${
                                        confirmModal.danger ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'
                                    }`}>
                                Confirm
                            </button>
                        </div>
                </BaseModal>
            )}

            <div className="mb-6">
                <h1 className="font-heading text-2xl font-bold text-[var(--color-text)]">Match Manager</h1>
                <p className="text-[var(--color-text-secondary)] text-sm mt-1">
                    Edit or delete existing matches, games, and player stats
                </p>
            </div>

            <MatchManagerHelp />

            {/* Season Selector */}
            <div className="bg-[var(--color-secondary)] border border-white/10 rounded-xl p-4 mb-6">
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Season</label>
                <select
                    value={selectedSeasonId || ''}
                    onChange={e => { handleSeasonChange(e.target.value); setExpandedMatchId(null); setMatchDetail(null); setEditData(null) }}
                    className="w-full max-w-md rounded-lg px-3 py-2 text-sm border"
                    style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.1)' }}
                >
                    <option value="">— Select Season —</option>
                    {seasons.map(s => (
                        <option key={s.season_id} value={s.season_id}>
                            {s.league_name} / {s.division_name} — {s.season_name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Bulk stage assignment bar */}
            {selectedMatchIds.size > 0 && stageData.stages.length > 0 && (
                <div className="sticky top-0 z-20 bg-violet-500/10 border border-violet-500/30 rounded-xl px-4 py-3 mb-4 flex flex-wrap items-center gap-3">
                    <span className="text-xs font-bold text-violet-300 shrink-0">{selectedMatchIds.size} selected</span>
                    <div>
                        <select value={bulkStage.stage_id || ''} onChange={e => setBulkStage({ stage_id: e.target.value ? parseInt(e.target.value) : '', group_id: '', round_id: '' })}
                                className="rounded px-2 py-1.5 text-xs border"
                                style={{ backgroundColor: 'var(--color-card)', color: 'var(--color-text)', borderColor: 'var(--color-border)', colorScheme: 'dark' }}>
                            <option value="" style={{ backgroundColor: '#1e1e2e', color: '#999' }}>— Stage —</option>
                            {stageData.stages.map(s => <option key={s.id} value={s.id} style={{ backgroundColor: '#1e1e2e', color: '#e0e0e0' }}>{s.name}</option>)}
                        </select>
                    </div>
                    {bulkStage.stage_id && stageData.groups.filter(g => String(g.stage_id) === String(bulkStage.stage_id)).length > 0 && (
                        <div>
                            <select value={bulkStage.group_id || ''} onChange={e => setBulkStage(p => ({ ...p, group_id: e.target.value ? parseInt(e.target.value) : '' }))}
                                    className="rounded px-2 py-1.5 text-xs border"
                                    style={{ backgroundColor: 'var(--color-card)', color: 'var(--color-text)', borderColor: 'var(--color-border)', colorScheme: 'dark' }}>
                                <option value="" style={{ backgroundColor: '#1e1e2e', color: '#999' }}>— Group —</option>
                                {stageData.groups.filter(g => String(g.stage_id) === String(bulkStage.stage_id)).map(g => <option key={g.id} value={g.id} style={{ backgroundColor: '#1e1e2e', color: '#e0e0e0' }}>{g.name}</option>)}
                            </select>
                        </div>
                    )}
                    {bulkStage.stage_id && stageData.rounds.filter(r => String(r.stage_id) === String(bulkStage.stage_id)).length > 0 && (
                        <div>
                            <select value={bulkStage.round_id || ''} onChange={e => setBulkStage(p => ({ ...p, round_id: e.target.value ? parseInt(e.target.value) : '' }))}
                                    className="rounded px-2 py-1.5 text-xs border"
                                    style={{ backgroundColor: 'var(--color-card)', color: 'var(--color-text)', borderColor: 'var(--color-border)', colorScheme: 'dark' }}>
                                <option value="" style={{ backgroundColor: '#1e1e2e', color: '#999' }}>— Round —</option>
                                {stageData.rounds.filter(r => String(r.stage_id) === String(bulkStage.stage_id)).map(r => <option key={r.id} value={r.id} style={{ backgroundColor: '#1e1e2e', color: '#e0e0e0' }}>{r.name}</option>)}
                            </select>
                        </div>
                    )}
                    <button onClick={handleBulkAssignStage} disabled={bulkSaving}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50">
                        {bulkSaving ? 'Assigning...' : 'Assign Stage'}
                    </button>
                    <button onClick={() => { setSelectedMatchIds(new Set()); setBulkStage({ stage_id: '', group_id: '', round_id: '' }) }}
                            className="px-2 py-1.5 rounded-lg text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
                        Clear
                    </button>
                    <button onClick={() => setSelectedMatchIds(new Set(matches.map(m => m.id)))}
                            className="px-2 py-1.5 rounded-lg text-xs text-violet-400 hover:text-violet-300 ml-auto">
                        Select All
                    </button>
                </div>
            )}

            {/* Match List */}
            {matchesLoading ? (
                <p className="text-sm text-[var(--color-text-secondary)]">Loading matches...</p>
            ) : matches.length === 0 && selectedSeasonId ? (
                <p className="text-sm text-[var(--color-text-secondary)]">No matches found for this season.</p>
            ) : (
                <div className="space-y-2">
                    {matches.map(m => (
                        <div key={m.id} ref={expandedMatchId === m.id ? (el) => { if (el && urlMatchId) el.scrollIntoView({ behavior: 'smooth', block: 'start' }) } : undefined} className={`border rounded-lg ${selectedMatchIds.has(m.id) ? 'border-violet-500/40 bg-violet-500/5' : 'border-[var(--color-border)]'}`}>
                            {/* Match row */}
                            <div className="flex items-center">
                                {stageData.stages.length > 0 && (
                                    <label className="pl-3 pr-1 py-3 flex items-center cursor-pointer shrink-0" onClick={e => e.stopPropagation()}>
                                        <input type="checkbox" checked={selectedMatchIds.has(m.id)}
                                            onChange={e => {
                                                setSelectedMatchIds(prev => {
                                                    const next = new Set(prev)
                                                    if (e.target.checked) next.add(m.id)
                                                    else next.delete(m.id)
                                                    return next
                                                })
                                            }}
                                            className="w-3.5 h-3.5 rounded accent-violet-500 cursor-pointer" />
                                    </label>
                                )}
                            <button
                                onClick={() => toggleMatch(m.id)}
                                className="w-full text-left px-4 py-3 flex items-center gap-4 hover:bg-white/5 transition-colors"
                            >
                                <span className="text-xs text-[var(--color-text-secondary)] tabular-nums shrink-0 font-mono opacity-50 w-8 text-right">#{m.id}</span>
                                <span className="text-xs text-[var(--color-text-secondary)] tabular-nums w-20 shrink-0">
                                    {m.date ? m.date.slice(0, 10) : 'No date'}
                                </span>
                                {m.stage_name && <span className="text-[10px] text-violet-400 font-medium shrink-0">{m.stage_name}{m.round_name ? ` / ${m.round_name}` : ''}</span>}
                                {m.week && <span className="text-xs text-[var(--color-text-secondary)] shrink-0">W{m.week}</span>}
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: m.team1_color || '#3b82f6' }} />
                                    <span className={`text-sm ${m.winner_team_id === m.team1_id ? 'text-[var(--color-text)] font-semibold' : 'text-[var(--color-text-secondary)]'}`}>
                                        {m.team1_name}
                                    </span>
                                    <span className="text-xs text-[var(--color-text-secondary)]">vs</span>
                                    <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: m.team2_color || '#ef4444' }} />
                                    <span className={`text-sm ${m.winner_team_id === m.team2_id ? 'text-[var(--color-text)] font-semibold' : 'text-[var(--color-text-secondary)]'}`}>
                                        {m.team2_name}
                                    </span>
                                </div>
                                <span className="text-xs text-[var(--color-text-secondary)] shrink-0">{m.game_count} game{m.game_count !== 1 ? 's' : ''}</span>
                                <span className="text-[var(--color-text-secondary)] text-sm">{expandedMatchId === m.id ? '\u25B2' : '\u25BC'}</span>
                            </button>
                            </div>

                            {/* Expanded detail */}
                            {expandedMatchId === m.id && (
                                <div className="border-t border-[var(--color-border)]">
                                    {detailLoading ? (
                                        <p className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">Loading detail...</p>
                                    ) : editData ? (
                                        <MatchEditor
                                            editData={editData}
                                            teamsForSeason={teamsForSeason}
                                            gods={gods}
                                            adminData={adminData}
                                            saving={saving}
                                            seasons={seasons}
                                            selectedSeasonId={selectedSeasonId}
                                            stageData={stageData}
                                            onUpdateMatch={(updates) => handleUpdateMatch(m.id, updates)}
                                            onSaveGame={(gameId, game) => handleSaveGame(gameId, m.id, game)}
                                            onDeleteGame={(gameId) => handleDeleteGame(gameId, m.id)}
                                            onDeleteMatch={() => handleDeleteMatch(m.id)}
                                            onTransferMatch={(targetSeasonId) => handleTransferMatch(m.id, targetSeasonId)}
                                            onEditGame={updateEditGame}
                                            onEditPlayer={updateEditPlayer}
                                        />
                                    ) : null}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// src/pages/admin/MatchManager.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Home } from 'lucide-react'
import { MatchManagerHelp } from '../../components/admin/AdminHelp'
import { getAuthHeaders } from '../../services/adminApi.js'

const API = import.meta.env.VITE_API_URL || '/api'
const SEASON_KEY = 'smite2_admin_season'

export default function MatchManager() {
    const [adminData, setAdminData] = useState(null)
    const [adminLoading, setAdminLoading] = useState(true)
    const [selectedSeasonId, setSelectedSeasonId] = useState(() => {
        try { return parseInt(localStorage.getItem(SEASON_KEY)) || null }
        catch { return null }
    })

    const [matches, setMatches] = useState([])
    const [matchesLoading, setMatchesLoading] = useState(false)
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

    useEffect(() => {
        if (selectedSeasonId) fetchMatches(selectedSeasonId)
    }, [selectedSeasonId, fetchMatches])

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
        } else {
            setExpandedMatchId(matchId)
            fetchDetail(matchId)
        }
    }, [expandedMatchId, fetchDetail])

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

    // ─── Save game (bulk) ───
    const handleSaveGame = useCallback(async (gameId, matchId, game) => {
        setSaving(prev => ({ ...prev, [gameId]: true }))
        try {
            const players = [...(game.team1_players || []), ...(game.team2_players || [])].map(p => ({
                league_player_id: p.league_player_id,
                team_side: p.team_side,
                god_played: p.god_played,
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
        <div className="max-w-7xl mx-auto py-8 px-4">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-[100] max-w-sm px-4 py-3 rounded-lg shadow-xl border text-sm font-medium transition-all ${
                    toast.type === 'success' ? 'bg-green-500/15 border-green-500/30 text-green-400' : 'bg-red-500/15 border-red-500/30 text-red-400'
                }`}>
                    <div className="flex items-start gap-2">
                        <span className="shrink-0">{toast.type === 'success' ? '\u2713' : '\u2715'}</span>
                        <span>{toast.message}</span>
                        <button onClick={() => setToast(null)} className="ml-auto shrink-0 opacity-60 hover:opacity-100">\u2715</button>
                    </div>
                </div>
            )}

            {/* Confirm Modal */}
            {confirmModal && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
                    <div className="rounded-xl border border-white/10 shadow-2xl max-w-sm w-full p-6" style={{ backgroundColor: 'var(--color-secondary)' }}>
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
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <p className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">
                        <Link to="/admin" className="hover:text-[var(--color-accent)] transition-colors">Admin</Link>
                    </p>
                    <h1 className="font-heading text-2xl font-bold text-[var(--color-text)]">Match Manager</h1>
                    <p className="text-[var(--color-text-secondary)] text-sm mt-1">
                        Edit or delete existing matches, games, and player stats
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
                    <Link to="/admin/players" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors">
                        Players
                    </Link>
                    <Link to="/admin/leagues" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors">
                        Leagues
                    </Link>
                    <Link to="/" className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-white/5 transition-colors" title="Home">
                        <Home className="w-4 h-4" />
                    </Link>
                </div>
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

            {/* Match List */}
            {matchesLoading ? (
                <p className="text-sm text-[var(--color-text-secondary)]">Loading matches...</p>
            ) : matches.length === 0 && selectedSeasonId ? (
                <p className="text-sm text-[var(--color-text-secondary)]">No matches found for this season.</p>
            ) : (
                <div className="space-y-2">
                    {matches.map(m => (
                        <div key={m.id} className="border border-[var(--color-border)] rounded-lg">
                            {/* Match row */}
                            <button
                                onClick={() => toggleMatch(m.id)}
                                className="w-full text-left px-4 py-3 flex items-center gap-4 hover:bg-white/5 transition-colors"
                            >
                                <span className="text-xs text-[var(--color-text-secondary)] tabular-nums w-20 shrink-0">
                                    {m.date ? m.date.slice(0, 10) : 'No date'}
                                </span>
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
                                            onUpdateMatch={(updates) => handleUpdateMatch(m.id, updates)}
                                            onSaveGame={(gameId, game) => handleSaveGame(gameId, m.id, game)}
                                            onDeleteGame={(gameId) => handleDeleteGame(gameId, m.id)}
                                            onDeleteMatch={() => handleDeleteMatch(m.id)}
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


// ═══════════════════════════════════════════════════
// MATCH EDITOR (expanded detail)
// ═══════════════════════════════════════════════════
function MatchEditor({ editData, teamsForSeason, gods, adminData, saving, onUpdateMatch, onSaveGame, onDeleteGame, onDeleteMatch, onEditGame, onEditPlayer }) {
    const [activeGame, setActiveGame] = useState(0)
    const [matchFields, setMatchFields] = useState({
        date: editData.date ? editData.date.slice(0, 10) : '',
        week: editData.week || '',
        team1_id: editData.team1_id,
        team2_id: editData.team2_id,
    })

    const matchDirty = matchFields.date !== (editData.date || '') ||
        String(matchFields.week || '') !== String(editData.week || '') ||
        String(matchFields.team1_id) !== String(editData.team1_id) ||
        String(matchFields.team2_id) !== String(editData.team2_id)

    return (
        <div className="bg-[var(--color-card)]/30">
            {/* Match-level fields */}
            <div className="px-4 py-3 flex flex-wrap items-end gap-3 border-b border-[var(--color-border)]">
                <div>
                    <label className="block text-[10px] text-[var(--color-text-secondary)] mb-0.5">Date</label>
                    <input type="date" value={matchFields.date || ''} onChange={e => setMatchFields(p => ({ ...p, date: e.target.value }))}
                           className="rounded px-2 py-1.5 text-xs border"
                           style={{ backgroundColor: 'var(--color-card)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }} />
                </div>
                <div>
                    <label className="block text-[10px] text-[var(--color-text-secondary)] mb-0.5">Week</label>
                    <input type="number" value={matchFields.week || ''} onChange={e => setMatchFields(p => ({ ...p, week: e.target.value }))}
                           className="rounded px-2 py-1.5 text-xs border w-16"
                           style={{ backgroundColor: 'var(--color-card)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }} />
                </div>
                <div>
                    <label className="block text-[10px] text-[var(--color-text-secondary)] mb-0.5">Team 1</label>
                    <select value={matchFields.team1_id || ''} onChange={e => setMatchFields(p => ({ ...p, team1_id: parseInt(e.target.value) }))}
                            className="rounded px-2 py-1.5 text-xs border"
                            style={{ backgroundColor: 'var(--color-card)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}>
                        {teamsForSeason.map(t => <option key={t.team_id} value={t.team_id}>{t.team_name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] text-[var(--color-text-secondary)] mb-0.5">Team 2</label>
                    <select value={matchFields.team2_id || ''} onChange={e => setMatchFields(p => ({ ...p, team2_id: parseInt(e.target.value) }))}
                            className="rounded px-2 py-1.5 text-xs border"
                            style={{ backgroundColor: 'var(--color-card)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}>
                        {teamsForSeason.filter(t => t.team_id !== matchFields.team1_id).map(t => <option key={t.team_id} value={t.team_id}>{t.team_name}</option>)}
                    </select>
                </div>
                {matchDirty && (
                    <button onClick={() => onUpdateMatch(matchFields)} disabled={saving.match}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50">
                        {saving.match ? 'Saving...' : 'Save Match Info'}
                    </button>
                )}
                <div className="ml-auto">
                    <button onClick={onDeleteMatch}
                            className="px-3 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-500/10 border border-red-500/20">
                        Delete Match
                    </button>
                </div>
            </div>

            {/* Game tabs */}
            <div className="px-4 pt-3">
                <div className="flex gap-1">
                    {editData.games.map((game, idx) => (
                        <button key={game.id} onClick={() => setActiveGame(idx)}
                                className={`px-3 py-1.5 text-xs rounded-t transition-colors ${
                                    activeGame === idx
                                        ? 'bg-[var(--color-card)] text-[var(--color-text)] border border-b-0 border-[var(--color-border)]'
                                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                                }`}>
                            Game {game.game_number}
                        </button>
                    ))}
                </div>
            </div>

            {/* Active game */}
            {editData.games[activeGame] && (
                <GameBlock
                    game={editData.games[activeGame]}
                    gameIdx={activeGame}
                    matchId={editData.id}
                    team1_id={editData.team1_id}
                    team2_id={editData.team2_id}
                    team1_name={editData.team1_name}
                    team2_name={editData.team2_name}
                    team1_color={editData.team1_color}
                    team2_color={editData.team2_color}
                    gods={gods}
                    adminData={adminData}
                    saving={saving[editData.games[activeGame].id]}
                    onSave={() => onSaveGame(editData.games[activeGame].id, editData.games[activeGame])}
                    onDelete={() => onDeleteGame(editData.games[activeGame].id)}
                    onEditGame={(updater) => onEditGame(activeGame, updater)}
                    onEditPlayer={(side, playerIdx, updates) => onEditPlayer(activeGame, side, playerIdx, updates)}
                />
            )}
        </div>
    )
}


// ═══════════════════════════════════════════════════
// GAME BLOCK (single game editor)
// ═══════════════════════════════════════════════════
function GameBlock({ game, gameIdx, matchId, team1_id, team2_id, team1_name, team2_name, team1_color, team2_color, gods, adminData, saving, onSave, onDelete, onEditGame, onEditPlayer }) {
    return (
        <div className="border-t border-[var(--color-border)]">
            {/* Winner + actions */}
            <div className="px-4 py-3 flex items-center gap-4 bg-[var(--color-card)]/50">
                <span className="text-xs text-[var(--color-text-secondary)] font-medium">Winner:</span>
                <div className="flex gap-2">
                    <WinnerBtn label={team1_name} color={team1_color || '#3b82f6'}
                               isActive={game.winner_team_id === team1_id}
                               onClick={() => onEditGame({ winner_team_id: team1_id })} />
                    <WinnerBtn label={team2_name} color={team2_color || '#ef4444'}
                               isActive={game.winner_team_id === team2_id}
                               onClick={() => onEditGame({ winner_team_id: team2_id })} />
                </div>
                <div className="ml-auto flex gap-2">
                    <button onClick={onSave} disabled={saving}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-green-600 hover:bg-green-500 disabled:opacity-50">
                        {saving ? 'Saving...' : 'Save Game'}
                    </button>
                    <button onClick={onDelete}
                            className="px-3 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-500/10 border border-red-500/20">
                        Delete Game
                    </button>
                </div>
            </div>

            {/* Player tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[var(--color-border)]">
                <StatsTable
                    label={team1_name}
                    color={team1_color || '#3b82f6'}
                    players={game.team1_players || []}
                    teamSide={1}
                    gods={gods}
                    adminData={adminData}
                    onUpdate={(idx, updates) => onEditPlayer(1, idx, updates)}
                    isWinner={game.winner_team_id === team1_id}
                />
                <StatsTable
                    label={team2_name}
                    color={team2_color || '#ef4444'}
                    players={game.team2_players || []}
                    teamSide={2}
                    gods={gods}
                    adminData={adminData}
                    onUpdate={(idx, updates) => onEditPlayer(2, idx, updates)}
                    isWinner={game.winner_team_id === team2_id}
                />
            </div>
        </div>
    )
}


// ═══════════════════════════════════════════════════
// STATS TABLE (one side of a game)
// ═══════════════════════════════════════════════════
function StatsTable({ label, color, players, teamSide, gods, adminData, onUpdate, isWinner }) {
    return (
        <div className="p-3">
            <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                <span className={`text-xs font-bold ${isWinner ? 'text-[var(--color-text)]' : 'text-[var(--color-text-secondary)]'}`}>
                    {label} {isWinner && '\u2714'}
                </span>
            </div>
            <div>
                <table className="w-full text-xs">
                    <thead>
                        <tr className="text-[var(--color-text-secondary)] text-[10px]">
                            <th className="text-left py-1 pr-2 min-w-[90px]">Player</th>
                            <th className="text-left py-1 pr-2 min-w-[90px]">God</th>
                            <th className="text-center py-1 px-1 w-10">K</th>
                            <th className="text-center py-1 px-1 w-10">D</th>
                            <th className="text-center py-1 px-1 w-10">A</th>
                            <th className="text-right py-1 px-1 w-14">Dmg</th>
                            <th className="text-right py-1 px-1 w-14">Mit</th>
                        </tr>
                    </thead>
                    <tbody>
                        {players.map((player, idx) => (
                            <StatRow key={player.stat_id || idx}
                                     player={player}
                                     gods={gods}
                                     adminData={adminData}
                                     onChange={(updates) => onUpdate(idx, updates)} />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}


// ═══════════════════════════════════════════════════
// STAT ROW (single player in a game)
// ═══════════════════════════════════════════════════
function StatRow({ player, gods, adminData, onChange }) {
    return (
        <tr className="border-t border-[var(--color-border)]/30">
            <td className="py-1.5 pr-2">
                <PlayerSwap player={player} adminData={adminData} onChange={onChange} />
            </td>
            <td className="py-1.5 pr-2">
                <GodAutocomplete value={player.god_played || ''} gods={gods} onChange={updates => onChange(updates)} />
            </td>
            <NumInput value={player.kills} onChange={v => onChange({ kills: v })} />
            <NumInput value={player.deaths} onChange={v => onChange({ deaths: v })} />
            <NumInput value={player.assists} onChange={v => onChange({ assists: v })} />
            <NumInput value={player.damage} onChange={v => onChange({ damage: v })} align="right" />
            <NumInput value={player.mitigated} onChange={v => onChange({ mitigated: v })} align="right" />
        </tr>
    )
}


// ═══════════════════════════════════════════════════
// PLAYER SWAP (click player name to change to different player)
// ═══════════════════════════════════════════════════
function PlayerSwap({ player, adminData, onChange }) {
    const [showSearch, setShowSearch] = useState(false)
    const [query, setQuery] = useState('')
    const containerRef = useRef(null)
    const inputRef = useRef(null)

    useEffect(() => {
        if (!showSearch) return
        const handler = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) setShowSearch(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [showSearch])

    const results = (() => {
        if (!showSearch || !adminData) return []
        const q = query.trim().toLowerCase()
        if (q.length < 2) return []
        const out = []
        const seen = new Set()

        for (const p of (adminData.players || [])) {
            if (seen.has(p.league_player_id)) continue
            if (p.name.toLowerCase().includes(q)) {
                seen.add(p.league_player_id)
                out.push(p)
            }
        }
        return out.slice(0, 12)
    })()

    return (
        <div className="relative" ref={containerRef}>
            {showSearch ? (
                <input ref={inputRef} type="text" value={query} autoFocus
                       onChange={e => setQuery(e.target.value)}
                       onKeyDown={e => { if (e.key === 'Escape') setShowSearch(false) }}
                       className="bg-transparent border-b border-[var(--color-accent)] outline-none w-full text-xs text-[var(--color-text)]"
                       placeholder="Search player..." />
            ) : (
                <button onClick={() => { setShowSearch(true); setQuery('') }}
                        className="text-xs text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors text-left w-full truncate">
                    {player.player_name}
                </button>
            )}

            {showSearch && results.length > 0 && (
                <div className="absolute z-50 top-full left-0 mt-1 w-64 border rounded shadow-xl max-h-48 overflow-y-auto"
                     style={{ backgroundColor: 'var(--color-card, #1e1e2e)', borderColor: 'var(--color-border, #333)' }}>
                    {results.map((r, i) => (
                        <button key={`${r.league_player_id}_${i}`}
                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--color-accent)]/10 flex items-center gap-2 transition-colors"
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => {
                                    onChange({
                                        player_name: r.name,
                                        player_id: r.player_id,
                                        league_player_id: r.league_player_id,
                                    })
                                    setShowSearch(false)
                                }}>
                            {r.team_color && <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: r.team_color }} />}
                            <span>{r.name}</span>
                            {r.role && <span className="text-[10px] text-[var(--color-text-secondary)] opacity-60">{r.role}</span>}
                            {r.team_name && <span className="text-[var(--color-text-secondary)] ml-auto text-[10px]">{r.team_name}</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}


// ═══════════════════════════════════════════════════
// GOD AUTOCOMPLETE (same as AdminDashboard version)
// ═══════════════════════════════════════════════════
function GodAutocomplete({ value, gods, onChange }) {
    const [showDropdown, setShowDropdown] = useState(false)
    const [query, setQuery] = useState('')
    const containerRef = useRef(null)
    const inputRef = useRef(null)

    useEffect(() => {
        if (!showDropdown) return
        const handler = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) setShowDropdown(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [showDropdown])

    const filtered = (() => {
        if (!showDropdown || !gods?.length) return []
        const q = query.trim().toLowerCase()
        if (!q) return gods
        return gods.filter(g => g.name.toLowerCase().includes(q))
    })()

    const currentGod = gods?.find(g => g.name.toLowerCase() === (value || '').toLowerCase())

    return (
        <div className="relative" ref={containerRef}>
            <div className="flex items-center gap-1">
                {currentGod?.image_url && !showDropdown && (
                    <img src={currentGod.image_url} alt="" className="w-4 h-4 rounded-sm shrink-0 object-cover" />
                )}
                <input ref={inputRef} type="text"
                       value={showDropdown ? query : (value || '')}
                       onChange={e => { setQuery(e.target.value); setShowDropdown(true) }}
                       onFocus={() => { setQuery(value || ''); setShowDropdown(true) }}
                       onKeyDown={e => {
                           if (e.key === 'Escape') { setShowDropdown(false); inputRef.current?.blur() }
                           if (e.key === 'Tab') setShowDropdown(false)
                       }}
                       className="bg-transparent border-b border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-accent)] outline-none w-full text-xs text-[var(--color-text)] transition-colors" />
            </div>

            {showDropdown && filtered.length > 0 && (
                <div className="absolute z-50 top-full left-0 mt-1 w-56 border rounded shadow-xl max-h-56 overflow-y-auto"
                     style={{ backgroundColor: 'var(--color-card, #1e1e2e)', borderColor: 'var(--color-border, #333)' }}>
                    {query === '' && (
                        <div className="px-3 py-1.5 text-[10px] text-[var(--color-text-secondary)] border-b border-[var(--color-border)]/50 sticky top-0"
                             style={{ backgroundColor: 'var(--color-card, #1e1e2e)' }}>
                            All gods — type to filter
                        </div>
                    )}
                    {filtered.map(god => (
                        <button key={god.id}
                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--color-accent)]/10 flex items-center gap-2 transition-colors"
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => {
                                    onChange({ god_played: god.name })
                                    setShowDropdown(false)
                                    setQuery('')
                                }}>
                            {god.image_url && <img src={god.image_url} alt="" className="w-5 h-5 rounded-sm shrink-0 object-cover" />}
                            <span className="text-[var(--color-text)]">{god.name}</span>
                        </button>
                    ))}
                </div>
            )}

            {showDropdown && query.length >= 2 && filtered.length === 0 && (
                <div className="absolute z-50 top-full left-0 mt-1 w-48 border rounded shadow-lg px-3 py-2 text-[10px] text-[var(--color-text-secondary)]"
                     style={{ backgroundColor: 'var(--color-card, #1e1e2e)', borderColor: 'var(--color-border, #333)' }}>
                    No gods found for "{query}"
                </div>
            )}
        </div>
    )
}


// ═══════════════════════════════════════════════════
// SMALL COMPONENTS
// ═══════════════════════════════════════════════════

function NumInput({ value, onChange, align = 'center' }) {
    return (
        <td className="py-1.5 px-1">
            <input type="number" value={value ?? ''} onChange={e => onChange(e.target.value === '' ? 0 : parseInt(e.target.value))}
                   className={`bg-transparent border-b border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-accent)] outline-none w-full text-xs text-[var(--color-text)] tabular-nums text-${align} transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`} />
        </td>
    )
}

function WinnerBtn({ label, color, isActive, onClick }) {
    return (
        <button onClick={onClick}
                className={`px-3 py-1 text-xs rounded transition-all ${
                    isActive
                        ? 'text-white ring-1 ring-white/30 font-semibold'
                        : 'bg-[var(--color-card)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-white/30'
                }`}
                style={isActive ? { backgroundColor: color } : undefined}>
            {label}
        </button>
    )
}

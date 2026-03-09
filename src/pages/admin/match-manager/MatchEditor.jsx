import { useState } from 'react'
import GameBlock from './GameBlock'

export default function MatchEditor({ editData, teamsForSeason, gods, adminData, saving, seasons, selectedSeasonId, stageData, onUpdateMatch, onSaveGame, onDeleteGame, onDeleteMatch, onTransferMatch, onEditGame, onEditPlayer }) {
    const [activeGame, setActiveGame] = useState(0)
    const [transferOpen, setTransferOpen] = useState(false)
    const [transferTarget, setTransferTarget] = useState('')
    const [matchFields, setMatchFields] = useState({
        date: editData.date ? editData.date.slice(0, 10) : '',
        week: editData.week || '',
        team1_id: editData.team1_id,
        team2_id: editData.team2_id,
        stage_id: editData.stage_id || '',
        group_id: editData.group_id || '',
        round_id: editData.round_id || '',
    })

    const filteredGroups = stageData.groups.filter(g => String(g.stage_id) === String(matchFields.stage_id))
    const filteredRounds = stageData.rounds.filter(r => String(r.stage_id) === String(matchFields.stage_id))

    const matchDirty = matchFields.date !== (editData.date || '') ||
        String(matchFields.week || '') !== String(editData.week || '') ||
        String(matchFields.team1_id) !== String(editData.team1_id) ||
        String(matchFields.team2_id) !== String(editData.team2_id) ||
        String(matchFields.stage_id || '') !== String(editData.stage_id || '') ||
        String(matchFields.group_id || '') !== String(editData.group_id || '') ||
        String(matchFields.round_id || '') !== String(editData.round_id || '')

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
                            style={{ backgroundColor: 'var(--color-card)', color: 'var(--color-text)', borderColor: 'var(--color-border)', colorScheme: 'dark' }}>
                        {teamsForSeason.map(t => <option key={t.team_id} value={t.team_id} style={{ backgroundColor: '#1e1e2e', color: '#e0e0e0' }}>{t.team_name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] text-[var(--color-text-secondary)] mb-0.5">Team 2</label>
                    <select value={matchFields.team2_id || ''} onChange={e => setMatchFields(p => ({ ...p, team2_id: parseInt(e.target.value) }))}
                            className="rounded px-2 py-1.5 text-xs border"
                            style={{ backgroundColor: 'var(--color-card)', color: 'var(--color-text)', borderColor: 'var(--color-border)', colorScheme: 'dark' }}>
                        {teamsForSeason.filter(t => t.team_id !== matchFields.team1_id).map(t => <option key={t.team_id} value={t.team_id} style={{ backgroundColor: '#1e1e2e', color: '#e0e0e0' }}>{t.team_name}</option>)}
                    </select>
                </div>
                {stageData.stages.length > 0 && (
                    <>
                        <div className="w-px h-6 bg-[var(--color-border)] self-center" />
                        <div>
                            <label className="block text-[10px] text-[var(--color-text-secondary)] mb-0.5">Stage</label>
                            <select value={matchFields.stage_id || ''} onChange={e => setMatchFields(p => ({ ...p, stage_id: e.target.value ? parseInt(e.target.value) : '', group_id: '', round_id: '' }))}
                                    className="rounded px-2 py-1.5 text-xs border"
                                    style={{ backgroundColor: 'var(--color-card)', color: 'var(--color-text)', borderColor: 'var(--color-border)', colorScheme: 'dark' }}>
                                <option value="" style={{ backgroundColor: '#1e1e2e', color: '#999' }}>— None —</option>
                                {stageData.stages.map(s => <option key={s.id} value={s.id} style={{ backgroundColor: '#1e1e2e', color: '#e0e0e0' }}>{s.name}</option>)}
                            </select>
                        </div>
                        {matchFields.stage_id && filteredGroups.length > 0 && (
                            <div>
                                <label className="block text-[10px] text-[var(--color-text-secondary)] mb-0.5">Group</label>
                                <select value={matchFields.group_id || ''} onChange={e => setMatchFields(p => ({ ...p, group_id: e.target.value ? parseInt(e.target.value) : '' }))}
                                        className="rounded px-2 py-1.5 text-xs border"
                                        style={{ backgroundColor: 'var(--color-card)', color: 'var(--color-text)', borderColor: 'var(--color-border)', colorScheme: 'dark' }}>
                                    <option value="" style={{ backgroundColor: '#1e1e2e', color: '#999' }}>— None —</option>
                                    {filteredGroups.map(g => <option key={g.id} value={g.id} style={{ backgroundColor: '#1e1e2e', color: '#e0e0e0' }}>{g.name}</option>)}
                                </select>
                            </div>
                        )}
                        {matchFields.stage_id && filteredRounds.length > 0 && (
                            <div>
                                <label className="block text-[10px] text-[var(--color-text-secondary)] mb-0.5">Round</label>
                                <select value={matchFields.round_id || ''} onChange={e => setMatchFields(p => ({ ...p, round_id: e.target.value ? parseInt(e.target.value) : '' }))}
                                        className="rounded px-2 py-1.5 text-xs border"
                                        style={{ backgroundColor: 'var(--color-card)', color: 'var(--color-text)', borderColor: 'var(--color-border)', colorScheme: 'dark' }}>
                                    <option value="" style={{ backgroundColor: '#1e1e2e', color: '#999' }}>— None —</option>
                                    {filteredRounds.map(r => <option key={r.id} value={r.id} style={{ backgroundColor: '#1e1e2e', color: '#e0e0e0' }}>{r.name}</option>)}
                                </select>
                            </div>
                        )}
                    </>
                )}
                {matchDirty && (
                    <button onClick={() => onUpdateMatch(matchFields)} disabled={saving.match}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50">
                        {saving.match ? 'Saving...' : 'Save Match Info'}
                    </button>
                )}
                <div className="ml-auto flex items-center gap-2">
                    {transferOpen ? (
                        <div className="flex items-center gap-2">
                            <select value={transferTarget} onChange={e => setTransferTarget(e.target.value)}
                                    className="rounded px-2 py-1.5 text-xs border"
                                    style={{ backgroundColor: 'var(--color-card)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}>
                                <option value="">— Target Season —</option>
                                {seasons.filter(s => s.season_id !== selectedSeasonId).map(s => (
                                    <option key={s.season_id} value={s.season_id}>
                                        {s.league_name} / {s.division_name} — {s.season_name}
                                    </option>
                                ))}
                            </select>
                            <button onClick={() => { if (transferTarget) onTransferMatch(parseInt(transferTarget)) }}
                                    disabled={!transferTarget || saving.transfer}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50">
                                {saving.transfer ? 'Transferring...' : 'Confirm'}
                            </button>
                            <button onClick={() => { setTransferOpen(false); setTransferTarget('') }}
                                    className="px-2 py-1.5 rounded-lg text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
                                Cancel
                            </button>
                        </div>
                    ) : (
                        <button onClick={() => setTransferOpen(true)}
                                className="px-3 py-1.5 rounded-lg text-xs text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20">
                            Transfer
                        </button>
                    )}
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
                            Game {game.game_number} <span className="opacity-40">#{game.id}</span>
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

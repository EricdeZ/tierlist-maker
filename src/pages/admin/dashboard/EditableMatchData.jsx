import { useState } from 'react'
import { FieldSelect, FieldInput, WinnerButton } from './FormControls'
import { PlayerTable } from './PlayerTable'


// ═══════════════════════════════════════════════════
// GAME EDITOR (winner + player tables)
// ═══════════════════════════════════════════════════
function GameEditor({ game, team1, team2, seasonId, adminData, onChange }) {
    const updatePlayer = (side, playerIdx, updates) => {
        const key = side === 'left' ? 'left_players' : 'right_players'
        onChange(prev => {
            const players = [...prev[key]]
            players[playerIdx] = { ...players[playerIdx], ...updates }
            return { ...prev, [key]: players }
        })
    }

    return (
        <div className="border-t border-[var(--color-border)]">
            {/* Winner selector + forfeit toggle */}
            <div className="px-4 py-3 flex items-center gap-4 bg-[var(--color-card)]/50">
                <span className="text-xs text-[var(--color-text-secondary)] font-medium">Winner:</span>
                <div className="flex gap-2">
                    <WinnerButton label={team1?.team_name || 'Team 1'} color="blue"
                                  isActive={game.winning_team_id === team1?.team_id}
                                  onClick={() => onChange({ ...game, winning_team_id: team1?.team_id })} />
                    <WinnerButton label={team2?.team_name || 'Team 2'} color="red"
                                  isActive={game.winning_team_id === team2?.team_id}
                                  onClick={() => onChange({ ...game, winning_team_id: team2?.team_id })} />
                    {game.winning_team_id && (
                        <button onClick={() => onChange({ ...game, winning_team_id: null })}
                                className="px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:text-red-400">Clear</button>
                    )}
                </div>
                <div className="ml-auto">
                    <button
                        onClick={() => onChange({ ...game, is_forfeit: !game.is_forfeit })}
                        className={`px-3 py-1 text-xs rounded font-semibold transition-all ${
                            game.is_forfeit
                                ? 'bg-orange-500/20 text-orange-400 ring-1 ring-orange-400/50'
                                : 'bg-[var(--color-card)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-orange-400/50 hover:text-orange-400'
                        }`}
                    >
                        FF
                    </button>
                </div>
            </div>

            {/* Forfeit banner */}
            {game.is_forfeit && (
                <div className="px-4 py-2 bg-orange-500/10 border-t border-orange-500/20 text-orange-400 text-xs">
                    Forfeit — no player stats will be recorded. This game won't affect individual player stats or winrates.
                </div>
            )}

            {/* Player tables (hidden for forfeits) */}
            {!game.is_forfeit && (
                <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[var(--color-border)]">
                    <PlayerTable
                        label={team1?.team_name || 'Team 1'}
                        color={team1?.color || '#3b82f6'}
                        players={game.left_players}
                        allGamePlayers={[...game.left_players, ...game.right_players]}
                        side="left"
                        seasonId={seasonId}
                        adminData={adminData}
                        onUpdatePlayer={(idx, updates) => updatePlayer('left', idx, updates)}
                        isWinner={game.winning_team_id === team1?.team_id}
                    />
                    <PlayerTable
                        label={team2?.team_name || 'Team 2'}
                        color={team2?.color || '#ef4444'}
                        players={game.right_players}
                        allGamePlayers={[...game.left_players, ...game.right_players]}
                        side="right"
                        seasonId={seasonId}
                        adminData={adminData}
                        onUpdatePlayer={(idx, updates) => updatePlayer('right', idx, updates)}
                        isWinner={game.winning_team_id === team2?.team_id}
                    />
                </div>
            )}
        </div>
    )
}


// ═══════════════════════════════════════════════════
// EDITABLE MATCH DATA (review phase)
// ═══════════════════════════════════════════════════
export function EditableMatchData({ editData, adminData, result, onChange }) {
    const [activeGame, setActiveGame] = useState(0)
    const [dismissedSuggestion, setDismissedSuggestion] = useState(null)
    const ed = editData
    if (!ed) return null

    const teamsForSeason = adminData?.teams?.filter(t => String(t.season_id) === String(ed.season_id)) || []
    const team1 = teamsForSeason.find(t => String(t.team_id) === String(ed.team1_id))
    const team2 = teamsForSeason.find(t => String(t.team_id) === String(ed.team2_id))

    // Scheduled matches for current season
    const scheduledForSeason = (adminData?.scheduledMatches || []).filter(
        sm => String(sm.season_id) === String(ed.season_id)
    )

    // Auto-detect matching scheduled match (teams match in either order)
    const suggestedMatch = (!ed.scheduled_match_id && ed.team1_id && ed.team2_id)
        ? scheduledForSeason.find(sm => {
            const t1 = String(sm.team1_id), t2 = String(sm.team2_id)
            const et1 = String(ed.team1_id), et2 = String(ed.team2_id)
            return (t1 === et1 && t2 === et2) || (t1 === et2 && t2 === et1)
        })
        : null

    const showSuggestion = suggestedMatch && String(dismissedSuggestion) !== String(suggestedMatch.id)

    const linkScheduledMatch = (sm) => {
        onChange({
            ...ed,
            team1_id: sm.team1_id,
            team2_id: sm.team2_id,
            date: sm.scheduled_date ? sm.scheduled_date.slice(0, 10) : ed.date,
            week: sm.week || ed.week,
            best_of: sm.best_of || ed.best_of,
            scheduled_match_id: sm.id,
        })
        setDismissedSuggestion(null)
    }

    const unlinkScheduledMatch = () => {
        onChange({ ...ed, scheduled_match_id: null })
    }

    const updateField = (key, value) => onChange({ ...ed, [key]: value })
    const updateGame = (gameIdx, gameUpdater) => {
        onChange(prev => {
            const games = [...prev.games]
            const oldGame = games[gameIdx]
            games[gameIdx] = typeof gameUpdater === 'function' ? gameUpdater(oldGame) : { ...oldGame, ...gameUpdater }
            const newGame = games[gameIdx]

            // Propagate newly-matched players to the same player in other games
            const propagate = (oldPlayers, newPlayers) => {
                if (!oldPlayers || !newPlayers) return
                newPlayers.forEach((np, i) => {
                    const op = oldPlayers[i]
                    if (!op || op.matched_lp_id || !np.matched_lp_id) return
                    // This player was just matched — find same extracted name in other games
                    const origName = (op.original_name || op.player_name || '').toLowerCase()
                    if (!origName) return
                    for (let gIdx = 0; gIdx < games.length; gIdx++) {
                        if (gIdx === gameIdx) continue
                        const g = games[gIdx]
                        if (!g) continue
                        const updatePlayers = (players) => {
                            if (!players) return players
                            let changed = false
                            const updated = players.map(p => {
                                const pOrig = (p.original_name || p.player_name || '').toLowerCase()
                                if (pOrig === origName && !p.matched_lp_id) {
                                    changed = true
                                    return {
                                        ...p,
                                        player_name: np.player_name,
                                        matched_name: np.matched_name,
                                        matched_lp_id: np.matched_lp_id,
                                        match_source: np.match_source || null,
                                        matched_alias: np.matched_alias || null,
                                        is_sub: false,
                                        sub_type: null,
                                    }
                                }
                                return p
                            })
                            return changed ? updated : players
                        }
                        games[gIdx] = {
                            ...g,
                            left_players: updatePlayers(g.left_players),
                            right_players: updatePlayers(g.right_players),
                        }
                    }
                })
            }
            propagate(oldGame.left_players, newGame.left_players)
            propagate(oldGame.right_players, newGame.right_players)

            return { ...prev, games }
        })
    }

    // Validation from text parse
    const gw = result?.game_winners

    // Currently linked scheduled match
    const linkedMatch = ed.scheduled_match_id
        ? scheduledForSeason.find(sm => sm.id === ed.scheduled_match_id)
        : null

    return (
        <div>
            {/* ─── Match metadata fields ─── */}
            <div className="px-4 py-3 border-t border-[var(--color-border)] grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                <FieldSelect label="Season" value={ed.season_id || ''}
                             onChange={v => onChange({ ...ed, season_id: v ? parseInt(v) : null, team1_id: null, team2_id: null, scheduled_match_id: null })}
                             options={(adminData?.seasons || []).map(s => ({ value: s.season_id, label: `${s.league_name} / ${s.division_name}` }))} />
                <FieldSelect label="Team 1" value={ed.team1_id || ''}
                             onChange={v => updateField('team1_id', v ? parseInt(v) : null)}
                             options={teamsForSeason.map(t => ({ value: t.team_id, label: t.team_name }))}
                             color={team1?.color} />
                <FieldSelect label="Team 2" value={ed.team2_id || ''}
                             onChange={v => updateField('team2_id', v ? parseInt(v) : null)}
                             options={teamsForSeason.filter(t => String(t.team_id) !== String(ed.team1_id)).map(t => ({ value: t.team_id, label: t.team_name }))}
                             color={team2?.color} />
                <FieldInput label="Date" type="date" value={ed.date || ''} onChange={v => updateField('date', v)} />
                <FieldInput label="Week" type="number" value={ed.week || ''} onChange={v => updateField('week', v ? parseInt(v) : null)} />
                <FieldInput label="Best Of" type="number" value={ed.best_of || 3} onChange={v => updateField('best_of', v ? parseInt(v) : 3)} />
            </div>

            {/* ─── Scheduled match selector ─── */}
            {scheduledForSeason.length > 0 && (
                <div className="px-4 py-2 border-t border-[var(--color-border)]">
                    {linkedMatch ? (
                        <div className="flex items-center gap-2 text-xs">
                            <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 font-medium">
                                Linked: {linkedMatch.team1_name || 'TBD'} vs {linkedMatch.team2_name || 'TBD'}
                                {linkedMatch.stage_name && ` \u2014 ${linkedMatch.stage_name}${linkedMatch.round_name ? ` / ${linkedMatch.round_name}` : ''}`}
                                {linkedMatch.scheduled_date && ` \u2014 ${linkedMatch.scheduled_date.slice(0, 10)}`}
                                {linkedMatch.week && ` (W${linkedMatch.week})`}
                            </span>
                            <button onClick={unlinkScheduledMatch}
                                    className="text-[var(--color-text-secondary)] hover:text-red-400 transition-colors">
                                {'\u2715'} Unlink
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <label className="text-[10px] text-[var(--color-text-secondary)] font-medium shrink-0">Scheduled Match</label>
                            <select
                                value=""
                                onChange={e => {
                                    const sm = scheduledForSeason.find(s => String(s.id) === e.target.value)
                                    if (sm) linkScheduledMatch(sm)
                                }}
                                className="rounded px-2 py-1 text-xs border max-w-md"
                                style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.1)' }}
                            >
                                <option value="">{'\u2014'} Select to auto-fill {'\u2014'}</option>
                                {scheduledForSeason.map(sm => (
                                    <option key={sm.id} value={sm.id}>
                                        {sm.team1_name || 'TBD'} vs {sm.team2_name || 'TBD'}
                                        {sm.stage_name ? ` \u2014 ${sm.stage_name}${sm.round_name ? ` / ${sm.round_name}` : ''}` : ''}
                                        {sm.scheduled_date ? ` \u2014 ${sm.scheduled_date.slice(0, 10)}` : ''}
                                        {sm.week ? ` (W${sm.week})` : ''}
                                        {` Bo${sm.best_of}`}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            )}

            {/* ─── Auto-suggestion banner ─── */}
            {showSuggestion && (
                <div className="mx-4 mt-2 flex items-center gap-3 text-xs px-3 py-2 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
                    <span>
                        Matches scheduled: <strong>{suggestedMatch.team1_name} vs {suggestedMatch.team2_name}</strong>
                        {suggestedMatch.scheduled_date && ` on ${suggestedMatch.scheduled_date.slice(0, 10)}`}
                        {suggestedMatch.week && ` (Week ${suggestedMatch.week})`}
                    </span>
                    <button onClick={() => linkScheduledMatch(suggestedMatch)}
                            className="px-2 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition-colors">
                        Link
                    </button>
                    <button onClick={() => setDismissedSuggestion(suggestedMatch.id)}
                            className="text-cyan-400/60 hover:text-cyan-400 transition-colors">
                        Dismiss
                    </button>
                </div>
            )}

            {/* ─── Validation banner ─── */}
            {gw?.validation && (
                <div className={`mx-4 mt-2 text-xs px-3 py-1.5 rounded inline-block ${
                    gw.validation.matches_stated ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                    {gw.validation.matches_stated
                        ? `\u2713 Winners match stated: ${gw.validation.stated_result}`
                        : `\u26a0 Mismatch: stated ${gw.validation.stated_result}, inferred ${gw.validation.inferred_result}`}
                </div>
            )}

            {/* ─── Game tabs ─── */}
            <div className="px-4 pt-3 border-t border-[var(--color-border)] mt-3">
                <div className="flex gap-1 items-center">
                    {ed.games.map((game, idx) => (
                        <button key={idx} onClick={() => setActiveGame(idx)}
                                className={`px-3 py-1.5 text-xs rounded-t transition-colors ${
                                    activeGame === idx
                                        ? 'bg-[var(--color-card)] text-[var(--color-text)] border border-b-0 border-[var(--color-border)]'
                                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                                }`}>
                            Game {idx + 1}
                            {game.is_forfeit && (
                                <span className="ml-1.5 text-orange-400 font-bold">FF</span>
                            )}
                            {game.winning_team_id && !game.is_forfeit && (
                                <span className={`ml-1.5 inline-block w-2 h-2 rounded-full ${
                                    game.winning_team_id === ed.team1_id ? 'bg-blue-400' : 'bg-red-400'
                                }`} />
                            )}
                        </button>
                    ))}
                    <button
                        onClick={() => {
                            const emptyPlayer = () => ({
                                player_name: '', original_name: '', god_played: '', role_played: '', kills: 0, deaths: 0, assists: 0,
                                player_damage: 0, mitigated: 0, structure_damage: 0, gpm: 0,
                                matched_name: null, matched_lp_id: null, is_sub: false, sub_type: null,
                            })
                            onChange(prev => ({
                                ...prev,
                                games: [...prev.games, {
                                    game_index: prev.games.length,
                                    winning_team_id: null,
                                    is_forfeit: false,
                                    left_players: Array.from({ length: 5 }, emptyPlayer),
                                    right_players: Array.from({ length: 5 }, emptyPlayer),
                                }],
                            }))
                            setActiveGame(ed.games.length)
                        }}
                        className="px-2 py-1 text-[10px] rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/10 transition-colors ml-1"
                        title="Add a game with player stats"
                    >
                        + Game
                    </button>
                    <button
                        onClick={() => {
                            onChange(prev => ({
                                ...prev,
                                games: [...prev.games, {
                                    game_index: prev.games.length,
                                    winning_team_id: null,
                                    is_forfeit: true,
                                    left_players: [],
                                    right_players: [],
                                }],
                            }))
                            setActiveGame(ed.games.length)
                        }}
                        className="px-2 py-1 text-[10px] rounded text-orange-400/70 hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
                        title="Add a forfeit game"
                    >
                        + FF
                    </button>
                    {ed.games.length > 1 && (
                        <button
                            onClick={() => {
                                onChange(prev => ({
                                    ...prev,
                                    games: prev.games.filter((_, i) => i !== activeGame),
                                }))
                                setActiveGame(Math.max(0, activeGame - 1))
                            }}
                            className="px-2 py-1 text-[10px] rounded text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Remove this game"
                        >
                            Remove
                        </button>
                    )}
                </div>
            </div>

            {/* ─── Active game ─── */}
            {ed.games[activeGame] && (() => {
                const g = ed.games[activeGame]
                // Sides swap each game in SMITE 2 — determine teams from matched players
                const rosterPlayers = adminData?.players || []
                const inferTeam = (players) => {
                    const teamIds = players
                        .filter(p => p.matched_lp_id)
                        .map(p => rosterPlayers.find(r => r.league_player_id === p.matched_lp_id)?.team_id)
                        .filter(Boolean)
                    if (!teamIds.length) return null
                    // Majority vote
                    const counts = {}
                    for (const id of teamIds) counts[id] = (counts[id] || 0) + 1
                    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
                }
                const leftTeamId = inferTeam(g.left_players)
                const swapped = leftTeamId && String(leftTeamId) === String(ed.team2_id)
                const leftTeam = swapped ? team2 : team1
                const rightTeam = swapped ? team1 : team2
                return (
                    <GameEditor
                        key={activeGame}
                        game={g}
                        gameIndex={activeGame}
                        team1={leftTeam}
                        team2={rightTeam}
                        seasonId={ed.season_id}
                        adminData={adminData}
                        onChange={(gameUpdate) => updateGame(activeGame, gameUpdate)}
                    />
                )
            })()}
        </div>
    )
}

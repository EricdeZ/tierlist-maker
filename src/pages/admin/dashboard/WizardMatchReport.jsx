import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { GodAutocomplete } from './GodAutocomplete'
import { ROLE_IMAGES, ROLE_LIST, API } from './constants'
import { getAuthHeaders } from '../../../services/adminApi.js'

const GAME_SUBSTEPS = ['winner', 'names', 'gods', 'roles', 'kda', 'damage', 'mitigated']
const SUBSTEP_LABELS = {
    winner: 'Winner', names: 'Player Names', gods: 'Gods',
    roles: 'Roles', kda: 'K/D/A', damage: 'Damage', mitigated: 'Mitigated',
}

// ═══════════════════════════════════════════════════
// MAIN WIZARD
// ═══════════════════════════════════════════════════

export default function WizardMatchReport({
    matchInfo, editData, onUpdateEditData, adminData,
    queueItems, onExtract, status, error,
    onSubmit, isSubmitting, submitResult,
}) {
    const [stepIndex, setStepIndex] = useState(0)
    const [selectedScreenshots, setSelectedScreenshots] = useState({})
    const prevStatusRef = useRef(status)

    // Build step list dynamically based on number of games
    const steps = useMemo(() => {
        const list = [
            { id: 'confirm', label: 'Confirm Match' },
            { id: 'screenshots', label: 'Select Screenshots' },
        ]
        const numGames = editData?.games?.length || 0
        if (numGames > 0) {
            list.push({ id: 'overview', label: 'Extraction Overview' })
            for (let g = 0; g < numGames; g++) {
                for (const sub of GAME_SUBSTEPS) {
                    list.push({
                        id: `game_${g}_${sub}`,
                        label: `Game ${g + 1} — ${SUBSTEP_LABELS[sub]}`,
                        gameIndex: g,
                        substep: sub,
                    })
                }
            }
            list.push({ id: 'review', label: 'Final Review' })
        }
        return list
    }, [editData?.games?.length])

    const step = steps[stepIndex] || steps[0]
    const progress = steps.length > 1 ? (stepIndex / (steps.length - 1)) * 100 : 0

    const next = useCallback(() => setStepIndex(i => Math.min(i + 1, steps.length - 1)), [steps.length])
    const prev = useCallback(() => setStepIndex(i => Math.max(i - 1, 0)), [steps.length])

    // Auto-advance from screenshots to overview after extraction
    useEffect(() => {
        if (prevStatusRef.current === 'processing' && status === 'review' && stepIndex === 1) {
            setStepIndex(2)
        }
        prevStatusRef.current = status
    }, [status, stepIndex])

    // Player update helper
    const updatePlayer = useCallback((gameIndex, side, playerIndex, updates) => {
        onUpdateEditData(prev => {
            const games = [...prev.games]
            const game = { ...games[gameIndex] }
            const key = side === 'left' ? 'left_players' : 'right_players'
            const players = [...game[key]]
            players[playerIndex] = { ...players[playerIndex], ...updates }
            game[key] = players
            games[gameIndex] = game
            return { ...prev, games }
        })
    }, [onUpdateEditData])

    const updateGame = useCallback((gameIndex, updates) => {
        onUpdateEditData(prev => {
            const games = [...prev.games]
            games[gameIndex] = { ...games[gameIndex], ...updates }
            return { ...prev, games }
        })
    }, [onUpdateEditData])

    // Handle extract
    const handleExtract = useCallback(async () => {
        const ids = Object.keys(selectedScreenshots).filter(k => selectedScreenshots[k]).map(Number).sort((a, b) => a - b)
        if (!ids.length) return
        await onExtract(ids)
    }, [selectedScreenshots, onExtract])

    // Team info helpers
    const team1Name = editData?.team1_name || matchInfo?.team1_name || 'Team 1'
    const team2Name = editData?.team2_name || matchInfo?.team2_name || 'Team 2'
    const team1Color = matchInfo?.team1_color || '#3b82f6'
    const team2Color = matchInfo?.team2_color || '#ef4444'
    const team1Id = editData?.team1_id || matchInfo?.team1_id
    const team2Id = editData?.team2_id || matchInfo?.team2_id

    // ─── Render current step content ───
    const renderStep = () => {
        if (step.id === 'confirm') {
            return <ConfirmStep matchInfo={matchInfo} onConfirm={next} />
        }

        if (step.id === 'screenshots') {
            return (
                <ScreenshotsStep
                    queueItems={queueItems}
                    selected={selectedScreenshots}
                    onToggle={id => setSelectedScreenshots(p => ({ ...p, [id]: !p[id] }))}
                    onSelectAll={() => {
                        const allSelected = queueItems.every(q => selectedScreenshots[q.id])
                        const s = {}
                        queueItems.forEach(q => { s[q.id] = !allSelected })
                        setSelectedScreenshots(s)
                    }}
                    onExtract={handleExtract}
                    extracting={status === 'processing'}
                    error={error}
                    selectedCount={Object.values(selectedScreenshots).filter(Boolean).length}
                />
            )
        }

        if (step.id === 'overview') {
            return (
                <OverviewStep
                    editData={editData}
                    team1Name={team1Name} team2Name={team2Name}
                    team1Id={team1Id} team2Id={team2Id}
                    onStartAudit={next}
                />
            )
        }

        if (step.id === 'review') {
            return (
                <ReviewStep
                    editData={editData}
                    team1Name={team1Name} team2Name={team2Name}
                    team1Color={team1Color} team2Color={team2Color}
                    team1Id={team1Id} team2Id={team2Id}
                    adminData={adminData}
                    onSubmit={onSubmit}
                    isSubmitting={isSubmitting}
                    submitResult={submitResult}
                />
            )
        }

        // Game substeps
        const { gameIndex, substep } = step
        const game = editData?.games?.[gameIndex]
        if (!game) return null

        const gameProps = {
            game, gameIndex, substep,
            team1Name, team2Name, team1Color, team2Color, team1Id, team2Id,
            adminData, updatePlayer, updateGame, onNext: next,
        }

        switch (substep) {
            case 'winner': return <WinnerStep {...gameProps} />
            case 'names': return <NamesStep {...gameProps} />
            case 'gods': return <GodsStep {...gameProps} />
            case 'roles': return <RolesStep {...gameProps} />
            case 'kda': return <KDAStep {...gameProps} />
            case 'damage': return <DamageStep {...gameProps} />
            case 'mitigated': return <MitigatedStep {...gameProps} />
            default: return null
        }
    }

    return (
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
            {/* Progress bar */}
            <div className="h-1 bg-white/5">
                <div
                    className="h-full bg-[var(--color-accent)] transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Step indicator */}
            <div className="px-6 pt-4 pb-2 flex items-center justify-between">
                <div>
                    <span className="text-xs text-[var(--color-text-secondary)]">
                        Step {stepIndex + 1} of {steps.length}
                    </span>
                    <h2 className="text-lg font-bold text-[var(--color-text)]">{step.label}</h2>
                </div>
                {stepIndex > 0 && step.id !== 'screenshots' && (
                    <button
                        onClick={prev}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition"
                    >
                        &larr; Back
                    </button>
                )}
            </div>

            {/* Step content */}
            <div className="px-6 pb-6">
                {renderStep()}
            </div>
        </div>
    )
}


// ═══════════════════════════════════════════════════
// STEP: CONFIRM MATCH
// ═══════════════════════════════════════════════════

function ConfirmStep({ matchInfo, onConfirm }) {
    return (
        <div className="py-8 text-center">
            <div className="flex items-center justify-center gap-4 mb-6">
                <div className="text-right">
                    <span className="inline-block w-4 h-4 rounded-full mr-2 align-middle" style={{ backgroundColor: matchInfo.team1_color }} />
                    <span className="text-xl font-bold text-[var(--color-text)]">{matchInfo.team1_name}</span>
                </div>
                <span className="text-lg text-[var(--color-text-secondary)]">vs</span>
                <div className="text-left">
                    <span className="inline-block w-4 h-4 rounded-full mr-2 align-middle" style={{ backgroundColor: matchInfo.team2_color }} />
                    <span className="text-xl font-bold text-[var(--color-text)]">{matchInfo.team2_name}</span>
                </div>
            </div>
            <div className="text-sm text-[var(--color-text-secondary)] mb-8 space-y-1">
                <p>{matchInfo.division_name} &middot; {matchInfo.league_name}</p>
                {matchInfo.week && <p>Week {matchInfo.week}</p>}
                {matchInfo.scheduled_date && <p>{new Date(matchInfo.scheduled_date).toLocaleDateString()}</p>}
                <p>Best of {matchInfo.best_of}</p>
            </div>
            <button
                onClick={onConfirm}
                className="px-8 py-3 rounded-xl text-sm font-bold bg-green-600 text-white hover:bg-green-500 transition"
            >
                Confirm &amp; Continue
            </button>
        </div>
    )
}


// ═══════════════════════════════════════════════════
// STEP: SELECT SCREENSHOTS
// ═══════════════════════════════════════════════════

function ScreenshotsStep({ queueItems, selected, onToggle, onSelectAll, onExtract, extracting, error, selectedCount }) {
    if (extracting) {
        return (
            <div className="py-16 text-center">
                <div className="inline-block w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-sm text-[var(--color-text-secondary)]">Extracting match data from screenshots...</p>
            </div>
        )
    }

    return (
        <div>
            <div className="px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-4">
                <p className="text-xs text-amber-300 font-medium">
                    Select only DETAILS page screenshots for AI extraction.
                </p>
                <p className="text-[10px] text-amber-300/70 mt-0.5">
                    Overview and lobby screenshots will waste AI processing.
                </p>
            </div>

            <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-[var(--color-text-secondary)]">
                    {queueItems.length} screenshot{queueItems.length !== 1 ? 's' : ''} available
                </span>
                <button onClick={onSelectAll} className="text-[10px] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition">
                    {queueItems.every(q => selected[q.id]) ? 'Deselect All' : 'Select All'}
                </button>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 mb-6">
                {queueItems.map(item => (
                    <div
                        key={item.id}
                        onClick={() => onToggle(item.id)}
                        className={`relative aspect-[16/10] rounded-lg overflow-hidden cursor-pointer border-2 transition ${
                            selected[item.id]
                                ? 'border-green-500 ring-1 ring-green-500/30'
                                : 'border-transparent hover:border-white/20'
                        }`}
                    >
                        <img
                            src={`${API}/discord-image?queueId=${item.id}&token=${encodeURIComponent(localStorage.getItem('auth_token') || '')}`}
                            alt="" className="w-full h-full object-cover" loading="lazy"
                            onError={e => { e.target.style.display = 'none' }}
                        />
                        {selected[item.id] && (
                            <div className="absolute inset-0 bg-green-600/30 flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M2 6l3 3 5-5" />
                                </svg>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {error && (
                <div className="mb-4 px-3 py-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg">
                    {error}
                </div>
            )}

            <div className="flex justify-center">
                <button
                    onClick={onExtract}
                    disabled={!selectedCount}
                    className="px-8 py-3 rounded-xl text-sm font-bold bg-[var(--color-accent)] text-[var(--color-bg)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                    Extract {selectedCount} Screenshot{selectedCount !== 1 ? 's' : ''}
                </button>
            </div>
        </div>
    )
}


// ═══════════════════════════════════════════════════
// STEP: OVERVIEW
// ═══════════════════════════════════════════════════

function OverviewStep({ editData, team1Name, team2Name, team1Id, team2Id, onStartAudit }) {
    const games = editData?.games || []
    return (
        <div className="py-4">
            <p className="text-sm text-[var(--color-text-secondary)] mb-6">
                {games.length} game{games.length !== 1 ? 's' : ''} extracted. Review the summary below, then start the audit.
            </p>
            <div className="space-y-3 mb-8">
                {games.map((g, i) => {
                    const winnerId = g.winning_team_id
                    const winnerName = String(winnerId) === String(team1Id) ? team1Name : String(winnerId) === String(team2Id) ? team2Name : 'Not set'
                    const leftCount = (g.left_players || []).filter(p => p.matched_lp_id).length
                    const rightCount = (g.right_players || []).filter(p => p.matched_lp_id).length
                    const totalPlayers = (g.left_players?.length || 0) + (g.right_players?.length || 0)
                    const matchedCount = leftCount + rightCount
                    return (
                        <div key={i} className="flex items-center gap-4 px-4 py-3 rounded-lg bg-white/3 border border-[var(--color-border)]">
                            <span className="text-sm font-bold text-[var(--color-text)] w-16">Game {i + 1}</span>
                            <span className={`text-xs ${winnerId ? 'text-green-400' : 'text-red-400'}`}>
                                {winnerId ? `${winnerName} wins` : 'No winner'}
                            </span>
                            <span className={`text-xs ml-auto ${matchedCount === totalPlayers ? 'text-green-400' : 'text-amber-400'}`}>
                                {matchedCount}/{totalPlayers} players matched
                            </span>
                        </div>
                    )
                })}
            </div>
            <div className="flex justify-center">
                <button
                    onClick={onStartAudit}
                    className="px-8 py-3 rounded-xl text-sm font-bold bg-cyan-600 text-white hover:bg-cyan-500 transition"
                >
                    Start Audit
                </button>
            </div>
        </div>
    )
}


// ═══════════════════════════════════════════════════
// GAME STEP: WINNER
// ═══════════════════════════════════════════════════

function WinnerStep({ game, gameIndex, team1Name, team2Name, team1Color, team2Color, team1Id, team2Id, updateGame, onNext }) {
    const winnerId = game.winning_team_id
    return (
        <div className="py-8 text-center">
            <p className="text-sm text-[var(--color-text-secondary)] mb-8">Who won this game?</p>
            <div className="flex items-center justify-center gap-6 mb-8">
                <button
                    onClick={() => updateGame(gameIndex, { winning_team_id: team1Id })}
                    className={`px-8 py-5 rounded-xl text-lg font-bold border-2 transition-all ${
                        String(winnerId) === String(team1Id)
                            ? 'border-green-500 bg-green-500/15 text-white scale-105 ring-2 ring-green-500/30'
                            : 'border-[var(--color-border)] text-[var(--color-text)] hover:border-white/40 hover:scale-102'
                    }`}
                >
                    <span className="inline-block w-4 h-4 rounded-full mr-2" style={{ backgroundColor: team1Color }} />
                    {team1Name}
                </button>
                <button
                    onClick={() => updateGame(gameIndex, { winning_team_id: team2Id })}
                    className={`px-8 py-5 rounded-xl text-lg font-bold border-2 transition-all ${
                        String(winnerId) === String(team2Id)
                            ? 'border-green-500 bg-green-500/15 text-white scale-105 ring-2 ring-green-500/30'
                            : 'border-[var(--color-border)] text-[var(--color-text)] hover:border-white/40 hover:scale-102'
                    }`}
                >
                    <span className="inline-block w-4 h-4 rounded-full mr-2" style={{ backgroundColor: team2Color }} />
                    {team2Name}
                </button>
            </div>
            <button
                onClick={onNext}
                disabled={!winnerId}
                className="px-8 py-3 rounded-xl text-sm font-bold bg-green-600 text-white hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
                Correct &rarr;
            </button>
        </div>
    )
}


// ═══════════════════════════════════════════════════
// GAME STEP: NAMES
// ═══════════════════════════════════════════════════

function PlayerNameInput({ player, onChange, rosterPlayers }) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const containerRef = useRef(null)

    useEffect(() => {
        if (!open) return
        const handler = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [open])

    const filtered = useMemo(() => {
        const q = (query || player.player_name || '').toLowerCase()
        if (!q) return rosterPlayers.slice(0, 12)
        return rosterPlayers.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.team_name?.toLowerCase().includes(q)
        ).slice(0, 12)
    }, [query, player.player_name, rosterPlayers])

    const statusDot = player.matched_lp_id
        ? 'bg-green-500' // matched
        : player.is_sub
            ? 'bg-amber-500' // sub
            : 'bg-red-500' // unknown

    return (
        <div className="relative" ref={containerRef}>
            <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot}`} />
                <input
                    type="text"
                    value={open ? query : player.player_name}
                    onChange={e => { setQuery(e.target.value); setOpen(true) }}
                    onFocus={() => { setQuery(player.player_name || ''); setOpen(true) }}
                    className="bg-transparent border-b border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-accent)] outline-none w-full text-sm text-[var(--color-text)] transition-colors py-1"
                />
            </div>
            {open && filtered.length > 0 && (
                <div className="absolute z-50 top-full left-0 mt-1 w-64 border rounded-lg shadow-xl max-h-48 overflow-y-auto"
                     style={{ backgroundColor: 'var(--color-card, #1e1e2e)', borderColor: 'var(--color-border, #333)' }}>
                    {filtered.map(p => (
                        <button
                            key={p.league_player_id}
                            className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-[var(--color-accent)]/10 transition"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => {
                                onChange({
                                    player_name: p.name,
                                    matched_name: p.name,
                                    matched_lp_id: p.league_player_id,
                                    is_sub: false,
                                    sub_type: null,
                                })
                                setOpen(false)
                            }}
                        >
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.team_color || '#666' }} />
                            <span className="text-[var(--color-text)]">{p.name}</span>
                            <span className="text-[var(--color-text-secondary)] ml-auto text-[10px]">{p.team_name}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

function NamesStep({ game, gameIndex, team1Name, team2Name, team1Color, team2Color, adminData, updatePlayer, onNext }) {
    const rosterPlayers = adminData?.players || []
    return (
        <div>
            <div className="grid grid-cols-2 gap-6 mb-6">
                <TeamColumn label={team1Name} color={team1Color}>
                    {(game.left_players || []).map((p, i) => (
                        <PlayerNameInput
                            key={i} player={p} rosterPlayers={rosterPlayers}
                            onChange={updates => updatePlayer(gameIndex, 'left', i, updates)}
                        />
                    ))}
                </TeamColumn>
                <TeamColumn label={team2Name} color={team2Color}>
                    {(game.right_players || []).map((p, i) => (
                        <PlayerNameInput
                            key={i} player={p} rosterPlayers={rosterPlayers}
                            onChange={updates => updatePlayer(gameIndex, 'right', i, updates)}
                        />
                    ))}
                </TeamColumn>
            </div>
            <CorrectButton onClick={onNext} />
        </div>
    )
}


// ═══════════════════════════════════════════════════
// GAME STEP: GODS
// ═══════════════════════════════════════════════════

function GodsStep({ game, gameIndex, team1Name, team2Name, team1Color, team2Color, adminData, updatePlayer, onNext }) {
    const gods = adminData?.gods || []
    return (
        <div>
            <div className="grid grid-cols-2 gap-6 mb-6">
                <TeamColumn label={team1Name} color={team1Color}>
                    {(game.left_players || []).map((p, i) => (
                        <div key={i} className="flex items-center gap-2 py-1">
                            <span className="text-xs text-[var(--color-text-secondary)] w-24 truncate">{p.player_name}</span>
                            <div className="flex-1">
                                <GodAutocomplete
                                    value={p.god_played || ''}
                                    gods={gods}
                                    onChange={updates => updatePlayer(gameIndex, 'left', i, updates)}
                                />
                            </div>
                        </div>
                    ))}
                </TeamColumn>
                <TeamColumn label={team2Name} color={team2Color}>
                    {(game.right_players || []).map((p, i) => (
                        <div key={i} className="flex items-center gap-2 py-1">
                            <span className="text-xs text-[var(--color-text-secondary)] w-24 truncate">{p.player_name}</span>
                            <div className="flex-1">
                                <GodAutocomplete
                                    value={p.god_played || ''}
                                    gods={gods}
                                    onChange={updates => updatePlayer(gameIndex, 'right', i, updates)}
                                />
                            </div>
                        </div>
                    ))}
                </TeamColumn>
            </div>
            <CorrectButton onClick={onNext} />
        </div>
    )
}


// ═══════════════════════════════════════════════════
// GAME STEP: ROLES
// ═══════════════════════════════════════════════════

function RolePicker({ player, onUpdate, allPlayers, side, gameIndex, updatePlayer }) {
    const currentRole = player.role_played

    const handleRoleClick = (role) => {
        if (currentRole === role) {
            onUpdate({ role_played: null })
            return
        }
        // Swap with whoever has this role
        const otherIdx = allPlayers.findIndex(p => p.role_played === role)
        if (otherIdx !== -1) {
            updatePlayer(gameIndex, side, otherIdx, { role_played: currentRole || null })
        }
        onUpdate({ role_played: role })
    }

    return (
        <div className="flex items-center gap-1">
            {ROLE_LIST.map(role => (
                <button
                    key={role}
                    onClick={() => handleRoleClick(role)}
                    className={`w-7 h-7 rounded flex items-center justify-center transition ${
                        currentRole === role
                            ? 'bg-[var(--color-accent)]/20 ring-1 ring-[var(--color-accent)]'
                            : 'hover:bg-white/10'
                    }`}
                    title={role}
                >
                    <img src={ROLE_IMAGES[role]} alt={role} className="w-4 h-4" />
                </button>
            ))}
        </div>
    )
}

function RolesStep({ game, gameIndex, team1Name, team2Name, team1Color, team2Color, updatePlayer, onNext }) {
    return (
        <div>
            <div className="grid grid-cols-2 gap-6 mb-6">
                <TeamColumn label={team1Name} color={team1Color}>
                    {(game.left_players || []).map((p, i) => (
                        <div key={i} className="flex items-center justify-between py-1">
                            <span className="text-xs text-[var(--color-text)] w-24 truncate">{p.player_name}</span>
                            <RolePicker
                                player={p}
                                onUpdate={updates => updatePlayer(gameIndex, 'left', i, updates)}
                                allPlayers={game.left_players}
                                side="left" gameIndex={gameIndex} updatePlayer={updatePlayer}
                            />
                        </div>
                    ))}
                </TeamColumn>
                <TeamColumn label={team2Name} color={team2Color}>
                    {(game.right_players || []).map((p, i) => (
                        <div key={i} className="flex items-center justify-between py-1">
                            <span className="text-xs text-[var(--color-text)] w-24 truncate">{p.player_name}</span>
                            <RolePicker
                                player={p}
                                onUpdate={updates => updatePlayer(gameIndex, 'right', i, updates)}
                                allPlayers={game.right_players}
                                side="right" gameIndex={gameIndex} updatePlayer={updatePlayer}
                            />
                        </div>
                    ))}
                </TeamColumn>
            </div>
            <CorrectButton onClick={onNext} />
        </div>
    )
}


// ═══════════════════════════════════════════════════
// GAME STEP: KDA
// ═══════════════════════════════════════════════════

function StatInput({ value, onChange, width = 'w-14' }) {
    return (
        <input
            type="number"
            value={value ?? ''}
            onChange={e => onChange(e.target.value === '' ? 0 : parseInt(e.target.value))}
            className={`${width} bg-transparent border-b border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-accent)] outline-none text-xs text-[var(--color-text)] text-right py-1 transition-colors`}
        />
    )
}

function KDAStep({ game, gameIndex, team1Name, team2Name, team1Color, team2Color, updatePlayer, onNext }) {
    return (
        <div>
            <div className="grid grid-cols-2 gap-6 mb-6">
                <TeamColumn label={team1Name} color={team1Color}>
                    <div className="flex items-center gap-2 mb-1 text-[10px] text-[var(--color-text-secondary)]">
                        <span className="w-24">Player</span>
                        <span className="w-14 text-right">K</span>
                        <span className="w-14 text-right">D</span>
                        <span className="w-14 text-right">A</span>
                    </div>
                    {(game.left_players || []).map((p, i) => (
                        <div key={i} className="flex items-center gap-2 py-0.5">
                            <span className="text-xs text-[var(--color-text)] w-24 truncate">{p.player_name}</span>
                            <StatInput value={p.kills} onChange={v => updatePlayer(gameIndex, 'left', i, { kills: v })} />
                            <StatInput value={p.deaths} onChange={v => updatePlayer(gameIndex, 'left', i, { deaths: v })} />
                            <StatInput value={p.assists} onChange={v => updatePlayer(gameIndex, 'left', i, { assists: v })} />
                        </div>
                    ))}
                </TeamColumn>
                <TeamColumn label={team2Name} color={team2Color}>
                    <div className="flex items-center gap-2 mb-1 text-[10px] text-[var(--color-text-secondary)]">
                        <span className="w-24">Player</span>
                        <span className="w-14 text-right">K</span>
                        <span className="w-14 text-right">D</span>
                        <span className="w-14 text-right">A</span>
                    </div>
                    {(game.right_players || []).map((p, i) => (
                        <div key={i} className="flex items-center gap-2 py-0.5">
                            <span className="text-xs text-[var(--color-text)] w-24 truncate">{p.player_name}</span>
                            <StatInput value={p.kills} onChange={v => updatePlayer(gameIndex, 'right', i, { kills: v })} />
                            <StatInput value={p.deaths} onChange={v => updatePlayer(gameIndex, 'right', i, { deaths: v })} />
                            <StatInput value={p.assists} onChange={v => updatePlayer(gameIndex, 'right', i, { assists: v })} />
                        </div>
                    ))}
                </TeamColumn>
            </div>
            <CorrectButton onClick={onNext} />
        </div>
    )
}


// ═══════════════════════════════════════════════════
// GAME STEP: DAMAGE
// ═══════════════════════════════════════════════════

function DamageStep({ game, gameIndex, team1Name, team2Name, team1Color, team2Color, updatePlayer, onNext }) {
    return (
        <div>
            <div className="grid grid-cols-2 gap-6 mb-6">
                <TeamColumn label={team1Name} color={team1Color}>
                    {(game.left_players || []).map((p, i) => (
                        <div key={i} className="flex items-center justify-between py-1">
                            <span className="text-xs text-[var(--color-text)] w-28 truncate">{p.player_name}</span>
                            <StatInput value={p.player_damage} onChange={v => updatePlayer(gameIndex, 'left', i, { player_damage: v })} width="w-20" />
                        </div>
                    ))}
                </TeamColumn>
                <TeamColumn label={team2Name} color={team2Color}>
                    {(game.right_players || []).map((p, i) => (
                        <div key={i} className="flex items-center justify-between py-1">
                            <span className="text-xs text-[var(--color-text)] w-28 truncate">{p.player_name}</span>
                            <StatInput value={p.player_damage} onChange={v => updatePlayer(gameIndex, 'right', i, { player_damage: v })} width="w-20" />
                        </div>
                    ))}
                </TeamColumn>
            </div>
            <CorrectButton onClick={onNext} />
        </div>
    )
}


// ═══════════════════════════════════════════════════
// GAME STEP: MITIGATED
// ═══════════════════════════════════════════════════

function MitigatedStep({ game, gameIndex, team1Name, team2Name, team1Color, team2Color, updatePlayer, onNext }) {
    return (
        <div>
            <div className="grid grid-cols-2 gap-6 mb-6">
                <TeamColumn label={team1Name} color={team1Color}>
                    {(game.left_players || []).map((p, i) => (
                        <div key={i} className="flex items-center justify-between py-1">
                            <span className="text-xs text-[var(--color-text)] w-28 truncate">{p.player_name}</span>
                            <StatInput value={p.mitigated} onChange={v => updatePlayer(gameIndex, 'left', i, { mitigated: v })} width="w-20" />
                        </div>
                    ))}
                </TeamColumn>
                <TeamColumn label={team2Name} color={team2Color}>
                    {(game.right_players || []).map((p, i) => (
                        <div key={i} className="flex items-center justify-between py-1">
                            <span className="text-xs text-[var(--color-text)] w-28 truncate">{p.player_name}</span>
                            <StatInput value={p.mitigated} onChange={v => updatePlayer(gameIndex, 'right', i, { mitigated: v })} width="w-20" />
                        </div>
                    ))}
                </TeamColumn>
            </div>
            <CorrectButton onClick={onNext} />
        </div>
    )
}


// ═══════════════════════════════════════════════════
// STEP: FINAL REVIEW
// ═══════════════════════════════════════════════════

function ReviewStep({ editData, team1Name, team2Name, team1Color, team2Color, team1Id, team2Id, adminData, onSubmit, isSubmitting, submitResult }) {
    const games = editData?.games || []
    const gods = adminData?.gods || []
    const findGodImg = (name) => gods.find(g => g.name === name)?.image_url

    if (submitResult?.success) {
        return (
            <div className="py-12 text-center">
                <div className="text-4xl mb-3">&#9989;</div>
                <h3 className="text-lg font-bold text-green-400 mb-2">Match Submitted</h3>
                <p className="text-sm text-[var(--color-text-secondary)]">Match ID: {submitResult.data?.match_id}</p>
            </div>
        )
    }

    return (
        <div>
            {submitResult?.error && (
                <div className="mb-4 px-3 py-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg">
                    {submitResult.error}
                </div>
            )}

            <div className="space-y-6 mb-8">
                {games.map((g, gi) => {
                    const winnerId = g.winning_team_id
                    const winnerName = String(winnerId) === String(team1Id) ? team1Name : team2Name
                    return (
                        <div key={gi} className="border border-[var(--color-border)] rounded-lg overflow-hidden">
                            <div className="px-4 py-2 bg-white/3 flex items-center justify-between">
                                <span className="text-sm font-bold text-[var(--color-text)]">Game {gi + 1}</span>
                                <span className="text-xs text-green-400">{winnerName} wins</span>
                            </div>
                            <div className="grid grid-cols-2 divide-x divide-[var(--color-border)]">
                                <ReviewTeamTable
                                    players={g.left_players || []}
                                    teamName={team1Name} teamColor={team1Color}
                                    findGodImg={findGodImg}
                                />
                                <ReviewTeamTable
                                    players={g.right_players || []}
                                    teamName={team2Name} teamColor={team2Color}
                                    findGodImg={findGodImg}
                                />
                            </div>
                        </div>
                    )
                })}
            </div>

            <div className="flex justify-center">
                <button
                    onClick={onSubmit}
                    disabled={isSubmitting}
                    className="px-10 py-3 rounded-xl text-sm font-bold bg-green-600 text-white hover:bg-green-500 disabled:opacity-50 transition"
                >
                    {isSubmitting ? 'Submitting...' : 'Submit Match'}
                </button>
            </div>
        </div>
    )
}

function ReviewTeamTable({ players, teamName, teamColor, findGodImg }) {
    return (
        <div className="p-3">
            <div className="flex items-center gap-1.5 mb-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: teamColor }} />
                <span className="text-xs font-semibold text-[var(--color-text)]">{teamName}</span>
            </div>
            <table className="w-full text-[11px]">
                <thead>
                    <tr className="text-[var(--color-text-secondary)] text-[10px]">
                        <th className="text-left font-normal pb-1">Player</th>
                        <th className="text-left font-normal pb-1">God</th>
                        <th className="text-left font-normal pb-1">Role</th>
                        <th className="text-right font-normal pb-1">KDA</th>
                        <th className="text-right font-normal pb-1">Dmg</th>
                        <th className="text-right font-normal pb-1">Mit</th>
                    </tr>
                </thead>
                <tbody>
                    {players.map((p, i) => (
                        <tr key={i} className="border-t border-[var(--color-border)]/30">
                            <td className="py-1 text-[var(--color-text)]">{p.player_name}</td>
                            <td className="py-1">
                                <span className="flex items-center gap-1">
                                    {findGodImg(p.god_played) && <img src={findGodImg(p.god_played)} alt="" className="w-4 h-4 rounded-sm" />}
                                    <span className="text-[var(--color-text)]">{p.god_played}</span>
                                </span>
                            </td>
                            <td className="py-1">
                                {p.role_played && ROLE_IMAGES[p.role_played] && (
                                    <img src={ROLE_IMAGES[p.role_played]} alt={p.role_played} className="w-4 h-4" title={p.role_played} />
                                )}
                            </td>
                            <td className="py-1 text-right text-[var(--color-text)]">{p.kills}/{p.deaths}/{p.assists}</td>
                            <td className="py-1 text-right text-[var(--color-text-secondary)]">{p.player_damage || '-'}</td>
                            <td className="py-1 text-right text-[var(--color-text-secondary)]">{p.mitigated || '-'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}


// ═══════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════

function TeamColumn({ label, color, children }) {
    return (
        <div>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[var(--color-border)]">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-sm font-bold text-[var(--color-text)]">{label}</span>
            </div>
            <div className="space-y-1">
                {children}
            </div>
        </div>
    )
}

function CorrectButton({ onClick }) {
    return (
        <div className="flex justify-end pt-4">
            <button
                onClick={onClick}
                className="px-8 py-2.5 rounded-xl text-sm font-bold bg-green-600 text-white hover:bg-green-500 transition"
            >
                Correct &rarr;
            </button>
        </div>
    )
}

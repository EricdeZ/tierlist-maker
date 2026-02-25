import { useState, useEffect, useCallback, useRef } from 'react'
import { ArrowLeft, Crown } from 'lucide-react'
import { inhouseService } from '../../services/database'
import { ROLE_LABELS, ROLE_COLORS, SIDE_COLORS, avatarUrl } from './arcadeConstants'

export default function ArcadeDraft({ lobby, participants, user, onPick, onBack, onRefresh }) {
    const [draftState, setDraftState] = useState(null)
    const [timeLeft, setTimeLeft] = useState(null)
    const [picking, setPicking] = useState(false)
    const pollRef = useRef(null)
    const timerRef = useRef(null)

    // Poll draft state every 2s
    const fetchDraftState = useCallback(async () => {
        try {
            const state = await inhouseService.getDraftState(lobby.id)
            setDraftState(state)

            // If draft is done, stop polling and refresh parent
            if (state.status !== 'drafting') {
                clearInterval(pollRef.current)
                onRefresh()
            }
        } catch (err) {
            console.error('Draft poll error:', err)
        }
    }, [lobby.id, onRefresh])

    useEffect(() => {
        fetchDraftState()
        pollRef.current = setInterval(fetchDraftState, 2000)
        return () => clearInterval(pollRef.current)
    }, [fetchDraftState])

    // Countdown timer from turnDeadline
    useEffect(() => {
        if (!draftState?.turnDeadline) return
        const updateTimer = () => {
            const deadline = new Date(draftState.turnDeadline).getTime()
            const now = Date.now()
            const remaining = Math.max(0, Math.ceil((deadline - now) / 1000))
            setTimeLeft(remaining)
        }
        updateTimer()
        timerRef.current = setInterval(updateTimer, 200)
        return () => clearInterval(timerRef.current)
    }, [draftState?.turnDeadline])

    if (!draftState) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--arcade-bg)' }}>
                <div className="arcade-label arcade-pulse" style={{ color: 'var(--arcade-cyan)' }}>LOADING DRAFT...</div>
            </div>
        )
    }

    const { currentPick, picks, pickOrder, currentCaptainSide, captainLeftId, captainRightId } = draftState
    const isMyTurn = user && (
        (currentCaptainSide === 'left' && user.id === captainLeftId) ||
        (currentCaptainSide === 'right' && user.id === captainRightId)
    )

    // Build picked user IDs set
    const pickedIds = new Set(picks.map(p => p.userId))
    pickedIds.add(captainLeftId)
    pickedIds.add(captainRightId)

    // Available pool (non-sub, not captain, not yet picked)
    const pool = participants.filter(p => !p.isSub && !pickedIds.has(p.userId))

    // Team rosters from picks
    const leftTeam = [
        participants.find(p => p.userId === captainLeftId),
        ...picks.filter(p => p.side === 'left').map(pk => participants.find(p => p.userId === pk.userId)),
    ].filter(Boolean)

    const rightTeam = [
        participants.find(p => p.userId === captainRightId),
        ...picks.filter(p => p.side === 'right').map(pk => participants.find(p => p.userId === pk.userId)),
    ].filter(Boolean)

    const handlePick = async (userId) => {
        if (!isMyTurn || picking) return
        setPicking(true)
        try {
            await onPick(userId)
            await fetchDraftState()
        } catch (err) {
            console.error('Pick failed:', err)
        } finally {
            setPicking(false)
        }
    }

    const timerPct = timeLeft != null && lobby.pickTimer > 0
        ? Math.max(0, (timeLeft / lobby.pickTimer) * 100)
        : 100

    const timerColor = timeLeft != null && timeLeft <= 5 ? 'var(--arcade-loss)' : 'var(--arcade-cyan)'

    return (
        <div className="min-h-screen" style={{ background: 'var(--arcade-bg)' }}>
            <div className="max-w-6xl mx-auto px-4 pt-4 pb-16">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <button onClick={onBack} className="flex items-center gap-2 hover:opacity-70">
                        <ArrowLeft className="w-4 h-4" style={{ color: 'var(--arcade-text-mid)' }} />
                        <span className="arcade-label" style={{ color: 'var(--arcade-text-mid)' }}>BACK</span>
                    </button>
                    <h1 className="arcade-title text-sm" style={{ color: 'var(--arcade-magenta)' }}>
                        PLAYER SELECT
                    </h1>
                    <div className="arcade-label" style={{ color: 'var(--arcade-text-dim)' }}>
                        PICK {currentPick + 1}/8
                    </div>
                </div>

                {/* Turn indicator */}
                <div className="text-center mb-2">
                    {isMyTurn ? (
                        <p className="arcade-title text-sm arcade-flash" style={{ color: 'var(--arcade-yellow)' }}>
                            YOUR PICK
                        </p>
                    ) : (
                        <p className="arcade-label" style={{ color: currentCaptainSide ? SIDE_COLORS[currentCaptainSide] : 'var(--arcade-text-mid)' }}>
                            {currentCaptainSide === 'left' ? 'PLAYER 1' : 'PLAYER 2'} IS PICKING...
                        </p>
                    )}
                </div>

                {/* Timer bar */}
                <div className="mb-6 h-1 rounded-full overflow-hidden" style={{ background: 'var(--arcade-border)' }}>
                    <div
                        className="h-full rounded-full transition-all"
                        style={{
                            width: `${timerPct}%`,
                            background: timerColor,
                            boxShadow: `0 0 8px ${timerColor}`,
                        }}
                    />
                </div>
                {timeLeft != null && (
                    <div className="text-center mb-4">
                        <span className="arcade-title text-lg" style={{ color: timerColor }}>
                            {timeLeft}s
                        </span>
                    </div>
                )}

                {/* Main layout: Left Team | Pool | Right Team */}
                <div className="grid grid-cols-12 gap-4">
                    {/* Left team */}
                    <div className="col-span-3">
                        <DraftTeamColumn
                            label="LEFT SIDE"
                            color={SIDE_COLORS.left}
                            team={leftTeam}
                            captainId={captainLeftId}
                            isActive={currentCaptainSide === 'left'}
                        />
                    </div>

                    {/* Player pool */}
                    <div className="col-span-6">
                        <h3 className="arcade-label text-center mb-3" style={{ color: 'var(--arcade-text-mid)' }}>
                            AVAILABLE PLAYERS
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                            {pool.map(p => (
                                <DraftPlayerCard
                                    key={p.userId}
                                    player={p}
                                    canPick={isMyTurn && !picking}
                                    onPick={() => handlePick(p.userId)}
                                />
                            ))}
                        </div>
                        {pool.length === 0 && currentPick >= 8 && (
                            <div className="text-center py-8">
                                <p className="arcade-title text-sm" style={{ color: 'var(--arcade-win)' }}>
                                    DRAFT COMPLETE
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Right team */}
                    <div className="col-span-3">
                        <DraftTeamColumn
                            label="RIGHT SIDE"
                            color={SIDE_COLORS.right}
                            team={rightTeam}
                            captainId={captainRightId}
                            isActive={currentCaptainSide === 'right'}
                        />
                    </div>
                </div>

                {/* Pick history */}
                {picks.length > 0 && (
                    <div className="mt-6 pt-4" style={{ borderTop: '1px solid var(--arcade-border)' }}>
                        <h3 className="arcade-label mb-2" style={{ color: 'var(--arcade-text-dim)' }}>PICK ORDER</h3>
                        <div className="flex flex-wrap gap-2">
                            {picks.map((pk, i) => {
                                const player = participants.find(p => p.userId === pk.userId)
                                return (
                                    <span
                                        key={i}
                                        className="arcade-label px-2 py-1 rounded"
                                        style={{
                                            fontSize: '0.4rem',
                                            background: SIDE_COLORS[pk.side] + '15',
                                            color: SIDE_COLORS[pk.side],
                                        }}
                                    >
                                        #{i + 1} {player?.username || '?'}
                                        {pk.auto && ' (auto)'}
                                    </span>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}


function DraftTeamColumn({ label, color, team, captainId, isActive }) {
    return (
        <div
            className="rounded-lg p-3"
            style={{
                background: 'var(--arcade-panel)',
                border: `1.5px solid ${isActive ? color + '80' : 'var(--arcade-border)'}`,
                boxShadow: isActive ? `0 0 16px ${color}20` : 'none',
            }}
        >
            <h3
                className={`arcade-label text-center mb-3 ${isActive ? 'arcade-glow-cyan' : ''}`}
                style={{ color }}
            >
                {label}
            </h3>
            <div className="space-y-2">
                {[0, 1, 2, 3, 4].map(slot => {
                    const player = team[slot]
                    if (!player) {
                        return (
                            <div
                                key={slot}
                                className="h-8 rounded flex items-center justify-center"
                                style={{ background: 'var(--arcade-surface)', border: '1px dashed var(--arcade-border)' }}
                            >
                                <span className="arcade-label" style={{ color: 'var(--arcade-text-dim)', fontSize: '0.4rem' }}>
                                    EMPTY
                                </span>
                            </div>
                        )
                    }
                    const av = avatarUrl(player.discordId, player.avatar)
                    const isCaptain = player.userId === captainId
                    return (
                        <div
                            key={slot}
                            className="flex items-center gap-2 px-2 py-1.5 rounded"
                            style={{ background: 'var(--arcade-surface)' }}
                        >
                            {av ? (
                                <img src={av} alt="" className="w-5 h-5 rounded-full" />
                            ) : (
                                <div className="w-5 h-5 rounded-full" style={{ background: 'var(--arcade-border-lt)' }} />
                            )}
                            <span className="text-xs truncate flex-1" style={{ color: 'var(--arcade-text)' }}>
                                {player.username}
                            </span>
                            {isCaptain && <Crown className="w-3 h-3 shrink-0" style={{ color }} />}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}


function DraftPlayerCard({ player, canPick, onPick }) {
    const av = avatarUrl(player.discordId, player.avatar)

    return (
        <button
            onClick={canPick ? onPick : undefined}
            disabled={!canPick}
            className={`arcade-pick-card w-full text-left rounded p-3 ${canPick ? 'cursor-pointer' : 'cursor-default'}`}
            style={{ background: 'var(--arcade-surface)' }}
        >
            <div className="flex items-center gap-2 mb-2">
                {av ? (
                    <img src={av} alt="" className="w-8 h-8 rounded-full" />
                ) : (
                    <div className="w-8 h-8 rounded-full" style={{ background: 'var(--arcade-border-lt)' }} />
                )}
                <span className="text-sm font-medium truncate" style={{ color: 'var(--arcade-text)' }}>
                    {player.username}
                </span>
            </div>
            {player.preferredRoles.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {player.preferredRoles.map(role => (
                        <span
                            key={role}
                            className="arcade-label px-1.5 py-0.5 rounded"
                            style={{
                                fontSize: '0.4rem',
                                background: ROLE_COLORS[role] + '20',
                                color: ROLE_COLORS[role],
                            }}
                        >
                            {ROLE_LABELS[role]}
                        </span>
                    ))}
                </div>
            )}
        </button>
    )
}

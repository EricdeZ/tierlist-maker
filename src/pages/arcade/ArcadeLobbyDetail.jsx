import { useState, useMemo } from 'react'
import { ArrowLeft, Crown, UserMinus, Play, X as XIcon, LogIn } from 'lucide-react'
import { ROLES, ROLE_LABELS, ROLE_COLORS, STATUS_LABELS, STATUS_CSS, SIDE_COLORS, avatarUrl } from './arcadeConstants'

export default function ArcadeLobbyDetail({
    lobby, participants, votes, user, error,
    onJoin, onLeave, onKick, onSetCaptains, onStartDraft, onStartVoting, onCancel, onBack, onLogin,
}) {
    const [selectedRoles, setSelectedRoles] = useState([])
    const [joining, setJoining] = useState(false)
    const [captainLeft, setCaptainLeft] = useState(lobby.captainLeftId || null)
    const [captainRight, setCaptainRight] = useState(lobby.captainRightId || null)

    const isCreator = user?.id === lobby.creatorId
    const isParticipant = participants.some(p => p.userId === user?.id)
    const nonSubs = participants.filter(p => !p.isSub)
    const subs = participants.filter(p => p.isSub)
    const isFull = nonSubs.length >= lobby.maxPlayers
    const canStartDraft = isCreator && captainLeft && captainRight && captainLeft !== captainRight && nonSubs.length >= lobby.maxPlayers

    const isOpen = lobby.status === 'open' || lobby.status === 'ready'
    const isCompleted = lobby.status === 'completed'
    const isActive = lobby.status === 'active'

    // Team rosters for completed/active
    const leftTeam = useMemo(() => participants.filter(p => p.teamSide === 'left'), [participants])
    const rightTeam = useMemo(() => participants.filter(p => p.teamSide === 'right'), [participants])

    const toggleRole = (role) => {
        setSelectedRoles(prev =>
            prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
        )
    }

    const handleJoin = async () => {
        setJoining(true)
        try {
            await onJoin({ preferredRoles: selectedRoles })
        } catch {
            // error handled by parent
        } finally {
            setJoining(false)
        }
    }

    const handleSetCaptainsAndStart = async () => {
        try {
            if (lobby.captainLeftId !== captainLeft || lobby.captainRightId !== captainRight) {
                await onSetCaptains({ captainLeftId: captainLeft, captainRightId: captainRight })
            }
            await onStartDraft()
        } catch {
            // handled by parent
        }
    }

    return (
        <div className="min-h-screen" style={{ background: 'var(--arcade-bg)' }}>
            <div className="max-w-4xl mx-auto px-4 pt-6 pb-16">
                {/* Header */}
                <button onClick={onBack} className="flex items-center gap-2 mb-4 hover:opacity-70 transition-opacity">
                    <ArrowLeft className="w-4 h-4" style={{ color: 'var(--arcade-text-mid)' }} />
                    <span className="arcade-label" style={{ color: 'var(--arcade-text-mid)' }}>BACK</span>
                </button>

                <div className="flex items-center justify-between mb-6">
                    <div>
                        <span className={`arcade-status ${STATUS_CSS[lobby.status]}`}>
                            {STATUS_LABELS[lobby.status]}
                        </span>
                        <h1 className="arcade-title text-lg mt-2" style={{ color: 'var(--arcade-text)' }}>
                            {lobby.title}
                        </h1>
                        <p className="text-sm mt-1" style={{ color: 'var(--arcade-text-mid)' }}>
                            Hosted by {lobby.creatorName}
                        </p>
                    </div>
                    {isCreator && isOpen && (
                        <button
                            onClick={onCancel}
                            className="arcade-label px-3 py-1.5 rounded flex items-center gap-1.5 hover:opacity-80"
                            style={{ background: 'rgba(255,68,102,0.15)', color: 'var(--arcade-loss)' }}
                        >
                            <XIcon className="w-3 h-3" /> CANCEL
                        </button>
                    )}
                </div>

                {error && (
                    <div className="mb-4 px-3 py-2 rounded text-sm" style={{ background: 'rgba(255,68,102,0.1)', color: 'var(--arcade-loss)' }}>
                        {error}
                    </div>
                )}

                {/* Active/completed: show teams */}
                {(isActive || isCompleted) && (
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <TeamRoster
                            label="LEFT SIDE"
                            color={SIDE_COLORS.left}
                            players={leftTeam}
                            captainId={lobby.captainLeftId}
                            isWinner={lobby.winningSide === 'left'}
                        />
                        <TeamRoster
                            label="RIGHT SIDE"
                            color={SIDE_COLORS.right}
                            players={rightTeam}
                            captainId={lobby.captainRightId}
                            isWinner={lobby.winningSide === 'right'}
                        />
                    </div>
                )}

                {/* Active: start voting button */}
                {isActive && isCreator && (
                    <div className="text-center mb-6">
                        <button
                            onClick={onStartVoting}
                            className="arcade-label px-6 py-3 rounded transition-all hover:scale-105 arcade-flash"
                            style={{ background: 'var(--arcade-yellow)', color: 'var(--arcade-bg)' }}
                        >
                            GAME OVER — START VOTE
                        </button>
                    </div>
                )}

                {/* Completed: show result */}
                {isCompleted && lobby.winningSide && (
                    <div className="text-center mb-6 py-4 rounded" style={{ background: 'var(--arcade-surface)' }}>
                        <p className="arcade-title text-sm" style={{ color: SIDE_COLORS[lobby.winningSide] }}>
                            {lobby.winningSide === 'left' ? 'LEFT SIDE' : 'RIGHT SIDE'} WINS
                        </p>
                    </div>
                )}

                {/* Open/ready: signup phase */}
                {isOpen && (
                    <>
                        {/* Player list */}
                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="arcade-label" style={{ color: 'var(--arcade-text-mid)' }}>
                                    PLAYERS ({nonSubs.length}/{lobby.maxPlayers})
                                </h2>
                                {/* Coin slots */}
                                <div className="flex gap-1">
                                    {Array.from({ length: lobby.maxPlayers }, (_, i) => (
                                        <div key={i} className={`arcade-coin ${i < nonSubs.length ? 'filled' : ''}`} />
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                {nonSubs.map(p => (
                                    <PlayerRow
                                        key={p.userId}
                                        player={p}
                                        isCreator={isCreator}
                                        isSelf={p.userId === user?.id}
                                        isLobbyCreator={p.userId === lobby.creatorId}
                                        isCaptainLeft={p.userId === captainLeft}
                                        isCaptainRight={p.userId === captainRight}
                                        onKick={() => onKick(p.userId)}
                                        onSetCaptainLeft={() => setCaptainLeft(p.userId)}
                                        onSetCaptainRight={() => setCaptainRight(p.userId)}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Subs */}
                        {subs.length > 0 && (
                            <div className="mb-6">
                                <h2 className="arcade-label mb-3" style={{ color: 'var(--arcade-text-dim)' }}>
                                    SUBS ({subs.length}/{lobby.maxSubs})
                                </h2>
                                <div className="space-y-2">
                                    {subs.map(p => (
                                        <PlayerRow
                                            key={p.userId}
                                            player={p}
                                            isCreator={isCreator}
                                            isSelf={p.userId === user?.id}
                                            onKick={() => onKick(p.userId)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Join/Leave actions */}
                        <div className="mt-6 space-y-4">
                            {!user && (
                                <button
                                    onClick={onLogin}
                                    className="arcade-label w-full py-3 rounded flex items-center justify-center gap-2"
                                    style={{ background: 'var(--arcade-cyan-dim)', color: 'var(--arcade-cyan)' }}
                                >
                                    <LogIn className="w-3.5 h-3.5" /> LOGIN TO JOIN
                                </button>
                            )}

                            {user && !isParticipant && !isFull && (
                                <div>
                                    <p className="arcade-label mb-2" style={{ color: 'var(--arcade-text-mid)' }}>
                                        PREFERRED ROLES
                                    </p>
                                    <div className="flex gap-2 mb-3">
                                        {ROLES.map(role => (
                                            <button
                                                key={role}
                                                onClick={() => toggleRole(role)}
                                                className="arcade-label px-3 py-1.5 rounded transition-all"
                                                style={{
                                                    background: selectedRoles.includes(role) ? ROLE_COLORS[role] + '30' : 'var(--arcade-surface)',
                                                    color: selectedRoles.includes(role) ? ROLE_COLORS[role] : 'var(--arcade-text-dim)',
                                                    border: `1px solid ${selectedRoles.includes(role) ? ROLE_COLORS[role] + '60' : 'var(--arcade-border)'}`,
                                                }}
                                            >
                                                {ROLE_LABELS[role]}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        onClick={handleJoin}
                                        disabled={joining}
                                        className="arcade-label w-full py-3 rounded transition-all hover:scale-[1.02] disabled:opacity-50"
                                        style={{ background: 'var(--arcade-cyan)', color: 'var(--arcade-bg)' }}
                                    >
                                        {joining ? 'JOINING...' : 'INSERT COIN'}
                                    </button>
                                </div>
                            )}

                            {user && isParticipant && !isCreator && (
                                <button
                                    onClick={onLeave}
                                    className="arcade-label w-full py-2 rounded hover:opacity-80"
                                    style={{ background: 'rgba(255,68,102,0.1)', color: 'var(--arcade-loss)' }}
                                >
                                    LEAVE GAME
                                </button>
                            )}
                        </div>

                        {/* Creator: captain assignment + start draft */}
                        {isCreator && isFull && (
                            <div className="mt-6 p-4 rounded" style={{ background: 'var(--arcade-surface)', border: '1px solid var(--arcade-border)' }}>
                                <h3 className="arcade-label mb-3" style={{ color: 'var(--arcade-yellow)' }}>
                                    ASSIGN CAPTAINS
                                </h3>
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <CaptainSelect
                                        label="PLAYER 1 (LEFT)"
                                        color={SIDE_COLORS.left}
                                        value={captainLeft}
                                        onChange={setCaptainLeft}
                                        players={nonSubs}
                                        excludeId={captainRight}
                                    />
                                    <CaptainSelect
                                        label="PLAYER 2 (RIGHT)"
                                        color={SIDE_COLORS.right}
                                        value={captainRight}
                                        onChange={setCaptainRight}
                                        players={nonSubs}
                                        excludeId={captainLeft}
                                    />
                                </div>
                                <button
                                    onClick={handleSetCaptainsAndStart}
                                    disabled={!canStartDraft}
                                    className="arcade-label w-full py-3 rounded transition-all hover:scale-[1.02] disabled:opacity-30"
                                    style={{ background: 'var(--arcade-yellow)', color: 'var(--arcade-bg)' }}
                                >
                                    START DRAFT
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}


function PlayerRow({ player, isCreator, isSelf, isLobbyCreator, isCaptainLeft, isCaptainRight, onKick, onSetCaptainLeft, onSetCaptainRight }) {
    const avatar = avatarUrl(player.discordId, player.avatar)
    const isCaptain = isCaptainLeft || isCaptainRight
    const captainColor = isCaptainLeft ? SIDE_COLORS.left : isCaptainRight ? SIDE_COLORS.right : null

    return (
        <div
            className="flex items-center gap-3 px-3 py-2 rounded"
            style={{
                background: isCaptain ? captainColor + '10' : 'var(--arcade-surface)',
                border: `1px solid ${isCaptain ? captainColor + '40' : 'var(--arcade-border)'}`,
            }}
        >
            {avatar ? (
                <img src={avatar} alt="" className="w-6 h-6 rounded-full" />
            ) : (
                <div className="w-6 h-6 rounded-full" style={{ background: 'var(--arcade-border-lt)' }} />
            )}

            <span className="text-sm flex-1" style={{ color: 'var(--arcade-text)' }}>
                {player.username}
                {isLobbyCreator && <span className="ml-1 text-xs" style={{ color: 'var(--arcade-text-dim)' }}>(host)</span>}
            </span>

            {/* Roles */}
            {player.preferredRoles.length > 0 && (
                <div className="flex gap-1">
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
                            {role.slice(0, 3).toUpperCase()}
                        </span>
                    ))}
                </div>
            )}

            {/* Captain badge */}
            {isCaptain && (
                <Crown className="w-3.5 h-3.5" style={{ color: captainColor }} />
            )}

            {/* Creator actions */}
            {isCreator && !isSelf && !isLobbyCreator && (
                <div className="flex gap-1">
                    {onSetCaptainLeft && !isCaptainLeft && (
                        <button
                            onClick={onSetCaptainLeft}
                            className="p-1 rounded hover:opacity-80"
                            title="Set as Player 1 (Left)"
                            style={{ color: SIDE_COLORS.left }}
                        >
                            <Crown className="w-3 h-3" />
                        </button>
                    )}
                    {onSetCaptainRight && !isCaptainRight && (
                        <button
                            onClick={onSetCaptainRight}
                            className="p-1 rounded hover:opacity-80"
                            title="Set as Player 2 (Right)"
                            style={{ color: SIDE_COLORS.right }}
                        >
                            <Crown className="w-3 h-3" />
                        </button>
                    )}
                    <button onClick={onKick} className="p-1 rounded hover:opacity-80" title="Kick">
                        <UserMinus className="w-3 h-3" style={{ color: 'var(--arcade-loss)' }} />
                    </button>
                </div>
            )}
        </div>
    )
}


function CaptainSelect({ label, color, value, onChange, players, excludeId }) {
    return (
        <div>
            <label className="arcade-label block mb-1" style={{ color, fontSize: '0.45rem' }}>
                {label}
            </label>
            <select
                value={value || ''}
                onChange={e => onChange(Number(e.target.value) || null)}
                className="w-full px-2 py-1.5 rounded text-sm"
                style={{
                    background: 'var(--arcade-bg)',
                    border: `1px solid ${color}40`,
                    color: 'var(--arcade-text)',
                }}
            >
                <option value="">Select captain...</option>
                {players.filter(p => p.userId !== excludeId).map(p => (
                    <option key={p.userId} value={p.userId}>{p.username}</option>
                ))}
            </select>
        </div>
    )
}


function TeamRoster({ label, color, players, captainId, isWinner }) {
    return (
        <div
            className="rounded p-4"
            style={{
                background: isWinner ? color + '10' : 'var(--arcade-surface)',
                border: `1.5px solid ${isWinner ? color + '60' : 'var(--arcade-border)'}`,
            }}
        >
            <h3 className="arcade-label mb-3 flex items-center gap-2" style={{ color }}>
                {label}
                {isWinner && <span className="arcade-label" style={{ color: 'var(--arcade-win)', fontSize: '0.45rem' }}>WINNER</span>}
            </h3>
            <div className="space-y-1.5">
                {players.map(p => {
                    const av = avatarUrl(p.discordId, p.avatar)
                    return (
                        <div key={p.userId} className="flex items-center gap-2">
                            {av ? (
                                <img src={av} alt="" className="w-5 h-5 rounded-full" />
                            ) : (
                                <div className="w-5 h-5 rounded-full" style={{ background: 'var(--arcade-border-lt)' }} />
                            )}
                            <span className="text-sm" style={{ color: 'var(--arcade-text)' }}>
                                {p.username}
                            </span>
                            {p.userId === captainId && (
                                <Crown className="w-3 h-3" style={{ color }} />
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

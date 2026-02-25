import { useState } from 'react'
import { ArrowLeft, Crown } from 'lucide-react'
import { SIDE_COLORS, avatarUrl } from './arcadeConstants'

export default function ArcadeVoting({ lobby, participants, votes, user, onVote, onBack, onRefresh }) {
    const [voting, setVoting] = useState(false)

    const leftTeam = participants.filter(p => p.teamSide === 'left' && !p.isSub)
    const rightTeam = participants.filter(p => p.teamSide === 'right' && !p.isSub)

    const isParticipant = user && participants.some(p => p.userId === user.id && !p.isSub)
    const hasVoted = votes?.userVote != null

    const handleVote = async (side) => {
        if (voting) return
        setVoting(true)
        try {
            await onVote(side)
            await onRefresh()
        } catch (err) {
            console.error('Vote failed:', err)
        } finally {
            setVoting(false)
        }
    }

    const leftPct = votes && votes.totalWeight > 0
        ? Math.round((votes.leftTotal / votes.totalWeight) * 100)
        : 0
    const rightPct = votes && votes.totalWeight > 0
        ? Math.round((votes.rightTotal / votes.totalWeight) * 100)
        : 0

    return (
        <div className="min-h-screen" style={{ background: 'var(--arcade-bg)' }}>
            <div className="max-w-4xl mx-auto px-4 pt-6 pb-16">
                <button onClick={onBack} className="flex items-center gap-2 mb-4 hover:opacity-70">
                    <ArrowLeft className="w-4 h-4" style={{ color: 'var(--arcade-text-mid)' }} />
                    <span className="arcade-label" style={{ color: 'var(--arcade-text-mid)' }}>BACK</span>
                </button>

                {/* GAME OVER header */}
                <div className="text-center mb-8">
                    <h1
                        className="arcade-title text-2xl mb-2"
                        style={{ color: 'var(--arcade-yellow)' }}
                    >
                        GAME OVER
                    </h1>
                    <p className="arcade-label" style={{ color: 'var(--arcade-text-mid)' }}>
                        {lobby.title}
                    </p>
                </div>

                {/* VS layout */}
                <div className="grid grid-cols-11 gap-2 mb-8">
                    {/* Left team */}
                    <div className="col-span-5">
                        <VoteTeam
                            label="LEFT SIDE"
                            color={SIDE_COLORS.left}
                            team={leftTeam}
                            captainId={lobby.captainLeftId}
                            selected={votes?.userVote === 'left'}
                            canVote={isParticipant && !voting}
                            onVote={() => handleVote('left')}
                        />
                    </div>

                    {/* VS */}
                    <div className="col-span-1 flex items-center justify-center">
                        <span className="arcade-title text-sm" style={{ color: 'var(--arcade-text-dim)' }}>VS</span>
                    </div>

                    {/* Right team */}
                    <div className="col-span-5">
                        <VoteTeam
                            label="RIGHT SIDE"
                            color={SIDE_COLORS.right}
                            team={rightTeam}
                            captainId={lobby.captainRightId}
                            selected={votes?.userVote === 'right'}
                            canVote={isParticipant && !voting}
                            onVote={() => handleVote('right')}
                        />
                    </div>
                </div>

                {/* Vote tally bar */}
                {votes && (
                    <div className="mb-6">
                        <div className="flex justify-between mb-1">
                            <span className="arcade-label" style={{ color: SIDE_COLORS.left }}>
                                {votes.leftTotal} ({leftPct}%)
                            </span>
                            <span className="arcade-label" style={{ color: 'var(--arcade-text-dim)' }}>
                                NEED {votes.majorityNeeded}
                            </span>
                            <span className="arcade-label" style={{ color: SIDE_COLORS.right }}>
                                {votes.rightTotal} ({rightPct}%)
                            </span>
                        </div>
                        <div className="flex h-3 rounded-full overflow-hidden" style={{ background: 'var(--arcade-border)' }}>
                            <div
                                className="transition-all"
                                style={{
                                    width: `${leftPct}%`,
                                    background: SIDE_COLORS.left,
                                    boxShadow: `0 0 8px ${SIDE_COLORS.left}`,
                                }}
                            />
                            <div className="flex-1" />
                            <div
                                className="transition-all"
                                style={{
                                    width: `${rightPct}%`,
                                    background: SIDE_COLORS.right,
                                    boxShadow: `0 0 8px ${SIDE_COLORS.right}`,
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* Status messages */}
                {!user && (
                    <p className="text-center arcade-label" style={{ color: 'var(--arcade-text-dim)' }}>
                        LOG IN TO VOTE
                    </p>
                )}
                {user && !isParticipant && (
                    <p className="text-center arcade-label" style={{ color: 'var(--arcade-text-dim)' }}>
                        ONLY PARTICIPANTS CAN VOTE
                    </p>
                )}
                {hasVoted && (
                    <p className="text-center arcade-label" style={{ color: 'var(--arcade-win)' }}>
                        VOTE CAST — {votes.userVote === 'left' ? 'LEFT SIDE' : 'RIGHT SIDE'}
                    </p>
                )}
            </div>
        </div>
    )
}


function VoteTeam({ label, color, team, captainId, selected, canVote, onVote }) {
    return (
        <div
            className="rounded-lg p-4 transition-all"
            style={{
                background: selected ? color + '15' : 'var(--arcade-panel)',
                border: `2px solid ${selected ? color : 'var(--arcade-border)'}`,
                boxShadow: selected ? `0 0 20px ${color}30` : 'none',
            }}
        >
            <h3 className="arcade-label text-center mb-3" style={{ color }}>
                {label}
            </h3>

            <div className="space-y-1.5 mb-4">
                {team.map(p => {
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
                            {p.userId === captainId && <Crown className="w-3 h-3" style={{ color }} />}
                        </div>
                    )
                })}
            </div>

            {canVote && (
                <button
                    onClick={onVote}
                    className={`arcade-label w-full py-2 rounded transition-all ${
                        selected ? 'opacity-60' : 'hover:scale-[1.02]'
                    }`}
                    style={{
                        background: selected ? color + '40' : color,
                        color: selected ? color : 'var(--arcade-bg)',
                    }}
                >
                    {selected ? 'VOTED' : 'THIS TEAM WON'}
                </button>
            )}
        </div>
    )
}

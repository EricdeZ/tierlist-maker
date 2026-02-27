import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { passionService } from '../services/database'
import { useAuth } from '../context/AuthContext'
import { getRank } from '../config/ranks'
import RankBadge from '../components/RankBadge'
import PageTitle from '../components/PageTitle'
import Navbar from '../components/layout/Navbar'
import passionCoin from '../assets/passion/passion.png'
import passionrain from '../assets/passion/passionrain.jpg'

// ─── Podium position configs ─────────────────────
const PODIUM = [
    { label: '1st', height: 'h-28 sm:h-36', gradient: 'from-yellow-500/30 via-amber-400/10 to-transparent', border: 'border-yellow-500/40', glow: 'shadow-[0_0_40px_rgba(234,179,8,0.3)]', text: 'text-yellow-400', medal: '👑' },
    { label: '2nd', height: 'h-20 sm:h-24', gradient: 'from-gray-300/20 via-gray-400/5 to-transparent', border: 'border-gray-400/30', glow: '', text: 'text-gray-300', medal: '🥈' },
    { label: '3rd', height: 'h-16 sm:h-20', gradient: 'from-amber-700/25 via-amber-800/5 to-transparent', border: 'border-amber-700/30', glow: '', text: 'text-amber-600', medal: '🥉' },
]

export default function PassionLeaderboard() {
    const { user, login } = useAuth()
    const [period, setPeriod] = useState('recent')
    const [leaderboard, setLeaderboard] = useState([])
    const [loading, setLoading] = useState(true)

    const loadLeaderboard = useCallback((p) => {
        setLoading(true)
        passionService.getLeaderboard(p)
            .then(data => setLeaderboard(data.leaderboard || []))
            .catch(err => console.error('Failed to load leaderboard:', err))
            .finally(() => setLoading(false))
    }, [])

    useEffect(() => { loadLeaderboard(period) }, [period, loadLeaderboard])

    const togglePeriod = (p) => {
        if (p !== period) setPeriod(p)
    }

    const isRecent = period === 'recent'
    const top3 = leaderboard.slice(0, 3)
    const rest = leaderboard.slice(3)
    // Reorder for podium display: [2nd, 1st, 3rd]
    const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3

    return (
        <div className="min-h-screen bg-(--color-primary) text-(--color-text)">
            <Navbar title="Leaderboard" />
            <PageTitle title="Passion Leaderboard" description="See who has earned the most Passion on SMITE 2 Companion. Climb the ranks from Clay to Deity and prove your dedication." />

            <div className="max-w-4xl mx-auto px-4 pt-24 pb-8">

                {/* Header */}
                <div className="text-center mb-6">
                    <h1 className="text-3xl sm:text-4xl font-bold font-heading">
                        Passion Leaderboard
                    </h1>
                    <p className="text-sm text-(--color-text-secondary)/60 mt-1">
                        {isRecent ? 'Top earners in the last 14 days' : 'All-time top earners'}
                    </p>
                </div>

                {/* Login prompt */}
                {!user && (
                    <div className="flex items-center justify-between gap-4 mb-6 px-5 py-4 rounded-xl border border-(--color-accent)/15 bg-(--color-accent)/[0.04]">
                        <div className="flex items-center gap-3 min-w-0">
                            <img src={passionCoin} alt="" className="w-8 h-8 shrink-0 opacity-60" />
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-(--color-text)">Show your Passion!</p>
                                <p className="text-xs text-(--color-text-secondary)/50">Log in to earn Passion and climb the leaderboard</p>
                            </div>
                        </div>
                        <button
                            onClick={login}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs text-white transition-all hover:opacity-90 active:scale-95 cursor-pointer shrink-0"
                            style={{ backgroundColor: '#5865F2' }}
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                            </svg>
                            Log in with Discord
                        </button>
                    </div>
                )}

                {/* Period toggle */}
                <div className="flex justify-center mb-8">
                    <div className="inline-flex rounded-lg border border-white/10 bg-(--color-secondary) p-1">
                        <button
                            onClick={() => togglePeriod('recent')}
                            className={`px-5 py-2 rounded-md text-sm font-medium transition-all cursor-pointer ${
                                isRecent
                                    ? 'bg-(--color-accent)/20 text-(--color-accent) shadow-sm'
                                    : 'text-(--color-text-secondary)/60 hover:text-(--color-text)'
                            }`}
                        >
                            Recent
                        </button>
                        <button
                            onClick={() => togglePeriod('lifetime')}
                            className={`px-5 py-2 rounded-md text-sm font-medium transition-all cursor-pointer ${
                                !isRecent
                                    ? 'bg-(--color-accent)/20 text-(--color-accent) shadow-sm'
                                    : 'text-(--color-text-secondary)/60 hover:text-(--color-text)'
                            }`}
                        >
                            Lifetime
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="space-y-4">
                        <div className="h-64 rounded-xl bg-(--color-secondary) border border-white/[0.06] animate-pulse" />
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-16 rounded-xl bg-(--color-secondary) border border-white/[0.06] animate-pulse" />
                        ))}
                    </div>
                ) : leaderboard.length === 0 ? (
                    <div className="text-center py-16">
                        <img src={passionCoin} alt="" className="w-16 h-16 mx-auto mb-4 opacity-30" />
                        <p className="text-(--color-text-secondary)/50 text-lg">
                            {isRecent ? 'No one has earned Passion in the last 14 days.' : 'No one has earned Passion yet.'}
                        </p>
                        <p className="text-(--color-text-secondary)/30 text-sm mt-1">Be the first!</p>
                    </div>
                ) : (
                    <>
                        {/* ═══ Top 3 Podium ═══ */}
                        {top3.length >= 3 && (
                            <div className="relative rounded-xl border border-white/[0.08] bg-(--color-secondary) overflow-hidden mb-6">
                                {/* Background fire/rain image */}
                                <div className="absolute inset-0 opacity-[0.07]"
                                    style={{ backgroundImage: `url(${passionrain})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                                />
                                {/* Floating coins */}
                                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                                    {[...Array(12)].map((_, i) => (
                                        <img key={i} src={passionCoin} alt=""
                                            className="absolute opacity-0"
                                            style={{
                                                width: `${12 + Math.random() * 14}px`,
                                                left: `${5 + Math.random() * 90}%`,
                                                animation: `coin-float ${3 + Math.random() * 4}s ease-in-out ${Math.random() * 5}s infinite`,
                                            }}
                                        />
                                    ))}
                                </div>

                                <div className="relative z-10 px-4 sm:px-8 pt-8 pb-6">
                                    {/* Podium cards: 2nd, 1st, 3rd */}
                                    <div className="flex items-end justify-center gap-3 sm:gap-6">
                                        {podiumOrder.map((entry, displayIdx) => {
                                            // Map display positions back: [0→2nd, 1→1st, 2→3rd]
                                            const realIdx = displayIdx === 0 ? 1 : displayIdx === 1 ? 0 : 2
                                            const p = PODIUM[realIdx]
                                            const entryRank = getRank(entry.totalEarned)
                                            const avatarUrl = entry.discordAvatar
                                                ? `https://cdn.discordapp.com/avatars/${entry.discordId}/${entry.discordAvatar}.png?size=128`
                                                : null
                                            const isMe = user && entry.userId === user.id
                                            const displayValue = isRecent ? (entry.recentEarned || entry.totalEarned) : entry.totalEarned
                                            const isFirst = realIdx === 0

                                            return (
                                                <div key={entry.userId}
                                                    className={`flex flex-col items-center ${isFirst ? 'order-2' : realIdx === 1 ? 'order-1' : 'order-3'}`}
                                                    style={{ animation: `podium-rise 0.6s ease-out ${realIdx * 0.15}s both` }}
                                                >
                                                    {/* Medal */}
                                                    <span className="text-xl sm:text-2xl mb-1">{p.medal}</span>

                                                    {/* Avatar */}
                                                    <div className={`relative mb-2 ${p.glow}`}>
                                                        <div className={`rounded-full border-2 ${p.border} overflow-hidden ${isFirst ? 'w-20 h-20 sm:w-24 sm:h-24' : 'w-14 h-14 sm:w-18 sm:h-18'}`}>
                                                            {avatarUrl ? (
                                                                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full bg-[#5865F2] flex items-center justify-center text-white font-bold text-xl">
                                                                    {entry.discordUsername?.[0]?.toUpperCase()}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Rank badge overlay */}
                                                        <div className="absolute -bottom-1 -right-1">
                                                            <RankBadge rank={entryRank} size="sm" />
                                                        </div>
                                                    </div>

                                                    {/* Name */}
                                                    {entry.playerSlug ? (
                                                        <Link to={`/profile/${entry.playerSlug}`} className={`font-bold text-xs sm:text-sm truncate max-w-[100px] sm:max-w-[140px] text-center hover:underline ${isMe ? 'text-(--color-accent)' : ''}`}>
                                                            {entry.discordUsername}
                                                        </Link>
                                                    ) : (
                                                        <span className={`font-bold text-xs sm:text-sm truncate max-w-[100px] sm:max-w-[140px] text-center ${isMe ? 'text-(--color-accent)' : ''}`}>
                                                            {entry.discordUsername}
                                                        </span>
                                                    )}

                                                    {/* Passion earned */}
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <img src={passionCoin} alt="" className={`${isFirst ? 'w-5 h-5' : 'w-4 h-4'}`} />
                                                        <span className={`font-bold tabular-nums ${p.text} ${isFirst ? 'text-lg sm:text-xl' : 'text-sm sm:text-base'}`}>
                                                            {displayValue?.toLocaleString()}
                                                        </span>
                                                    </div>

                                                    {/* Streak */}
                                                    {entry.currentStreak > 0 && (
                                                        <span className="text-[10px] text-(--color-text-secondary)/50 mt-0.5">
                                                            {entry.currentStreak}d streak
                                                        </span>
                                                    )}

                                                    {/* Podium bar */}
                                                    <div className={`${p.height} w-20 sm:w-28 mt-3 rounded-t-lg border-t border-x ${p.border} bg-gradient-to-b ${p.gradient}`}>
                                                        <div className="text-center pt-2">
                                                            <span className={`text-xs font-bold ${p.text}`}>#{entry.position}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ═══ Remaining positions ═══ */}
                        {rest.length > 0 && (
                            <div className="space-y-2">
                                {rest.map((entry) => {
                                    const isMe = user && entry.userId === user.id
                                    const entryRank = getRank(entry.totalEarned)
                                    const avatarUrl = entry.discordAvatar
                                        ? `https://cdn.discordapp.com/avatars/${entry.discordId}/${entry.discordAvatar}.png?size=64`
                                        : null
                                    const displayValue = isRecent ? (entry.recentEarned || entry.totalEarned) : entry.totalEarned

                                    return (
                                        <div key={entry.userId}
                                            className={`flex items-center gap-3 sm:gap-4 px-4 py-3 rounded-xl border transition-all
                                                ${isMe
                                                    ? 'bg-(--color-accent)/[0.06] border-(--color-accent)/20'
                                                    : 'bg-(--color-secondary) border-white/[0.06] hover:border-white/10'
                                                }`}
                                            style={{ animation: `card-enter 0.3s ease-out ${(entry.position - 4) * 0.04}s both` }}
                                        >
                                            {/* Position */}
                                            <span className="text-sm font-bold text-(--color-text-secondary)/40 w-8 text-center tabular-nums shrink-0">
                                                {entry.position}
                                            </span>

                                            {/* Avatar */}
                                            <div className="shrink-0">
                                                {avatarUrl ? (
                                                    <img src={avatarUrl} alt="" className="w-10 h-10 rounded-full" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-[#5865F2] flex items-center justify-center text-white text-sm font-bold">
                                                        {entry.discordUsername?.[0]?.toUpperCase()}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Name + rank */}
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                {entry.playerSlug ? (
                                                    <Link to={`/profile/${entry.playerSlug}`} className={`font-medium text-sm truncate hover:underline ${isMe ? 'text-(--color-accent)' : ''}`}>
                                                        {entry.discordUsername}
                                                        {isMe && <span className="text-xs text-(--color-text-secondary)/50 ml-1">(you)</span>}
                                                    </Link>
                                                ) : (
                                                    <span className={`font-medium text-sm truncate ${isMe ? 'text-(--color-accent)' : ''}`}>
                                                        {entry.discordUsername}
                                                        {isMe && <span className="text-xs text-(--color-text-secondary)/50 ml-1">(you)</span>}
                                                    </span>
                                                )}
                                                <RankBadge rank={entryRank} size="sm" />
                                            </div>

                                            {/* Passion */}
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <img src={passionCoin} alt="" className="w-4 h-4" />
                                                <span className="font-bold text-sm tabular-nums" style={{ color: '#f8c56a' }}>
                                                    {displayValue?.toLocaleString()}
                                                </span>
                                            </div>

                                            {/* Streak (desktop) */}
                                            <div className="hidden sm:flex items-center w-16 justify-end shrink-0">
                                                {entry.currentStreak > 0 && (
                                                    <span className="text-xs text-(--color-text-secondary)/50 tabular-nums">
                                                        {entry.currentStreak}d
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>

            <style>{`
                @keyframes coin-float {
                    0% { opacity: 0; transform: translateY(-100%) rotate(0deg); }
                    5% { opacity: 0.4; }
                    75% { opacity: 0.3; }
                    95% { opacity: 0; transform: translateY(300%) rotate(360deg); }
                    100% { opacity: 0; transform: translateY(300%) rotate(360deg); }
                }
                @keyframes podium-rise {
                    0% { opacity: 0; transform: translateY(30px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                @keyframes card-enter {
                    0% { opacity: 0; transform: translateY(12px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    )
}

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { usePassion } from '../context/PassionContext'
import { coinflipService } from '../services/database'
import { getRank } from '../config/ranks'
import RankBadge from '../components/RankBadge'
import PageTitle from '../components/PageTitle'
import SimpleNav from '../components/layout/SimpleNav'
import passionCoin from '../assets/passion/passion.png'
import passionTails from '../assets/passion/passiontails.png'
import flip1 from '../assets/passion/flipping1.png'
import flip2 from '../assets/passion/flipping2.png'
import flip3 from '../assets/passion/flipping3.png'
import passionsplosion from '../assets/passion/passionsplosion.png'

const FLIP_FRAMES = [flip1, flip2, flip3, passionCoin]

export default function CoinFlip() {
    const { user } = useAuth()
    const { balance, refreshBalance } = usePassion()

    const [flipping, setFlipping] = useState(false)
    const [lastResult, setLastResult] = useState(null)       // 'heads' | 'tails' | null
    const [currentStreak, setCurrentStreak] = useState(0)
    const [bestStreak, setBestStreak] = useState(0)
    const [totalFlips, setTotalFlips] = useState(0)
    const [totalHeads, setTotalHeads] = useState(0)
    const [localBalance, setLocalBalance] = useState(null)
    const [leaderboard, setLeaderboard] = useState([])
    const [leaderboardLoading, setLeaderboardLoading] = useState(true)
    const [statsLoading, setStatsLoading] = useState(true)
    const [flipFrame, setFlipFrame] = useState(0)
    const [showExplosion, setShowExplosion] = useState(false)
    const [resultDelta, setResultDelta] = useState(null)     // +1 or -1
    const [shake, setShake] = useState(false)
    const [streakBroken, setStreakBroken] = useState(null)    // streak value that was broken
    const flipInterval = useRef(null)

    // Load leaderboard
    const loadLeaderboard = useCallback(() => {
        coinflipService.getLeaderboard()
            .then(data => setLeaderboard(data.leaderboard || []))
            .catch(err => console.error('Failed to load coinflip leaderboard:', err))
            .finally(() => setLeaderboardLoading(false))
    }, [])

    // Load user stats
    useEffect(() => {
        if (!user) {
            setStatsLoading(false)
            return
        }
        coinflipService.getMyStats()
            .then(data => {
                setCurrentStreak(data.currentStreak || 0)
                setBestStreak(data.bestStreak || 0)
                setTotalFlips(data.totalFlips || 0)
                setTotalHeads(data.totalHeads || 0)
            })
            .catch(err => console.error('Failed to load coinflip stats:', err))
            .finally(() => setStatsLoading(false))
    }, [user])

    useEffect(() => { loadLeaderboard() }, [loadLeaderboard])

    // Sync local balance from passion context
    useEffect(() => {
        if (localBalance === null && balance !== undefined) {
            setLocalBalance(balance)
        }
    }, [balance, localBalance])

    // Coin flip animation
    useEffect(() => {
        if (flipping) {
            let frame = 0
            flipInterval.current = setInterval(() => {
                frame = (frame + 1) % FLIP_FRAMES.length
                setFlipFrame(frame)
            }, 100)
        } else {
            clearInterval(flipInterval.current)
            setFlipFrame(0)
        }
        return () => clearInterval(flipInterval.current)
    }, [flipping])

    const displayBalance = localBalance !== null ? localBalance : balance

    const handleFlip = async () => {
        if (flipping || !user) return
        if (displayBalance < 1) return

        setFlipping(true)
        setLastResult(null)
        setResultDelta(null)
        setShake(false)
        setStreakBroken(null)

        const prevStreak = currentStreak

        // Fire API + minimum animation time in parallel
        const [data] = await Promise.all([
            coinflipService.flip(),
            new Promise(resolve => setTimeout(resolve, 800)),
        ])

        if (data.error === 'insufficient_balance') {
            setFlipping(false)
            setLocalBalance(data.balance)
            return
        }

        setFlipping(false)
        setLastResult(data.result)

        if (data.result === 'heads') {
            setResultDelta(+1)
            setCurrentStreak(data.currentStreak)
            setBestStreak(data.bestStreak)
            setTotalFlips(data.totalFlips)
            setTotalHeads(data.totalHeads)
            setLocalBalance(data.balance)

            // Explosion on milestone streaks
            if (data.currentStreak > 0 && data.currentStreak % 5 === 0) {
                setShowExplosion(true)
                setTimeout(() => setShowExplosion(false), 1200)
            }

            // Refresh leaderboard (might have new best)
            loadLeaderboard()
        } else {
            setResultDelta(-1)
            setShake(true)
            if (prevStreak >= 3) {
                setStreakBroken(prevStreak)
            }
            setCurrentStreak(data.currentStreak)
            setBestStreak(data.bestStreak)
            setTotalFlips(data.totalFlips)
            setTotalHeads(data.totalHeads)
            setLocalBalance(data.balance)
            setTimeout(() => setShake(false), 600)
        }

        // Sync passion context balance
        refreshBalance()
    }

    const canFlip = user && !flipping && displayBalance >= 1

    // Determine coin image to show
    let coinImage = passionCoin
    if (flipping) {
        coinImage = FLIP_FRAMES[flipFrame]
    } else if (lastResult === 'heads') {
        coinImage = passionCoin
    } else if (lastResult === 'tails') {
        coinImage = passionTails
    }

    return (
        <div className="min-h-screen bg-(--color-primary) text-(--color-text)">
            <SimpleNav title="Coin Flip" />
            <PageTitle title="Coin Flip" />

            <div className="max-w-6xl mx-auto px-4 pt-24 pb-8">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

                    {/* ═══ Left: Coin Flip Game ═══ */}
                    <div className="lg:col-span-2 flex flex-col items-center">
                        <div className="w-full max-w-sm bg-(--color-secondary) rounded-2xl border border-white/[0.08] p-6 sm:p-8 flex flex-col items-center">

                            <h1 className="text-2xl sm:text-3xl font-bold font-heading mb-1 text-center">
                                Coin Flip
                            </h1>
                            <p className="text-xs text-(--color-text-secondary)/50 mb-6 text-center">
                                Flip heads to win — how far can you go?
                            </p>

                            {!user ? (
                                /* Login prompt */
                                <div className="text-center py-12">
                                    <img src={passionCoin} alt="" className="w-20 h-20 mx-auto mb-4 opacity-30" />
                                    <p className="text-(--color-text-secondary)/60 text-sm mb-2">
                                        Log in with Discord to play
                                    </p>
                                    <p className="text-(--color-text-secondary)/30 text-xs">
                                        Each flip costs 1 Passion — heads wins +1, tails loses -1
                                    </p>
                                </div>
                            ) : statsLoading ? (
                                <div className="py-12">
                                    <div className="w-40 h-40 rounded-full bg-white/5 animate-pulse mx-auto" />
                                </div>
                            ) : (
                                <>
                                    {/* Coin */}
                                    <div className="relative mb-6">
                                        <div className={`relative transition-transform duration-200 ${shake ? 'animate-shake' : ''}`}>
                                            <img
                                                src={coinImage}
                                                alt="Passion Coin"
                                                className={`w-40 h-40 sm:w-52 sm:h-52 object-contain transition-all duration-300 ${
                                                    lastResult === 'heads' && !flipping
                                                        ? 'drop-shadow-[0_0_20px_rgba(74,222,128,0.4)]'
                                                        : lastResult === 'tails' && !flipping
                                                            ? 'drop-shadow-[0_0_20px_rgba(248,113,113,0.4)]'
                                                            : 'drop-shadow-[0_0_12px_rgba(248,197,106,0.2)]'
                                                }`}
                                            />
                                            {showExplosion && (
                                                <img src={passionsplosion} alt=""
                                                    className="absolute inset-0 w-full h-full object-contain animate-explosion pointer-events-none" />
                                            )}
                                        </div>

                                        {/* +1 / -1 floating indicator */}
                                        {resultDelta !== null && !flipping && (
                                            <div className={`absolute -top-2 right-0 text-2xl font-black animate-float-up ${
                                                resultDelta > 0 ? 'text-green-400' : 'text-red-400'
                                            }`}>
                                                {resultDelta > 0 ? '+1' : '-1'}
                                            </div>
                                        )}
                                    </div>

                                    {/* Result label (fixed height to prevent layout shift) */}
                                    <div className="h-6 mb-4 flex items-center justify-center">
                                        {lastResult && !flipping && (
                                            <div className={`text-sm font-bold uppercase tracking-wider ${
                                                lastResult === 'heads' ? 'text-green-400' : 'text-red-400'
                                            }`}>
                                                {lastResult === 'heads' ? 'Heads!' : 'Tails!'}
                                                {streakBroken && (
                                                    <span className="text-red-400/60 ml-2 text-xs normal-case">
                                                        streak of {streakBroken} broken
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Current streak */}
                                    <div className="text-center mb-2">
                                        <div className="text-xs text-(--color-text-secondary)/50 uppercase tracking-wider mb-1">
                                            Current Streak
                                        </div>
                                        <div className="text-4xl sm:text-5xl font-heading font-black tabular-nums"
                                            style={{ color: currentStreak > 0 ? '#f8c56a' : 'rgba(255,255,255,0.2)' }}>
                                            {currentStreak}
                                        </div>
                                    </div>

                                    {/* Best streak */}
                                    <div className="text-xs text-(--color-text-secondary)/40 mb-6 tabular-nums">
                                        Best: <span className="text-(--color-text-secondary)/60 font-bold">{bestStreak}</span>
                                    </div>

                                    {/* Balance */}
                                    <div className="flex items-center gap-1.5 mb-4">
                                        <img src={passionCoin} alt="" className="w-4 h-4" />
                                        <span className="text-sm font-bold tabular-nums" style={{ color: '#f8c56a' }}>
                                            {displayBalance}
                                        </span>
                                        <span className="text-xs text-(--color-text-secondary)/40">available</span>
                                    </div>

                                    {/* Flip button */}
                                    <button
                                        onClick={handleFlip}
                                        disabled={!canFlip}
                                        className="w-full max-w-[200px] py-3 rounded-xl font-bold text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-95 cursor-pointer"
                                        style={{
                                            background: canFlip
                                                ? 'linear-gradient(135deg, #c4922e, #f8c56a)'
                                                : 'rgba(255,255,255,0.1)',
                                            color: canFlip ? '#0a0f1a' : 'rgba(255,255,255,0.3)',
                                        }}
                                    >
                                        {flipping ? 'Flipping...' : displayBalance < 1 ? 'No Passion' : 'Flip'}
                                    </button>

                                    {displayBalance < 1 && !flipping && (
                                        <p className="text-xs text-red-400/60 mt-2 text-center">
                                            You need at least 1 Passion to flip
                                        </p>
                                    )}

                                    {/* Stats */}
                                    <div className="flex gap-6 mt-6 text-center">
                                        <div>
                                            <div className="text-lg font-bold tabular-nums text-(--color-text)">{totalFlips}</div>
                                            <div className="text-[10px] text-(--color-text-secondary)/40 uppercase tracking-wider">Flips</div>
                                        </div>
                                        <div>
                                            <div className="text-lg font-bold tabular-nums text-(--color-text)">{totalHeads}</div>
                                            <div className="text-[10px] text-(--color-text-secondary)/40 uppercase tracking-wider">Heads</div>
                                        </div>
                                        <div>
                                            <div className="text-lg font-bold tabular-nums text-(--color-text)">
                                                {totalFlips > 0 ? Math.round((totalHeads / totalFlips) * 100) : 0}%
                                            </div>
                                            <div className="text-[10px] text-(--color-text-secondary)/40 uppercase tracking-wider">Rate</div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* ═══ Right: Streak Leaderboard ═══ */}
                    <div className="lg:col-span-3">
                        <div className="bg-(--color-secondary) rounded-2xl border border-white/[0.08] p-6">
                            <h2 className="text-xl font-bold font-heading mb-1 flex items-center gap-2">
                                <svg className="w-5 h-5 text-(--color-accent)" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                Streak Leaderboard
                            </h2>
                            <p className="text-xs text-(--color-text-secondary)/40 mb-5">
                                Longest heads streaks of all time
                            </p>

                            {leaderboardLoading ? (
                                <div className="space-y-2">
                                    {[...Array(8)].map((_, i) => (
                                        <div key={i} className="h-14 rounded-xl bg-white/[0.03] animate-pulse" />
                                    ))}
                                </div>
                            ) : leaderboard.length === 0 ? (
                                <div className="text-center py-12">
                                    <img src={passionCoin} alt="" className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p className="text-(--color-text-secondary)/40 text-sm">No streaks yet</p>
                                    <p className="text-(--color-text-secondary)/25 text-xs mt-1">Be the first!</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {leaderboard.map((entry) => {
                                        const isMe = user && entry.userId === user.id
                                        const entryRank = getRank(entry.totalEarned)
                                        const avatarUrl = entry.discordAvatar
                                            ? `https://cdn.discordapp.com/avatars/${entry.discordId}/${entry.discordAvatar}.png?size=64`
                                            : null

                                        return (
                                            <div key={entry.userId}
                                                className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                                                    isMe
                                                        ? 'bg-(--color-accent)/[0.06] border-(--color-accent)/20'
                                                        : 'bg-white/[0.02] border-white/[0.04] hover:border-white/10'
                                                }`}
                                                style={{ animation: `card-enter 0.3s ease-out ${(entry.position - 1) * 0.04}s both` }}
                                            >
                                                {/* Position */}
                                                <span className={`text-sm font-bold w-7 text-center tabular-nums shrink-0 ${
                                                    entry.position === 1 ? 'text-yellow-400'
                                                        : entry.position === 2 ? 'text-gray-300'
                                                            : entry.position === 3 ? 'text-amber-600'
                                                                : 'text-(--color-text-secondary)/40'
                                                }`}>
                                                    {entry.position <= 3
                                                        ? ['', '\uD83D\uDC51', '\uD83E\uDD48', '\uD83E\uDD49'][entry.position]
                                                        : entry.position
                                                    }
                                                </span>

                                                {/* Avatar */}
                                                <div className="shrink-0">
                                                    {avatarUrl ? (
                                                        <img src={avatarUrl} alt="" className="w-9 h-9 rounded-full" />
                                                    ) : (
                                                        <div className="w-9 h-9 rounded-full bg-[#5865F2] flex items-center justify-center text-white text-xs font-bold">
                                                            {entry.discordUsername?.[0]?.toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Name + rank */}
                                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                                    <span className={`font-medium text-sm truncate ${isMe ? 'text-(--color-accent)' : ''}`}>
                                                        {entry.discordUsername}
                                                        {isMe && <span className="text-xs text-(--color-text-secondary)/50 ml-1">(you)</span>}
                                                    </span>
                                                    <RankBadge rank={entryRank} size="sm" />
                                                </div>

                                                {/* Best streak */}
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <svg className="w-4 h-4 text-(--color-accent)/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                    </svg>
                                                    <span className="font-bold text-sm tabular-nums" style={{ color: '#f8c56a' }}>
                                                        {entry.bestStreak}
                                                    </span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes card-enter {
                    0% { opacity: 0; transform: translateY(12px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                @keyframes float-up {
                    0% { opacity: 1; transform: translateY(0); }
                    100% { opacity: 0; transform: translateY(-40px); }
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    20% { transform: translateX(-8px); }
                    40% { transform: translateX(8px); }
                    60% { transform: translateX(-6px); }
                    80% { transform: translateX(6px); }
                }
                @keyframes explosion {
                    0% { transform: scale(0.3); opacity: 1; }
                    60% { transform: scale(1.5); opacity: 0.7; }
                    100% { transform: scale(2); opacity: 0; }
                }
                .animate-float-up { animation: float-up 1s ease-out forwards; }
                .animate-shake { animation: shake 0.5s ease-in-out; }
                .animate-explosion { animation: explosion 1.2s ease-out forwards; }
            `}</style>
        </div>
    )
}

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
const FLIP_CYCLE_2D = [passionCoin, flip1, flip2, flip3, passionTails, flip3, flip2, flip1]

export default function CoinFlip() {
    const { user, login } = useAuth()
    const { balance, refreshBalance, canClaimDaily, claimDaily, currentStreak: passionStreak, loading: passionLoading } = usePassion()

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
    const [mode3d, setMode3d] = useState(() => localStorage.getItem('coinflip_3d') !== 'false')
    const [claimingDaily, setClaimingDaily] = useState(false)
    const [dailyClaimResult, setDailyClaimResult] = useState(null)
    const [landing, setLanding] = useState(false)             // 3D landing phase

    // Ref for 2D frame cycling (rAF)
    const flip2dRafRef = useRef(null)

    // Refs for 3D JS-driven rotation
    const coinInnerRef = useRef(null)
    const coinLiftRef = useRef(null)
    const coinShadowRef = useRef(null)
    const rotationRef = useRef(0)
    const spinRafRef = useRef(null)
    const spinStartRef = useRef(0)

    const toggleMode = () => {
        const next = !mode3d
        setMode3d(next)
        localStorage.setItem('coinflip_3d', String(next))
    }

    const handleClaimDaily = async () => {
        setClaimingDaily(true)
        const result = await claimDaily()
        setClaimingDaily(false)
        if (result && !result.alreadyClaimed) {
            setDailyClaimResult(result)
        }
    }

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

    // Sync local balance from passion context (unless mid-flip where we track locally)
    useEffect(() => {
        if (!flipping && !landing && balance !== undefined) {
            setLocalBalance(balance)
        }
    }, [balance, flipping, landing])

    // 2D: variable-speed frame cycling via rAF (accelerate → peak → decelerate)
    const start2dFlip = () => {
        const startTime = performance.now()
        let lastFrameTime = startTime
        let frame = 0
        setFlipFrame(0)

        const cycle = (now) => {
            const elapsed = now - startTime
            const sinceLastFrame = now - lastFrameTime

            let interval
            if (elapsed < 250) {
                interval = 130 - (elapsed / 250) * 75   // 130→55ms (accelerating)
            } else if (elapsed < 700) {
                interval = 55                            // peak speed
            } else {
                const t = Math.min((elapsed - 700) / 350, 1)
                interval = 55 + t * 140                  // 55→195ms (decelerating)
            }

            if (sinceLastFrame >= interval) {
                frame = (frame + 1) % FLIP_CYCLE_2D.length
                setFlipFrame(frame)
                lastFrameTime = now
            }

            flip2dRafRef.current = requestAnimationFrame(cycle)
        }

        flip2dRafRef.current = requestAnimationFrame(cycle)
    }

    // 3D: start epic vertical flip — coin launches up towards the camera
    const startSpin3d = () => {
        const inner = coinInnerRef.current
        const lift = coinLiftRef.current
        const shadow = coinShadowRef.current
        if (!inner || !lift) return

        // Reset
        inner.style.transition = 'none'
        lift.style.transition = 'none'
        // Force reflow so transition:none takes effect
        void lift.offsetHeight

        // Launch: rise up + come towards camera
        lift.style.transition = 'transform 0.35s cubic-bezier(0.2, 0, 0, 1)'
        lift.style.transform = 'translateY(-60px) translateZ(250px)'
        if (shadow) {
            shadow.style.transition = 'all 0.35s cubic-bezier(0.2, 0, 0, 1)'
            shadow.style.opacity = '0.5'
            shadow.style.transform = 'scaleX(1.8) scaleY(1)'
        }

        // Spin on X axis (vertical flip) using rAF for smooth 60fps
        spinStartRef.current = performance.now()
        const spin = (now) => {
            const elapsed = now - spinStartRef.current
            // Accelerate over first 300ms, then constant speed
            const accel = Math.min(elapsed / 300, 1)
            const speed = accel * 22 // degrees per frame at max speed
            rotationRef.current += speed
            inner.style.transform = `rotateX(${rotationRef.current}deg)`
            spinRafRef.current = requestAnimationFrame(spin)
        }
        spinRafRef.current = requestAnimationFrame(spin)
    }

    // 3D: dramatic landing — decelerate, settle back, bounce
    const landOn3d = (result) => {
        cancelAnimationFrame(spinRafRef.current)
        const inner = coinInnerRef.current
        const lift = coinLiftRef.current
        const shadow = coinShadowRef.current
        if (!inner || !lift) return

        const current = rotationRef.current
        // At least 720deg more for a satisfying deceleration arc
        const minTarget = current + 720
        let target
        if (result === 'heads') {
            target = Math.ceil(minTarget / 360) * 360
        } else {
            target = Math.ceil((minTarget - 180) / 360) * 360 + 180
        }

        rotationRef.current = target
        setLanding(true)

        // Coin settles back down and away from camera
        lift.style.transition = 'transform 0.65s cubic-bezier(0.2, 0, 0.3, 1)'
        lift.style.transform = 'translateY(0px) translateZ(0px)'
        if (shadow) {
            shadow.style.transition = 'all 0.65s cubic-bezier(0.2, 0, 0.3, 1)'
            shadow.style.opacity = '0.15'
            shadow.style.transform = 'scaleX(1) scaleY(0.5)'
        }

        // Decelerate spin to land on correct face
        inner.style.transition = 'transform 0.7s cubic-bezier(0.1, 0, 0.15, 1)'
        inner.style.transform = `rotateX(${target}deg)`

        // Bounce on landing
        setTimeout(() => {
            if (!lift) return
            lift.style.transition = 'transform 0.12s ease-out'
            lift.style.transform = 'translateY(-6px) translateZ(20px)'
            setTimeout(() => {
                lift.style.transition = 'transform 0.15s ease-in'
                lift.style.transform = 'translateY(0px) translateZ(0px)'
            }, 120)
        }, 600)

        setTimeout(() => setLanding(false), 800)
    }

    // Cleanup animations on unmount
    useEffect(() => {
        return () => {
            cancelAnimationFrame(spinRafRef.current)
            cancelAnimationFrame(flip2dRafRef.current)
        }
    }, [])

    const displayBalance = localBalance !== null ? localBalance : balance

    const handleFlip = async () => {
        if (flipping || !user) return
        if (displayBalance < 1) return

        setFlipping(true)
        setLastResult(null)
        setResultDelta(null)
        setShake(false)
        setStreakBroken(null)

        // Start the appropriate animation immediately
        if (mode3d) {
            startSpin3d()
        } else {
            start2dFlip()
        }

        const prevStreak = currentStreak

        // Fire API + minimum animation time in parallel
        const [data] = await Promise.all([
            coinflipService.flip(),
            new Promise(resolve => setTimeout(resolve, mode3d ? 550 : 900)),
        ])

        if (data.error === 'insufficient_balance') {
            if (mode3d) cancelAnimationFrame(spinRafRef.current)
            else cancelAnimationFrame(flip2dRafRef.current)
            setFlipping(false)
            setLocalBalance(data.balance)
            return
        }

        // Reveal the result — in 3D, delay until landing animation finishes
        const revealResult = () => {
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

            refreshBalance()
        }

        if (mode3d) {
            landOn3d(data.result)
            // Reveal when the coin lands (matches the 0.7s spin deceleration)
            setTimeout(revealResult, 700)
        } else {
            // Stop frame cycling, begin landing phase
            cancelAnimationFrame(flip2dRafRef.current)
            setLanding(true)
            setTimeout(() => {
                revealResult()
                setTimeout(() => setLanding(false), 400)
            }, 50)
        }
    }

    const canFlip = user && !flipping && !landing && displayBalance >= 1

    // 2D: determine coin image to show
    let coinImage = passionCoin
    if (!mode3d) {
        if (flipping) {
            coinImage = FLIP_CYCLE_2D[flipFrame % FLIP_CYCLE_2D.length]
        } else if (lastResult === 'heads') {
            coinImage = passionCoin
        } else if (lastResult === 'tails') {
            coinImage = passionTails
        }
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

                            <div className="flex items-center justify-between w-full mb-1">
                                <h1 className="text-2xl sm:text-3xl font-bold font-heading text-center flex-1">
                                    Coin Flip
                                </h1>
                                {/* 2D / 3D toggle */}
                                <button
                                    onClick={toggleMode}
                                    className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border transition-all cursor-pointer shrink-0"
                                    style={{
                                        background: mode3d ? 'rgba(248,197,106,0.15)' : 'rgba(255,255,255,0.05)',
                                        borderColor: mode3d ? 'rgba(248,197,106,0.3)' : 'rgba(255,255,255,0.1)',
                                        color: mode3d ? '#f8c56a' : 'rgba(255,255,255,0.4)',
                                    }}
                                >
                                    {mode3d ? '3D' : '2D'}
                                </button>
                            </div>
                            <p className="text-xs text-(--color-text-secondary)/50 mb-6 text-center">
                                Flip heads to win — how far can you go?
                            </p>

                            {!user ? (
                                /* Login prompt */
                                <div className="text-center py-10">
                                    <img src={passionCoin} alt="" className="w-24 h-24 mx-auto mb-5 opacity-40" />
                                    <p className="text-(--color-text) font-bold text-base mb-1">
                                        Show your Passion!
                                    </p>
                                    <p className="text-(--color-text-secondary)/50 text-xs mb-5">
                                        Log in with Discord to flip — heads wins +1, tails loses -1
                                    </p>
                                    <button
                                        onClick={login}
                                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-95 cursor-pointer"
                                        style={{ backgroundColor: '#5865F2' }}
                                    >
                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                                        </svg>
                                        Log in with Discord
                                    </button>
                                </div>
                            ) : statsLoading || passionLoading ? (
                                <div className="py-12">
                                    <div className="w-40 h-40 rounded-full bg-white/5 animate-pulse mx-auto" />
                                </div>
                            ) : (
                                <>
                                    {/* Coin */}
                                    <div className="relative mb-6">
                                        <div className={`relative transition-transform duration-200 ${shake ? 'animate-shake' : ''}`}>
                                            {mode3d ? (
                                                /* ═══ 3D Coin — vertical flip with depth ═══ */
                                                <div className="flex flex-col items-center">
                                                    <div className="coin-3d-scene w-40 h-40 sm:w-52 sm:h-52">
                                                        <div ref={coinLiftRef} className="coin-3d-lift w-full h-full">
                                                            <div ref={coinInnerRef} className="coin-3d-inner w-full h-full">
                                                                {/* Front face (heads) */}
                                                                <div className="coin-3d-face coin-3d-front">
                                                                    <img src={passionCoin} alt="Heads"
                                                                        className={`w-full h-full object-contain transition-[filter] duration-300 ${
                                                                            lastResult === 'heads' && !flipping && !landing
                                                                                ? 'drop-shadow-[0_0_24px_rgba(74,222,128,0.5)]'
                                                                                : 'drop-shadow-[0_0_12px_rgba(248,197,106,0.3)]'
                                                                        }`}
                                                                    />
                                                                </div>
                                                                {/* Back face (tails) — rotated on X axis for vertical flip */}
                                                                <div className="coin-3d-face coin-3d-back-x">
                                                                    <img src={passionTails} alt="Tails"
                                                                        className={`w-full h-full object-contain transition-[filter] duration-300 ${
                                                                            lastResult === 'tails' && !flipping && !landing
                                                                                ? 'drop-shadow-[0_0_24px_rgba(248,113,113,0.5)]'
                                                                                : 'drop-shadow-[0_0_12px_rgba(248,197,106,0.3)]'
                                                                        }`}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {/* Shadow beneath the coin */}
                                                    <div
                                                        ref={coinShadowRef}
                                                        className="coin-3d-shadow"
                                                    />
                                                </div>
                                            ) : (
                                                /* ═══ 2D Coin ═══ */
                                                <div className={flipping || landing ? 'animate-coin-2d-flip' : ''}>
                                                    <img
                                                        src={coinImage}
                                                        alt="Passion Coin"
                                                        className={`w-40 h-40 sm:w-52 sm:h-52 object-contain transition-[filter] duration-300 ${
                                                            lastResult === 'heads' && !flipping
                                                                ? 'drop-shadow-[0_0_20px_rgba(74,222,128,0.4)]'
                                                                : lastResult === 'tails' && !flipping
                                                                    ? 'drop-shadow-[0_0_20px_rgba(248,113,113,0.4)]'
                                                                    : 'drop-shadow-[0_0_12px_rgba(248,197,106,0.2)]'
                                                        }`}
                                                    />
                                                </div>
                                            )}
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

                                    {/* Daily claim */}
                                    {canClaimDaily && !dailyClaimResult && (
                                        <button
                                            onClick={handleClaimDaily}
                                            disabled={claimingDaily}
                                            className="w-full max-w-[200px] mb-3 py-2 rounded-lg font-bold text-xs transition-all disabled:opacity-50 hover:opacity-90 active:scale-95 cursor-pointer"
                                            style={{ background: 'linear-gradient(135deg, #c4922e, #f8c56a)', color: '#0a0f1a' }}
                                        >
                                            {claimingDaily ? 'Claiming...' : `Claim Daily Passion (${passionStreak}d streak)`}
                                        </button>
                                    )}
                                    {dailyClaimResult && (
                                        <div className="text-center mb-3 text-xs">
                                            <span style={{ color: '#f8c56a' }} className="font-bold">+{dailyClaimResult.earned}</span>
                                            <span className="text-(--color-text-secondary) ml-1">daily claimed!</span>
                                            {dailyClaimResult.streakBonus > 0 && (
                                                <span className="text-(--color-text-secondary)/60 ml-1">(+{dailyClaimResult.streakBonus} streak bonus)</span>
                                            )}
                                        </div>
                                    )}

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
                /* ═══ 3D Coin — epic vertical flip ═══ */
                .coin-3d-scene {
                    perspective: 600px;
                    perspective-origin: 50% 50%;
                }
                .coin-3d-lift {
                    transform-style: preserve-3d;
                    transform: translateY(0) translateZ(0);
                }
                .coin-3d-inner {
                    position: relative;
                    transform-style: preserve-3d;
                    transform: rotateX(0deg);
                }
                .coin-3d-face {
                    position: absolute;
                    inset: 0;
                    backface-visibility: hidden;
                    -webkit-backface-visibility: hidden;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .coin-3d-back-x {
                    position: absolute;
                    inset: 0;
                    backface-visibility: hidden;
                    -webkit-backface-visibility: hidden;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transform: rotateX(180deg);
                }
                .coin-3d-shadow {
                    width: 120px;
                    height: 16px;
                    margin-top: 8px;
                    border-radius: 50%;
                    background: radial-gradient(ellipse, rgba(248,197,106,0.15) 0%, transparent 70%);
                    opacity: 0.15;
                    transform: scaleX(1) scaleY(0.5);
                }

                /* ═══ 2D Coin — arc with bounce ═══ */
                @keyframes coin-2d-flip {
                    0%   { transform: translateY(0) scale(1); filter: brightness(1); }
                    12%  { transform: translateY(-50px) scale(1.1); }
                    25%  { transform: translateY(-80px) scale(1.18); filter: brightness(1.12); }
                    38%  { transform: translateY(-88px) scale(1.2); filter: brightness(1.15); }
                    52%  { transform: translateY(-78px) scale(1.16); filter: brightness(1.1); }
                    66%  { transform: translateY(-40px) scale(1.08); filter: brightness(1.05); }
                    78%  { transform: translateY(-5px) scale(1); filter: brightness(1); }
                    84%  { transform: translateY(0) scale(0.98); }
                    89%  { transform: translateY(-10px) scale(1.03); }
                    94%  { transform: translateY(0) scale(1); }
                    97%  { transform: translateY(-3px) scale(1.01); }
                    100% { transform: translateY(0) scale(1); filter: brightness(1); }
                }
                .animate-coin-2d-flip {
                    animation: coin-2d-flip 1.3s cubic-bezier(0.25, 0.1, 0.25, 1) forwards;
                }

                /* ═══ Shared animations ═══ */
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

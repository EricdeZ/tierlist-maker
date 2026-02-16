import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePassion } from '../context/PassionContext'
import { RANK_THRESHOLDS } from '../config/ranks'
import passionIcon from '../assets/passion/passion.png'
import passionTails from '../assets/passion/passiontails.png'
import passionsplosion from '../assets/passion/passionsplosion.png'
import { ChevronRight, Flame, Target, ShoppingBag, Star, Trophy } from 'lucide-react'

const DISPLAY_RANKS = RANK_THRESHOLDS.filter((r, i, arr) =>
    i === 0 || r.name !== arr[i - 1].name
)

const RankDisplay = ({ size, keyPrefix = '', currentRank, rankIdx, rankPhase, explosionKey }) => (
    <div className="flex flex-col items-center gap-1.5">
        <div className={`relative ${size} flex items-center justify-center`}>
            {explosionKey > 0 && (
                <div key={`${keyPrefix}explosion-${explosionKey}`} className="absolute inset-0 pointer-events-none z-0 flex items-center justify-center overflow-visible">
                    <img
                        src={passionsplosion} alt=""
                        className="w-full h-full max-w-none object-contain"
                        style={{ animation: 'rankExplosion 0.8s ease-out forwards' }}
                    />
                </div>
            )}
            <div
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(248,197,106,0.1), transparent 60%)', animation: 'rankGlow 3s ease-in-out infinite' }}
            />
            {currentRank.image ? (
                <img
                    key={`${keyPrefix}${rankIdx}`}
                    src={currentRank.image} alt={currentRank.name}
                    className="w-3/4 h-3/4 object-contain relative z-10"
                    style={
                        rankPhase === 'spin-out' ? { animation: 'rankSpinOut 400ms cubic-bezier(0.4, 0, 1, 1) forwards' }
                            : rankPhase === 'spin-in' ? { animation: 'rankSpinIn 400ms cubic-bezier(0, 0, 0.2, 1) forwards' }
                                : undefined
                    }
                />
            ) : (
                <div className="w-3/4 h-3/4 rounded-full bg-white/10 flex items-center justify-center text-xl font-bold text-(--color-text-secondary) relative z-10">
                    {currentRank.name[0]}
                </div>
            )}
        </div>
        <span
            key={`${keyPrefix}label-${rankIdx}`}
            className="text-[10px] sm:text-xs font-bold text-(--color-text-secondary)/70 uppercase tracking-wider"
            style={rankPhase === 'spin-in' ? { animation: 'labelFadeIn 300ms ease-out 150ms both' } : undefined}
        >
            {currentRank.name}
        </span>
    </div>
)

const DiscordIcon = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z" />
    </svg>
)

export default function PassionPromoBanner() {
    const { user, login, loading: authLoading } = useAuth()
    const { canClaimDaily, claimDaily, currentStreak } = usePassion()

    const [revealed, setRevealed] = useState(false)
    const [flipping, setFlipping] = useState(false)
    const coinInnerRef = useRef(null)
    const coinLiftRef = useRef(null)
    const coinShadowRef = useRef(null)
    const rotationRef = useRef(0)
    const spinRafRef = useRef(null)
    const spinStartRef = useRef(0)

    const [claiming, setClaiming] = useState(false)
    const [claimed, setClaimed] = useState(false)

    const [rankIdx, setRankIdx] = useState(0)
    const [rankPhase, setRankPhase] = useState('show')
    const [explosionKey, setExplosionKey] = useState(0)
    const rankTimerRef = useRef(null)

    // --- 3D flip ---
    const startSpin = useCallback(() => {
        const inner = coinInnerRef.current
        const lift = coinLiftRef.current
        const shadow = coinShadowRef.current
        if (!inner || !lift) return

        inner.style.transition = 'none'
        lift.style.transition = 'none'
        void lift.offsetHeight

        lift.style.transition = 'transform 0.35s cubic-bezier(0.2, 0, 0, 1)'
        lift.style.transform = 'translateY(-60px) translateZ(250px)'
        if (shadow) {
            shadow.style.transition = 'all 0.35s cubic-bezier(0.2, 0, 0, 1)'
            shadow.style.opacity = '0.5'
            shadow.style.transform = 'scaleX(1.8) scaleY(1)'
        }

        spinStartRef.current = performance.now()
        const spin = (now) => {
            const elapsed = now - spinStartRef.current
            const accel = Math.min(elapsed / 300, 1)
            rotationRef.current += accel * 22
            inner.style.transform = `rotateX(${rotationRef.current}deg)`
            spinRafRef.current = requestAnimationFrame(spin)
        }
        spinRafRef.current = requestAnimationFrame(spin)
    }, [])

    const landOnHeads = useCallback(() => {
        cancelAnimationFrame(spinRafRef.current)
        const inner = coinInnerRef.current
        const lift = coinLiftRef.current
        const shadow = coinShadowRef.current
        if (!inner || !lift) return

        const target = Math.ceil((rotationRef.current + 720) / 360) * 360
        rotationRef.current = target

        lift.style.transition = 'transform 0.65s cubic-bezier(0.2, 0, 0.3, 1)'
        lift.style.transform = 'translateY(0px) translateZ(0px)'
        if (shadow) {
            shadow.style.transition = 'all 0.65s cubic-bezier(0.2, 0, 0.3, 1)'
            shadow.style.opacity = '0.15'
            shadow.style.transform = 'scaleX(1) scaleY(0.5)'
        }

        inner.style.transition = 'transform 0.7s cubic-bezier(0.1, 0, 0.15, 1)'
        inner.style.transform = `rotateX(${target}deg)`

        setTimeout(() => {
            if (!coinLiftRef.current) return
            coinLiftRef.current.style.transition = 'transform 0.12s ease-out'
            coinLiftRef.current.style.transform = 'translateY(-6px) translateZ(20px)'
            setTimeout(() => {
                if (!coinLiftRef.current) return
                coinLiftRef.current.style.transition = 'transform 0.15s ease-in'
                coinLiftRef.current.style.transform = 'translateY(0px) translateZ(0px)'
            }, 120)
        }, 600)

        setTimeout(() => setFlipping(false), 800)
    }, [])

    const handleFlip = useCallback(() => {
        if (flipping) return
        setFlipping(true)
        if (!revealed) setRevealed(true)
        startSpin()
        setTimeout(() => landOnHeads(), 800)
    }, [flipping, revealed, startSpin, landOnHeads])

    const handleClaim = useCallback(async (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (claiming || !canClaimDaily) return
        setClaiming(true)
        try {
            const result = await claimDaily()
            if (result && !result.alreadyClaimed) {
                setClaimed(true)
                setTimeout(() => setClaimed(false), 3000)
            }
        } finally {
            setClaiming(false)
        }
    }, [claiming, canClaimDaily, claimDaily])

    // Rank cycling only after reveal
    useEffect(() => {
        if (!revealed) return
        const SHOW = 2000, HALF = 400

        const cycle = () => {
            setRankPhase('spin-out')
            rankTimerRef.current = setTimeout(() => {
                setRankIdx(prev => (prev + 1) % DISPLAY_RANKS.length)
                setExplosionKey(prev => prev + 1)
                setRankPhase('spin-in')
                rankTimerRef.current = setTimeout(() => setRankPhase('show'), HALF)
            }, HALF)
        }

        const interval = setInterval(cycle, SHOW + HALF * 2)
        return () => {
            clearInterval(interval)
            if (rankTimerRef.current) clearTimeout(rankTimerRef.current)
        }
    }, [revealed])

    useEffect(() => () => cancelAnimationFrame(spinRafRef.current), [])

    const currentRank = DISPLAY_RANKS[rankIdx]

    return (
        <section className="py-8 px-4">
            <style>{`
                @keyframes passionBorderPulse {
                    0%, 100% { border-color: rgba(248,197,106,0.15); box-shadow: 0 0 20px rgba(248,197,106,0.03); }
                    50% { border-color: rgba(248,197,106,0.4); box-shadow: 0 0 40px rgba(248,197,106,0.08); }
                }
                @keyframes shimmerSweep {
                    0% { background-position: -200% center; }
                    100% { background-position: 200% center; }
                }
                @keyframes rankSpinOut {
                    0% { transform: perspective(400px) rotateY(0deg) scale(1); opacity: 1; }
                    100% { transform: perspective(400px) rotateY(90deg) scale(0.8); opacity: 0; }
                }
                @keyframes rankSpinIn {
                    0% { transform: perspective(400px) rotateY(-90deg) scale(0.8); opacity: 0; }
                    100% { transform: perspective(400px) rotateY(0deg) scale(1); opacity: 1; }
                }
                @keyframes rankExplosion {
                    0% { transform: scale(0.2); opacity: 0.9; }
                    50% { transform: scale(0.8); opacity: 0.6; }
                    100% { transform: scale(1.1); opacity: 0; }
                }
                @keyframes labelFadeIn {
                    0% { opacity: 0; transform: translateY(6px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                @keyframes rankGlow {
                    0%, 100% { filter: drop-shadow(0 0 8px rgba(248,197,106,0.1)); }
                    50% { filter: drop-shadow(0 0 16px rgba(248,197,106,0.3)); }
                }
                .promo-3d-scene { perspective: 600px; perspective-origin: 50% 50%; }
                .promo-3d-lift { transform-style: preserve-3d; transform: translateY(0) translateZ(0); }
                .promo-3d-inner { position: relative; transform-style: preserve-3d; transform: rotateX(0deg); }
                .promo-3d-face, .promo-3d-back {
                    position: absolute; inset: 0;
                    backface-visibility: hidden; -webkit-backface-visibility: hidden;
                    display: flex; align-items: center; justify-content: center;
                }
                .promo-3d-back { transform: rotateX(180deg); }
                .promo-3d-shadow {
                    width: 100px; height: 12px; border-radius: 50%;
                    background: radial-gradient(ellipse, rgba(248,197,106,0.15) 0%, transparent 70%);
                    opacity: 0.15; transform: scaleX(1) scaleY(0.5);
                }
                .promo-expand {
                    display: grid; grid-template-rows: 0fr; opacity: 0;
                    transition: grid-template-rows 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease-out 0.1s;
                }
                .promo-expand.promo-revealed { grid-template-rows: 1fr; opacity: 1; }
                .promo-expand-inner { overflow: hidden; }

                /* Banner chrome fade-in */
                .promo-chrome { opacity: 0; transition: opacity 0.6s ease-out 0.15s; }
                .promo-chrome.promo-visible { opacity: 1; }
                .promo-border-wrap {
                    border-color: transparent;
                    transition: border-color 0.5s ease-out 0.1s;
                }
                .promo-border-wrap.promo-bordered {
                    animation: passionBorderPulse 3s ease-in-out infinite;
                }
            `}</style>

            <div className="max-w-6xl mx-auto">
                <div className={`relative rounded-2xl border-2 promo-border-wrap ${revealed ? 'promo-bordered' : ''}`}>

                    {/* Background layers — hidden until revealed */}
                    <div className={`promo-chrome ${revealed ? 'promo-visible' : ''}`}>
                        <div className="absolute inset-0 rounded-2xl" style={{ background: 'linear-gradient(135deg, #0d1117 0%, #161b22 40%, #1a0f05 100%)' }} />
                        <div className="absolute inset-0 rounded-2xl opacity-40" style={{ background: 'radial-gradient(ellipse at 15% 50%, rgba(248,197,106,0.08), transparent 55%)' }} />
                        <div className="absolute inset-0 rounded-2xl opacity-30" style={{ background: 'radial-gradient(ellipse at 85% 50%, rgba(248,197,106,0.06), transparent 50%)' }} />
                        <div
                            className="absolute inset-0 rounded-2xl opacity-[0.02]"
                            style={{ backgroundImage: 'linear-gradient(rgba(248,197,106,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(248,197,106,.12) 1px, transparent 1px)', backgroundSize: '40px 40px' }}
                        />
                        <div
                            className="absolute inset-0 rounded-2xl pointer-events-none opacity-[0.035]"
                            style={{ background: 'linear-gradient(110deg, transparent 25%, rgba(248,197,106,0.4) 50%, transparent 75%)', backgroundSize: '200% 100%', animation: 'shimmerSweep 4s ease-in-out infinite' }}
                        />
                    </div>

                    <div className="relative z-10">

                        {/* ═══ TOP ROW ═══ */}
                        <div className={`flex ${revealed ? 'items-center gap-4 sm:gap-6 p-5 sm:p-8 lg:p-10 pb-0 sm:pb-0 lg:pb-0' : 'flex-col items-center gap-3 py-8 sm:py-10'}`}>

                            {/* 3D Passion icon */}
                            <div className="shrink-0 flex flex-col items-center">
                                <button
                                    onClick={handleFlip}
                                    className="relative cursor-pointer focus:outline-none group promo-3d-scene"
                                    aria-label="Flip Passion"
                                >
                                    <div
                                        className="absolute -inset-8 rounded-full opacity-20 group-hover:opacity-40 transition-opacity duration-500 pointer-events-none"
                                        style={{ background: 'radial-gradient(circle, rgba(248,197,106,0.5), transparent 70%)' }}
                                    />
                                    <div
                                        ref={coinLiftRef}
                                        className={`promo-3d-lift ${revealed ? 'w-28 h-28 sm:w-36 sm:h-36 lg:w-44 lg:h-44' : 'w-40 h-40 sm:w-48 sm:h-48'}`}
                                        style={{ transition: 'width 0.5s ease, height 0.5s ease' }}
                                    >
                                        <div ref={coinInnerRef} className="promo-3d-inner w-full h-full">
                                            <div className="promo-3d-face">
                                                <img src={passionIcon} alt="Passion" className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(248,197,106,0.3)] group-hover:drop-shadow-[0_0_30px_rgba(248,197,106,0.5)] transition-[filter] duration-300" />
                                            </div>
                                            <div className="promo-3d-back">
                                                <img src={passionTails} alt="Passion" className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(248,197,106,0.3)]" />
                                            </div>
                                        </div>
                                    </div>
                                </button>
                                <div ref={coinShadowRef} className="promo-3d-shadow mt-1" />
                            </div>

                            {/* Text */}
                            {!revealed ? (
                                <button onClick={handleFlip} className="cursor-pointer focus:outline-none group">
                                    <p className="font-heading text-base sm:text-xl font-bold text-(--color-text-secondary)/40 group-hover:text-(--color-text-secondary)/60 transition-colors">
                                        Flip for Passion
                                    </p>
                                </button>
                            ) : (
                                <>
                                    <div className="flex-1 min-w-0 text-center">
                                        <h2
                                            className="font-heading text-xl sm:text-3xl lg:text-4xl font-black tracking-tight bg-clip-text text-transparent leading-tight"
                                            style={{
                                                WebkitBackgroundClip: 'text',
                                                backgroundImage: 'linear-gradient(135deg, #f8c56a, #fde68a, #f8c56a)',
                                                backgroundSize: '200% auto',
                                                animation: 'shimmerSweep 3s linear infinite',
                                            }}
                                        >
                                            Passion Fuels Everything
                                        </h2>
                                    </div>

                                    {/* Desktop rank */}
                                    <div className="shrink-0 hidden sm:flex">
                                        <RankDisplay size="w-28 h-28 sm:w-36 sm:h-36 lg:w-44 lg:h-44" keyPrefix="d-" currentRank={currentRank} rankIdx={rankIdx} rankPhase={rankPhase} explosionKey={explosionKey} />
                                    </div>
                                </>
                            )}
                        </div>

                        {/* ═══ EXPANDABLE CONTENT ═══ */}
                        <div className={`promo-expand ${revealed ? 'promo-revealed' : ''}`}>
                            <div className="promo-expand-inner">

                                {/* Mobile rank */}
                                <div className="sm:hidden flex justify-center pt-2 pb-1 px-5">
                                    <RankDisplay size="w-24 h-24" keyPrefix="m-" currentRank={currentRank} rankIdx={rankIdx} rankPhase={rankPhase} explosionKey={explosionKey} />
                                </div>

                                {/* CTA row */}
                                <div className="px-5 sm:px-8 lg:px-10 pt-4 sm:pt-6">
                                    {!authLoading && !user ? (
                                        <button
                                            onClick={login}
                                            className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl font-heading font-bold text-sm text-white transition-all duration-300 hover:scale-[1.01] hover:shadow-lg hover:shadow-[#5865F2]/25 cursor-pointer"
                                            style={{ background: 'linear-gradient(135deg, #5865F2, #4752C4)' }}
                                        >
                                            <DiscordIcon className="w-4 h-4" />
                                            Stop being passionless — Connect Discord Now
                                        </button>
                                    ) : (
                                        <div className="flex flex-wrap items-center justify-center gap-2">
                                            {canClaimDaily && !claimed ? (
                                                <button
                                                    onClick={handleClaim}
                                                    disabled={claiming}
                                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-heading font-bold text-sm text-(--color-primary) transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-(--color-accent)/25 cursor-pointer"
                                                    style={{ background: 'linear-gradient(135deg, var(--color-accent), #e5a84e)' }}
                                                >
                                                    <Flame className="w-4 h-4" />
                                                    {claiming ? 'Claiming...' : 'Claim Daily'}
                                                </button>
                                            ) : claimed ? (
                                                <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-heading font-bold text-sm text-green-400 bg-green-400/10 border border-green-400/20">
                                                    <Star className="w-4 h-4" />
                                                    +{10 + Math.min(currentStreak, 5)} Passion
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-(--color-text-secondary)/40 bg-white/[0.03] border border-white/[0.05]">
                                                    Daily claimed
                                                </span>
                                            )}
                                            <Link
                                                to="/challenges"
                                                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-heading font-bold text-sm text-(--color-text) border border-white/10 hover:border-(--color-accent)/40 transition-all duration-300 hover:scale-[1.02]"
                                            >
                                                <Target className="w-4 h-4 text-(--color-accent)" />
                                                Challenges
                                                <ChevronRight className="w-3.5 h-3.5 text-(--color-text-secondary)/40" />
                                            </Link>
                                        </div>
                                    )}
                                </div>

                                {/* 3 promo cards */}
                                <div className="grid sm:grid-cols-3 gap-4 p-5 sm:p-8 lg:p-10 pt-4 sm:pt-5">

                                    {/* Rank Up */}
                                    <Link
                                        to="/challenges"
                                        className="group rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-(--color-accent)/30 p-4 sm:p-5 transition-all duration-300 hover:-translate-y-0.5"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-(--color-accent)/10 flex items-center justify-center mb-3">
                                            <Trophy className="w-5 h-5 text-(--color-accent)" />
                                        </div>
                                        <p className="text-sm font-bold text-(--color-text) mb-1 group-hover:text-(--color-accent) transition-colors">Rank Up</p>
                                        <p className="text-xs text-(--color-text-secondary)/50 leading-relaxed">
                                            Climb from Clay to Deity across 27 ranks. Every Passion you earn pushes you higher on the ladder.
                                        </p>
                                    </Link>

                                    {/* How to Earn */}
                                    <Link
                                        to="/challenges"
                                        className="group rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-(--color-accent)/30 p-4 sm:p-5 transition-all duration-300 hover:-translate-y-0.5"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center mb-3">
                                            <Flame className="w-5 h-5 text-green-400" />
                                        </div>
                                        <p className="text-sm font-bold text-(--color-text) mb-1 group-hover:text-(--color-accent) transition-colors">How to Earn</p>
                                        <p className="text-xs text-(--color-text-secondary)/50 leading-relaxed">
                                            Daily logins, challenges, tier lists, and drafts all reward Passion. Stay active, stack up.
                                        </p>
                                    </Link>

                                    {/* Passion Shop */}
                                    <Link
                                        to="/shop"
                                        className="group rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-(--color-accent)/30 p-4 sm:p-5 transition-all duration-300 hover:-translate-y-0.5"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center mb-3">
                                            <ShoppingBag className="w-5 h-5 text-purple-400" />
                                        </div>
                                        <p className="text-sm font-bold text-(--color-text) mb-1 group-hover:text-(--color-accent) transition-colors">Passion Shop</p>
                                        <p className="text-xs text-(--color-text-secondary)/50 leading-relaxed">
                                            Spend your Passion on exclusive rewards. The more you earn, the more you unlock.
                                        </p>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

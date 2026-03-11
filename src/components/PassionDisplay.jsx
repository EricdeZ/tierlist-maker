import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { usePassion } from '../context/PassionContext'
import { useAuth } from '../context/AuthContext'
import { formatRank } from '../config/ranks'
import { FEATURE_FLAGS } from '../config/featureFlags'
import RankBadge from './RankBadge'
import passionCoin from '../assets/passion/passion.png'
import flip1 from '../assets/passion/flipping1.png'
import flip2 from '../assets/passion/flipping2.png'
import flip3 from '../assets/passion/flipping3.png'
import passionsplosion from '../assets/passion/passionsplosion.png'
import emberIcon from '../assets/ember.png'

const FLIP_FRAMES = [flip1, flip2, flip3, passionCoin]

export default function PassionDisplay() {
    const { user, isAdmin, hasPermission } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const {
        balance, totalEarned, currentStreak, canClaimDaily, lastDailyClaim, claimableCount,
        rank, nextRank, claimDaily, claimEmberDaily, refreshBalance, loading, rankUpInfo, dismissRankUp,
        challengeNotifications, dismissChallengeNotification, ember,
    } = usePassion()

    const isVault = location.pathname.startsWith('/vault')

    // Auto-dismiss challenge notifications after 5 seconds
    useEffect(() => {
        if (challengeNotifications.length === 0) return
        const timers = challengeNotifications.map(n =>
            setTimeout(() => dismissChallengeNotification(n.notifId), 5000)
        )
        return () => timers.forEach(clearTimeout)
    }, [challengeNotifications, dismissChallengeNotification])

    const [open, setOpen] = useState(false)
    const [claiming, setClaiming] = useState(false)
    const [claimResult, setClaimResult] = useState(null)
    const [showExplosion, setShowExplosion] = useState(false)
    const [flipFrame, setFlipFrame] = useState(0)
    const [animatingBalance, setAnimatingBalance] = useState(null)
    const menuRef = useRef(null)
    const flipInterval = useRef(null)

    // Close on click outside
    useEffect(() => {
        if (!open) return
        const handle = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setOpen(false)
                setClaimResult(null)
            }
        }
        document.addEventListener('mousedown', handle)
        return () => document.removeEventListener('mousedown', handle)
    }, [open])

    // Coin flip animation
    useEffect(() => {
        if (claiming) {
            let frame = 0
            flipInterval.current = setInterval(() => {
                frame = (frame + 1) % FLIP_FRAMES.length
                setFlipFrame(frame)
            }, 120)
        } else {
            clearInterval(flipInterval.current)
            setFlipFrame(0)
        }
        return () => clearInterval(flipInterval.current)
    }, [claiming])

    // Balance count-up animation
    useEffect(() => {
        if (animatingBalance === null) return
        const target = balance
        if (animatingBalance >= target) {
            setAnimatingBalance(null)
            return
        }
        const timer = setTimeout(() => {
            setAnimatingBalance(prev => Math.min(prev + 1, target))
        }, 30)
        return () => clearTimeout(timer)
    }, [animatingBalance, balance])

    // Countdown timer until next daily claim (midnight UTC)
    const [countdown, setCountdown] = useState('')
    useEffect(() => {
        if (canClaimDaily || !lastDailyClaim) {
            setCountdown('')
            return
        }
        const tick = () => {
            const now = new Date()
            const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
            const diff = tomorrow - now
            if (diff <= 0) {
                setCountdown('')
                refreshBalance()
                return
            }
            const h = Math.floor(diff / 3600000)
            const m = Math.floor((diff % 3600000) / 60000)
            const s = Math.floor((diff % 60000) / 1000)
            setCountdown(`${h}h ${m}m ${s}s`)
        }
        tick()
        const id = setInterval(tick, 1000)
        return () => clearInterval(id)
    }, [canClaimDaily, lastDailyClaim, refreshBalance])

    // Ember daily claim
    const [emberClaiming, setEmberClaiming] = useState(false)
    const [emberClaimResult, setEmberClaimResult] = useState(null)

    // Ember countdown
    const [emberCountdown, setEmberCountdown] = useState('')
    useEffect(() => {
        if (ember.canClaimDaily || !ember.lastDailyClaim) { setEmberCountdown(''); return }
        const tick = () => {
            const now = new Date()
            const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
            const diff = tomorrow - now
            if (diff <= 0) { setEmberCountdown(''); refreshBalance(); return }
            const h = Math.floor(diff / 3600000)
            const m = Math.floor((diff % 3600000) / 60000)
            const s = Math.floor((diff % 60000) / 1000)
            setEmberCountdown(`${h}h ${m}m ${s}s`)
        }
        tick()
        const id = setInterval(tick, 1000)
        return () => clearInterval(id)
    }, [ember.canClaimDaily, ember.lastDailyClaim, refreshBalance])

    if (!user || loading) return null

    const handleClaim = async () => {
        setClaiming(true)
        setClaimResult(null)
        const startBalance = balance
        const result = await claimDaily()
        setClaiming(false)

        if (result && !result.alreadyClaimed) {
            setClaimResult(result)
            setShowExplosion(true)
            setAnimatingBalance(startBalance)
            setTimeout(() => setShowExplosion(false), 1200)
        }
    }

    const handleEmberClaim = async () => {
        setEmberClaiming(true)
        setEmberClaimResult(null)
        const result = await claimEmberDaily()
        setEmberClaiming(false)
        if (result && !result.alreadyClaimed) {
            setEmberClaimResult(result)
        }
    }

    const handleToastClick = (notifId) => {
        dismissChallengeNotification(notifId)
        navigate('/challenges')
    }

    const displayBalance = animatingBalance !== null ? animatingBalance : balance
    const progressPct = nextRank
        ? ((totalEarned - rank.minPassion) / (nextRank.minPassion - rank.minPassion)) * 100
        : 100

    return (
        <>
            {/* ═══ Epic Rank-Up Overlay (portaled to body to escape nav stacking context) ═══ */}
            {rankUpInfo && (() => {
                const displayRank = rankUpInfo.overrideRank || rank
                return createPortal(
                <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 backdrop-blur-md"
                    onClick={dismissRankUp}>
                    <div className="flex flex-col items-center gap-6 rank-up-entrance">
                        {/* Visual center: all layers stacked via CSS grid */}
                        <div className="rank-up-stack">
                            {/* Glow rings */}
                            <div className="w-64 h-64 rounded-full rank-up-ring-outer" />
                            <div className="w-48 h-48 rounded-full rank-up-ring-inner" />

                            {/* Explosion */}
                            <img src={passionsplosion} alt=""
                                className="w-56 h-56 object-contain animate-explosion pointer-events-none opacity-90" />

                            {/* Badge */}
                            <div className="rank-up-badge">
                                <RankBadge rank={displayRank} size="xl" />
                            </div>

                            {/* Particle ring */}
                            {[...Array(12)].map((_, i) => {
                                const angle = (i * 30) * (Math.PI / 180)
                                const dist = 50 + (i % 3) * 20
                                return (
                                    <span key={i}
                                        className="w-2 h-2 rounded-full"
                                        style={{
                                            background: i % 3 === 0 ? '#f8c56a' : i % 3 === 1 ? '#ffe4a0' : '#d4a04a',
                                            '--px': `${Math.cos(angle) * dist}px`,
                                            '--py': `${Math.sin(angle) * dist}px`,
                                            animation: `rank-particle ${1 + Math.random() * 0.5}s ease-out ${i * 0.08}s forwards`,
                                        }}
                                    />
                                )
                            })}
                        </div>

                        <div className="text-center">
                            <div className="text-xs font-bold uppercase tracking-[0.3em] text-(--color-accent)/70 mb-2">
                                Rank Up
                            </div>
                            <div className="text-2xl sm:text-3xl font-heading font-black" style={{ color: '#f8c56a' }}>
                                {formatRank(displayRank)}
                            </div>
                        </div>

                        <div className="text-xs text-(--color-text-secondary)/40 mt-4">
                            Tap anywhere to continue
                        </div>
                    </div>

                    {/* Inline styles for rank-up animations */}
                    <style>{`
                        .rank-up-stack {
                            display: grid;
                            place-items: center;
                        }
                        .rank-up-stack > * {
                            grid-area: 1 / 1;
                        }
                        @keyframes explosion {
                            0% { transform: scale(0.3); opacity: 1; }
                            60% { transform: scale(1.5); opacity: 0.7; }
                            100% { transform: scale(2); opacity: 0; }
                        }
                        @keyframes rank-up-entrance {
                            0% { transform: scale(0); opacity: 0; }
                            40% { transform: scale(1.15); opacity: 1; }
                            60% { transform: scale(0.95); }
                            80% { transform: scale(1.03); }
                            100% { transform: scale(1); opacity: 1; }
                        }
                        @keyframes rank-up-ring {
                            0% { transform: scale(0.3); opacity: 0; border-color: rgba(248,197,106,0.6); }
                            50% { transform: scale(1); opacity: 0.6; }
                            100% { transform: scale(1.5); opacity: 0; border-color: rgba(248,197,106,0); }
                        }
                        @keyframes rank-up-glow {
                            0%, 100% { box-shadow: 0 0 30px 10px rgba(248,197,106,0.2); }
                            50% { box-shadow: 0 0 60px 20px rgba(248,197,106,0.4); }
                        }
                        @keyframes rank-particle {
                            0% { transform: translate(0, 0); opacity: 1; }
                            100% { transform: translate(var(--px, 60px), var(--py, -60px)); opacity: 0; }
                        }
                        .rank-up-entrance { animation: rank-up-entrance 0.7s ease-out forwards; }
                        .rank-up-ring-outer {
                            border: 2px solid rgba(248,197,106,0.4);
                            animation: rank-up-ring 1.5s ease-out infinite;
                        }
                        .rank-up-ring-inner {
                            border: 1px solid rgba(248,197,106,0.3);
                            animation: rank-up-ring 1.5s ease-out 0.3s infinite;
                        }
                        .rank-up-badge {
                            animation: rank-up-glow 2s ease-in-out infinite;
                            border-radius: 50%;
                        }
                        .animate-explosion { animation: explosion 1.2s ease-out forwards; }
                    `}</style>
                </div>,
                document.body
            )})()}

            {/* ═══ Challenge Toast Notifications (portaled to body) ═══ */}
            {challengeNotifications.length > 0 && createPortal(
                <div className="fixed top-16 right-4 z-[90] flex flex-col gap-2 pointer-events-none">
                    {challengeNotifications.map(notif => (
                        <div key={notif.notifId}
                            className="pointer-events-auto flex items-center gap-3 px-4 py-3 bg-(--color-secondary) border border-(--color-accent)/20 rounded-xl shadow-xl animate-slide-in-right cursor-pointer hover:border-(--color-accent)/40 transition-colors"
                            onClick={() => handleToastClick(notif.notifId)}
                        >
                            <img src={passionsplosion} alt="" className="w-8 h-8" />
                            <div>
                                <div className="text-xs font-bold text-(--color-accent)">Challenge Ready!</div>
                                <div className="text-sm text-(--color-text)">{notif.title}</div>
                                <div className="flex items-center gap-1 mt-0.5">
                                    <img src={passionCoin} alt="" className="w-3.5 h-3.5" />
                                    <span className="text-xs font-bold text-(--color-accent)">+{notif.reward}</span>
                                </div>
                            </div>
                            <svg className="w-4 h-4 text-(--color-text-secondary)/40 shrink-0 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    ))}
                </div>,
                document.body
            )}

            {/* ═══ Navbar Widgets ═══ */}
            <div className="flex items-center gap-1">
                {/* Challenge icon */}
                <Link
                    to="/challenges"
                    className="relative p-1.5 rounded-lg hover:bg-white/10 transition-colors hidden sm:flex"
                    title="Challenges"
                >
                    <svg className={`w-5 h-5 ${claimableCount > 0 ? 'text-(--color-accent)' : 'text-(--color-text-secondary)/60'}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round"
                            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    {claimableCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center"
                            style={{ background: '#f8c56a', color: '#0a0f1a' }}>
                            {claimableCount}
                        </span>
                    )}
                </Link>

                {/* Currency counter — swaps between Passion and Cores on Compdeck pages */}
                <div ref={menuRef} className="relative">
                    <button
                        onClick={() => { setOpen(!open); setClaimResult(null) }}
                        className="relative flex items-center gap-1.5 rounded-lg hover:bg-white/10 transition-colors px-2 py-1"
                    >
                        {!isVault && <span className="hidden sm:inline-flex"><RankBadge rank={rank} size="sm" /></span>}
                        {isVault ? (
                            <>
                                <img id="ember-balance-icon" src={emberIcon} alt="Cores" className="h-5 w-auto object-contain" />
                                <span className="text-sm font-semibold text-[#00e5ff] tabular-nums min-w-[2ch]">
                                    {ember.balance}
                                </span>
                            </>
                        ) : (
                            <>
                                <img id="passion-balance-coin" src={claiming ? FLIP_FRAMES[flipFrame] : passionCoin} alt="Passion"
                                    className={`w-5 h-5 ${claiming ? 'animate-pulse' : ''}`} />
                                <span className="text-sm font-semibold text-(--color-accent) tabular-nums min-w-[2ch]">
                                    {displayBalance}
                                </span>
                            </>
                        )}
                        {(isVault ? (ember.canClaimDaily && !emberClaimResult) : (canClaimDaily && !claimResult || claimableCount > 0)) && (
                            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: isVault ? '#00e5ff' : '#f8c56a' }} />
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: isVault ? '#00e5ff' : '#f8c56a' }} />
                            </span>
                        )}
                    </button>

                    {open && (
                        <div className="fixed right-2 left-2 sm:left-auto sm:absolute sm:right-0 top-14 sm:top-full mt-0 sm:mt-2 w-auto sm:w-72 bg-(--color-secondary) border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
                            {isVault ? (
                                <>
                                    {/* ═══ Compdeck Dropdown ═══ */}
                                    {/* Core Balance header */}
                                    <div className="px-4 py-3 border-b border-white/10">
                                        <div className="flex items-center gap-3">
                                            <img src={emberIcon} alt="Cores" className="h-8 w-auto object-contain" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-bold text-white/50 uppercase tracking-wider">Cores</div>
                                                <span className="text-xl font-bold text-[#00e5ff] tabular-nums">{ember.balance}</span>
                                            </div>
                                        </div>
                                        {/* Secondary: Passion balance */}
                                        <div className="flex items-center gap-1.5 mt-2 text-xs text-white/40">
                                            <img src={passionCoin} alt="" className="w-3.5 h-3.5" />
                                            <span className="tabular-nums">{displayBalance} Passion</span>
                                        </div>
                                    </div>

                                    {/* Daily Core claim */}
                                    <div className="px-4 py-3 border-b border-white/10">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="text-xs text-white/50">
                                                Core Streak: <span className="text-[#00e5ff] font-bold">{ember.currentStreak || 0}</span>
                                            </div>
                                        </div>

                                        {ember.canClaimDaily && !emberClaimResult ? (
                                            <button
                                                onClick={handleEmberClaim}
                                                disabled={emberClaiming}
                                                className="w-full py-2 rounded-lg font-bold text-sm transition-all disabled:opacity-50"
                                                style={{ background: 'linear-gradient(135deg, #00a0c0, #00e5ff)', color: '#000' }}
                                            >
                                                {emberClaiming ? 'Claiming...' : `Claim ${10 + Math.min((ember.currentStreak || 0), 10)} Cores`}
                                            </button>
                                        ) : emberClaimResult ? (
                                            <div className="text-center py-2 text-sm">
                                                <span className="text-[#00e5ff] font-bold">+{emberClaimResult.earned}</span>
                                                <span className="text-white/50 ml-1">Cores claimed!</span>
                                                {emberClaimResult.streakBonus > 0 && (
                                                    <div className="text-xs text-orange-400/70 mt-0.5">
                                                        includes +{emberClaimResult.streakBonus} streak bonus
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="text-center py-2 text-xs text-white/50">
                                                {emberCountdown
                                                    ? <>Next claim in <span className="text-[#00e5ff] font-mono font-medium tabular-nums">{emberCountdown}</span></>
                                                    : 'Come back tomorrow!'
                                                }
                                            </div>
                                        )}
                                    </div>

                                    {/* Daily Passion claim */}
                                    <div className="px-4 py-3 border-b border-white/10">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-1.5 text-xs text-white/50">
                                                <img src={passionCoin} alt="" className="w-3.5 h-3.5" />
                                                Passion Streak: <span className="text-[#f8c56a] font-bold">{currentStreak}</span>
                                            </div>
                                        </div>

                                        {canClaimDaily && !claimResult ? (
                                            <button
                                                onClick={handleClaim}
                                                disabled={claiming}
                                                className="w-full py-2 rounded-lg hover:opacity-90 font-bold text-sm transition-all disabled:opacity-50 relative overflow-hidden"
                                                style={{ background: 'linear-gradient(135deg, #c4922e, #f8c56a)', color: '#0a0f1a' }}
                                            >
                                                {claiming ? 'Claiming...' : 'Claim Daily Passion'}
                                                {showExplosion && (
                                                    <img src={passionsplosion} alt=""
                                                        className="absolute inset-0 w-full h-full object-contain animate-explosion pointer-events-none" />
                                                )}
                                            </button>
                                        ) : claimResult ? (
                                            <div className="text-center py-2 text-sm">
                                                <span className="text-[#f8c56a] font-bold">+{claimResult.earned}</span>
                                                <span className="text-white/50 ml-1">Passion earned!</span>
                                                {claimResult.streakBonus > 0 && (
                                                    <div className="text-xs text-[#f8c56a]/70 mt-0.5">
                                                        includes +{claimResult.streakBonus} streak bonus
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="text-center py-2 text-xs text-white/50">
                                                {countdown
                                                    ? <>Next claim in <span className="text-[#f8c56a] font-mono font-medium tabular-nums">{countdown}</span></>
                                                    : 'Come back tomorrow!'
                                                }
                                            </div>
                                        )}
                                    </div>

                                    {/* Compdeck Links */}
                                    <div className="py-1">
                                        <Link to="/vault?tab=packs" onClick={() => setOpen(false)}
                                            className="flex items-center gap-3 px-4 py-2 text-sm text-(--color-text) hover:bg-white/5 transition-colors">
                                            Packs
                                        </Link>
                                        <Link to="/vault?tab=catalog" onClick={() => setOpen(false)}
                                            className="flex items-center gap-3 px-4 py-2 text-sm text-(--color-text) hover:bg-white/5 transition-colors">
                                            Collection
                                        </Link>
                                        <Link to="/vault?tab=starting5" onClick={() => setOpen(false)}
                                            className="flex items-center gap-3 px-4 py-2 text-sm text-(--color-text) hover:bg-white/5 transition-colors">
                                            Starting 5
                                        </Link>
                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* ═══ Passion Dropdown (default) ═══ */}
                                    {/* Rank & Balance header */}
                                    <div className="px-4 py-3 border-b border-white/10">
                                        <div className="flex items-center gap-3">
                                            <RankBadge rank={rank} size="lg" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-bold text-(--color-text)">{formatRank(rank)}</div>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <img src={passionCoin} alt="" className="w-4 h-4" />
                                                    <span className="text-lg font-bold text-(--color-accent) tabular-nums">{displayBalance}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Progress to next rank */}
                                        {nextRank && (
                                            <div className="mt-3">
                                                <div className="flex justify-between text-[10px] text-(--color-text-secondary) mb-1">
                                                    <span>{formatRank(rank)}</span>
                                                    <span>{formatRank(nextRank)}</span>
                                                </div>
                                                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                    <div className="h-full rounded-full transition-all duration-500"
                                                        style={{
                                                            width: `${progressPct}%`,
                                                            background: 'linear-gradient(90deg, #d4a04a, #f8c56a)',
                                                        }} />
                                                </div>
                                                <div className="text-[10px] text-(--color-text-secondary) mt-1 text-center">
                                                    {nextRank.passionNeeded} more to {formatRank(nextRank)}
                                                </div>
                                            </div>
                                        )}
                                        {!nextRank && (
                                            <div className="mt-2 text-xs text-center text-(--color-accent) font-medium">Max Rank!</div>
                                        )}
                                    </div>

                                    {/* Streak & Daily claim */}
                                    <div className="px-4 py-3 border-b border-white/10">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="text-xs text-(--color-text-secondary)">
                                                Daily Streak: <span className="text-(--color-accent) font-bold">{currentStreak}</span>
                                            </div>
                                        </div>

                                        {canClaimDaily && !claimResult ? (
                                            <button
                                                onClick={handleClaim}
                                                disabled={claiming}
                                                className="w-full py-2 rounded-lg hover:opacity-90 font-bold text-sm transition-all disabled:opacity-50 relative overflow-hidden"
                                                style={{ background: 'linear-gradient(135deg, #c4922e, #f8c56a)', color: '#0a0f1a' }}
                                            >
                                                {claiming ? 'Claiming...' : 'Claim Daily Passion'}
                                                {showExplosion && (
                                                    <img src={passionsplosion} alt=""
                                                        className="absolute inset-0 w-full h-full object-contain animate-explosion pointer-events-none" />
                                                )}
                                            </button>
                                        ) : claimResult ? (
                                            <div className="text-center py-2 text-sm">
                                                <span className="text-(--color-accent) font-bold">+{claimResult.earned}</span>
                                                <span className="text-(--color-text-secondary) ml-1">Passion earned!</span>
                                                {claimResult.streakBonus > 0 && (
                                                    <div className="text-xs text-(--color-accent) mt-0.5">
                                                        (includes +{claimResult.streakBonus} streak bonus)
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="text-center py-2 text-xs text-(--color-text-secondary)">
                                                {countdown
                                                    ? <>Next claim in <span className="text-(--color-accent) font-mono font-medium tabular-nums">{countdown}</span></>
                                                    : 'Daily claim used — come back tomorrow!'
                                                }
                                            </div>
                                        )}
                                    </div>

                                    {/* Links */}
                                    <div className="py-1">
                                        <Link to="/leaderboard" onClick={() => setOpen(false)}
                                            className="flex items-center gap-3 px-4 py-2 text-sm text-(--color-text) hover:bg-white/5 transition-colors">
                                            Leaderboard
                                        </Link>
                                        <Link to="/challenges" onClick={() => setOpen(false)}
                                            className="flex items-center justify-between px-4 py-2 text-sm text-(--color-text) hover:bg-white/5 transition-colors">
                                            Challenges
                                            {claimableCount > 0 && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                                    style={{ background: 'rgba(248,197,106,0.15)', color: '#f8c56a' }}>
                                                    {claimableCount} ready
                                                </span>
                                            )}
                                        </Link>
                                        <Link to="/coinflip" onClick={() => setOpen(false)}
                                            className="flex items-center gap-3 px-4 py-2 text-sm text-(--color-text) hover:bg-white/5 transition-colors">
                                            Coin Flip
                                        </Link>
                                        {(FEATURE_FLAGS.CARD_CLASH_RELEASED || isAdmin || hasPermission('codex_edit')) && (
                                            <Link to="/vault" onClick={() => setOpen(false)}
                                                className="flex items-center justify-between px-4 py-2 text-sm text-(--color-text) hover:bg-white/5 transition-colors">
                                                <span className="flex items-center gap-2">
                                                    <img src={emberIcon} alt="" className="h-4 w-auto object-contain" />
                                                    The Vault
                                                </span>
                                                <span className="text-xs font-bold text-[#00e5ff] tabular-nums">{ember.balance}</span>
                                            </Link>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Styles for claim button explosion + toast slide-in */}
            <style>{`
                @keyframes explosion {
                    0% { transform: scale(0.3); opacity: 1; }
                    60% { transform: scale(1.5); opacity: 0.7; }
                    100% { transform: scale(2); opacity: 0; }
                }
                @keyframes slide-in-right {
                    0% { transform: translateX(100%); opacity: 0; }
                    100% { transform: translateX(0); opacity: 1; }
                }
                .animate-explosion { animation: explosion 1.2s ease-out forwards; }
                .animate-slide-in-right { animation: slide-in-right 0.3s ease-out forwards; }
            `}</style>
        </>
    )
}

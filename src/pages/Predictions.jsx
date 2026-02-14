import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { predictionsService, leagueService } from '../services/database'
import { useAuth } from '../context/AuthContext'
import { usePassion } from '../context/PassionContext'
import PageTitle from '../components/PageTitle'
import Navbar from '../components/layout/Navbar'
import TeamLogo from '../components/TeamLogo'
import RankBadge from '../components/RankBadge'
import passionCoin from '../assets/passion/passion.png'
import passionTilted from '../assets/passion/passiontilted.png'
import passionTails from '../assets/passion/passiontails.png'
import flip1 from '../assets/passion/flipping1.png'
import flip2 from '../assets/passion/flipping2.png'
import flip3 from '../assets/passion/flipping3.png'
import passionsplosion from '../assets/passion/passionsplosion.png'
import { getLeagueLogo } from '../utils/leagueImages'
import { getDivisionImage } from '../utils/divisionImages'
import { getRank } from '../config/ranks'
import { Lock, TrendingUp, Trophy, X, Target, Eye, Search, Flame, ChevronDown, ChevronUp, Coins } from 'lucide-react'

const WAGER_PRESETS = [
    { label: 'Free', value: 0 },
    { label: '10', value: 10 },
    { label: '25', value: 25 },
    { label: '50', value: 50 },
    { label: '100', value: 100 },
]

const FLIP_CYCLE = [passionCoin, flip1, flip2, flip3, passionTails, flip3, flip2, flip1]
const INITIAL_SHOW = 10

// ═══════════════════════════════════════════════════
// Background — scattered passion coins
// ═══════════════════════════════════════════════════
function CoinBackground() {
    const coins = useRef([
        { bottom: '-10%', right: '-6%', size: 600, opacity: 0.04, rotate: -8, delay: 0 },
        { top: '5%', left: '-3%', size: 200, opacity: 0.02, rotate: 15, delay: 2 },
        { top: '35%', right: '2%', size: 140, opacity: 0.018, rotate: -20, delay: 4 },
        { bottom: '15%', left: '8%', size: 100, opacity: 0.015, rotate: 25, delay: 6 },
        { top: '60%', right: '15%', size: 90, opacity: 0.012, rotate: -12, delay: 3 },
        { top: '15%', right: '20%', size: 120, opacity: 0.015, rotate: 10, delay: 5 },
        { bottom: '30%', left: '25%', size: 80, opacity: 0.01, rotate: -30, delay: 7 },
    ]).current

    return (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden>
            {coins.map((c, i) => (
                <div key={i} className="absolute pred-coin-bg"
                    style={{
                        top: c.top, bottom: c.bottom, left: c.left, right: c.right,
                        width: c.size, height: c.size,
                        animationDelay: `${c.delay}s`,
                    }}>
                    <img src={passionTilted} alt=""
                        className="w-full h-full object-contain"
                        style={{ opacity: c.opacity, transform: `rotate(${c.rotate}deg)` }} />
                </div>
            ))}
        </div>
    )
}

// ═══════════════════════════════════════════════════
// Floating particles
// ═══════════════════════════════════════════════════
function FloatingParticles() {
    const particles = useRef(
        Array.from({ length: 14 }, (_, i) => ({
            id: i,
            left: Math.random() * 100,
            delay: Math.random() * 20,
            duration: 18 + Math.random() * 12,
            size: 2 + Math.random() * 2,
            opacity: 0.05 + Math.random() * 0.07,
        }))
    ).current

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
            {particles.map(p => (
                <div key={p.id}
                    className="absolute rounded-full pred-particle"
                    style={{
                        left: `${p.left}%`,
                        width: p.size,
                        height: p.size,
                        opacity: p.opacity,
                        background: 'rgba(248,197,106,0.6)',
                        boxShadow: '0 0 4px rgba(248,197,106,0.3)',
                        animationDelay: `${p.delay}s`,
                        animationDuration: `${p.duration}s`,
                    }}
                />
            ))}
        </div>
    )
}

// ═══════════════════════════════════════════════════
// Coin flip overlay — big epic flip
// ═══════════════════════════════════════════════════
function CoinFlipOverlay({ open, onClose }) {
    const [result, setResult] = useState(null)
    const [showExplosion, setShowExplosion] = useState(false)
    const [phase, setPhase] = useState('idle') // idle | spinning | landing | done
    const coinInnerRef = useRef(null)
    const coinLiftRef = useRef(null)
    const coinShadowRef = useRef(null)
    const rotationRef = useRef(0)
    const spinRafRef = useRef(null)
    const spinStartRef = useRef(0)
    const closeTimerRef = useRef(null)

    // Auto-flip when opened
    useEffect(() => {
        if (!open) return
        setResult(null)
        setShowExplosion(false)
        setPhase('idle')
        rotationRef.current = 0

        // Delay so DOM mounts and 3D compositing layer is ready
        const t = setTimeout(() => startSpin(), 200)
        return () => { clearTimeout(t); cancelAnimationFrame(spinRafRef.current); clearTimeout(closeTimerRef.current) }
    }, [open])

    useEffect(() => () => { cancelAnimationFrame(spinRafRef.current); clearTimeout(closeTimerRef.current) }, [])

    const startSpin = () => {
        const inner = coinInnerRef.current
        const lift = coinLiftRef.current
        const shadow = coinShadowRef.current
        if (!inner || !lift) return

        setPhase('spinning')
        const outcome = Math.random() < 0.5 ? 'heads' : 'tails'

        // Reset
        inner.style.transition = 'none'
        lift.style.transition = 'none'
        void lift.offsetHeight

        // Launch up
        lift.style.transition = 'transform 0.35s cubic-bezier(0.2, 0, 0, 1)'
        lift.style.transform = 'translateY(-80px) translateZ(300px)'
        if (shadow) {
            shadow.style.transition = 'all 0.35s cubic-bezier(0.2, 0, 0, 1)'
            shadow.style.opacity = '0.5'
            shadow.style.transform = 'scaleX(2) scaleY(1)'
        }

        // Spin via rAF
        spinStartRef.current = performance.now()
        const spin = (now) => {
            const elapsed = now - spinStartRef.current
            const accel = Math.min(elapsed / 300, 1)
            const speed = accel * 22
            rotationRef.current += speed
            inner.style.transform = `rotateX(${rotationRef.current}deg)`
            spinRafRef.current = requestAnimationFrame(spin)
        }
        spinRafRef.current = requestAnimationFrame(spin)

        // Land after delay
        setTimeout(() => landOn(outcome), 600)
    }

    const landOn = (outcome) => {
        cancelAnimationFrame(spinRafRef.current)
        const inner = coinInnerRef.current
        const lift = coinLiftRef.current
        const shadow = coinShadowRef.current
        if (!inner || !lift) return

        setPhase('landing')
        const current = rotationRef.current
        const minTarget = current + 720
        let target
        if (outcome === 'heads') {
            target = Math.ceil(minTarget / 360) * 360
        } else {
            target = Math.ceil((minTarget - 180) / 360) * 360 + 180
        }
        rotationRef.current = target

        // Settle back
        lift.style.transition = 'transform 0.65s cubic-bezier(0.2, 0, 0.3, 1)'
        lift.style.transform = 'translateY(0px) translateZ(0px)'
        if (shadow) {
            shadow.style.transition = 'all 0.65s cubic-bezier(0.2, 0, 0.3, 1)'
            shadow.style.opacity = '0.15'
            shadow.style.transform = 'scaleX(1) scaleY(0.5)'
        }
        inner.style.transition = 'transform 0.7s cubic-bezier(0.1, 0, 0.15, 1)'
        inner.style.transform = `rotateX(${target}deg)`

        // Bounce
        setTimeout(() => {
            if (!lift) return
            lift.style.transition = 'transform 0.12s ease-out'
            lift.style.transform = 'translateY(-8px) translateZ(25px)'
            setTimeout(() => {
                lift.style.transition = 'transform 0.15s ease-in'
                lift.style.transform = 'translateY(0px) translateZ(0px)'
            }, 120)
        }, 600)

        // Reveal result
        setTimeout(() => {
            setResult(outcome)
            setPhase('done')
            setShowExplosion(true)
            setTimeout(() => setShowExplosion(false), 1200)
        }, 750)

        // Auto-dismiss
        closeTimerRef.current = setTimeout(() => onClose(), 2800)
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget && phase === 'done') onClose() }}
            style={{ background: 'rgba(0,0,0,0.92)' }}>

            <div className="flex flex-col items-center">
                <div className="relative mb-8">
                    {/* 3D Coin */}
                    <div className="pred-coin-3d-scene" style={{ width: 220, height: 220 }}>
                        <div ref={coinLiftRef} className="pred-coin-3d-lift" style={{ width: '100%', height: '100%' }}>
                            <div ref={coinInnerRef} className="pred-coin-3d-inner" style={{ width: '100%', height: '100%' }}>
                                <div className="pred-coin-3d-face">
                                    <img src={passionCoin} alt="Heads" className="w-full h-full object-contain drop-shadow-[0_0_30px_rgba(248,197,106,0.4)]" />
                                </div>
                                <div className="pred-coin-3d-back">
                                    <img src={passionTails} alt="Tails" className="w-full h-full object-contain drop-shadow-[0_0_30px_rgba(248,197,106,0.4)]" />
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Shadow */}
                    <div ref={coinShadowRef} className="mx-auto mt-2" style={{
                        width: 140, height: 16, borderRadius: '50%',
                        background: 'radial-gradient(ellipse, rgba(248,197,106,0.15) 0%, transparent 70%)',
                        opacity: 0.15, transform: 'scaleX(1) scaleY(0.5)',
                    }} />
                    {showExplosion && (
                        <img src={passionsplosion} alt="" className="absolute inset-0 w-full h-full object-contain pred-coinflip-explode pointer-events-none" />
                    )}
                </div>

                <div className="h-14 flex items-center justify-center">
                    {result && phase === 'done' && (
                        <div className={`text-4xl sm:text-5xl font-black uppercase tracking-wider pred-card-enter ${
                            result === 'heads' ? 'text-green-400' : 'text-red-400'
                        }`}>
                            {result === 'heads' ? 'Heads!' : 'Tails!'}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════
// Wager bar — preset amounts + custom + confirm
// ═══════════════════════════════════════════════════
function WagerBar({ teamName, passion, onSubmit, onCancel, submitting, submitError }) {
    const [wagerAmount, setWagerAmount] = useState(0)
    const [customMode, setCustomMode] = useState(false)
    const [customInput, setCustomInput] = useState('')

    const activeAmount = customMode ? (parseInt(customInput) || 0) : wagerAmount

    return (
        <div className="pred-wager-enter mt-4 pt-3" style={{ borderTop: '1px solid rgba(248,197,106,0.12)' }}>
            <div className="flex items-center gap-2 mb-2.5">
                <img src={passionCoin} alt="" className="w-3.5 h-3.5" />
                <span className="text-[11px] font-semibold" style={{ color: '#f8c56a' }}>
                    Wager on {teamName}
                </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
                {WAGER_PRESETS.map(p => {
                    const isActive = !customMode && wagerAmount === p.value
                    const canAfford = p.value === 0 || (passion?.balance >= p.value)
                    return (
                        <button key={p.value}
                            onClick={() => { setCustomMode(false); setWagerAmount(p.value) }}
                            disabled={!canAfford}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed ${
                                isActive ? 'font-bold text-[#0a0f1a]' : 'text-white/70 hover:text-white'
                            }`}
                            style={{
                                background: isActive
                                    ? 'linear-gradient(135deg, #c4922e, #f8c56a)'
                                    : 'rgba(255,255,255,0.08)',
                            }}>
                            {p.value === 0 ? 'Free' : (
                                <span className="inline-flex items-center gap-1">
                                    <img src={passionCoin} alt="" className="w-3 h-3" />
                                    {p.label}
                                </span>
                            )}
                        </button>
                    )
                })}

                {!customMode ? (
                    <button onClick={() => setCustomMode(true)}
                        className="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white/80 transition-colors cursor-pointer"
                        style={{ background: 'rgba(255,255,255,0.08)' }}>
                        Custom
                    </button>
                ) : (
                    <div className="inline-flex items-center gap-1 rounded-lg px-2 py-1"
                        style={{ background: 'rgba(248,197,106,0.1)', border: '1px solid rgba(248,197,106,0.25)' }}>
                        <img src={passionCoin} alt="" className="w-3 h-3" />
                        <input type="number" min="5" value={customInput} onChange={e => setCustomInput(e.target.value)}
                            placeholder="Amount" autoFocus
                            className="bg-transparent text-xs text-white w-14 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                    </div>
                )}

                <div className="flex-1 min-w-4" />

                <button onClick={() => onSubmit(activeAmount)} disabled={submitting || (customMode && activeAmount > 0 && activeAmount < 5)}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-30 hover:brightness-110 hover:scale-[1.02] active:scale-95"
                    style={{ background: 'linear-gradient(135deg, #c4922e, #f8c56a)', color: '#0a0f1a' }}>
                    <Target className="w-3.5 h-3.5" />
                    {submitting ? '...' : activeAmount > 0 ? 'Wager' : 'Predict'}
                </button>

                <button onClick={onCancel} className="p-1.5 text-white/30 hover:text-white/60 cursor-pointer transition-colors">
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            {submitError && <p className="text-[10px] text-red-400 mt-2">{submitError}</p>}
        </div>
    )
}


// ═══════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════
export default function Predictions() {
    const { user, login, hasAnyPermission } = useAuth()
    const passion = usePassion()
    const [searchParams] = useSearchParams()
    const [entered, setEntered] = useState(false)

    const [coinFlipOpen, setCoinFlipOpen] = useState(false)

    const [activeTab, setActiveTab] = useState('upcoming')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [search, setSearch] = useState('')
    const [showAll, setShowAll] = useState(false)

    const [matches, setMatches] = useState([])
    const [leagues, setLeagues] = useState([])
    const [selectedLeague, setSelectedLeague] = useState('')
    const [selectedDivision, setSelectedDivision] = useState('')
    const [myPredictions, setMyPredictions] = useState([])
    const [myStats, setMyStats] = useState(null)
    const [leaderboard, setLeaderboard] = useState([])

    useEffect(() => { requestAnimationFrame(() => setEntered(true)) }, [])

    useEffect(() => {
        leagueService.getAll()
            .then(all => Promise.all(all.map(l => leagueService.getBySlug(l.slug))))
            .then(detailed => setLeagues(detailed.filter(l => l.name?.toLowerCase() !== 'test league')))
            .catch(() => {})
    }, [])

    useEffect(() => {
        const league = searchParams.get('league')
        const division = searchParams.get('division')
        if (league) setSelectedLeague(league)
        if (division) setSelectedDivision(division)
    }, [searchParams])

    const loadData = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            if (activeTab === 'upcoming' || activeTab === 'results') {
                const filters = {}
                if (selectedLeague) {
                    const league = leagues.find(l => l.slug === selectedLeague)
                    if (league) filters.leagueId = league.id
                }
                if (selectedDivision) {
                    const league = leagues.find(l => l.slug === selectedLeague)
                    const div = league?.divisions?.find(d => d.slug === selectedDivision)
                    if (div) filters.divisionId = div.id
                }
                const data = await predictionsService.getUpcoming(filters)
                setMatches(data.matches || [])
            } else if (activeTab === 'my-predictions') {
                if (!user) { setLoading(false); return }
                const data = await predictionsService.getMyPredictions()
                setMyPredictions(data.predictions || [])
                setMyStats(data.stats || null)
            } else if (activeTab === 'leaderboard') {
                const data = await predictionsService.getLeaderboard()
                setLeaderboard(data.leaderboard || [])
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [activeTab, selectedLeague, selectedDivision, leagues, user])

    useEffect(() => { loadData() }, [loadData])

    // Filter only active leagues (those with at least one active season)
    const activeLeagues = useMemo(() =>
        leagues.filter(l => l.divisions?.some(d => d.seasons?.some(s => s.is_active)))
    , [leagues])

    // Sort: week ASC, then hype DESC. Top 3 = featured. Split open vs closed.
    const { openWeekGroups, featured, closedMatches } = useMemo(() => {
        let filtered = matches
        if (search.trim()) {
            const q = search.toLowerCase()
            filtered = filtered.filter(m =>
                m.team1.name.toLowerCase().includes(q) ||
                m.team2.name.toLowerCase().includes(q) ||
                m.leagueName?.toLowerCase().includes(q) ||
                m.divisionName?.toLowerCase().includes(q)
            )
        }

        const open = filtered.filter(m => m.status === 'scheduled' && !m.isLocked)
        const closed = filtered.filter(m => m.status !== 'scheduled' || m.isLocked)

        // Top 3 hype matches as featured (from open only)
        const sortedByHype = [...open].sort((a, b) => (b.hypeScore || 0) - (a.hypeScore || 0))
        const feat = sortedByHype.filter(m => m.hypeScore >= 40).slice(0, 3)
        const featIds = new Set(feat.map(m => m.id))

        // Group remaining open by week
        const remaining = open.filter(m => !featIds.has(m.id))
        remaining.sort((a, b) => {
            const wa = a.week ?? 999
            const wb = b.week ?? 999
            if (wa !== wb) return wa - wb
            return (b.hypeScore || 0) - (a.hypeScore || 0)
        })

        const groups = []
        let currentWeek = null
        let currentGroup = null
        for (const m of remaining) {
            const week = m.week ?? null
            if (week !== currentWeek) {
                currentWeek = week
                currentGroup = { week, matches: [] }
                groups.push(currentGroup)
            }
            currentGroup.matches.push(m)
        }

        return { openWeekGroups: groups, featured: feat, closedMatches: closed }
    }, [matches, search])

    const selectedLeagueObj = activeLeagues.find(l => l.slug === selectedLeague)
    const availableDivisions = selectedLeagueObj?.divisions?.filter(d => d.seasons?.some(s => s.is_active)) || []

    const TABS = [
        { key: 'upcoming', label: 'Markets', icon: Target },
        { key: 'results', label: 'Results', icon: Trophy },
        { key: 'my-predictions', label: 'Portfolio', icon: TrendingUp },
        { key: 'leaderboard', label: 'Rankings', icon: Flame },
    ]

    // Predictions disabled for non-admin users
    if (!hasAnyPermission) {
        return (
            <div className="min-h-screen bg-(--color-primary)">
                <Navbar title="Predictions" />
                <div className="max-w-md mx-auto py-24 px-4 text-center">
                    <Lock className="w-12 h-12 mx-auto mb-4 text-(--color-text-secondary)" />
                    <h1 className="font-heading text-2xl font-bold text-(--color-text) mb-2">Predictions Unavailable</h1>
                    <p className="text-sm text-(--color-text-secondary)">
                        Match predictions are currently disabled.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen text-white relative">
            <Navbar title="Predictions" />
            <PageTitle title="Match Predictions" />
            <CoinBackground />
            <CoinFlipOverlay open={coinFlipOpen} onClose={() => setCoinFlipOpen(false)} />

            {/* ═══ FULL-PAGE GRADIENT BACKGROUND ═══ */}
            <div className="fixed inset-0 z-0" aria-hidden>
                <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #111830 0%, #161e38 35%, #1a2240 55%, #151d34 100%)' }} />
                <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 90% 50% at 50% 8%, rgba(248,197,106,0.25) 0%, transparent 65%)' }} />
                <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 70% 50% at 90% 25%, rgba(168,85,247,0.16) 0%, transparent 55%)' }} />
                <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 45% at 10% 45%, rgba(99,102,241,0.13) 0%, transparent 55%)' }} />
                <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 40% at 50% 85%, rgba(248,197,106,0.12) 0%, transparent 55%)' }} />
                <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 50% 35% at 70% 60%, rgba(196,146,46,0.08) 0%, transparent 50%)' }} />
            </div>

            {/* ═══ HERO ═══ */}
            <section className="relative min-h-[30vh] sm:min-h-[34vh] flex items-end overflow-hidden">
                <FloatingParticles />
                <div className={`relative w-full max-w-6xl mx-auto px-4 sm:px-6 pb-6 sm:pb-8 pt-24 transition-all duration-1000 ${entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                    {user && passion && !passion.loading && (
                        <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full mb-4"
                            style={{ background: 'rgba(248,197,106,0.1)', border: '1px solid rgba(248,197,106,0.15)' }}>
                            <RankBadge rank={passion.rank} size="sm" />
                            <img src={passionCoin} alt="" className="w-4 h-4" />
                            <span className="text-sm font-bold tabular-nums" style={{ color: '#f8c56a' }}>{passion.balance?.toLocaleString()}</span>
                        </div>
                    )}

                    <h1 className="font-heading font-black text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[0.95]">
                        <span className="block text-white">Predict with</span>
                        <span className="block pred-gold-text">Passion.</span>
                    </h1>
                    <p className="mt-3 text-white/60 text-sm sm:text-base max-w-md leading-relaxed">
                        Pick match winners, wager Passion, earn dynamic rewards.
                    </p>

                    {!user && (
                        <button onClick={login}
                            className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-lg font-bold text-sm text-white transition-all hover:opacity-90 active:scale-95 cursor-pointer"
                            style={{ backgroundColor: '#5865F2' }}>
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                            </svg>
                            Login to Predict
                        </button>
                    )}
                </div>
            </section>

            {/* ═══ TAB BAR ═══ */}
            <div className="sticky top-[72px] z-30" style={{ background: 'rgba(18,26,52,0.9)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(248,197,106,0.12)' }}>
                <div className="max-w-6xl mx-auto px-2 sm:px-6">
                    <div className="flex">
                        {TABS.map(tab => (
                            <button key={tab.key} onClick={() => { setActiveTab(tab.key); setShowAll(false) }}
                                className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-5 py-3.5 text-xs sm:text-sm font-medium transition-all cursor-pointer border-b-2 ${
                                    activeTab === tab.key
                                        ? 'text-[#f8c56a] border-[#f8c56a]'
                                        : 'text-white/40 border-transparent hover:text-white/70'
                                }`}>
                                <tab.icon className="w-4 h-4 flex-shrink-0" />
                                <span className={`${activeTab === tab.key ? '' : 'hidden sm:inline'}`}>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ═══ CONTENT BACKGROUND ═══ */}
            <div className="relative z-5" aria-hidden>
                <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(14,20,40,0.7) 0%, rgba(18,26,50,0.5) 30%, transparent 100%)', height: '400px' }} />
            </div>

            {/* ═══ CONTENT ═══ */}
            <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
                {activeTab === 'upcoming' && (
                    <UpcomingTab
                        weekGroups={openWeekGroups} featured={featured}
                        loading={loading} error={error}
                        user={user} login={login} passion={passion}
                        leagues={activeLeagues} selectedLeague={selectedLeague}
                        setSelectedLeague={v => { setSelectedLeague(v); setSelectedDivision('') }}
                        selectedDivision={selectedDivision} setSelectedDivision={setSelectedDivision}
                        availableDivisions={availableDivisions}
                        search={search} setSearch={setSearch}
                        showAll={showAll} setShowAll={setShowAll}
                        onPredictionMade={loadData}
                        onCoinFlip={() => setCoinFlipOpen(true)}
                    />
                )}
                {activeTab === 'results' && (
                    <ResultsTab
                        matches={closedMatches} loading={loading} error={error}
                        leagues={activeLeagues} selectedLeague={selectedLeague}
                        setSelectedLeague={v => { setSelectedLeague(v); setSelectedDivision('') }}
                        selectedDivision={selectedDivision} setSelectedDivision={setSelectedDivision}
                        availableDivisions={availableDivisions}
                        search={search} setSearch={setSearch}
                    />
                )}
                {activeTab === 'my-predictions' && (
                    <MyPredictionsTab predictions={myPredictions} stats={myStats} loading={loading} error={error} user={user} login={login} />
                )}
                {activeTab === 'leaderboard' && (
                    <LeaderboardTab leaderboard={leaderboard} loading={loading} error={error} user={user} />
                )}
            </div>

            {/* ═══ STYLES ═══ */}
            <style>{`
                .pred-gold-text {
                    background: linear-gradient(135deg, #d4a04a 0%, #f8c56a 30%, #ffe4a0 50%, #f8c56a 70%, #c4922e 100%);
                    background-size: 200% 100%;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    animation: pred-gold-shift 6s ease-in-out infinite;
                }
                @keyframes pred-gold-shift {
                    0%, 100% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                }
                .pred-particle {
                    animation: pred-float linear infinite;
                }
                @keyframes pred-float {
                    0% { opacity: 0; transform: translateY(100vh) scale(0.5); }
                    5% { opacity: var(--p-opacity, 0.08); }
                    90% { opacity: var(--p-opacity, 0.08); }
                    100% { opacity: 0; transform: translateY(-20vh) scale(1.5); }
                }
                .pred-card-enter {
                    animation: pred-card-in 0.5s ease-out both;
                }
                @keyframes pred-card-in {
                    0% { opacity: 0; transform: translateY(12px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                .pred-coin-bg {
                    animation: pred-coin-pulse 12s ease-in-out infinite;
                }
                @keyframes pred-coin-pulse {
                    0%, 100% { filter: brightness(0.95); }
                    50% { filter: brightness(1.2); }
                }
                .pred-wager-enter {
                    animation: pred-wager-slide 0.3s ease-out both;
                }
                @keyframes pred-wager-slide {
                    0% { opacity: 0; transform: translateY(-6px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                .pred-shimmer {
                    animation: pred-shimmer-move 3s ease-in-out infinite;
                }
                @keyframes pred-shimmer-move {
                    0% { transform: translateX(-100%) skewX(-15deg); }
                    100% { transform: translateX(300%) skewX(-15deg); }
                }
                .pred-featured-glow {
                    animation: pred-featured-pulse 3s ease-in-out infinite;
                }
                @keyframes pred-featured-pulse {
                    0%, 100% { box-shadow: 0 0 30px -10px rgba(248,197,106,0.12); }
                    50% { box-shadow: 0 0 50px -10px rgba(248,197,106,0.22); }
                }
                .pred-team-btn {
                    transition: all 0.2s ease;
                }
                .pred-team-btn:not(:disabled):hover {
                    background: rgba(248,197,106,0.06);
                    transform: scale(1.02);
                }
                .pred-team-btn.pred-selected {
                    background: rgba(248,197,106,0.1);
                    box-shadow: 0 0 20px -4px rgba(248,197,106,0.15), inset 0 0 0 1px rgba(248,197,106,0.25);
                }
                .pred-team-btn.pred-selected img {
                    filter: drop-shadow(0 0 12px rgba(248,197,106,0.35));
                }
                .pred-vs {
                    font-style: italic;
                    font-weight: 900;
                    color: #f8c56a;
                    filter: drop-shadow(0 0 12px rgba(248,197,106,0.4));
                    letter-spacing: 0.15em;
                }
                .pred-coin-3d-scene {
                    perspective: 600px;
                    perspective-origin: 50% 50%;
                }
                .pred-coin-3d-lift {
                    transform-style: preserve-3d;
                    transform: translateY(0) translateZ(0);
                    will-change: transform;
                }
                .pred-coin-3d-inner {
                    position: relative;
                    transform-style: preserve-3d;
                    transform: rotateX(0deg);
                    will-change: transform;
                }
                .pred-coin-3d-face {
                    position: absolute;
                    inset: 0;
                    backface-visibility: hidden;
                    -webkit-backface-visibility: hidden;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .pred-coin-3d-back {
                    position: absolute;
                    inset: 0;
                    backface-visibility: hidden;
                    -webkit-backface-visibility: hidden;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transform: rotateX(180deg);
                }
                @keyframes pred-coinflip-arc {
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
                .pred-coinflip-arc {
                    animation: pred-coinflip-arc 1.3s cubic-bezier(0.25, 0.1, 0.25, 1) forwards;
                }
                @keyframes pred-coinflip-explode {
                    0% { transform: scale(0.3); opacity: 1; }
                    60% { transform: scale(1.5); opacity: 0.7; }
                    100% { transform: scale(2.2); opacity: 0; }
                }
                .pred-coinflip-explode {
                    animation: pred-coinflip-explode 1.2s ease-out forwards;
                }
                .pred-expand-enter {
                    animation: pred-expand-in 0.3s ease-out both;
                }
                @keyframes pred-expand-in {
                    0% { opacity: 0; max-height: 0; }
                    100% { opacity: 1; max-height: 200px; }
                }
            `}</style>
        </div>
    )
}


// ═══════════════════════════════════════════════════
// League / Division icon filter bar
// ═══════════════════════════════════════════════════
function FilterBar({ leagues, selectedLeague, setSelectedLeague, selectedDivision, setSelectedDivision, availableDivisions, search, setSearch }) {
    return (
        <div className="mb-6 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setSelectedLeague('')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        !selectedLeague ? 'text-[#f8c56a] font-bold' : 'text-white/60 hover:text-white'
                    }`}
                    style={{ background: !selectedLeague ? 'rgba(248,197,106,0.12)' : 'rgba(255,255,255,0.06)' }}>
                    All
                </button>
                {leagues.map(l => {
                    const logo = getLeagueLogo(l.slug)
                    const isActive = selectedLeague === l.slug
                    return (
                        <button key={l.id} onClick={() => setSelectedLeague(isActive ? '' : l.slug)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                isActive ? 'text-white font-bold' : 'text-white/60 hover:text-white'
                            }`}
                            style={{
                                background: isActive ? `${l.color || '#f8c56a'}20` : 'rgba(255,255,255,0.06)',
                                boxShadow: isActive ? `inset 0 0 0 1px ${l.color || '#f8c56a'}40` : 'none',
                            }}>
                            {logo && <img src={logo} alt="" className="w-5 h-5 object-contain" />}
                            <span className="hidden sm:inline">{l.name}</span>
                        </button>
                    )
                })}

                <div className="flex-1" />
                <div className="relative w-full sm:w-48">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
                    <input type="text" placeholder="Search teams..." value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs text-white placeholder:text-white/30 outline-none transition-colors"
                        style={{ background: 'rgba(255,255,255,0.06)' }} />
                </div>
            </div>

            {selectedLeague && availableDivisions.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => setSelectedDivision('')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                            !selectedDivision ? 'text-[#f8c56a] font-bold' : 'text-white/50 hover:text-white/80'
                        }`}
                        style={{ background: !selectedDivision ? 'rgba(248,197,106,0.1)' : 'rgba(255,255,255,0.05)' }}>
                        All Divisions
                    </button>
                    {availableDivisions.map(d => {
                        const divImg = getDivisionImage(selectedLeague, d.slug, d.tier)
                        const isActive = selectedDivision === d.slug
                        return (
                            <button key={d.id} onClick={() => setSelectedDivision(isActive ? '' : d.slug)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                                    isActive ? 'text-white font-bold' : 'text-white/50 hover:text-white/80'
                                }`}
                                style={{
                                    background: isActive ? 'rgba(248,197,106,0.1)' : 'rgba(255,255,255,0.05)',
                                    boxShadow: isActive ? 'inset 0 0 0 1px rgba(248,197,106,0.2)' : 'none',
                                }}>
                                {divImg && <img src={divImg} alt="" className="w-4 h-4 object-contain" />}
                                {d.name}
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}


// ═══════════════════════════════════════════════════
// Upcoming Tab
// ═══════════════════════════════════════════════════
function UpcomingTab({
    weekGroups, featured, loading, error, user, login, passion,
    leagues, selectedLeague, setSelectedLeague,
    selectedDivision, setSelectedDivision, availableDivisions,
    search, setSearch, showAll, setShowAll, onPredictionMade, onCoinFlip,
}) {
    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="w-10 h-10 border-2 border-white/10 border-t-[#f8c56a] rounded-full animate-spin" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="py-8 text-center">
                <p className="text-red-400/80 text-sm">{error}</p>
            </div>
        )
    }

    // Flatten all non-featured matches, limit to INITIAL_SHOW unless showAll
    const allRegular = weekGroups.flatMap(g => g.matches)
    const visibleCount = showAll ? allRegular.length : INITIAL_SHOW
    const hasMore = allRegular.length > INITIAL_SHOW && !showAll

    // Rebuild week groups from visible matches
    const visibleMatches = allRegular.slice(0, visibleCount)
    const visibleGroups = []
    let curWeek = null, curGroup = null
    for (const m of visibleMatches) {
        const week = m.week ?? null
        if (week !== curWeek) {
            curWeek = week
            curGroup = { week, matches: [] }
            visibleGroups.push(curGroup)
        }
        curGroup.matches.push(m)
    }

    const noMatches = featured.length === 0 && allRegular.length === 0

    return (
        <div>
            <FilterBar
                leagues={leagues} selectedLeague={selectedLeague} setSelectedLeague={setSelectedLeague}
                selectedDivision={selectedDivision} setSelectedDivision={setSelectedDivision}
                availableDivisions={availableDivisions} search={search} setSearch={setSearch}
            />

            {noMatches ? (
                <div className="py-20 text-center">
                    <Target className="w-12 h-12 text-white/10 mx-auto mb-4" />
                    <h3 className="text-base font-heading font-bold text-white/60 mb-1">No Active Markets</h3>
                    <p className="text-white/40 text-sm">New markets open when matches are scheduled.</p>
                </div>
            ) : (
                <>
                    {/* Coin flip button */}
                    <div className="flex justify-end mb-4">
                        <button onClick={onCoinFlip}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer"
                            style={{ background: 'rgba(248,197,106,0.1)', border: '1px solid rgba(248,197,106,0.2)', color: '#f8c56a' }}>
                            <Coins className="w-4 h-4" />
                            Can't Decide? Flip!
                        </button>
                    </div>

                    {/* Featured matches — all full width */}
                    {featured.length > 0 && (
                        <div className="mb-8">
                            <div className="flex items-center gap-2 mb-4">
                                <Flame className="w-4 h-4" style={{ color: '#f8c56a' }} />
                                <span className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color: '#f8c56a' }}>
                                    Featured Matches
                                </span>
                            </div>
                            <div className="space-y-4">
                                {featured.map((m, i) => (
                                    <FeaturedCard key={m.id} match={m} index={i} user={user} login={login} passion={passion} onPredictionMade={onPredictionMade} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Week groups */}
                    {visibleGroups.map((group, gi) => (
                        <div key={gi} className="mb-6">
                            <div className="flex items-center gap-3 mb-3">
                                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/40">
                                    {group.week ? `Week ${group.week}` : 'Unscheduled'}
                                </span>
                                <div className="flex-1 h-px bg-white/[0.06]" />
                                <span className="text-[10px] text-white/30">{group.matches.length}</span>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                {group.matches.map((m, i) => (
                                    <MatchCard key={m.id} match={m} index={i} user={user} login={login} passion={passion} onPredictionMade={onPredictionMade} />
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* Show more button */}
                    {hasMore && (
                        <div className="text-center mt-6">
                            <button onClick={() => setShowAll(true)}
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer"
                                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                <ChevronDown className="w-4 h-4" />
                                Show {allRegular.length - INITIAL_SHOW} More Matches
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}


// ═══════════════════════════════════════════════════
// Results Tab — locked and resolved matches
// ═══════════════════════════════════════════════════
function ResultsTab({
    matches, loading, error,
    leagues, selectedLeague, setSelectedLeague,
    selectedDivision, setSelectedDivision, availableDivisions,
    search, setSearch,
}) {
    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="w-10 h-10 border-2 border-white/10 border-t-[#f8c56a] rounded-full animate-spin" />
            </div>
        )
    }

    let filtered = matches
    if (search.trim()) {
        const q = search.toLowerCase()
        filtered = filtered.filter(m =>
            m.team1.name.toLowerCase().includes(q) ||
            m.team2.name.toLowerCase().includes(q) ||
            m.leagueName?.toLowerCase().includes(q) ||
            m.divisionName?.toLowerCase().includes(q)
        )
    }

    // Sort by date descending (most recent first)
    const sorted = [...filtered].sort((a, b) => new Date(b.scheduledDate) - new Date(a.scheduledDate))

    return (
        <div>
            <FilterBar
                leagues={leagues} selectedLeague={selectedLeague} setSelectedLeague={setSelectedLeague}
                selectedDivision={selectedDivision} setSelectedDivision={setSelectedDivision}
                availableDivisions={availableDivisions} search={search} setSearch={setSearch}
            />

            {sorted.length === 0 ? (
                <div className="py-20 text-center">
                    <Trophy className="w-12 h-12 text-white/10 mx-auto mb-4" />
                    <h3 className="text-base font-heading font-bold text-white/60 mb-1">No Results Yet</h3>
                    <p className="text-white/40 text-sm">Results appear when predictions lock or matches complete.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {sorted.map((match, i) => {
                        const t1 = match.team1
                        const t2 = match.team2
                        const isResolved = match.userPrediction?.status === 'won' || match.userPrediction?.status === 'lost'
                        const userWon = match.userPrediction?.status === 'won'
                        const hasWager = match.userPrediction?.wagerAmount > 0
                        const leagueLogo = getLeagueLogo(match.leagueSlug)
                        const divisionImg = getDivisionImage(match.leagueSlug, match.divisionSlug, match.divisionTier)

                        return (
                            <div key={match.id} className="relative rounded-xl overflow-hidden pred-card-enter"
                                style={{
                                    animationDelay: `${i * 30}ms`,
                                    background: isResolved && userWon ? 'rgba(34,197,94,0.06)' : isResolved ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.04)',
                                    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                }}>
                                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                                    {leagueLogo && <img src={leagueLogo} alt="" className="absolute top-2 left-3 w-8 h-8 object-contain opacity-[0.08]" />}
                                    {divisionImg && <img src={divisionImg} alt="" className="absolute bottom-2 right-3 w-10 h-10 object-contain opacity-[0.09]" />}
                                </div>
                                <div className="relative p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-1.5 text-[10px] text-white/50">
                                            {leagueLogo && <img src={leagueLogo} alt="" className="w-3.5 h-3.5 object-contain" />}
                                            <span>{match.leagueName}</span>
                                            <span className="text-white/25">·</span>
                                            {divisionImg && <img src={divisionImg} alt="" className="w-3.5 h-3.5 object-contain" />}
                                            <span>{match.divisionName}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {isResolved && userWon && <span className="text-[10px] font-bold text-green-400">Won</span>}
                                            {isResolved && !userWon && <span className="text-[10px] font-bold text-red-400/70">Lost</span>}
                                            {match.userPrediction?.status === 'refunded' && <span className="text-[10px] font-bold text-yellow-400">Refunded</span>}
                                            {!isResolved && !match.userPrediction?.status && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white/40"><Lock className="w-2.5 h-2.5" /> Locked</span>}
                                            <span className="text-xs text-white/50 tabular-nums">
                                                {new Date(match.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-evenly">
                                        <div className="flex flex-col items-center text-center md:flex-row md:text-left gap-1.5 md:gap-3 flex-1">
                                            <TeamLogo slug={t1.slug} name={t1.name} size={28} className="md:!w-[36px] md:!h-[36px] flex-shrink-0" />
                                            <span className={`text-xs md:text-sm font-bold ${match.winnerTeamId === t1.id ? 'text-green-400' : 'text-white'}`}>{t1.name}</span>
                                            {match.winnerTeamId === t1.id && <span className="text-[9px] font-bold text-green-400">WIN</span>}
                                        </div>
                                        <span className="pred-vs text-xs md:text-sm px-1 md:px-3">VS</span>
                                        <div className="flex flex-col items-center text-center md:flex-row-reverse md:text-right gap-1.5 md:gap-3 flex-1">
                                            <TeamLogo slug={t2.slug} name={t2.name} size={28} className="md:!w-[36px] md:!h-[36px] flex-shrink-0" />
                                            <span className={`text-xs md:text-sm font-bold ${match.winnerTeamId === t2.id ? 'text-green-400' : 'text-white'}`}>{t2.name}</span>
                                            {match.winnerTeamId === t2.id && <span className="text-[9px] font-bold text-green-400">WIN</span>}
                                        </div>
                                    </div>

                                    {match.community && <CommunityOdds match={match} t1={t1} t2={t2} compact />}

                                    {isResolved && match.userPrediction && (
                                        <div className={`flex items-center justify-between mt-3 text-xs ${userWon ? 'text-green-400' : 'text-red-400/60'}`}>
                                            <span>
                                                Picked {match.userPrediction.predictedTeamId === t1.id ? t1.name : t2.name}
                                                {hasWager && <> · {match.userPrediction.wagerAmount} <img src={passionCoin} alt="" className="w-3 h-3 inline" /></>}
                                            </span>
                                            {userWon && match.userPrediction.payoutAmount > 0 && (
                                                <span className="flex items-center gap-1 font-bold">
                                                    +{match.userPrediction.payoutAmount} <img src={passionCoin} alt="" className="w-3.5 h-3.5" />
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    <Link to={`/matchup/${match.id}`}
                                        className="flex items-center gap-1 mt-2 text-[10px] text-white/40 hover:text-[#f8c56a] transition-colors">
                                        <Eye className="w-3 h-3" /> Details
                                    </Link>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}


// ═══════════════════════════════════════════════════
// Featured match card — full width, prominent
// ═══════════════════════════════════════════════════
function FeaturedCard({ match, index, user, login, passion, onPredictionMade }) {
    const [selectedTeam, setSelectedTeam] = useState(match.userPrediction?.predictedTeamId || null)
    const [wagerBarOpen, setWagerBarOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState(null)
    const hasWager = match.userPrediction?.wagerAmount > 0

    const leagueLogo = getLeagueLogo(match.leagueSlug)
    const divisionImg = getDivisionImage(match.leagueSlug, match.divisionSlug, match.divisionTier)

    const handleTeamClick = (teamId) => {
        if (match.isLocked || hasWager || submitting) return
        if (!user) { login(); return }
        if (selectedTeam === teamId && wagerBarOpen) {
            setWagerBarOpen(false)
        } else {
            setSelectedTeam(teamId)
            setWagerBarOpen(true)
            setSubmitError(null)
        }
    }

    const handleSubmit = async (wagerAmount) => {
        if (!selectedTeam) return
        if (wagerAmount > 0 && wagerAmount < 5) { setSubmitError('Minimum wager is 5'); return }
        if (wagerAmount > 0 && passion?.balance < wagerAmount) { setSubmitError('Insufficient balance'); return }
        setSubmitting(true)
        setSubmitError(null)
        try {
            await predictionsService.predict({ scheduledMatchId: match.id, predictedTeamId: selectedTeam, wagerAmount })
            if (wagerAmount > 0) passion?.refreshBalance?.()
            onPredictionMade()
            setWagerBarOpen(false)
        } catch (err) { setSubmitError(err.message) }
        finally { setSubmitting(false) }
    }

    const t1 = match.team1
    const t2 = match.team2
    const canInteract = !match.isLocked && !hasWager && !submitting

    return (
        <div className="relative overflow-hidden rounded-2xl pred-featured-glow pred-card-enter"
            style={{
                animationDelay: `${index * 80}ms`,
                background: 'linear-gradient(135deg, rgba(248,197,106,0.06) 0%, rgba(255,255,255,0.03) 50%, rgba(168,85,247,0.04) 100%)',
                backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.08)',
            }}>
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {leagueLogo && <img src={leagueLogo} alt="" className="absolute top-4 left-4 w-16 h-16 object-contain opacity-[0.09]" />}
                {divisionImg && <img src={divisionImg} alt="" className="absolute bottom-4 right-4 w-20 h-20 object-contain opacity-[0.1]" />}
                <div className="absolute inset-0 pred-shimmer" style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(248,197,106,0.03) 50%, transparent 60%)' }} />
            </div>

            <div className="relative p-5 sm:p-7">
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        {leagueLogo && <img src={leagueLogo} alt="" className="w-4 h-4 object-contain" />}
                        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/60">
                            {match.leagueName}
                        </span>
                        {divisionImg && <img src={divisionImg} alt="" className="w-4 h-4 object-contain" />}
                        <span className="text-[11px] text-white/50">{match.divisionName}</span>
                        {match.week && <span className="text-[11px] text-white/40">· W{match.week}</span>}
                    </div>
                    {match.bestOf > 1 && <span className="hidden sm:inline text-[10px] font-medium text-white/40">Bo{match.bestOf}</span>}
                </div>

                {/* Date */}
                <div className="mb-5">
                    <div className="text-sm font-semibold text-white/80 tabular-nums">
                        {new Date(match.scheduledDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </div>
                </div>

                {/* Tap hint */}
                {canInteract && !selectedTeam && !match.userPrediction && (
                    <div className="text-center mb-3">
                        <span className="text-[10px] text-[#f8c56a]/60 uppercase tracking-wider font-medium">Tap a team to predict</span>
                    </div>
                )}

                {/* Teams face-off — horizontal: Icon Name VS Name Icon */}
                <div className="flex items-center justify-evenly gap-2 sm:gap-4">
                    <FeaturedTeamSide team={t1} selected={selectedTeam === t1.id}
                        onPick={() => handleTeamClick(t1.id)} disabled={!canInteract} align="right" />

                    <div className="flex-shrink-0 px-2 sm:px-4">
                        <span className="pred-vs text-2xl sm:text-3xl">VS</span>
                    </div>

                    <FeaturedTeamSide team={t2} selected={selectedTeam === t2.id}
                        onPick={() => handleTeamClick(t2.id)} disabled={!canInteract} align="left" />
                </div>

                {/* Wager bar */}
                {canInteract && wagerBarOpen && selectedTeam && (
                    <WagerBar
                        teamName={selectedTeam === t1.id ? t1.name : t2.name}
                        passion={passion}
                        onSubmit={handleSubmit}
                        onCancel={() => setWagerBarOpen(false)}
                        submitting={submitting}
                        submitError={submitError}
                    />
                )}

                {hasWager && (
                    <div className="flex items-center justify-center gap-2 mt-5 text-sm" style={{ color: '#f8c56a' }}>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Wagered {match.userPrediction.wagerAmount}</span>
                        <img src={passionCoin} alt="" className="w-4 h-4" />
                        <span className="text-white/40">on {selectedTeam === t1.id ? t1.name : t2.name}</span>
                    </div>
                )}

                {match.isLocked && match.community && (
                    <CommunityOdds match={match} t1={t1} t2={t2} />
                )}

                <Link to={`/matchup/${match.id}`}
                    className="flex items-center justify-center gap-2 mt-4 py-2.5 rounded-lg text-xs font-semibold transition-all hover:scale-[1.02] active:scale-95"
                    style={{ background: 'rgba(248,197,106,0.08)', border: '1px solid rgba(248,197,106,0.15)', color: '#f8c56a' }}>
                    <Eye className="w-3.5 h-3.5" /> View Full Matchup
                </Link>
            </div>
        </div>
    )
}

function FeaturedTeamSide({ team, selected, onPick, disabled, align }) {
    const isTeam1 = align === 'right'
    return (
        <button onClick={onPick} disabled={disabled}
            className={`group pred-team-btn flex flex-col items-center text-center md:flex-row md:items-center md:gap-4 gap-2 p-3 sm:p-4 rounded-xl flex-1 ${
                !isTeam1 ? 'md:flex-row-reverse md:text-right' : 'md:text-left'
            } ${disabled ? 'cursor-default' : 'cursor-pointer'} ${selected ? 'pred-selected' : ''}`}>
            <TeamLogo slug={team.slug} name={team.name} size={64} className="md:!w-[88px] md:!h-[88px] flex-shrink-0" />

            <div>
                <div className={`font-heading font-bold text-sm md:text-xl transition-colors duration-200 ${
                    selected ? 'text-[#f8c56a]' : 'text-white group-hover:text-white'
                }`}>
                    {team.name}
                </div>
                {team.stats?.matchesPlayed > 0 && (
                    <div className={`flex items-center gap-2 mt-0.5 justify-center ${isTeam1 ? 'md:justify-start' : 'md:justify-end'}`}>
                        <span className="text-[10px] md:text-xs text-white/60 tabular-nums">{team.stats.wins}W – {team.stats.losses}L</span>
                        <span className="text-[9px] md:text-[10px] font-bold tabular-nums" style={{ color: team.stats.winRate >= 50 ? '#22c55e' : '#ef4444' }}>
                            {team.stats.winRate}%
                        </span>
                    </div>
                )}
            </div>
        </button>
    )
}


// ═══════════════════════════════════════════════════
// Regular match card (with expandable stats)
// ═══════════════════════════════════════════════════
function MatchCard({ match, index, user, login, passion, onPredictionMade }) {
    const [selectedTeam, setSelectedTeam] = useState(match.userPrediction?.predictedTeamId || null)
    const [wagerBarOpen, setWagerBarOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState(null)
    const [expanded, setExpanded] = useState(false)

    const hasWager = match.userPrediction?.wagerAmount > 0
    const canInteract = !match.isLocked && !hasWager && !submitting

    const leagueLogo = getLeagueLogo(match.leagueSlug)
    const divisionImg = getDivisionImage(match.leagueSlug, match.divisionSlug, match.divisionTier)

    const handleTeamClick = (teamId) => {
        if (!canInteract) return
        if (!user) { login(); return }
        if (selectedTeam === teamId && wagerBarOpen) {
            setWagerBarOpen(false)
        } else {
            setSelectedTeam(teamId)
            setWagerBarOpen(true)
            setSubmitError(null)
        }
    }

    const handleSubmit = async (wagerAmount) => {
        if (!selectedTeam) return
        if (wagerAmount > 0 && wagerAmount < 5) { setSubmitError('Minimum wager is 5'); return }
        if (wagerAmount > 0 && passion?.balance < wagerAmount) { setSubmitError('Insufficient balance'); return }
        setSubmitting(true)
        setSubmitError(null)
        try {
            await predictionsService.predict({ scheduledMatchId: match.id, predictedTeamId: selectedTeam, wagerAmount })
            if (wagerAmount > 0) passion?.refreshBalance?.()
            onPredictionMade()
            setWagerBarOpen(false)
        } catch (err) { setSubmitError(err.message) }
        finally { setSubmitting(false) }
    }

    const t1 = match.team1
    const t2 = match.team2
    const hasStats = t1.stats?.matchesPlayed > 0 || t2.stats?.matchesPlayed > 0

    return (
        <div className="relative rounded-xl overflow-hidden pred-card-enter"
            style={{
                animationDelay: `${index * 40}ms`,
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.06)',
            }}>
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {leagueLogo && <img src={leagueLogo} alt="" className="absolute top-2 left-3 w-8 h-8 object-contain opacity-[0.08]" />}
                {divisionImg && <img src={divisionImg} alt="" className="absolute bottom-2 right-3 w-10 h-10 object-contain opacity-[0.09]" />}
            </div>

            <div className="relative p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 text-[10px] text-white/50">
                        {leagueLogo && <img src={leagueLogo} alt="" className="w-3.5 h-3.5 object-contain" />}
                        <span>{match.leagueName}</span>
                        <span className="text-white/25">·</span>
                        {divisionImg && <img src={divisionImg} alt="" className="w-3.5 h-3.5 object-contain" />}
                        <span>{match.divisionName}</span>
                    </div>
                    <span className="text-[10px] font-bold" style={{ color: '#f8c56a' }}>Open</span>
                </div>

                {/* Date */}
                <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-white/70 tabular-nums">
                        {new Date(match.scheduledDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    {hasStats && (
                        <button onClick={() => setExpanded(!expanded)}
                            className="inline-flex items-center gap-1 text-[10px] text-white/40 hover:text-white/70 transition-colors cursor-pointer">
                            Stats {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                    )}
                </div>

                {/* Teams — stacked on mobile, inline on md+ */}
                <div className="flex items-center justify-evenly">
                    <button onClick={() => handleTeamClick(t1.id)} disabled={!canInteract}
                        className={`pred-team-btn flex-1 flex flex-col items-center text-center md:flex-row md:items-center md:text-left gap-1.5 md:gap-3 py-2.5 px-2 md:px-3 rounded-xl ${
                            canInteract ? 'cursor-pointer' : 'cursor-default'
                        } ${selectedTeam === t1.id ? 'pred-selected' : ''}`}>
                        <TeamLogo slug={t1.slug} name={t1.name} size={32} className="md:!w-[40px] md:!h-[40px] flex-shrink-0" />
                        <div className="min-w-0 md:flex-1">
                            <div className={`text-xs md:text-sm font-bold truncate ${
                                selectedTeam === t1.id ? 'text-[#f8c56a]' : 'text-white'
                            }`}>{t1.name}</div>
                            {t1.stats?.matchesPlayed > 0 && (
                                <div className="text-[10px] text-white/50 tabular-nums">{t1.stats.wins}W – {t1.stats.losses}L</div>
                            )}
                        </div>
                    </button>

                    <span className="pred-vs text-xs md:text-sm flex-shrink-0 px-1 md:px-2">VS</span>

                    <button onClick={() => handleTeamClick(t2.id)} disabled={!canInteract}
                        className={`pred-team-btn flex-1 flex flex-col items-center text-center md:flex-row-reverse md:items-center md:text-right gap-1.5 md:gap-3 py-2.5 px-2 md:px-3 rounded-xl ${
                            canInteract ? 'cursor-pointer' : 'cursor-default'
                        } ${selectedTeam === t2.id ? 'pred-selected' : ''}`}>
                        <TeamLogo slug={t2.slug} name={t2.name} size={32} className="md:!w-[40px] md:!h-[40px] flex-shrink-0" />
                        <div className="min-w-0 md:flex-1 md:text-right">
                            <div className={`text-xs md:text-sm font-bold truncate ${
                                selectedTeam === t2.id ? 'text-[#f8c56a]' : 'text-white'
                            }`}>{t2.name}</div>
                            {t2.stats?.matchesPlayed > 0 && (
                                <div className="text-[10px] text-white/50 tabular-nums">{t2.stats.wins}W – {t2.stats.losses}L</div>
                            )}
                        </div>
                    </button>
                </div>

                {/* Expanded stats */}
                {expanded && hasStats && (
                    <div className="pred-expand-enter mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="grid grid-cols-2 gap-4 text-center">
                            <TeamStatBlock team={t1} />
                            <TeamStatBlock team={t2} />
                        </div>
                    </div>
                )}

                {/* Wager bar */}
                {canInteract && wagerBarOpen && selectedTeam && (
                    <WagerBar
                        teamName={selectedTeam === t1.id ? t1.name : t2.name}
                        passion={passion}
                        onSubmit={handleSubmit}
                        onCancel={() => setWagerBarOpen(false)}
                        submitting={submitting}
                        submitError={submitError}
                    />
                )}

                {hasWager && (
                    <div className="flex items-center gap-2 mt-3 text-xs" style={{ color: '#f8c56a' }}>
                        <Lock className="w-3 h-3" />
                        <span>{match.userPrediction.wagerAmount}</span>
                        <img src={passionCoin} alt="" className="w-3.5 h-3.5" />
                        <span className="text-white/40">on {selectedTeam === t1.id ? t1.name : t2.name}</span>
                    </div>
                )}

                <Link to={`/matchup/${match.id}`}
                    className="flex items-center gap-1 mt-2 text-[10px] text-white/40 hover:text-[#f8c56a] transition-colors">
                    <Eye className="w-3 h-3" /> Details
                </Link>
            </div>
        </div>
    )
}

function TeamStatBlock({ team }) {
    const s = team.stats
    if (!s || s.matchesPlayed === 0) return <div className="text-[10px] text-white/30">No stats</div>

    return (
        <div>
            <div className="flex items-center justify-center gap-2 mb-2">
                <TeamLogo slug={team.slug} name={team.name} size={20} />
                <span className="text-xs font-bold text-white">{team.name}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
                <div>
                    <div className="text-lg font-bold text-white tabular-nums">{s.wins}</div>
                    <div className="text-[9px] text-white/40 uppercase">Wins</div>
                </div>
                <div>
                    <div className="text-lg font-bold text-white tabular-nums">{s.losses}</div>
                    <div className="text-[9px] text-white/40 uppercase">Losses</div>
                </div>
                <div>
                    <div className="text-lg font-bold tabular-nums" style={{ color: s.winRate >= 50 ? '#22c55e' : '#ef4444' }}>{s.winRate}%</div>
                    <div className="text-[9px] text-white/40 uppercase">Win Rate</div>
                </div>
            </div>
            {/* Win rate bar */}
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div className="h-full rounded-full transition-all" style={{
                    width: `${s.winRate}%`,
                    background: s.winRate >= 50
                        ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                        : 'linear-gradient(90deg, #ef4444, #f87171)',
                }} />
            </div>
        </div>
    )
}


// ═══════════════════════════════════════════════════
// Community odds split
// ═══════════════════════════════════════════════════
function CommunityOdds({ match, t1, t2, compact }) {
    return (
        <div className={`${compact ? 'mt-3' : 'mt-5'}`}>
            <div className="flex items-center gap-2 mb-1.5">
                <Eye className="w-3 h-3 text-white/25" />
                <span className="text-[10px] font-medium text-white/40">{match.totalPicks} predictions</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/50 w-7 text-right tabular-nums">{match.community.team1Pct}%</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden flex" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div className="h-full rounded-l-full" style={{ width: `${match.community.team1Pct}%`, backgroundColor: t1.color || '#6366f1', opacity: 0.8 }} />
                    <div className="h-full rounded-r-full" style={{ width: `${match.community.team2Pct}%`, backgroundColor: t2.color || '#f59e0b', opacity: 0.8 }} />
                </div>
                <span className="text-[10px] text-white/50 w-7 tabular-nums">{match.community.team2Pct}%</span>
            </div>
            {match.odds && (
                <div className="flex justify-between mt-1 text-[9px] text-white/30 px-9">
                    <span>{match.odds.team1Multiplier.toFixed(2)}x</span>
                    <span>{match.odds.team2Multiplier.toFixed(2)}x</span>
                </div>
            )}
        </div>
    )
}


// ═══════════════════════════════════════════════════
// My Predictions Tab
// ═══════════════════════════════════════════════════
function MyPredictionsTab({ predictions, stats, loading, error, user, login }) {
    if (!user) {
        return (
            <div className="py-20 text-center">
                <TrendingUp className="w-12 h-12 text-white/10 mx-auto mb-4" />
                <h3 className="text-base font-heading font-bold text-white/60 mb-1">Your Portfolio</h3>
                <p className="text-white/40 text-sm mb-5">Log in to track your prediction history.</p>
                <button onClick={login}
                    className="px-5 py-2.5 rounded-lg text-white text-sm font-semibold cursor-pointer transition-all hover:opacity-90"
                    style={{ backgroundColor: '#5865F2' }}>
                    Login with Discord
                </button>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="w-10 h-10 border-2 border-white/10 border-t-[#f8c56a] rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div>
            {stats && (
                <div className="flex items-stretch rounded-xl overflow-hidden mb-8" style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <DashboardStat label="Accuracy" value={`${stats.accuracy}%`}
                        color={stats.accuracy >= 60 ? '#22c55e' : stats.accuracy >= 40 ? '#f8c56a' : '#ef4444'} />
                    <div className="w-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                    <DashboardStat label="Pending" value={stats.pending} />
                    <div className="w-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                    <DashboardStat label="Wagered" value={stats.totalWagered} icon={passionCoin} />
                    <div className="w-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                    <DashboardStat label="Net P&L" value={stats.netPL >= 0 ? `+${stats.netPL}` : stats.netPL} icon={passionCoin}
                        color={stats.netPL >= 0 ? '#22c55e' : '#ef4444'} />
                </div>
            )}

            {predictions.length === 0 ? (
                <div className="py-16 text-center">
                    <Target className="w-12 h-12 text-white/10 mx-auto mb-4" />
                    <p className="text-white/40 text-sm">No predictions yet. Head to Markets to place your first pick.</p>
                </div>
            ) : (
                <div className="space-y-1">
                    {predictions.map((p, i) => {
                        const statusColor = p.status === 'won' ? '#22c55e' : p.status === 'lost' ? '#ef4444' : p.status === 'refunded' ? '#eab308' : 'rgba(248,197,106,0.4)'
                        return (
                            <div key={p.id} className="flex items-center gap-3 py-3 px-3 rounded-lg pred-card-enter"
                                style={{
                                    animationDelay: `${i * 25}ms`,
                                    background: p.status === 'won' ? 'rgba(34,197,94,0.05)' : p.status === 'lost' ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.03)',
                                }}>
                                <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: statusColor }} />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-white truncate">{p.team1.name} vs {p.team2.name}</div>
                                    <div className="text-[10px] text-white/40 mt-0.5">
                                        {p.leagueName} · {p.divisionName} · Picked <span className="text-white/60">{p.predictedTeamName}</span>
                                    </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    {p.status === 'won' && p.payoutAmount > 0 && (
                                        <div className="flex items-center gap-1 text-sm font-bold text-green-400">+{p.payoutAmount} <img src={passionCoin} alt="" className="w-3.5 h-3.5" /></div>
                                    )}
                                    {p.status === 'lost' && p.wagerAmount > 0 && (
                                        <div className="flex items-center gap-1 text-sm text-red-400/60">-{p.wagerAmount} <img src={passionCoin} alt="" className="w-3.5 h-3.5 opacity-50" /></div>
                                    )}
                                    {p.status === 'pending' && (
                                        <div className="text-[10px] text-white/40">{p.wagerAmount > 0 ? <span className="flex items-center gap-1"><img src={passionCoin} alt="" className="w-3 h-3" />{p.wagerAmount}</span> : 'Free'}</div>
                                    )}
                                    {p.payoutMultiplier && <div className="text-[9px] text-white/30 mt-0.5">{p.payoutMultiplier}x</div>}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}


function DashboardStat({ label, value, icon, color }) {
    return (
        <div className="flex-1 py-4 px-3 text-center min-w-0">
            <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/30 mb-1.5">{label}</div>
            <div className="flex items-center justify-center gap-1 text-lg sm:text-xl font-bold tabular-nums truncate" style={{ color: color || 'white' }}>
                {icon && <img src={icon} alt="" className="w-4 h-4 flex-shrink-0" />}
                {value}
            </div>
        </div>
    )
}


// ═══════════════════════════════════════════════════
// Leaderboard Tab
// ═══════════════════════════════════════════════════
function LeaderboardTab({ leaderboard, loading, error, user }) {
    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="w-10 h-10 border-2 border-white/10 border-t-[#f8c56a] rounded-full animate-spin" />
            </div>
        )
    }

    if (leaderboard.length === 0) {
        return (
            <div className="py-20 text-center">
                <Trophy className="w-12 h-12 text-white/10 mx-auto mb-4" />
                <h3 className="text-base font-heading font-bold text-white/60 mb-1">No Rankings Yet</h3>
                <p className="text-white/40 text-sm">Rankings appear after matches are resolved.</p>
            </div>
        )
    }

    const top3 = leaderboard.slice(0, 3)
    const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3
    const PODIUM = [
        { height: 'h-16', color: '#9ca3af', medal: '2nd', glow: '' },
        { height: 'h-24', color: '#f8c56a', medal: '1st', glow: '0 0 30px -8px rgba(248,197,106,0.25)' },
        { height: 'h-12', color: '#cd7f32', medal: '3rd', glow: '' },
    ]

    return (
        <div>
            {top3.length >= 3 && (
                <div className="flex items-end justify-center gap-3 sm:gap-5 mb-10 pt-4">
                    {podiumOrder.map((entry, i) => {
                        const s = PODIUM[i]
                        const avatarUrl = entry.avatar && entry.discordId
                            ? `https://cdn.discordapp.com/avatars/${entry.discordId}/${entry.avatar}.png?size=64`
                            : null
                        return (
                            <div key={entry.userId} className="flex flex-col items-center gap-2 pred-card-enter" style={{ animationDelay: `${i * 100}ms` }}>
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt="" className="w-11 h-11 sm:w-13 sm:h-13 rounded-full"
                                        style={{ border: `2px solid ${s.color}`, boxShadow: s.glow }} />
                                ) : (
                                    <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-[#5865F2] flex items-center justify-center text-white text-sm font-bold"
                                        style={{ border: `2px solid ${s.color}`, boxShadow: s.glow }}>
                                        {entry.username?.[0]?.toUpperCase()}
                                    </div>
                                )}
                                <div className="text-xs font-medium text-white/70 truncate max-w-[80px]">{entry.username}</div>
                                <div className="text-sm font-bold tabular-nums" style={{ color: s.color }}>{entry.accuracy}%</div>
                                <div className={`w-14 sm:w-18 ${s.height} rounded-t-xl flex items-start justify-center pt-2`}
                                    style={{ background: `linear-gradient(to top, rgba(255,255,255,0.02), ${s.color}12)`, borderTop: `1px solid ${s.color}25`, borderLeft: `1px solid ${s.color}15`, borderRight: `1px solid ${s.color}15` }}>
                                    <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: s.color }}>{s.medal}</span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            <div className="flex items-center gap-3 mb-4">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">Full Rankings</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            <div className="grid grid-cols-[2rem_1fr_4rem_4rem_5rem] sm:grid-cols-[2.5rem_1fr_5rem_5rem_5rem_5rem] items-center px-3 py-2 mb-1">
                <span className="text-[9px] font-bold uppercase tracking-wider text-white/25">#</span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-white/25">Predictor</span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-white/25 text-center hidden sm:block">Record</span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-white/25 text-center">Rate</span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-white/25 text-center">Correct</span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-white/25 text-right hidden sm:block">Earned</span>
            </div>

            {leaderboard.map((entry, i) => {
                const isMe = user && entry.userId === user.id
                const avatarUrl = entry.avatar && entry.discordId
                    ? `https://cdn.discordapp.com/avatars/${entry.discordId}/${entry.avatar}.png?size=32`
                    : null

                return (
                    <div key={entry.userId}
                        className="grid grid-cols-[2rem_1fr_4rem_4rem_5rem] sm:grid-cols-[2.5rem_1fr_5rem_5rem_5rem_5rem] items-center px-3 py-2.5 rounded-lg pred-card-enter"
                        style={{
                            animationDelay: `${i * 20}ms`,
                            background: isMe ? 'rgba(248,197,106,0.06)' : i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                        }}>
                        <span className={`text-sm font-bold tabular-nums ${i < 3 ? '' : 'text-white/30'}`}
                            style={{ color: i === 0 ? '#f8c56a' : i === 1 ? '#9ca3af' : i === 2 ? '#cd7f32' : undefined }}>
                            {entry.position}
                        </span>

                        <div className="flex items-center gap-2 min-w-0">
                            {avatarUrl ? (
                                <img src={avatarUrl} alt="" className="w-6 h-6 rounded-full flex-shrink-0" />
                            ) : (
                                <div className="w-6 h-6 rounded-full bg-[#5865F2] flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                                    {entry.username?.[0]?.toUpperCase()}
                                </div>
                            )}
                            {entry.playerSlug ? (
                                <Link to={`/profile/${entry.playerSlug}`} className="text-sm font-medium text-white/70 truncate hover:text-white transition-colors">
                                    {entry.username}
                                </Link>
                            ) : (
                                <span className="text-sm font-medium text-white/70 truncate">{entry.username}</span>
                            )}
                        </div>

                        <span className="text-xs text-white/30 text-center hidden sm:block tabular-nums">{entry.correct}-{entry.incorrect}</span>

                        <span className="text-sm font-bold text-center tabular-nums" style={{
                            color: entry.accuracy >= 70 ? '#22c55e' : entry.accuracy >= 50 ? '#f8c56a' : '#ef4444'
                        }}>{entry.accuracy}%</span>

                        <span className="text-xs text-white/40 text-center tabular-nums">{entry.correct}</span>

                        <span className="hidden sm:flex items-center justify-end gap-1 text-sm font-medium tabular-nums" style={{ color: '#f8c56a' }}>
                            {entry.totalEarned} <img src={passionCoin} alt="" className="w-3.5 h-3.5" />
                        </span>
                    </div>
                )
            })}
        </div>
    )
}

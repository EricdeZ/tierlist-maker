import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { predictionsService } from '../services/database'
import { useAuth } from '../context/AuthContext'
import { usePassion } from '../context/PassionContext'
import PageTitle from '../components/PageTitle'
import SimpleNav from '../components/layout/SimpleNav'
import TeamLogo from '../components/TeamLogo'
import passionCoin from '../assets/passion/passion.png'
import passionTilted from '../assets/passion/passiontilted.png'
import { getLeagueLogo } from '../utils/leagueImages'
import { getDivisionImage } from '../utils/divisionImages'
import {
    Lock, ArrowLeft, Swords, TrendingUp, Users, Target, Eye, Flame,
    Shield, Zap, X, ChevronRight, Trophy, Crown, Crosshair
} from 'lucide-react'

const WAGER_PRESETS = [
    { label: 'Free', value: 0 },
    { label: '10', value: 10 },
    { label: '25', value: 25 },
    { label: '50', value: 50 },
    { label: '100', value: 100 },
]

const ROLE_ORDER = ['carry', 'mid', 'jungle', 'solo', 'support']

function roleIndex(role) {
    const i = ROLE_ORDER.indexOf((role || '').toLowerCase())
    return i >= 0 ? i : 99
}

// ═══════════════════════════════════════════════════
// Background elements (same as Predictions page)
// ═══════════════════════════════════════════════════
function CoinBackground() {
    const coins = useRef([
        { bottom: '-10%', right: '-6%', size: 600, opacity: 0.04, rotate: -8 },
        { top: '5%', left: '-3%', size: 200, opacity: 0.02, rotate: 15 },
        { top: '35%', right: '2%', size: 140, opacity: 0.018, rotate: -20 },
        { bottom: '15%', left: '8%', size: 100, opacity: 0.015, rotate: 25 },
    ]).current

    return (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden>
            {coins.map((c, i) => (
                <div key={i} className="absolute"
                    style={{ top: c.top, bottom: c.bottom, left: c.left, right: c.right, width: c.size, height: c.size }}>
                    <img src={passionTilted} alt="" className="w-full h-full object-contain"
                        style={{ opacity: c.opacity, transform: `rotate(${c.rotate}deg)` }} />
                </div>
            ))}
        </div>
    )
}

// ═══════════════════════════════════════════════════
// Section wrapper — glassmorphism card
// ═══════════════════════════════════════════════════
function Section({ icon: Icon, title, children, delay = 0 }) {
    return (
        <div className="matchup-card-enter rounded-2xl overflow-hidden"
            style={{
                animationDelay: `${delay}ms`,
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.06)',
            }}>
            <div className="p-5 sm:p-6">
                <div className="flex items-center gap-2.5 mb-4">
                    {Icon && <Icon className="w-5 h-5" style={{ color: '#f8c56a' }} />}
                    <h2 className="font-heading font-bold text-lg text-white">{title}</h2>
                </div>
                {children}
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════
// Comparison bar
// ═══════════════════════════════════════════════════
function ComparisonBar({ label, val1, val2, color1, color2, format }) {
    const total = (val1 || 0) + (val2 || 0)
    const pct1 = total > 0 ? ((val1 || 0) / total) * 100 : 50
    const fmt = format || (v => v)
    const highlight1 = val1 > val2
    const highlight2 = val2 > val1

    return (
        <div className="py-2.5">
            <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-bold tabular-nums ${highlight1 ? 'text-white' : 'text-white/50'}`}>
                    {fmt(val1 || 0)}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-white/30 font-medium">{label}</span>
                <span className={`text-sm font-bold tabular-nums ${highlight2 ? 'text-white' : 'text-white/50'}`}>
                    {fmt(val2 || 0)}
                </span>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-l-full transition-all duration-700"
                    style={{ width: `${pct1}%`, backgroundColor: color1, opacity: highlight1 ? 0.9 : 0.5 }} />
                <div className="h-full rounded-r-full transition-all duration-700"
                    style={{ width: `${100 - pct1}%`, backgroundColor: color2, opacity: highlight2 ? 0.9 : 0.5 }} />
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════
// Wager bar (same as Predictions page)
// ═══════════════════════════════════════════════════
function WagerBar({ teamName, passion, onSubmit, onCancel, submitting, submitError }) {
    const [wagerAmount, setWagerAmount] = useState(0)
    const [customMode, setCustomMode] = useState(false)
    const [customInput, setCustomInput] = useState('')
    const activeAmount = customMode ? (parseInt(customInput) || 0) : wagerAmount

    return (
        <div className="matchup-wager-enter mt-5 pt-4" style={{ borderTop: '1px solid rgba(248,197,106,0.12)' }}>
            <div className="flex items-center gap-2 mb-3">
                <img src={passionCoin} alt="" className="w-4 h-4" />
                <span className="text-xs font-semibold" style={{ color: '#f8c56a' }}>Wager on {teamName}</span>
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
                                    <img src={passionCoin} alt="" className="w-3 h-3" />{p.label}
                                </span>
                            )}
                        </button>
                    )
                })}
                {!customMode ? (
                    <button onClick={() => setCustomMode(true)}
                        className="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white/80 transition-colors cursor-pointer"
                        style={{ background: 'rgba(255,255,255,0.08)' }}>Custom</button>
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
// Main page
// ═══════════════════════════════════════════════════
export default function MatchupDetail() {
    const { scheduledMatchId } = useParams()
    const { user, login, hasAnyPermission } = useAuth()
    const passion = usePassion()

    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [entered, setEntered] = useState(false)

    // Prediction state
    const [selectedTeam, setSelectedTeam] = useState(null)
    const [wagerBarOpen, setWagerBarOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState(null)

    useEffect(() => { requestAnimationFrame(() => setEntered(true)) }, [])

    const loadData = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const result = await predictionsService.getMatchupDetail(scheduledMatchId)
            setData(result)
            if (result.match.userPrediction) {
                setSelectedTeam(result.match.userPrediction.predictedTeamId)
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [scheduledMatchId])

    useEffect(() => { loadData() }, [loadData])

    // Predictions disabled for non-admin users
    if (!hasAnyPermission) {
        return (
            <div className="min-h-screen bg-(--color-primary)">
                <SimpleNav title="Matchup Detail" />
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

    const handleTeamClick = (teamId) => {
        if (!data) return
        const m = data.match
        if (m.isLocked || (m.userPrediction?.wagerAmount > 0) || submitting) return
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
        if (!selectedTeam || !data) return
        if (wagerAmount > 0 && wagerAmount < 5) { setSubmitError('Minimum wager is 5'); return }
        if (wagerAmount > 0 && passion?.balance < wagerAmount) { setSubmitError('Insufficient balance'); return }
        setSubmitting(true)
        setSubmitError(null)
        try {
            await predictionsService.predict({ scheduledMatchId: data.match.id, predictedTeamId: selectedTeam, wagerAmount })
            if (wagerAmount > 0) passion?.refreshBalance?.()
            loadData()
            setWagerBarOpen(false)
        } catch (err) { setSubmitError(err.message) }
        finally { setSubmitting(false) }
    }

    // Loading
    if (loading) {
        return (
            <div className="min-h-screen text-white relative">
                <SimpleNav title="Matchup" />
                <div className="fixed inset-0 z-0" aria-hidden>
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #111830 0%, #161e38 35%, #1a2240 55%, #151d34 100%)' }} />
                </div>
                <div className="relative z-10 flex items-center justify-center pt-40">
                    <div className="w-12 h-12 border-2 border-white/10 border-t-[#f8c56a] rounded-full animate-spin" />
                </div>
            </div>
        )
    }

    // Error
    if (error || !data) {
        return (
            <div className="min-h-screen text-white relative">
                <SimpleNav title="Matchup" />
                <div className="fixed inset-0 z-0" aria-hidden>
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #111830 0%, #161e38 35%, #1a2240 55%, #151d34 100%)' }} />
                </div>
                <div className="relative z-10 pt-32 text-center px-4">
                    <Swords className="w-12 h-12 text-white/10 mx-auto mb-4" />
                    <h2 className="font-heading font-bold text-xl text-white/60 mb-2">Match Not Found</h2>
                    <p className="text-white/40 text-sm mb-6">{error || 'This matchup could not be loaded.'}</p>
                    <Link to="/predictions" className="inline-flex items-center gap-2 text-sm font-medium text-[#f8c56a] hover:underline">
                        <ArrowLeft className="w-4 h-4" /> Back to Predictions
                    </Link>
                </div>
            </div>
        )
    }

    const { match, rosters, teamAggregates, headToHead, recentForm } = data
    const t1 = match.team1, t2 = match.team2
    const hasWager = match.userPrediction?.wagerAmount > 0
    const canInteract = !match.isLocked && !hasWager && !submitting
    const leagueLogo = getLeagueLogo(match.leagueSlug)
    const divisionImg = getDivisionImage(match.leagueSlug, match.divisionSlug, match.divisionTier)

    const fmtNum = v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v))
    const fmtPct = v => `${v}%`

    // Role-matched roster rows — within same role, match by stat rank (highest vs highest)
    const rosterRows = (() => {
        const statScore = p => p.avgDeaths > 0
            ? (p.avgKills + p.avgAssists / 2) / p.avgDeaths + p.avgDamage / 10000
            : p.avgKills + p.avgAssists / 2 + p.avgDamage / 10000

        // Group by role, sort each group by stats descending
        const group = (list) => {
            const map = {}
            for (const p of list) {
                const key = (p.role || '').toLowerCase()
                if (!map[key]) map[key] = []
                map[key].push(p)
            }
            for (const key in map) map[key].sort((a, b) => statScore(b) - statScore(a))
            return map
        }

        const groups1 = group(rosters.team1 || [])
        const groups2 = group(rosters.team2 || [])
        const allRoles = [...new Set([...Object.keys(groups1), ...Object.keys(groups2)])]
            .sort((a, b) => roleIndex(a) - roleIndex(b))

        const rows = []
        for (const role of allRoles) {
            const list1 = groups1[role] || []
            const list2 = groups2[role] || []
            const maxLen = Math.max(list1.length, list2.length)
            for (let i = 0; i < maxLen; i++) {
                rows.push({ player1: list1[i] || null, player2: list2[i] || null, role: role || '—' })
            }
        }
        return rows
    })()

    return (
        <div className="min-h-screen text-white relative">
            <SimpleNav title="Matchup" />
            <PageTitle title={`${t1.name} vs ${t2.name}`} />
            <CoinBackground />

            {/* Full-page gradient background */}
            <div className="fixed inset-0 z-0" aria-hidden>
                <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #111830 0%, #161e38 35%, #1a2240 55%, #151d34 100%)' }} />
                <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 90% 50% at 50% 8%, rgba(248,197,106,0.25) 0%, transparent 65%)' }} />
                <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 70% 50% at 90% 25%, rgba(168,85,247,0.16) 0%, transparent 55%)' }} />
                <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 45% at 10% 45%, rgba(99,102,241,0.13) 0%, transparent 55%)' }} />
                <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 40% at 50% 85%, rgba(248,197,106,0.12) 0%, transparent 55%)' }} />
            </div>

            {/* ═══ HERO ═══ */}
            <section className="relative z-10 pt-20 sm:pt-24 pb-6 overflow-hidden">
                {/* Team color accents */}
                <div className="absolute inset-0 pointer-events-none" aria-hidden>
                    <div className="absolute top-0 left-0 w-1/2 h-full" style={{ background: `radial-gradient(ellipse 100% 80% at 0% 30%, ${t1.color || '#6366f1'}18 0%, transparent 60%)` }} />
                    <div className="absolute top-0 right-0 w-1/2 h-full" style={{ background: `radial-gradient(ellipse 100% 80% at 100% 30%, ${t2.color || '#f59e0b'}18 0%, transparent 60%)` }} />
                </div>

                <div className={`relative max-w-5xl mx-auto px-4 sm:px-6 transition-all duration-1000 ${entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    {/* Back link */}
                    <div className="mb-5">
                        <Link to="/predictions" className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-[#f8c56a] transition-colors">
                            <ArrowLeft className="w-3.5 h-3.5" /> Predictions
                        </Link>
                    </div>

                    {/* League + Division badge — prominent */}
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-full"
                            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                            {leagueLogo && <img src={leagueLogo} alt="" className="w-6 h-6 object-contain" />}
                            <span className="text-sm font-bold text-white/80">{match.leagueName}</span>
                            <span className="text-white/20">·</span>
                            {divisionImg && <img src={divisionImg} alt="" className="w-6 h-6 object-contain" />}
                            <span className="text-sm font-bold" style={{ color: '#f8c56a' }}>{match.divisionName}</span>
                        </div>
                    </div>

                    {/* Date + format */}
                    <div className="text-center mb-6">
                        <div className="text-sm sm:text-base font-semibold text-white/80 tabular-nums">
                            {new Date(match.scheduledDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </div>
                        <div className="flex items-center justify-center gap-3 mt-1 text-[11px] text-white/40">
                            {match.week && <span>Week {match.week}</span>}
                            {match.bestOf > 1 && <span>Best of {match.bestOf}</span>}
                            {match.seasonName && <span>{match.seasonName}</span>}
                        </div>
                    </div>

                    {/* Team showdown */}
                    <div className="flex items-center justify-center gap-4 sm:gap-8 mb-6">
                        {/* Team 1 */}
                        <button onClick={() => handleTeamClick(t1.id)} disabled={!canInteract}
                            className={`matchup-enter-left matchup-team-btn flex flex-col items-center gap-2 sm:gap-3 p-4 sm:p-6 rounded-2xl flex-1 max-w-[220px] ${
                                canInteract ? 'cursor-pointer' : 'cursor-default'
                            } ${selectedTeam === t1.id ? 'matchup-team-selected' : ''}`}>
                            <TeamLogo slug={t1.slug} name={t1.name} size={64} className="sm:!w-[96px] sm:!h-[96px]" />
                            <div className="text-center">
                                <div className={`font-heading font-bold text-base sm:text-xl transition-colors ${selectedTeam === t1.id ? 'text-[#f8c56a]' : 'text-white'}`}>
                                    {t1.name}
                                </div>
                                {t1.stats.matchesPlayed > 0 && (
                                    <div className="flex items-center justify-center gap-2 mt-1">
                                        <span className="text-[11px] text-white/60 tabular-nums">{t1.stats.wins}W – {t1.stats.losses}L</span>
                                        <span className="text-[10px] font-bold tabular-nums" style={{ color: t1.stats.winRate >= 50 ? '#22c55e' : '#ef4444' }}>
                                            {t1.stats.winRate}%
                                        </span>
                                    </div>
                                )}
                            </div>
                        </button>

                        {/* VS */}
                        <div className="flex-shrink-0">
                            <span className="matchup-vs text-3xl sm:text-5xl">VS</span>
                        </div>

                        {/* Team 2 */}
                        <button onClick={() => handleTeamClick(t2.id)} disabled={!canInteract}
                            className={`matchup-enter-right matchup-team-btn flex flex-col items-center gap-2 sm:gap-3 p-4 sm:p-6 rounded-2xl flex-1 max-w-[220px] ${
                                canInteract ? 'cursor-pointer' : 'cursor-default'
                            } ${selectedTeam === t2.id ? 'matchup-team-selected' : ''}`}>
                            <TeamLogo slug={t2.slug} name={t2.name} size={64} className="sm:!w-[96px] sm:!h-[96px]" />
                            <div className="text-center">
                                <div className={`font-heading font-bold text-base sm:text-xl transition-colors ${selectedTeam === t2.id ? 'text-[#f8c56a]' : 'text-white'}`}>
                                    {t2.name}
                                </div>
                                {t2.stats.matchesPlayed > 0 && (
                                    <div className="flex items-center justify-center gap-2 mt-1">
                                        <span className="text-[11px] text-white/60 tabular-nums">{t2.stats.wins}W – {t2.stats.losses}L</span>
                                        <span className="text-[10px] font-bold tabular-nums" style={{ color: t2.stats.winRate >= 50 ? '#22c55e' : '#ef4444' }}>
                                            {t2.stats.winRate}%
                                        </span>
                                    </div>
                                )}
                            </div>
                        </button>
                    </div>

                    {/* Prediction hint */}
                    {canInteract && !selectedTeam && !match.userPrediction && (
                        <div className="text-center mb-2">
                            <span className="text-[11px] text-[#f8c56a]/60 uppercase tracking-wider font-medium">Tap a team to predict</span>
                        </div>
                    )}

                    {/* Wager bar */}
                    {canInteract && wagerBarOpen && selectedTeam && (
                        <div className="max-w-lg mx-auto">
                            <WagerBar
                                teamName={selectedTeam === t1.id ? t1.name : t2.name}
                                passion={passion}
                                onSubmit={handleSubmit}
                                onCancel={() => setWagerBarOpen(false)}
                                submitting={submitting}
                                submitError={submitError}
                            />
                        </div>
                    )}

                    {/* Locked wager state */}
                    {hasWager && (
                        <div className="flex items-center justify-center gap-2 text-sm" style={{ color: '#f8c56a' }}>
                            <Lock className="w-4 h-4" />
                            <span>Wagered {match.userPrediction.wagerAmount}</span>
                            <img src={passionCoin} alt="" className="w-4 h-4" />
                            <span className="text-white/40">on {selectedTeam === t1.id ? t1.name : t2.name}</span>
                        </div>
                    )}

                    {/* Community odds (if locked) */}
                    {match.isLocked && match.community && (
                        <div className="max-w-md mx-auto mt-4">
                            <div className="flex items-center gap-2 mb-1.5 justify-center">
                                <Eye className="w-3.5 h-3.5 text-white/25" />
                                <span className="text-[11px] font-medium text-white/40">{match.totalPicks} predictions</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-white/60 w-10 text-right tabular-nums font-bold">{match.community.team1Pct}%</span>
                                <div className="flex-1 h-2.5 rounded-full overflow-hidden flex" style={{ background: 'rgba(255,255,255,0.08)' }}>
                                    <div className="h-full rounded-l-full" style={{ width: `${match.community.team1Pct}%`, backgroundColor: t1.color || '#6366f1', opacity: 0.85 }} />
                                    <div className="h-full rounded-r-full" style={{ width: `${match.community.team2Pct}%`, backgroundColor: t2.color || '#f59e0b', opacity: 0.85 }} />
                                </div>
                                <span className="text-xs text-white/60 w-10 tabular-nums font-bold">{match.community.team2Pct}%</span>
                            </div>
                            {match.odds && (
                                <div className="flex justify-between mt-1.5 text-[10px] text-white/30 px-12">
                                    <span>{match.odds.team1Multiplier.toFixed(2)}x</span>
                                    <span>{match.odds.team2Multiplier.toFixed(2)}x</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </section>

            {/* ═══ CONTENT ═══ */}
            <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pb-12 space-y-5">

                {/* ── Tale of the Tape ── */}
                {(teamAggregates.team1.totalGames > 0 || teamAggregates.team2.totalGames > 0) && (
                    <Section icon={Swords} title="Tale of the Tape" delay={100}>
                        {/* Team name headers */}
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <TeamLogo slug={t1.slug} name={t1.name} size={20} />
                                <span className="text-xs font-bold text-white/70">{t1.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white/70">{t2.name}</span>
                                <TeamLogo slug={t2.slug} name={t2.name} size={20} />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <ComparisonBar label="Win Rate" val1={t1.stats.winRate} val2={t2.stats.winRate}
                                color1={t1.color || '#6366f1'} color2={t2.color || '#f59e0b'} format={fmtPct} />
                            <ComparisonBar label="Match Wins" val1={t1.stats.wins} val2={t2.stats.wins}
                                color1={t1.color || '#6366f1'} color2={t2.color || '#f59e0b'} />
                            <ComparisonBar label="Game Wins" val1={t1.stats.gameWins} val2={t2.stats.gameWins}
                                color1={t1.color || '#6366f1'} color2={t2.color || '#f59e0b'} />
                            <ComparisonBar label="Avg Kills" val1={teamAggregates.team1.avgKillsPerGame} val2={teamAggregates.team2.avgKillsPerGame}
                                color1={t1.color || '#6366f1'} color2={t2.color || '#f59e0b'} format={v => v.toFixed(1)} />
                            <ComparisonBar label="Avg Damage" val1={teamAggregates.team1.avgDamagePerGame} val2={teamAggregates.team2.avgDamagePerGame}
                                color1={t1.color || '#6366f1'} color2={t2.color || '#f59e0b'} format={fmtNum} />
                            <ComparisonBar label="Avg Mitigated" val1={teamAggregates.team1.avgMitigatedPerGame} val2={teamAggregates.team2.avgMitigatedPerGame}
                                color1={t1.color || '#6366f1'} color2={t2.color || '#f59e0b'} format={fmtNum} />
                        </div>
                    </Section>
                )}

                {/* ── Starting Lineups ── */}
                {rosterRows.length > 0 && (
                    <Section icon={Users} title="Starting Lineups" delay={200}>
                        {/* Desktop header */}
                        <div className="hidden md:flex items-center justify-between mb-3 px-2">
                            <div className="flex items-center gap-2">
                                <TeamLogo slug={t1.slug} name={t1.name} size={18} />
                                <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">{t1.name}</span>
                            </div>
                            <span className="text-[10px] font-bold text-white/25 uppercase tracking-wider">Role</span>
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">{t2.name}</span>
                                <TeamLogo slug={t2.slug} name={t2.name} size={18} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            {rosterRows.map((row, i) => (
                                <div key={i} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
                                    {/* Desktop: side by side */}
                                    <div className="hidden md:flex items-center gap-3">
                                        <PlayerCell player={row.player1} align="left" />
                                        <div className="flex-shrink-0 w-16 text-center">
                                            <span className="text-[10px] font-bold text-[#f8c56a]/60 uppercase">{row.role || '—'}</span>
                                        </div>
                                        <PlayerCell player={row.player2} align="right" />
                                    </div>
                                    {/* Mobile: stacked */}
                                    <div className="md:hidden">
                                        <div className="text-[10px] font-bold text-[#f8c56a]/60 uppercase tracking-wider mb-2 text-center">{row.role || '—'}</div>
                                        <div className="space-y-2">
                                            {row.player1 && <PlayerCardMobile player={row.player1} teamColor={t1.color} />}
                                            {row.player2 && <PlayerCardMobile player={row.player2} teamColor={t2.color} />}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Section>
                )}

                {/* ── Head to Head ── */}
                <Section icon={Crown} title="Previous Meetings" delay={300}>
                    {headToHead.matches.length === 0 ? (
                        <div className="text-center py-6">
                            <Swords className="w-8 h-8 text-white/10 mx-auto mb-2" />
                            <p className="text-white/40 text-sm">First meeting this season</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center justify-center gap-6 mb-4">
                                <div className="text-center">
                                    <div className="text-2xl font-black tabular-nums" style={{ color: t1.color || '#6366f1' }}>{headToHead.team1Wins}</div>
                                    <div className="text-[10px] text-white/40 uppercase">{t1.name}</div>
                                </div>
                                <div className="text-xs text-white/20 font-bold">—</div>
                                <div className="text-center">
                                    <div className="text-2xl font-black tabular-nums" style={{ color: t2.color || '#f59e0b' }}>{headToHead.team2Wins}</div>
                                    <div className="text-[10px] text-white/40 uppercase">{t2.name}</div>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                {headToHead.matches.map(m => {
                                    const t1Won = m.winnerTeamId === t1.id
                                    return (
                                        <div key={m.id} className="flex items-center justify-between py-2 px-3 rounded-lg"
                                            style={{ background: 'rgba(255,255,255,0.03)' }}>
                                            <span className="text-[11px] text-white/50 tabular-nums w-16">
                                                {m.week ? `Week ${m.week}` : new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </span>
                                            <div className="flex items-center gap-3">
                                                <span className={`text-xs font-bold ${t1Won ? 'text-white' : 'text-white/40'}`}>{t1.name}</span>
                                                <span className="text-xs font-bold text-[#f8c56a] tabular-nums">{m.t1GameWins} – {m.t2GameWins}</span>
                                                <span className={`text-xs font-bold ${!t1Won ? 'text-white' : 'text-white/40'}`}>{t2.name}</span>
                                            </div>
                                            <span className="text-[10px] font-bold w-16 text-right" style={{ color: t1Won ? (t1.color || '#6366f1') : (t2.color || '#f59e0b') }}>
                                                {t1Won ? t1.name : t2.name}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        </>
                    )}
                </Section>

                {/* ── Recent Form ── */}
                {(recentForm.team1.length > 0 || recentForm.team2.length > 0) && (
                    <Section icon={TrendingUp} title="Current Form" delay={400}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <RecentFormColumn team={t1} matches={recentForm.team1} />
                            <RecentFormColumn team={t2} matches={recentForm.team2} />
                        </div>
                    </Section>
                )}
            </div>

            {/* ═══ STYLES ═══ */}
            <style>{`
                .matchup-vs {
                    font-style: italic;
                    font-weight: 900;
                    color: #f8c56a;
                    filter: drop-shadow(0 0 20px rgba(248,197,106,0.5));
                    letter-spacing: 0.15em;
                }
                .matchup-team-btn {
                    transition: all 0.25s ease;
                }
                .matchup-team-btn:not(:disabled):hover {
                    background: rgba(248,197,106,0.06);
                    transform: scale(1.03);
                }
                .matchup-team-selected {
                    background: rgba(248,197,106,0.1) !important;
                    box-shadow: 0 0 30px -4px rgba(248,197,106,0.2), inset 0 0 0 1px rgba(248,197,106,0.3);
                }
                .matchup-team-selected img {
                    filter: drop-shadow(0 0 16px rgba(248,197,106,0.4));
                }
                .matchup-enter-left {
                    animation: matchup-slide-left 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
                }
                .matchup-enter-right {
                    animation: matchup-slide-right 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
                }
                @keyframes matchup-slide-left {
                    0% { opacity: 0; transform: translateX(-50px); }
                    100% { opacity: 1; transform: translateX(0); }
                }
                @keyframes matchup-slide-right {
                    0% { opacity: 0; transform: translateX(50px); }
                    100% { opacity: 1; transform: translateX(0); }
                }
                .matchup-card-enter {
                    animation: matchup-card-in 0.6s ease-out both;
                }
                @keyframes matchup-card-in {
                    0% { opacity: 0; transform: translateY(16px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                .matchup-wager-enter {
                    animation: matchup-wager-slide 0.3s ease-out both;
                }
                @keyframes matchup-wager-slide {
                    0% { opacity: 0; transform: translateY(-8px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    )
}


// ═══════════════════════════════════════════════════
// Player cell (desktop — one side of a row)
// ═══════════════════════════════════════════════════
function PlayerCell({ player, align }) {
    if (!player) return <div className="flex-1" />
    const kda = player.avgDeaths > 0
        ? ((player.avgKills + player.avgAssists / 2) / player.avgDeaths).toFixed(2)
        : (player.avgKills + player.avgAssists / 2).toFixed(2)
    const isRight = align === 'right'

    return (
        <div className={`flex-1 flex items-center gap-3 ${isRight ? 'flex-row-reverse text-right' : ''}`}>
            <Link to={`/profile/${player.playerSlug}`} className="text-sm font-bold text-white hover:text-[#f8c56a] transition-colors truncate max-w-[120px]">
                {player.playerName}
            </Link>
            <div className={`flex items-center gap-3 text-[11px] text-white/50 tabular-nums ${isRight ? 'flex-row-reverse' : ''}`}>
                <span title="KDA">{kda} KDA</span>
                <span title="Avg Damage">{Math.round(player.avgDamage).toLocaleString()} dmg</span>
                {player.topGod && <span className="text-white/30">{player.topGod}</span>}
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════
// Player card (mobile — stacked)
// ═══════════════════════════════════════════════════
function PlayerCardMobile({ player, teamColor }) {
    const kda = player.avgDeaths > 0
        ? ((player.avgKills + player.avgAssists / 2) / player.avgDeaths).toFixed(2)
        : (player.avgKills + player.avgAssists / 2).toFixed(2)

    return (
        <div className="flex items-center gap-3 py-1.5 px-2 rounded-lg" style={{ background: `${teamColor || '#6366f1'}08` }}>
            <Link to={`/profile/${player.playerSlug}`} className="text-xs font-bold text-white hover:text-[#f8c56a] transition-colors truncate flex-1">
                {player.playerName}
            </Link>
            <div className="flex items-center gap-2.5 text-[10px] text-white/50 tabular-nums shrink-0">
                <span>{kda} KDA</span>
                <span>{Math.round(player.avgDamage).toLocaleString()} dmg</span>
                {player.topGod && <span className="text-white/30 truncate max-w-[60px]">{player.topGod}</span>}
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════
// Recent form column
// ═══════════════════════════════════════════════════
function RecentFormColumn({ team, matches }) {
    if (!matches || matches.length === 0) {
        return (
            <div className="text-center py-4">
                <p className="text-white/30 text-xs">No matches played yet</p>
            </div>
        )
    }

    const streak = (() => {
        let count = 0
        const first = matches[0]?.won
        for (const m of matches) {
            if (m.won === first) count++
            else break
        }
        return { type: first ? 'W' : 'L', count }
    })()

    return (
        <div>
            <div className="flex items-center gap-2 mb-3">
                <TeamLogo slug={team.slug} name={team.name} size={20} />
                <span className="text-xs font-bold text-white/70">{team.name}</span>
                {streak.count >= 2 && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        streak.type === 'W' ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'
                    }`}>
                        {streak.count}{streak.type} streak
                    </span>
                )}
            </div>

            {/* W/L dots */}
            <div className="flex items-center gap-1.5 mb-3">
                {matches.map((m, i) => (
                    <div key={i} className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        m.won ? 'bg-green-500/20 text-green-400' : 'bg-red-500/15 text-red-400/70'
                    }`}>
                        {m.won ? 'W' : 'L'}
                    </div>
                ))}
            </div>

            {/* Match list */}
            <div className="space-y-1">
                {matches.map((m, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 text-[11px]">
                        <span className="text-white/40 tabular-nums w-14">
                            {m.week ? `W${m.week}` : new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <span className="text-white/60 truncate flex-1 px-2">vs {m.opponentName}</span>
                        <span className={`font-bold ${m.won ? 'text-green-400' : 'text-red-400/70'}`}>
                            {m.won ? 'W' : 'L'}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}

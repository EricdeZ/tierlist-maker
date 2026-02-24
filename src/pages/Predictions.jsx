import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { predictionsService, leagueService } from '../services/database'
import { useAuth } from '../context/AuthContext'
import { usePassion } from '../context/PassionContext'
import PageTitle from '../components/PageTitle'
import Navbar from '../components/layout/Navbar'
import RankBadge from '../components/RankBadge'
import passionCoin from '../assets/passion/passion.png'
import { Lock, Target, TrendingUp, Trophy, Flame } from 'lucide-react'
import { CoinBackground, CoinFlipOverlay, FloatingParticles } from './predictions/CoinFlipOverlay'
import { PredictionStyles } from './predictions/PredictionStyles'
import { UpcomingTab } from './predictions/UpcomingTab'
import { ResultsTab } from './predictions/ResultsTab'
import { MyPredictionsTab } from './predictions/MyPredictionsTab'
import { LeaderboardTab } from './predictions/LeaderboardTab'

const TABS = [
    { key: 'upcoming', label: 'Markets', icon: Target },
    { key: 'results', label: 'Results', icon: Trophy },
    { key: 'my-predictions', label: 'Portfolio', icon: TrendingUp },
    { key: 'leaderboard', label: 'Rankings', icon: Flame },
]

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
            <PageTitle title="Match Predictions" noindex />
            <CoinBackground />
            <CoinFlipOverlay open={coinFlipOpen} onClose={() => setCoinFlipOpen(false)} />

            {/* Full-page gradient background */}
            <div className="fixed inset-0 z-0" aria-hidden>
                <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #111830 0%, #161e38 35%, #1a2240 55%, #151d34 100%)' }} />
                <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 90% 50% at 50% 8%, rgba(248,197,106,0.25) 0%, transparent 65%)' }} />
                <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 70% 50% at 90% 25%, rgba(168,85,247,0.16) 0%, transparent 55%)' }} />
                <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 45% at 10% 45%, rgba(99,102,241,0.13) 0%, transparent 55%)' }} />
                <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 40% at 50% 85%, rgba(248,197,106,0.12) 0%, transparent 55%)' }} />
                <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 50% 35% at 70% 60%, rgba(196,146,46,0.08) 0%, transparent 50%)' }} />
            </div>

            {/* Hero */}
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

            {/* Tab bar */}
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

            {/* Content background */}
            <div className="relative z-5" aria-hidden>
                <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(14,20,40,0.7) 0%, rgba(18,26,50,0.5) 30%, transparent 100%)', height: '400px' }} />
            </div>

            {/* Content */}
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

            <PredictionStyles />
        </div>
    )
}

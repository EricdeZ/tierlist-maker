// src/pages/division/Matches.jsx
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDivision } from '../../context/DivisionContext'
import { matchService } from '../../services/database'
import PageTitle from '../../components/PageTitle'
import TeamLogo from '../../components/TeamLogo'
import { Calendar, Clock, ChevronDown, ChevronRight, Trophy, Swords } from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════════════════
   Collapsible Week Section
   ═══════════════════════════════════════════════════════════════════════════ */
const WeekSection = ({ title, matches, defaultOpen, basePath, formatDate, leagueColor, type }) => {
    const [open, setOpen] = useState(defaultOpen)
    const contentRef = useRef(null)
    const [height, setHeight] = useState(defaultOpen ? 'auto' : '0px')

    useEffect(() => {
        if (!contentRef.current) return
        if (open) {
            setHeight(`${contentRef.current.scrollHeight}px`)
            const t = setTimeout(() => setHeight('auto'), 300)
            return () => clearTimeout(t)
        } else {
            // Collapse: set explicit height first, then 0
            setHeight(`${contentRef.current.scrollHeight}px`)
            requestAnimationFrame(() => {
                requestAnimationFrame(() => setHeight('0px'))
            })
        }
    }, [open])

    const completedCount = matches.filter(m => m.is_completed).length
    const totalCount = matches.length
    const weekNum = title.replace('Week ', '')
    const isNumberedWeek = !isNaN(parseInt(weekNum))

    return (
        <div className="group/week">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 hover:bg-white/[0.03]"
            >
                {/* Week indicator */}
                <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-sm font-black font-heading transition-colors"
                    style={{
                        background: open ? `${leagueColor}20` : 'rgba(255,255,255,0.04)',
                        color: open ? leagueColor : 'var(--color-text-secondary)',
                    }}
                >
                    {isNumberedWeek ? weekNum : '#'}
                </div>

                <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-heading text-sm font-bold text-(--color-text)">
                            {title}
                        </span>
                        {type === 'upcoming' && (
                            <span
                                className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                style={{ background: `${leagueColor}15`, color: leagueColor }}
                            >
                                {totalCount} match{totalCount !== 1 ? 'es' : ''}
                            </span>
                        )}
                        {type === 'results' && (
                            <span className="text-[10px] font-medium text-(--color-text-secondary)/50 uppercase tracking-wider">
                                {completedCount}/{totalCount} played
                            </span>
                        )}
                    </div>
                    {/* Date range hint */}
                    {matches.length > 0 && matches[0].date && (
                        <div className="text-[11px] text-(--color-text-secondary)/40 mt-0.5">
                            {formatDate(matches[matches.length - 1].date)}
                            {matches.length > 1 && matches[0].date !== matches[matches.length - 1].date && (
                                <> — {formatDate(matches[0].date)}</>
                            )}
                        </div>
                    )}
                </div>

                {/* Progress bar for results weeks */}
                {type === 'results' && totalCount > 0 && (
                    <div className="hidden sm:flex items-center gap-2 shrink-0">
                        <div className="w-16 h-1 rounded-full bg-white/5 overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                    width: `${(completedCount / totalCount) * 100}%`,
                                    background: completedCount === totalCount ? leagueColor : `${leagueColor}80`,
                                }}
                            />
                        </div>
                    </div>
                )}

                <ChevronDown
                    className="w-4 h-4 text-(--color-text-secondary)/40 transition-transform duration-300 shrink-0"
                    style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
            </button>

            {/* Collapsible content */}
            <div
                className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
                style={{ maxHeight: height }}
            >
                <div ref={contentRef} className="px-1 pb-2 pt-1">
                    <div className="space-y-2">
                        {matches.map(match => (
                            <MatchCard
                                key={match.id}
                                match={match}
                                formatDate={formatDate}
                                basePath={basePath}
                                leagueColor={leagueColor}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Match Card — Esports-grade design
   ═══════════════════════════════════════════════════════════════════════════ */
const MatchCard = ({ match, formatDate, basePath, leagueColor }) => {
    const isCompleted = match.is_completed
    const team1Won = match.winner_team_id === match.team1_id
    const team2Won = match.winner_team_id === match.team2_id
    const matchLink = isCompleted ? `${basePath}/matches/${match.id}` : null

    const CardWrapper = matchLink
        ? ({ children, className }) => (
            <Link to={matchLink} className={`${className} group`}>
                {children}
            </Link>
        )
        : ({ children, className }) => (
            <div className={className}>{children}</div>
        )

    return (
        <CardWrapper
            className={`block relative rounded-xl border overflow-hidden transition-all duration-200 ${
                isCompleted
                    ? 'border-white/[0.06] hover:border-white/15 bg-(--color-secondary)/80 hover:bg-(--color-secondary) cursor-pointer'
                    : 'border-white/[0.08] bg-(--color-secondary)/50'
            }`}
        >
            {/* Top accent line for completed */}
            {isCompleted && (
                <div
                    className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: `linear-gradient(90deg, transparent, ${leagueColor}, transparent)` }}
                />
            )}

            {/* ── Desktop layout (md+) ── */}
            <div className="hidden md:flex items-center min-h-[60px]">
                {/* Team 1 side */}
                <div className={`flex-1 flex items-center gap-3 px-5 py-3 ${isCompleted && !team1Won ? 'opacity-40' : ''}`}>
                    <TeamLogo slug={match.team1_slug} name={match.team1_name} size={28} color={match.team1_color} />
                    <div
                        className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-offset-1"
                        style={{
                            backgroundColor: match.team1_color,
                            ringColor: `${match.team1_color}40`,
                            ringOffsetColor: 'transparent',
                        }}
                    />
                    <span className={`text-sm font-bold truncate transition-colors ${
                        team1Won ? 'text-(--color-text)' : 'text-(--color-text) group-hover:text-(--color-accent)'
                    }`}>
                        {match.team1_name}
                    </span>
                    {team1Won && (
                        <span className="ml-auto text-[10px] font-black uppercase tracking-wider text-green-400 shrink-0">
                            WIN
                        </span>
                    )}
                </div>

                {/* Center scoreboard */}
                <div className="shrink-0 px-5 py-3 flex flex-col items-center min-w-[120px]">
                    {isCompleted ? (
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-(--color-text-secondary)/50">
                                Final
                            </span>
                        </div>
                    ) : (
                        <span
                            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                            style={{ background: `${leagueColor}15`, color: leagueColor }}
                        >
                            Upcoming
                        </span>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                        {match.date && (
                            <span className="text-[11px] text-(--color-text-secondary)/40">
                                {formatDate(match.date)}
                            </span>
                        )}
                        {match.best_of > 1 && (
                            <>
                                <span className="text-(--color-text-secondary)/15">·</span>
                                <span className="text-[11px] text-(--color-text-secondary)/30">
                                    Bo{match.best_of}
                                </span>
                            </>
                        )}
                    </div>
                </div>

                {/* Team 2 side */}
                <div className={`flex-1 flex items-center gap-3 px-5 py-3 justify-end ${isCompleted && !team2Won ? 'opacity-40' : ''}`}>
                    {team2Won && (
                        <span className="mr-auto text-[10px] font-black uppercase tracking-wider text-green-400 shrink-0">
                            WIN
                        </span>
                    )}
                    <span className={`text-sm font-bold truncate text-right transition-colors ${
                        team2Won ? 'text-(--color-text)' : 'text-(--color-text) group-hover:text-(--color-accent)'
                    }`}>
                        {match.team2_name}
                    </span>
                    <div
                        className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-offset-1"
                        style={{
                            backgroundColor: match.team2_color,
                            ringColor: `${match.team2_color}40`,
                            ringOffsetColor: 'transparent',
                        }}
                    />
                    <TeamLogo slug={match.team2_slug} name={match.team2_name} size={28} color={match.team2_color} />
                </div>

                {/* View arrow for completed */}
                {isCompleted && (
                    <div className="pr-4 shrink-0">
                        <ChevronRight className="w-4 h-4 text-(--color-text-secondary)/20 group-hover:text-(--color-accent) transition-all group-hover:translate-x-0.5" />
                    </div>
                )}
            </div>

            {/* ── Mobile layout (<md) ── */}
            <div className="md:hidden p-3.5">
                {/* Status + date row */}
                <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                        {isCompleted ? (
                            <span className="text-[10px] font-bold text-(--color-text-secondary)/50 uppercase tracking-wider px-2 py-0.5 rounded bg-white/[0.03]">
                                Final
                            </span>
                        ) : (
                            <span
                                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                                style={{ background: `${leagueColor}15`, color: leagueColor }}
                            >
                                Upcoming
                            </span>
                        )}
                        {match.best_of > 1 && (
                            <span className="text-[10px] text-(--color-text-secondary)/40">
                                Bo{match.best_of}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {match.date && (
                            <span className="text-[11px] text-(--color-text-secondary)/40">
                                {formatDate(match.date)}
                            </span>
                        )}
                        {isCompleted && (
                            <ChevronRight className="w-3.5 h-3.5 text-(--color-text-secondary)/30 group-hover:text-(--color-accent) transition-colors" />
                        )}
                    </div>
                </div>

                {/* Teams */}
                <div className="space-y-1.5">
                    {/* Team 1 */}
                    <div
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors ${
                            team1Won
                                ? 'bg-green-500/[0.06] border border-green-500/15'
                                : isCompleted
                                    ? 'opacity-40'
                                    : ''
                        }`}
                    >
                        <TeamLogo slug={match.team1_slug} name={match.team1_name} size={20} color={match.team1_color} />
                        <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: match.team1_color }}
                        />
                        <span className="text-sm font-bold text-(--color-text) flex-1 truncate">
                            {match.team1_name}
                        </span>
                        {team1Won && (
                            <span className="text-[10px] font-black text-green-400 uppercase tracking-wider shrink-0">WIN</span>
                        )}
                    </div>

                    {/* VS */}
                    <div className="flex items-center gap-2 px-3">
                        <div className="flex-1 h-px bg-white/[0.04]" />
                        <span className="text-[9px] font-bold text-(--color-text-secondary)/25 uppercase">vs</span>
                        <div className="flex-1 h-px bg-white/[0.04]" />
                    </div>

                    {/* Team 2 */}
                    <div
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors ${
                            team2Won
                                ? 'bg-green-500/[0.06] border border-green-500/15'
                                : isCompleted
                                    ? 'opacity-40'
                                    : ''
                        }`}
                    >
                        <TeamLogo slug={match.team2_slug} name={match.team2_name} size={20} color={match.team2_color} />
                        <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: match.team2_color }}
                        />
                        <span className="text-sm font-bold text-(--color-text) flex-1 truncate">
                            {match.team2_name}
                        </span>
                        {team2Won && (
                            <span className="text-[10px] font-black text-green-400 uppercase tracking-wider shrink-0">WIN</span>
                        )}
                    </div>
                </div>
            </div>
        </CardWrapper>
    )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Section Toggle (Upcoming / Results tabs)
   ═══════════════════════════════════════════════════════════════════════════ */
const SectionToggle = ({ active, onChange, upcomingCount, resultsCount, leagueColor }) => (
    <div className="flex items-center bg-white/[0.03] rounded-xl p-1 border border-white/[0.06] overflow-hidden">
        <button
            onClick={() => onChange('upcoming')}
            className={`relative flex-1 flex items-center justify-center gap-1.5 px-3 sm:px-5 py-2.5 rounded-lg text-xs sm:text-sm font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer whitespace-nowrap ${
                active === 'upcoming'
                    ? 'text-(--color-text) shadow-lg'
                    : 'text-(--color-text-secondary)/50 hover:text-(--color-text-secondary)'
            }`}
            style={active === 'upcoming' ? { background: `${leagueColor}18`, color: leagueColor } : {}}
        >
            <Clock className="w-4 h-4" />
            <span className="hidden sm:inline">Upcoming</span>
            {upcomingCount > 0 && (
                <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none"
                    style={active === 'upcoming'
                        ? { background: `${leagueColor}30`, color: leagueColor }
                        : { background: 'rgba(255,255,255,0.06)', color: 'inherit' }
                    }
                >
                    {upcomingCount}
                </span>
            )}
        </button>
        <button
            onClick={() => onChange('results')}
            className={`relative flex-1 flex items-center justify-center gap-1.5 px-3 sm:px-5 py-2.5 rounded-lg text-xs sm:text-sm font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer whitespace-nowrap ${
                active === 'results'
                    ? 'text-(--color-text) shadow-lg'
                    : 'text-(--color-text-secondary)/50 hover:text-(--color-text-secondary)'
            }`}
            style={active === 'results' ? { background: `${leagueColor}18`, color: leagueColor } : {}}
        >
            <Trophy className="w-4 h-4" />
            <span className="hidden sm:inline">Results</span>
            {resultsCount > 0 && (
                <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none"
                    style={active === 'results'
                        ? { background: `${leagueColor}30`, color: leagueColor }
                        : { background: 'rgba(255,255,255,0.06)', color: 'inherit' }
                    }
                >
                    {resultsCount}
                </span>
            )}
        </button>
    </div>
)

/* ═══════════════════════════════════════════════════════════════════════════
   Empty State
   ═══════════════════════════════════════════════════════════════════════════ */
const EmptyState = ({ type, leagueColor }) => (
    <div className="flex flex-col items-center justify-center py-16 text-center">
        <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: `${leagueColor}10` }}
        >
            {type === 'upcoming'
                ? <Calendar className="w-8 h-8" style={{ color: `${leagueColor}60` }} />
                : <Trophy className="w-8 h-8" style={{ color: `${leagueColor}60` }} />
            }
        </div>
        <p className="text-(--color-text-secondary)/60 text-sm font-medium">
            {type === 'upcoming'
                ? 'No upcoming matches scheduled'
                : 'No results yet — check back after matches are played'
            }
        </p>
    </div>
)


/* ═══════════════════════════════════════════════════════════════════════════
   Main Matches Page
   ═══════════════════════════════════════════════════════════════════════════ */
const Matches = () => {
    const { leagueSlug, divisionSlug } = useParams()
    const { season, division, league } = useDivision()
    const [matches, setMatches] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [activeSection, setActiveSection] = useState(null) // set after data loads

    const basePath = `/${leagueSlug}/${divisionSlug}`
    const leagueColor = league?.color || 'var(--color-accent)'

    useEffect(() => {
        if (!season) return
        let cancelled = false
        const fetchMatches = async () => {
            setLoading(true)
            setError(null)
            try {
                const data = await matchService.getAllBySeason(season.id)
                if (!cancelled) setMatches(data)
            } catch (err) {
                if (!cancelled) setError(err.message)
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        fetchMatches()
        return () => { cancelled = true }
    }, [season])

    const formatDate = useCallback((dateStr) => {
        if (!dateStr) return ''
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        })
    }, [])

    // Split matches into upcoming and completed, grouped by week
    const { upcomingWeeks, resultsWeeks, upcomingCount, resultsCount } = useMemo(() => {
        const upcoming = {}
        const results = {}

        for (const match of matches) {
            const key = match.week != null ? `Week ${match.week}` : 'Unscheduled'
            if (match.is_completed) {
                if (!results[key]) results[key] = []
                results[key].push(match)
            } else {
                if (!upcoming[key]) upcoming[key] = []
                upcoming[key].push(match)
            }
        }

        // Sort weeks: ascending for upcoming (soonest first), descending for results (latest first)
        const sortWeeks = (obj, ascending) => {
            return Object.keys(obj).sort((a, b) => {
                const numA = parseInt(a.replace('Week ', ''))
                const numB = parseInt(b.replace('Week ', ''))
                if (isNaN(numA)) return 1
                if (isNaN(numB)) return -1
                return ascending ? numA - numB : numB - numA
            })
        }

        // Sort matches within each week by date
        for (const key of Object.keys(upcoming)) {
            upcoming[key].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))
        }
        for (const key of Object.keys(results)) {
            results[key].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
        }

        const uw = sortWeeks(upcoming, true).map(k => ({ key: k, matches: upcoming[k] }))
        const rw = sortWeeks(results, false).map(k => ({ key: k, matches: results[k] }))

        const uCount = Object.values(upcoming).reduce((s, arr) => s + arr.length, 0)
        const rCount = Object.values(results).reduce((s, arr) => s + arr.length, 0)

        return { upcomingWeeks: uw, resultsWeeks: rw, upcomingCount: uCount, resultsCount: rCount }
    }, [matches])

    // Default to results
    useEffect(() => {
        if (activeSection !== null) return
        if (!loading && matches.length > 0) {
            setActiveSection('results')
        }
    }, [loading, matches, activeSection])

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-t-transparent mx-auto mb-4" style={{ borderColor: `${leagueColor}40`, borderTopColor: 'transparent' }} />
                    <p className="text-(--color-text-secondary)/50 text-sm">Loading matches...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="max-w-3xl mx-auto py-8 px-4">
                <div className="bg-red-900/20 border border-red-500/20 rounded-xl p-8 text-center">
                    <h2 className="text-xl font-bold text-red-400 mb-2 font-heading">Failed to Load Matches</h2>
                    <p className="text-red-300/60 text-sm">{error}</p>
                </div>
            </div>
        )
    }

    const currentWeeks = activeSection === 'upcoming' ? upcomingWeeks : resultsWeeks

    return (
        <div>
            {division && <PageTitle title={`Matches - ${division.name}`} description={`Match schedule and results for the ${division.name} division. Week-by-week results with team compositions and scores.`} />}

            {/* Keyframes */}
            <style>{`
                @keyframes matchesSlideUp {
                    from { opacity: 0; transform: translateY(12px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>

            {/* ─── Hero Header ─── */}
            <div className="relative overflow-hidden border-b border-white/[0.06]">
                {/* Background layers */}
                <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${leagueColor}15, transparent 60%)` }} />
                <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse 60% 50% at 80% 80%, ${leagueColor}08, transparent 50%)` }} />
                <div
                    className="absolute inset-0 opacity-[0.02] pointer-events-none"
                    style={{
                        backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
                        backgroundSize: '48px 48px',
                    }}
                />
                <div
                    className="absolute bottom-0 left-0 right-0 h-px"
                    style={{ background: `linear-gradient(90deg, transparent, ${leagueColor}30, transparent)` }}
                />

                <div className="relative z-10 max-w-5xl mx-auto px-4 py-10 sm:py-14" style={{ animation: 'matchesSlideUp 0.4s ease-out' }}>
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-3 mb-3">
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                                    style={{ background: `${leagueColor}15` }}
                                >
                                    <Swords className="w-5 h-5" style={{ color: leagueColor }} />
                                </div>
                                <div>
                                    <h1 className="font-heading text-2xl sm:text-3xl font-black text-(--color-text)">
                                        Matches
                                    </h1>
                                </div>
                            </div>
                            <p className="text-(--color-text-secondary)/60 text-sm ml-[52px] -mt-1">
                                {season?.name} — {matches.length} total match{matches.length !== 1 ? 'es' : ''}
                            </p>
                        </div>

                        {/* Summary pills */}
                        <div className="flex items-center gap-3 ml-[52px] sm:ml-0">
                            {upcomingCount > 0 && (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: `${leagueColor}12`, color: leagueColor }}>
                                    <Clock className="w-3.5 h-3.5" />
                                    {upcomingCount} upcoming
                                </div>
                            )}
                            {resultsCount > 0 && (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/[0.04] text-(--color-text-secondary)/60">
                                    <Trophy className="w-3.5 h-3.5" />
                                    {resultsCount} played
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Content ─── */}
            <div className="max-w-5xl mx-auto px-4 py-6">
                {matches.length === 0 ? (
                    <div className="rounded-xl border border-white/[0.06] bg-(--color-secondary)/30 p-12 text-center">
                        <Calendar className="w-12 h-12 mx-auto mb-4" style={{ color: `${leagueColor}40` }} />
                        <p className="text-(--color-text-secondary)/50 text-lg font-medium font-heading">No matches scheduled yet</p>
                        <p className="text-(--color-text-secondary)/30 text-sm mt-1">Check back soon for upcoming matchups</p>
                    </div>
                ) : (
                    <>
                        {/* Section Toggle */}
                        <div className="max-w-sm mx-auto mb-6">
                            <SectionToggle
                                active={activeSection || 'upcoming'}
                                onChange={setActiveSection}
                                upcomingCount={upcomingCount}
                                resultsCount={resultsCount}
                                leagueColor={leagueColor}
                            />
                        </div>

                        {/* Week sections */}
                        <div className="space-y-1">
                            {currentWeeks.length === 0 ? (
                                <EmptyState type={activeSection || 'upcoming'} leagueColor={leagueColor} />
                            ) : (
                                currentWeeks.map((week, i) => (
                                    <WeekSection
                                        key={week.key}
                                        title={week.key}
                                        matches={week.matches}
                                        defaultOpen={i === 0}
                                        basePath={basePath}
                                        formatDate={formatDate}
                                        leagueColor={leagueColor}
                                        type={activeSection || 'upcoming'}
                                    />
                                ))
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

export default Matches

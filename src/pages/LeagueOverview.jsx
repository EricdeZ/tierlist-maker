import { useEffect, useState, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { leagueService } from '../services/database'
import { ArrowLeft, ChevronDown, ChevronRight, Calendar, Users, Trophy, MessageCircle, Home, User, Wrench, ListOrdered, Swords } from 'lucide-react'
import UserMenu from '../components/UserMenu'
import PageTitle from '../components/PageTitle'
import smiteLogo from '../assets/smite2.png'

import aglLogo from '../assets/leagues/agl.png'
import babylonLogo from '../assets/leagues/babylon.png'
import oslLogo from '../assets/leagues/osl.png'

import { getDivisionImage, RANK_LABELS } from '../utils/divisionImages'

const LEAGUE_LOGOS = {
    'agl': aglLogo,
    'albion-giants-league': aglLogo,
    'bsl': babylonLogo,
    'babylon-smite-league': babylonLogo,
    'osl': oslLogo,
    'olympian-smite-league': oslLogo,
}

const LeagueOverview = () => {
    const { leagueSlug } = useParams()
    const { user, linkedPlayer } = useAuth()
    const [league, setLeague] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [expanded, setExpanded] = useState({})
    const [toolsOpen, setToolsOpen] = useState(false)
    const toolsRef = useRef(null)

    // Close tools dropdown on click outside
    useEffect(() => {
        if (!toolsOpen) return
        const handle = (e) => {
            if (toolsRef.current && !toolsRef.current.contains(e.target)) setToolsOpen(false)
        }
        document.addEventListener('mousedown', handle)
        return () => document.removeEventListener('mousedown', handle)
    }, [toolsOpen])

    useEffect(() => {
        let cancelled = false

        const load = async () => {
            try {
                const data = await leagueService.getBySlug(leagueSlug)
                if (cancelled) return
                if (!data || !data.id) {
                    setError('League not found')
                } else {
                    setLeague(data)
                }
            } catch (err) {
                if (!cancelled) setError(err.message)
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        load()
        return () => { cancelled = true }
    }, [leagueSlug])

    const toggleExpand = (divisionId) => {
        setExpanded(prev => ({ ...prev, [divisionId]: !prev[divisionId] }))
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-(--color-accent) mx-auto mb-4" />
                    <p className="text-(--color-text-secondary)">Loading league...</p>
                </div>
            </div>
        )
    }

    if (error || !league) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4">
                <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-8 text-center max-w-md">
                    <h2 className="text-2xl font-bold text-red-400 mb-3">League Not Found</h2>
                    <p className="text-red-300/80 mb-6">{error || 'This league does not exist.'}</p>
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/10 text-(--color-text) hover:bg-white/20 transition-colors text-sm"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Home
                    </Link>
                </div>
            </div>
        )
    }

    const divisions = league.divisions || []
    const logo = LEAGUE_LOGOS[league.slug]
    const activeDivisions = divisions.filter(d => d.seasons?.some(s => s.is_active))
    const totalSeasons = divisions.reduce((sum, d) => sum + (d.seasons?.length || 0), 0)
    const leagueColor = league.color || 'var(--color-accent)'

    return (
        <div className="min-h-screen">
            {league && <PageTitle title={league.name} />}

            {/* ─── NAVBAR ─── */}
            <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-7xl">
                <div className="bg-(--color-primary)/75 backdrop-blur-xl rounded-xl px-4 py-2 shadow-lg border border-white/10">
                    <div className="flex items-center gap-3 sm:gap-6">
                        {/* Logo → homepage */}
                        <Link to="/" className="flex items-center gap-3 flex-shrink-0">
                            <img src={smiteLogo} alt="SMITE 2" className="h-8 sm:h-10 w-auto" />
                        </Link>

                        {/* League badge */}
                        <div className="flex items-center gap-2 flex-shrink-0 border-l border-white/10 pl-3 sm:pl-4">
                            {logo && (
                                <img src={logo} alt="" className="h-6 w-6 sm:h-7 sm:w-7 object-contain" />
                            )}
                            <div className="text-xs sm:text-sm font-bold text-(--color-text)">
                                {league.name}
                            </div>
                        </div>

                        {/* Right side: Home, Profile, Tools, UserMenu */}
                        <div className="flex items-center gap-1 ml-auto">
                            <Link
                                to="/"
                                title="Home"
                                className="p-2 rounded-lg text-(--nav-text) hover:text-(--color-accent) hover:bg-white/10 transition-all duration-200"
                            >
                                <Home className="w-4 h-4" />
                            </Link>
                            {user && (
                                linkedPlayer ? (
                                    <Link
                                        to={`/profile/${linkedPlayer.slug}`}
                                        title="My Profile"
                                        className="p-2 rounded-lg text-(--nav-text) hover:text-(--color-accent) hover:bg-white/10 transition-all duration-200"
                                    >
                                        <User className="w-4 h-4" />
                                    </Link>
                                ) : (
                                    <button
                                        onClick={() => window.dispatchEvent(new CustomEvent('open-claim-modal'))}
                                        title="Claim Your Profile"
                                        className="p-2 rounded-lg text-(--nav-text) hover:text-(--color-accent) hover:bg-white/10 transition-all duration-200"
                                    >
                                        <User className="w-4 h-4" />
                                    </button>
                                )
                            )}
                            <div ref={toolsRef} className="relative">
                                <button
                                    onClick={() => setToolsOpen(!toolsOpen)}
                                    title="Tools"
                                    className={`p-2 rounded-lg flex items-center gap-0.5 transition-all duration-200 ${
                                        toolsOpen ? 'text-(--color-accent) bg-white/10' : 'text-(--nav-text) hover:text-(--color-accent) hover:bg-white/10'
                                    }`}
                                >
                                    <Wrench className="w-4 h-4" />
                                    <ChevronDown className={`w-3 h-3 transition-transform ${toolsOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {toolsOpen && (
                                    <div className="absolute right-0 top-full mt-2 w-48 bg-(--color-secondary) border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
                                        <div className="py-1">
                                            <Link
                                                to="/tierlist"
                                                onClick={() => setToolsOpen(false)}
                                                className="flex items-center gap-3 px-4 py-2.5 text-sm text-(--color-text) hover:bg-white/5 transition-colors"
                                            >
                                                <ListOrdered className="w-4 h-4 text-(--color-text-secondary)" />
                                                Tier List
                                            </Link>
                                            <Link
                                                to="/draft"
                                                onClick={() => setToolsOpen(false)}
                                                className="flex items-center gap-3 px-4 py-2.5 text-sm text-(--color-text) hover:bg-white/5 transition-colors"
                                            >
                                                <Swords className="w-4 h-4 text-(--color-text-secondary)" />
                                                Draft Simulator
                                            </Link>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <UserMenu compact />
                        </div>
                    </div>
                </div>
            </nav>

            {/* ─── HERO ─── */}
            <section className="relative overflow-hidden pt-24 pb-16 px-4">
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: `radial-gradient(ellipse at 50% 0%, ${leagueColor}10, transparent 60%)` }}
                />

                <div className="max-w-5xl mx-auto relative z-10">
                    <Link
                        to="/"
                        className="inline-flex items-center gap-1.5 text-sm text-(--color-text-secondary) hover:text-(--color-accent) transition-colors mb-8"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        All Leagues
                    </Link>

                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                        {logo ? (
                            <img
                                src={logo}
                                alt=""
                                className="h-28 w-28 object-contain"
                            />
                        ) : (
                            <div className="h-24 w-24 rounded-2xl bg-(--color-secondary) border border-white/10 flex items-center justify-center text-4xl">
                                <Trophy className="w-10 h-10" style={{ color: leagueColor }} />
                            </div>
                        )}
                        <div className="text-center sm:text-left flex-1">
                            <h1 className="font-heading text-4xl sm:text-5xl font-black text-(--color-text) mb-2">
                                {league.name}
                            </h1>
                            {league.description && league.description !== league.name && (
                                <p className="text-lg text-(--color-text-secondary) max-w-xl">
                                    {league.description}
                                </p>
                            )}
                            <div className="flex flex-wrap items-center gap-3 mt-4 justify-center sm:justify-start">
                                {activeDivisions.length > 0 && (
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider" style={{ backgroundColor: `${leagueColor}15`, borderColor: `${leagueColor}30`, color: leagueColor, border: `1px solid ${leagueColor}30` }}>
                                        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: leagueColor }} />
                                        {activeDivisions.length} Active {activeDivisions.length === 1 ? 'Division' : 'Divisions'}
                                    </div>
                                )}
                                {league.discord_url && (
                                    <a
                                        href={league.discord_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold text-white bg-[#5865F2] hover:bg-[#4752C4] transition-colors"
                                    >
                                        <MessageCircle className="w-3.5 h-3.5" />
                                        Discord
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── QUICK STATS ─── */}
            <section className="px-4 pb-12">
                <div className="max-w-5xl mx-auto">
                    <div className="grid grid-cols-3 gap-4">
                        {[
                            { icon: <Users className="w-5 h-5" />, label: 'Divisions', value: divisions.length },
                            { icon: <Calendar className="w-5 h-5" />, label: 'Seasons', value: totalSeasons },
                            { icon: <Trophy className="w-5 h-5" />, label: 'Active', value: activeDivisions.length },
                        ].map(stat => (
                            <div
                                key={stat.label}
                                className="bg-(--color-secondary) rounded-xl border border-white/10 p-5 text-center"
                            >
                                <div className="flex items-center justify-center gap-2 text-(--color-text-secondary) mb-2">
                                    {stat.icon}
                                </div>
                                <div className="text-2xl font-bold text-(--color-text) font-heading">
                                    {stat.value}
                                </div>
                                <div className="text-xs text-(--color-text-secondary) uppercase tracking-wider mt-1">
                                    {stat.label}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── DIVISIONS ─── */}
            <section className="px-4 pb-20">
                <div className="max-w-5xl mx-auto">
                    <div
                        className="w-2/3 h-px mx-auto mb-12"
                        style={{ background: `linear-gradient(90deg, transparent, ${leagueColor}40, transparent)` }}
                    />

                    <div className="text-center mb-10">
                        <span className="text-sm font-bold uppercase tracking-widest mb-3 block" style={{ color: leagueColor }}>
                            Divisions
                        </span>
                        <h2 className="font-heading text-3xl font-black text-(--color-text)">
                            Choose Your Division
                        </h2>
                    </div>

                    {divisions.length === 0 ? (
                        <p className="text-center text-(--color-text-secondary) italic">
                            No divisions have been created yet.
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {divisions.map(division => {
                                const rankImg = getDivisionImage(leagueSlug, division.slug, division.tier)
                                const rankLabel = RANK_LABELS[division.tier]
                                const activeSeason = division.seasons?.find(s => s.is_active)
                                const hasData = !!activeSeason
                                const isExpanded = expanded[division.id]
                                const seasons = division.seasons || []

                                return (
                                    <div
                                        key={division.id}
                                        className={`group relative rounded-xl border transition-all duration-300 overflow-hidden ${
                                            hasData
                                                ? 'border-white/10 hover:border-(--color-accent)/40 hover:shadow-lg hover:shadow-(--color-accent)/5'
                                                : 'border-white/5 opacity-50'
                                        }`}
                                        style={{
                                            background: hasData
                                                ? 'linear-gradient(135deg, var(--color-secondary), var(--color-primary))'
                                                : 'var(--color-secondary)',
                                        }}
                                    >
                                        {/* Accent top line */}
                                        <div
                                            className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                            style={{ background: `linear-gradient(90deg, transparent, ${leagueColor}, transparent)` }}
                                        />

                                        {/* Main banner content */}
                                        <div className="p-6">
                                            <div className="flex items-start gap-4">
                                                {rankImg && (
                                                    <img
                                                        src={rankImg}
                                                        alt={rankLabel}
                                                        className="h-14 w-14 object-contain flex-shrink-0"
                                                    />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h3 className="font-heading text-xl font-bold text-(--color-text) truncate">
                                                            {division.name}
                                                        </h3>
                                                        {hasData && (
                                                            <span className="flex-shrink-0 w-2 h-2 rounded-full bg-green-400" />
                                                        )}
                                                    </div>
                                                    {rankLabel && (
                                                        <span className="text-xs text-(--color-text-secondary) uppercase tracking-wider">
                                                            {rankLabel} Tier
                                                        </span>
                                                    )}
                                                    {activeSeason && (
                                                        <p className="text-sm text-(--color-text-secondary) mt-2 flex items-center gap-1.5">
                                                            <Calendar className="w-3.5 h-3.5" />
                                                            {activeSeason.name}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Action area */}
                                                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                                    {hasData && (
                                                        <Link
                                                            to={`/${leagueSlug}/${division.slug}`}
                                                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.03] hover:shadow-md"
                                                            style={{ background: leagueColor, boxShadow: `0 4px 12px ${leagueColor}30` }}
                                                        >
                                                            Enter
                                                            <ChevronRight className="w-4 h-4" />
                                                        </Link>
                                                    )}
                                                    {seasons.length > 1 && (
                                                        <button
                                                            onClick={() => toggleExpand(division.id)}
                                                            className="inline-flex items-center gap-1 text-xs text-(--color-text-secondary) hover:text-(--color-accent) transition-colors"
                                                        >
                                                            {seasons.length} seasons
                                                            <ChevronDown
                                                                className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                                            />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expandable seasons list */}
                                        {isExpanded && seasons.length > 0 && (
                                            <div className="border-t border-white/5 px-6 py-4">
                                                <div className="space-y-2">
                                                    {seasons.map(season => (
                                                        <div
                                                            key={season.id}
                                                            className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/5"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                {season.is_active && (
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                                                                )}
                                                                <span className={`text-sm ${season.is_active ? 'text-(--color-text) font-medium' : 'text-(--color-text-secondary)'}`}>
                                                                    {season.name}
                                                                </span>
                                                            </div>
                                                            {season.start_date && (
                                                                <span className="text-xs text-(--color-text-secondary)/60">
                                                                    {new Date(season.start_date).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* No data overlay hint */}
                                        {!hasData && (
                                            <div className="px-6 pb-4">
                                                <p className="text-sm text-(--color-text-secondary)/50 italic">
                                                    No active season
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </section>

            {/* ─── FOOTER CTA ─── */}
            <section className="px-4 pb-16">
                <div className="max-w-5xl mx-auto text-center">
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 text-sm text-(--color-text-secondary) hover:text-(--color-accent) transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to All Leagues
                    </Link>
                </div>
            </section>
        </div>
    )
}

export default LeagueOverview

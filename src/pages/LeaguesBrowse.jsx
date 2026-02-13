import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { leagueService } from '../services/database'
import { Trophy, ChevronRight, Calendar, MessageCircle, Users } from 'lucide-react'
import SimpleNav from '../components/layout/SimpleNav'
import PageTitle from '../components/PageTitle'
import { getLeagueLogo } from '../utils/leagueImages'
import { getDivisionImage, RANK_LABELS } from '../utils/divisionImages'

const LeaguesBrowse = () => {
    const [leagues, setLeagues] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        let cancelled = false

        const load = async () => {
            try {
                const allLeagues = await leagueService.getAll()
                if (cancelled) return

                const detailed = await Promise.all(
                    allLeagues.map(l => leagueService.getBySlug(l.slug))
                )
                if (cancelled) return
                setLeagues(detailed)
            } catch (err) {
                if (!cancelled) setError(err.message)
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        load()
        return () => { cancelled = true }
    }, [])

    const mainLeagues = [...leagues]
        .filter(l => l.name?.toLowerCase() !== 'test league')
        .sort((a, b) => {
            const aActive = a.divisions?.some(d => d.seasons?.some(s => s.is_active)) ? 0 : 1
            const bActive = b.divisions?.some(d => d.seasons?.some(s => s.is_active)) ? 0 : 1
            return aActive - bActive
        })

    if (loading) {
        return (
            <div className="min-h-screen">
                <SimpleNav title="Leagues" />
                <div className="pt-24 flex items-center justify-center">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-(--color-accent) mx-auto mb-4" />
                        <p className="text-(--color-text-secondary)">Loading leagues...</p>
                    </div>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen">
                <SimpleNav title="Leagues" />
                <div className="pt-24 flex items-center justify-center px-4">
                    <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-8 text-center max-w-md">
                        <h2 className="text-2xl font-bold text-red-400 mb-3">Error</h2>
                        <p className="text-red-300/80">{error}</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen">
            <PageTitle title="Leagues" />
            <SimpleNav title="Leagues" />

            {/* Hero */}
            <section className="pt-24 pb-12 px-4">
                <div className="max-w-5xl mx-auto text-center">
                    <span className="text-sm font-bold text-(--color-accent) uppercase tracking-widest mb-3 block">Competition</span>
                    <h1 className="font-heading text-4xl sm:text-5xl font-black text-(--color-text) mb-3">
                        All Leagues
                    </h1>
                    <p className="text-(--color-text-secondary) max-w-lg mx-auto">
                        Browse every tracked SMITE 2 league and jump into your division.
                    </p>
                </div>
            </section>

            {/* Leagues list */}
            <section className="px-4 pb-20">
                <div className="max-w-5xl mx-auto space-y-12">
                    {mainLeagues.map(league => {
                        const divisions = league.divisions || []
                        const logo = getLeagueLogo(league.slug)
                        const leagueColor = league.color || 'var(--color-accent)'
                        const isActive = divisions.some(d => d.seasons?.some(s => s.is_active))
                        const activeDivisions = divisions.filter(d => d.seasons?.some(s => s.is_active))
                        const totalSeasons = divisions.reduce((sum, d) => sum + (d.seasons?.length || 0), 0)

                        return (
                            <div key={league.id} className="rounded-2xl border border-white/10 bg-(--color-secondary)/50 overflow-hidden">
                                {/* League header */}
                                <div className="p-6 sm:p-8">
                                    <div className="flex items-center gap-4 mb-6">
                                        {logo ? (
                                            <img src={logo} alt="" className={`h-14 w-14 object-contain rounded-lg ${!isActive ? 'opacity-40' : ''}`} />
                                        ) : (
                                            <div className={`h-14 w-14 rounded-lg bg-white/5 flex items-center justify-center ${!isActive ? 'opacity-40' : ''}`}>
                                                <Trophy className="w-7 h-7" style={{ color: leagueColor }} />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 flex-wrap">
                                                {isActive ? (
                                                    <Link
                                                        to={`/${league.slug}`}
                                                        className="font-heading text-2xl font-bold text-(--color-text) hover:text-(--color-accent) transition-colors"
                                                    >
                                                        {league.name}
                                                    </Link>
                                                ) : (
                                                    <h3 className="font-heading text-2xl font-bold text-(--color-text)/40">
                                                        {league.name}
                                                    </h3>
                                                )}
                                                {isActive ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider" style={{ backgroundColor: `${leagueColor}15`, color: leagueColor, border: `1px solid ${leagueColor}25` }}>
                                                        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: leagueColor }} />
                                                        Live
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider" style={{ backgroundColor: `${leagueColor}10`, color: `${leagueColor}90`, border: `1px solid ${leagueColor}15` }}>
                                                        Not Tracked
                                                    </span>
                                                )}
                                            </div>
                                            {league.description && league.description !== league.name && (
                                                <p className={`text-sm mt-1 ${isActive ? 'text-(--color-text-secondary)' : 'text-(--color-text-secondary)/40'}`}>
                                                    {league.description}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {league.discord_url && (
                                                <a
                                                    href={league.discord_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors ${isActive ? 'bg-[#5865F2] hover:bg-[#4752C4]' : 'bg-[#5865F2]/50 hover:bg-[#5865F2]/70'}`}
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    <MessageCircle className="w-3.5 h-3.5" />
                                                    <span className="hidden sm:inline">Discord</span>
                                                </a>
                                            )}
                                            {isActive && (
                                                <Link
                                                    to={`/${league.slug}`}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-(--color-text-secondary) hover:text-(--color-text) border border-white/10 hover:border-white/20 transition-colors"
                                                >
                                                    View League
                                                    <ChevronRight className="w-3.5 h-3.5" />
                                                </Link>
                                            )}
                                        </div>
                                    </div>

                                    {/* Quick stats */}
                                    <div className="flex items-center gap-6 text-sm text-(--color-text-secondary) mb-6">
                                        <span className="flex items-center gap-1.5">
                                            <Users className="w-4 h-4" />
                                            {divisions.length} {divisions.length === 1 ? 'Division' : 'Divisions'}
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <Calendar className="w-4 h-4" />
                                            {totalSeasons} {totalSeasons === 1 ? 'Season' : 'Seasons'}
                                        </span>
                                        {activeDivisions.length > 0 && (
                                            <span className="flex items-center gap-1.5" style={{ color: leagueColor }}>
                                                <Trophy className="w-4 h-4" />
                                                {activeDivisions.length} Active
                                            </span>
                                        )}
                                    </div>

                                    {/* Division cards */}
                                    {divisions.length > 0 && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {divisions.map(division => {
                                                const rankImg = getDivisionImage(league.slug, division.slug, division.tier)
                                                const rankLabel = RANK_LABELS[division.tier]
                                                const activeSeason = division.seasons?.find(s => s.is_active)
                                                const divActive = !!activeSeason

                                                if (divActive) {
                                                    return (
                                                        <Link
                                                            key={division.id}
                                                            to={`/${league.slug}/${division.slug}`}
                                                            className="group relative overflow-hidden rounded-xl border border-white/10 hover:border-white/20 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
                                                            style={{ background: 'linear-gradient(135deg, var(--color-secondary), var(--color-primary))' }}
                                                        >
                                                            <div
                                                                className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                style={{ background: `linear-gradient(90deg, transparent, ${leagueColor}, transparent)` }}
                                                            />
                                                            <div className="p-4">
                                                                <div className="flex items-center gap-3">
                                                                    {rankImg && (
                                                                        <img src={rankImg} alt={rankLabel} className="h-9 w-9 object-contain" />
                                                                    )}
                                                                    <div className="flex-1 min-w-0">
                                                                        <h4 className="font-heading text-base font-bold text-(--color-text) group-hover:text-(--color-accent) transition-colors truncate">
                                                                            {division.name}
                                                                        </h4>
                                                                        <div className="flex items-center gap-2">
                                                                            {rankLabel && (
                                                                                <span className="text-xs text-(--color-text-secondary) uppercase tracking-wider">
                                                                                    {rankLabel}
                                                                                </span>
                                                                            )}
                                                                            {activeSeason && (
                                                                                <span className="text-xs text-(--color-text-secondary)/60">
                                                                                    {activeSeason.name}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <ChevronRight className="w-4 h-4 text-(--color-text-secondary) group-hover:text-(--color-accent) transition-colors shrink-0" />
                                                                </div>
                                                            </div>
                                                        </Link>
                                                    )
                                                }

                                                return (
                                                    <div
                                                        key={division.id}
                                                        className="rounded-xl border border-white/5 bg-(--color-secondary)/50 p-4 opacity-40"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            {rankImg && (
                                                                <img src={rankImg} alt={rankLabel} className="h-9 w-9 object-contain" />
                                                            )}
                                                            <div className="flex-1 min-w-0">
                                                                <h4 className="font-heading text-base font-bold text-(--color-text) truncate">
                                                                    {division.name}
                                                                </h4>
                                                                <span className="text-xs text-(--color-text-secondary) italic">No active season</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}

                    {mainLeagues.length === 0 && (
                        <div className="text-center py-16">
                            <Trophy className="w-12 h-12 text-(--color-text-secondary)/30 mx-auto mb-4" />
                            <p className="text-(--color-text-secondary)">No leagues found.</p>
                        </div>
                    )}
                </div>
            </section>
        </div>
    )
}

export default LeaguesBrowse

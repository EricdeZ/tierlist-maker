// src/pages/OrgPage.jsx
import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { orgService } from '../services/database'
import PageTitle from '../components/PageTitle'
import TeamLogo from '../components/TeamLogo'
import Navbar from '../components/layout/Navbar'
import { Users, Trophy, ChevronRight } from 'lucide-react'

const OrgPage = () => {
    const { orgSlug } = useParams()
    const [org, setOrg] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!orgSlug) return
        let cancelled = false
        const fetch = async () => {
            setLoading(true)
            setError(null)
            try {
                const data = await orgService.getBySlug(orgSlug)
                if (!cancelled) setOrg(data)
            } catch (err) {
                if (!cancelled) setError(err.message)
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        fetch()
        return () => { cancelled = true }
    }, [orgSlug])

    if (loading) {
        return (
            <>
                <Navbar />
                <div className="flex items-center justify-center p-20 pt-32">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-2 border-t-transparent border-white/20 mx-auto mb-4" />
                        <p className="text-(--color-text-secondary)/50 text-sm">Loading organization...</p>
                    </div>
                </div>
            </>
        )
    }

    if (error || !org) {
        return (
            <>
                <Navbar />
                <div className="max-w-3xl mx-auto py-16 pt-32 px-4 text-center">
                    <h2 className="text-2xl font-bold text-(--color-text) mb-4">Organization Not Found</h2>
                    <p className="text-(--color-text-secondary) mb-4">{error || 'This organization does not exist.'}</p>
                    <Link to="/" className="text-(--color-accent) hover:underline">Back to Home</Link>
                </div>
            </>
        )
    }

    const orgColor = org.color || 'var(--color-accent)'
    const winRate = org.overallWinRate?.toFixed(1) || '0.0'

    return (
        <div>
            <Navbar title={org.name} />
            <div className="pt-24">
            {org && <PageTitle title={org.name} description={`${org.name} organization — ${org.teams?.length || 0} teams across multiple leagues and seasons.`} />}

            <style>{`
                @keyframes orgSlideUp {
                    from { opacity: 0; transform: translateY(16px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>

            {/* Hero Banner */}
            <div className="relative overflow-hidden border-b border-white/10">
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${orgColor}20, transparent 60%)` }}
                />
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: `radial-gradient(ellipse 60% 50% at 80% 80%, ${orgColor}10, transparent 50%)` }}
                />
                <div
                    className="absolute bottom-0 left-0 right-0 h-px"
                    style={{ background: `linear-gradient(90deg, transparent, ${orgColor}40, transparent)` }}
                />

                <div
                    className="relative z-10 max-w-5xl mx-auto px-4 py-12 sm:py-16"
                    style={{ animation: 'orgSlideUp 0.5s ease-out' }}
                >
                    <div className="flex items-center gap-5">
                        {/* Org logo — single team logo */}
                        <div className="shrink-0">
                            <TeamLogo slug={org.slug} name={org.name} size={80} className="sm:!w-24 sm:!h-24" color={org.color} />
                        </div>

                        <div>
                            <h1 className="font-heading text-3xl sm:text-4xl font-black text-(--color-text) mb-1">
                                {org.name}
                            </h1>
                            <div className="flex flex-wrap items-center gap-3 mt-2">
                                <div
                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider"
                                    style={{ backgroundColor: `${orgColor}12`, border: `1px solid ${orgColor}25`, color: orgColor }}
                                >
                                    <Users className="w-3 h-3" />
                                    {org.teams?.length || 0} Teams
                                </div>
                                {org.totalGames > 0 && (
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-white/5 border border-white/10 text-(--color-text-secondary)">
                                        <Trophy className="w-3 h-3" />
                                        {org.totalWins}W – {org.totalGames - org.totalWins}L
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-5xl mx-auto px-4 py-8">
                {/* Overall stats */}
                {org.totalGames > 0 && (
                    <div className="grid grid-cols-3 gap-4 mb-8">
                        <div className="rounded-xl border border-white/10 bg-(--color-secondary) p-5 text-center">
                            <div className="text-2xl sm:text-3xl font-black font-heading" style={{ color: orgColor }}>
                                {winRate}%
                            </div>
                            <div className="text-xs text-(--color-text-secondary) uppercase tracking-wider mt-1">Win Rate</div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-(--color-secondary) p-5 text-center">
                            <div className="text-2xl sm:text-3xl font-black font-heading text-green-400">
                                {org.totalWins}
                            </div>
                            <div className="text-xs text-(--color-text-secondary) uppercase tracking-wider mt-1">Total Wins</div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-(--color-secondary) p-5 text-center">
                            <div className="text-2xl sm:text-3xl font-black font-heading text-(--color-text)">
                                {org.totalGames}
                            </div>
                            <div className="text-xs text-(--color-text-secondary) uppercase tracking-wider mt-1">Matches Played</div>
                        </div>
                    </div>
                )}

                {/* Teams list */}
                <h2 className="font-heading text-xl font-bold text-(--color-text) mb-4">Teams</h2>
                {(!org.teams || org.teams.length === 0) ? (
                    <div className="rounded-xl border border-white/10 bg-(--color-secondary) p-8 text-center">
                        <p className="text-(--color-text-secondary)">No teams in this organization yet.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {org.teams.map(team => {
                            const gp = Number(team.games_played) || 0
                            const w = Number(team.wins) || 0
                            const l = Number(team.losses) || 0
                            const wr = gp > 0 ? (w / gp * 100).toFixed(1) : null
                            const teamPath = `/${team.league_slug}/${team.division_slug}/teams/${team.slug}`

                            return (
                                <Link
                                    key={team.id}
                                    to={teamPath}
                                    className="group flex items-center gap-4 rounded-xl border border-white/10 bg-(--color-secondary) p-4 hover:border-white/20 transition-all duration-200"
                                >
                                    {/* Team logo */}
                                    <TeamLogo slug={team.slug} name={team.name} size={40} color={team.color} />

                                    {/* Color bar */}
                                    <div
                                        className="w-1 h-10 rounded-full shrink-0"
                                        style={{ backgroundColor: team.color }}
                                    />

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="font-heading text-sm sm:text-base font-bold text-(--color-text) group-hover:text-(--color-accent) transition-colors truncate">
                                            {team.name}
                                        </div>
                                        <div className="text-xs text-(--color-text-secondary) truncate">
                                            {team.league_name} · {team.division_name} · {team.season_name}
                                        </div>
                                    </div>

                                    {/* Win/Loss */}
                                    {gp > 0 && (
                                        <div className="shrink-0 text-right hidden sm:block">
                                            <div className="text-sm font-bold font-heading text-(--color-text)">
                                                <span className="text-green-400">{w}</span>
                                                <span className="text-(--color-text-secondary) mx-1">–</span>
                                                <span className="text-red-400">{l}</span>
                                            </div>
                                            <div className={`text-xs font-semibold ${
                                                wr >= 60 ? 'text-green-400' : wr >= 45 ? 'text-yellow-400' : 'text-red-400'
                                            }`}>
                                                {wr}%
                                            </div>
                                        </div>
                                    )}

                                    <ChevronRight className="w-4 h-4 text-(--color-text-secondary) group-hover:text-(--color-accent) transition-all group-hover:translate-x-0.5 shrink-0" />
                                </Link>
                            )
                        })}
                    </div>
                )}
            </div>
            </div>{/* end pt-24 */}
        </div>
    )
}

export default OrgPage

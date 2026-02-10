// src/pages/division/DivisionOverview.jsx
import { Link, useParams } from 'react-router-dom'
import { useDivision } from '../../context/DivisionContext'
import { useAuth } from '../../context/AuthContext'
import { useState, useEffect } from 'react'
import { statsService } from '../../services/database'
import { Trophy, Calendar, BarChart3, ChevronRight, MessageCircle, Users, User } from 'lucide-react'

import aglLogo from '../../assets/leagues/agl.png'
import babylonLogo from '../../assets/leagues/babylon.png'
import oslLogo from '../../assets/leagues/osl.png'

import deityImg from '../../assets/ranks/deity.png'
import demigodImg from '../../assets/ranks/demigod.png'
import masterImg from '../../assets/ranks/master.png'
import obsidianImg from '../../assets/ranks/obsidian.png'
import diamondImg from '../../assets/ranks/diamond.png'

const LEAGUE_LOGOS = {
    'agl': aglLogo,
    'albion-giants-league': aglLogo,
    'bsl': babylonLogo,
    'babylon-smite-league': babylonLogo,
    'osl': oslLogo,
    'olympian-smite-league': oslLogo,
}

const RANK_IMAGES = {
    1: deityImg,
    2: demigodImg,
    3: masterImg,
    4: obsidianImg,
    5: diamondImg,
}

const DivisionOverview = () => {
    const { leagueSlug, divisionSlug } = useParams()
    const { league, division, season, teams, players } = useDivision()
    const { user, linkedPlayer, login, loading: authLoading } = useAuth()
    const [seasonStats, setSeasonStats] = useState(null)

    const [statsError, setStatsError] = useState(false)

    useEffect(() => {
        if (!season) return
        statsService.getSeasonStats(season.id)
            .then(setSeasonStats)
            .catch(() => setStatsError(true))
    }, [season])

    const basePath = `/${leagueSlug}/${divisionSlug}`
    const rankImg = division?.tier ? RANK_IMAGES[division.tier] : null
    const leagueLogo = league?.slug ? LEAGUE_LOGOS[league.slug] : null
    const leagueColor = league?.color || 'var(--color-accent)'

    const formatNumber = (num) => new Intl.NumberFormat().format(Math.round(num))

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            {/* ─── Hero Banner ─── */}
            <div className="relative overflow-hidden rounded-2xl border border-white/10 mb-10">
                {/* Background glow */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background: `radial-gradient(ellipse at 30% 50%, ${leagueColor}15, transparent 60%), radial-gradient(ellipse at 70% 0%, ${leagueColor}08, transparent 50%)`,
                    }}
                />
                <div
                    className="absolute bottom-0 left-0 right-0 h-px"
                    style={{ background: `linear-gradient(90deg, transparent, ${leagueColor}40, transparent)` }}
                />

                <div className="relative z-10 p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
                    {/* League logo */}
                    {leagueLogo ? (
                        <img
                            src={leagueLogo}
                            alt=""
                            className="h-20 w-20 sm:h-24 sm:w-24 object-contain rounded-2xl border border-white/10 bg-(--color-secondary) p-3 shrink-0"
                        />
                    ) : (
                        <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl bg-(--color-secondary) border border-white/10 flex items-center justify-center shrink-0">
                            <Trophy className="w-10 h-10" style={{ color: leagueColor }} />
                        </div>
                    )}

                    {/* Division info */}
                    <div className="flex-1 text-center sm:text-left">
                        <p className="text-sm text-(--color-text-secondary) uppercase tracking-wider mb-1">
                            {league?.name}
                        </p>
                        <div className="flex items-center justify-center sm:justify-start gap-3 mb-2">
                            {rankImg && (
                                <img src={rankImg} alt="" className="h-10 w-10 object-contain" />
                            )}
                            <h1 className="font-heading text-3xl sm:text-4xl font-black text-(--color-text)">
                                {division?.name}
                            </h1>
                        </div>
                        {season && (
                            <p className="text-(--color-text-secondary) text-sm">
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                                    {season.name}
                                </span>
                            </p>
                        )}
                    </div>

                    {/* Discord CTA */}
                    {league?.discord_url && (
                        <a
                            href={league.discord_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#5865F2] hover:bg-[#4752C4] transition-colors shrink-0"
                        >
                            <MessageCircle className="w-4 h-4" />
                            Join Discord
                        </a>
                    )}
                </div>
            </div>

            {/* ─── Quick Stats ─── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
                {[
                    { label: 'Teams',          value: teams?.length || 0, link: `${basePath}/teams` },
                    { label: 'Players',        value: players?.length || 0, link: `${basePath}/stats` },
                    { label: 'Matches Played', value: statsError ? '—' : (seasonStats?.total_matches ?? '—'), link: `${basePath}/matches` },
                    { label: 'Total Kills',    value: statsError ? '—' : (seasonStats?.total_kills ? formatNumber(seasonStats.total_kills) : '—'), link: `${basePath}/stats` },
                ].map(stat => (
                    <Link
                        key={stat.label}
                        to={stat.link}
                        className="bg-(--color-secondary) rounded-xl border border-white/10 p-5 text-center group hover:border-white/20 transition-all duration-200"
                        style={{ '--hover-color': leagueColor }}
                    >
                        <div className="text-3xl font-bold text-(--color-text) font-heading group-hover:text-(--color-accent) transition-colors">
                            {stat.value}
                        </div>
                        <div className="text-sm text-(--color-text-secondary)">{stat.label}</div>
                    </Link>
                ))}
            </div>

            {/* ─── Feature Banners ─── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                <Link
                    to={`${basePath}/standings`}
                    className="group relative overflow-hidden rounded-xl border border-white/10 bg-(--color-secondary) p-6 hover:border-white/20 transition-all duration-300 hover:-translate-y-0.5"
                >
                    <Trophy className="w-8 h-8 mb-3" style={{ color: leagueColor }} />
                    <h3 className="font-heading text-xl font-bold text-(--color-text) mb-2 group-hover:text-(--color-accent) transition-colors">
                        Standings
                    </h3>
                    <p className="text-sm text-(--color-text-secondary)">
                        View the current division standings and team records.
                    </p>
                    <ChevronRight className="absolute top-6 right-5 w-5 h-5 text-(--color-text-secondary) group-hover:text-(--color-accent) transition-all group-hover:translate-x-1" />
                </Link>

                <Link
                    to={`${basePath}/matches`}
                    className="group relative overflow-hidden rounded-xl border border-white/10 bg-(--color-secondary) p-6 hover:border-white/20 transition-all duration-300 hover:-translate-y-0.5"
                >
                    <Calendar className="w-8 h-8 mb-3" style={{ color: leagueColor }} />
                    <h3 className="font-heading text-xl font-bold text-(--color-text) mb-2 group-hover:text-(--color-accent) transition-colors">
                        Schedule & Results
                    </h3>
                    <p className="text-sm text-(--color-text-secondary)">
                        Upcoming matches and past results for the current season.
                    </p>
                    <ChevronRight className="absolute top-6 right-5 w-5 h-5 text-(--color-text-secondary) group-hover:text-(--color-accent) transition-all group-hover:translate-x-1" />
                </Link>

                <Link
                    to={`${basePath}/stats`}
                    className="group relative overflow-hidden rounded-xl border border-white/10 bg-(--color-secondary) p-6 hover:border-white/20 transition-all duration-300 hover:-translate-y-0.5"
                >
                    <BarChart3 className="w-8 h-8 mb-3" style={{ color: leagueColor }} />
                    <h3 className="font-heading text-xl font-bold text-(--color-text) mb-2 group-hover:text-(--color-accent) transition-colors">
                        Player Stats
                    </h3>
                    <p className="text-sm text-(--color-text-secondary)">
                        Full player statistics with KDA, win rates, damage, and more.
                    </p>
                    <ChevronRight className="absolute top-6 right-5 w-5 h-5 text-(--color-text-secondary) group-hover:text-(--color-accent) transition-all group-hover:translate-x-1" />
                </Link>

                <Link
                    to={`${basePath}/rankings`}
                    className="group relative overflow-hidden rounded-xl border border-white/10 p-6 transition-all duration-300 hover:-translate-y-0.5"
                    style={{
                        background: `linear-gradient(135deg, var(--color-secondary), ${leagueColor}08)`,
                        borderColor: `${leagueColor}30`,
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = `${leagueColor}60`}
                    onMouseLeave={e => e.currentTarget.style.borderColor = `${leagueColor}30`}
                >
                    <div className="text-3xl mb-3">⚔️</div>
                    <h3 className="font-heading text-xl font-bold mb-2" style={{ color: leagueColor }}>
                        Create Tierlist
                    </h3>
                    <p className="text-sm text-(--color-text-secondary)">
                        Rank players by role with drag-and-drop. Save and share your picks.
                    </p>
                    <ChevronRight className="absolute top-6 right-5 w-5 h-5 transition-all group-hover:translate-x-1" style={{ color: leagueColor }} />
                </Link>
            </div>

            {/* ─── Teams Preview ─── */}
            {teams && teams.length > 0 && (
                <div className="mb-10">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-heading text-xl font-bold text-(--color-text)">Teams</h2>
                        <Link to={`${basePath}/teams`} className="inline-flex items-center gap-1 text-sm font-medium hover:underline transition-colors" style={{ color: leagueColor }}>
                            View all
                            <ChevronRight className="w-4 h-4" />
                        </Link>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {teams.map(team => {
                            const playerCount = players?.filter(p => p.team_id === team.id).length || 0
                            return (
                                <Link
                                    key={team.id}
                                    to={`${basePath}/teams/${team.slug}`}
                                    className="group flex items-stretch rounded-lg border border-white/10 bg-(--color-secondary) overflow-hidden hover:border-white/20 transition-all duration-200"
                                >
                                    {/* Color bar */}
                                    <div
                                        className="w-1 shrink-0 group-hover:w-1.5 transition-all duration-200"
                                        style={{ backgroundColor: team.color }}
                                    />
                                    {/* Content */}
                                    <div className="flex items-center gap-3 px-4 py-3 flex-1 min-w-0">
                                        <div className="flex-1 min-w-0">
                                            <div className="font-heading text-sm font-bold text-(--color-text) group-hover:text-(--color-accent) transition-colors truncate">
                                                {team.name}
                                            </div>
                                            <div className="flex items-center gap-1 text-xs text-(--color-text-secondary)">
                                                <Users className="w-3 h-3" />
                                                {playerCount} player{playerCount !== 1 ? 's' : ''}
                                            </div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-(--color-text-secondary) group-hover:text-(--color-accent) transition-all group-hover:translate-x-0.5 shrink-0" />
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* ─── Claim Profile Banner ─── */}
            {!authLoading && !linkedPlayer && (
                <div className="mb-10 rounded-xl border border-[#5865F2]/20 bg-[#5865F2]/5 p-5 flex flex-col sm:flex-row items-center gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-[#5865F2]/20 flex items-center justify-center shrink-0">
                            <User className="w-5 h-5 text-[#5865F2]" />
                        </div>
                        <p className="text-sm text-(--color-text-secondary)">
                            <strong className="text-(--color-text)">Playing in this division?</strong>{' '}
                            Claim your player profile to track your stats and match history.
                        </p>
                    </div>
                    {!user ? (
                        <button
                            onClick={login}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-semibold transition-colors shrink-0"
                        >
                            Login with Discord
                        </button>
                    ) : (
                        <button
                            onClick={() => window.dispatchEvent(new CustomEvent('open-claim-modal'))}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-semibold transition-colors shrink-0"
                        >
                            Claim Your Profile
                        </button>
                    )}
                </div>
            )}

            {/* ─── Footer: Discord link ─── */}
            {league?.discord_url && (
                <div className="text-center pt-4 border-t border-white/5">
                    <a
                        href={league.discord_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-(--color-text-secondary) hover:text-[#5865F2] transition-colors"
                    >
                        <MessageCircle className="w-4 h-4" />
                        Join the {league.name} Discord
                    </a>
                </div>
            )}
        </div>
    )
}

export default DivisionOverview

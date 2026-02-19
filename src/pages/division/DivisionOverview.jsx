// src/pages/division/DivisionOverview.jsx
import { Link, useParams } from 'react-router-dom'
import { useDivision } from '../../context/DivisionContext'
import { useAuth } from '../../context/AuthContext'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { statsService } from '../../services/database'
import { Trophy, Calendar, BarChart3, ChevronRight, ChevronLeft, MessageCircle, Users, User } from 'lucide-react'
import PageTitle from '../../components/PageTitle'
import BannedContentBanner from '../../components/BannedContentBanner'
import ChallengeBanner from '../../components/ChallengeBanner'

import aglLogo from '../../assets/leagues/agl.png'
import babylonLogo from '../../assets/leagues/babylon.png'
import oslLogo from '../../assets/leagues/osl.png'

import { getDivisionImage } from '../../utils/divisionImages'
import TeamLogo from '../../components/TeamLogo'

const LEAGUE_LOGOS = {
    'agl': aglLogo,
    'albion-giants-league': aglLogo,
    'bsl': babylonLogo,
    'babylon-smite-league': babylonLogo,
    'osl': oslLogo,
    'olympian-smite-league': oslLogo,
}

/* ─── Player Stats Ticker ─── */
const PlayerTicker = ({ players, allPlayers, leagueColor, basePath }) => {
    if (!players || players.length === 0) return null

    // Build ticker items from player data (DB returns strings)
    const items = players.map(p => {
        const k = Number(p.avg_kills) || 0
        const d = Number(p.avg_deaths) || 0
        const a = Number(p.avg_assists) || 0
        const kda = d > 0 ? ((k + a / 2) / d).toFixed(1) : (k + a / 2).toFixed(1)
        const playerInfo = allPlayers?.find(pl => pl.id === p.id)
        return { name: p.name, slug: playerInfo?.slug, team: p.team_name, kda, kills: k.toFixed(1), deaths: d.toFixed(1), assists: a.toFixed(1) }
    })

    // Duplicate for seamless loop
    const track = [...items, ...items]

    return (
        <div className="relative overflow-hidden py-2.5 font-mono" style={{ maskImage: 'linear-gradient(90deg, transparent, black 3%, black 97%, transparent)' }}>
            <div className="flex gap-8 animate-[ticker_60s_linear_infinite] w-max hover:[animation-play-state:paused]">
                {track.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 shrink-0 text-[11px] tracking-wide uppercase">
                        {p.slug ? (
                            <Link to={`${basePath}/players/${p.slug}`} className="font-bold text-(--color-text) hover:text-(--color-accent) transition-colors">
                                {p.name}
                            </Link>
                        ) : (
                            <span className="font-bold text-(--color-text)">{p.name}</span>
                        )}
                        <span className="text-(--color-text-secondary)/50 text-[10px]">{p.team}</span>
                        <span className="font-bold tabular-nums" style={{ color: leagueColor }}>{p.kda}</span>
                        <span className="text-(--color-text-secondary)/30 tabular-nums">
                            {p.kills}/{p.deaths}/{p.assists}
                        </span>
                        <span className="text-(--color-text-secondary)/15 mx-1">|</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

const DivisionOverview = () => {
    const { leagueSlug, divisionSlug } = useParams()
    const { league, division, season, teams, players } = useDivision()
    const { user, linkedPlayer, login, loading: authLoading } = useAuth()
    const [seasonStats, setSeasonStats] = useState(null)
    const [playerStats, setPlayerStats] = useState(null)
    const [statsError, setStatsError] = useState(false)

    // Mouse-tracking hero gradient
    const heroRef = useRef(null)
    const [heroLight, setHeroLight] = useState({ x: 50, y: 50, active: false })

    const handleHeroMove = useCallback((e) => {
        const el = heroRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        setHeroLight({
            x: ((e.clientX - rect.left) / rect.width) * 100,
            y: ((e.clientY - rect.top) / rect.height) * 100,
            active: true,
        })
    }, [])

    const handleHeroLeave = useCallback(() => {
        setHeroLight(prev => ({ ...prev, active: false }))
    }, [])

    useEffect(() => {
        if (!season) return
        statsService.getSeasonStats(season.id)
            .then(setSeasonStats)
            .catch(() => setStatsError(true))
        statsService.getPlayerStats(season.id)
            .then(setPlayerStats)
            .catch(() => {})
    }, [season])

    const basePath = `/${leagueSlug}/${divisionSlug}`
    const rankImg = getDivisionImage(leagueSlug, divisionSlug, division?.tier)
    const leagueLogo = league?.slug ? LEAGUE_LOGOS[league.slug] : null
    const leagueColor = league?.color || 'var(--color-accent)'

    const formatNumber = (num) => new Intl.NumberFormat().format(Math.round(num))

    // Top players for the ticker (sorted by KDA, need at least 1 game)
    const tickerPlayers = useMemo(() => {
        if (!playerStats) return []
        return [...playerStats]
            .filter(p => p.games_played > 0)
            .sort((a, b) => {
                const kA = Number(a.avg_kills) || 0, dA = Number(a.avg_deaths) || 0, aA = Number(a.avg_assists) || 0
                const kB = Number(b.avg_kills) || 0, dB = Number(b.avg_deaths) || 0, aB = Number(b.avg_assists) || 0
                const kdaA = dA > 0 ? (kA + aA / 2) / dA : kA + aA / 2
                const kdaB = dB > 0 ? (kB + aB / 2) / dB : kB + aB / 2
                return kdaB - kdaA
            })
            .slice(0, 20)
    }, [playerStats])

    return (
        <div>
            {division && <PageTitle title={`${division.name} - ${league?.name || ''}`} description={`${division.name} division of ${league?.name || 'SMITE 2 league'}${season ? ` – ${season.name}` : ''}. Live standings, match results, player stats, and rankings.`} />}

            {/* Keyframe animations */}
            <style>{`
                @keyframes divGradientDrift {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    33% { transform: translate(2%, -1%) scale(1.01); }
                    66% { transform: translate(-1%, 1.5%) scale(0.99); }
                }
                @keyframes divGradientDrift2 {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    33% { transform: translate(-2%, 1%) scale(1.02); }
                    66% { transform: translate(1.5%, -1%) scale(0.98); }
                }
                @keyframes ticker {
                    from { transform: translateX(0); }
                    to { transform: translateX(-50%); }
                }
                @keyframes heroSlideUp {
                    from { opacity: 0; transform: translateY(16px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* ─── Hero Banner ─── Full-width, immersive                 */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <div
                ref={heroRef}
                onMouseMove={handleHeroMove}
                onMouseLeave={handleHeroLeave}
                className="relative overflow-hidden border-b border-white/10"
            >
                {/* BG Layer 1: Animated gradient blobs — GPU composited via transform */}
                <div
                    className="absolute inset-[-20%] pointer-events-none will-change-transform"
                    style={{
                        background: `radial-gradient(ellipse 80% 50% at 30% 30%, ${leagueColor}20, transparent 60%), radial-gradient(ellipse 60% 40% at 75% 70%, ${leagueColor}15, transparent 55%)`,
                        animation: 'divGradientDrift 20s ease-in-out infinite',
                    }}
                />
                <div
                    className="absolute inset-[-20%] pointer-events-none will-change-transform"
                    style={{
                        background: `radial-gradient(ellipse 70% 45% at 65% 20%, ${leagueColor}12, transparent 55%), radial-gradient(ellipse 50% 35% at 20% 80%, ${leagueColor}10, transparent 50%)`,
                        animation: 'divGradientDrift2 25s ease-in-out infinite',
                    }}
                />

                {/* BG Layer 2: Static shimmer */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background: `linear-gradient(135deg, transparent 20%, ${leagueColor}0a 40%, transparent 55%, ${leagueColor}06 75%, transparent 90%)`,
                    }}
                />

                {/* BG Layer 3: Mouse-tracking glow */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background: `radial-gradient(500px circle at ${heroLight.x}% ${heroLight.y}%, ${leagueColor}25, transparent 60%)`,
                        opacity: heroLight.active ? 1 : 0,
                        transition: 'opacity 0.5s ease, background 0.15s ease',
                    }}
                />

                {/* BG Layer 4: Subtle grid */}
                <div
                    className="absolute inset-0 opacity-[0.025] pointer-events-none"
                    style={{
                        backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
                        backgroundSize: '60px 60px',
                    }}
                />

                {/* Bottom edge glow */}
                <div
                    className="absolute bottom-0 left-0 right-0 h-px"
                    style={{ background: `linear-gradient(90deg, transparent, ${leagueColor}40, transparent)` }}
                />

                {/* Hero content */}
                <div
                    className="relative z-10 py-12 sm:py-16 px-6 sm:px-10 flex flex-col items-center text-center"
                    style={{ animation: 'heroSlideUp 0.5s ease-out' }}
                >
                    {/* Back to league */}
                    <Link
                        to={`/${leagueSlug}`}
                        className="inline-flex items-center gap-1 text-sm text-(--color-text-secondary) uppercase tracking-wider mb-6 hover:text-(--color-accent) transition-colors group/league"
                    >
                        <ChevronLeft className="w-3.5 h-3.5 opacity-0 -ml-4 group-hover/league:opacity-100 group-hover/league:ml-0 transition-all duration-200" />
                        {league?.name}
                    </Link>

                    {/* Logo + division name cluster */}
                    <div className="flex items-center gap-5 mb-4">
                        {leagueLogo ? (
                            <img
                                src={leagueLogo}
                                alt=""
                                className="h-20 w-20 sm:h-28 sm:w-28 object-contain shrink-0"
                                style={{ filter: `drop-shadow(0 0 20px ${leagueColor}30)` }}
                            />
                        ) : (
                            <div
                                className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl border border-white/10 flex items-center justify-center shrink-0"
                                style={{ background: `linear-gradient(135deg, ${leagueColor}15, ${leagueColor}05)` }}
                            >
                                <Trophy className="w-10 h-10" style={{ color: leagueColor }} />
                            </div>
                        )}
                        <div className="text-left">
                            <div className="flex items-center gap-3 mb-1">
                                {rankImg && (
                                    <img src={rankImg} alt="" className="h-10 w-10 sm:h-12 sm:w-12 object-contain" />
                                )}
                                <h1 className="font-heading text-4xl sm:text-5xl font-black text-(--color-text)">
                                    {division?.name}
                                </h1>
                            </div>
                            {season && (
                                <p className="text-(--color-text-secondary) text-sm sm:text-base">
                                    <span className="inline-flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                        {season.name}
                                    </span>
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Quick badges + CTA */}
                    <div className="flex flex-wrap items-center gap-3 justify-center mt-4">
                        {teams && (
                            <div
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider"
                                style={{ backgroundColor: `${leagueColor}12`, border: `1px solid ${leagueColor}25`, color: leagueColor }}
                            >
                                <Users className="w-3 h-3" />
                                {teams.length} Teams
                            </div>
                        )}
                        {players && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-white/5 border border-white/10 text-(--color-text-secondary)">
                                {players.length} Players
                            </div>
                        )}
                        {league?.discord_url && (
                            <a
                                href={league.discord_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold text-white bg-[#5865F2] hover:bg-[#4752C4] transition-colors"
                            >
                                <MessageCircle className="w-3.5 h-3.5" />
                                Join Discord
                            </a>
                        )}
                    </div>
                </div>
            </div>

            {/* ─── Player Stats Ticker ─── Full-width stock ticker */}
            {tickerPlayers.length > 0 && (
                <div className="border-b border-white/5 bg-black/30 backdrop-blur-sm">
                    <PlayerTicker players={tickerPlayers} allPlayers={players} leagueColor={leagueColor} basePath={basePath} />
                </div>
            )}

            {/* ─── Constrained content below hero ─── */}
            <div className="max-w-6xl mx-auto px-4 pt-10">

            {/* ─── Player Stats Hero Card ─── */}
            <Link
                to={`${basePath}/stats`}
                className="group relative overflow-hidden rounded-2xl border border-white/10 mb-6 block transition-all duration-300 hover:-translate-y-0.5"
                style={{
                    background: `linear-gradient(135deg, var(--color-secondary), ${leagueColor}12)`,
                    borderColor: `${leagueColor}25`,
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = `${leagueColor}50`}
                onMouseLeave={e => e.currentTarget.style.borderColor = `${leagueColor}25`}
            >
                {/* Decorative background elements */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background: `radial-gradient(ellipse at 80% 20%, ${leagueColor}10, transparent 50%), radial-gradient(ellipse at 20% 80%, ${leagueColor}06, transparent 40%)`,
                    }}
                />
                <div className="absolute top-0 right-0 w-48 h-48 pointer-events-none opacity-[0.03]">
                    <BarChart3 className="w-full h-full" />
                </div>

                <div className="relative z-10 p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
                    {/* Icon cluster */}
                    <div className="shrink-0 flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl" style={{ background: `${leagueColor}15` }}>
                        <BarChart3 className="w-8 h-8 sm:w-10 sm:h-10" style={{ color: leagueColor }} />
                    </div>

                    {/* Text content */}
                    <div className="flex-1 text-center sm:text-left">
                        <h3 className="font-heading text-2xl sm:text-3xl font-black text-(--color-text) mb-1 group-hover:text-(--color-accent) transition-colors">
                            Player Stats
                        </h3>
                        <p className="text-(--color-text-secondary) text-sm sm:text-base max-w-lg">
                            Dive into full player statistics — KDA, win rates, damage output, and more. Compare players and find the top performers.
                        </p>
                    </div>

                    {/* Mini stat previews */}
                    <div className="hidden lg:flex items-center gap-4 shrink-0">
                        {[
                            { label: 'Players', value: players?.length || 0 },
                            { label: 'Total Kills', value: statsError ? '—' : (seasonStats?.total_kills ? formatNumber(seasonStats.total_kills) : '—') },
                        ].map(s => (
                            <div key={s.label} className="text-center px-4 py-2 rounded-lg bg-black/20 border border-white/5">
                                <div className="text-xl font-bold font-heading" style={{ color: leagueColor }}>{s.value}</div>
                                <div className="text-xs text-(--color-text-secondary)">{s.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Arrow */}
                    <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-white/5 group-hover:bg-white/10 transition-all">
                        <ChevronRight className="w-5 h-5 text-(--color-text-secondary) group-hover:text-(--color-accent) transition-all group-hover:translate-x-0.5" />
                    </div>
                </div>
            </Link>

            {/* ─── Feature Cards ─── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
                <Link
                    to={`${basePath}/matches`}
                    className="group relative overflow-hidden rounded-xl border border-white/10 bg-(--color-secondary) p-5 hover:border-white/20 transition-all duration-300 hover:-translate-y-0.5"
                >
                    <Calendar className="w-7 h-7 mb-2.5" style={{ color: leagueColor }} />
                    <h3 className="font-heading text-lg font-bold text-(--color-text) mb-1 group-hover:text-(--color-accent) transition-colors">
                        Matches
                    </h3>
                    <p className="text-xs text-(--color-text-secondary)">
                        Upcoming schedule and past results.
                    </p>
                    <ChevronRight className="absolute top-5 right-4 w-4 h-4 text-(--color-text-secondary) group-hover:text-(--color-accent) transition-all group-hover:translate-x-1" />
                </Link>

                <Link
                    to={`${basePath}/teams`}
                    className="group relative overflow-hidden rounded-xl border border-white/10 bg-(--color-secondary) p-5 hover:border-white/20 transition-all duration-300 hover:-translate-y-0.5"
                >
                    <Users className="w-7 h-7 mb-2.5" style={{ color: leagueColor }} />
                    <h3 className="font-heading text-lg font-bold text-(--color-text) mb-1 group-hover:text-(--color-accent) transition-colors">
                        Teams
                    </h3>
                    <p className="text-xs text-(--color-text-secondary)">
                        Rosters, records, and team profiles.
                    </p>
                    <ChevronRight className="absolute top-5 right-4 w-4 h-4 text-(--color-text-secondary) group-hover:text-(--color-accent) transition-all group-hover:translate-x-1" />
                </Link>

                <Link
                    to={`${basePath}/tierlist`}
                    className="group relative overflow-hidden rounded-xl border border-white/10 p-5 transition-all duration-300 hover:-translate-y-0.5"
                    style={{
                        background: `linear-gradient(135deg, var(--color-secondary), ${leagueColor}08)`,
                        borderColor: `${leagueColor}30`,
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = `${leagueColor}60`}
                    onMouseLeave={e => e.currentTarget.style.borderColor = `${leagueColor}30`}
                >
                    <div className="text-2xl mb-2.5">⚔️</div>
                    <h3 className="font-heading text-lg font-bold mb-1" style={{ color: leagueColor }}>
                        Create Tierlist
                    </h3>
                    <p className="text-xs text-(--color-text-secondary)">
                        Drag-and-drop player rankings.
                    </p>
                    <ChevronRight className="absolute top-5 right-4 w-4 h-4 transition-all group-hover:translate-x-1" style={{ color: leagueColor }} />
                </Link>
            </div>

            {/* ─── Banned Content ─── */}
            {league && (
                <div className="mb-10">
                    <BannedContentBanner leagueId={league.id} accentColor={leagueColor} />
                </div>
            )}

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
                                        <TeamLogo slug={team.slug} name={team.name} size={28} />
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

            {/* ─── Challenge Banner ─── */}
            <div className="mb-10">
                <ChallengeBanner />
            </div>

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
                <div className="text-center pt-4 pb-8 border-t border-white/5">
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
            </div>{/* end constrained content */}
        </div>
    )
}

export default DivisionOverview

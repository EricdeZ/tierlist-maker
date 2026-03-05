// src/pages/division/PlayerProfile.jsx
import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useDivision } from '../../context/DivisionContext'
import { useAuth } from '../../context/AuthContext'
import { statsService, profileService, godService, forgeService } from '../../services/database'
import PageTitle from '../../components/PageTitle'
import RankBadge from '../../components/RankBadge'
import { getRank, formatRank } from '../../config/ranks'
import { getTierColor } from '../../config/challengeTiers'
import { getDivisionImage } from '../../utils/divisionImages'
import { getLeagueLogo } from '../../utils/leagueImages'
import { UserCheck, User, ExternalLink, ArrowLeft, Flame } from 'lucide-react'
import TeamLogo from '../../components/TeamLogo'
import GodpoolTierListDisplay from '../../components/GodpoolTierListDisplay'
import passionCoin from '../../assets/passion/passion.png'
import sparkIcon from '../../assets/spark.png'
import forgeLogo from '../../assets/forge.png'
import { drawSparkline } from '../forge/forgeCanvas'
import { getHeatTier, SPARK_COLORS, FALLBACK_HISTORY } from '../forge/forgeConstants'
import '../forge/forge.css'
import { FEATURE_FLAGS } from '../../config/featureFlags'

import soloImage from '../../assets/roles/solo.webp'
import jungleImage from '../../assets/roles/jungle.webp'
import midImage from '../../assets/roles/mid.webp'
import suppImage from '../../assets/roles/supp.webp'
import adcImage from '../../assets/roles/adc.webp'

const roleImages = {
    'SOLO': soloImage,
    'JUNGLE': jungleImage,
    'MID': midImage,
    'SUPPORT': suppImage,
    'ADC': adcImage,
}

const formatNumber = (num) => new Intl.NumberFormat().format(Math.round(num))
const formatDate = (dateStr) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function computeStats(source) {
    const gamesPlayed = parseInt(source?.games_played) || 0
    const wins = parseInt(source?.wins) || 0
    const totalKills = parseInt(source?.total_kills) || 0
    const totalDeaths = parseInt(source?.total_deaths) || 0
    const totalAssists = parseInt(source?.total_assists) || 0
    const totalDamage = parseInt(source?.total_damage) || 0
    const totalMitigated = parseInt(source?.total_mitigated) || 0
    const kda = totalDeaths === 0
        ? totalKills + (totalAssists / 2)
        : (totalKills + (totalAssists / 2)) / totalDeaths
    const winRate = gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0
    return { gamesPlayed, wins, totalKills, totalDeaths, totalAssists, totalDamage, totalMitigated, kda, winRate }
}

function aggregateGodStats(games, godsList) {
    const godMap = {}
    for (const game of games) {
        const name = game.god_played
        if (!name || name === 'Unknown') continue
        if (!godMap[name]) {
            const godInfo = godsList.find(g => g.name.toLowerCase() === name.toLowerCase())
            godMap[name] = {
                name, imageUrl: godInfo?.image_url || null,
                games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, damage: 0, mitigated: 0,
            }
        }
        const g = godMap[name]
        g.games++
        if (game.winner_team_id === game.player_team_id) g.wins++
        g.kills += parseInt(game.kills) || 0
        g.deaths += parseInt(game.deaths) || 0
        g.assists += parseInt(game.assists) || 0
        g.damage += parseInt(game.damage) || 0
        g.mitigated += parseInt(game.mitigated) || 0
    }
    return Object.values(godMap)
        .map(g => ({
            ...g,
            winRate: g.games > 0 ? (g.wins / g.games) * 100 : 0,
            kda: g.deaths === 0
                ? g.kills + (g.assists / 2)
                : (g.kills + (g.assists / 2)) / g.deaths,
            avgDamage: g.games > 0 ? g.damage / g.games : 0,
            avgMitigated: g.games > 0 ? g.mitigated / g.games : 0,
        }))
        .sort((a, b) => b.games - a.games)
}

const GodPool = ({ godStats }) => {
    if (!godStats || godStats.length === 0) return null
    return (
        <div className="mb-6">
            <h3 className="text-sm font-semibold text-(--color-text-secondary) uppercase tracking-wider mb-3">
                God Pool <span className="text-(--color-text-secondary)/60">({godStats.length})</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {godStats.map(god => (
                    <div key={god.name} className="flex items-center gap-3 bg-(--color-secondary) rounded-lg border border-white/10 p-3">
                        {god.imageUrl ? (
                            <img src={god.imageUrl} alt={god.name} className="w-10 h-10 rounded object-cover flex-shrink-0" />
                        ) : (
                            <div className="w-10 h-10 rounded bg-white/10 flex items-center justify-center text-xs text-(--color-text-secondary) flex-shrink-0">?</div>
                        )}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-(--color-text) truncate">{god.name}</span>
                                <span className="text-xs text-(--color-text-secondary) flex-shrink-0">{god.games}G</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-(--color-text-secondary)">
                                <span className={god.winRate >= 50 ? 'text-green-400' : 'text-red-400'}>
                                    {god.winRate.toFixed(0)}% WR
                                </span>
                                <span>{god.kda.toFixed(1)} KDA</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-(--color-text-secondary)">
                                <span>{formatNumber(god.avgDamage)} dmg</span>
                                <span>{formatNumber(god.avgMitigated)} mit</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

function ForgeBanner({ spark, leagueSlug, divisionSlug }) {
    const chartRef = useRef(null)
    const [historyData, setHistoryData] = useState(null)

    useEffect(() => {
        if (!spark) return
        forgeService.getHistory(spark.sparkId).then(res => {
            setHistoryData(res.history || [])
        }).catch(() => {})
    }, [spark?.sparkId])

    useEffect(() => {
        if (!chartRef.current || !historyData) return
        const data = historyData.length ? historyData.map(h => h.price) : FALLBACK_HISTORY
        const hasData = historyData.length > 0
        const change = spark.priceChange24h
        const tier = getHeatTier(change)
        const colors = hasData ? SPARK_COLORS[tier] : SPARK_COLORS.neutral
        drawSparkline(chartRef.current, data, { lineColor: colors.line, fillColor: colors.fill })
    }, [historyData, spark])

    if (!spark) return null

    const change = spark.priceChange24h
    const tier = getHeatTier(change)
    const isUp = change > 0
    const isDown = change < 0
    const perfColor = spark.perfMultiplier >= 1.5 ? 'text-[var(--forge-flame-bright)]'
        : spark.perfMultiplier >= 1.0 ? 'text-[var(--forge-gold)]'
        : spark.perfMultiplier >= 0.7 ? 'text-[var(--forge-cool)]'
        : 'text-[var(--forge-loss)]'

    return (
        <div className="mb-6">
            <Link
                to={`/forge/${leagueSlug}/${divisionSlug}/player/${spark.playerSlug}`}
                className={`forge-${tier} block bg-[var(--forge-panel)] border border-[var(--forge-edge)] hover:border-[var(--forge-flame)]/30 transition-colors relative overflow-hidden group`}
            >
                {/* Left flame accent */}
                <div className="absolute top-0 left-0 w-[3px] h-full forge-accent-line" />

                <div className="p-3 sm:p-4 flex items-center gap-2.5 sm:gap-4 relative z-[1]">
                    {/* Forge logo */}
                    <img src={forgeLogo} alt="" className="w-10 h-10 sm:w-16 sm:h-16 object-contain forge-logo-glow flex-shrink-0" />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <div className="forge-head text-[0.7rem] font-semibold tracking-[0.2em] text-[var(--forge-flame)] mb-0.5 flex items-center gap-1.5">
                            <Flame size={10} />
                            Fantasy Forge
                        </div>
                        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                            {/* Price */}
                            <div>
                                <span className="forge-num text-lg text-[var(--forge-gold-bright)]">
                                    {Math.round(spark.currentPrice).toLocaleString()}
                                </span>
                                <span className="forge-head text-[0.6rem] tracking-wider text-[var(--forge-text-dim)] ml-1">Heat</span>
                            </div>
                            {/* Change */}
                            {change != null && (
                                <span className={`forge-num text-sm ${isUp ? 'text-[var(--forge-gain)]' : isDown ? 'text-[var(--forge-loss)]' : 'text-white'}`}>
                                    {isUp ? '+' : ''}{change.toFixed(1)}%
                                </span>
                            )}
                            {/* Performance */}
                            {spark.perfMultiplier != null && (
                                <div className="flex items-center gap-1">
                                    <span className={`forge-num text-sm ${perfColor}`}>{spark.perfMultiplier.toFixed(2)}x</span>
                                    <span className="forge-head text-[0.6rem] tracking-wider text-[var(--forge-text-dim)]">Perf</span>
                                </div>
                            )}
                            {/* Sparks */}
                            <div className="flex items-center gap-1">
                                <img src={sparkIcon} alt="" className="w-5 h-5 object-contain" />
                                <span className="forge-num text-sm text-[var(--forge-text-mid)]">{spark.totalSparks}</span>
                                <span className="forge-head text-[0.6rem] tracking-wider text-[var(--forge-text-dim)]">Sparks</span>
                            </div>
                        </div>
                    </div>

                    {/* Mini sparkline */}
                    <div className="w-[100px] h-[32px] flex-shrink-0 opacity-60 hidden sm:block">
                        <canvas ref={chartRef} />
                    </div>

                    {/* CTA */}
                    <div className="forge-head text-[0.65rem] sm:text-[0.75rem] font-semibold tracking-wider text-[var(--forge-flame)] group-hover:text-[var(--forge-flame-bright)] transition-colors flex-shrink-0">
                        <span className="hidden sm:inline">View in Forge</span><span className="sm:hidden">Forge</span> →
                    </div>
                </div>
            </Link>
        </div>
    )
}

const PlayerProfile = () => {
    const { leagueSlug, divisionSlug, playerSlug } = useParams()
    const navigate = useNavigate()
    const { players, teams, season, division, loading: divisionLoading } = useDivision()
    const { user, linkedPlayer, login, loading: authLoading } = useAuth()

    const [gameHistory, setGameHistory] = useState([])
    const [playerStats, setPlayerStats] = useState(null)
    const [profileData, setProfileData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [activeTab, setActiveTab] = useState('season')
    const [selectedLeague, setSelectedLeague] = useState(null)
    const [gods, setGods] = useState([])
    const [forgeSpark, setForgeSpark] = useState(null)

    const basePath = `/${leagueSlug}/${divisionSlug}`
    const player = players?.find(p => p.slug === playerSlug)
    const team = teams?.find(t => t.id === player?.team_id)

    useEffect(() => {
        if (!player || !season) return

        let cancelled = false

        const fetchData = async () => {
            setLoading(true)
            setError(null)
            try {
                const [games, allStats, profile, godsList, forgeData] = await Promise.all([
                    statsService.getPlayerGameStats(season.id, player.id),
                    statsService.getPlayerStats(season.id),
                    profileService.getPlayerProfile(player.slug).catch(() => null),
                    godService.getAll().catch(() => []),
                    forgeService.getMarket(season.id).catch(() => null),
                ])
                if (cancelled) return

                setGameHistory(Array.isArray(games) ? games : [])
                const stats = Array.isArray(allStats) ? allStats.find(s => s.id === player.id) : null
                setPlayerStats(stats || null)
                setProfileData(profile)
                setGods(Array.isArray(godsList) ? godsList : [])
                const spark = forgeData?.players?.find(p => p.playerSlug === player.slug)
                setForgeSpark(spark || null)
            } catch (err) {
                if (!cancelled) setError(err.message)
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        fetchData()
        return () => { cancelled = true }
    }, [player, season])

    if (!player) {
        if (divisionLoading) return null
        return (
            <div className="max-w-3xl mx-auto py-16 px-4 text-center">
                <h2 className="text-2xl font-bold text-(--color-text) mb-4">Player Not Found</h2>
                <Link to={`${basePath}/stats`} className="text-(--color-accent) hover:underline">
                    ← Back to Stats
                </Link>
            </div>
        )
    }

    const roleImg = player.role ? roleImages[player.role.toUpperCase()] : null
    const seasonStats = computeStats(playerStats)

    // Career data from profile API
    const careerActiveStats = profileData
        ? (selectedLeague
            ? profileData.leagueBreakdowns?.find(l => l.league_id === selectedLeague) || profileData.allTimeStats
            : profileData.allTimeStats)
        : null
    const careerStats = careerActiveStats ? computeStats(careerActiveStats) : null

    const filteredSeasons = profileData
        ? (selectedLeague
            ? profileData.seasonHistory?.filter(s => s.league_id === selectedLeague)
            : profileData.seasonHistory) || []
        : []

    const filteredGames = profileData
        ? (selectedLeague
            ? (profileData.gameHistory || []).filter(g => g.league_id === selectedLeague)
            : (profileData.gameHistory || []))
        : []

    const totalEarned = profileData?.player?.total_earned ?? null
    const passionBalance = profileData?.player?.passion_balance ?? null
    const isOwnProfile = linkedPlayer && linkedPlayer.id === player.id

    const avatarUrl = profileData?.player?.is_claimed && profileData.player.discord_id && profileData.player.discord_avatar
        ? `https://cdn.discordapp.com/avatars/${profileData.player.discord_id}/${profileData.player.discord_avatar}.png?size=128`
        : null

    return (
        <div className="max-w-5xl mx-auto py-8 px-4">
            {player && <PageTitle title={`${player.name} - ${division?.name || ''}`} description={`${player.name}'s stats in the ${division?.name || ''} division. KDA, damage, win rate, and game-by-game performance.`} />}

            {/* Back arrow + breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-(--color-text-secondary) mb-4">
                <Link to={`${basePath}/stats`} className="inline-flex items-center gap-1.5 hover:text-(--color-accent) transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    Stats
                </Link>
                {team && (
                    <>
                        <span>/</span>
                        <Link to={`${basePath}/teams/${team.slug}`} className="hover:text-(--color-accent) transition-colors">
                            {team.name}
                        </Link>
                    </>
                )}
                <span>/</span>
                <span className="text-(--color-text)">{player.name}</span>
            </div>

            {/* Header — avatar + name + rank (rank hidden on mobile) */}
            <div className="bg-(--color-secondary) rounded-xl border border-white/10 p-6 mb-3">
                <div className="flex items-center gap-4">
                    {avatarUrl && (
                        <img
                            src={avatarUrl}
                            alt=""
                            className="w-14 h-14 rounded-full border-2 border-(--color-accent)/30 flex-shrink-0"
                        />
                    )}
                    <h1 className="font-heading text-3xl font-bold text-(--color-text) flex-1 min-w-0 truncate">
                        {player.name}
                    </h1>
                    {totalEarned != null && (
                        <Link to="/challenges" className="hidden sm:flex flex-col items-center gap-1 flex-shrink-0 hover:opacity-80 transition-opacity">
                            <RankBadge totalEarned={totalEarned} size="lg" />
                            <span className="text-xs font-semibold text-(--color-text-secondary)">
                                {formatRank(getRank(totalEarned))}
                            </span>
                        </Link>
                    )}
                </div>
            </div>

            {/* Team / Role card (+ rank on mobile) */}
            <div className="bg-(--color-secondary) rounded-xl border border-white/10 p-4 mb-6">
                <div className="flex items-center gap-3">
                    {team && (
                        <Link to={`${basePath}/teams/${team.slug}`} className="flex items-center gap-2 flex-shrink-0">
                            <TeamLogo slug={team.slug} name={team.name} size={36} color={team.color} />
                            <div className="w-2.5 h-10 rounded hover:opacity-80 transition-opacity" style={{ backgroundColor: team.color }} />
                        </Link>
                    )}
                    {roleImg && (
                        <img src={roleImg} alt={player.role} className="w-9 h-9 object-contain flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-(--color-text)">
                            {team ? (
                                <Link
                                    to={`${basePath}/teams/${team.slug}`}
                                    className="font-semibold hover:text-(--color-accent) transition-colors"
                                >
                                    {team.name}
                                </Link>
                            ) : (
                                <span className="text-(--color-text-secondary)">No Team</span>
                            )}
                        </p>
                        {player.role && (
                            <p className="text-xs text-(--color-text-secondary)">
                                {player.role}
                                {player.secondary_role && ` / ${player.secondary_role}`}
                            </p>
                        )}
                    </div>
                    {/* Rank — mobile only (hidden on sm+) */}
                    {totalEarned != null && (
                        <Link to="/challenges" className="flex sm:hidden flex-col items-center gap-1 flex-shrink-0 hover:opacity-80 transition-opacity">
                            <RankBadge totalEarned={totalEarned} size="md" />
                            <span className="text-[10px] font-semibold text-(--color-text-secondary)">
                                {formatRank(getRank(totalEarned))}
                            </span>
                        </Link>
                    )}
                </div>
            </div>

            {/* Profile Tags */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
                {profileData?.player?.is_claimed && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium">
                        <UserCheck className="w-3.5 h-3.5" />
                        Verified
                    </span>
                )}
                {!authLoading && (() => {
                    if (isOwnProfile) {
                        return (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-(--color-accent)/10 border border-(--color-accent)/20 text-(--color-accent) text-xs font-medium">
                                Your Profile
                            </span>
                        )
                    }
                    if (!user) {
                        return (
                            <button
                                onClick={login}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-medium transition-colors"
                            >
                                <User className="w-3.5 h-3.5" />
                                Claim Profile
                            </button>
                        )
                    }
                    if (!linkedPlayer) {
                        return (
                            <button
                                onClick={() => window.dispatchEvent(new CustomEvent('open-claim-modal', { detail: { playerId: player.id, playerName: player.name } }))}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-medium transition-colors"
                            >
                                <User className="w-3.5 h-3.5" />
                                Claim This Profile
                            </button>
                        )
                    }
                    return null
                })()}
                {player.tracker_url && (
                    <a
                        href={player.tracker_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-(--color-accent)/10 border border-(--color-accent)/20 text-(--color-accent) text-xs font-medium hover:bg-(--color-accent)/20 transition-colors"
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Tracker
                    </a>
                )}
                {passionBalance != null && (
                    <Link
                        to="/challenges"
                        className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-(--color-accent)/10 border border-(--color-accent)/20 text-(--color-accent) text-xs font-bold hover:bg-(--color-accent)/20 transition-colors"
                    >
                        <img src={passionCoin} alt="" className="w-4 h-4" />
                        {new Intl.NumberFormat().format(passionBalance)}
                    </Link>
                )}
            </div>

            {/* Badges */}
            {profileData?.badges?.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                    {profileData.badges.map((badge, i) => {
                        const color = getTierColor(badge.tier)
                        return (
                            <div
                                key={i}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold"
                                style={{
                                    borderColor: `${color}60`,
                                    color: color,
                                    backgroundColor: `${color}15`,
                                }}
                                title={`${badge.title} — ${badge.completed_at ? new Date(badge.completed_at).toLocaleDateString() : ''}`}
                            >
                                <span>&#9733;</span>
                                {badge.badge_label}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Claim CTA Banner */}
            {profileData && !profileData.player.is_claimed && !authLoading && (
                <div
                    className="relative overflow-hidden rounded-xl border border-[#5865F2]/30 p-5 mb-6"
                    style={{ background: 'linear-gradient(135deg, rgba(88, 101, 242, 0.08), var(--color-secondary))' }}
                >
                    <div
                        className="absolute top-0 right-0 w-40 h-40 opacity-10 pointer-events-none"
                        style={{ background: 'radial-gradient(circle at top right, #5865F2, transparent 70%)' }}
                    />
                    <div className="relative z-10 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-[#5865F2]/20 flex items-center justify-center flex-shrink-0">
                            <User className="w-6 h-6 text-[#5865F2]" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-heading text-lg font-bold text-(--color-text) mb-1">
                                Is this you? Claim this profile!
                            </h3>
                            <p className="text-sm text-(--color-text-secondary)">
                                Link your Discord and unlock your full competitive identity.
                                Show off your stats and track your career across every season.
                            </p>
                        </div>
                        {!user ? (
                            <button
                                onClick={login}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-semibold transition-colors flex-shrink-0"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                                </svg>
                                Login to Claim
                            </button>
                        ) : !linkedPlayer ? (
                            <button
                                onClick={() => window.dispatchEvent(new CustomEvent('open-claim-modal', { detail: { playerId: player.id, playerName: player.name } }))}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-semibold transition-colors flex-shrink-0"
                            >
                                <User className="w-4 h-4" />
                                Claim This Profile
                            </button>
                        ) : null}
                    </div>
                </div>
            )}

            {/* Tab Toggle */}
            <div className="flex gap-1 p-1 bg-(--color-secondary) rounded-lg border border-white/10 mb-6">
                <button
                    onClick={() => setActiveTab('season')}
                    className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                        activeTab === 'season'
                            ? 'bg-(--color-accent) text-(--color-primary)'
                            : 'text-(--color-text-secondary) hover:text-(--color-text) hover:bg-white/5'
                    }`}
                >
                    Current Season
                </button>
                <button
                    onClick={() => setActiveTab('career')}
                    className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                        activeTab === 'career'
                            ? 'bg-(--color-accent) text-(--color-primary)'
                            : 'text-(--color-text-secondary) hover:text-(--color-text) hover:bg-white/5'
                    }`}
                >
                    Career
                </button>
            </div>

            {/* ── Current Season Tab ── */}
            {activeTab === 'season' && (
                loading ? (
                    <div className="flex items-center justify-center p-16">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-(--color-accent) mx-auto mb-4" />
                            <p className="text-(--color-text-secondary)">Loading player stats...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-8 text-center">
                        <h2 className="text-xl font-bold text-red-400 mb-3">Failed to Load Stats</h2>
                        <p className="text-red-300/80">{error}</p>
                    </div>
                ) : (
                    <>
                        {/* Stat Cards */}
                        <StatCards stats={seasonStats} />

                        {/* Averages */}
                        {seasonStats.gamesPlayed > 0 && (
                            <AveragesRow stats={seasonStats} />
                        )}

                        {/* Fantasy Forge Banner */}
                        {forgeSpark && FEATURE_FLAGS.FORGE_RELEASED && (
                            <ForgeBanner spark={forgeSpark} leagueSlug={leagueSlug} divisionSlug={divisionSlug} />
                        )}

                        {/* God Pool */}
                        <GodPool godStats={aggregateGodStats(gameHistory, gods)} />

                        {/* Godpool Tier List */}
                        <GodpoolTierListDisplay playerSlug={player.slug} isOwnProfile={isOwnProfile} gods={gods} />

                        {/* Match History */}
                        <h2 className="font-heading text-xl font-bold text-(--color-text) mb-4">
                            Match History
                        </h2>

                        {gameHistory.length === 0 ? (
                            <div className="bg-(--color-secondary) rounded-xl border border-white/10 p-8 text-center">
                                <p className="text-(--color-text-secondary)">No games played yet this season.</p>
                            </div>
                        ) : (
                            <div className="bg-(--color-secondary) rounded-xl border border-white/10 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-white/10">
                                        <thead className="bg-white/5">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Date</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Opponent</th>
                                            <th className="px-4 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Result</th>
                                            {gameHistory.some(g => g.role_played) && (
                                                <th className="px-4 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Role</th>
                                            )}
                                            {gameHistory.some(g => g.god_played) && (
                                                <th className="px-4 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">God</th>
                                            )}
                                            <th className="px-4 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">K</th>
                                            <th className="px-4 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">D</th>
                                            <th className="px-4 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">A</th>
                                            <th className="px-4 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Damage</th>
                                            <th className="px-4 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Mitigated</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider"></th>
                                        </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                        {gameHistory.map((game, index) => {
                                            const isWin = game.winner_team_id === game.player_team_id
                                            const opponent = game.player_team_id === game.team1_id
                                                ? { name: game.team2_name, color: game.team2_color, slug: game.team2_slug }
                                                : { name: game.team1_name, color: game.team1_color, slug: game.team1_slug }

                                            return (
                                                <tr key={game.game_id} className={index % 2 === 0 ? '' : 'bg-white/[0.02]'}>
                                                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                                                        <Link to={`${basePath}/matches/${game.match_id}`} className="text-(--color-text-secondary) hover:text-(--color-accent) transition-colors">
                                                            {formatDate(game.date)}
                                                        </Link>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <Link
                                                            to={`${basePath}/teams/${opponent.slug}`}
                                                            className="flex items-center gap-2 group"
                                                        >
                                                            <TeamLogo slug={opponent.slug} name={opponent.name} size={18} color={opponent.color} />
                                                            <div
                                                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                                style={{ backgroundColor: opponent.color }}
                                                            />
                                                            <span className="text-sm text-(--color-text) group-hover:text-(--color-accent) transition-colors">
                                                                {opponent.name}
                                                            </span>
                                                        </Link>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                                            isWin
                                                                ? 'bg-green-400/10 text-green-400'
                                                                : 'bg-red-400/10 text-red-400'
                                                        }`}>
                                                            {isWin ? 'W' : 'L'}
                                                        </span>
                                                    </td>
                                                    {gameHistory.some(g => g.role_played) && (
                                                        <td className="px-4 py-3 text-center">
                                                            {game.role_played && roleImages[game.role_played.toUpperCase()] ? (
                                                                <img src={roleImages[game.role_played.toUpperCase()]} alt={game.role_played} title={game.role_played} className="w-5 h-5 object-contain inline-block" />
                                                            ) : (
                                                                <span className="text-sm text-(--color-text-secondary)">—</span>
                                                            )}
                                                        </td>
                                                    )}
                                                    {gameHistory.some(g => g.god_played) && (
                                                        <td className="px-4 py-3 text-center text-sm text-(--color-text)">
                                                            {game.god_played || '—'}
                                                        </td>
                                                    )}
                                                    <td className="px-4 py-3 text-center text-sm font-medium text-(--color-text)">
                                                        {game.kills}
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-sm font-medium text-(--color-text)">
                                                        {game.deaths}
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-sm font-medium text-(--color-text)">
                                                        {game.assists}
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-sm text-(--color-text)">
                                                        {game.damage != null ? formatNumber(game.damage) : '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-sm text-(--color-text)">
                                                        {game.mitigated != null ? formatNumber(game.mitigated) : '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-right whitespace-nowrap">
                                                        <Link to={`${basePath}/matches/${game.match_id}`} className="text-(--color-accent) hover:opacity-80 transition-opacity text-xs font-medium">
                                                            View Match →
                                                        </Link>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )
            )}

            {/* ── Career Tab ── */}
            {activeTab === 'career' && (
                !profileData ? (
                    <div className="flex items-center justify-center p-16">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-(--color-accent) mx-auto mb-4" />
                            <p className="text-(--color-text-secondary)">Loading career data...</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* League Filter */}
                        {profileData.leagueBreakdowns?.length > 1 && (
                            <div className="flex flex-wrap gap-2 mb-6">
                                <button
                                    onClick={() => setSelectedLeague(null)}
                                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                        !selectedLeague
                                            ? 'bg-(--color-accent) text-(--color-primary)'
                                            : 'bg-white/5 text-(--color-text-secondary) hover:bg-white/10'
                                    }`}
                                >
                                    All Leagues
                                </button>
                                {profileData.leagueBreakdowns.map(league => (
                                    <button
                                        key={league.league_id}
                                        onClick={() => setSelectedLeague(league.league_id)}
                                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                            selectedLeague === league.league_id
                                                ? 'text-white'
                                                : 'bg-white/5 text-(--color-text-secondary) hover:bg-white/10'
                                        }`}
                                        style={selectedLeague === league.league_id && league.league_color ? { backgroundColor: league.league_color } : {}}
                                    >
                                        {league.league_name}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Career Stats */}
                        {careerStats && careerStats.gamesPlayed > 0 ? (
                            <>
                                <StatCards stats={careerStats} />
                                <AveragesRow stats={careerStats} />
                            </>
                        ) : (
                            <div className="bg-(--color-secondary) rounded-xl border border-white/10 p-8 text-center mb-8">
                                <p className="text-(--color-text-secondary)">No games played yet.</p>
                            </div>
                        )}

                        {/* God Pool */}
                        <GodPool godStats={aggregateGodStats(filteredGames, gods)} />

                        {/* Godpool Tier List */}
                        <GodpoolTierListDisplay playerSlug={player.slug} isOwnProfile={isOwnProfile} gods={gods} />

                        {/* Season History */}
                        {filteredSeasons.length > 0 && (
                            <>
                                <h2 className="font-heading text-xl font-bold text-(--color-text) mb-4">
                                    Season History
                                </h2>
                                <div className="bg-(--color-secondary) rounded-xl border border-white/10 overflow-hidden mb-8">
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-white/10">
                                            <thead className="bg-white/5">
                                                <tr>
                                                    <th className="px-3 py-3 text-left text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider min-w-[120px]">Season</th>
                                                    <th className="px-3 py-3 text-left text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider min-w-[120px]">Team</th>
                                                    <th className="px-3 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider min-w-[70px]">Role</th>
                                                    <th className="px-3 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider min-w-[70px]">Games</th>
                                                    <th className="px-3 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider min-w-[70px]">W-L</th>
                                                    <th className="px-3 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider min-w-[70px]">KDA</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {filteredSeasons.map((s, index) => {
                                                    const sGames = parseInt(s.games_played) || 0
                                                    const sWins = parseInt(s.wins) || 0
                                                    const sKills = parseInt(s.total_kills) || 0
                                                    const sDeaths = parseInt(s.total_deaths) || 0
                                                    const sAssists = parseInt(s.total_assists) || 0
                                                    const sKda = sDeaths === 0
                                                        ? sKills + (sAssists / 2)
                                                        : (sKills + (sAssists / 2)) / sDeaths
                                                    const divImg = getDivisionImage(s.league_slug, s.division_slug, s.division_tier)
                                                    const leagueLogo = getLeagueLogo(s.league_slug)
                                                    const seasonNum = s.season_name?.match(/\d+/)?.[0]
                                                    const seasonPath = `/${s.league_slug}/${s.division_slug}/players/${player.slug}`
                                                    const isCurrent = s.league_slug === leagueSlug && s.division_slug === divisionSlug && s.season_id === season?.id

                                                    return (
                                                        <tr
                                                            key={s.season_id}
                                                            className={`${index % 2 === 0 ? '' : 'bg-white/[0.02]'} ${isCurrent ? 'ring-1 ring-inset ring-(--color-accent)/30 bg-(--color-accent)/5' : ''} group cursor-pointer hover:bg-white/[0.04] transition-colors`}
                                                            onClick={() => {
                                                                if (isCurrent) {
                                                                    setActiveTab('season')
                                                                } else {
                                                                    navigate(seasonPath)
                                                                }
                                                            }}
                                                        >
                                                            <td className="px-3 py-3 whitespace-nowrap">
                                                                <div
                                                                    className="inline-flex items-center gap-1.5"
                                                                    title={`${s.league_name} · ${s.division_name} · ${s.season_name}`}
                                                                >
                                                                    {leagueLogo ? (
                                                                        <img src={leagueLogo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
                                                                    ) : s.league_color && (
                                                                        <div
                                                                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                                            style={{ backgroundColor: s.league_color }}
                                                                        />
                                                                    )}
                                                                    {divImg ? (
                                                                        <img src={divImg} alt={s.division_name || ''} className="w-5 h-5 object-contain" />
                                                                    ) : s.division_name && (
                                                                        <span className="text-xs font-medium text-(--color-text)">{s.division_name}</span>
                                                                    )}
                                                                    {seasonNum && (
                                                                        <span className="text-xs font-medium text-(--color-text-secondary)">S{seasonNum}</span>
                                                                    )}
                                                                    {s.is_active && (
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-3 whitespace-nowrap">
                                                                {s.team_name ? (
                                                                    <div className="flex items-center gap-2">
                                                                        <div
                                                                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                                            style={{ backgroundColor: s.team_color }}
                                                                        />
                                                                        <span className="text-sm text-(--color-text)">{s.team_name}</span>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-sm text-(--color-text-secondary)">—</span>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-3 text-center text-sm text-(--color-text)">
                                                                {s.role || '—'}
                                                            </td>
                                                            <td className="px-3 py-3 text-center text-sm text-(--color-text)">
                                                                {sGames}
                                                            </td>
                                                            <td className="px-3 py-3 text-center text-sm text-(--color-text)">
                                                                {sGames > 0 ? `${sWins}-${sGames - sWins}` : '—'}
                                                            </td>
                                                            <td className="px-3 py-3 text-center text-sm font-medium">
                                                                <span className={
                                                                    sGames === 0 ? 'text-(--color-text-secondary)' :
                                                                    sKda >= 2 ? 'text-green-400' :
                                                                    sKda >= 1.5 ? 'text-yellow-400' : 'text-red-400'
                                                                }>
                                                                    {sGames > 0 ? sKda.toFixed(2) : '—'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* All Match History */}
                        {filteredGames.length > 0 && (
                            <>
                                <h2 className="font-heading text-xl font-bold text-(--color-text) mb-4">
                                    Match History
                                </h2>
                                <div className="bg-(--color-secondary) rounded-xl border border-white/10 overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-white/10">
                                            <thead className="bg-white/5">
                                                <tr>
                                                    <th className="px-3 py-3 text-left text-xs font-medium text-(--color-text-secondary) uppercase">Date</th>
                                                    {!selectedLeague && (
                                                        <th className="px-2 py-3 text-left text-xs font-medium text-(--color-text-secondary) uppercase min-w-[120px]">Season</th>
                                                    )}
                                                    <th className="px-3 py-3 text-left text-xs font-medium text-(--color-text-secondary) uppercase">Opponent</th>
                                                    <th className="px-2 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase"></th>
                                                    {filteredGames.some(g => g.role_played) && (
                                                        <th className="px-2 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase">Role</th>
                                                    )}
                                                    {filteredGames.some(g => g.god_played) && (
                                                        <th className="px-2 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase">God</th>
                                                    )}
                                                    <th className="px-2 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase">K</th>
                                                    <th className="px-2 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase">D</th>
                                                    <th className="px-2 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase">A</th>
                                                    <th className="px-2 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase">Dmg</th>
                                                    <th className="px-2 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase">Mit</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {filteredGames.map((game, index) => {
                                                    const isWin = game.winner_team_id === game.player_team_id
                                                    const opponent = game.player_team_id === game.team1_id
                                                        ? { name: game.team2_name, color: game.team2_color, slug: game.team2_slug }
                                                        : { name: game.team1_name, color: game.team1_color, slug: game.team1_slug }
                                                    const divImg = getDivisionImage(game.league_slug, game.division_slug, game.division_tier)
                                                    const leagueLogo = getLeagueLogo(game.league_slug)
                                                    const seasonNum = game.season_name?.match(/\d+/)?.[0]
                                                    const matchPath = `/${game.league_slug}/${game.division_slug}/matches/${game.match_id}`

                                                    return (
                                                        <tr key={game.game_id} className={`${index % 2 === 0 ? '' : 'bg-white/[0.02]'} group cursor-pointer hover:bg-white/[0.04] transition-colors`} onClick={() => navigate(matchPath)}>
                                                            <td className="px-3 py-2.5 text-sm whitespace-nowrap text-(--color-text-secondary) group-hover:text-(--color-accent) transition-colors">
                                                                {formatDate(game.date)}
                                                            </td>
                                                            {!selectedLeague && (
                                                                <td className="px-2 py-2.5 whitespace-nowrap">
                                                                    <Link
                                                                        to={`/${game.league_slug}/${game.division_slug}`}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        className="inline-flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                                                                        title={`${game.league_name} · ${game.division_name} · ${game.season_name}`}
                                                                    >
                                                                        {leagueLogo ? (
                                                                            <img src={leagueLogo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
                                                                        ) : game.league_color && (
                                                                            <div
                                                                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                                                style={{ backgroundColor: game.league_color }}
                                                                            />
                                                                        )}
                                                                        {divImg ? (
                                                                            <img src={divImg} alt={game.division_name || ''} className="w-5 h-5 object-contain" />
                                                                        ) : game.division_name && (
                                                                            <span className="text-xs font-medium text-(--color-text)">{game.division_name}</span>
                                                                        )}
                                                                        {seasonNum && (
                                                                            <span className="text-xs font-medium text-(--color-text-secondary)">S{seasonNum}</span>
                                                                        )}
                                                                    </Link>
                                                                </td>
                                                            )}
                                                            <td className="px-3 py-2.5 whitespace-nowrap">
                                                                <div className="flex items-center gap-1.5">
                                                                    <div
                                                                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                                        style={{ backgroundColor: opponent.color }}
                                                                    />
                                                                    <span className="text-sm text-(--color-text)">
                                                                        {opponent.name}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="px-2 py-2.5 text-center">
                                                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                                                                    isWin
                                                                        ? 'bg-green-400/10 text-green-400'
                                                                        : 'bg-red-400/10 text-red-400'
                                                                }`}>
                                                                    {isWin ? 'W' : 'L'}
                                                                </span>
                                                            </td>
                                                            {filteredGames.some(g => g.role_played) && (
                                                                <td className="px-2 py-2.5 text-center">
                                                                    {game.role_played && roleImages[game.role_played.toUpperCase()] ? (
                                                                        <img src={roleImages[game.role_played.toUpperCase()]} alt={game.role_played} title={game.role_played} className="w-4 h-4 object-contain inline-block" />
                                                                    ) : (
                                                                        <span className="text-sm text-(--color-text-secondary)">—</span>
                                                                    )}
                                                                </td>
                                                            )}
                                                            {filteredGames.some(g => g.god_played) && (
                                                                <td className="px-2 py-2.5 text-center text-sm text-(--color-text)">
                                                                    {game.god_played || '—'}
                                                                </td>
                                                            )}
                                                            <td className="px-2 py-2.5 text-center text-sm font-medium text-(--color-text)">
                                                                {game.kills}
                                                            </td>
                                                            <td className="px-2 py-2.5 text-center text-sm font-medium text-(--color-text)">
                                                                {game.deaths}
                                                            </td>
                                                            <td className="px-2 py-2.5 text-center text-sm font-medium text-(--color-text)">
                                                                {game.assists}
                                                            </td>
                                                            <td className="px-2 py-2.5 text-center text-sm text-(--color-text)">
                                                                {game.damage != null ? formatNumber(game.damage) : '—'}
                                                            </td>
                                                            <td className="px-2 py-2.5 text-center text-sm text-(--color-text)">
                                                                {game.mitigated != null ? formatNumber(game.mitigated) : '—'}
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        )}
                    </>
                )
            )}

        </div>
    )
}

/* ── Shared stat cards ── */
function StatCards({ stats }) {
    const { gamesPlayed, wins, winRate, kda, totalKills, totalDeaths, totalAssists } = stats
    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
            {[
                { label: 'Games', value: gamesPlayed },
                { label: 'Wins', value: wins },
                {
                    label: 'Win Rate',
                    value: gamesPlayed > 0 ? `${winRate.toFixed(0)}%` : '—',
                    color: winRate >= 60 ? 'text-green-400' : winRate >= 45 ? 'text-yellow-400' : 'text-red-400',
                },
                {
                    label: 'KDA',
                    value: gamesPlayed > 0 ? kda.toFixed(2) : '—',
                    color: kda >= 2 ? 'text-green-400' : kda >= 1.5 ? 'text-yellow-400' : 'text-red-400',
                },
                { label: 'Kills', value: totalKills },
                { label: 'Deaths', value: totalDeaths },
                { label: 'Assists', value: totalAssists },
            ].map(stat => (
                <div key={stat.label} className="bg-(--color-secondary) rounded-xl border border-white/10 p-4 text-center">
                    <div className={`text-xl font-bold font-heading ${stat.color || 'text-(--color-text)'}`}>
                        {stat.value}
                    </div>
                    <div className="text-xs text-(--color-text-secondary)">{stat.label}</div>
                </div>
            ))}
        </div>
    )
}

/* ── Shared averages row ── */
function AveragesRow({ stats }) {
    const { gamesPlayed, totalKills, totalDeaths, totalAssists, totalDamage, totalMitigated } = stats
    if (gamesPlayed === 0) return null
    return (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
            {[
                { label: 'Avg Kills', value: (totalKills / gamesPlayed).toFixed(1) },
                { label: 'Avg Deaths', value: (totalDeaths / gamesPlayed).toFixed(1) },
                { label: 'Avg Assists', value: (totalAssists / gamesPlayed).toFixed(1) },
                { label: 'Avg Damage', value: formatNumber(totalDamage / gamesPlayed) },
                { label: 'Avg Mitigated', value: formatNumber(totalMitigated / gamesPlayed) },
            ].map(stat => (
                <div key={stat.label} className="bg-(--color-secondary) rounded-xl border border-white/10 p-3 text-center">
                    <div className="text-lg font-bold text-(--color-text)">{stat.value}</div>
                    <div className="text-xs text-(--color-text-secondary)">{stat.label}</div>
                </div>
            ))}
        </div>
    )
}

export default PlayerProfile

// src/pages/division/PlayerProfile.jsx
import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useDivision } from '../../context/DivisionContext'
import { useAuth } from '../../context/AuthContext'
import { statsService, profileService } from '../../services/database'
import PageTitle from '../../components/PageTitle'
import RankBadge from '../../components/RankBadge'
import { getRank, formatRank } from '../../config/ranks'
import { UserCheck, User, ExternalLink } from 'lucide-react'
import TeamLogo from '../../components/TeamLogo'
import passionCoin from '../../assets/passion/passion.png'

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

const PlayerProfile = () => {
    const { leagueSlug, divisionSlug, playerSlug } = useParams()
    const { players, teams, season, division } = useDivision()
    const { user, linkedPlayer, login, loading: authLoading } = useAuth()

    const [gameHistory, setGameHistory] = useState([])
    const [playerStats, setPlayerStats] = useState(null)
    const [totalEarned, setTotalEarned] = useState(null)
    const [passionBalance, setPassionBalance] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

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
                const [games, allStats, profileData] = await Promise.all([
                    statsService.getPlayerGameStats(season.id, player.id),
                    statsService.getPlayerStats(season.id),
                    profileService.getPlayerProfile(player.slug).catch(() => null),
                ])
                if (cancelled) return

                setGameHistory(Array.isArray(games) ? games : [])

                // Find this player's aggregate stats
                const stats = Array.isArray(allStats) ? allStats.find(s => s.id === player.id) : null
                setPlayerStats(stats || null)
                setTotalEarned(profileData?.player?.total_earned ?? null)
                setPassionBalance(profileData?.player?.passion_balance ?? null)
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
    const formatNumber = (num) => new Intl.NumberFormat().format(Math.round(num))

    const formatDate = (dateStr) => {
        if (!dateStr) return ''
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        })
    }

    // Compute aggregate stats from playerStats
    const gamesPlayed = parseInt(playerStats?.games_played) || 0
    const wins = parseInt(playerStats?.wins) || 0
    const totalKills = parseInt(playerStats?.total_kills) || 0
    const totalDeaths = parseInt(playerStats?.total_deaths) || 0
    const totalAssists = parseInt(playerStats?.total_assists) || 0
    const totalDamage = parseInt(playerStats?.total_damage) || 0
    const totalMitigated = parseInt(playerStats?.total_mitigated) || 0
    const kda = totalDeaths === 0
        ? totalKills + (totalAssists / 2)
        : (totalKills + (totalAssists / 2)) / totalDeaths
    const winRate = gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0

    return (
        <div className="max-w-5xl mx-auto py-8 px-4">
            {player && <PageTitle title={`${player.name} - ${division?.name || ''}`} />}
            {/* Breadcrumb / back links */}
            <div className="flex items-center gap-2 text-sm text-(--color-text-secondary) mb-4">
                <Link to={`${basePath}/stats`} className="hover:text-(--color-accent) transition-colors">
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

            {/* Header */}
            <div className="bg-(--color-secondary) rounded-xl border border-white/10 p-6 mb-6">
                <div className="flex items-center gap-4">
                    {team && (
                        <Link to={`${basePath}/teams/${team.slug}`} className="flex items-center gap-2">
                            <TeamLogo slug={team.slug} name={team.name} size={40} />
                            <div className="w-3 h-12 rounded hover:opacity-80 transition-opacity" style={{ backgroundColor: team.color }} />
                        </Link>
                    )}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        {roleImg && (
                            <img src={roleImg} alt={player.role} className="w-10 h-10 object-contain" />
                        )}
                        <div>
                            <h1 className="font-heading text-3xl font-bold text-(--color-text)">
                                {player.name}
                            </h1>
                            <p className="text-(--color-text-secondary)">
                                {team ? (
                                    <Link
                                        to={`${basePath}/teams/${team.slug}`}
                                        className="hover:text-(--color-accent) transition-colors"
                                    >
                                        {team.name}
                                    </Link>
                                ) : (
                                    <span>No Team</span>
                                )}
                                {player.role && ` · ${player.role}`}
                                {player.secondary_role && ` / ${player.secondary_role}`}
                            </p>
                        </div>
                    </div>

                    {/* Rank */}
                    {totalEarned != null && (
                        <Link to="/challenges" className="flex flex-col items-center gap-1 flex-shrink-0 hover:opacity-80 transition-opacity">
                            <RankBadge totalEarned={totalEarned} size="lg" />
                            <span className="text-xs font-semibold text-(--color-text-secondary)">
                                {formatRank(getRank(totalEarned))}
                            </span>
                        </Link>
                    )}
                </div>
            </div>

            {/* Profile Tags */}
            <div className="flex items-center gap-2 mb-6">
                <Link
                    to={`/profile/${player.slug}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-(--color-text) text-xs font-medium hover:bg-white/10 transition-colors"
                >
                    Full Profile
                </Link>
                {!authLoading && (() => {
                    const isOwnProfile = linkedPlayer && linkedPlayer.id === player.id
                    if (isOwnProfile) {
                        return (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium">
                                <UserCheck className="w-3.5 h-3.5" />
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

            {loading ? (
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

                    {/* Averages */}
                    {gamesPlayed > 0 && (
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
                    )}

                    {/* Game History */}
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
                                                        <TeamLogo slug={opponent.slug} name={opponent.name} size={18} />
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
            )}
        </div>
    )
}

export default PlayerProfile
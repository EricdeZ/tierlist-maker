// src/pages/division/TeamDetail.jsx
import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useDivision } from '../../context/DivisionContext'
import { statsService, matchService } from '../../services/database'
import PageTitle from '../../components/PageTitle'
import TeamLogo from '../../components/TeamLogo'

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

const TeamDetail = () => {
    const { leagueSlug, divisionSlug, teamSlug } = useParams()
    const { teams, players, season, division } = useDivision()

    const [rosterStats, setRosterStats] = useState([])
    const [matches, setMatches] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const basePath = `/${leagueSlug}/${divisionSlug}`
    const team = teams?.find(t => t.slug === teamSlug)
    const teamPlayers = players?.filter(p => p.team_id === team?.id) || []

    useEffect(() => {
        if (!team || !season) return

        let cancelled = false

        const fetchData = async () => {
            setLoading(true)
            setError(null)
            try {
                const [allStats, allMatches] = await Promise.all([
                    statsService.getPlayerStats(season.id),
                    matchService.getAllBySeason(season.id),
                ])
                if (cancelled) return

                // Filter stats to this team's players
                const teamPlayerIds = teamPlayers.map(p => p.id)
                const filtered = allStats
                    .filter(s => teamPlayerIds.includes(s.id))
                    .map(s => {
                        const gamesPlayed = parseInt(s.games_played) || 0
                        const wins = parseInt(s.wins) || 0
                        const totalKills = parseInt(s.total_kills) || 0
                        const totalDeaths = parseInt(s.total_deaths) || 0
                        const totalAssists = parseInt(s.total_assists) || 0

                        const kda = totalDeaths === 0
                            ? totalKills + (totalAssists / 2)
                            : (totalKills + (totalAssists / 2)) / totalDeaths
                        const winRate = gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0

                        return { ...s, gamesPlayed, wins, totalKills, totalDeaths, totalAssists, kda, winRate }
                    })

                setRosterStats(filtered)

                // Filter matches involving this team
                const teamMatches = allMatches.filter(
                    m => m.team1_id === team.id || m.team2_id === team.id
                )
                setMatches(teamMatches)
            } catch (err) {
                if (!cancelled) setError(err.message)
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        fetchData()
        return () => { cancelled = true }
    }, [team, season, team?.id])

    if (!team) {
        return (
            <div className="max-w-3xl mx-auto py-16 px-4 text-center">
                <h2 className="text-2xl font-bold text-(--color-text) mb-4">Team Not Found</h2>
                <Link to={`${basePath}/teams`} className="text-(--color-accent) hover:underline">
                    ← Back to Teams
                </Link>
            </div>
        )
    }

    const formatNumber = (num) => new Intl.NumberFormat().format(Math.round(num))

    const formatDate = (dateStr) => {
        if (!dateStr) return ''
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        })
    }

    // Team record from matches
    const completedMatches = matches.filter(m => m.is_completed)
    const teamWins = completedMatches.filter(m => m.winner_team_id === team.id).length
    const teamLosses = completedMatches.length - teamWins

    return (
        <div className="max-w-5xl mx-auto py-8 px-4">
            {team && <PageTitle title={`${team.name} - ${division?.name || ''}`} description={`${team.name} roster, match history, and stats in the ${division?.name || ''} division. View player performances and team record.`} />}
            {/* Back link */}
            <Link
                to={`${basePath}/teams`}
                className="inline-flex items-center gap-1.5 text-sm text-(--color-text-secondary) hover:text-(--color-accent) transition-colors mb-4"
            >
                ← Back to Teams
            </Link>

            {/* Team Header */}
            <div className="bg-(--color-secondary) rounded-xl border border-white/10 p-6 mb-6">
                <div className="flex items-center gap-4">
                    <TeamLogo slug={team.slug} name={team.name} size={56} />
                    <div className="w-4 h-14 rounded" style={{ backgroundColor: team.color }} />
                    <div className="flex-1">
                        <h1 className="font-heading text-3xl font-bold text-(--color-text)">
                            {team.name}
                        </h1>
                        <p className="text-(--color-text-secondary)">
                            {teamPlayers.length} players · {season?.name}
                        </p>
                    </div>
                    {!loading && completedMatches.length > 0 && (
                        <div className="text-right flex-shrink-0">
                            <div className="font-heading text-2xl font-bold text-(--color-text)">
                                <span className="text-green-400">{teamWins}</span>
                                <span className="text-(--color-text-secondary) mx-1">–</span>
                                <span className="text-red-400">{teamLosses}</span>
                            </div>
                            <div className="text-xs text-(--color-text-secondary)">Match Record</div>
                        </div>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center p-16">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-(--color-accent) mx-auto mb-4" />
                        <p className="text-(--color-text-secondary)">Loading team data...</p>
                    </div>
                </div>
            ) : error ? (
                <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-8 text-center">
                    <h2 className="text-xl font-bold text-red-400 mb-3">Failed to Load Data</h2>
                    <p className="text-red-300/80">{error}</p>
                </div>
            ) : (
                <>
                    {/* Roster Stats */}
                    <h2 className="font-heading text-xl font-bold text-(--color-text) mb-4">Roster</h2>
                    <div className="bg-(--color-secondary) rounded-xl border border-white/10 overflow-hidden mb-8">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-white/10">
                                <thead className="bg-white/5">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Player</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Role</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Games</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">K/D/A</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">KDA</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Win Rate</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Damage</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Mitigated</th>
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                {rosterStats.map((player, index) => {
                                    const pInfo = teamPlayers.find(p => p.id === player.id)
                                    const slug = pInfo?.slug
                                    const roleImg = player.role ? roleImages[player.role.toUpperCase()] : null

                                    return (
                                        <tr key={player.id} className={index % 2 === 0 ? '' : 'bg-white/[0.02]'}>
                                            <td className="px-4 py-3">
                                                <Link
                                                    to={`${basePath}/players/${slug}`}
                                                    className="text-sm font-semibold text-(--color-text) hover:text-(--color-accent) transition-colors"
                                                >
                                                    {player.name}
                                                </Link>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {roleImg && (
                                                    <img src={roleImg} alt={player.role} className="w-7 h-7 object-contain mx-auto" title={player.role} />
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center text-sm text-(--color-text)">
                                                {player.gamesPlayed}
                                            </td>
                                            <td className="px-4 py-3 text-center text-sm text-(--color-text)">
                                                {player.totalKills}/{player.totalDeaths}/{player.totalAssists}
                                            </td>
                                            <td className="px-4 py-3 text-center text-sm font-bold">
                                                    <span className={
                                                        player.kda >= 2 ? 'text-green-400' :
                                                            player.kda >= 1.5 ? 'text-yellow-400' : 'text-red-400'
                                                    }>
                                                        {player.gamesPlayed > 0 ? player.kda.toFixed(2) : '—'}
                                                    </span>
                                            </td>
                                            <td className="px-4 py-3 text-center text-sm font-medium">
                                                    <span className={
                                                        player.winRate >= 60 ? 'text-green-400' :
                                                            player.winRate >= 45 ? 'text-yellow-400' : 'text-red-400'
                                                    }>
                                                        {player.gamesPlayed > 0 ? `${player.winRate.toFixed(0)}%` : '—'}
                                                    </span>
                                            </td>
                                            <td className="px-4 py-3 text-center text-sm text-(--color-text)">
                                                {formatNumber(parseInt(player.total_damage) || 0)}
                                            </td>
                                            <td className="px-4 py-3 text-center text-sm text-(--color-text)">
                                                {formatNumber(parseInt(player.total_mitigated) || 0)}
                                            </td>
                                        </tr>
                                    )
                                })}
                                {rosterStats.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-8 text-center text-(--color-text-secondary)">
                                            No player stats available yet.
                                        </td>
                                    </tr>
                                )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Match History */}
                    <h2 className="font-heading text-xl font-bold text-(--color-text) mb-4">
                        Matches ({matches.length})
                    </h2>

                    {matches.length === 0 ? (
                        <div className="bg-(--color-secondary) rounded-xl border border-white/10 p-8 text-center">
                            <p className="text-(--color-text-secondary)">No matches scheduled yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {matches.map(match => {
                                const isTeam1 = match.team1_id === team.id
                                const opponent = isTeam1
                                    ? { name: match.team2_name, color: match.team2_color, slug: match.team2_slug, teamSlug: match.team2_slug }
                                    : { name: match.team1_name, color: match.team1_color, slug: match.team1_slug, teamSlug: match.team1_slug }
                                const isWin = match.winner_team_id === team.id
                                const matchLink = match.is_completed ? `${basePath}/matches/${match.id}` : null

                                const CardTag = matchLink ? Link : 'div'
                                const cardProps = matchLink
                                    ? { to: matchLink, className: "bg-(--color-secondary) rounded-xl border border-white/10 flex items-center px-5 py-4 group hover:border-(--color-accent)/30 transition-all" }
                                    : { className: "bg-(--color-secondary) rounded-xl border border-white/10 flex items-center px-5 py-4" }

                                return (
                                    <CardTag
                                        key={match.id}
                                        {...cardProps}
                                    >
                                        {/* Result indicator */}
                                        <div className="w-16 flex-shrink-0">
                                            {match.is_completed ? (
                                                <span className={`text-xs font-bold px-2.5 py-1 rounded ${
                                                    isWin
                                                        ? 'bg-green-400/10 text-green-400'
                                                        : 'bg-red-400/10 text-red-400'
                                                }`}>
                                                    {isWin ? 'WIN' : 'LOSS'}
                                                </span>
                                            ) : (
                                                <span className="text-xs font-medium text-(--color-accent) uppercase">
                                                    TBD
                                                </span>
                                            )}
                                        </div>

                                        {/* Opponent */}
                                        <div className="flex-1 flex items-center gap-3">
                                            <span className="text-sm text-(--color-text-secondary)">vs</span>
                                            <div className="flex items-center gap-2">
                                                <TeamLogo slug={opponent.teamSlug} name={opponent.name} size={20} />
                                                <div
                                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: opponent.color }}
                                                />
                                                <span className="text-sm font-semibold text-(--color-text) group-hover:text-(--color-accent) transition-colors">
                                                    {opponent.name}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Meta */}
                                        <div className="flex items-center gap-4 text-sm text-(--color-text-secondary) flex-shrink-0">
                                            {match.week && <span>Week {match.week}</span>}
                                            {match.date && <span>{formatDate(match.date)}</span>}
                                            {match.is_completed && (
                                                <span className="text-(--color-text-secondary)/30 group-hover:text-(--color-accent) transition-colors">→</span>
                                            )}
                                        </div>
                                    </CardTag>
                                )
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

export default TeamDetail
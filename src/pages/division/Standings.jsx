// src/pages/division/Standings.jsx
import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDivision } from '../../context/DivisionContext'
import { standingsService } from '../../services/database'
import PageTitle from '../../components/PageTitle'
import TeamLogo from '../../components/TeamLogo'

const Standings = () => {
    const { leagueSlug, divisionSlug } = useParams()
    const { season, division } = useDivision()
    const [standings, setStandings] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const basePath = `/${leagueSlug}/${divisionSlug}`

    useEffect(() => {
        if (!season) return

        let cancelled = false

        const fetchStandings = async () => {
            setLoading(true)
            setError(null)
            try {
                const data = await standingsService.getBySeason(season.id)
                if (!cancelled) setStandings(data)
            } catch (err) {
                if (!cancelled) setError(err.message)
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        fetchStandings()
        return () => { cancelled = true }
    }, [season])

    const getWinPct = (wins, losses) => {
        const total = wins + losses
        if (total === 0) return '—'
        return ((wins / total) * 100).toFixed(0) + '%'
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-16">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-(--color-accent) mx-auto mb-4" />
                    <p className="text-(--color-text-secondary)">Loading standings...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="max-w-3xl mx-auto py-8 px-4">
                <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-8 text-center">
                    <h2 className="text-2xl font-bold text-red-400 mb-3">Failed to Load Standings</h2>
                    <p className="text-red-300/80">{error}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-5xl mx-auto py-8 px-4">
            {division && <PageTitle title={`Standings - ${division.name}`} description={`Live standings for the ${division.name} division. Win/loss records, game differentials, and team rankings updated after every match.`} />}
            <h1 className="font-heading text-3xl font-bold text-(--color-text) mb-2 text-center">
                Standings
            </h1>
            <p className="text-(--color-text-secondary) text-center mb-8">
                {season?.name} — {standings.length} teams
            </p>

            {standings.length === 0 ? (
                <div className="bg-(--color-secondary) rounded-xl border border-white/10 p-8 text-center">
                    <p className="text-(--color-text-secondary) text-lg">No matches have been played yet.</p>
                </div>
            ) : (
                <div className="bg-(--color-secondary) rounded-xl border border-white/10 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-white/10">
                            <thead className="bg-white/5">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider w-8">
                                    #
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">
                                    Team
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">
                                    W
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">
                                    L
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">
                                    Win %
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">
                                    Games
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">
                                    Matches
                                </th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                            {standings.map((team, index) => {
                                const matchWins = parseInt(team.match_wins) || 0
                                const matchLosses = parseInt(team.match_losses) || 0
                                const gameWins = parseInt(team.game_wins) || 0
                                const gameLosses = parseInt(team.game_losses) || 0
                                const matchesPlayed = parseInt(team.matches_played) || 0

                                return (
                                    <tr
                                        key={team.id}
                                        className={index % 2 === 0 ? '' : 'bg-white/[0.02]'}
                                    >
                                        <td className="px-4 py-4 text-sm text-(--color-text-secondary) font-medium">
                                            {index + 1}
                                        </td>
                                        <td className="px-4 py-4">
                                            <Link
                                                to={`${basePath}/teams/${team.slug}`}
                                                className="flex items-center gap-3 group"
                                            >
                                                <TeamLogo slug={team.slug} name={team.name} size={24} logoUrl={team.logo_url} color={team.color} />
                                                <div
                                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: team.color }}
                                                />
                                                <span className="text-sm font-semibold text-(--color-text) group-hover:text-(--color-accent) transition-colors">
                                                        {team.name}
                                                    </span>
                                            </Link>
                                        </td>
                                        <td className="px-4 py-4 text-center text-sm font-bold text-green-400">
                                            {matchWins}
                                        </td>
                                        <td className="px-4 py-4 text-center text-sm font-bold text-red-400">
                                            {matchLosses}
                                        </td>
                                        <td className="px-4 py-4 text-center text-sm font-medium text-(--color-text)">
                                            {getWinPct(matchWins, matchLosses)}
                                        </td>
                                        <td className="px-4 py-4 text-center text-sm text-(--color-text-secondary)">
                                            {gameWins}–{gameLosses}
                                        </td>
                                        <td className="px-4 py-4 text-center text-sm text-(--color-text-secondary)">
                                            {matchesPlayed}
                                        </td>
                                    </tr>
                                )
                            })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Standings
// src/pages/division/Matches.jsx
import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDivision } from '../../context/DivisionContext'
import { matchService } from '../../services/database'

const Matches = () => {
    const { leagueSlug, divisionSlug } = useParams()
    const { season } = useDivision()
    const [matches, setMatches] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const basePath = `/${leagueSlug}/${divisionSlug}`

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

    if (loading) {
        return (
            <div className="flex items-center justify-center p-16">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-(--color-accent) mx-auto mb-4" />
                    <p className="text-(--color-text-secondary)">Loading matches...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="max-w-3xl mx-auto py-8 px-4">
                <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-8 text-center">
                    <h2 className="text-2xl font-bold text-red-400 mb-3">Failed to Load Matches</h2>
                    <p className="text-red-300/80">{error}</p>
                </div>
            </div>
        )
    }

    // Group matches by week (null week goes to "Unscheduled")
    const grouped = matches.reduce((acc, match) => {
        const key = match.week != null ? `Week ${match.week}` : 'Unscheduled'
        if (!acc[key]) acc[key] = []
        acc[key].push(match)
        return acc
    }, {})

    // Sort week keys numerically
    const weekKeys = Object.keys(grouped).sort((a, b) => {
        const numA = parseInt(a.replace('Week ', ''))
        const numB = parseInt(b.replace('Week ', ''))
        if (isNaN(numA)) return 1
        if (isNaN(numB)) return -1
        return numA - numB
    })

    const formatDate = (dateStr) => {
        if (!dateStr) return ''
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        })
    }

    return (
        <div className="max-w-5xl mx-auto py-8 px-4">
            <h1 className="font-heading text-3xl font-bold text-(--color-text) mb-2 text-center">
                Schedule & Results
            </h1>
            <p className="text-(--color-text-secondary) text-center mb-8">
                {season?.name} — {matches.length} matches
            </p>

            {matches.length === 0 ? (
                <div className="bg-(--color-secondary) rounded-xl border border-white/10 p-8 text-center">
                    <p className="text-(--color-text-secondary) text-lg">No matches scheduled yet.</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {weekKeys.map(week => (
                        <div key={week}>
                            <h2 className="font-heading text-lg font-bold text-(--color-text) mb-3 px-1">
                                {week}
                            </h2>
                            <div className="space-y-3">
                                {grouped[week].map(match => (
                                    <MatchCard key={match.id} match={match} formatDate={formatDate} basePath={basePath} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

const MatchCard = ({ match, formatDate, basePath }) => {
    const isCompleted = match.is_completed
    const team1Won = match.winner_team_id === match.team1_id
    const team2Won = match.winner_team_id === match.team2_id

    return (
        <div className="bg-(--color-secondary) rounded-xl border border-white/10 overflow-hidden">
            <div className="flex items-center">
                {/* Team 1 */}
                <Link
                    to={`${basePath}/teams/${match.team1_slug}`}
                    className={`flex-1 flex items-center gap-3 px-5 py-4 group hover:bg-white/5 transition-colors ${team1Won ? '' : isCompleted ? 'opacity-50' : ''}`}
                >
                    <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: match.team1_color }}
                    />
                    <span className="text-sm font-semibold text-(--color-text) truncate group-hover:text-(--color-accent) transition-colors">
                        {match.team1_name}
                    </span>
                    {team1Won && (
                        <span className="text-xs font-bold text-green-400 ml-auto flex-shrink-0">W</span>
                    )}
                </Link>

                {/* Center info */}
                <div className="flex-shrink-0 px-4 py-4 text-center min-w-24">
                    {isCompleted ? (
                        <span className="text-xs font-medium text-(--color-text-secondary) uppercase">
                            Final
                        </span>
                    ) : (
                        <span className="text-xs font-medium text-(--color-accent) uppercase">
                            Upcoming
                        </span>
                    )}
                    {match.date && (
                        <div className="text-xs text-(--color-text-secondary)/60 mt-0.5">
                            {formatDate(match.date)}
                        </div>
                    )}
                    {match.best_of > 1 && (
                        <div className="text-xs text-(--color-text-secondary)/40 mt-0.5">
                            Bo{match.best_of}
                        </div>
                    )}
                </div>

                {/* Team 2 */}
                <Link
                    to={`${basePath}/teams/${match.team2_slug}`}
                    className={`flex-1 flex items-center gap-3 px-5 py-4 justify-end group hover:bg-white/5 transition-colors ${team2Won ? '' : isCompleted ? 'opacity-50' : ''}`}
                >
                    {team2Won && (
                        <span className="text-xs font-bold text-green-400 mr-auto flex-shrink-0">W</span>
                    )}
                    <span className="text-sm font-semibold text-(--color-text) truncate text-right group-hover:text-(--color-accent) transition-colors">
                        {match.team2_name}
                    </span>
                    <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: match.team2_color }}
                    />
                </Link>
            </div>
        </div>
    )
}

export default Matches
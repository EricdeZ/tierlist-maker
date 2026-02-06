// src/pages/division/TeamDetail.jsx
import { useParams, Link } from 'react-router-dom'
import { useDivision } from '../../context/DivisionContext'

const TeamDetail = () => {
    const { leagueSlug, divisionSlug, teamSlug } = useParams()
    const { teams, players } = useDivision()

    const basePath = `/${leagueSlug}/${divisionSlug}`
    const team = teams?.find(t => t.slug === teamSlug)
    const teamPlayers = players?.filter(p => p.team_id === team?.id) || []

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

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            {/* Team Header */}
            <div className="flex items-center gap-4 mb-8">
                <div className="w-4 h-12 rounded" style={{ backgroundColor: team.color }} />
                <div>
                    <h1 className="font-heading text-3xl font-bold text-(--color-text)">{team.name}</h1>
                    <p className="text-(--color-text-secondary)">{teamPlayers.length} players</p>
                </div>
            </div>

            {/* Roster */}
            <div className="bg-(--color-secondary) rounded-xl border border-white/10 overflow-hidden">
                <div className="px-5 py-3 border-b border-white/10">
                    <h2 className="font-heading font-bold text-(--color-text)">Roster</h2>
                </div>
                <div className="divide-y divide-white/5">
                    {teamPlayers.map(player => (
                        <Link
                            key={player.id}
                            to={`${basePath}/players/${player.slug}`}
                            className="flex items-center justify-between px-5 py-3 hover:bg-white/5 transition-colors"
                        >
                            <span className="text-(--color-text) font-medium">{player.name}</span>
                            <span className="text-sm text-(--color-text-secondary) uppercase">
                                {player.role || '—'}
                            </span>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default TeamDetail
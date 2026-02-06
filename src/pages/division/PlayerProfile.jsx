// src/pages/division/PlayerProfile.jsx
import { useParams, Link } from 'react-router-dom'
import { useDivision } from '../../context/DivisionContext'

const PlayerProfile = () => {
    const { leagueSlug, divisionSlug, playerSlug } = useParams()
    const { players, teams } = useDivision()

    const basePath = `/${leagueSlug}/${divisionSlug}`
    const player = players?.find(p => p.slug === playerSlug)
    const team = teams?.find(t => t.id === player?.team_id)

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

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            <div className="bg-(--color-secondary) rounded-xl border border-white/10 p-6">
                <div className="flex items-center gap-4 mb-6">
                    {team && (
                        <div className="w-3 h-10 rounded" style={{ backgroundColor: team.color }} />
                    )}
                    <div>
                        <h1 className="font-heading text-3xl font-bold text-(--color-text)">
                            {player.name}
                        </h1>
                        <p className="text-(--color-text-secondary)">
                            {team?.name || 'No Team'} · {player.role || 'No Role'}
                        </p>
                    </div>
                    {player.tracker_url && (
                        <a
                            href={player.tracker_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-auto text-sm bg-(--color-accent) text-(--color-primary) px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity"
                        >
                            View Tracker ↗
                        </a>
                    )}
                </div>

                <div className="text-center py-8">
                    <p className="text-(--color-text-secondary) text-lg">🏗️ Full player profile coming soon</p>
                    <p className="text-(--color-text-secondary)/60 text-sm mt-2">
                        Game history, god stats, performance trends will appear here.
                    </p>
                </div>
            </div>
        </div>
    )
}

export default PlayerProfile
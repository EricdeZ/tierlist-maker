// src/pages/division/Teams.jsx
import { Link, useParams } from 'react-router-dom'
import { useDivision } from '../../context/DivisionContext'

const Teams = () => {
    const { leagueSlug, divisionSlug } = useParams()
    const { season, teams, players } = useDivision()

    const basePath = `/${leagueSlug}/${divisionSlug}`

    const getTeamPlayers = (teamId) =>
        players?.filter(p => p.team_id === teamId) || []

    return (
        <div className="max-w-6xl mx-auto py-8 px-4">
            <h1 className="font-heading text-3xl font-bold text-(--color-text) mb-2 text-center">
                Teams
            </h1>
            <p className="text-(--color-text-secondary) text-center mb-8">
                {season?.name} — {teams?.length || 0} teams
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {teams?.map(team => {
                    const teamPlayers = getTeamPlayers(team.id)

                    return (
                        <Link
                            key={team.id}
                            to={`${basePath}/teams/${team.slug}`}
                            className="group rounded-xl border border-white/10 bg-(--color-secondary) overflow-hidden hover:border-white/20 transition-all"
                        >
                            <div className="h-2" style={{ backgroundColor: team.color }} />
                            <div className="p-4">
                                <h3 className="font-heading text-lg font-bold text-(--color-text) mb-3 group-hover:text-(--color-accent) transition-colors">
                                    {team.name}
                                </h3>
                                <div className="space-y-1.5">
                                    {teamPlayers.map(player => (
                                        <div
                                            key={player.id}
                                            className="text-sm text-(--color-text-secondary) flex items-center justify-between"
                                        >
                                            <span>{player.name}</span>
                                            {player.role && (
                                                <span className="text-xs text-(--color-text-secondary)/50 uppercase">
                                                    {player.role}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}

export default Teams
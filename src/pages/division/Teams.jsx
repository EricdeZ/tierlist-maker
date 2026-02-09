// src/pages/division/Teams.jsx
import { Link, useParams } from 'react-router-dom'
import { useDivision } from '../../context/DivisionContext'

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

            {(!teams || teams.length === 0) ? (
                <div className="bg-(--color-secondary) rounded-xl border border-white/10 p-8 text-center">
                    <p className="text-(--color-text-secondary)">No teams found for this season.</p>
                </div>
            ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {teams.map(team => {
                    const teamPlayers = getTeamPlayers(team.id)

                    return (
                        <div
                            key={team.id}
                            className="rounded-xl border border-white/10 bg-(--color-secondary) overflow-hidden"
                        >
                            {/* Team header - links to team detail */}
                            <Link
                                to={`${basePath}/teams/${team.slug}`}
                                className="block group"
                            >
                                <div className="h-2" style={{ backgroundColor: team.color }} />
                                <div className="px-4 pt-4 pb-2">
                                    <h3 className="font-heading text-lg font-bold text-(--color-text) group-hover:text-(--color-accent) transition-colors">
                                        {team.name}
                                    </h3>
                                </div>
                            </Link>

                            {/* Player list - each player links to their profile */}
                            <div className="px-4 pb-4 space-y-1.5">
                                {teamPlayers.map(player => {
                                    const roleImg = player.role ? roleImages[player.role.toUpperCase()] : null

                                    return (
                                        <Link
                                            key={player.id}
                                            to={`${basePath}/players/${player.slug}`}
                                            className="text-sm text-(--color-text-secondary) flex items-center justify-between hover:text-(--color-accent) transition-colors py-0.5 group"
                                        >
                                            <span>{player.name}</span>
                                            <div className="flex items-center gap-1.5">
                                                {player.role && !roleImg && (
                                                    <span className="text-xs text-(--color-text-secondary)/50 uppercase">
                                                        {player.role}
                                                    </span>
                                                )}
                                                {roleImg && (
                                                    <img
                                                        src={roleImg}
                                                        alt={player.role}
                                                        className="w-5 h-5 object-contain opacity-50 group-hover:opacity-80 transition-opacity"
                                                        title={player.role}
                                                    />
                                                )}
                                            </div>
                                        </Link>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}
            </div>
            )}
        </div>
    )
}

export default Teams
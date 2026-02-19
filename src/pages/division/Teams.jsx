// src/pages/division/Teams.jsx
import { useState, useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Crown } from 'lucide-react'
import { useDivision } from '../../context/DivisionContext'
import { matchService } from '../../services/database'
import PageTitle from '../../components/PageTitle'
import TeamLogo from '../../components/TeamLogo'

import soloImage from '../../assets/roles/solo.webp'
import jungleImage from '../../assets/roles/jungle.webp'
import midImage from '../../assets/roles/mid.webp'
import suppImage from '../../assets/roles/supp.webp'
import adcImage from '../../assets/roles/adc.webp'

// Resolve team logo src for background usage
const teamImages = import.meta.glob('../../assets/teams/*.webp', { eager: true })
const getTeamLogoSrc = (slug) => {
    if (!slug) return null
    return teamImages[`../../assets/teams/${slug}.webp`]?.default || null
}

const roleImages = {
    'SOLO': soloImage,
    'JUNGLE': jungleImage,
    'MID': midImage,
    'SUPPORT': suppImage,
    'ADC': adcImage,
}

const Teams = () => {
    const { leagueSlug, divisionSlug } = useParams()
    const { season, teams, players, division } = useDivision()
    const [matches, setMatches] = useState([])

    const basePath = `/${leagueSlug}/${divisionSlug}`

    useEffect(() => {
        if (!season?.id) return
        matchService.getAllBySeason(season.id)
            .then(data => setMatches(data))
            .catch(() => {})
    }, [season?.id])

    // Build W-L records per team from completed matches
    const teamRecords = useMemo(() => {
        const records = {}
        const completed = matches.filter(m => m.is_completed)
        for (const m of completed) {
            if (!records[m.team1_id]) records[m.team1_id] = { wins: 0, losses: 0 }
            if (!records[m.team2_id]) records[m.team2_id] = { wins: 0, losses: 0 }
            if (m.winner_team_id === m.team1_id) {
                records[m.team1_id].wins++
                records[m.team2_id].losses++
            } else if (m.winner_team_id === m.team2_id) {
                records[m.team2_id].wins++
                records[m.team1_id].losses++
            }
        }
        return records
    }, [matches])

    const getTeamPlayers = (teamId) =>
        (players?.filter(p => p.team_id === teamId) || [])
            .sort((a, b) => {
                if (a.is_captain && !b.is_captain) return -1
                if (!a.is_captain && b.is_captain) return 1
                return a.name.localeCompare(b.name)
            })

    return (
        <div className="max-w-6xl mx-auto py-8 px-4">
            {division && <PageTitle title={`Teams - ${division.name}`} description={`All teams and rosters in the ${division.name} division. View player lineups, roles, and team details.`} />}

            {(!teams || teams.length === 0) ? (
                <div className="bg-(--color-secondary) rounded-xl border border-white/10 p-8 text-center">
                    <p className="text-(--color-text-secondary)">No teams found for this season.</p>
                </div>
            ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {teams.map(team => {
                    const teamPlayers = getTeamPlayers(team.id)
                    const record = teamRecords[team.id] || { wins: 0, losses: 0 }
                    const logoSrc = getTeamLogoSrc(team.slug)

                    return (
                        <div
                            key={team.id}
                            className="relative rounded-xl border overflow-hidden transition-transform hover:scale-[1.02] hover:shadow-lg"
                            style={{
                                borderColor: `${team.color}30`,
                                background: `linear-gradient(135deg, var(--color-secondary), ${team.color}10)`,
                            }}
                        >
                            {/* Background team logo — large, low opacity */}
                            {logoSrc && (
                                <img
                                    src={logoSrc}
                                    alt=""
                                    aria-hidden="true"
                                    className="absolute pointer-events-none opacity-[0.06]"
                                    style={{
                                        width: '75%',
                                        height: 'auto',
                                        right: '-10%',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        objectFit: 'contain',
                                    }}
                                />
                            )}

                            {/* Top color bar */}
                            <div className="h-1" style={{ background: `linear-gradient(90deg, ${team.color}, ${team.color}60)` }} />

                            {/* Team header */}
                            <Link
                                to={`${basePath}/teams/${team.slug}`}
                                className="relative block group"
                            >
                                <div className="px-4 pt-4 pb-2 flex items-center gap-3">
                                    <div
                                        className="flex-shrink-0 rounded-lg p-1.5"
                                        style={{ backgroundColor: `${team.color}18` }}
                                    >
                                        <TeamLogo slug={team.slug} name={team.name} size={36} />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-heading text-lg font-bold text-(--color-text) group-hover:text-(--color-accent) transition-colors truncate">
                                            {team.name}
                                        </h3>
                                        {(record.wins > 0 || record.losses > 0) && (
                                            <div className="flex items-center gap-2 text-xs mt-0.5">
                                                <span className="font-semibold" style={{ color: team.color }}>
                                                    {record.wins}W - {record.losses}L
                                                </span>
                                                <span className="text-(--color-text-secondary)">
                                                    ({teamPlayers.length} players)
                                                </span>
                                            </div>
                                        )}
                                        {record.wins === 0 && record.losses === 0 && (
                                            <div className="text-xs text-(--color-text-secondary) mt-0.5">
                                                {teamPlayers.length} players
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Link>

                            {/* Divider */}
                            <div className="mx-4 h-px" style={{ backgroundColor: `${team.color}20` }} />

                            {/* Player list */}
                            <div className="relative px-4 py-3 space-y-1">
                                {teamPlayers.map(player => {
                                    const roleImg = player.role ? roleImages[player.role.toUpperCase()] : null

                                    return (
                                        <Link
                                            key={player.id}
                                            to={`${basePath}/players/${player.slug}`}
                                            className="text-sm text-(--color-text-secondary) flex items-center justify-between hover:text-(--color-accent) transition-colors py-0.5 group"
                                        >
                                            <span className="flex items-center gap-1.5">
                                                {player.is_captain && (
                                                    <Crown className="w-3.5 h-3.5 text-yellow-400 shrink-0" title="Team Captain" />
                                                )}
                                                {player.name}
                                            </span>
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

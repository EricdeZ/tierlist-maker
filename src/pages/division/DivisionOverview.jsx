// src/pages/division/DivisionOverview.jsx
import { Link, useParams } from 'react-router-dom'
import { useDivision } from '../../context/DivisionContext'
import { useState, useEffect } from 'react'
import { statsService } from '../../services/database'

import deityImg from '../../assets/ranks/deity.png'
import demigodImg from '../../assets/ranks/demigod.png'
import masterImg from '../../assets/ranks/master.png'
import obsidianImg from '../../assets/ranks/obsidian.png'
import diamondImg from '../../assets/ranks/diamond.png'

const RANK_IMAGES = {
    1: deityImg,
    2: demigodImg,
    3: masterImg,
    4: obsidianImg,
    5: diamondImg,
}

const DivisionOverview = () => {
    const { leagueSlug, divisionSlug } = useParams()
    const { league, division, season, teams, players } = useDivision()
    const [seasonStats, setSeasonStats] = useState(null)

    const [statsError, setStatsError] = useState(false)

    useEffect(() => {
        if (!season) return
        statsService.getSeasonStats(season.id)
            .then(setSeasonStats)
            .catch(() => setStatsError(true))
    }, [season])

    const basePath = `/${leagueSlug}/${divisionSlug}`
    const rankImg = division?.tier ? RANK_IMAGES[division.tier] : null

    const formatNumber = (num) => new Intl.NumberFormat().format(Math.round(num))

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            {/* Division Hero */}
            <div className="text-center mb-10">
                <div className="flex items-center justify-center gap-4 mb-3">
                    {rankImg && (
                        <img src={rankImg} alt="" className="h-16 w-16 object-contain" />
                    )}
                    <div>
                        <p className="text-sm text-(--color-text-secondary) uppercase tracking-wider">
                            {league?.name}
                        </p>
                        <h1 className="font-heading text-4xl font-bold text-(--color-text)">
                            {division?.name}
                        </h1>
                    </div>
                </div>
                {season && (
                    <p className="text-(--color-text-secondary)">
                        <span className="inline-flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                            {season.name}
                        </span>
                    </p>
                )}
            </div>

            {/* Quick Stats — clickable */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
                {[
                    { label: 'Teams',          value: teams?.length || 0, link: `${basePath}/teams` },
                    { label: 'Players',        value: players?.length || 0, link: `${basePath}/stats` },
                    { label: 'Matches Played', value: statsError ? '—' : (seasonStats?.total_matches ?? '—'), link: `${basePath}/matches` },
                    { label: 'Total Kills',    value: statsError ? '—' : (seasonStats?.total_kills ? formatNumber(seasonStats.total_kills) : '—'), link: `${basePath}/stats` },
                ].map(stat => (
                    <Link
                        key={stat.label}
                        to={stat.link}
                        className="bg-(--color-secondary) rounded-xl border border-white/10 p-5 text-center group hover:border-(--color-accent)/40 transition-all duration-200"
                    >
                        <div className="text-3xl font-bold text-(--color-text) font-heading group-hover:text-(--color-accent) transition-colors">
                            {stat.value}
                        </div>
                        <div className="text-sm text-(--color-text-secondary)">{stat.label}</div>
                    </Link>
                ))}
            </div>

            {/* Feature Banners */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                <Link
                    to={`${basePath}/standings`}
                    className="group relative overflow-hidden rounded-xl border border-white/10 bg-(--color-secondary) p-6 hover:border-(--color-accent)/40 transition-all duration-300 hover:-translate-y-0.5"
                >
                    <div className="text-3xl mb-3">🏆</div>
                    <h3 className="font-heading text-xl font-bold text-(--color-text) mb-2 group-hover:text-(--color-accent) transition-colors">
                        Standings
                    </h3>
                    <p className="text-sm text-(--color-text-secondary)">
                        View the current division standings and team records.
                    </p>
                    <div className="absolute top-6 right-5 text-(--color-text-secondary) group-hover:text-(--color-accent) transition-all group-hover:translate-x-1 text-lg">→</div>
                </Link>

                <Link
                    to={`${basePath}/matches`}
                    className="group relative overflow-hidden rounded-xl border border-white/10 bg-(--color-secondary) p-6 hover:border-(--color-accent)/40 transition-all duration-300 hover:-translate-y-0.5"
                >
                    <div className="text-3xl mb-3">📅</div>
                    <h3 className="font-heading text-xl font-bold text-(--color-text) mb-2 group-hover:text-(--color-accent) transition-colors">
                        Schedule & Results
                    </h3>
                    <p className="text-sm text-(--color-text-secondary)">
                        Upcoming matches and past results for the current season.
                    </p>
                    <div className="absolute top-6 right-5 text-(--color-text-secondary) group-hover:text-(--color-accent) transition-all group-hover:translate-x-1 text-lg">→</div>
                </Link>

                <Link
                    to={`${basePath}/stats`}
                    className="group relative overflow-hidden rounded-xl border border-white/10 bg-(--color-secondary) p-6 hover:border-(--color-accent)/40 transition-all duration-300 hover:-translate-y-0.5"
                >
                    <div className="text-3xl mb-3">📊</div>
                    <h3 className="font-heading text-xl font-bold text-(--color-text) mb-2 group-hover:text-(--color-accent) transition-colors">
                        Player Stats
                    </h3>
                    <p className="text-sm text-(--color-text-secondary)">
                        Full player statistics with KDA, win rates, damage, and more.
                    </p>
                    <div className="absolute top-6 right-5 text-(--color-text-secondary) group-hover:text-(--color-accent) transition-all group-hover:translate-x-1 text-lg">→</div>
                </Link>

                <Link
                    to={`${basePath}/rankings`}
                    className="group relative overflow-hidden rounded-xl border border-(--color-accent)/30 bg-gradient-to-br from-(--color-secondary) to-(--color-accent)/5 p-6 hover:border-(--color-accent)/60 transition-all duration-300 hover:-translate-y-0.5"
                >
                    <div className="text-3xl mb-3">⚔️</div>
                    <h3 className="font-heading text-xl font-bold text-(--color-accent) mb-2">
                        Create Tierlist
                    </h3>
                    <p className="text-sm text-(--color-text-secondary)">
                        Rank players by role with drag-and-drop. Save and share your picks.
                    </p>
                    <div className="absolute top-6 right-5 text-(--color-accent) transition-all group-hover:translate-x-1 text-lg">→</div>
                </Link>
            </div>

            {/* Teams Preview */}
            {teams && teams.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-heading text-xl font-bold text-(--color-text)">Teams</h2>
                        <Link to={`${basePath}/teams`} className="text-sm text-(--color-accent) hover:underline">
                            View all →
                        </Link>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
                        {teams.map(team => (
                            <Link
                                key={team.id}
                                to={`${basePath}/teams/${team.slug}`}
                                className="group rounded-lg border border-white/10 bg-(--color-secondary) p-4 text-center hover:border-white/20 transition-all"
                            >
                                <div
                                    className="w-3 h-3 rounded-full mx-auto mb-2"
                                    style={{ backgroundColor: team.color }}
                                />
                                <div className="text-sm font-semibold text-(--color-text) group-hover:text-(--color-accent) transition-colors truncate">
                                    {team.name}
                                </div>
                                <div className="text-xs text-(--color-text-secondary)">
                                    {players?.filter(p => p.team_id === team.id).length || 0} players
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

export default DivisionOverview
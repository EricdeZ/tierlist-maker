// src/components/PlayerList.jsx - Refactored to use DivisionContext via usePlayerStats
import { useState, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePlayerStats } from '../hooks/usePlayerStats'
import { useDivision } from '../context/DivisionContext'

import soloImage from '../assets/roles/solo.webp'
import jungleImage from '../assets/roles/jungle.webp'
import midImage from '../assets/roles/mid.webp'
import suppImage from '../assets/roles/supp.webp'
import adcImage from '../assets/roles/adc.webp'

const PlayerList = () => {
    const { leagueSlug, divisionSlug } = useParams()
    const basePath = `/${leagueSlug}/${divisionSlug}`

    // Get raw players/teams from context for slug lookups
    const { players: rawPlayers, teams: rawTeams } = useDivision()

    const [searchTerm, setSearchTerm] = useState('')
    const [sortBy, setSortBy] = useState('name')
    const [sortOrder, setSortOrder] = useState('asc')
    const [roleFilter, setRoleFilter] = useState('all')
    const [teamFilter, setTeamFilter] = useState('all')

    const roleImages = {
        'SOLO': soloImage,
        'JUNGLE': jungleImage,
        'MID': midImage,
        'SUPPORT': suppImage,
        'ADC': adcImage
    }

    // Fetch player stats via DivisionContext
    const { data: processedPlayers, loading, error, season } = usePlayerStats()

    // Build lookup maps for slugs
    const playerSlugMap = useMemo(() => {
        if (!rawPlayers) return {}
        return Object.fromEntries(rawPlayers.map(p => [p.id, p.slug]))
    }, [rawPlayers])

    const teamSlugMap = useMemo(() => {
        if (!rawTeams) return {}
        return Object.fromEntries(rawTeams.map(t => [t.name, t.slug]))
    }, [rawTeams])

    // Filter and sort players
    const filteredAndSortedPlayers = useMemo(() => {
        if (!processedPlayers) return []

        let filtered = processedPlayers.filter(player => {
            const matchesSearch = player.name.toLowerCase().includes(searchTerm.toLowerCase())
            const matchesRole = roleFilter === 'all' || player.role.toLowerCase() === roleFilter.toLowerCase()
            const matchesTeam = teamFilter === 'all' || player.team.name === teamFilter
            return matchesSearch && matchesRole && matchesTeam
        })

        filtered.sort((a, b) => {
            let aValue, bValue

            switch (sortBy) {
                case 'name':
                    aValue = a.name.toLowerCase()
                    bValue = b.name.toLowerCase()
                    break
                case 'role':
                    aValue = a.role.toLowerCase()
                    bValue = b.role.toLowerCase()
                    break
                case 'team':
                    aValue = a.team.name.toLowerCase()
                    bValue = b.team.name.toLowerCase()
                    break
                case 'kills':
                    aValue = a.stats.kills
                    bValue = b.stats.kills
                    break
                case 'deaths':
                    aValue = a.stats.deaths
                    bValue = b.stats.deaths
                    break
                case 'assists':
                    aValue = a.stats.assists
                    bValue = b.stats.assists
                    break
                case 'kda':
                    aValue = a.kda
                    bValue = b.kda
                    break
                case 'winRate':
                    aValue = a.winRate
                    bValue = b.winRate
                    break
                case 'gamesPlayed':
                    aValue = a.stats.gamesPlayed
                    bValue = b.stats.gamesPlayed
                    break
                case 'damage':
                    aValue = a.stats.damage
                    bValue = b.stats.damage
                    break
                default:
                    return 0
            }

            if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
            if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
            return 0
        })

        return filtered
    }, [processedPlayers, searchTerm, roleFilter, teamFilter, sortBy, sortOrder])

    const handleSort = (column) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            setSortBy(column)
            setSortOrder('asc')
        }
    }

    const getSortIcon = (column) => {
        if (sortBy !== column) return ''
        return sortOrder === 'asc' ? '↑' : '↓'
    }

    const formatNumber = (num) => new Intl.NumberFormat().format(Math.round(num))

    const uniqueRoles = useMemo(() => {
        if (!processedPlayers) return []
        return [...new Set(processedPlayers.map(p => p.role).filter(Boolean))]
    }, [processedPlayers])

    const uniqueTeams = useMemo(() => {
        if (!processedPlayers) return []
        return [...new Set(processedPlayers.map(p => p.team.name))]
    }, [processedPlayers])

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-(--color-accent) mx-auto mb-4"></div>
                    <p className="text-(--color-text-secondary)">Loading player statistics...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-4 bg-red-900/30 border border-red-500/30 rounded-xl">
                <h3 className="font-bold text-red-400">Failed to Load Player Stats</h3>
                <p className="text-red-300/80">{error}</p>
            </div>
        )
    }

    if (!processedPlayers || processedPlayers.length === 0) {
        return (
            <div className="p-4 bg-yellow-900/30 border border-yellow-500/30 rounded-xl">
                <h3 className="font-bold text-yellow-400">No Player Data Available</h3>
                <p className="text-yellow-300/80">No player statistics found for the current season.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <h1 className="text-3xl font-bold mb-2 font-heading">Player Statistics</h1>
                <p className="text-(--color-text-secondary)">
                    Complete player stats for {season?.name || 'current season'}
                </p>
            </div>

            {/* Controls */}
            <div className="bg-(--color-secondary) rounded-xl border border-white/10 p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label htmlFor="search" className="block text-sm font-medium text-(--color-text-secondary) mb-1">
                            Search Players
                        </label>
                        <input
                            id="search"
                            type="text"
                            placeholder="Search by name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-3 py-2 bg-(--color-primary) border border-white/10 rounded-md text-(--color-text) focus:outline-none focus:ring-2 focus:ring-(--color-accent)/50"
                        />
                    </div>
                    <div>
                        <label htmlFor="roleFilter" className="block text-sm font-medium text-(--color-text-secondary) mb-1">
                            Filter by Role
                        </label>
                        <select
                            id="roleFilter"
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="w-full px-3 py-2 bg-(--color-primary) border border-white/10 rounded-md text-(--color-text) focus:outline-none focus:ring-2 focus:ring-(--color-accent)/50"
                        >
                            <option value="all">All Roles</option>
                            {uniqueRoles.map(role => (
                                <option key={role} value={role}>{role}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="teamFilter" className="block text-sm font-medium text-(--color-text-secondary) mb-1">
                            Filter by Team
                        </label>
                        <select
                            id="teamFilter"
                            value={teamFilter}
                            onChange={(e) => setTeamFilter(e.target.value)}
                            className="w-full px-3 py-2 bg-(--color-primary) border border-white/10 rounded-md text-(--color-text) focus:outline-none focus:ring-2 focus:ring-(--color-accent)/50"
                        >
                            <option value="all">All Teams</option>
                            {uniqueTeams.map(team => (
                                <option key={team} value={team}>{team}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-end">
                        <div className="text-sm text-(--color-text-secondary)">
                            Showing {filteredAndSortedPlayers.length} of {processedPlayers.length} players
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Table */}
            <div className="bg-(--color-secondary) rounded-xl border border-white/10 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-white/10">
                        <thead className="bg-white/5 text-center">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider cursor-pointer hover:bg-white/5" onClick={() => handleSort('name')}>
                                Player {getSortIcon('name')}
                            </th>
                            <th className="px-4 py-3 text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Tracker</th>
                            <th className="px-4 py-3 text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider cursor-pointer hover:bg-white/5" onClick={() => handleSort('role')}>
                                Role {getSortIcon('role')}
                            </th>
                            <th className="px-4 py-3 text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider cursor-pointer hover:bg-white/5" onClick={() => handleSort('gamesPlayed')}>
                                Games {getSortIcon('gamesPlayed')}
                            </th>
                            <th className="px-4 py-3 text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider cursor-pointer hover:bg-white/5" onClick={() => handleSort('kills')}>
                                Kills {getSortIcon('kills')}
                            </th>
                            <th className="px-4 py-3 text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider cursor-pointer hover:bg-white/5" onClick={() => handleSort('deaths')}>
                                Deaths {getSortIcon('deaths')}
                            </th>
                            <th className="px-4 py-3 text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider cursor-pointer hover:bg-white/5" onClick={() => handleSort('assists')}>
                                Assists {getSortIcon('assists')}
                            </th>
                            <th className="px-4 py-3 text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider cursor-pointer hover:bg-white/5" onClick={() => handleSort('kda')}>
                                KDA {getSortIcon('kda')}
                            </th>
                            <th className="px-4 py-3 text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider cursor-pointer hover:bg-white/5" onClick={() => handleSort('winRate')}>
                                Win Rate {getSortIcon('winRate')}
                            </th>
                            <th className="px-4 py-3 text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider cursor-pointer hover:bg-white/5" onClick={() => handleSort('damage')}>
                                Total Damage {getSortIcon('damage')}
                            </th>
                            <th className="px-4 py-3 text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider cursor-pointer hover:bg-white/5" onClick={() => handleSort('team')}>
                                Team {getSortIcon('team')}
                            </th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                        {filteredAndSortedPlayers.map((player, index) => {
                            const pSlug = playerSlugMap[player.id]
                            const tSlug = teamSlugMap[player.team.name]

                            return (
                                <tr key={player.id} className={index % 2 === 0 ? '' : 'bg-white/[0.02]'}>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                                        {pSlug ? (
                                            <Link
                                                to={`${basePath}/players/${pSlug}`}
                                                className="text-(--color-text) hover:text-(--color-accent) transition-colors"
                                            >
                                                {player.name}
                                            </Link>
                                        ) : (
                                            <span className="text-(--color-text)">{player.name}</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                                        {player.tracker ? (
                                            <a
                                                href={player.tracker}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="bg-(--color-accent) text-(--color-primary) px-2 py-1 rounded text-xs font-semibold hover:opacity-90 transition-opacity"
                                            >
                                                View Stats
                                            </a>
                                        ) : (
                                            <span className="text-(--color-text-secondary)/50 text-xs">No Tracker</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                                        <div className="flex gap-1 items-center justify-center">
                                            {player.role && roleImages[player.role.toUpperCase()] && (
                                                <img src={roleImages[player.role.toUpperCase()]} alt={player.role} className="w-8 h-8 object-contain" title={player.role} />
                                            )}
                                            {player.secondary_role && roleImages[player.secondary_role.toUpperCase()] && (
                                                <img src={roleImages[player.secondary_role.toUpperCase()]} alt={player.secondary_role} className="w-8 h-8 object-contain opacity-50" title={`Secondary: ${player.secondary_role}`} />
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-(--color-text) font-medium text-center">
                                        {player.stats.gamesPlayed}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-(--color-text) font-medium text-center">
                                        <div>{player.stats.kills}</div>
                                        <div className="text-xs text-(--color-text-secondary)">({player.avgStats.avgKills.toFixed(1)}/game)</div>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-(--color-text) font-medium text-center">
                                        <div>{player.stats.deaths}</div>
                                        <div className="text-xs text-(--color-text-secondary)">({player.avgStats.avgDeaths.toFixed(1)}/game)</div>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-(--color-text) font-medium text-center">
                                        <div>{player.stats.assists}</div>
                                        <div className="text-xs text-(--color-text-secondary)">({player.avgStats.avgAssists.toFixed(1)}/game)</div>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-center">
                                        <span className={`${
                                            player.kda >= 2 ? 'text-green-400' :
                                                player.kda >= 1.5 ? 'text-yellow-400' : 'text-red-400'
                                        }`}>
                                            {player.kda.toFixed(2)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-center">
                                        <span className={`${
                                            player.winRate >= 60 ? 'text-green-400' :
                                                player.winRate >= 45 ? 'text-yellow-400' : 'text-red-400'
                                        }`}>
                                            {player.winRate.toFixed(0)}%
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-(--color-text) font-medium text-center">
                                        <div>{formatNumber(player.stats.damage)}</div>
                                        <div className="text-xs text-(--color-text-secondary)">({formatNumber(player.avgStats.avgDamage)}/game)</div>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                                        {tSlug ? (
                                            <Link
                                                to={`${basePath}/teams/${tSlug}`}
                                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white w-full text-center justify-center hover:opacity-80 transition-opacity"
                                                style={{ backgroundColor: player.team.color }}
                                            >
                                                {player.team.name}
                                            </Link>
                                        ) : (
                                            <span
                                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white w-full text-center justify-center"
                                                style={{ backgroundColor: player.team.color }}
                                            >
                                                {player.team.name}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                        </tbody>
                    </table>
                </div>

                {filteredAndSortedPlayers.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-(--color-text-secondary) text-lg">No players found matching your criteria</p>
                        <p className="text-(--color-text-secondary)/50 text-sm mt-2">Try adjusting your search or filters</p>
                    </div>
                )}
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                {[
                    { label: 'Total Kills', value: filteredAndSortedPlayers.reduce((sum, p) => sum + p.stats.kills, 0) },
                    { label: 'Total Deaths', value: filteredAndSortedPlayers.reduce((sum, p) => sum + p.stats.deaths, 0) },
                    { label: 'Total Assists', value: filteredAndSortedPlayers.reduce((sum, p) => sum + p.stats.assists, 0) },
                    { label: 'Average KDA', value: filteredAndSortedPlayers.length > 0 ? (filteredAndSortedPlayers.reduce((sum, p) => sum + p.kda, 0) / filteredAndSortedPlayers.length).toFixed(2) : '0.00' },
                    { label: 'Average Win Rate', value: filteredAndSortedPlayers.length > 0 ? (filteredAndSortedPlayers.reduce((sum, p) => sum + p.winRate, 0) / filteredAndSortedPlayers.length).toFixed(0) + '%' : '0%' },
                    { label: 'Total Damage', value: formatNumber(filteredAndSortedPlayers.reduce((sum, p) => sum + p.stats.damage, 0)) },
                ].map(stat => (
                    <div key={stat.label} className="bg-(--color-secondary) rounded-xl border border-white/10 p-4 text-center">
                        <div className="text-xl font-bold text-(--color-text)">{stat.value}</div>
                        <div className="text-xs text-(--color-text-secondary)">{stat.label}</div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default PlayerList
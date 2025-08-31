// src/components/PlayerList.jsx
import { useState, useMemo } from 'react'
import playersData from '../data/players.json'
import teamsData from '../data/teams.json'
import gamesData from '../data/games.json'

const PlayerList = () => {
    const [searchTerm, setSearchTerm] = useState('')
    const [sortBy, setSortBy] = useState('name')
    const [sortOrder, setSortOrder] = useState('asc')
    const [roleFilter, setRoleFilter] = useState('all')
    const [teamFilter, setTeamFilter] = useState('all')

    // Utility functions to calculate player statistics from games
    const getPlayerStatsFromGames = (playerName) => {
        let totalKills = 0
        let totalDeaths = 0
        let totalAssists = 0
        let totalDamage = 0
        let totalMitigated = 0
        let gamesPlayed = 0

        gamesData.forEach(game => {
            const playerGameData = game.players.find(p => p.playerName === playerName)
            if (playerGameData) {
                totalKills += playerGameData.kills
                totalDeaths += playerGameData.deaths
                totalAssists += playerGameData.assists
                totalDamage += playerGameData.damage
                totalMitigated += playerGameData.mitigated
                gamesPlayed++
            }
        })

        return {
            kills: totalKills,
            deaths: totalDeaths,
            assists: totalAssists,
            damage: totalDamage,
            mitigated: totalMitigated,
            gamesPlayed
        }
    }

    const getPlayerTeam = (playerName) => {
        return teamsData.find(team => team.players.includes(playerName))
    }

    const calculateKDA = (kills, deaths, assists) => {
        if (deaths === 0) return kills + (assists / 2)
        return (kills + (assists / 2)) / deaths
    }

    const getPlayerWinRate = (playerName) => {
        let wins = 0
        let totalGames = 0

        gamesData.forEach(game => {
            const playerGameData = game.players.find(p => p.playerName === playerName)
            if (playerGameData) {
                totalGames++

                // Determine which team the player was on
                const team1Players = game.players.slice(0, 5).map(p => p.playerName)
                const isTeam1 = team1Players.includes(playerName)

                // Check if player's team won
                if ((isTeam1 && game.score.team1 > game.score.team2) ||
                    (!isTeam1 && game.score.team2 > game.score.team1)) {
                    wins++
                }
            }
        })

        return totalGames > 0 ? (wins / totalGames) * 100 : 0
    }

    const getAverageStats = (playerName) => {
        const stats = getPlayerStatsFromGames(playerName)
        if (stats.gamesPlayed === 0) return { ...stats, avgKills: 0, avgDeaths: 0, avgAssists: 0, avgDamage: 0, avgMitigated: 0 }

        return {
            ...stats,
            avgKills: stats.kills / stats.gamesPlayed,
            avgDeaths: stats.deaths / stats.gamesPlayed,
            avgAssists: stats.assists / stats.gamesPlayed,
            avgDamage: stats.damage / stats.gamesPlayed,
            avgMitigated: stats.mitigated / stats.gamesPlayed
        }
    }

    // Process player data
    const processedPlayers = useMemo(() => {
        return playersData.map(player => {
            const team = getPlayerTeam(player.name)
            const stats = getPlayerStatsFromGames(player.name)
            const avgStats = getAverageStats(player.name)
            const kda = calculateKDA(stats.kills, stats.deaths, stats.assists)
            const winRate = getPlayerWinRate(player.name)

            return {
                ...player,
                team: team || { name: 'No Team', color: '#6b7280' },
                stats,
                avgStats,
                kda,
                winRate
            }
        })
    }, [])

    // Filter and sort players
    const filteredAndSortedPlayers = useMemo(() => {
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

    const formatNumber = (num) => {
        return new Intl.NumberFormat().format(Math.round(num))
    }

    const uniqueRoles = [...new Set(playersData.map(p => p.role).filter(Boolean))]
    const uniqueTeams = [...new Set(teamsData.map(t => t.name))]

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Player Statistics</h1>
                <p className="text-gray-600">Complete player stats calculated from {gamesData.length} recorded games</p>
            </div>

            {/* Controls */}
            <div className="bg-white rounded-lg shadow p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Search */}
                    <div>
                        <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                            Search Players
                        </label>
                        <input
                            id="search"
                            type="text"
                            placeholder="Search by name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Role Filter */}
                    <div>
                        <label htmlFor="roleFilter" className="block text-sm font-medium text-gray-700 mb-1">
                            Filter by Role
                        </label>
                        <select
                            id="roleFilter"
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">All Roles</option>
                            {uniqueRoles.map(role => (
                                <option key={role} value={role}>{role}</option>
                            ))}
                        </select>
                    </div>

                    {/* Team Filter */}
                    <div>
                        <label htmlFor="teamFilter" className="block text-sm font-medium text-gray-700 mb-1">
                            Filter by Team
                        </label>
                        <select
                            id="teamFilter"
                            value={teamFilter}
                            onChange={(e) => setTeamFilter(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">All Teams</option>
                            {uniqueTeams.map(team => (
                                <option key={team} value={team}>{team}</option>
                            ))}
                        </select>
                    </div>

                    {/* Results Count */}
                    <div className="flex items-end">
                        <div className="text-sm text-gray-600">
                            Showing {filteredAndSortedPlayers.length} of {processedPlayers.length} players
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                        <tr>
                            <th
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('name')}
                            >
                                Player {getSortIcon('name')}
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Tracker
                            </th>
                            <th
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('role')}
                            >
                                Role {getSortIcon('role')}
                            </th>
                            <th
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('gamesPlayed')}
                            >
                                Games {getSortIcon('gamesPlayed')}
                            </th>
                            <th
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('kills')}
                            >
                                Kills {getSortIcon('kills')}
                            </th>
                            <th
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('deaths')}
                            >
                                Deaths {getSortIcon('deaths')}
                            </th>
                            <th
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('assists')}
                            >
                                Assists {getSortIcon('assists')}
                            </th>
                            <th
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('kda')}
                            >
                                KDA {getSortIcon('kda')}
                            </th>
                            <th
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('winRate')}
                            >
                                Win Rate {getSortIcon('winRate')}
                            </th>
                            <th
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('damage')}
                            >
                                Total Damage {getSortIcon('damage')}
                            </th>
                            <th
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('team')}
                            >
                                Team {getSortIcon('team')}
                            </th>
                        </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                        {filteredAndSortedPlayers.map((player, index) => (
                            <tr
                                key={player.id}
                                className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                            >
                                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {player.name}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {player.tracker ? (
                                        <a
                                            href={player.tracker}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700 transition-colors"
                                        >
                                            View Stats
                                        </a>
                                    ) : (
                                        <span className="text-gray-400 text-xs">No Tracker</span>
                                    )}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 w-full text-center justify-center">
                      {player.role || 'N/A'}
                    </span>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 font-medium text-center">
                                    {player.stats.gamesPlayed}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 font-medium text-center">
                                    <div>{player.stats.kills}</div>
                                    <div className="text-xs text-gray-500">({player.avgStats.avgKills.toFixed(1)}/game)</div>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 font-medium text-center">
                                    <div>{player.stats.deaths}</div>
                                    <div className="text-xs text-gray-500">({player.avgStats.avgDeaths.toFixed(1)}/game)</div>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 font-medium text-center">
                                    <div>{player.stats.assists}</div>
                                    <div className="text-xs text-gray-500">({player.avgStats.avgAssists.toFixed(1)}/game)</div>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 font-bold text-center">
                    <span className={`${
                        player.kda >= 2 ? 'text-green-600' :
                            player.kda >= 1.5 ? 'text-yellow-600' :
                                'text-red-600'
                    }`}>
                      {player.kda.toFixed(2)}
                    </span>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 font-medium text-center">
                    <span className={`${
                        player.winRate >= 60 ? 'text-green-600' :
                            player.winRate >= 45 ? 'text-yellow-600' :
                                'text-red-600'
                    }`}>
                      {player.winRate.toFixed(0)}%
                    </span>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 font-medium text-center">
                                    <div>{formatNumber(player.stats.damage)}</div>
                                    <div className="text-xs text-gray-500">({formatNumber(player.avgStats.avgDamage)}/game)</div>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white w-full text-center justify-center"
                        style={{ backgroundColor: player.team.color }}
                    >
                      {player.team.name}
                    </span>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>

                {filteredAndSortedPlayers.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-gray-500 text-lg">No players found matching your criteria</p>
                        <p className="text-gray-400 text-sm mt-2">Try adjusting your search or filters</p>
                    </div>
                )}
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <div className="bg-white rounded-lg shadow p-4 text-center">
                    <div className="text-xl font-bold text-gray-900">
                        {filteredAndSortedPlayers.reduce((sum, p) => sum + p.stats.kills, 0)}
                    </div>
                    <div className="text-xs text-gray-500">Total Kills</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4 text-center">
                    <div className="text-xl font-bold text-gray-900">
                        {filteredAndSortedPlayers.reduce((sum, p) => sum + p.stats.deaths, 0)}
                    </div>
                    <div className="text-xs text-gray-500">Total Deaths</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4 text-center">
                    <div className="text-xl font-bold text-gray-900">
                        {filteredAndSortedPlayers.reduce((sum, p) => sum + p.stats.assists, 0)}
                    </div>
                    <div className="text-xs text-gray-500">Total Assists</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4 text-center">
                    <div className="text-xl font-bold text-gray-900">
                        {filteredAndSortedPlayers.length > 0 ?
                            (filteredAndSortedPlayers.reduce((sum, p) => sum + p.kda, 0) / filteredAndSortedPlayers.length).toFixed(2) :
                            '0.00'
                        }
                    </div>
                    <div className="text-xs text-gray-500">Average KDA</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4 text-center">
                    <div className="text-xl font-bold text-gray-900">
                        {filteredAndSortedPlayers.length > 0 ?
                            (filteredAndSortedPlayers.reduce((sum, p) => sum + p.winRate, 0) / filteredAndSortedPlayers.length).toFixed(0) :
                            '0'
                        }%
                    </div>
                    <div className="text-xs text-gray-500">Average Win Rate</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4 text-center">
                    <div className="text-xl font-bold text-gray-900">
                        {formatNumber(filteredAndSortedPlayers.reduce((sum, p) => sum + p.stats.damage, 0))}
                    </div>
                    <div className="text-xs text-gray-500">Total Damage</div>
                </div>
            </div>
        </div>
    )
}

export default PlayerList
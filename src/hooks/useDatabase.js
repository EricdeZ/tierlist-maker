// src/hooks/useDatabase.js
import { useState, useEffect, useCallback, useRef } from 'react'
import { leagueService, teamService, playerService, matchService, statsService } from '../services/database'

// Simple in-memory cache
const cache = new Map()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

const getCacheKey = (functionName, params) => {
    return `${functionName}_${JSON.stringify(params)}`
}

const getCachedData = (key) => {
    const cached = cache.get(key)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data
    }
    return null
}

const setCachedData = (key, data) => {
    cache.set(key, {
        data,
        timestamp: Date.now()
    })
}

// Generic data fetching hook with caching and rate limiting
const useApiData = (fetchFunction, dependencies = [], cacheKey = null) => {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const lastFetchRef = useRef(0)
    const minFetchInterval = 1000 // Minimum 1 second between requests

    const refetch = useCallback(async (forceRefresh = false) => {
        const now = Date.now()
        const timeSinceLastFetch = now - lastFetchRef.current

        // Rate limiting: don't fetch if less than minFetchInterval has passed
        if (!forceRefresh && timeSinceLastFetch < minFetchInterval) {
            console.log('Rate limiting: skipping fetch, too soon since last request')
            return
        }

        // Check cache first
        if (!forceRefresh && cacheKey) {
            const cachedResult = getCachedData(cacheKey)
            if (cachedResult) {
                console.log('Using cached data for:', cacheKey)
                setData(cachedResult)
                setLoading(false)
                return
            }
        }

        try {
            setLoading(true)
            setError(null)
            lastFetchRef.current = now

            console.log('Fetching fresh data for:', cacheKey || 'uncached request')
            const result = await fetchFunction()

            setData(result)

            // Cache the result
            if (cacheKey) {
                setCachedData(cacheKey, result)
            }
        } catch (err) {
            console.error('API fetch error:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [fetchFunction, cacheKey])

    useEffect(() => {
        refetch()
    }, dependencies)

    return { data, loading, error, refetch }
}

// League hooks
export const useLeagues = () => {
    return useApiData(
        () => leagueService.getAll(),
        [],
        'leagues_all'
    )
}

export const useLeague = (slug) => {
    return useApiData(
        () => leagueService.getBySlug(slug),
        [slug],
        `league_${slug}`
    )
}

// Team hooks
export const useTeams = (leagueId) => {
    return useApiData(
        () => teamService.getAllByLeague(leagueId),
        [leagueId],
        `teams_${leagueId}`
    )
}

export const useTeamWithPlayers = (teamSlug) => {
    return useApiData(
        () => teamService.getTeamWithPlayers(teamSlug),
        [teamSlug],
        `team_players_${teamSlug}`
    )
}

// Player hooks
export const usePlayers = (leagueId) => {
    return useApiData(
        () => playerService.getAllByLeague(leagueId),
        [leagueId],
        `players_${leagueId}`
    )
}

export const usePlayerStats = (playerId, leagueId) => {
    return useApiData(
        () => playerService.getPlayerSummaryStats(playerId, leagueId),
        [playerId, leagueId],
        `player_stats_${playerId}_${leagueId}`
    )
}

// Match hooks
export const useMatches = (leagueId, limit = null) => {
    return useApiData(
        () => matchService.getAllByLeague(leagueId, limit),
        [leagueId, limit],
        `matches_${leagueId}_${limit || 'all'}`
    )
}

export const useRecentMatches = (leagueId, limit = 5) => {
    return useApiData(
        () => matchService.getRecentMatches(leagueId, limit),
        [leagueId, limit],
        `recent_matches_${leagueId}_${limit}`
    )
}

// Stats hooks
export const useLeagueStats = (leagueId) => {
    return useApiData(
        () => statsService.getLeagueStats(leagueId),
        [leagueId],
        `league_stats_${leagueId}`
    )
}

// League context hook for managing current league
export const useBabylonLeague = () => {
    const { data: leagues, loading, error } = useLeagues()

    const babylonLeague = leagues?.find(l => l.slug === 'babylon-league')

    return {
        league: babylonLeague,
        loading,
        error,
        leagueId: babylonLeague?.id
    }
}

// Combined hook for components that need teams formatted like your JSON
export const useTeamsLegacyFormat = (leagueId) => {
    const { data: teams, loading: teamsLoading, error: teamsError } = useTeams(leagueId)
    const { data: players, loading: playersLoading, error: playersError } = usePlayers(leagueId)

    const [formattedTeams, setFormattedTeams] = useState([])

    useEffect(() => {
        if (teams && players) {
            // Transform database format to match your existing JSON structure
            const formatted = teams.map(team => {
                // Find players for this team with their roles
                const teamPlayers = players
                    .filter(p => p.team_id === team.id)
                    .map(p => ({
                        name: p.name,
                        role: p.role // Include role information for role icons
                    }))

                return {
                    id: team.slug,
                    name: team.name,
                    color: team.color,
                    players: teamPlayers.map(p => p.name), // Keep player names for compatibility
                    playersWithRoles: teamPlayers // Add detailed player info with roles
                }
            })

            setFormattedTeams(formatted)
        }
    }, [teams, players])

    return {
        data: formattedTeams,
        loading: teamsLoading || playersLoading,
        error: teamsError || playersError
    }
}

// Combined hook for components that need players formatted like your JSON
export const usePlayersLegacyFormat = (leagueId) => {
    const { data: players, loading, error } = usePlayers(leagueId)

    const [formattedPlayers, setFormattedPlayers] = useState([])

    useEffect(() => {
        if (players) {
            // Transform database format to match your existing JSON structure
            const formatted = players.map(player => ({
                name: player.name,
                id: player.slug,
                tracker: player.tracker_url || '',
                role: player.role || ''
            }))

            setFormattedPlayers(formatted)
        }
    }, [players])

    return {
        data: formattedPlayers,
        loading,
        error
    }
}

// Hook for getting comprehensive player stats (like your current PlayerList component uses)
export const usePlayerStatsLegacyFormat = (leagueId) => {
    const { data: players, loading: playersLoading, error: playersError } = usePlayers(leagueId)
    const [playerStats, setPlayerStats] = useState([])
    const [statsLoading, setStatsLoading] = useState(false)

    useEffect(() => {
        if (!players || players.length === 0) return

        const fetchAllPlayerStats = async () => {
            setStatsLoading(true)
            try {
                // For now, we'll use the existing JSON calculation logic
                // Later this can be replaced with API calls to get real stats
                const gamesData = await import('../data/games.json')

                const playersWithStats = players.map(player => {
                    // Calculate stats from games JSON for this player
                    let totalKills = 0, totalDeaths = 0, totalAssists = 0, totalDamage = 0, totalMitigated = 0, gamesPlayed = 0

                    gamesData.default.forEach(game => {
                        const playerGameData = game.players.find(p => p.playerName === player.name)
                        if (playerGameData) {
                            totalKills += playerGameData.kills
                            totalDeaths += playerGameData.deaths
                            totalAssists += playerGameData.assists
                            totalDamage += playerGameData.damage
                            totalMitigated += playerGameData.mitigated
                            gamesPlayed++
                        }
                    })

                    const kda = totalDeaths === 0 ? totalKills + (totalAssists / 2) : (totalKills + (totalAssists / 2)) / totalDeaths

                    return {
                        ...player,
                        stats: {
                            kills: totalKills,
                            deaths: totalDeaths,
                            assists: totalAssists,
                            damage: totalDamage,
                            mitigated: totalMitigated,
                            gamesPlayed
                        },
                        avgStats: {
                            avgKills: gamesPlayed > 0 ? totalKills / gamesPlayed : 0,
                            avgDeaths: gamesPlayed > 0 ? totalDeaths / gamesPlayed : 0,
                            avgAssists: gamesPlayed > 0 ? totalAssists / gamesPlayed : 0,
                            avgDamage: gamesPlayed > 0 ? totalDamage / gamesPlayed : 0,
                            avgMitigated: gamesPlayed > 0 ? totalMitigated / gamesPlayed : 0
                        },
                        kda,
                        winRate: 50 // Placeholder - would need match data to calculate properly
                    }
                })

                setPlayerStats(playersWithStats)
            } catch (error) {
                console.error('Error calculating player stats:', error)
            } finally {
                setStatsLoading(false)
            }
        }

        fetchAllPlayerStats()
    }, [players])

    return {
        data: playerStats,
        loading: playersLoading || statsLoading,
        error: playersError
    }
}
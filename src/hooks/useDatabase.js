// src/hooks/useDatabase.js
import { useState, useEffect, useCallback, useRef } from 'react'
import { leagueService, teamService, playerService, matchService, statsService } from '../services/database'

// League configuration - change this to switch leagues
const CURRENT_LEAGUE_SLUG = 'babylon-league' // Change this to 'babylon-league-test' for testing

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

// Single hook that loads everything sequentially for current league
export const useCurrentLeagueData = () => {
    const [state, setState] = useState({
        league: null,
        teams: [],
        players: [],
        loading: true,
        error: null
    })

    useEffect(() => {
        const cacheKey = `league_data_${CURRENT_LEAGUE_SLUG}`

        // Check cache first
        const cachedData = getCachedData(cacheKey)
        if (cachedData) {
            console.log('Using cached league data')
            setState({
                ...cachedData,
                loading: false,
                error: null
            })
            return
        }

        const loadAllData = async () => {
            try {
                setState(prev => ({ ...prev, loading: true, error: null }))

                // Step 1: Get current league
                console.log('Loading league data...')
                const leagues = await leagueService.getAll()
                const league = leagues.find(l => l.slug === CURRENT_LEAGUE_SLUG)

                if (!league) {
                    throw new Error(`League "${CURRENT_LEAGUE_SLUG}" not found`)
                }

                // Step 2: Get teams and players for this league
                console.log('Loading teams and players...')
                const [teams, players] = await Promise.all([
                    teamService.getAllByLeague(league.id),
                    playerService.getAllByLeague(league.id)
                ])

                const result = {
                    league,
                    teams,
                    players
                }

                // Cache the result
                setCachedData(cacheKey, result)

                setState({
                    ...result,
                    loading: false,
                    error: null
                })

            } catch (error) {
                console.error('Failed to load league data:', error)
                setState(prev => ({
                    ...prev,
                    loading: false,
                    error: error.message
                }))
            }
        }

        loadAllData()
    }, []) // Only run once on mount

    return state
}

// Hook for teams with player roles (for rankings page)
export const useCurrentTeamsWithPlayers = () => {
    const { league, teams, players, loading, error } = useCurrentLeagueData()
    const [formattedTeams, setFormattedTeams] = useState([])

    useEffect(() => {
        if (teams && players) {
            const formatted = teams.map(team => {
                const teamPlayers = players
                    .filter(p => p.team_id === team.id)
                    .map(p => ({
                        name: p.name,
                        role: p.role
                    }))

                return {
                    id: team.slug,
                    name: team.name,
                    color: team.color,
                    players: teamPlayers.map(p => p.name), // For compatibility
                    playersWithRoles: teamPlayers // For role icons
                }
            })

            setFormattedTeams(formatted)
        }
    }, [teams, players])

    return {
        data: formattedTeams,
        loading,
        error,
        league
    }
}

// Hook for player stats (for stats page)
export const useCurrentPlayerStats = () => {
    const { league, players, loading, error } = useCurrentLeagueData()
    const [formattedPlayers, setFormattedPlayers] = useState([])
    const [statsLoading, setStatsLoading] = useState(false)

    useEffect(() => {
        if (!players || !league || statsLoading) return

        const formatPlayersForList = async () => {
            setStatsLoading(true)
            try {
                // Import games data for stats calculation (temporary until we migrate game stats)
                const gamesData = await import('../data/games.json')

                const processedPlayers = players.map(player => {
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
                        id: player.id,
                        name: player.name,
                        tracker: player.tracker_url || '',
                        role: player.role || '',
                        team: {
                            name: player.team_name || 'No Team',
                            color: player.team_color || '#6b7280'
                        },
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
                        winRate: 50 // Placeholder
                    }
                })

                setFormattedPlayers(processedPlayers)
            } catch (error) {
                console.error('Error processing player stats:', error)
            } finally {
                setStatsLoading(false)
            }
        }

        formatPlayersForList()
    }, [players, league])

    return {
        data: formattedPlayers,
        loading: loading || statsLoading,
        error
    }
}
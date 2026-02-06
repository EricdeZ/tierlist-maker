// src/hooks/useDatabase.js
import { useState, useEffect, useCallback, useRef } from 'react'
import { leagueService, seasonService, teamService, playerService, matchService, statsService } from '../services/database'

// League configuration - change this to switch leagues
const CURRENT_LEAGUE_SLUG = 'test-league' // Changed from 'babylon-league'

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

// Single hook that loads everything for current season
export const useCurrentLeagueData = () => {
    const [state, setState] = useState({
        league: null,
        season: null,
        teams: [],
        players: [],
        loading: true,
        error: null
    })

    useEffect(() => {
        const cacheKey = `season_data_${CURRENT_LEAGUE_SLUG}`

        // Check cache first
        const cachedData = getCachedData(cacheKey)
        if (cachedData) {
            console.log('Using cached season data')
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

                // Step 1: Get league and active season
                console.log(`Loading league data for: ${CURRENT_LEAGUE_SLUG}`)
                const league = await leagueService.getBySlug(CURRENT_LEAGUE_SLUG)

                if (!league) {
                    throw new Error(`League "${CURRENT_LEAGUE_SLUG}" not found`)
                }

                // Step 2: Get active season
                console.log('Loading active season...')
                const season = await seasonService.getActiveSeason(CURRENT_LEAGUE_SLUG)

                if (!season) {
                    throw new Error('No active season found')
                }

                // Step 3: Get teams and players for this season
                console.log(`Loading teams and players for season ${season.id}...`)
                const [teams, players] = await Promise.all([
                    teamService.getAllBySeason(season.id),
                    playerService.getAllBySeason(season.id)
                ])

                const result = {
                    league,
                    season,
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
    const { league, season, teams, players, loading, error } = useCurrentLeagueData()
    const [formattedTeams, setFormattedTeams] = useState([])

    useEffect(() => {
        if (teams && players) {
            const formatted = teams.map(team => {
                const teamPlayers = players
                    .filter(p => p.team_id === team.id)
                    .map(p => ({
                        name: p.name,
                        role: p.role,
                        secondary_role: p.secondary_role
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
        league,
        season
    }
}

// Hook for player stats (for stats page) - NOW USES DATABASE
export const useCurrentPlayerStats = () => {
    const { league, season, loading: baseLoading, error: baseError } = useCurrentLeagueData()
    const [formattedPlayers, setFormattedPlayers] = useState([])
    const [statsLoading, setStatsLoading] = useState(false)
    const [statsError, setStatsError] = useState(null)

    useEffect(() => {
        if (!season || !league || statsLoading) return

        const fetchPlayerStats = async () => {
            setStatsLoading(true)
            setStatsError(null)

            try {
                console.log(`Loading player stats for season ${season.id}...`)
                const playerStats = await statsService.getPlayerStats(season.id)

                // Transform database response to match expected format
                const processedPlayers = playerStats.map(player => {
                    const gamesPlayed = parseInt(player.games_played) || 0
                    const wins = parseInt(player.wins) || 0
                    const totalKills = parseInt(player.total_kills) || 0
                    const totalDeaths = parseInt(player.total_deaths) || 0
                    const totalAssists = parseInt(player.total_assists) || 0
                    const totalDamage = parseInt(player.total_damage) || 0
                    const totalMitigated = parseInt(player.total_mitigated) || 0

                    // Calculate KDA
                    const kda = totalDeaths === 0
                        ? totalKills + (totalAssists / 2)
                        : (totalKills + (totalAssists / 2)) / totalDeaths

                    // Calculate win rate
                    const winRate = gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0

                    return {
                        id: player.id,
                        name: player.name,
                        tracker: player.tracker_url || '',
                        role: player.role || '',
                        secondary_role: player.secondary_role || '',
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
                            avgKills: parseFloat(player.avg_kills) || 0,
                            avgDeaths: parseFloat(player.avg_deaths) || 0,
                            avgAssists: parseFloat(player.avg_assists) || 0,
                            avgDamage: parseFloat(player.avg_damage) || 0,
                            avgMitigated: parseFloat(player.avg_mitigated) || 0
                        },
                        kda,
                        winRate
                    }
                })

                setFormattedPlayers(processedPlayers)
            } catch (error) {
                console.error('Error loading player stats:', error)
                setStatsError(error.message)
            } finally {
                setStatsLoading(false)
            }
        }

        fetchPlayerStats()
    }, [season, league])

    return {
        data: formattedPlayers,
        loading: baseLoading || statsLoading,
        error: baseError || statsError,
        season
    }
}
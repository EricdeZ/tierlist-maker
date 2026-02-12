// src/services/database.js
const API_BASE = '/.netlify/functions'

const apiCall = async (endpoint, params = {}) => {
    const url = new URL(`${API_BASE}/${endpoint}`, window.location.origin)
    Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
            url.searchParams.append(key, params[key])
        }
    })

    const token = localStorage.getItem('auth_token')
    const response = await fetch(url, {
        ...(token && { headers: { Authorization: `Bearer ${token}` } }),
    })

    if (!response.ok) {
        throw new Error(`API call failed: ${response.statusText}`)
    }

    return response.json()
}

export const leagueService = {
    async getAll() {
        return apiCall('leagues')
    },

    async getBySlug(slug) {
        return apiCall('leagues', { slug })
    }
}

export const seasonService = {
    // Get active season for a league (uses first active season found)
    async getActiveSeason(leagueSlug) {
        const league = await leagueService.getBySlug(leagueSlug)

        if (!league || !league.divisions) {
            throw new Error('League not found or has no divisions')
        }

        // Find first active season across all divisions
        for (const division of league.divisions) {
            if (division.seasons) {
                const activeSeason = division.seasons.find(s => s.is_active)
                if (activeSeason) {
                    return {
                        ...activeSeason,
                        division_id: division.id,
                        division_name: division.name,
                        league_id: league.id,
                        league_name: league.name
                    }
                }
            }
        }

        // If no active season, return the most recent season
        for (const division of league.divisions) {
            if (division.seasons && division.seasons.length > 0) {
                const latestSeason = division.seasons[0] // Already ordered by start_date DESC
                return {
                    ...latestSeason,
                    division_id: division.id,
                    division_name: division.name,
                    league_id: league.id,
                    league_name: league.name
                }
            }
        }

        throw new Error('No seasons found for league')
    }
}

export const teamService = {
    async getAllBySeason(seasonId) {
        return apiCall('teams', { seasonId })
    }
}

export const playerService = {
    async getAllBySeason(seasonId) {
        return apiCall('players', { seasonId })
    },

    async getPlayerSummaryStats(playerId, seasonId) {
        return apiCall('players', { seasonId, playerId })
    }
}

export const matchService = {
    async getAllBySeason(seasonId, limit = null) {
        return apiCall('matches', { seasonId, ...(limit && { limit }) })
    },

    async getRecentMatches(seasonId, limit = 5) {
        return this.getAllBySeason(seasonId, limit)
    },

    async getById(matchId) {
        return apiCall('match-detail', { matchId })
    }
}

export const statsService = {
    async getSeasonStats(seasonId) {
        return apiCall('stats', { seasonId })
    },

    async getPlayerStats(seasonId) {
        return apiCall('stats', { seasonId, type: 'players' })
    },

    // Per-game stats for a single player
    async getPlayerGameStats(seasonId, playerId) {
        return apiCall('stats', { seasonId, type: 'player-games', playerId })
    }
}

export const standingsService = {
    async getBySeason(seasonId) {
        return apiCall('standings', { seasonId })
    }
}

export const profileService = {
    async getPlayerProfile(slug) {
        return apiCall('player-profile', { slug })
    }
}

export const godService = {
    async getAll() {
        return apiCall('gods')
    }
}

export const bannedContentService = {
    async getByLeague(leagueId) {
        return apiCall('banned-content', { leagueId })
    }
}


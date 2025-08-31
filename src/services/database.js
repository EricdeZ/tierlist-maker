// src/services/database.js
const API_BASE = '/.netlify/functions'

const apiCall = async (endpoint, params = {}) => {
    const url = new URL(`${API_BASE}/${endpoint}`, window.location.origin)
    Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
            url.searchParams.append(key, params[key])
        }
    })

    const response = await fetch(url)
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
        const leagues = await this.getAll()
        return leagues.find(l => l.slug === slug)
    }
}

export const teamService = {
    async getAllByLeague(leagueId) {
        return apiCall('teams', { leagueId })
    }
}

export const playerService = {
    async getAllByLeague(leagueId) {
        return apiCall('players', { leagueId })
    },

    async getPlayerSummaryStats(playerId, leagueId) {
        return apiCall('players', { leagueId, playerId })
    }
}

export const matchService = {
    async getAllByLeague(leagueId, limit = null) {
        return apiCall('matches', { leagueId, ...(limit && { limit }) })
    },

    async getRecentMatches(leagueId, limit = 5) {
        return this.getAllByLeague(leagueId, limit)
    }
}

export const statsService = {
    async getLeagueStats(leagueId) {
        return apiCall('stats', { leagueId })
    }
}

// Test function
export const healthCheck = async () => {
    try {
        const leagues = await leagueService.getAll()
        return { connected: true, leagues: leagues.length }
    } catch (error) {
        return { connected: false, error: error.message }
    }
}
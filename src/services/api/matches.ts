import { apiCall } from './core'

export const matchService = {
    async getAllBySeason(seasonId: number, limit: number | null = null) {
        const data = await apiCall('matches', { seasonId, ...(limit && { limit }) })
        return Array.isArray(data) ? data : data.matches
    },
    async getAllBySeasonWithStages(seasonId: number) {
        const data = await apiCall('matches', { seasonId })
        if (Array.isArray(data)) return { matches: data, stages: [] }
        return { matches: data.matches, stages: data.stages || [] }
    },
    async getRecentMatches(seasonId: number, limit = 5) {
        return this.getAllBySeason(seasonId, limit)
    },
    async getById(matchId: number) {
        return apiCall('match-detail', { matchId })
    }
}

export const statsService = {
    async getSeasonStats(seasonId: number) {
        return apiCall('stats', { seasonId })
    },
    async getPlayerStats(seasonId: number) {
        return apiCall('stats', { seasonId, type: 'players' })
    },
    async getPlayerGameStats(seasonId: number, playerId: number) {
        return apiCall('stats', { seasonId, type: 'player-games', playerId })
    }
}

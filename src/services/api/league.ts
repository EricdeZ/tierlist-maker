import { apiCall, apiPost } from './core'

export const leagueService = {
    async getAll() {
        return apiCall('leagues')
    },
    async getBySlug(slug: string) {
        return apiCall('leagues', { slug })
    }
}

export const seasonService = {
    async getActiveSeason(leagueSlug: string) {
        const league = await leagueService.getBySlug(leagueSlug)
        if (!league || !league.divisions) {
            throw new Error('League not found or has no divisions')
        }
        for (const division of league.divisions) {
            if (division.seasons) {
                const activeSeason = division.seasons.find((s: any) => s.is_active)
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
        throw new Error('No active season found for league')
    }
}

export const teamService = {
    async getAllBySeason(seasonId: number) {
        return apiCall('teams', { seasonId })
    }
}

export const playerService = {
    async getAllBySeason(seasonId: number) {
        return apiCall('players', { seasonId })
    },
    async getPlayerSummaryStats(playerId: number, seasonId: number) {
        return apiCall('players', { seasonId, playerId })
    }
}

export const standingsService = {
    async getBySeason(seasonId: number) {
        return apiCall('standings', { seasonId })
    }
}

export const transactionService = {
    async getRecent() {
        return apiCall('transactions')
    },
    async getByLeague(leagueId: number) {
        return apiCall('transactions', { leagueId })
    },
    async getByDivision(divisionId: number) {
        return apiCall('transactions', { divisionId })
    },
}

export const profileService = {
    async getPlayerProfile(slug: string) {
        return apiCall('player-profile', { slug })
    }
}

export const globalPlayerService = {
    async getStats() {
        return apiCall('players-global')
    },
    async search(q: string) {
        return apiCall('players-global', { q })
    },
    async getNames() {
        return apiCall('players-global', { type: 'names' })
    },
}

export const godService = {
    async getAll() {
        return apiCall('gods')
    },
    async getTopPlayers() {
        return apiCall('gods', { action: 'top-players' })
    }
}

export const godpoolService = {
    async get(playerSlug: string) {
        return apiCall('godpool', { action: 'get', playerSlug })
    },
    async save(tiers: any, visibility: string) {
        return apiPost('godpool', {}, { action: 'save', tiers, visibility })
    },
    async delete() {
        return apiPost('godpool', {}, { action: 'delete' })
    },
}

export const bannedContentService = {
    async getByLeague(leagueId: number) {
        return apiCall('banned-content', { leagueId })
    }
}

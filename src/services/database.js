// src/services/database.js
const API_BASE = '/api'

// Owner impersonation support
let _impersonateUserId = null
export function setImpersonation(userId) { _impersonateUserId = userId }
export function clearImpersonation() { _impersonateUserId = null }
export function getImpersonation() { return _impersonateUserId }

const apiCall = async (endpoint, params = {}) => {
    const url = new URL(`${API_BASE}/${endpoint}`, window.location.origin)
    Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
            url.searchParams.append(key, params[key])
        }
    })

    const token = localStorage.getItem('auth_token')
    const hdrs = {}
    if (token) hdrs.Authorization = `Bearer ${token}`
    if (_impersonateUserId) hdrs['X-Impersonate'] = String(_impersonateUserId)

    const response = await fetch(url, {
        headers: Object.keys(hdrs).length > 0 ? hdrs : undefined,
    })

    if (!response.ok) {
        let message = `API call failed: ${response.statusText}`
        try {
            const data = await response.json()
            if (data.error) message = data.error
        } catch {}
        throw new Error(message)
    }

    return response.json()
}

const apiPost = async (endpoint, params = {}, body = {}) => {
    const url = new URL(`${API_BASE}/${endpoint}`, window.location.origin)
    Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
            url.searchParams.append(key, params[key])
        }
    })

    const token = localStorage.getItem('auth_token')
    const hdrs = { 'Content-Type': 'application/json' }
    if (token) hdrs.Authorization = `Bearer ${token}`
    if (_impersonateUserId) hdrs['X-Impersonate'] = String(_impersonateUserId)

    const response = await fetch(url, {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify(body),
    })

    if (!response.ok) {
        let message = `API call failed: ${response.statusText}`
        try {
            const data = await response.json()
            if (data.error) message = data.error
        } catch {}
        throw new Error(message)
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

        throw new Error('No active season found for league')
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
    },
    async getTopPlayers() {
        return apiCall('gods', { action: 'top-players' })
    }
}

export const godpoolService = {
    async get(playerSlug) {
        return apiCall('godpool', { action: 'get', playerSlug })
    },
    async save(tiers, visibility) {
        return apiPost('godpool', {}, { action: 'save', tiers, visibility })
    },
    async delete() {
        return apiPost('godpool', {}, { action: 'delete' })
    },
}

export const bannedContentService = {
    async getByLeague(leagueId) {
        return apiCall('banned-content', { leagueId })
    }
}

export const passionService = {
    async getBalance() {
        return apiCall('passion', { action: 'balance' })
    },

    async getLeaderboard(period = 'recent') {
        return apiCall('passion', { action: 'leaderboard', period })
    },

    async getTransactions(limit = 50, offset = 0) {
        return apiCall('passion', { action: 'transactions', limit, offset })
    },

    async claimDaily() {
        return apiPost('passion', { action: 'claim-daily' })
    },

    async earn(type, referenceId = null) {
        return apiPost('passion', { action: 'earn' }, { type, referenceId })
    },
}

export const coinflipService = {
    async flip() {
        return apiPost('coinflip', { action: 'flip' })
    },

    async getLeaderboard() {
        return apiCall('coinflip', { action: 'leaderboard' })
    },

    async getMyStats() {
        return apiCall('coinflip', { action: 'my-stats' })
    },
}

export const smiterunnerService = {
    async startSession() {
        return apiPost('smiterunner', { action: 'start' })
    },
    async heartbeat(sessionToken, ticks) {
        return apiPost('smiterunner', { action: 'heartbeat' }, { sessionToken, ticks })
    },
    async submitScore(sessionToken, score, ticks) {
        return apiPost('smiterunner', { action: 'submit' }, { sessionToken, score, ticks })
    },
    async getLeaderboard() {
        return apiCall('smiterunner', { action: 'leaderboard' })
    },
    async getMyStats() {
        return apiCall('smiterunner', { action: 'my-stats' })
    },
}

export const challengeService = {
    async getAll() {
        return apiCall('challenges')
    },

    async claim(challengeId) {
        return apiPost('challenges', { action: 'claim' }, { challengeId })
    },

    // Admin methods
    async adminGetAll() {
        return apiCall('challenge-manage')
    },

    async create(data) {
        return apiPost('challenge-manage', {}, { action: 'create', ...data })
    },

    async update(data) {
        return apiPost('challenge-manage', {}, { action: 'update', ...data })
    },

    async toggle(id) {
        return apiPost('challenge-manage', {}, { action: 'toggle', id })
    },

    async remove(id) {
        return apiPost('challenge-manage', {}, { action: 'delete', id })
    },

    async resetMyChallenges() {
        return apiPost('challenge-manage', {}, { action: 'reset-my-challenges' })
    },

    async recalcAll() {
        return apiPost('challenge-manage', {}, { action: 'recalc-all' })
    },
}

export const siteConfigService = {
    async get(keys) {
        return apiCall('site-config', { keys: keys.join(',') })
    },
}

export const featuredStreamerService = {
    async getCurrent() {
        return apiCall('featured-streamer', { action: 'current' })
    },
    async getQueue() {
        return apiCall('featured-streamer', { action: 'queue' })
    },
    async getStatus() {
        // Check if current user owns the badge
        return apiCall('featured-streamer', { action: 'my-status' })
    },
    async register(twitch_channel) {
        return apiPost('featured-streamer', { action: 'register' }, { twitch_channel })
    },
    async updateChannel(twitch_channel) {
        return apiPost('featured-streamer', { action: 'update-channel' }, { twitch_channel })
    },
    async deactivate() {
        return apiPost('featured-streamer', { action: 'deactivate' })
    },
    async reactivate() {
        return apiPost('featured-streamer', { action: 'reactivate' })
    },
    async heartbeat(streamer_id) {
        return apiPost('featured-streamer', { action: 'heartbeat' }, { streamer_id })
    },
}

export const orgService = {
    async getBySlug(slug) {
        return apiCall('orgs', { slug })
    },

    async getAll() {
        return apiCall('orgs')
    },

    // Admin methods
    async adminGetAll() {
        return apiCall('org-manage')
    },

    async create(data) {
        return apiPost('org-manage', {}, { action: 'create', ...data })
    },

    async update(data) {
        return apiPost('org-manage', {}, { action: 'update', ...data })
    },

    async remove(id) {
        return apiPost('org-manage', {}, { action: 'delete', id })
    },

    async assignTeam(team_id, org_id) {
        return apiPost('org-manage', {}, { action: 'assign-team', team_id, org_id })
    },

    async unassignTeam(team_id) {
        return apiPost('org-manage', {}, { action: 'unassign-team', team_id })
    },
}

export const codexService = {
    async getAll() {
        return apiCall('codex-manage')
    },
    // Fields
    async createField(data) {
        return apiPost('codex-manage', {}, { action: 'create-field', ...data })
    },
    async updateField(data) {
        return apiPost('codex-manage', {}, { action: 'update-field', ...data })
    },
    async deleteField(id) {
        return apiPost('codex-manage', {}, { action: 'delete-field', id })
    },
    // Tags
    async createTag(data) {
        return apiPost('codex-manage', {}, { action: 'create-tag', ...data })
    },
    async updateTag(data) {
        return apiPost('codex-manage', {}, { action: 'update-tag', ...data })
    },
    async deleteTag(id) {
        return apiPost('codex-manage', {}, { action: 'delete-tag', id })
    },
    // Items
    async createItem(data) {
        return apiPost('codex-manage', {}, { action: 'create-item', ...data })
    },
    async updateItem(data) {
        return apiPost('codex-manage', {}, { action: 'update-item', ...data })
    },
    async deleteItem(id) {
        return apiPost('codex-manage', {}, { action: 'delete-item', id })
    },
    // Images
    async getImages(category) {
        return apiCall('codex-upload', category ? { category } : {})
    },
    async uploadImage(file, category) {
        const formData = new FormData()
        formData.append('file', file)
        if (category) formData.append('category', category)
        const token = localStorage.getItem('auth_token')
        const res = await fetch(`${API_BASE}/codex-upload`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Upload failed')
        return data
    },
    async deleteImage(id) {
        const token = localStorage.getItem('auth_token')
        const res = await fetch(`${API_BASE}/codex-upload?id=${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Delete failed')
        return data
    },
    async updateImageCategory(id, category) {
        return apiPost('codex-manage', {}, { action: 'update-image-category', id, category })
    },
    // Gods
    async getAllGods() {
        return apiCall('codex-manage', { type: 'gods' })
    },
    async createGodField(data) {
        return apiPost('codex-manage', {}, { action: 'create-god-field', ...data })
    },
    async updateGodField(data) {
        return apiPost('codex-manage', {}, { action: 'update-god-field', ...data })
    },
    async deleteGodField(id) {
        return apiPost('codex-manage', {}, { action: 'delete-god-field', id })
    },
    async createGodTag(data) {
        return apiPost('codex-manage', {}, { action: 'create-god-tag', ...data })
    },
    async updateGodTag(data) {
        return apiPost('codex-manage', {}, { action: 'update-god-tag', ...data })
    },
    async deleteGodTag(id) {
        return apiPost('codex-manage', {}, { action: 'delete-god-tag', id })
    },
    async createGod(data) {
        return apiPost('codex-manage', {}, { action: 'create-god', ...data })
    },
    async updateGod(data) {
        return apiPost('codex-manage', {}, { action: 'update-god', ...data })
    },
    async deleteGod(id) {
        return apiPost('codex-manage', {}, { action: 'delete-god', id })
    },
    // God Categories
    async createGodCategory(data) {
        return apiPost('codex-manage', {}, { action: 'create-god-category', ...data })
    },
    async updateGodCategory(data) {
        return apiPost('codex-manage', {}, { action: 'update-god-category', ...data })
    },
    async deleteGodCategory(id) {
        return apiPost('codex-manage', {}, { action: 'delete-god-category', id })
    },
    async reorderGodCategories(items) {
        return apiPost('codex-manage', {}, { action: 'reorder-god-categories', items })
    },
    // God Images (gallery)
    async addGodImage(data) {
        return apiPost('codex-manage', {}, { action: 'add-god-image', ...data })
    },
    async removeGodImage(id) {
        return apiPost('codex-manage', {}, { action: 'remove-god-image', id })
    },
    async reorderGodImages(items) {
        return apiPost('codex-manage', {}, { action: 'reorder-god-images', items })
    },
    async updateGodImageCaption(id, caption) {
        return apiPost('codex-manage', {}, { action: 'update-god-image', id, caption })
    },
}

export const forgeService = {
    async getMarket(seasonId) {
        return apiCall('forge', { action: 'market', seasonId })
    },

    async getPortfolio(seasonId) {
        return apiCall('forge', { action: 'portfolio', seasonId })
    },

    async getLeaderboard(seasonId) {
        return apiCall('forge', { action: 'leaderboard', seasonId })
    },

    async getHistory(sparkId) {
        return apiCall('forge', { action: 'history', sparkId })
    },

    async getMarketStatuses() {
        return apiCall('forge', { action: 'market-statuses' })
    },

    async fuel(sparkId, sparks) {
        return apiPost('forge', { action: 'fuel' }, { sparkId, sparks })
    },

    async cool(sparkId, sparks) {
        return apiPost('forge', { action: 'cool' }, { sparkId, sparks })
    },

    async liquidate(seasonId) {
        return apiPost('forge', { action: 'liquidate' }, { seasonId })
    },

    async toggleStatus(seasonId, status) {
        return apiPost('forge', { action: 'toggle-status' }, { seasonId, status })
    },
}

export const predictionsService = {
    async getUpcoming(filters = {}) {
        return apiCall('predictions', { action: 'upcoming', ...filters })
    },

    async getMyPredictions(filters = {}) {
        return apiCall('predictions', { action: 'my-predictions', ...filters })
    },

    async getLeaderboard(seasonId) {
        return apiCall('predictions', { action: 'leaderboard', seasonId })
    },

    async predict(data) {
        return apiPost('predictions', { action: 'predict' }, data)
    },

    async lockToggle(scheduledMatchId, locked) {
        return apiPost('predictions', { action: 'lock-toggle' }, { scheduledMatchId, locked })
    },

    async getMatchupDetail(scheduledMatchId) {
        return apiCall('predictions', { action: 'matchup-detail', scheduledMatchId })
    },

    async refundAll() {
        return apiPost('predictions', { action: 'refund-all' })
    },
}

export const feedbackService = {
    async submit(data) {
        return apiPost('feedback', {}, data)
    },
    async adminGetAll() {
        return apiCall('feedback')
    },
    async remove(id) {
        return apiPost('feedback', {}, { action: 'delete', id })
    },
}

export const tierlistFeedService = {
    async getFeed(seasonId, limit = 20, offset = 0) {
        return apiCall('tierlist-feed', { action: 'feed', seasonId, limit, offset })
    },
    async getPost(postId) {
        return apiCall('tierlist-feed', { action: 'post', postId })
    },
    async publish(seasonId, rankings, title) {
        return apiPost('tierlist-feed', {}, { action: 'publish', seasonId, rankings, title })
    },
    async like(postId) {
        return apiPost('tierlist-feed', {}, { action: 'like', postId })
    },
    async deletePost(postId) {
        return apiPost('tierlist-feed', {}, { action: 'delete', postId })
    },
}

export const scrimService = {
    async list(filters = {}) {
        return apiCall('scrim', { action: 'list', ...filters })
    },
    async getMyScrims() {
        return apiCall('scrim', { action: 'my-scrims' })
    },
    async getIncoming() {
        return apiCall('scrim', { action: 'incoming' })
    },
    async getCaptainTeams() {
        return apiCall('scrim', { action: 'captain-teams' })
    },
    async getAllActiveTeams() {
        return apiCall('scrim', { action: 'all-teams' })
    },
    async create(data) {
        return apiPost('scrim', { action: 'create' }, data)
    },
    async accept(data) {
        return apiPost('scrim', { action: 'accept' }, data)
    },
    async cancel(scrimId) {
        return apiPost('scrim', { action: 'cancel' }, { scrim_id: scrimId })
    },
    async decline(scrimId) {
        return apiPost('scrim', { action: 'decline' }, { scrim_id: scrimId })
    },
    async reportOutcome(data) {
        return apiPost('scrim', { action: 'report-outcome' }, data)
    },
    async disputeOutcome(scrimId) {
        return apiPost('scrim', { action: 'dispute-outcome' }, { scrim_id: scrimId })
    },
    async getTeamReliability(teamIds) {
        return apiCall('scrim', { action: 'team-reliability', team_ids: teamIds.join(',') })
    },
    async getBlacklist() {
        return apiCall('scrim', { action: 'blacklist' })
    },
    async addToBlacklist(teamId, blockedTeamId) {
        return apiPost('scrim', { action: 'blacklist-add' }, { team_id: teamId, blocked_team_id: blockedTeamId })
    },
    async removeFromBlacklist(teamId, blockedTeamId) {
        return apiPost('scrim', { action: 'blacklist-remove' }, { team_id: teamId, blocked_team_id: blockedTeamId })
    },
    async searchUsers(query) {
        return apiCall('scrim', { action: 'search-users', ...(query ? { q: query } : {}) })
    },
}


// src/services/database.js
const API_BASE = '/api'

// Owner impersonation support
let _impersonateUserId = null
export function setImpersonation(userId) { _impersonateUserId = userId }
export function clearImpersonation() { _impersonateUserId = null }
export function getImpersonation() { return _impersonateUserId }

// In-flight GET request deduplication — simultaneous calls to the same URL share one fetch
const _inflight = new Map()

const apiCall = async (endpoint, params = {}) => {
    const url = new URL(`${API_BASE}/${endpoint}`, window.location.origin)
    Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
            url.searchParams.append(key, params[key])
        }
    })

    const cacheKey = url.toString()
    if (_inflight.has(cacheKey)) return _inflight.get(cacheKey)

    const token = localStorage.getItem('auth_token')
    const hdrs = {}
    if (token) hdrs.Authorization = `Bearer ${token}`
    if (_impersonateUserId) hdrs['X-Impersonate'] = String(_impersonateUserId)

    const promise = fetch(url, {
        headers: Object.keys(hdrs).length > 0 ? hdrs : undefined,
    }).then(async response => {
        if (!response.ok) {
            let message = `API call failed: ${response.statusText}`
            try {
                const data = await response.json()
                if (data.error) message = data.error
            } catch {}
            throw new Error(message)
        }
        return response.json()
    }).finally(() => {
        _inflight.delete(cacheKey)
    })

    _inflight.set(cacheKey, promise)
    return promise
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
        let extra = {}
        try {
            const data = await response.json()
            if (data.error) message = data.error
            extra = data
        } catch {}
        const err = new Error(message)
        Object.assign(err, extra)
        throw err
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
        const data = await apiCall('matches', { seasonId, ...(limit && { limit }) })
        // API returns { matches, stages } when stages exist, or plain array
        return Array.isArray(data) ? data : data.matches
    },

    async getAllBySeasonWithStages(seasonId) {
        const data = await apiCall('matches', { seasonId })
        if (Array.isArray(data)) return { matches: data, stages: [] }
        return { matches: data.matches, stages: data.stages || [] }
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

export const transactionService = {
    async getRecent() {
        return apiCall('transactions')
    },
    async getByLeague(leagueId) {
        return apiCall('transactions', { leagueId })
    },
    async getByDivision(divisionId) {
        return apiCall('transactions', { divisionId })
    },
}

export const profileService = {
    async getPlayerProfile(slug) {
        return apiCall('player-profile', { slug })
    }
}

export const globalPlayerService = {
    async getStats() {
        return apiCall('players-global')
    },
    async search(q) {
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
    },
    async create(name, image_url) {
        return apiPost('gods', {}, { action: 'create', name, image_url })
    },
    async update(id, name, image_url) {
        return apiPost('gods', {}, { action: 'update', id, name, image_url })
    },
    async delete(id) {
        return apiPost('gods', {}, { action: 'delete', id })
    },
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

    async adminGrant(userId, amount, reason) {
        return apiPost('passion-admin', {}, { userId, amount, reason })
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

    async catchupAll() {
        return apiPost('challenge-manage', {}, { action: 'catchup-all' })
    },

    async searchUsers(query) {
        return apiPost('challenge-manage', {}, { action: 'search-users', query })
    },

    async getUserChallenges(userId) {
        return apiPost('challenge-manage', {}, { action: 'user-challenges', userId })
    },

    async awardChallenge(userId, challengeId) {
        return apiPost('challenge-manage', {}, { action: 'award-challenge', userId, challengeId })
    },

    async revokeUserChallenge(userId, challengeId) {
        return apiPost('challenge-manage', {}, { action: 'revoke-user-challenge', userId, challengeId })
    },

    async getUserTitles(userId) {
        return apiPost('challenge-manage', {}, { action: 'get-user-titles', userId })
    },

    async grantTitle(userId, label, tier) {
        return apiPost('challenge-manage', {}, { action: 'grant-title', userId, label, tier })
    },

    async revokeTitle(titleId) {
        return apiPost('challenge-manage', {}, { action: 'revoke-title', titleId })
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
    // Group Types
    async createGroupType(data) {
        return apiPost('codex-manage', {}, { action: 'create-group-type', ...data })
    },
    async updateGroupType(data) {
        return apiPost('codex-manage', {}, { action: 'update-group-type', ...data })
    },
    async deleteGroupType(id) {
        return apiPost('codex-manage', {}, { action: 'delete-group-type', id })
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
    // Wordle Categories
    async getWordleCategories() {
        return apiCall('codex-manage', { type: 'wordle' })
    },
    async createWordleCategory(data) {
        return apiPost('codex-manage', {}, { action: 'create-wordle-category', ...data })
    },
    async updateWordleCategory(data) {
        return apiPost('codex-manage', {}, { action: 'update-wordle-category', ...data })
    },
    async deleteWordleCategory(id) {
        return apiPost('codex-manage', {}, { action: 'delete-wordle-category', id })
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

    async getBatchHistory(sparkIds) {
        return apiCall('forge', { action: 'batch-history', sparkIds: sparkIds.join(',') })
    },

    async getPortfolioTimeline(seasonId) {
        return apiCall('forge', { action: 'portfolio-timeline', seasonId })
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

    async getTutorialStatus(seasonId) {
        return apiCall('forge', { action: 'tutorial-status', seasonId })
    },

    async tutorialFuel(sparkId) {
        return apiPost('forge', { action: 'tutorial-fuel' }, { sparkId })
    },

    async claimForgeReferral(refCode) {
        return apiPost('forge', { action: 'claim-forge-referral' }, { refCode })
    },

    async referralFuel(sparkId) {
        return apiPost('forge', { action: 'referral-fuel' }, { sparkId })
    },
}

export const referralService = {
    async getMyStats() {
        return apiCall('referrals', { action: 'my-stats' })
    },

    async validateCode(code) {
        return apiCall('referrals', { action: 'validate-code', code })
    },

    async claimReferral(code, type) {
        return apiPost('referrals', { action: 'claim' }, { code, type })
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
    async update(data) {
        return apiPost('scrim', { action: 'update' }, data)
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
    async getActiveDivisions() {
        return apiCall('scrim', { action: 'active-divisions' })
    },
    async confirmAccept(scrimId, teamId) {
        return apiPost('scrim', { action: 'confirm-accept' }, { scrim_id: scrimId, team_id: teamId })
    },
    async denyAccept(scrimId, teamId) {
        return apiPost('scrim', { action: 'deny-accept' }, { scrim_id: scrimId, team_id: teamId })
    },
    async checkDMConfirmations() {
        return apiCall('scrim', { action: 'check-dm-confirmations' })
    },
}

export const arcadeNpcService = {
    async list() { return apiCall('arcade-npcs', { action: 'list' }) },
    async adminList() { return apiCall('arcade-npcs', { action: 'admin-list' }) },
    async create(data) { return apiPost('arcade-npcs', { action: 'create' }, data) },
    async update(data) { return apiPost('arcade-npcs', { action: 'update' }, data) },
    async toggle(id) { return apiPost('arcade-npcs', { action: 'toggle' }, { id }) },
    async remove(id) { return apiPost('arcade-npcs', { action: 'delete' }, { id }) },
}

export const inhouseService = {
    async list(filters = {}) {
        return apiCall('inhouse', { action: 'list', ...filters })
    },
    async getDetail(lobbyId) {
        return apiCall('inhouse', { action: 'detail', lobbyId })
    },
    async getDraftState(lobbyId) {
        return apiCall('inhouse', { action: 'draft-state', lobbyId })
    },
    async getLeaderboard(sort) {
        return apiCall('inhouse', { action: 'leaderboard', sort })
    },
    async getMyStats() {
        return apiCall('inhouse', { action: 'my-stats' })
    },
    async getPlayerStats(userId) {
        return apiCall('inhouse', { action: 'player-stats', userId })
    },
    async getMyLobbies() {
        return apiCall('inhouse', { action: 'my-lobbies' })
    },
    async create(data) {
        return apiPost('inhouse', { action: 'create' }, data)
    },
    async join(data) {
        return apiPost('inhouse', { action: 'join' }, data)
    },
    async leave(lobbyId) {
        return apiPost('inhouse', { action: 'leave' }, { lobbyId })
    },
    async kick(data) {
        return apiPost('inhouse', { action: 'kick' }, data)
    },
    async cancel(lobbyId) {
        return apiPost('inhouse', { action: 'cancel' }, { lobbyId })
    },
    async setCaptains(data) {
        return apiPost('inhouse', { action: 'set-captains' }, data)
    },
    async startDraft(lobbyId) {
        return apiPost('inhouse', { action: 'start-draft' }, { lobbyId })
    },
    async draftPick(data) {
        return apiPost('inhouse', { action: 'draft-pick' }, data)
    },
    async startVoting(lobbyId) {
        return apiPost('inhouse', { action: 'start-voting' }, { lobbyId })
    },
    async vote(data) {
        return apiPost('inhouse', { action: 'vote' }, data)
    },
}

export const communityTeamService = {
    async getMyTeams() {
        return apiCall('community-teams', { action: 'my-teams' })
    },
    async getLeagueTeams() {
        return apiCall('community-teams', { action: 'league-teams' })
    },
    async getTeam(idOrSlug) {
        return apiCall('community-teams', { action: 'team', id: idOrSlug })
    },
    async browse(tier) {
        return apiCall('community-teams', { action: 'browse', tier })
    },
    async create(data) {
        return apiPost('community-teams', { action: 'create' }, data)
    },
    async update(data) {
        return apiPost('community-teams', { action: 'update' }, data)
    },
    async invite(teamId, userId) {
        return apiPost('community-teams', { action: 'invite' }, { team_id: teamId, user_id: userId })
    },
    async generateLink(teamId) {
        return apiPost('community-teams', { action: 'generate-link' }, { team_id: teamId })
    },
    async joinLink(code) {
        return apiPost('community-teams', { action: 'join-link' }, { code })
    },
    async requestJoin(teamId) {
        return apiPost('community-teams', { action: 'request' }, { team_id: teamId })
    },
    async respond(invitationId, accept) {
        return apiPost('community-teams', { action: 'respond' }, { invitation_id: invitationId, accept })
    },
    async leave(teamId) {
        return apiPost('community-teams', { action: 'leave' }, { team_id: teamId })
    },
    async kick(teamId, userId) {
        return apiPost('community-teams', { action: 'kick' }, { team_id: teamId, user_id: userId })
    },
    async setCoCaptain(teamId, userId, remove = false) {
        return apiPost('community-teams', { action: 'set-co-captain' }, { team_id: teamId, user_id: userId, remove })
    },
    async disband(teamId) {
        return apiPost('community-teams', { action: 'disband' }, { team_id: teamId })
    },
    async searchUsers(query) {
        return apiCall('community-teams', { action: 'search-users', q: query })
    },
    async getPending() {
        return apiCall('community-teams', { action: 'pending' })
    },
    async getPendingCount() {
        return apiCall('community-teams', { action: 'pending-count' })
    },
    async previewLink(code) {
        return apiCall('community-teams', { action: 'preview-link', code })
    },
    async getDivisionsByTier(tier) {
        return apiCall('community-teams', { action: 'divisions-by-tier', tier })
    },
    async uploadLogo(teamId, file) {
        const formData = new FormData()
        formData.append('teamId', String(teamId))
        formData.append('file', file)
        const token = localStorage.getItem('auth_token')
        const hdrs = {}
        if (token) hdrs.Authorization = `Bearer ${token}`
        const res = await fetch(`${API_BASE}/community-team-upload`, {
            method: 'POST',
            headers: hdrs,
            body: formData,
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Upload failed')
        return data
    },
    async deleteLogo(teamId) {
        const token = localStorage.getItem('auth_token')
        const hdrs = {}
        if (token) hdrs.Authorization = `Bearer ${token}`
        const res = await fetch(`${API_BASE}/community-team-upload?teamId=${teamId}`, {
            method: 'DELETE',
            headers: hdrs,
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Delete failed')
        return data
    },
}

export const adminCommunityService = {
    async listTeams(params = {}) {
        return apiCall('admin-community', { action: 'teams', ...params })
    },
    async teamDetail(id) {
        return apiCall('admin-community', { action: 'team-detail', id })
    },
    async listScrims(params = {}) {
        return apiCall('admin-community', { action: 'scrims', ...params })
    },
    async scrimStats() {
        return apiCall('admin-community', { action: 'scrim-stats' })
    },
    async teamStats() {
        return apiCall('admin-community', { action: 'team-stats' })
    },
    async editTeam(data) {
        return apiPost('admin-community', { action: 'edit-team' }, data)
    },
    async deleteTeam(id) {
        return apiPost('admin-community', { action: 'delete-team' }, { id })
    },
    async cancelScrim(id) {
        return apiPost('admin-community', { action: 'cancel-scrim' }, { id })
    },
    async resolveDispute(id, outcome) {
        return apiPost('admin-community', { action: 'resolve-dispute' }, { id, outcome })
    },
}

export const emberService = {
    async getBalance() {
        return apiCall('ember', { action: 'balance' })
    },
    async claimDaily() {
        return apiPost('ember', { action: 'claim-daily' })
    },
    async convert() {
        return apiPost('ember', { action: 'convert' })
    },
    async adminGrant(userId, amount, reason) {
        return apiPost('ember-admin', {}, { userId, amount, reason })
    },
}

export const vaultService = {
    async load() {
        return apiCall('vault', { action: 'load' })
    },
    async openPack(packType) {
        return apiPost('vault', { action: 'open-pack' }, { packType })
    },
    async openSalePack(saleId, packType) {
        return apiPost('vault', { action: 'open-pack' }, { saleId, packType })
    },
    async getDefinitionOverrides() {
        return apiCall('vault', { action: 'definition-overrides' })
    },
    async getSharedCard(token) {
        return apiCall('vault', { action: 'shared-card', token })
    },
    async getCollectionCatalog() {
        return apiCall('vault', { action: 'collection-catalog' })
    },
    async getCollectionOwned() {
        return apiCall('vault', { action: 'collection-owned' })
    },
    async getCollectionSet(setKey) {
        return apiCall('vault', { action: 'collection-set', setKey })
    },
    async getCardDetail(defId) {
        return apiCall('vault', { action: 'card-detail', defId })
    },
    async searchCollection(q) {
        return apiCall('vault', { action: 'collection-search', q })
    },
    async loadGifts() {
        return apiCall('vault', { action: 'gifts' })
    },
    async searchUsers(q) {
        return apiCall('vault', { action: 'search-users', q })
    },
    async sendGift(recipientId, message, packType = 'gift') {
        return apiPost('vault', { action: 'send-gift' }, { recipientId, message, packType })
    },
    async openGift(giftId) {
        return apiPost('vault', { action: 'open-gift' }, { giftId })
    },
    async markGiftsSeen() {
        return apiPost('vault', { action: 'mark-gifts-seen' }, {})
    },
    async buyGiftPack(packType) {
        return apiPost('vault', { action: 'buy-gift-pack' }, { packType })
    },
    async dismantleCards(cardIds) {
        return apiPost('vault', { action: 'dismantle' }, { cardIds })
    },
    loadStartingFive() {
        return apiCall('vault', { action: 'starting-five' })
    },
    slotCard(cardId, role, slotType = 'player') {
        return apiPost('vault', { action: 'slot-card' }, { cardId, role, slotType })
    },
    unslotCard(role) {
        return apiPost('vault', { action: 'unslot-card' }, { role })
    },
    unslotAttachment(role, slotType) {
        return apiPost('vault', { action: 'unslot-attachment' }, { role, slotType })
    },
    collectIncome() {
        return apiPost('vault', { action: 'collect-income' }, {})
    },
    slotConsumable(cardId) {
        return apiPost('vault', { action: 'slot-consumable' }, { cardId })
    },
    openInventoryPack(inventoryId) {
        return apiPost('vault', { action: 'open-inventory-pack' }, { inventoryId })
    },
    buyPacksToInventory(packType, quantity) {
        return apiPost('vault', { action: 'buy-packs-to-inventory' }, { packType, quantity })
    },
    redeemCode(code) {
        return apiPost('vault', { action: 'redeem-code' }, { code })
    },
    adminListRedeemCodes() {
        return apiCall('vault', { action: 'admin-redeem-codes' })
    },
    adminCreateRedeemCode(data) {
        return apiPost('vault', { action: 'create-redeem-code' }, data)
    },
    adminToggleRedeemCode(codeId, active) {
        return apiPost('vault', { action: 'toggle-redeem-code' }, { codeId, active })
    },
    async loadBinder() {
        return apiCall('vault', { action: 'binder' })
    },
    async getBinderView(token) {
        return apiCall('vault', { action: 'binder-view', token })
    },
    async saveBinder(name, color) {
        return apiPost('vault', { action: 'binder-save' }, { name, color })
    },
    async binderSlot(cardId, page, slot) {
        return apiPost('vault', { action: 'binder-slot' }, { cardId, page, slot })
    },
    async binderUnslot(page, slot) {
        return apiPost('vault', { action: 'binder-unslot' }, { page, slot })
    },
    async binderGenerateShare() {
        return apiPost('vault', { action: 'binder-generate-share' }, {})
    },
    blackMarketTurnIn(cardId) {
        return apiPost('vault', { action: 'black-market-turn-in' }, { cardId })
    },
    blackMarketClaimMythic(data) {
        return apiPost('vault', { action: 'black-market-claim-mythic' }, data)
    },
    blackMarketDebugPending() {
        return apiPost('vault', { action: 'black-market-debug-pending' }, {})
    },
}

export const bountyService = {
    async list(params = {}) {
        return apiCall('bounty', { action: 'list', ...params })
    },
    async myBounties() {
        return apiCall('bounty', { action: 'my-bounties' })
    },
    async fulfillable() {
        return apiCall('bounty', { action: 'fulfillable' })
    },
    async hero() {
        return apiCall('bounty', { action: 'hero' })
    },
    async create(data) {
        return apiPost('bounty', { action: 'create' }, data)
    },
    async fulfill(data) {
        return apiPost('bounty', { action: 'fulfill' }, data)
    },
    async cancel(bountyId) {
        return apiPost('bounty', { action: 'cancel' }, { bountyId })
    },
    async searchPlayers(q) {
        return apiCall('bounty', { action: 'search-players', q })
    },
}

export const marketplaceService = {
    async list(params = {}) {
        return apiCall('marketplace', { action: 'list', ...params })
    },
    async getMyListings() {
        return apiCall('marketplace', { action: 'my-listings' })
    },
    async create(data) {
        return apiPost('marketplace', { action: 'create' }, data)
    },
    async buy(data) {
        return apiPost('marketplace', { action: 'buy' }, data)
    },
    async cancel(listingId) {
        return apiPost('marketplace', { action: 'cancel' }, { listingId })
    },
}

export const tradingService = {
    async pending() {
        return apiCall('trading', { action: 'pending' })
    },
    async poll(tradeId) {
        return apiCall('trading', { action: 'poll', tradeId })
    },
    async history() {
        return apiCall('trading', { action: 'history' })
    },
    async searchUsers(q) {
        return apiCall('trading', { action: 'search-users', q })
    },
    async create(targetUserId) {
        return apiPost('trading', { action: 'create' }, { targetUserId })
    },
    async join(tradeId) {
        return apiPost('trading', { action: 'join' }, { tradeId })
    },
    async addCard(tradeId, cardId) {
        return apiPost('trading', { action: 'add-card' }, { tradeId, cardId })
    },
    async removeCard(tradeId, cardId) {
        return apiPost('trading', { action: 'remove-card' }, { tradeId, cardId })
    },
    async setCore(tradeId, amount) {
        return apiPost('trading', { action: 'set-core' }, { tradeId, amount })
    },
    async ready(tradeId) {
        return apiPost('trading', { action: 'ready' }, { tradeId })
    },
    async confirm(tradeId) {
        return apiPost('trading', { action: 'confirm' }, { tradeId })
    },
    async cancel(tradeId) {
        return apiPost('trading', { action: 'cancel' }, { tradeId })
    },
}

export const packCreatorService = {
    async load() {
        return apiCall('pack-creator', { action: 'load' })
    },
    async create(data) {
        return apiPost('pack-creator', { action: 'create' }, data)
    },
    async update(data) {
        return apiPost('pack-creator', { action: 'update' }, data)
    },
    async toggle(id) {
        return apiPost('pack-creator', { action: 'toggle' }, { id })
    },
    async delete(id) {
        return apiPost('pack-creator', { action: 'delete' }, { id })
    },
}

export const vendingRestockService = {
    async load() {
        return apiCall('vending-restock', { action: 'load' })
    },
    async create(data) {
        return apiPost('vending-restock', { action: 'create' }, data)
    },
    async restock(id, amount) {
        return apiPost('vending-restock', { action: 'restock' }, { id, amount })
    },
    async edit(id, data) {
        return apiPost('vending-restock', { action: 'edit' }, { id, ...data })
    },
    async toggle(id) {
        return apiPost('vending-restock', { action: 'toggle' }, { id })
    },
    async delete(id) {
        return apiPost('vending-restock', { action: 'delete' }, { id })
    },
}

export const vaultAdminService = {
    async getStats() {
        return apiCall('vault-admin', { action: 'stats' })
    },
    async listCards(params = {}) {
        return apiCall('vault-admin', { action: 'cards', ...params })
    },
    async getCard(id) {
        return apiCall('vault-admin', { action: 'card', id })
    },
    async listUsers(params = {}) {
        return apiCall('vault-admin', { action: 'users', ...params })
    },
    async getHoloTypes() {
        return apiCall('vault-admin', { action: 'holo-types' })
    },
    async updateCard(id, updates) {
        return apiPost('vault-admin', { action: 'update-card' }, { id, updates })
    },
    async bulkUpdateCards(cardIds, updates) {
        return apiPost('vault-admin', { action: 'bulk-update-cards' }, { cardIds, updates })
    },
    async grantCard(data) {
        return apiPost('vault-admin', { action: 'grant-card' }, data)
    },
    async deleteCard(id) {
        return apiPost('vault-admin', { action: 'delete-card' }, { id })
    },
    async updateUserStats(userId, updates) {
        return apiPost('vault-admin', { action: 'update-user-stats' }, { userId, updates })
    },
    async getDefinitionOverrides(type) {
        return apiCall('vault-admin', { action: 'definition-overrides', type })
    },
    async saveDefinitionOverride(type, definitionId, metadata) {
        return apiPost('vault-admin', { action: 'save-definition-override' }, { type, definitionId, metadata })
    },
    async generateShareLink(playerSlug, holoEffect, rarity) {
        return apiPost('vault-admin', { action: 'generate-share-link' }, { playerSlug, holoEffect, rarity })
    },
    async generatePlayerDefs(params) {
        return apiPost('vault-admin', { action: 'generate-player-defs' }, params)
    },
    async freezeSeasonStats(seasonId) {
        return apiPost('vault-admin', { action: 'freeze-season-stats' }, { seasonId })
    },
    async backfillCardDefs() {
        return apiPost('vault-admin', { action: 'backfill-card-defs' }, {})
    },
    async refreshBestGods() {
        return apiPost('vault-admin', { action: 'refresh-best-gods' }, {})
    },
    async banUser(userId) {
        return apiPost('vault-admin', { action: 'ban-user' }, { userId })
    },
    async unbanUser(userId) {
        return apiPost('vault-admin', { action: 'unban-user' }, { userId })
    },
}

// ─── Vault Dashboard (card creator) ───

export const vaultDashboardService = {
    // Templates
    async getTemplates(params = {}) { return apiCall('vault-dashboard', { action: 'templates', ...params }) },
    async getTemplate(id) { return apiCall('vault-dashboard', { action: 'template', id }) },
    async saveTemplate(data) { return apiPost('vault-dashboard', { action: 'save-template' }, data) },

    // Drafts
    async getDrafts(params = {}) { return apiCall('vault-dashboard', { action: 'drafts', ...params }) },
    async getDraft(id) { return apiCall('vault-dashboard', { action: 'draft', id }) },
    async saveDraft(data) { return apiPost('vault-dashboard', { action: 'save-draft' }, data) },

    // Review workflow
    async submitForReview(type, id) { return apiPost('vault-dashboard', { action: 'submit-for-review' }, { type, id }) },
    async approve(type, id) { return apiPost('vault-dashboard', { action: 'approve' }, { type, id }) },
    async reject(type, id, reason) { return apiPost('vault-dashboard', { action: 'reject' }, { type, id, reason }) },
    async archiveTemplate(id) { return apiPost('vault-dashboard', { action: 'archive-template' }, { id }) },

    // Assets
    async getAssets(params = {}) { return apiCall('vault-dashboard', { action: 'assets', ...params }) },
    async getAsset(id) { return apiCall('vault-dashboard', { action: 'asset', id }) },
    async deleteAsset(id) { return apiPost('vault-dashboard', { action: 'delete-asset' }, { id }) },

    // Uploads (multipart — use fetch directly)
    async uploadAsset(file, { name, category, tags }) {
        const form = new FormData()
        form.append('file', file)
        form.append('name', name || file.name)
        form.append('category', category || 'background')
        if (tags) form.append('tags', tags.join(','))
        const token = localStorage.getItem('auth_token')
        const res = await fetch('/api/vault-dashboard-upload?action=upload-asset', {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: form,
        })
        return res.json()
    },

    async exportThumbnail(file, type, id) {
        const form = new FormData()
        form.append('file', file)
        const token = localStorage.getItem('auth_token')
        const res = await fetch(`/api/vault-dashboard-upload?action=export-thumbnail&type=${type}&id=${id}`, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: form,
        })
        return res.json()
    },
}


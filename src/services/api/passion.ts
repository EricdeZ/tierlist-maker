import { apiCall, apiPost } from './core'

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
    async earn(type: string, referenceId: string | null = null) {
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
    async heartbeat(sessionToken: string, ticks: number) {
        return apiPost('smiterunner', { action: 'heartbeat' }, { sessionToken, ticks })
    },
    async submitScore(sessionToken: string, score: number, ticks: number) {
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
    async claim(challengeId: number) {
        return apiPost('challenges', { action: 'claim' }, { challengeId })
    },
    async adminGetAll() {
        return apiCall('challenge-manage')
    },
    async create(data: any) {
        return apiPost('challenge-manage', {}, { action: 'create', ...data })
    },
    async update(data: any) {
        return apiPost('challenge-manage', {}, { action: 'update', ...data })
    },
    async toggle(id: number) {
        return apiPost('challenge-manage', {}, { action: 'toggle', id })
    },
    async remove(id: number) {
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
    async searchUsers(query: string) {
        return apiPost('challenge-manage', {}, { action: 'search-users', query })
    },
    async getUserChallenges(userId: number) {
        return apiPost('challenge-manage', {}, { action: 'user-challenges', userId })
    },
    async awardChallenge(userId: number, challengeId: number) {
        return apiPost('challenge-manage', {}, { action: 'award-challenge', userId, challengeId })
    },
    async revokeUserChallenge(userId: number, challengeId: number) {
        return apiPost('challenge-manage', {}, { action: 'revoke-user-challenge', userId, challengeId })
    },
    async getUserTitles(userId: number) {
        return apiPost('challenge-manage', {}, { action: 'get-user-titles', userId })
    },
    async grantTitle(userId: number, label: string, tier: string) {
        return apiPost('challenge-manage', {}, { action: 'grant-title', userId, label, tier })
    },
    async revokeTitle(titleId: number) {
        return apiPost('challenge-manage', {}, { action: 'revoke-title', titleId })
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
}

import { apiCall, apiPost } from './core'

export const forgeService = {
    async getMarket(seasonId: number) {
        return apiCall('forge', { action: 'market', seasonId })
    },
    async getPortfolio(seasonId: number) {
        return apiCall('forge', { action: 'portfolio', seasonId })
    },
    async getLeaderboard(seasonId: number) {
        return apiCall('forge', { action: 'leaderboard', seasonId })
    },
    async getHistory(sparkId: number) {
        return apiCall('forge', { action: 'history', sparkId })
    },
    async getBatchHistory(sparkIds: number[]) {
        return apiCall('forge', { action: 'batch-history', sparkIds: sparkIds.join(',') })
    },
    async getPortfolioTimeline(seasonId: number) {
        return apiCall('forge', { action: 'portfolio-timeline', seasonId })
    },
    async getMarketStatuses() {
        return apiCall('forge', { action: 'market-statuses' })
    },
    async fuel(sparkId: number, sparks: number) {
        return apiPost('forge', { action: 'fuel' }, { sparkId, sparks })
    },
    async cool(sparkId: number, sparks: number) {
        return apiPost('forge', { action: 'cool' }, { sparkId, sparks })
    },
    async liquidate(seasonId: number) {
        return apiPost('forge', { action: 'liquidate' }, { seasonId })
    },
    async toggleStatus(seasonId: number, status: string) {
        return apiPost('forge', { action: 'toggle-status' }, { seasonId, status })
    },
    async getTutorialStatus(seasonId: number) {
        return apiCall('forge', { action: 'tutorial-status', seasonId })
    },
    async tutorialFuel(sparkId: number) {
        return apiPost('forge', { action: 'tutorial-fuel' }, { sparkId })
    },
    async claimForgeReferral(refCode: string) {
        return apiPost('forge', { action: 'claim-forge-referral' }, { refCode })
    },
    async referralFuel(sparkId: number) {
        return apiPost('forge', { action: 'referral-fuel' }, { sparkId })
    },
}

export const referralService = {
    async getMyStats() {
        return apiCall('referrals', { action: 'my-stats' })
    },
    async validateCode(code: string) {
        return apiCall('referrals', { action: 'validate-code', code })
    },
    async claimReferral(code: string, type: string) {
        return apiPost('referrals', { action: 'claim' }, { code, type })
    },
}

export const predictionsService = {
    async getUpcoming(filters: Record<string, any> = {}) {
        return apiCall('predictions', { action: 'upcoming', ...filters })
    },
    async getMyPredictions(filters: Record<string, any> = {}) {
        return apiCall('predictions', { action: 'my-predictions', ...filters })
    },
    async getLeaderboard(seasonId: number) {
        return apiCall('predictions', { action: 'leaderboard', seasonId })
    },
    async predict(data: any) {
        return apiPost('predictions', { action: 'predict' }, data)
    },
    async lockToggle(scheduledMatchId: number, locked: boolean) {
        return apiPost('predictions', { action: 'lock-toggle' }, { scheduledMatchId, locked })
    },
    async getMatchupDetail(scheduledMatchId: number) {
        return apiCall('predictions', { action: 'matchup-detail', scheduledMatchId })
    },
    async refundAll() {
        return apiPost('predictions', { action: 'refund-all' })
    },
}

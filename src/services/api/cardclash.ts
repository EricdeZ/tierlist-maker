import { apiCall, apiPost } from './core'

export const cardclashService = {
    async load() {
        return apiCall('cardclash', { action: 'load' })
    },
    async openPack(packType: string, testMode?: boolean) {
        return apiPost('cardclash', { action: 'open-pack' }, { packType, testMode })
    },
    async getDefinitionOverrides() {
        return apiCall('cardclash', { action: 'definition-overrides' })
    },
    async getSharedCard(token: string) {
        return apiCall('cardclash', { action: 'shared-card', token })
    },
}

export const cardclashAdminService = {
    async getStats() {
        return apiCall('cardclash-admin', { action: 'stats' })
    },
    async listCards(params: Record<string, any> = {}) {
        return apiCall('cardclash-admin', { action: 'cards', ...params })
    },
    async getCard(id: number) {
        return apiCall('cardclash-admin', { action: 'card', id })
    },
    async listUsers(params: Record<string, any> = {}) {
        return apiCall('cardclash-admin', { action: 'users', ...params })
    },
    async getHoloTypes() {
        return apiCall('cardclash-admin', { action: 'holo-types' })
    },
    async updateCard(id: number, updates: any) {
        return apiPost('cardclash-admin', { action: 'update-card' }, { id, updates })
    },
    async bulkUpdateCards(cardIds: number[], updates: any) {
        return apiPost('cardclash-admin', { action: 'bulk-update-cards' }, { cardIds, updates })
    },
    async grantCard(data: any) {
        return apiPost('cardclash-admin', { action: 'grant-card' }, data)
    },
    async deleteCard(id: number) {
        return apiPost('cardclash-admin', { action: 'delete-card' }, { id })
    },
    async updateUserStats(userId: number, updates: any) {
        return apiPost('cardclash-admin', { action: 'update-user-stats' }, { userId, updates })
    },
    async getDefinitionOverrides(type: string) {
        return apiCall('cardclash-admin', { action: 'definition-overrides', type })
    },
    async saveDefinitionOverride(type: string, definitionId: number, metadata: any) {
        return apiPost('cardclash-admin', { action: 'save-definition-override' }, { type, definitionId, metadata })
    },
    async generateShareLink(playerSlug: string, holoEffect: string, rarity: string) {
        return apiPost('cardclash-admin', { action: 'generate-share-link' }, { playerSlug, holoEffect, rarity })
    },
}

import { apiCall, apiPost } from './core'

export const siteConfigService = {
    async get(keys: string[]) {
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
        return apiCall('featured-streamer', { action: 'my-status' })
    },
    async register(twitch_channel: string) {
        return apiPost('featured-streamer', { action: 'register' }, { twitch_channel })
    },
    async updateChannel(twitch_channel: string) {
        return apiPost('featured-streamer', { action: 'update-channel' }, { twitch_channel })
    },
    async deactivate() {
        return apiPost('featured-streamer', { action: 'deactivate' })
    },
    async reactivate() {
        return apiPost('featured-streamer', { action: 'reactivate' })
    },
    async heartbeat(streamer_id: number) {
        return apiPost('featured-streamer', { action: 'heartbeat' }, { streamer_id })
    },
}

export const feedbackService = {
    async submit(data: any) {
        return apiPost('feedback', {}, data)
    },
    async adminGetAll() {
        return apiCall('feedback')
    },
    async remove(id: number) {
        return apiPost('feedback', {}, { action: 'delete', id })
    },
}

export const tierlistFeedService = {
    async getFeed(seasonId: number, limit = 20, offset = 0) {
        return apiCall('tierlist-feed', { action: 'feed', seasonId, limit, offset })
    },
    async getPost(postId: number) {
        return apiCall('tierlist-feed', { action: 'post', postId })
    },
    async publish(seasonId: number, rankings: any, title: string) {
        return apiPost('tierlist-feed', {}, { action: 'publish', seasonId, rankings, title })
    },
    async like(postId: number) {
        return apiPost('tierlist-feed', {}, { action: 'like', postId })
    },
    async deletePost(postId: number) {
        return apiPost('tierlist-feed', {}, { action: 'delete', postId })
    },
}

export const arcadeNpcService = {
    async list() { return apiCall('arcade-npcs', { action: 'list' }) },
    async adminList() { return apiCall('arcade-npcs', { action: 'admin-list' }) },
    async create(data: any) { return apiPost('arcade-npcs', { action: 'create' }, data) },
    async update(data: any) { return apiPost('arcade-npcs', { action: 'update' }, data) },
    async toggle(id: number) { return apiPost('arcade-npcs', { action: 'toggle' }, { id }) },
    async remove(id: number) { return apiPost('arcade-npcs', { action: 'delete' }, { id }) },
}

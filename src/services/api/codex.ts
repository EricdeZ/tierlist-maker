import { apiCall, apiPost, API_BASE } from './core'

export const codexService = {
    async getAll() {
        return apiCall('codex-manage')
    },
    // Fields
    async createField(data: any) {
        return apiPost('codex-manage', {}, { action: 'create-field', ...data })
    },
    async updateField(data: any) {
        return apiPost('codex-manage', {}, { action: 'update-field', ...data })
    },
    async deleteField(id: number) {
        return apiPost('codex-manage', {}, { action: 'delete-field', id })
    },
    // Tags
    async createTag(data: any) {
        return apiPost('codex-manage', {}, { action: 'create-tag', ...data })
    },
    async updateTag(data: any) {
        return apiPost('codex-manage', {}, { action: 'update-tag', ...data })
    },
    async deleteTag(id: number) {
        return apiPost('codex-manage', {}, { action: 'delete-tag', id })
    },
    // Items
    async createItem(data: any) {
        return apiPost('codex-manage', {}, { action: 'create-item', ...data })
    },
    async updateItem(data: any) {
        return apiPost('codex-manage', {}, { action: 'update-item', ...data })
    },
    async deleteItem(id: number) {
        return apiPost('codex-manage', {}, { action: 'delete-item', id })
    },
    // Images
    async getImages(category?: string) {
        return apiCall('codex-upload', category ? { category } : {})
    },
    async uploadImage(file: File, category?: string) {
        const formData = new FormData()
        formData.append('file', file)
        if (category) formData.append('category', category)
        const token = localStorage.getItem('auth_token')
        const res = await fetch(`${API_BASE}/codex-upload`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` } as Record<string, string>,
            body: formData,
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Upload failed')
        return data
    },
    async deleteImage(id: number) {
        const token = localStorage.getItem('auth_token')
        const res = await fetch(`${API_BASE}/codex-upload?id=${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` } as Record<string, string>,
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Delete failed')
        return data
    },
    async updateImageCategory(id: number, category: string) {
        return apiPost('codex-manage', {}, { action: 'update-image-category', id, category })
    },
    // Group Types
    async createGroupType(data: any) {
        return apiPost('codex-manage', {}, { action: 'create-group-type', ...data })
    },
    async updateGroupType(data: any) {
        return apiPost('codex-manage', {}, { action: 'update-group-type', ...data })
    },
    async deleteGroupType(id: number) {
        return apiPost('codex-manage', {}, { action: 'delete-group-type', id })
    },
    // Gods
    async getAllGods() {
        return apiCall('codex-manage', { type: 'gods' })
    },
    async createGodField(data: any) {
        return apiPost('codex-manage', {}, { action: 'create-god-field', ...data })
    },
    async updateGodField(data: any) {
        return apiPost('codex-manage', {}, { action: 'update-god-field', ...data })
    },
    async deleteGodField(id: number) {
        return apiPost('codex-manage', {}, { action: 'delete-god-field', id })
    },
    async createGodTag(data: any) {
        return apiPost('codex-manage', {}, { action: 'create-god-tag', ...data })
    },
    async updateGodTag(data: any) {
        return apiPost('codex-manage', {}, { action: 'update-god-tag', ...data })
    },
    async deleteGodTag(id: number) {
        return apiPost('codex-manage', {}, { action: 'delete-god-tag', id })
    },
    async createGod(data: any) {
        return apiPost('codex-manage', {}, { action: 'create-god', ...data })
    },
    async updateGod(data: any) {
        return apiPost('codex-manage', {}, { action: 'update-god', ...data })
    },
    async deleteGod(id: number) {
        return apiPost('codex-manage', {}, { action: 'delete-god', id })
    },
    // God Categories
    async createGodCategory(data: any) {
        return apiPost('codex-manage', {}, { action: 'create-god-category', ...data })
    },
    async updateGodCategory(data: any) {
        return apiPost('codex-manage', {}, { action: 'update-god-category', ...data })
    },
    async deleteGodCategory(id: number) {
        return apiPost('codex-manage', {}, { action: 'delete-god-category', id })
    },
    async reorderGodCategories(items: any[]) {
        return apiPost('codex-manage', {}, { action: 'reorder-god-categories', items })
    },
    // God Images (gallery)
    async addGodImage(data: any) {
        return apiPost('codex-manage', {}, { action: 'add-god-image', ...data })
    },
    async removeGodImage(id: number) {
        return apiPost('codex-manage', {}, { action: 'remove-god-image', id })
    },
    async reorderGodImages(items: any[]) {
        return apiPost('codex-manage', {}, { action: 'reorder-god-images', items })
    },
    async updateGodImageCaption(id: number, caption: string) {
        return apiPost('codex-manage', {}, { action: 'update-god-image', id, caption })
    },
    // Wordle Categories
    async getWordleCategories() {
        return apiCall('codex-manage', { type: 'wordle' })
    },
    async createWordleCategory(data: any) {
        return apiPost('codex-manage', {}, { action: 'create-wordle-category', ...data })
    },
    async updateWordleCategory(data: any) {
        return apiPost('codex-manage', {}, { action: 'update-wordle-category', ...data })
    },
    async deleteWordleCategory(id: number) {
        return apiPost('codex-manage', {}, { action: 'delete-wordle-category', id })
    },
}

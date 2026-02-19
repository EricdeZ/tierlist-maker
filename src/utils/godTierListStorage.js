// src/utils/godTierListStorage.js
const STORAGE_KEY = 'god-tierlist'
const TIERS = ['S', 'A', 'B', 'C', 'D', 'F']

export const saveGodTierList = (tiers) => {
    try {
        const data = {
            tiers,
            timestamp: new Date().toISOString(),
            version: '1.0',
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
        console.error('Failed to save god tier list:', error)
    }
}

export const loadGodTierList = () => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (!saved) return null
        const data = JSON.parse(saved)
        if (!data.tiers || typeof data.tiers !== 'object') return null
        const hasTiers = TIERS.every(t => Array.isArray(data.tiers[t]))
        if (!hasTiers) return null
        return data.tiers
    } catch {
        return null
    }
}

export const clearGodTierList = () => {
    try {
        localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
        console.error('Failed to clear god tier list:', error)
    }
}

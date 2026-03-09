// src/utils/localStorage.ts
/**
 * Utilities for managing rankings in localStorage.
 * Storage key is now parameterized so rankings are scoped per division.
 */

const DEFAULT_KEY = 'tierlist-rankings'

export interface RankingsData {
    rankings: Record<string, unknown[]>
    selectedStat: string
    playerStatOverrides: Record<string, unknown>
}

interface StoredData extends RankingsData {
    timestamp: string
    version: string
}

/**
 * Save rankings to localStorage
 */
export const saveRankingsToStorage = (
    rankings: Record<string, unknown[]>,
    storageKey: string = DEFAULT_KEY,
    extra: Record<string, unknown> = {},
): void => {
    try {
        const dataToSave: StoredData = {
            rankings,
            ...extra as Partial<RankingsData>,
            timestamp: new Date().toISOString(),
            version: '2.1'
        }
        localStorage.setItem(storageKey, JSON.stringify(dataToSave))
    } catch (error) {
        console.error('Failed to save rankings to localStorage:', error)
    }
}

/**
 * Load rankings from localStorage
 */
export const loadRankingsFromStorage = (storageKey: string = DEFAULT_KEY): RankingsData | null => {
    try {
        const saved = localStorage.getItem(storageKey)
        if (!saved) return null

        const data = JSON.parse(saved)

        if (!data.rankings || typeof data.rankings !== 'object') return null

        const requiredRoles = ['SOLO', 'JUNGLE', 'MID', 'SUPPORT', 'ADC']
        const hasAllRoles = requiredRoles.every(role => Array.isArray(data.rankings[role]))
        if (!hasAllRoles) return null

        return {
            rankings: data.rankings,
            selectedStat: data.selectedStat || 'none',
            playerStatOverrides: data.playerStatOverrides || {},
        }
    } catch (error) {
        console.error('Failed to load rankings from localStorage:', error)
        return null
    }
}

/**
 * Clear rankings from localStorage
 */
export const clearRankingsFromStorage = (storageKey: string = DEFAULT_KEY): void => {
    try {
        localStorage.removeItem(storageKey)
    } catch (error) {
        console.error('Failed to clear rankings from localStorage:', error)
    }
}

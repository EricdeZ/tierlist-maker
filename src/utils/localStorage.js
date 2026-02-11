// src/utils/localStorage.js
/**
 * Utilities for managing rankings in localStorage.
 * Storage key is now parameterized so rankings are scoped per division.
 */

const DEFAULT_KEY = 'tierlist-rankings'

/**
 * Save rankings to localStorage
 * @param {Object} rankings - The rankings object to save
 * @param {string} [storageKey] - Optional custom storage key (e.g. scoped by division)
 * @param {Object} [extra] - Optional extra fields to persist (e.g. selectedStat, playerStatOverrides)
 */
export const saveRankingsToStorage = (rankings, storageKey = DEFAULT_KEY, extra = {}) => {
    try {
        const dataToSave = {
            rankings,
            ...extra,
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
 * @param {string} [storageKey] - Optional custom storage key
 * @returns {Object|null} The saved rankings object or null if not found/invalid
 */
export const loadRankingsFromStorage = (storageKey = DEFAULT_KEY) => {
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
 * @param {string} [storageKey] - Optional custom storage key
 */
export const clearRankingsFromStorage = (storageKey = DEFAULT_KEY) => {
    try {
        localStorage.removeItem(storageKey)
    } catch (error) {
        console.error('Failed to clear rankings from localStorage:', error)
    }
}

/**
 * Check if there are saved rankings in localStorage
 * @param {string} [storageKey] - Optional custom storage key
 * @returns {boolean}
 */
export const hasSavedRankings = (storageKey = DEFAULT_KEY) => {
    try {
        return localStorage.getItem(storageKey) !== null
    } catch {
        return false
    }
}
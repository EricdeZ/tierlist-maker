// src/utils/localStorage.js
/**
 * Utilities for managing rankings in localStorage
 */

const RANKINGS_STORAGE_KEY = 'tierlist-rankings'

/**
 * Save rankings to localStorage
 * @param {Object} rankings - The rankings object to save
 */
export const saveRankingsToStorage = (rankings) => {
    try {
        const dataToSave = {
            rankings,
            timestamp: new Date().toISOString(),
            version: '1.0' // For future migrations if needed
        }
        localStorage.setItem(RANKINGS_STORAGE_KEY, JSON.stringify(dataToSave))
        console.log('Rankings saved to localStorage')
    } catch (error) {
        console.error('Failed to save rankings to localStorage:', error)
    }
}

/**
 * Load rankings from localStorage
 * @returns {Object|null} The saved rankings object or null if not found/invalid
 */
export const loadRankingsFromStorage = () => {
    try {
        const saved = localStorage.getItem(RANKINGS_STORAGE_KEY)
        if (!saved) return null

        const data = JSON.parse(saved)

        // Validate the data structure
        if (!data.rankings || typeof data.rankings !== 'object') {
            console.warn('Invalid rankings data in localStorage')
            return null
        }

        // Validate that all required roles exist
        const requiredRoles = ['SOLO', 'JUNGLE', 'MID', 'SUPPORT', 'ADC']
        const hasAllRoles = requiredRoles.every(role =>
            Array.isArray(data.rankings[role])
        )

        if (!hasAllRoles) {
            console.warn('Missing required roles in saved rankings')
            return null
        }

        console.log('Rankings loaded from localStorage:', data.timestamp)
        return data.rankings
    } catch (error) {
        console.error('Failed to load rankings from localStorage:', error)
        return null
    }
}

/**
 * Clear rankings from localStorage
 */
export const clearRankingsFromStorage = () => {
    try {
        localStorage.removeItem(RANKINGS_STORAGE_KEY)
        console.log('Rankings cleared from localStorage')
    } catch (error) {
        console.error('Failed to clear rankings from localStorage:', error)
    }
}

/**
 * Check if there are saved rankings in localStorage
 * @returns {boolean} True if saved rankings exist
 */
export const hasSavedRankings = () => {
    try {
        return localStorage.getItem(RANKINGS_STORAGE_KEY) !== null
    } catch (error) {
        console.error('Failed to check localStorage:', error)
        return false
    }
}
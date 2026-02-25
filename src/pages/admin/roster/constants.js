// src/pages/admin/roster/constants.js

export const API = import.meta.env.VITE_API_URL || '/api'
export const STORAGE_KEY = 'smite2_roster_admin'

export const ROLES = ['Solo', 'Jungle', 'Mid', 'Support', 'ADC', 'Fill']

export const ROLE_COLORS = {
    solo: 'bg-amber-500/20 text-amber-400',
    jungle: 'bg-green-500/20 text-green-400',
    mid: 'bg-blue-500/20 text-blue-400',
    support: 'bg-purple-500/20 text-purple-400',
    adc: 'bg-red-500/20 text-red-400',
    fill: 'bg-white/10 text-[var(--color-text-secondary)]',
}

export const POOL_ROLE_COLORS = {
    solo: 'bg-amber-500/20 text-amber-400',
    jungle: 'bg-green-500/20 text-green-400',
    mid: 'bg-blue-500/20 text-blue-400',
    support: 'bg-purple-500/20 text-purple-400',
    adc: 'bg-red-500/20 text-red-400',
    fill: 'bg-gray-500/20 text-gray-400',
}

export const playerSort = (a, b) => {
    if (a.roster_status === 'captain' && b.roster_status !== 'captain') return -1
    if (a.roster_status !== 'captain' && b.roster_status === 'captain') return 1
    return a.name.localeCompare(b.name)
}

// ─── Persistence ───
export function loadState() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
    } catch {
        return {}
    }
}

export function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

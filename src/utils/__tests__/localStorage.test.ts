import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
    saveRankingsToStorage,
    loadRankingsFromStorage,
    clearRankingsFromStorage,
} from '../localStorage'

beforeEach(() => {
    localStorage.clear()
})

const validRankings = {
    SOLO: [{ name: 'Player1' }],
    JUNGLE: [{ name: 'Player2' }],
    MID: [{ name: 'Player3' }],
    SUPPORT: [{ name: 'Player4' }],
    ADC: [{ name: 'Player5' }],
}

describe('saveRankingsToStorage', () => {
    it('saves rankings to localStorage with default key', () => {
        saveRankingsToStorage(validRankings)
        const raw = localStorage.getItem('tierlist-rankings')
        expect(raw).not.toBeNull()
        const parsed = JSON.parse(raw!)
        expect(parsed.rankings).toEqual(validRankings)
        expect(parsed.version).toBe('2.1')
        expect(parsed.timestamp).toBeDefined()
    })

    it('saves with a custom storage key', () => {
        saveRankingsToStorage(validRankings, 'my-division')
        expect(localStorage.getItem('tierlist-rankings')).toBeNull()
        expect(localStorage.getItem('my-division')).not.toBeNull()
    })

    it('merges extra fields into saved data', () => {
        saveRankingsToStorage(validRankings, 'tierlist-rankings', {
            selectedStat: 'kda',
            playerStatOverrides: { p1: 5 },
        })
        const parsed = JSON.parse(localStorage.getItem('tierlist-rankings')!)
        expect(parsed.selectedStat).toBe('kda')
        expect(parsed.playerStatOverrides).toEqual({ p1: 5 })
    })

    it('handles localStorage errors gracefully', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('QuotaExceededError')
        })
        // Should not throw
        saveRankingsToStorage(validRankings)
        expect(spy).toHaveBeenCalled()
        spy.mockRestore()
        vi.restoreAllMocks()
    })
})

describe('loadRankingsFromStorage', () => {
    it('returns saved rankings after a save/load cycle', () => {
        saveRankingsToStorage(validRankings)
        const result = loadRankingsFromStorage()
        expect(result).not.toBeNull()
        expect(result!.rankings).toEqual(validRankings)
    })

    it('returns null when nothing is stored', () => {
        expect(loadRankingsFromStorage()).toBeNull()
    })

    it('returns null for corrupt JSON', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        localStorage.setItem('tierlist-rankings', '{not valid json')
        expect(loadRankingsFromStorage()).toBeNull()
        spy.mockRestore()
    })

    it('returns null when rankings is missing', () => {
        localStorage.setItem('tierlist-rankings', JSON.stringify({ version: '2.1' }))
        expect(loadRankingsFromStorage()).toBeNull()
    })

    it('returns null when rankings is not an object', () => {
        localStorage.setItem('tierlist-rankings', JSON.stringify({ rankings: 'nope' }))
        expect(loadRankingsFromStorage()).toBeNull()
    })

    it('returns null when a required role is missing', () => {
        const incomplete = { SOLO: [], JUNGLE: [], MID: [], SUPPORT: [] } // missing ADC
        localStorage.setItem('tierlist-rankings', JSON.stringify({ rankings: incomplete }))
        expect(loadRankingsFromStorage()).toBeNull()
    })

    it('returns null when a required role is not an array', () => {
        const badRankings = { ...validRankings, ADC: 'not an array' }
        localStorage.setItem('tierlist-rankings', JSON.stringify({ rankings: badRankings }))
        expect(loadRankingsFromStorage()).toBeNull()
    })

    it('defaults selectedStat to "none" when missing', () => {
        saveRankingsToStorage(validRankings)
        const result = loadRankingsFromStorage()
        expect(result!.selectedStat).toBe('none')
    })

    it('defaults playerStatOverrides to {} when missing', () => {
        saveRankingsToStorage(validRankings)
        const result = loadRankingsFromStorage()
        expect(result!.playerStatOverrides).toEqual({})
    })

    it('preserves selectedStat and playerStatOverrides when present', () => {
        saveRankingsToStorage(validRankings, 'tierlist-rankings', {
            selectedStat: 'winrate',
            playerStatOverrides: { p1: 10 },
        })
        const result = loadRankingsFromStorage()
        expect(result!.selectedStat).toBe('winrate')
        expect(result!.playerStatOverrides).toEqual({ p1: 10 })
    })

    it('loads from a custom storage key', () => {
        saveRankingsToStorage(validRankings, 'custom-key')
        expect(loadRankingsFromStorage('custom-key')).not.toBeNull()
        expect(loadRankingsFromStorage()).toBeNull()
    })
})

describe('clearRankingsFromStorage', () => {
    it('removes rankings from localStorage', () => {
        saveRankingsToStorage(validRankings)
        expect(loadRankingsFromStorage()).not.toBeNull()
        clearRankingsFromStorage()
        expect(loadRankingsFromStorage()).toBeNull()
    })

    it('clears from a custom key', () => {
        saveRankingsToStorage(validRankings, 'custom-key')
        clearRankingsFromStorage('custom-key')
        expect(loadRankingsFromStorage('custom-key')).toBeNull()
    })

    it('does not throw when key does not exist', () => {
        expect(() => clearRankingsFromStorage('nonexistent')).not.toThrow()
    })
})

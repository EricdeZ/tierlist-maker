import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const mockGetPlayerStats = vi.fn()

vi.mock('../../context/DivisionContext', () => ({
    useDivision: () => divisionValue,
}))

vi.mock('../../services/database', () => ({
    statsService: {
        getPlayerStats: (...args) => mockGetPlayerStats(...args),
    },
}))

let divisionValue = { season: null }

import { usePlayerStats } from '../usePlayerStats'

beforeEach(() => {
    mockGetPlayerStats.mockReset()
    divisionValue = { season: null }
})

afterEach(() => {
    vi.restoreAllMocks()
})

const samplePlayer = {
    id: 1,
    name: 'TestPlayer',
    tracker_url: 'https://tracker.example.com/player',
    role: 'MID',
    secondary_role: 'SUPPORT',
    team_name: 'Alpha',
    team_color: '#ff0000',
    games_played: '10',
    wins: '7',
    total_kills: '50',
    total_deaths: '20',
    total_assists: '30',
    total_damage: '100000',
    total_mitigated: '50000',
    avg_kills: '5.0',
    avg_deaths: '2.0',
    avg_assists: '3.0',
    avg_damage: '10000',
    avg_mitigated: '5000',
}

describe('usePlayerStats', () => {
    it('returns empty data when no season', () => {
        divisionValue = { season: null }
        const { result } = renderHook(() => usePlayerStats())
        expect(result.current.data).toEqual([])
        expect(result.current.loading).toBe(false)
        expect(result.current.error).toBeNull()
    })

    it('fetches and processes player stats when season is available', async () => {
        divisionValue = { season: { id: 42 } }
        mockGetPlayerStats.mockResolvedValue([samplePlayer])

        const { result } = renderHook(() => usePlayerStats())

        // Initially loading
        expect(result.current.loading).toBe(true)

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(mockGetPlayerStats).toHaveBeenCalledWith(42)
        expect(result.current.data).toHaveLength(1)

        const player = result.current.data[0]
        expect(player.id).toBe(1)
        expect(player.name).toBe('TestPlayer')
        expect(player.team.name).toBe('Alpha')
        expect(player.team.color).toBe('#ff0000')
        expect(player.stats.kills).toBe(50)
        expect(player.stats.deaths).toBe(20)
        expect(player.stats.gamesPlayed).toBe(10)
        expect(player.winRate).toBe(70)
        // KDA: (50 + 30/2) / 20 = 65/20 = 3.25
        expect(player.kda).toBe(3.25)
    })

    it('handles KDA when deaths are zero', async () => {
        divisionValue = { season: { id: 1 } }
        mockGetPlayerStats.mockResolvedValue([{
            ...samplePlayer,
            total_deaths: '0',
        }])

        const { result } = renderHook(() => usePlayerStats())
        await waitFor(() => expect(result.current.loading).toBe(false))

        // KDA with 0 deaths: kills + assists/2 = 50 + 15 = 65
        expect(result.current.data[0].kda).toBe(65)
    })

    it('sets error state on fetch failure', async () => {
        divisionValue = { season: { id: 1 } }
        mockGetPlayerStats.mockRejectedValue(new Error('Network error'))

        const { result } = renderHook(() => usePlayerStats())
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.error).toBe('Network error')
        expect(result.current.data).toEqual([])
    })

    it('returns season from division context', () => {
        const season = { id: 99 }
        divisionValue = { season }
        mockGetPlayerStats.mockResolvedValue([])

        const { result } = renderHook(() => usePlayerStats())
        expect(result.current.season).toBe(season)
    })

    it('handles missing optional player fields gracefully', async () => {
        divisionValue = { season: { id: 1 } }
        mockGetPlayerStats.mockResolvedValue([{
            id: 2,
            name: 'Minimal',
            // no tracker_url, role, secondary_role, team_name, team_color
            games_played: '0',
            wins: '0',
            total_kills: '0',
            total_deaths: '0',
            total_assists: '0',
            total_damage: '0',
            total_mitigated: '0',
            avg_kills: null,
            avg_deaths: null,
            avg_assists: null,
            avg_damage: null,
            avg_mitigated: null,
        }])

        const { result } = renderHook(() => usePlayerStats())
        await waitFor(() => expect(result.current.loading).toBe(false))

        const player = result.current.data[0]
        expect(player.tracker).toBe('')
        expect(player.role).toBe('')
        expect(player.team.name).toBe('No Team')
        expect(player.team.color).toBe('#6b7280')
        expect(player.winRate).toBe(0)
        expect(player.kda).toBe(0)
    })
})

import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { roles, roleImages, STAT_TYPES } from '../constants'
import { useDragDrop } from '../useDragDrop'
import { useStatLocking } from '../useStatLocking'

// Mock asset imports (vitest handles .webp as strings by default)
vi.mock('../../../assets/roles/solo.webp', () => ({ default: 'solo.webp' }))
vi.mock('../../../assets/roles/jungle.webp', () => ({ default: 'jungle.webp' }))
vi.mock('../../../assets/roles/mid.webp', () => ({ default: 'mid.webp' }))
vi.mock('../../../assets/roles/supp.webp', () => ({ default: 'supp.webp' }))
vi.mock('../../../assets/roles/adc.webp', () => ({ default: 'adc.webp' }))

describe('constants', () => {
    it('exports roles as an array of 5 role strings', () => {
        expect(roles).toEqual(['SOLO', 'JUNGLE', 'MID', 'SUPPORT', 'ADC'])
    })

    it('exports roleImages with a key for each role', () => {
        for (const role of roles) {
            expect(roleImages).toHaveProperty(role)
        }
    })

    it('exports STAT_TYPES with expected keys', () => {
        expect(STAT_TYPES).toBeInstanceOf(Array)
        expect(STAT_TYPES.length).toBe(7)
        expect(STAT_TYPES[0].key).toBe('none')
        expect(STAT_TYPES.map(s => s.key)).toEqual([
            'none', 'kda', 'killsPerGame', 'deathsPerGame',
            'assistsPerGame', 'damagePerGame', 'mitigationsPerGame',
        ])
    })

    it('each STAT_TYPE has label and buttonLabel', () => {
        for (const st of STAT_TYPES) {
            expect(st).toHaveProperty('label')
            expect(st).toHaveProperty('buttonLabel')
            expect(typeof st.label).toBe('string')
            expect(typeof st.buttonLabel).toBe('string')
        }
    })
})

describe('useDragDrop', () => {
    const emptyRankings = { SOLO: [], JUNGLE: [], MID: [], SUPPORT: [], ADC: [] }

    function renderDragDrop(overrides = {}) {
        const setRankings = vi.fn()
        const lockPlayerStat = vi.fn()
        const setSpotlightPlayer = vi.fn()

        return renderHook(() =>
            useDragDrop({
                rankings: emptyRankings,
                setRankings,
                lockPlayerStat,
                showSpotlight: false,
                setSpotlightPlayer,
                ...overrides,
            })
        )
    }

    it('initializes with null drag state', () => {
        const { result } = renderDragDrop()

        expect(result.current.draggedItem).toBeNull()
        expect(result.current.dragOverZone).toBeNull()
        expect(result.current.dragOverIndex).toBeNull()
    })

    it('handleDragStart sets draggedItem state', () => {
        const { result } = renderDragDrop()

        const mockEvent = {
            dataTransfer: { effectAllowed: '' },
        }

        act(() => {
            result.current.handleDragStart(mockEvent, 'PlayerA', 'team1')
        })

        expect(result.current.draggedItem).toEqual({
            player: 'PlayerA',
            sourceTeam: 'team1',
            sourceRole: null,
            sourceIndex: null,
            type: 'team',
        })
    })

    it('handleDragStart with sourceRole sets type to ranking', () => {
        const { result } = renderDragDrop()

        const mockEvent = {
            dataTransfer: { effectAllowed: '' },
        }

        act(() => {
            result.current.handleDragStart(mockEvent, 'PlayerA', null, 'SOLO', 0)
        })

        expect(result.current.draggedItem).toEqual({
            player: 'PlayerA',
            sourceTeam: null,
            sourceRole: 'SOLO',
            sourceIndex: 0,
            type: 'ranking',
        })
    })

    it('handleDragEnd clears drag state after timeout', async () => {
        vi.useFakeTimers()
        const { result } = renderDragDrop()

        const mockEvent = {
            dataTransfer: { effectAllowed: '' },
        }

        act(() => {
            result.current.handleDragStart(mockEvent, 'PlayerA', 'team1')
        })

        expect(result.current.draggedItem).not.toBeNull()

        act(() => {
            result.current.handleDragEnd()
            vi.advanceTimersByTime(100)
        })

        expect(result.current.draggedItem).toBeNull()
        expect(result.current.dragOverZone).toBeNull()
        expect(result.current.dragOverIndex).toBeNull()

        vi.useRealTimers()
    })

    it('handleDragEnter sets dragOverZone and dragOverIndex', () => {
        const { result } = renderDragDrop()

        act(() => {
            result.current.handleDragEnter(
                { preventDefault: vi.fn() },
                'MID',
                2
            )
        })

        expect(result.current.dragOverZone).toBe('MID')
        expect(result.current.dragOverIndex).toBe(2)
    })

    it('getDisplayRankings returns rankings when not dragging', () => {
        const rankings = { ...emptyRankings, SOLO: ['PlayerA', 'PlayerB'] }
        const { result } = renderDragDrop({ rankings })

        expect(result.current.getDisplayRankings('SOLO')).toEqual(['PlayerA', 'PlayerB'])
        expect(result.current.getDisplayRankings('MID')).toEqual([])
    })
})

describe('useStatLocking', () => {
    function makeStatsMap(entries) {
        const map = new Map()
        for (const [name, data] of entries) {
            map.set(name, data)
        }
        return map
    }

    const mockPlayerStats = (kda, kills, deaths, assists, damage, mitigated, games) => ({
        kda,
        avgStats: {
            avgKills: kills,
            avgDeaths: deaths,
            avgAssists: assists,
            avgDamage: damage,
            avgMitigated: mitigated,
        },
        stats: { gamesPlayed: games },
        winRate: 50,
    })

    const emptyRankings = { SOLO: [], JUNGLE: [], MID: [], SUPPORT: [], ADC: [] }

    function renderStatLocking(overrides = {}) {
        const setRankings = vi.fn()

        return renderHook(() =>
            useStatLocking({
                rankings: emptyRankings,
                setRankings,
                statsMap: new Map(),
                teams: [],
                savedLockedStats: undefined,
                savedSelectedStat: undefined,
                ...overrides,
            })
        )
    }

    it('initializes with default state', () => {
        const { result } = renderStatLocking()

        expect(result.current.selectedStat).toBe('none')
        expect(result.current.lockedStats).toEqual({})
    })

    it('initializes with saved state when provided', () => {
        const { result } = renderStatLocking({
            savedSelectedStat: 'kda',
            savedLockedStats: { PlayerA: 'kda' },
        })

        expect(result.current.selectedStat).toBe('kda')
        expect(result.current.lockedStats).toEqual({ PlayerA: 'kda' })
    })

    it('getStatValue returns null for "none" stat type', () => {
        const { result } = renderStatLocking()

        expect(result.current.getStatValue('PlayerA', 'none')).toBeNull()
    })

    it('getStatValue returns null for unknown player', () => {
        const { result } = renderStatLocking()

        expect(result.current.getStatValue('UnknownPlayer', 'kda')).toBeNull()
    })

    it('getStatValue returns formatted KDA value', () => {
        const statsMap = makeStatsMap([
            ['PlayerA', mockPlayerStats(3.5, 5.2, 2.1, 8.3, 25000, 15000, 10)],
        ])
        const { result } = renderStatLocking({ statsMap })

        const kda = result.current.getStatValue('PlayerA', 'kda')
        expect(kda).toEqual({ value: '3.50', label: 'KDA' })
    })

    it('getStatValue returns formatted kills per game', () => {
        const statsMap = makeStatsMap([
            ['PlayerA', mockPlayerStats(3.5, 5.2, 2.1, 8.3, 25000, 15000, 10)],
        ])
        const { result } = renderStatLocking({ statsMap })

        const kills = result.current.getStatValue('PlayerA', 'killsPerGame')
        expect(kills).toEqual({ value: '5.2', label: 'K/G' })
    })

    it('getStatValue returns formatted damage per game', () => {
        const statsMap = makeStatsMap([
            ['PlayerA', mockPlayerStats(3.5, 5.2, 2.1, 8.3, 25000, 15000, 10)],
        ])
        const { result } = renderStatLocking({ statsMap })

        const damage = result.current.getStatValue('PlayerA', 'damagePerGame')
        expect(damage.label).toBe('Dmg/G')
        // toLocaleString formatting varies by environment; just check numeric value
        expect(parseInt(damage.value.replace(/\D/g, ''))).toBe(25000)
    })

    it('getNumericStatValue returns raw numeric values', () => {
        const statsMap = makeStatsMap([
            ['PlayerA', mockPlayerStats(3.5, 5.2, 2.1, 8.3, 25000, 15000, 10)],
        ])
        const { result } = renderStatLocking({ statsMap })

        expect(result.current.getNumericStatValue('PlayerA', 'kda')).toBe(3.5)
        expect(result.current.getNumericStatValue('PlayerA', 'killsPerGame')).toBe(5.2)
        expect(result.current.getNumericStatValue('PlayerA', 'deathsPerGame')).toBe(2.1)
        expect(result.current.getNumericStatValue('PlayerA', 'damagePerGame')).toBe(25000)
    })

    it('getNumericStatValue returns -Infinity for unknown player', () => {
        const { result } = renderStatLocking()

        expect(result.current.getNumericStatValue('Unknown', 'kda')).toBe(-Infinity)
    })

    it('lockPlayerStat locks a player to the current selectedStat', () => {
        const { result } = renderStatLocking({
            savedSelectedStat: 'kda',
        })

        act(() => {
            result.current.lockPlayerStat('PlayerA')
        })

        expect(result.current.lockedStats).toEqual({ PlayerA: 'kda' })
    })

    it('lockPlayerStat does nothing when selectedStat is none', () => {
        const { result } = renderStatLocking()

        act(() => {
            result.current.lockPlayerStat('PlayerA')
        })

        expect(result.current.lockedStats).toEqual({})
    })

    it('unlockPlayerStat removes a player lock', () => {
        const { result } = renderStatLocking({
            savedLockedStats: { PlayerA: 'kda', PlayerB: 'kda' },
        })

        act(() => {
            result.current.unlockPlayerStat('PlayerA')
        })

        expect(result.current.lockedStats).toEqual({ PlayerB: 'kda' })
    })
})

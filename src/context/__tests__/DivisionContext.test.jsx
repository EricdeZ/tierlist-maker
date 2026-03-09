import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

// vi.hoisted runs before vi.mock hoisting — safe to reference in factories
const { routeParams, authState, mockLeagueService, mockTeamService, mockPlayerService } = vi.hoisted(() => ({
    routeParams: { leagueSlug: '', divisionSlug: '' },
    authState: {
        hasPermission: vi.fn(() => false),
        loading: false,
    },
    mockLeagueService: {
        getBySlug: vi.fn(),
    },
    mockTeamService: {
        getAllBySeason: vi.fn(),
    },
    mockPlayerService: {
        getAllBySeason: vi.fn(),
    },
}))

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom')
    return {
        ...actual,
        useParams: () => routeParams,
    }
})

vi.mock('../AuthContext', () => ({
    useAuth: () => authState,
}))

vi.mock('../../services/database', () => ({
    leagueService: mockLeagueService,
    teamService: mockTeamService,
    playerService: mockPlayerService,
}))

import { DivisionProvider, useDivision } from '../DivisionContext'

function wrapper({ children }) {
    return <DivisionProvider>{children}</DivisionProvider>
}

// Shared test fixtures
const mockLeague = {
    id: 10,
    name: 'Test League',
    slug: 'test-league',
    divisions: [
        {
            id: 20,
            name: 'Division A',
            slug: 'div-a',
            seasons: [
                { id: 100, name: 'Season 1', is_active: false },
                { id: 101, name: 'Season 2', is_active: true },
            ],
        },
        {
            id: 21,
            name: 'Division B',
            slug: 'div-b',
            seasons: [
                { id: 102, name: 'Season 3', is_active: true },
            ],
        },
    ],
}

const mockTeams = [
    { id: 1, name: 'Team Alpha' },
    { id: 2, name: 'Team Beta' },
]

const mockPlayers = [
    { id: 1, name: 'Player One', team_id: 1 },
    { id: 2, name: 'Player Two', team_id: 2 },
]

beforeEach(() => {
    vi.clearAllMocks()
    routeParams.leagueSlug = 'test-league'
    routeParams.divisionSlug = 'div-a'
    authState.hasPermission = vi.fn(() => false)
    authState.loading = false
    mockLeagueService.getBySlug.mockResolvedValue(mockLeague)
    mockTeamService.getAllBySeason.mockResolvedValue(mockTeams)
    mockPlayerService.getAllBySeason.mockResolvedValue(mockPlayers)
})

describe('DivisionContext', () => {
    // 1. Successful load
    describe('successful load', () => {
        it('fetches league by slug, finds division, loads teams + players', async () => {
            const { result } = renderHook(() => useDivision(), { wrapper })

            expect(result.current.loading).toBe(true)

            await waitFor(() => expect(result.current.loading).toBe(false))

            expect(mockLeagueService.getBySlug).toHaveBeenCalledWith('test-league')
            expect(result.current.league).toMatchObject({ id: 10, name: 'Test League' })
            expect(result.current.division).toMatchObject({ id: 20, name: 'Division A', slug: 'div-a' })
            expect(result.current.season).toMatchObject({
                id: 101,
                name: 'Season 2',
                is_active: true,
                division_id: 20,
                division_name: 'Division A',
                division_slug: 'div-a',
            })
            expect(result.current.teams).toEqual(mockTeams)
            expect(result.current.players).toEqual(mockPlayers)
            expect(result.current.error).toBeNull()
        })

        it('loads teams and players for the active season', async () => {
            const { result } = renderHook(() => useDivision(), { wrapper })
            await waitFor(() => expect(result.current.loading).toBe(false))

            expect(mockTeamService.getAllBySeason).toHaveBeenCalledWith(101)
            expect(mockPlayerService.getAllBySeason).toHaveBeenCalledWith(101)
        })
    })

    // 2. Loading state
    describe('loading state', () => {
        it('starts as loading=true and transitions to false after data loads', async () => {
            const { result } = renderHook(() => useDivision(), { wrapper })

            expect(result.current.loading).toBe(true)

            await waitFor(() => expect(result.current.loading).toBe(false))
            expect(result.current.league).not.toBeNull()
        })

        it('does not fetch when auth is still loading', async () => {
            authState.loading = true
            const { result } = renderHook(() => useDivision(), { wrapper })

            expect(result.current.loading).toBe(true)
            await new Promise(r => setTimeout(r, 50))
            expect(mockLeagueService.getBySlug).not.toHaveBeenCalled()
        })

        it('does not fetch when slugs are missing', async () => {
            routeParams.leagueSlug = ''
            routeParams.divisionSlug = ''
            const { result } = renderHook(() => useDivision(), { wrapper })

            expect(result.current.loading).toBe(true)
            await new Promise(r => setTimeout(r, 50))
            expect(mockLeagueService.getBySlug).not.toHaveBeenCalled()
        })
    })

    // 3. Error: league not found
    describe('error: league not found', () => {
        it('sets error when league API returns null', async () => {
            mockLeagueService.getBySlug.mockResolvedValue(null)
            const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {})

            const { result } = renderHook(() => useDivision(), { wrapper })

            await waitFor(() => expect(result.current.loading).toBe(false))
            expect(result.current.error).toBe('League "test-league" not found')
            expect(result.current.league).toBeNull()

            consoleErr.mockRestore()
        })
    })

    // 4. Error: division not found
    describe('error: division not found', () => {
        it('sets specific error when division slug does not match', async () => {
            routeParams.divisionSlug = 'nonexistent-div'
            const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {})

            const { result } = renderHook(() => useDivision(), { wrapper })

            await waitFor(() => expect(result.current.loading).toBe(false))
            expect(result.current.error).toBe('Division "nonexistent-div" not found in Test League')

            consoleErr.mockRestore()
        })
    })

    // 5. Error: no seasons
    describe('error: no seasons', () => {
        it('sets season to null when division has no seasons', async () => {
            mockLeagueService.getBySlug.mockResolvedValue({
                ...mockLeague,
                divisions: [
                    { id: 20, name: 'Division A', slug: 'div-a', seasons: [] },
                ],
            })

            const { result } = renderHook(() => useDivision(), { wrapper })
            await waitFor(() => expect(result.current.loading).toBe(false))

            expect(result.current.season).toBeNull()
            expect(result.current.teams).toEqual([])
            expect(result.current.players).toEqual([])
            expect(mockTeamService.getAllBySeason).not.toHaveBeenCalled()
        })

        it('sets season to null when no active season and no league_preview permission', async () => {
            mockLeagueService.getBySlug.mockResolvedValue({
                ...mockLeague,
                divisions: [
                    {
                        id: 20, name: 'Division A', slug: 'div-a',
                        seasons: [{ id: 100, name: 'Season 1', is_active: false }],
                    },
                ],
            })

            const { result } = renderHook(() => useDivision(), { wrapper })
            await waitFor(() => expect(result.current.loading).toBe(false))

            expect(result.current.season).toBeNull()
            expect(mockTeamService.getAllBySeason).not.toHaveBeenCalled()
        })
    })

    // 6. Season selection
    describe('season selection', () => {
        it('picks the active season', async () => {
            const { result } = renderHook(() => useDivision(), { wrapper })
            await waitFor(() => expect(result.current.loading).toBe(false))

            expect(result.current.season.id).toBe(101)
            expect(result.current.season.is_active).toBe(true)
        })

        it('falls back to first season when user has league_preview permission and no active season', async () => {
            authState.hasPermission = vi.fn((perm, leagueId) => {
                return perm === 'league_preview' && leagueId === 10
            })
            mockLeagueService.getBySlug.mockResolvedValue({
                ...mockLeague,
                divisions: [
                    {
                        id: 20, name: 'Division A', slug: 'div-a',
                        seasons: [
                            { id: 100, name: 'Season 1', is_active: false },
                            { id: 103, name: 'Season 3', is_active: false },
                        ],
                    },
                ],
            })

            const { result } = renderHook(() => useDivision(), { wrapper })
            await waitFor(() => expect(result.current.loading).toBe(false))

            expect(result.current.season.id).toBe(100)
            expect(authState.hasPermission).toHaveBeenCalledWith('league_preview', 10)
        })

        it('does not fall back to first season without league_preview permission', async () => {
            mockLeagueService.getBySlug.mockResolvedValue({
                ...mockLeague,
                divisions: [
                    {
                        id: 20, name: 'Division A', slug: 'div-a',
                        seasons: [{ id: 100, name: 'Season 1', is_active: false }],
                    },
                ],
            })

            const { result } = renderHook(() => useDivision(), { wrapper })
            await waitFor(() => expect(result.current.loading).toBe(false))

            expect(result.current.season).toBeNull()
        })
    })

    // 7. Parallel data loading
    describe('parallel data loading', () => {
        it('loads teams and players in parallel after season is found', async () => {
            const callOrder = []
            mockTeamService.getAllBySeason.mockImplementation(async () => {
                callOrder.push('teams')
                return mockTeams
            })
            mockPlayerService.getAllBySeason.mockImplementation(async () => {
                callOrder.push('players')
                return mockPlayers
            })

            const { result } = renderHook(() => useDivision(), { wrapper })
            await waitFor(() => expect(result.current.loading).toBe(false))

            expect(mockTeamService.getAllBySeason).toHaveBeenCalledWith(101)
            expect(mockPlayerService.getAllBySeason).toHaveBeenCalledWith(101)
            expect(callOrder).toContain('teams')
            expect(callOrder).toContain('players')
        })

        it('does not load teams/players when no season exists', async () => {
            mockLeagueService.getBySlug.mockResolvedValue({
                ...mockLeague,
                divisions: [
                    { id: 20, name: 'Division A', slug: 'div-a', seasons: [] },
                ],
            })

            const { result } = renderHook(() => useDivision(), { wrapper })
            await waitFor(() => expect(result.current.loading).toBe(false))

            expect(mockTeamService.getAllBySeason).not.toHaveBeenCalled()
            expect(mockPlayerService.getAllBySeason).not.toHaveBeenCalled()
        })
    })

    // 8. useDivision outside provider
    describe('useDivision outside provider', () => {
        it('throws an error when used outside DivisionProvider', () => {
            expect(() => {
                renderHook(() => useDivision())
            }).toThrow('useDivision must be used within a DivisionProvider')
        })
    })
})

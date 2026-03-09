import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PlayerManager from '../../PlayerManager'
import SortHeader from '../SortHeader'
import PlayerRow from '../PlayerRow'
import EditInfoModal from '../EditInfoModal'
import AliasModal from '../AliasModal'
import MergeModal from '../MergeModal'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Mock getAuthHeaders
vi.mock('../../../../services/adminApi.js', () => ({
    getAuthHeaders: () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer test' }),
}))

// Mock PlayerManagerHelp to avoid pulling in unrelated deps
vi.mock('../../../../components/admin/AdminHelp', () => ({
    PlayerManagerHelp: () => <div data-testid="player-manager-help" />,
}))

const mockApiResponse = {
    players: [
        { id: 1, name: 'TestPlayer', slug: 'testplayer', discord_name: 'test#1234', tracker_url: null, main_role: 'mid', secondary_role: null },
        { id: 2, name: 'Another', slug: 'another', discord_name: null, tracker_url: null, main_role: null, secondary_role: null },
    ],
    rosters: [],
    gameCounts: [],
    aliases: [],
    seasons: [{ season_id: 1, season_name: 'S1', league_name: 'League', division_name: 'Div', is_active: true }],
    teams: [{ team_id: 1, team_name: 'Team A', season_id: 1 }],
}

function jsonResponse(data) {
    return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(data),
    })
}

beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockReturnValue(jsonResponse(mockApiResponse))
})

describe('PlayerManager', () => {
    it('renders without crashing and shows player data', async () => {
        render(<PlayerManager />)
        expect(screen.getByText('Loading player data...')).toBeInTheDocument()
        expect(await screen.findByText('Player Manager')).toBeInTheDocument()
        expect(await screen.findByText('TestPlayer')).toBeInTheDocument()
        expect(await screen.findByText('Another')).toBeInTheDocument()
    })

    it('fetches data from /api/player-manage on mount', async () => {
        render(<PlayerManager />)
        await screen.findByText('Player Manager')
        expect(mockFetch).toHaveBeenCalledWith(
            '/api/player-manage',
            expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test' }) })
        )
    })

    it('shows error state when fetch fails', async () => {
        mockFetch.mockReturnValue(Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) }))
        // Re-mock to throw
        mockFetch.mockReset()
        mockFetch.mockReturnValue(Promise.reject(new Error('Network error')))
        render(<PlayerManager />)
        expect(await screen.findByText(/Failed to load player data/)).toBeInTheDocument()
    })
})

describe('SortHeader', () => {
    it('renders label text', () => {
        const table = document.createElement('table')
        const thead = document.createElement('thead')
        const tr = document.createElement('tr')
        table.appendChild(thead)
        thead.appendChild(tr)

        const { getByText } = render(
            <SortHeader col="name" label="Player" current="name" dir="asc" onSort={() => {}} />,
            { container: document.body.appendChild(tr) }
        )
        expect(getByText('Player')).toBeInTheDocument()
    })

    it('calls onSort with column name when clicked', () => {
        const onSort = vi.fn()
        const table = document.createElement('table')
        const thead = document.createElement('thead')
        const tr = document.createElement('tr')
        table.appendChild(thead)
        thead.appendChild(tr)

        const { getByText } = render(
            <SortHeader col="team" label="Team" current="name" dir="asc" onSort={onSort} />,
            { container: document.body.appendChild(tr) }
        )
        fireEvent.click(getByText('Team'))
        expect(onSort).toHaveBeenCalledWith('team')
    })
})

describe('Subcomponent exports', () => {
    it('exports PlayerRow as a function', () => {
        expect(typeof PlayerRow).toBe('function')
    })

    it('exports EditInfoModal as a function', () => {
        expect(typeof EditInfoModal).toBe('function')
    })

    it('exports AliasModal as a function', () => {
        expect(typeof AliasModal).toBe('function')
    })

    it('exports MergeModal as a function', () => {
        expect(typeof MergeModal).toBe('function')
    })

    it('exports SortHeader as a function', () => {
        expect(typeof SortHeader).toBe('function')
    })
})

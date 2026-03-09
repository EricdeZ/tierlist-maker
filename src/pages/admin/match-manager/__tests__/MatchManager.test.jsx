import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// Mock adminApi
vi.mock('../../../../services/adminApi.js', () => ({
    getAuthHeaders: () => ({ 'Content-Type': 'application/json' }),
}))

// Mock AdminHelp
vi.mock('../../../../components/admin/AdminHelp', () => ({
    MatchManagerHelp: () => <div data-testid="match-manager-help" />,
}))

// Mock BaseModal
vi.mock('../../../../components/BaseModal', () => ({
    default: ({ children }) => <div data-testid="base-modal">{children}</div>,
}))

// Mock role images
vi.mock('../../../../assets/roles/solo.webp', () => ({ default: 'solo.webp' }))
vi.mock('../../../../assets/roles/jungle.webp', () => ({ default: 'jungle.webp' }))
vi.mock('../../../../assets/roles/mid.webp', () => ({ default: 'mid.webp' }))
vi.mock('../../../../assets/roles/supp.webp', () => ({ default: 'supp.webp' }))
vi.mock('../../../../assets/roles/adc.webp', () => ({ default: 'adc.webp' }))

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function jsonResponse(data, ok = true) {
    return Promise.resolve({
        ok,
        status: ok ? 200 : 500,
        json: () => Promise.resolve(data),
    })
}

beforeEach(() => {
    mockFetch.mockReset()
    localStorage.clear()
})

describe('MatchManager', () => {
    // Lazy import to ensure mocks are registered before module loads
    async function renderMatchManager() {
        const { default: MatchManager } = await import('../../MatchManager.jsx')
        return render(
            <MemoryRouter>
                <MatchManager />
            </MemoryRouter>
        )
    }

    it('renders loading state then main UI', async () => {
        mockFetch.mockReturnValue(jsonResponse({
            seasons: [{ season_id: 1, league_name: 'SPL', division_name: 'Div 1', season_name: 'S1' }],
            teams: [],
            players: [],
            gods: [],
        }))

        await renderMatchManager()

        // After loading resolves, should show heading
        expect(await screen.findByText('Match Manager')).toBeInTheDocument()
        expect(screen.getByText('Edit or delete existing matches, games, and player stats')).toBeInTheDocument()
    })

    it('shows season selector with options', async () => {
        mockFetch.mockImplementation((url) => {
            if (url.includes('admin-data')) {
                return jsonResponse({
                    seasons: [
                        { season_id: 1, league_name: 'SPL', division_name: 'Div 1', season_name: 'Season 1' },
                        { season_id: 2, league_name: 'SPL', division_name: 'Div 2', season_name: 'Season 2' },
                    ],
                    teams: [],
                    players: [],
                    gods: [],
                })
            }
            if (url.includes('admin-match-manage')) return jsonResponse({ matches: [] })
            if (url.includes('stage-manage')) return jsonResponse({ stages: [], groups: [], rounds: [] })
            return jsonResponse({})
        })

        await renderMatchManager()

        expect(await screen.findByText('Match Manager')).toBeInTheDocument()
        expect(screen.getByText('SPL / Div 1 — Season 1')).toBeInTheDocument()
        expect(screen.getByText('SPL / Div 2 — Season 2')).toBeInTheDocument()
    })
})

describe('GodAutocomplete', () => {
    async function renderGodAutocomplete(props = {}) {
        const { default: GodAutocomplete } = await import('../GodAutocomplete.jsx')
        const defaultProps = {
            value: '',
            gods: [
                { id: 1, name: 'Zeus', image_url: null },
                { id: 2, name: 'Athena', image_url: null },
                { id: 3, name: 'Ares', image_url: null },
            ],
            onChange: vi.fn(),
            ...props,
        }
        return render(<GodAutocomplete {...defaultProps} />)
    }

    it('renders with initial value', async () => {
        await renderGodAutocomplete({ value: 'Zeus' })
        const input = screen.getByRole('textbox')
        expect(input).toHaveValue('Zeus')
    })

    it('shows dropdown on focus and filters on input', async () => {
        const user = userEvent.setup()
        await renderGodAutocomplete()

        const input = screen.getByRole('textbox')
        await user.click(input)

        // All gods shown initially (dropdown includes all when query empty)
        expect(screen.getByText('Zeus')).toBeInTheDocument()
        expect(screen.getByText('Athena')).toBeInTheDocument()
        expect(screen.getByText('Ares')).toBeInTheDocument()

        // Type to filter
        await user.clear(input)
        await user.type(input, 'At')

        expect(screen.getByText('Athena')).toBeInTheDocument()
        expect(screen.queryByText('Zeus')).not.toBeInTheDocument()
        expect(screen.queryByText('Ares')).not.toBeInTheDocument()
    })

    it('calls onChange when a god is selected', async () => {
        const onChange = vi.fn()
        const user = userEvent.setup()
        await renderGodAutocomplete({ onChange })

        const input = screen.getByRole('textbox')
        await user.click(input)
        await user.clear(input)
        await user.type(input, 'Zeus')

        const zeusBtn = screen.getByText('Zeus')
        await user.click(zeusBtn)

        expect(onChange).toHaveBeenCalledWith({ god_played: 'Zeus' })
    })
})

describe('NumInput', () => {
    async function renderNumInput(props = {}) {
        const { NumInput } = await import('../shared.jsx')
        const defaultProps = {
            value: 5,
            onChange: vi.fn(),
            ...props,
        }
        return render(
            <table><tbody><tr><NumInput {...defaultProps} /></tr></tbody></table>
        )
    }

    it('renders with numeric value', async () => {
        await renderNumInput({ value: 10 })
        const input = screen.getByRole('spinbutton')
        expect(input).toHaveValue(10)
    })

    it('renders empty when value is null', async () => {
        await renderNumInput({ value: null })
        const input = screen.getByRole('spinbutton')
        expect(input).toHaveValue(null)
    })

    it('calls onChange with parsed integer', async () => {
        const onChange = vi.fn()
        await renderNumInput({ onChange })
        const input = screen.getByRole('spinbutton')
        fireEvent.change(input, { target: { value: '42' } })
        expect(onChange).toHaveBeenCalledWith(42)
    })

    it('calls onChange with 0 when cleared', async () => {
        const onChange = vi.fn()
        await renderNumInput({ value: 5, onChange })
        const input = screen.getByRole('spinbutton')
        fireEvent.change(input, { target: { value: '' } })
        expect(onChange).toHaveBeenCalledWith(0)
    })
})

describe('WinnerBtn', () => {
    async function renderWinnerBtn(props = {}) {
        const { WinnerBtn } = await import('../shared.jsx')
        const defaultProps = {
            label: 'Team Alpha',
            color: '#3b82f6',
            isActive: false,
            onClick: vi.fn(),
            ...props,
        }
        return render(<WinnerBtn {...defaultProps} />)
    }

    it('renders with label', async () => {
        await renderWinnerBtn()
        expect(screen.getByText('Team Alpha')).toBeInTheDocument()
    })

    it('applies active styling with background color', async () => {
        await renderWinnerBtn({ isActive: true })
        const btn = screen.getByText('Team Alpha')
        expect(btn).toHaveStyle({ backgroundColor: '#3b82f6' })
    })

    it('does not set background color when inactive', async () => {
        await renderWinnerBtn({ isActive: false })
        const btn = screen.getByText('Team Alpha')
        expect(btn.style.backgroundColor).toBe('')
    })

    it('calls onClick when clicked', async () => {
        const onClick = vi.fn()
        const user = userEvent.setup()
        await renderWinnerBtn({ onClick })
        await user.click(screen.getByText('Team Alpha'))
        expect(onClick).toHaveBeenCalledTimes(1)
    })
})

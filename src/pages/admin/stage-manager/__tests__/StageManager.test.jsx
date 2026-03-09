import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
    STAGE_TYPE_LABELS,
    STAGE_TYPE_COLORS,
    STATUS_COLORS,
    MATCH_STATUS_COLORS,
    inputStyle,
    inputClass,
    inputClassSm,
    numInputClass,
    numInputClassSm,
} from '../constants'

// Mock adminApi
vi.mock('../../../../services/adminApi.js', () => ({
    getAuthHeaders: () => ({ 'Content-Type': 'application/json' }),
}))

// Mock PageTitle (sets document.title, uses meta tags)
vi.mock('../../../../components/PageTitle', () => ({
    default: () => null,
}))

// Mock TeamLogo
vi.mock('../../../../components/TeamLogo', () => ({
    default: ({ name }) => <span data-testid="team-logo">{name}</span>,
}))

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

describe('constants', () => {
    it('exports all stage type labels', () => {
        expect(STAGE_TYPE_LABELS).toHaveProperty('round_robin', 'Round Robin')
        expect(STAGE_TYPE_LABELS).toHaveProperty('single_elimination', 'Single Elim')
        expect(STAGE_TYPE_LABELS).toHaveProperty('double_elimination', 'Double Elim')
        expect(STAGE_TYPE_LABELS).toHaveProperty('swiss', 'Swiss')
        expect(STAGE_TYPE_LABELS).toHaveProperty('custom', 'Custom')
    })

    it('exports stage type colors for each type', () => {
        expect(Object.keys(STAGE_TYPE_COLORS)).toEqual(Object.keys(STAGE_TYPE_LABELS))
        for (const color of Object.values(STAGE_TYPE_COLORS)) {
            expect(color).toContain('bg-')
            expect(color).toContain('text-')
        }
    })

    it('exports status colors for pending/active/completed', () => {
        expect(STATUS_COLORS).toHaveProperty('pending')
        expect(STATUS_COLORS).toHaveProperty('active')
        expect(STATUS_COLORS).toHaveProperty('completed')
    })

    it('exports match status colors', () => {
        expect(MATCH_STATUS_COLORS).toHaveProperty('scheduled')
        expect(MATCH_STATUS_COLORS).toHaveProperty('completed')
        expect(MATCH_STATUS_COLORS).toHaveProperty('cancelled')
    })

    it('exports input style objects and classes', () => {
        expect(inputStyle).toHaveProperty('backgroundColor')
        expect(inputStyle).toHaveProperty('color')
        expect(inputStyle).toHaveProperty('borderColor')
        expect(typeof inputClass).toBe('string')
        expect(typeof inputClassSm).toBe('string')
        expect(typeof numInputClass).toBe('string')
        expect(typeof numInputClassSm).toBe('string')
        expect(numInputClass).toContain(inputClass)
        expect(numInputClassSm).toContain(inputClassSm)
    })
})

describe('StageManager', () => {
    it('renders loading state then main content', async () => {
        // First fetch: schedule-manage (seasons/teams)
        mockFetch.mockImplementation((url) => {
            if (url.includes('schedule-manage')) {
                return jsonResponse({
                    seasons: [{ season_id: 1, league_name: 'SPL', division_name: 'Div 1', season_name: 'S1', league_id: 1, is_active: true }],
                    teams: [],
                    scheduledMatches: [],
                })
            }
            if (url.includes('stage-manage')) {
                return jsonResponse({ stages: [], groups: [], groupTeams: [], rounds: [] })
            }
            return jsonResponse({})
        })

        const { default: StageManager } = await import('../../StageManager')
        render(<StageManager />)

        // Initially shows loading
        expect(screen.getByText('Loading stage data...')).toBeInTheDocument()

        // After fetches resolve, shows main content
        await screen.findByText('Stage Manager')
        expect(screen.getByText('+ Add Stage')).toBeInTheDocument()
    })

    it('shows empty state when no stages exist', async () => {
        mockFetch.mockImplementation((url) => {
            if (url.includes('schedule-manage')) {
                return jsonResponse({
                    seasons: [{ season_id: 1, league_name: 'SPL', division_name: 'Div 1', season_name: 'S1', league_id: 1, is_active: true }],
                    teams: [],
                    scheduledMatches: [],
                })
            }
            if (url.includes('stage-manage')) {
                return jsonResponse({ stages: [], groups: [], groupTeams: [], rounds: [] })
            }
            return jsonResponse({})
        })

        const { default: StageManager } = await import('../../StageManager')
        render(<StageManager />)

        await screen.findByText('No stages yet for this season.')
    })
})

describe('StageForm', () => {
    it('renders new stage form with correct fields', async () => {
        const { default: StageForm } = await import('../StageForm')

        const form = { name: '', stage_type: '', sort_order: 0, status: 'pending', counts_for_team_record: true }
        render(
            <StageForm
                isNew={true}
                form={form}
                setForm={() => {}}
                onSubmit={() => {}}
                onCancel={() => {}}
                saving={false}
                hasMultipleDivisions={false}
            />
        )

        expect(screen.getByText('New Stage')).toBeInTheDocument()
        expect(screen.getByText('Name')).toBeInTheDocument()
        expect(screen.getByText('Type')).toBeInTheDocument()
        expect(screen.getByText('Sort Order')).toBeInTheDocument()
        expect(screen.getByText('Create Stage')).toBeInTheDocument()
        expect(screen.getByText('Cancel')).toBeInTheDocument()
        expect(screen.getByText('Counts for team record')).toBeInTheDocument()
    })

    it('renders edit mode with status field', async () => {
        const { default: StageForm } = await import('../StageForm')

        const form = { name: 'Playoffs', stage_type: 'single_elimination', sort_order: 1, status: 'active', counts_for_team_record: true }
        render(
            <StageForm
                isNew={false}
                form={form}
                setForm={() => {}}
                onSubmit={() => {}}
                onCancel={() => {}}
                saving={false}
                hasMultipleDivisions={false}
            />
        )

        expect(screen.getByText('Edit Stage')).toBeInTheDocument()
        expect(screen.getByText('Status')).toBeInTheDocument()
        expect(screen.getByText('Update Stage')).toBeInTheDocument()
    })

    it('shows league-wide checkbox when hasMultipleDivisions is true', async () => {
        const { default: StageForm } = await import('../StageForm')

        const form = { name: '', stage_type: '', sort_order: 0, status: 'pending', counts_for_team_record: true, league_wide: false }
        render(
            <StageForm
                isNew={true}
                form={form}
                setForm={() => {}}
                onSubmit={() => {}}
                onCancel={() => {}}
                saving={false}
                hasMultipleDivisions={true}
                leagueName="SPL"
            />
        )

        expect(screen.getByText('Create in all SPL divisions')).toBeInTheDocument()
    })

    it('shows saving state on button', async () => {
        const { default: StageForm } = await import('../StageForm')

        const form = { name: '', stage_type: '', sort_order: 0, status: 'pending', counts_for_team_record: true }
        render(
            <StageForm
                isNew={true}
                form={form}
                setForm={() => {}}
                onSubmit={() => {}}
                onCancel={() => {}}
                saving={true}
                hasMultipleDivisions={false}
            />
        )

        expect(screen.getByText('Saving...')).toBeInTheDocument()
    })
})

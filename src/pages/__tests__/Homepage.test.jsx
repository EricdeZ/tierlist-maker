import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// --- Mock leagueService ---
const mockGetAll = vi.fn()
const mockGetBySlug = vi.fn()

vi.mock('../../services/database', () => ({
    leagueService: {
        getAll: (...args) => mockGetAll(...args),
        getBySlug: (...args) => mockGetBySlug(...args),
    },
}))

// --- Mock AuthContext ---
const authValue = {
    user: null,
    linkedPlayer: null,
    login: vi.fn(),
    loading: false,
    hasPermission: () => false,
    isAdmin: false,
    hasAnyPermission: false,
    avatarUrl: null,
    permissions: { global: [], byLeague: {} },
}

vi.mock('../../context/AuthContext', () => ({
    useAuth: () => authValue,
}))

// --- Mock PassionContext (PassionPromoBanner uses it) ---
vi.mock('../../context/PassionContext', () => ({
    usePassion: () => ({
        balance: 0,
        totalEarned: 0,
        rank: { name: 'Unranked' },
        nextRank: null,
        loading: false,
        canClaimDaily: false,
        claimableCount: 0,
        ember: { balance: 0, canClaimDaily: false },
        challengeNotifications: [],
    }),
}))

// --- Mock useReadyMatchCount hook ---
vi.mock('../../hooks/useReadyMatchCount', () => ({
    useReadyMatchCount: () => ({ count: 0, matches: [], hasReportPermission: false }),
}))

// --- Mock react-router-dom ---
vi.mock('react-router-dom', () => ({
    Link: ({ to, children, ...rest }) => <a href={to} {...rest}>{children}</a>,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/', search: '', hash: '' }),
}))

// --- Mock image imports ---
vi.mock('../../assets/smite2.png', () => ({ default: 'smite-logo.png' }))

// --- Stub child components to simplify rendering ---
vi.mock('../homepage/HeroSection', () => ({ default: () => <div data-testid="hero-section" /> }))
vi.mock('../homepage/ReporterNotification', () => ({ default: () => null }))
vi.mock('../homepage/ToolsSection', () => ({ default: () => null }))
vi.mock('../homepage/FeaturesSection', () => ({ default: () => null }))
vi.mock('../homepage/StorySection', () => ({ default: () => null }))
vi.mock('../homepage/CommunitySection', () => ({ default: () => null }))
vi.mock('../homepage/PassionCTA', () => ({ default: () => null }))
vi.mock('../homepage/HomepageFooter', () => ({ default: () => null }))
vi.mock('../../components/ChallengeBanner', () => ({ default: () => null }))
vi.mock('../../components/PassionPromoBanner', () => ({ default: () => null }))
vi.mock('../../components/PageTitle', () => ({ default: () => null }))

// LeaguesSection — render something testable from the leagues prop
vi.mock('../homepage/LeaguesSection', () => ({
    default: ({ leagues }) => (
        <div data-testid="leagues-section">
            {leagues.map(l => (
                <div key={l.id} data-testid={`league-${l.slug}`}>
                    <span>{l.name}</span>
                    {l.divisions?.map(d => (
                        <a key={d.id} href={`/${l.slug}/${d.slug}`}>{d.name}</a>
                    ))}
                </div>
            ))}
        </div>
    ),
}))

import Homepage from '../Homepage'

beforeEach(() => {
    mockGetAll.mockReset()
    mockGetBySlug.mockReset()
})

afterEach(() => {
    authValue.user = null
    authValue.hasPermission = () => false
})

describe('Homepage', () => {
    it('shows loading indicator initially', () => {
        // Never resolve so we stay in loading state
        mockGetAll.mockReturnValue(new Promise(() => {}))

        render(<Homepage />)
        // The loading state uses an animate-spin spinner
        const spinner = document.querySelector('.animate-spin')
        expect(spinner).toBeInTheDocument()
    })

    it('fetches leagues and displays them after load', async () => {
        const leagues = [
            { id: 1, slug: 'scc', name: 'SCC' },
            { id: 2, slug: 'spl', name: 'SPL' },
        ]
        const detailedLeagues = [
            { id: 1, slug: 'scc', name: 'SCC', divisions: [{ id: 10, slug: 'div-a', name: 'Division A' }] },
            { id: 2, slug: 'spl', name: 'SPL', divisions: [{ id: 20, slug: 'div-b', name: 'Division B' }] },
        ]

        mockGetAll.mockResolvedValue(leagues)
        mockGetBySlug.mockImplementation(slug =>
            Promise.resolve(detailedLeagues.find(l => l.slug === slug))
        )

        render(<Homepage />)

        await waitFor(() => {
            expect(screen.getByTestId('leagues-section')).toBeInTheDocument()
        })

        expect(screen.getByText('SCC')).toBeInTheDocument()
        expect(screen.getByText('SPL')).toBeInTheDocument()
    })

    it('filters out leagues with name "Test League"', async () => {
        const leagues = [
            { id: 1, slug: 'scc', name: 'SCC' },
            { id: 2, slug: 'test', name: 'Test League' },
        ]
        const detailedLeagues = [
            { id: 1, slug: 'scc', name: 'SCC', divisions: [] },
            { id: 2, slug: 'test', name: 'Test League', divisions: [] },
        ]

        mockGetAll.mockResolvedValue(leagues)
        mockGetBySlug.mockImplementation(slug =>
            Promise.resolve(detailedLeagues.find(l => l.slug === slug))
        )

        render(<Homepage />)

        await waitFor(() => {
            expect(screen.getByTestId('leagues-section')).toBeInTheDocument()
        })

        expect(screen.getByText('SCC')).toBeInTheDocument()
        expect(screen.queryByText('Test League')).not.toBeInTheDocument()
    })

    it('shows error message when API fails', async () => {
        mockGetAll.mockRejectedValue(new Error('Network error'))

        render(<Homepage />)

        await waitFor(() => {
            expect(screen.getByText('Network error')).toBeInTheDocument()
        })

        expect(screen.getByText('Connection Error')).toBeInTheDocument()
    })

    it('each league shows division links', async () => {
        const leagues = [
            { id: 1, slug: 'scc', name: 'SCC' },
        ]
        const detailed = [
            {
                id: 1, slug: 'scc', name: 'SCC',
                divisions: [
                    { id: 10, slug: 'gold', name: 'Gold Division' },
                    { id: 11, slug: 'silver', name: 'Silver Division' },
                ],
            },
        ]

        mockGetAll.mockResolvedValue(leagues)
        mockGetBySlug.mockImplementation(slug =>
            Promise.resolve(detailed.find(l => l.slug === slug))
        )

        render(<Homepage />)

        await waitFor(() => {
            expect(screen.getByTestId('leagues-section')).toBeInTheDocument()
        })

        const goldLink = screen.getByText('Gold Division')
        expect(goldLink.closest('a')).toHaveAttribute('href', '/scc/gold')

        const silverLink = screen.getByText('Silver Division')
        expect(silverLink.closest('a')).toHaveAttribute('href', '/scc/silver')
    })
})

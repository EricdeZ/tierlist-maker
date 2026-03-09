import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mutable auth state
const authValue = {
    user: null,
    loading: false,
    notification: null,
    clearNotification: vi.fn(),
    impersonating: false,
    realUser: null,
    stopImpersonation: vi.fn(),
    isAdmin: false,
    hasPermission: () => false,
    hasAnyPermission: false,
    login: vi.fn(),
    logout: vi.fn(),
    avatarUrl: null,
    linkedPlayer: null,
    token: null,
    permissions: { global: [], byLeague: {} },
}

vi.mock('../../../context/AuthContext', () => ({
    useAuth: () => authValue,
}))

vi.mock('../../../context/PassionContext', () => ({
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
        dismissChallengeNotification: vi.fn(),
    }),
    PassionProvider: ({ children }) => children,
}))

vi.mock('../../../context/SidebarContext', () => ({
    SidebarProvider: ({ children }) => children,
    useSidebar: () => ({
        isOpen: false,
        open: vi.fn(),
        close: vi.fn(),
        toggle: vi.fn(),
        hasUsedShortcut: false,
    }),
}))

vi.mock('react-router-dom', () => ({
    Outlet: () => <div data-testid="outlet">Outlet</div>,
    useLocation: () => ({ pathname: '/', search: '', hash: '' }),
    Link: ({ to, children, ...rest }) => <a href={to} {...rest}>{children}</a>,
}))

// Stub child components to isolate AppLayout behavior
vi.mock('../../UserMenu', () => ({ default: () => <div data-testid="user-menu" /> }))
vi.mock('../../PassionDisplay', () => ({ default: () => <div data-testid="passion-display" /> }))
vi.mock('../../ClaimProfileModal', () => ({ default: () => null }))
vi.mock('../../ReportDataIssueModal', () => ({ default: () => null }))
vi.mock('../../ReporterBell', () => ({ default: () => null }))
vi.mock('../SidebarTrigger', () => ({ default: () => null }))
vi.mock('../GlobalSidebar', () => ({ default: () => null }))
vi.mock('../../StreamWidget', () => ({ default: () => null }))
vi.mock('../../WhatsNewModal', () => ({ default: () => null }))
vi.mock('../../ChallengeNudge', () => ({ default: () => null }))
vi.mock('../../GlobalToast', () => ({
    default: ({ message, onDone }) =>
        message ? <div data-testid="global-toast" onClick={onDone}>{message}</div> : null,
}))

import AppLayout from '../AppLayout'

afterEach(() => {
    authValue.user = null
    authValue.loading = false
    authValue.notification = null
    authValue.clearNotification = vi.fn()
    authValue.impersonating = false
    authValue.realUser = null
    authValue.stopImpersonation = vi.fn()
})

describe('AppLayout', () => {
    it('renders without crashing and includes Outlet', () => {
        render(<AppLayout />)
        expect(screen.getByTestId('outlet')).toBeInTheDocument()
    })

    it('shows impersonation banner when impersonating=true', () => {
        authValue.impersonating = true
        authValue.user = { discord_username: 'FakeUser' }
        authValue.realUser = { discord_username: 'RealAdmin' }

        render(<AppLayout />)
        expect(screen.getByText('FakeUser')).toBeInTheDocument()
        expect(screen.getByText(/logged in as RealAdmin/)).toBeInTheDocument()
        expect(screen.getByText('Stop')).toBeInTheDocument()
    })

    it('hides impersonation banner when not impersonating', () => {
        authValue.impersonating = false
        authValue.user = { discord_username: 'RegularUser' }

        render(<AppLayout />)
        expect(screen.queryByText('Stop')).not.toBeInTheDocument()
        expect(screen.queryByText(/Viewing as/)).not.toBeInTheDocument()
    })

    it('calls stopImpersonation when Stop button is clicked', async () => {
        const user = userEvent.setup()
        authValue.impersonating = true
        authValue.user = { discord_username: 'FakeUser' }
        authValue.realUser = { discord_username: 'RealAdmin' }

        render(<AppLayout />)
        await user.click(screen.getByText('Stop'))
        expect(authValue.stopImpersonation).toHaveBeenCalledOnce()
    })

    it('shows toast notification when notification is present', () => {
        authValue.notification = 'Action completed!'

        render(<AppLayout />)
        expect(screen.getByTestId('global-toast')).toBeInTheDocument()
        expect(screen.getByText('Action completed!')).toBeInTheDocument()
    })

    it('does not show toast when notification is null', () => {
        authValue.notification = null

        render(<AppLayout />)
        expect(screen.queryByTestId('global-toast')).not.toBeInTheDocument()
    })

    it('calls clearNotification when toast is dismissed', async () => {
        const user = userEvent.setup()
        authValue.notification = 'Some notification'

        render(<AppLayout />)
        await user.click(screen.getByTestId('global-toast'))
        expect(authValue.clearNotification).toHaveBeenCalledOnce()
    })
})

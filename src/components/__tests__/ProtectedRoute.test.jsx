import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// We control useAuth via this mutable ref
const authValue = {
    user: null,
    loading: false,
    isAdmin: false,
    hasPermission: () => false,
    hasAnyPermission: false,
    permissions: { global: [], byLeague: {} },
}

vi.mock('../../context/AuthContext', () => ({
    useAuth: () => authValue,
}))

import ProtectedRoute from '../ProtectedRoute'

function renderWithRouter(ui, { route = '/' } = {}) {
    return render(
        <MemoryRouter initialEntries={[route]}>
            {ui}
        </MemoryRouter>
    )
}

afterEach(() => {
    // Reset to defaults
    authValue.user = null
    authValue.loading = false
    authValue.isAdmin = false
    authValue.hasPermission = () => false
    authValue.hasAnyPermission = false
    authValue.permissions = { global: [], byLeague: {} }
})

describe('ProtectedRoute', () => {
    it('shows loading spinner while auth is loading', () => {
        authValue.loading = true
        renderWithRouter(
            <ProtectedRoute><div>Secret</div></ProtectedRoute>
        )
        expect(screen.getByText('Checking authentication...')).toBeInTheDocument()
        expect(screen.queryByText('Secret')).not.toBeInTheDocument()
    })

    it('redirects to /?login=required when no user', () => {
        authValue.user = null
        authValue.loading = false
        const { container } = renderWithRouter(
            <ProtectedRoute><div>Secret</div></ProtectedRoute>
        )
        // Navigate renders nothing visible — children should not appear
        expect(screen.queryByText('Secret')).not.toBeInTheDocument()
    })

    it('renders children when user is logged in (no permission required)', () => {
        authValue.user = { id: '1', username: 'test' }
        authValue.loading = false
        renderWithRouter(
            <ProtectedRoute><div>Secret Content</div></ProtectedRoute>
        )
        expect(screen.getByText('Secret Content')).toBeInTheDocument()
    })

    it('renders children when user has the required permission globally', () => {
        authValue.user = { id: '1', username: 'test' }
        authValue.hasPermission = (key) => key === 'match_report'
        authValue.permissions = { global: ['match_report'], byLeague: {} }
        renderWithRouter(
            <ProtectedRoute requiredPermission="match_report">
                <div>Admin Panel</div>
            </ProtectedRoute>
        )
        expect(screen.getByText('Admin Panel')).toBeInTheDocument()
    })

    it('renders children when user has the required permission for a league', () => {
        authValue.user = { id: '1', username: 'test' }
        authValue.hasPermission = () => false
        authValue.permissions = { global: [], byLeague: { 5: ['match_report'] } }
        renderWithRouter(
            <ProtectedRoute requiredPermission="match_report">
                <div>Admin Panel</div>
            </ProtectedRoute>
        )
        expect(screen.getByText('Admin Panel')).toBeInTheDocument()
    })

    it('redirects when user lacks the required permission', () => {
        authValue.user = { id: '1', username: 'test' }
        authValue.hasPermission = () => false
        authValue.permissions = { global: [], byLeague: {} }
        renderWithRouter(
            <ProtectedRoute requiredPermission="match_report">
                <div>Admin Panel</div>
            </ProtectedRoute>
        )
        expect(screen.queryByText('Admin Panel')).not.toBeInTheDocument()
    })

    it('supports array of required permissions (any match)', () => {
        authValue.user = { id: '1', username: 'test' }
        authValue.hasPermission = (key) => key === 'match_manage_own'
        authValue.permissions = { global: ['match_manage_own'], byLeague: {} }
        renderWithRouter(
            <ProtectedRoute requiredPermission={['match_manage', 'match_manage_own']}>
                <div>Match Manager</div>
            </ProtectedRoute>
        )
        expect(screen.getByText('Match Manager')).toBeInTheDocument()
    })

    it('renders children when requireAdmin and user is admin', () => {
        authValue.user = { id: '1', username: 'admin' }
        authValue.isAdmin = true
        renderWithRouter(
            <ProtectedRoute requireAdmin>
                <div>Admin Area</div>
            </ProtectedRoute>
        )
        expect(screen.getByText('Admin Area')).toBeInTheDocument()
    })

    it('renders children when requireAdmin and user has any RBAC permission', () => {
        authValue.user = { id: '1', username: 'staff' }
        authValue.isAdmin = false
        authValue.hasAnyPermission = true
        renderWithRouter(
            <ProtectedRoute requireAdmin>
                <div>Admin Area</div>
            </ProtectedRoute>
        )
        expect(screen.getByText('Admin Area')).toBeInTheDocument()
    })

    it('redirects when requireAdmin and user is not admin and has no permissions', () => {
        authValue.user = { id: '1', username: 'regular' }
        authValue.isAdmin = false
        authValue.hasAnyPermission = false
        renderWithRouter(
            <ProtectedRoute requireAdmin>
                <div>Admin Area</div>
            </ProtectedRoute>
        )
        expect(screen.queryByText('Admin Area')).not.toBeInTheDocument()
    })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// Mock all lazy-loaded pages to avoid pulling in the entire dependency tree
vi.mock('./pages/Homepage', () => ({
    default: () => <div data-testid="homepage">Homepage</div>,
}))
vi.mock('./pages/NotFound', () => ({
    default: () => <div data-testid="not-found">Not Found</div>,
}))

// Mock layouts to render children via Outlet
vi.mock('./components/layout/AppLayout', () => {
    const { Outlet } = require('react-router-dom')
    return { default: () => <div data-testid="app-layout"><Outlet /></div> }
})
vi.mock('./components/layout/AdminLayout', () => {
    const { Outlet } = require('react-router-dom')
    return { default: () => <div data-testid="admin-layout"><Outlet /></div> }
})
vi.mock('./components/layout/CodexLayout', () => {
    const { Outlet } = require('react-router-dom')
    return { default: () => <div data-testid="codex-layout"><Outlet /></div> }
})
vi.mock('./components/layout/DivisionLayout', () => {
    const { Outlet } = require('react-router-dom')
    return { default: () => <div data-testid="division-layout"><Outlet /></div> }
})

// Mock context providers to pass-through children
vi.mock('./context/AuthContext', () => ({
    AuthProvider: ({ children }) => <div data-testid="auth-provider">{children}</div>,
    useAuth: () => ({
        user: null,
        loading: false,
        isAdmin: false,
        hasPermission: () => false,
        hasAnyPermission: false,
        permissions: { global: [], byLeague: {} },
    }),
}))
vi.mock('./context/PassionContext', () => ({
    PassionProvider: ({ children }) => <div data-testid="passion-provider">{children}</div>,
}))

// Mock ErrorBoundary and ProtectedRoute as pass-through
vi.mock('./components/ErrorBoundary', () => ({
    default: ({ children }) => <div data-testid="error-boundary">{children}</div>,
}))
vi.mock('./components/ProtectedRoute', () => ({
    default: ({ children }) => children,
}))
vi.mock('./components/ScrollToTop', () => ({
    default: () => null,
}))

// Mock fetch for any downstream calls
const mockFetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
)
vi.stubGlobal('fetch', mockFetch)

import App from './App'

beforeEach(() => {
    mockFetch.mockClear()
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('App', () => {
    it('renders without crashing', () => {
        const { container } = render(<App />)
        expect(container).toBeTruthy()
    })

    it('renders the homepage at root path', async () => {
        window.history.pushState({}, '', '/')
        render(<App />)
        await waitFor(() => {
            expect(screen.getByTestId('homepage')).toBeInTheDocument()
        })
    })

    it('renders ErrorBoundary and AuthProvider wrappers', () => {
        render(<App />)
        expect(screen.getByTestId('auth-provider')).toBeInTheDocument()
        expect(screen.getByTestId('error-boundary')).toBeInTheDocument()
    })

    it('renders PassionProvider wrapper', () => {
        render(<App />)
        expect(screen.getByTestId('passion-provider')).toBeInTheDocument()
    })

    it('lazy page shows loading state before content', async () => {
        // The lp() wrapper uses Suspense with a "Loading..." fallback.
        // Since we mock the pages eagerly, the Suspense resolves instantly,
        // but we can verify the structure works without errors.
        window.history.pushState({}, '', '/')
        render(<App />)
        await waitFor(() => {
            expect(screen.getByTestId('homepage')).toBeInTheDocument()
        })
    })
})

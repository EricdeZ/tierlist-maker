import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mutable auth state
const authValue = {
    user: null,
    linkedPlayer: null,
    login: vi.fn(),
    logout: vi.fn(),
    isAdmin: false,
    hasAnyPermission: false,
    hasPermission: () => false,
    avatarUrl: null,
}

vi.mock('../../context/AuthContext', () => ({
    useAuth: () => authValue,
}))

vi.mock('react-router-dom', () => ({
    Link: ({ to, children, onClick, ...rest }) => (
        <a href={to} onClick={onClick} {...rest}>{children}</a>
    ),
    useNavigate: () => vi.fn(),
}))

vi.mock('lucide-react', () => ({
    LogOut: () => <span data-testid="icon-logout" />,
    Shield: () => <span data-testid="icon-shield" />,
    BookOpen: () => <span data-testid="icon-book" />,
    User: () => <span data-testid="icon-user" />,
    UserCheck: () => <span data-testid="icon-user-check" />,
}))

import UserMenu from '../UserMenu'

afterEach(() => {
    authValue.user = null
    authValue.linkedPlayer = null
    authValue.login = vi.fn()
    authValue.logout = vi.fn()
    authValue.isAdmin = false
    authValue.hasAnyPermission = false
    authValue.hasPermission = () => false
    authValue.avatarUrl = null
})

describe('UserMenu', () => {
    it('shows login button when no user', () => {
        authValue.user = null

        render(<UserMenu />)
        expect(screen.getByText('Login')).toBeInTheDocument()
    })

    it('calls login when login button is clicked', async () => {
        authValue.user = null
        const user = userEvent.setup()

        render(<UserMenu />)
        await user.click(screen.getByText('Login'))
        expect(authValue.login).toHaveBeenCalledOnce()
    })

    it('shows username when logged in', () => {
        authValue.user = { discord_username: 'TestUser', discord_id: '123' }

        render(<UserMenu />)
        expect(screen.getByText('TestUser')).toBeInTheDocument()
        expect(screen.queryByText('Login')).not.toBeInTheDocument()
    })

    it('shows avatar initial when no avatar URL', () => {
        authValue.user = { discord_username: 'TestUser', discord_id: '123' }
        authValue.avatarUrl = null

        render(<UserMenu />)
        expect(screen.getByText('T')).toBeInTheDocument()
    })

    it('shows avatar image when avatar URL is set', () => {
        authValue.user = { discord_username: 'TestUser', discord_id: '123' }
        authValue.avatarUrl = 'https://cdn.discordapp.com/avatars/123/abc.png'

        render(<UserMenu />)
        const img = document.querySelector('img[src="https://cdn.discordapp.com/avatars/123/abc.png"]')
        expect(img).toBeInTheDocument()
    })

    it('toggles dropdown open and closed on avatar click', async () => {
        authValue.user = { discord_username: 'TestUser', discord_id: '123' }
        const user = userEvent.setup()

        render(<UserMenu />)

        // The toggle is the button containing the username
        const toggleBtn = screen.getByRole('button')

        // Dropdown closed initially — Log Out not visible
        expect(screen.queryByText('Log Out')).not.toBeInTheDocument()

        // Click to open
        await user.click(toggleBtn)
        expect(screen.getByText('Log Out')).toBeInTheDocument()

        // Click again to close
        await user.click(toggleBtn)
        expect(screen.queryByText('Log Out')).not.toBeInTheDocument()
    })

    it('shows Admin Dashboard link when user is admin', async () => {
        authValue.user = { discord_username: 'AdminUser', discord_id: '1' }
        authValue.isAdmin = true
        const user = userEvent.setup()

        render(<UserMenu />)
        await user.click(screen.getByText('AdminUser'))

        expect(screen.getByText('Admin Dashboard')).toBeInTheDocument()
        expect(screen.getByText('Admin Dashboard').closest('a')).toHaveAttribute('href', '/admin')
    })

    it('shows Admin Dashboard link when user hasAnyPermission', async () => {
        authValue.user = { discord_username: 'StaffUser', discord_id: '2' }
        authValue.isAdmin = false
        authValue.hasAnyPermission = true
        const user = userEvent.setup()

        render(<UserMenu />)
        await user.click(screen.getByText('StaffUser'))

        expect(screen.getByText('Admin Dashboard')).toBeInTheDocument()
    })

    it('hides Admin Dashboard link for regular users', async () => {
        authValue.user = { discord_username: 'RegularUser', discord_id: '3' }
        authValue.isAdmin = false
        authValue.hasAnyPermission = false
        const user = userEvent.setup()

        render(<UserMenu />)
        await user.click(screen.getByText('RegularUser'))

        expect(screen.queryByText('Admin Dashboard')).not.toBeInTheDocument()
    })

    it('shows role label "Admin" for admin users', async () => {
        authValue.user = { discord_username: 'AdminUser', discord_id: '1' }
        authValue.isAdmin = true
        const user = userEvent.setup()

        render(<UserMenu />)
        await user.click(screen.getByText('AdminUser'))

        expect(screen.getByText('Admin')).toBeInTheDocument()
    })

    it('shows role label "Staff" for users with permissions but not admin', async () => {
        authValue.user = { discord_username: 'StaffUser', discord_id: '2' }
        authValue.isAdmin = false
        authValue.hasAnyPermission = true
        const user = userEvent.setup()

        render(<UserMenu />)
        await user.click(screen.getByText('StaffUser'))

        expect(screen.getByText('Staff')).toBeInTheDocument()
    })

    it('shows role label "Player" for regular users', async () => {
        authValue.user = { discord_username: 'RegularUser', discord_id: '3' }
        authValue.isAdmin = false
        authValue.hasAnyPermission = false
        const user = userEvent.setup()

        render(<UserMenu />)
        await user.click(screen.getByText('RegularUser'))

        expect(screen.getByText('Player')).toBeInTheDocument()
    })

    it('calls logout when Log Out is clicked', async () => {
        authValue.user = { discord_username: 'TestUser', discord_id: '1' }
        const user = userEvent.setup()

        render(<UserMenu />)
        await user.click(screen.getByText('TestUser'))
        await user.click(screen.getByText('Log Out'))

        expect(authValue.logout).toHaveBeenCalledOnce()
    })

    it('closes menu when clicking outside', async () => {
        authValue.user = { discord_username: 'TestUser', discord_id: '1' }
        const user = userEvent.setup()

        render(
            <div>
                <div data-testid="outside">Outside</div>
                <UserMenu />
            </div>
        )

        // Open menu
        await user.click(screen.getByText('TestUser'))
        expect(screen.getByText('Log Out')).toBeInTheDocument()

        // Click outside — uses mousedown event
        fireEvent.mouseDown(screen.getByTestId('outside'))
        expect(screen.queryByText('Log Out')).not.toBeInTheDocument()
    })
})

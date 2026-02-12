// src/components/layout/AppLayout.jsx
import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import UserMenu from '../UserMenu'
import PassionDisplay from '../PassionDisplay'
import ClaimProfileModal from '../ClaimProfileModal'

const AppLayout = () => {
    const { user, loading } = useAuth()
    const location = useLocation()

    // League and division pages render their own navbar with UserMenu,
    // so hide the global one. Known top-level routes that need the global menu:
    const firstSegment = location.pathname.split('/')[1]
    const knownRoutes = ['', 'admin', 'draft', 'tierlist']
    const hasOwnNav = firstSegment && !knownRoutes.includes(firstSegment)

    return (
        <div className="min-h-screen bg-(--color-primary) text-(--color-text)">
            {/* Global user menu — top right, hidden on pages with their own navbar */}
            {!loading && !hasOwnNav && (
                <div className="fixed top-2 right-2 sm:top-4 sm:right-4 z-50 flex items-center gap-2">
                    {user && <PassionDisplay />}
                    <UserMenu />
                </div>
            )}
            <Outlet />
            <ClaimProfileModal />
        </div>
    )
}

export default AppLayout

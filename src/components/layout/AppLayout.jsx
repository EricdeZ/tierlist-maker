// src/components/layout/AppLayout.jsx
import { Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import UserMenu from '../UserMenu'
import ClaimProfileModal from '../ClaimProfileModal'

const AppLayout = () => {
    const { loading } = useAuth()

    return (
        <div className="min-h-screen bg-(--color-primary) text-(--color-text)">
            {/* Global user menu — top right, visible on non-division pages */}
            {!loading && (
                <div className="fixed top-4 right-4 z-50">
                    <UserMenu />
                </div>
            )}
            <Outlet />
            <ClaimProfileModal />
        </div>
    )
}

export default AppLayout

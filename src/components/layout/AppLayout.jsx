// src/components/layout/AppLayout.jsx
import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { SidebarProvider } from '../../context/SidebarContext'
import UserMenu from '../UserMenu'
import PassionDisplay from '../PassionDisplay'
import ClaimProfileModal from '../ClaimProfileModal'
import ReportDataIssueModal from '../ReportDataIssueModal'
import ReporterBell from '../ReporterBell'
import SidebarTrigger from './SidebarTrigger'
import GlobalSidebar from './GlobalSidebar'

const AppLayout = () => {
    const { user, loading } = useAuth()
    const location = useLocation()

    // League and division pages render their own navbar with UserMenu,
    // so hide the global one. Known top-level routes that need the global menu:
    const firstSegment = location.pathname.split('/')[1]
    const knownRoutes = ['']
    const hasOwnNav = firstSegment && !knownRoutes.includes(firstSegment)

    return (
        <SidebarProvider>
            <div className="min-h-screen bg-(--color-primary) text-(--color-text)">
                <SidebarTrigger hideOnSmall={hasOwnNav} />
                <GlobalSidebar />
                {/* Global user menu — top right, hidden on pages with their own navbar */}
                {!loading && !hasOwnNav && (
                    <div className="fixed top-2 right-2 sm:top-4 sm:right-4 z-50 flex items-center gap-2">
                        <ReporterBell />
                        {user && <PassionDisplay />}
                        <UserMenu />
                    </div>
                )}
                <Outlet />
                <ClaimProfileModal />
                <ReportDataIssueModal />
            </div>
        </SidebarProvider>
    )
}

export default AppLayout

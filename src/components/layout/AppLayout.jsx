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
import StreamWidget from '../StreamWidget'
import WhatsNewModal from '../WhatsNewModal'
import ChallengeNudge from '../ChallengeNudge'
import GlobalToast from '../GlobalToast'

const AppLayout = () => {
    const { user, loading, notification, clearNotification, impersonating, realUser, stopImpersonation } = useAuth()
    const location = useLocation()

    // League and division pages render their own navbar with UserMenu,
    // so hide the global one. Known top-level routes that need the global menu:
    const firstSegment = location.pathname.split('/')[1]
    const knownRoutes = ['']
    const hasOwnNav = firstSegment && !knownRoutes.includes(firstSegment)

    return (
        <SidebarProvider>
            <div className="min-h-screen bg-(--color-primary) text-(--color-text)">
                {impersonating && (
                    <div className="fixed top-0 left-0 right-0 z-[200] bg-amber-600 text-white text-center text-sm font-medium py-1.5 px-4 flex items-center justify-center gap-3">
                        <span>
                            Viewing as <strong>{user?.discord_username}</strong>
                            {realUser && <span className="opacity-75"> (logged in as {realUser.discord_username})</span>}
                        </span>
                        <button
                            onClick={stopImpersonation}
                            className="px-2.5 py-0.5 rounded bg-red-700 hover:bg-red-800 text-xs font-semibold transition-colors"
                        >
                            Stop
                        </button>
                    </div>
                )}
                {impersonating && <div className="h-9" />}
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
                <StreamWidget />
                <ClaimProfileModal />
                <ReportDataIssueModal />
                <WhatsNewModal />
                <ChallengeNudge />
                <GlobalToast message={notification} onDone={clearNotification} />
            </div>
        </SidebarProvider>
    )
}

export default AppLayout

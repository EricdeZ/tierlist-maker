import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useSidebar } from '../../context/SidebarContext'
import UserMenu from '../UserMenu'
import PassionDisplay from '../PassionDisplay'
import smiteLogo from '../../assets/smite2.png'
import { Home, ChevronRight } from 'lucide-react'

const tabs = [
    { path: '/vault-dashboard', label: 'Card Creator', exact: true },
    { path: '/vault-dashboard/templates', label: 'Templates' },
    { path: '/vault-dashboard/drafts', label: 'Drafts' },
    { path: '/vault-dashboard/collections', label: 'Collections' },
    { path: '/vault-dashboard/assets', label: 'Assets' },
]

export default function VaultDashboardNavbar() {
    const { user } = useAuth()
    const { toggle: toggleSidebar } = useSidebar()
    const location = useLocation()

    const isActive = (tab) => {
        if (tab.exact) return location.pathname === tab.path
        return location.pathname.startsWith(tab.path)
    }

    return (
        <nav className="fixed left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-7xl top-4">
            <div className="bg-(--color-primary)/75 backdrop-blur-xl rounded-xl px-4 py-2 shadow-lg border border-white/10">
                <div className="flex items-center gap-3 sm:gap-4">
                    {/* Sidebar trigger */}
                    <button
                        onClick={toggleSidebar}
                        className="sidebar:hidden flex items-center justify-center w-8 h-8 rounded-lg text-(--color-accent) hover:bg-white/10 transition-colors cursor-pointer border border-(--color-accent)/25"
                        aria-label="Open menu"
                    >
                        <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
                    </button>

                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-2 flex-shrink-0">
                        <img src={smiteLogo} alt="SMITE 2" className="h-8 w-auto" />
                    </Link>

                    {/* "Vault Studio" title */}
                    <div className="flex items-center border-l border-white/10 pl-3">
                        <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Vault Studio</span>
                    </div>

                    {/* Desktop: tabs */}
                    <div className="hidden md:flex items-center gap-1 ml-auto">
                        {tabs.map(tab => (
                            <Link
                                key={tab.path}
                                to={tab.path}
                                className={`text-xs font-bold uppercase px-2.5 py-1.5 rounded-lg transition-all duration-200 ${
                                    isActive(tab)
                                        ? 'text-(--color-accent) bg-(--color-accent)/10'
                                        : 'text-(--nav-text) hover:text-(--color-accent) hover:bg-white/5'
                                }`}
                            >
                                {tab.label}
                            </Link>
                        ))}

                        <div className="border-l border-white/10 mx-1 h-5" />
                        <div className="flex items-center gap-1">
                            <Link
                                to="/"
                                title="Home"
                                className="p-2 rounded-lg text-(--nav-text) hover:text-(--color-accent) hover:bg-white/10 transition-all duration-200"
                            >
                                <Home className="w-4 h-4" />
                            </Link>
                            {user && <PassionDisplay />}
                            <UserMenu compact />
                        </div>
                    </div>

                    {/* Mobile: passion + user */}
                    <div className="flex md:hidden items-center gap-2 ml-auto">
                        {user && <PassionDisplay compact />}
                        <UserMenu compact />
                    </div>
                </div>
            </div>
        </nav>
    )
}

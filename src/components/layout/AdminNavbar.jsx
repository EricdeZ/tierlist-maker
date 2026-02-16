import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useSidebar } from '../../context/SidebarContext'
import UserMenu from '../UserMenu'
import PassionDisplay from '../PassionDisplay'
import smiteLogo from '../../assets/smite2.png'
import ReporterBell from '../ReporterBell'
import { Home, ChevronDown, ChevronRight, MoreHorizontal } from 'lucide-react'

const primaryTabs = [
    { path: '/admin',            label: 'Dashboard',    exact: true,  permission: null },
    { path: '/admin/matchreport', label: 'Report',      exact: false, permission: 'match_report' },
    { path: '/admin/schedule',    label: 'Schedule',    exact: false, permission: 'match_schedule' },
    { path: '/admin/discord',     label: 'Discord',     exact: false, permission: 'match_report' },
]

const morePages = [
    { path: '/admin/discord-review', label: 'Discord Review',  permission: 'match_report' },
    { path: '/admin/matches',        label: 'Match Manager',   permission: 'match_manage' },
    { path: '/admin/rosters',        label: 'Rosters',         permission: 'roster_manage' },
    { path: '/admin/players',        label: 'Players',         permission: 'player_manage' },
    { path: '/admin/leagues',        label: 'Leagues',         permission: 'league_manage' },
    { path: '/admin/challenges',     label: 'Challenges',      permission: 'league_manage' },
    { path: '/admin/banned-content', label: 'Banned Content',  permission: 'league_manage' },
    { path: '/admin/users',          label: 'Users',           permission: 'user_manage' },
    { path: '/admin/claims',         label: 'Claims',          permission: 'claim_manage' },
    { path: '/admin/data-reports',   label: 'Data Reports',    permission: 'league_manage' },
    { path: '/admin/permissions',    label: 'Permissions',     permission: 'permission_manage' },
    { path: '/admin/auditlog',       label: 'Audit Log',       permission: 'audit_log_view' },
    { path: '/admin/debug',          label: 'Debug Tools',     permission: 'permission_manage' },
]

export default function AdminNavbar() {
    const { user, permissions } = useAuth()
    const { toggle: toggleSidebar } = useSidebar()
    const location = useLocation()
    const [moreOpen, setMoreOpen] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)
    const moreRef = useRef(null)
    const menuRef = useRef(null)

    const hasPermissionAnywhere = (key) => {
        if (!key) return true
        if (permissions.global.includes(key)) return true
        return Object.values(permissions.byLeague).some(perms => perms.includes(key))
    }

    const isActive = (item) => {
        if (item.exact) return location.pathname === item.path
        return location.pathname.startsWith(item.path)
    }

    // In the "More" dropdown, also highlight the Discord tab for discord-review
    const isDiscordActive = location.pathname.startsWith('/admin/discord')

    const visibleTabs = primaryTabs.filter(t => hasPermissionAnywhere(t.permission))
    const visibleMore = morePages.filter(p => hasPermissionAnywhere(p.permission))

    // Check if current page is in the "More" list (to show active state on More button)
    const moreIsActive = visibleMore.some(p => isActive(p))

    // Close menus on route change
    useEffect(() => {
        setMobileOpen(false)
        setMoreOpen(false)
    }, [location.pathname])

    // Close More dropdown on click outside
    useEffect(() => {
        if (!moreOpen) return
        const handle = (e) => {
            if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false)
        }
        document.addEventListener('mousedown', handle)
        return () => document.removeEventListener('mousedown', handle)
    }, [moreOpen])

    // Close mobile menu on click outside
    useEffect(() => {
        if (!mobileOpen) return
        const handle = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setMobileOpen(false)
        }
        document.addEventListener('mousedown', handle)
        document.addEventListener('touchstart', handle)
        return () => {
            document.removeEventListener('mousedown', handle)
            document.removeEventListener('touchstart', handle)
        }
    }, [mobileOpen])

    // Prevent body scroll when mobile menu open
    useEffect(() => {
        document.body.style.overflow = mobileOpen ? 'hidden' : ''
        return () => { document.body.style.overflow = '' }
    }, [mobileOpen])

    // All items for mobile menu
    const allPages = [
        ...primaryTabs.filter(t => hasPermissionAnywhere(t.permission)),
        ...visibleMore,
    ]

    return (
        <nav ref={menuRef} className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-7xl">
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

                    {/* "Admin" title — hidden on mobile */}
                    <div className="hidden sm:flex items-center border-l border-white/10 pl-3">
                        <span className="text-xs font-bold text-(--color-accent) uppercase tracking-wider">Admin</span>
                    </div>

                    {/* ── Desktop: tabs + icons ── */}
                    <div className="hidden md:flex items-center gap-1 ml-auto">
                        {/* Primary tabs */}
                        <div className="flex items-center gap-0.5">
                            {visibleTabs.map((item) => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`text-xs font-bold uppercase px-2.5 py-1.5 rounded-lg transition-all duration-200 ${
                                        isActive(item)
                                            ? 'text-(--color-accent) bg-(--color-accent)/10'
                                            : 'text-(--nav-text) hover:text-(--color-accent) hover:bg-white/5'
                                    }`}
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </div>

                        {/* More dropdown */}
                        {visibleMore.length > 0 && (
                            <>
                                <div className="border-l border-white/10 mx-1 h-5" />
                                <div ref={moreRef} className="relative">
                                    <button
                                        onClick={() => setMoreOpen(!moreOpen)}
                                        className={`p-1.5 rounded-lg flex items-center gap-0.5 transition-all duration-200 cursor-pointer ${
                                            moreOpen || moreIsActive
                                                ? 'text-(--color-accent) bg-white/10'
                                                : 'text-(--nav-text) hover:text-(--color-accent) hover:bg-white/10'
                                        }`}
                                        title="More admin pages"
                                    >
                                        <MoreHorizontal className="w-4 h-4" />
                                        <ChevronDown className={`w-3 h-3 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                    {moreOpen && (
                                        <div className="absolute right-0 top-full mt-2 w-52 bg-(--color-secondary) border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
                                            <div className="py-1">
                                                {visibleMore.map((page) => (
                                                    <Link
                                                        key={page.path}
                                                        to={page.path}
                                                        onClick={() => setMoreOpen(false)}
                                                        className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                                                            isActive(page)
                                                                ? 'text-(--color-accent) bg-(--color-accent)/5'
                                                                : 'text-(--color-text) hover:bg-white/5'
                                                        }`}
                                                    >
                                                        {page.label}
                                                    </Link>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Divider + Home + Passion + User */}
                        <div className="border-l border-white/10 mx-1 h-5" />
                        <div className="flex items-center gap-1">
                            <Link
                                to="/"
                                title="Home"
                                className="p-2 rounded-lg text-(--nav-text) hover:text-(--color-accent) hover:bg-white/10 transition-all duration-200"
                            >
                                <Home className="w-4 h-4" />
                            </Link>
                            <ReporterBell />
                            {user && <PassionDisplay />}
                            <UserMenu compact />
                        </div>
                    </div>

                    {/* ── Mobile: passion + user + hamburger ── */}
                    <div className="flex md:hidden items-center gap-2 ml-auto">
                        <ReporterBell />
                        {user && <PassionDisplay compact />}
                        <UserMenu compact />
                        <button
                            onClick={() => setMobileOpen(!mobileOpen)}
                            className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
                            aria-label="Toggle navigation menu"
                        >
                            <div className="w-5 h-4 flex flex-col justify-between">
                                <span
                                    className="block w-full h-0.5 bg-(--color-text) rounded-full transition-all duration-300 origin-center"
                                    style={{ transform: mobileOpen ? 'translateY(7px) rotate(45deg)' : 'none' }}
                                />
                                <span
                                    className="block w-full h-0.5 bg-(--color-text) rounded-full transition-all duration-300"
                                    style={{ opacity: mobileOpen ? 0 : 1, transform: mobileOpen ? 'scaleX(0)' : 'scaleX(1)' }}
                                />
                                <span
                                    className="block w-full h-0.5 bg-(--color-text) rounded-full transition-all duration-300 origin-center"
                                    style={{ transform: mobileOpen ? 'translateY(-7px) rotate(-45deg)' : 'none' }}
                                />
                            </div>
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Mobile dropdown menu ── */}
            <div
                className="md:hidden overflow-hidden transition-all duration-300 ease-in-out"
                style={{ maxHeight: mobileOpen ? '600px' : '0px', opacity: mobileOpen ? 1 : 0 }}
            >
                <div className="mt-2 bg-(--color-primary)/90 backdrop-blur-xl rounded-xl border border-white/10 shadow-xl p-2 max-h-[70vh] overflow-y-auto">
                    {allPages.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold uppercase tracking-wider transition-all duration-200 ${
                                isActive(item)
                                    ? 'text-(--color-accent) bg-(--color-accent)/10'
                                    : 'text-(--nav-text) hover:text-(--color-accent) hover:bg-white/5'
                            }`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                isActive(item) ? 'bg-(--color-accent)' : 'bg-white/20'
                            }`} />
                            {item.label}
                        </Link>
                    ))}

                    <div className="border-t border-white/5 mt-1 pt-1">
                        <Link
                            to="/"
                            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold uppercase tracking-wider text-(--nav-text) hover:text-(--color-accent) hover:bg-white/5 transition-all duration-200"
                        >
                            <Home className="w-4 h-4" />
                            Home
                        </Link>
                    </div>
                </div>
            </div>

            {/* Backdrop overlay when mobile menu open */}
            {mobileOpen && (
                <div className="fixed inset-0 -z-10 md:hidden" />
            )}
        </nav>
    )
}

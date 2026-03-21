import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useSidebar } from '../../context/SidebarContext'
import { scrimService } from '../../services/database'
import UserMenu from '../UserMenu'
import PassionDisplay from '../PassionDisplay'
import smiteLogo from '../../assets/smite2.png'
import ReporterBell from '../ReporterBell'
import { Home, ChevronDown, ChevronRight, MoreHorizontal, UserRoundCog, X, Search } from 'lucide-react'

const primaryTabs = [
    { path: '/admin',            label: 'Dashboard',    exact: true,  permission: null },
    { path: '/admin/matchreport', label: 'Report',      exact: false, permission: 'match_report' },
    { path: '/admin/schedule',    label: 'Schedule',    exact: false, permission: 'match_schedule' },
    { path: '/admin/discord',     label: 'Discord',     exact: false, permission: 'match_report' },
    { path: '/vault-dashboard',  label: 'Vault Studio', exact: false, permission: 'vault_member' },
    { path: '/codex',            label: 'Codex',        exact: false, permission: 'codex_edit' },
]

const morePages = [
    { path: '/admin/discord-review', label: 'Discord Review',  permission: 'match_report' },
    { path: '/admin/roster-sync',    label: 'Roster Sync',    permission: 'roster_manage' },
    { path: '/admin/matches',        label: 'Match Manager',   permission: ['match_manage', 'match_manage_own'] },
    { path: '/admin/rosters',        label: 'Rosters',         permission: 'roster_manage' },
    { path: '/admin/players',        label: 'Players',         permission: 'player_manage',   globalOnly: true },
    { path: '/admin/leagues',        label: 'Leagues',         permission: 'league_manage',   globalOnly: true },
    { path: '/admin/orgs',           label: 'Organizations',   permission: 'league_manage',   globalOnly: true },
    { path: '/admin/challenges',     label: 'Challenges',      permission: 'league_manage',   globalOnly: true },
    { path: '/admin/banned-content', label: 'Banned Content',  permission: 'league_manage',   globalOnly: true },
    { path: '/admin/users',          label: 'Users',           permission: 'user_manage',     globalOnly: true },
    { path: '/admin/claims',         label: 'Claims',          permission: 'claim_manage',    globalOnly: true },
    { path: '/admin/data-reports',   label: 'Data Reports',    permission: 'league_manage',   globalOnly: true },
    { path: '/admin/leaguestaff',    label: 'League Staff',    permission: 'league_staff_manage' },
    { path: '/admin/permissions',    label: 'Permissions',     permission: 'permission_manage' },
    { path: '/admin/auditlog',       label: 'Audit Log',       permission: 'audit_log_view' },
    { path: '/admin/tournaments',    label: 'Tournaments',     permission: 'tournament_manage', globalOnly: true },
    { path: '/admin/debug',          label: 'Debug Tools',     permission: 'permission_manage' },
    { path: '/admin/feedback',       label: 'Feedback',        permission: 'feedback_manage', globalOnly: true },
    { path: '/admin/card-preview',   label: 'Card Preview',    permission: 'permission_manage' },
    { path: '/admin/rotation',       label: 'Pack Rotation',   permission: 'permission_manage' },
    { path: '/vault-dashboard',       label: 'Vault Studio',    permission: 'vault_member' },
    { path: '/admin/settings',       label: 'My Settings',     permission: null },
]

export default function AdminNavbar() {
    const { user, permissions, impersonating, realUser, startImpersonation, stopImpersonation, hasPermission } = useAuth()
    const { toggle: toggleSidebar } = useSidebar()
    const location = useLocation()
    const [moreOpen, setMoreOpen] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)
    const moreRef = useRef(null)
    const menuRef = useRef(null)

    // Impersonation search state
    const [impSearchOpen, setImpSearchOpen] = useState(false)
    const [impQuery, setImpQuery] = useState('')
    const [impResults, setImpResults] = useState([])
    const [impLoading, setImpLoading] = useState(false)
    const impRef = useRef(null)
    const impInputRef = useRef(null)
    const searchTimeout = useRef(null)

    const canImpersonate = hasPermission('permission_manage')

    const hasPermissionAnywhere = (key, globalOnly = false) => {
        if (!key) return true
        const keys = Array.isArray(key) ? key : [key]
        return keys.some(k => {
            if (permissions.global.includes(k)) return true
            if (globalOnly) return false
            return Object.values(permissions.byLeague).some(perms => perms.includes(k))
        })
    }

    const isActive = (item) => {
        if (item.exact) return location.pathname === item.path
        return location.pathname.startsWith(item.path)
    }

    // In the "More" dropdown, also highlight the Discord tab for discord-review
    const isDiscordActive = location.pathname.startsWith('/admin/discord')

    const visibleTabs = primaryTabs.filter(t => hasPermissionAnywhere(t.permission, t.globalOnly))
    const visibleMore = morePages.filter(p => hasPermissionAnywhere(p.permission, p.globalOnly))

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

    // Close impersonation dropdown on click outside
    useEffect(() => {
        if (!impSearchOpen) return
        const handle = (e) => {
            if (impRef.current && !impRef.current.contains(e.target)) {
                setImpSearchOpen(false)
                setImpQuery('')
                setImpResults([])
            }
        }
        document.addEventListener('mousedown', handle)
        return () => document.removeEventListener('mousedown', handle)
    }, [impSearchOpen])

    // Focus search input when dropdown opens
    useEffect(() => {
        if (impSearchOpen && impInputRef.current) {
            impInputRef.current.focus()
        }
    }, [impSearchOpen])

    // Debounced user search
    const searchUsers = useCallback(async (query) => {
        if (!query || query.length < 2) {
            setImpResults([])
            return
        }
        setImpLoading(true)
        try {
            const data = await scrimService.searchUsers(query)
            setImpResults(data.users || [])
        } catch {
            setImpResults([])
        } finally {
            setImpLoading(false)
        }
    }, [])

    useEffect(() => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current)
        searchTimeout.current = setTimeout(() => searchUsers(impQuery), 300)
        return () => clearTimeout(searchTimeout.current)
    }, [impQuery, searchUsers])

    const handleSelectUser = (selectedUser) => {
        startImpersonation(selectedUser.id)
        setImpSearchOpen(false)
        setImpQuery('')
        setImpResults([])
    }

    // All items for mobile menu
    const allPages = [
        ...primaryTabs.filter(t => hasPermissionAnywhere(t.permission, t.globalOnly)),
        ...visibleMore,
    ]

    return (
        <>
            {/* Impersonation banner */}
            {impersonating && (
                <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-600/90 backdrop-blur-sm text-white text-center py-1.5 px-4 text-sm font-medium flex items-center justify-center gap-3">
                    <UserRoundCog className="w-4 h-4 flex-shrink-0" />
                    <span>
                        Impersonating: <strong>{user?.discord_username || `User #${user?.id}`}</strong>
                        {realUser && <span className="opacity-75 ml-1">(as {realUser.discord_username})</span>}
                    </span>
                    <button
                        onClick={stopImpersonation}
                        className="ml-2 px-2.5 py-0.5 bg-white/20 hover:bg-white/30 rounded text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer"
                    >
                        Stop
                    </button>
                </div>
            )}

            <nav ref={menuRef} className={`fixed left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-7xl ${impersonating ? 'top-10' : 'top-4'}`}>
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

                            {/* Divider + Impersonate + Home + Passion + User */}
                            <div className="border-l border-white/10 mx-1 h-5" />
                            <div className="flex items-center gap-1">
                                {/* Impersonate button (owner only) */}
                                {canImpersonate && !impersonating && (
                                    <div ref={impRef} className="relative">
                                        <button
                                            onClick={() => setImpSearchOpen(!impSearchOpen)}
                                            className={`p-2 rounded-lg transition-all duration-200 cursor-pointer ${
                                                impSearchOpen
                                                    ? 'text-amber-400 bg-amber-400/10'
                                                    : 'text-(--nav-text) hover:text-amber-400 hover:bg-white/10'
                                            }`}
                                            title="Impersonate user"
                                        >
                                            <UserRoundCog className="w-4 h-4" />
                                        </button>
                                        {impSearchOpen && (
                                            <div className="absolute right-0 top-full mt-2 w-72 bg-(--color-secondary) border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
                                                <div className="p-3">
                                                    <div className="relative">
                                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
                                                        <input
                                                            ref={impInputRef}
                                                            type="text"
                                                            value={impQuery}
                                                            onChange={(e) => setImpQuery(e.target.value)}
                                                            placeholder="Search users..."
                                                            className="w-full pl-8 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-(--color-text) placeholder:text-white/30 focus:outline-none focus:border-(--color-accent)/50"
                                                        />
                                                    </div>
                                                </div>
                                                {impLoading && (
                                                    <div className="px-4 py-3 text-xs text-white/50 text-center">Searching...</div>
                                                )}
                                                {!impLoading && impResults.length > 0 && (
                                                    <div className="max-h-60 overflow-y-auto border-t border-white/5">
                                                        {impResults.map((u) => (
                                                            <button
                                                                key={u.id}
                                                                onClick={() => handleSelectUser(u)}
                                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-(--color-text) hover:bg-white/5 transition-colors cursor-pointer text-left"
                                                            >
                                                                {u.discord_avatar ? (
                                                                    <img
                                                                        src={`https://cdn.discordapp.com/avatars/${u.discord_id}/${u.discord_avatar}.png?size=32`}
                                                                        alt=""
                                                                        className="w-6 h-6 rounded-full flex-shrink-0"
                                                                    />
                                                                ) : (
                                                                    <div className="w-6 h-6 rounded-full bg-white/10 flex-shrink-0" />
                                                                )}
                                                                <div className="min-w-0">
                                                                    <div className="truncate font-medium">{u.discord_username}</div>
                                                                    <div className="text-xs text-white/40">ID: {u.id}</div>
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                                {!impLoading && impQuery.length >= 2 && impResults.length === 0 && (
                                                    <div className="px-4 py-3 text-xs text-white/50 text-center border-t border-white/5">No users found</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
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

                        {/* Mobile impersonate */}
                        {canImpersonate && (
                            <div className="border-t border-white/5 mt-1 pt-1 px-3 pb-2">
                                {impersonating ? (
                                    <div className="flex items-center justify-between gap-2 px-1 py-2">
                                        <span className="text-xs text-amber-400 font-bold truncate">
                                            <UserRoundCog className="w-3.5 h-3.5 inline mr-1" />
                                            {user?.discord_username}
                                        </span>
                                        <button
                                            onClick={() => { stopImpersonation(); setMobileOpen(false) }}
                                            className="px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded text-xs font-bold uppercase tracking-wide cursor-pointer hover:bg-amber-500/30"
                                        >
                                            Stop
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="relative mt-1">
                                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
                                            <input
                                                type="text"
                                                value={impQuery}
                                                onChange={(e) => setImpQuery(e.target.value)}
                                                placeholder="Impersonate user..."
                                                className="w-full pl-8 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-(--color-text) placeholder:text-white/30 focus:outline-none focus:border-amber-400/50"
                                            />
                                        </div>
                                        {impLoading && <div className="py-2 text-xs text-white/50 text-center">Searching...</div>}
                                        {!impLoading && impResults.length > 0 && (
                                            <div className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-white/5 bg-white/[0.02]">
                                                {impResults.map((u) => (
                                                    <button
                                                        key={u.id}
                                                        onClick={() => { handleSelectUser(u); setMobileOpen(false) }}
                                                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-(--color-text) hover:bg-white/5 cursor-pointer text-left"
                                                    >
                                                        {u.discord_avatar ? (
                                                            <img src={`https://cdn.discordapp.com/avatars/${u.discord_id}/${u.discord_avatar}.png?size=32`} alt="" className="w-6 h-6 rounded-full flex-shrink-0" />
                                                        ) : (
                                                            <div className="w-6 h-6 rounded-full bg-white/10 flex-shrink-0" />
                                                        )}
                                                        <div className="min-w-0">
                                                            <div className="truncate font-medium">{u.discord_username}</div>
                                                            <div className="text-xs text-white/40">ID: {u.id}</div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {!impLoading && impQuery.length >= 2 && impResults.length === 0 && (
                                            <div className="py-2 text-xs text-white/50 text-center">No users found</div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Backdrop overlay when mobile menu open */}
                {mobileOpen && (
                    <div className="fixed inset-0 -z-10 md:hidden" />
                )}
            </nav>
        </>
    )
}

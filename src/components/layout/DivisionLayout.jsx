// src/components/layout/DivisionLayout.jsx
import { useState, useEffect, useRef } from 'react'
import { Outlet, Link, useLocation, useParams } from 'react-router-dom'
import { DivisionProvider, useDivision } from '../../context/DivisionContext'
import { useAuth } from '../../context/AuthContext'
import { useSidebar } from '../../context/SidebarContext'
import UserMenu from '../UserMenu'
import PassionDisplay from '../PassionDisplay'
import smiteLogo from '../../assets/smite2.png'
import { getDivisionImage } from '../../utils/divisionImages'
import { getLeagueLogo } from '../../utils/leagueImages'
import { Home, User, Wrench, ChevronDown, ChevronRight, ListOrdered, Swords, Trophy } from 'lucide-react'

const DivisionNav = () => {
    const { leagueSlug, divisionSlug } = useParams()
    const location = useLocation()
    const { league, division, loading } = useDivision()
    const { user, linkedPlayer } = useAuth()
    const { toggle: toggleSidebar } = useSidebar()
    const [mobileOpen, setMobileOpen] = useState(false)
    const [toolsOpen, setToolsOpen] = useState(false)
    const menuRef = useRef(null)
    const toolsRef = useRef(null)

    const basePath = `/${leagueSlug}/${divisionSlug}`

    const navItems = [
        { path: basePath, label: 'Overview', exact: true },
        { path: `${basePath}/standings`, label: 'Standings' },
        { path: `${basePath}/matches`, label: 'Matches' },
        { path: `${basePath}/stats`, label: 'Stats' },
        { path: `${basePath}/rankings`, label: 'Rankings' },
        { path: `${basePath}/teams`, label: 'Teams' },
    ]

    const isActive = (item) => {
        if (item.exact) return location.pathname === item.path
        return location.pathname.startsWith(item.path)
    }

    // Close menus on route change
    useEffect(() => {
        setMobileOpen(false)
        setToolsOpen(false)
    }, [location.pathname])

    // Close on click outside
    useEffect(() => {
        if (!mobileOpen) return
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setMobileOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('touchstart', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('touchstart', handleClickOutside)
        }
    }, [mobileOpen])

    // Close tools dropdown on click outside
    useEffect(() => {
        if (!toolsOpen) return
        const handle = (e) => {
            if (toolsRef.current && !toolsRef.current.contains(e.target)) setToolsOpen(false)
        }
        document.addEventListener('mousedown', handle)
        return () => document.removeEventListener('mousedown', handle)
    }, [toolsOpen])

    // Prevent body scroll when menu open
    useEffect(() => {
        if (mobileOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => { document.body.style.overflow = '' }
    }, [mobileOpen])

    const rankImg = getDivisionImage(leagueSlug, divisionSlug, division?.tier)
    const leagueLogo = getLeagueLogo(leagueSlug)

    // Find current active nav label for mobile display


    return (
        <nav ref={menuRef} className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-7xl">
            <div className="bg-(--color-primary)/75 backdrop-blur-xl rounded-xl px-4 py-2 shadow-lg border border-white/10">
                <div className="flex items-center gap-3 sm:gap-6">
                    {/* Inline sidebar trigger — visible below 1400px */}
                    <button
                        onClick={toggleSidebar}
                        className="sidebar:hidden flex items-center justify-center w-8 h-8 rounded-lg text-(--color-accent) hover:bg-white/10 transition-colors cursor-pointer border border-(--color-accent)/25"
                        aria-label="Open menu"
                    >
                        <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
                    </button>

                    {/* Logo → homepage */}
                    <Link to="/" className="flex items-center gap-3 flex-shrink-0">
                        <img src={smiteLogo} alt="SMITE 2" className="h-8 sm:h-10 w-auto" />
                    </Link>

                    {/* League logo + Division badge */}
                    <div className="flex items-center gap-2 flex-shrink-0 border-l border-white/10 pl-3 sm:pl-4">
                        {leagueLogo && (
                            <Link to={`/${leagueSlug}`} className="hidden nav:flex flex-shrink-0">
                                <img src={leagueLogo} alt={league?.name || leagueSlug} className="h-8 w-8 object-contain" />
                            </Link>
                        )}
                        {rankImg && (
                            <img src={rankImg} alt="" className="h-6 w-6 sm:h-7 sm:w-7 object-contain" />
                        )}
                        <div className="leading-tight">
                            <div className="text-[10px] sm:text-xs text-(--nav-text) uppercase tracking-wider">
                                {loading ? '...' : leagueSlug.toUpperCase()}
                            </div>
                            <div className="text-xs sm:text-sm font-bold text-(--color-text)">
                                {loading ? '...' : division?.name || divisionSlug}
                            </div>
                        </div>
                    </div>

                    {/* Desktop nav links */}
                    <div className="hidden nav:flex items-center gap-1 text-(--nav-text) ml-auto">
                        {navItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`text-sm font-bold uppercase px-3 py-2 rounded-lg transition-all duration-200 ${
                                    isActive(item)
                                        ? 'text-(--color-accent)'
                                        : 'hover:text-(--color-accent)'
                                }`}
                            >
                                {item.label}
                            </Link>
                        ))}
                        <div className="border-l border-white/10 ml-2 pl-2 flex items-center gap-1">
                            <Link
                                to="/"
                                title="Home"
                                className="p-2 rounded-lg text-(--nav-text) hover:text-(--color-accent) hover:bg-white/10 transition-all duration-200"
                            >
                                <Home className="w-4 h-4" />
                            </Link>
                            <Link
                                to="/leagues"
                                title="Browse Leagues"
                                className="p-2 rounded-lg text-(--nav-text) hover:text-(--color-accent) hover:bg-white/10 transition-all duration-200"
                            >
                                <Trophy className="w-4 h-4" />
                            </Link>
                            {user && (
                                linkedPlayer ? (
                                    <Link
                                        to={`/profile/${linkedPlayer.slug}`}
                                        title="My Profile"
                                        className="p-2 rounded-lg text-(--nav-text) hover:text-(--color-accent) hover:bg-white/10 transition-all duration-200"
                                    >
                                        <User className="w-4 h-4" />
                                    </Link>
                                ) : (
                                    <button
                                        onClick={() => window.dispatchEvent(new CustomEvent('open-claim-modal'))}
                                        title="Claim Your Profile"
                                        className="p-2 rounded-lg text-(--nav-text) hover:text-(--color-accent) hover:bg-white/10 transition-all duration-200"
                                    >
                                        <User className="w-4 h-4" />
                                    </button>
                                )
                            )}
                            <div ref={toolsRef} className="relative">
                                <button
                                    onClick={() => setToolsOpen(!toolsOpen)}
                                    title="Tools"
                                    className={`p-2 rounded-lg flex items-center gap-0.5 transition-all duration-200 ${
                                        toolsOpen ? 'text-(--color-accent) bg-white/10' : 'text-(--nav-text) hover:text-(--color-accent) hover:bg-white/10'
                                    }`}
                                >
                                    <Wrench className="w-4 h-4" />
                                    <ChevronDown className={`w-3 h-3 transition-transform ${toolsOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {toolsOpen && (
                                    <div className="absolute right-0 top-full mt-2 w-48 bg-(--color-secondary) border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
                                        <div className="py-1">
                                            <Link
                                                to="/tierlist"
                                                onClick={() => setToolsOpen(false)}
                                                className="flex items-center gap-3 px-4 py-2.5 text-sm text-(--color-text) hover:bg-white/5 transition-colors"
                                            >
                                                <ListOrdered className="w-4 h-4 text-(--color-text-secondary)" />
                                                Tier List
                                            </Link>
                                            <Link
                                                to="/draft"
                                                onClick={() => setToolsOpen(false)}
                                                className="flex items-center gap-3 px-4 py-2.5 text-sm text-(--color-text) hover:bg-white/5 transition-colors"
                                            >
                                                <Swords className="w-4 h-4 text-(--color-text-secondary)" />
                                                Draft Simulator
                                            </Link>
                                        </div>
                                    </div>
                                )}
                            </div>
                            {user && <PassionDisplay compact />}
                            <UserMenu compact />
                        </div>
                    </div>

                    {/* Mobile: user menu + hamburger */}
                    <div className="flex nav:hidden items-center gap-2 ml-auto">
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
                                    style={{
                                        transform: mobileOpen ? 'translateY(7px) rotate(45deg)' : 'none',
                                    }}
                                />
                                <span
                                    className="block w-full h-0.5 bg-(--color-text) rounded-full transition-all duration-300"
                                    style={{
                                        opacity: mobileOpen ? 0 : 1,
                                        transform: mobileOpen ? 'scaleX(0)' : 'scaleX(1)',
                                    }}
                                />
                                <span
                                    className="block w-full h-0.5 bg-(--color-text) rounded-full transition-all duration-300 origin-center"
                                    style={{
                                        transform: mobileOpen ? 'translateY(-7px) rotate(-45deg)' : 'none',
                                    }}
                                />
                            </div>
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile dropdown menu */}
            <div
                className="nav:hidden overflow-hidden transition-all duration-300 ease-in-out"
                style={{
                    maxHeight: mobileOpen ? '600px' : '0px',
                    opacity: mobileOpen ? 1 : 0,
                }}
            >
                <div className="mt-2 bg-(--color-primary)/90 backdrop-blur-xl rounded-xl border border-white/10 shadow-xl p-2">
                    {navItems.map((item) => (
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

                    {/* Tools section in mobile menu */}
                    <div className="border-t border-white/5 mt-1 pt-1">
                        <div className="px-4 py-2 text-[10px] font-bold text-(--color-text-secondary) uppercase tracking-widest">
                            Tools
                        </div>
                        <Link
                            to="/tierlist"
                            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold uppercase tracking-wider text-(--nav-text) hover:text-(--color-accent) hover:bg-white/5 transition-all duration-200"
                        >
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-white/20" />
                            Tier List
                        </Link>
                        <Link
                            to="/draft"
                            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold uppercase tracking-wider text-(--nav-text) hover:text-(--color-accent) hover:bg-white/5 transition-all duration-200"
                        >
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-white/20" />
                            Draft Simulator
                        </Link>
                    </div>

                    {/* Profile + Home links in mobile menu */}
                    <div className="border-t border-white/5 mt-1 pt-1">
                        {user && linkedPlayer && (
                            <Link
                                to={`/profile/${linkedPlayer.slug}`}
                                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold uppercase tracking-wider text-(--nav-text) hover:text-(--color-accent) hover:bg-white/5 transition-all duration-200"
                            >
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-white/20" />
                                My Profile
                            </Link>
                        )}
                        <Link
                            to="/leagues"
                            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold uppercase tracking-wider text-(--nav-text) hover:text-(--color-accent) hover:bg-white/5 transition-all duration-200"
                        >
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-white/20" />
                            Browse Leagues
                        </Link>
                        <Link
                            to="/"
                            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold uppercase tracking-wider text-(--nav-text) hover:text-(--color-accent) hover:bg-white/5 transition-all duration-200"
                        >
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-white/20" />
                            ← Home
                        </Link>
                    </div>
                </div>
            </div>

            {/* Backdrop overlay when menu is open */}
            {mobileOpen && (
                <div className="fixed inset-0 -z-10 nav:hidden" />
            )}
        </nav>
    )
}

const DivisionContent = () => {
    const { loading, error, season, division } = useDivision()

    if (error) {
        return (
            <div className="pt-24 px-4">
                <div className="max-w-2xl mx-auto mt-12">
                    <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-8 text-center">
                        <h2 className="text-2xl font-bold text-red-400 mb-3">Failed to Load</h2>
                        <p className="text-red-300/80 mb-6">{error}</p>
                        <Link
                            to="/"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-(--color-accent) text-(--color-primary) rounded-lg font-semibold hover:opacity-90 transition-opacity"
                        >
                            ← Back to Home
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <>
            <DivisionNav />
            <main className="pt-24">
                {loading ? (
                    <div className="flex items-center justify-center p-16">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-(--color-accent) mx-auto mb-4" />
                            <p className="text-(--color-text-secondary)">Loading division data...</p>
                        </div>
                    </div>
                ) : !season ? (
                    <div className="flex items-center justify-center p-16">
                        <div className="max-w-md text-center">
                            <h2 className="text-xl font-bold text-(--color-text) mb-2">No Seasons Yet</h2>
                            <p className="text-(--color-text-secondary) mb-6">
                                {division?.name || 'This division'} doesn't have any seasons configured yet.
                            </p>
                            <Link
                                to="/"
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-(--color-accent) text-(--color-primary) rounded-lg font-semibold hover:opacity-90 transition-opacity"
                            >
                                ← Back to Home
                            </Link>
                        </div>
                    </div>
                ) : (
                    <Outlet />
                )}
            </main>
        </>
    )
}

const DivisionLayout = () => {
    return (
        <DivisionProvider>
            <DivisionContent />
        </DivisionProvider>
    )
}

export default DivisionLayout
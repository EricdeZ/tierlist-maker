// src/components/layout/DivisionLayout.jsx
import { useState, useEffect, useRef } from 'react'
import { Outlet, Link, useLocation, useParams } from 'react-router-dom'
import { DivisionProvider, useDivision } from '../../context/DivisionContext'
import UserMenu from '../UserMenu'
import smiteLogo from '../../assets/smite2.png'
import { getDivisionImage } from '../../utils/divisionImages'

const DivisionNav = () => {
    const { leagueSlug, divisionSlug } = useParams()
    const location = useLocation()
    const { league, division, loading } = useDivision()
    const [mobileOpen, setMobileOpen] = useState(false)
    const menuRef = useRef(null)

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

    // Close mobile menu on route change
    useEffect(() => {
        setMobileOpen(false)
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

    // Find current active nav label for mobile display
    const activeItem = navItems.find(item => isActive(item))

    return (
        <nav ref={menuRef} className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-7xl">
            <div className="bg-(--color-primary)/75 backdrop-blur-xl rounded-xl px-4 py-2 shadow-lg border border-white/10">
                <div className="flex items-center gap-3 sm:gap-6">
                    {/* Logo → homepage */}
                    <Link to="/" className="flex items-center gap-3 flex-shrink-0">
                        <img src={smiteLogo} alt="SMITE 2" className="h-8 sm:h-10 w-auto" />
                    </Link>

                    {/* Division badge */}
                    <div className="flex items-center gap-2 flex-shrink-0 border-l border-white/10 pl-3 sm:pl-4">
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
                    <div className="hidden md:flex items-center gap-1 text-(--nav-text) ml-auto">
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
                        <div className="border-l border-white/10 ml-2 pl-2">
                            <UserMenu compact />
                        </div>
                    </div>

                    {/* Mobile: active page label + user menu + hamburger */}
                    <div className="flex md:hidden items-center gap-2 ml-auto">
                        {activeItem && (
                            <span className="text-xs font-bold text-(--color-accent) uppercase tracking-wider">
                                {activeItem.label}
                            </span>
                        )}
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
                className="md:hidden overflow-hidden transition-all duration-300 ease-in-out"
                style={{
                    maxHeight: mobileOpen ? '400px' : '0px',
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

                    {/* Home link in mobile menu */}
                    <div className="border-t border-white/5 mt-1 pt-1">
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
                <div className="fixed inset-0 -z-10 md:hidden" />
            )}
        </nav>
    )
}

const DivisionContent = () => {
    const { loading, error } = useDivision()

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
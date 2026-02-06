// src/components/layout/DivisionLayout.jsx
import { Outlet, Link, useLocation, useParams } from 'react-router-dom'
import { DivisionProvider, useDivision } from '../../context/DivisionContext'
import smiteLogo from '../../assets/smite2.png'

// Rank images keyed by division tier (1 = highest skill)
import deityImg from '../../assets/ranks/deity.png'
import demigodImg from '../../assets/ranks/demigod.png'
import masterImg from '../../assets/ranks/master.png'
import obsidianImg from '../../assets/ranks/obsidian.png'
import diamondImg from '../../assets/ranks/diamond.png'

const RANK_IMAGES = {
    1: deityImg,
    2: demigodImg,
    3: masterImg,
    4: obsidianImg,
    5: diamondImg,
}

const DivisionNav = () => {
    const { leagueSlug, divisionSlug } = useParams()
    const location = useLocation()
    const { league, division, loading } = useDivision()

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

    const rankImg = division?.tier ? RANK_IMAGES[division.tier] : null

    return (
        <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%]">
            <div className="bg-(--color-primary)/75 backdrop-blur-xl rounded-xl px-4 py-2 shadow-lg border border-white/10">
                <div className="flex items-center gap-6">
                    {/* Logo → homepage */}
                    <Link to="/" className="flex items-center gap-3 flex-shrink-0">
                        <img src={smiteLogo} alt="SMITE 2" className="h-10 w-auto" />
                    </Link>

                    {/* Division badge */}
                    <div className="flex items-center gap-2 flex-shrink-0 border-l border-white/10 pl-4">
                        {rankImg && (
                            <img src={rankImg} alt="" className="h-7 w-7 object-contain" />
                        )}
                        <div className="leading-tight">
                            <div className="text-xs text-(--nav-text) uppercase tracking-wider">
                                {loading ? '...' : league?.name || leagueSlug}
                            </div>
                            <div className="text-sm font-bold text-(--color-text)">
                                {loading ? '...' : division?.name || divisionSlug}
                            </div>
                        </div>
                    </div>

                    {/* Nav links */}
                    <div className="flex gap-1 text-(--nav-text) ml-auto">
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
                    </div>
                </div>
            </div>
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
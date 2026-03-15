// src/components/layout/DivisionLayout.jsx
import { Outlet, Link, useParams, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { DivisionProvider, useDivision } from '../../context/DivisionContext'
import Navbar from './Navbar'
import { getDivisionImage } from '../../utils/divisionImages'
import { getLeagueLogo } from '../../utils/leagueImages'
import { ChevronDown } from 'lucide-react'

const DivisionContent = () => {
    const { leagueSlug, divisionSlug } = useParams()
    const navigate = useNavigate()
    const location = useLocation()
    const { loading, error, season, division, league } = useDivision()
    const [divPickerOpen, setDivPickerOpen] = useState(false)
    const divPickerRef = useRef(null)

    const basePath = `/${leagueSlug}/${divisionSlug}`

    const navItems = [
        { path: basePath, label: 'Overview', exact: true },
        { path: `${basePath}/matches`, label: 'Matches' },
        { path: `${basePath}/stats`, label: 'Stats' },
        { path: `${basePath}/tierlist`, label: 'Tierlist' },
        { path: `${basePath}/teams`, label: 'Teams' },
    ]

    const rankImg = getDivisionImage(leagueSlug, divisionSlug, division?.tier)
    const leagueLogo = getLeagueLogo(leagueSlug, league?.image_url)
    const hasManyDivisions = !loading && league?.divisions?.length > 1

    // Close picker on click outside
    useEffect(() => {
        if (!divPickerOpen) return
        const handle = (e) => {
            if (divPickerRef.current && !divPickerRef.current.contains(e.target)) setDivPickerOpen(false)
        }
        document.addEventListener('mousedown', handle)
        return () => document.removeEventListener('mousedown', handle)
    }, [divPickerOpen])

    // Close picker on route change
    useEffect(() => { setDivPickerOpen(false) }, [location.pathname])

    const divisionBranding = (
        <>
            {leagueLogo && (
                <Link to={`/${leagueSlug}`} className="flex flex-shrink-0">
                    <img src={leagueLogo} alt={league?.name || leagueSlug} className="h-8 w-8 object-contain" />
                </Link>
            )}
            {rankImg && (
                <img src={rankImg} alt="" className="h-6 w-6 sm:h-7 sm:w-7 object-contain" />
            )}
            <div className="hidden min-[800px]:block leading-tight relative" ref={divPickerRef}>
                <div className="text-[10px] sm:text-xs text-(--nav-text) uppercase tracking-wider">
                    {loading ? '...' : leagueSlug.toUpperCase()}
                </div>
                {hasManyDivisions ? (
                    <>
                        <button
                            onClick={() => setDivPickerOpen(prev => !prev)}
                            className="flex items-center gap-1 text-xs sm:text-sm font-bold text-(--color-text) hover:text-(--color-accent) transition-colors cursor-pointer"
                        >
                            {division?.name || divisionSlug}
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${divPickerOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {divPickerOpen && (
                            <div className="absolute top-full left-0 mt-2 min-w-[180px] rounded-xl border border-white/15 bg-(--color-secondary) shadow-2xl overflow-hidden backdrop-blur-xl z-50">
                                {league.divisions.map(d => {
                                    const isActive = d.slug === divisionSlug
                                    const img = getDivisionImage(leagueSlug, d.slug, d.tier)
                                    return (
                                        <button
                                            key={d.id}
                                            onClick={() => {
                                                setDivPickerOpen(false)
                                                if (!isActive) navigate(`/${leagueSlug}/${d.slug}`)
                                            }}
                                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer ${
                                                isActive
                                                    ? 'bg-white/10 text-(--color-accent)'
                                                    : 'hover:bg-white/5 text-(--color-text)'
                                            }`}
                                        >
                                            {img && <img src={img} alt="" className="h-5 w-5 object-contain shrink-0" />}
                                            <span className="font-bold text-sm">{d.name}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-xs sm:text-sm font-bold text-(--color-text)">
                        {loading ? '...' : division?.name || divisionSlug}
                    </div>
                )}
            </div>
        </>
    )

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
            <Navbar branding={divisionBranding} tabs={navItems} />
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

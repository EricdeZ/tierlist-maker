// src/components/layout/DivisionLayout.jsx
import { Outlet, Link, useParams } from 'react-router-dom'
import { DivisionProvider, useDivision } from '../../context/DivisionContext'
import Navbar from './Navbar'
import { getDivisionImage } from '../../utils/divisionImages'
import { getLeagueLogo } from '../../utils/leagueImages'

const DivisionContent = () => {
    const { leagueSlug, divisionSlug } = useParams()
    const { loading, error, season, division, league } = useDivision()

    const basePath = `/${leagueSlug}/${divisionSlug}`

    const navItems = [
        { path: basePath, label: 'Overview', exact: true },
        { path: `${basePath}/matches`, label: 'Matches' },
        { path: `${basePath}/stats`, label: 'Stats' },
        { path: `${basePath}/rankings`, label: 'Rankings' },
        { path: `${basePath}/teams`, label: 'Teams' },
    ]

    const rankImg = getDivisionImage(leagueSlug, divisionSlug, division?.tier)
    const leagueLogo = getLeagueLogo(leagueSlug)

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
            <div className="hidden min-[800px]:block leading-tight">
                <div className="text-[10px] sm:text-xs text-(--nav-text) uppercase tracking-wider">
                    {loading ? '...' : leagueSlug.toUpperCase()}
                </div>
                <div className="text-xs sm:text-sm font-bold text-(--color-text)">
                    {loading ? '...' : division?.name || divisionSlug}
                </div>
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

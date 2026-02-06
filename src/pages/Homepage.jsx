// src/pages/Homepage.jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { leagueService } from '../services/database'
import smiteLogo from '../assets/smite2.png'

// Rank images (tier 1 = highest skill)
import deityImg from '../assets/ranks/deity.png'
import demigodImg from '../assets/ranks/demigod.png'
import masterImg from '../assets/ranks/master.png'
import obsidianImg from '../assets/ranks/obsidian.png'
import diamondImg from '../assets/ranks/diamond.png'

const RANK_IMAGES = {
    1: deityImg,
    2: demigodImg,
    3: masterImg,
    4: obsidianImg,
    5: diamondImg,
}

const RANK_LABELS = {
    1: 'Deity',
    2: 'Demigod',
    3: 'Master',
    4: 'Obsidian',
    5: 'Diamond',
}

const Homepage = () => {
    const [leagues, setLeagues] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        let cancelled = false

        const loadLeagues = async () => {
            try {
                const allLeagues = await leagueService.getAll()
                if (cancelled) return

                // Fetch full details (divisions + seasons) for each league
                const detailed = await Promise.all(
                    allLeagues.map(l => leagueService.getBySlug(l.slug))
                )
                if (cancelled) return

                setLeagues(detailed)
            } catch (err) {
                if (!cancelled) setError(err.message)
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        loadLeagues()
        return () => { cancelled = true }
    }, [])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-(--color-accent) mx-auto mb-4" />
                    <p className="text-(--color-text-secondary)">Loading leagues...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4">
                <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-8 text-center max-w-md">
                    <h2 className="text-2xl font-bold text-red-400 mb-3">Connection Error</h2>
                    <p className="text-red-300/80">{error}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen">
            {/* Header */}
            <header className="pt-12 pb-8 px-4 text-center">
                <img src={smiteLogo} alt="SMITE 2" className="h-20 w-auto mx-auto mb-4" />
                <h1 className="font-heading text-4xl font-bold text-(--color-text) mb-2">
                    SMITE 2 Companion
                </h1>
                <p className="text-(--color-text-secondary) text-lg max-w-md mx-auto">
                    Player stats, standings, tierlists and more for competitive SMITE 2 leagues.
                </p>
            </header>

            {/* Leagues */}
            <div className="max-w-6xl mx-auto px-4 pb-16 space-y-12">
                {leagues.map(league => {
                    const divisions = league.divisions || []

                    return (
                        <section key={league.id}>
                            {/* League header */}
                            <div className="flex items-center gap-4 mb-6">
                                <div>
                                    <h2 className="font-heading text-2xl font-bold text-(--color-text)">
                                        {league.name}
                                    </h2>
                                    {league.description && (
                                        <p className="text-(--color-text-secondary) text-sm">
                                            {league.description}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Division cards */}
                            {divisions.length === 0 ? (
                                <p className="text-(--color-text-secondary) italic">
                                    No divisions found for this league.
                                </p>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {divisions.map(division => {
                                        const rankImg = RANK_IMAGES[division.tier]
                                        const rankLabel = RANK_LABELS[division.tier]
                                        const activeSeason = division.seasons?.find(s => s.is_active)
                                        const hasData = !!activeSeason

                                        return (
                                            <Link
                                                key={division.id}
                                                to={hasData ? `/${league.slug}/${division.slug}` : '#'}
                                                className={`group relative overflow-hidden rounded-xl border transition-all duration-300 ${
                                                    hasData
                                                        ? 'border-white/10 bg-(--color-secondary) hover:border-(--color-accent)/40 hover:shadow-lg hover:shadow-(--color-accent)/5 hover:-translate-y-0.5'
                                                        : 'border-white/5 bg-(--color-secondary)/50 opacity-50 cursor-not-allowed'
                                                }`}
                                            >
                                                <div className="p-5">
                                                    <div className="flex items-center gap-3 mb-3">
                                                        {rankImg && (
                                                            <img
                                                                src={rankImg}
                                                                alt={rankLabel}
                                                                className="h-10 w-10 object-contain"
                                                            />
                                                        )}
                                                        <div>
                                                            <h3 className="font-heading text-lg font-bold text-(--color-text) group-hover:text-(--color-accent) transition-colors">
                                                                {division.name}
                                                            </h3>
                                                            {rankLabel && (
                                                                <span className="text-xs text-(--color-text-secondary) uppercase tracking-wider">
                                                                    {rankLabel} Tier
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {activeSeason ? (
                                                        <div className="text-sm text-(--color-text-secondary)">
                                                            <span className="inline-flex items-center gap-1.5">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                                                                {activeSeason.name}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div className="text-sm text-(--color-text-secondary) italic">
                                                            No active season
                                                        </div>
                                                    )}
                                                </div>

                                                {hasData && (
                                                    <div className="absolute top-5 right-4 text-(--color-text-secondary) group-hover:text-(--color-accent) transition-all group-hover:translate-x-1">
                                                        →
                                                    </div>
                                                )}
                                            </Link>
                                        )
                                    })}
                                </div>
                            )}
                        </section>
                    )
                })}
            </div>
        </div>
    )
}

export default Homepage
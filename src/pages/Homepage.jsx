// src/pages/Homepage.jsx
import { useEffect, useState, useRef, useCallback } from 'react'
import { leagueService } from '../services/database'
import { useAuth } from '../context/AuthContext'
import smiteLogo from '../assets/smite2.png'

import ChallengeBanner from '../components/ChallengeBanner'
import PassionPromoBanner from '../components/PassionPromoBanner'
import PageTitle from '../components/PageTitle'
import { useReadyMatchCount } from '../hooks/useReadyMatchCount'

import HeroSection from './homepage/HeroSection'
import ReporterNotification from './homepage/ReporterNotification'
import LeaguesSection from './homepage/LeaguesSection'
import WhatIsSection from './homepage/WhatIsSection'
import StorySection from './homepage/StorySection'
import CommunitySection from './homepage/CommunitySection'
import PassionCTA from './homepage/PassionCTA'
import VaultPromoSection from './homepage/VaultPromoSection'
import ForgePromoSection from './homepage/ForgePromoSection'
import HomepageFooter from './homepage/HomepageFooter'


const Homepage = () => {
    const { hasPermission } = useAuth()
    const canPreview = (leagueId) => hasPermission('league_preview', leagueId)
    const { count: readyCount, matches: readyMatches, hasReportPermission } = useReadyMatchCount()
    const [leagues, setLeagues] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    // Subtle interactive effects for hero section
    const heroRef = useRef(null)
    const [heroLight, setHeroLight] = useState({ x: 50, y: 50, active: false })

    const handleHeroMove = useCallback((e) => {
        const el = heroRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        setHeroLight({
            x: ((e.clientX - rect.left) / rect.width) * 100,
            y: ((e.clientY - rect.top) / rect.height) * 100,
            active: true,
        })
    }, [])
    const handleHeroLeave = useCallback(() => {
        setHeroLight(prev => ({ ...prev, active: false }))
    }, [])


    useEffect(() => {
        let cancelled = false

        const loadLeagues = async () => {
            try {
                const allLeagues = await leagueService.getAll()
                if (cancelled) return

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

    const mainLeagues = [...leagues]
        .filter(l => l.name?.toLowerCase() !== 'test league')
        .sort((a, b) => {
            const aActive = a.divisions?.some(d => d.seasons?.some(s => s.is_active || canPreview(a.id))) ? 0 : 1
            const bActive = b.divisions?.some(d => d.seasons?.some(s => s.is_active || canPreview(b.id))) ? 0 : 1
            return aActive - bActive
        })
    const hasActiveLeagues = mainLeagues.some(l =>
        l.divisions?.some(d => d.seasons?.some(s => s.is_active || canPreview(l.id)))
    )

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <img src={smiteLogo} alt="" className="h-16 w-auto mx-auto mb-6 animate-pulse" />
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-(--color-accent) border-t-transparent mx-auto" />
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4">
                <div className="bg-red-900/20 border border-red-500/30 rounded-2xl p-10 text-center max-w-md backdrop-blur-sm">
                    <div className="text-5xl mb-4">⚠️</div>
                    <h2 className="text-2xl font-bold text-red-400 mb-3 font-heading">Connection Error</h2>
                    <p className="text-red-300/80">{error}</p>
                </div>
            </div>
        )
    }

    const divisionCount = mainLeagues.reduce((sum, l) => sum + (l.divisions?.length || 0), 0)

    return (
        <div className="min-h-screen overflow-hidden">
            <PageTitle title="Stats, Standings & Tools for Competitive SMITE 2" description="The ultimate SMITE 2 competitive companion. Live standings, player stats, match history, tier lists, and draft simulator for community SMITE 2 leagues." />

            <HeroSection
                heroRef={heroRef}
                heroLight={heroLight}
                handleHeroMove={handleHeroMove}
                handleHeroLeave={handleHeroLeave}
            />

            {hasReportPermission && readyCount > 0 && (
                <ReporterNotification readyCount={readyCount} readyMatches={readyMatches} />
            )}

            <LeaguesSection leagues={mainLeagues} canPreview={canPreview} />

            <VaultPromoSection />

            <ForgePromoSection />

            <PassionPromoBanner />

            <WhatIsSection />

            <StorySection leagueCount={mainLeagues.length} divisionCount={divisionCount} />

            <CommunitySection />

            <section className="px-4 pb-4">
                <div className="max-w-4xl mx-auto">
                    <ChallengeBanner />
                </div>
            </section>

            <PassionCTA hasActiveLeagues={hasActiveLeagues} />

            <HomepageFooter />
        </div>
    )
}

export default Homepage

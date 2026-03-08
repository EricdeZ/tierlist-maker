import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePassion } from '../context/PassionContext'
import { forgeService } from '../services/database'
import PageTitle from '../components/PageTitle'
import Navbar from '../components/layout/Navbar'

import { createEmberSystem } from './forge/forgeCanvas'
import useForgeData from './forge/useForgeData'
import useForgeTrade from './forge/useForgeTrade'
import ForgeHeader from './forge/ForgeHeader'
import ForgeTabBar from './forge/ForgeTabBar'
import ForgeLockBanner from './forge/ForgeLockBanner'
import ForgeLoadingScreen from './forge/ForgeLoadingScreen'
import ForgeAuthGate from './forge/ForgeAuthGate'
import ForgeHeroBanner from './forge/ForgeHeroBanner'
import ForgeMarketTab from './forge/ForgeMarketTab'
import ForgePortfolioTab from './forge/ForgePortfolioTab'
import ForgeLeaderboardTab from './forge/ForgeLeaderboardTab'
import ForgeChallengesTab from './forge/ForgeChallengesTab'
import ForgeWikiTab from './forge/ForgeWikiTab'
import ForgeTradeModal from './forge/ForgeTradeModal'
import ForgeToast from './forge/ForgeToast'
import ForgeTutorial from './forge/ForgeTutorial'
import ForgeSpotlight from './forge/ForgeSpotlight'
import './forge/forge.css'

const CHANGE_VIEW_KEY = 'smite2_forge_change_view'

export default function FantasyForge() {
    const { leagueSlug: urlLeagueSlug, divisionSlug: urlDivisionSlug } = useParams()
    const navigate = useNavigate()
    const location = useLocation()
    const { user, login, loading: authLoading, hasPermission } = useAuth()
    const { balance, refreshBalance } = usePassion()

    const isOwner = hasPermission('permission_manage')

    // Change view toggle (24h vs 7d)
    const [changeView, setChangeView] = useState(() => {
        try { return localStorage.getItem(CHANGE_VIEW_KEY) || '24h' }
        catch { return '24h' }
    })
    const setChangeViewPersisted = (val) => {
        setChangeView(val)
        localStorage.setItem(CHANGE_VIEW_KEY, val)
    }

    // Data hook
    const data = useForgeData({ urlLeagueSlug, urlDivisionSlug, user })

    // Market filters
    const [search, setSearch] = useState('')
    const [sortBy, setSortBy] = useState('perf-desc')
    const [teamFilter, setTeamFilter] = useState('')
    const [roleFilter, setRoleFilter] = useState('')

    // Spotlight state
    const [spotlightPlayer, setSpotlightPlayer] = useState(null)
    const [spotlightPos, setSpotlightPos] = useState({ x: window.innerWidth - 280, y: 120 })
    const [isDraggingSpotlight, setIsDraggingSpotlight] = useState(false)
    const spotlightDragOffset = useRef({ x: 0, y: 0 })

    // UI state
    const [toastMessage, setToastMessage] = useState(null)
    const [tutorialReplay, setTutorialReplay] = useState(false)

    // Canvas refs
    const bgCanvasRef = useRef(null)
    const fxCanvasRef = useRef(null)
    const flashRef = useRef(null)
    const containerRef = useRef(null)
    const emberSystemRef = useRef(null)

    // Trade hook
    const trade = useForgeTrade({
        market: data.market,
        refreshBalance,
        loadData: data.loadData,
        setFreeSparksRemaining: data.setFreeSparksRemaining,
        setReferralSparksAvailable: data.setReferralSparksAvailable,
        setToastMessage,
        fxCanvasRef,
        flashRef,
        containerRef,
    })

    // Capture forge_ref from URL and auto-claim when logged in
    useEffect(() => {
        const params = new URLSearchParams(location.search)
        const forgeRef = params.get('forge_ref')
        if (forgeRef) {
            localStorage.setItem('pending_forge_referral', forgeRef)
            params.delete('forge_ref')
            navigate(location.pathname + (params.toString() ? `?${params}` : ''), { replace: true })
        }
    }, [location.search, navigate, location.pathname])

    useEffect(() => {
        if (!user) return
        const pendingRef = localStorage.getItem('pending_forge_referral')
        if (!pendingRef) return
        localStorage.removeItem('pending_forge_referral')
        forgeService.claimForgeReferral(pendingRef)
            .then(() => {
                data.setReferralSparksAvailable(1)
                setToastMessage('Forge referral claimed! You earned 1 free Referral Spark.')
            })
            .catch(() => {})
    }, [user])

    // Canvas setup
    useEffect(() => {
        if (!bgCanvasRef.current) return
        const system = createEmberSystem(bgCanvasRef.current)
        system.start()
        emberSystemRef.current = system

        const handleResize = () => {
            system.resize()
            if (fxCanvasRef.current) {
                const dpr = window.devicePixelRatio || 1
                fxCanvasRef.current.width = window.innerWidth * dpr
                fxCanvasRef.current.height = window.innerHeight * dpr
            }
        }
        window.addEventListener('resize', handleResize)
        handleResize()

        return () => {
            system.stop()
            window.removeEventListener('resize', handleResize)
        }
    }, [user])

    // Spotlight dragging
    useEffect(() => {
        if (!isDraggingSpotlight) return
        const onMouseMove = (e) => {
            setSpotlightPos({
                x: Math.max(0, Math.min(window.innerWidth - 240, e.clientX - spotlightDragOffset.current.x)),
                y: Math.max(0, Math.min(window.innerHeight - 100, e.clientY - spotlightDragOffset.current.y)),
            })
        }
        const onMouseUp = () => setIsDraggingSpotlight(false)
        window.addEventListener('mousemove', onMouseMove)
        window.addEventListener('mouseup', onMouseUp)
        return () => {
            window.removeEventListener('mousemove', onMouseMove)
            window.removeEventListener('mouseup', onMouseUp)
        }
    }, [isDraggingSpotlight])

    // Tab navigation
    const getTabPath = useCallback((tabKey) => {
        if (data.isLeagueWide && data.selectedLeagueOption) {
            const base = `/forge/${data.selectedLeagueOption.leagueSlug}`
            return tabKey === 'market' ? base : `${base}/${tabKey}`
        }
        const s = data.selectedSeason
        if (!s) return '/forge'
        const base = `/forge/${s.leagueSlug}/${s.divisionSlug}`
        return tabKey === 'market' ? base : `${base}/${tabKey}`
    }, [data.selectedSeason, data.isLeagueWide, data.selectedLeagueOption])

    const navigateTab = useCallback((tabKey) => {
        navigate(getTabPath(tabKey), { replace: true })
    }, [navigate, getTabPath])

    // Unique teams for filter
    const teams = useMemo(() => {
        const map = {}
        data.players.forEach(p => { map[p.teamSlug] = { name: p.teamName, color: p.teamColor, slug: p.teamSlug } })
        const list = Object.values(map).sort((a, b) => a.name.localeCompare(b.name))
        if (data.players.some(p => p.isFreeAgent)) {
            list.push({ name: 'Free Agents', color: '#888', slug: 'fa' })
        }
        return list
    }, [data.players])

    // Filtered + sorted players
    const filteredPlayers = useMemo(() => {
        let list = [...data.players]

        if (search.trim()) {
            const q = search.toLowerCase()
            list = list.filter(p =>
                p.playerName.toLowerCase().includes(q) ||
                p.teamName.toLowerCase().includes(q) ||
                (p.role || '').toLowerCase().includes(q) ||
                (p.isFreeAgent && ('free agent'.startsWith(q) || q === 'fa'))
            )
        }

        if (teamFilter) {
            list = teamFilter === 'fa' ? list.filter(p => p.isFreeAgent) : list.filter(p => p.teamSlug === teamFilter)
        }

        if (roleFilter) {
            list = list.filter(p => (p.role || '').toLowerCase() === roleFilter.toLowerCase())
        }

        const [key, dir] = sortBy.split('-')
        list.sort((a, b) => {
            let va, vb
            if (key === 'price') { va = a.currentPrice; vb = b.currentPrice }
            else if (key === 'change') {
                const cv = changeView === '7d' ? 'priceChange7d' : 'priceChange24h'
                va = a[cv] ?? -999; vb = b[cv] ?? -999
            }
            else if (key === 'perf') { va = a.perfMultiplier ?? 0; vb = b.perfMultiplier ?? 0 }
            else if (key === 'sparks') { va = a.totalSparks; vb = b.totalSparks }
            else if (key === 'name') { va = a.playerName; vb = b.playerName }
            if (typeof va === 'string') return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
            return dir === 'asc' ? va - vb : vb - va
        })

        return list
    }, [data.players, search, teamFilter, roleFilter, sortBy, changeView])

    // Player interaction handlers
    const handleSelectFeatured = (player) => {
        data.setFeaturedPlayer(player)
        data.loadPlayerHistory(player.sparkId)
    }

    const handleSelectPlayer = (player) => {
        if (data.isLeagueWide && player.divisionSlug) {
            navigate(`/forge/${urlLeagueSlug}/${player.divisionSlug}/player/${player.playerSlug}`)
            return
        }
        if (!data.selectedSeason) return
        navigate(`/forge/${data.selectedSeason.leagueSlug}/${data.selectedSeason.divisionSlug}/player/${player.playerSlug}`)
    }

    const handleSpotlightPlayer = useCallback((player) => {
        setSpotlightPlayer(prev => prev?.sparkId === player.sparkId ? null : player)
    }, [])

    const handleRandomPlayer = useCallback(() => {
        if (data.players.length === 0) return
        const pool = data.players.filter(p => p.sparkId !== data.featuredPlayer?.sparkId)
        if (pool.length === 0) return
        const random = pool[Math.floor(Math.random() * pool.length)]
        data.setFeaturedPlayer(random)
        data.loadPlayerHistory(random.sparkId)
    }, [data.players, data.featuredPlayer])

    // Toggle market status (owner only)
    const toggleMarketStatus = async () => {
        if (!data.market || !isOwner) return
        const newStatus = data.market.status === 'open' ? 'closed' : 'open'
        try {
            await forgeService.toggleStatus(data.seasonId, newStatus)
            data.setMarket(prev => ({ ...prev, status: newStatus }))
            setToastMessage(`Forge market ${newStatus === 'open' ? 'opened' : 'closed'}`)
        } catch (err) {
            setToastMessage(`Failed: ${err.message}`)
        }
    }

    // Full-page loading screen
    const isInitializing = authLoading || !data.seasonsLoaded || (!data.initialDataLoaded && (!!data.seasonId || !!data.leagueWideId))

    if (isInitializing) return <ForgeLoadingScreen />
    if (!user) return <ForgeAuthGate onLogin={login} />

    return (
        <div className="min-h-screen bg-(--color-primary) text-(--color-text) relative overflow-hidden">
            <Navbar title="Fantasy Forge" />
            <PageTitle title="Fantasy Forge" description="Invest Sparks in competitive SMITE 2 players. Buy low, sell high as players perform. Track portfolios and climb leaderboards." image="https://smitecomp.com/forge.png" />

            <canvas ref={bgCanvasRef} className="fixed inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }} />
            <canvas ref={fxCanvasRef} className="fixed inset-0 w-full h-full pointer-events-none" style={{ zIndex: 100 }} />
            <div ref={flashRef} className="forge-flash" />
            <ForgeToast message={toastMessage} onDone={() => setToastMessage(null)} />

            <div ref={containerRef} className="relative" style={{ zIndex: 1 }}>
                <ForgeHeroBanner />

                <div className="max-w-[1300px] mx-auto px-3 sm:px-5 pt-20 pb-20">
                    <ForgeHeader
                        visibleSeasons={data.visibleSeasons}
                        leagueOptions={data.leagueOptions}
                        seasonId={data.seasonId}
                        isLeagueWide={data.isLeagueWide}
                        leagueWideId={data.leagueWideId}
                        urlLeagueSlug={urlLeagueSlug}
                        selectedLeagueOption={data.selectedLeagueOption}
                        changeView={changeView}
                        setChangeView={setChangeViewPersisted}
                        activeTab={data.activeTab}
                        isOwner={isOwner}
                        market={data.market}
                        openMarketIds={data.openMarketIds}
                        players={data.players}
                        tutorialReplay={tutorialReplay}
                        onSetSeasonId={data.setSeasonId}
                        onSelectLeagueWide={data.selectLeagueWide}
                        onNavigateTab={navigateTab}
                        onToggleMarketStatus={toggleMarketStatus}
                        onReplayTutorial={() => setTutorialReplay(true)}
                    />

                    <ForgeTabBar activeTab={data.activeTab} onNavigateTab={navigateTab} />
                    <ForgeLockBanner fuelingLocked={data.market?.fuelingLocked} coolingLocked={data.market?.coolingLocked} />

                    {data.error && (
                        <div className="text-center py-8 text-[var(--forge-loss)]">{data.error}</div>
                    )}

                    {data.activeTab === 'market' && (
                        <ForgeMarketTab
                            players={filteredPlayers}
                            allPlayers={data.players}
                            teams={teams}
                            search={search} setSearch={setSearch}
                            sortBy={sortBy} setSortBy={setSortBy}
                            teamFilter={teamFilter} setTeamFilter={setTeamFilter}
                            roleFilter={roleFilter} setRoleFilter={setRoleFilter}
                            loading={data.loading}
                            marketStatus={data.isLeagueWide ? 'open' : data.market?.status}
                            featuredPlayer={data.featuredPlayer}
                            historyData={data.historyData}
                            userTeamId={data.userTeamId}
                            isOwner={isOwner}
                            changeView={changeView}
                            freeSparksRemaining={data.freeSparksRemaining}
                            referralSparksAvailable={data.referralSparksAvailable}
                            seasonSlugs={data.selectedSeason ? { leagueSlug: data.selectedSeason.leagueSlug, divisionSlug: data.selectedSeason.divisionSlug } : null}
                            isLeagueWide={data.isLeagueWide}
                            leagueSlug={urlLeagueSlug}
                            userTeamBySeasonId={data.userTeamBySeasonId}
                            openMarketIds={data.openMarketIds}
                            fuelingLocked={data.market?.fuelingLocked}
                            coolingLocked={data.market?.coolingLocked}
                            onFuel={(p) => trade.openTrade(p, 'fuel')}
                            onCool={(p) => trade.openTrade(p, 'cool')}
                            onSelectPlayer={handleSelectPlayer}
                            onSpotlightPlayer={handleSpotlightPlayer}
                            onRandomPlayer={handleRandomPlayer}
                        />
                    )}

                    {data.activeTab === 'portfolio' && (
                        <ForgePortfolioTab
                            portfolio={data.portfolio}
                            portfolioHistories={data.portfolioHistories}
                            portfolioTimeline={data.portfolioTimeline}
                            loading={data.loading}
                            seasonSlugs={data.selectedSeason ? { leagueSlug: data.selectedSeason.leagueSlug, divisionSlug: data.selectedSeason.divisionSlug } : null}
                            isLeagueWide={data.isLeagueWide}
                            leagueSlug={urlLeagueSlug}
                            coolingLocked={data.market?.coolingLocked}
                            fuelingLocked={data.market?.fuelingLocked}
                            changeView={changeView}
                            onFuel={(sparkId, playerName, currentPrice) => trade.openTrade({ sparkId, playerName, currentPrice }, 'fuel')}
                            onCool={(sparkId, playerName, holding) => trade.openTrade({ sparkId, playerName, holding }, 'cool')}
                        />
                    )}

                    {data.activeTab === 'leaderboard' && (
                        <ForgeLeaderboardTab
                            leaderboard={data.leaderboard}
                            loading={data.loading}
                            currentUserId={user?.id}
                            seasonSlugs={data.selectedSeason ? { leagueSlug: data.selectedSeason.leagueSlug, divisionSlug: data.selectedSeason.divisionSlug } : null}
                        />
                    )}

                    {data.activeTab === 'challenges' && <ForgeChallengesTab loading={data.loading} />}
                    {data.activeTab === 'wiki' && <ForgeWikiTab />}
                </div>
            </div>

            {data.activeTab === 'market' && (
                <ForgeTutorial
                    players={data.players}
                    seasonId={data.seasonId || data.leagueSeasons[0]?.id || null}
                    marketOpen={data.isLeagueWide ? data.openMarketIds.length > 0 : data.market?.status === 'open'}
                    onTutorialFuel={trade.handleTutorialFuel}
                    onSelectFeatured={handleSelectFeatured}
                    onComplete={trade.handleTutorialComplete}
                    search={search} setSearch={setSearch}
                    filteredPlayers={filteredPlayers}
                    userTeamId={data.userTeamId}
                    userTeamBySeasonId={data.isLeagueWide ? data.userTeamBySeasonId : null}
                    isOwner={isOwner}
                    isReplay={tutorialReplay}
                    onReplayComplete={() => setTutorialReplay(false)}
                />
            )}

            {spotlightPlayer && (
                <ForgeSpotlight
                    player={spotlightPlayer}
                    pos={spotlightPos}
                    isDragging={isDraggingSpotlight}
                    dragOffset={spotlightDragOffset}
                    changeView={changeView}
                    onStartDrag={() => setIsDraggingSpotlight(true)}
                    onClose={() => setSpotlightPlayer(null)}
                    onViewProfile={() => { handleSelectPlayer(spotlightPlayer); setSpotlightPlayer(null) }}
                />
            )}

            {trade.tradeModal && (
                <ForgeTradeModal
                    player={trade.tradeModal.player}
                    mode={trade.tradeModal.mode}
                    amount={trade.tradeAmount}
                    setAmount={trade.setTradeAmount}
                    balance={balance}
                    trading={trade.trading}
                    result={trade.tradeResult}
                    error={trade.tradeError}
                    freeSparksRemaining={data.freeSparksRemaining}
                    referralSparksAvailable={data.referralSparksAvailable}
                    onExecute={trade.executeTrade}
                    onFreeFuel={trade.executeFreeFuel}
                    onReferralFuel={trade.executeReferralFuel}
                    onClose={() => trade.setTradeModal(null)}
                />
            )}
        </div>
    )
}

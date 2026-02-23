import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { usePassion } from '../context/PassionContext'
import { forgeService, leagueService } from '../services/database'
import PageTitle from '../components/PageTitle'
import Navbar from '../components/layout/Navbar'
import passionCoin from '../assets/passion/passion.png'
import { Flame, ChevronDown } from 'lucide-react'
import { getLeagueLogo } from '../utils/leagueImages'
import { getDivisionImage } from '../utils/divisionImages'

import { TABS } from './forge/forgeConstants'
import { createEmberSystem, fireBurst } from './forge/forgeCanvas'
import ForgeMarketTab from './forge/ForgeMarketTab'
import ForgePortfolioTab from './forge/ForgePortfolioTab'
import ForgeLeaderboardTab from './forge/ForgeLeaderboardTab'
import ForgeTradeModal from './forge/ForgeTradeModal'
import ForgeToast from './forge/ForgeToast'
import './forge/forge.css'

const SEASON_KEY = 'smite2_forge_season'

export default function FantasyForge() {
    const { user, login, loading: authLoading, hasPermission } = useAuth()
    const { balance, refreshBalance } = usePassion()
    const [activeTab, setActiveTab] = useState('market')
    const [loading, setLoading] = useState(true)
    const [seasonsLoaded, setSeasonsLoaded] = useState(false)
    const [initialDataLoaded, setInitialDataLoaded] = useState(false)
    const [error, setError] = useState(null)

    const isOwner = hasPermission('permission_manage')

    // Market state
    const [market, setMarket] = useState(null)
    const [players, setPlayers] = useState([])
    const [userTeamId, setUserTeamId] = useState(null)
    const [search, setSearch] = useState('')
    const [sortBy, setSortBy] = useState('price-desc')
    const [teamFilter, setTeamFilter] = useState('')

    // Portfolio state
    const [portfolio, setPortfolio] = useState(null)

    // Leaderboard state
    const [leaderboard, setLeaderboard] = useState([])

    // Trade modal state
    const [tradeModal, setTradeModal] = useState(null) // { player, mode: 'fuel'|'cool' }
    const [tradeAmount, setTradeAmount] = useState(1)
    const [trading, setTrading] = useState(false)
    const [tradeResult, setTradeResult] = useState(null)
    const [tradeError, setTradeError] = useState(null)

    // Season selection (persisted in localStorage)
    const [seasons, setSeasons] = useState([])
    const [seasonId, setSeasonIdRaw] = useState(() => {
        try { return parseInt(localStorage.getItem(SEASON_KEY)) || null }
        catch { return null }
    })
    const setSeasonId = (id) => {
        setSeasonIdRaw(id)
        if (id) localStorage.setItem(SEASON_KEY, String(id))
        else localStorage.removeItem(SEASON_KEY)
    }
    const [seasonDropdownOpen, setSeasonDropdownOpen] = useState(false)
    const seasonDropdownRef = useRef(null)

    // Forge-specific UI state
    const [featuredPlayer, setFeaturedPlayer] = useState(null)
    const [historyData, setHistoryData] = useState([])
    const [toastMessage, setToastMessage] = useState(null)

    // Canvas refs
    const bgCanvasRef = useRef(null)
    const fxCanvasRef = useRef(null)
    const flashRef = useRef(null)
    const containerRef = useRef(null)
    const emberSystemRef = useRef(null)

    // ── Canvas setup ──
    useEffect(() => {
        if (!bgCanvasRef.current) return
        const system = createEmberSystem(bgCanvasRef.current)
        system.start()
        emberSystemRef.current = system

        const handleResize = () => {
            system.resize()
            // Resize FX canvas too
            if (fxCanvasRef.current) {
                const dpr = window.devicePixelRatio || 1
                fxCanvasRef.current.width = window.innerWidth * dpr
                fxCanvasRef.current.height = window.innerHeight * dpr
            }
        }
        window.addEventListener('resize', handleResize)
        // Initial FX canvas size
        handleResize()

        return () => {
            system.stop()
            window.removeEventListener('resize', handleResize)
        }
    }, [user]) // re-init when user logs in (canvas appears)

    // ── Close season dropdown on outside click ──
    useEffect(() => {
        if (!seasonDropdownOpen) return
        const handleClick = (e) => {
            if (seasonDropdownRef.current && !seasonDropdownRef.current.contains(e.target)) setSeasonDropdownOpen(false)
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [seasonDropdownOpen])

    // ── Load seasons ──
    useEffect(() => {
        const loadSeasons = async () => {
            try {
                const [allLeagues, marketStatusData] = await Promise.all([
                    leagueService.getAll(),
                    forgeService.getMarketStatuses().catch(() => ({ statuses: {} })),
                ])
                const leagueList = Array.isArray(allLeagues) ? allLeagues : (allLeagues?.leagues || [])
                const marketStatuses = marketStatusData.statuses || {}

                const allSeasons = []
                for (const league of leagueList) {
                    const full = await leagueService.getBySlug(league.slug)
                    if (!full?.divisions) continue
                    for (const div of full.divisions) {
                        for (const season of (div.seasons || [])) {
                            const forgeStatus = marketStatuses[season.id] || null
                            allSeasons.push({
                                id: season.id,
                                name: season.name,
                                leagueName: full.name,
                                leagueSlug: full.slug,
                                divisionName: div.name,
                                divisionSlug: div.slug,
                                divisionTier: div.tier,
                                isActive: season.is_active,
                                forgeStatus,
                            })
                        }
                    }
                }

                allSeasons.sort((a, b) => {
                    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
                    return a.leagueName.localeCompare(b.leagueName) || a.divisionName.localeCompare(b.divisionName)
                })

                setSeasons(allSeasons)

                // Prefer saved season from localStorage if it still exists
                const savedId = seasonId
                if (savedId && allSeasons.find(s => s.id === savedId)) {
                    // Already set from localStorage init, keep it
                } else {
                    const active = allSeasons.find(s => s.isActive)
                    if (active) setSeasonId(active.id)
                    else if (allSeasons.length > 0) setSeasonId(allSeasons[0].id)
                }
            } catch (err) {
                console.error('Failed to load seasons:', err)
            } finally {
                setSeasonsLoaded(true)
            }
        }
        loadSeasons()
    }, [])

    // ── Load data based on active tab ──
    const loadData = useCallback(async () => {
        if (!seasonId) return
        setLoading(true)
        setError(null)

        try {
            if (activeTab === 'market') {
                const data = await forgeService.getMarket(seasonId)
                setMarket(data.market)
                setPlayers(data.players || [])
                setUserTeamId(data.userTeamId || null)
            } else if (activeTab === 'portfolio') {
                if (!user) { setLoading(false); return }
                const data = await forgeService.getPortfolio(seasonId)
                setPortfolio(data)
            } else if (activeTab === 'leaderboard') {
                const data = await forgeService.getLeaderboard(seasonId)
                setLeaderboard(data.leaderboard || [])
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
            setInitialDataLoaded(true)
        }
    }, [activeTab, seasonId, user])

    useEffect(() => { loadData() }, [loadData])

    // ── Auto-feature hottest player when market loads ──
    useEffect(() => {
        if (players.length === 0) return
        if (featuredPlayer && players.find(p => p.sparkId === featuredPlayer.sparkId)) return
        // Feature highest-priced player
        const hottest = [...players].sort((a, b) => b.currentPrice - a.currentPrice)[0]
        if (hottest) {
            setFeaturedPlayer(hottest)
            loadPlayerHistory(hottest.sparkId)
        }
    }, [players])

    // ── Load history for featured player ──
    const loadPlayerHistory = async (sparkId) => {
        try {
            const data = await forgeService.getHistory(sparkId)
            setHistoryData(data.history?.map(h => h.price) || [])
        } catch {
            setHistoryData([])
        }
    }

    // ── Visible seasons: owners see all, regular users only see open markets ──
    const visibleSeasons = useMemo(() => {
        if (isOwner) return seasons
        return seasons.filter(s => s.forgeStatus === 'open' || s.forgeStatus === null)
    }, [seasons, isOwner])

    // ── Unique teams for filter ──
    const teams = useMemo(() => {
        const map = {}
        players.forEach(p => { map[p.teamSlug] = { name: p.teamName, color: p.teamColor, slug: p.teamSlug } })
        return Object.values(map).sort((a, b) => a.name.localeCompare(b.name))
    }, [players])

    // ── Filtered + sorted players ──
    const filteredPlayers = useMemo(() => {
        let list = [...players]

        if (search.trim()) {
            const q = search.toLowerCase()
            list = list.filter(p =>
                p.playerName.toLowerCase().includes(q) ||
                p.teamName.toLowerCase().includes(q) ||
                (p.role || '').toLowerCase().includes(q)
            )
        }

        if (teamFilter) {
            list = list.filter(p => p.teamSlug === teamFilter)
        }

        const [key, dir] = sortBy.split('-')
        list.sort((a, b) => {
            let va, vb
            if (key === 'price') { va = a.currentPrice; vb = b.currentPrice }
            else if (key === 'change') { va = a.priceChange24h ?? -999; vb = b.priceChange24h ?? -999 }
            else if (key === 'sparks') { va = a.totalSparks; vb = b.totalSparks }
            else if (key === 'name') { va = a.playerName; vb = b.playerName }
            if (typeof va === 'string') return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
            return dir === 'asc' ? va - vb : vb - va
        })

        return list
    }, [players, search, teamFilter, sortBy])

    // ── Select player for hero ──
    const handleSelectPlayer = (player) => {
        setFeaturedPlayer(player)
        loadPlayerHistory(player.sparkId)
    }

    // ── Trade handlers ──
    const openTrade = (player, mode) => {
        setTradeModal({ player, mode })
        setTradeAmount(1)
        setTradeResult(null)
        setTradeError(null)
    }

    const executeTrade = async () => {
        if (!tradeModal || tradeAmount < 1) return
        setTrading(true)
        setTradeError(null)
        setTradeResult(null)

        try {
            let result
            if (tradeModal.mode === 'fuel') {
                result = await forgeService.fuel(tradeModal.player.sparkId, tradeAmount)
            } else {
                result = await forgeService.cool(tradeModal.player.sparkId, tradeAmount)
            }
            setTradeResult(result)
            refreshBalance()

            // Fire spectacle on fuel
            if (tradeModal.mode === 'fuel') {
                triggerFuelSpectacle(tradeModal.player.playerName)
            } else {
                setToastMessage(`Cooled ${tradeAmount} Spark${tradeAmount !== 1 ? 's' : ''} from ${tradeModal.player.playerName}`)
            }

            setTimeout(() => loadData(), 500)
        } catch (err) {
            setTradeError(err.message || 'Trade failed')
        } finally {
            setTrading(false)
        }
    }

    // ── Toggle market status (owner only) ──
    const toggleMarketStatus = async () => {
        if (!market || !isOwner) return
        const newStatus = market.status === 'open' ? 'closed' : 'open'
        try {
            await forgeService.toggleStatus(seasonId, newStatus)
            setMarket(prev => ({ ...prev, status: newStatus }))
            setToastMessage(`Forge market ${newStatus === 'open' ? 'opened' : 'closed'}`)
        } catch (err) {
            setToastMessage(`Failed: ${err.message}`)
        }
    }

    // ── Fuel spectacle: burst + shake + flash + toast ──
    const triggerFuelSpectacle = (playerName) => {
        // 1. Fire burst at center of screen
        if (fxCanvasRef.current) {
            const cx = window.innerWidth / 2
            const cy = window.innerHeight / 2
            fireBurst(fxCanvasRef.current, cx, cy, 40)
        }

        // 2. Screen flash
        if (flashRef.current) {
            flashRef.current.classList.add('active')
            setTimeout(() => flashRef.current?.classList.remove('active'), 150)
        }

        // 3. Screen shake
        if (containerRef.current) {
            containerRef.current.classList.add('forge-shaking')
            setTimeout(() => containerRef.current?.classList.remove('forge-shaking'), 400)
        }

        // 4. Toast
        setToastMessage(`Spark Fueled! +${tradeAmount} to ${playerName}`)
    }

    // ── Full-page loading screen while auth + seasons + initial data resolve ──
    const isInitializing = authLoading || !seasonsLoaded || (!initialDataLoaded && !!seasonId)

    if (isInitializing) {
        return (
            <div className="min-h-screen bg-(--color-primary) text-(--color-text)">
                <Navbar title="Fantasy Forge" />
                <PageTitle title="Fantasy Forge" description="Invest your Passion in players. Fuel the players you believe in." />
                <div className="flex flex-col items-center justify-center pt-48">
                    <div
                        className="w-14 h-14 forge-clip-hex flex items-center justify-center text-lg mb-4"
                        style={{
                            background: 'var(--forge-flame)',
                            boxShadow: '0 0 24px rgba(232,101,32,0.4)',
                            animation: 'forge-glow-pulse 2s ease-in-out infinite',
                        }}
                    >
                        &#9876;
                    </div>
                    <div className="forge-head text-lg font-semibold tracking-wider text-[var(--forge-text-mid)]">
                        Igniting the Forge...
                    </div>
                </div>
            </div>
        )
    }

    // ── Auth gate (only after loading is done) ──
    if (!user) {
        return (
            <div className="min-h-screen bg-(--color-primary) text-(--color-text)">
                <Navbar title="Fantasy Forge" />
                <PageTitle title="Fantasy Forge" description="Invest your Passion in players. Fuel the players you believe in." />
                <div className="max-w-lg mx-auto px-4 pt-32 text-center">
                    <Flame className="mx-auto mb-4 text-[var(--forge-flame)]" size={48} />
                    <h2 className="forge-head text-3xl font-bold tracking-wider mb-2">Fantasy Forge</h2>
                    <p className="forge-body text-[var(--forge-text-mid)] mb-6">
                        Fuel the players you believe in with your Passion. Watch their value rise with demand and performance.
                    </p>
                    <button
                        onClick={login}
                        className="forge-clip-btn forge-head text-base font-bold tracking-wider px-6 py-3 text-white transition-all hover:-translate-y-0.5"
                        style={{
                            background: 'linear-gradient(135deg, var(--forge-flame), var(--forge-ember))',
                            boxShadow: '0 4px 20px rgba(232,101,32,0.3)',
                        }}
                    >
                        Sign in to Enter the Forge
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-(--color-primary) text-(--color-text) relative overflow-hidden">
            <Navbar title="Fantasy Forge" />
            <PageTitle title="Fantasy Forge" description="Invest your Passion in players. Fuel the players you believe in." />

            {/* Background ember canvas */}
            <canvas
                ref={bgCanvasRef}
                className="fixed inset-0 w-full h-full pointer-events-none"
                style={{ zIndex: 0 }}
            />

            {/* FX burst canvas */}
            <canvas
                ref={fxCanvasRef}
                className="fixed inset-0 w-full h-full pointer-events-none"
                style={{ zIndex: 100 }}
            />

            {/* Screen flash overlay */}
            <div ref={flashRef} className="forge-flash" />

            {/* Toast */}
            <ForgeToast message={toastMessage} onDone={() => setToastMessage(null)} />

            <div ref={containerRef} className="relative" style={{ zIndex: 1 }}>
                <div className="max-w-[1300px] mx-auto px-5 pt-24 pb-20">

                    {/* Top bar: brand + passion chip */}
                    <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[var(--forge-border)] relative">
                        <div className="absolute bottom-[-1px] left-0 w-[200px] h-[2px]" style={{ background: 'linear-gradient(90deg, var(--forge-flame), transparent)' }} />
                        <div className="flex items-center gap-2.5">
                            <div
                                className="w-8 h-8 forge-clip-hex flex items-center justify-center text-sm"
                                style={{ background: 'var(--forge-flame)', boxShadow: '0 0 16px rgba(232,101,32,0.3)' }}
                            >
                                &#9876;
                            </div>
                            <div className="forge-head text-[1.6rem] font-bold tracking-wider">
                                Fantasy <span className="text-[var(--forge-flame-bright)]">Forge</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            {visibleSeasons.length > 1 && (() => {
                                const selected = visibleSeasons.find(s => s.id === seasonId)
                                const selectedLeagueLogo = selected ? getLeagueLogo(selected.leagueSlug) : null
                                const selectedDivLogo = selected ? getDivisionImage(selected.leagueSlug, selected.divisionSlug, selected.divisionTier) : null
                                return (
                                    <div className="relative" ref={seasonDropdownRef}>
                                        <button
                                            onClick={() => setSeasonDropdownOpen(!seasonDropdownOpen)}
                                            className="flex items-center gap-2 py-2 px-3 bg-[var(--forge-panel)] border border-[var(--forge-border)] text-[var(--forge-text-mid)] forge-body text-base cursor-pointer hover:border-[var(--forge-border-lt)] transition-colors whitespace-nowrap"
                                        >
                                            {selectedLeagueLogo && <img src={selectedLeagueLogo} alt="" className="w-5 h-5 object-contain" />}
                                            {selectedDivLogo && <img src={selectedDivLogo} alt="" className="w-5 h-5 object-contain" />}
                                            <span>{selected ? `${selected.leagueName} — ${selected.divisionName}` : 'Select Season'}</span>
                                            <ChevronDown size={14} className={`transition-transform ${seasonDropdownOpen ? 'rotate-180' : ''}`} />
                                        </button>
                                        {seasonDropdownOpen && (
                                            <div className="absolute top-full right-0 mt-1 min-w-[280px] bg-[var(--color-primary)] border border-[var(--forge-border)] shadow-xl z-50 max-h-[350px] overflow-y-auto">
                                                {visibleSeasons.map(s => {
                                                    const lLogo = getLeagueLogo(s.leagueSlug)
                                                    const dLogo = getDivisionImage(s.leagueSlug, s.divisionSlug, s.divisionTier)
                                                    return (
                                                        <button
                                                            key={s.id}
                                                            onClick={() => { setSeasonId(s.id); setSeasonDropdownOpen(false) }}
                                                            className={`w-full flex items-center gap-2 px-3 py-2.5 text-left forge-body text-base hover:bg-[var(--forge-surface)] transition-colors ${
                                                                seasonId === s.id ? 'text-[var(--forge-flame-bright)]' : 'text-[var(--forge-text-mid)]'
                                                            }`}
                                                        >
                                                            {lLogo && <img src={lLogo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />}
                                                            {dLogo && <img src={dLogo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />}
                                                            <span className="flex-1">{s.leagueName} — {s.divisionName}</span>
                                                            {isOwner && s.forgeStatus && s.forgeStatus !== 'open' && (
                                                                <span className={`forge-head text-[0.75rem] tracking-wider ${
                                                                    s.forgeStatus === 'closed' ? 'text-[var(--forge-loss)]' : 'text-[var(--forge-text-dim)]'
                                                                }`}>
                                                                    {s.forgeStatus === 'closed' ? 'Closed' : 'Ended'}
                                                                </span>
                                                            )}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )
                            })()}
                            <div className="flex items-center gap-2 px-4 py-1.5 forge-clip-chip" style={{ background: 'rgba(232,101,32,0.06)', border: '1px solid rgba(232,101,32,0.15)' }}>
                                <img src={passionCoin} alt="" className="w-4 h-4" />
                                <span className="forge-num text-[1.25rem] text-[var(--forge-gold-bright)]">
                                    {balance?.toLocaleString() ?? '\u2014'}
                                </span>
                            </div>
                            {market?.status === 'open' && (
                                isOwner ? (
                                    <button onClick={toggleMarketStatus} className="flex items-center gap-1.5 forge-head text-[0.85rem] font-semibold tracking-wider text-[var(--forge-gain)] cursor-pointer hover:opacity-80 transition-opacity" title="Click to close market">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--forge-gain)] shadow-[0_0_8px_var(--forge-gain)]" style={{ animation: 'forge-blink 2s infinite' }} />
                                        Open
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-1.5 forge-head text-[0.85rem] font-semibold tracking-wider text-[var(--forge-gain)]">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--forge-gain)] shadow-[0_0_8px_var(--forge-gain)]" style={{ animation: 'forge-blink 2s infinite' }} />
                                        Open
                                    </div>
                                )
                            )}
                            {market?.status === 'closed' && (
                                isOwner ? (
                                    <button onClick={toggleMarketStatus} className="forge-head text-[0.85rem] font-semibold tracking-wider text-[var(--forge-loss)] cursor-pointer hover:opacity-80 transition-opacity" title="Click to open market">
                                        Closed
                                    </button>
                                ) : (
                                    <span className="forge-head text-[0.85rem] font-semibold tracking-wider text-[var(--forge-loss)]">Closed</span>
                                )
                            )}
                            {market?.status === 'liquidated' && (
                                <span className="forge-head text-[0.85rem] font-semibold tracking-wider text-[var(--forge-text-dim)]">Season Ended</span>
                            )}
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-0 mb-4">
                        {TABS.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`px-6 py-2.5 forge-head text-lg font-semibold tracking-wider relative transition-colors ${
                                    activeTab === tab.key
                                        ? 'text-[var(--forge-flame-bright)]'
                                        : 'text-[var(--forge-text-dim)] hover:text-[var(--forge-text-mid)]'
                                }`}
                            >
                                {tab.label}
                                {activeTab === tab.key && (
                                    <span
                                        className="absolute bottom-0 left-3 right-3 h-[2px]"
                                        style={{ background: 'var(--forge-flame)', boxShadow: '0 0 10px rgba(232,101,32,0.4)' }}
                                    />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="text-center py-8 text-[var(--forge-loss)]">{error}</div>
                    )}

                    {/* Tab content */}
                    {activeTab === 'market' && (
                        <ForgeMarketTab
                            players={filteredPlayers}
                            allPlayers={players}
                            teams={teams}
                            search={search}
                            setSearch={setSearch}
                            sortBy={sortBy}
                            setSortBy={setSortBy}
                            teamFilter={teamFilter}
                            setTeamFilter={setTeamFilter}
                            loading={loading}
                            marketStatus={market?.status}
                            featuredPlayer={featuredPlayer}
                            historyData={historyData}
                            userTeamId={userTeamId}
                            isOwner={isOwner}
                            onFuel={(p) => openTrade(p, 'fuel')}
                            onCool={(p) => openTrade(p, 'cool')}
                            onSelectPlayer={handleSelectPlayer}
                        />
                    )}

                    {activeTab === 'portfolio' && (
                        <ForgePortfolioTab
                            portfolio={portfolio}
                            loading={loading}
                            onCool={(sparkId, playerName, holding) => openTrade({ sparkId, playerName, holding }, 'cool')}
                        />
                    )}

                    {activeTab === 'leaderboard' && (
                        <ForgeLeaderboardTab
                            leaderboard={leaderboard}
                            loading={loading}
                            currentUserId={user?.id}
                        />
                    )}
                </div>
            </div>

            {/* Trade Modal */}
            {tradeModal && (
                <ForgeTradeModal
                    player={tradeModal.player}
                    mode={tradeModal.mode}
                    amount={tradeAmount}
                    setAmount={setTradeAmount}
                    balance={balance}
                    trading={trading}
                    result={tradeResult}
                    error={tradeError}
                    onExecute={executeTrade}
                    onClose={() => setTradeModal(null)}
                />
            )}
        </div>
    )
}

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePassion } from '../context/PassionContext'
import { forgeService, leagueService } from '../services/database'
import PageTitle from '../components/PageTitle'
import Navbar from '../components/layout/Navbar'
import forgeLogo from '../assets/forge.png'
import { ChevronDown, RotateCcw, Flame } from 'lucide-react'
import { getLeagueLogo } from '../utils/leagueImages'
import { getDivisionImage } from '../utils/divisionImages'

import { TABS } from './forge/forgeConstants'
import { createEmberSystem, fireBurst } from './forge/forgeCanvas'
import ForgeMarketTab from './forge/ForgeMarketTab'
import ForgePortfolioTab from './forge/ForgePortfolioTab'
import ForgeLeaderboardTab from './forge/ForgeLeaderboardTab'
import ForgeChallengesTab from './forge/ForgeChallengesTab'
import ForgeTradeModal from './forge/ForgeTradeModal'
import ForgeToast from './forge/ForgeToast'
import ForgeTutorial from './forge/ForgeTutorial'
import './forge/forge.css'

const SEASON_KEY = 'smite2_forge_season'
const CHANGE_VIEW_KEY = 'smite2_forge_change_view'

export default function FantasyForge() {
    const { leagueSlug: urlLeagueSlug, divisionSlug: urlDivisionSlug } = useParams()
    const navigate = useNavigate()
    const location = useLocation()
    const { user, login, loading: authLoading, hasPermission } = useAuth()
    const { balance, refreshBalance } = usePassion()

    // Derive active tab from URL path
    const activeTab = location.pathname.endsWith('/portfolio') ? 'portfolio'
        : location.pathname.endsWith('/leaderboard') ? 'leaderboard'
        : location.pathname.endsWith('/challenges') ? 'challenges'
        : 'market'
    const [loading, setLoading] = useState(true)
    const [seasonsLoaded, setSeasonsLoaded] = useState(false)
    const [initialDataLoaded, setInitialDataLoaded] = useState(false)
    const [error, setError] = useState(null)

    const isOwner = hasPermission('permission_manage')

    // League-wide mode: has leagueSlug in URL but no divisionSlug
    const isLeagueWide = !!urlLeagueSlug && !urlDivisionSlug
    const [leagueWideId, setLeagueWideId] = useState(null)
    const [leagueOptions, setLeagueOptions] = useState([]) // [{ leagueId, leagueName, leagueSlug }]
    const [userTeamBySeasonId, setUserTeamBySeasonId] = useState({})
    const [openMarketIds, setOpenMarketIds] = useState([])

    // Change view toggle (24h vs 7d)
    const [changeView, setChangeView] = useState(() => {
        try { return localStorage.getItem(CHANGE_VIEW_KEY) || '24h' }
        catch { return '24h' }
    })
    const toggleChangeView = () => {
        const next = changeView === '24h' ? '7d' : '24h'
        setChangeView(next)
        localStorage.setItem(CHANGE_VIEW_KEY, next)
    }

    // Market state
    const [market, setMarket] = useState(null)
    const [players, setPlayers] = useState([])
    const [userTeamId, setUserTeamId] = useState(null)
    const [search, setSearch] = useState('')
    const [sortBy, setSortBy] = useState('price-desc')
    const [teamFilter, setTeamFilter] = useState('')

    // Portfolio state
    const [portfolio, setPortfolio] = useState(null)
    const [portfolioHistories, setPortfolioHistories] = useState(null)
    const [portfolioTimeline, setPortfolioTimeline] = useState(null)

    // Leaderboard state
    const [leaderboard, setLeaderboard] = useState([])

    // Trade modal state
    const [tradeModal, setTradeModal] = useState(null) // { player, mode: 'fuel'|'cool' }
    const [tradeAmount, setTradeAmount] = useState(1)
    const [trading, setTrading] = useState(false)
    const [tradeResult, setTradeResult] = useState(null)
    const [tradeError, setTradeError] = useState(null)

    // Season selection (persisted in localStorage + URL)
    const [seasons, setSeasons] = useState([])
    const [seasonId, setSeasonIdRaw] = useState(() => {
        try { return parseInt(localStorage.getItem(SEASON_KEY)) || null }
        catch { return null }
    })
    const setSeasonId = useCallback((id, allSeasons) => {
        setSeasonIdRaw(id)
        setLeagueWideId(null)
        if (id) {
            localStorage.setItem(SEASON_KEY, String(id))
            localStorage.removeItem('smite2_forge_league')
            // Update URL to match selected season, preserving tab suffix
            const list = allSeasons || seasons
            const s = list.find(s => s.id === id)
            if (s) {
                const base = `/forge/${s.leagueSlug}/${s.divisionSlug}`
                const suffix = location.pathname.endsWith('/portfolio') ? '/portfolio'
                    : location.pathname.endsWith('/leaderboard') ? '/leaderboard'
                    : ''
                navigate(base + suffix, { replace: true })
            }
        } else {
            localStorage.removeItem(SEASON_KEY)
        }
    }, [seasons, navigate, location.pathname])

    const selectLeagueWide = useCallback((leagueId, leagueSlug) => {
        setSeasonIdRaw(null)
        setLeagueWideId(leagueId)
        localStorage.removeItem(SEASON_KEY)
        localStorage.setItem('smite2_forge_league', JSON.stringify({ leagueId, leagueSlug }))
        const suffix = location.pathname.endsWith('/portfolio') ? '/portfolio'
            : location.pathname.endsWith('/leaderboard') ? '/leaderboard'
            : ''
        navigate(`/forge/${leagueSlug}${suffix}`, { replace: true })
    }, [navigate, location.pathname])
    const [seasonDropdownOpen, setSeasonDropdownOpen] = useState(false)
    const seasonDropdownRef = useRef(null)

    // Free Starter Sparks tracking
    const [freeSparksRemaining, setFreeSparksRemaining] = useState(0)
    const [referralSparksAvailable, setReferralSparksAvailable] = useState(0)

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
                setReferralSparksAvailable(1)
                setToastMessage('Forge referral claimed! You earned 1 free Referral Spark.')
            })
            .catch(() => { /* already referred or invalid code */ })
    }, [user])

    // Forge-specific UI state
    const [featuredPlayer, setFeaturedPlayer] = useState(null)
    const [historyData, setHistoryData] = useState([])
    const [toastMessage, setToastMessage] = useState(null)
    const [tutorialReplay, setTutorialReplay] = useState(false)

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

                // Fetch all league details in parallel (not sequentially)
                const fullLeagues = await Promise.all(
                    leagueList.map(league => leagueService.getBySlug(league.slug).catch(() => null))
                )

                const allSeasons = []
                const leagueMap = {}
                for (const full of fullLeagues) {
                    if (!full?.divisions) continue
                    leagueMap[full.slug] = { leagueId: full.id, leagueName: full.name, leagueSlug: full.slug }
                    for (const div of full.divisions) {
                        for (const season of (div.seasons || [])) {
                            const forgeStatus = marketStatuses[season.id] || null
                            allSeasons.push({
                                id: season.id,
                                name: season.name,
                                leagueId: full.id,
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

                // Build league-wide options: one per league that has 2+ visible divisions
                const ownerNow = hasPermission('permission_manage')
                const visible = ownerNow
                    ? allSeasons
                    : allSeasons.filter(s => s.forgeStatus === 'open' || s.forgeStatus === null)

                const leagueDivCounts = {}
                for (const s of visible) {
                    if (!leagueDivCounts[s.leagueSlug]) leagueDivCounts[s.leagueSlug] = new Set()
                    leagueDivCounts[s.leagueSlug].add(s.divisionSlug)
                }
                const leagueOpts = Object.entries(leagueDivCounts)
                    .filter(([, divs]) => divs.size > 1)
                    .map(([slug]) => leagueMap[slug])
                    .filter(Boolean)
                setLeagueOptions(leagueOpts)

                // Priority: 1) league-wide URL, 2) division URL slugs, 3) saved league, 4) saved season, 5) first visible
                const isLeagueUrl = urlLeagueSlug && !urlDivisionSlug
                const urlLeagueOpt = isLeagueUrl ? leagueOpts.find(l => l.leagueSlug === urlLeagueSlug) : null

                if (urlLeagueOpt) {
                    setLeagueWideId(urlLeagueOpt.leagueId)
                    setSeasonIdRaw(null)
                } else {
                    const urlMatch = urlLeagueSlug && urlDivisionSlug
                        ? visible.find(s => s.leagueSlug === urlLeagueSlug && s.divisionSlug === urlDivisionSlug)
                        : null
                    const savedId = seasonId
                    const savedLeague = (() => { try { return JSON.parse(localStorage.getItem('smite2_forge_league')) } catch { return null } })()
                    if (urlMatch) {
                        setSeasonId(urlMatch.id, allSeasons)
                    } else if (savedLeague && leagueOpts.find(l => l.leagueId === savedLeague.leagueId)) {
                        selectLeagueWide(savedLeague.leagueId, savedLeague.leagueSlug)
                    } else if (savedId && visible.find(s => s.id === savedId)) {
                        const saved = visible.find(s => s.id === savedId)
                        if (saved) {
                            const base = `/forge/${saved.leagueSlug}/${saved.divisionSlug}`
                            const suffix = location.pathname.endsWith('/portfolio') ? '/portfolio'
                                : location.pathname.endsWith('/leaderboard') ? '/leaderboard'
                                : ''
                            navigate(base + suffix, { replace: true })
                        }
                    } else if (visible.length > 0) {
                        setSeasonId(visible[0].id, allSeasons)
                    }
                }
            } catch (err) {
                console.error('Failed to load seasons:', err)
            } finally {
                setSeasonsLoaded(true)
            }
        }
        loadSeasons()
    }, [])

    // ── Seasons for the current league (for league-wide mode) ──
    const leagueSeasons = useMemo(() => {
        if (!leagueWideId) return []
        const visible = isOwner ? seasons : seasons.filter(s => s.forgeStatus === 'open' || s.forgeStatus === null)
        return visible.filter(s => s.leagueId === leagueWideId)
    }, [leagueWideId, seasons, isOwner])

    // ── Load data based on active tab ──
    const loadData = useCallback(async () => {
        if (!seasonId && !leagueWideId) return
        setLoading(true)
        setError(null)

        try {
            if (leagueWideId && leagueSeasons.length > 0) {
                // League-wide mode — fetch each division and merge
                if (activeTab === 'market') {
                    const results = await Promise.all(leagueSeasons.map(s => forgeService.getMarket(s.id).catch(() => null)))
                    const allPlayers = []
                    const teamBySeason = {}
                    const openMktIds = []
                    let freeRemaining = 0
                    let refAvail = 0
                    for (let i = 0; i < results.length; i++) {
                        const data = results[i]
                        if (!data) continue
                        const si = leagueSeasons[i]
                        if (data.market?.status === 'open') openMktIds.push(data.market.id)
                        if (data.userTeamId) teamBySeason[si.id] = data.userTeamId
                        freeRemaining = Math.max(freeRemaining, data.freeSparksRemaining ?? 0)
                        refAvail = Math.max(refAvail, data.referralSparksAvailable ?? 0)
                        for (const p of (data.players || [])) {
                            allPlayers.push({
                                ...p,
                                divisionName: si.divisionName,
                                divisionSlug: si.divisionSlug,
                                divisionTier: si.divisionTier,
                                seasonId: si.id,
                                marketId: data.market?.id,
                            })
                        }
                    }
                    setMarket(null)
                    setPlayers(allPlayers)
                    setUserTeamBySeasonId(teamBySeason)
                    setOpenMarketIds(openMktIds)
                    setUserTeamId(null)
                    setFreeSparksRemaining(freeRemaining)
                    setReferralSparksAvailable(refAvail)
                } else if (activeTab === 'portfolio') {
                    if (!user) { setLoading(false); return }
                    const results = await Promise.all(leagueSeasons.map(s => forgeService.getPortfolio(s.id).catch(() => null)))
                    const allHoldings = []
                    let totalValue = 0, totalInvested = 0
                    const allTransactions = []
                    for (let i = 0; i < results.length; i++) {
                        const data = results[i]
                        if (!data) continue
                        const si = leagueSeasons[i]
                        for (const h of (data.holdings || [])) {
                            allHoldings.push({ ...h, divisionName: si.divisionName, divisionSlug: si.divisionSlug })
                        }
                        if (data.stats) {
                            totalValue += data.stats.totalValue || 0
                            totalInvested += data.stats.totalInvested || 0
                        }
                        for (const t of (data.transactions || [])) allTransactions.push(t)
                    }
                    allHoldings.sort((a, b) => b.currentValue - a.currentValue)
                    allTransactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    const totalPL = totalValue - totalInvested
                    const plPct = totalInvested > 0 ? Math.round(totalPL / totalInvested * 10000) / 100 : 0
                    setPortfolio({
                        holdings: allHoldings,
                        stats: { totalValue, totalInvested, unrealizedPL: totalPL, plPercent: plPct, holdingCount: allHoldings.length },
                        transactions: allTransactions.slice(0, 20),
                    })
                    setPortfolioTimeline(null)
                    if (allHoldings.length > 0) {
                        const sparkIds = allHoldings.map(h => h.sparkId)
                        forgeService.getBatchHistory(sparkIds).then(res => {
                            setPortfolioHistories(res.histories || {})
                        }).catch(() => setPortfolioHistories({}))
                    } else {
                        setPortfolioHistories({})
                    }
                } else if (activeTab === 'leaderboard') {
                    const results = await Promise.all(leagueSeasons.map(s => forgeService.getLeaderboard(s.id).catch(() => null)))
                    const userMap = {}
                    for (const data of results) {
                        if (!data) continue
                        for (const entry of (data.leaderboard || [])) {
                            if (!userMap[entry.userId]) {
                                userMap[entry.userId] = { ...entry, totalProfit: 0, portfolioValue: 0, holdingsCount: 0, totalSparks: 0 }
                            }
                            userMap[entry.userId].totalProfit += entry.totalProfit
                            userMap[entry.userId].portfolioValue += entry.portfolioValue
                            userMap[entry.userId].holdingsCount += entry.holdingsCount
                            userMap[entry.userId].totalSparks += entry.totalSparks
                        }
                    }
                    const merged = Object.values(userMap).sort((a, b) => b.totalProfit - a.totalProfit).slice(0, 50)
                    merged.forEach((e, i) => e.position = i + 1)
                    setLeaderboard(merged)
                }
            } else {
                // Division-scoped mode
                if (activeTab === 'market') {
                    const data = await forgeService.getMarket(seasonId)
                    setMarket(data.market)
                    setPlayers(data.players || [])
                    setUserTeamId(data.userTeamId || null)
                    setFreeSparksRemaining(data.freeSparksRemaining ?? 0)
                    setReferralSparksAvailable(data.referralSparksAvailable ?? 0)
                } else if (activeTab === 'portfolio') {
                    if (!user) { setLoading(false); return }
                    const data = await forgeService.getPortfolio(seasonId)
                    setPortfolio(data)
                    const timelinePromise = forgeService.getPortfolioTimeline(seasonId).then(res => {
                        setPortfolioTimeline(res.timeline || [])
                    }).catch(() => setPortfolioTimeline([]))
                    if (data.holdings?.length > 0) {
                        const sparkIds = data.holdings.map(h => h.sparkId)
                        forgeService.getBatchHistory(sparkIds).then(res => {
                            setPortfolioHistories(res.histories || {})
                        }).catch(() => setPortfolioHistories({}))
                    } else {
                        setPortfolioHistories({})
                    }
                    await timelinePromise
                } else if (activeTab === 'leaderboard') {
                    const data = await forgeService.getLeaderboard(seasonId)
                    setLeaderboard(data.leaderboard || [])
                }
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
            setInitialDataLoaded(true)
        }
    }, [activeTab, seasonId, leagueWideId, leagueSeasons, user])

    useEffect(() => { loadData() }, [loadData])

    // ── Auto-feature a random player (not top 3) when market loads ──
    useEffect(() => {
        if (players.length === 0) return
        if (featuredPlayer && players.find(p => p.sparkId === featuredPlayer.sparkId)) return
        // Exclude top 3 by price (shown as performer cards)
        const sorted = [...players].sort((a, b) => b.currentPrice - a.currentPrice)
        const top3Ids = new Set(sorted.slice(0, 3).map(p => p.sparkId))
        const remaining = players.filter(p => !top3Ids.has(p.sparkId))
        const pool = remaining.length > 0 ? remaining : players
        const chosen = pool[Math.floor(Math.random() * pool.length)]
        if (chosen) {
            setFeaturedPlayer(chosen)
            loadPlayerHistory(chosen.sparkId)
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

    // ── Selected season info for profile links ──
    const selectedSeason = useMemo(() => visibleSeasons.find(s => s.id === seasonId), [visibleSeasons, seasonId])

    // ── Selected league option (for league-wide mode) ──
    const selectedLeagueOption = useMemo(() => leagueOptions.find(l => l.leagueId === leagueWideId), [leagueOptions, leagueWideId])

    // ── Tab navigation helper ──
    const getTabPath = useCallback((tabKey) => {
        if (isLeagueWide && selectedLeagueOption) {
            const base = `/forge/${selectedLeagueOption.leagueSlug}`
            if (tabKey === 'portfolio') return `${base}/portfolio`
            if (tabKey === 'leaderboard') return `${base}/leaderboard`
            return base
        }
        const s = selectedSeason
        if (!s) return '/forge'
        const base = `/forge/${s.leagueSlug}/${s.divisionSlug}`
        if (tabKey === 'portfolio') return `${base}/portfolio`
        if (tabKey === 'leaderboard') return `${base}/leaderboard`
        if (tabKey === 'challenges') return `${base}/challenges`
        return base
    }, [selectedSeason, isLeagueWide, selectedLeagueOption])

    const navigateTab = useCallback((tabKey) => {
        navigate(getTabPath(tabKey), { replace: true })
    }, [navigate, getTabPath])

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
            else if (key === 'change') {
                const cv = changeView === '7d' ? 'priceChange7d' : 'priceChange24h'
                va = a[cv] ?? -999; vb = b[cv] ?? -999
            }
            else if (key === 'sparks') { va = a.totalSparks; vb = b.totalSparks }
            else if (key === 'name') { va = a.playerName; vb = b.playerName }
            if (typeof va === 'string') return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
            return dir === 'asc' ? va - vb : vb - va
        })

        return list
    }, [players, search, teamFilter, sortBy, changeView])

    // ── Select player for hero (used by tutorial) ──
    const handleSelectFeatured = (player) => {
        setFeaturedPlayer(player)
        loadPlayerHistory(player.sparkId)
    }

    // ── Navigate to player detail page ──
    const handleSelectPlayer = (player) => {
        if (isLeagueWide && player.divisionSlug) {
            navigate(`/forge/${urlLeagueSlug}/${player.divisionSlug}/player/${player.playerSlug}`)
            return
        }
        if (!selectedSeason) return
        navigate(`/forge/${selectedSeason.leagueSlug}/${selectedSeason.divisionSlug}/player/${player.playerSlug}`)
    }

    // ── Random player for hero (excluding current) ──
    const handleRandomPlayer = useCallback(() => {
        if (players.length === 0) return
        const pool = players.filter(p => p.sparkId !== featuredPlayer?.sparkId)
        if (pool.length === 0) return
        const random = pool[Math.floor(Math.random() * pool.length)]
        setFeaturedPlayer(random)
        loadPlayerHistory(random.sparkId)
    }, [players, featuredPlayer])

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

    // ── Free Starter Spark fuel (from trade modal) ──
    const executeFreeFuel = async (sparkId) => {
        setTrading(true)
        setTradeError(null)
        setTradeResult(null)

        try {
            const result = await forgeService.tutorialFuel(sparkId)
            if (result.freeSparksRemaining != null) setFreeSparksRemaining(result.freeSparksRemaining)
            setTradeResult({ ...result, isFreeSpark: true })
            triggerFuelSpectacle(tradeModal.player.playerName, 1)
            setTimeout(() => loadData(), 500)
        } catch (err) {
            setTradeError(err.message || 'Failed to use Starter Spark')
        } finally {
            setTrading(false)
        }
    }

    // ── Free Referral Spark fuel (from trade modal) ──
    const executeReferralFuel = async (sparkId) => {
        setTrading(true)
        setTradeError(null)
        setTradeResult(null)

        try {
            const result = await forgeService.referralFuel(sparkId)
            setReferralSparksAvailable(prev => Math.max(0, prev - 1))
            setTradeResult({ ...result, isReferralSpark: true })
            triggerFuelSpectacle(tradeModal.player.playerName, 1)
            setTimeout(() => loadData(), 500)
        } catch (err) {
            setTradeError(err.message || 'Failed to use Referral Spark')
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
    const triggerFuelSpectacle = (playerName, sparkCount) => {
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
        const amount = sparkCount || tradeAmount
        setToastMessage(`Spark Fueled! +${amount} to ${playerName}`)
    }

    // ── Tutorial fuel handler ──
    const handleTutorialFuel = useCallback((player, result) => {
        triggerFuelSpectacle(player.playerName, result.sparks || 1)
        if (result.freeSparksRemaining != null) setFreeSparksRemaining(result.freeSparksRemaining)
        setTimeout(() => loadData(), 500)
    }, [loadData])

    // ── Tutorial complete handler ──
    const handleTutorialComplete = useCallback(() => {
        loadData()
    }, [loadData])

    // ── Full-page loading screen while auth + seasons + initial data resolve ──
    const isInitializing = authLoading || !seasonsLoaded || (!initialDataLoaded && (!!seasonId || !!leagueWideId))

    if (isInitializing) {
        return (
            <div className="min-h-screen bg-(--color-primary) text-(--color-text)">
                <Navbar title="Fantasy Forge" />
                <PageTitle title="Fantasy Forge" description="Invest your Passion in players. Fuel the players you believe in." />
                <div className="flex flex-col items-center justify-center pt-48">
                    <img
                        src={forgeLogo}
                        alt="Fantasy Forge"
                        className="w-40 h-40 object-contain forge-logo-float forge-logo-glow mb-4"
                    />
                    <div className="forge-head text-lg font-semibold tracking-wider text-[var(--forge-text-mid)]">
                        Igniting the Forge...
                    </div>
                    <div className="w-48 h-1 mt-3 rounded-full overflow-hidden bg-[var(--forge-edge)]">
                        <div className="h-full forge-shimmer rounded-full" style={{ background: 'var(--forge-flame)' }} />
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
                    <img
                        src={forgeLogo}
                        alt="Fantasy Forge"
                        className="w-48 h-48 object-contain mx-auto mb-6 forge-logo-float forge-logo-glow"
                    />
                    <h2 className="forge-head text-3xl font-bold tracking-wider mb-2">Fantasy Forge</h2>
                    <p className="forge-body text-[var(--forge-text-mid)] mb-6">
                        Fuel the players you believe in with your Passion. Watch their value rise with demand and performance.
                    </p>
                    <button
                        onClick={login}
                        className="forge-clip-btn forge-btn-fuel forge-head text-base font-bold tracking-wider px-6 py-3 text-white"
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
                {/* Slim fiery hero banner */}
                <div className="forge-banner h-44 flex items-end justify-center pb-3">
                    <div className="relative z-10 flex items-center gap-3">
                        <img
                            src={forgeLogo}
                            alt=""
                            className="w-16 h-16 object-contain"
                            style={{ filter: 'drop-shadow(0 0 10px rgba(232,101,32,0.6))' }}
                        />
                        <div className="forge-head text-2xl font-bold tracking-[0.25em] text-white" style={{ textShadow: '0 0 20px rgba(232,101,32,0.5)' }}>
                            Fantasy <span className="text-[var(--forge-flame-bright)]">Forge</span>
                        </div>
                    </div>
                </div>

                <div className="max-w-[1300px] mx-auto px-3 sm:px-5 pt-20 pb-20">

                    {/* Top bar: brand + controls */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-[var(--forge-border)] relative">
                        <div className="absolute bottom-[-1px] left-0 w-[200px] h-[2px]" style={{ background: 'linear-gradient(90deg, var(--forge-flame), transparent)' }} />
                        <div className="flex items-center gap-2.5">
                            <img
                                src={forgeLogo}
                                alt="Forge"
                                className="w-10 h-10 sm:w-18 sm:h-18 object-contain forge-logo-glow"
                            />
                            <div className="forge-head text-lg sm:text-[1.6rem] font-bold tracking-wider">
                                Fantasy <span className="text-[var(--forge-flame-bright)]">Forge</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                            {/* Season selector */}
                            {(visibleSeasons.length > 1 || leagueOptions.length > 0) && (() => {
                                const selected = isLeagueWide
                                    ? null
                                    : visibleSeasons.find(s => s.id === seasonId)
                                const selectedLeagueLogo = isLeagueWide
                                    ? getLeagueLogo(urlLeagueSlug)
                                    : (selected ? getLeagueLogo(selected.leagueSlug) : null)
                                const selectedDivLogo = selected ? getDivisionImage(selected.leagueSlug, selected.divisionSlug, selected.divisionTier) : null
                                const selectedLabel = isLeagueWide
                                    ? `${selectedLeagueOption?.leagueName || urlLeagueSlug} — All Divisions`
                                    : (selected ? `${selected.leagueName} — ${selected.divisionName}` : 'Select Season')

                                // Group seasons by league for dropdown
                                const leagueSlugsOrdered = []
                                const seasonsByLeague = {}
                                for (const s of visibleSeasons) {
                                    if (!seasonsByLeague[s.leagueSlug]) {
                                        seasonsByLeague[s.leagueSlug] = []
                                        leagueSlugsOrdered.push(s.leagueSlug)
                                    }
                                    seasonsByLeague[s.leagueSlug].push(s)
                                }

                                return (
                                    <div className="relative" ref={seasonDropdownRef}>
                                        <button
                                            onClick={() => setSeasonDropdownOpen(!seasonDropdownOpen)}
                                            className="flex items-center gap-2 py-2 px-3 bg-[var(--forge-panel)] border border-[var(--forge-border)] text-[var(--forge-text-mid)] forge-body text-base cursor-pointer hover:border-[var(--forge-border-lt)] transition-colors whitespace-nowrap"
                                        >
                                            {selectedLeagueLogo && <img src={selectedLeagueLogo} alt="" className="w-5 h-5 object-contain" />}
                                            {selectedDivLogo && <img src={selectedDivLogo} alt="" className="w-5 h-5 object-contain" />}
                                            <span>{selectedLabel}</span>
                                            <ChevronDown size={14} className={`transition-transform ${seasonDropdownOpen ? 'rotate-180' : ''}`} />
                                        </button>
                                        {seasonDropdownOpen && (
                                            <div className="absolute top-full right-0 mt-1 min-w-[280px] bg-[var(--color-primary)] border border-[var(--forge-border)] shadow-xl z-50 max-h-[350px] overflow-y-auto">
                                                {leagueSlugsOrdered.map(slug => {
                                                    const leagueSeasons = seasonsByLeague[slug]
                                                    const leagueOpt = leagueOptions.find(l => l.leagueSlug === slug)
                                                    const lLogo = getLeagueLogo(slug)
                                                    return (
                                                        <div key={slug}>
                                                            {/* League-wide "All Divisions" option */}
                                                            {leagueOpt && (
                                                                <button
                                                                    onClick={() => { selectLeagueWide(leagueOpt.leagueId, leagueOpt.leagueSlug); setSeasonDropdownOpen(false) }}
                                                                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-left forge-body text-base hover:bg-[var(--forge-surface)] transition-colors ${
                                                                        isLeagueWide && leagueWideId === leagueOpt.leagueId ? 'text-[var(--forge-flame-bright)]' : 'text-[var(--forge-text-mid)]'
                                                                    }`}
                                                                >
                                                                    {lLogo && <img src={lLogo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />}
                                                                    <Flame size={14} className="text-[var(--forge-flame)] flex-shrink-0" />
                                                                    <span className="flex-1 font-semibold">{leagueOpt.leagueName} — All Divisions</span>
                                                                </button>
                                                            )}
                                                            {/* Individual division entries */}
                                                            {leagueSeasons.map(s => {
                                                                const dLogo = getDivisionImage(s.leagueSlug, s.divisionSlug, s.divisionTier)
                                                                return (
                                                                    <button
                                                                        key={s.id}
                                                                        onClick={() => { setSeasonId(s.id); setSeasonDropdownOpen(false) }}
                                                                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-left forge-body text-base hover:bg-[var(--forge-surface)] transition-colors ${
                                                                            !isLeagueWide && seasonId === s.id ? 'text-[var(--forge-flame-bright)]' : 'text-[var(--forge-text-mid)]'
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
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )
                            })()}

                            {/* Change view toggle */}
                            <button
                                onClick={toggleChangeView}
                                className="forge-change-toggle flex items-center forge-head text-[0.85rem] font-semibold tracking-wider cursor-pointer"
                                title={`Showing ${changeView} change. Click to toggle.`}
                            >
                                <span className={`px-2.5 py-1.5 transition-all ${changeView === '24h' ? 'bg-[var(--forge-flame)]/15 text-[var(--forge-flame-bright)] border border-[var(--forge-flame)]/25' : 'bg-[var(--forge-panel)] text-[var(--forge-text-dim)] border border-[var(--forge-border)]'}`}>
                                    24H
                                </span>
                                <span className={`px-2.5 py-1.5 transition-all ${changeView === '7d' ? 'bg-[var(--forge-flame)]/15 text-[var(--forge-flame-bright)] border border-[var(--forge-flame)]/25' : 'bg-[var(--forge-panel)] text-[var(--forge-text-dim)] border border-[var(--forge-border)]'}`}>
                                    7D
                                </span>
                            </button>

                            {/* Replay tutorial (only on market tab) */}
                            {activeTab === 'market' && !tutorialReplay && (
                                <button
                                    onClick={() => setTutorialReplay(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-[var(--forge-text-dim)] hover:text-[var(--forge-flame-bright)] hover:bg-[var(--forge-flame)]/8 border border-transparent hover:border-[var(--forge-flame)]/20 transition-all forge-head text-[0.75rem] tracking-wider"
                                    title="Replay tutorial"
                                >
                                    <RotateCcw size={13} />
                                    Tutorial
                                </button>
                            )}

                            {/* Market status */}
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
                        {TABS.filter(tab => !isLeagueWide || tab.key !== 'challenges').map(tab => {
                            const Icon = tab.icon
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => navigateTab(tab.key)}
                                    className={`flex-1 sm:flex-none px-2 sm:px-6 py-2.5 forge-head text-xs sm:text-lg font-semibold tracking-wider relative transition-all flex items-center justify-center sm:justify-start gap-1.5 ${
                                        activeTab === tab.key
                                            ? 'text-[var(--forge-flame-bright)] forge-tab-active'
                                            : 'text-[var(--forge-text-dim)] hover:text-[var(--forge-text-mid)] hover:bg-[var(--forge-flame)]/3'
                                    }`}
                                >
                                    <Icon size={16} className="sm:hidden flex-shrink-0" />
                                    <span className="hidden sm:inline">{tab.label}</span>
                                    <span className="sm:hidden">{tab.key === 'market' ? 'Forge' : tab.key === 'portfolio' ? 'Sparks' : tab.key === 'leaderboard' ? 'Flame' : 'Contracts'}</span>
                                    {activeTab === tab.key && (
                                        <span
                                            className="absolute bottom-0 left-2 right-2 sm:left-3 sm:right-3 h-[2px] forge-tab-underline"
                                            style={{ background: 'var(--forge-flame)', boxShadow: '0 0 10px rgba(232,101,32,0.4)' }}
                                        />
                                    )}
                                </button>
                            )
                        })}
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
                            marketStatus={isLeagueWide ? 'open' : market?.status}
                            featuredPlayer={featuredPlayer}
                            historyData={historyData}
                            userTeamId={userTeamId}
                            isOwner={isOwner}
                            changeView={changeView}
                            freeSparksRemaining={freeSparksRemaining}
                            referralSparksAvailable={referralSparksAvailable}
                            seasonSlugs={selectedSeason ? { leagueSlug: selectedSeason.leagueSlug, divisionSlug: selectedSeason.divisionSlug } : null}
                            isLeagueWide={isLeagueWide}
                            leagueSlug={urlLeagueSlug}
                            userTeamBySeasonId={userTeamBySeasonId}
                            openMarketIds={openMarketIds}
                            onFuel={(p) => openTrade(p, 'fuel')}
                            onCool={(p) => openTrade(p, 'cool')}
                            onSelectPlayer={handleSelectPlayer}
                            onRandomPlayer={handleRandomPlayer}
                        />
                    )}

                    {activeTab === 'portfolio' && (
                        <ForgePortfolioTab
                            portfolio={portfolio}
                            portfolioHistories={portfolioHistories}
                            portfolioTimeline={portfolioTimeline}
                            loading={loading}
                            seasonSlugs={selectedSeason ? { leagueSlug: selectedSeason.leagueSlug, divisionSlug: selectedSeason.divisionSlug } : null}
                            isLeagueWide={isLeagueWide}
                            leagueSlug={urlLeagueSlug}
                            onCool={(sparkId, playerName, holding) => openTrade({ sparkId, playerName, holding }, 'cool')}
                        />
                    )}

                    {activeTab === 'leaderboard' && (
                        <ForgeLeaderboardTab
                            leaderboard={leaderboard}
                            loading={loading}
                            currentUserId={user?.id}
                            seasonSlugs={selectedSeason ? { leagueSlug: selectedSeason.leagueSlug, divisionSlug: selectedSeason.divisionSlug } : null}
                        />
                    )}

                    {!isLeagueWide && activeTab === 'challenges' && (
                        <ForgeChallengesTab loading={loading} />
                    )}
                </div>
            </div>

            {/* Tutorial */}
            {activeTab === 'market' && (
                <ForgeTutorial
                    players={players}
                    seasonId={seasonId}
                    marketOpen={market?.status === 'open'}
                    onTutorialFuel={handleTutorialFuel}
                    onSelectFeatured={handleSelectFeatured}
                    onComplete={handleTutorialComplete}
                    search={search}
                    setSearch={setSearch}
                    filteredPlayers={filteredPlayers}
                    userTeamId={userTeamId}
                    isOwner={isOwner}
                    isReplay={tutorialReplay}
                    onReplayComplete={() => setTutorialReplay(false)}
                />
            )}

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
                    freeSparksRemaining={freeSparksRemaining}
                    referralSparksAvailable={referralSparksAvailable}
                    onExecute={executeTrade}
                    onFreeFuel={executeFreeFuel}
                    onReferralFuel={executeReferralFuel}
                    onClose={() => setTradeModal(null)}
                />
            )}
        </div>
    )
}

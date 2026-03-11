import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { forgeService, leagueService } from '../../services/database'

const SEASON_KEY = 'smite2_forge_season'

export default function useForgeData({ urlLeagueSlug, urlDivisionSlug, user }) {
    const navigate = useNavigate()
    const location = useLocation()

    const [loading, setLoading] = useState(true)
    const [seasonsLoaded, setSeasonsLoaded] = useState(false)
    const [initialDataLoaded, setInitialDataLoaded] = useState(false)
    const [error, setError] = useState(null)

    // League-wide mode
    const isLeagueWide = !!urlLeagueSlug && !urlDivisionSlug
    const [leagueWideId, setLeagueWideId] = useState(null)
    const [leagueOptions, setLeagueOptions] = useState([])
    const [userTeamBySeasonId, setUserTeamBySeasonId] = useState({})
    const [openMarketIds, setOpenMarketIds] = useState([])

    // Market state
    const [market, setMarket] = useState(null)
    const [players, setPlayers] = useState([])
    const [userTeamId, setUserTeamId] = useState(null)

    // Portfolio state
    const [portfolio, setPortfolio] = useState(null)
    const [portfolioHistories, setPortfolioHistories] = useState(null)
    const [portfolioTimeline, setPortfolioTimeline] = useState(null)

    // Leaderboard state
    const [leaderboard, setLeaderboard] = useState([])

    // Season selection
    const [seasons, setSeasons] = useState([])
    const [seasonId, setSeasonIdRaw] = useState(() => {
        try { return parseInt(localStorage.getItem(SEASON_KEY)) || null }
        catch { return null }
    })

    // Free Starter Sparks
    const [freeSparksRemaining, setFreeSparksRemaining] = useState(0)
    const [referralSparksAvailable, setReferralSparksAvailable] = useState(0)

    // Featured player
    const [featuredPlayer, setFeaturedPlayer] = useState(null)
    const [historyData, setHistoryData] = useState([])

    // Derive active tab from URL
    const activeTab = location.pathname.endsWith('/portfolio') ? 'portfolio'
        : location.pathname.endsWith('/leaderboard') ? 'leaderboard'
        : location.pathname.endsWith('/challenges') ? 'challenges'
        : location.pathname.endsWith('/wiki') ? 'wiki'
        : 'market'

    const setSeasonId = useCallback((id, allSeasons) => {
        setSeasonIdRaw(id)
        setLeagueWideId(null)
        if (id) {
            localStorage.setItem(SEASON_KEY, String(id))
            localStorage.removeItem('smite2_forge_league')
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

    // Visible seasons (open markets only)
    const visibleSeasons = useMemo(() => {
        return seasons.filter(s => s.forgeStatus === 'open')
    }, [seasons])

    const selectedSeason = useMemo(() => visibleSeasons.find(s => s.id === seasonId), [visibleSeasons, seasonId])
    const selectedLeagueOption = useMemo(() => leagueOptions.find(l => l.leagueId === leagueWideId), [leagueOptions, leagueWideId])

    // Seasons for current league (league-wide mode)
    const leagueSeasons = useMemo(() => {
        if (!leagueWideId) return []
        return seasons.filter(s => s.leagueId === leagueWideId && s.forgeStatus === 'open')
    }, [leagueWideId, seasons])

    // Load seasons
    useEffect(() => {
        const loadSeasons = async () => {
            try {
                const [allLeagues, marketStatusData] = await Promise.all([
                    leagueService.getAll(),
                    forgeService.getMarketStatuses().catch(() => ({ statuses: {} })),
                ])
                const leagueList = Array.isArray(allLeagues) ? allLeagues : (allLeagues?.leagues || [])
                const marketStatuses = marketStatusData.statuses || {}

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
                    const statusOrder = s => s.forgeStatus === 'open' ? 0 : s.forgeStatus === 'closed' ? 1 : 2
                    const so = statusOrder(a) - statusOrder(b)
                    if (so !== 0) return so
                    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
                    return a.leagueName.localeCompare(b.leagueName) || a.divisionName.localeCompare(b.divisionName)
                })

                setSeasons(allSeasons)

                const visible = allSeasons.filter(s => s.forgeStatus === 'open')
                const leagueDivCounts = {}
                const leagueHasOpen = {}
                for (const s of visible) {
                    if (!leagueDivCounts[s.leagueSlug]) leagueDivCounts[s.leagueSlug] = new Set()
                    leagueDivCounts[s.leagueSlug].add(s.divisionSlug)
                    if (s.forgeStatus === 'open') leagueHasOpen[s.leagueSlug] = true
                }
                const leagueOpts = Object.entries(leagueDivCounts)
                    .filter(([slug, divs]) => divs.size > 1 && leagueHasOpen[slug])
                    .map(([slug]) => leagueMap[slug])
                    .filter(Boolean)
                    .sort((a, b) => (leagueHasOpen[b.leagueSlug] ? 1 : 0) - (leagueHasOpen[a.leagueSlug] ? 1 : 0))
                setLeagueOptions(leagueOpts)

                const isLeagueUrl = urlLeagueSlug && !urlDivisionSlug
                const urlLeagueOpt = isLeagueUrl ? leagueOpts.find(l => l.leagueSlug === urlLeagueSlug) : null

                if (urlLeagueOpt) {
                    setLeagueWideId(urlLeagueOpt.leagueId)
                    setSeasonIdRaw(null)
                } else {
                    const urlMatch = urlLeagueSlug && urlDivisionSlug
                        ? visible.find(s => s.leagueSlug === urlLeagueSlug && s.divisionSlug === urlDivisionSlug)
                        : null
                    if (urlMatch) {
                        setSeasonId(urlMatch.id, allSeasons)
                    } else if (leagueOpts.length > 0) {
                        selectLeagueWide(leagueOpts[0].leagueId, leagueOpts[0].leagueSlug)
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

    // Track what we last loaded
    const lastLoadRef = useRef({ tab: null, seasonId: null, leagueWideId: null })

    // Load data based on active tab
    const loadData = useCallback(async () => {
        if (!seasonId && !leagueWideId) return

        const prev = lastLoadRef.current
        const hardChange = prev.tab !== activeTab || prev.seasonId !== seasonId || prev.leagueWideId !== leagueWideId
        lastLoadRef.current = { tab: activeTab, seasonId, leagueWideId }
        if (hardChange) setLoading(true)
        setError(null)

        try {
            if (leagueWideId && leagueSeasons.length > 0) {
                await loadLeagueWideData(activeTab, leagueSeasons)
            } else {
                await loadDivisionData(activeTab, seasonId)
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
            setInitialDataLoaded(true)
        }
    }, [activeTab, seasonId, leagueWideId, leagueSeasons, user])

    // League-wide data loading
    const loadLeagueWideData = async (tab, lgSeasons) => {
        if (tab === 'market') {
            const results = await Promise.all(lgSeasons.map(s => forgeService.getMarket(s.id).catch(() => null)))
            const allPlayers = []
            const teamBySeason = {}
            const openMktIds = []
            let freeRemaining = 0
            let refAvail = 0
            let lockFlags = null
            for (let i = 0; i < results.length; i++) {
                const data = results[i]
                if (!data) continue
                const si = lgSeasons[i]
                if (data.market?.status === 'open') openMktIds.push(data.market.id)
                if (data.userTeamId) teamBySeason[si.id] = data.userTeamId
                freeRemaining = Math.max(freeRemaining, data.freeSparksRemaining ?? 0)
                refAvail = Math.max(refAvail, data.referralSparksAvailable ?? 0)
                if (!lockFlags && data.market) lockFlags = { fuelingLocked: data.market.fuelingLocked, coolingLocked: data.market.coolingLocked }
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
            setMarket(lockFlags)
            setPlayers(prev => {
                const prevHist = {}
                for (const p of prev) if (p.historyData) prevHist[p.sparkId] = p.historyData
                return allPlayers.map(p => ({ ...p, historyData: prevHist[p.sparkId] }))
            })
            setUserTeamBySeasonId(teamBySeason)
            setOpenMarketIds(openMktIds)
            setUserTeamId(null)
            setFreeSparksRemaining(freeRemaining)
            setReferralSparksAvailable(refAvail)
            if (allPlayers.length > 0) {
                const ids = allPlayers.map(p => p.sparkId)
                const chunks = []
                for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50))
                Promise.all(chunks.map(c => forgeService.getBatchHistory(c).catch(() => ({ histories: {} })))).then(results => {
                    const hist = {}
                    for (const r of results) Object.assign(hist, r.histories || {})
                    setPlayers(prev => prev.map(p => ({
                        ...p,
                        historyData: (hist[p.sparkId] || []).map(h => h.price),
                    })))
                })
            }
        } else if (tab === 'portfolio') {
            if (!user) { setLoading(false); return }
            const [portfolioResults, marketResults] = await Promise.all([
                Promise.all(lgSeasons.map(s => forgeService.getPortfolio(s.id).catch(() => null))),
                Promise.all(lgSeasons.map(s => forgeService.getMarket(s.id).catch(() => null))),
            ])
            let freeRemaining = 0, refAvail = 0
            for (const data of marketResults) {
                if (!data) continue
                freeRemaining = Math.max(freeRemaining, data.freeSparksRemaining ?? 0)
                refAvail = Math.max(refAvail, data.referralSparksAvailable ?? 0)
            }
            setFreeSparksRemaining(freeRemaining)
            setReferralSparksAvailable(refAvail)
            const results = portfolioResults
            const allHoldings = []
            let totalValue = 0, totalInvested = 0, totalRealized = 0
            const allTransactions = []
            for (let i = 0; i < results.length; i++) {
                const data = results[i]
                if (!data) continue
                const si = lgSeasons[i]
                for (const h of (data.holdings || [])) {
                    allHoldings.push({ ...h, divisionName: si.divisionName, divisionSlug: si.divisionSlug })
                }
                if (data.stats) {
                    totalValue += data.stats.totalValue || 0
                    totalInvested += data.stats.totalInvested || 0
                    totalRealized += data.stats.realizedProfit || 0
                }
                for (const t of (data.transactions || [])) allTransactions.push(t)
            }
            allHoldings.sort((a, b) => b.currentValue - a.currentValue)
            allTransactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            const unrealizedPL = totalValue - totalInvested
            const totalProfit = unrealizedPL + totalRealized
            const plPct = totalInvested > 0 ? Math.round(totalProfit / totalInvested * 10000) / 100 : 0
            setPortfolio({
                holdings: allHoldings,
                stats: { totalValue, totalInvested, realizedProfit: totalRealized, totalProfit, plPercent: plPct, holdingCount: allHoldings.length },
                transactions: allTransactions.slice(0, 20),
            })
            setPortfolioTimeline(null)
            if (allHoldings.length > 0) {
                const sparkIds = allHoldings.map(h => h.sparkId)
                forgeService.getBatchHistory(sparkIds).then(res => {
                    setPortfolioHistories(res.histories || {})
                }).catch(() => setPortfolioHistories({}))

                const timelineResults = await Promise.all(
                    lgSeasons.map(s =>
                        forgeService.getPortfolioTimeline(s.id)
                            .then(res => ({ seasonId: s.id, timeline: res.timeline || [] }))
                            .catch(() => ({ seasonId: s.id, timeline: [] }))
                    )
                )
                const allEvents = []
                for (const { seasonId, timeline } of timelineResults) {
                    for (const point of timeline) {
                        allEvents.push({ ...point, seasonId })
                    }
                }
                allEvents.sort((a, b) => new Date(a.t) - new Date(b.t))
                const latestWorth = {}
                const latestBasis = {}
                const merged = []
                for (const ev of allEvents) {
                    latestWorth[ev.seasonId] = ev.worth
                    latestBasis[ev.seasonId] = ev.basis
                    const totalWorth = Object.values(latestWorth).reduce((s, v) => s + v, 0)
                    const totalBasis = Object.values(latestBasis).reduce((s, v) => s + v, 0)
                    merged.push({ t: ev.t, worth: totalWorth, basis: totalBasis, trigger: ev.trigger, playerName: ev.playerName })
                }
                setPortfolioTimeline(merged)
            } else {
                setPortfolioHistories({})
                setPortfolioTimeline([])
            }
        } else if (tab === 'leaderboard') {
            const results = await Promise.all(lgSeasons.map(s => forgeService.getLeaderboard(s.id).catch(() => null)))
            const userMap = {}
            for (const data of results) {
                if (!data) continue
                for (const entry of (data.leaderboard || [])) {
                    if (!userMap[entry.userId]) {
                        userMap[entry.userId] = { ...entry, totalProfit: 0, portfolioValue: 0, holdingsCount: 0, totalSparks: 0, realizedProfit: 0 }
                    }
                    userMap[entry.userId].totalProfit += entry.totalProfit
                    userMap[entry.userId].realizedProfit += entry.realizedProfit ?? 0
                    userMap[entry.userId].portfolioValue += entry.portfolioValue
                    userMap[entry.userId].holdingsCount += entry.holdingsCount
                    userMap[entry.userId].totalSparks += entry.totalSparks
                }
            }
            const merged = Object.values(userMap).sort((a, b) => b.totalProfit - a.totalProfit)
            merged.forEach((e, i) => e.position = i + 1)
            setLeaderboard(merged)
        }
    }

    // Division-scoped data loading
    const loadDivisionData = async (tab, sid) => {
        if (tab === 'market') {
            const data = await forgeService.getMarket(sid)
            setMarket(data.market)
            const marketPlayers = data.players || []
            setPlayers(prev => {
                const prevHist = {}
                for (const p of prev) if (p.historyData) prevHist[p.sparkId] = p.historyData
                return marketPlayers.map(p => ({ ...p, historyData: prevHist[p.sparkId] }))
            })
            setUserTeamId(data.userTeamId || null)
            setFreeSparksRemaining(data.freeSparksRemaining ?? 0)
            setReferralSparksAvailable(data.referralSparksAvailable ?? 0)
            if (marketPlayers.length > 0) {
                const ids = marketPlayers.map(p => p.sparkId)
                const chunks = []
                for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50))
                Promise.all(chunks.map(c => forgeService.getBatchHistory(c).catch(() => ({ histories: {} })))).then(results => {
                    const hist = {}
                    for (const r of results) Object.assign(hist, r.histories || {})
                    setPlayers(prev => prev.map(p => ({
                        ...p,
                        historyData: (hist[p.sparkId] || []).map(h => h.price),
                    })))
                })
            }
        } else if (tab === 'portfolio') {
            if (!user) { setLoading(false); return }
            const [data, marketData] = await Promise.all([
                forgeService.getPortfolio(sid),
                forgeService.getMarket(sid).catch(() => null),
            ])
            if (marketData) {
                setFreeSparksRemaining(marketData.freeSparksRemaining ?? 0)
                setReferralSparksAvailable(marketData.referralSparksAvailable ?? 0)
            }
            setPortfolio(data)
            const timelinePromise = forgeService.getPortfolioTimeline(sid).then(res => {
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
        } else if (tab === 'leaderboard') {
            const data = await forgeService.getLeaderboard(sid)
            setLeaderboard(data.leaderboard || [])
        }
    }

    useEffect(() => { loadData() }, [loadData])

    // Auto-feature a random player when market loads
    useEffect(() => {
        if (players.length === 0) return
        if (featuredPlayer && players.find(p => p.sparkId === featuredPlayer.sparkId)) return
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

    const loadPlayerHistory = async (sparkId) => {
        try {
            const data = await forgeService.getHistory(sparkId)
            setHistoryData(data.history?.map(h => h.price) || [])
        } catch {
            setHistoryData([])
        }
    }

    return {
        // Loading/error
        loading, seasonsLoaded, initialDataLoaded, error,
        // Season
        seasons, seasonId, setSeasonId, activeTab,
        visibleSeasons, selectedSeason, selectedLeagueOption,
        // League-wide
        isLeagueWide, leagueWideId, leagueOptions, leagueSeasons,
        selectLeagueWide,
        userTeamBySeasonId, openMarketIds,
        // Market
        market, setMarket, players, setPlayers, userTeamId,
        // Portfolio
        portfolio, portfolioHistories, portfolioTimeline,
        // Leaderboard
        leaderboard,
        // Sparks
        freeSparksRemaining, setFreeSparksRemaining,
        referralSparksAvailable, setReferralSparksAvailable,
        // Featured player
        featuredPlayer, setFeaturedPlayer, historyData, loadPlayerHistory,
        // Actions
        loadData,
    }
}

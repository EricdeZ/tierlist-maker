import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { usePassion } from '../context/PassionContext'
import { forgeService, leagueService } from '../services/database'
import PageTitle from '../components/PageTitle'
import Navbar from '../components/layout/Navbar'
import TeamLogo from '../components/TeamLogo'
import RankBadge from '../components/RankBadge'
import passionCoin from '../assets/passion/passion.png'
import { getRank } from '../config/ranks'
import {
    Flame, Snowflake, TrendingUp, TrendingDown, Search,
    ChevronDown, ChevronUp, Wallet, Trophy, ArrowUpRight,
    ArrowDownRight, Minus, X, Zap, BarChart3,
} from 'lucide-react'

const TABS = [
    { key: 'market', label: 'The Forge', icon: Flame },
    { key: 'portfolio', label: 'My Sparks', icon: Zap },
    { key: 'leaderboard', label: 'Leaderboard', icon: Trophy },
]

const SORT_OPTIONS = [
    { key: 'price-desc', label: 'Highest Value' },
    { key: 'price-asc', label: 'Lowest Value' },
    { key: 'change-desc', label: 'Biggest Gainers' },
    { key: 'change-asc', label: 'Biggest Losers' },
    { key: 'sparks-desc', label: 'Most Popular' },
    { key: 'name-asc', label: 'Name (A-Z)' },
]

// ═══════════════════════════════════════════════════
// Main page component
// ═══════════════════════════════════════════════════
export default function FantasyForge() {
    const { user, login } = useAuth()
    const { balance, refreshBalance } = usePassion()
    const [activeTab, setActiveTab] = useState('market')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    // Market state
    const [market, setMarket] = useState(null)
    const [players, setPlayers] = useState([])
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

    // Season selection
    const [seasons, setSeasons] = useState([]) // { id, name, leagueName, divisionName, isActive }
    const [seasonId, setSeasonId] = useState(null)

    // Load all leagues → divisions → seasons
    useEffect(() => {
        const loadSeasons = async () => {
            try {
                const allLeagues = await leagueService.getAll()
                const leagueList = Array.isArray(allLeagues) ? allLeagues : (allLeagues?.leagues || [])

                const allSeasons = []
                for (const league of leagueList) {
                    const full = await leagueService.getBySlug(league.slug)
                    if (!full?.divisions) continue
                    for (const div of full.divisions) {
                        for (const season of (div.seasons || [])) {
                            allSeasons.push({
                                id: season.id,
                                name: season.name,
                                leagueName: full.name,
                                divisionName: div.name,
                                isActive: season.is_active,
                            })
                        }
                    }
                }

                // Sort: active first, then by name
                allSeasons.sort((a, b) => {
                    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
                    return a.leagueName.localeCompare(b.leagueName) || a.divisionName.localeCompare(b.divisionName)
                })

                setSeasons(allSeasons)

                // Default to first active season
                const active = allSeasons.find(s => s.isActive)
                if (active) setSeasonId(active.id)
                else if (allSeasons.length > 0) setSeasonId(allSeasons[0].id)
            } catch (err) {
                console.error('Failed to load seasons:', err)
            } finally {
                setLoading(false)
            }
        }
        loadSeasons()
    }, [])

    // Load data based on active tab
    const loadData = useCallback(async () => {
        if (!seasonId) return
        setLoading(true)
        setError(null)

        try {
            if (activeTab === 'market') {
                const data = await forgeService.getMarket(seasonId)
                setMarket(data.market)
                setPlayers(data.players || [])
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
        }
    }, [activeTab, seasonId, user])

    useEffect(() => { loadData() }, [loadData])

    // Unique teams for filter
    const teams = useMemo(() => {
        const map = {}
        players.forEach(p => { map[p.teamSlug] = { name: p.teamName, color: p.teamColor, slug: p.teamSlug } })
        return Object.values(map).sort((a, b) => a.name.localeCompare(b.name))
    }, [players])

    // Filtered + sorted players
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

    // Trade handlers
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
            // Refresh market data
            setTimeout(() => loadData(), 500)
        } catch (err) {
            setTradeError(err.message || 'Trade failed')
        } finally {
            setTrading(false)
        }
    }

    // Auth gate
    if (!user) {
        return (
            <div className="min-h-screen bg-(--color-primary) text-(--color-text)">
                <Navbar title="Fantasy Forge" />
                <PageTitle title="Fantasy Forge" description="Invest your Passion in players. Fuel the players you believe in." />
                <div className="max-w-lg mx-auto px-4 pt-32 text-center">
                    <Flame className="mx-auto mb-4 text-amber-400" size={48} />
                    <h2 className="text-2xl font-bold font-heading mb-2">Fantasy Forge</h2>
                    <p className="text-(--color-text-secondary)/60 mb-6">
                        Fuel the players you believe in with your Passion. Watch their value rise with demand and performance.
                    </p>
                    <button onClick={login}
                        className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg transition-colors">
                        Sign in to Enter the Forge
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-(--color-primary) text-(--color-text)">
            <Navbar title="Fantasy Forge" />
            <PageTitle title="Fantasy Forge" description="Invest your Passion in players. Fuel the players you believe in." />

            <div className="max-w-6xl mx-auto px-4 pt-24 pb-8">

                {/* Header */}
                <div className="text-center mb-6">
                    <h1 className="text-3xl sm:text-4xl font-bold font-heading flex items-center justify-center gap-2">
                        <Flame className="text-amber-400" size={32} />
                        Fantasy Forge
                    </h1>
                    <p className="text-sm text-(--color-text-secondary)/60 mt-1">
                        Fuel the players you believe in. Cool when the time is right.
                    </p>
                </div>

                {/* Season selector + Balance bar */}
                <div className="flex items-center justify-center gap-4 mb-6 flex-wrap">
                    {seasons.length > 1 && (
                        <select
                            value={seasonId || ''}
                            onChange={e => setSeasonId(Number(e.target.value))}
                            className="px-3 py-2 rounded-lg bg-(--color-secondary)/50 border border-(--color-border)/30 text-sm focus:outline-none focus:border-amber-500/50"
                        >
                            {seasons.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.leagueName} — {s.divisionName} — {s.name}{s.isActive ? ' (Active)' : ''}
                                </option>
                            ))}
                        </select>
                    )}
                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-(--color-secondary)/50 border border-amber-500/20">
                        <img src={passionCoin} alt="" className="w-5 h-5" />
                        <span className="font-bold text-amber-400">{balance?.toLocaleString() ?? '—'}</span>
                        <span className="text-xs text-(--color-text-secondary)/50">available</span>
                    </div>
                    {market?.status === 'closed' && (
                        <span className="px-3 py-1 text-xs font-bold rounded bg-red-500/20 text-red-400 border border-red-500/30">
                            Market Closed
                        </span>
                    )}
                    {market?.status === 'liquidated' && (
                        <span className="px-3 py-1 text-xs font-bold rounded bg-gray-500/20 text-gray-400 border border-gray-500/30">
                            Season Ended
                        </span>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex justify-center gap-1 mb-6">
                    {TABS.map(tab => (
                        <button key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                activeTab === tab.key
                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                    : 'text-(--color-text-secondary)/60 hover:text-(--color-text) hover:bg-(--color-secondary)/30'
                            }`}>
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                {error && (
                    <div className="text-center py-8 text-red-400">{error}</div>
                )}

                {activeTab === 'market' && (
                    <MarketTab
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
                        onFuel={(p) => openTrade(p, 'fuel')}
                        onCool={(p) => openTrade(p, 'cool')}
                    />
                )}

                {activeTab === 'portfolio' && (
                    <PortfolioTab
                        portfolio={portfolio}
                        loading={loading}
                        onCool={(sparkId, playerName, holding) => openTrade({ sparkId, playerName, holding }, 'cool')}
                    />
                )}

                {activeTab === 'leaderboard' && (
                    <LeaderboardTab
                        leaderboard={leaderboard}
                        loading={loading}
                        currentUserId={user?.id}
                    />
                )}
            </div>

            {/* Trade Modal */}
            {tradeModal && (
                <TradeModal
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


// ═══════════════════════════════════════════════════
// Market Tab
// ═══════════════════════════════════════════════════
function MarketTab({ players, allPlayers, teams, search, setSearch, sortBy, setSortBy, teamFilter, setTeamFilter, loading, marketStatus, onFuel, onCool }) {
    if (loading) {
        return <div className="text-center py-12 text-(--color-text-secondary)/40">Loading the Forge...</div>
    }

    if (allPlayers.length === 0) {
        return <div className="text-center py-12 text-(--color-text-secondary)/40">No active market found for this season.</div>
    }

    return (
        <div>
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-4">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-secondary)/40" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search players, teams, roles..."
                        className="w-full pl-9 pr-3 py-2 rounded-lg bg-(--color-secondary)/50 border border-(--color-border)/30 text-sm focus:outline-none focus:border-amber-500/50"
                    />
                </div>

                <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-(--color-secondary)/50 border border-(--color-border)/30 text-sm">
                    <option value="">All Teams</option>
                    {teams.map(t => (
                        <option key={t.slug} value={t.slug}>{t.name}</option>
                    ))}
                </select>

                <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-(--color-secondary)/50 border border-(--color-border)/30 text-sm">
                    {SORT_OPTIONS.map(o => (
                        <option key={o.key} value={o.key}>{o.label}</option>
                    ))}
                </select>
            </div>

            {/* Player Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {players.map(p => (
                    <PlayerCard key={p.sparkId} player={p} marketStatus={marketStatus} onFuel={onFuel} onCool={onCool} />
                ))}
            </div>

            {players.length === 0 && (
                <div className="text-center py-8 text-(--color-text-secondary)/40">No players match your search.</div>
            )}
        </div>
    )
}


// ═══════════════════════════════════════════════════
// Player Card
// ═══════════════════════════════════════════════════
function PlayerCard({ player: p, marketStatus, onFuel, onCool }) {
    const isOpen = marketStatus === 'open'
    const change = p.priceChange24h
    const isUp = change > 0
    const isDown = change < 0

    return (
        <div className="rounded-xl bg-(--color-secondary)/40 border border-(--color-border)/20 p-4 hover:border-amber-500/30 transition-all">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                    <TeamLogo slug={p.teamSlug} name={p.teamName} size={28} />
                    <div className="min-w-0">
                        <div className="font-bold text-sm truncate">{p.playerName}</div>
                        <div className="flex items-center gap-1.5 text-xs text-(--color-text-secondary)/50">
                            <span style={{ color: p.teamColor }}>{p.teamName}</span>
                            {p.role && <span className="opacity-60">· {p.role}</span>}
                        </div>
                    </div>
                </div>
                {p.perfMultiplier !== 1.0 && (
                    <div className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        p.perfMultiplier > 1.0 ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
                    }`}>
                        {p.perfMultiplier > 1.0 ? '+' : ''}{((p.perfMultiplier - 1) * 100).toFixed(0)}%
                    </div>
                )}
            </div>

            {/* Price */}
            <div className="flex items-end justify-between mb-3">
                <div>
                    <div className="flex items-center gap-1.5">
                        <img src={passionCoin} alt="" className="w-4 h-4" />
                        <span className="text-xl font-bold text-amber-400">
                            {Math.round(p.currentPrice).toLocaleString()}
                        </span>
                    </div>
                    {change != null && (
                        <div className={`flex items-center gap-0.5 text-xs mt-0.5 ${
                            isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-(--color-text-secondary)/40'
                        }`}>
                            {isUp ? <ArrowUpRight size={12} /> : isDown ? <ArrowDownRight size={12} /> : <Minus size={12} />}
                            {change > 0 ? '+' : ''}{change.toFixed(1)}%
                            <span className="opacity-60 ml-1">24h</span>
                        </div>
                    )}
                </div>
                <div className="text-right text-xs text-(--color-text-secondary)/40">
                    <div>{p.totalSparks} Spark{p.totalSparks !== 1 ? 's' : ''}</div>
                    {p.holding && (
                        <div className="text-amber-400/70">You: {p.holding.sparks}</div>
                    )}
                </div>
            </div>

            {/* Actions */}
            {isOpen && (
                <div className="flex gap-2">
                    <button onClick={() => onFuel(p)}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 text-sm font-medium transition-colors border border-amber-500/20">
                        <Flame size={14} />
                        Fuel
                    </button>
                    {p.holding && p.holding.sparks > 0 && (
                        <button onClick={() => onCool(p)}
                            className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 text-sm font-medium transition-colors border border-blue-500/20">
                            <Snowflake size={14} />
                            Cool
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}


// ═══════════════════════════════════════════════════
// Portfolio Tab
// ═══════════════════════════════════════════════════
function PortfolioTab({ portfolio, loading, onCool }) {
    if (loading) {
        return <div className="text-center py-12 text-(--color-text-secondary)/40">Loading your Sparks...</div>
    }

    if (!portfolio || portfolio.holdings.length === 0) {
        return (
            <div className="text-center py-12">
                <Zap className="mx-auto mb-3 text-(--color-text-secondary)/30" size={40} />
                <p className="text-(--color-text-secondary)/50">You haven't fueled any players yet.</p>
                <p className="text-xs text-(--color-text-secondary)/30 mt-1">Head to The Forge to get started!</p>
            </div>
        )
    }

    const { stats } = portfolio

    return (
        <div>
            {/* Summary */}
            {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                    <StatCard label="Portfolio Value" value={stats.totalValue} icon={Wallet} />
                    <StatCard label="Total Invested" value={stats.totalInvested} />
                    <StatCard label="Unrealized P&L"
                        value={stats.unrealizedPL}
                        color={stats.unrealizedPL >= 0 ? 'text-green-400' : 'text-red-400'}
                        prefix={stats.unrealizedPL >= 0 ? '+' : ''}
                    />
                    <StatCard label="Return"
                        value={`${stats.plPercent >= 0 ? '+' : ''}${stats.plPercent}%`}
                        color={stats.plPercent >= 0 ? 'text-green-400' : 'text-red-400'}
                        raw
                    />
                </div>
            )}

            {/* Holdings */}
            <div className="space-y-2">
                {portfolio.holdings.map(h => (
                    <div key={h.sparkId}
                        className="flex items-center gap-3 p-3 rounded-lg bg-(--color-secondary)/40 border border-(--color-border)/20">
                        <TeamLogo slug={h.teamSlug} name={h.teamName} size={28} />
                        <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm">{h.playerName}</div>
                            <div className="text-xs text-(--color-text-secondary)/50">
                                <span style={{ color: h.teamColor }}>{h.teamName}</span>
                                {h.role && <span className="opacity-60"> · {h.role}</span>}
                                <span className="opacity-60"> · {h.sparks} Spark{h.sparks !== 1 ? 's' : ''}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="flex items-center gap-1 justify-end">
                                <img src={passionCoin} alt="" className="w-3.5 h-3.5" />
                                <span className="font-bold text-sm text-amber-400">{h.currentValue.toLocaleString()}</span>
                            </div>
                            <div className={`text-xs ${h.unrealizedPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {h.unrealizedPL >= 0 ? '+' : ''}{h.unrealizedPL.toLocaleString()}
                            </div>
                        </div>
                        <button onClick={() => onCool(h.sparkId, h.playerName, { sparks: h.sparks })}
                            className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                            title="Cool">
                            <Snowflake size={14} />
                        </button>
                    </div>
                ))}
            </div>

            {/* Recent Transactions */}
            {portfolio.transactions?.length > 0 && (
                <div className="mt-6">
                    <h3 className="text-sm font-bold text-(--color-text-secondary)/60 mb-3">Recent Activity</h3>
                    <div className="space-y-1.5">
                        {portfolio.transactions.map(t => (
                            <div key={t.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-(--color-secondary)/20 text-sm">
                                {t.type === 'fuel' ? (
                                    <Flame size={14} className="text-amber-400 flex-shrink-0" />
                                ) : (
                                    <Snowflake size={14} className="text-blue-400 flex-shrink-0" />
                                )}
                                <span className="flex-1 min-w-0 truncate">
                                    {t.type === 'fuel' ? 'Fueled' : t.type === 'cool' ? 'Cooled' : 'Liquidated'} {t.playerName}
                                    <span className="opacity-50"> ({t.sparks} Spark{t.sparks !== 1 ? 's' : ''})</span>
                                </span>
                                <span className={`font-medium ${t.type === 'fuel' ? 'text-red-400' : 'text-green-400'}`}>
                                    {t.type === 'fuel' ? '-' : '+'}{t.totalCost.toLocaleString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}


// ═══════════════════════════════════════════════════
// Stat Card
// ═══════════════════════════════════════════════════
function StatCard({ label, value, icon: Icon, color, prefix = '', raw = false }) {
    return (
        <div className="rounded-lg bg-(--color-secondary)/40 border border-(--color-border)/20 p-3">
            <div className="text-xs text-(--color-text-secondary)/50 mb-1 flex items-center gap-1">
                {Icon && <Icon size={12} />}
                {label}
            </div>
            <div className={`font-bold text-lg ${color || 'text-amber-400'}`}>
                {raw ? value : (
                    <>
                        {prefix}
                        <img src={passionCoin} alt="" className="w-4 h-4 inline mr-1 -mt-0.5" />
                        {typeof value === 'number' ? value.toLocaleString() : value}
                    </>
                )}
            </div>
        </div>
    )
}


// ═══════════════════════════════════════════════════
// Leaderboard Tab
// ═══════════════════════════════════════════════════
function LeaderboardTab({ leaderboard, loading, currentUserId }) {
    if (loading) {
        return <div className="text-center py-12 text-(--color-text-secondary)/40">Loading leaderboard...</div>
    }

    if (leaderboard.length === 0) {
        return (
            <div className="text-center py-12">
                <Trophy className="mx-auto mb-3 text-(--color-text-secondary)/30" size={40} />
                <p className="text-(--color-text-secondary)/50">No one has entered the Forge yet.</p>
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto">
            <div className="space-y-2">
                {leaderboard.map((entry) => {
                    const isMe = entry.userId === currentUserId
                    const rank = getRank(0) // placeholder — leaderboard doesn't need rank display

                    return (
                        <div key={entry.userId}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                                isMe
                                    ? 'bg-amber-500/10 border-amber-500/30'
                                    : 'bg-(--color-secondary)/40 border-(--color-border)/20'
                            }`}>
                            {/* Position */}
                            <div className={`w-8 text-center font-bold text-sm ${
                                entry.position === 1 ? 'text-yellow-400' :
                                entry.position === 2 ? 'text-gray-300' :
                                entry.position === 3 ? 'text-amber-600' : 'text-(--color-text-secondary)/40'
                            }`}>
                                #{entry.position}
                            </div>

                            {/* Avatar */}
                            {entry.avatar && entry.discordId ? (
                                <img
                                    src={`https://cdn.discordapp.com/avatars/${entry.discordId}/${entry.avatar}.png?size=32`}
                                    alt=""
                                    className="w-8 h-8 rounded-full flex-shrink-0"
                                />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-(--color-secondary) flex items-center justify-center flex-shrink-0">
                                    <span className="text-xs font-bold">{(entry.username || '?')[0]}</span>
                                </div>
                            )}

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-sm truncate">
                                    {entry.username || 'Unknown'}
                                    {isMe && <span className="text-amber-400 text-xs ml-1">(you)</span>}
                                </div>
                                <div className="text-xs text-(--color-text-secondary)/50">
                                    {entry.holdingsCount} player{entry.holdingsCount !== 1 ? 's' : ''} · {entry.totalSparks} Spark{entry.totalSparks !== 1 ? 's' : ''}
                                </div>
                            </div>

                            {/* Value */}
                            <div className="text-right">
                                <div className="flex items-center gap-1 justify-end">
                                    <img src={passionCoin} alt="" className="w-3.5 h-3.5" />
                                    <span className="font-bold text-sm text-amber-400">
                                        {entry.portfolioValue.toLocaleString()}
                                    </span>
                                </div>
                                <div className={`text-xs ${entry.pl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {entry.pl >= 0 ? '+' : ''}{entry.pl.toLocaleString()}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}


// ═══════════════════════════════════════════════════
// Trade Modal
// ═══════════════════════════════════════════════════
function TradeModal({ player, mode, amount, setAmount, balance, trading, result, error, onExecute, onClose }) {
    const isFuel = mode === 'fuel'
    const estimatedCost = isFuel
        ? Math.round(player.currentPrice * amount * (1 + 0.005 * amount)) // rough estimate accounting for price increase
        : null
    const estimatedProceeds = !isFuel && player.currentPrice
        ? Math.round(player.currentPrice * amount * 0.9) // rough estimate with 10% tax
        : null

    const maxSparks = !isFuel && player.holding ? player.holding.sparks : 10

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div className="bg-(--color-primary) border border-(--color-border)/30 rounded-xl p-6 w-full max-w-sm mx-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        {isFuel ? <Flame className="text-amber-400" size={20} /> : <Snowflake className="text-blue-400" size={20} />}
                        {isFuel ? 'Fuel' : 'Cool'} {player.playerName}
                    </h3>
                    <button onClick={onClose} className="p-1 rounded hover:bg-(--color-secondary)/50">
                        <X size={18} />
                    </button>
                </div>

                {/* Result display */}
                {result && (
                    <div className={`mb-4 p-3 rounded-lg border ${isFuel ? 'bg-amber-500/10 border-amber-500/30' : 'bg-blue-500/10 border-blue-500/30'}`}>
                        <div className="text-sm font-bold mb-1">
                            {isFuel ? 'Fueled!' : 'Cooled!'}
                        </div>
                        {isFuel ? (
                            <div className="text-xs text-(--color-text-secondary)/70">
                                Spent <strong className="text-amber-400">{result.totalCost?.toLocaleString()}</strong> Passion.
                                New value: <strong className="text-amber-400">{Math.round(result.newPrice).toLocaleString()}</strong>
                            </div>
                        ) : (
                            <div className="text-xs text-(--color-text-secondary)/70">
                                Received <strong className="text-green-400">{result.netProceeds?.toLocaleString()}</strong> Passion
                                (tax: {result.coolingTax?.toLocaleString()}).
                                {result.profit != null && (
                                    <span className={result.profit >= 0 ? ' text-green-400' : ' text-red-400'}>
                                        {' '}P&L: {result.profit >= 0 ? '+' : ''}{result.profit.toLocaleString()}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
                        {error}
                    </div>
                )}

                {/* Amount selector */}
                {!result && (
                    <>
                        <div className="mb-4">
                            <label className="text-xs text-(--color-text-secondary)/50 mb-2 block">
                                Sparks to {isFuel ? 'fuel' : 'cool'}
                            </label>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setAmount(Math.max(1, amount - 1))}
                                    className="p-2 rounded-lg bg-(--color-secondary)/50 hover:bg-(--color-secondary) disabled:opacity-30"
                                    disabled={amount <= 1}>
                                    <ChevronDown size={16} />
                                </button>
                                <div className="flex-1 text-center">
                                    <span className="text-2xl font-bold">{amount}</span>
                                    <span className="text-sm text-(--color-text-secondary)/50 ml-1">
                                        Spark{amount !== 1 ? 's' : ''}
                                    </span>
                                </div>
                                <button onClick={() => setAmount(Math.min(maxSparks, amount + 1))}
                                    className="p-2 rounded-lg bg-(--color-secondary)/50 hover:bg-(--color-secondary) disabled:opacity-30"
                                    disabled={amount >= maxSparks}>
                                    <ChevronUp size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Cost preview */}
                        <div className="mb-4 p-3 rounded-lg bg-(--color-secondary)/30">
                            {isFuel ? (
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-(--color-text-secondary)/60">Estimated cost</span>
                                    <span className="flex items-center gap-1 font-bold text-amber-400">
                                        <img src={passionCoin} alt="" className="w-3.5 h-3.5" />
                                        ~{estimatedCost?.toLocaleString()}
                                    </span>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between text-sm mb-1">
                                        <span className="text-(--color-text-secondary)/60">Estimated proceeds</span>
                                        <span className="flex items-center gap-1 font-bold text-green-400">
                                            <img src={passionCoin} alt="" className="w-3.5 h-3.5" />
                                            ~{estimatedProceeds?.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-(--color-text-secondary)/40">
                                        <span>Includes 10% cooling tax</span>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Confirm */}
                        <button onClick={onExecute}
                            disabled={trading}
                            className={`w-full py-2.5 rounded-lg font-bold text-sm transition-colors disabled:opacity-50 ${
                                isFuel
                                    ? 'bg-amber-500 hover:bg-amber-400 text-black'
                                    : 'bg-blue-500 hover:bg-blue-400 text-white'
                            }`}>
                            {trading
                                ? (isFuel ? 'Fueling...' : 'Cooling...')
                                : (isFuel ? `Fuel ${amount} Spark${amount !== 1 ? 's' : ''}` : `Cool ${amount} Spark${amount !== 1 ? 's' : ''}`)
                            }
                        </button>
                    </>
                )}

                {/* Done button after result */}
                {result && (
                    <button onClick={onClose}
                        className="w-full py-2.5 rounded-lg font-bold text-sm bg-(--color-secondary)/50 hover:bg-(--color-secondary) transition-colors">
                        Close
                    </button>
                )}
            </div>
        </div>
    )
}

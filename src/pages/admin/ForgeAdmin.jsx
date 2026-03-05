import { useState, useEffect, useCallback } from 'react'
import { adminFetch } from '../../services/adminApi'
import PageTitle from '../../components/PageTitle'

const TYPE_LABELS = {
    fuel: { label: 'Fueled', color: 'text-green-400' },
    cool: { label: 'Cooled', color: 'text-blue-400' },
    liquidate: { label: 'Liquidated', color: 'text-amber-400' },
    tutorial_fuel: { label: 'Tutorial', color: 'text-purple-400' },
    referral_fuel: { label: 'Referral', color: 'text-pink-400' },
}

const TYPE_FILTERS = ['all', 'fuel', 'cool', 'tutorial_fuel', 'referral_fuel', 'liquidate']

function avatarUrl(discordId, avatar) {
    if (!discordId || !avatar) return null
    return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.webp?size=32`
}

function formatTime(iso) {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
        d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function ForgeAdmin() {
    const [tab, setTab] = useState('holdings')
    const [markets, setMarkets] = useState([])
    const [marketId, setMarketId] = useState('')
    const [loading, setLoading] = useState(true)
    const [cleanupRunning, setCleanupRunning] = useState(false)
    const [cleanupResult, setCleanupResult] = useState(null)

    // Holdings state
    const [holdings, setHoldings] = useState([])
    const [holdingsSearch, setHoldingsSearch] = useState('')

    // Activity state
    const [activity, setActivity] = useState([])
    const [typeFilter, setTypeFilter] = useState('all')
    const [hasMore, setHasMore] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)

    useEffect(() => {
        adminFetch('forge-admin', { method: 'GET', params: { action: 'markets' } })
            .then(data => {
                setMarkets(data)
                const open = data.find(m => m.status === 'open')
                if (open) setMarketId(String(open.market_id))
            })
            .catch(console.error)
    }, [])

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            if (tab === 'holdings') {
                const data = await adminFetch('forge-admin', {
                    method: 'GET',
                    params: { action: 'holdings', ...(marketId ? { marketId } : {}) }
                })
                setHoldings(data)
            } else {
                const data = await adminFetch('forge-admin', {
                    method: 'GET',
                    params: {
                        action: 'activity',
                        ...(marketId ? { marketId } : {}),
                        ...(typeFilter !== 'all' ? { type: typeFilter } : {}),
                        limit: 50,
                    }
                })
                setActivity(data)
                setHasMore(data.length === 50)
            }
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }, [tab, marketId, typeFilter])

    useEffect(() => { loadData() }, [loadData])

    const loadMore = async () => {
        setLoadingMore(true)
        try {
            const data = await adminFetch('forge-admin', {
                method: 'GET',
                params: {
                    action: 'activity',
                    ...(marketId ? { marketId } : {}),
                    ...(typeFilter !== 'all' ? { type: typeFilter } : {}),
                    limit: 50,
                    offset: activity.length,
                }
            })
            setActivity(prev => [...prev, ...data])
            setHasMore(data.length === 50)
        } catch (err) {
            console.error(err)
        } finally {
            setLoadingMore(false)
        }
    }

    const filteredHoldings = holdingsSearch.trim()
        ? holdings.filter(h => {
            const q = holdingsSearch.toLowerCase()
            return h.discord_username?.toLowerCase().includes(q) ||
                h.player_name?.toLowerCase().includes(q) ||
                h.team_name?.toLowerCase().includes(q)
        })
        : holdings

    // Aggregate holdings by user for summary
    const userSummary = {}
    holdings.forEach(h => {
        const key = h.discord_username
        if (!userSummary[key]) {
            userSummary[key] = { username: h.discord_username, avatar: avatarUrl(h.discord_id, h.discord_avatar), totalValue: 0, totalInvested: 0, positions: 0 }
        }
        userSummary[key].totalValue += h.sparks * Number(h.current_price)
        userSummary[key].totalInvested += Number(h.total_invested)
        userSummary[key].positions++
    })

    return (
        <div className="max-w-5xl mx-auto pb-8 px-4">
            <PageTitle title="Forge Admin" noindex />

            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="font-heading text-2xl font-bold text-[var(--color-text)]">Forge Admin</h1>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                        View all holdings and transaction activity across the market.
                    </p>
                </div>
                <button
                    onClick={async () => {
                        if (!confirm('Scan all players and auto-sell any illegal own-team holdings?')) return
                        setCleanupRunning(true)
                        setCleanupResult(null)
                        try {
                            const data = await adminFetch('roster-manage', {
                                method: 'POST',
                                body: { action: 'cleanup-illegal-holdings' },
                            })
                            setCleanupResult(data)
                            if (data.totalSold > 0 || data.totalRefunded > 0) loadData()
                        } catch (err) {
                            setCleanupResult({ error: err.message })
                        } finally {
                            setCleanupRunning(false)
                        }
                    }}
                    disabled={cleanupRunning}
                    className="px-4 py-2 rounded-lg bg-red-600/20 border border-red-500/30 text-sm font-medium text-red-400 hover:bg-red-600/30 transition-colors cursor-pointer disabled:opacity-50"
                >
                    {cleanupRunning ? 'Scanning...' : 'Cleanup Illegal Holdings'}
                </button>
            </div>

            {cleanupResult && (
                <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
                    cleanupResult.error
                        ? 'border-red-500/30 bg-red-600/10 text-red-400'
                        : cleanupResult.totalSold > 0 || cleanupResult.totalRefunded > 0
                            ? 'border-amber-500/30 bg-amber-600/10 text-amber-300'
                            : 'border-green-500/30 bg-green-600/10 text-green-400'
                }`}>
                    {cleanupResult.error ? (
                        <span>Error: {cleanupResult.error}</span>
                    ) : cleanupResult.totalSold === 0 && cleanupResult.totalRefunded === 0 ? (
                        <span>No illegal holdings found.</span>
                    ) : (
                        <div>
                            <span className="font-medium">Cleaned up {cleanupResult.affected?.length} user{cleanupResult.affected?.length !== 1 ? 's' : ''}:</span>
                            {' '}{cleanupResult.totalSold} Spark{cleanupResult.totalSold !== 1 ? 's' : ''} sold (with cooling fee),
                            {' '}{cleanupResult.totalRefunded} free Spark{cleanupResult.totalRefunded !== 1 ? 's' : ''} refunded.
                            <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                {cleanupResult.affected?.map(u => `${u.username} (${u.sold} sold, ${u.refunded} refunded)`).join(' | ')}
                            </div>
                        </div>
                    )}
                    <button onClick={() => setCleanupResult(null)} className="ml-2 text-xs underline opacity-60 hover:opacity-100 cursor-pointer">dismiss</button>
                </div>
            )}

            {/* Market selector + tabs */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
                <select
                    value={marketId}
                    onChange={e => setMarketId(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-orange-500/50"
                >
                    <option value="">All open markets</option>
                    {markets.map(m => (
                        <option key={m.market_id} value={m.market_id}>
                            {m.league_name} — {m.division_name} ({m.status})
                        </option>
                    ))}
                </select>

                <div className="flex gap-1 ml-auto">
                    {['holdings', 'activity'].map(t => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                                tab === t
                                    ? 'bg-orange-600/20 text-orange-400 border border-orange-500/30'
                                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/5'
                            }`}
                        >
                            {t === 'holdings' ? 'Holdings' : 'Activity'}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="text-center text-[var(--color-text-secondary)] py-12">Loading...</div>
            ) : tab === 'holdings' ? (
                <HoldingsTab
                    holdings={filteredHoldings}
                    search={holdingsSearch}
                    setSearch={setHoldingsSearch}
                    userSummary={userSummary}
                />
            ) : (
                <ActivityTab
                    activity={activity}
                    typeFilter={typeFilter}
                    setTypeFilter={(f) => { setTypeFilter(f); setActivity([]); setHasMore(true) }}
                    hasMore={hasMore}
                    loadMore={loadMore}
                    loadingMore={loadingMore}
                />
            )}
        </div>
    )
}

function HoldingsTab({ holdings, search, setSearch, userSummary }) {
    const summaryList = Object.values(userSummary).sort((a, b) => b.totalValue - a.totalValue)

    return (
        <>
            {/* User summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-4">
                {summaryList.slice(0, 8).map(u => (
                    <div key={u.username} className="rounded-lg border border-white/10 px-3 py-2" style={{ backgroundColor: 'var(--color-card, var(--color-secondary))' }}>
                        <div className="flex items-center gap-2 mb-1">
                            {u.avatar && <img src={u.avatar} className="w-5 h-5 rounded-full" alt="" />}
                            <span className="text-xs font-medium text-[var(--color-text)] truncate">{u.username}</span>
                        </div>
                        <div className="text-xs text-[var(--color-text-secondary)]">
                            {u.positions} position{u.positions !== 1 ? 's' : ''} &middot; {Math.round(u.totalValue).toLocaleString()} value
                        </div>
                        <div className={`text-xs font-medium ${u.totalValue - u.totalInvested >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            P&L: {u.totalValue - u.totalInvested >= 0 ? '+' : ''}{Math.round(u.totalValue - u.totalInvested).toLocaleString()}
                        </div>
                    </div>
                ))}
            </div>

            {/* Search */}
            <input
                type="text"
                placeholder="Search user, player, or team..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full sm:w-64 mb-3 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder-white/30 focus:outline-none focus:border-orange-500/50"
            />

            {/* Holdings table */}
            <div className="rounded-xl border border-white/10 overflow-hidden" style={{ backgroundColor: 'var(--color-card, var(--color-secondary))' }}>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/10">
                                <th className="text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider px-4 py-3">User</th>
                                <th className="text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider px-4 py-3">Player</th>
                                <th className="text-right text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider px-4 py-3">Sparks</th>
                                <th className="text-right text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider px-4 py-3">Invested</th>
                                <th className="text-right text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider px-4 py-3">Value</th>
                                <th className="text-right text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider px-4 py-3">P&L</th>
                            </tr>
                        </thead>
                        <tbody>
                            {holdings.map((h, i) => {
                                const value = h.sparks * Number(h.current_price)
                                const pnl = value - Number(h.total_invested)
                                const free = (h.tutorial_sparks || 0) + (h.referral_sparks || 0)
                                return (
                                    <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center gap-2">
                                                {avatarUrl(h.discord_id, h.discord_avatar) && (
                                                    <img src={avatarUrl(h.discord_id, h.discord_avatar)} className="w-5 h-5 rounded-full" alt="" />
                                                )}
                                                <span className="text-[var(--color-text)]">{h.discord_username}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className="text-[var(--color-text)]">{h.player_name}</span>
                                            <span className="ml-1.5 text-xs" style={{ color: h.team_color || 'var(--color-text-secondary)' }}>
                                                {h.team_name}
                                            </span>
                                            {h.division_name && (
                                                <span className="ml-1.5 text-xs text-[var(--color-text-secondary)]">({h.division_name})</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-[var(--color-text)]">
                                            {h.sparks}
                                            {free > 0 && (
                                                <span className="ml-1 text-xs text-purple-400" title={`${h.tutorial_sparks || 0} tutorial + ${h.referral_sparks || 0} referral`}>
                                                    ({free} free)
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-[var(--color-text-secondary)]">
                                            {Math.round(Number(h.total_invested)).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-[var(--color-text)]">
                                            {Math.round(value).toLocaleString()}
                                        </td>
                                        <td className={`px-4 py-2.5 text-right font-medium ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {pnl >= 0 ? '+' : ''}{Math.round(pnl).toLocaleString()}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
                {holdings.length === 0 && (
                    <div className="text-center text-[var(--color-text-secondary)] py-8 text-sm">No holdings found</div>
                )}
            </div>
        </>
    )
}

function ActivityTab({ activity, typeFilter, setTypeFilter, hasMore, loadMore, loadingMore }) {
    return (
        <>
            {/* Type filter chips */}
            <div className="flex flex-wrap gap-1.5 mb-4">
                {TYPE_FILTERS.map(f => (
                    <button
                        key={f}
                        onClick={() => setTypeFilter(f)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                            typeFilter === f
                                ? 'bg-orange-600/20 text-orange-400 border border-orange-500/30'
                                : 'bg-white/5 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] border border-white/10'
                        }`}
                    >
                        {f === 'all' ? 'All' : TYPE_LABELS[f]?.label || f}
                    </button>
                ))}
            </div>

            {/* Activity list */}
            <div className="rounded-xl border border-white/10 overflow-hidden" style={{ backgroundColor: 'var(--color-card, var(--color-secondary))' }}>
                <div className="divide-y divide-white/5">
                    {activity.map(tx => {
                        const meta = TYPE_LABELS[tx.type] || { label: tx.type, color: 'text-white' }
                        return (
                            <div key={tx.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02]">
                                {avatarUrl(tx.discord_id, tx.discord_avatar) ? (
                                    <img src={avatarUrl(tx.discord_id, tx.discord_avatar)} className="w-7 h-7 rounded-full flex-shrink-0" alt="" />
                                ) : (
                                    <div className="w-7 h-7 rounded-full bg-white/10 flex-shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm">
                                        <span className="text-[var(--color-text)] font-medium">{tx.discord_username}</span>
                                        <span className={`ml-1.5 ${meta.color}`}>{meta.label}</span>
                                        <span className="text-[var(--color-text-secondary)]"> {tx.sparks}x </span>
                                        <span className="text-[var(--color-text)]">{tx.player_name}</span>
                                        <span className="ml-1 text-xs" style={{ color: tx.team_color || 'var(--color-text-secondary)' }}>
                                            {tx.team_name}
                                        </span>
                                    </div>
                                    <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                                        {formatTime(tx.created_at)}
                                        {tx.division_name && <span> &middot; {tx.division_name}</span>}
                                    </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <div className={`text-sm font-medium ${tx.type === 'cool' || tx.type === 'liquidate' ? 'text-green-400' : 'text-red-400'}`}>
                                        {tx.type === 'cool' || tx.type === 'liquidate' ? '+' : '-'}{Math.round(tx.total_cost).toLocaleString()}
                                    </div>
                                    <div className="text-xs text-[var(--color-text-secondary)]">
                                        @{Math.round(Number(tx.price_per_spark))}/spark
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
                {activity.length === 0 && (
                    <div className="text-center text-[var(--color-text-secondary)] py-8 text-sm">No activity found</div>
                )}
            </div>

            {hasMore && activity.length > 0 && (
                <div className="text-center mt-4">
                    <button
                        onClick={loadMore}
                        disabled={loadingMore}
                        className="px-5 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
                    >
                        {loadingMore ? 'Loading...' : 'Load more'}
                    </button>
                </div>
            )}
        </>
    )
}

import { useState, useEffect, useCallback } from 'react'
import { adminCommunityService } from '../../services/database'
import PageTitle from '../../components/PageTitle'
import { Swords, AlertTriangle, XCircle, CheckCircle, Clock, Ban } from 'lucide-react'

const STATUS_META = {
    open:      { label: 'Open',      color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
    accepted:  { label: 'Accepted',  color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
    cancelled: { label: 'Cancelled', color: '#6b7280', bg: 'rgba(107,114,128,0.15)' },
    expired:   { label: 'Expired',   color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
}

const OUTCOME_META = {
    completed: { label: 'Completed', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
    no_show:   { label: 'No Show',   color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
    disputed:  { label: 'Disputed',  color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
}

export default function ScrimAdmin() {
    const [scrims, setScrims] = useState([])
    const [stats, setStats] = useState(null)
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [statusFilter, setStatusFilter] = useState('all')
    const [page, setPage] = useState(0)
    const [toast, setToast] = useState(null)

    const PAGE_SIZE = 50

    const showToast = useCallback((type, message) => {
        const id = Date.now()
        setToast({ type, message, id })
        setTimeout(() => setToast(prev => prev?.id === id ? null : prev), 4000)
    }, [])

    const fetchScrims = async () => {
        setLoading(true)
        try {
            const data = await adminCommunityService.listScrims({
                status: statusFilter,
                limit: PAGE_SIZE,
                offset: page * PAGE_SIZE,
            })
            setScrims(data.scrims || [])
            setTotal(data.total || 0)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const fetchStats = async () => {
        try {
            const data = await adminCommunityService.scrimStats()
            setStats(data.stats)
        } catch (err) {
            console.error('Failed to load scrim stats:', err)
        }
    }

    useEffect(() => { fetchStats() }, [])
    useEffect(() => { fetchScrims() }, [statusFilter, page])

    const handleCancel = async (scrim) => {
        if (!confirm(`Cancel scrim #${scrim.id} (${scrim.team_name} vs ${scrim.accepted_team_name || 'open'})?`)) return
        try {
            await adminCommunityService.cancelScrim(scrim.id)
            showToast('success', 'Scrim cancelled')
            await fetchScrims()
            await fetchStats()
        } catch (err) {
            showToast('error', err.message)
        }
    }

    const handleResolve = async (scrim, outcome) => {
        try {
            await adminCommunityService.resolveDispute(scrim.id, outcome)
            showToast('success', `Dispute resolved as "${outcome}"`)
            await fetchScrims()
            await fetchStats()
        } catch (err) {
            showToast('error', err.message)
        }
    }

    const totalPages = Math.ceil(total / PAGE_SIZE)

    const formatDate = (d) => {
        if (!d) return '—'
        return new Date(d).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        })
    }

    if (loading && scrims.length === 0 && !stats) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-(--color-accent)" />
            </div>
        )
    }

    return (
        <div className="max-w-5xl mx-auto px-4 py-8 pt-24">
            <PageTitle title="Scrim Admin" noindex />

            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-orange-500/10">
                    <Swords className="w-6 h-6 text-orange-400" />
                </div>
                <div>
                    <h1 className="text-xl font-heading font-bold text-(--color-text)">Scrim Monitor</h1>
                    <p className="text-xs text-(--color-text-secondary)">{total} scrim{total !== 1 ? 's' : ''} total</p>
                </div>
            </div>

            {/* Stats grid */}
            {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                    <StatCard label="Open" value={stats.open_count} color="#22c55e" />
                    <StatCard label="Accepted" value={stats.accepted_count} color="#3b82f6" />
                    <StatCard label="Completed" value={stats.completed_count} color="#8b5cf6" />
                    <StatCard label="No Shows" value={stats.no_show_count} color="#ef4444" />
                    <StatCard label="Disputed" value={stats.disputed_count} color="#f59e0b" highlight={stats.disputed_count > 0} />
                </div>
            )}

            {/* Activity summary */}
            {stats && (
                <div className="flex gap-4 mb-6 text-xs text-(--color-text-secondary)">
                    <span>Last 7 days: <strong className="text-(--color-text)">{stats.last_7_days}</strong></span>
                    <span>Last 30 days: <strong className="text-(--color-text)">{stats.last_30_days}</strong></span>
                    <span>Cancelled: <strong className="text-(--color-text)">{stats.cancelled_count}</strong></span>
                    <span>Expired: <strong className="text-(--color-text)">{stats.expired_count}</strong></span>
                </div>
            )}

            {/* Disputed scrims callout */}
            {stats && Number(stats.disputed_count) > 0 && (
                <div className="bg-yellow-900/20 border border-yellow-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-yellow-300">{stats.disputed_count} disputed scrim{stats.disputed_count != 1 ? 's' : ''} need attention</p>
                        <p className="text-xs text-yellow-400/70 mt-0.5">Filter by "Accepted" status to find scrims with disputed outcomes.</p>
                    </div>
                </div>
            )}

            {/* Status filter tabs */}
            <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
                {['all', 'open', 'accepted', 'cancelled', 'expired'].map(s => (
                    <button
                        key={s}
                        onClick={() => { setStatusFilter(s); setPage(0) }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                            statusFilter === s
                                ? 'bg-(--color-accent) text-white'
                                : 'bg-white/5 text-(--color-text-secondary) hover:bg-white/10'
                        }`}
                    >
                        {s === 'all' ? 'All' : STATUS_META[s]?.label || s}
                    </button>
                ))}
            </div>

            {error && (
                <div className="bg-red-900/20 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm mb-6">{error}</div>
            )}

            {/* Scrim list */}
            {scrims.length === 0 && !loading ? (
                <div className="py-16 text-center">
                    <Swords className="w-12 h-12 text-white/10 mx-auto mb-4" />
                    <h3 className="text-base font-heading font-bold text-white/60 mb-1">No scrims found</h3>
                </div>
            ) : (
                <div className="space-y-2">
                    {scrims.map(scrim => {
                        const statusMeta = STATUS_META[scrim.status] || {}
                        const outcomeMeta = scrim.outcome ? OUTCOME_META[scrim.outcome] : null
                        const isDisputed = scrim.outcome === 'disputed'

                        return (
                            <div key={scrim.id} className={`bg-(--color-secondary) border rounded-xl p-3 sm:p-4 ${isDisputed ? 'border-yellow-500/30' : 'border-white/10'}`}>
                                <div className="flex items-start gap-3">
                                    {/* Teams */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <span className="font-medium text-sm text-(--color-text)">{scrim.team_name || `Team #${scrim.team_id}`}</span>
                                            {scrim.team_type === 'community' && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-400 font-medium">BYOT</span>
                                            )}
                                            {scrim.accepted_team_name && (
                                                <>
                                                    <span className="text-xs text-(--color-text-secondary)">vs</span>
                                                    <span className="font-medium text-sm text-(--color-text)">{scrim.accepted_team_name}</span>
                                                </>
                                            )}
                                            {scrim.challenged_team_name && !scrim.accepted_team_name && (
                                                <>
                                                    <span className="text-xs text-(--color-text-secondary)">challenges</span>
                                                    <span className="font-medium text-sm text-(--color-text)">{scrim.challenged_team_name}</span>
                                                </>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-(--color-text-secondary) flex-wrap">
                                            <span className="font-medium px-1.5 py-0.5 rounded" style={{ background: statusMeta.bg, color: statusMeta.color }}>
                                                {statusMeta.label}
                                            </span>
                                            {outcomeMeta && (
                                                <span className="font-medium px-1.5 py-0.5 rounded" style={{ background: outcomeMeta.bg, color: outcomeMeta.color }}>
                                                    {outcomeMeta.label}
                                                </span>
                                            )}
                                            <span>{formatDate(scrim.scheduled_date)}</span>
                                            <span className="text-white/20">|</span>
                                            <span>by {scrim.poster_username || '?'}</span>
                                            {scrim.pick_mode && scrim.pick_mode !== 'regular' && (
                                                <>
                                                    <span className="text-white/20">|</span>
                                                    <span>{scrim.pick_mode}</span>
                                                </>
                                            )}
                                            {scrim.league_name && (
                                                <>
                                                    <span className="text-white/20">|</span>
                                                    <span>{scrim.league_name}{scrim.division_name ? ` / ${scrim.division_name}` : ''}</span>
                                                </>
                                            )}
                                            <span className="text-white/20">|</span>
                                            <span className="text-white/30">#{scrim.id}</span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1 shrink-0">
                                        {isDisputed && (
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => handleResolve(scrim, 'completed')}
                                                    className="p-1.5 rounded-lg text-green-400 hover:bg-green-500/10 transition-colors cursor-pointer"
                                                    title="Resolve as Completed"
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleResolve(scrim, 'no_show')}
                                                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                                                    title="Resolve as No Show"
                                                >
                                                    <Ban className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleResolve(scrim, 'cancelled')}
                                                    className="p-1.5 rounded-lg text-(--color-text-secondary) hover:bg-white/5 transition-colors cursor-pointer"
                                                    title="Resolve as Cancelled"
                                                >
                                                    <XCircle className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                        {(scrim.status === 'open' || scrim.status === 'accepted') && (
                                            <button
                                                onClick={() => handleCancel(scrim)}
                                                className="p-1.5 rounded-lg text-(--color-text-secondary) hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                                                title="Cancel scrim"
                                            >
                                                <XCircle className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                    <button
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-(--color-text-secondary) hover:bg-white/10 disabled:opacity-30 cursor-pointer transition-colors"
                    >
                        Prev
                    </button>
                    <span className="text-xs text-(--color-text-secondary)">
                        Page {page + 1} of {totalPages}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={page >= totalPages - 1}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-(--color-text-secondary) hover:bg-white/10 disabled:opacity-30 cursor-pointer transition-colors"
                    >
                        Next
                    </button>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg border ${
                    toast.type === 'error'
                        ? 'bg-red-900/90 border-red-500/30 text-red-200'
                        : 'bg-green-900/90 border-green-500/30 text-green-200'
                }`}>
                    {toast.message}
                </div>
            )}
        </div>
    )
}

function StatCard({ label, value, color, highlight }) {
    return (
        <div className={`bg-(--color-secondary) border rounded-xl p-3 ${highlight ? 'border-yellow-500/30' : 'border-white/10'}`}>
            <div className="text-xs text-(--color-text-secondary) mb-1">{label}</div>
            <div className="text-xl font-heading font-bold" style={{ color }}>{value ?? 0}</div>
        </div>
    )
}

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Flag, Check, X, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { getAuthHeaders } from '../../services/adminApi'

const API = import.meta.env.VITE_API_URL || '/api'

const CATEGORY_LABELS = {
    wrong_score: 'Wrong Score',
    wrong_stats: 'Wrong Stats',
    wrong_god: 'Wrong God',
    missing_data: 'Missing Data',
    other: 'Other',
}

const CATEGORY_COLORS = {
    wrong_score: 'bg-red-500/10 text-red-400 border-red-500/20',
    wrong_stats: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    wrong_god: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    missing_data: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    other: 'bg-white/5 text-(--color-text-secondary) border-white/10',
}

export default function DataReportManager() {
    const [reports, setReports] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [actionMsg, setActionMsg] = useState(null)
    const [filter, setFilter] = useState('pending')
    const [expandedNote, setExpandedNote] = useState(null)
    const [adminNote, setAdminNote] = useState('')

    const fetchReports = async () => {
        try {
            const res = await fetch(`${API}/data-reports?status=${filter}`, { headers: getAuthHeaders() })
            if (!res.ok) throw new Error('Failed to load reports')
            const data = await res.json()
            setReports(data.reports || [])
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        setLoading(true)
        setError(null)
        fetchReports()
    }, [filter])

    const handleResolve = async (reportId, status) => {
        setActionMsg(null)
        try {
            const res = await fetch(`${API}/data-reports`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    action: 'resolve',
                    report_id: reportId,
                    status,
                    admin_note: expandedNote === reportId ? adminNote : null,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Action failed')
            setActionMsg({ success: status === 'resolved' ? 'Report resolved.' : 'Report dismissed.' })
            setExpandedNote(null)
            setAdminNote('')
            fetchReports()
        } catch (err) {
            setActionMsg({ error: err.message })
        }
    }

    const avatarUrl = (report) => report.reporter_avatar
        ? `https://cdn.discordapp.com/avatars/${report.reporter_discord_id}/${report.reporter_avatar}.png?size=32`
        : null

    const formatDate = (dateStr) => {
        if (!dateStr) return ''
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }

    const matchUrl = (report) =>
        report.league_slug && report.division_slug
            ? `/${report.league_slug}/${report.division_slug}/matches/${report.match_id}`
            : null

    const filters = ['pending', 'resolved', 'dismissed', 'all']

    if (loading) {
        return (
            <div className="max-w-5xl mx-auto py-12 px-4">
                <div className="flex items-center justify-center p-16">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-(--color-accent) mx-auto" />
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-5xl mx-auto pb-8 px-4">
            <div className="mb-8">
                <h1 className="font-heading text-2xl font-bold text-(--color-text)">Data Reports</h1>
                <p className="text-(--color-text-secondary) text-sm">Review and resolve user-reported data issues</p>
            </div>

            {error && (
                <div className="mb-6 p-4 rounded-lg bg-red-900/20 border border-red-500/20 text-red-400 text-sm">{error}</div>
            )}
            {actionMsg?.error && (
                <div className="mb-6 p-4 rounded-lg bg-red-900/20 border border-red-500/20 text-red-400 text-sm">{actionMsg.error}</div>
            )}
            {actionMsg?.success && (
                <div className="mb-6 p-4 rounded-lg bg-green-900/20 border border-green-500/20 text-green-400 text-sm">{actionMsg.success}</div>
            )}

            {/* Filter tabs */}
            <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
                {filters.map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                            filter === f
                                ? 'bg-(--color-accent)/10 text-(--color-accent) border border-(--color-accent)/20'
                                : 'text-(--color-text-secondary) hover:text-(--color-text) hover:bg-white/5'
                        }`}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {reports.length === 0 ? (
                <div className="p-8 rounded-xl bg-(--color-secondary) border border-white/10 text-center text-(--color-text-secondary) text-sm">
                    No {filter === 'all' ? '' : filter} reports
                </div>
            ) : (
                <div className="space-y-3">
                    {reports.map(report => {
                        const isPending = report.status === 'pending'
                        const url = matchUrl(report)

                        return (
                            <div
                                key={report.id}
                                className={`bg-(--color-secondary) rounded-xl border border-white/10 p-4 ${!isPending ? 'opacity-70' : ''}`}
                            >
                                <div className="flex items-start gap-4">
                                    {/* Avatar */}
                                    {avatarUrl(report) ? (
                                        <img src={avatarUrl(report)} alt="" className="w-8 h-8 rounded-full flex-shrink-0 mt-0.5" />
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-[#5865F2] flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
                                            {report.reporter_name?.[0]?.toUpperCase()}
                                        </div>
                                    )}

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <span className="text-sm font-medium text-(--color-text)">{report.reporter_name}</span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[report.category] || CATEGORY_COLORS.other}`}>
                                                {CATEGORY_LABELS[report.category] || report.category}
                                            </span>
                                            {!isPending && (
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                    report.status === 'resolved'
                                                        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                                        : 'bg-white/5 text-(--color-text-secondary) border border-white/10'
                                                }`}>
                                                    {report.status}
                                                </span>
                                            )}
                                        </div>

                                        {/* Match link */}
                                        <div className="text-xs text-(--color-text-secondary) mb-2">
                                            {url ? (
                                                <Link to={url} className="inline-flex items-center gap-1 hover:text-(--color-accent) transition-colors">
                                                    {report.team1_name} vs {report.team2_name}
                                                    <span className="text-(--color-text-secondary)/50">#{report.match_id}</span>
                                                    <ExternalLink className="w-3 h-3" />
                                                </Link>
                                            ) : (
                                                <span>Match #{report.match_id}</span>
                                            )}
                                        </div>

                                        {/* Details */}
                                        <p className="text-sm text-(--color-text)/80 whitespace-pre-wrap">{report.details}</p>

                                        {/* Meta */}
                                        <div className="text-xs text-(--color-text-secondary)/50 mt-2">
                                            {formatDate(report.created_at)}
                                            {report.resolved_by_name && (
                                                <span> &middot; {report.status} by {report.resolved_by_name} on {formatDate(report.resolved_at)}</span>
                                            )}
                                        </div>

                                        {/* Admin note (resolved) */}
                                        {report.admin_note && (
                                            <div className="mt-2 text-xs text-(--color-text-secondary)/60 italic">
                                                Note: {report.admin_note}
                                            </div>
                                        )}

                                        {/* Admin note input (pending, expanded) */}
                                        {isPending && expandedNote === report.id && (
                                            <div className="mt-3">
                                                <textarea
                                                    value={adminNote}
                                                    onChange={e => setAdminNote(e.target.value)}
                                                    placeholder="Admin note (optional)"
                                                    rows={2}
                                                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-(--color-text) placeholder:text-(--color-text-secondary)/50 focus:outline-none focus:border-(--color-accent)/50 resize-none"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    {isPending && (
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {expandedNote !== report.id ? (
                                                <>
                                                    <button
                                                        onClick={() => handleResolve(report.id, 'resolved')}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition-colors cursor-pointer"
                                                        title="Mark as resolved"
                                                    >
                                                        <Check className="w-3.5 h-3.5" /> Resolve
                                                    </button>
                                                    <button
                                                        onClick={() => handleResolve(report.id, 'dismissed')}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-(--color-text-secondary) text-xs font-medium transition-colors cursor-pointer"
                                                        title="Dismiss report"
                                                    >
                                                        <X className="w-3.5 h-3.5" /> Dismiss
                                                    </button>
                                                    <button
                                                        onClick={() => { setExpandedNote(report.id); setAdminNote('') }}
                                                        className="p-1.5 rounded-lg hover:bg-white/10 text-(--color-text-secondary) transition-colors cursor-pointer"
                                                        title="Add a note before resolving"
                                                    >
                                                        <ChevronDown className="w-3.5 h-3.5" />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => handleResolve(report.id, 'resolved')}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition-colors cursor-pointer"
                                                    >
                                                        <Check className="w-3.5 h-3.5" /> Resolve
                                                    </button>
                                                    <button
                                                        onClick={() => handleResolve(report.id, 'dismissed')}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-(--color-text-secondary) text-xs font-medium transition-colors cursor-pointer"
                                                    >
                                                        <X className="w-3.5 h-3.5" /> Dismiss
                                                    </button>
                                                    <button
                                                        onClick={() => setExpandedNote(null)}
                                                        className="p-1.5 rounded-lg hover:bg-white/10 text-(--color-text-secondary) transition-colors cursor-pointer"
                                                        title="Collapse note"
                                                    >
                                                        <ChevronRight className="w-3.5 h-3.5" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

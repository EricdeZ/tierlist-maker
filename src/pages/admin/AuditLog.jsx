// src/pages/admin/AuditLog.jsx
import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Home, Shield, ChevronLeft, ChevronRight, Search, X, Clock } from 'lucide-react'
import { getAuthHeaders } from '../../services/adminApi'
import smiteLogo from '../../assets/smite2.png'
import PageTitle from '../../components/PageTitle'

const API = import.meta.env.VITE_API_URL || '/api'

const ENDPOINT_COLORS = {
    'admin-write':        'bg-blue-500/20 text-blue-300',
    'admin-match-manage': 'bg-amber-500/20 text-amber-300',
    'roster-manage':      'bg-emerald-500/20 text-emerald-300',
    'league-manage':      'bg-rose-500/20 text-rose-300',
    'player-manage':      'bg-violet-500/20 text-violet-300',
    'user-manage':        'bg-indigo-500/20 text-indigo-300',
    'claim-manage':       'bg-teal-500/20 text-teal-300',
    'permission-manage':  'bg-yellow-500/20 text-yellow-300',
}

function formatDate(iso) {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export default function AuditLog() {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    // Filters
    const [page, setPage] = useState(1)
    const [endpoint, setEndpoint] = useState('')
    const [username, setUsername] = useState('')
    const [action, setAction] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')

    // Available filter options (populated from API)
    const [filterOptions, setFilterOptions] = useState({ endpoints: [], usernames: [] })

    const fetchData = useCallback(async (p = page) => {
        setLoading(true)
        setError(null)
        try {
            const params = new URLSearchParams({ page: p, limit: 50 })
            if (endpoint) params.set('endpoint', endpoint)
            if (username) params.set('username', username)
            if (action) params.set('action', action)
            if (dateFrom) params.set('from', dateFrom)
            if (dateTo) params.set('to', dateTo)

            const res = await fetch(`${API}/audit-log?${params}`, { headers: getAuthHeaders() })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.error || 'Failed to load audit log')
            }
            const result = await res.json()
            setData(result)
            if (result.filters) setFilterOptions(result.filters)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [page, endpoint, username, action, dateFrom, dateTo])

    useEffect(() => { fetchData(1); setPage(1) }, [endpoint, username, action, dateFrom, dateTo])
    useEffect(() => { fetchData(page) }, [page])

    const clearFilters = () => {
        setEndpoint('')
        setUsername('')
        setAction('')
        setDateFrom('')
        setDateTo('')
        setPage(1)
    }

    const hasFilters = endpoint || username || action || dateFrom || dateTo

    return (
        <div className="max-w-6xl mx-auto pb-8 px-4">
            <PageTitle title="Audit Log" noindex />
            <div className="mb-8">
                <h1 className="font-heading text-2xl font-bold text-(--color-text)">Audit Log</h1>
                <p className="text-(--color-text-secondary) text-sm">Track all admin actions across the system</p>
            </div>

            {/* Filters */}
            <div className="mb-6 p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                <div className="flex items-center gap-2 mb-3">
                    <Search className="w-4 h-4 text-(--color-text-secondary)" />
                    <span className="text-sm font-medium text-(--color-text-secondary)">Filters</span>
                    {hasFilters && (
                        <button onClick={clearFilters} className="ml-auto text-xs text-(--color-accent) hover:underline flex items-center gap-1">
                            <X className="w-3 h-3" /> Clear all
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <select
                        value={endpoint}
                        onChange={e => setEndpoint(e.target.value)}
                        className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-(--color-text) focus:outline-none focus:border-(--color-accent)"
                    >
                        <option value="">All endpoints</option>
                        {filterOptions.endpoints.map(ep => (
                            <option key={ep} value={ep}>{ep}</option>
                        ))}
                    </select>

                    <select
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-(--color-text) focus:outline-none focus:border-(--color-accent)"
                    >
                        <option value="">All users</option>
                        {filterOptions.usernames.map(u => (
                            <option key={u} value={u}>{u}</option>
                        ))}
                    </select>

                    <input
                        type="text"
                        placeholder="Search action..."
                        value={action}
                        onChange={e => setAction(e.target.value)}
                        className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-(--color-text) placeholder:text-(--color-text-secondary)/50 focus:outline-none focus:border-(--color-accent)"
                    />

                    <input
                        type="date"
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-(--color-text) focus:outline-none focus:border-(--color-accent)"
                        title="From date"
                    />

                    <input
                        type="date"
                        value={dateTo}
                        onChange={e => setDateTo(e.target.value)}
                        className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-(--color-text) focus:outline-none focus:border-(--color-accent)"
                        title="To date"
                    />
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 rounded-lg bg-red-900/20 border border-red-500/20 text-red-400 text-sm">{error}</div>
            )}

            {/* Table */}
            <div className="rounded-xl border border-white/10 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/[0.03]">
                                <th className="text-left px-4 py-3 font-medium text-(--color-text-secondary)">Time</th>
                                <th className="text-left px-4 py-3 font-medium text-(--color-text-secondary)">User</th>
                                <th className="text-left px-4 py-3 font-medium text-(--color-text-secondary)">Endpoint</th>
                                <th className="text-left px-4 py-3 font-medium text-(--color-text-secondary)">Action</th>
                                <th className="text-left px-4 py-3 font-medium text-(--color-text-secondary)">Target</th>
                                <th className="text-left px-4 py-3 font-medium text-(--color-text-secondary)">League</th>
                                <th className="text-left px-4 py-3 font-medium text-(--color-text-secondary)">Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && !data ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-(--color-accent) mx-auto" />
                                    </td>
                                </tr>
                            ) : data?.rows?.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-(--color-text-secondary)">
                                        No audit log entries found{hasFilters ? ' matching your filters' : ''}.
                                    </td>
                                </tr>
                            ) : (
                                data?.rows?.map(row => (
                                    <tr key={row.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                        <td className="px-4 py-3 whitespace-nowrap text-(--color-text-secondary) text-xs">
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="w-3 h-3 opacity-50" />
                                                {formatDate(row.created_at)}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-(--color-text)">
                                            {row.username || <span className="text-(--color-text-secondary) italic">deleted</span>}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${ENDPOINT_COLORS[row.endpoint] || 'bg-gray-500/20 text-gray-300'}`}>
                                                {row.endpoint}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-(--color-text) font-mono text-xs">
                                            {row.action}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-(--color-text-secondary) text-xs">
                                            {row.target_type && (
                                                <span>{row.target_type}{row.target_id ? ` #${row.target_id}` : ''}</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-(--color-text-secondary) text-xs">
                                            {row.league_name || ''}
                                        </td>
                                        <td className="px-4 py-3 max-w-xs">
                                            {row.details && (
                                                <DetailsCell details={row.details} />
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {data && data.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm text-(--color-text-secondary)">
                        {data.total.toLocaleString()} entries &middot; Page {data.page} of {data.totalPages}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className="p-2 rounded-lg border border-white/10 text-(--color-text-secondary) hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                            disabled={page >= data.totalPages}
                            className="p-2 rounded-lg border border-white/10 text-(--color-text-secondary) hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

/** Expandable JSON details cell */
function DetailsCell({ details }) {
    const [expanded, setExpanded] = useState(false)
    const obj = typeof details === 'string' ? JSON.parse(details) : details
    const preview = Object.entries(obj).slice(0, 2).map(([k, v]) => `${k}: ${typeof v === 'object' ? '...' : v}`).join(', ')

    return (
        <div className="text-xs">
            {expanded ? (
                <div>
                    <pre className="whitespace-pre-wrap text-(--color-text-secondary) font-mono bg-white/5 rounded p-2 max-h-48 overflow-auto">
                        {JSON.stringify(obj, null, 2)}
                    </pre>
                    <button onClick={() => setExpanded(false)} className="text-(--color-accent) hover:underline mt-1">collapse</button>
                </div>
            ) : (
                <button
                    onClick={() => setExpanded(true)}
                    className="text-(--color-text-secondary) hover:text-(--color-text) truncate block max-w-xs"
                    title="Click to expand"
                >
                    {preview}
                </button>
            )}
        </div>
    )
}

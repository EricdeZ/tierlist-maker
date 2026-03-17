import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { vaultDashboardService } from '../../services/database'
import { useAuth } from '../../context/AuthContext'
import { RARITIES } from '../../data/vault/economy'
import { FileText } from 'lucide-react'
import MiniCardPreview from './preview/MiniCardPreview'

const STATUS_OPTIONS = ['draft', 'pending_review', 'approved', 'rejected']

const STATUS_COLORS = {
    draft: 'bg-gray-600/20 text-gray-400',
    pending_review: 'bg-yellow-600/20 text-yellow-400',
    approved: 'bg-green-600/20 text-green-400',
    rejected: 'bg-red-600/20 text-red-400',
}

const STATUS_LABELS = {
    draft: 'Draft',
    pending_review: 'Pending Review',
    approved: 'Approved',
    rejected: 'Rejected',
}

export default function DraftsPage() {
    const navigate = useNavigate()
    const { hasPermission } = useAuth()
    const canApprove = hasPermission('vault_approve')

    const [drafts, setDrafts] = useState([])
    const [loading, setLoading] = useState(true)
    const [filterStatus, setFilterStatus] = useState('')
    const [filterRarity, setFilterRarity] = useState('')

    const fetchDrafts = useCallback(async () => {
        setLoading(true)
        try {
            const params = {}
            if (filterStatus) params.status = filterStatus
            if (filterRarity) params.rarity = filterRarity
            const data = await vaultDashboardService.getDrafts(params)
            setDrafts(data.drafts || [])
        } catch (err) {
            console.error('Failed to load drafts:', err)
        } finally {
            setLoading(false)
        }
    }, [filterStatus, filterRarity])

    useEffect(() => {
        fetchDrafts()
    }, [fetchDrafts])

    const handleApprove = async (e, id) => {
        e.stopPropagation()
        await vaultDashboardService.approve('draft', id)
        fetchDrafts()
    }

    const handleReject = async (e, id) => {
        e.stopPropagation()
        const reason = prompt('Rejection reason (optional):')
        await vaultDashboardService.reject('draft', id, reason)
        fetchDrafts()
    }

    return (
        <div className="max-w-7xl mx-auto px-4 py-6">
            <h1 className="text-2xl font-bold text-white mb-6">Drafts</h1>

            {/* Filter bar */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
                >
                    <option value="">All Statuses</option>
                    {STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                </select>
                <select
                    value={filterRarity}
                    onChange={e => setFilterRarity(e.target.value)}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
                >
                    <option value="">All Rarities</option>
                    {Object.keys(RARITIES).map(r => (
                        <option key={r} value={r}>{RARITIES[r].name || r}</option>
                    ))}
                </select>
            </div>

            {/* Content */}
            {loading && (
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-20 bg-gray-800 rounded-lg animate-pulse" />
                    ))}
                </div>
            )}

            {!loading && drafts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                    <FileText size={48} strokeWidth={1} />
                    <p className="mt-4">No drafts found.</p>
                </div>
            )}

            {!loading && drafts.length > 0 && (
                <div className="space-y-2">
                    {drafts.map(d => (
                        <div
                            key={d.id}
                            onClick={() => navigate('/vault-dashboard', { state: { loadDraft: d.id } })}
                            className="flex items-center gap-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700/50 hover:border-amber-500/30 cursor-pointer transition-colors"
                        >
                            {/* Preview */}
                            <MiniCardPreview templateData={d.template_data} />

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <p className="text-white font-medium truncate">
                                    Card Draft #{d.id}
                                    {d.card_type && (
                                        <span className="text-gray-400 font-normal">
                                            {' \u2014 '}{d.card_type.charAt(0).toUpperCase() + d.card_type.slice(1)}
                                        </span>
                                    )}
                                </p>
                                <p className="text-sm text-gray-400 mt-0.5">
                                    {d.rarity && (
                                        <span style={{ color: RARITIES[d.rarity]?.color }}>
                                            {RARITIES[d.rarity]?.name || d.rarity}
                                        </span>
                                    )}
                                    {d.creator_name && (
                                        <>
                                            {d.rarity ? ' \u00b7 ' : ''}
                                            <span className="text-gray-500">{d.creator_name}</span>
                                        </>
                                    )}
                                </p>
                                {d.notes && (
                                    <p className="text-xs text-gray-500 mt-1 truncate">{d.notes}</p>
                                )}
                                {d.rejection_reason && (
                                    <p className="text-xs text-red-400 mt-1 truncate">Rejected: {d.rejection_reason}</p>
                                )}
                            </div>

                            {/* Status badge */}
                            <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${STATUS_COLORS[d.status] || 'bg-gray-600/20 text-gray-400'}`}>
                                {STATUS_LABELS[d.status] || d.status}
                            </span>

                            {/* Actions */}
                            {canApprove && d.status === 'pending_review' && (
                                <div className="flex gap-2 flex-shrink-0">
                                    <button
                                        onClick={e => handleApprove(e, d.id)}
                                        className="px-2 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-xs transition-colors"
                                    >
                                        Approve
                                    </button>
                                    <button
                                        onClick={e => handleReject(e, d.id)}
                                        className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs transition-colors"
                                    >
                                        Reject
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

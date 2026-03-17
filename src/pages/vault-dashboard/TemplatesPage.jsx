import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { vaultDashboardService } from '../../services/database'
import { useAuth } from '../../context/AuthContext'
import { RARITIES } from '../../data/vault/economy'
import { Search, FileText } from 'lucide-react'
import MiniCardPreview from './preview/MiniCardPreview'

const CARD_TYPES = ['player', 'god', 'item', 'consumable', 'minion', 'buff', 'custom']
const STATUS_OPTIONS = ['draft', 'pending_review', 'approved', 'rejected', 'archived']

const STATUS_COLORS = {
    draft: 'bg-gray-600/20 text-gray-400',
    pending_review: 'bg-yellow-600/20 text-yellow-400',
    approved: 'bg-green-600/20 text-green-400',
    rejected: 'bg-red-600/20 text-red-400',
    archived: 'bg-gray-500/20 text-gray-500',
}

const STATUS_LABELS = {
    draft: 'Draft',
    pending_review: 'Pending Review',
    approved: 'Approved',
    rejected: 'Rejected',
    archived: 'Archived',
}

export default function TemplatesPage() {
    const navigate = useNavigate()
    const { hasPermission } = useAuth()
    const canApprove = hasPermission('vault_approve')

    const [templates, setTemplates] = useState([])
    const [loading, setLoading] = useState(true)
    const [filterStatus, setFilterStatus] = useState('')
    const [filterRarity, setFilterRarity] = useState('')
    const [filterType, setFilterType] = useState('')
    const [searchQuery, setSearchQuery] = useState('')

    const fetchTemplates = useCallback(async () => {
        setLoading(true)
        try {
            const params = {}
            if (filterStatus) params.status = filterStatus
            if (filterRarity) params.rarity = filterRarity
            if (filterType) params.card_type = filterType
            const data = await vaultDashboardService.getTemplates(params)
            setTemplates(data.templates || [])
        } catch (err) {
            console.error('Failed to load templates:', err)
        } finally {
            setLoading(false)
        }
    }, [filterStatus, filterRarity, filterType])

    useEffect(() => {
        fetchTemplates()
    }, [fetchTemplates])

    const handleApprove = async (e, id) => {
        e.stopPropagation()
        await vaultDashboardService.approve('template', id)
        fetchTemplates()
    }

    const handleReject = async (e, id) => {
        e.stopPropagation()
        const reason = prompt('Rejection reason (optional):')
        await vaultDashboardService.reject('template', id, reason)
        fetchTemplates()
    }

    const handleArchive = async (e, id) => {
        e.stopPropagation()
        await vaultDashboardService.archiveTemplate(id)
        fetchTemplates()
    }

    const filtered = searchQuery
        ? templates.filter(t => t.name?.toLowerCase().includes(searchQuery.toLowerCase()))
        : templates

    return (
        <div className="max-w-7xl mx-auto px-4 py-6">
            <h1 className="text-2xl font-bold text-white mb-6">Templates</h1>

            {/* Filter bar */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search templates..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                    />
                </div>
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
                <select
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
                >
                    <option value="">All Types</option>
                    {CARD_TYPES.map(t => (
                        <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
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

            {!loading && filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                    <FileText size={48} strokeWidth={1} />
                    <p className="mt-4">No templates found.</p>
                </div>
            )}

            {!loading && filtered.length > 0 && (
                <div className="space-y-2">
                    {filtered.map(t => (
                        <div
                            key={t.id}
                            onClick={() => navigate('/vault-dashboard', { state: { loadTemplate: t.id } })}
                            className="flex items-center gap-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700/50 hover:border-amber-500/30 cursor-pointer transition-colors"
                        >
                            {/* Preview */}
                            <MiniCardPreview templateData={t.template_data} />

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <p className="text-white font-medium truncate">{t.name}</p>
                                <p className="text-sm text-gray-400 mt-0.5">
                                    <span className="capitalize">{t.card_type}</span>
                                    {t.rarity && (
                                        <>
                                            {' \u00b7 '}
                                            <span style={{ color: RARITIES[t.rarity]?.color }}>
                                                {RARITIES[t.rarity]?.name || t.rarity}
                                            </span>
                                        </>
                                    )}
                                    {t.creator_name && (
                                        <>
                                            {' \u00b7 '}
                                            <span className="text-gray-500">{t.creator_name}</span>
                                        </>
                                    )}
                                </p>
                            </div>

                            {/* Status badge */}
                            <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${STATUS_COLORS[t.status] || 'bg-gray-600/20 text-gray-400'}`}>
                                {STATUS_LABELS[t.status] || t.status}
                            </span>

                            {/* Actions */}
                            {canApprove && (
                                <div className="flex gap-2 flex-shrink-0">
                                    {t.status === 'pending_review' && (
                                        <>
                                            <button
                                                onClick={e => handleApprove(e, t.id)}
                                                className="px-2 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-xs transition-colors"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                onClick={e => handleReject(e, t.id)}
                                                className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs transition-colors"
                                            >
                                                Reject
                                            </button>
                                        </>
                                    )}
                                    {t.status === 'approved' && (
                                        <button
                                            onClick={e => handleArchive(e, t.id)}
                                            className="px-2 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-xs transition-colors"
                                        >
                                            Archive
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

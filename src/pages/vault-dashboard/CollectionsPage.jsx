import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { vaultDashboardService } from '../../services/database'
import { useAuth } from '../../context/AuthContext'
import { Search, Plus, X, Trash2, Archive, CheckCircle, FileText, Eye, ExternalLink, Upload, Image } from 'lucide-react'
import CanvasCard from '../vault/components/CanvasCard'
import CollectionShowcase from './CollectionShowcase'

const STATUS_COLORS = {
    draft: 'bg-gray-600/20 text-gray-400',
    active: 'bg-green-600/20 text-green-400',
    archived: 'bg-gray-500/20 text-gray-500',
}

export default function CollectionsPage() {
    const { hasPermission } = useAuth()
    const canApprove = hasPermission('vault_approve')

    const [collections, setCollections] = useState([])
    const [loading, setLoading] = useState(true)
    const [filterStatus, setFilterStatus] = useState('')
    const [editingId, setEditingId] = useState(null)

    const fetchCollections = useCallback(async () => {
        try {
            const data = await vaultDashboardService.getCollections()
            setCollections(data.collections || [])
        } catch (err) {
            console.error('Failed to load collections:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchCollections() }, [fetchCollections])

    const filtered = useMemo(() => {
        let list = collections
        if (filterStatus) list = list.filter(c => c.status === filterStatus)
        return list
    }, [collections, filterStatus])

    if (editingId !== null) {
        return (
            <CollectionEditor
                id={editingId}
                canApprove={canApprove}
                onBack={() => { setEditingId(null); fetchCollections() }}
                onCreated={(newId) => setEditingId(newId)}
            />
        )
    }

    return (
        <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-bold text-white">Collections</h1>
                {canApprove && (
                    <button
                        onClick={() => setEditingId('new')}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        New Collection
                    </button>
                )}
            </div>

            <div className="flex gap-2 mb-4">
                {['', 'draft', 'active', 'archived'].map(s => (
                    <button
                        key={s}
                        onClick={() => setFilterStatus(s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            filterStatus === s
                                ? 'bg-white/10 text-white border border-white/20'
                                : 'bg-white/[0.03] text-white/40 hover:text-white/60 border border-transparent'
                        }`}
                    >
                        {s || 'All'}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-20 text-white/30">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-bold">No collections found</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(c => (
                        <div
                            key={c.id}
                            onClick={() => setEditingId(c.id)}
                            className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors cursor-pointer"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-white">{c.name}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold ${STATUS_COLORS[c.status] || STATUS_COLORS.draft}`}>
                                        {c.status}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 mt-0.5 text-xs text-white/40">
                                    <span>{c.entry_count} card{c.entry_count !== 1 ? 's' : ''}</span>
                                    {c.creator_name && <span>by {c.creator_name}</span>}
                                    <span>{new Date(c.updated_at).toLocaleDateString()}</span>
                                </div>
                            </div>
                            {c.slug && c.status === 'active' && (
                                <a
                                    href={`/vault/showcase/${c.slug}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-cyan-600/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-600/25 transition-colors no-underline shrink-0"
                                >
                                    <Eye className="w-3 h-3" /> Showcase
                                </a>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function CollectionEditor({ id, canApprove, onBack, onCreated }) {
    const isNew = id === 'new'
    const [collection, setCollection] = useState({ name: '', description: '', status: 'draft' })
    const [entries, setEntries] = useState([])
    const [loading, setLoading] = useState(!isNew)
    const [saving, setSaving] = useState(false)
    const [showBrowser, setShowBrowser] = useState(false)
    const [showShowcase, setShowShowcase] = useState(false)
    const [uploadingCover, setUploadingCover] = useState(false)
    const coverInputRef = useRef(null)

    const handleCoverUpload = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploadingCover(true)
        try {
            const res = await vaultDashboardService.uploadAsset(file, {
                name: `collection-cover-${collection.id || 'new'}`,
                category: 'collections',
            })
            if (res.asset?.url) {
                setCollection(prev => ({ ...prev, cover_image_url: res.asset.url }))
            }
        } catch (err) {
            console.error('Cover upload failed:', err)
        } finally {
            setUploadingCover(false)
            if (coverInputRef.current) coverInputRef.current.value = ''
        }
    }

    useEffect(() => {
        if (isNew) return
        vaultDashboardService.getCollection(id).then(data => {
            setCollection(data.collection)
            setEntries(data.entries || [])
            setLoading(false)
        }).catch(() => setLoading(false))
    }, [id, isNew])

    const handleSave = async () => {
        setSaving(true)
        try {
            const result = await vaultDashboardService.saveCollection({
                id: isNew ? undefined : collection.id,
                name: collection.name,
                description: collection.description,
                cover_image_url: collection.cover_image_url,
            })
            if (isNew && result.collection?.id) {
                setCollection(result.collection)
                onCreated?.(result.collection.id)
            }
        } catch (err) {
            console.error('Save failed:', err)
        } finally {
            setSaving(false)
        }
    }

    const handleStatus = async (status) => {
        try {
            await vaultDashboardService.setCollectionStatus(collection.id, status)
            setCollection(prev => ({ ...prev, status }))
        } catch (err) {
            console.error('Status change failed:', err)
        }
    }

    const handleRemoveEntry = async (entryId) => {
        try {
            await vaultDashboardService.removeCollectionEntry(entryId)
            setEntries(prev => prev.filter(e => e.id !== entryId))
        } catch (err) {
            console.error('Remove failed:', err)
        }
    }

    const handleAddEntries = async (selectedItems) => {
        if (!collection.id) return
        try {
            const blueprintIds = selectedItems.map(i => i.id)
            await vaultDashboardService.addCollectionEntries(collection.id, blueprintIds)
            const data = await vaultDashboardService.getCollection(collection.id)
            setEntries(data.entries || [])
        } catch (err) {
            console.error('Add failed:', err)
        }
        setShowBrowser(false)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
            </div>
        )
    }

    return (
        <div className="max-w-5xl mx-auto">
            <button onClick={onBack} className="text-xs text-white/40 hover:text-white/70 mb-4 cursor-pointer">&larr; Back to Collections</button>

            <div className="space-y-4">
                {/* Name & Description */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs text-white/50 mb-1">Name</label>
                        <input
                            value={collection.name}
                            onChange={e => setCollection(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white"
                            placeholder="Collection name"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-white/50 mb-1">Description</label>
                        <input
                            value={collection.description || ''}
                            onChange={e => setCollection(prev => ({ ...prev, description: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white"
                            placeholder="Optional description"
                        />
                    </div>
                </div>

                {/* Cover Image */}
                <div>
                    <label className="block text-xs text-white/50 mb-1">Cover Image</label>
                    <div className="flex items-center gap-3">
                        {collection.cover_image_url ? (
                            <div className="relative group">
                                <img
                                    src={collection.cover_image_url}
                                    alt="Cover"
                                    className="w-12 h-12 rounded-lg object-cover border border-white/10"
                                />
                                <button
                                    onClick={() => setCollection(prev => ({ ...prev, cover_image_url: null }))}
                                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ) : (
                            <div className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                                <Image className="w-5 h-5 text-white/20" />
                            </div>
                        )}
                        <button
                            onClick={() => coverInputRef.current?.click()}
                            disabled={uploadingCover}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
                        >
                            {uploadingCover ? 'Uploading...' : <><Upload className="w-3 h-3" /> {collection.cover_image_url ? 'Replace' : 'Upload'}</>}
                        </button>
                        <input
                            ref={coverInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            onChange={handleCoverUpload}
                            className="hidden"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSave}
                        disabled={saving || !collection.name?.trim()}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 transition-colors cursor-pointer"
                    >
                        {saving ? 'Saving...' : isNew ? 'Create' : 'Save'}
                    </button>

                    {!isNew && canApprove && (
                        <>
                            {collection.status === 'draft' && (
                                <button onClick={() => handleStatus('active')} className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold bg-green-600/15 text-green-400 border border-green-500/30 hover:bg-green-600/25 transition-colors cursor-pointer">
                                    <CheckCircle className="w-3.5 h-3.5" /> Activate
                                </button>
                            )}
                            {collection.status === 'active' && (
                                <button onClick={() => handleStatus('archived')} className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold bg-gray-500/15 text-gray-400 border border-gray-500/30 hover:bg-gray-500/25 transition-colors cursor-pointer">
                                    <Archive className="w-3.5 h-3.5" /> Archive
                                </button>
                            )}
                            {collection.status === 'archived' && (
                                <button onClick={() => handleStatus('draft')} className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold bg-gray-500/15 text-gray-400 border border-gray-500/30 hover:bg-gray-500/25 transition-colors cursor-pointer">
                                    Revert to Draft
                                </button>
                            )}
                        </>
                    )}

                    <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold ${
                        collection.status === 'active' ? 'bg-green-600/20 text-green-400' :
                        collection.status === 'archived' ? 'bg-gray-500/20 text-gray-500' :
                        'bg-gray-600/20 text-gray-400'
                    }`}>
                        {collection.status || 'draft'}
                    </span>

                    {collection.slug && collection.status === 'active' && (
                        <a
                            href={`/vault/showcase/${collection.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold bg-cyan-600/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-600/25 transition-colors no-underline"
                        >
                            <ExternalLink className="w-3.5 h-3.5" /> Showcase
                        </a>
                    )}
                </div>

                {/* Entries */}
                {!isNew && (
                    <>
                        <div className="flex items-center justify-between mt-6">
                            <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider">
                                Cards ({entries.length})
                            </h2>
                            {canApprove && (
                                <button
                                    onClick={() => setShowBrowser(true)}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600/15 text-amber-400 border border-amber-500/30 hover:bg-amber-600/25 transition-colors cursor-pointer"
                                >
                                    <Plus className="w-3 h-3" /> Add Cards
                                </button>
                            )}
                        </div>

                        {entries.length === 0 ? (
                            <div className="text-center py-12 text-white/20">
                                <p className="text-sm">No cards in this collection yet</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                {entries.map(entry => (
                                    <div key={entry.id} className="relative group">
                                        <div className="rounded-lg bg-white/5 border border-white/10 p-2">
                                            {entry.thumbnail_url ? (
                                                <img src={entry.thumbnail_url} alt="" className="w-full aspect-[63/88] object-cover rounded" />
                                            ) : (
                                                <CanvasCard
                                                    elements={entry.template_data?.elements}
                                                    border={entry.template_data?.border}
                                                    size={120}
                                                />
                                            )}
                                            <div className="mt-1.5">
                                                <div className="text-xs font-bold text-white truncate">{entry.template_name}</div>
                                                <div className="text-[10px] text-white/30">{entry.card_type}</div>
                                            </div>
                                        </div>
                                        {canApprove && (
                                            <button
                                                onClick={() => handleRemoveEntry(entry.id)}
                                                className="absolute top-1 right-1 p-1 rounded bg-black/60 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Template browser modal */}
            {showBrowser && (
                <TemplateBrowser
                    existingEntries={entries}
                    onAdd={handleAddEntries}
                    onClose={() => setShowBrowser(false)}
                />
            )}
        </div>
    )
}

function TemplateBrowser({ existingEntries, onAdd, onClose }) {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)
    const [selected, setSelected] = useState(new Map())
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState('')

    useEffect(() => {
        vaultDashboardService.getBlueprints({ status: 'approved' }).then(data => {
            setItems(data.blueprints || [])
            setLoading(false)
        }).catch(() => setLoading(false))
    }, [])

    const existingKeys = useMemo(() =>
        new Set(existingEntries.map(e => e.blueprint_id)),
        [existingEntries]
    )

    const filtered = useMemo(() => {
        let list = items.filter(i => !existingKeys.has(i.id))
        if (search.trim()) {
            const q = search.toLowerCase()
            list = list.filter(i => i.name?.toLowerCase().includes(q))
        }
        if (typeFilter) list = list.filter(i => i.card_type === typeFilter)
        return list
    }, [items, existingKeys, search, typeFilter])

    const toggleSelect = (item) => {
        setSelected(prev => {
            const next = new Map(prev)
            next.has(item.id) ? next.delete(item.id) : next.set(item.id, { id: item.id })
            return next
        })
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-[#1a1a2e] rounded-xl border border-white/10 w-[90vw] max-w-3xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h3 className="text-sm font-bold text-white">Add Approved Cards</h3>
                    <button onClick={onClose} className="text-white/40 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
                </div>

                <div className="flex items-center gap-2 p-3 border-b border-white/5">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search cards..."
                            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-white/30"
                        />
                    </div>
                    <select
                        value={typeFilter}
                        onChange={e => setTypeFilter(e.target.value)}
                        className="px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white"
                    >
                        <option value="">All types</option>
                        {['player', 'god', 'item', 'consumable', 'custom'].map(t => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                </div>

                <div className="flex-1 overflow-y-auto p-3">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-12 text-white/20 text-sm">No cards available</div>
                    ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                            {filtered.map(item => (
                                <div
                                    key={item.id}
                                    onClick={() => toggleSelect(item)}
                                    className={`rounded-lg p-2 cursor-pointer transition-all border ${
                                        selected.has(item.id)
                                            ? 'bg-amber-500/15 border-amber-500/40'
                                            : 'bg-white/[0.03] border-white/5 hover:border-white/15'
                                    }`}
                                >
                                    {item.thumbnail_url ? (
                                        <img src={item.thumbnail_url} alt="" className="w-full aspect-[63/88] object-cover rounded" />
                                    ) : item.template_data?.elements ? (
                                        <CanvasCard
                                            elements={item.template_data.elements}
                                            border={item.template_data.border}
                                            size={120}
                                        />
                                    ) : (
                                        <div className="w-full aspect-[63/88] bg-white/5 rounded flex items-center justify-center text-[10px] text-white/20">
                                            No preview
                                        </div>
                                    )}
                                    <div className="mt-1 text-[10px] font-bold text-white truncate">{item.name}</div>
                                    <div className="text-[9px] text-white/30">{item.card_type}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between p-3 border-t border-white/10">
                    <span className="text-xs text-white/40">{selected.size} selected</span>
                    <button
                        onClick={() => onAdd([...selected.values()])}
                        disabled={selected.size === 0}
                        className="px-4 py-2 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-30 transition-colors cursor-pointer"
                    >
                        Add Selected
                    </button>
                </div>
            </div>
        </div>
    )
}

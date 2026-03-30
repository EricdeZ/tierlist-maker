import { useState, useEffect, useCallback, useRef } from 'react'
import compressImage from './compressImage'
import { vaultDashboardService } from '../../services/database'
import { useAuth } from '../../context/AuthContext'
import { Upload, Search, Trash2, X, Image, Filter } from 'lucide-react'

const CATEGORIES = ['background', 'frame', 'overlay', 'texture', 'character', 'effect']

const CATEGORY_COLORS = {
    background: 'bg-blue-600/20 text-blue-400',
    frame: 'bg-purple-600/20 text-purple-400',
    overlay: 'bg-green-600/20 text-green-400',
    texture: 'bg-orange-600/20 text-orange-400',
    character: 'bg-red-600/20 text-red-400',
    effect: 'bg-cyan-600/20 text-cyan-400',
}

function formatFileSize(bytes) {
    if (!bytes) return 'Unknown'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function AssetsPage() {
    const { hasPermission } = useAuth()
    const canApprove = hasPermission('vault_approve')

    const [assets, setAssets] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    // Filters
    const [search, setSearch] = useState('')
    const [category, setCategory] = useState('')
    const searchTimeout = useRef(null)

    // Modals
    const [showUpload, setShowUpload] = useState(false)
    const [detailAsset, setDetailAsset] = useState(null)

    const fetchAssets = useCallback(async (params = {}) => {
        setLoading(true)
        setError(null)
        try {
            const data = await vaultDashboardService.getAssets(params)
            setAssets(data.assets || [])
        } catch (err) {
            console.error('Failed to load assets:', err)
            setError('Failed to load assets')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        const params = {}
        if (category) params.category = category
        if (search.trim()) params.search = search.trim()
        fetchAssets(params)
    }, [category, fetchAssets]) // search is debounced separately

    const handleSearchChange = (val) => {
        setSearch(val)
        clearTimeout(searchTimeout.current)
        searchTimeout.current = setTimeout(() => {
            const params = {}
            if (category) params.category = category
            if (val.trim()) params.search = val.trim()
            fetchAssets(params)
        }, 300)
    }

    const handleUploadComplete = (newAsset) => {
        setShowUpload(false)
        if (newAsset) {
            setAssets(prev => [newAsset, ...prev])
        }
    }

    const handleDelete = async (id) => {
        try {
            await vaultDashboardService.deleteAsset(id)
            setAssets(prev => prev.filter(a => a.id !== id))
            setDetailAsset(null)
        } catch (err) {
            console.error('Failed to delete asset:', err)
        }
    }

    return (
        <div className="max-w-7xl mx-auto px-4 py-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-white">Asset Library</h1>
                <button
                    onClick={() => setShowUpload(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition-colors"
                >
                    <Upload size={16} />
                    Upload Asset
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search assets..."
                        value={search}
                        onChange={e => handleSearchChange(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                    />
                </div>
                <div className="relative">
                    <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    <select
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                        className="pl-9 pr-8 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500 appearance-none cursor-pointer"
                    >
                        <option value="">All Categories</option>
                        {CATEGORIES.map(c => (
                            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Content */}
            {error && (
                <div className="text-center py-12">
                    <p className="text-red-400">{error}</p>
                    <button
                        onClick={() => fetchAssets({ ...(category && { category }), ...(search.trim() && { search: search.trim() }) })}
                        className="mt-3 text-sm text-amber-500 hover:text-amber-400"
                    >
                        Try again
                    </button>
                </div>
            )}

            {loading && !error && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="aspect-square bg-gray-800 rounded-lg animate-pulse" />
                    ))}
                </div>
            )}

            {!loading && !error && assets.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                    <Image size={48} strokeWidth={1} />
                    <p className="mt-4 text-lg font-medium text-gray-400">No assets found</p>
                    <p className="mt-1 text-sm">
                        {search || category ? 'Try adjusting your filters' : 'Upload your first asset to get started'}
                    </p>
                    {!search && !category && (
                        <button
                            onClick={() => setShowUpload(true)}
                            className="mt-4 flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            <Upload size={16} />
                            Upload Asset
                        </button>
                    )}
                </div>
            )}

            {!loading && !error && assets.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {assets.map(asset => (
                        <button
                            key={asset.id}
                            onClick={() => setDetailAsset(asset)}
                            className="group relative bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-gray-600 transition-colors text-left"
                        >
                            <div className="aspect-square bg-gray-900">
                                <img
                                    src={asset.thumbnail_url || asset.url}
                                    alt={asset.name}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                />
                            </div>
                            <div className="p-2">
                                <p className="text-xs text-white truncate font-medium">{asset.name}</p>
                                <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${CATEGORY_COLORS[asset.category] || 'bg-gray-700 text-gray-300'}`}>
                                    {asset.category}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Upload Modal */}
            {showUpload && (
                <UploadModal
                    onClose={() => setShowUpload(false)}
                    onComplete={handleUploadComplete}
                />
            )}

            {/* Detail Modal */}
            {detailAsset && (
                <DetailModal
                    asset={detailAsset}
                    canDelete={canApprove}
                    onDelete={handleDelete}
                    onClose={() => setDetailAsset(null)}
                />
            )}
        </div>
    )
}

function UploadModal({ onClose, onComplete }) {
    const [file, setFile] = useState(null)
    const [preview, setPreview] = useState(null)
    const [name, setName] = useState('')
    const [category, setCategory] = useState('background')
    const [tags, setTags] = useState('')
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState(null)
    const [dragOver, setDragOver] = useState(false)
    const fileInputRef = useRef(null)

    const handleFile = (f) => {
        if (!f) return
        setFile(f)
        if (!name) setName(f.name.replace(/\.[^.]+$/, ''))
        const reader = new FileReader()
        reader.onload = (e) => setPreview(e.target.result)
        reader.readAsDataURL(f)
    }

    const handleDrop = (e) => {
        e.preventDefault()
        setDragOver(false)
        const f = e.dataTransfer.files?.[0]
        if (f && f.type.startsWith('image/')) handleFile(f)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!file) return

        setUploading(true)
        setError(null)
        try {
            const tagList = tags.split(',').map(t => t.trim()).filter(Boolean)
            const compressed = await compressImage(file)
            const data = await vaultDashboardService.uploadAsset(compressed, {
                name: name || file.name,
                category,
                tags: tagList,
            })
            if (data.success) {
                onComplete(data.asset)
            } else {
                setError(data.error || 'Upload failed')
            }
        } catch (err) {
            console.error('Upload failed:', err)
            setError('Upload failed. Please try again.')
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
            <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white">Upload Asset</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Drop zone */}
                    <div
                        className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                            dragOver ? 'border-amber-500 bg-amber-500/10' : 'border-gray-700 hover:border-gray-600'
                        }`}
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                    >
                        {preview ? (
                            <img src={preview} alt="Preview" className="mx-auto max-h-40 rounded object-contain" />
                        ) : (
                            <>
                                <Upload size={32} className="mx-auto text-gray-500 mb-2" />
                                <p className="text-sm text-gray-400">Click or drag an image to upload</p>
                                <p className="text-xs text-gray-600 mt-1">PNG, JPG, WebP, SVG</p>
                            </>
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => handleFile(e.target.files?.[0])}
                        />
                    </div>

                    {/* Name */}
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Asset name"
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                        />
                    </div>

                    {/* Category */}
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Category</label>
                        <select
                            value={category}
                            onChange={e => setCategory(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500 appearance-none cursor-pointer"
                        >
                            {CATEGORIES.map(c => (
                                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                            ))}
                        </select>
                    </div>

                    {/* Tags */}
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Tags (comma-separated)</label>
                        <input
                            type="text"
                            value={tags}
                            onChange={e => setTags(e.target.value)}
                            placeholder="e.g. dark, abstract, fire"
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                        />
                    </div>

                    {error && <p className="text-sm text-red-400">{error}</p>}

                    <button
                        type="submit"
                        disabled={!file || uploading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        {uploading ? (
                            <>
                                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Uploading...
                            </>
                        ) : (
                            <>
                                <Upload size={16} />
                                Upload
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    )
}

function DetailModal({ asset, canDelete, onDelete, onClose }) {
    const [confirming, setConfirming] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const handleDelete = async () => {
        if (!confirming) {
            setConfirming(true)
            return
        }
        setDeleting(true)
        await onDelete(asset.id)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
            <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white truncate pr-4">{asset.name}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors flex-shrink-0">
                        <X size={20} />
                    </button>
                </div>

                {/* Preview */}
                <div className="bg-gray-800 rounded-lg overflow-hidden mb-4">
                    <img
                        src={asset.url}
                        alt={asset.name}
                        className="w-full max-h-80 object-contain"
                    />
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                    <div>
                        <span className="text-gray-500">Category</span>
                        <div className="mt-1">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[asset.category] || 'bg-gray-700 text-gray-300'}`}>
                                {asset.category}
                            </span>
                        </div>
                    </div>
                    <div>
                        <span className="text-gray-500">Format</span>
                        <p className="text-white mt-1">{asset.metadata?.format || 'Unknown'}</p>
                    </div>
                    <div>
                        <span className="text-gray-500">Size</span>
                        <p className="text-white mt-1">{formatFileSize(asset.metadata?.size)}</p>
                    </div>
                    <div>
                        <span className="text-gray-500">Uploaded</span>
                        <p className="text-white mt-1">
                            {asset.created_at ? new Date(asset.created_at).toLocaleDateString() : 'Unknown'}
                        </p>
                    </div>
                </div>

                {/* Tags */}
                {asset.tags?.length > 0 && (
                    <div className="mb-4">
                        <span className="text-sm text-gray-500">Tags</span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                            {asset.tags.map(tag => (
                                <span key={tag} className="px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Delete */}
                {canDelete && (
                    <div className="flex justify-end pt-2 border-t border-gray-800">
                        <button
                            onClick={handleDelete}
                            disabled={deleting}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                confirming
                                    ? 'bg-red-600 hover:bg-red-500 text-white'
                                    : 'text-red-400 hover:text-red-300 hover:bg-red-600/10'
                            } disabled:opacity-50`}
                        >
                            <Trash2 size={14} />
                            {deleting ? 'Deleting...' : confirming ? 'Confirm Delete' : 'Delete'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

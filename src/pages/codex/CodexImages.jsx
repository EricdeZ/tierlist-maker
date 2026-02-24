import { useState, useEffect, useRef } from 'react'
import { codexService } from '../../services/database'
import PageTitle from '../../components/PageTitle'
import { ImagePlus, Trash2, Upload, X } from 'lucide-react'

export default function CodexImages() {
    const [images, setImages] = useState([])
    const [categories, setCategories] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [uploading, setUploading] = useState(false)
    const [filterCat, setFilterCat] = useState(null)
    const [uploadCategory, setUploadCategory] = useState('')
    const [editingCat, setEditingCat] = useState(null) // { id, category }
    const fileRef = useRef(null)

    const fetchData = async () => {
        setLoading(true)
        try {
            const data = await codexService.getImages()
            setImages(data.images || [])
            setCategories(data.categories || [])
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchData() }, [])

    const handleUpload = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.size > 512 * 1024) {
            alert('Image must be under 512KB')
            return
        }
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
            alert('Only JPEG, PNG, WebP, and GIF allowed')
            return
        }

        setUploading(true)
        try {
            await codexService.uploadImage(file, uploadCategory || null)
            await fetchData()
        } catch (err) {
            alert('Upload error: ' + err.message)
        } finally {
            setUploading(false)
            if (fileRef.current) fileRef.current.value = ''
        }
    }

    const handleDelete = async (image) => {
        if (!confirm(`Delete "${image.filename}"?`)) return
        try {
            await codexService.deleteImage(image.id)
            await fetchData()
        } catch (err) {
            alert('Error: ' + err.message)
        }
    }

    const handleCategoryUpdate = async (id, category) => {
        try {
            await codexService.updateImageCategory(id, category)
            setEditingCat(null)
            await fetchData()
        } catch (err) {
            alert('Error: ' + err.message)
        }
    }

    const filtered = filterCat
        ? images.filter(img => img.category === filterCat)
        : images

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-t-transparent border-white/20 mx-auto" />
            </div>
        )
    }

    return (
        <div className="max-w-5xl mx-auto px-4 py-8">
            <PageTitle title="Codex - Images" noindex />

            {error && (
                <div className="bg-red-900/20 border border-red-500/20 rounded-xl p-4 mb-4 text-red-400 text-sm">{error}</div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <ImagePlus className="w-6 h-6 text-(--color-accent)" />
                    <h1 className="font-heading text-2xl font-bold text-(--color-text)">Images</h1>
                    <span className="text-sm text-(--color-text-secondary)">({images.length})</span>
                </div>
            </div>

            {/* Upload zone */}
            <div className="bg-(--color-secondary) border border-white/10 rounded-xl p-5 mb-6">
                <h3 className="font-heading text-sm font-bold text-(--color-text) mb-3">Upload Image</h3>
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                    <div className="flex-1">
                        <label className="block text-xs text-(--color-text-secondary) uppercase tracking-wider mb-1">Category</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={uploadCategory}
                                onChange={e => setUploadCategory(e.target.value)}
                                className="flex-1 px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent)"
                                placeholder="e.g. item-icons, relics, gods"
                                list="category-suggestions"
                            />
                            <datalist id="category-suggestions">
                                {categories.map(c => <option key={c} value={c} />)}
                            </datalist>
                        </div>
                    </div>
                    <div>
                        <input
                            ref={fileRef}
                            type="file"
                            className="hidden"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            onChange={handleUpload}
                        />
                        <button
                            onClick={() => fileRef.current?.click()}
                            disabled={uploading}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-(--color-accent) hover:bg-(--color-accent)/80 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
                        >
                            <Upload className="w-4 h-4" />
                            {uploading ? 'Uploading...' : 'Choose File'}
                        </button>
                    </div>
                </div>
                <p className="text-xs text-(--color-text-secondary)/50 mt-2">JPEG, PNG, WebP, or GIF. Max 512KB.</p>
            </div>

            {/* Category filter */}
            {categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                    <button
                        onClick={() => setFilterCat(null)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${!filterCat ? 'bg-white/15 text-(--color-text) border border-white/20' : 'bg-white/5 text-(--color-text-secondary) hover:bg-white/10 border border-transparent'}`}
                    >
                        All
                    </button>
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setFilterCat(filterCat === cat ? null : cat)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${filterCat === cat ? 'bg-white/15 text-(--color-text) border border-white/20' : 'bg-white/5 text-(--color-text-secondary) hover:bg-white/10 border border-transparent'}`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            )}

            {/* Image grid */}
            {filtered.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {filtered.map(image => (
                        <div key={image.id} className="bg-(--color-secondary) border border-white/10 rounded-xl overflow-hidden group hover:border-white/20 transition-colors">
                            <div className="aspect-square bg-black/20 flex items-center justify-center p-2">
                                <img src={image.url} alt={image.filename} className="max-w-full max-h-full object-contain" loading="lazy" />
                            </div>
                            <div className="p-2">
                                <p className="text-xs text-(--color-text) truncate mb-1" title={image.filename}>{image.filename}</p>
                                {editingCat?.id === image.id ? (
                                    <div className="flex gap-1">
                                        <input
                                            type="text"
                                            value={editingCat.category}
                                            onChange={e => setEditingCat(prev => ({ ...prev, category: e.target.value }))}
                                            onKeyDown={e => { if (e.key === 'Enter') handleCategoryUpdate(image.id, editingCat.category); if (e.key === 'Escape') setEditingCat(null) }}
                                            className="flex-1 px-1.5 py-0.5 bg-black/20 border border-white/10 rounded text-xs text-(--color-text) focus:outline-none focus:border-(--color-accent)"
                                            autoFocus
                                            list="category-suggestions"
                                        />
                                        <button onClick={() => handleCategoryUpdate(image.id, editingCat.category)} className="text-xs text-(--color-accent) hover:underline cursor-pointer">Save</button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setEditingCat({ id: image.id, category: image.category || '' })}
                                        className="text-xs text-(--color-text-secondary)/50 hover:text-(--color-text-secondary) transition-colors cursor-pointer truncate block w-full text-left"
                                    >
                                        {image.category || 'No category — click to set'}
                                    </button>
                                )}
                            </div>
                            <div className="px-2 pb-2">
                                <button
                                    onClick={() => handleDelete(image)}
                                    className="w-full flex items-center justify-center gap-1 px-2 py-1 rounded-lg text-xs text-(--color-text-secondary) hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 className="w-3 h-3" /> Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-(--color-secondary) border border-white/10 rounded-xl p-12 text-center">
                    <ImagePlus className="w-12 h-12 mx-auto mb-4 text-(--color-text-secondary)/30" />
                    <p className="text-(--color-text-secondary) text-lg font-medium font-heading">
                        {filterCat ? 'No images in this category' : 'No images uploaded yet'}
                    </p>
                    <p className="text-(--color-text-secondary)/50 text-sm mt-1">Upload your first image above</p>
                </div>
            )}
        </div>
    )
}

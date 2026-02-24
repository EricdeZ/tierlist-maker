import { useState, useEffect, useRef } from 'react'
import { codexService } from '../../services/database'
import { ImagePlus, X, Upload } from 'lucide-react'

/**
 * Reusable image picker for selecting from uploaded codex images.
 * Props:
 *   value         - current image URL (or null)
 *   onChange       - callback with selected URL (or null to clear)
 *   onSelectFull  - optional callback with full image object { id, url, filename } on selection
 *   className     - optional wrapper class
 */
export default function CodexImagePicker({ value, onChange, onSelectFull, className = '' }) {
    const [open, setOpen] = useState(false)
    const [images, setImages] = useState([])
    const [categories, setCategories] = useState([])
    const [filterCat, setFilterCat] = useState(null)
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const dropdownRef = useRef(null)
    const fileRef = useRef(null)

    // Fetch images when opening
    useEffect(() => {
        if (!open) return
        let cancelled = false
        const load = async () => {
            setLoading(true)
            try {
                const data = await codexService.getImages()
                if (!cancelled) {
                    setImages(data.images || [])
                    setCategories(data.categories || [])
                }
            } catch {
                // Silently fail — picker is non-critical
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => { cancelled = true }
    }, [open])

    // Close on click outside
    useEffect(() => {
        if (!open) return
        const handle = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false)
        }
        document.addEventListener('mousedown', handle)
        return () => document.removeEventListener('mousedown', handle)
    }, [open])

    const handleSelect = (image) => {
        onChange(image.url)
        if (onSelectFull) onSelectFull(image)
        setOpen(false)
    }

    const handleClear = (e) => {
        e.stopPropagation()
        onChange(null)
    }

    const handleUpload = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (file.size > 512 * 1024) { alert('Image must be under 512KB'); return }
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) { alert('Only JPEG, PNG, WebP, GIF'); return }

        setUploading(true)
        try {
            const result = await codexService.uploadImage(file, filterCat || null)
            // Refresh list and auto-select
            const data = await codexService.getImages()
            setImages(data.images || [])
            setCategories(data.categories || [])
            if (result.image?.url) {
                onChange(result.image.url)
                setOpen(false)
            }
        } catch (err) {
            alert('Upload error: ' + err.message)
        } finally {
            setUploading(false)
            if (fileRef.current) fileRef.current.value = ''
        }
    }

    const filtered = filterCat ? images.filter(img => img.category === filterCat) : images

    return (
        <div ref={dropdownRef} className={`relative ${className}`}>
            {/* Trigger button */}
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2 w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-sm text-(--color-text) hover:border-white/20 transition-colors cursor-pointer text-left"
            >
                {value ? (
                    <>
                        <img src={value} alt="" className="w-6 h-6 rounded object-contain bg-black/20 shrink-0" />
                        <span className="flex-1 truncate text-(--color-text-secondary) text-xs">{value.split('/').pop()?.split('?')[0]}</span>
                        <button type="button" onClick={handleClear} className="p-0.5 rounded hover:bg-red-500/10 text-(--color-text-secondary) hover:text-red-400 transition-colors shrink-0">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </>
                ) : (
                    <>
                        <ImagePlus className="w-4 h-4 text-(--color-text-secondary)/40 shrink-0" />
                        <span className="text-(--color-text-secondary)/50">Select image...</span>
                    </>
                )}
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute z-50 left-0 top-full mt-1 w-80 max-h-96 bg-(--color-secondary) border border-white/10 rounded-xl shadow-xl overflow-hidden flex flex-col">
                    {/* Category tabs + upload */}
                    <div className="p-2 border-b border-white/5 flex flex-wrap gap-1 items-center">
                        <button
                            onClick={() => setFilterCat(null)}
                            className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${!filterCat ? 'bg-white/15 text-(--color-text)' : 'text-(--color-text-secondary) hover:bg-white/10'}`}
                        >
                            All
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setFilterCat(filterCat === cat ? null : cat)}
                                className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${filterCat === cat ? 'bg-white/15 text-(--color-text)' : 'text-(--color-text-secondary) hover:bg-white/10'}`}
                            >
                                {cat}
                            </button>
                        ))}
                        <div className="ml-auto">
                            <input ref={fileRef} type="file" className="hidden" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleUpload} />
                            <button
                                onClick={() => fileRef.current?.click()}
                                disabled={uploading}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs text-(--color-accent) hover:bg-(--color-accent)/10 transition-colors cursor-pointer disabled:opacity-50"
                            >
                                <Upload className="w-3 h-3" />
                                {uploading ? '...' : 'Upload'}
                            </button>
                        </div>
                    </div>

                    {/* Image grid */}
                    <div className="flex-1 overflow-y-auto p-2">
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-6 w-6 border-2 border-t-transparent border-white/20" />
                            </div>
                        ) : filtered.length > 0 ? (
                            <div className="grid grid-cols-4 gap-1.5">
                                {filtered.map(image => (
                                    <button
                                        key={image.id}
                                        onClick={() => handleSelect(image)}
                                        className={`aspect-square rounded-lg overflow-hidden bg-black/20 hover:ring-2 hover:ring-(--color-accent) transition-all cursor-pointer flex items-center justify-center p-1 ${value === image.url ? 'ring-2 ring-(--color-accent)' : 'border border-white/5'}`}
                                        title={image.filename}
                                    >
                                        <img src={image.url} alt={image.filename} className="max-w-full max-h-full object-contain" loading="lazy" />
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-6 text-xs text-(--color-text-secondary)/50">
                                {images.length === 0 ? 'No images uploaded yet' : 'No images in this category'}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

import { useState, useEffect, useRef } from 'react'
import { ImagePlus } from 'lucide-react'

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 512 * 1024

/**
 * Reusable image upload component with local preview.
 *
 * Two modes:
 *   Deferred:  Parent stores the File, uploads later (team creation flow)
 *              Props: file, onChange
 *
 *   Immediate: Uploads on pick via uploadFn, calls onComplete when done (team edit flow)
 *              Props: currentUrl, uploadFn, onComplete
 *
 * Common props:
 *   size        - preview square size in px (default 40)
 *   onError     - called with error message string
 *   removable   - show remove button (default true when there's something to remove)
 *   onRemove    - called when remove is clicked (immediate mode)
 */
export default function ImageUpload({
    // Deferred mode
    file,
    onChange,
    // Immediate mode
    currentUrl,
    uploadFn,
    onComplete,
    onRemove,
    // Common
    size = 40,
    onError,
}) {
    const fileRef = useRef(null)
    const [uploading, setUploading] = useState(false)
    const [previewUrl, setPreviewUrl] = useState(null)

    // Local file preview (deferred mode)
    useEffect(() => {
        if (!file) { setPreviewUrl(null); return }
        const url = URL.createObjectURL(file)
        setPreviewUrl(url)
        return () => URL.revokeObjectURL(url)
    }, [file])

    const isDeferred = typeof onChange === 'function'
    const displayUrl = previewUrl || currentUrl

    const handleFile = async (e) => {
        const f = e.target.files?.[0]
        if (fileRef.current) fileRef.current.value = ''
        if (!f) return

        if (f.size > MAX_SIZE) {
            onError?.('Image must be under 512KB')
            return
        }
        if (!ALLOWED.includes(f.type)) {
            onError?.('Only JPEG, PNG, WebP, and GIF allowed')
            return
        }

        if (isDeferred) {
            onChange(f)
        } else if (uploadFn) {
            setUploading(true)
            try {
                await uploadFn(f)
                onComplete?.()
            } catch (err) {
                onError?.(err.message || 'Upload failed')
            } finally {
                setUploading(false)
            }
        }
    }

    const handleRemove = async () => {
        if (isDeferred) {
            onChange(null)
        } else if (onRemove) {
            setUploading(true)
            try {
                await onRemove()
                onComplete?.()
            } catch (err) {
                onError?.(err.message || 'Remove failed')
            } finally {
                setUploading(false)
            }
        }
    }

    const hasImage = !!displayUrl
    const canRemove = hasImage && (isDeferred || onRemove)

    return (
        <div className="flex flex-col items-center gap-1">
            {displayUrl ? (
                <img
                    src={displayUrl}
                    className="rounded-lg object-cover border border-white/10"
                    style={{ width: size, height: size }}
                    alt=""
                />
            ) : (
                <div
                    className="rounded-lg border border-dashed border-white/20 flex items-center justify-center"
                    style={{ width: size, height: size }}
                >
                    <ImagePlus className="w-4 h-4 text-[var(--color-text-secondary)]" />
                </div>
            )}
            <input type="file" ref={fileRef} className="hidden" accept={ACCEPT} onChange={handleFile} />
            <div className="flex gap-1">
                <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="text-[10px] text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors disabled:opacity-40"
                >
                    {uploading ? 'Uploading...' : hasImage ? 'Change' : 'Icon'}
                </button>
                {canRemove && (
                    <button
                        type="button"
                        onClick={handleRemove}
                        disabled={uploading}
                        className="text-[10px] text-red-400/70 hover:text-red-300 transition-colors disabled:opacity-40"
                    >
                        Remove
                    </button>
                )}
            </div>
        </div>
    )
}

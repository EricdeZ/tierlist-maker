import { useState, useEffect, useRef, useCallback } from 'react'
import { ImagePlus, Upload } from 'lucide-react'

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_INPUT = 10 * 1024 * 1024   // 10MB — accept large files, we compress client-side
const MAX_OUTPUT = 512 * 1024        // 512KB — target after compression
const DEFAULT_MAX_DIM = 256          // max width/height px

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image()
        const url = URL.createObjectURL(file)
        img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')) }
        img.src = url
    })
}

function compressViaCanvas(img, maxDim, fileName) {
    return new Promise((resolve, reject) => {
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
            const scale = maxDim / Math.max(width, height)
            width = Math.round(width * scale)
            height = Math.round(height * scale)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)

        const tryBlob = (type, quality) => {
            canvas.toBlob(blob => {
                if (!blob) {
                    // webp not supported — fallback to jpeg
                    if (type === 'image/webp') return tryBlob('image/jpeg', quality)
                    return reject(new Error('Compression failed'))
                }
                if (blob.size > MAX_OUTPUT && quality > 0.4) {
                    return tryBlob(type, quality - 0.1)
                }
                const ext = type === 'image/webp' ? '.webp' : '.jpg'
                resolve(new File([blob], fileName.replace(/\.\w+$/, ext), { type }))
            }, type, quality)
        }
        tryBlob('image/webp', 0.85)
    })
}

async function processImage(file, maxDim) {
    const img = await loadImage(file)
    // Skip compression if already small and within dimensions
    if (file.size <= MAX_OUTPUT && img.width <= maxDim && img.height <= maxDim) {
        return file
    }
    return compressViaCanvas(img, maxDim, file.name)
}

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
    maxDim = DEFAULT_MAX_DIM,
    onError,
}) {
    const fileRef = useRef(null)
    const [uploading, setUploading] = useState(false)
    const [previewUrl, setPreviewUrl] = useState(null)
    const [dragOver, setDragOver] = useState(false)

    // Local file preview (deferred mode)
    useEffect(() => {
        if (!file) { setPreviewUrl(null); return }
        const url = URL.createObjectURL(file)
        setPreviewUrl(url)
        return () => URL.revokeObjectURL(url)
    }, [file])

    const isDeferred = typeof onChange === 'function'
    const displayUrl = previewUrl || currentUrl

    const pick = useCallback(async (f) => {
        if (!f) return
        if (!ALLOWED.includes(f.type)) {
            onError?.('Only JPEG, PNG, WebP, and GIF allowed')
            return
        }
        if (f.size > MAX_INPUT) {
            onError?.('Image must be under 10MB')
            return
        }

        let processed
        try {
            processed = await processImage(f, maxDim)
        } catch {
            onError?.('Failed to process image')
            return
        }
        if (processed.size > MAX_OUTPUT) {
            onError?.(`Image still too large after compression (${Math.round(processed.size / 1024)}KB). Try a smaller image.`)
            return
        }

        if (isDeferred) {
            onChange(processed)
        } else if (uploadFn) {
            // Show local preview immediately
            const localUrl = URL.createObjectURL(processed)
            setPreviewUrl(localUrl)
            setUploading(true)
            try {
                await uploadFn(processed)
                onComplete?.()
            } catch (err) {
                URL.revokeObjectURL(localUrl)
                setPreviewUrl(null)
                onError?.(err.message || 'Upload failed')
            } finally {
                setUploading(false)
            }
        }
    }, [isDeferred, onChange, uploadFn, onComplete, onError, maxDim])

    const handleFile = (e) => {
        const f = e.target.files?.[0]
        if (fileRef.current) fileRef.current.value = ''
        pick(f)
    }

    const handleDrop = useCallback((e) => {
        e.preventDefault()
        e.stopPropagation()
        setDragOver(false)
        const f = e.dataTransfer?.files?.[0]
        if (f) pick(f)
    }, [pick])

    const handleDragOver = useCallback((e) => {
        e.preventDefault()
        e.stopPropagation()
        setDragOver(true)
    }, [])

    const handleDragLeave = useCallback((e) => {
        e.preventDefault()
        e.stopPropagation()
        setDragOver(false)
    }, [])

    const handleRemove = async () => {
        if (isDeferred) {
            onChange(null)
        } else if (onRemove) {
            setUploading(true)
            try {
                await onRemove()
                setPreviewUrl(null)
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
            <div
                onClick={() => !uploading && fileRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`rounded-lg overflow-hidden transition-all ${
                    uploading
                        ? 'opacity-50 cursor-wait'
                        : 'cursor-pointer'
                } ${
                    dragOver
                        ? 'ring-2 ring-[var(--color-accent)] border-[var(--color-accent)]'
                        : hasImage
                            ? 'border border-white/10 hover:border-white/30'
                            : 'border border-dashed border-white/20 hover:border-white/40 hover:bg-white/5'
                }`}
                style={{ width: size, height: size }}
                title={uploading ? 'Uploading...' : 'Click or drag to upload'}
            >
                {displayUrl ? (
                    <img
                        src={displayUrl}
                        className="w-full h-full object-cover"
                        alt=""
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        {dragOver
                            ? <Upload className="w-4 h-4 text-[var(--color-accent)]" />
                            : <ImagePlus className="w-4 h-4 text-[var(--color-text-secondary)]" />
                        }
                    </div>
                )}
            </div>
            <input type="file" ref={fileRef} className="hidden" accept={ACCEPT} onChange={handleFile} />
            {uploading && (
                <span className="text-[10px] text-[var(--color-text-secondary)] animate-pulse">Uploading...</span>
            )}
            {!uploading && canRemove && (
                <button
                    type="button"
                    onClick={handleRemove}
                    className="text-[10px] text-red-400/70 hover:text-red-300 transition-colors"
                >
                    Remove
                </button>
            )}
        </div>
    )
}

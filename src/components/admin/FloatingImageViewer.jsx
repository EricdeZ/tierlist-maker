import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { ZoomIn, ZoomOut, RotateCcw, X, ChevronLeft, ChevronRight } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || '/api'

/**
 * Floating, draggable, resizable image viewer with zoom/pan.
 *
 * Accepts either:
 *  - `images` array of { id, preview } (blob URLs from in-memory files)
 *  - `queueItemIds` array of discord_queue IDs (fetched via proxy on demand)
 * Falls back to queueItemIds when images is empty.
 */
export default function FloatingImageViewer({ images = [], queueItemIds = [], onClose, initialIndex = 0 }) {
    // Build effective image list: prefer liveImages, fall back to proxy URLs
    const effectiveImages = useMemo(() => {
        if (images.length > 0) return images
        if (!queueItemIds.length) return []
        const token = encodeURIComponent(localStorage.getItem('auth_token') || '')
        return queueItemIds.map((qId, i) => ({
            id: `proxy_${qId}`,
            preview: `${API}/discord-image?queueId=${qId}&token=${token}`,
        }))
    }, [images, queueItemIds])

    const [activeIndex, setActiveIndex] = useState(initialIndex)
    const [zoom, setZoom] = useState(1)
    const [pan, setPan] = useState({ x: 0, y: 0 })
    const [position, setPosition] = useState(() => ({
        x: Math.max(0, window.innerWidth - 620),
        y: 80,
    }))
    const [size, setSize] = useState({ w: 580, h: 480 })

    const imgRef = useRef(null)
    const containerRef = useRef(null)

    // Drag state
    const dragging = useRef(false)
    const dragOffset = useRef({ x: 0, y: 0 })

    // Resize state
    const resizing = useRef(false)
    const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 })

    // Pan state
    const panning = useRef(false)
    const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 })

    const activeImage = effectiveImages[activeIndex]

    // Reset zoom/pan when switching images
    useEffect(() => {
        setZoom(1)
        setPan({ x: 0, y: 0 })
    }, [activeIndex])

    // Drag header
    const startDrag = useCallback((e) => {
        if (e.target.closest('button')) return
        e.preventDefault()
        dragging.current = true
        dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y }
    }, [position])

    // Resize handle
    const startResize = useCallback((e) => {
        e.preventDefault()
        e.stopPropagation()
        resizing.current = true
        resizeStart.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h }
    }, [size])

    // Pan image (when zoomed)
    const startPan = useCallback((e) => {
        if (zoom <= 1) return
        e.preventDefault()
        panning.current = true
        panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }
    }, [zoom, pan])

    useEffect(() => {
        const onMove = (e) => {
            if (dragging.current) {
                setPosition({
                    x: Math.max(0, Math.min(e.clientX - dragOffset.current.x, window.innerWidth - 100)),
                    y: Math.max(0, Math.min(e.clientY - dragOffset.current.y, window.innerHeight - 40)),
                })
            }
            if (resizing.current) {
                const dx = e.clientX - resizeStart.current.x
                const dy = e.clientY - resizeStart.current.y
                setSize({
                    w: Math.max(320, Math.min(resizeStart.current.w + dx, window.innerWidth - 40)),
                    h: Math.max(280, Math.min(resizeStart.current.h + dy, window.innerHeight - 40)),
                })
            }
            if (panning.current) {
                setPan({
                    x: panStart.current.px + (e.clientX - panStart.current.x),
                    y: panStart.current.py + (e.clientY - panStart.current.y),
                })
            }
        }
        const onUp = () => {
            dragging.current = false
            resizing.current = false
            panning.current = false
        }

        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
        return () => {
            document.removeEventListener('mousemove', onMove)
            document.removeEventListener('mouseup', onUp)
        }
    }, [])

    // Scroll to zoom
    const handleWheel = useCallback((e) => {
        e.preventDefault()
        const delta = e.deltaY > 0 ? -0.15 : 0.15
        setZoom(prev => Math.max(0.5, Math.min(prev + delta, 5)))
    }, [])

    const zoomIn = () => setZoom(prev => Math.min(prev + 0.5, 5))
    const zoomOut = () => setZoom(prev => Math.max(prev - 0.5, 0.5))
    const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }) }

    const prevImg = () => setActiveIndex(i => (i - 1 + effectiveImages.length) % effectiveImages.length)
    const nextImg = () => setActiveIndex(i => (i + 1) % effectiveImages.length)

    // Keyboard nav — disabled when an input field is focused (match reporting data entry)
    useEffect(() => {
        const onKey = (e) => {
            const tag = e.target.tagName
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return
            if (e.key === 'Escape') onClose()
            if (e.key === 'ArrowLeft') prevImg()
            if (e.key === 'ArrowRight') nextImg()
            if (e.key === '+' || e.key === '=') zoomIn()
            if (e.key === '-') zoomOut()
            if (e.key === '0') resetView()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onClose])

    if (!activeImage) return null

    const thumbBarHeight = effectiveImages.length > 1 ? 56 : 0
    const headerHeight = 36
    const controlsHeight = 32
    const imageAreaHeight = size.h - headerHeight - controlsHeight - thumbBarHeight

    return (
        <div
            style={{ position: 'fixed', top: position.y, left: position.x, width: size.w, height: size.h, zIndex: 60 }}
            className="bg-gray-950 border border-white/15 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        >
            {/* Header */}
            <div
                onMouseDown={startDrag}
                className="px-3 py-1.5 border-b border-white/10 flex items-center gap-2 select-none cursor-grab active:cursor-grabbing shrink-0"
                style={{ height: headerHeight }}
            >
                <svg className="w-3 h-4 text-white/20 shrink-0" viewBox="0 0 6 10">
                    <circle cx="1" cy="1" r="1" fill="currentColor" />
                    <circle cx="5" cy="1" r="1" fill="currentColor" />
                    <circle cx="1" cy="5" r="1" fill="currentColor" />
                    <circle cx="5" cy="5" r="1" fill="currentColor" />
                    <circle cx="1" cy="9" r="1" fill="currentColor" />
                    <circle cx="5" cy="9" r="1" fill="currentColor" />
                </svg>
                <span className="text-xs font-bold text-white/80 uppercase tracking-wider flex-1">
                    Screenshot {activeIndex + 1}/{effectiveImages.length}
                </span>
                <span className="text-[10px] text-white/40">{Math.round(zoom * 100)}%</span>
                <button onClick={onClose} className="w-5 h-5 flex items-center justify-center rounded text-white/40 hover:text-white hover:bg-white/10 transition">
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Zoom controls */}
            <div className="flex items-center gap-1 px-2 py-1 border-b border-white/5 shrink-0" style={{ height: controlsHeight }}>
                <button onClick={zoomOut} className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10 transition" title="Zoom out (-)">
                    <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <input
                    type="range"
                    min="50"
                    max="500"
                    step="10"
                    value={Math.round(zoom * 100)}
                    onChange={e => setZoom(Number(e.target.value) / 100)}
                    className="flex-1 h-1 mx-1 accent-blue-500 cursor-pointer"
                    title={`${Math.round(zoom * 100)}%`}
                />
                <button onClick={zoomIn} className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10 transition" title="Zoom in (+)">
                    <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button onClick={resetView} className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10 transition ml-1" title="Reset (0)">
                    <RotateCcw className="w-3.5 h-3.5" />
                </button>

                {effectiveImages.length > 1 && (
                    <div className="flex items-center gap-1 ml-2 pl-2 border-l border-white/10">
                        <button onClick={prevImg} className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10 transition">
                            <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={nextImg} className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10 transition">
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
            </div>

            {/* Image area */}
            <div
                ref={containerRef}
                onWheel={handleWheel}
                onMouseDown={startPan}
                className="flex-1 overflow-hidden bg-black/40 relative"
                style={{ height: imageAreaHeight, cursor: zoom > 1 ? 'grab' : 'default' }}
            >
                <img
                    ref={imgRef}
                    src={activeImage.preview}
                    alt={`Screenshot ${activeIndex + 1}`}
                    className="absolute top-1/2 left-1/2 max-w-none select-none"
                    draggable={false}
                    style={{
                        transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transformOrigin: 'center center',
                        maxHeight: '100%',
                        maxWidth: '100%',
                        objectFit: 'contain',
                    }}
                />
            </div>

            {/* Thumbnail bar */}
            {effectiveImages.length > 1 && (
                <div className="flex gap-1.5 px-2 py-1.5 border-t border-white/10 overflow-x-auto shrink-0" style={{ height: thumbBarHeight }}>
                    {effectiveImages.map((img, idx) => (
                        <button
                            key={img.id}
                            onClick={() => setActiveIndex(idx)}
                            className={`relative h-10 w-16 rounded overflow-hidden shrink-0 border-2 transition ${
                                idx === activeIndex
                                    ? 'border-blue-500 ring-1 ring-blue-500/30'
                                    : 'border-transparent opacity-60 hover:opacity-100'
                            }`}
                        >
                            <img src={img.preview} alt="" className="w-full h-full object-cover" draggable={false} />
                            <span className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[8px] text-center">
                                G{idx + 1}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {/* Resize handle */}
            <div
                onMouseDown={startResize}
                className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize"
                style={{ touchAction: 'none' }}
            >
                <svg className="w-3 h-3 absolute bottom-0.5 right-0.5 text-white/15" viewBox="0 0 8 8">
                    <path d="M7 1L1 7M7 4L4 7M7 7L7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
            </div>
        </div>
    )
}

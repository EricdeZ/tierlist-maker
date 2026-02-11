import { useState, useEffect, useRef, useCallback } from 'react'

export default function DraggablePanel({ title, children, initialPosition, defaultWidth = 320, defaultHeight = 384, minimized, onToggleMinimize }) {
    const [position, setPosition] = useState(() => {
        if (initialPosition) {
            return {
                x: Math.max(0, Math.min(initialPosition.x, window.innerWidth - 340)),
                y: Math.max(0, Math.min(initialPosition.y, window.innerHeight - 200)),
            }
        }
        return { x: Math.max(0, window.innerWidth - 400), y: 120 }
    })
    const [size, setSize] = useState({ w: defaultWidth, h: defaultHeight })

    // ─── Drag ───
    const dragging = useRef(false)
    const dragOffset = useRef({ x: 0, y: 0 })

    const startDrag = useCallback((e) => {
        if (e.target.closest('button')) return // don't drag when clicking buttons
        e.preventDefault()
        dragging.current = true
        dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y }
    }, [position])

    // ─── Resize ───
    const resizing = useRef(false)
    const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 })

    const startResize = useCallback((e) => {
        e.preventDefault()
        e.stopPropagation()
        resizing.current = true
        resizeStart.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h }
    }, [size])

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
                    w: Math.max(240, Math.min(resizeStart.current.w + dx, 700)),
                    h: Math.max(200, Math.min(resizeStart.current.h + dy, window.innerHeight - 100)),
                })
            }
        }
        const onUp = () => { dragging.current = false; resizing.current = false }

        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
        return () => {
            document.removeEventListener('mousemove', onMove)
            document.removeEventListener('mouseup', onUp)
        }
    }, [])

    return (
        <div
            style={{ position: 'fixed', top: position.y, left: position.x, width: size.w, zIndex: 50 }}
            className="bg-[var(--color-secondary)] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        >
            {/* Header — draggable */}
            <div
                onMouseDown={startDrag}
                className="px-3 py-2 border-b border-white/10 flex items-center gap-2 select-none cursor-grab active:cursor-grabbing shrink-0"
            >
                {/* Grip dots */}
                <svg className="w-3 h-4 text-white/20 shrink-0" viewBox="0 0 6 10">
                    <circle cx="1" cy="1" r="1" fill="currentColor" />
                    <circle cx="5" cy="1" r="1" fill="currentColor" />
                    <circle cx="1" cy="5" r="1" fill="currentColor" />
                    <circle cx="5" cy="5" r="1" fill="currentColor" />
                    <circle cx="1" cy="9" r="1" fill="currentColor" />
                    <circle cx="5" cy="9" r="1" fill="currentColor" />
                </svg>
                <h3 className="text-xs font-bold text-[var(--color-text)] uppercase tracking-wider flex-1">{title}</h3>
                {onToggleMinimize && (
                    <button
                        onClick={onToggleMinimize}
                        className="w-5 h-5 flex items-center justify-center rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/10 transition"
                    >
                        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                            {minimized ? <path d="M2 4l4 4 4-4" /> : <path d="M2 8l4-4 4 4" />}
                        </svg>
                    </button>
                )}
            </div>

            {/* Body */}
            {!minimized && (
                <div
                    className="panel-scrollbar overflow-y-auto flex-1"
                    style={{ maxHeight: size.h - 40 }}
                >
                    {children}
                </div>
            )}

            {/* Resize handle */}
            {!minimized && (
                <div
                    onMouseDown={startResize}
                    className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
                    style={{ touchAction: 'none' }}
                >
                    <svg className="w-3 h-3 absolute bottom-0.5 right-0.5 text-white/15" viewBox="0 0 8 8">
                        <path d="M7 1L1 7M7 4L4 7M7 7L7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                </div>
            )}
        </div>
    )
}

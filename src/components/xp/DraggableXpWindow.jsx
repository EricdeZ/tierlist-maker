import { useState, useEffect, useCallback, useRef } from 'react'

export default function DraggableXpWindow({ title, icon, children, defaultX, defaultY, className = '', zIndex = 10, onFocus, resizable = true, onClose, minimized: minimizedProp, onMinimize }) {
    const [pos, setPos] = useState({ x: defaultX ?? 0, y: defaultY ?? 0 })
    const [size, setSize] = useState({ w: 0, h: 0 }) // 0 = use CSS default
    const [closed, setClosed] = useState(false)
    const [minimizedInternal, setMinimizedInternal] = useState(false)

    // Controlled mode when minimizedProp is provided by parent
    const isControlled = minimizedProp !== undefined
    const minimized = isControlled ? minimizedProp : minimizedInternal
    const handleMinimizeToggle = () => {
        if (isControlled) onMinimize?.(!minimizedProp)
        else setMinimizedInternal(m => !m)
    }
    const dragRef = useRef({ active: false, offsetX: 0, offsetY: 0 })
    const resizeRef = useRef({ active: false, startX: 0, startY: 0, startW: 0, startH: 0 })
    const windowRef = useRef(null)

    // ── Drag ──
    const handlePointerDown = (e) => {
        if (e.target.closest('.xp-title-btn')) return
        e.preventDefault()
        dragRef.current = {
            active: true,
            offsetX: e.clientX - pos.x,
            offsetY: e.clientY - pos.y,
        }
        onFocus?.()
        window.addEventListener('pointermove', handleDragMove)
        window.addEventListener('pointerup', handleDragUp)
    }

    const handleDragMove = useCallback((e) => {
        if (!dragRef.current.active) return
        const el = windowRef.current
        const w = el ? el.offsetWidth : 200
        const navEl = document.querySelector('nav')
        const minY = navEl ? navEl.getBoundingClientRect().bottom + 4 : 72
        const maxX = Math.max(0, window.innerWidth - w)
        const maxY = Math.max(minY, window.innerHeight - 38 - 28) // 38=taskbar, 28=title bar
        setPos({
            x: Math.max(0, Math.min(maxX, e.clientX - dragRef.current.offsetX)),
            y: Math.max(minY, Math.min(maxY, e.clientY - dragRef.current.offsetY)),
        })
    }, [])

    const handleDragUp = useCallback(() => {
        dragRef.current.active = false
        window.removeEventListener('pointermove', handleDragMove)
        window.removeEventListener('pointerup', handleDragUp)
    }, [handleDragMove])

    // ── Resize ──
    const handleResizeDown = useCallback((e) => {
        e.preventDefault()
        e.stopPropagation()
        const rect = windowRef.current?.getBoundingClientRect()
        if (!rect) return
        resizeRef.current = {
            active: true,
            startX: e.clientX,
            startY: e.clientY,
            startW: rect.width,
            startH: rect.height,
        }
        window.addEventListener('pointermove', handleResizeMove)
        window.addEventListener('pointerup', handleResizeUp)
    }, [])

    const handleResizeMove = useCallback((e) => {
        if (!resizeRef.current.active) return
        const r = resizeRef.current
        const newW = Math.max(320, r.startW + (e.clientX - r.startX))
        const newH = Math.max(200, r.startH + (e.clientY - r.startY))
        setSize({ w: newW, h: newH })
    }, [])

    const handleResizeUp = useCallback(() => {
        resizeRef.current.active = false
        window.removeEventListener('pointermove', handleResizeMove)
        window.removeEventListener('pointerup', handleResizeUp)
    }, [handleResizeMove])

    useEffect(() => {
        return () => {
            window.removeEventListener('pointermove', handleDragMove)
            window.removeEventListener('pointerup', handleDragUp)
            window.removeEventListener('pointermove', handleResizeMove)
            window.removeEventListener('pointerup', handleResizeUp)
        }
    }, [handleDragMove, handleDragUp, handleResizeMove, handleResizeUp])

    const handleClose = () => {
        setClosed(true)
        onClose?.()
    }

    const sizeStyle = {}
    if (size.w > 0) sizeStyle.width = size.w
    if (size.h > 0) sizeStyle.height = size.h

    if (closed) return null

    return (
        <div
            ref={windowRef}
            className={`xp-window xp-window-draggable ${className}`}
            style={{
                left: pos.x, top: pos.y, zIndex,
                ...sizeStyle,
                display: minimized ? 'none' : 'flex',
                flexDirection: 'column',
                ...(size.h === 0 ? { maxHeight: '85vh' } : {}),
            }}
            onPointerDown={onFocus}
        >
            <div className="xp-title-bar" onPointerDown={handlePointerDown} style={{ cursor: 'grab', touchAction: 'none', flexShrink: 0 }}>
                <div className="flex items-center gap-1.5">
                    {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
                    <span className="xp-title-text">{title}</span>
                </div>
                <div className="flex items-center gap-0.5">
                    <span className="xp-title-btn xp-tbtn-min" onClick={handleMinimizeToggle}>_</span>
                    <span className="xp-title-btn xp-tbtn-max">&#9633;</span>
                    <span className="xp-title-btn xp-tbtn-x" onClick={handleClose}>&times;</span>
                </div>
            </div>
            <div className="xp-window-body xp-window-body-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                {children}
            </div>
            {resizable && (
                <div
                    className="xp-resize-handle"
                    onPointerDown={handleResizeDown}
                    style={{ touchAction: 'none' }}
                />
            )}
        </div>
    )
}

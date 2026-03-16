import { useState, useRef, useCallback, useEffect } from 'react'
import { Trash2 } from 'lucide-react'

const CARD_W = 300
const CARD_H = 420
const HANDLE_SIZE = 8

// Resize handle positions
const HANDLES = ['nw', 'ne', 'sw', 'se']
const HANDLE_CURSORS = { nw: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', se: 'nwse-resize' }

export default function CardCanvas({
    elements = [],
    selectedId,
    onSelect,
    onUpdateElement,
    onDeleteElement,
    onDropImage,
    border,
    zoom = 100,
}) {
    const canvasRef = useRef(null)
    const [dragging, setDragging] = useState(null) // { id, type: 'move'|'resize', handle?, startX, startY, startEl }
    const [dragOver, setDragOver] = useState(false)

    const scale = zoom / 100

    // Convert page coords to canvas coords
    const toCanvas = useCallback((pageX, pageY) => {
        const rect = canvasRef.current?.getBoundingClientRect()
        if (!rect) return { x: 0, y: 0 }
        return {
            x: (pageX - rect.left) / scale,
            y: (pageY - rect.top) / scale,
        }
    }, [scale])

    const handleMouseDown = useCallback((e, id, type = 'move', handle = null) => {
        e.stopPropagation()
        e.preventDefault()
        onSelect(id)
        const el = elements.find(el => el.id === id)
        if (!el) return
        const { x, y } = toCanvas(e.clientX, e.clientY)
        setDragging({ id, type, handle, startX: x, startY: y, startEl: { ...el } })
    }, [elements, onSelect, toCanvas])

    useEffect(() => {
        if (!dragging) return

        const handleMove = (e) => {
            const { x, y } = toCanvas(e.clientX, e.clientY)
            const dx = x - dragging.startX
            const dy = y - dragging.startY
            const el = dragging.startEl

            if (dragging.type === 'move') {
                onUpdateElement(dragging.id, {
                    x: Math.round(el.x + dx),
                    y: Math.round(el.y + dy),
                })
            } else if (dragging.type === 'resize') {
                let newX = el.x, newY = el.y, newW = el.w, newH = el.h
                const h = dragging.handle

                if (h.includes('e')) newW = Math.max(20, el.w + dx)
                if (h.includes('w')) { newW = Math.max(20, el.w - dx); newX = el.x + dx }
                if (h.includes('s')) newH = Math.max(20, el.h + dy)
                if (h.includes('n')) { newH = Math.max(20, el.h - dy); newY = el.y + dy }

                onUpdateElement(dragging.id, {
                    x: Math.round(newX),
                    y: Math.round(newY),
                    w: Math.round(newW),
                    h: Math.round(newH),
                })
            }
        }

        const handleUp = () => setDragging(null)

        window.addEventListener('mousemove', handleMove)
        window.addEventListener('mouseup', handleUp)
        return () => {
            window.removeEventListener('mousemove', handleMove)
            window.removeEventListener('mouseup', handleUp)
        }
    }, [dragging, toCanvas, onUpdateElement])

    // Drop handling
    const handleDrop = useCallback((e) => {
        e.preventDefault()
        setDragOver(false)
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
        if (files.length > 0 && onDropImage) {
            const { x, y } = toCanvas(e.clientX, e.clientY)
            files.forEach(f => onDropImage(f, x, y))
        }
    }, [onDropImage, toCanvas])

    // Click on empty area deselects
    const handleCanvasClick = useCallback((e) => {
        if (e.target === canvasRef.current || e.target.dataset.canvasBg) {
            onSelect(null)
        }
    }, [onSelect])

    // Delete key removes selected element
    useEffect(() => {
        const handleKey = (e) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
                // Don't delete if user is typing in an input
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
                onDeleteElement(selectedId)
            }
        }
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    }, [selectedId, onDeleteElement])

    return (
        <div
            ref={canvasRef}
            onClick={handleCanvasClick}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`relative overflow-hidden select-none ${dragOver ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-gray-900' : ''}`}
            style={{
                width: CARD_W,
                height: CARD_H,
                borderRadius: border?.enabled ? (border.radius ?? 12) : 12,
                border: border?.enabled ? `${border.width ?? 3}px solid ${border.color ?? '#d4af37'}` : '1px solid #374151',
                background: '#111827',
                cursor: dragging ? (dragging.type === 'move' ? 'grabbing' : HANDLE_CURSORS[dragging.handle]) : 'default',
            }}
        >
            {/* Empty state */}
            {elements.length === 0 && !dragOver && (
                <div data-canvas-bg className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <svg className="w-10 h-10 mb-2 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-xs text-gray-600">Drop images here to start</p>
                </div>
            )}

            {/* Drag overlay */}
            {dragOver && (
                <div className="absolute inset-0 bg-amber-500/10 flex items-center justify-center z-50 pointer-events-none">
                    <span className="bg-gray-900/90 text-amber-400 text-sm px-4 py-2 rounded-lg font-medium">Drop image</span>
                </div>
            )}

            {/* Render elements */}
            {elements.filter(el => el.visible !== false).map(el => (
                <CanvasElement
                    key={el.id}
                    el={el}
                    isSelected={el.id === selectedId}
                    onMouseDown={(e) => handleMouseDown(e, el.id, 'move')}
                    onHandleMouseDown={(e, handle) => handleMouseDown(e, el.id, 'resize', handle)}
                />
            ))}
        </div>
    )
}

function CanvasElement({ el, isSelected, onMouseDown, onHandleMouseDown }) {
    const style = {
        position: 'absolute',
        left: el.x ?? 0,
        top: el.y ?? 0,
        width: el.w ?? '100%',
        height: el.h ?? '100%',
        opacity: el.opacity ?? 1,
        zIndex: el.z ?? 0,
        cursor: 'grab',
    }

    let content = null

    switch (el.type) {
        case 'image':
            content = el.url ? (
                <img src={el.url} alt="" className="w-full h-full object-cover pointer-events-none" draggable={false} />
            ) : (
                <div className="w-full h-full bg-gray-800/60 flex items-center justify-center">
                    <span className="text-[10px] text-gray-500">No image</span>
                </div>
            )
            break

        case 'text':
            content = (
                <span
                    className="pointer-events-none whitespace-nowrap"
                    style={{
                        fontFamily: el.font || 'Cinzel, serif',
                        fontSize: el.fontSize ?? 20,
                        color: el.color || '#ffffff',
                        fontWeight: el.bold ? 'bold' : 'normal',
                        textShadow: el.shadow ? '1px 1px 3px rgba(0,0,0,0.8)' : 'none',
                        letterSpacing: el.letterSpacing ?? 0,
                    }}
                >
                    {el.content || 'Text'}
                </span>
            )
            // Text elements: auto-size, no explicit w/h
            style.width = 'auto'
            style.height = 'auto'
            style.padding = '2px 4px'
            break

        case 'stats': {
            const stats = el.stats || {}
            content = (
                <div className="pointer-events-none p-2 rounded" style={{ background: el.bgColor || 'rgba(0,0,0,0.7)' }}>
                    {Object.entries(stats).map(([key, val]) => (
                        <div key={key} className="flex justify-between gap-3 text-xs" style={{ color: el.color || '#ffffff' }}>
                            <span className="opacity-70">{key}</span>
                            <span className="font-bold">{val}</span>
                        </div>
                    ))}
                </div>
            )
            style.width = el.w ?? 120
            style.height = 'auto'
            break
        }

        case 'effect':
            content = (
                <div className="w-full h-full flex items-center justify-center pointer-events-none"
                    style={{ background: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(245,158,11,0.08) 4px, rgba(245,158,11,0.08) 8px)' }}>
                    <span className="text-[10px] text-amber-400/60 font-medium uppercase tracking-wider px-2 py-0.5 bg-black/30 rounded">
                        {el.effectName}
                    </span>
                </div>
            )
            style.width = '100%'
            style.height = '100%'
            style.left = 0
            style.top = 0
            style.pointerEvents = 'none'
            break

        default:
            content = null
    }

    const isEffect = el.type === 'effect'

    return (
        <div
            style={style}
            onMouseDown={!isEffect ? onMouseDown : undefined}
            className={isSelected ? 'ring-1 ring-amber-400' : ''}
        >
            {content}

            {/* Resize handles */}
            {isSelected && !isEffect && (
                <>
                    {HANDLES.map(h => {
                        const pos = {}
                        if (h.includes('n')) pos.top = -HANDLE_SIZE / 2
                        if (h.includes('s')) pos.bottom = -HANDLE_SIZE / 2
                        if (h.includes('w')) pos.left = -HANDLE_SIZE / 2
                        if (h.includes('e')) pos.right = -HANDLE_SIZE / 2
                        return (
                            <div
                                key={h}
                                onMouseDown={(e) => onHandleMouseDown(e, h)}
                                style={{
                                    position: 'absolute',
                                    ...pos,
                                    width: HANDLE_SIZE,
                                    height: HANDLE_SIZE,
                                    background: '#f59e0b',
                                    border: '1px solid #92400e',
                                    borderRadius: 2,
                                    cursor: HANDLE_CURSORS[h],
                                    zIndex: 999,
                                }}
                            />
                        )
                    })}
                </>
            )}
        </div>
    )
}

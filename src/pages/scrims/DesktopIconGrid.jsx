import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import shortcutOverlay from '../../assets/shortcut.PNG'

const GRID_CELL_W = 100 // px per grid column
const GRID_CELL_H = 120 // px per grid row
const GRID_ORIGIN_X = 12 // left offset
const GRID_ORIGIN_Y = 84 // top offset (below navbar)

export default function DesktopIconGrid({ gods, topPlayers }) {
    const navigate = useNavigate()
    // Track each icon's grid position { col, row } — columns-first, top-to-bottom
    const rows = 4
    const [positions, setPositions] = useState(() =>
        gods.map((_, i) => ({ col: Math.floor(i / rows), row: i % rows }))
    )
    const [dragging, setDragging] = useState(null) // { index, x, y } while dragging
    const dragRef = useRef({ active: false, index: -1, offsetX: 0, offsetY: 0, startX: 0, startY: 0, moved: false })

    const handlePointerDown = useCallback((e, index) => {
        e.preventDefault()
        const rect = e.currentTarget.getBoundingClientRect()
        dragRef.current = { active: true, index, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top, startX: e.clientX, startY: e.clientY, moved: false }
        setDragging({ index, x: rect.left, y: rect.top })
        window.addEventListener('pointermove', handleMove)
        window.addEventListener('pointerup', handleUp)
    }, [])

    const handleMove = useCallback((e) => {
        if (!dragRef.current.active) return
        const dx = Math.abs(e.clientX - dragRef.current.startX)
        const dy = Math.abs(e.clientY - dragRef.current.startY)
        if (dx > 5 || dy > 5) dragRef.current.moved = true
        setDragging({
            index: dragRef.current.index,
            x: e.clientX - dragRef.current.offsetX,
            y: e.clientY - dragRef.current.offsetY,
        })
    }, [])

    const handleUp = useCallback(() => {
        if (!dragRef.current.active) return
        const d = dragRef.current
        d.active = false
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', handleUp)

        setDragging(prev => {
            if (!prev) return null
            // If not dragged, just deselect (don't snap)
            if (!d.moved) return null
            // Snap to nearest grid cell
            const snapCol = Math.max(0, Math.round((prev.x - GRID_ORIGIN_X) / GRID_CELL_W))
            const snapRow = Math.max(0, Math.round((prev.y - GRID_ORIGIN_Y) / GRID_CELL_H))
            setPositions(p => p.map((pos, i) => i === prev.index ? { col: snapCol, row: snapRow } : pos))
            return null
        })
    }, [handleMove])

    // Double-click navigates to the top player for that god
    const handleDoubleClick = useCallback((god) => {
        const top = topPlayers?.[god.id]
        if (top?.playerSlug) {
            navigate(`/profile/${top.playerSlug}`)
        }
    }, [topPlayers, navigate])

    useEffect(() => () => {
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', handleUp)
    }, [handleMove, handleUp])

    return (
        <div className="xp-desktop-icons">
            {gods.map((god, i) => {
                const isDragging = dragging?.index === i
                const top = topPlayers?.[god.id]
                const style = isDragging
                    ? { position: 'fixed', left: dragging.x, top: dragging.y, zIndex: 30 }
                    : { position: 'absolute', left: GRID_ORIGIN_X + positions[i].col * GRID_CELL_W, top: GRID_ORIGIN_Y + positions[i].row * GRID_CELL_H }
                return (
                    <div
                        key={god.id}
                        className={`xp-desktop-icon ${isDragging ? 'xp-desktop-icon-selected' : ''}`}
                        style={style}
                        onPointerDown={(e) => handlePointerDown(e, i)}
                        onDoubleClick={() => handleDoubleClick(god)}
                        title={top ? `${top.playerName} (${top.games} games)` : god.name}
                    >
                        <div className="xp-desktop-icon-img-wrap">
                            <img src={god.image_url} alt={god.name} className="xp-desktop-icon-img" draggable={false} />
                            <img src={shortcutOverlay} alt="" className="xp-shortcut-img" draggable={false} />
                        </div>
                        <span className="xp-desktop-icon-label">{god.name}</span>
                    </div>
                )
            })}
        </div>
    )
}

// src/pages/admin/roster/PlayerPoolPanel.jsx
import { useState, useEffect, useRef, useMemo } from 'react'
import { POOL_ROLE_COLORS } from './constants'

export function PlayerPoolPanel({ allPlayers, leagueRosteredPlayerIds, pendingChanges, search, onSearchChange, onDragStart, onDragEnd, onClose }) {
    const inputRef = useRef(null)
    const panelRef = useRef(null)
    const [pos, setPos] = useState({ x: window.innerWidth - 300, y: 80 })
    const [size, setSize] = useState({ w: 280, h: 500 })
    const [sortBy, setSortBy] = useState('name') // 'name' | 'discord'
    const [freeAgentOnly, setFreeAgentOnly] = useState(true)
    const dragState = useRef(null)
    const resizeState = useRef(null)

    useEffect(() => { inputRef.current?.focus() }, [])

    // Clamp position to keep panel visible on window resize
    useEffect(() => {
        const handleResize = () => {
            setPos(prev => ({
                x: Math.min(prev.x, window.innerWidth - 60),
                y: Math.max(0, Math.min(prev.y, window.innerHeight - 60)),
            }))
        }
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    // Title bar drag to move
    const onMoveStart = (e) => {
        if (e.target.closest('button') || e.target.closest('input')) return
        e.preventDefault()
        dragState.current = { startX: e.clientX - pos.x, startY: e.clientY - pos.y }

        const onMove = (ev) => {
            if (!dragState.current) return
            const nx = Math.max(0, Math.min(ev.clientX - dragState.current.startX, window.innerWidth - 60))
            const ny = Math.max(0, Math.min(ev.clientY - dragState.current.startY, window.innerHeight - 60))
            setPos({ x: nx, y: ny })
        }
        const onUp = () => {
            dragState.current = null
            document.removeEventListener('mousemove', onMove)
            document.removeEventListener('mouseup', onUp)
        }
        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
    }

    // Corner resize
    const onResizeStart = (e) => {
        e.preventDefault()
        e.stopPropagation()
        resizeState.current = { startX: e.clientX, startY: e.clientY, startW: size.w, startH: size.h }

        const onMove = (ev) => {
            if (!resizeState.current) return
            const dw = ev.clientX - resizeState.current.startX
            const dh = ev.clientY - resizeState.current.startY
            setSize({
                w: Math.max(220, Math.min(resizeState.current.startW + dw, 600)),
                h: Math.max(300, Math.min(resizeState.current.startH + dh, window.innerHeight - pos.y - 20)),
            })
        }
        const onUp = () => {
            resizeState.current = null
            document.removeEventListener('mousemove', onMove)
            document.removeEventListener('mouseup', onUp)
        }
        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
    }

    const filtered = useMemo(() => {
        const pendingAddIds = new Set(
            (pendingChanges || []).filter(c => c.type === 'add').map(c => c.player_id)
        )
        let base = allPlayers.filter(p => {
            if (pendingAddIds.has(p.player_id)) return false
            if (freeAgentOnly && leagueRosteredPlayerIds.has(p.player_id)) return false
            return true
        })
        const list = search.trim().length >= 2
            ? base.filter(p => {
                const q = search.trim().toLowerCase()
                return p.name.toLowerCase().includes(q) || (p.discord_name && p.discord_name.toLowerCase().includes(q))
            })
            : base
        if (sortBy === 'discord') {
            list.sort((a, b) => {
                // Players with discord names first, then alphabetically
                if (a.discord_name && !b.discord_name) return -1
                if (!a.discord_name && b.discord_name) return 1
                if (a.discord_name && b.discord_name) return a.discord_name.localeCompare(b.discord_name)
                return a.name.localeCompare(b.name)
            })
        } else {
            list.sort((a, b) => a.name.localeCompare(b.name))
        }
        return list
    }, [allPlayers, leagueRosteredPlayerIds, pendingChanges, freeAgentOnly, search, sortBy])

    return (
        <div
            ref={panelRef}
            className="fixed z-40 rounded-xl border border-white/10 shadow-2xl flex flex-col overflow-hidden"
            style={{
                backgroundColor: 'var(--color-secondary)',
                left: pos.x,
                top: pos.y,
                width: size.w,
                height: size.h,
            }}
        >
            {/* Draggable header */}
            <div
                className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between shrink-0 cursor-move select-none"
                onMouseDown={onMoveStart}
            >
                <div className="flex items-center gap-2">
                    {/* Drag grip */}
                    <div className="flex gap-[3px] opacity-40">
                        <div className="flex flex-col gap-[3px]">
                            <span className="w-1 h-1 rounded-full bg-[var(--color-text)]" />
                            <span className="w-1 h-1 rounded-full bg-[var(--color-text)]" />
                            <span className="w-1 h-1 rounded-full bg-[var(--color-text)]" />
                        </div>
                        <div className="flex flex-col gap-[3px]">
                            <span className="w-1 h-1 rounded-full bg-[var(--color-text)]" />
                            <span className="w-1 h-1 rounded-full bg-[var(--color-text)]" />
                            <span className="w-1 h-1 rounded-full bg-[var(--color-text)]" />
                        </div>
                    </div>
                    <h3 className="text-sm font-bold text-[var(--color-text)]">
                        Player Pool
                        <span className="ml-1.5 text-xs font-normal text-[var(--color-text-secondary)]">
                            ({filtered.length})
                        </span>
                    </h3>
                </div>
                <button onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] text-lg leading-none">
                    ✕
                </button>
            </div>

            {/* Search + sort */}
            <div className="px-3 py-2 border-b border-white/10 shrink-0 space-y-1.5">
                <input
                    ref={inputRef}
                    type="text"
                    value={search}
                    onChange={e => onSearchChange(e.target.value)}
                    placeholder="Search players..."
                    className="w-full rounded-lg px-3 py-2 text-xs border focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/50"
                    style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.1)' }}
                />
                <div className="flex items-center gap-1">
                    {[['name', 'Name'], ['discord', 'Discord']].map(([key, label]) => (
                        <button
                            key={key}
                            onClick={() => setSortBy(key)}
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                                sortBy === key
                                    ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
                                    : 'bg-white/5 text-[var(--color-text-secondary)] hover:bg-white/10'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                    <div className="ml-auto">
                        <button
                            onClick={() => setFreeAgentOnly(prev => !prev)}
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                                freeAgentOnly
                                    ? 'bg-green-500/20 text-green-400'
                                    : 'bg-white/5 text-[var(--color-text-secondary)] hover:bg-white/10'
                            }`}
                        >
                            FA Only
                        </button>
                    </div>
                </div>
            </div>

            {/* Player list */}
            <div className="flex-1 overflow-y-auto px-2 py-1 min-h-0">
                {filtered.length === 0 ? (
                    <p className="text-center text-xs text-[var(--color-text-secondary)] py-8 opacity-60">
                        {search.trim().length >= 2 ? 'No players found' : 'No unrostered players'}
                    </p>
                ) : filtered.map(player => (
                    <div
                        key={player.player_id}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-grab active:cursor-grabbing hover:bg-white/5 transition-colors group"
                        draggable
                        onDragStart={(e) => onDragStart(e, player)}
                        onDragEnd={onDragEnd}
                    >
                        {/* Drag handle */}
                        <div className="w-3 flex flex-col items-center gap-[2px] opacity-0 group-hover:opacity-40 transition-opacity shrink-0">
                            <span className="w-1 h-1 rounded-full bg-[var(--color-text)]" />
                            <span className="w-1 h-1 rounded-full bg-[var(--color-text)]" />
                        </div>

                        <div className="flex-1 min-w-0">
                            <span className="text-xs text-[var(--color-text)] truncate block">{player.name}</span>
                            {player.discord_name && (
                                <span className="text-[10px] text-[var(--color-text-secondary)] truncate block opacity-60">{player.discord_name}</span>
                            )}
                        </div>

                        {player.main_role && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 ${POOL_ROLE_COLORS[player.main_role.toLowerCase()] || POOL_ROLE_COLORS.fill}`}>
                                {player.main_role}
                            </span>
                        )}
                    </div>
                ))}
            </div>

            {/* Hint + resize handle */}
            <div className="px-3 py-1.5 border-t border-white/10 shrink-0 flex items-center justify-between">
                <p className="text-[10px] text-[var(--color-text-secondary)]">
                    Drag players onto team cards
                </p>
                {/* Resize grip (bottom-right) */}
                <div
                    className="w-4 h-4 cursor-se-resize flex items-end justify-end opacity-40 hover:opacity-70 transition-opacity"
                    onMouseDown={onResizeStart}
                >
                    <svg width="10" height="10" viewBox="0 0 10 10" className="text-[var(--color-text)]">
                        <path d="M9 1v8H1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        <path d="M9 5v4H5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                </div>
            </div>
        </div>
    )
}

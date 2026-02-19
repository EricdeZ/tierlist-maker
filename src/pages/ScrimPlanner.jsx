import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { scrimService, godService, coinflipService } from '../services/database'
import { usePassion } from '../context/PassionContext'
import PageTitle from '../components/PageTitle'
import Navbar from '../components/layout/Navbar'
import TeamLogo from '../components/TeamLogo'
import passionCoin from '../assets/passion/passion.png'
import passionTails from '../assets/passion/passiontails.png'
import xpBg from '../assets/xp-bg.jpg'
import shortcutOverlay from '../assets/shortcut.PNG'
import {
    Swords, Clock, Shield, MessageSquare, Search,
    Plus, X, Check, Send, Users,
    Calendar, Filter, Target,
} from 'lucide-react'

const PICK_MODES = [
    { value: 'regular', label: 'Regular' },
    { value: 'fearless', label: 'Fearless' },
    { value: 'fearless_picks', label: 'Fearless Picks' },
    { value: 'fearless_bans', label: 'Fearless Bans' },
]

const XP_PICK_BADGE = {
    regular: 'xp-badge-blue',
    fearless: 'xp-badge-red',
    fearless_picks: 'xp-badge-orange',
    fearless_bans: 'xp-badge-purple',
}

function formatPickMode(mode) {
    return PICK_MODES.find(m => m.value === mode)?.label || mode
}

function formatDateEST(dateStr) {
    const date = new Date(dateStr)
    return date.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        weekday: 'short', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
    }) + ' EST'
}

function formatRelativeDate(dateStr) {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = date - now
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays > 1) return `in ${diffDays} days`
    if (diffDays === 1) return 'tomorrow'
    if (diffHours > 1) return `in ${diffHours} hours`
    if (diffHours === 1) return 'in 1 hour'
    return 'soon'
}


// ═══════════════════════════════════════════════════
// Draggable + Resizable XP Window
// ═══════════════════════════════════════════════════
function DraggableXpWindow({ title, icon, children, defaultX, defaultY, className = '', zIndex = 10, onFocus, resizable = true }) {
    const [pos, setPos] = useState({ x: defaultX ?? 0, y: defaultY ?? 0 })
    const [size, setSize] = useState({ w: 0, h: 0 }) // 0 = use CSS default
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
        setPos({
            x: e.clientX - dragRef.current.offsetX,
            y: e.clientY - dragRef.current.offsetY,
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

    const sizeStyle = {}
    if (size.w > 0) sizeStyle.width = size.w
    if (size.h > 0) sizeStyle.height = size.h

    return (
        <div
            ref={windowRef}
            className={`xp-window xp-window-draggable ${className}`}
            style={{ left: pos.x, top: pos.y, zIndex, ...sizeStyle, display: 'flex', flexDirection: 'column' }}
            onPointerDown={onFocus}
        >
            <div className="xp-title-bar" onPointerDown={handlePointerDown} style={{ cursor: 'grab', touchAction: 'none', flexShrink: 0 }}>
                <div className="flex items-center gap-1.5">
                    {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
                    <span className="xp-title-text">{title}</span>
                </div>
                <div className="flex items-center gap-0.5">
                    <span className="xp-title-btn xp-tbtn-min">_</span>
                    <span className="xp-title-btn xp-tbtn-max">&#9633;</span>
                    <span className="xp-title-btn xp-tbtn-x">&times;</span>
                </div>
            </div>
            <div className="xp-window-body xp-window-body-scroll" style={{ flex: 1, minHeight: 0 }}>
                {children}
            </div>
            {/* Resize handle */}
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


// ═══════════════════════════════════════════════════
// Desktop Icon Grid (manages snapping layout)
// ═══════════════════════════════════════════════════
const GRID_CELL_W = 100 // px per grid column
const GRID_CELL_H = 120 // px per grid row
const GRID_ORIGIN_X = 12 // left offset
const GRID_ORIGIN_Y = 84 // top offset (below navbar)

function DesktopIconGrid({ gods }) {
    // Track each icon's grid position { col, row } — columns-first, top-to-bottom
    const rows = 4
    const [positions, setPositions] = useState(() =>
        gods.map((_, i) => ({ col: Math.floor(i / rows), row: i % rows }))
    )
    const [dragging, setDragging] = useState(null) // { index, x, y } while dragging
    const dragRef = useRef({ active: false, index: -1, offsetX: 0, offsetY: 0 })

    const handlePointerDown = useCallback((e, index) => {
        e.preventDefault()
        const rect = e.currentTarget.getBoundingClientRect()
        dragRef.current = { active: true, index, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top }
        setDragging({ index, x: rect.left, y: rect.top })
        window.addEventListener('pointermove', handleMove)
        window.addEventListener('pointerup', handleUp)
    }, [])

    const handleMove = useCallback((e) => {
        if (!dragRef.current.active) return
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
            // Snap to nearest grid cell
            const snapCol = Math.max(0, Math.round((prev.x - GRID_ORIGIN_X) / GRID_CELL_W))
            const snapRow = Math.max(0, Math.round((prev.y - GRID_ORIGIN_Y) / GRID_CELL_H))
            setPositions(p => p.map((pos, i) => i === prev.index ? { col: snapCol, row: snapRow } : pos))
            return null
        })
    }, [handleMove])

    useEffect(() => () => {
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', handleUp)
    }, [handleMove, handleUp])

    return (
        <div className="xp-desktop-icons">
            {gods.map((god, i) => {
                const isDragging = dragging?.index === i
                const style = isDragging
                    ? { position: 'fixed', left: dragging.x, top: dragging.y, zIndex: 30 }
                    : { position: 'absolute', left: GRID_ORIGIN_X + positions[i].col * GRID_CELL_W, top: GRID_ORIGIN_Y + positions[i].row * GRID_CELL_H }
                return (
                    <div
                        key={god.id}
                        className={`xp-desktop-icon ${isDragging ? 'xp-desktop-icon-selected' : ''}`}
                        style={style}
                        onPointerDown={(e) => handlePointerDown(e, i)}
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


// ═══════════════════════════════════════════════════
// XP Progress Bar
// ═══════════════════════════════════════════════════
function XpProgressBar() {
    return (
        <div className="flex flex-col items-center gap-3 py-12">
            <div className="xp-progress">
                <div className="xp-progress-bar" />
            </div>
            <span className="xp-text" style={{ fontSize: 11 }}>Loading scrims...</span>
        </div>
    )
}


// ═══════════════════════════════════════════════════
// Dino Runner Game — Full-width banner
// ═══════════════════════════════════════════════════
function XpDinoGame() {
    const canvasRef = useRef(null)
    const stateRef = useRef({
        dino: { x: 60, y: 0, vy: 0, w: 22, h: 26 },
        cacti: [],
        clouds: [],
        score: 0, speed: 3.5,
        gameOver: false, started: false,
        frame: 0, nextCactus: 80, ground: 0,
    })
    const rafRef = useRef(null)

    const W = 900, H = 150, GROUND = H - 22

    const reset = useCallback(() => {
        const s = stateRef.current
        s.dino = { x: 60, y: 0, vy: 0, w: 22, h: 26 }
        s.cacti = []
        s.clouds = Array.from({ length: 5 }, (_, i) => ({ x: 100 + i * 180, y: 10 + Math.random() * 30 }))
        s.score = 0; s.speed = 3.5
        s.gameOver = false; s.started = true
        s.frame = 0; s.nextCactus = 80; s.ground = 0
    }, [])

    const jump = useCallback(() => {
        const s = stateRef.current
        if (s.gameOver) { reset(); return }
        if (!s.started) { reset(); return }
        if (s.dino.y === 0) s.dino.vy = -9
    }, [reset])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        stateRef.current.clouds = Array.from({ length: 5 }, (_, i) => ({ x: 80 + i * 180, y: 10 + Math.random() * 30 }))

        const drawDino = (d, frame) => {
            const baseY = GROUND - d.h - d.y
            ctx.fillStyle = '#535353'
            ctx.fillRect(d.x, baseY, d.w, d.h - 4)
            ctx.fillRect(d.x + 12, baseY - 7, 14, 11)
            ctx.fillStyle = '#fff'
            ctx.fillRect(d.x + 20, baseY - 5, 3, 3)
            ctx.fillStyle = '#535353'
            if (d.y > 0) {
                ctx.fillRect(d.x + 4, baseY + d.h - 4, 5, 7)
                ctx.fillRect(d.x + 13, baseY + d.h - 4, 5, 7)
            } else {
                const leg = Math.floor(frame / 4) % 2
                ctx.fillRect(d.x + 4, baseY + d.h - 4, 5, leg ? 7 : 3)
                ctx.fillRect(d.x + 13, baseY + d.h - 4, 5, leg ? 3 : 7)
            }
            ctx.fillRect(d.x - 5, baseY + 4, 7, 4)
            ctx.fillRect(d.x - 8, baseY + 2, 5, 4)
        }

        const drawCactus = (c) => {
            ctx.fillStyle = '#535353'
            ctx.fillRect(c.x, GROUND - c.h, c.w, c.h)
            if (c.h > 22) {
                ctx.fillRect(c.x - 4, GROUND - c.h + 8, 4, 10)
                ctx.fillRect(c.x + c.w, GROUND - c.h + 12, 4, 8)
            }
        }

        const loop = () => {
            const s = stateRef.current
            ctx.clearRect(0, 0, W, H)
            ctx.fillStyle = '#f7f7f7'
            ctx.fillRect(0, 0, W, H)

            // clouds
            ctx.fillStyle = '#ddd'
            s.clouds.forEach(c => {
                ctx.fillRect(c.x, c.y, 35, 6)
                ctx.fillRect(c.x + 6, c.y - 4, 22, 4)
                ctx.fillRect(c.x + 3, c.y + 6, 28, 3)
            })

            // ground
            ctx.fillStyle = '#535353'
            ctx.fillRect(0, GROUND, W, 1)
            for (let i = 0; i < W; i += 8) {
                if ((i + Math.floor(s.ground)) % 16 < 8) ctx.fillRect(i, GROUND + 4, 3, 1)
            }

            if (!s.started) {
                drawDino(s.dino, 0)
                ctx.fillStyle = '#535353'
                ctx.font = '14px "Pixelify Sans", monospace'
                ctx.textAlign = 'center'
                ctx.fillText('CLICK OR PRESS SPACE TO START', W / 2, GROUND - 50)
                ctx.font = '11px "Pixelify Sans", monospace'
                ctx.fillText('Jump over the cacti!', W / 2, GROUND - 32)
                rafRef.current = requestAnimationFrame(loop)
                return
            }

            if (!s.gameOver) {
                s.frame++
                s.dino.vy += 0.5
                s.dino.y = Math.max(0, s.dino.y - s.dino.vy)
                s.ground = (s.ground + s.speed) % W
                s.clouds.forEach(c => { c.x -= s.speed * 0.3; if (c.x < -50) c.x = W + Math.random() * 100 })

                s.nextCactus--
                if (s.nextCactus <= 0) {
                    s.cacti.push({ x: W + 10, h: 18 + Math.random() * 22, w: 8 + Math.random() * 7 })
                    s.nextCactus = 45 + Math.random() * 65
                }
                s.cacti.forEach(c => { c.x -= s.speed })
                s.cacti = s.cacti.filter(c => c.x > -20)

                const dBox = { x: s.dino.x + 2, w: s.dino.w - 4, y: s.dino.y, h: s.dino.h }
                for (const c of s.cacti) {
                    if (dBox.x + dBox.w > c.x && dBox.x < c.x + c.w && dBox.y < c.h) s.gameOver = true
                }
                s.score = Math.floor(s.frame / 5)
                s.speed = 3.5 + s.score * 0.004
            }

            s.cacti.forEach(drawCactus)
            drawDino(s.dino, s.frame)

            ctx.fillStyle = '#535353'
            ctx.font = '12px "Pixelify Sans", monospace'
            ctx.textAlign = 'right'
            ctx.fillText('HI ' + String(s.score).padStart(5, '0'), W - 12, 18)

            if (s.gameOver) {
                ctx.fillStyle = 'rgba(247,247,247,0.6)'
                ctx.fillRect(0, 0, W, H)
                ctx.fillStyle = '#535353'
                ctx.font = '16px "Pixelify Sans", monospace'
                ctx.textAlign = 'center'
                ctx.fillText('G A M E   O V E R', W / 2, GROUND - 55)
                ctx.font = '11px "Pixelify Sans", monospace'
                ctx.fillText('Score: ' + s.score + '  —  Click to Restart', W / 2, GROUND - 35)
            }

            rafRef.current = requestAnimationFrame(loop)
        }
        loop()

        const onKey = (e) => { if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jump() } }
        window.addEventListener('keydown', onKey)
        return () => { window.removeEventListener('keydown', onKey); if (rafRef.current) cancelAnimationFrame(rafRef.current) }
    }, [jump])

    return (
        <div style={{ background: '#c0c0c0', padding: 3 }}>
            <canvas ref={canvasRef} width={W} height={H} onClick={jump}
                style={{ display: 'block', width: '100%', height: 'auto', imageRendering: 'pixelated', cursor: 'pointer', border: '2px inset #d4d0c8' }}
            />
        </div>
    )
}


// ═══════════════════════════════════════════════════
// XP Taskbar Clock
// ═══════════════════════════════════════════════════
function XpClock() {
    const [time, setTime] = useState('')
    useEffect(() => {
        const tick = () => setTime(new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true }))
        tick()
        const id = setInterval(tick, 30000)
        return () => clearInterval(id)
    }, [])
    return <span className="xp-tray-clock">{time} EST</span>
}


// ═══════════════════════════════════════════════════
// XP Coin Flip (mini window game)
// ═══════════════════════════════════════════════════
function XpCoinFlip() {
    const { user } = useAuth()
    const { balance, refreshBalance } = usePassion()

    const [flipping, setFlipping] = useState(false)
    const [lastResult, setLastResult] = useState(null)
    const [currentStreak, setCurrentStreak] = useState(0)
    const [bestStreak, setBestStreak] = useState(0)
    const [totalFlips, setTotalFlips] = useState(0)
    const [totalHeads, setTotalHeads] = useState(0)
    const [localBalance, setLocalBalance] = useState(null)
    const [resultDelta, setResultDelta] = useState(null)
    const [leaderboard, setLeaderboard] = useState([])
    const [showLeaderboard, setShowLeaderboard] = useState(false)
    const [flipAngle, setFlipAngle] = useState(0)
    const flipRef = useRef(null)

    useEffect(() => {
        if (!user) return
        coinflipService.getMyStats()
            .then(data => {
                setCurrentStreak(data.currentStreak || 0)
                setBestStreak(data.bestStreak || 0)
                setTotalFlips(data.totalFlips || 0)
                setTotalHeads(data.totalHeads || 0)
            })
            .catch(() => {})
    }, [user])

    useEffect(() => {
        if (!flipping && balance !== undefined) setLocalBalance(balance)
    }, [balance, flipping])

    const loadLeaderboard = () => {
        coinflipService.getLeaderboard()
            .then(data => setLeaderboard(data.leaderboard || []))
            .catch(() => {})
    }

    const handleFlip = async () => {
        if (flipping || !user) return
        if ((localBalance ?? balance) < 1) return
        setFlipping(true)
        setResultDelta(null)
        setLastResult(null)

        // Animate spinning
        let angle = 0
        const spin = () => {
            angle += 18
            setFlipAngle(angle)
            if (angle < 720) flipRef.current = requestAnimationFrame(spin)
        }
        flipRef.current = requestAnimationFrame(spin)

        try {
            const data = await coinflipService.flip()
            // Stop spin
            if (flipRef.current) cancelAnimationFrame(flipRef.current)

            const isHeads = data.result === 'heads'
            setFlipAngle(isHeads ? 0 : 180)
            setLastResult(data.result)
            setResultDelta(isHeads ? +1 : -1)
            setCurrentStreak(data.currentStreak)
            setBestStreak(data.bestStreak)
            setTotalFlips(data.totalFlips)
            setTotalHeads(data.totalHeads)
            setLocalBalance(data.balance)

            setTimeout(() => refreshBalance(), 500)
        } catch (err) {
            if (flipRef.current) cancelAnimationFrame(flipRef.current)
            setFlipAngle(0)
            console.error('Flip failed:', err)
        } finally {
            setFlipping(false)
        }
    }

    useEffect(() => () => { if (flipRef.current) cancelAnimationFrame(flipRef.current) }, [])

    const headsRate = totalFlips > 0 ? Math.round((totalHeads / totalFlips) * 100) : 0

    // Determine which face to show
    const showTails = flipAngle % 360 >= 90 && flipAngle % 360 < 270
    const coinSrc = lastResult === 'tails' && !flipping ? passionTails
        : lastResult === 'heads' && !flipping ? passionCoin
        : showTails ? passionTails : passionCoin

    if (!user) {
        return (
            <div className="text-center py-6">
                <div style={{ fontSize: 32 }}>&#128176;</div>
                <div className="xp-text" style={{ fontWeight: 700, marginTop: 4 }}>Log in to flip</div>
                <div className="xp-text" style={{ fontSize: 10, color: '#666' }}>Costs 1 Passion per flip</div>
            </div>
        )
    }

    return (
        <div style={{ padding: 4 }}>
            {/* Coin display */}
            <div className="flex flex-col items-center" style={{ padding: '10px 0 6px' }}>
                <div
                    className="xp-coin-wrap"
                    style={{ transform: flipping ? `rotateY(${flipAngle}deg)` : undefined }}
                >
                    <img src={coinSrc} alt="coin" className="xp-coin-img" draggable={false} />
                </div>

                {/* Result feedback */}
                {resultDelta !== null && (
                    <div style={{
                        fontSize: 14, fontWeight: 700, marginTop: 4,
                        fontFamily: '"Pixelify Sans", system-ui',
                        color: resultDelta > 0 ? '#2d8212' : '#cc0000',
                    }}>
                        {resultDelta > 0 ? 'HEADS! +1' : 'TAILS! -1'}
                    </div>
                )}

                {/* Flip button */}
                <button
                    onClick={handleFlip}
                    disabled={flipping || (localBalance ?? balance) < 1}
                    className="xp-btn xp-btn-primary"
                    style={{ marginTop: 6, padding: '4px 20px', fontSize: 12 }}
                >
                    {flipping ? 'Flipping...' : 'Flip (1 Passion)'}
                </button>

                {(localBalance ?? balance) < 1 && !flipping && (
                    <div className="xp-text" style={{ fontSize: 10, color: '#cc0000', marginTop: 2 }}>Not enough Passion!</div>
                )}
            </div>

            {/* Stats panel */}
            <fieldset className="xp-fieldset" style={{ marginTop: 4 }}>
                <legend className="xp-fieldset-legend">Stats</legend>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px' }}>
                    <div className="xp-text"><b>Balance:</b> {localBalance ?? balance ?? 0}</div>
                    <div className="xp-text"><b>Streak:</b> {currentStreak}</div>
                    <div className="xp-text"><b>Best:</b> {bestStreak}</div>
                    <div className="xp-text"><b>Flips:</b> {totalFlips}</div>
                    <div className="xp-text"><b>Heads:</b> {totalHeads} ({headsRate}%)</div>
                    <div className="xp-text"><b>Tails:</b> {totalFlips - totalHeads}</div>
                </div>
            </fieldset>

            {/* Leaderboard toggle */}
            <button
                onClick={() => { setShowLeaderboard(!showLeaderboard); if (!showLeaderboard) loadLeaderboard() }}
                className="xp-btn w-full"
                style={{ marginTop: 4, fontSize: 11 }}
            >
                {showLeaderboard ? 'Hide Leaderboard' : 'Show Leaderboard'}
            </button>

            {showLeaderboard && (
                <div style={{ marginTop: 4, background: '#fff', border: '2px solid', borderColor: '#7f9db9 #f0f0f0 #f0f0f0 #7f9db9', maxHeight: 150, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#ece9d8', borderBottom: '1px solid #c0c0c0' }}>
                                <th className="xp-text" style={{ padding: '2px 6px', textAlign: 'left', fontWeight: 700, fontSize: 10 }}>#</th>
                                <th className="xp-text" style={{ padding: '2px 6px', textAlign: 'left', fontWeight: 700, fontSize: 10 }}>Player</th>
                                <th className="xp-text" style={{ padding: '2px 6px', textAlign: 'right', fontWeight: 700, fontSize: 10 }}>Best</th>
                            </tr>
                        </thead>
                        <tbody>
                            {leaderboard.slice(0, 10).map((entry, i) => (
                                <tr key={entry.user_id || i} style={{ borderBottom: '1px solid #e8e8e8' }}>
                                    <td className="xp-text" style={{ padding: '2px 6px', fontSize: 10 }}>{i + 1}</td>
                                    <td className="xp-text" style={{ padding: '2px 6px', fontSize: 10 }}>{entry.discord_username || entry.player_name || '???'}</td>
                                    <td className="xp-text" style={{ padding: '2px 6px', textAlign: 'right', fontSize: 10, fontWeight: 700, color: '#0058e6' }}>{entry.best_streak}</td>
                                </tr>
                            ))}
                            {leaderboard.length === 0 && (
                                <tr><td colSpan={3} className="xp-text" style={{ padding: '6px', textAlign: 'center', fontSize: 10, color: '#666' }}>No data yet</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}


// ═══════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════
export default function ScrimPlanner() {
    const { user, login } = useAuth()
    const [activeTab, setActiveTab] = useState('open')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [startMenuOpen, setStartMenuOpen] = useState(false)
    const startRef = useRef(null)
    const [desktopGods, setDesktopGods] = useState([])

    const [openScrims, setOpenScrims] = useState([])
    const [leagueFilter, setLeagueFilter] = useState('')
    const [tierFilter, setTierFilter] = useState('')

    const [myScrims, setMyScrims] = useState([])
    const [captainTeams, setCaptainTeams] = useState([])
    const [incomingScrims, setIncomingScrims] = useState([])

    const [postForm, setPostForm] = useState({
        team_id: '', scheduled_date: '', pick_mode: 'regular',
        banned_content_league: '', notes: '', challenged_team_id: '',
    })
    const [posting, setPosting] = useState(false)
    const [postError, setPostError] = useState(null)
    const [postSuccess, setPostSuccess] = useState(false)

    const [allTeams, setAllTeams] = useState([])
    const [teamSearch, setTeamSearch] = useState('')
    const [showTeamPicker, setShowTeamPicker] = useState(false)

    const [actionLoading, setActionLoading] = useState(null)

    const isCaptain = captainTeams.length > 0

    const TABS = [
        { key: 'open', label: 'Open Scrims' },
        ...(user ? [{ key: 'my', label: 'My Scrims' }] : []),
        ...(isCaptain ? [{ key: 'post', label: 'Post Scrim' }] : []),
    ]

    const loadOpenScrims = useCallback(async () => {
        try {
            const filters = {}
            if (leagueFilter) filters.league_id = leagueFilter
            if (tierFilter) filters.division_tier = tierFilter
            const data = await scrimService.list(filters)
            setOpenScrims(data.scrims || [])
        } catch (err) { console.error('Failed to load scrims:', err) }
    }, [leagueFilter, tierFilter])

    const loadMyScrims = useCallback(async () => {
        if (!user) return
        try {
            const [myData, incomingData] = await Promise.all([scrimService.getMyScrims(), scrimService.getIncoming()])
            setMyScrims(myData.scrims || [])
            setCaptainTeams(myData.captainTeams || [])
            setIncomingScrims(incomingData.scrims || [])
        } catch (err) { console.error('Failed to load my scrims:', err) }
    }, [user])

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            try {
                await loadOpenScrims()
                if (user) await loadMyScrims()
            } catch (err) { setError(err.message) }
            finally { setLoading(false) }
        }
        load()
    }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { if (!loading) loadOpenScrims() }, [leagueFilter, tierFilter]) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (activeTab === 'post' && allTeams.length === 0) {
            scrimService.getAllActiveTeams().then(data => setAllTeams(data.teams || [])).catch(() => {})
        }
    }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (captainTeams.length > 0 && !postForm.team_id) setPostForm(prev => ({ ...prev, team_id: captainTeams[0].teamId }))
    }, [captainTeams]) // eslint-disable-line react-hooks/exhaustive-deps

    // Close start menu on click outside
    useEffect(() => {
        if (!startMenuOpen) return
        const handle = (e) => {
            if (startRef.current && !startRef.current.contains(e.target)) setStartMenuOpen(false)
        }
        document.addEventListener('mousedown', handle)
        return () => document.removeEventListener('mousedown', handle)
    }, [startMenuOpen])

    // Load random gods for desktop icons
    useEffect(() => {
        godService.getAll().then(data => {
            const gods = data.gods || data || []
            if (gods.length === 0) return
            const shuffled = [...gods].sort(() => Math.random() - 0.5)
            setDesktopGods(shuffled.slice(0, 24))
        }).catch(() => {})
    }, [])

    const handlePost = async (e) => {
        e.preventDefault()
        setPosting(true); setPostError(null); setPostSuccess(false)
        try {
            await scrimService.create({
                team_id: Number(postForm.team_id),
                scheduled_date: new Date(postForm.scheduled_date).toISOString(),
                pick_mode: postForm.pick_mode,
                banned_content_league: postForm.banned_content_league || null,
                notes: postForm.notes || null,
                challenged_team_id: postForm.challenged_team_id ? Number(postForm.challenged_team_id) : null,
            })
            setPostSuccess(true)
            setPostForm(prev => ({ ...prev, scheduled_date: '', banned_content_league: '', notes: '', challenged_team_id: '' }))
            setTeamSearch('')
            await Promise.all([loadOpenScrims(), loadMyScrims()])
        } catch (err) { setPostError(err.message || 'Failed to post scrim') }
        finally { setPosting(false) }
    }

    const handleAccept = async (scrimId, teamId) => {
        setActionLoading(scrimId)
        try { await scrimService.accept({ scrim_id: scrimId, team_id: teamId }); await Promise.all([loadOpenScrims(), loadMyScrims()]) }
        catch (err) { alert(err.message || 'Failed to accept scrim') }
        finally { setActionLoading(null) }
    }

    const handleCancel = async (scrimId) => {
        setActionLoading(scrimId)
        try { await scrimService.cancel(scrimId); await Promise.all([loadOpenScrims(), loadMyScrims()]) }
        catch (err) { alert(err.message || 'Failed to cancel scrim') }
        finally { setActionLoading(null) }
    }

    const handleDecline = async (scrimId) => {
        setActionLoading(scrimId)
        try { await scrimService.decline(scrimId); await Promise.all([loadOpenScrims(), loadMyScrims()]) }
        catch (err) { alert(err.message || 'Failed to decline challenge') }
        finally { setActionLoading(null) }
    }

    const uniqueLeagues = [...new Map(openScrims.map(s => [s.leagueSlug, { slug: s.leagueSlug, name: s.leagueName }])).values()]
    const uniqueTiers = [...new Set(openScrims.map(s => s.divisionTier).filter(Boolean))].sort((a, b) => a - b)
    const selectedTeam = captainTeams.find(t => t.teamId === Number(postForm.team_id))
    const captainTeamIds = new Set(captainTeams.map(t => t.teamId))
    const filteredChallengeTeams = allTeams.filter(t =>
        !captainTeamIds.has(t.id) && (teamSearch === '' ||
            t.name.toLowerCase().includes(teamSearch.toLowerCase()) ||
            t.leagueName.toLowerCase().includes(teamSearch.toLowerCase()) ||
            t.divisionName.toLowerCase().includes(teamSearch.toLowerCase()))
    )
    const [acceptModal, setAcceptModal] = useState(null)

    // Calculate default window position (centered, below banner)
    const defaultWinX = typeof window !== 'undefined' ? Math.max(20, (window.innerWidth - 800) / 2) : 100
    const defaultWinY = typeof window !== 'undefined' ? Math.min(380, window.innerHeight * 0.35) : 380

    return (
        <>
            <PageTitle title="Scrim Planner" description="Find and schedule scrimmage matches." />
            <Navbar />

            <div className="xp-theme" style={{ backgroundImage: `url(${xpBg})` }}>
                {/* ═══ DESKTOP GOD ICONS (left-aligned grid, draggable + snapping) ═══ */}
                {desktopGods.length > 0 && <DesktopIconGrid gods={desktopGods} />}

                {/* ═══ DINO BANNER (draggable window) ═══ */}
                <DraggableXpWindow
                    title="DinoRunner.exe"
                    icon="&#127918;"
                    defaultX={typeof window !== 'undefined' ? Math.max(0, (window.innerWidth - Math.min(900, window.innerWidth * 0.92)) / 2) : 0}
                    defaultY={80}
                    className="xp-dino-window"
                    resizable={false}
                >
                    <XpDinoGame />
                </DraggableXpWindow>

                {/* ═══ COIN FLIP WINDOW ═══ */}
                <DraggableXpWindow
                    title="CoinFlip.exe"
                    icon="&#128176;"
                    defaultX={typeof window !== 'undefined' ? Math.min(window.innerWidth - 280, window.innerWidth * 0.72) : 500}
                    defaultY={110}
                    className="xp-coinflip-window"
                    resizable={false}
                >
                    <XpCoinFlip />
                </DraggableXpWindow>

                {/* ═══ DRAGGABLE SCRIM PLANNER WINDOW ═══ */}
                <DraggableXpWindow
                    title="Scrim Planner"
                    icon="&#9876;"
                    defaultX={defaultWinX}
                    defaultY={defaultWinY}
                    className="xp-main-window"
                >
                    {/* Tabs */}
                    <div className="xp-tab-bar">
                        {TABS.map(tab => (
                            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                                className={`xp-tab ${activeTab === tab.key ? 'xp-tab-active' : ''}`}>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="xp-tab-content">
                        {loading && <XpProgressBar />}

                        {error && (
                            <div className="flex items-center gap-3 p-4">
                                <div className="xp-error-icon">X</div>
                                <span className="xp-text">{error}</span>
                            </div>
                        )}

                        {!loading && !error && (
                            <>
                                {activeTab === 'open' && (
                                    <OpenScrimsTab scrims={openScrims} user={user} currentUserId={user?.id}
                                        captainTeams={captainTeams} leagueFilter={leagueFilter} setLeagueFilter={setLeagueFilter}
                                        tierFilter={tierFilter} setTierFilter={setTierFilter} uniqueLeagues={uniqueLeagues}
                                        uniqueTiers={uniqueTiers} onAccept={handleAccept} actionLoading={actionLoading}
                                        login={login} acceptModal={acceptModal} setAcceptModal={setAcceptModal} />
                                )}
                                {activeTab === 'my' && user && (
                                    <MyScrimsTab scrims={myScrims} incomingScrims={incomingScrims} captainTeams={captainTeams}
                                        currentUserId={user?.id} onAccept={handleAccept} onCancel={handleCancel}
                                        onDecline={handleDecline} actionLoading={actionLoading} acceptModal={acceptModal}
                                        setAcceptModal={setAcceptModal} />
                                )}
                                {activeTab === 'post' && isCaptain && (
                                    <PostScrimTab form={postForm} setForm={setPostForm} captainTeams={captainTeams}
                                        selectedTeam={selectedTeam} onSubmit={handlePost} posting={posting}
                                        postError={postError} postSuccess={postSuccess} teamSearch={teamSearch}
                                        setTeamSearch={setTeamSearch} showTeamPicker={showTeamPicker}
                                        setShowTeamPicker={setShowTeamPicker} filteredChallengeTeams={filteredChallengeTeams}
                                        allTeams={allTeams} />
                                )}
                            </>
                        )}
                    </div>
                </DraggableXpWindow>

                {/* ═══ XP TASKBAR ═══ */}
                <div className="xp-taskbar">
                    {/* Start button + menu */}
                    <div ref={startRef} className="relative">
                        <button
                            onClick={() => !user ? login() : setStartMenuOpen(prev => !prev)}
                            className={`xp-start-btn ${startMenuOpen ? 'xp-start-pressed' : ''}`}
                        >
                            <span className="xp-start-flag">&#10063;</span>
                            <span>start</span>
                        </button>

                        {/* Start Menu popup */}
                        {startMenuOpen && (
                            <div className="xp-start-menu">
                                <div className="xp-start-menu-banner">
                                    <span className="xp-start-menu-banner-text">SmiteComp</span>
                                </div>
                                <div className="xp-start-menu-body">
                                    <Link
                                        to="/coinflip"
                                        onClick={() => setStartMenuOpen(false)}
                                        className="xp-start-menu-item"
                                    >
                                        <div className="xp-start-menu-item-icon-wrap">
                                            <img src={passionCoin} alt="" className="xp-start-menu-icon" />
                                        </div>
                                        <span>Coin Flip</span>
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Quick launch divider */}
                    <div className="xp-taskbar-divider" />

                    {/* Active window buttons */}
                    <button className="xp-taskbar-window-btn xp-taskbar-window-active">
                        <span style={{ fontSize: 12 }}>&#9876;</span>
                        <span>Scrim Planner</span>
                    </button>
                    <button className="xp-taskbar-window-btn xp-taskbar-window-active">
                        <span style={{ fontSize: 12 }}>&#128176;</span>
                        <span>CoinFlip</span>
                    </button>

                    <div className="flex-1" />

                    {/* System tray */}
                    <div className="xp-tray">
                        {!user && <span className="xp-tray-text">Log in to post or accept scrims</span>}
                        {user && <span className="xp-tray-text">{user.discord_username}</span>}
                        <div className="xp-tray-divider" />
                        <XpClock />
                    </div>
                </div>
            </div>

            <style>{XP_STYLES}</style>
        </>
    )
}


// ═══════════════════════════════════════════════════
// Scrim Card
// ═══════════════════════════════════════════════════
function ScrimCard({ scrim, showActions, captainTeams, currentUserId, onAccept, onCancel, onDecline, actionLoading, acceptModal, setAcceptModal, isChallenge }) {
    const isLoading = actionLoading === scrim.id
    const acceptableTeams = captainTeams.filter(t => t.teamId !== scrim.teamId)
    const handleAcceptClick = () => {
        if (acceptableTeams.length === 1) onAccept(scrim.id, acceptableTeams[0].teamId)
        else setAcceptModal(scrim.id)
    }
    const isOwnPost = currentUserId && scrim.userId === currentUserId
    const isOwnTeam = captainTeams.some(t => t.teamId === scrim.teamId)
    const canAccept = acceptableTeams.length > 0 && !isOwnPost
    const canCancel = isOwnPost || isOwnTeam

    return (
        <div className="xp-scrim-card">
            <div className="flex items-start gap-3 w-full">
                <div className="flex-shrink-0"><TeamLogo slug={scrim.teamSlug} name={scrim.teamName} size={36} /></div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="xp-text" style={{ fontWeight: 700 }}>{scrim.teamName}</span>
                        <span className="xp-text" style={{ fontSize: 10, color: '#666' }}>{scrim.leagueName} &middot; {scrim.divisionName}</span>
                    </div>
                    <div className="flex items-center gap-1 mb-1">
                        <Clock size={11} style={{ color: '#555' }} />
                        <span className="xp-text" style={{ fontSize: 11 }}>{formatDateEST(scrim.scheduledDate)}</span>
                        <span className="xp-text" style={{ fontSize: 10, color: '#999' }}>({formatRelativeDate(scrim.scheduledDate)})</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className={`xp-badge ${XP_PICK_BADGE[scrim.pickMode] || 'xp-badge-blue'}`}>{formatPickMode(scrim.pickMode)}</span>
                        {scrim.divisionName && <span className="xp-badge xp-badge-amber">{scrim.divisionName}</span>}
                        {scrim.bannedContentLeague && <span className="xp-badge xp-badge-red"><Shield size={9} /> {scrim.bannedContentLeague}</span>}
                        {isChallenge && <span className="xp-badge xp-badge-purple"><Target size={9} /> Challenge</span>}
                    </div>
                    {scrim.notes && (
                        <div className="flex items-start gap-1 mb-1">
                            <MessageSquare size={10} style={{ color: '#888', marginTop: 2, flexShrink: 0 }} />
                            <span className="xp-text" style={{ fontSize: 11, color: '#555' }}>{scrim.notes}</span>
                        </div>
                    )}
                    {scrim.challengedTeamName && (
                        <div className="flex items-center gap-1.5 mb-1">
                            <Target size={11} style={{ color: '#6a3ea1' }} />
                            <span className="xp-text" style={{ fontSize: 11, color: '#6a3ea1' }}>Challenging: </span>
                            <TeamLogo slug={scrim.challengedTeamSlug} name={scrim.challengedTeamName} size={14} />
                            <span className="xp-text" style={{ fontSize: 11, fontWeight: 700, color: '#6a3ea1' }}>{scrim.challengedTeamName}</span>
                        </div>
                    )}
                    {scrim.status === 'accepted' && scrim.acceptedTeamName && (
                        <div className="flex items-center gap-1.5 mb-1">
                            <Check size={11} style={{ color: '#2d8212' }} />
                            <span className="xp-text" style={{ fontSize: 11, color: '#2d8212' }}>Accepted by: </span>
                            <TeamLogo slug={scrim.acceptedTeamSlug} name={scrim.acceptedTeamName} size={14} />
                            <span className="xp-text" style={{ fontSize: 11, fontWeight: 700, color: '#2d8212' }}>{scrim.acceptedTeamName}</span>
                        </div>
                    )}
                    <div className="xp-text" style={{ fontSize: 10, color: '#999' }}>Posted by {scrim.postedBy}</div>
                </div>
                {showActions && (
                    <div className="flex flex-col gap-1 flex-shrink-0">
                        {scrim.status === 'open' && canAccept && (
                            <>
                                <button onClick={handleAcceptClick} disabled={isLoading} className="xp-btn xp-btn-primary">{isLoading ? '...' : 'Accept'}</button>
                                {acceptModal === scrim.id && acceptableTeams.length > 1 && (
                                    <div className="xp-listbox" style={{ minWidth: 130 }}>
                                        <div className="xp-text" style={{ fontSize: 10, padding: '2px 6px', color: '#555' }}>Accept as:</div>
                                        {acceptableTeams.map(t => (
                                            <button key={t.teamId} onClick={() => { onAccept(scrim.id, t.teamId); setAcceptModal(null) }} className="xp-listbox-item">
                                                <TeamLogo slug={t.teamSlug} name={t.teamName} size={14} />
                                                <span>{t.teamName}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                        {scrim.status === 'open' && isChallenge && (
                            <button onClick={() => onDecline(scrim.id)} disabled={isLoading} className="xp-btn xp-btn-danger">{isLoading ? '...' : 'Decline'}</button>
                        )}
                        {scrim.status === 'open' && canCancel && (
                            <button onClick={() => onCancel(scrim.id)} disabled={isLoading} className="xp-btn xp-btn-danger">{isLoading ? '...' : 'Cancel'}</button>
                        )}
                        {scrim.status === 'accepted' && <span className="xp-badge xp-badge-green">Accepted</span>}
                        {scrim.status === 'cancelled' && <span className="xp-badge xp-badge-red">Cancelled</span>}
                        {scrim.status === 'expired' && <span className="xp-badge xp-badge-gray">Expired</span>}
                    </div>
                )}
            </div>
        </div>
    )
}


// ═══════════════════════════════════════════════════
// Open Scrims Tab
// ═══════════════════════════════════════════════════
function OpenScrimsTab({ scrims, user, currentUserId, captainTeams, leagueFilter, setLeagueFilter, tierFilter, setTierFilter, uniqueLeagues, uniqueTiers, onAccept, actionLoading, acceptModal, setAcceptModal }) {
    return (
        <div>
            {scrims.length > 0 && (
                <div className="flex items-center gap-2 mb-2 flex-wrap" style={{ borderBottom: '1px solid #c0c0c0', paddingBottom: 6 }}>
                    <span className="xp-text" style={{ fontSize: 11, fontWeight: 700 }}>Filter:</span>
                    <select value={leagueFilter} onChange={e => setLeagueFilter(e.target.value)} className="xp-select">
                        <option value="">All Leagues</option>
                        {uniqueLeagues.map(l => <option key={l.slug} value={l.slug}>{l.name}</option>)}
                    </select>
                    <select value={tierFilter} onChange={e => setTierFilter(e.target.value)} className="xp-select">
                        <option value="">All Tiers</option>
                        {uniqueTiers.map(t => <option key={t} value={t}>Tier {t}</option>)}
                    </select>
                </div>
            )}
            <div className="flex flex-col gap-0.5">
                {scrims.map(scrim => (
                    <ScrimCard key={scrim.id} scrim={scrim} showActions={!!user} captainTeams={captainTeams}
                        currentUserId={currentUserId} onAccept={onAccept} onCancel={() => {}} onDecline={() => {}}
                        actionLoading={actionLoading} acceptModal={acceptModal} setAcceptModal={setAcceptModal} isChallenge={false} />
                ))}
            </div>
            {scrims.length === 0 && (
                <div className="text-center py-10">
                    <div style={{ fontSize: 36 }}>&#9876;</div>
                    <div className="xp-text" style={{ fontWeight: 700, marginTop: 4 }}>No open scrims right now</div>
                    <div className="xp-text" style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                        {user ? 'Be the first to post a scrim request!' : 'Check back later or log in to post one.'}
                    </div>
                </div>
            )}
        </div>
    )
}


// ═══════════════════════════════════════════════════
// My Scrims Tab
// ═══════════════════════════════════════════════════
function MyScrimsTab({ scrims, incomingScrims, captainTeams, currentUserId, onAccept, onCancel, onDecline, actionLoading, acceptModal, setAcceptModal }) {
    const openScrims = scrims.filter(s => s.status === 'open' && !incomingScrims.some(i => i.id === s.id))
    const acceptedScrims = scrims.filter(s => s.status === 'accepted')
    const pastScrims = scrims.filter(s => s.status === 'cancelled' || s.status === 'expired')

    const Section = ({ title, items, challenge = false, dim = false }) => items.length > 0 && (
        <fieldset className="xp-fieldset" style={dim ? { opacity: 0.55 } : undefined}>
            <legend className="xp-fieldset-legend">{title} ({items.length})</legend>
            <div className="flex flex-col gap-0.5">
                {items.map(s => (
                    <ScrimCard key={s.id} scrim={s} showActions captainTeams={captainTeams} currentUserId={currentUserId}
                        onAccept={onAccept} onCancel={onCancel} onDecline={onDecline} actionLoading={actionLoading}
                        acceptModal={acceptModal} setAcceptModal={setAcceptModal} isChallenge={challenge || !!s.challengedTeamId} />
                ))}
            </div>
        </fieldset>
    )

    return (
        <div className="flex flex-col gap-3">
            <Section title="Incoming Challenges" items={incomingScrims} challenge />
            <Section title="Your Open Requests" items={openScrims} />
            <Section title="Confirmed Scrims" items={acceptedScrims} />
            <Section title="Past Scrims" items={pastScrims} dim />
            {scrims.length === 0 && incomingScrims.length === 0 && (
                <div className="text-center py-10">
                    <div style={{ fontSize: 36 }}>&#128187;</div>
                    <div className="xp-text" style={{ fontWeight: 700, marginTop: 4 }}>No scrims yet</div>
                    <div className="xp-text" style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                        {captainTeams.length > 0 ? 'Post a scrim or accept one from Open Scrims.' : 'You need to be a team captain to manage scrims.'}
                    </div>
                </div>
            )}
        </div>
    )
}


// ═══════════════════════════════════════════════════
// Post Scrim Tab
// ═══════════════════════════════════════════════════
function PostScrimTab({ form, setForm, captainTeams, selectedTeam, onSubmit, posting, postError, postSuccess, teamSearch, setTeamSearch, showTeamPicker, setShowTeamPicker, filteredChallengeTeams, allTeams }) {
    const challengedTeam = allTeams.find(t => t.id === Number(form.challenged_team_id))

    return (
        <div style={{ maxWidth: 460, margin: '0 auto' }}>
            <form onSubmit={onSubmit}>
                <fieldset className="xp-fieldset">
                    <legend className="xp-fieldset-legend">Your Team</legend>
                    {captainTeams.length === 1 ? (
                        <div className="flex items-center gap-3 p-1.5" style={{ background: '#fff', border: '1px solid #c0c0c0' }}>
                            <TeamLogo slug={captainTeams[0].teamSlug} name={captainTeams[0].teamName} size={24} />
                            <div>
                                <div className="xp-text" style={{ fontWeight: 700 }}>{captainTeams[0].teamName}</div>
                                <div className="xp-text" style={{ fontSize: 10, color: '#666' }}>{captainTeams[0].leagueName} &middot; {captainTeams[0].divisionName}</div>
                            </div>
                        </div>
                    ) : (
                        <select value={form.team_id} onChange={e => setForm({ ...form, team_id: e.target.value })} className="xp-select w-full">
                            {captainTeams.map(t => <option key={t.teamId} value={t.teamId}>{t.teamName} ({t.leagueName} - {t.divisionName})</option>)}
                        </select>
                    )}
                    {selectedTeam && <div className="xp-text" style={{ fontSize: 10, color: '#0058e6', marginTop: 3 }}>Division: {selectedTeam.divisionName}</div>}
                </fieldset>

                <fieldset className="xp-fieldset">
                    <legend className="xp-fieldset-legend">Date & Time (EST)</legend>
                    <input type="datetime-local" value={form.scheduled_date} onChange={e => setForm({ ...form, scheduled_date: e.target.value })} required className="xp-input w-full" />
                    <div className="xp-text" style={{ fontSize: 10, color: '#666', marginTop: 2 }}>All times in Eastern Standard Time</div>
                </fieldset>

                <fieldset className="xp-fieldset">
                    <legend className="xp-fieldset-legend">Pick Mode</legend>
                    <div className="flex flex-col gap-1">
                        {PICK_MODES.map(mode => (
                            <label key={mode.value} className="xp-radio-label">
                                <input type="radio" name="pick_mode" checked={form.pick_mode === mode.value}
                                    onChange={() => setForm({ ...form, pick_mode: mode.value })} className="xp-radio" />
                                <span className="xp-text">{mode.label}</span>
                            </label>
                        ))}
                    </div>
                </fieldset>

                <fieldset className="xp-fieldset">
                    <legend className="xp-fieldset-legend">Banned Content</legend>
                    <input type="text" value={form.banned_content_league} onChange={e => setForm({ ...form, banned_content_league: e.target.value })}
                        placeholder="e.g., AGL Deity bans, No bans..." className="xp-input w-full" />
                </fieldset>

                <fieldset className="xp-fieldset">
                    <legend className="xp-fieldset-legend">Challenge a Team (optional)</legend>
                    <div className="xp-text" style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>Leave empty for an open request visible to all.</div>
                    {challengedTeam ? (
                        <div className="flex items-center gap-2 p-1.5" style={{ background: '#e0c8ff', border: '1px solid #8055c0' }}>
                            <TeamLogo slug={challengedTeam.slug} name={challengedTeam.name} size={20} />
                            <div className="flex-1">
                                <div className="xp-text" style={{ fontWeight: 700, color: '#400080' }}>{challengedTeam.name}</div>
                                <div className="xp-text" style={{ fontSize: 10, color: '#666' }}>{challengedTeam.leagueName} &middot; {challengedTeam.divisionName}</div>
                            </div>
                            <button type="button" onClick={() => { setForm({ ...form, challenged_team_id: '' }); setTeamSearch('') }} className="xp-btn" style={{ padding: '1px 6px', fontSize: 10 }}>X</button>
                        </div>
                    ) : (
                        <div className="relative">
                            <input type="text" value={teamSearch} onChange={e => { setTeamSearch(e.target.value); setShowTeamPicker(true) }}
                                onFocus={() => setShowTeamPicker(true)} placeholder="Search for a team..." className="xp-input w-full" />
                            {showTeamPicker && teamSearch && (
                                <div className="xp-listbox absolute z-10 w-full" style={{ maxHeight: 180, overflowY: 'auto' }}>
                                    {filteredChallengeTeams.slice(0, 20).map(team => (
                                        <button key={team.id} type="button" onClick={() => { setForm({ ...form, challenged_team_id: String(team.id) }); setShowTeamPicker(false); setTeamSearch('') }} className="xp-listbox-item">
                                            <TeamLogo slug={team.slug} name={team.name} size={16} />
                                            <div>
                                                <div className="xp-text" style={{ fontWeight: 500 }}>{team.name}</div>
                                                <div className="xp-text" style={{ fontSize: 10, color: '#666' }}>{team.leagueName} &middot; {team.divisionName}</div>
                                            </div>
                                        </button>
                                    ))}
                                    {filteredChallengeTeams.length === 0 && <div className="xp-text" style={{ padding: '4px 8px', fontSize: 11, color: '#666' }}>No teams found</div>}
                                </div>
                            )}
                        </div>
                    )}
                </fieldset>

                <fieldset className="xp-fieldset">
                    <legend className="xp-fieldset-legend">Notes (optional)</legend>
                    <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                        placeholder="Additional details..." rows={3} maxLength={500} className="xp-input w-full" style={{ resize: 'none' }} />
                </fieldset>

                {postError && (
                    <div className="flex items-center gap-2 mb-2 p-2" style={{ background: '#ffc8c8', border: '1px solid #c05555' }}>
                        <div className="xp-error-icon" style={{ width: 16, height: 16, fontSize: 9 }}>X</div>
                        <span className="xp-text" style={{ fontSize: 11, color: '#800000' }}>{postError}</span>
                    </div>
                )}
                {postSuccess && (
                    <div className="flex items-center gap-2 mb-2 p-2" style={{ background: '#c8ffc8', border: '1px solid #55c055' }}>
                        <Check size={13} style={{ color: '#2d8212' }} />
                        <span className="xp-text" style={{ fontSize: 11, color: '#004000' }}>Scrim request posted!</span>
                    </div>
                )}

                <button type="submit" disabled={posting || !form.team_id || !form.scheduled_date}
                    className="xp-btn xp-btn-primary w-full" style={{ padding: '6px 16px', fontSize: 12 }}>
                    {posting ? 'Posting...' : form.challenged_team_id ? 'Send Challenge' : 'Post Open Scrim'}
                </button>
            </form>
        </div>
    )
}


// ═══════════════════════════════════════════════════
// Scoped XP Styles
// ═══════════════════════════════════════════════════
const XP_STYLES = `
/* ── Base ── */
.xp-theme {
    font-family: system-ui, Tahoma, "Segoe UI", sans-serif;
    color: #000;
    position: relative;
    min-height: 100vh;
    padding-bottom: 44px;
    background: #3a6ea5 center/cover fixed no-repeat;
    overflow-x: hidden;
}
.xp-theme h1,.xp-theme h2,.xp-theme h3 { font-family: "Pixelify Sans", system-ui, sans-serif; }
.xp-text { font-family: system-ui, Tahoma, "Segoe UI", sans-serif; font-size: 12px; color: #000; line-height: 1.4; }

/* ── Dino window ── */
.xp-dino-window {
    z-index: 10;
    width: min(900px, 92vw) !important;
}

/* ── Desktop Icons ── */
.xp-desktop-icons {
    position: absolute; top: 0; left: 0; right: 0; bottom: 44px;
    z-index: 1; pointer-events: none;
}
.xp-desktop-icon {
    display: flex; flex-direction: column; align-items: center; gap: 3px;
    padding: 4px 2px; border-radius: 3px; cursor: default;
    width: 88px;
    user-select: none;
    touch-action: none;
    pointer-events: auto;
}
.xp-desktop-icon:hover,
.xp-desktop-icon-selected { background: rgba(55,100,180,0.3); }
.xp-desktop-icon:hover .xp-desktop-icon-label,
.xp-desktop-icon-selected .xp-desktop-icon-label { background: #316ac5; color: #fff; }
.xp-desktop-icon-img-wrap {
    width: 64px; height: 64px;
    overflow: hidden;
    border: 2px outset #d4d0c8; background: #c0c0c0;
    box-shadow: 1px 1px 0 rgba(0,0,0,0.3);
    position: relative;
}
.xp-desktop-icon-img {
    /* Render at 3x3 then scale to fill = ultra chunky pixels */
    width: 3px; height: 3px; object-fit: cover;
    image-rendering: pixelated;
    transform: scale(22);
    transform-origin: top left;
    position: absolute; top: 0; left: 0;
    filter: contrast(1.4) saturate(0.65);
}
/* XP shortcut arrow overlay (bottom-left) */
.xp-shortcut-img {
    position: absolute; bottom: 0; left: 0;
    width: 22px; height: 22px;
    object-fit: contain;
    z-index: 2; pointer-events: none;
}
.xp-desktop-icon-label {
    font-family: "Pixelify Sans", system-ui, sans-serif;
    font-size: 11px; color: #fff;
    text-shadow: 1px 1px 2px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.7);
    text-align: center; line-height: 1.2;
    padding: 1px 3px; border-radius: 1px;
    max-width: 84px;
    overflow: hidden; text-overflow: ellipsis;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}

/* ── Window Chrome ── */
.xp-window {
    border-radius: 8px 8px 0 0;
    overflow: hidden;
    box-shadow: 2px 3px 12px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(166,202,240,0.4);
    border: 1px solid #0054e3;
}
.xp-title-bar {
    background: linear-gradient(180deg,
        #0997ff 0%, #0053ee 8%, #0050ee 20%,
        #1a6cff 50%, #0048dd 52%,
        #0054ee 85%, #0264ff 100%
    );
    padding: 3px 6px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 26px;
    user-select: none;
}
.xp-title-text {
    font-family: "Pixelify Sans", system-ui, sans-serif;
    color: #fff; font-weight: 700; font-size: 13px;
    text-shadow: 1px 1px 2px rgba(0,0,0,0.4);
}
.xp-title-btn {
    width: 21px; height: 21px; border-radius: 3px;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: bold; cursor: default; line-height: 1; color: #fff;
}
.xp-tbtn-min,.xp-tbtn-max {
    background: linear-gradient(180deg, #3c8eff 0%, #2663de 45%, #1a4cc0 50%, #2157d4 100%);
    border: 1px solid rgba(255,255,255,0.3);
}
.xp-tbtn-x {
    background: linear-gradient(180deg, #e88c6c 0%, #d05040 45%, #c13b2a 50%, #d4533f 100%);
    border: 1px solid rgba(255,255,255,0.3);
}
.xp-window-body { background: #ece9d8; padding: 4px; }

/* ── Draggable + Resizable Window ── */
.xp-window-draggable {
    position: absolute;
    width: min(800px, 92vw);
}
.xp-window-body-scroll {
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #a0a0a0 #ece9d8;
}
.xp-main-window { z-index: 20; }

/* ── Resize Handle ── */
.xp-resize-handle {
    position: absolute; right: 0; bottom: 0;
    width: 16px; height: 16px; cursor: nwse-resize;
    background:
        linear-gradient(135deg,
            transparent 0%, transparent 40%,
            #808080 40%, #808080 45%,
            transparent 45%, transparent 55%,
            #808080 55%, #808080 60%,
            transparent 60%, transparent 70%,
            #808080 70%, #808080 75%,
            transparent 75%
        );
    opacity: 0.6;
    z-index: 5;
}
.xp-resize-handle:hover { opacity: 1; }

/* ── Tabs ── */
.xp-tab-bar {
    display: flex; gap: 0;
    border-bottom: 1px solid #7f9db9;
    padding-left: 4px;
}
.xp-tab {
    font-family: system-ui, Tahoma, sans-serif;
    font-size: 11px; padding: 4px 14px;
    background: #d6d0c4; border: 1px solid #7f9db9;
    border-bottom: none; border-radius: 4px 4px 0 0;
    cursor: pointer; position: relative; top: 1px; color: #000; margin-right: -1px;
}
.xp-tab:hover { background: #e8e4d8; }
.xp-tab-active { background: #ece9d8; border-bottom: 1px solid #ece9d8; font-weight: bold; z-index: 1; }
.xp-tab-content { border: 1px solid #7f9db9; border-top: none; background: #ece9d8; padding: 6px; min-height: 120px; }

/* ── Buttons ── */
.xp-btn {
    font-family: system-ui, Tahoma, sans-serif; font-size: 11px;
    padding: 2px 10px; border-radius: 3px; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center; gap: 3px;
    background: linear-gradient(180deg, #fff 0%, #ece9d8 80%, #d6d0c4 100%);
    border: 1px solid #003c74; color: #000;
    box-shadow: inset 0 1px 0 #fff, 0 1px 0 rgba(0,0,0,0.1);
}
.xp-btn:hover { background: linear-gradient(180deg, #fff8e8, #f0e8d8); }
.xp-btn:active { background: linear-gradient(180deg, #d6d0c4, #ccc6b8); box-shadow: inset 0 1px 2px rgba(0,0,0,0.2); }
.xp-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.xp-btn-primary {
    background: linear-gradient(180deg, #4fa0e8 0%, #2570c4 100%);
    border: 1px solid #003c9a; color: #fff; font-weight: bold;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.3);
    text-shadow: 0 1px 1px rgba(0,0,0,0.3);
}
.xp-btn-primary:hover { background: linear-gradient(180deg, #5cb0f0, #2d7ad4); }
.xp-btn-primary:active { background: linear-gradient(180deg, #2060b0, #1a50a0); }
.xp-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.xp-btn-danger {
    background: linear-gradient(180deg, #ff8080 0%, #cc3030 100%);
    border: 1px solid #800000; color: #fff; font-weight: bold; font-size: 11px;
    padding: 2px 10px; border-radius: 3px; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center;
    text-shadow: 0 1px 1px rgba(0,0,0,0.3);
}
.xp-btn-danger:hover { background: linear-gradient(180deg, #ff9090, #dd4040); }
.xp-btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── Inputs ── */
.xp-input {
    font-family: system-ui, Tahoma, sans-serif; font-size: 12px;
    padding: 3px 5px; background: #fff;
    border: 2px solid; border-color: #7f9db9 #f0f0f0 #f0f0f0 #7f9db9;
    border-radius: 0; color: #000; outline: none;
}
.xp-input:focus { border-color: #0058e6 #c0c0c0 #c0c0c0 #0058e6; }
.xp-input::placeholder { color: #999; }
.xp-select {
    font-family: system-ui, Tahoma, sans-serif; font-size: 11px;
    padding: 2px 18px 2px 5px; background: #fff;
    border: 2px solid; border-color: #7f9db9 #f0f0f0 #f0f0f0 #7f9db9;
    color: #000; border-radius: 0; appearance: auto; cursor: pointer;
}
.xp-radio-label { display: flex; align-items: center; gap: 5px; cursor: pointer; padding: 1px 0; }
.xp-radio { accent-color: #0058e6; cursor: pointer; }

/* ── Fieldset ── */
.xp-fieldset {
    border: 2px groove #d4d0c8; border-radius: 0;
    padding: 6px 8px; margin-bottom: 6px;
}
.xp-fieldset-legend {
    font-family: system-ui, Tahoma, sans-serif;
    font-size: 11px; font-weight: bold; color: #000; padding: 0 3px;
}

/* ── Badges ── */
.xp-badge {
    display: inline-flex; align-items: center; gap: 2px;
    padding: 1px 5px; font-family: system-ui, Tahoma, sans-serif;
    font-size: 10px; font-weight: bold; border: 1px solid; border-radius: 2px; white-space: nowrap;
}
.xp-badge-blue { background: #c0d8ff; border-color: #5580c0; color: #003080; }
.xp-badge-red { background: #ffc8c8; border-color: #c05555; color: #800000; }
.xp-badge-orange { background: #ffe0b0; border-color: #c08030; color: #804000; }
.xp-badge-purple { background: #e0c8ff; border-color: #8055c0; color: #400080; }
.xp-badge-green { background: #c8ffc8; border-color: #55c055; color: #004000; }
.xp-badge-amber { background: #fff0c0; border-color: #c0a030; color: #604000; }
.xp-badge-gray { background: #e0e0e0; border-color: #808080; color: #404040; }

/* ── Scrim Card ── */
.xp-scrim-card {
    background: #fff; border: 1px solid #c0c0c0;
    padding: 6px 8px;
}
.xp-scrim-card:hover { background: #eff4ff; }

/* ── Listbox ── */
.xp-listbox { background: #fff; border: 2px solid; border-color: #7f9db9 #f0f0f0 #f0f0f0 #7f9db9; }
.xp-listbox-item {
    display: flex; align-items: center; gap: 5px; width: 100%;
    padding: 3px 6px; font-family: system-ui, Tahoma, sans-serif;
    font-size: 11px; color: #000; cursor: pointer; border: none; background: transparent; text-align: left;
}
.xp-listbox-item:hover { background: #316ac5; color: #fff; }

/* ── Progress Bar ── */
.xp-progress {
    width: 200px; height: 16px; background: #fff;
    border: 2px solid; border-color: #7f9db9 #f0f0f0 #f0f0f0 #7f9db9;
    overflow: hidden; position: relative;
}
.xp-progress-bar {
    position: absolute; height: 100%; width: 30%;
    background: repeating-linear-gradient(90deg, #3a8cf2 0px, #3a8cf2 8px, #5ba3e8 8px, #5ba3e8 10px);
    animation: xp-slide 1.5s ease-in-out infinite;
}
@keyframes xp-slide { 0% { left: -30%; } 100% { left: 100%; } }

/* ── Error Icon ── */
.xp-error-icon {
    width: 22px; height: 22px; border-radius: 50%; background: #cc0000;
    color: #fff; font-weight: bold; font-size: 13px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}

/* ── Taskbar ── */
.xp-taskbar {
    position: fixed; bottom: 0; left: 0; right: 0; height: 38px;
    background: linear-gradient(180deg,
        #3168d5 0%, #2456c7 2%, #1d4aba 48%,
        #1941a5 50%, #1d4aba 98%, #3168d5 100%
    );
    border-top: 2px solid #0c3daa;
    display: flex; align-items: center; padding: 0 4px; gap: 2px;
    z-index: 50;
}
.xp-start-btn {
    background: linear-gradient(180deg,
        #4aad22 0%, #3c9a16 2%, #328e14 48%,
        #2d8212 50%, #3c9a16 98%, #4aad22 100%
    );
    border: 1px solid #2a7510; border-radius: 0 8px 8px 0;
    color: #fff; font-weight: bold; font-size: 15px;
    font-family: "Pixelify Sans", system-ui, sans-serif;
    padding: 2px 14px 2px 6px;
    display: flex; align-items: center; gap: 5px;
    text-shadow: 1px 1px 1px rgba(0,0,0,0.5);
    cursor: pointer; height: 32px;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.2);
}
.xp-start-btn:hover { filter: brightness(1.08); }
.xp-start-pressed {
    background: linear-gradient(180deg,
        #3c8a14 0%, #2d7510 2%, #256a0e 48%,
        #216310 50%, #2d7510 98%, #3c8a14 100%
    ) !important;
    box-shadow: inset 0 2px 3px rgba(0,0,0,0.3) !important;
}
.xp-start-flag {
    font-size: 16px; line-height: 1;
}

/* ── Start Menu ── */
.xp-start-menu {
    position: absolute; bottom: 100%; left: 0;
    margin-bottom: 2px; width: 240px;
    background: #fff; border: 2px solid #0054e3;
    border-radius: 8px 8px 0 0;
    box-shadow: 3px 3px 12px rgba(0,0,0,0.4);
    overflow: hidden;
    z-index: 100;
}
.xp-start-menu-banner {
    background: linear-gradient(180deg, #2062d0 0%, #1349a0 100%);
    padding: 8px 10px; display: flex; align-items: center;
}
.xp-start-menu-banner-text {
    font-family: "Pixelify Sans", system-ui, sans-serif;
    font-size: 16px; font-weight: 700; color: #fff;
    text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
}
.xp-start-menu-body { padding: 4px 0; }
.xp-start-menu-item {
    display: flex; align-items: center; gap: 10px;
    padding: 6px 12px; width: 100%;
    font-family: system-ui, Tahoma, sans-serif;
    font-size: 12px; color: #000;
    text-decoration: none; cursor: pointer;
    border: none; background: transparent;
}
.xp-start-menu-item:hover { background: #316ac5; color: #fff; }
.xp-start-menu-item-icon-wrap {
    width: 28px; height: 28px; overflow: hidden; position: relative;
    flex-shrink: 0;
}
.xp-start-menu-icon {
    width: 7px; height: 7px; object-fit: contain;
    image-rendering: pixelated;
    transform: scale(4);
    transform-origin: top left;
    position: absolute; top: 0; left: 0;
    filter: contrast(1.15) saturate(0.85);
}

.xp-taskbar-divider {
    width: 2px; height: 24px; margin: 0 4px;
    border-left: 1px solid rgba(0,0,0,0.2);
    border-right: 1px solid rgba(255,255,255,0.15);
}
.xp-taskbar-window-btn {
    font-family: system-ui, Tahoma, sans-serif;
    font-size: 11px; color: #fff;
    display: flex; align-items: center; gap: 4px;
    padding: 3px 12px; height: 26px;
    border-radius: 2px; cursor: default;
    background: rgba(0,0,0,0.15);
    border: 1px solid rgba(255,255,255,0.15);
    min-width: 140px;
    text-shadow: 0 1px 1px rgba(0,0,0,0.4);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
}
.xp-taskbar-window-active {
    background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.25);
    box-shadow: inset 0 0 4px rgba(255,255,255,0.1);
}

.xp-tray {
    display: flex; align-items: center; gap: 6px;
    background: linear-gradient(180deg, #0f8bef 0%, #0670d4 50%, #0050b0 100%);
    border-left: 2px solid rgba(0,0,0,0.2);
    padding: 0 10px; height: 100%; margin-left: 4px;
}
.xp-tray-text { font-size: 10px; color: rgba(255,255,255,0.8); }
.xp-tray-divider {
    width: 1px; height: 18px;
    border-left: 1px solid rgba(0,0,0,0.2);
    border-right: 1px solid rgba(255,255,255,0.1);
}
.xp-tray-clock {
    font-family: system-ui, Tahoma, sans-serif;
    font-size: 11px; color: #fff; white-space: nowrap;
}

/* ── Coin Flip Window ── */
.xp-coinflip-window {
    z-index: 15;
    width: 240px !important;
}
.xp-coin-wrap {
    width: 80px; height: 80px;
    border: 2px outset #d4d0c8; background: #c0c0c0;
    box-shadow: 1px 1px 0 rgba(0,0,0,0.3);
    overflow: hidden; position: relative;
    transition: transform 0.1s linear;
}
.xp-coin-img {
    width: 6px; height: 6px; object-fit: contain;
    image-rendering: pixelated;
    transform: scale(14);
    transform-origin: top left;
    position: absolute; top: 0; left: 0;
    filter: contrast(1.15) saturate(0.85);
}

/* ── Scrollbar (XP style) ── */
.xp-window-body-scroll::-webkit-scrollbar { width: 17px; }
.xp-window-body-scroll::-webkit-scrollbar-track { background: #ece9d8; border-left: 1px solid #c0c0c0; }
.xp-window-body-scroll::-webkit-scrollbar-thumb {
    background: linear-gradient(90deg, #ece9d8 0%, #d6d0c4 40%, #c0bab0 100%);
    border: 1px solid #808080; border-radius: 0;
}
.xp-window-body-scroll::-webkit-scrollbar-thumb:hover { background: #d0ccc0; }
.xp-window-body-scroll::-webkit-scrollbar-button { background: #ece9d8; border: 1px solid #808080; height: 17px; }

/* ── Mobile adjustments ── */
@media (max-width: 768px) {
    .xp-window-draggable {
        position: relative !important;
        left: auto !important; top: auto !important;
        width: 100% !important; height: auto !important;
        margin: 8px 0;
        border-radius: 0;
    }
    .xp-window-body-scroll { max-height: none; }
    .xp-resize-handle { display: none; }
    .xp-dino-window { margin-top: 72px !important; }
    .xp-coinflip-window { width: 100% !important; }
    .xp-desktop-icons { display: none; }
    .xp-taskbar-window-btn { min-width: auto; }
    .xp-tray-text { display: none; }
    .xp-start-menu { width: 200px; }
}
`

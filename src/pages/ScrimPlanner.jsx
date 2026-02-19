import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { scrimService, godService, coinflipService, leagueService } from '../services/database'
import { usePassion } from '../context/PassionContext'
import PageTitle from '../components/PageTitle'
import Navbar from '../components/layout/Navbar'
import TeamLogo from '../components/TeamLogo'
import passionCoin from '../assets/passion/passion.png'
import passionTails from '../assets/passion/passiontails.png'
import xpBg from '../assets/xp-bg.jpg'
import shortcutOverlay from '../assets/shortcut.PNG'
import zeusImg from '../assets/zeus.png'
import minionImg from '../assets/minion.png'
import { RANK_LABELS, getDivisionImage } from '../utils/divisionImages'
import {
    Swords, Clock, Shield, MessageSquare, Search,
    Plus, X, Check, Send, Users,
    Calendar, Filter, Target, ChevronLeft, ChevronRight, AlertTriangle,
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
function DraggableXpWindow({ title, icon, children, defaultX, defaultY, className = '', zIndex = 10, onFocus, resizable = true, onClose }) {
    const [pos, setPos] = useState({ x: defaultX ?? 0, y: defaultY ?? 0 })
    const [size, setSize] = useState({ w: 0, h: 0 }) // 0 = use CSS default
    const [closed, setClosed] = useState(false)
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
                    <span className="xp-title-btn xp-tbtn-x" onClick={handleClose}>&times;</span>
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

function DesktopIconGrid({ gods, topPlayers }) {
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
// SMITE Runner Game — Zeus vs Minions
// ═══════════════════════════════════════════════════
function XpDinoGame() {
    const canvasRef = useRef(null)
    const rafRef = useRef(null)
    const stateRef = useRef({
        player: { x: 60, y: 0, vy: 0, w: 40, h: 55 },
        obstacles: [],
        clouds: [],
        columns: [],
        score: 0, speed: 3.5,
        gameOver: false, started: false,
        frame: 0, nextObstacle: 80, ground: 0,
    })
    // Jump state tracked via refs so the game loop always sees the latest values
    const keyDownRef = useRef(false)   // is space/click currently held?
    const jumpActiveRef = useRef(false) // are we in the "boost" window of a jump?
    const boostFramesRef = useRef(0)

    const W = 900, H = 150, GROUND = H - 22
    const GRAVITY = 0.55
    const INITIAL_VY = -5        // small kick on press
    const BOOST_FORCE = -0.65    // extra upward force per frame while held
    const MAX_BOOST_FRAMES = 14  // frames you can hold for extra height (~230ms at 60fps)

    // Preload images
    const zeusImgRef = useRef(null)
    const minionImgRef = useRef(null)
    useEffect(() => {
        const z = new Image(); z.src = zeusImg; zeusImgRef.current = z
        const m = new Image(); m.src = minionImg; minionImgRef.current = m
    }, [])

    const reset = useCallback(() => {
        const s = stateRef.current
        s.player = { x: 60, y: 0, vy: 0, w: 40, h: 55 }
        s.obstacles = []
        s.clouds = Array.from({ length: 6 }, (_, i) => ({ x: 80 + i * 160, y: 12 + Math.random() * 30 }))
        s.columns = [{ x: W * 0.55 }, { x: W * 1.2 }]
        s.score = 0; s.speed = 3.5
        s.gameOver = false; s.started = true
        s.frame = 0; s.nextObstacle = 80; s.ground = 0
        keyDownRef.current = false
        jumpActiveRef.current = false
        boostFramesRef.current = 0
    }, [])

    // --- Input handlers ---
    // Space DOWN: if on ground, start jump. Set keyDown flag.
    const onPress = useCallback(() => {
        const s = stateRef.current
        if (s.gameOver) { reset(); return }
        if (!s.started) { reset(); return }
        keyDownRef.current = true
        // Only initiate jump if on the ground
        if (s.player.y === 0) {
            s.player.vy = INITIAL_VY
            jumpActiveRef.current = true
            boostFramesRef.current = 0
        }
    }, [reset])

    // Space UP: stop boosting immediately — this is what makes short hops short
    const onRelease = useCallback(() => {
        keyDownRef.current = false
        jumpActiveRef.current = false
    }, [])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        ctx.imageSmoothingEnabled = false // pixelated sprites
        const s0 = stateRef.current
        s0.clouds = Array.from({ length: 6 }, (_, i) => ({ x: 80 + i * 160, y: 12 + Math.random() * 30 }))
        s0.columns = [{ x: W * 0.55 }, { x: W * 1.2 }]

        // Background Greek column
        const drawColumn = (c) => {
            ctx.fillStyle = 'rgba(180,170,150,0.2)'
            ctx.fillRect(c.x, GROUND - 65, 10, 65)
            ctx.fillRect(c.x - 3, GROUND - 69, 16, 5)
            ctx.fillRect(c.x - 2, GROUND - 72, 14, 4)
            ctx.fillRect(c.x - 3, GROUND - 2, 16, 3)
        }

        const loop = () => {
            const s = stateRef.current
            ctx.clearRect(0, 0, W, H)

            // Light sky (Mount Olympus)
            const sky = ctx.createLinearGradient(0, 0, 0, GROUND)
            sky.addColorStop(0, '#88b8e8')
            sky.addColorStop(0.4, '#a8d0f0')
            sky.addColorStop(1, '#d8e8f4')
            ctx.fillStyle = sky
            ctx.fillRect(0, 0, W, GROUND)

            // Clouds
            ctx.fillStyle = 'rgba(255,255,255,0.6)'
            s.clouds.forEach(c => {
                ctx.fillRect(c.x, c.y, 45, 6)
                ctx.fillRect(c.x + 8, c.y - 4, 28, 5)
                ctx.fillRect(c.x + 4, c.y + 5, 35, 4)
            })

            // Background columns
            s.columns.forEach(drawColumn)

            // Ground (marble path)
            ctx.fillStyle = '#d8d0c0'
            ctx.fillRect(0, GROUND, W, H - GROUND)
            ctx.fillStyle = '#c0b8a8'
            ctx.fillRect(0, GROUND, W, 2)
            ctx.fillStyle = '#c8c0b0'
            for (let i = 0; i < W; i += 24) {
                if ((i + Math.floor(s.ground)) % 48 < 24) ctx.fillRect(i, GROUND + 6, 20, 2)
            }

            if (!s.started) {
                // Draw Zeus idle
                if (zeusImgRef.current?.complete) {
                    ctx.drawImage(zeusImgRef.current, s.player.x, GROUND - s.player.h, s.player.w, s.player.h)
                }
                ctx.fillStyle = '#2050a0'
                ctx.font = '14px "Pixelify Sans", monospace'
                ctx.textAlign = 'center'
                ctx.fillText('CLICK OR PRESS SPACE TO START', W / 2, GROUND - 65)
                ctx.font = '11px "Pixelify Sans", monospace'
                ctx.fillStyle = '#5070a0'
                ctx.fillText('Tap = short hop  |  Hold = long leap', W / 2, GROUND - 48)
                rafRef.current = requestAnimationFrame(loop)
                return
            }

            if (!s.gameOver) {
                s.frame++

                // ── Jump physics (Mario-style variable height) ──
                // While space is held AND we're in the boost window, add upward force
                if (jumpActiveRef.current && keyDownRef.current && boostFramesRef.current < MAX_BOOST_FRAMES) {
                    s.player.vy += BOOST_FORCE
                    boostFramesRef.current++
                }
                // If key released mid-jump, stop boosting (jumpActiveRef already false from onRelease)

                s.player.vy += GRAVITY
                s.player.y = Math.max(0, s.player.y - s.player.vy)

                // Landed
                if (s.player.y === 0 && s.player.vy > 0) {
                    s.player.vy = 0
                    jumpActiveRef.current = false
                    boostFramesRef.current = 0
                }

                s.ground = (s.ground + s.speed) % W
                s.clouds.forEach(c => { c.x -= s.speed * 0.15; if (c.x < -60) c.x = W + Math.random() * 120 })
                s.columns.forEach(c => { c.x -= s.speed * 0.1; if (c.x < -20) c.x = W + 200 + Math.random() * 400 })

                // Spawn minions (varying sizes)
                s.nextObstacle--
                if (s.nextObstacle <= 0) {
                    const r = Math.random()
                    const mw = 28 + Math.random() * 8  // minion width
                    if (r < 0.5) {
                        s.obstacles.push({ x: W + 10, h: 28 + Math.random() * 8, w: mw })  // short
                    } else if (r < 0.85) {
                        s.obstacles.push({ x: W + 10, h: 38 + Math.random() * 8, w: mw })  // medium
                    } else {
                        s.obstacles.push({ x: W + 10, h: 48 + Math.random() * 8, w: mw })  // tall
                    }
                    s.nextObstacle = 45 + Math.random() * 65
                }
                s.obstacles.forEach(o => { o.x -= s.speed })
                s.obstacles = s.obstacles.filter(o => o.x > -40)

                // Collision
                const pBox = { x: s.player.x + 8, w: s.player.w - 16, y: s.player.y, h: s.player.h - 5 }
                for (const o of s.obstacles) {
                    if (pBox.x + pBox.w > o.x + 4 && pBox.x < o.x + o.w - 4 && pBox.y < o.h) s.gameOver = true
                }
                s.score = Math.floor(s.frame / 5)
                s.speed = 3.5 + s.score * 0.004
            }

            // Draw minions
            if (minionImgRef.current?.complete) {
                s.obstacles.forEach(o => {
                    ctx.drawImage(minionImgRef.current, o.x, GROUND - o.h, o.w, o.h)
                })
            }

            // Draw Zeus
            if (zeusImgRef.current?.complete) {
                const p = s.player
                ctx.drawImage(zeusImgRef.current, p.x, GROUND - p.h - p.y, p.w, p.h)
            }

            // HUD
            ctx.fillStyle = '#2050a0'
            ctx.font = '12px "Pixelify Sans", monospace'
            ctx.textAlign = 'right'
            ctx.fillText('GOLD ' + String(s.score).padStart(5, '0'), W - 12, 18)

            ctx.textAlign = 'left'
            ctx.fillStyle = '#7090b0'
            ctx.font = '9px "Pixelify Sans", monospace'
            ctx.fillText('TAP=HOP  HOLD=LEAP', 8, 14)

            if (s.gameOver) {
                ctx.fillStyle = 'rgba(255,255,255,0.75)'
                ctx.fillRect(0, 0, W, H)
                ctx.fillStyle = '#c03030'
                ctx.font = '16px "Pixelify Sans", monospace'
                ctx.textAlign = 'center'
                ctx.fillText('Y O U   H A V E   B E E N   S L A I N', W / 2, GROUND - 55)
                ctx.fillStyle = '#2050a0'
                ctx.font = '11px "Pixelify Sans", monospace'
                ctx.fillText('Gold: ' + s.score + '  —  Click to Respawn', W / 2, GROUND - 35)
            }

            rafRef.current = requestAnimationFrame(loop)
        }
        loop()

        // Keyboard: track keydown AND keyup, prevent repeat events
        const onKeyDown = (e) => {
            if (e.repeat) return // ignore key repeat — only first press matters
            if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); onPress() }
        }
        const onKeyUp = (e) => {
            if (e.code === 'Space' || e.code === 'ArrowUp') onRelease()
        }
        window.addEventListener('keydown', onKeyDown)
        window.addEventListener('keyup', onKeyUp)
        return () => {
            window.removeEventListener('keydown', onKeyDown)
            window.removeEventListener('keyup', onKeyUp)
            if (rafRef.current) cancelAnimationFrame(rafRef.current)
        }
    }, [onPress, onRelease])

    return (
        <div style={{ background: '#c0c0c0', padding: 3 }}>
            <canvas ref={canvasRef} width={W} height={H}
                onPointerDown={onPress} onPointerUp={onRelease}
                style={{ display: 'block', width: '100%', height: 'auto', imageRendering: 'auto', cursor: 'pointer', border: '2px inset #d4d0c8', touchAction: 'none' }}
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

        // Fire API call and start 2s spin in parallel
        const apiPromise = coinflipService.flip().catch(err => { console.error('Flip failed:', err); return null })
        const timerPromise = new Promise(resolve => setTimeout(resolve, 2000))

        // Animate spinning for full 2 seconds
        const spinStart = performance.now()
        const spin = (now) => {
            const elapsed = now - spinStart
            // Speed up then slow down: fast in middle, decelerate near end
            const t = Math.min(elapsed / 2000, 1)
            const speed = t < 0.7 ? 20 : 20 * (1 - (t - 0.7) / 0.3) + 4
            setFlipAngle(prev => prev + speed)
            if (elapsed < 2000) flipRef.current = requestAnimationFrame(spin)
        }
        flipRef.current = requestAnimationFrame(spin)

        // Wait for both API and timer
        const [data] = await Promise.all([apiPromise, timerPromise])
        if (flipRef.current) cancelAnimationFrame(flipRef.current)

        if (data) {
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
        } else {
            setFlipAngle(0)
        }
        setFlipping(false)
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
                                <tr key={entry.userId || i} style={{ borderBottom: '1px solid #e8e8e8' }}>
                                    <td className="xp-text" style={{ padding: '2px 6px', fontSize: 10 }}>{entry.position || i + 1}</td>
                                    <td className="xp-text" style={{ padding: '2px 6px', fontSize: 10 }}>{entry.playerName || entry.discordUsername || '???'}</td>
                                    <td className="xp-text" style={{ padding: '2px 6px', textAlign: 'right', fontSize: 10, fontWeight: 700, color: '#0058e6' }}>{entry.bestStreak}</td>
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
    const [topPlayers, setTopPlayers] = useState({})

    const [openScrims, setOpenScrims] = useState([])
    const [leagueFilter, setLeagueFilter] = useState('')
    const [tierFilter, setTierFilter] = useState('')

    const [myScrims, setMyScrims] = useState([])
    const [captainTeams, setCaptainTeams] = useState([])
    const [incomingScrims, setIncomingScrims] = useState([])

    const [allTeams, setAllTeams] = useState([])
    const [showPostWindow, setShowPostWindow] = useState(false)

    const [actionLoading, setActionLoading] = useState(null)

    const isCaptain = captainTeams.length > 0

    const TABS = [
        { key: 'open', label: 'Open Scrims' },
        ...(user ? [{ key: 'my', label: 'My Scrims' }] : []),
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
        if (showPostWindow && allTeams.length === 0) {
            scrimService.getAllActiveTeams().then(data => setAllTeams(data.teams || [])).catch(() => {})
        }
    }, [showPostWindow]) // eslint-disable-line react-hooks/exhaustive-deps

    // Close start menu on click outside
    useEffect(() => {
        if (!startMenuOpen) return
        const handle = (e) => {
            if (startRef.current && !startRef.current.contains(e.target)) setStartMenuOpen(false)
        }
        document.addEventListener('mousedown', handle)
        return () => document.removeEventListener('mousedown', handle)
    }, [startMenuOpen])

    // Load random gods for desktop icons + top players per god
    useEffect(() => {
        godService.getAll().then(data => {
            const gods = data.gods || data || []
            if (gods.length === 0) return
            const shuffled = [...gods].sort(() => Math.random() - 0.5)
            setDesktopGods(shuffled.slice(0, 24))
        }).catch(() => {})
        godService.getTopPlayers().then(data => {
            setTopPlayers(data.topPlayers || {})
        }).catch(() => {})
    }, [])

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
                {desktopGods.length > 0 && <DesktopIconGrid gods={desktopGods} topPlayers={topPlayers} />}

                {/* ═══ DINO BANNER (draggable window) ═══ */}
                <DraggableXpWindow
                    title="SmiteRunner.exe"
                    icon="&#9876;"
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

                {/* ═══ SCRIM CALENDAR WINDOW ═══ */}
                {user && captainTeams.length > 0 && (
                    <DraggableXpWindow
                        title="Scrim Calendar"
                        icon="&#128197;"
                        defaultX={typeof window !== 'undefined' ? Math.max(20, window.innerWidth - 360) : 400}
                        defaultY={80}
                        className="xp-scrim-cal-window"
                        resizable={true}
                    >
                        <XpScrimCalendarWindow myScrims={myScrims} captainTeams={captainTeams} />
                    </DraggableXpWindow>
                )}

                {/* ═══ DRAGGABLE SCRIM PLANNER WINDOW ═══ */}
                <DraggableXpWindow
                    title="Scrim Planner"
                    icon="&#9876;"
                    defaultX={defaultWinX}
                    defaultY={defaultWinY}
                    className="xp-main-window"
                >
                    {/* Tabs + Post button */}
                    <div className="xp-tab-bar" style={{ justifyContent: 'space-between' }}>
                        <div className="flex">
                            {TABS.map(tab => (
                                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                                    className={`xp-tab ${activeTab === tab.key ? 'xp-tab-active' : ''}`}>
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                        {isCaptain && (
                            <button onClick={() => setShowPostWindow(true)}
                                className="xp-btn xp-btn-primary xp-post-scrim-btn" style={{ fontSize: 10, padding: '2px 10px', marginRight: 4, alignSelf: 'center' }}>
                                <Plus size={11} /> Post Scrim
                            </button>
                        )}
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
                            </>
                        )}
                    </div>
                </DraggableXpWindow>

                {/* ═══ POST SCRIM WIZARD WINDOW ═══ */}
                {showPostWindow && isCaptain && (
                    <DraggableXpWindow
                        title="Post Scrim Wizard"
                        icon="&#128228;"
                        defaultX={typeof window !== 'undefined' ? Math.max(40, (window.innerWidth - 520) / 2) : 100}
                        defaultY={typeof window !== 'undefined' ? Math.min(120, window.innerHeight * 0.15) : 120}
                        className="xp-post-window"
                        resizable={false}
                        onClose={() => setShowPostWindow(false)}
                        zIndex={30}
                    >
                        <PostScrimWizard captainTeams={captainTeams} allTeams={allTeams}
                            myScrims={myScrims}
                            onSuccess={() => { loadOpenScrims(); loadMyScrims(); setShowPostWindow(false) }} />
                    </DraggableXpWindow>
                )}

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
                    {user && captainTeams.length > 0 && (
                        <button className="xp-taskbar-window-btn xp-taskbar-window-active">
                            <span style={{ fontSize: 12 }}>&#128197;</span>
                            <span>Calendar</span>
                        </button>
                    )}
                    {showPostWindow && (
                        <button className="xp-taskbar-window-btn xp-taskbar-window-active">
                            <span style={{ fontSize: 12 }}>&#128228;</span>
                            <span>Post Scrim</span>
                        </button>
                    )}

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
                    {scrim.acceptableTiers && scrim.acceptableTiers.length < 5 && (
                        <div className="flex items-center gap-1 flex-wrap mb-1">
                            <span className="xp-text" style={{ fontSize: 10, color: '#666' }}>Accepts:</span>
                            {scrim.acceptableTiers.sort((a, b) => a - b).map(tier => (
                                <span key={tier} className="xp-badge xp-badge-amber" style={{ fontSize: 9 }}>
                                    {RANK_LABELS[tier]}
                                </span>
                            ))}
                        </div>
                    )}
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
// XP Calendar Component
// ═══════════════════════════════════════════════════
function XpCalendar({ selectedDate, onSelectDate, scrimDates }) {
    const [viewMonth, setViewMonth] = useState(() => new Date())

    const year = viewMonth.getFullYear()
    const month = viewMonth.getMonth()
    const monthName = viewMonth.toLocaleString('en-US', { month: 'long' })

    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    const cells = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)

    const dayHeaders = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

    return (
        <div className="xp-calendar" style={{ maxWidth: 280, margin: '0 auto' }}>
            <div className="xp-calendar-header">
                <button type="button" onClick={() => setViewMonth(new Date(year, month - 1, 1))} className="xp-title-btn xp-tbtn-min" style={{ width: 18, height: 18, fontSize: 11 }}>
                    <ChevronLeft size={12} />
                </button>
                <span style={{ fontFamily: '"Pixelify Sans", system-ui', fontSize: 13 }}>{monthName} {year}</span>
                <button type="button" onClick={() => setViewMonth(new Date(year, month + 1, 1))} className="xp-title-btn xp-tbtn-min" style={{ width: 18, height: 18, fontSize: 11 }}>
                    <ChevronRight size={12} />
                </button>
            </div>
            <div className="xp-calendar-grid">
                {dayHeaders.map(d => <div key={d} className="xp-calendar-day-header">{d}</div>)}
                {cells.map((day, i) => {
                    if (!day) return <div key={`e${i}`} className="xp-calendar-day" />
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                    const isPast = new Date(year, month, day) < today
                    const isToday = dateStr === todayStr
                    const isSelected = dateStr === selectedDate
                    const hasScrim = scrimDates.has(dateStr)
                    const cls = [
                        'xp-calendar-day',
                        isPast && 'xp-calendar-day-past',
                        isToday && 'xp-calendar-day-today',
                        isSelected && 'xp-calendar-day-selected',
                        hasScrim && 'xp-calendar-day-scrim',
                    ].filter(Boolean).join(' ')
                    return (
                        <div key={dateStr} className={cls}
                            onClick={() => !isPast && onSelectDate(dateStr, hasScrim)}>
                            {day}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}


// ═══════════════════════════════════════════════════
// Scrim Calendar Window (standalone, resizable)
// ═══════════════════════════════════════════════════
function toESTDateStr(isoStr) {
    const d = new Date(isoStr)
    const est = new Date(d.toLocaleString('en-US', { timeZone: 'America/New_York' }))
    return `${est.getFullYear()}-${String(est.getMonth() + 1).padStart(2, '0')}-${String(est.getDate()).padStart(2, '0')}`
}

function XpScrimCalendarWindow({ myScrims, captainTeams }) {
    const [viewMonth, setViewMonth] = useState(() => new Date())
    const [selectedDay, setSelectedDay] = useState(null)

    const year = viewMonth.getFullYear()
    const month = viewMonth.getMonth()
    const monthName = viewMonth.toLocaleString('en-US', { month: 'long' })

    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    // Build map: dateStr → array of scrims
    const scrimsByDate = useMemo(() => {
        const map = {}
        const teamIds = new Set(captainTeams.map(t => t.teamId))
        for (const s of (myScrims || [])) {
            if (s.status === 'cancelled' || s.status === 'expired') continue
            if (!teamIds.has(s.teamId) && !teamIds.has(s.acceptedTeamId)) continue
            const dateStr = toESTDateStr(s.scheduledDate)
            if (!map[dateStr]) map[dateStr] = []
            map[dateStr].push(s)
        }
        return map
    }, [myScrims, captainTeams])

    const cells = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)

    const dayHeaders = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
    const selectedScrims = selectedDay ? (scrimsByDate[selectedDay] || []) : []

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Calendar grid */}
            <div className="xp-calendar" style={{ maxWidth: 'none', border: 'none', borderBottom: '2px groove #d4d0c8' }}>
                <div className="xp-calendar-header">
                    <button type="button" onClick={() => { setViewMonth(new Date(year, month - 1, 1)); setSelectedDay(null) }} className="xp-title-btn xp-tbtn-min" style={{ width: 18, height: 18, fontSize: 11 }}>
                        <ChevronLeft size={12} />
                    </button>
                    <span style={{ fontFamily: '"Pixelify Sans", system-ui', fontSize: 14 }}>{monthName} {year}</span>
                    <button type="button" onClick={() => { setViewMonth(new Date(year, month + 1, 1)); setSelectedDay(null) }} className="xp-title-btn xp-tbtn-min" style={{ width: 18, height: 18, fontSize: 11 }}>
                        <ChevronRight size={12} />
                    </button>
                </div>
                <div className="xp-calendar-grid">
                    {dayHeaders.map(d => <div key={d} className="xp-calendar-day-header">{d}</div>)}
                    {cells.map((day, i) => {
                        if (!day) return <div key={`e${i}`} className="xp-calendar-day xp-cal-big-day" />
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                        const scrims = scrimsByDate[dateStr] || []
                        const hasConfirmed = scrims.some(s => s.status === 'accepted')
                        const hasPending = scrims.some(s => s.status === 'open')
                        const isToday = dateStr === todayStr
                        const isSelected = dateStr === selectedDay
                        const cls = [
                            'xp-calendar-day xp-cal-big-day',
                            isToday && 'xp-calendar-day-today',
                            isSelected && 'xp-calendar-day-selected',
                        ].filter(Boolean).join(' ')
                        return (
                            <div key={dateStr} className={cls} onClick={() => setSelectedDay(dateStr)}>
                                <span>{day}</span>
                                {(hasConfirmed || hasPending) && (
                                    <div className="xp-cal-dots">
                                        {hasConfirmed && <span className="xp-cal-dot xp-cal-dot-confirmed" />}
                                        {hasPending && <span className="xp-cal-dot xp-cal-dot-pending" />}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
                {/* Legend */}
                <div className="flex items-center gap-4 px-2 py-1.5" style={{ background: '#ece9d8', borderTop: '1px solid #c0c0c0' }}>
                    <div className="flex items-center gap-1">
                        <span className="xp-cal-dot xp-cal-dot-confirmed" style={{ position: 'static' }} />
                        <span className="xp-text" style={{ fontSize: 10 }}>Confirmed</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="xp-cal-dot xp-cal-dot-pending" style={{ position: 'static' }} />
                        <span className="xp-text" style={{ fontSize: 10 }}>Pending</span>
                    </div>
                </div>
            </div>

            {/* Day detail panel */}
            <div className="xp-cal-detail" style={{ flex: 1, overflowY: 'auto', padding: 6, minHeight: 60 }}>
                {!selectedDay && (
                    <div className="xp-text" style={{ color: '#888', textAlign: 'center', paddingTop: 12 }}>
                        Click a day to see scrim details.
                    </div>
                )}
                {selectedDay && selectedScrims.length === 0 && (
                    <div className="xp-text" style={{ color: '#888', textAlign: 'center', paddingTop: 12 }}>
                        No scrims on {new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}.
                    </div>
                )}
                {selectedDay && selectedScrims.length > 0 && (
                    <div>
                        <div className="xp-text" style={{ fontWeight: 700, marginBottom: 4 }}>
                            {new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        </div>
                        <div className="flex flex-col gap-1">
                            {selectedScrims.map(s => (
                                <div key={s.id} className="xp-cal-scrim-item">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <TeamLogo slug={s.teamSlug} name={s.teamName} size={18} />
                                        <span className="xp-text" style={{ fontWeight: 700 }}>{s.teamName}</span>
                                        {s.status === 'accepted' ? (
                                            <span className="xp-badge xp-badge-green" style={{ fontSize: 9 }}>Confirmed</span>
                                        ) : (
                                            <span className="xp-badge xp-badge-amber" style={{ fontSize: 9 }}>Pending</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <Clock size={10} style={{ color: '#555' }} />
                                        <span className="xp-text" style={{ fontSize: 11 }}>{formatDateEST(s.scheduledDate)}</span>
                                        <span className={`xp-badge ${XP_PICK_BADGE[s.pickMode] || 'xp-badge-blue'}`} style={{ fontSize: 9 }}>{formatPickMode(s.pickMode)}</span>
                                    </div>
                                    {s.status === 'accepted' && s.acceptedTeamName && (
                                        <div className="flex items-center gap-1 mt-0.5">
                                            <span className="xp-text" style={{ fontSize: 10, color: '#2d8212' }}>vs</span>
                                            <TeamLogo slug={s.acceptedTeamSlug} name={s.acceptedTeamName} size={14} />
                                            <span className="xp-text" style={{ fontSize: 11, fontWeight: 600, color: '#2d8212' }}>{s.acceptedTeamName}</span>
                                        </div>
                                    )}
                                    {s.challengedTeamName && s.status === 'open' && (
                                        <div className="flex items-center gap-1 mt-0.5">
                                            <Target size={10} style={{ color: '#6a3ea1' }} />
                                            <span className="xp-text" style={{ fontSize: 10, color: '#6a3ea1' }}>Challenging {s.challengedTeamName}</span>
                                        </div>
                                    )}
                                    {s.notes && (
                                        <div className="xp-text" style={{ fontSize: 10, color: '#666', marginTop: 1 }}>
                                            <MessageSquare size={9} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />
                                            {s.notes}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}


// ═══════════════════════════════════════════════════
// XP Dialog (modal popup)
// ═══════════════════════════════════════════════════
function XpDialog({ title, icon, children, onClose }) {
    return (
        <div className="xp-dialog-overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
            <div className="xp-window xp-dialog">
                <div className="xp-title-bar">
                    <div className="flex items-center gap-1.5">
                        {icon && <span style={{ fontSize: 13 }}>{icon}</span>}
                        <span className="xp-title-text" style={{ fontSize: 11 }}>{title}</span>
                    </div>
                    <button type="button" className="xp-title-btn xp-tbtn-x" onClick={onClose}>&times;</button>
                </div>
                <div className="xp-window-body" style={{ padding: 12 }}>
                    {children}
                </div>
            </div>
        </div>
    )
}


// ═══════════════════════════════════════════════════
// Post Scrim Wizard (XP Installer style)
// ═══════════════════════════════════════════════════
function PostScrimWizard({ captainTeams, allTeams, myScrims, onSuccess }) {
    const [step, setStep] = useState(0)

    // Form state
    const [teamId, setTeamId] = useState(() => captainTeams[0]?.teamId || '')
    const [selectedDate, setSelectedDate] = useState(null)
    const [timeHour, setTimeHour] = useState('7')
    const [timeMinute, setTimeMinute] = useState('00')
    const [timeAmPm, setTimeAmPm] = useState('PM')
    const [pickMode, setPickMode] = useState('regular')
    const [bannedContentLeague, setBannedContentLeague] = useState('')
    const [challengedTeamId, setChallengedTeamId] = useState('')
    const [notes, setNotes] = useState('')
    const [acceptableTiers, setAcceptableTiers] = useState([1, 2, 3, 4, 5])

    // UI state
    const [teamSearch, setTeamSearch] = useState('')
    const [showTeamPicker, setShowTeamPicker] = useState(false)
    const [showConflictDialog, setShowConflictDialog] = useState(null)
    const [showCancelDialog, setShowCancelDialog] = useState(false)
    const [posting, setPosting] = useState(false)
    const [postError, setPostError] = useState(null)
    const [postSuccess, setPostSuccess] = useState(false)
    const [leagues, setLeagues] = useState([])

    // Fetch leagues for banned content dropdown
    useEffect(() => {
        leagueService.getAll().then(data => setLeagues(data || [])).catch(() => {})
    }, [])

    const selectedTeam = captainTeams.find(t => t.teamId === Number(teamId))
    const tierImg = selectedTeam ? getDivisionImage(selectedTeam.leagueSlug, selectedTeam.divisionSlug, selectedTeam.divisionTier) : null

    // Get scrim dates for the selected team (for calendar)
    const scrimDates = useMemo(() => {
        const dates = new Set()
        if (!selectedTeam) return dates
        const tid = selectedTeam.teamId
        for (const s of (myScrims || [])) {
            if ((s.teamId === tid || s.acceptedTeamId === tid) && (s.status === 'open' || s.status === 'accepted')) {
                // Convert to EST date string
                const d = new Date(s.scheduledDate)
                const est = new Date(d.toLocaleString('en-US', { timeZone: 'America/New_York' }))
                const dateStr = `${est.getFullYear()}-${String(est.getMonth() + 1).padStart(2, '0')}-${String(est.getDate()).padStart(2, '0')}`
                dates.add(dateStr)
            }
        }
        return dates
    }, [myScrims, selectedTeam])

    // Filter challenge teams — only exclude the selected posting team
    const filteredChallengeTeams = useMemo(() => {
        const selectedId = Number(teamId)
        return allTeams.filter(t =>
            t.id !== selectedId && (teamSearch === '' ||
                t.name.toLowerCase().includes(teamSearch.toLowerCase()) ||
                t.leagueName.toLowerCase().includes(teamSearch.toLowerCase()) ||
                t.divisionName.toLowerCase().includes(teamSearch.toLowerCase()))
        )
    }, [allTeams, teamId, teamSearch])

    const challengedTeam = allTeams.find(t => t.id === Number(challengedTeamId))

    // Map tier → unique division names for display
    const tierDivisions = useMemo(() => {
        const map = {}
        for (const t of allTeams) {
            if (t.divisionTier) {
                if (!map[t.divisionTier]) map[t.divisionTier] = new Set()
                map[t.divisionTier].add(t.divisionName)
            }
        }
        const result = {}
        for (const [tier, names] of Object.entries(map)) {
            result[tier] = [...names].sort()
        }
        return result
    }, [allTeams])

    const STEPS = [
        { title: 'Team', subtitle: 'Select Your Team' },
        { title: 'Date', subtitle: 'Choose a Date' },
        { title: 'Time', subtitle: 'Set Time (EST)' },
        { title: 'Settings', subtitle: 'Pick Mode & Bans' },
        { title: 'Opponent', subtitle: 'Challenge & Tiers' },
        { title: 'Review', subtitle: 'Notes & Confirm' },
    ]

    const canAdvance = () => {
        if (step === 0) return !!teamId
        if (step === 1) return !!selectedDate
        if (step === 4) return acceptableTiers.length > 0
        return true
    }

    const handleDateSelect = (dateStr, hasScrim) => {
        if (hasScrim) {
            setShowConflictDialog(dateStr)
        } else {
            setSelectedDate(dateStr)
        }
    }

    const confirmConflictDate = () => {
        setSelectedDate(showConflictDialog)
        setShowConflictDialog(null)
    }

    const toggleTier = (tier) => {
        setAcceptableTiers(prev =>
            prev.includes(tier) ? prev.filter(t => t !== tier) : [...prev, tier].sort((a, b) => a - b)
        )
    }

    const assembleScheduledDate = () => {
        const h = Number(timeHour)
        const hour24 = timeAmPm === 'AM' ? (h === 12 ? 0 : h) : (h === 12 ? 12 : h + 12)
        return `${selectedDate}T${String(hour24).padStart(2, '0')}:${timeMinute}:00-05:00`
    }

    const handleSubmit = async () => {
        setPosting(true)
        setPostError(null)
        try {
            await scrimService.create({
                team_id: Number(teamId),
                scheduled_date: assembleScheduledDate(),
                pick_mode: pickMode,
                banned_content_league: bannedContentLeague || null,
                notes: notes || null,
                challenged_team_id: challengedTeamId ? Number(challengedTeamId) : null,
                acceptable_tiers: acceptableTiers.length < 5 ? acceptableTiers : null,
            })
            setPostSuccess(true)
        } catch (err) {
            setPostError(err.message || 'Failed to post scrim')
        } finally {
            setPosting(false)
        }
    }

    const resetWizard = () => {
        setStep(0)
        setSelectedDate(null)
        setTimeHour('7'); setTimeMinute('00'); setTimeAmPm('PM')
        setPickMode('regular'); setBannedContentLeague('')
        setChallengedTeamId(''); setNotes('')
        setAcceptableTiers([1, 2, 3, 4, 5])
        setTeamSearch(''); setShowTeamPicker(false)
        setPostError(null); setPostSuccess(false)
    }

    // Success screen
    if (postSuccess) {
        return (
            <div className="xp-wizard">
                <div className="xp-wizard-body" style={{ minHeight: 200 }}>
                    <div className="xp-wizard-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                        <div style={{ fontSize: 36 }}>&#9989;</div>
                        <div className="xp-text" style={{ fontWeight: 700, fontSize: 14 }}>Scrim Request Posted!</div>
                        <div className="xp-text" style={{ fontSize: 11, color: '#555', textAlign: 'center' }}>
                            {challengedTeamId ? 'Your challenge has been sent.' : 'Your open scrim request is now visible to all teams.'}
                        </div>
                        <div className="flex gap-2 mt-2">
                            <button type="button" onClick={() => { resetWizard() }} className="xp-btn">Post Another</button>
                            <button type="button" onClick={onSuccess} className="xp-btn xp-btn-primary">View My Scrims</button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="xp-wizard">
            <div className="xp-wizard-body">
                {/* Sidebar (hidden on mobile via CSS) */}
                <div className="xp-wizard-sidebar">
                    {STEPS.map((s, i) => (
                        <div key={i} className={`xp-wizard-step-item ${i === step ? 'xp-wizard-step-item-active' : i < step ? 'xp-wizard-step-item-done' : ''}`}>
                            <span className="xp-wizard-step-num">{i < step ? '✓' : i + 1}</span>
                            <span>{s.title}</span>
                        </div>
                    ))}
                </div>

                {/* Content */}
                <div className="xp-wizard-content">
                    {/* Mobile step indicator */}
                    <div className="xp-wizard-mobile-step">Step {step + 1} of {STEPS.length} — {STEPS[step].subtitle}</div>

                    {/* Step header */}
                    <div style={{ marginBottom: 10 }}>
                        <div className="xp-text" style={{ fontWeight: 700, fontSize: 13 }}>{STEPS[step].subtitle}</div>
                        <div style={{ height: 1, background: '#7f9db9', margin: '4px 0 8px' }} />
                    </div>

                    {/* ── Step 0: Team Selection ── */}
                    {step === 0 && (
                        <div>
                            <div className="xp-text" style={{ marginBottom: 8, color: '#555' }}>
                                Welcome to the Scrim Request Wizard. Select the team you want to post a scrim for.
                            </div>
                            {captainTeams.length === 1 ? (
                                <div className="flex items-center gap-3 p-2" style={{ background: '#fff', border: '1px solid #c0c0c0' }}>
                                    <TeamLogo slug={captainTeams[0].teamSlug} name={captainTeams[0].teamName} size={28} />
                                    <div>
                                        <div className="xp-text" style={{ fontWeight: 700, fontSize: 13 }}>{captainTeams[0].teamName}</div>
                                        <div className="xp-text" style={{ fontSize: 10, color: '#666' }}>{captainTeams[0].leagueName}</div>
                                    </div>
                                </div>
                            ) : (
                                <select value={teamId} onChange={e => setTeamId(e.target.value)} className="xp-select w-full" style={{ fontSize: 12, padding: '4px 6px' }}>
                                    {captainTeams.map(t => (
                                        <option key={t.teamId} value={t.teamId}>{t.teamName} ({t.leagueName} - {t.divisionName})</option>
                                    ))}
                                </select>
                            )}
                            {selectedTeam && (
                                <div className="flex items-center gap-3 mt-3 p-2" style={{ background: '#e8f0ff', border: '1px solid #7f9db9' }}>
                                    {tierImg && <img src={tierImg} alt="" style={{ width: 32, height: 32 }} />}
                                    <div>
                                        <div className="xp-text" style={{ fontWeight: 700, color: '#0054e3' }}>
                                            {selectedTeam.divisionName}
                                        </div>
                                        <div className="xp-text" style={{ fontSize: 10, color: '#555' }}>
                                            {selectedTeam.divisionTier ? `Tier ${selectedTeam.divisionTier} — ${RANK_LABELS[selectedTeam.divisionTier] || ''}` : 'No tier assigned'}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Step 1: Date Selection ── */}
                    {step === 1 && (
                        <div>
                            <div className="xp-text" style={{ marginBottom: 8, color: '#555' }}>
                                Choose a date for your scrim. Days with an orange dot have existing team scrims.
                            </div>
                            <XpCalendar selectedDate={selectedDate} onSelectDate={handleDateSelect} scrimDates={scrimDates} />
                            {selectedDate && (
                                <div className="xp-text" style={{ textAlign: 'center', marginTop: 6, fontWeight: 700, color: '#0054e3' }}>
                                    Selected: {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Step 2: Time Selection ── */}
                    {step === 2 && (
                        <div>
                            <div className="xp-text" style={{ marginBottom: 8, color: '#555' }}>
                                Set the start time for your scrim.
                            </div>
                            <div className="flex items-center justify-center gap-2 my-4">
                                <Clock size={20} style={{ color: '#0054e3' }} />
                                <select value={timeHour} onChange={e => setTimeHour(e.target.value)} className="xp-time-select">
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                                        <option key={h} value={String(h)}>{h}</option>
                                    ))}
                                </select>
                                <span className="xp-time-colon">:</span>
                                <select value={timeMinute} onChange={e => setTimeMinute(e.target.value)} className="xp-time-select">
                                    {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                                <select value={timeAmPm} onChange={e => setTimeAmPm(e.target.value)} className="xp-time-select" style={{ width: 56 }}>
                                    <option value="AM">AM</option>
                                    <option value="PM">PM</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2 p-2 mt-2" style={{ background: '#fffff0', border: '1px solid #c0a030' }}>
                                <AlertTriangle size={14} style={{ color: '#c08030', flexShrink: 0 }} />
                                <span className="xp-text" style={{ fontSize: 11, color: '#604000' }}>
                                    All times are in <strong>Eastern Standard Time (EST)</strong>. Enter the time as you would read a clock in EST.
                                </span>
                            </div>
                        </div>
                    )}

                    {/* ── Step 3: Game Settings ── */}
                    {step === 3 && (
                        <div>
                            <fieldset className="xp-fieldset">
                                <legend className="xp-fieldset-legend">Pick Mode</legend>
                                <div className="flex flex-col gap-1">
                                    {PICK_MODES.map(mode => (
                                        <label key={mode.value} className="xp-radio-label">
                                            <input type="radio" name="wiz_pick_mode" checked={pickMode === mode.value}
                                                onChange={() => setPickMode(mode.value)} className="xp-radio" />
                                            <span className="xp-text">{mode.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </fieldset>

                            <fieldset className="xp-fieldset">
                                <legend className="xp-fieldset-legend">Banned Content League</legend>
                                <div className="xp-text" style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>
                                    Select a league whose banned content rules apply to this scrim.
                                </div>
                                <select value={bannedContentLeague} onChange={e => setBannedContentLeague(e.target.value)} className="xp-select w-full">
                                    <option value="">None (No bans)</option>
                                    {leagues.map(l => (
                                        <option key={l.id} value={l.name}>{l.name}</option>
                                    ))}
                                </select>
                            </fieldset>
                        </div>
                    )}

                    {/* ── Step 4: Opponent & Tiers ── */}
                    {step === 4 && (
                        <div>
                            <fieldset className="xp-fieldset">
                                <legend className="xp-fieldset-legend">Challenge a Team (optional)</legend>
                                <div className="xp-text" style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>
                                    Leave empty for an open request visible to all teams.
                                </div>
                                {challengedTeam ? (
                                    <div className="flex items-center gap-2 p-1.5" style={{ background: '#e0c8ff', border: '1px solid #8055c0' }}>
                                        <TeamLogo slug={challengedTeam.slug} name={challengedTeam.name} size={20} />
                                        <div className="flex-1">
                                            <div className="xp-text" style={{ fontWeight: 700, color: '#400080' }}>{challengedTeam.name}</div>
                                            <div className="xp-text" style={{ fontSize: 10, color: '#666' }}>{challengedTeam.leagueName} &middot; {challengedTeam.divisionName}</div>
                                        </div>
                                        <button type="button" onClick={() => { setChallengedTeamId(''); setTeamSearch('') }} className="xp-btn" style={{ padding: '1px 6px', fontSize: 10 }}>X</button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <input type="text" value={teamSearch} onChange={e => { setTeamSearch(e.target.value); setShowTeamPicker(true) }}
                                            onFocus={() => setShowTeamPicker(true)} placeholder="Search for a team..." className="xp-input w-full" />
                                        {showTeamPicker && teamSearch && (
                                            <div className="xp-listbox absolute z-10 w-full" style={{ maxHeight: 160, overflowY: 'auto' }}>
                                                {filteredChallengeTeams.slice(0, 20).map(team => (
                                                    <button key={team.id} type="button" onClick={() => { setChallengedTeamId(String(team.id)); setShowTeamPicker(false); setTeamSearch('') }} className="xp-listbox-item">
                                                        <TeamLogo slug={team.slug} name={team.name} size={16} />
                                                        <div>
                                                            <div className="xp-text" style={{ fontWeight: 500 }}>{team.name}</div>
                                                            <div className="xp-text" style={{ fontSize: 10, color: '#666' }}>{team.leagueName} &middot; {team.divisionName}</div>
                                                        </div>
                                                    </button>
                                                ))}
                                                {filteredChallengeTeams.length === 0 && (
                                                    <div className="xp-text" style={{ padding: '4px 8px', fontSize: 11, color: '#666' }}>No teams found</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </fieldset>

                            <fieldset className="xp-fieldset">
                                <legend className="xp-fieldset-legend">Acceptable Tiers</legend>
                                <div className="xp-text" style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>
                                    Select which division tiers you are willing to accept scrims from.
                                </div>
                                <div className="flex flex-col gap-1">
                                    {[1, 2, 3, 4, 5].map(tier => {
                                        const img = getDivisionImage(null, null, tier)
                                        return (
                                            <label key={tier} className="xp-checkbox-label">
                                                <input type="checkbox" checked={acceptableTiers.includes(tier)}
                                                    onChange={() => toggleTier(tier)} className="xp-checkbox" />
                                                {img && <img src={img} alt="" style={{ width: 16, height: 16 }} />}
                                                <span className="xp-text">
                                                    Tier {tier} — {RANK_LABELS[tier]}
                                                    {tierDivisions[tier] && <span style={{ color: '#666' }}> ({tierDivisions[tier].join(', ')})</span>}
                                                </span>
                                            </label>
                                        )
                                    })}
                                </div>
                                {acceptableTiers.length === 0 && (
                                    <div className="xp-text" style={{ fontSize: 10, color: '#800000', marginTop: 4 }}>
                                        You must select at least one tier.
                                    </div>
                                )}
                            </fieldset>
                        </div>
                    )}

                    {/* ── Step 5: Notes & Review ── */}
                    {step === 5 && (
                        <div>
                            <fieldset className="xp-fieldset">
                                <legend className="xp-fieldset-legend">Notes (optional)</legend>
                                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                                    placeholder="Additional details..." rows={2} maxLength={500}
                                    className="xp-input w-full" style={{ resize: 'none' }} />
                            </fieldset>

                            <fieldset className="xp-fieldset">
                                <legend className="xp-fieldset-legend">Review</legend>
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-2">
                                        <span className="xp-text" style={{ fontWeight: 700, width: 70, flexShrink: 0 }}>Team:</span>
                                        {selectedTeam && <TeamLogo slug={selectedTeam.teamSlug} name={selectedTeam.teamName} size={16} />}
                                        <span className="xp-text">{selectedTeam?.teamName}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="xp-text" style={{ fontWeight: 700, width: 70, flexShrink: 0 }}>Division:</span>
                                        <span className="xp-text">{selectedTeam?.divisionName} ({RANK_LABELS[selectedTeam?.divisionTier] || 'N/A'})</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="xp-text" style={{ fontWeight: 700, width: 70, flexShrink: 0 }}>Date:</span>
                                        <span className="xp-text">
                                            {selectedDate && new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="xp-text" style={{ fontWeight: 700, width: 70, flexShrink: 0 }}>Time:</span>
                                        <span className="xp-text">{timeHour}:{timeMinute} {timeAmPm} EST</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="xp-text" style={{ fontWeight: 700, width: 70, flexShrink: 0 }}>Pick Mode:</span>
                                        <span className={`xp-badge ${XP_PICK_BADGE[pickMode] || 'xp-badge-blue'}`}>{formatPickMode(pickMode)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="xp-text" style={{ fontWeight: 700, width: 70, flexShrink: 0 }}>Bans:</span>
                                        <span className="xp-text">{bannedContentLeague || 'None'}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="xp-text" style={{ fontWeight: 700, width: 70, flexShrink: 0 }}>Opponent:</span>
                                        {challengedTeam ? (
                                            <span className="flex items-center gap-1">
                                                <TeamLogo slug={challengedTeam.slug} name={challengedTeam.name} size={14} />
                                                <span className="xp-text" style={{ color: '#400080' }}>{challengedTeam.name}</span>
                                            </span>
                                        ) : (
                                            <span className="xp-text" style={{ color: '#555' }}>Open Request</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="xp-text" style={{ fontWeight: 700, width: 70, flexShrink: 0 }}>Tiers:</span>
                                        <span className="xp-text">
                                            {acceptableTiers.length === 5 ? 'All tiers' : acceptableTiers.map(t => RANK_LABELS[t]).join(', ')}
                                        </span>
                                    </div>
                                    {notes && (
                                        <div className="flex items-start gap-2">
                                            <span className="xp-text" style={{ fontWeight: 700, width: 70, flexShrink: 0 }}>Notes:</span>
                                            <span className="xp-text" style={{ color: '#555' }}>{notes}</span>
                                        </div>
                                    )}
                                </div>
                            </fieldset>

                            {postError && (
                                <div className="flex items-center gap-2 mb-2 p-2" style={{ background: '#ffc8c8', border: '1px solid #c05555' }}>
                                    <div className="xp-error-icon" style={{ width: 16, height: 16, fontSize: 9 }}>X</div>
                                    <span className="xp-text" style={{ fontSize: 11, color: '#800000' }}>{postError}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Footer navigation */}
            <div className="xp-wizard-footer">
                <div>
                    {step > 0 && (
                        <button type="button" onClick={() => setStep(s => s - 1)} className="xp-btn">
                            &lt; Back
                        </button>
                    )}
                </div>
                <div className="flex gap-2">
                    {step < 5 ? (
                        <button type="button" onClick={() => setStep(s => s + 1)} disabled={!canAdvance()} className="xp-btn xp-btn-primary">
                            Next &gt;
                        </button>
                    ) : (
                        <button type="button" onClick={handleSubmit} disabled={posting || !canAdvance()} className="xp-btn xp-btn-primary">
                            {posting ? 'Posting...' : 'Finish'}
                        </button>
                    )}
                    <button type="button" onClick={() => setShowCancelDialog(true)} className="xp-btn">Cancel</button>
                </div>
            </div>

            {/* Conflict warning dialog */}
            {showConflictDialog && (
                <XpDialog title="Schedule Conflict" icon="⚠️" onClose={() => setShowConflictDialog(null)}>
                    <div className="flex items-start gap-3">
                        <AlertTriangle size={28} style={{ color: '#c08030', flexShrink: 0 }} />
                        <div>
                            <div className="xp-text" style={{ fontWeight: 700, marginBottom: 4 }}>Your team already has a scrim on this date.</div>
                            <div className="xp-text" style={{ fontSize: 11, color: '#555' }}>
                                Are you sure you want to schedule another scrim on {new Date(showConflictDialog + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}?
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-3">
                        <button type="button" onClick={confirmConflictDate} className="xp-btn xp-btn-primary">Yes</button>
                        <button type="button" onClick={() => setShowConflictDialog(null)} className="xp-btn">No</button>
                    </div>
                </XpDialog>
            )}

            {/* Cancel confirmation dialog */}
            {showCancelDialog && (
                <XpDialog title="Cancel Wizard" icon="❓" onClose={() => setShowCancelDialog(false)}>
                    <div className="xp-text" style={{ marginBottom: 8 }}>
                        Are you sure you want to cancel? All entered information will be lost.
                    </div>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => { setShowCancelDialog(false); resetWizard() }} className="xp-btn xp-btn-danger">Yes, Cancel</button>
                        <button type="button" onClick={() => setShowCancelDialog(false)} className="xp-btn">No, Continue</button>
                    </div>
                </XpDialog>
            )}
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
    color-scheme: light;
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

/* ── Wizard (XP Installer) ── */
.xp-wizard { display: flex; flex-direction: column; }
.xp-wizard-body { display: flex; min-height: 260px; }
.xp-wizard-sidebar {
    width: 130px; flex-shrink: 0;
    background: linear-gradient(180deg, #5989c7 0%, #3a6ea5 100%);
    padding: 14px 6px; border-right: 1px solid #7f9db9;
}
.xp-wizard-step-item {
    font-family: system-ui, Tahoma, sans-serif; font-size: 10px;
    color: rgba(255,255,255,0.5); padding: 3px 5px; margin-bottom: 1px;
    border-radius: 2px; display: flex; align-items: center; gap: 5px;
}
.xp-wizard-step-item-active { color: #fff; font-weight: bold; background: rgba(255,255,255,0.15); }
.xp-wizard-step-item-done { color: rgba(255,255,255,0.75); }
.xp-wizard-step-num {
    width: 16px; height: 16px; border-radius: 50%; font-size: 9px;
    display: flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,0.2); font-weight: bold; flex-shrink: 0;
}
.xp-wizard-step-item-active .xp-wizard-step-num { background: #fff; color: #0054e3; }
.xp-wizard-step-item-done .xp-wizard-step-num { background: rgba(255,255,255,0.35); }
.xp-wizard-content { flex: 1; padding: 10px 12px; overflow-y: auto; max-height: 360px; }
.xp-wizard-footer {
    display: flex; align-items: center; justify-content: space-between;
    padding: 5px 8px; border-top: 2px groove #d4d0c8; background: #ece9d8;
}
.xp-wizard-mobile-step { display: none; }

/* ── Calendar ── */
.xp-calendar { border: 2px solid; border-color: #7f9db9 #f0f0f0 #f0f0f0 #7f9db9; background: #fff; }
.xp-calendar-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 3px 6px; background: linear-gradient(180deg, #0997ff 0%, #0054ee 100%);
    color: #fff; font-weight: bold;
}
.xp-calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); }
.xp-calendar-day-header {
    text-align: center; font-size: 10px; font-weight: bold;
    padding: 3px; color: #555; background: #ece9d8;
    border-bottom: 1px solid #c0c0c0;
}
.xp-calendar-day {
    text-align: center; padding: 5px 2px; font-size: 11px;
    cursor: pointer; border: 1px solid transparent; position: relative;
    font-family: system-ui, Tahoma, sans-serif; color: #000;
}
.xp-calendar-day:hover { background: #eff4ff; border-color: #316ac5; }
.xp-calendar-day-selected { background: #316ac5 !important; color: #fff !important; font-weight: bold; }
.xp-calendar-day-today { border-color: #0054e3; font-weight: bold; }
.xp-calendar-day-past { color: #c0c0c0 !important; cursor: default; }
.xp-calendar-day-past:hover { background: transparent; border-color: transparent; }
.xp-calendar-day-scrim::after {
    content: ''; position: absolute; bottom: 1px; left: 50%; transform: translateX(-50%);
    width: 5px; height: 5px; border-radius: 50%; background: #ff6600;
}

/* ── Time Picker ── */
.xp-time-select {
    font-family: system-ui, Tahoma, sans-serif; font-size: 14px;
    padding: 4px 6px; background: #fff;
    border: 2px solid; border-color: #7f9db9 #f0f0f0 #f0f0f0 #7f9db9;
    color: #000; text-align: center; width: 52px; cursor: pointer;
}
.xp-time-colon { font-size: 18px; font-weight: bold; color: #000; }

/* ── Checkbox (XP style) ── */
.xp-checkbox-label {
    display: flex; align-items: center; gap: 5px; cursor: pointer;
    padding: 2px 0; font-family: system-ui, Tahoma, sans-serif; font-size: 11px;
}
.xp-checkbox { accent-color: #0058e6; cursor: pointer; }

/* ── Scrim Calendar Window ── */
.xp-scrim-cal-window {
    z-index: 12;
    width: 320px !important;
}
.xp-scrim-cal-window .xp-window-body {
    padding: 0 !important;
    display: flex; flex-direction: column;
}
.xp-cal-big-day {
    min-height: 32px; padding: 3px 2px !important;
    display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
    gap: 1px; position: relative;
}
.xp-cal-dots {
    display: flex; gap: 2px; position: absolute; bottom: 2px;
}
.xp-cal-dot {
    width: 6px; height: 6px; border-radius: 50%; display: inline-block;
}
.xp-cal-dot-confirmed { background: #2d8212; }
.xp-cal-dot-pending { background: #e89c0c; }
.xp-cal-scrim-item {
    background: #fff; border: 1px solid #d4d0c8; padding: 4px 6px;
    border-left: 3px solid #0054e3;
}
.xp-cal-scrim-item:hover { background: #f4f8ff; }
.xp-cal-detail {
    scrollbar-width: thin;
    scrollbar-color: #a0a0a0 #ece9d8;
}

/* ── Post Scrim Window ── */
.xp-post-window {
    z-index: 30;
    width: min(520px, 92vw) !important;
}

/* ── Dialog (XP warning popup) ── */
.xp-dialog-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.35);
    display: flex; align-items: center; justify-content: center;
    z-index: 200;
}
.xp-dialog { width: 340px; max-width: 92vw; }

/* ── Mobile adjustments ── */
@media (max-width: 768px) {
    /* Hide all XP chrome on mobile — only show scrim planner content */
    .xp-theme {
        background: none !important;
        background-color: var(--color-primary, #0f1923) !important;
        padding-bottom: 0 !important;
        color: var(--color-text, #e0e0e0) !important;
        font-family: "Montserrat", system-ui, sans-serif !important;
        color-scheme: dark !important;
        padding-top: 72px;
    }
    .xp-dino-window { display: none !important; }
    .xp-coinflip-window { display: none !important; }
    .xp-scrim-cal-window { display: none !important; }
    .xp-post-window {
        position: relative !important;
        left: auto !important; top: auto !important;
        width: 100% !important; height: auto !important;
        border: none !important; border-radius: 0 !important;
        box-shadow: none !important; overflow: visible !important;
        margin-top: 8px;
    }
    .xp-post-window > .xp-title-bar { display: none !important; }
    .xp-post-window > .xp-window-body { background: transparent !important; padding: 0 !important; }
    .xp-desktop-icons { display: none !important; }
    .xp-taskbar { display: none !important; }
    .xp-resize-handle { display: none !important; }

    /* Strip XP window chrome from the main scrim planner window */
    .xp-main-window {
        position: relative !important;
        left: auto !important; top: auto !important;
        width: 100% !important; height: auto !important;
        border: none !important; border-radius: 0 !important;
        box-shadow: none !important;
        overflow: visible !important;
    }
    .xp-main-window > .xp-title-bar { display: none !important; }
    .xp-main-window > .xp-window-body {
        background: transparent !important;
        padding: 0 12px !important;
    }

    /* Restyle tabs for dark theme */
    .xp-tab-bar {
        border-bottom-color: rgba(255,255,255,0.1) !important;
        padding-left: 0 !important;
        gap: 4px !important;
    }
    .xp-tab {
        background: rgba(255,255,255,0.05) !important;
        border: 1px solid rgba(255,255,255,0.1) !important;
        border-bottom: none !important;
        color: var(--color-text, #e0e0e0) !important;
        font-family: "Montserrat", system-ui, sans-serif !important;
        font-size: 12px !important; font-weight: 600 !important;
        padding: 8px 16px !important;
    }
    .xp-tab:hover { background: rgba(255,255,255,0.1) !important; }
    .xp-tab-active {
        background: rgba(255,255,255,0.12) !important;
        border-bottom: 1px solid transparent !important;
        color: var(--color-accent, #4fa0e8) !important;
    }
    .xp-tab-content {
        background: transparent !important;
        border: none !important;
        padding: 12px 0 !important;
    }

    /* Restyle XP elements for dark mobile theme */
    .xp-text { color: var(--color-text, #e0e0e0) !important; font-family: "Montserrat", system-ui, sans-serif !important; }
    .xp-fieldset { border-color: rgba(255,255,255,0.15) !important; }
    .xp-fieldset-legend { color: var(--color-text, #e0e0e0) !important; font-family: "Montserrat", system-ui, sans-serif !important; }
    .xp-input, .xp-select {
        background: rgba(255,255,255,0.08) !important;
        border-color: rgba(255,255,255,0.2) !important;
        color: var(--color-text, #e0e0e0) !important;
        font-family: "Montserrat", system-ui, sans-serif !important;
    }
    .xp-scrim-card {
        background: rgba(255,255,255,0.05) !important;
        border-color: rgba(255,255,255,0.1) !important;
    }
    .xp-scrim-card:hover { background: rgba(255,255,255,0.08) !important; }
    .xp-listbox {
        background: var(--color-secondary, #1a2733) !important;
        border-color: rgba(255,255,255,0.2) !important;
    }
    .xp-listbox-item { color: var(--color-text, #e0e0e0) !important; }
    .xp-listbox-item:hover { background: var(--color-accent, #4fa0e8) !important; }
    .xp-radio-label { color: var(--color-text, #e0e0e0) !important; }
    .xp-progress { border-color: rgba(255,255,255,0.2) !important; background: rgba(255,255,255,0.05) !important; }

    /* Wizard mobile overrides */
    .xp-wizard-sidebar { display: none !important; }
    .xp-wizard-mobile-step {
        display: block !important;
        font-family: "Montserrat", system-ui, sans-serif;
        font-size: 11px; color: var(--color-accent, #4fa0e8);
        font-weight: 600; margin-bottom: 6px;
    }
    .xp-wizard-content {
        padding: 8px 2px !important; max-height: none !important;
    }
    .xp-wizard-footer {
        border-color: rgba(255,255,255,0.1) !important;
        background: transparent !important;
    }
    .xp-wizard-footer .xp-btn { font-family: "Montserrat", system-ui, sans-serif !important; }
    .xp-calendar { border-color: rgba(255,255,255,0.2) !important; background: rgba(255,255,255,0.05) !important; }
    .xp-calendar-header { background: var(--color-accent, #4fa0e8) !important; }
    .xp-calendar-day-header { background: rgba(255,255,255,0.05) !important; color: var(--color-text, #e0e0e0) !important; border-color: rgba(255,255,255,0.1) !important; }
    .xp-calendar-day { color: var(--color-text, #e0e0e0) !important; }
    .xp-calendar-day:hover { background: rgba(255,255,255,0.1) !important; }
    .xp-calendar-day-selected { background: var(--color-accent, #4fa0e8) !important; color: #fff !important; }
    .xp-calendar-day-past { color: rgba(255,255,255,0.2) !important; }
    .xp-calendar-day-today { border-color: var(--color-accent, #4fa0e8) !important; }
    .xp-time-select {
        background: rgba(255,255,255,0.08) !important;
        border-color: rgba(255,255,255,0.2) !important;
        color: var(--color-text, #e0e0e0) !important;
        font-family: "Montserrat", system-ui, sans-serif !important;
    }
    .xp-time-colon { color: var(--color-text, #e0e0e0) !important; }
    .xp-checkbox-label { color: var(--color-text, #e0e0e0) !important; font-family: "Montserrat", system-ui, sans-serif !important; }
    .xp-dialog-overlay { z-index: 200; }
    .xp-dialog .xp-window-body { background: var(--color-secondary, #1a2733) !important; }
    .xp-dialog .xp-text { color: var(--color-text, #e0e0e0) !important; }
}
`

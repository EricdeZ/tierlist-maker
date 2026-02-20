import { useRef, useEffect, useCallback, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { smiterunnerService } from '../../services/database'
import zeusImg from '../../assets/zeus.png'
import minionImg from '../../assets/minion.png'

const TICK_RATE = 60
const TICK_MS = 1000 / TICK_RATE
const HEARTBEAT_INTERVAL = 120 // ticks (~2 seconds)

const W = 900, H = 150, GROUND = H - 22
const GRAVITY = 0.55
const INITIAL_VY = -5
const BOOST_FORCE = -0.65
const MAX_BOOST_FRAMES = 14

export default function XpDinoGame() {
    const { user } = useAuth()

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

    // Jump state
    const keyDownRef = useRef(false)
    const jumpActiveRef = useRef(false)
    const boostFramesRef = useRef(0)

    // Fixed timestep state
    const accumulatorRef = useRef(0)
    const lastTimestampRef = useRef(null)
    const gameTickRef = useRef(0)

    // Session / anti-cheat
    const sessionTokenRef = useRef(null)
    const submittedRef = useRef(false)
    const lastHeartbeatRef = useRef(0)

    // Leaderboard state
    const [leaderboard, setLeaderboard] = useState([])
    const [myBestScore, setMyBestScore] = useState(0)
    const [totalRuns, setTotalRuns] = useState(0)
    const [showLeaderboard, setShowLeaderboard] = useState(false)
    const [lastSubmitResult, setLastSubmitResult] = useState(null)

    // Preload images
    const zeusImgRef = useRef(null)
    const minionImgRef = useRef(null)
    useEffect(() => {
        const z = new Image(); z.src = zeusImg; zeusImgRef.current = z
        const m = new Image(); m.src = minionImg; minionImgRef.current = m
    }, [])

    // Load stats on mount
    const loadLeaderboard = useCallback(() => {
        smiterunnerService.getLeaderboard()
            .then(data => setLeaderboard(data.leaderboard || []))
            .catch(() => {})
    }, [])

    useEffect(() => {
        loadLeaderboard()
        if (user) {
            smiterunnerService.getMyStats()
                .then(data => {
                    setMyBestScore(data.bestScore || 0)
                    setTotalRuns(data.totalRuns || 0)
                })
                .catch(() => {})
        }
    }, [user, loadLeaderboard])

    // ── Fixed-step game logic (runs at exactly 60 ticks/sec) ──
    const updateGameTick = useCallback((s) => {
        s.frame++

        // Jump physics (Mario-style variable height)
        if (jumpActiveRef.current && keyDownRef.current && boostFramesRef.current < MAX_BOOST_FRAMES) {
            s.player.vy += BOOST_FORCE
            boostFramesRef.current++
        }

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
            const mw = 28 + Math.random() * 8
            if (r < 0.5) {
                s.obstacles.push({ x: W + 10, h: 28 + Math.random() * 8, w: mw })
            } else if (r < 0.85) {
                s.obstacles.push({ x: W + 10, h: 38 + Math.random() * 8, w: mw })
            } else {
                s.obstacles.push({ x: W + 10, h: 48 + Math.random() * 8, w: mw })
            }
            s.nextObstacle = 25 + Math.random() * 35
        }
        s.obstacles.forEach(o => { o.x -= s.speed })
        s.obstacles = s.obstacles.filter(o => o.x > -40)

        // Collision
        const pBox = { x: s.player.x + 8, w: s.player.w - 16, y: s.player.y, h: s.player.h - 5 }
        for (const o of s.obstacles) {
            if (pBox.x + pBox.w > o.x + 4 && pBox.x < o.x + o.w - 4 && pBox.y < o.h) s.gameOver = true
        }

        s.score = Math.floor(gameTickRef.current / 5)
        s.speed = 15 + s.score * 0.024

        // Heartbeat (fire-and-forget)
        if (sessionTokenRef.current && gameTickRef.current - lastHeartbeatRef.current >= HEARTBEAT_INTERVAL) {
            lastHeartbeatRef.current = gameTickRef.current
            smiterunnerService.heartbeat(sessionTokenRef.current, gameTickRef.current).catch(() => {})
        }
    }, [])

    const reset = useCallback(() => {
        const s = stateRef.current
        s.player = { x: 60, y: 0, vy: 0, w: 40, h: 55 }
        s.obstacles = []
        s.clouds = Array.from({ length: 6 }, (_, i) => ({ x: 80 + i * 160, y: 12 + Math.random() * 30 }))
        s.columns = [{ x: W * 0.55 }, { x: W * 1.2 }]
        s.score = 0; s.speed = 15
        s.gameOver = false; s.started = true
        s.frame = 0; s.nextObstacle = 25; s.ground = 0
        keyDownRef.current = false
        jumpActiveRef.current = false
        boostFramesRef.current = 0

        // Fixed timestep reset
        accumulatorRef.current = 0
        lastTimestampRef.current = null
        gameTickRef.current = 0
        submittedRef.current = false
        lastHeartbeatRef.current = 0
        setLastSubmitResult(null)

        // Start server session for leaderboard
        if (user) {
            sessionTokenRef.current = null
            smiterunnerService.startSession()
                .then(data => { sessionTokenRef.current = data.sessionToken })
                .catch(() => { sessionTokenRef.current = null })
        }
    }, [user])

    // --- Input handlers ---
    const onPress = useCallback(() => {
        const s = stateRef.current
        if (s.gameOver) { reset(); return }
        if (!s.started) { reset(); return }
        keyDownRef.current = true
        if (s.player.y === 0) {
            s.player.vy = INITIAL_VY
            jumpActiveRef.current = true
            boostFramesRef.current = 0
        }
    }, [reset])

    const onRelease = useCallback(() => {
        keyDownRef.current = false
        jumpActiveRef.current = false
    }, [])

    // Auto-submit on game over
    const handleGameOver = useCallback((score, ticks) => {
        if (submittedRef.current || !sessionTokenRef.current || score <= 0) return
        submittedRef.current = true
        smiterunnerService.submitScore(sessionTokenRef.current, score, ticks)
            .then(data => {
                if (data.error) return
                if (data.isNewBest) setMyBestScore(data.bestScore)
                setTotalRuns(data.totalRuns)
                setLastSubmitResult(data)
                loadLeaderboard()
            })
            .catch(() => {})
    }, [loadLeaderboard])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        ctx.imageSmoothingEnabled = false

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

        const loop = (timestamp) => {
            const s = stateRef.current

            // ── Fixed timestep accumulation ──
            if (lastTimestampRef.current === null) lastTimestampRef.current = timestamp
            const rawDelta = timestamp - lastTimestampRef.current
            const delta = Math.min(rawDelta, 100) // cap to prevent death spiral
            lastTimestampRef.current = timestamp

            if (s.started && !s.gameOver) {
                accumulatorRef.current += delta
                const wasAlive = !s.gameOver
                while (accumulatorRef.current >= TICK_MS && !s.gameOver) {
                    updateGameTick(s)
                    gameTickRef.current++
                    accumulatorRef.current -= TICK_MS
                }
                // Game over triggered during tick loop
                if (wasAlive && s.gameOver) {
                    handleGameOver(s.score, gameTickRef.current)
                }
            }

            // ── Render ──
            ctx.clearRect(0, 0, W, H)

            // Sky
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

            // Ground
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

        // Kick off the loop — first frame gets timestamp from rAF
        rafRef.current = requestAnimationFrame(loop)

        // Keyboard handlers
        const isTyping = () => {
            const tag = document.activeElement?.tagName
            return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable
        }
        const onKeyDown = (e) => {
            if (e.repeat || isTyping()) return
            if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); onPress() }
        }
        const onKeyUp = (e) => {
            if (isTyping()) return
            if (e.code === 'Space' || e.code === 'ArrowUp') onRelease()
        }
        window.addEventListener('keydown', onKeyDown)
        window.addEventListener('keyup', onKeyUp)
        return () => {
            window.removeEventListener('keydown', onKeyDown)
            window.removeEventListener('keyup', onKeyUp)
            if (rafRef.current) cancelAnimationFrame(rafRef.current)
        }
    }, [onPress, onRelease, updateGameTick, handleGameOver])

    return (
        <div style={{ background: '#c0c0c0', padding: 3 }}>
            <canvas ref={canvasRef} width={W} height={H}
                onPointerDown={onPress} onPointerUp={onRelease}
                style={{ display: 'block', width: '100%', height: 'auto', imageRendering: 'auto', cursor: 'pointer', border: '2px inset #d4d0c8', touchAction: 'none' }}
            />

            {/* Personal stats bar */}
            {user && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 4px', background: '#ece9d8', borderTop: '1px solid #fff' }}>
                    <span className="xp-text" style={{ fontSize: 10 }}>
                        <b>Your Best:</b> {myBestScore > 0 ? myBestScore : '---'}
                        {lastSubmitResult?.isNewBest && <span style={{ color: '#2d8212', marginLeft: 4 }}>NEW!</span>}
                    </span>
                    <span className="xp-text" style={{ fontSize: 10 }}>
                        <b>Runs:</b> {totalRuns}
                    </span>
                </div>
            )}

            {/* Leaderboard toggle */}
            <button
                onClick={() => { setShowLeaderboard(!showLeaderboard); if (!showLeaderboard) loadLeaderboard() }}
                className="xp-btn"
                style={{ display: 'block', width: '100%', marginTop: 2, fontSize: 10, padding: '2px 4px' }}
            >
                {showLeaderboard ? 'Hide Leaderboard' : 'Leaderboard'}
            </button>

            {showLeaderboard && (
                <div style={{ marginTop: 2, background: '#fff', border: '2px solid', borderColor: '#7f9db9 #f0f0f0 #f0f0f0 #7f9db9', maxHeight: 150, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#ece9d8', borderBottom: '1px solid #c0c0c0' }}>
                                <th className="xp-text" style={{ padding: '2px 6px', textAlign: 'left', fontWeight: 700, fontSize: 10 }}>#</th>
                                <th className="xp-text" style={{ padding: '2px 6px', textAlign: 'left', fontWeight: 700, fontSize: 10 }}>Player</th>
                                <th className="xp-text" style={{ padding: '2px 6px', textAlign: 'right', fontWeight: 700, fontSize: 10 }}>Gold</th>
                            </tr>
                        </thead>
                        <tbody>
                            {leaderboard.map((entry, i) => (
                                <tr key={entry.userId} style={{
                                    borderBottom: '1px solid #e8e8e8',
                                    background: entry.userId === user?.id ? '#e8f0ff' : undefined,
                                }}>
                                    <td className="xp-text" style={{ padding: '2px 6px', fontSize: 10 }}>{entry.position}</td>
                                    <td className="xp-text" style={{ padding: '2px 6px', fontSize: 10 }}>{entry.discordUsername || '???'}</td>
                                    <td className="xp-text" style={{ padding: '2px 6px', textAlign: 'right', fontSize: 10, fontWeight: 700, color: '#0058e6' }}>{entry.bestScore}</td>
                                </tr>
                            ))}
                            {leaderboard.length === 0 && (
                                <tr><td colSpan={3} className="xp-text" style={{ padding: '6px', textAlign: 'center', fontSize: 10, color: '#666' }}>No scores yet</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

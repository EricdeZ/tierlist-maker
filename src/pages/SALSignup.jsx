import { useState, useEffect, useRef, useCallback } from 'react'
import PageTitle from '../components/PageTitle'
import Navbar from '../components/layout/Navbar'
import salLogo from '../assets/leagues/sap.png'

// Set embed URLs here — leave null for "Unlocking Soon"
const PLAYER_EMBED_URL = 'https://forms.gle/VjiqocWrtYyscK7UA'
const COACH_EMBED_URL = 'https://forms.gle/qtrghApr5vJm7enCA'
const DISCORD_URL = 'https://discord.gg/7H6mqwtZq6'

const COLOR = '#719c3a'
const COLOR_LIGHT = '#8fbf4a'
const COLOR_GLOW = 'rgba(113,156,58,0.4)'

export default function SALSignup() {
    const [mode, setMode] = useState('player') // 'player' | 'coach'
    const isPlayer = mode === 'player'
    const embedUrl = isPlayer ? PLAYER_EMBED_URL : COACH_EMBED_URL

    return (
        <div className="min-h-screen bg-(--color-primary) text-(--color-text)">
            <PageTitle
                title="SAL Season Signup"
                description="Sign up for the Serpent Ascension League — a community-focused SMITE 2 league for Gold and below players."
            />
            <Navbar title="SAL Signup" />

            {/* Hero Banner */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-0" style={{
                        background: `linear-gradient(180deg, #0a1a04 0%, #132d08 20%, #0a1a04 50%, var(--color-primary) 100%)`,
                    }} />
                    <div className="absolute top-0 left-1/4 w-[600px] h-[400px] rounded-full opacity-20 blur-3xl"
                        style={{ background: `radial-gradient(ellipse, ${COLOR}, transparent 70%)` }}
                    />
                    <div className="absolute top-10 right-1/4 w-[500px] h-[350px] rounded-full opacity-15 blur-3xl"
                        style={{ background: `radial-gradient(ellipse, ${COLOR_LIGHT}, transparent 70%)` }}
                    />
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[900px] h-[300px] rounded-full opacity-10 blur-3xl"
                        style={{ background: `radial-gradient(ellipse, ${COLOR}, transparent 60%)` }}
                    />
                    <div className="absolute inset-0" style={{
                        background: 'radial-gradient(ellipse at center, transparent 40%, rgba(6,13,26,0.8) 100%)',
                    }} />
                </div>

                <LeafRain />

                <div className="relative max-w-5xl mx-auto px-4 pt-28 pb-16 text-center" style={{ zIndex: 2, pointerEvents: 'none' }}>
                    <div className="relative inline-block mb-6">
                        <div className="absolute inset-0 blur-2xl opacity-40 scale-150 rounded-full"
                            style={{ background: `radial-gradient(circle, ${COLOR}, transparent 70%)` }}
                        />
                        <img src={salLogo} alt="SAL" className="relative w-28 h-28 sm:w-32 sm:h-32 drop-shadow-2xl" />
                    </div>

                    <span className="block text-xs font-bold uppercase tracking-[0.3em] mb-4"
                        style={{ color: COLOR }}
                    >
                        Serpent Ascension League
                    </span>
                    <h1 className="font-heading text-5xl sm:text-6xl lg:text-7xl font-black mb-5 leading-[1.1]">
                        <span className="block text-white drop-shadow-lg">Rise. Compete.</span>
                        <span className="block mt-1" style={{
                            background: `linear-gradient(135deg, ${COLOR_LIGHT}, ${COLOR}, #5a7d2e)`,
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            filter: `drop-shadow(0 2px 8px ${COLOR_GLOW})`,
                        }}>
                            Ascend.
                        </span>
                    </h1>
                    <p className="text-white/80 text-base sm:text-lg max-w-2xl mx-auto mb-6 leading-relaxed">
                        The Serpent Ascension League is a community-focused SMITE 2 league for Gold and below players.
                        We help lower-ranked players improve, learn from top mentors, and enjoy competitive matches
                        in a fun, supportive environment. Players, coaches, and friends rise together through teamwork,
                        strategy, and skill!
                    </p>

                    {/* Discord Button */}
                    <a
                        href={DISCORD_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full text-sm font-bold uppercase tracking-wider transition-all hover:scale-105"
                        style={{
                            pointerEvents: 'auto',
                            background: `linear-gradient(135deg, ${COLOR}, #5a7d2e)`,
                            color: '#fff',
                            boxShadow: `0 0 24px ${COLOR_GLOW}`,
                        }}
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z" />
                        </svg>
                        Join the Discord
                    </a>
                </div>
            </div>

            {/* Divider */}
            <div
                className="w-2/3 h-px mx-auto mb-12"
                style={{ background: `linear-gradient(90deg, transparent, ${COLOR_GLOW}, transparent)` }}
            />

            {/* Toggle + Content */}
            <div className="max-w-4xl mx-auto px-4 pb-20">
                {/* Player / Coach Toggle */}
                <div className="flex justify-center mb-10">
                    <div className="inline-flex rounded-xl border border-white/10 p-1" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <button
                            onClick={() => setMode('player')}
                            className="relative px-6 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer"
                            style={{
                                background: isPlayer ? `linear-gradient(135deg, ${COLOR}, #5a7d2e)` : 'transparent',
                                color: isPlayer ? '#fff' : 'rgba(255,255,255,0.5)',
                                boxShadow: isPlayer ? `0 0 20px ${COLOR_GLOW}` : 'none',
                            }}
                        >
                            <span className="flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                </svg>
                                Player Signup
                            </span>
                        </button>
                        <button
                            onClick={() => setMode('coach')}
                            className="relative px-6 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer"
                            style={{
                                background: !isPlayer ? `linear-gradient(135deg, ${COLOR}, #5a7d2e)` : 'transparent',
                                color: !isPlayer ? '#fff' : 'rgba(255,255,255,0.5)',
                                boxShadow: !isPlayer ? `0 0 20px ${COLOR_GLOW}` : 'none',
                            }}
                        >
                            <span className="flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
                                </svg>
                                Coach Signup
                            </span>
                        </button>
                    </div>
                </div>

                {/* Info Card */}
                <InfoCard isPlayer={isPlayer} />

                {/* Embed / Unlocking Soon */}
                <div className="mt-10">
                    {embedUrl ? (
                        <>
                            <div
                                className="rounded-xl border border-white/10 overflow-hidden"
                                style={{ background: 'linear-gradient(135deg, var(--color-secondary), var(--color-primary))' }}
                            >
                                <iframe
                                    src={embedUrl}
                                    width="100%"
                                    height="900"
                                    frameBorder="0"
                                    title={isPlayer ? 'Player Signup' : 'Coach Signup'}
                                    className="w-full"
                                    style={{ minHeight: 600 }}
                                >
                                    Loading...
                                </iframe>
                            </div>
                            <div className="mt-4 text-center">
                                <a
                                    href={embedUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-bold transition-all hover:scale-105"
                                    style={{
                                        background: `linear-gradient(135deg, ${COLOR}, #5a7d2e)`,
                                        color: '#fff',
                                        boxShadow: `0 0 20px ${COLOR_GLOW}`,
                                    }}
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                                    </svg>
                                    {isPlayer ? 'Open Player Form' : 'Open Coach Form'}
                                </a>
                                <p className="text-white/40 text-xs mt-2">Form not loading? Click the button above to open it directly.</p>
                            </div>
                        </>
                    ) : (
                        <UnlockingSoon />
                    )}
                </div>
            </div>

            {/* Cursor-following serpent */}
            <CursorSerpent />

            <style>{`
                @keyframes leaf-float {
                    0%, 100% { transform: translateY(0) rotate(var(--tw-rotate, 0deg)); }
                    50% { transform: translateY(-12px) rotate(var(--tw-rotate, 0deg)); }
                }
            `}</style>
        </div>
    )
}

/* ═══════════════════════════════════════════
   Leaf Rain — Canvas Background
   ═══════════════════════════════════════════ */
function LeafRain() {
    const canvasRef = useRef(null)
    const particlesRef = useRef([])
    const rafRef = useRef(null)
    const visibleRef = useRef(true)
    const mouseRef = useRef({ x: -1, y: -1 })

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')

        let running = true
        let lastTick = 0
        const FRAME_INTERVAL = 33

        function resize() {
            const parent = canvas.parentElement
            canvas.width = parent.offsetWidth
            canvas.height = parent.offsetHeight
        }

        function initParticles() {
            resize()
            const count = Math.min(Math.floor(canvas.width / 35), 50)
            particlesRef.current = Array.from({ length: count }, () => createParticle(true, false))
        }

        function createParticle(randomY, fromMouse) {
            const mx = mouseRef.current.x
            const my = mouseRef.current.y

            if (fromMouse && mx >= 0) {
                const angle = Math.random() * Math.PI * 2
                const velocity = 2 + Math.random() * 3
                const size = 6 + Math.random() * 10
                return {
                    x: mx + (Math.random() - 0.5) * 10,
                    y: my + (Math.random() - 0.5) * 10,
                    size,
                    speed: Math.sin(angle) * velocity,
                    drift: Math.cos(angle) * velocity,
                    rotation: Math.random() * Math.PI * 2,
                    rotSpeed: (Math.random() - 0.5) * 0.1,
                    opacity: 0.15 + Math.random() * 0.25,
                    life: 1.0,
                    isBurst: true,
                    hue: 80 + Math.random() * 40, // green-yellow range
                }
            }

            const size = 8 + Math.random() * 16
            return {
                x: Math.random() * canvas.width,
                y: randomY ? -size - Math.random() * canvas.height * 1.5 : -size - Math.random() * 80,
                size,
                speed: 0.2 + Math.random() * 0.6,
                drift: (Math.random() - 0.5) * 0.4,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.02,
                opacity: 0.05 + Math.random() * 0.12,
                life: null,
                isBurst: false,
                hue: 80 + Math.random() * 40,
            }
        }

        function onMouseMove(e) {
            const rect = canvas.getBoundingClientRect()
            mouseRef.current.x = e.clientX - rect.left
            mouseRef.current.y = e.clientY - rect.top

            const particles = particlesRef.current
            for (let i = 0; i < 2; i++) {
                if (particles.length < 150) {
                    particles.push(createParticle(false, true))
                }
            }
        }

        function onMouseLeave() {
            mouseRef.current.x = -1
            mouseRef.current.y = -1
        }

        canvas.addEventListener('mousemove', onMouseMove)
        canvas.addEventListener('mouseleave', onMouseLeave)

        initParticles()

        function tick(now) {
            if (!running) return
            rafRef.current = requestAnimationFrame(tick)

            if (!visibleRef.current) return
            if (now - lastTick < FRAME_INTERVAL) return
            lastTick = now

            ctx.clearRect(0, 0, canvas.width, canvas.height)

            const particles = particlesRef.current
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i]

                p.y += p.speed
                p.x += p.drift
                p.rotation += p.rotSpeed

                if (p.isBurst) {
                    p.life -= 0.02
                    p.speed *= 0.97
                    p.drift *= 0.97
                    if (p.life <= 0) {
                        particles.splice(i, 1)
                        continue
                    }
                } else if (p.y > canvas.height + p.size) {
                    Object.assign(p, createParticle(false, false))
                }

                const alpha = p.isBurst ? p.opacity * p.life : p.opacity

                // Draw a simple diamond/leaf shape
                ctx.save()
                ctx.globalAlpha = alpha
                ctx.translate(p.x, p.y)
                ctx.rotate(p.rotation)
                ctx.beginPath()
                ctx.moveTo(0, -p.size / 2)
                ctx.quadraticCurveTo(p.size / 3, 0, 0, p.size / 2)
                ctx.quadraticCurveTo(-p.size / 3, 0, 0, -p.size / 2)
                ctx.closePath()
                ctx.fillStyle = `hsla(${p.hue}, 60%, 45%, 1)`
                ctx.fill()
                ctx.restore()
            }
        }

        rafRef.current = requestAnimationFrame(tick)

        const io = new IntersectionObserver(([entry]) => {
            visibleRef.current = entry.isIntersecting
        }, { threshold: 0 })
        io.observe(canvas.parentElement)

        const ro = new ResizeObserver(() => resize())
        ro.observe(canvas.parentElement)

        return () => {
            running = false
            cancelAnimationFrame(rafRef.current)
            canvas.removeEventListener('mousemove', onMouseMove)
            canvas.removeEventListener('mouseleave', onMouseLeave)
            io.disconnect()
            ro.disconnect()
        }
    }, [])

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ zIndex: 1 }}
        />
    )
}

/* ═══════════════════════════════════════════
   Info Card — Player or Coach
   ═══════════════════════════════════════════ */
function InfoCard({ isPlayer }) {
    return (
        <div
            className="rounded-xl border p-6 sm:p-8 text-center relative overflow-hidden"
            style={{
                background: `linear-gradient(135deg, rgba(113,156,58,0.08), rgba(113,156,58,0.02))`,
                borderColor: `rgba(113,156,58,0.25)`,
            }}
        >
            <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-15 blur-3xl pointer-events-none"
                style={{ background: COLOR }}
            />

            {isPlayer ? (
                <>
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                        style={{ background: `rgba(113,156,58,0.15)`, border: `1px solid rgba(113,156,58,0.3)` }}
                    >
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke={COLOR} strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                    </div>
                    <div className="text-xs font-bold uppercase tracking-[0.2em] mb-1" style={{ color: COLOR }}>
                        Player Registration
                    </div>
                    <h2 className="font-heading text-3xl sm:text-4xl font-black mb-3">
                        Join as a Player
                    </h2>
                    <p className="text-(--color-text-secondary)/70 text-sm max-w-lg mx-auto leading-relaxed">
                        Sign up solo, get drafted onto a team, and compete against other Gold and below players.
                        Improve your skills, learn from experienced coaches, and rise through the ranks.
                    </p>
                </>
            ) : (
                <>
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                        style={{ background: `rgba(113,156,58,0.15)`, border: `1px solid rgba(113,156,58,0.3)` }}
                    >
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke={COLOR} strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
                        </svg>
                    </div>
                    <div className="text-xs font-bold uppercase tracking-[0.2em] mb-1" style={{ color: COLOR }}>
                        Coach Registration
                    </div>
                    <h2 className="font-heading text-3xl sm:text-4xl font-black mb-3">
                        Join as a Coach
                    </h2>
                    <p className="text-(--color-text-secondary)/70 text-sm max-w-lg mx-auto leading-relaxed">
                        Help newer players develop their skills and lead a team to victory.
                        Share your knowledge, draft your roster, and guide your team through the season.
                    </p>
                </>
            )}
        </div>
    )
}

/* ═══════════════════════════════════════════
   Unlocking Soon Placeholder
   ═══════════════════════════════════════════ */
function UnlockingSoon() {
    return (
        <div
            className="rounded-xl border border-white/10 p-12 sm:p-16 text-center"
            style={{ background: 'linear-gradient(135deg, var(--color-secondary), var(--color-primary))' }}
        >
            <div className="w-16 h-16 mx-auto mb-5 rounded-full border border-white/10 flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.03)' }}
            >
                <svg className="w-8 h-8 text-(--color-text-secondary)/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
            </div>
            <h3 className="font-heading text-xl sm:text-2xl font-bold mb-2 text-(--color-text)/80">
                Unlocking Soon
            </h3>
            <p className="text-(--color-text-secondary)/50 text-sm max-w-md mx-auto">
                Signups aren't open just yet. Stay tuned — the gates open soon.
            </p>

            <div className="flex justify-center gap-1.5 mt-5">
                {[0, 1, 2].map((i) => (
                    <div
                        key={i}
                        className="w-2 h-2 rounded-full"
                        style={{
                            background: `rgba(113,156,58,0.5)`,
                            animation: `unlock-pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
                        }}
                    />
                ))}
            </div>

            <style>{`
                @keyframes unlock-pulse {
                    0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
                    40% { opacity: 1; transform: scale(1.2); }
                }
            `}</style>
        </div>
    )
}

/* ═══════════════════════════════════════════
   Cursor Serpent — follows mouse, coils when idle
   ═══════════════════════════════════════════ */
const SNAKE_SEGMENTS = 60
const SEGMENT_SPACING = 6
const HEAD_SIZE = 10
const COIL_IDLE_MS = 400

function CursorSerpent() {
    const canvasRef = useRef(null)
    const mouseRef = useRef({ x: -100, y: -100 })
    const lastMoveRef = useRef(0)
    const segmentsRef = useRef([])
    const coilProgressRef = useRef(0)
    const coilTargetsRef = useRef([])
    const activeRef = useRef(false)
    const rafRef = useRef(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        let running = true

        segmentsRef.current = Array.from({ length: SNAKE_SEGMENTS }, () => ({ x: -100, y: -100 }))

        function resize() {
            canvas.width = window.innerWidth
            canvas.height = window.innerHeight
        }
        resize()

        function onMouseMove(e) {
            mouseRef.current.x = e.clientX
            mouseRef.current.y = e.clientY
            lastMoveRef.current = performance.now()
            activeRef.current = true
            coilProgressRef.current = 0
        }

        function onMouseLeave() {
            activeRef.current = false
        }

        window.addEventListener('mousemove', onMouseMove)
        document.addEventListener('mouseleave', onMouseLeave)

        // Coil: build spiral waypoints, head drives toward them one by one,
        // body follows via chain physics. Stops when head reaches cursor.
        const coilWaypointsRef = { value: [], idx: 0 }
        const coilDoneRef = { value: false }
        const COIL_HEAD_SPEED = 4

        function buildCoilWaypoints(cx, cy) {
            const pts = []
            // Spiral inward: ~3 revolutions, from radius 80 → 0
            const steps = 160
            for (let i = 0; i <= steps; i++) {
                const t = i / steps
                const angle = t * Math.PI * 6
                const radius = 80 * (1 - t)
                pts.push({
                    x: cx + Math.cos(angle) * radius,
                    y: cy + Math.sin(angle) * radius,
                })
            }
            return pts
        }

        function tick() {
            if (!running) return
            rafRef.current = requestAnimationFrame(tick)

            ctx.clearRect(0, 0, canvas.width, canvas.height)
            if (!activeRef.current) return

            const segs = segmentsRef.current
            const mx = mouseRef.current.x
            const my = mouseRef.current.y
            const now = performance.now()
            const idle = now - lastMoveRef.current > COIL_IDLE_MS

            if (idle) {
                const head = segs[0]

                if (coilProgressRef.current === 0) {
                    coilWaypointsRef.value = buildCoilWaypoints(mx, my)
                    coilWaypointsRef.idx = 0
                    coilDoneRef.value = false
                    coilProgressRef.current = 1
                }

                if (!coilDoneRef.value) {
                    const wps = coilWaypointsRef.value
                    let wp = wps[coilWaypointsRef.idx]

                    // Drive head toward current waypoint
                    const dx = wp.x - head.x
                    const dy = wp.y - head.y
                    const dist = Math.sqrt(dx * dx + dy * dy)

                    if (dist < COIL_HEAD_SPEED * 1.5) {
                        // Reached waypoint, advance to next
                        coilWaypointsRef.idx++
                        if (coilWaypointsRef.idx >= wps.length) {
                            coilDoneRef.value = true
                        }
                    }

                    if (!coilDoneRef.value) {
                        wp = wps[coilWaypointsRef.idx]
                        const ddx = wp.x - head.x
                        const ddy = wp.y - head.y
                        const dd = Math.sqrt(ddx * ddx + ddy * ddy)
                        if (dd > 0.5) {
                            head.x += (ddx / dd) * COIL_HEAD_SPEED
                            head.y += (ddy / dd) * COIL_HEAD_SPEED
                        }
                    }
                }
                // else: coil complete, head stays put

                // Body follows via chain physics
                for (let i = 1; i < segs.length; i++) {
                    const prev = segs[i - 1]
                    const cur = segs[i]
                    const sdx = prev.x - cur.x
                    const sdy = prev.y - cur.y
                    const sd = Math.sqrt(sdx * sdx + sdy * sdy)
                    if (sd > SEGMENT_SPACING) {
                        const move = sd - SEGMENT_SPACING
                        cur.x += (sdx / sd) * move
                        cur.y += (sdy / sd) * move
                    }
                }
            } else {
                coilProgressRef.current = 0
                const head = segs[0]
                const dx = mx - head.x
                const dy = my - head.y
                const dist = Math.sqrt(dx * dx + dy * dy)
                const speed = Math.min(dist * 0.25, 30)
                if (dist > 1) {
                    head.x += (dx / dist) * speed
                    head.y += (dy / dist) * speed
                }

                for (let i = 1; i < segs.length; i++) {
                    const prev = segs[i - 1]
                    const cur = segs[i]
                    const sdx = prev.x - cur.x
                    const sdy = prev.y - cur.y
                    const sd = Math.sqrt(sdx * sdx + sdy * sdy)
                    if (sd > SEGMENT_SPACING) {
                        const move = sd - SEGMENT_SPACING
                        cur.x += (sdx / sd) * move
                        cur.y += (sdy / sd) * move
                    }
                }
            }

            // Body
            ctx.lineCap = 'round'
            ctx.lineJoin = 'round'

            for (let i = segs.length - 1; i >= 1; i--) {
                const t = 1 - i / segs.length
                const width = 3 + t * (HEAD_SIZE - 3)
                const lightness = 30 + t * 20
                const alpha = 0.3 + t * 0.6

                ctx.beginPath()
                ctx.moveTo(segs[i].x, segs[i].y)
                ctx.lineTo(segs[i - 1].x, segs[i - 1].y)
                ctx.strokeStyle = `hsla(90, 55%, ${lightness}%, ${alpha})`
                ctx.lineWidth = width
                ctx.stroke()
            }

            // Scale pattern
            for (let i = 0; i < segs.length; i += 3) {
                const t = 1 - i / segs.length
                const r = 1.5 + t * 3
                ctx.beginPath()
                ctx.arc(segs[i].x, segs[i].y, r, 0, Math.PI * 2)
                ctx.fillStyle = `hsla(85, 60%, ${25 + t * 15}%, ${0.2 + t * 0.3})`
                ctx.fill()
            }

            // Head
            const head = segs[0]
            const neck = segs[1]
            const angle = Math.atan2(head.y - neck.y, head.x - neck.x)

            ctx.save()
            ctx.translate(head.x, head.y)
            ctx.rotate(angle)

            ctx.beginPath()
            ctx.ellipse(2, 0, HEAD_SIZE * 0.7, HEAD_SIZE * 0.55, 0, 0, Math.PI * 2)
            ctx.fillStyle = 'hsla(90, 55%, 42%, 0.9)'
            ctx.fill()

            // Eyes
            const ey = HEAD_SIZE * 0.25
            ctx.beginPath()
            ctx.arc(4, -ey, 2.5, 0, Math.PI * 2)
            ctx.arc(4, ey, 2.5, 0, Math.PI * 2)
            ctx.fillStyle = '#1a1a2e'
            ctx.fill()

            ctx.beginPath()
            ctx.arc(4.8, -ey - 0.8, 1, 0, Math.PI * 2)
            ctx.arc(4.8, ey - 0.8, 1, 0, Math.PI * 2)
            ctx.fillStyle = 'rgba(255,255,255,0.7)'
            ctx.fill()

            // Tongue flicker
            if (!idle && Math.sin(now * 0.015) > 0.3) {
                ctx.beginPath()
                ctx.moveTo(HEAD_SIZE * 0.7, 0)
                ctx.lineTo(HEAD_SIZE * 1.3, -2)
                ctx.moveTo(HEAD_SIZE * 0.7, 0)
                ctx.lineTo(HEAD_SIZE * 1.3, 2)
                ctx.strokeStyle = 'hsla(0, 70%, 55%, 0.8)'
                ctx.lineWidth = 1.2
                ctx.stroke()
            }

            ctx.restore()

            // Head glow
            ctx.save()
            ctx.beginPath()
            ctx.arc(head.x, head.y, HEAD_SIZE * 1.5, 0, Math.PI * 2)
            const grad = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, HEAD_SIZE * 1.5)
            grad.addColorStop(0, 'rgba(113,156,58,0.15)')
            grad.addColorStop(1, 'rgba(113,156,58,0)')
            ctx.fillStyle = grad
            ctx.fill()
            ctx.restore()
        }

        rafRef.current = requestAnimationFrame(tick)

        const ro = new ResizeObserver(() => resize())
        ro.observe(document.documentElement)

        return () => {
            running = false
            cancelAnimationFrame(rafRef.current)
            window.removeEventListener('mousemove', onMouseMove)
            document.removeEventListener('mouseleave', onMouseLeave)
            ro.disconnect()
        }
    }, [])

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 50 }}
        />
    )
}

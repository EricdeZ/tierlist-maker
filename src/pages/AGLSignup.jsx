import { useState, useEffect, useRef, useCallback } from 'react'
import PageTitle from '../components/PageTitle'
import Navbar from '../components/layout/Navbar'
import aglLogo from '../assets/leagues/agl.png'
import passionCoin from '../assets/passion/passion.png'
import passionTails from '../assets/passion/passiontails.png'
import diamondsImg from '../assets/diamonds.png'
import deityImg from '../assets/ranks/deity.png'
import demigodImg from '../assets/ranks/demigod.png'
import masterImg from '../assets/ranks/master.png'
import obsidianImg from '../assets/ranks/obsidian.png'
import diamondImg from '../assets/ranks/diamond.png'

// Set embed URLs here — leave null for "Unlocking Soon"
const KAIJU_EMBED_URL = null
const OTHER_EMBED_URL = null

const OTHER_DIVISIONS = [
    { name: 'Glaciier', img: demigodImg },
    { name: 'Majin', img: masterImg },
    { name: 'Ferendum', img: obsidianImg },
    { name: 'Sharixx', img: diamondImg },
]

export default function AGLSignup() {
    const [mode, setMode] = useState('kaiju') // 'kaiju' | 'other'
    const isKaiju = mode === 'kaiju'
    const embedUrl = isKaiju ? KAIJU_EMBED_URL : OTHER_EMBED_URL

    return (
        <div className="min-h-screen bg-(--color-primary) text-(--color-text)">
            <PageTitle
                title="AGL Season Signup"
                description="Sign up for the Albion Giants League — Cash Division or ranked play. Prize pool sponsored by Hi-Rez Studios."
            />
            <Navbar title="AGL Signup" />

            {/* ═══ Hero Banner ═══ */}
            <div className="relative overflow-hidden">
                {/* AGL orange gradient background */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-0" style={{
                        background: 'linear-gradient(180deg, #1a0a00 0%, #2d1200 20%, #1a0a00 50%, var(--color-primary) 100%)',
                    }} />
                    {/* Orange radial blooms */}
                    <div className="absolute top-0 left-1/4 w-[600px] h-[400px] rounded-full opacity-20 blur-3xl"
                        style={{ background: 'radial-gradient(ellipse, #F57C20, transparent 70%)' }}
                    />
                    <div className="absolute top-10 right-1/4 w-[500px] h-[350px] rounded-full opacity-15 blur-3xl"
                        style={{ background: 'radial-gradient(ellipse, #E8941A, transparent 70%)' }}
                    />
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[900px] h-[300px] rounded-full opacity-10 blur-3xl"
                        style={{ background: 'radial-gradient(ellipse, #F57C20, transparent 60%)' }}
                    />
                    {/* Vignette edges */}
                    <div className="absolute inset-0" style={{
                        background: 'radial-gradient(ellipse at center, transparent 40%, rgba(6,13,26,0.8) 100%)',
                    }} />
                </div>

                {/* Diamond rain canvas */}
                <DiamondRain />

                <div className="relative max-w-5xl mx-auto px-4 pt-28 pb-16 text-center" style={{ zIndex: 2, pointerEvents: 'none' }}>
                    {/* AGL Logo — large & glowing */}
                    <div className="relative inline-block mb-6">
                        <div className="absolute inset-0 blur-2xl opacity-40 scale-150 rounded-full"
                            style={{ background: 'radial-gradient(circle, #F57C20, transparent 70%)' }}
                        />
                        <img src={aglLogo} alt="AGL" className="relative w-28 h-28 sm:w-32 sm:h-32 drop-shadow-2xl" />
                    </div>

                    <span className="block text-xs font-bold uppercase tracking-[0.3em] mb-4"
                        style={{ color: '#F57C20' }}
                    >
                        Albion Giants League
                    </span>
                    <h1 className="font-heading text-5xl sm:text-6xl lg:text-7xl font-black mb-5 leading-[1.1]">
                        <span className="block text-white drop-shadow-lg">A New Season</span>
                        <span className="block mt-1" style={{
                            background: 'linear-gradient(135deg, #FFB347, #F57C20, #E8941A)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            filter: 'drop-shadow(0 2px 8px rgba(245,124,32,0.4))',
                        }}>
                            Rises
                        </span>
                    </h1>
                    <p className="text-white/80 text-base sm:text-lg max-w-2xl mx-auto mb-4 leading-relaxed">
                        The battleground is set. Whether you're chasing glory or cold hard cash,
                        your next chapter starts here.
                    </p>
                    {/* Sponsor badge */}
                    <div
                        className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full border text-xs font-bold uppercase tracking-wider"
                        style={{
                            background: 'rgba(245,124,32,0.12)',
                            borderColor: 'rgba(245,124,32,0.3)',
                        }}
                    >
                        <svg className="w-4 h-4" fill="#F57C20" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                        <span style={{ color: '#FFB347' }}>Prize Pool Sponsored by Hi-Rez Studios</span>
                        <svg className="w-4 h-4" fill="#F57C20" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                    </div>

                    {/* Decorative diamonds flanking */}
                    <div className="hidden sm:block">
                        <img src={diamondsImg} alt="" className="absolute left-8 top-1/2 w-10 h-10 opacity-20 rotate-12"
                            style={{ animation: 'gem-float 4s ease-in-out infinite' }}
                        />
                        <img src={diamondsImg} alt="" className="absolute right-8 top-1/3 w-12 h-12 opacity-15 -rotate-12"
                            style={{ animation: 'gem-float 5s ease-in-out 1s infinite' }}
                        />
                        <img src={diamondsImg} alt="" className="absolute left-1/4 bottom-8 w-8 h-8 opacity-15 rotate-45"
                            style={{ animation: 'gem-float 3.5s ease-in-out 0.5s infinite' }}
                        />
                    </div>
                </div>
            </div>

            {/* Divider */}
            <div
                className="w-2/3 h-px mx-auto mb-12"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(245,124,32,0.4), transparent)' }}
            />

            {/* Toggle + Content */}
            <div className="max-w-4xl mx-auto px-4 pb-20">
                {/* Division Toggle */}
                <div className="flex justify-center mb-10">
                    <div className="inline-flex rounded-xl border border-white/10 p-1" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <button
                            onClick={() => setMode('kaiju')}
                            className="relative px-5 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer"
                            style={{
                                background: isKaiju ? 'linear-gradient(135deg, #F57C20, #E8941A)' : 'transparent',
                                color: isKaiju ? '#fff' : 'rgba(255,255,255,0.5)',
                                boxShadow: isKaiju ? '0 0 20px rgba(245,124,32,0.3)' : 'none',
                            }}
                        >
                            <span className="flex items-center gap-2">
                                <img src={deityImg} alt="" className="w-5 h-5" />
                                Cash Division (Kaiju)
                            </span>
                        </button>
                        <button
                            onClick={() => setMode('other')}
                            className="relative px-5 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer"
                            style={{
                                background: !isKaiju ? 'linear-gradient(135deg, #F57C20, #E8941A)' : 'transparent',
                                color: !isKaiju ? '#fff' : 'rgba(255,255,255,0.5)',
                                boxShadow: !isKaiju ? '0 0 20px rgba(245,124,32,0.3)' : 'none',
                            }}
                        >
                            <span className="flex items-center gap-2">
                                <img src={demigodImg} alt="" className="w-5 h-5" />
                                Other Divisions
                            </span>
                        </button>
                    </div>
                </div>

                {/* Tier Display */}
                {isKaiju ? <KaijuSection /> : <OtherTiersSection />}

                {/* Embed / Unlocking Soon */}
                <div className="mt-10">
                    {embedUrl ? (
                        <div
                            className="rounded-xl border border-white/10 overflow-hidden"
                            style={{ background: 'linear-gradient(135deg, var(--color-secondary), var(--color-primary))' }}
                        >
                            <iframe
                                src={embedUrl}
                                width="100%"
                                height="900"
                                frameBorder="0"
                                title={isKaiju ? 'Kaiju Division Signup' : 'Division Signup'}
                                className="w-full"
                                style={{ minHeight: 600 }}
                            >
                                Loading...
                            </iframe>
                        </div>
                    ) : (
                        <UnlockingSoon />
                    )}
                </div>
            </div>

            {/* Interactive 3D Coin Flip — corner */}
            <CornerCoin3D />

            <style>{`
                @keyframes gem-float {
                    0%, 100% { transform: translateY(0) rotate(var(--tw-rotate, 0deg)); }
                    50% { transform: translateY(-12px) rotate(var(--tw-rotate, 0deg)); }
                }
            `}</style>
        </div>
    )
}

/* ═══════════════════════════════════════════
   Diamond Rain — Canvas Background
   ═══════════════════════════════════════════ */
function DiamondRain() {
    const canvasRef = useRef(null)
    const particlesRef = useRef([])
    const imgRef = useRef(null)
    const rafRef = useRef(null)
    const visibleRef = useRef(true)
    const mouseRef = useRef({ x: -1, y: -1 })

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')

        let running = true
        let lastTick = 0
        const FRAME_INTERVAL = 33 // ~30fps for smoother mouse interaction

        const img = new Image()
        img.onload = () => {
            if (!running) return
            imgRef.current = img
            initParticles()
            rafRef.current = requestAnimationFrame(tick)
        }
        img.src = diamondsImg

        function resize() {
            const parent = canvas.parentElement
            canvas.width = parent.offsetWidth
            canvas.height = parent.offsetHeight
        }

        function initParticles() {
            resize()
            const count = Math.min(Math.floor(canvas.width / 30), 60) // denser field
            particlesRef.current = Array.from({ length: count }, () => createParticle(true, false))
        }

        function createParticle(randomY, fromMouse) {
            const mx = mouseRef.current.x
            const my = mouseRef.current.y

            if (fromMouse && mx >= 0) {
                // Burst from mouse — fly outward in a random direction
                const angle = Math.random() * Math.PI * 2
                const velocity = 2 + Math.random() * 4
                const size = 10 + Math.random() * 18
                return {
                    x: mx + (Math.random() - 0.5) * 10,
                    y: my + (Math.random() - 0.5) * 10,
                    size,
                    speed: Math.sin(angle) * velocity,
                    drift: Math.cos(angle) * velocity,
                    rotation: Math.random() * Math.PI * 2,
                    rotSpeed: (Math.random() - 0.5) * 0.08,
                    opacity: 0.15 + Math.random() * 0.2,
                    life: 1.0, // fades out over time
                    isBurst: true,
                }
            }

            const size = 14 + Math.random() * 26
            return {
                x: Math.random() * canvas.width,
                y: randomY ? -size - Math.random() * canvas.height * 1.5 : -size - Math.random() * 80,
                size,
                speed: 0.3 + Math.random() * 0.8,
                drift: (Math.random() - 0.5) * 0.3,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.015,
                opacity: 0.06 + Math.random() * 0.14,
                life: null,
                isBurst: false,
            }
        }

        // Mouse tracking
        function onMouseMove(e) {
            const rect = canvas.getBoundingClientRect()
            mouseRef.current.x = e.clientX - rect.left
            mouseRef.current.y = e.clientY - rect.top

            // Spawn burst diamonds on move
            const particles = particlesRef.current
            const burstCount = 2
            for (let i = 0; i < burstCount; i++) {
                if (particles.length < 200) { // cap total
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

        function tick(now) {
            if (!running) return
            rafRef.current = requestAnimationFrame(tick)

            if (!visibleRef.current) return
            if (now - lastTick < FRAME_INTERVAL) return
            lastTick = now

            ctx.clearRect(0, 0, canvas.width, canvas.height)
            const diamondImage = imgRef.current
            if (!diamondImage) return

            const particles = particlesRef.current
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i]

                p.y += p.speed
                p.x += p.drift
                p.rotation += p.rotSpeed

                if (p.isBurst) {
                    // Fade out + slow down
                    p.life -= 0.018
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

                ctx.save()
                ctx.globalAlpha = alpha
                ctx.translate(p.x, p.y)
                ctx.rotate(p.rotation)
                ctx.drawImage(diamondImage, -p.size / 2, -p.size / 2, p.size, p.size)
                ctx.restore()
            }
        }

        // Pause when hero is scrolled out of view
        const io = new IntersectionObserver(([entry]) => {
            visibleRef.current = entry.isIntersecting
        }, { threshold: 0 })
        io.observe(canvas.parentElement)

        const ro = new ResizeObserver(() => {
            resize()
        })
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
   Kaiju (Cash Division) Section
   ═══════════════════════════════════════════ */
function KaijuSection() {
    return (
        <div
            className="rounded-xl border p-6 sm:p-8 text-center relative overflow-hidden"
            style={{
                background: 'linear-gradient(135deg, rgba(245,124,32,0.08), rgba(245,124,32,0.02))',
                borderColor: 'rgba(245,124,32,0.25)',
            }}
        >
            {/* Corner glow */}
            <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-15 blur-3xl pointer-events-none"
                style={{ background: '#F57C20' }}
            />

            <img src={deityImg} alt="Deity" className="w-24 h-24 sm:w-28 sm:h-28 mx-auto mb-4 drop-shadow-lg" />
            <div className="text-xs font-bold uppercase tracking-[0.2em] mb-1" style={{ color: '#F57C20' }}>
                Cash Division
            </div>
            <h2 className="font-heading text-3xl sm:text-4xl font-black mb-3">
                Kaiju
            </h2>
            <p className="text-(--color-text-secondary)/70 text-sm max-w-lg mx-auto leading-relaxed">
                The highest tier of competitive play. Cash prizes on the line.
                Prove you belong among the best — only the fearless need apply.
            </p>

            {/* Tier badge */}
            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border"
                style={{ background: 'rgba(245,124,32,0.12)', borderColor: 'rgba(245,124,32,0.25)', color: '#FFB347' }}
            >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm0 2h14v2H5v-2z" />
                </svg>
                Deity Tier
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════
   Other Divisions Section
   ═══════════════════════════════════════════ */
function OtherTiersSection() {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {OTHER_DIVISIONS.map((div) => (
                <div
                    key={div.name}
                    className="rounded-xl border border-white/10 p-4 sm:p-5 text-center transition-all hover:border-white/20 hover:scale-[1.02]"
                    style={{ background: 'linear-gradient(135deg, var(--color-secondary), var(--color-primary))' }}
                >
                    <img src={div.img} alt={div.name} className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-3 drop-shadow-md" />
                    <div className="font-heading font-bold text-sm sm:text-base">{div.name}</div>
                </div>
            ))}
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
            {/* Padlock */}
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

            {/* Animated dots */}
            <div className="flex justify-center gap-1.5 mt-5">
                {[0, 1, 2].map((i) => (
                    <div
                        key={i}
                        className="w-2 h-2 rounded-full"
                        style={{
                            background: 'rgba(245,124,32,0.5)',
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
   Interactive 3D Coin Flip — Fixed Corner
   Adapted from CoinFlip.jsx 3D mode
   ═══════════════════════════════════════════ */
function CornerCoin3D() {
    const [flipping, setFlipping] = useState(false)
    const [lastResult, setLastResult] = useState(null) // 'heads' | 'tails'
    const [landing, setLanding] = useState(false)

    const coinInnerRef = useRef(null)
    const coinLiftRef = useRef(null)
    const coinShadowRef = useRef(null)
    const rotationRef = useRef(0)
    const spinRafRef = useRef(null)
    const spinStartRef = useRef(0)

    const startSpin = useCallback(() => {
        const inner = coinInnerRef.current
        const lift = coinLiftRef.current
        const shadow = coinShadowRef.current
        if (!inner || !lift) return

        inner.style.transition = 'none'
        lift.style.transition = 'none'
        void lift.offsetHeight

        lift.style.transition = 'transform 0.35s cubic-bezier(0.2, 0, 0, 1)'
        lift.style.transform = 'translateY(-40px) translateZ(180px)'
        if (shadow) {
            shadow.style.transition = 'all 0.35s cubic-bezier(0.2, 0, 0, 1)'
            shadow.style.opacity = '0.5'
            shadow.style.transform = 'scaleX(1.8) scaleY(1)'
        }

        spinStartRef.current = performance.now()
        const spin = (now) => {
            const elapsed = now - spinStartRef.current
            const accel = Math.min(elapsed / 300, 1)
            const speed = accel * 22
            rotationRef.current += speed
            inner.style.transform = `rotateX(${rotationRef.current}deg)`
            spinRafRef.current = requestAnimationFrame(spin)
        }
        spinRafRef.current = requestAnimationFrame(spin)
    }, [])

    const landOn = useCallback((result) => {
        cancelAnimationFrame(spinRafRef.current)
        const inner = coinInnerRef.current
        const lift = coinLiftRef.current
        const shadow = coinShadowRef.current
        if (!inner || !lift) return

        const current = rotationRef.current
        const minTarget = current + 720
        let target
        if (result === 'heads') {
            target = Math.ceil(minTarget / 360) * 360
        } else {
            target = Math.ceil((minTarget - 180) / 360) * 360 + 180
        }
        rotationRef.current = target
        setLanding(true)

        lift.style.transition = 'transform 0.65s cubic-bezier(0.2, 0, 0.3, 1)'
        lift.style.transform = 'translateY(0px) translateZ(0px)'
        if (shadow) {
            shadow.style.transition = 'all 0.65s cubic-bezier(0.2, 0, 0.3, 1)'
            shadow.style.opacity = '0.15'
            shadow.style.transform = 'scaleX(1) scaleY(0.5)'
        }

        inner.style.transition = 'transform 0.7s cubic-bezier(0.1, 0, 0.15, 1)'
        inner.style.transform = `rotateX(${target}deg)`

        setTimeout(() => {
            if (!lift) return
            lift.style.transition = 'transform 0.12s ease-out'
            lift.style.transform = 'translateY(-4px) translateZ(15px)'
            setTimeout(() => {
                lift.style.transition = 'transform 0.15s ease-in'
                lift.style.transform = 'translateY(0px) translateZ(0px)'
            }, 120)
        }, 600)

        setTimeout(() => setLanding(false), 800)
    }, [])

    const handleFlip = useCallback(() => {
        if (flipping || landing) return
        setFlipping(true)
        setLastResult(null)
        startSpin()

        // Random result after spin time
        const result = Math.random() > 0.5 ? 'heads' : 'tails'
        setTimeout(() => {
            landOn(result)
            setTimeout(() => {
                setFlipping(false)
                setLastResult(result)
            }, 700)
        }, 550)
    }, [flipping, landing, startSpin, landOn])

    useEffect(() => {
        return () => cancelAnimationFrame(spinRafRef.current)
    }, [])

    const glowColor = lastResult === 'heads' && !flipping && !landing
        ? 'rgba(74,222,128,0.4)' : lastResult === 'tails' && !flipping && !landing
            ? 'rgba(248,113,113,0.4)' : 'rgba(245,124,32,0.2)'

    return (
        <div className="fixed bottom-5 right-5 z-40 select-none">
            <button
                onClick={handleFlip}
                className="relative cursor-pointer group"
                title="Click to flip!"
                style={{ background: 'none', border: 'none', padding: 0 }}
            >
                {/* Glow ring */}
                <div className="absolute inset-0 rounded-full blur-xl opacity-0 group-hover:opacity-60 transition-opacity duration-300"
                    style={{ background: 'rgba(245,124,32,0.4)' }}
                />

                {/* 3D scene */}
                <div className="coin-corner-scene w-16 h-16 sm:w-20 sm:h-20"
                    style={{ animation: flipping || landing ? 'none' : 'corner-bob 3s ease-in-out infinite' }}
                >
                    <div ref={coinLiftRef} className="coin-corner-lift w-full h-full">
                        <div ref={coinInnerRef} className="coin-corner-inner w-full h-full">
                            {/* Front (heads) */}
                            <div className="coin-corner-face coin-corner-front">
                                <img src={passionCoin} alt="Heads"
                                    className="w-full h-full object-contain transition-[filter] duration-300"
                                    style={{ filter: `drop-shadow(0 0 10px ${glowColor})` }}
                                />
                            </div>
                            {/* Back (tails) */}
                            <div className="coin-corner-face coin-corner-back">
                                <img src={passionTails} alt="Tails"
                                    className="w-full h-full object-contain transition-[filter] duration-300"
                                    style={{ filter: `drop-shadow(0 0 10px ${glowColor})` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
                {/* Shadow */}
                <div ref={coinShadowRef} className="coin-corner-shadow mx-auto" />

                {/* Result label */}
                {lastResult && !flipping && !landing && (
                    <div className={`absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wider ${
                        lastResult === 'heads' ? 'text-green-400' : 'text-red-400'
                    }`} style={{ animation: 'corner-result-fade 2s ease-out forwards' }}>
                        {lastResult === 'heads' ? 'Heads!' : 'Tails!'}
                    </div>
                )}
            </button>

            <style>{`
                .coin-corner-scene {
                    perspective: 400px;
                    perspective-origin: 50% 50%;
                }
                .coin-corner-lift {
                    transform-style: preserve-3d;
                    transform: translateY(0) translateZ(0);
                }
                .coin-corner-inner {
                    position: relative;
                    transform-style: preserve-3d;
                    transform: rotateX(0deg);
                }
                .coin-corner-face {
                    position: absolute;
                    inset: 0;
                    backface-visibility: hidden;
                    -webkit-backface-visibility: hidden;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .coin-corner-front {}
                .coin-corner-back {
                    transform: rotateX(180deg);
                }
                .coin-corner-shadow {
                    width: 50px;
                    height: 8px;
                    margin-top: 4px;
                    border-radius: 50%;
                    background: radial-gradient(ellipse, rgba(245,124,32,0.12) 0%, transparent 70%);
                    opacity: 0.15;
                    transform: scaleX(1) scaleY(0.5);
                }
                @keyframes corner-bob {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-6px); }
                }
                @keyframes corner-result-fade {
                    0% { opacity: 1; transform: translateX(-50%) translateY(0); }
                    70% { opacity: 1; }
                    100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
                }
            `}</style>
        </div>
    )
}

import { useState, useEffect, useRef } from 'react'
import passionCoin from '../../assets/passion/passion.png'
import passionTilted from '../../assets/passion/passiontilted.png'
import passionTails from '../../assets/passion/passiontails.png'
import passionsplosion from '../../assets/passion/passionsplosion.png'

export function CoinBackground() {
    const coins = useRef([
        { bottom: '-10%', right: '-6%', size: 600, opacity: 0.04, rotate: -8, delay: 0 },
        { top: '5%', left: '-3%', size: 200, opacity: 0.02, rotate: 15, delay: 2 },
        { top: '35%', right: '2%', size: 140, opacity: 0.018, rotate: -20, delay: 4 },
        { bottom: '15%', left: '8%', size: 100, opacity: 0.015, rotate: 25, delay: 6 },
        { top: '60%', right: '15%', size: 90, opacity: 0.012, rotate: -12, delay: 3 },
        { top: '15%', right: '20%', size: 120, opacity: 0.015, rotate: 10, delay: 5 },
        { bottom: '30%', left: '25%', size: 80, opacity: 0.01, rotate: -30, delay: 7 },
    ]).current

    return (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden>
            {coins.map((c, i) => (
                <div key={i} className="absolute pred-coin-bg"
                    style={{
                        top: c.top, bottom: c.bottom, left: c.left, right: c.right,
                        width: c.size, height: c.size,
                        animationDelay: `${c.delay}s`,
                    }}>
                    <img src={passionTilted} alt=""
                        className="w-full h-full object-contain"
                        style={{ opacity: c.opacity, transform: `rotate(${c.rotate}deg)` }} />
                </div>
            ))}
        </div>
    )
}

export function FloatingParticles() {
    const particles = useRef(
        Array.from({ length: 14 }, (_, i) => ({
            id: i,
            left: Math.random() * 100,
            delay: Math.random() * 20,
            duration: 18 + Math.random() * 12,
            size: 2 + Math.random() * 2,
            opacity: 0.05 + Math.random() * 0.07,
        }))
    ).current

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
            {particles.map(p => (
                <div key={p.id}
                    className="absolute rounded-full pred-particle"
                    style={{
                        left: `${p.left}%`,
                        width: p.size,
                        height: p.size,
                        opacity: p.opacity,
                        background: 'rgba(248,197,106,0.6)',
                        boxShadow: '0 0 4px rgba(248,197,106,0.3)',
                        animationDelay: `${p.delay}s`,
                        animationDuration: `${p.duration}s`,
                    }}
                />
            ))}
        </div>
    )
}

export function CoinFlipOverlay({ open, onClose }) {
    const [result, setResult] = useState(null)
    const [showExplosion, setShowExplosion] = useState(false)
    const [phase, setPhase] = useState('idle') // idle | spinning | landing | done
    const coinInnerRef = useRef(null)
    const coinLiftRef = useRef(null)
    const coinShadowRef = useRef(null)
    const rotationRef = useRef(0)
    const spinRafRef = useRef(null)
    const spinStartRef = useRef(0)
    const closeTimerRef = useRef(null)

    // Auto-flip when opened
    useEffect(() => {
        if (!open) return
        setResult(null)
        setShowExplosion(false)
        setPhase('idle')
        rotationRef.current = 0

        // Delay so DOM mounts and 3D compositing layer is ready
        const t = setTimeout(() => startSpin(), 200)
        return () => { clearTimeout(t); cancelAnimationFrame(spinRafRef.current); clearTimeout(closeTimerRef.current) }
    }, [open])

    useEffect(() => () => { cancelAnimationFrame(spinRafRef.current); clearTimeout(closeTimerRef.current) }, [])

    const startSpin = () => {
        const inner = coinInnerRef.current
        const lift = coinLiftRef.current
        const shadow = coinShadowRef.current
        if (!inner || !lift) return

        setPhase('spinning')
        const outcome = Math.random() < 0.5 ? 'heads' : 'tails'

        // Reset
        inner.style.transition = 'none'
        lift.style.transition = 'none'
        void lift.offsetHeight

        // Launch up
        lift.style.transition = 'transform 0.35s cubic-bezier(0.2, 0, 0, 1)'
        lift.style.transform = 'translateY(-80px) translateZ(300px)'
        if (shadow) {
            shadow.style.transition = 'all 0.35s cubic-bezier(0.2, 0, 0, 1)'
            shadow.style.opacity = '0.5'
            shadow.style.transform = 'scaleX(2) scaleY(1)'
        }

        // Spin via rAF
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

        // Land after delay
        setTimeout(() => landOn(outcome), 600)
    }

    const landOn = (outcome) => {
        cancelAnimationFrame(spinRafRef.current)
        const inner = coinInnerRef.current
        const lift = coinLiftRef.current
        const shadow = coinShadowRef.current
        if (!inner || !lift) return

        setPhase('landing')
        const current = rotationRef.current
        const minTarget = current + 720
        let target
        if (outcome === 'heads') {
            target = Math.ceil(minTarget / 360) * 360
        } else {
            target = Math.ceil((minTarget - 180) / 360) * 360 + 180
        }
        rotationRef.current = target

        // Settle back
        lift.style.transition = 'transform 0.65s cubic-bezier(0.2, 0, 0.3, 1)'
        lift.style.transform = 'translateY(0px) translateZ(0px)'
        if (shadow) {
            shadow.style.transition = 'all 0.65s cubic-bezier(0.2, 0, 0.3, 1)'
            shadow.style.opacity = '0.15'
            shadow.style.transform = 'scaleX(1) scaleY(0.5)'
        }
        inner.style.transition = 'transform 0.7s cubic-bezier(0.1, 0, 0.15, 1)'
        inner.style.transform = `rotateX(${target}deg)`

        // Bounce
        setTimeout(() => {
            if (!lift) return
            lift.style.transition = 'transform 0.12s ease-out'
            lift.style.transform = 'translateY(-8px) translateZ(25px)'
            setTimeout(() => {
                lift.style.transition = 'transform 0.15s ease-in'
                lift.style.transform = 'translateY(0px) translateZ(0px)'
            }, 120)
        }, 600)

        // Reveal result
        setTimeout(() => {
            setResult(outcome)
            setPhase('done')
            setShowExplosion(true)
            setTimeout(() => setShowExplosion(false), 1200)
        }, 750)

        // Auto-dismiss
        closeTimerRef.current = setTimeout(() => onClose(), 2800)
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget && phase === 'done') onClose() }}
            style={{ background: 'rgba(0,0,0,0.92)' }}>

            <div className="flex flex-col items-center">
                <div className="relative mb-8">
                    {/* 3D Coin */}
                    <div className="pred-coin-3d-scene" style={{ width: 220, height: 220 }}>
                        <div ref={coinLiftRef} className="pred-coin-3d-lift" style={{ width: '100%', height: '100%' }}>
                            <div ref={coinInnerRef} className="pred-coin-3d-inner" style={{ width: '100%', height: '100%' }}>
                                <div className="pred-coin-3d-face">
                                    <img src={passionCoin} alt="Heads" className="w-full h-full object-contain drop-shadow-[0_0_30px_rgba(248,197,106,0.4)]" />
                                </div>
                                <div className="pred-coin-3d-back">
                                    <img src={passionTails} alt="Tails" className="w-full h-full object-contain drop-shadow-[0_0_30px_rgba(248,197,106,0.4)]" />
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Shadow */}
                    <div ref={coinShadowRef} className="mx-auto mt-2" style={{
                        width: 140, height: 16, borderRadius: '50%',
                        background: 'radial-gradient(ellipse, rgba(248,197,106,0.15) 0%, transparent 70%)',
                        opacity: 0.15, transform: 'scaleX(1) scaleY(0.5)',
                    }} />
                    {showExplosion && (
                        <img src={passionsplosion} alt="" className="absolute inset-0 w-full h-full object-contain pred-coinflip-explode pointer-events-none" />
                    )}
                </div>

                <div className="h-14 flex items-center justify-center">
                    {result && phase === 'done' && (
                        <div className={`text-4xl sm:text-5xl font-black uppercase tracking-wider pred-card-enter ${
                            result === 'heads' ? 'text-green-400' : 'text-red-400'
                        }`}>
                            {result === 'heads' ? 'Heads!' : 'Tails!'}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

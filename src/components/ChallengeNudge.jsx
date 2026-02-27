import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ChevronRight } from 'lucide-react'
import { usePassion } from '../context/PassionContext'
import { useAuth } from '../context/AuthContext'
import passionCoin from '../assets/passion/passion.png'
import passionTails from '../assets/passion/passiontails.png'

const DELAY_MS = 30_000
const SESSION_KEY = 'challenge-nudge-dismissed'

export default function ChallengeNudge() {
    const [open, setOpen] = useState(false)
    const [flipping, setFlipping] = useState(false)
    const modalRef = useRef(null)
    const coinInnerRef = useRef(null)
    const coinLiftRef = useRef(null)
    const coinShadowRef = useRef(null)
    const rotationRef = useRef(0)
    const spinRafRef = useRef(null)
    const spinStartRef = useRef(0)
    const navigate = useNavigate()
    const { user } = useAuth()
    const { balance, claimableCount, loading } = usePassion()

    useEffect(() => {
        if (loading || !user) return
        if (balance !== 0 || claimableCount === 0) return
        if (sessionStorage.getItem(SESSION_KEY)) return

        const timer = setTimeout(() => setOpen(true), DELAY_MS)
        return () => clearTimeout(timer)
    }, [loading, user, balance, claimableCount])

    // Allow manual trigger via custom event (debug tools)
    useEffect(() => {
        const handler = () => setOpen(true)
        window.addEventListener('open-challenge-nudge', handler)
        return () => window.removeEventListener('open-challenge-nudge', handler)
    }, [])

    // Close on click outside
    useEffect(() => {
        if (!open) return
        const handle = (e) => {
            if (modalRef.current && !modalRef.current.contains(e.target)) dismiss()
        }
        document.addEventListener('mousedown', handle)
        return () => document.removeEventListener('mousedown', handle)
    }, [open])

    // Close on escape
    useEffect(() => {
        if (!open) return
        const handle = (e) => { if (e.key === 'Escape') dismiss() }
        document.addEventListener('keydown', handle)
        return () => document.removeEventListener('keydown', handle)
    }, [open])

    // --- 3D flip ---
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
            rotationRef.current += accel * 22
            inner.style.transform = `rotateX(${rotationRef.current}deg)`
            spinRafRef.current = requestAnimationFrame(spin)
        }
        spinRafRef.current = requestAnimationFrame(spin)
    }, [])

    const landOnHeads = useCallback(() => {
        cancelAnimationFrame(spinRafRef.current)
        const inner = coinInnerRef.current
        const lift = coinLiftRef.current
        const shadow = coinShadowRef.current
        if (!inner || !lift) return

        const target = Math.ceil((rotationRef.current + 720) / 360) * 360
        rotationRef.current = target

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
            if (!coinLiftRef.current) return
            coinLiftRef.current.style.transition = 'transform 0.12s ease-out'
            coinLiftRef.current.style.transform = 'translateY(-6px) translateZ(20px)'
            setTimeout(() => {
                if (!coinLiftRef.current) return
                coinLiftRef.current.style.transition = 'transform 0.15s ease-in'
                coinLiftRef.current.style.transform = 'translateY(0px) translateZ(0px)'
            }, 120)
        }, 600)

        setTimeout(() => setFlipping(false), 800)
    }, [])

    const handleFlip = useCallback(() => {
        if (flipping) return
        setFlipping(true)
        startSpin()
        setTimeout(() => landOnHeads(), 800)
    }, [flipping, startSpin, landOnHeads])

    useEffect(() => () => cancelAnimationFrame(spinRafRef.current), [])

    const dismiss = useCallback(() => {
        sessionStorage.setItem(SESSION_KEY, '1')
        setOpen(false)
    }, [])

    const goToChallenges = useCallback(() => {
        dismiss()
        navigate('/challenges')
    }, [dismiss, navigate])

    if (!open) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <style>{`
                .nudge-3d-scene { perspective: 600px; perspective-origin: 50% 50%; }
                .nudge-3d-lift { transform-style: preserve-3d; transform: translateY(0) translateZ(0); }
                .nudge-3d-inner { position: relative; transform-style: preserve-3d; transform: rotateX(0deg); }
                .nudge-3d-face, .nudge-3d-back {
                    position: absolute; inset: 0;
                    backface-visibility: hidden; -webkit-backface-visibility: hidden;
                    display: flex; align-items: center; justify-content: center;
                }
                .nudge-3d-back { transform: rotateX(180deg); }
                @keyframes nudgeBorderPulse {
                    0%, 100% { border-color: rgba(248,197,106,0.15); box-shadow: 0 0 20px rgba(248,197,106,0.03); }
                    50% { border-color: rgba(248,197,106,0.4); box-shadow: 0 0 40px rgba(248,197,106,0.08); }
                }
                @keyframes nudgeShimmer {
                    0% { background-position: -200% center; }
                    100% { background-position: 200% center; }
                }
                @keyframes nudgeSlideUp {
                    0% { opacity: 0; transform: translateY(20px) scale(0.97); }
                    100% { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>

            <div
                ref={modalRef}
                className="relative w-full max-w-sm rounded-2xl border-2"
                style={{
                    animation: 'nudgeBorderPulse 3s ease-in-out infinite, nudgeSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
                }}
            >
                {/* Background layers — clipped to border radius */}
                <div className="absolute inset-0 rounded-2xl overflow-hidden">
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #0d1117 0%, #161b22 40%, #1a0f05 100%)' }} />
                    <div className="absolute inset-0 opacity-40" style={{ background: 'radial-gradient(ellipse at 30% 20%, rgba(248,197,106,0.1), transparent 60%)' }} />
                    <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(ellipse at 70% 80%, rgba(248,197,106,0.06), transparent 50%)' }} />
                    <div
                        className="absolute inset-0 opacity-[0.02]"
                        style={{ backgroundImage: 'linear-gradient(rgba(248,197,106,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(248,197,106,.12) 1px, transparent 1px)', backgroundSize: '40px 40px' }}
                    />
                    <div
                        className="absolute inset-0 pointer-events-none opacity-[0.035]"
                        style={{ background: 'linear-gradient(110deg, transparent 25%, rgba(248,197,106,0.4) 50%, transparent 75%)', backgroundSize: '200% 100%', animation: 'nudgeShimmer 4s ease-in-out infinite' }}
                    />
                </div>

                {/* Close button */}
                <button
                    onClick={dismiss}
                    className="absolute top-3 right-3 z-20 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                >
                    <X className="w-4 h-4 text-(--color-text-secondary)/60" />
                </button>

                {/* Content */}
                <div className="relative z-10 flex flex-col items-center text-center px-6 pt-8 pb-6">
                    {/* 3D Coin */}
                    <div className="relative mb-5 flex flex-col items-center">
                        <button
                            onClick={handleFlip}
                            className="relative cursor-pointer focus:outline-none group nudge-3d-scene"
                            aria-label="Flip Passion coin"
                        >
                            <div
                                className="absolute -inset-8 rounded-full opacity-20 group-hover:opacity-40 transition-opacity duration-500 pointer-events-none"
                                style={{ background: 'radial-gradient(circle, rgba(248,197,106,0.5), transparent 70%)' }}
                            />
                            <div
                                ref={coinLiftRef}
                                className="nudge-3d-lift w-20 h-20"
                            >
                                <div ref={coinInnerRef} className="nudge-3d-inner w-full h-full">
                                    <div className="nudge-3d-face">
                                        <img
                                            src={passionCoin}
                                            alt="Passion"
                                            className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(248,197,106,0.3)] group-hover:drop-shadow-[0_0_30px_rgba(248,197,106,0.5)] transition-[filter] duration-300"
                                        />
                                    </div>
                                    <div className="nudge-3d-back">
                                        <img
                                            src={passionTails}
                                            alt="Passion"
                                            className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(248,197,106,0.3)]"
                                        />
                                    </div>
                                </div>
                            </div>
                        </button>
                        <div
                            ref={coinShadowRef}
                            className="mt-1"
                            style={{
                                width: '80px', height: '10px', borderRadius: '50%',
                                background: 'radial-gradient(ellipse, rgba(248,197,106,0.15) 0%, transparent 70%)',
                                opacity: 0.15, transform: 'scaleX(1) scaleY(0.5)',
                            }}
                        />
                    </div>

                    {/* Badge */}
                    <span
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3"
                        style={{ background: 'rgba(248,197,106,0.12)', color: '#f8c56a' }}
                    >
                        {claimableCount} {claimableCount === 1 ? 'challenge' : 'challenges'} ready
                    </span>

                    {/* Title */}
                    <h2
                        className="font-heading text-2xl font-black tracking-tight bg-clip-text text-transparent mb-2"
                        style={{
                            WebkitBackgroundClip: 'text',
                            backgroundImage: 'linear-gradient(135deg, #f8c56a, #fde68a, #f8c56a)',
                            backgroundSize: '200% auto',
                            animation: 'nudgeShimmer 3s linear infinite',
                        }}
                    >
                        Passion Awaits
                    </h2>

                    {/* Body */}
                    <p className="text-sm text-(--color-text-secondary)/70 leading-relaxed max-w-xs mb-6">
                        You've got unclaimed rewards waiting. Collect your Passion and start climbing the ranks!
                    </p>

                    {/* CTA */}
                    <button
                        onClick={goToChallenges}
                        className="group inline-flex items-center gap-2 px-6 py-3 rounded-xl font-heading font-bold text-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-lg cursor-pointer"
                        style={{
                            background: 'linear-gradient(135deg, #c4922e, #f8c56a)',
                            color: '#0a0f1a',
                            boxShadow: '0 4px 20px rgba(248,197,106,0.2)',
                        }}
                    >
                        <img src={passionCoin} alt="" className="w-4 h-4" />
                        Claim Challenges
                        <ChevronRight className="w-4 h-4 opacity-60 group-hover:translate-x-0.5 transition-transform" />
                    </button>

                    {/* Dismiss link */}
                    <button
                        onClick={dismiss}
                        className="mt-3 text-xs text-(--color-text-secondary)/40 hover:text-(--color-text-secondary)/60 transition-colors"
                    >
                        Maybe later
                    </button>
                </div>
            </div>
        </div>
    )
}

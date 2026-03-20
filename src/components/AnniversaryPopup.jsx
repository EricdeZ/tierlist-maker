import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, PartyPopper } from 'lucide-react'

const STORAGE_KEY = 'anniversary-popup-dismissed'
const EXPIRY = new Date('2026-03-24T23:59:59').getTime()
const DELAY_MS = 2_000

export default function AnniversaryPopup() {
    const [open, setOpen] = useState(false)
    const modalRef = useRef(null)
    const navigate = useNavigate()

    useEffect(() => {
        if (Date.now() > EXPIRY) return
        if (localStorage.getItem(STORAGE_KEY)) return

        const timer = setTimeout(() => setOpen(true), DELAY_MS)
        return () => clearTimeout(timer)
    }, [])

    useEffect(() => {
        if (!open) return
        const handle = (e) => {
            if (modalRef.current && !modalRef.current.contains(e.target)) dismiss()
        }
        document.addEventListener('mousedown', handle)
        return () => document.removeEventListener('mousedown', handle)
    }, [open])

    useEffect(() => {
        if (!open) return
        const handle = (e) => { if (e.key === 'Escape') dismiss() }
        document.addEventListener('keydown', handle)
        return () => document.removeEventListener('keydown', handle)
    }, [open])

    function dismiss() {
        setOpen(false)
        localStorage.setItem(STORAGE_KEY, '1')
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" style={{ animation: 'annivFadeIn 0.3s ease-out' }} />

            <div
                ref={modalRef}
                className="relative w-full max-w-sm rounded-2xl border overflow-hidden"
                style={{
                    background: 'linear-gradient(160deg, #1a0a2e 0%, #0d0620 40%, #0a0818 100%)',
                    borderColor: 'rgba(168,85,247,0.3)',
                    boxShadow: '0 0 60px rgba(168,85,247,0.15), 0 0 120px rgba(234,179,8,0.05)',
                    animation: 'annivSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
            >
                {/* Top glow line */}
                <div className="absolute top-0 left-0 right-0 h-px" style={{
                    background: 'linear-gradient(90deg, transparent 10%, #a855f7 30%, #eab308 70%, transparent 90%)',
                }} />

                {/* Radial glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-40 opacity-20 blur-3xl pointer-events-none"
                    style={{ background: 'radial-gradient(ellipse, #a855f7, transparent 70%)' }}
                />

                {/* Close button */}
                <button
                    onClick={dismiss}
                    className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors cursor-pointer"
                >
                    <X className="w-4 h-4" />
                </button>

                <div className="relative px-6 pt-8 pb-6 text-center">
                    <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-purple-400/60 mb-4">
                        Celebrating
                    </div>

                    <div className="relative inline-block mb-4">
                        <div className="absolute inset-0 blur-2xl opacity-30 scale-150 rounded-full"
                            style={{ background: 'radial-gradient(circle, #eab308, transparent 70%)' }}
                        />
                        <PartyPopper className="relative w-14 h-14 text-yellow-400 drop-shadow-xl" />
                    </div>

                    <h3 className="font-heading text-2xl sm:text-3xl font-black text-white mb-2 leading-tight">
                        One Month of SmiteComp
                    </h3>
                    <p className="text-sm font-bold mb-4" style={{ color: '#c084fc' }}>
                        Thank you for being part of this journey
                    </p>

                    <div className="text-sm text-white/70 leading-relaxed mb-5">
                        <p>
                            See the stats, milestones, and highlights from our first month — including top players, most-played gods, and community records.
                        </p>
                    </div>

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => { dismiss(); navigate('/anniversary') }}
                            className="w-full px-6 py-3 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                            style={{
                                background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
                                boxShadow: '0 4px 24px rgba(168,85,247,0.3)',
                            }}
                        >
                            View the Anniversary Page
                        </button>
                        <button
                            onClick={dismiss}
                            className="text-xs text-white/30 hover:text-white/50 transition-colors cursor-pointer"
                        >
                            Maybe later
                        </button>
                    </div>
                </div>

                <div className="absolute inset-0 rounded-2xl p-px pointer-events-none" style={{
                    background: 'linear-gradient(135deg, #a855f7, #eab308, #a855f7, #7c3aed)',
                    mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    maskComposite: 'exclude',
                    WebkitMaskComposite: 'xor',
                    opacity: 0.2,
                    animation: 'annivBorderPulse 3s ease-in-out infinite',
                }} />
            </div>

            <style>{`
                @keyframes annivFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes annivSlideUp {
                    from { opacity: 0; transform: translateY(30px) scale(0.96); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes annivBorderPulse {
                    0%, 100% { opacity: 0.15; }
                    50% { opacity: 0.35; }
                }
            `}</style>
        </div>
    )
}

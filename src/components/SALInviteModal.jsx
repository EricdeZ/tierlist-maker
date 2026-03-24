import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import salLogo from '../assets/leagues/sal.png'

const SESSION_KEY = 'sal-invite-dismissed'
const DELAY_MS = 8_000

export default function SALInviteModal() {
    const [open, setOpen] = useState(false)
    const modalRef = useRef(null)
    const navigate = useNavigate()
    const { user, linkedPlayer } = useAuth()

    // Auto-show for tier 5 players (disabled — SAL is inactive)
    // useEffect(() => {
    //     if (!user || !linkedPlayer) return
    //     if (linkedPlayer.division_tier !== 5) return
    //     if (localStorage.getItem(SESSION_KEY)) return
    //
    //     const timer = setTimeout(() => setOpen(true), DELAY_MS)
    //     return () => clearTimeout(timer)
    // }, [user, linkedPlayer])

    // Manual trigger from debug tools
    useEffect(() => {
        const handler = () => setOpen(true)
        window.addEventListener('open-sal-invite', handler)
        return () => window.removeEventListener('open-sal-invite', handler)
    }, [])

    // Close on outside click
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

    function dismiss() {
        setOpen(false)
        localStorage.setItem(SESSION_KEY, '1')
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" style={{ animation: 'salFadeIn 0.3s ease-out' }} />

            {/* Modal */}
            <div
                ref={modalRef}
                className="relative w-full max-w-md rounded-2xl border overflow-hidden"
                style={{
                    background: 'linear-gradient(160deg, #0f1f08 0%, #0a1505 40%, #060d1a 100%)',
                    borderColor: 'rgba(113,156,58,0.3)',
                    boxShadow: '0 0 60px rgba(113,156,58,0.15), 0 0 120px rgba(113,156,58,0.05)',
                    animation: 'salSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
            >
                {/* Top glow line */}
                <div className="absolute top-0 left-0 right-0 h-px" style={{
                    background: 'linear-gradient(90deg, transparent 10%, #719c3a 50%, transparent 90%)',
                }} />

                {/* Radial glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-40 opacity-20 blur-3xl pointer-events-none"
                    style={{ background: 'radial-gradient(ellipse, #719c3a, transparent 70%)' }}
                />

                {/* Close button */}
                <button
                    onClick={dismiss}
                    className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors cursor-pointer"
                >
                    <X className="w-4 h-4" />
                </button>

                <div className="relative px-6 pt-8 pb-6 text-center">
                    {/* Invitation header */}
                    <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#719c3a]/60 mb-4">
                        You've been invited
                    </div>

                    {/* Logo */}
                    <div className="relative inline-block mb-4">
                        <div className="absolute inset-0 blur-2xl opacity-30 scale-150 rounded-full"
                            style={{ background: 'radial-gradient(circle, #719c3a, transparent 70%)' }}
                        />
                        <img src={salLogo} alt="SAL" className="relative w-20 h-20 drop-shadow-xl" />
                    </div>

                    {/* Title */}
                    <h3 className="font-heading text-2xl sm:text-3xl font-black text-white mb-2 leading-tight">
                        Serpent Ascension League
                    </h3>
                    <p className="text-sm font-bold mb-4" style={{ color: '#8fbf4a' }}>
                        Rise. Compete. Ascend.
                    </p>

                    {/* Body */}
                    <div className="text-sm text-white/70 leading-relaxed mb-5 space-y-3">
                        <p>
                            As a Tier 5 competitor, you're eligible to join the <span className="text-white font-semibold">Serpent Ascension League</span> — a
                            community-focused league designed to help lower-ranked players
                            grow, compete, and rise through the ranks.
                        </p>
                        <p>
                            Get coached by top mentors, play in organized matches, and be
                            part of a supportive community.
                        </p>
                    </div>

                    {/* Partnership badge */}
                    <div
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-semibold mb-6"
                        style={{
                            background: 'rgba(113,156,58,0.08)',
                            borderColor: 'rgba(113,156,58,0.2)',
                            color: 'rgba(255,255,255,0.6)',
                        }}
                    >
                        <span className="text-base">🤝</span>
                        Partnered with <span className="text-white font-bold">smitecomp.com</span>
                    </div>

                    {/* CTA buttons */}
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => { dismiss(); navigate('/sal/signup') }}
                            className="w-full px-6 py-3 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                            style={{
                                background: 'linear-gradient(135deg, #719c3a, #5a7d2e)',
                                boxShadow: '0 4px 24px rgba(113,156,58,0.3)',
                            }}
                        >
                            Sign Up Now
                        </button>
                        <a
                            href="https://discord.gg/7H6mqwtZq6"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
                            style={{
                                background: 'rgba(88,101,242,0.15)',
                                color: '#8b9eff',
                                border: '1px solid rgba(88,101,242,0.25)',
                            }}
                        >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z" />
                            </svg>
                            Join the Discord
                        </a>
                        <button
                            onClick={dismiss}
                            className="text-xs text-white/30 hover:text-white/50 transition-colors cursor-pointer"
                        >
                            Maybe later
                        </button>
                    </div>
                </div>

                {/* Animated border glow */}
                <div className="absolute inset-0 rounded-2xl p-px pointer-events-none" style={{
                    background: 'linear-gradient(135deg, #719c3a, #8fbf4a, #719c3a, #5a7d2e)',
                    mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    maskComposite: 'exclude',
                    WebkitMaskComposite: 'xor',
                    opacity: 0.2,
                    animation: 'salBorderPulse 3s ease-in-out infinite',
                }} />
            </div>

            <style>{`
                @keyframes salFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes salSlideUp {
                    from { opacity: 0; transform: translateY(30px) scale(0.96); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes salBorderPulse {
                    0%, 100% { opacity: 0.15; }
                    50% { opacity: 0.35; }
                }
            `}</style>
        </div>
    )
}

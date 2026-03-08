import { ChevronRight } from 'lucide-react'

const KEYFRAMES = `
    @keyframes fireFloat {
        0%, 100% { transform: translateY(0) scale(1); opacity: 1; }
        50% { transform: translateY(-12px) scale(1.15); opacity: 0.8; }
    }
    @keyframes fireFloat2 {
        0%, 100% { transform: translateY(0) scale(1.1); opacity: 0.9; }
        50% { transform: translateY(-18px) scale(0.95); opacity: 1; }
    }
    @keyframes fireFloat3 {
        0%, 100% { transform: translateY(-5px) scale(1); opacity: 0.85; }
        50% { transform: translateY(-22px) scale(1.2); opacity: 1; }
    }
    @keyframes passionGlow {
        0%, 100% { text-shadow: 0 0 20px rgba(248,197,106,0.3), 0 0 40px rgba(248,197,106,0.1); }
        50% { text-shadow: 0 0 40px rgba(248,197,106,0.7), 0 0 80px rgba(248,197,106,0.3), 0 0 120px rgba(248,197,106,0.15); }
    }
    @keyframes passionSlideUp1 {
        0% { opacity: 0; transform: translateY(30px); }
        20% { opacity: 1; transform: translateY(0); }
        100% { opacity: 1; transform: translateY(0); }
    }
    @keyframes passionSlideUp2 {
        0%, 25% { opacity: 0; transform: translateY(30px); }
        45% { opacity: 1; transform: translateY(0); }
        100% { opacity: 1; transform: translateY(0); }
    }
    @keyframes passionSlideUp3 {
        0%, 50% { opacity: 0; transform: translateY(30px); }
        70% { opacity: 1; transform: translateY(0); }
        100% { opacity: 1; transform: translateY(0); }
    }
    @keyframes ember {
        0% { transform: translateY(0) translateX(0) scale(1); opacity: 1; }
        100% { transform: translateY(-80px) translateX(20px) scale(0); opacity: 0; }
    }
    @keyframes ember2 {
        0% { transform: translateY(0) translateX(0) scale(1); opacity: 0.8; }
        100% { transform: translateY(-100px) translateX(-15px) scale(0); opacity: 0; }
    }
    @keyframes ember3 {
        0% { transform: translateY(0) translateX(0) scale(1); opacity: 0.9; }
        100% { transform: translateY(-60px) translateX(10px) scale(0); opacity: 0; }
    }
    @keyframes firePulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
    }
    @keyframes borderGlow {
        0%, 100% { border-color: rgba(248,197,106,0.3); box-shadow: 0 0 30px rgba(248,197,106,0.05), inset 0 0 30px rgba(248,197,106,0.02); }
        50% { border-color: rgba(248,197,106,0.6); box-shadow: 0 0 60px rgba(248,197,106,0.15), inset 0 0 60px rgba(248,197,106,0.05); }
    }
    @keyframes heatWave {
        0%, 100% { opacity: 0.15; transform: scaleY(1); }
        50% { opacity: 0.25; transform: scaleY(1.1); }
    }
`

const PassionCTA = ({ hasActiveLeagues }) => {
    return (
        <section className="py-24 px-4">
            <style>{KEYFRAMES}</style>
            <div className="max-w-4xl mx-auto">
                <div
                    className="rounded-3xl border-2 relative overflow-hidden"
                    style={{
                        background: 'linear-gradient(180deg, var(--color-secondary), var(--color-primary) 40%, #1a0800)',
                        animation: 'borderGlow 3s ease-in-out infinite',
                    }}
                >
                    {/* Layered fire background */}
                    <div
                        className="absolute inset-0 pointer-events-none"
                        style={{ background: 'radial-gradient(ellipse at 50% 110%, var(--color-accent), transparent 55%)', animation: 'heatWave 3s ease-in-out infinite' }}
                    />
                    <div
                        className="absolute inset-0 pointer-events-none opacity-30"
                        style={{ background: 'radial-gradient(ellipse at 50% 120%, #ef4444, transparent 50%)' }}
                    />
                    <div
                        className="absolute inset-0 pointer-events-none opacity-10"
                        style={{ background: 'radial-gradient(ellipse at 30% 100%, #f97316, transparent 40%)' }}
                    />
                    <div
                        className="absolute inset-0 pointer-events-none opacity-10"
                        style={{ background: 'radial-gradient(ellipse at 70% 100%, #f97316, transparent 40%)' }}
                    />
                    <div
                        className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 -mt-48 opacity-15 pointer-events-none"
                        style={{ background: 'radial-gradient(circle, var(--color-accent), transparent 60%)' }}
                    />

                    {/* Animated flame emojis */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        {/* Bottom row */}
                        <span className="absolute bottom-4 left-[5%] text-5xl" style={{ animation: 'fireFloat 2s ease-in-out infinite' }}>🔥</span>
                        <span className="absolute bottom-3 left-[12%] text-4xl" style={{ animation: 'fireFloat2 2.4s ease-in-out infinite 0.3s' }}>🔥</span>
                        <span className="absolute bottom-5 left-[20%] text-5xl" style={{ animation: 'fireFloat3 1.8s ease-in-out infinite 0.8s' }}>🔥</span>
                        <span className="absolute bottom-2 left-[28%] text-3xl" style={{ animation: 'fireFloat 2.6s ease-in-out infinite 0.5s' }}>🔥</span>
                        <span className="absolute bottom-4 left-[35%] text-6xl" style={{ animation: 'fireFloat2 2.1s ease-in-out infinite 0.2s' }}>🔥</span>
                        <span className="absolute bottom-3 left-[45%] text-6xl" style={{ animation: 'fireFloat 1.9s ease-in-out infinite 0.4s' }}>🔥</span>
                        <span className="absolute bottom-5 right-[35%] text-6xl" style={{ animation: 'fireFloat3 2.2s ease-in-out infinite 0.1s' }}>🔥</span>
                        <span className="absolute bottom-2 right-[28%] text-3xl" style={{ animation: 'fireFloat2 2.7s ease-in-out infinite 0.9s' }}>🔥</span>
                        <span className="absolute bottom-4 right-[20%] text-5xl" style={{ animation: 'fireFloat 2.3s ease-in-out infinite 0.6s' }}>🔥</span>
                        <span className="absolute bottom-3 right-[12%] text-4xl" style={{ animation: 'fireFloat3 2s ease-in-out infinite 1.1s' }}>🔥</span>
                        <span className="absolute bottom-5 right-[5%] text-5xl" style={{ animation: 'fireFloat2 2.5s ease-in-out infinite 0.7s' }}>🔥</span>

                        {/* Mid row */}
                        <span className="absolute bottom-16 left-[8%] text-3xl opacity-70" style={{ animation: 'fireFloat 3s ease-in-out infinite 1.2s' }}>🔥</span>
                        <span className="absolute bottom-20 left-[18%] text-2xl opacity-60" style={{ animation: 'fireFloat2 3.2s ease-in-out infinite 0.4s' }}>🔥</span>
                        <span className="absolute bottom-14 left-[30%] text-3xl opacity-70" style={{ animation: 'fireFloat3 2.8s ease-in-out infinite 1.5s' }}>🔥</span>
                        <span className="absolute bottom-18 right-[30%] text-3xl opacity-70" style={{ animation: 'fireFloat 2.9s ease-in-out infinite 0.8s' }}>🔥</span>
                        <span className="absolute bottom-20 right-[18%] text-2xl opacity-60" style={{ animation: 'fireFloat2 3.1s ease-in-out infinite 1.3s' }}>🔥</span>
                        <span className="absolute bottom-16 right-[8%] text-3xl opacity-70" style={{ animation: 'fireFloat3 3.3s ease-in-out infinite 0.6s' }}>🔥</span>

                        {/* Top accent */}
                        <span className="absolute top-8 left-[25%] text-xl opacity-30" style={{ animation: 'fireFloat 3.5s ease-in-out infinite 1.5s' }}>🔥</span>
                        <span className="absolute top-6 left-[45%] text-xl opacity-25" style={{ animation: 'fireFloat2 4s ease-in-out infinite 2s' }}>🔥</span>
                        <span className="absolute top-8 right-[25%] text-xl opacity-30" style={{ animation: 'fireFloat3 3.8s ease-in-out infinite 0.9s' }}>🔥</span>

                        {/* Embers */}
                        <span className="absolute bottom-24 left-[25%] w-2 h-2 rounded-full bg-(--color-accent)" style={{ animation: 'ember 2s ease-out infinite' }} />
                        <span className="absolute bottom-20 left-[40%] w-1.5 h-1.5 rounded-full bg-orange-400" style={{ animation: 'ember2 2.5s ease-out infinite 0.5s' }} />
                        <span className="absolute bottom-28 left-[55%] w-2 h-2 rounded-full bg-(--color-accent)" style={{ animation: 'ember3 1.8s ease-out infinite 1s' }} />
                        <span className="absolute bottom-16 right-[40%] w-1.5 h-1.5 rounded-full bg-orange-400" style={{ animation: 'ember 2.2s ease-out infinite 0.3s' }} />
                        <span className="absolute bottom-32 left-[35%] w-1 h-1 rounded-full bg-yellow-300" style={{ animation: 'ember2 3s ease-out infinite 1.4s' }} />
                        <span className="absolute bottom-24 right-[35%] w-1 h-1 rounded-full bg-yellow-300" style={{ animation: 'ember3 2.6s ease-out infinite 0.8s' }} />
                        <span className="absolute bottom-20 left-[15%] w-1.5 h-1.5 rounded-full bg-orange-300" style={{ animation: 'ember 1.9s ease-out infinite 0.6s' }} />
                        <span className="absolute bottom-26 right-[15%] w-1.5 h-1.5 rounded-full bg-orange-300" style={{ animation: 'ember2 2.3s ease-out infinite 1.1s' }} />
                        <span className="absolute bottom-18 left-[60%] w-1 h-1 rounded-full bg-yellow-200" style={{ animation: 'ember3 2.8s ease-out infinite 0.2s' }} />
                        <span className="absolute bottom-30 right-[25%] w-1 h-1 rounded-full bg-yellow-200" style={{ animation: 'ember 3.2s ease-out infinite 1.7s' }} />
                    </div>

                    {/* Content */}
                    <div className="relative z-10 p-12 sm:p-20 text-center">
                        <div className="space-y-4 mb-10">
                            <p
                                className="font-heading text-3xl sm:text-4xl font-black text-(--color-text) tracking-tight"
                                style={{ animation: 'passionSlideUp1 1.5s ease-out forwards, passionGlow 3s ease-in-out infinite 1.5s' }}
                            >
                                Passion never stops
                            </p>
                            <p
                                className="font-heading text-3xl sm:text-4xl font-black tracking-tight"
                                style={{
                                    animation: 'passionSlideUp2 1.5s ease-out forwards, passionGlow 3s ease-in-out infinite 2s',
                                    color: 'var(--color-accent)',
                                }}
                            >
                                Passion never dies
                            </p>
                            <p
                                className="font-heading text-4xl sm:text-6xl font-black tracking-tight pt-2"
                                style={{
                                    animation: 'passionSlideUp3 1.5s ease-out forwards, firePulse 2s ease-in-out infinite 2.5s',
                                    backgroundImage: 'linear-gradient(135deg, var(--color-accent), #fde68a, #f97316, #ef4444, var(--color-accent))',
                                    backgroundSize: '200% 200%',
                                    backgroundClip: 'text',
                                    WebkitBackgroundClip: 'text',
                                    color: 'transparent',
                                }}
                            >
                                Unlimited Passion
                            </p>
                        </div>

                        {hasActiveLeagues && (
                            <a
                                href="#leagues"
                                className="inline-flex items-center gap-2 px-10 py-4 rounded-xl font-heading font-bold text-lg text-(--color-primary) transition-all duration-300 hover:scale-[1.05] hover:shadow-2xl hover:shadow-(--color-accent)/30"
                                style={{ background: 'linear-gradient(135deg, var(--color-accent), #e5a84e)' }}
                            >
                                Get Started
                                <ChevronRight className="w-5 h-5" />
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </section>
    )
}

export default PassionCTA

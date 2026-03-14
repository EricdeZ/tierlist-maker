import { useState, useEffect } from 'react'

export default function Bill() {
    const [blink, setBlink] = useState(false)
    const [facing, setFacing] = useState(1)
    const [walkX, setWalkX] = useState(0)
    const [stepping, setStepping] = useState(false)
    const [pecking, setPecking] = useState(false)
    const [happy, setHappy] = useState(false)
    const [dancing, setDancing] = useState(false)

    // Blink randomly
    useEffect(() => {
        const loop = () => {
            const delay = 1800 + Math.random() * 3000
            const timeout = setTimeout(() => {
                setBlink(true)
                // Occasional double blink
                const double = Math.random() > 0.7
                setTimeout(() => {
                    setBlink(false)
                    if (double) {
                        setTimeout(() => setBlink(true), 150)
                        setTimeout(() => setBlink(false), 280)
                    }
                }, 100)
                loop()
            }, delay)
            return timeout
        }
        const t = loop()
        return () => clearTimeout(t)
    }, [])

    // Random waddle
    useEffect(() => {
        const loop = () => {
            const delay = 2500 + Math.random() * 4000
            const timeout = setTimeout(() => {
                const steps = 2 + Math.floor(Math.random() * 4)
                const dir = Math.random() > 0.5 ? 1 : -1
                const stepSize = 14 * dir
                setFacing(dir)
                setStepping(true)

                let i = 0
                const stepInterval = setInterval(() => {
                    setWalkX(prev => Math.max(-250, Math.min(250, prev + stepSize)))
                    i++
                    if (i >= steps) {
                        clearInterval(stepInterval)
                        setStepping(false)
                    }
                }, 280)

                loop()
            }, delay)
            return timeout
        }
        const t = loop()
        return () => clearTimeout(t)
    }, [])

    // Random peck
    useEffect(() => {
        const loop = () => {
            const delay = 6000 + Math.random() * 7000
            const timeout = setTimeout(() => {
                if (!stepping) {
                    setPecking(true)
                    setTimeout(() => setPecking(false), 500)
                }
                loop()
            }, delay)
            return timeout
        }
        const t = loop()
        return () => clearTimeout(t)
    }, [stepping])

    // Random happy moment
    useEffect(() => {
        const loop = () => {
            const delay = 8000 + Math.random() * 10000
            const timeout = setTimeout(() => {
                if (!stepping && !pecking) {
                    setHappy(true)
                    setTimeout(() => setHappy(false), 1200)
                }
                loop()
            }, delay)
            return timeout
        }
        const t = loop()
        return () => clearTimeout(t)
    }, [stepping, pecking])

    return (
        <div style={{
            background: '#1a1a1e',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            userSelect: 'none',
            cursor: 'default',
        }}>
            <style>{`
                @keyframes idle-bob {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    25% { transform: translateY(-5px) rotate(-1deg); }
                    75% { transform: translateY(-3px) rotate(1deg); }
                }
                @keyframes tuft-sway {
                    0%, 100% { transform: rotate(-6deg); }
                    50% { transform: rotate(6deg); }
                }
                @keyframes step-l {
                    0%, 100% { transform: rotate(0deg); }
                    50% { transform: rotate(-18deg); }
                }
                @keyframes step-r {
                    0%, 100% { transform: rotate(0deg); }
                    50% { transform: rotate(18deg); }
                }
                @keyframes shadow-bob {
                    0%, 100% { transform: scale(1, 1); opacity: 0.18; }
                    25% { transform: scale(0.95, 0.9); opacity: 0.14; }
                    75% { transform: scale(0.97, 0.95); opacity: 0.16; }
                }
                @keyframes peck-anim {
                    0%, 100% { transform: rotate(0deg); }
                    30%, 50% { transform: rotate(20deg); }
                    40% { transform: rotate(25deg); }
                }
                @keyframes happy-bounce {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    15% { transform: translateY(-18px) rotate(-3deg); }
                    30% { transform: translateY(0) rotate(0deg); }
                    45% { transform: translateY(-14px) rotate(3deg); }
                    60% { transform: translateY(0) rotate(0deg); }
                    75% { transform: translateY(-8px) rotate(-2deg); }
                    90% { transform: translateY(0) rotate(0deg); }
                }
                @keyframes blush-in {
                    0% { opacity: 0; }
                    30%, 80% { opacity: 1; }
                    100% { opacity: 0; }
                }
                @keyframes name-float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-3px); }
                }
                @keyframes dance {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    8% { transform: translateY(-20px) rotate(-8deg); }
                    16% { transform: translateY(0) rotate(5deg); }
                    24% { transform: translateY(-16px) rotate(10deg); }
                    32% { transform: translateY(0) rotate(-5deg); }
                    40% { transform: translateY(-22px) rotate(-12deg); }
                    48% { transform: translateY(0) rotate(8deg); }
                    56% { transform: translateY(-12px) rotate(14deg); }
                    64% { transform: translateY(0) rotate(-10deg); }
                    72% { transform: translateY(-18px) rotate(-6deg); }
                    80% { transform: translateY(0) rotate(12deg); }
                    88% { transform: translateY(-10px) rotate(-4deg); }
                    96% { transform: translateY(0) rotate(2deg); }
                }
                @keyframes dance-legs-l {
                    0%, 100% { transform: rotate(0deg); }
                    25% { transform: rotate(-30deg); }
                    50% { transform: rotate(10deg); }
                    75% { transform: rotate(-20deg); }
                }
                @keyframes dance-legs-r {
                    0%, 100% { transform: rotate(0deg); }
                    25% { transform: rotate(25deg); }
                    50% { transform: rotate(-15deg); }
                    75% { transform: rotate(30deg); }
                }
                @keyframes dance-wing {
                    0%, 100% { transform: rotate(0deg); }
                    20% { transform: rotate(-30deg); }
                    40% { transform: rotate(15deg); }
                    60% { transform: rotate(-25deg); }
                    80% { transform: rotate(20deg); }
                }
                @keyframes dance-tuft {
                    0%, 100% { transform: rotate(0deg); }
                    15% { transform: rotate(-20deg); }
                    35% { transform: rotate(25deg); }
                    55% { transform: rotate(-15deg); }
                    75% { transform: rotate(20deg); }
                }
                @keyframes note-float {
                    0% { opacity: 0; transform: translate(0, 0) rotate(0deg); }
                    15% { opacity: 1; }
                    100% { opacity: 0; transform: translate(var(--nx), -80px) rotate(var(--nr)); }
                }
                .dance-btn {
                    background: none;
                    border: 2px solid #f0b42955;
                    color: #f0b429;
                    padding: 10px 28px;
                    border-radius: 999px;
                    font-family: "Georgia", serif;
                    font-style: italic;
                    font-size: 1.1rem;
                    letter-spacing: 0.1em;
                    cursor: pointer;
                    transition: all 0.25s ease;
                    margin-top: 0.8rem;
                }
                .dance-btn:hover {
                    background: #f0b42918;
                    border-color: #f0b429aa;
                    transform: scale(1.05);
                }
                .dance-btn:active {
                    transform: scale(0.97);
                }
                .dance-btn.active {
                    background: #f0b42930;
                    border-color: #f0b429;
                    box-shadow: 0 0 20px #f0b42933;
                }
            `}</style>

            <svg
                viewBox="-160 -20 320 320"
                style={{
                    width: 'min(75vw, 420px)',
                    height: 'min(75vh, 420px)',
                    transform: `translateX(${walkX}px)`,
                    transition: 'transform 0.28s ease-in-out',
                }}
            >
                {/* Shadow */}
                <ellipse
                    cx="0" cy="268"
                    rx="50" ry="10"
                    fill="#000"
                    style={{ animation: 'shadow-bob 2s ease-in-out infinite', transformOrigin: '0 268px' }}
                />

                {/* Music notes when dancing */}
                {dancing && [0,1,2].map(i => (
                    <text
                        key={i}
                        x={-30 + i * 40}
                        y={60}
                        fontSize="24"
                        fill="#f0b429"
                        style={{
                            '--nx': `${-20 + i * 30}px`,
                            '--nr': `${-20 + i * 15}deg`,
                            animation: `note-float 1.8s ease-out infinite`,
                            animationDelay: `${i * 0.5}s`,
                        }}
                    >{['♪','♫','♩'][i]}</text>
                ))}

                {/* Main bird group */}
                <g style={{
                    animation: dancing
                        ? 'dance 1.6s ease-in-out infinite'
                        : happy
                            ? 'happy-bounce 1.2s ease-in-out'
                            : pecking
                                ? 'peck-anim 0.5s ease-in-out'
                                : 'idle-bob 2.5s ease-in-out infinite',
                    transformOrigin: '0 260px',
                }}>
                    <g transform={`scale(${facing}, 1)`}>

                        {/* Left leg */}
                        <g style={{
                            transformOrigin: '-16px 230px',
                            animation: dancing ? 'dance-legs-l 0.4s ease-in-out infinite' : stepping ? 'step-l 0.56s ease-in-out infinite' : 'none',
                        }}>
                            <line x1="-16" y1="218" x2="-22" y2="252" stroke="#d4940f" strokeWidth="4" strokeLinecap="round" />
                            <path d="M-22 252 L-34 258 M-22 252 L-28 262 M-22 252 L-16 260" stroke="#d4940f" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                        </g>
                        {/* Right leg */}
                        <g style={{
                            transformOrigin: '16px 230px',
                            animation: dancing ? 'dance-legs-r 0.4s ease-in-out infinite' : stepping ? 'step-r 0.56s ease-in-out infinite' : 'none',
                        }}>
                            <line x1="16" y1="218" x2="22" y2="252" stroke="#d4940f" strokeWidth="4" strokeLinecap="round" />
                            <path d="M22 252 L10 258 M22 252 L16 262 M22 252 L28 260" stroke="#d4940f" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                        </g>

                        {/* Body — soft chubby bean */}
                        <ellipse cx="0" cy="165" rx="58" ry="68" fill="#f0b429" />
                        {/* Body shading */}
                        <ellipse cx="8" cy="155" rx="40" ry="50" fill="#f5c84c" opacity="0.5" />

                        {/* Head — big round for cuteness */}
                        <circle cx="-8" cy="98" r="42" fill="#f0b429" />
                        {/* Head highlight */}
                        <circle cx="-2" cy="88" r="26" fill="#f5c84c" opacity="0.4" />

                        {/* Cheek blush — left */}
                        <ellipse cx="-35" cy="108" rx="10" ry="6" fill="#e87c5f" opacity={(happy || dancing) ? "0.6" : "0.25"}
                            style={(happy || dancing) ? { animation: 'blush-in 1.2s ease-in-out' } : {}}
                        />
                        {/* Cheek blush — right (back cheek, subtle) */}
                        <ellipse cx="18" cy="106" rx="8" ry="5" fill="#e87c5f" opacity={(happy || dancing) ? "0.4" : "0.15"}
                            style={(happy || dancing) ? { animation: 'blush-in 1.2s ease-in-out' } : {}}
                        />

                        {/* Beak — wide flat duck bill */}
                        <path
                            d="M-48 96 Q-78 90 -82 98 Q-78 108 -48 106 Z"
                            fill="#e8940f"
                        />
                        {/* Beak line */}
                        <path
                            d="M-50 101 Q-70 100 -78 100"
                            stroke="#d4820a"
                            strokeWidth="1.5"
                            fill="none"
                            strokeLinecap="round"
                        />

                        {/* Eyes */}
                        {blink ? (
                            <>
                                <path d="M-22 92 Q-18 96 -14 92" stroke="#3d2a0a" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                                <path d="M2 90 Q6 94 10 90" stroke="#3d2a0a" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                            </>
                        ) : (happy || dancing) ? (
                            <>
                                {/* Happy squint eyes */}
                                <path d="M-24 93 Q-18 87 -12 93" stroke="#3d2a0a" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                                <path d="M0 91 Q6 85 12 91" stroke="#3d2a0a" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                            </>
                        ) : (
                            <>
                                {/* Big round eyes with shine */}
                                <circle cx="-18" cy="90" r="6.5" fill="#3d2a0a" />
                                <circle cx="-20" cy="87" r="2.5" fill="white" />
                                <circle cx="-15" cy="91" r="1.2" fill="white" opacity="0.5" />
                                <circle cx="6" cy="88" r="6" fill="#3d2a0a" />
                                <circle cx="4" cy="85" r="2.3" fill="white" />
                                <circle cx="9" cy="89" r="1.1" fill="white" opacity="0.5" />
                            </>
                        )}

                        {/* Tuft — three little feathers */}
                        <g style={{
                            transformOrigin: '-8px 58px',
                            animation: dancing ? 'dance-tuft 0.5s ease-in-out infinite' : 'tuft-sway 1.8s ease-in-out infinite',
                        }}>
                            <path d="M-8 58 Q-14 38 -18 30" stroke="#e8a210" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                            <path d="M-8 58 Q-8 36 -6 28" stroke="#f0b429" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                            <path d="M-8 58 Q-2 40 2 32" stroke="#f5c84c" strokeWidth="3" strokeLinecap="round" fill="none" />
                            {/* Tiny balls at tips */}
                            <circle cx="-18" cy="30" r="3" fill="#e8a210" />
                            <circle cx="-6" cy="28" r="3.2" fill="#f0b429" />
                            <circle cx="2" cy="32" r="2.8" fill="#f5c84c" />
                        </g>

                        {/* Tiny wing hint */}
                        <g style={{
                            transformOrigin: '30px 155px',
                            animation: dancing ? 'dance-wing 0.4s ease-in-out infinite' : 'none',
                        }}>
                            <path
                                d="M 30 140 Q 52 135 55 155 Q 52 175 30 175"
                                fill="#e8a210"
                                opacity="0.6"
                            />
                        </g>
                    </g>
                </g>
            </svg>

            <p style={{
                color: '#f0b429',
                fontSize: '1.5rem',
                fontFamily: '"Georgia", serif',
                fontStyle: 'italic',
                letterSpacing: '0.12em',
                marginTop: '0.5rem',
                opacity: 0.7,
                animation: 'name-float 3s ease-in-out infinite',
            }}>
                bill
            </p>

            <button
                className={`dance-btn${dancing ? ' active' : ''}`}
                onClick={() => setDancing(d => !d)}
            >
                {dancing ? 'stop dancing' : 'dance, bill!'}
            </button>
        </div>
    )
}

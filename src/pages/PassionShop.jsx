import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePassion } from '../context/PassionContext'
import { formatRank } from '../config/ranks'
import RankBadge from '../components/RankBadge'
import PageTitle from '../components/PageTitle'
import Navbar from '../components/layout/Navbar'
import passionCoin from '../assets/passion/passion.png'
import passionRain from '../assets/passion/passionrain.jpg'

// ─── Shop Data ───────────────────────────────────────────────

const FEATURED = {
    id: 'featured-stream',
    name: 'Stream Spotlight',
    headline: 'Your stream. Front page. Live.',
    description: 'Get your Twitch or YouTube stream embedded directly on the smitecomp.com homepage for all visitors to see. Grow your audience while the community watches.',
    tier: 'legendary',
    tag: 'Most Popular',
    mockup: true,
}

const VAULT_ITEMS = [
    {
        id: 'fantasy-spot',
        name: 'Fantasy League Reservation',
        description: 'Lock in your spot for Season 1 of smitecomp.com Fantasy SMITE before public registration.',
        tier: 'mythic',
        tag: 'Limited Supply',
    },
    {
        id: 'animated-name',
        name: 'Animated Name',
        description: 'Shimmer, glow, rainbow, fire — your name, alive.',
        tier: 'legendary',
    },
    {
        id: 'daily-boost',
        name: 'Daily Passion Boost',
        description: '2x daily login rewards for an entire week. Stack the coins while the boost lasts.',
        tier: 'legendary',
        tag: 'Consumable',
    },
]

const COLLECTION_ITEMS = [
    {
        id: 'name-color',
        name: 'Name Color',
        description: 'Custom colored display name across the entire site.',
        tier: 'epic',
    },
    {
        id: 'exclusive-badge',
        name: 'Exclusive Badges',
        description: 'Limited profile badges released each season.',
        tier: 'epic',
    },
    {
        id: 'profile-border',
        name: 'Profile Border',
        description: 'Animated avatar frame — elemental, celestial, and more.',
        tier: 'epic',
    },
    {
        id: 'profile-title',
        name: 'Profile Title',
        description: 'A custom line under your name — "The Relentless", "God of Solo Lane", whatever you want.',
        tier: 'epic',
    },
    {
        id: 'tierlist-themes',
        name: 'Tier List Themes',
        description: 'Custom color schemes for your tier list exports. Fire, ice, cosmic, and more.',
        tier: 'epic',
    },
    {
        id: 'profile-banner',
        name: 'Profile Banner',
        description: 'Upload a custom banner for your profile page.',
        tier: 'rare',
    },
    {
        id: 'team-flair',
        name: 'Team Flair',
        description: 'Rep your squad with a flair badge next to your name.',
        tier: 'rare',
    },
    {
        id: 'coin-skins',
        name: 'Coinflip Skins',
        description: 'Different coin designs for the flip game. Gold, silver, holographic, and more.',
        tier: 'rare',
    },
    {
        id: 'streak-shield',
        name: 'Streak Shield',
        description: 'One-time use. Protects your daily login streak from breaking if you miss a day.',
        tier: 'rare',
        tag: 'Consumable',
    },
]

const TIERS = {
    rare:      { color: '#60a5fa', glow: 'rgba(96,165,250,0.35)',  bg: 'rgba(96,165,250,0.06)',  border: 'rgba(96,165,250,0.18)',  label: 'Rare' },
    epic:      { color: '#c084fc', glow: 'rgba(192,132,252,0.35)', bg: 'rgba(192,132,252,0.06)', border: 'rgba(192,132,252,0.18)', label: 'Epic' },
    legendary: { color: '#f8c56a', glow: 'rgba(248,197,106,0.40)', bg: 'rgba(248,197,106,0.06)', border: 'rgba(248,197,106,0.20)', label: 'Legendary' },
    mythic:    { color: '#fb7185', glow: 'rgba(251,113,133,0.40)', bg: 'rgba(251,113,133,0.06)', border: 'rgba(251,113,133,0.18)', label: 'Mythic' },
}

// ─── Floating Coins Background ──────────────────────────────

function FloatingCoins() {
    const coins = useRef(
        Array.from({ length: 14 }, (_, i) => ({
            id: i,
            left: Math.random() * 100,
            delay: Math.random() * 20,
            duration: 18 + Math.random() * 14,
            size: 12 + Math.random() * 20,
            opacity: 0.03 + Math.random() * 0.06,
        }))
    ).current

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
            {coins.map(c => (
                <img key={c.id} src={passionCoin} alt=""
                    className="absolute shop-coin-float"
                    style={{
                        left: `${c.left}%`,
                        width: c.size,
                        height: c.size,
                        opacity: c.opacity,
                        animationDelay: `${c.delay}s`,
                        animationDuration: `${c.duration}s`,
                    }}
                />
            ))}
        </div>
    )
}

// ─── Stream Mockup ──────────────────────────────────────────

function StreamMockup() {
    return (
        <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black/40 border border-white/[0.06]">
            {/* Fake stream UI */}
            <div className="absolute inset-0 flex flex-col">
                {/* Video area */}
                <div className="flex-1 relative">
                    <div className="absolute inset-0"
                        style={{
                            background: 'linear-gradient(135deg, #0a0f1a 0%, #1a1040 40%, #0d1929 100%)',
                        }}
                    />
                    {/* Fake game scene suggestion */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full mx-auto mb-3 flex items-center justify-center"
                                style={{ background: 'rgba(248,197,106,0.08)', border: '1px solid rgba(248,197,106,0.15)' }}>
                                <svg className="w-8 h-8 sm:w-10 sm:h-10" viewBox="0 0 24 24" fill="none" stroke="rgba(248,197,106,0.5)" strokeWidth="1.5">
                                    <polygon points="5 3 19 12 5 21 5 3" fill="rgba(248,197,106,0.15)" />
                                </svg>
                            </div>
                            <div className="text-[10px] sm:text-xs text-white/20 font-medium tracking-wider uppercase">Your Stream Here</div>
                        </div>
                    </div>
                    {/* LIVE badge */}
                    <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                        </span>
                        <span className="text-[9px] sm:text-[10px] font-bold text-red-400 uppercase tracking-wider">Live</span>
                    </div>
                    {/* Viewer count */}
                    <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 flex items-center gap-1 text-white/25">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></svg>
                        <span className="text-[9px] sm:text-[10px] font-medium">247</span>
                    </div>
                </div>
                {/* Bottom bar */}
                <div className="h-8 sm:h-10 bg-black/60 border-t border-white/[0.04] flex items-center px-2.5 sm:px-3 gap-2">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-purple-500/30 border border-purple-400/20 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <div className="h-2 w-20 sm:w-24 bg-white/10 rounded-full" />
                    </div>
                    <div className="h-2 w-12 sm:w-16 bg-white/[0.06] rounded-full" />
                </div>
            </div>
        </div>
    )
}

// ─── Item Card ──────────────────────────────────────────────

function ItemCard({ item, index, large }) {
    const t = TIERS[item.tier]
    const [hovered, setHovered] = useState(false)

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="group relative rounded-2xl transition-all duration-500 shop-card-enter"
            style={{
                animationDelay: `${index * 60}ms`,
                background: hovered
                    ? `linear-gradient(135deg, ${t.bg}, rgba(255,255,255,0.02))`
                    : 'rgba(255,255,255,0.02)',
                border: `1px solid ${hovered ? t.border : 'rgba(255,255,255,0.05)'}`,
                boxShadow: hovered ? `0 0 40px -10px ${t.glow}, inset 0 1px 0 rgba(255,255,255,0.05)` : 'inset 0 1px 0 rgba(255,255,255,0.03)',
            }}
        >
            {/* Shimmer on hover */}
            <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 shop-shimmer"
                    style={{ background: `linear-gradient(105deg, transparent 40%, ${t.glow} 50%, transparent 60%)` }}
                />
            </div>

            <div className={`relative ${large ? 'p-6 sm:p-8' : 'p-5 sm:p-6'}`}>
                {/* Tag */}
                {item.tag && (
                    <div className="absolute top-4 right-4 sm:top-5 sm:right-5">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
                            style={{ background: t.bg, color: t.color, border: `1px solid ${t.border}` }}>
                            {item.tag}
                        </span>
                    </div>
                )}

                {/* Tier dot + label */}
                <div className="flex items-center gap-2 mb-4">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.color, boxShadow: `0 0 6px ${t.glow}` }} />
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: t.color }}>{t.label}</span>
                </div>

                {/* Name */}
                <h3 className={`font-heading font-bold text-white mb-2 ${large ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg'}`}>
                    {item.name}
                </h3>

                {/* Description */}
                <p className={`text-white/40 leading-relaxed ${large ? 'text-sm' : 'text-xs sm:text-[13px]'}`}>
                    {item.description}
                </p>

                {/* Price */}
                <div className="flex items-center gap-2 mt-5">
                    <img src={passionCoin} alt="" className="w-4 h-4 opacity-30" />
                    <span className="text-xs font-medium text-white/25 tracking-wide">Price TBD</span>
                </div>
            </div>
        </div>
    )
}


// ─── Main Component ─────────────────────────────────────────

export default function PassionShop() {
    const { user, login } = useAuth()
    const { balance, rank, loading } = usePassion()
    const [entered, setEntered] = useState(false)

    useEffect(() => {
        requestAnimationFrame(() => setEntered(true))
    }, [])

    return (
        <div className="min-h-screen text-white" style={{ background: '#060a14' }}>
            <Navbar title="Passion Shop" />
            <PageTitle title="Passion Shop" description="Spend your Passion Coins in the SMITE 2 Companion shop. Unlock cosmetics and rewards." />

            {/* ═══ HERO ═══ */}
            <section className="relative min-h-[55vh] sm:min-h-[60vh] flex items-end overflow-hidden">
                {/* BG layers */}
                <div className="absolute inset-0">
                    {/* Rain texture — very subtle */}
                    <img src={passionRain} alt="" className="absolute inset-0 w-full h-full object-cover opacity-[0.04]" />
                    {/* Radial glow */}
                    <div className="absolute inset-0"
                        style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(248,197,106,0.07) 0%, transparent 70%)' }} />
                    {/* Vignette */}
                    <div className="absolute inset-0"
                        style={{ background: 'radial-gradient(ellipse 100% 100% at 50% 50%, transparent 50%, #060a14 100%)' }} />
                    {/* Bottom fade */}
                    <div className="absolute bottom-0 left-0 right-0 h-40"
                        style={{ background: 'linear-gradient(to top, #060a14, transparent)' }} />
                </div>

                <FloatingCoins />

                {/* Content */}
                <div className={`relative w-full max-w-6xl mx-auto px-4 sm:px-6 pb-12 sm:pb-16 pt-32 transition-all duration-1000 ${entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                    {/* Balance pill */}
                    {user && !loading && (
                        <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full mb-6"
                            style={{ background: 'rgba(248,197,106,0.06)', border: '1px solid rgba(248,197,106,0.12)' }}>
                            <RankBadge rank={rank} size="sm" />
                            <img src={passionCoin} alt="" className="w-4.5 h-4.5" />
                            <span className="text-sm font-bold tabular-nums" style={{ color: '#f8c56a' }}>{balance}</span>
                            <span className="text-xs text-white/30">available</span>
                        </div>
                    )}

                    <h1 className="font-heading font-black text-4xl sm:text-6xl lg:text-7xl tracking-tight leading-[0.95]">
                        <span className="block text-white/90">The</span>
                        <span className="block shop-gold-text">Vault</span>
                    </h1>
                    <p className="mt-4 text-white/35 text-sm sm:text-base max-w-md leading-relaxed">
                        Exclusive rewards earned through dedication. Prices are being forged — start earning now.
                    </p>

                    {/* CTA */}
                    {!user ? (
                        <div className="flex items-center gap-3 mt-6 px-5 py-4 rounded-xl max-w-md"
                            style={{ background: 'rgba(248,197,106,0.04)', border: '1px solid rgba(248,197,106,0.12)' }}>
                            <img src={passionCoin} alt="" className="w-8 h-8 shrink-0 opacity-60" />
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-white">Show your Passion!</p>
                                <p className="text-xs text-white/40">Log in to start earning and unlock the Vault</p>
                            </div>
                            <button
                                onClick={login}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs text-white transition-all hover:opacity-90 active:scale-95 cursor-pointer shrink-0"
                                style={{ backgroundColor: '#5865F2' }}
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                                </svg>
                                Log in
                            </button>
                        </div>
                    ) : (
                        <Link to="/challenges"
                            className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-lg text-sm font-bold transition-all hover:brightness-110 cursor-pointer"
                            style={{ background: 'linear-gradient(135deg, #c4922e, #f8c56a)', color: '#0a0f1a' }}>
                            <img src={passionCoin} alt="" className="w-4 h-4" />
                            Start Earning
                        </Link>
                    )}
                </div>
            </section>

            {/* ═══ FEATURED ═══ */}
            <section className="relative max-w-6xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20">
                <SectionLabel label="Featured" />

                <div className="rounded-2xl overflow-hidden transition-all duration-500"
                    style={{
                        background: 'linear-gradient(135deg, rgba(248,197,106,0.04), rgba(255,255,255,0.015))',
                        border: '1px solid rgba(248,197,106,0.12)',
                        boxShadow: '0 0 80px -20px rgba(248,197,106,0.08)',
                    }}>
                    {/* Shimmer overlay */}
                    <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                        <div className="absolute inset-0 shop-shimmer-slow"
                            style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(248,197,106,0.06) 50%, transparent 60%)' }}
                        />
                    </div>

                    <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-0">
                        {/* Left — info */}
                        <div className="p-6 sm:p-10 flex flex-col justify-center">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#f8c56a', boxShadow: '0 0 6px rgba(248,197,106,0.5)' }} />
                                <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: '#f8c56a' }}>Legendary</span>
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ml-2"
                                    style={{ background: 'rgba(248,197,106,0.08)', color: '#f8c56a', border: '1px solid rgba(248,197,106,0.15)' }}>
                                    Most Popular
                                </span>
                            </div>
                            <h2 className="font-heading font-black text-2xl sm:text-3xl lg:text-4xl text-white tracking-tight mb-2">
                                {FEATURED.name}
                            </h2>
                            <p className="text-white/50 text-sm sm:text-base italic mb-4">{FEATURED.headline}</p>
                            <p className="text-white/30 text-sm leading-relaxed max-w-md">{FEATURED.description}</p>

                            <div className="flex items-center gap-2 mt-8">
                                <img src={passionCoin} alt="" className="w-5 h-5 opacity-30" />
                                <span className="text-sm font-medium text-white/25 tracking-wide">Price TBD</span>
                            </div>
                        </div>

                        {/* Right — mockup */}
                        <div className="p-4 sm:p-6 lg:p-8 flex items-center">
                            <StreamMockup />
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══ THE VAULT — premium/limited items ═══ */}
            <section className="relative max-w-6xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20">
                <SectionLabel label="Limited Offerings" />

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {VAULT_ITEMS.map((item, i) => (
                        <ItemCard key={item.id} item={item} index={i} large />
                    ))}
                </div>
            </section>

            {/* ═══ COLLECTION — all other items ═══ */}
            <section className="relative max-w-6xl mx-auto px-4 sm:px-6 pb-20 sm:pb-28">
                <SectionLabel label="Collection" />

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    {COLLECTION_ITEMS.map((item, i) => (
                        <ItemCard key={item.id} item={item} index={i} />
                    ))}
                </div>
            </section>

            {/* ═══ BOTTOM CTA ═══ */}
            <section className="relative border-t border-white/[0.04]">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
                    <img src={passionCoin} alt="" className="w-12 h-12 mx-auto mb-5 opacity-15" />
                    <h3 className="font-heading font-bold text-xl sm:text-2xl text-white/80 mb-2">
                        Prices are being forged
                    </h3>
                    <p className="text-sm text-white/25 max-w-sm mx-auto mb-8">
                        Earn Passion through daily logins, challenges, and competing — so you're ready when the Vault opens.
                    </p>
                    <div className="flex items-center justify-center gap-3">
                        <Link to="/challenges"
                            className="px-6 py-3 rounded-xl text-sm font-bold transition-all hover:brightness-110 cursor-pointer"
                            style={{ background: 'linear-gradient(135deg, #c4922e, #f8c56a)', color: '#0a0f1a' }}>
                            Earn Passion
                        </Link>
                        <Link to="/leaderboard"
                            className="px-6 py-3 rounded-xl text-sm font-medium text-white/40 hover:text-white/60 transition-colors"
                            style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                            Leaderboard
                        </Link>
                    </div>
                </div>
            </section>

            {/* ═══ STYLES ═══ */}
            <style>{`
                .shop-gold-text {
                    background: linear-gradient(135deg, #d4a04a 0%, #f8c56a 30%, #ffe4a0 50%, #f8c56a 70%, #c4922e 100%);
                    background-size: 200% 100%;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    animation: shop-gold-shift 6s ease-in-out infinite;
                }

                @keyframes shop-gold-shift {
                    0%, 100% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                }

                .shop-coin-float {
                    animation: shop-float linear infinite;
                }

                @keyframes shop-float {
                    0% {
                        opacity: 0;
                        transform: translateY(100vh) rotate(0deg);
                    }
                    5% { opacity: var(--coin-opacity, 0.04); }
                    90% { opacity: var(--coin-opacity, 0.04); }
                    100% {
                        opacity: 0;
                        transform: translateY(-20vh) rotate(360deg);
                    }
                }

                .shop-card-enter {
                    animation: shop-card-in 0.6s ease-out both;
                }

                @keyframes shop-card-in {
                    0% { opacity: 0; transform: translateY(20px); }
                    100% { opacity: 1; transform: translateY(0); }
                }

                .shop-shimmer {
                    animation: shop-shimmer-move 2s ease-in-out;
                }

                .shop-shimmer-slow {
                    animation: shop-shimmer-move 4s ease-in-out infinite;
                    animation-delay: 1s;
                }

                @keyframes shop-shimmer-move {
                    0% { transform: translateX(-100%) skewX(-15deg); }
                    100% { transform: translateX(300%) skewX(-15deg); }
                }
            `}</style>
        </div>
    )
}


// ─── Section Label ──────────────────────────────────────────

function SectionLabel({ label }) {
    return (
        <div className="flex items-center gap-4 mb-6">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/25">{label}</h2>
            <div className="flex-1 h-px bg-white/[0.04]" />
        </div>
    )
}

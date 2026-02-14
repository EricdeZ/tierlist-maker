// src/pages/Homepage.jsx
import { useEffect, useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { leagueService } from '../services/database'
import { useAuth } from '../context/AuthContext'
import { Trophy, BarChart3, Calendar, Swords, ChevronRight, MessageCircle, Mic, Video, Gamepad2, User, ListOrdered, Shield } from 'lucide-react'
import smiteLogo from '../assets/smite2.png'
import statsheetImg from '../assets/statsheet.png'

// League logos
import aglLogo from '../assets/leagues/agl.png'
import babylonLogo from '../assets/leagues/babylon.png'
import oslLogo from '../assets/leagues/osl.png'

import { getDivisionImage, RANK_LABELS, ALL_RANK_IMAGES } from '../utils/divisionImages'
import ChallengeBanner from '../components/ChallengeBanner'

const LEAGUE_LOGOS = {
    'agl': aglLogo,
    'albion-giants-league': aglLogo,
    'bsl': babylonLogo,
    'babylon-smite-league': babylonLogo,
    'osl': oslLogo,
    'olympian-smite-league': oslLogo,
}

const DiscordIcon = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
    </svg>
)

const Homepage = () => {
    const { user, linkedPlayer, login, loading: authLoading, hasAnyPermission } = useAuth()
    const canPreview = hasAnyPermission
    const [leagues, setLeagues] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    // Subtle interactive effects for hero section — one cursor drives everything
    const heroRef = useRef(null)
    const [heroLight, setHeroLight] = useState({ x: 50, y: 50, active: false })

    const handleHeroMove = useCallback((e) => {
        const el = heroRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        setHeroLight({
            x: ((e.clientX - rect.left) / rect.width) * 100,
            y: ((e.clientY - rect.top) / rect.height) * 100,
            active: true,
        })
    }, [])
    const handleHeroLeave = useCallback(() => {
        setHeroLight(prev => ({ ...prev, active: false }))
    }, [])

    // Derive sheet tilt from hero cursor — very subtle
    const sheetRy = heroLight.active ? -4 + (heroLight.x / 100 - 0.5) * 3 : -4   // base -4 ± 1.5deg
    const sheetRx = heroLight.active ? 2 + (0.5 - heroLight.y / 100) * 2 : 2     // base  2 ± 1deg

    useEffect(() => {
        let cancelled = false

        const loadLeagues = async () => {
            try {
                const allLeagues = await leagueService.getAll()
                if (cancelled) return

                const detailed = await Promise.all(
                    allLeagues.map(l => leagueService.getBySlug(l.slug))
                )
                if (cancelled) return
                setLeagues(detailed)
            } catch (err) {
                if (!cancelled) setError(err.message)
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        loadLeagues()
        return () => { cancelled = true }
    }, [])

    const mainLeagues = [...leagues]
        .filter(l => l.name?.toLowerCase() !== 'test league')
        .sort((a, b) => {
            const aActive = a.divisions?.some(d => d.seasons?.some(s => s.is_active || canPreview)) ? 0 : 1
            const bActive = b.divisions?.some(d => d.seasons?.some(s => s.is_active || canPreview)) ? 0 : 1
            return aActive - bActive
        })
    const hasActiveLeagues = mainLeagues.some(l =>
        l.divisions?.some(d => d.seasons?.some(s => s.is_active || canPreview))
    )

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <img src={smiteLogo} alt="" className="h-16 w-auto mx-auto mb-6 animate-pulse" />
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-(--color-accent) border-t-transparent mx-auto" />
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4">
                <div className="bg-red-900/20 border border-red-500/30 rounded-2xl p-10 text-center max-w-md backdrop-blur-sm">
                    <div className="text-5xl mb-4">⚠️</div>
                    <h2 className="text-2xl font-bold text-red-400 mb-3 font-heading">Connection Error</h2>
                    <p className="text-red-300/80">{error}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen overflow-hidden">

            {/* Keyframe styles */}
            <style>{`
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
            `}</style>

            {/* ─── HERO SECTION ─── */}
            <section
                ref={heroRef}
                onMouseMove={handleHeroMove}
                onMouseLeave={handleHeroLeave}
                className="relative min-h-[85vh] flex items-center px-4 py-20 overflow-hidden"
            >
                {/* Background effects */}
                <div className="absolute inset-0 overflow-hidden">
                    <div
                        className="absolute top-1/3 left-1/3 w-[800px] h-[800px] rounded-full opacity-15"
                        style={{ background: 'radial-gradient(circle, var(--color-accent) 0%, transparent 70%)' }}
                    />
                    <div
                        className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-8"
                        style={{ background: 'radial-gradient(circle, var(--color-accent) 0%, transparent 60%)' }}
                    />
                    <div
                        className="absolute inset-0 opacity-[0.03]"
                        style={{
                            backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
                            backgroundSize: '60px 60px'
                        }}
                    />
                    <div
                        className="absolute top-0 left-1/4 w-px h-full opacity-10 rotate-12 origin-top"
                        style={{ background: 'linear-gradient(to bottom, transparent, var(--color-accent), transparent)' }}
                    />
                    <div
                        className="absolute top-0 right-1/3 w-px h-full opacity-5 -rotate-6 origin-top"
                        style={{ background: 'linear-gradient(to bottom, transparent, var(--color-accent), transparent)' }}
                    />
                </div>

                <div className="relative z-10 max-w-7xl mx-auto w-full">

                    {/* Text content */}
                    <div className="text-center lg:text-left lg:max-w-[44%] relative z-20">
                        <div className="flex items-center gap-3 mb-6 justify-center lg:justify-start">
                            <img src={smiteLogo} alt="SMITE 2" className="h-12 sm:h-14 w-auto drop-shadow-2xl" />
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-(--color-accent)/30 bg-(--color-accent)/5">
                                <span className="w-1.5 h-1.5 rounded-full bg-(--color-accent) animate-pulse" />
                                <span className="text-xs font-semibold text-(--color-accent) uppercase tracking-wider">Community-Driven Competitive</span>
                            </div>
                        </div>

                        <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-black mb-5 leading-[1.1] tracking-tight">
                            <span
                                className="bg-clip-text text-transparent"
                                style={{
                                    WebkitBackgroundClip: 'text',
                                    backgroundImage: heroLight.active
                                        ? `radial-gradient(circle 300px at ${heroLight.x}% ${heroLight.y}%, rgba(255,255,255,1), rgba(255,255,255,0.55) 50%, rgba(255,255,255,0.55))`
                                        : 'linear-gradient(to right, rgba(255,255,255,0.55), rgba(255,255,255,0.55))',
                                }}
                            >
                                The Battleground{' '}
                            </span>
                            <span className="relative inline-block">
                                <span
                                    className="bg-clip-text text-transparent"
                                    style={{
                                        WebkitBackgroundClip: 'text',
                                        backgroundImage: heroLight.active
                                            ? `radial-gradient(circle 300px at ${heroLight.x}% ${heroLight.y}%, #ffffff, transparent 55%), linear-gradient(135deg, var(--color-accent), #fde68a, var(--color-accent))`
                                            : 'linear-gradient(135deg, var(--color-accent), #fde68a, var(--color-accent))',
                                    }}
                                >
                                    Lives On
                                </span>
                                <span
                                    className="absolute -bottom-1 left-0 right-0 h-1 rounded-full"
                                    style={{ background: 'linear-gradient(90deg, transparent, var(--color-accent), transparent)' }}
                                />
                            </span>
                        </h1>

                        <p className="text-base sm:text-lg text-(--color-text-secondary) max-w-lg mb-8 leading-relaxed mx-auto lg:mx-0">
                            Stats, standings, and tools for the community leagues keeping SMITE 2 esports alive. Find your league and jump in.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                            <a
                                href="#leagues"
                                className="group relative inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-heading font-bold text-lg overflow-hidden transition-all duration-300 hover:scale-[1.03] hover:shadow-lg hover:shadow-(--color-accent)/20"
                                style={{ background: 'linear-gradient(135deg, var(--color-accent), #e5a84e)' }}
                            >
                                <span className="relative z-10 text-(--color-primary)">Explore Leagues</span>
                            </a>
                            <a
                                href="#about"
                                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-heading font-bold text-base border border-white/10 text-(--color-text-secondary) hover:border-white/25 hover:text-(--color-text) transition-all duration-300"
                            >
                                Learn More
                            </a>
                        </div>
                    </div>

                    {/* Screenshot — stacks on mobile, floats freely on desktop */}
                    <div
                        className="relative mt-10 lg:mt-0 lg:absolute lg:right-[-8%] lg:top-1/2 lg:-translate-y-[46%] lg:w-[60%] z-10"
                        style={{ perspective: '1200px' }}
                    >
                        {/* Glow behind */}
                        <div
                            className="absolute -inset-8 rounded-3xl opacity-25 blur-3xl"
                            style={{ background: 'radial-gradient(ellipse at 60% 40%, var(--color-accent), transparent 65%)' }}
                        />
                        <div
                            className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/60 lg:rounded-xl"
                            style={{
                                transform: `rotateY(${sheetRy}deg) rotateX(${sheetRx}deg)`,
                                transition: 'transform 0.4s ease-out',
                            }}
                        >
                            <img
                                src={statsheetImg}
                                alt="Player stats dashboard"
                                className="w-full h-auto block"
                            />
                            {/* Cursor light reflection */}
                            <div
                                className="absolute inset-0 pointer-events-none transition-opacity duration-500"
                                style={{
                                    background: `radial-gradient(circle at ${heroLight.x}% ${heroLight.y}%, rgba(255,255,255,0.04), transparent 50%)`,
                                    opacity: heroLight.active ? 1 : 0,
                                }}
                            />
                            {/* Bottom fade */}
                            <div
                                className="absolute inset-0 pointer-events-none"
                                style={{ background: 'linear-gradient(to bottom, transparent 55%, var(--color-primary) 100%)' }}
                            />
                            {/* Left fade — blends into text on desktop */}
                            <div
                                className="absolute inset-0 pointer-events-none hidden lg:block"
                                style={{ background: 'linear-gradient(to right, var(--color-primary), transparent 20%)' }}
                            />
                            {/* Right fade — bleeds off screen edge */}
                            <div
                                className="absolute inset-0 pointer-events-none"
                                style={{ background: 'linear-gradient(to left, var(--color-primary), transparent 3%)' }}
                            />
                            {/* Top shine */}
                            <div
                                className="absolute top-0 left-0 right-0 h-px"
                                style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)' }}
                            />
                        </div>
                    </div>

                </div>
            </section>

            {/* ─── LEAGUES SECTION ─── */}
            <section id="leagues" className="py-20 px-4">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-14">
                        <span className="text-sm font-bold text-(--color-accent) uppercase tracking-widest mb-3 block">Competition</span>
                        <h2 className="font-heading text-3xl sm:text-4xl font-black text-(--color-text)">
                            Choose Your League
                        </h2>
                    </div>

                    <div className="space-y-16">
                        {mainLeagues.map(league => {
                            const divisions = league.divisions || []
                            const logo = LEAGUE_LOGOS[league.slug]
                            const leagueColor = league.color || 'var(--color-accent)'
                            const isActive = divisions.some(d => d.seasons?.some(s => s.is_active || canPreview))

                            return (
                                <div key={league.id} id={`league-${league.slug}`}>
                                    <div className="flex items-center gap-4 mb-6">
                                        {logo ? (
                                            <img src={logo} alt="" className={`h-12 w-12 object-contain rounded-lg ${!isActive ? 'opacity-40' : ''}`} />
                                        ) : (
                                            <div className={`h-12 w-12 rounded-lg bg-white/5 flex items-center justify-center ${!isActive ? 'opacity-40' : ''}`}>
                                                <Trophy className="w-6 h-6" style={{ color: leagueColor }} />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 flex-wrap">
                                                {isActive ? (
                                                    <Link
                                                        to={`/${league.slug}`}
                                                        className="font-heading text-2xl font-bold text-(--color-text) hover:text-(--color-accent) transition-colors"
                                                    >
                                                        {league.name}
                                                    </Link>
                                                ) : (
                                                    <h3 className="font-heading text-2xl font-bold text-(--color-text)/40">
                                                        {league.name}
                                                    </h3>
                                                )}
                                                {isActive ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider" style={{ backgroundColor: `${leagueColor}15`, color: leagueColor, border: `1px solid ${leagueColor}25` }}>
                                                        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: leagueColor }} />
                                                        Live
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider" style={{ backgroundColor: `${leagueColor}10`, color: `${leagueColor}90`, border: `1px solid ${leagueColor}15` }}>
                                                        Not Tracked
                                                    </span>
                                                )}
                                            </div>
                                            {league.description && league.description !== league.name && (
                                                <p className={`text-sm ${isActive ? 'text-(--color-text-secondary)' : 'text-(--color-text-secondary)/40'}`}>
                                                    {league.description}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {league.discord_url && (
                                                <a
                                                    href={league.discord_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors ${isActive ? 'bg-[#5865F2] hover:bg-[#4752C4]' : 'bg-[#5865F2]/50 hover:bg-[#5865F2]/70'}`}
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    <MessageCircle className="w-3.5 h-3.5" />
                                                    <span className="hidden sm:inline">Discord</span>
                                                </a>
                                            )}
                                            {isActive && (
                                                <Link
                                                    to={`/${league.slug}`}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-(--color-text-secondary) hover:text-(--color-text) border border-white/10 hover:border-white/20 transition-colors"
                                                >
                                                    View League
                                                    <ChevronRight className="w-3.5 h-3.5" />
                                                </Link>
                                            )}
                                        </div>
                                    </div>

                                    {divisions.length > 0 && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {divisions.map(division => {
                                                const rankImg = getDivisionImage(league.slug, division.slug, division.tier)
                                                const rankLabel = RANK_LABELS[division.tier]
                                                const activeSeason = division.seasons?.find(s => s.is_active || canPreview)
                                                const divActive = !!activeSeason

                                                if (divActive) {
                                                    return (
                                                        <Link
                                                            key={division.id}
                                                            to={`/${league.slug}/${division.slug}`}
                                                            className="group relative overflow-hidden rounded-xl border border-white/10 hover:border-white/20 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                                                            style={{ background: 'linear-gradient(135deg, var(--color-secondary), var(--color-primary))' }}
                                                        >
                                                            <div
                                                                className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                style={{ background: `linear-gradient(90deg, transparent, ${leagueColor}, transparent)` }}
                                                            />
                                                            <div className="p-5">
                                                                <div className="flex items-center gap-3 mb-3">
                                                                    {rankImg && (
                                                                        <img src={rankImg} alt={rankLabel} className="h-10 w-10 object-contain" />
                                                                    )}
                                                                    <div className="flex-1 min-w-0">
                                                                        <h4 className="font-heading text-lg font-bold text-(--color-text) group-hover:text-(--color-accent) transition-colors truncate">
                                                                            {division.name}
                                                                        </h4>
                                                                        {rankLabel && (
                                                                            <span className="text-xs text-(--color-text-secondary) uppercase tracking-wider">
                                                                                {rankLabel} Tier
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <ChevronRight className="w-5 h-5 text-(--color-text-secondary) group-hover:translate-x-1 transition-all shrink-0" />
                                                                </div>

                                                                <div className="flex items-center gap-1.5 text-sm text-(--color-text-secondary)">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                                                                    {activeSeason.name}
                                                                </div>
                                                            </div>
                                                        </Link>
                                                    )
                                                }

                                                return (
                                                    <div
                                                        key={division.id}
                                                        className="rounded-xl border border-white/5 bg-(--color-secondary)/50 p-5 opacity-35"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            {rankImg && (
                                                                <img src={rankImg} alt={rankLabel} className="h-10 w-10 object-contain" />
                                                            )}
                                                            <div className="flex-1 min-w-0">
                                                                <h4 className="font-heading text-lg font-bold text-(--color-text) truncate">
                                                                    {division.name}
                                                                </h4>
                                                                {rankLabel && (
                                                                    <span className="text-xs text-(--color-text-secondary) uppercase tracking-wider">
                                                                        {rankLabel} Tier
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </section>

            {/* ─── TOOLS & PROFILE ─── */}
            <section className="py-20 px-4">
                <div
                    className="w-2/3 h-px mx-auto mb-20"
                    style={{ background: 'linear-gradient(90deg, transparent, var(--color-accent)/0.3, transparent)' }}
                />

                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-10">
                        <span className="text-sm font-bold text-(--color-accent) uppercase tracking-widest mb-3 block">Your Toolkit</span>
                        <h2 className="font-heading text-3xl sm:text-4xl font-black text-(--color-text)">
                            More Than Just Stats
                        </h2>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {/* Draft Simulator */}
                        <Link
                            to="/draft"
                            className="group relative overflow-hidden rounded-2xl border border-white/10 hover:border-(--color-accent)/40 p-6 sm:p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-(--color-accent)/10"
                            style={{ background: 'linear-gradient(135deg, var(--color-secondary), var(--color-primary))' }}
                        >
                            <div
                                className="absolute top-0 right-0 w-40 h-40 opacity-10 group-hover:opacity-20 transition-opacity"
                                style={{ background: 'radial-gradient(circle at top right, var(--color-accent), transparent 70%)' }}
                            />
                            <div
                                className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ background: 'linear-gradient(90deg, transparent, var(--color-accent), transparent)' }}
                            />
                            <div className="relative z-10">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-12 h-12 rounded-xl bg-(--color-accent)/10 flex items-center justify-center">
                                        <Swords className="w-6 h-6 text-(--color-accent)" />
                                    </div>
                                    <h3 className="font-heading text-xl font-bold text-(--color-text) group-hover:text-(--color-accent) transition-colors">
                                        Draft Simulator
                                    </h3>
                                </div>
                                <p className="text-sm text-(--color-text-secondary) leading-relaxed mb-5">
                                    Practice pick/ban strategy with the full SMITE 2 god pool. Supports Regular, Fearless, and multi-game series formats.
                                </p>
                                <span
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-heading font-bold text-sm transition-all duration-300 group-hover:scale-[1.03]"
                                    style={{ background: 'linear-gradient(135deg, var(--color-accent), #e5a84e)', color: 'var(--color-primary)' }}
                                >
                                    Try It Out
                                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </span>
                            </div>
                        </Link>

                        {/* Tier Lists */}
                        <Link
                            to="/tierlist"
                            className="group relative overflow-hidden rounded-2xl border border-white\10 hover:border-(--color-accent)/40 p-6 sm:p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-(--color-accent)/10"
                            style={{ background: 'linear-gradient(135deg, var(--color-secondary), var(--color-primary))' }}
                        >
                            <div
                                className="absolute top-0 right-0 w-40 h-40 opacity-10 group-hover:opacity-20 transition-opacity"
                                style={{ background: 'radial-gradient(circle at top right, var(--color-accent), transparent 70%)' }}
                            />
                            <div
                                className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ background: 'linear-gradient(90deg, transparent, var(--color-accent), transparent)' }}
                            />
                            <div className="relative z-10">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-12 h-12 rounded-xl bg-(--color-accent)/10 flex items-center justify-center">
                                        <ListOrdered className="w-6 h-6 text-(--color-accent)" />
                                    </div>
                                    <h3 className="font-heading text-xl font-bold text-(--color-text) group-hover:text-(--color-accent) transition-colors">
                                        Player Tier Lists
                                    </h3>
                                </div>
                                <p className="text-sm text-(--color-text-secondary) leading-relaxed mb-5">
                                    Rank players by role with drag-and-drop. Export as shareable images and compare your rankings with the community.
                                </p>
                                <span
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-heading font-bold text-sm transition-all duration-300 group-hover:scale-[1.03]"
                                    style={{ background: 'linear-gradient(135deg, var(--color-accent), #e5a84e)', color: 'var(--color-primary)' }}
                                >
                                    Try It Out
                                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </span>
                            </div>
                        </Link>

                        {/* Comp Profile */}
                        <div
                            className="group relative overflow-hidden rounded-2xl border border-[#5865F2]/20 p-6 sm:p-8"
                            style={{ background: 'linear-gradient(135deg, #5865F2/0.04, var(--color-secondary))' }}
                        >
                            <div
                                className="absolute top-0 right-0 w-40 h-40 opacity-10"
                                style={{ background: 'radial-gradient(circle at top right, #5865F2, transparent 70%)' }}
                            />
                            <div className="relative z-10">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-12 h-12 rounded-xl bg-[#5865F2]/10 flex items-center justify-center">
                                        <User className="w-6 h-6 text-[#5865F2]" />
                                    </div>
                                    <h3 className="font-heading text-xl font-bold text-(--color-text)">
                                        Comp Profile
                                    </h3>
                                </div>
                                <p className="text-sm text-(--color-text-secondary) leading-relaxed mb-5">
                                    Link your Discord to claim your player profile. Track your KDA, match history, and performance across every league and season.
                                </p>
                                {!authLoading && (
                                    !user ? (
                                        <button
                                            onClick={login}
                                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-semibold transition-colors"
                                        >
                                            <DiscordIcon className="w-4 h-4" />
                                            Login with Discord
                                        </button>
                                    ) : linkedPlayer ? (
                                        <Link
                                            to={`/profile/${linkedPlayer.slug}`}
                                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-semibold transition-colors"
                                        >
                                            <User className="w-4 h-4" />
                                            View My Profile
                                        </Link>
                                    ) : (
                                        <button
                                            onClick={() => window.dispatchEvent(new CustomEvent('open-claim-modal'))}
                                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-semibold transition-colors"
                                        >
                                            <User className="w-4 h-4" />
                                            Claim Your Profile
                                        </button>
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── WHAT IS SMITECOMP.COM? ─── */}
            <section className="py-20 px-4">
                <div
                    className="w-2/3 h-px mx-auto mb-20"
                    style={{ background: 'linear-gradient(90deg, transparent, var(--color-accent)/0.3, transparent)' }}
                />

                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-6">
                        <span className="text-sm font-bold text-(--color-accent) uppercase tracking-widest mb-3 block">The Platform</span>
                        <h2 className="font-heading text-3xl sm:text-4xl font-black text-(--color-text)">
                            What is smitecomp.com?
                        </h2>
                    </div>
                    <p className="text-(--color-text-secondary) text-lg leading-relaxed max-w-3xl mx-auto text-center mb-14">
                        The companion app for community-run SMITE 2 leagues. Every stat, every match, every play — tracked, ranked, and shareable. Here's what you get:
                    </p>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {[
                            {
                                icon: <Trophy className="w-7 h-7" />,
                                title: 'Live Standings',
                                desc: 'Real-time league standings with match records, game differentials, and head-to-head breakdowns for every division.',
                            },
                            {
                                icon: <BarChart3 className="w-7 h-7" />,
                                title: 'Player Stats',
                                desc: 'Full performance analytics — KDA, damage, mitigated, win rates, and per-game breakdowns for every player in every season.',
                            },
                            {
                                icon: <Calendar className="w-7 h-7" />,
                                title: 'Match History',
                                desc: 'Complete schedule and results organized by week. See team compositions, individual performances, and game-by-game details.',
                            },
                            {
                                icon: <ListOrdered className="w-7 h-7" />,
                                title: 'Tier Lists',
                                desc: 'Drag-and-drop player rankings by role. Export as shareable images and see how your takes stack up against the community.',
                            },
                            {
                                icon: <Shield className="w-7 h-7" />,
                                title: 'Draft Simulator',
                                desc: 'Practice picks and bans with the full god pool. Supports Fearless draft, multi-game series, and all competitive formats.',
                            },
                            {
                                icon: <User className="w-7 h-7" />,
                                title: 'Player Profiles',
                                desc: 'Claim your profile with Discord. Track your stats across seasons and leagues with a single cross-season profile page.',
                            },
                        ].map((feature) => (
                            <div
                                key={feature.title}
                                className="group relative rounded-xl border border-white/10 p-6 transition-all duration-300 hover:border-(--color-accent)/30 hover:-translate-y-1"
                                style={{ background: 'linear-gradient(to bottom, var(--color-secondary), var(--color-primary))' }}
                            >
                                <div
                                    className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                    style={{ background: 'radial-gradient(circle at 50% 0%, var(--color-accent)/0.05, transparent 60%)' }}
                                />
                                <div className="relative z-10">
                                    <div className="text-(--color-accent) mb-4">{feature.icon}</div>
                                    <h3 className="font-heading text-lg font-bold text-(--color-text) mb-2 group-hover:text-(--color-accent) transition-colors">
                                        {feature.title}
                                    </h3>
                                    <p className="text-sm text-(--color-text-secondary) leading-relaxed">{feature.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── STORY SECTION ─── */}
            <section id="about" className="relative py-24 px-4">
                <div
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-px"
                    style={{ background: 'linear-gradient(90deg, transparent, var(--color-accent)/0.3, transparent)' }}
                />

                <div className="max-w-5xl mx-auto">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div>
                            <span className="text-sm font-bold text-(--color-accent) uppercase tracking-widest mb-3 block">The Story</span>
                            <h2 className="font-heading text-3xl sm:text-4xl font-black text-(--color-text) mb-6 leading-tight">
                                Built by Passion,{' '}
                                <span className="text-(--color-accent)">for Passion</span>
                            </h2>
                            <div className="space-y-4 text-(--color-text-secondary) leading-relaxed">
                                <p>
                                    When the SMITE Pro League was officially canceled, many feared competitive SMITE was done for good. But this community doesn't give up that easily.
                                </p>
                                <p>
                                    Driven by pure passion, players, organizers, and casters came together to build something new. Multiple community leagues formed — fully structured seasons with divisions, playoffs, and the same fire that made competitive SMITE legendary.
                                </p>
                                <p>
                                    <strong className="text-(--color-text)">SMITE 2 Companion</strong> is the hub that tracks it all. Every kill, every match, every clutch play — recorded and ranked. Because this much passion deserves to be seen.
                                </p>
                            </div>
                        </div>

                        <div className="relative">
                            <div
                                className="rounded-2xl border border-white/10 p-8 text-center relative overflow-hidden"
                                style={{ background: 'linear-gradient(135deg, var(--color-secondary), var(--color-primary))' }}
                            >
                                <div
                                    className="absolute top-0 right-0 w-32 h-32 opacity-20"
                                    style={{ background: 'radial-gradient(circle at top right, var(--color-accent), transparent 70%)' }}
                                />

                                <div className="flex justify-center text-(--color-accent) mb-6"><Swords className="w-16 h-16" /></div>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-white/5">
                                        <span className="text-(--color-text-secondary) text-sm">Active Leagues</span>
                                        <span className="font-heading font-bold text-(--color-accent) text-lg">{mainLeagues.length}</span>
                                    </div>
                                    <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-white/5">
                                        <span className="text-(--color-text-secondary) text-sm">Total Divisions</span>
                                        <span className="font-heading font-bold text-(--color-accent) text-lg">
                                            {mainLeagues.reduce((sum, l) => sum + (l.divisions?.length || 0), 0)}
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-6 flex justify-center gap-2">
                                    {ALL_RANK_IMAGES.map((img, i) => (
                                        <img key={i} src={img} alt="" className="w-9 h-9 object-contain opacity-70" />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── SHOUTOUT SECTION ─── */}
            <section className="py-20 px-4">
                <div
                    className="w-2/3 h-px mx-auto mb-20"
                    style={{ background: 'linear-gradient(90deg, transparent, var(--color-accent)/0.3, transparent)' }}
                />

                <div className="max-w-4xl mx-auto text-center">
                    <span className="text-sm font-bold text-(--color-accent) uppercase tracking-widest mb-3 block">Respect</span>
                    <h2 className="font-heading text-3xl sm:text-4xl font-black text-(--color-text) mb-6">
                        Powered by the Community
                    </h2>
                    <p className="text-(--color-text-secondary) text-lg leading-relaxed max-w-2xl mx-auto mb-10">
                        None of this happens without the incredible people pouring their time, energy, and passion into keeping competitive SMITE alive. Massive shoutout to everyone behind these leagues.
                    </p>

                    <div className="grid sm:grid-cols-3 gap-6">
                        {[
                            {
                                icon: <Mic className="w-8 h-8" />,
                                title: 'Organizers & Admins',
                                desc: 'The ones who handle scheduling, rules, disputes, and everything behind the scenes so the rest of us can compete.',
                            },
                            {
                                icon: <Video className="w-8 h-8" />,
                                title: 'Casters & Streamers',
                                desc: 'Bringing every match to life with commentary, hype, and production — giving these games the spotlight they deserve.',
                            },
                            {
                                icon: <Gamepad2 className="w-8 h-8" />,
                                title: 'Players & Captains',
                                desc: 'The ones showing up week after week, grinding scrims, and proving that the passion for competitive SMITE burns stronger than ever.',
                            },
                        ].map((group) => (
                            <div
                                key={group.title}
                                className="rounded-xl border border-white/10 p-6 text-center"
                                style={{ background: 'linear-gradient(to bottom, var(--color-secondary), var(--color-primary))' }}
                            >
                                <div className="flex justify-center text-(--color-accent) mb-4">{group.icon}</div>
                                <h3 className="font-heading text-base font-bold text-(--color-text) mb-2">{group.title}</h3>
                                <p className="text-sm text-(--color-text-secondary) leading-relaxed">{group.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── CHALLENGE BANNER ─── */}
            <section className="px-4 pb-4">
                <div className="max-w-4xl mx-auto">
                    <ChallengeBanner />
                </div>
            </section>

            {/* ─── PASSION CTA ─── */}
            <section className="py-24 px-4">
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
                            {/* Bottom row — dense */}
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

                            {/* Top accent — faint */}
                            <span className="absolute top-8 left-[25%] text-xl opacity-30" style={{ animation: 'fireFloat 3.5s ease-in-out infinite 1.5s' }}>🔥</span>
                            <span className="absolute top-6 left-[45%] text-xl opacity-25" style={{ animation: 'fireFloat2 4s ease-in-out infinite 2s' }}>🔥</span>
                            <span className="absolute top-8 right-[25%] text-xl opacity-30" style={{ animation: 'fireFloat3 3.8s ease-in-out infinite 0.9s' }}>🔥</span>

                            {/* Embers — more of them */}
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

            {/* ─── COIN FLIP LINK ─── */}
            <div className="text-center pb-8">
                <Link
                    to="/coinflip"
                    className="text-sm text-(--color-text-secondary)/40 hover:text-(--color-accent) transition-colors"
                >
                    Flip coin
                </Link>
            </div>

            {/* ─── FOOTER ─── */}
            <footer className="py-8 px-4 border-t border-white/5">
                <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <img src={smiteLogo} alt="" className="h-6 w-auto opacity-50" />
                        <span className="text-sm text-(--color-text-secondary)/50">
                            SMITE 2 Companion
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        {mainLeagues.filter(l => l.discord_url).map(l => (
                            <a
                                key={l.id}
                                href={l.discord_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs text-(--color-text-secondary)/50 hover:text-[#5865F2] transition-colors"
                                title={`${l.name} Discord`}
                            >
                                <MessageCircle className="w-3.5 h-3.5" />
                                {l.name}
                            </a>
                        ))}
                    </div>
                    <p className="text-xs text-(--color-text-secondary)/30">
                        Community project · Not affiliated with Hi-Rez Studios
                    </p>
                </div>
            </footer>
        </div>
    )
}

export default Homepage

import { useEffect, useState, useRef, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSidebar } from '../context/SidebarContext'
import { leagueService } from '../services/database'
import {
    ArrowLeft, ChevronDown, ChevronRight, Calendar, Users, User, Trophy,
    MessageCircle, Home, Wrench, ListOrdered, Swords, Shield, BarChart3, Star
} from 'lucide-react'
import UserMenu from '../components/UserMenu'
import PassionDisplay from '../components/PassionDisplay'
import PageTitle from '../components/PageTitle'
import BannedContentBanner from '../components/BannedContentBanner'
import TeamLogo from '../components/TeamLogo'
import smiteLogo from '../assets/smite2.png'
import { getLeagueLogo } from '../utils/leagueImages'
import { getDivisionImage, RANK_LABELS } from '../utils/divisionImages'

const teamImages = import.meta.glob('../assets/teams/*.webp', { eager: true, import: 'default' })

const DiscordIcon = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
    </svg>
)

const LeagueOverview = () => {
    const { leagueSlug } = useParams()
    const { user, linkedPlayer, hasAnyPermission } = useAuth()
    const { toggle: toggleSidebar } = useSidebar()
    const canPreview = hasAnyPermission
    const [league, setLeague] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [expanded, setExpanded] = useState({})
    const [toolsOpen, setToolsOpen] = useState(false)
    const toolsRef = useRef(null)

    // Mouse-tracking hero gradient
    const heroRef = useRef(null)
    const [heroLight, setHeroLight] = useState({ x: 50, y: 50, active: false })

    // Canvas-based floating symbols (single layer, no per-element compositing)
    const canvasRef = useRef(null)

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

    // Canvas-based floating symbols — single layer, ~20fps, paused off-screen
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !league) return
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Collect image URLs for particles
        const divs = league.divisions || []
        const allDivTeams = divs.flatMap(d => d.teams || [])
            .filter((t, i, arr) => arr.findIndex(x => x.slug === t.slug) === i)
        const imgUrls = []
        divs.forEach(d => {
            const src = getDivisionImage(leagueSlug, d.slug, d.tier)
            if (src) imgUrls.push(src)
        })
        allDivTeams.slice(0, 14).forEach(t => {
            const src = teamImages[`../assets/teams/${t.slug}.webp`]
            if (src) imgUrls.push(src)
        })
        if (imgUrls.length === 0) return

        // Load all images, then start animation
        let cancelled = false
        const loadImages = () => Promise.all(imgUrls.map(src => new Promise(resolve => {
            const img = new Image()
            img.onload = () => resolve(img)
            img.onerror = () => resolve(null)
            img.src = src
        })))

        loadImages().then(loaded => {
            if (cancelled) return
            const images = loaded.filter(Boolean)
            if (images.length === 0) return

            // Size canvas to container
            const resize = () => {
                const parent = canvas.parentElement
                if (!parent) return
                canvas.width = parent.offsetWidth
                canvas.height = parent.offsetHeight
            }
            resize()
            window.addEventListener('resize', resize)

            // Create particles
            const particles = images.map(img => {
                const size = 30 + Math.random() * 40 // 30-70px
                const speed = 12 + Math.random() * 28
                const angle = Math.random() * Math.PI * 2
                return {
                    img,
                    size,
                    x: size + Math.random() * (canvas.width - size * 2),
                    y: size + Math.random() * (canvas.height - size * 2),
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    rotation: Math.random() * Math.PI * 2,
                    rotSpeed: (Math.random() - 0.5) * 0.35,
                    opacity: 0.06 + Math.random() * 0.08,
                }
            })

            let visible = true
            const observer = new IntersectionObserver(([e]) => { visible = e.isIntersecting }, { threshold: 0 })
            observer.observe(canvas)

            const INTERVAL = 50 // 20fps
            const dt = INTERVAL / 1000
            const intervalId = setInterval(() => {
                if (!visible || canvas.width === 0) return

                ctx.clearRect(0, 0, canvas.width, canvas.height)
                const margin = 10
                particles.forEach(p => {
                    p.x += p.vx * dt
                    p.y += p.vy * dt
                    p.rotation += p.rotSpeed * dt

                    if (p.x < margin) { p.x = margin; p.vx = Math.abs(p.vx) }
                    if (p.x > canvas.width - margin) { p.x = canvas.width - margin; p.vx = -Math.abs(p.vx) }
                    if (p.y < margin) { p.y = margin; p.vy = Math.abs(p.vy) }
                    if (p.y > canvas.height - margin) { p.y = canvas.height - margin; p.vy = -Math.abs(p.vy) }

                    ctx.save()
                    ctx.globalAlpha = p.opacity
                    ctx.translate(p.x, p.y)
                    ctx.rotate(p.rotation)
                    ctx.drawImage(p.img, -p.size / 2, -p.size / 2, p.size, p.size)
                    ctx.restore()
                })
            }, INTERVAL)

            // Store cleanup refs
            canvas._cleanup = () => {
                clearInterval(intervalId)
                observer.disconnect()
                window.removeEventListener('resize', resize)
            }
        })

        return () => {
            cancelled = true
            if (canvas._cleanup) canvas._cleanup()
        }
    }, [league, leagueSlug])

    // Close tools dropdown on click outside
    useEffect(() => {
        if (!toolsOpen) return
        const handle = (e) => {
            if (toolsRef.current && !toolsRef.current.contains(e.target)) setToolsOpen(false)
        }
        document.addEventListener('mousedown', handle)
        return () => document.removeEventListener('mousedown', handle)
    }, [toolsOpen])

    useEffect(() => {
        let cancelled = false

        const load = async () => {
            try {
                const data = await leagueService.getBySlug(leagueSlug)
                if (cancelled) return
                if (!data || !data.id) {
                    setError('League not found')
                } else {
                    setLeague(data)
                }
            } catch (err) {
                if (!cancelled) setError(err.message)
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        load()
        return () => { cancelled = true }
    }, [leagueSlug])

    const toggleExpand = (divisionId) => {
        setExpanded(prev => ({ ...prev, [divisionId]: !prev[divisionId] }))
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-(--color-accent) mx-auto mb-4" />
                    <p className="text-(--color-text-secondary)">Loading league...</p>
                </div>
            </div>
        )
    }

    if (error || !league) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4">
                <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-8 text-center max-w-md">
                    <h2 className="text-2xl font-bold text-red-400 mb-3">League Not Found</h2>
                    <p className="text-red-300/80 mb-6">{error || 'This league does not exist.'}</p>
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/10 text-(--color-text) hover:bg-white/20 transition-colors text-sm"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Home
                    </Link>
                </div>
            </div>
        )
    }

    const divisions = league.divisions || []
    const logo = getLeagueLogo(league.slug)
    const activeDivisions = divisions.filter(d => d.seasons?.some(s => s.is_active || canPreview))
    const leagueColor = league.color || 'var(--color-accent)'
    const totalTeams = activeDivisions.reduce((sum, d) => sum + (d.team_count || 0), 0)
    const totalPlayers = activeDivisions.reduce((sum, d) => sum + (d.player_count || 0), 0)
    const allTeams = activeDivisions.flatMap(d => d.teams || [])
    // Unique teams only (same team might appear in data)
    const uniqueTeams = allTeams.filter((t, i, arr) => arr.findIndex(x => x.slug === t.slug) === i)

    return (
        <div className="min-h-screen overflow-hidden">
            {league && <PageTitle title={league.name} />}

            {/* Keyframe animations */}
            <style>{`
                @keyframes leagueFloat {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-8px); }
                }
                @keyframes leaguePulse {
                    0%, 100% { opacity: 0.15; }
                    50% { opacity: 0.25; }
                }
                @keyframes slideIn {
                    from { opacity: 0; transform: scale(0.97); }
                    to { opacity: 1; transform: scale(1); }
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>

            {/* ─── NAVBAR ─── */}
            <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-7xl">
                <div className="bg-(--color-primary)/75 backdrop-blur-xl rounded-xl px-4 py-2 shadow-lg border border-white/10">
                    <div className="flex items-center gap-3 sm:gap-6">
                        <button
                            onClick={toggleSidebar}
                            className="sidebar:hidden flex items-center justify-center w-8 h-8 rounded-lg text-(--color-accent) hover:bg-white/10 transition-colors cursor-pointer border border-(--color-accent)/25"
                            aria-label="Open menu"
                        >
                            <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
                        </button>
                        <Link to="/" className="flex items-center gap-3 flex-shrink-0">
                            <img src={smiteLogo} alt="SMITE 2" className="h-8 sm:h-10 w-auto" />
                        </Link>
                        <div className="flex items-center gap-2 flex-shrink-0 border-l border-white/10 pl-3 sm:pl-4">
                            {logo && <img src={logo} alt="" className="h-6 w-6 sm:h-7 sm:w-7 object-contain" />}
                            <div className="text-xs sm:text-sm font-bold text-(--color-text)">{league.name}</div>
                        </div>
                        <div className="flex items-center gap-1 ml-auto">
                            <Link to="/" title="Home" className="p-2 rounded-lg text-(--nav-text) hover:text-(--color-accent) hover:bg-white/10 transition-all duration-200">
                                <Home className="w-4 h-4" />
                            </Link>
                            <Link to="/leagues" title="Browse Leagues" className="p-2 rounded-lg text-(--nav-text) hover:text-(--color-accent) hover:bg-white/10 transition-all duration-200">
                                <Trophy className="w-4 h-4" />
                            </Link>
                            {user && (
                                linkedPlayer ? (
                                    <Link to={`/profile/${linkedPlayer.slug}`} title="My Profile" className="p-2 rounded-lg text-(--nav-text) hover:text-(--color-accent) hover:bg-white/10 transition-all duration-200">
                                        <User className="w-4 h-4" />
                                    </Link>
                                ) : (
                                    <button onClick={() => window.dispatchEvent(new CustomEvent('open-claim-modal'))} title="Claim Your Profile" className="p-2 rounded-lg text-(--nav-text) hover:text-(--color-accent) hover:bg-white/10 transition-all duration-200">
                                        <User className="w-4 h-4" />
                                    </button>
                                )
                            )}
                            <div ref={toolsRef} className="relative">
                                <button
                                    onClick={() => setToolsOpen(!toolsOpen)}
                                    title="Tools"
                                    className={`p-2 rounded-lg flex items-center gap-0.5 transition-all duration-200 ${toolsOpen ? 'text-(--color-accent) bg-white/10' : 'text-(--nav-text) hover:text-(--color-accent) hover:bg-white/10'}`}
                                >
                                    <Wrench className="w-4 h-4" />
                                    <ChevronDown className={`w-3 h-3 transition-transform ${toolsOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {toolsOpen && (
                                    <div className="absolute right-0 top-full mt-2 w-48 bg-(--color-secondary) border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
                                        <div className="py-1">
                                            <Link to="/tierlist" onClick={() => setToolsOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-(--color-text) hover:bg-white/5 transition-colors">
                                                <ListOrdered className="w-4 h-4 text-(--color-text-secondary)" /> Tier List
                                            </Link>
                                            <Link to="/draft" onClick={() => setToolsOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-(--color-text) hover:bg-white/5 transition-colors">
                                                <Swords className="w-4 h-4 text-(--color-text-secondary)" /> Draft Simulator
                                            </Link>
                                        </div>
                                    </div>
                                )}
                            </div>
                            {user && <PassionDisplay />}
                            <UserMenu compact />
                        </div>
                    </div>
                </div>
            </nav>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* ─── HERO SECTION ─── Full viewport, immersive             */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <section
                ref={heroRef}
                onMouseMove={handleHeroMove}
                onMouseLeave={handleHeroLeave}
                className="relative min-h-[80vh] flex items-center justify-center px-4 overflow-hidden"
            >
                {/* BG Layer 1: Painted gradient blobs — like Predictions */}
                <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse 90% 50% at 50% 8%, ${leagueColor}30, transparent 65%)` }} />
                <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse 70% 50% at 85% 30%, ${leagueColor}18, transparent 55%)` }} />
                <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse 60% 45% at 15% 50%, ${leagueColor}15, transparent 55%)` }} />
                <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse 80% 40% at 50% 90%, ${leagueColor}14, transparent 55%)` }} />
                <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse 50% 35% at 70% 65%, ${leagueColor}0c, transparent 50%)` }} />

                {/* BG Layer 2: Static shimmer accent */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background: `linear-gradient(135deg, transparent 15%, ${leagueColor}12 35%, transparent 50%, ${leagueColor}0a 70%, transparent 85%)`,
                    }}
                />

                {/* BG Layer 3: Mouse-tracking paint blob — large, prominent */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background: `radial-gradient(600px circle at ${heroLight.x}% ${heroLight.y}%, ${leagueColor}35, transparent 60%)`,
                        opacity: heroLight.active ? 1 : 0.3,
                        transition: 'opacity 0.5s ease, background 0.15s ease',
                    }}
                />
                {/* Secondary paint blob — offset, different size for depth */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background: `radial-gradient(400px circle at ${Math.min(100, heroLight.x + 8)}% ${Math.min(100, heroLight.y + 5)}%, ${leagueColor}20, transparent 55%)`,
                        opacity: heroLight.active ? 0.8 : 0,
                        transition: 'opacity 0.7s ease, background 0.2s ease',
                    }}
                />

                {/* BG Layer 4: Grid texture */}
                <div
                    className="absolute inset-0 opacity-[0.03] pointer-events-none"
                    style={{
                        backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
                        backgroundSize: '60px 60px',
                    }}
                />

                {/* Floating symbols — single canvas, no per-element GPU layers */}
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

                {/* Hero content */}
                <div className="relative z-10 text-center max-w-4xl mx-auto" style={{ animation: 'slideUp 0.6s ease-out' }}>
                    <Link
                        to="/leagues"
                        className="inline-flex items-center gap-1.5 text-sm text-(--color-text-secondary) hover:text-(--color-accent) transition-colors mb-10"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        All Leagues
                    </Link>

                    {/* League logo — large and glowing */}
                    <div className="flex justify-center mb-8">
                        {logo ? (
                            <div className="relative">
                                <div
                                    className="absolute inset-0 rounded-full blur-3xl"
                                    style={{
                                        background: `radial-gradient(circle, ${leagueColor}30, transparent 70%)`,
                                        animation: 'leaguePulse 3s ease-in-out infinite',
                                    }}
                                />
                                <img
                                    src={logo}
                                    alt={league.name}
                                    className="relative h-36 w-36 sm:h-44 sm:w-44 object-contain"
                                    style={{
                                        filter: `drop-shadow(0 0 30px ${leagueColor}40)`,
                                        animation: 'leagueFloat 5s ease-in-out infinite',
                                    }}
                                />
                            </div>
                        ) : (
                            <div
                                className="h-32 w-32 rounded-3xl border border-white/10 flex items-center justify-center"
                                style={{
                                    background: `linear-gradient(135deg, ${leagueColor}15, ${leagueColor}05)`,
                                    boxShadow: `0 0 30px ${leagueColor}15, 0 0 60px ${leagueColor}05`,
                                }}
                            >
                                <Trophy className="w-16 h-16" style={{ color: leagueColor }} />
                            </div>
                        )}
                    </div>

                    {/* League name */}
                    <h1 className="font-heading text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight mb-4">
                        <span
                            className="bg-clip-text text-transparent"
                            style={{
                                WebkitBackgroundClip: 'text',
                                backgroundImage: heroLight.active
                                    ? `radial-gradient(circle 400px at ${heroLight.x}% ${heroLight.y}%, #ffffff, rgba(255,255,255,0.7) 60%, rgba(255,255,255,0.7))`
                                    : 'linear-gradient(to right, rgba(255,255,255,0.85), rgba(255,255,255,0.65))',
                            }}
                        >
                            {league.name}
                        </span>
                    </h1>

                    {/* Description */}
                    {league.description && league.description !== league.name && (
                        <p className="text-lg sm:text-xl text-(--color-text-secondary) max-w-2xl mx-auto leading-relaxed mb-8">
                            {league.description}
                        </p>
                    )}

                    {/* Badges + CTA */}
                    <div className="flex flex-wrap items-center gap-3 justify-center mb-10">
                        {activeDivisions.length > 0 && (
                            <div
                                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider"
                                style={{ backgroundColor: `${leagueColor}15`, border: `1px solid ${leagueColor}30`, color: leagueColor }}
                            >
                                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: leagueColor }} />
                                Season Active
                            </div>
                        )}
                        {league.discord_url && (
                            <a
                                href={league.discord_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold text-white bg-[#5865F2] hover:bg-[#4752C4] transition-colors"
                            >
                                <DiscordIcon className="w-3.5 h-3.5" />
                                Join Discord
                            </a>
                        )}
                    </div>

                    {/* Quick action — scroll to divisions */}
                    {activeDivisions.length > 0 && (
                        <a
                            href="#divisions"
                            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-heading font-bold text-base transition-all duration-300 hover:scale-[1.03] hover:shadow-lg"
                            style={{
                                background: `linear-gradient(135deg, ${leagueColor}, ${leagueColor}cc)`,
                                color: '#000',
                                boxShadow: `0 8px 32px ${leagueColor}30`,
                            }}
                        >
                            Explore Divisions
                            <ChevronRight className="w-5 h-5" />
                        </a>
                    )}
                </div>

                {/* Bottom edge fade */}
                <div
                    className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
                    style={{ background: 'linear-gradient(to bottom, transparent, var(--color-primary))' }}
                />
            </section>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* ─── STATS BAR ─── Overlapping hero bottom                 */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <section className="px-4 -mt-8 relative z-10 pb-16">
                <div className="max-w-4xl mx-auto">
                    <div
                        className="grid grid-cols-3 gap-4 sm:gap-6 rounded-2xl border border-white/10 p-6 sm:p-8"
                        style={{
                            background: 'linear-gradient(135deg, var(--color-secondary), var(--color-primary))',
                            boxShadow: `0 0 40px ${leagueColor}12, 0 0 80px ${leagueColor}06`,
                        }}
                    >
                        {[
                            { icon: <Shield className="w-6 h-6" />, label: 'Divisions', value: activeDivisions.length },
                            { icon: <Users className="w-6 h-6" />, label: 'Teams', value: totalTeams },
                            { icon: <User className="w-6 h-6" />, label: 'Players', value: totalPlayers },
                        ].map(stat => (
                            <div key={stat.label} className="text-center">
                                <div className="flex items-center justify-center mb-2" style={{ color: leagueColor }}>
                                    {stat.icon}
                                </div>
                                <div className="text-3xl sm:text-4xl font-black text-(--color-text) font-heading">
                                    {stat.value}
                                </div>
                                <div className="text-xs text-(--color-text-secondary) uppercase tracking-widest mt-1 font-semibold">
                                    {stat.label}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* ─── TEAMS SHOWCASE ─── Logo grid of all teams             */}
            {/* ═══════════════════════════════════════════════════════════ */}
            {uniqueTeams.length > 0 && (
                <section className="px-4 pb-20">
                    <div className="max-w-5xl mx-auto">
                        <div className="text-center mb-10">
                            <span className="text-sm font-bold uppercase tracking-widest mb-3 block" style={{ color: leagueColor }}>
                                Competing
                            </span>
                            <h2 className="font-heading text-3xl sm:text-4xl font-black text-(--color-text)">
                                {uniqueTeams.length} Orgs Battling It Out
                            </h2>
                        </div>

                        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
                            {uniqueTeams.map((team) => (
                                <div
                                    key={team.slug}
                                    className="group"
                                    title={team.name}
                                >
                                    <TeamLogo slug={team.slug} name={team.name} size={48} className="transition-transform duration-300 group-hover:scale-110" />
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* ─── Banned Content ─── */}
            {league && (
                <section className="px-4 pb-6">
                    <div className="max-w-5xl mx-auto">
                        <BannedContentBanner leagueId={league.id} accentColor={leagueColor} />
                    </div>
                </section>
            )}

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* ─── DIVISIONS ─── The main content                        */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <section id="divisions" className="px-4 pb-20">
                <div className="max-w-5xl mx-auto">
                    <div
                        className="w-2/3 h-px mx-auto mb-16"
                        style={{ background: `linear-gradient(90deg, transparent, ${leagueColor}40, transparent)` }}
                    />

                    <div className="text-center mb-12">
                        <span className="text-sm font-bold uppercase tracking-widest mb-3 block" style={{ color: leagueColor }}>
                            Divisions
                        </span>
                        <h2 className="font-heading text-3xl sm:text-4xl font-black text-(--color-text)">
                            Choose Your Division
                        </h2>
                    </div>

                    {divisions.length === 0 ? (
                        <p className="text-center text-(--color-text-secondary) italic">
                            No divisions have been created yet.
                        </p>
                    ) : (
                        <div className="space-y-6">
                            {divisions.map(division => {
                                const rankImg = getDivisionImage(leagueSlug, division.slug, division.tier)
                                const rankLabel = RANK_LABELS[division.tier]
                                const activeSeason = division.seasons?.find(s => s.is_active || canPreview)
                                const hasData = !!activeSeason
                                const isExpanded = expanded[division.id]
                                const seasons = division.seasons || []
                                const divTeams = division.teams || []

                                return (
                                    <div
                                        key={division.id}
                                        className={`group relative rounded-2xl border transition-all duration-300 overflow-hidden ${
                                            hasData
                                                ? 'border-white/10 hover:border-white/20'
                                                : 'border-white/5 opacity-40'
                                        }`}
                                        style={{
                                            background: hasData
                                                ? 'linear-gradient(135deg, var(--color-secondary), var(--color-primary))'
                                                : 'var(--color-secondary)',
                                        }}
                                    >
                                        {/* Accent top line */}
                                        <div
                                            className="absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                            style={{ background: `linear-gradient(90deg, transparent, ${leagueColor}, transparent)` }}
                                        />

                                        {/* Hover glow */}
                                        {hasData && (
                                            <div
                                                className="absolute top-0 left-0 right-0 h-40 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                                                style={{ background: `radial-gradient(ellipse at 50% 0%, ${leagueColor}08, transparent 70%)` }}
                                            />
                                        )}

                                        <div className="relative p-6 sm:p-8">
                                            <div className="flex flex-col sm:flex-row items-start gap-5">
                                                {/* Rank image — bigger */}
                                                {rankImg && (
                                                    <div className="flex-shrink-0 relative">
                                                        <img
                                                            src={rankImg}
                                                            alt={rankLabel}
                                                            className="h-20 w-20 sm:h-24 sm:w-24 object-contain"
                                                            style={{ filter: hasData ? `drop-shadow(0 4px 12px ${leagueColor}20)` : 'none' }}
                                                        />
                                                    </div>
                                                )}

                                                {/* Division info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <h3 className="font-heading text-2xl sm:text-3xl font-black text-(--color-text) truncate group-hover:text-white transition-colors">
                                                            {division.name}
                                                        </h3>
                                                        {hasData && (
                                                            <span className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-3 mb-3">
                                                        {rankLabel && (
                                                            <span className="text-sm text-(--color-text-secondary) uppercase tracking-wider font-semibold">
                                                                {rankLabel} Tier
                                                            </span>
                                                        )}
                                                        {activeSeason && (
                                                            <span className="text-sm text-(--color-text-secondary) flex items-center gap-1.5">
                                                                <Calendar className="w-3.5 h-3.5" />
                                                                {activeSeason.name}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Stats row */}
                                                    {division.team_count > 0 && (
                                                        <div className="flex items-center gap-4 mb-4 text-sm text-(--color-text-secondary)">
                                                            <span className="inline-flex items-center gap-1.5">
                                                                <Users className="w-4 h-4" style={{ color: leagueColor }} />
                                                                {division.team_count} teams
                                                            </span>
                                                            <span className="inline-flex items-center gap-1.5">
                                                                <User className="w-4 h-4" style={{ color: leagueColor }} />
                                                                {division.player_count} players
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* Team logo strip */}
                                                    {divTeams.length > 0 && (
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {divTeams.slice(0, 8).map(team => (
                                                                <div
                                                                    key={team.slug}
                                                                    className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center opacity-60 group-hover:opacity-100 transition-all duration-300"
                                                                >
                                                                    <TeamLogo slug={team.slug} name={team.name} size={22} />
                                                                </div>
                                                            ))}
                                                            {divTeams.length > 8 && (
                                                                <span className="text-xs text-(--color-text-secondary) ml-1 font-semibold">
                                                                    +{divTeams.length - 8}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Action area */}
                                                <div className="flex flex-col items-end gap-3 flex-shrink-0 sm:self-center">
                                                    {hasData && (
                                                        <Link
                                                            to={`/${leagueSlug}/${division.slug}`}
                                                            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-black transition-all duration-300 hover:scale-[1.04] hover:shadow-lg"
                                                            style={{
                                                                background: `linear-gradient(135deg, ${leagueColor}, ${leagueColor}cc)`,
                                                                boxShadow: `0 4px 20px ${leagueColor}30`,
                                                            }}
                                                        >
                                                            Enter Division
                                                            <ChevronRight className="w-4 h-4" />
                                                        </Link>
                                                    )}
                                                    {seasons.length > 1 && (
                                                        <button
                                                            onClick={() => toggleExpand(division.id)}
                                                            className="inline-flex items-center gap-1.5 text-xs text-(--color-text-secondary) hover:text-(--color-accent) transition-colors font-semibold"
                                                        >
                                                            {seasons.length} seasons
                                                            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expandable seasons */}
                                        {isExpanded && seasons.length > 0 && (
                                            <div className="border-t border-white/5 px-6 sm:px-8 py-5">
                                                <div className="space-y-2">
                                                    {seasons.map(season => (
                                                        <div key={season.id} className="flex items-center justify-between py-2.5 px-4 rounded-lg bg-white/5">
                                                            <div className="flex items-center gap-2">
                                                                {season.is_active && <span className="w-1.5 h-1.5 rounded-full bg-green-400" />}
                                                                <span className={`text-sm ${season.is_active ? 'text-(--color-text) font-medium' : 'text-(--color-text-secondary)'}`}>
                                                                    {season.name}
                                                                </span>
                                                            </div>
                                                            {season.start_date && (
                                                                <span className="text-xs text-(--color-text-secondary)/60">
                                                                    {new Date(season.start_date).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {!hasData && (
                                            <div className="px-6 pb-5">
                                                <p className="text-sm text-(--color-text-secondary)/50 italic">No active season</p>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* ─── DISCORD CTA ─── Join the community                    */}
            {/* ═══════════════════════════════════════════════════════════ */}
            {league.discord_url && (
                <section className="px-4 pb-20">
                    <div className="max-w-4xl mx-auto">
                        <div
                            className="relative overflow-hidden rounded-2xl border border-[#5865F2]/30 p-10 sm:p-14 text-center"
                            style={{ background: 'linear-gradient(135deg, #5865F2/0.08, var(--color-secondary), #5865F2/0.05)' }}
                        >
                            <div
                                className="absolute top-0 right-0 w-80 h-80 opacity-15 pointer-events-none"
                                style={{ background: 'radial-gradient(circle at top right, #5865F2, transparent 60%)' }}
                            />
                            <div
                                className="absolute bottom-0 left-0 w-60 h-60 opacity-10 pointer-events-none"
                                style={{ background: 'radial-gradient(circle at bottom left, #5865F2, transparent 60%)' }}
                            />

                            <div className="relative z-10">
                                <DiscordIcon className="w-12 h-12 text-[#5865F2] mx-auto mb-5" />
                                <h2 className="font-heading text-2xl sm:text-3xl font-black text-(--color-text) mb-3">
                                    Join the {league.name} Community
                                </h2>
                                <p className="text-(--color-text-secondary) max-w-lg mx-auto mb-8 leading-relaxed">
                                    Find scrims, discuss matches, and stay up to date with scheduling and results. The action happens on Discord.
                                </p>
                                <a
                                    href={league.discord_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-heading font-bold text-base transition-all duration-300 hover:scale-[1.03] hover:shadow-lg hover:shadow-[#5865F2]/20"
                                >
                                    <DiscordIcon className="w-5 h-5" />
                                    Join Discord Server
                                </a>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* ─── FOOTER CTA ─── */}
            <section className="px-4 pb-16">
                <div className="max-w-5xl mx-auto text-center">
                    <Link
                        to="/leagues"
                        className="inline-flex items-center gap-2 text-sm text-(--color-text-secondary) hover:text-(--color-accent) transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to All Leagues
                    </Link>
                </div>
            </section>
        </div>
    )
}

export default LeagueOverview

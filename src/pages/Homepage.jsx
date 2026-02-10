// src/pages/Homepage.jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { leagueService } from '../services/database'
import { useAuth } from '../context/AuthContext'
import { Trophy, BarChart3, Calendar, Swords, ChevronRight, MessageCircle, Mic, Video, Gamepad2, User, ListOrdered } from 'lucide-react'
import smiteLogo from '../assets/smite2.png'

// League logos
import aglLogo from '../assets/leagues/agl.png'
import babylonLogo from '../assets/leagues/babylon.png'
import oslLogo from '../assets/leagues/osltext.png'

// Rank images
import deityImg from '../assets/ranks/deity.png'
import demigodImg from '../assets/ranks/demigod.png'
import masterImg from '../assets/ranks/master.png'
import obsidianImg from '../assets/ranks/obsidian.png'
import diamondImg from '../assets/ranks/diamond.png'

const RANK_IMAGES = { 1: deityImg, 2: demigodImg, 3: masterImg, 4: obsidianImg, 5: diamondImg }
const RANK_LABELS = { 1: 'Deity', 2: 'Demigod', 3: 'Master', 4: 'Obsidian', 5: 'Diamond' }

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
    const { user, linkedPlayer, login, loading: authLoading } = useAuth()
    const [leagues, setLeagues] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

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

    const [ishtarStats, setIshtarStats] = useState(null)

    // Fetch Ishtar division player/team count once leagues are loaded
    useEffect(() => {
        if (!leagues.length) return
        const bsl = leagues.find(l => l.slug === 'bsl' || l.slug === 'babylon-smite-league')
        if (!bsl) return
        const ishtar = bsl.divisions?.find(d => d.slug === 'ishtar')
        if (!ishtar) return
        const activeSeason = ishtar.seasons?.find(s => s.is_active)
        if (!activeSeason) return

        const fetchStats = async () => {
            try {
                const res = await fetch(`/.netlify/functions/standings?seasonId=${activeSeason.id}`)
                const teams = await res.json()
                const teamCount = teams.length || 0

                // Get player count from rosters
                const rosterRes = await fetch(`/.netlify/functions/players?seasonId=${activeSeason.id}`)
                const players = await rosterRes.json()
                const playerCount = players.length || 0

                setIshtarStats({ teams: teamCount, players: playerCount })
            } catch {
                // Silently fail — banner still renders without stats
            }
        }
        fetchStats()
    }, [leagues])

    const mainLeagues = [...leagues]
        .filter(l => l.name?.toLowerCase() !== 'test league')
        .sort((a, b) => {
            const aActive = a.divisions?.some(d => d.seasons?.some(s => s.is_active)) ? 0 : 1
            const bActive = b.divisions?.some(d => d.seasons?.some(s => s.is_active)) ? 0 : 1
            return aActive - bActive
        })
    const hasActiveLeagues = mainLeagues.some(l =>
        l.divisions?.some(d => d.seasons?.some(s => s.is_active))
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

            {/* Keyframe styles for fire animation */}
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
                    50% { text-shadow: 0 0 30px rgba(248,197,106,0.6), 0 0 60px rgba(248,197,106,0.2), 0 0 80px rgba(248,197,106,0.1); }
                }
                @keyframes passionSlideUp1 {
                    0% { opacity: 0; transform: translateY(30px); }
                    20% { opacity: 1; transform: translateY(0); }
                    80% { opacity: 1; transform: translateY(0); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                @keyframes passionSlideUp2 {
                    0%, 25% { opacity: 0; transform: translateY(30px); }
                    45% { opacity: 1; transform: translateY(0); }
                    80% { opacity: 1; transform: translateY(0); }
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
            `}</style>

            {/* ─── HERO SECTION ─── */}
            <section className="relative min-h-[85vh] flex items-center justify-center px-4">
                <div className="absolute inset-0 overflow-hidden">
                    <div
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-15"
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

                <div className="relative z-10 text-center max-w-4xl mx-auto">
                    <div className="mb-8">
                        <img src={smiteLogo} alt="SMITE 2" className="h-28 sm:h-36 w-auto mx-auto drop-shadow-2xl" />
                    </div>

                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-(--color-accent)/30 bg-(--color-accent)/5 mb-6">
                        <span className="w-2 h-2 rounded-full bg-(--color-accent) animate-pulse" />
                        <span className="text-sm font-semibold text-(--color-accent) uppercase tracking-wider">Community-Driven Competitive</span>
                    </div>

                    <h1 className="font-heading text-5xl sm:text-7xl font-black text-(--color-text) mb-6 leading-[1.1] tracking-tight">
                        The Battleground{' '}
                        <span className="relative inline-block">
                            <span
                                className="bg-clip-text text-transparent"
                                style={{ backgroundImage: 'linear-gradient(135deg, var(--color-accent), #fde68a, var(--color-accent))' }}
                            >
                                Lives On
                            </span>
                            <span
                                className="absolute -bottom-1 left-0 right-0 h-1 rounded-full"
                                style={{ background: 'linear-gradient(90deg, transparent, var(--color-accent), transparent)' }}
                            />
                        </span>
                    </h1>

                    <p className="text-lg sm:text-xl text-(--color-text-secondary) max-w-2xl mx-auto mb-10 leading-relaxed">
                        When the SPL fell, the community answered with passion. Track stats, standings, and tierlists across the leagues keeping SMITE 2 esports alive.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                        {hasActiveLeagues ? (
                            <a
                                href="#leagues"
                                className="group relative px-8 py-3.5 rounded-xl font-heading font-bold text-lg overflow-hidden transition-all duration-300 hover:scale-[1.03] hover:shadow-lg hover:shadow-(--color-accent)/20"
                                style={{ background: 'linear-gradient(135deg, var(--color-accent), #e5a84e)' }}
                            >
                                <span className="relative z-10 text-(--color-primary)">Explore Leagues</span>
                            </a>
                        ) : (
                            <a
                                href="#leagues"
                                className="group px-8 py-3.5 rounded-xl font-heading font-bold text-lg border-2 border-(--color-accent)/50 text-(--color-accent) hover:bg-(--color-accent)/10 transition-all duration-300"
                            >
                                View Leagues
                            </a>
                        )}
                        <a
                            href="#about"
                            className="px-8 py-3.5 rounded-xl font-heading font-bold text-lg border border-white/10 text-(--color-text-secondary) hover:border-white/25 hover:text-(--color-text) transition-all duration-300"
                        >
                            Learn More
                        </a>
                    </div>

                    <div className="mt-16 animate-bounce">
                        <svg className="w-6 h-6 mx-auto text-(--color-text-secondary)/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                    </div>
                </div>
            </section>

            {/* ─── BSL ISHTAR DIVISION BANNER ─── */}
            <section className="py-16 px-4">
                <div
                    className="w-2/3 h-px mx-auto mb-16"
                    style={{ background: `linear-gradient(90deg, transparent, ${leagues.find(l => l.slug === 'bsl' || l.slug === 'babylon-smite-league')?.color || 'var(--color-accent)'}40, transparent)` }}
                />

                <div className="max-w-5xl mx-auto">
                    <Link
                        to="/bsl/ishtar"
                        className="group relative block overflow-hidden rounded-2xl border border-white/10 hover:border-(--color-accent)/40 transition-all duration-300 hover:shadow-lg hover:shadow-(--color-accent)/5 hover:-translate-y-1"
                        style={{ background: 'linear-gradient(135deg, var(--color-secondary), var(--color-primary))' }}
                    >
                        {/* Top accent line */}
                        <div
                            className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ background: 'linear-gradient(90deg, transparent, var(--color-accent), transparent)' }}
                        />

                        {/* Background glow */}
                        <div
                            className="absolute top-0 right-0 w-72 h-72 opacity-10 group-hover:opacity-20 transition-opacity"
                            style={{ background: 'radial-gradient(circle at top right, var(--color-accent), transparent 70%)' }}
                        />
                        <div
                            className="absolute bottom-0 left-0 w-48 h-48 opacity-5"
                            style={{ background: 'radial-gradient(circle at bottom left, var(--color-accent), transparent 70%)' }}
                        />

                        <div className="relative z-10 p-6 sm:p-10">
                            <div className="flex flex-col md:flex-row items-center gap-6 sm:gap-10">

                                {/* Left — Babylon logo */}
                                <div className="flex-shrink-0">
                                    <div
                                        className="w-20 h-20 sm:w-28 sm:h-28 rounded-xl border border-white/10 flex items-center justify-center overflow-hidden"
                                        style={{ background: 'linear-gradient(135deg, var(--color-accent)/0.08, transparent)' }}
                                    >
                                        <img src={babylonLogo} alt="Babylon Smite League" className="w-14 h-14 sm:w-20 sm:h-20 object-contain" />
                                    </div>
                                </div>

                                {/* Center — Content */}
                                <div className="flex-1 text-center md:text-left">
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-(--color-accent)/5 border border-(--color-accent)/20 mb-3">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                        <span className="text-xs font-semibold text-(--color-accent) uppercase tracking-wider">Live Season</span>
                                    </div>

                                    <h2 className="font-heading text-2xl sm:text-3xl font-black text-(--color-text) mb-1.5 leading-tight">
                                        Babylon Smite League
                                    </h2>
                                    <p className="text-base sm:text-lg font-semibold text-(--color-accent) mb-3">
                                        Ishtar Division — First Tracked Season
                                    </p>
                                    <p className="text-sm text-(--color-text-secondary) max-w-lg leading-relaxed">
                                        Follow every match, track player stats, and see live standings.
                                        {ishtarStats ? ` Full performance analytics for ${ishtarStats.teams} teams and ${ishtarStats.players} players.` : ' Full performance analytics for every team and player.'}
                                    </p>
                                </div>

                                {/* Right — CTA */}
                                <div className="flex-shrink-0 flex flex-col items-center gap-3">
                                    <div
                                        className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl font-heading font-bold text-sm sm:text-base transition-all duration-300 group-hover:scale-[1.03] group-hover:shadow-lg group-hover:shadow-(--color-accent)/20"
                                        style={{ background: 'linear-gradient(135deg, var(--color-accent), #e5a84e)' }}
                                    >
                                        <span className="text-(--color-primary)">View Standings</span>
                                        <svg className="w-4 h-4 text-(--color-primary) group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                        </svg>
                                    </div>
                                    {ishtarStats && (
                                        <div className="flex items-center gap-3 text-xs text-(--color-text-secondary)/60">
                                            <span>{ishtarStats.teams} Teams</span>
                                            <span className="w-1 h-1 rounded-full bg-white/20" />
                                            <span>{ishtarStats.players} Players</span>
                                        </div>
                                    )}
                                </div>

                            </div>
                        </div>
                    </Link>
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
                                    {[deityImg, demigodImg, masterImg, obsidianImg, diamondImg].map((img, i) => (
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

            {/* ─── FEATURES SECTION ─── */}
            <section className="py-20 px-4">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-14">
                        <span className="text-sm font-bold text-(--color-accent) uppercase tracking-widest mb-3 block">Everything You Need</span>
                        <h2 className="font-heading text-3xl sm:text-4xl font-black text-(--color-text)">
                            Your Competitive Toolkit
                        </h2>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {[
                            {
                                icon: <Trophy className="w-8 h-8" />,
                                title: 'Standings',
                                desc: 'Live league standings with match and game records for every division.',
                            },
                            {
                                icon: <BarChart3 className="w-8 h-8" />,
                                title: 'Player Stats',
                                desc: 'Full KDA, damage, win rates, and per-game breakdowns for every player.',
                            },
                            {
                                icon: <Calendar className="w-8 h-8" />,
                                title: 'Match History',
                                desc: 'Complete schedule and results organized by week with team details.',
                            },
                            {
                                icon: <Swords className="w-8 h-8" />,
                                title: 'Tierlists',
                                desc: 'Drag-and-drop player rankings by role. Save locally and export as images.',
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

            {/* ─── CLAIM YOUR PROFILE CTA ─── */}
            {!authLoading && (
                <section className="py-16 px-4">
                    <div className="max-w-5xl mx-auto">
                        <div className="grid sm:grid-cols-2 gap-5">
                            {/* Claim Profile Card */}
                            <div
                                className="relative overflow-hidden rounded-2xl border border-[#5865F2]/30 p-6 sm:p-8"
                                style={{ background: 'linear-gradient(135deg, #5865F2/0.08, var(--color-secondary))' }}
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 opacity-10" style={{ background: 'radial-gradient(circle at top right, #5865F2, transparent 70%)' }} />
                                <div className="relative z-10">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-lg bg-[#5865F2]/20 flex items-center justify-center">
                                            <User className="w-5 h-5 text-[#5865F2]" />
                                        </div>
                                        <h3 className="font-heading text-lg font-bold text-(--color-text)">Claim Your Profile</h3>
                                    </div>
                                    <p className="text-sm text-(--color-text-secondary) mb-5 leading-relaxed">
                                        Link your Discord account to your player profile. Track your stats, view your match history, and represent yourself in the community.
                                    </p>
                                    {!user ? (
                                        <button
                                            onClick={login}
                                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-semibold transition-colors"
                                        >
                                            <DiscordIcon className="w-4 h-4" />
                                            Login with Discord
                                        </button>
                                    ) : linkedPlayer ? (
                                        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium">
                                            <User className="w-4 h-4" />
                                            Linked to {linkedPlayer.name}
                                        </span>
                                    ) : (
                                        <button
                                            onClick={() => window.dispatchEvent(new CustomEvent('open-claim-modal'))}
                                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-semibold transition-colors"
                                        >
                                            <User className="w-4 h-4" />
                                            Claim Your Profile
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Community Tier Lists Card */}
                            <div
                                className="relative overflow-hidden rounded-2xl border border-(--color-accent)/30 p-6 sm:p-8"
                                style={{ background: 'linear-gradient(135deg, var(--color-accent)/0.08, var(--color-secondary))' }}
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 opacity-10" style={{ background: 'radial-gradient(circle at top right, var(--color-accent), transparent 70%)' }} />
                                <div className="relative z-10">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-lg bg-(--color-accent)/20 flex items-center justify-center">
                                            <ListOrdered className="w-5 h-5 text-(--color-accent)" />
                                        </div>
                                        <h3 className="font-heading text-lg font-bold text-(--color-text)">Community Tier Lists</h3>
                                    </div>
                                    <p className="text-sm text-(--color-text-secondary) mb-5 leading-relaxed">
                                        Rank players by role, save your tier lists, and share them with the community. Log in to keep your rankings across devices.
                                    </p>
                                    {!user ? (
                                        <button
                                            onClick={login}
                                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                                            style={{ background: 'linear-gradient(135deg, var(--color-accent), #e5a84e)', color: 'var(--color-primary)' }}
                                        >
                                            <DiscordIcon className="w-4 h-4" />
                                            Login to Save Rankings
                                        </button>
                                    ) : (
                                        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-(--color-accent)/10 border border-(--color-accent)/20 text-(--color-accent) text-sm font-medium">
                                            <ListOrdered className="w-4 h-4" />
                                            Rankings save to your account
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* ─── LEAGUES SECTION ─── */}
            <section id="leagues" className="py-20 px-4">
                <div
                    className="w-2/3 h-px mx-auto mb-20"
                    style={{ background: 'linear-gradient(90deg, transparent, var(--color-accent)/0.3, transparent)' }}
                />

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
                            const isActive = divisions.some(d => d.seasons?.some(s => s.is_active))

                            return (
                                <div key={league.id}>
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
                                                <h3 className={`font-heading text-2xl font-bold ${isActive ? 'text-(--color-text)' : 'text-(--color-text)/40'}`}>
                                                    {league.name}
                                                </h3>
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
                                                const rankImg = RANK_IMAGES[division.tier]
                                                const rankLabel = RANK_LABELS[division.tier]
                                                const activeSeason = division.seasons?.find(s => s.is_active)
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

            {/* ─── PASSION CTA ─── */}
            <section className="py-24 px-4">
                <div className="max-w-3xl mx-auto">
                    <div
                        className="rounded-2xl border border-(--color-accent)/30 relative overflow-hidden"
                        style={{ background: 'linear-gradient(135deg, var(--color-secondary), var(--color-primary))' }}
                    >
                        {/* Fire background effects */}
                        <div
                            className="absolute inset-0 opacity-20 pointer-events-none"
                            style={{ background: 'radial-gradient(ellipse at 50% 100%, var(--color-accent), transparent 60%)' }}
                        />
                        <div
                            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-1/2 opacity-10 pointer-events-none"
                            style={{ background: 'radial-gradient(ellipse at 50% 100%, #ef4444, transparent 70%)' }}
                        />
                        <div
                            className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 -mt-32 opacity-20 pointer-events-none"
                            style={{ background: 'radial-gradient(circle, var(--color-accent), transparent 60%)' }}
                        />

                        {/* Animated flame emojis */}
                        <div className="absolute inset-0 pointer-events-none overflow-hidden">
                            {/* Left flames */}
                            <span className="absolute bottom-8 left-[8%] text-4xl" style={{ animation: 'fireFloat 2s ease-in-out infinite' }}>🔥</span>
                            <span className="absolute bottom-16 left-[15%] text-3xl" style={{ animation: 'fireFloat2 2.4s ease-in-out infinite 0.3s' }}>🔥</span>
                            <span className="absolute bottom-4 left-[22%] text-2xl" style={{ animation: 'fireFloat3 1.8s ease-in-out infinite 0.8s' }}>🔥</span>
                            <span className="absolute bottom-20 left-[5%] text-2xl opacity-60" style={{ animation: 'fireFloat 3s ease-in-out infinite 1.2s' }}>🔥</span>

                            {/* Right flames */}
                            <span className="absolute bottom-8 right-[8%] text-4xl" style={{ animation: 'fireFloat2 2.2s ease-in-out infinite 0.5s' }}>🔥</span>
                            <span className="absolute bottom-16 right-[15%] text-3xl" style={{ animation: 'fireFloat 2.6s ease-in-out infinite 0.2s' }}>🔥</span>
                            <span className="absolute bottom-4 right-[22%] text-2xl" style={{ animation: 'fireFloat3 2s ease-in-out infinite 1s' }}>🔥</span>
                            <span className="absolute bottom-20 right-[5%] text-2xl opacity-60" style={{ animation: 'fireFloat2 2.8s ease-in-out infinite 0.7s' }}>🔥</span>

                            {/* Top accent flames */}
                            <span className="absolute top-6 left-[30%] text-xl opacity-40" style={{ animation: 'fireFloat 3.5s ease-in-out infinite 1.5s' }}>🔥</span>
                            <span className="absolute top-6 right-[30%] text-xl opacity-40" style={{ animation: 'fireFloat2 3s ease-in-out infinite 0.9s' }}>🔥</span>

                            {/* Center big flames */}
                            <span className="absolute bottom-6 left-[42%] text-5xl" style={{ animation: 'fireFloat 2s ease-in-out infinite 0.4s' }}>🔥</span>
                            <span className="absolute bottom-6 right-[42%] text-5xl" style={{ animation: 'fireFloat2 2.3s ease-in-out infinite 0.1s' }}>🔥</span>

                            {/* Embers (small dots rising) */}
                            <span className="absolute bottom-24 left-[35%] w-1.5 h-1.5 rounded-full bg-(--color-accent)" style={{ animation: 'ember 2s ease-out infinite' }} />
                            <span className="absolute bottom-20 left-[50%] w-1 h-1 rounded-full bg-orange-400" style={{ animation: 'ember2 2.5s ease-out infinite 0.5s' }} />
                            <span className="absolute bottom-28 right-[35%] w-1.5 h-1.5 rounded-full bg-(--color-accent)" style={{ animation: 'ember3 1.8s ease-out infinite 1s' }} />
                            <span className="absolute bottom-16 right-[45%] w-1 h-1 rounded-full bg-orange-400" style={{ animation: 'ember 2.2s ease-out infinite 0.3s' }} />
                            <span className="absolute bottom-32 left-[45%] w-1 h-1 rounded-full bg-yellow-300" style={{ animation: 'ember2 3s ease-out infinite 1.4s' }} />
                            <span className="absolute bottom-24 right-[40%] w-1 h-1 rounded-full bg-yellow-300" style={{ animation: 'ember3 2.6s ease-out infinite 0.8s' }} />
                        </div>

                        {/* Content */}
                        <div className="relative z-10 p-10 sm:p-16 text-center">
                            <div className="space-y-3 mb-8">
                                <p
                                    className="font-heading text-2xl sm:text-3xl font-black text-(--color-text) tracking-tight"
                                    style={{ animation: 'passionSlideUp1 1.5s ease-out forwards, passionGlow 3s ease-in-out infinite 1.5s' }}
                                >
                                    Passion never stops
                                </p>
                                <p
                                    className="font-heading text-2xl sm:text-3xl font-black tracking-tight"
                                    style={{
                                        animation: 'passionSlideUp2 1.5s ease-out forwards, passionGlow 3s ease-in-out infinite 2s',
                                        color: 'var(--color-accent)',
                                    }}
                                >
                                    Passion never dies
                                </p>
                                <p
                                    className="font-heading text-3xl sm:text-5xl font-black tracking-tight"
                                    style={{
                                        animation: 'passionSlideUp3 1.5s ease-out forwards, firePulse 2s ease-in-out infinite 2.5s',
                                        backgroundImage: 'linear-gradient(135deg, var(--color-accent), #fde68a, #f97316, var(--color-accent))',
                                        backgroundClip: 'text',
                                        WebkitBackgroundClip: 'text',
                                        color: 'transparent',
                                    }}
                                >
                                    🔥 Unlimited Passion 🔥
                                </p>
                            </div>

                            {hasActiveLeagues && (
                                <a
                                    href="#leagues"
                                    className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-heading font-bold text-lg text-(--color-primary) transition-all duration-300 hover:scale-[1.03] hover:shadow-lg hover:shadow-(--color-accent)/25"
                                    style={{ background: 'linear-gradient(135deg, var(--color-accent), #e5a84e)' }}
                                >
                                    Get Started →
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            </section>

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
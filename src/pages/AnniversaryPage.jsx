import { useState, useEffect, useRef, useCallback } from 'react'
import PageTitle from '../components/PageTitle'
import Navbar from '../components/layout/Navbar'
import { useAuth } from '../context/AuthContext'
import passionCoin from '../assets/passion/passion.png'
import sparkImg from '../assets/spark.png'
import diamondsImg from '../assets/diamonds.png'

// ─── Hardcoded snapshot stats (queried 2026-03-19) ───────────────

const STATS = {
    // Global
    totalUsers: 929,
    totalLeagues: 5,
    totalDivisions: 18,
    totalSeasons: 11,
    totalTeams: 108,
    totalPlayers: 571,

    // Competitive (excludes TSL)
    totalMatches: 364,
    totalGames: 786,
    totalKills: 31764,
    totalDeaths: 31837,
    totalAssists: 62259,
    totalDamage: 162473789,
    totalMitigated: 167326227,

    topKillers: [
        { name: 'DecidingArc11', total_kills: 198, team_name: 'Boo House', team_color: '#2700B9' },
        { name: 'Aewon2085', total_kills: 193, team_name: 'The Kings Court', team_color: '#FFAB4A' },
        { name: 'Pronugget01', total_kills: 182, team_name: 'The Kings Court', team_color: '#FFAB4A' },
        { name: 'PoppinNike', total_kills: 182, team_name: 'The Crew', team_color: '#43FF67' },
        { name: 'DemonicKess', total_kills: 179, team_name: 'Gunshow Shoguns', team_color: '#FFA461' },
    ],
    topKDA: [
        { name: 'Pain-_-6paths', kda: '7.19', games: 9, team_name: 'Food Fighters', team_color: '#f6ba04' },
        { name: 'LDDonno', kda: '6.42', games: 7, team_name: 'Food Fighters', team_color: '#f6ba04' },
        { name: 'Zyrgoli', kda: '5.94', games: 5, team_name: 'Boo House', team_color: '#7148ac' },
        { name: 'Abductz', kda: '5.84', games: 11, team_name: 'The Kings Court', team_color: '#FFAB4A' },
        { name: 'Inferno', kda: '5.83', games: 15, team_name: 'Fallen Angels', team_color: '#4A0093' },
    ],
    topDamage: [
        { name: 'DecidingArc11', total_damage: 966450, team_name: 'Boo House', team_color: '#2700B9' },
        { name: 'Aewon2085', total_damage: 894766, team_name: 'The Kings Court', team_color: '#FFAB4A' },
        { name: 'DemonicKess', total_damage: 844421, team_name: 'Gunshow Shoguns', team_color: '#FFA461' },
        { name: 'zenosyne', total_damage: 821452, team_name: "Baba's Kitchen", team_color: '#FFFFBA' },
        { name: 'Bjartskullar', total_damage: 809546, team_name: 'Eternal Vanguard', team_color: '#A01208' },
    ],
    topGods: [
        { god: 'Hou Yi', picks: 214 },
        { god: 'Anhur', picks: 205 },
        { god: 'Merlin', picks: 195 },
        { god: 'Discordia', picks: 190 },
        { god: 'Baron Samedi', picks: 179 },
        { god: 'Agni', picks: 179 },
        { god: 'Yemoja', picks: 177 },
        { god: 'Hun Batz', picks: 176 },
        { god: 'Hecate', picks: 174 },
        { god: 'Osiris', picks: 164 },
    ],
    topSingleGameKills: { name: 'DoloXL', kills: 24, god_played: 'Hun Batz', team_name: "Baba's Kitchen" },
    topSingleGameDamage: { name: 'Elegy', damage: 83926, god_played: 'Sun Wukong', team_name: 'Fallen Angels' },

    // Per-game averages (min 5 games, excludes TSL)
    avgKillsPerGame: [
        { name: 'Huzzblocker', avg: '10.83', games: 12, team_name: 'La Jungla', team_color: '#F5FFE0' },
        { name: 'LordSaltysteak', avg: '10.45', games: 11, team_name: 'Food Fighters', team_color: '#f6ba04' },
        { name: 'MalwareCookies', avg: '9.88', games: 8, team_name: 'Wailing Banshees', team_color: '#000000' },
        { name: 'Speedy529', avg: '9.17', games: 6, team_name: 'The Kings Court', team_color: '#f9a01b' },
        { name: 'NMR', avg: '9.00', games: 17, team_name: 'The Kings Court', team_color: '#FFAB4A' },
    ],
    avgDamagePerGame: [
        { name: 'Duduin', avg: '37,841', games: 9, team_name: 'Kitsune', team_color: '#e91e63' },
        { name: 'Madame Herta', avg: '37,783', games: 15, team_name: 'The Crew', team_color: '#43FF67' },
        { name: 'Aewon2085', avg: '37,282', games: 24, team_name: 'The Kings Court', team_color: '#FFAB4A' },
        { name: 'Paul', avg: '36,690', games: 11, team_name: 'The Crew', team_color: '#7CFC00' },
        { name: 'Dbz-Spartan', avg: '36,275', games: 16, team_name: 'La Jungla', team_color: '#F5FFE0' },
    ],
    avgDeathsPerGame: [
        { name: 'Clyrical', avg: '10.20', games: 5, team_name: 'Cyberpunk Otters', team_color: '#FF1B8D' },
        { name: 'Cocoa', avg: '8.13', games: 23, team_name: 'Gunshow Shoguns', team_color: '#FFA461' },
        { name: 'MrJU1CY', avg: '8.00', games: 6, team_name: "Boy's Night Out", team_color: '#DF2372' },
        { name: 'Kuzcode', avg: '7.86', games: 7, team_name: 'Eternal Vanguard', team_color: '#f80202' },
        { name: 'Kgluckyme', avg: '7.67', games: 6, team_name: 'Warriors of Albion', team_color: '#0B5D1E' },
    ],
    avgMitigationPerGame: [
        { name: 'SaintZaps', avg: '68,090', games: 5, team_name: 'Eternal Vanguard', team_color: '#f80202' },
        { name: 'OhhViperzz', avg: '62,000', games: 9, team_name: 'Kitsune', team_color: '#e91e63' },
        { name: 'Kc Canna', avg: '61,138', games: 8, team_name: 'Wailing Banshees', team_color: '#000000' },
        { name: 'Snaddy', avg: '60,145', games: 10, team_name: 'Warriors of Albion', team_color: '#0B5D1E' },
        { name: 'Arkatlas', avg: '57,483', games: 9, team_name: 'Cyberpunk Otters', team_color: '#189bcc' },
    ],
    godWinRates: [
        { god: 'Nu Wa', picks: 40, wins: 28, win_rate: '70.0' },
        { god: 'Anubis', picks: 16, wins: 11, win_rate: '68.8' },
        { god: 'Amaterasu', picks: 19, wins: 13, win_rate: '68.4' },
        { god: 'Poseidon', picks: 60, wins: 39, win_rate: '65.0' },
        { god: 'Morgan Le Fay', picks: 14, wins: 9, win_rate: '64.3' },
        { god: 'Pele', picks: 43, wins: 26, win_rate: '60.5' },
        { god: 'Xbalanque', picks: 32, wins: 19, win_rate: '59.4' },
        { god: 'Sylvanus', picks: 78, wins: 46, win_rate: '59.0' },
        { god: 'Hua Mulan', picks: 75, wins: 44, win_rate: '58.7' },
        { god: 'Neith', picks: 133, wins: 78, win_rate: '58.6' },
    ],

    // Passion
    totalPassionEarned: 1185402,
    totalPassionTransactions: 82947,
    challengesCompleted: 37254,
    uniquePassionEarners: 837,
    topPassionEarners: [
        { name: 'caesarbama', total_earned: 6536 },
        { name: 'gsdenny', total_earned: 5859 },
        { name: 'brudif', total_earned: 5791 },
        { name: 'saintzaps', total_earned: 5650 },
        { name: 'mist309', total_earned: 5114 },
    ],
    topStreak: { name: 'caesarbama', longest_streak: 35 },

    // Coin Flip
    totalFlips: 768543,
    totalHeads: 385389,
    uniqueFlippers: 438,
    topFlippers: [
        { name: 'ookthar', total_flips: 196816, total_heads: 98162, best_streak: 19 },
        { name: 'soullesswhisper', total_flips: 157608, total_heads: 78864, best_streak: 18 },
        { name: 'llama._', total_flips: 117332, total_heads: 58728, best_streak: 17 },
        { name: 'itspelley', total_flips: 45693, total_heads: 22913, best_streak: 13 },
        { name: 'rorymercury420', total_flips: 38752, total_heads: 19354, best_streak: 12 },
        { name: 'bapponohacko288', total_flips: 35961, total_heads: 17938, best_streak: 14 },
        { name: 'bdubz__', total_flips: 31150, total_heads: 15572, best_streak: 14 },
        { name: 'cob5358', total_flips: 26036, total_heads: 12992, best_streak: 14 },
        { name: 'tropicalwastaken', total_flips: 19462, total_heads: 9766, best_streak: 11 },
        { name: 'saltynugget01', total_flips: 8624, total_heads: 4364, best_streak: 10 },
    ],
    topFlipStreaks: [
        { name: 'ookthar', best_streak: 19 },
        { name: 'soullesswhisper', best_streak: 18 },
        { name: 'llama._', best_streak: 17 },
        { name: 'yserrra', best_streak: 15 },
        { name: 'bdubz__', best_streak: 14 },
    ],

    // Forge
    forgeTransactions: 6200,
    totalSparksFueled: 8794,
    totalSparksCooled: 3883,
    forgeVolume: 900773,
    uniqueForgeUsers: 569,
    topBuyers: [
        { name: 'caesarbama', total_spent: 10091, total_sparks: 202 },
        { name: 'azteck.', total_spent: 10089, total_sparks: 172 },
        { name: 'crux7897', total_spent: 9779, total_sparks: 177 },
        { name: 'cojafox', total_spent: 8634, total_sparks: 160 },
        { name: 'llama._', total_spent: 8509, total_sparks: 147 },
    ],
    topSellers: [
        { name: 'caesarbama', total_earned: 11332, total_sparks: 198 },
        { name: 'azteck.', total_earned: 6967, total_sparks: 117 },
        { name: 'crux7897', total_earned: 6417, total_sparks: 101 },
        { name: 'cojafox', total_earned: 6292, total_sparks: 124 },
        { name: 'twinkletoes12._.', total_earned: 5715, total_sparks: 97 },
    ],
    topInvestedPlayers: [
        { name: 'Paul', market_cap: 43927 },
        { name: 'SonPradeje', market_cap: 15695 },
        { name: 'LordSaltysteak', market_cap: 13269 },
        { name: 'PrimeXXI', market_cap: 13108 },
        { name: 'Tegveer', market_cap: 11548 },
    ],

    // Vault
    totalCards: 422187,
    totalTrades: 5825,
    totalListings: 6133,
    totalGifts: 5816,
    totalPacksOpened: 129801,
    uniqueVaultUsers: 772,
    totalBinders: 130,
    totalBounties: 438,
    topCollectors: [
        { name: 'ezeuz_', card_count: 5544 },
        { name: 'itzwitzx', card_count: 5422 },
        { name: 'llama._', card_count: 5278 },
        { name: 'gsdenny', card_count: 5097 },
        { name: 'kazar5', card_count: 4915 },
    ],
    topPackOpeners: [
        { name: 'gsdenny', packs_opened: 1769 },
        { name: 'itzwitzx', packs_opened: 1380 },
        { name: 'ezeuz_', packs_opened: 1367 },
        { name: 'mist309', packs_opened: 1305 },
        { name: 'im.a.h.a.n', packs_opened: 1239 },
    ],
    topTraders: [
        { name: 'itzwitzx', trade_count: 468 },
        { name: 'gsdenny', trade_count: 464 },
        { name: 'chipsorsoda', trade_count: 462 },
        { name: '.d1egox', trade_count: 452 },
        { name: 'llama._', trade_count: 433 },
    ],
    totalCardsGenerated: 798595,
    uniqueCardsPulled: 21,

    // Site Traffic (Cloudflare Web Analytics, Feb 19 – Mar 19)
    totalPageLoads: 137850,
    totalVisits: 44720,
    peakDay: { date: 'March 12', views: 19630, visits: 5490 },
    deviceSplit: { desktop: 97860, mobile: 39920 },

    // Match Reporters
    topReporters: [
        { name: 'caesarbama', matches_reported: 196 },
        { name: 'saintzaps', matches_reported: 37 },
        { name: 'crux7897', matches_reported: 29 },
        { name: 'asinus', matches_reported: 23 },
        { name: 'celestewish', matches_reported: 16 },
        { name: 'bdubz__', matches_reported: 14 },
        { name: 'akuma007', matches_reported: 12 },
        { name: 'rigz011', matches_reported: 9 },
        { name: 'alias711', matches_reported: 2 },
        { name: 'brian.codex', matches_reported: 1 },
    ],

    // Community
    totalTierlistPosts: 25,
    totalTierlistLikes: 21,
    totalGodTierlists: 42,
    totalScrims: 102,
    totalFeedback: 31,
    totalReferrals: 240,
    totalCommunityTeams: 26,
}

// ─── Helpers ─────────────────────────────────────────────

const fmt = (n) => Number(n).toLocaleString()
const fmtShort = (n) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
    return fmt(n)
}

// ─── Main Page ───────────────────────────────────────────

export default function AnniversaryPage() {
    const { user } = useAuth()
    const [personal, setPersonal] = useState(null)

    useEffect(() => {
        if (!user) return
        const token = localStorage.getItem('auth_token')
        if (!token) return
        fetch('/api/anniversary', { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .then(d => setPersonal(d.personal))
            .catch(() => {})
    }, [user])

    return (
        <div className="min-h-screen bg-(--color-primary) text-(--color-text)">
            <PageTitle
                title="1 Month Anniversary"
                description="Celebrating one month of SMITE 2 Companion! See the stats, records, and milestones from our incredible first month."
            />
            <Navbar title="Anniversary" />

            {/* ═══ Hero Banner ═══ */}
            <HeroBanner />

            {/* ═══ By The Numbers ═══ */}
            <div className="max-w-6xl mx-auto px-4 pb-20 space-y-16">
                <ByTheNumbers />
                <SiteTrafficSection />
                <CompetitiveSection />
                <PassionSection />
                <CoinFlipSection />
                <ForgeSection />
                <VaultSection />
                <CommunitySection />
                {personal && <PersonalSection personal={personal} />}

                {/* Footer */}
                <div className="text-center pt-8 pb-4">
                    <p className="text-white/30 text-sm">
                        Stats snapshot taken March 19, 2026
                    </p>
                    <p className="text-white/20 text-xs mt-1">
                        Here's to many more months of competition, community, and chaos.
                    </p>
                </div>
            </div>

            <style>{anniversaryStyles}</style>
        </div>
    )
}

// ─── Hero Banner with Confetti ───────────────────────────

function HeroBanner() {
    const canvasRef = useRef(null)
    const particlesRef = useRef([])
    const rafRef = useRef(null)
    const visibleRef = useRef(true)
    const mouseRef = useRef({ x: -1, y: -1 })
    const imgRef = useRef(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')

        let running = true
        let lastTick = 0
        const FRAME_INTERVAL = 33

        const img = new Image()
        img.onload = () => {
            if (!running) return
            imgRef.current = img
            initParticles()
            rafRef.current = requestAnimationFrame(tick)
        }
        img.src = diamondsImg

        function resize() {
            const parent = canvas.parentElement
            canvas.width = parent.offsetWidth
            canvas.height = parent.offsetHeight
        }

        function initParticles() {
            resize()
            const count = Math.min(Math.floor(canvas.width / 35), 50)
            particlesRef.current = Array.from({ length: count }, () => createParticle(true, false))
        }

        function createParticle(randomY, fromMouse) {
            const mx = mouseRef.current.x
            const my = mouseRef.current.y

            if (fromMouse && mx >= 0) {
                const angle = Math.random() * Math.PI * 2
                const velocity = 2 + Math.random() * 5
                const size = 8 + Math.random() * 16
                return {
                    x: mx + (Math.random() - 0.5) * 10,
                    y: my + (Math.random() - 0.5) * 10,
                    size,
                    speed: Math.sin(angle) * velocity,
                    drift: Math.cos(angle) * velocity,
                    rotation: Math.random() * Math.PI * 2,
                    rotSpeed: (Math.random() - 0.5) * 0.1,
                    opacity: 0.2 + Math.random() * 0.25,
                    life: 1.0,
                    isBurst: true,
                    hue: Math.random() * 360,
                }
            }

            const size = 12 + Math.random() * 22
            return {
                x: Math.random() * canvas.width,
                y: randomY ? -size - Math.random() * canvas.height * 1.5 : -size - Math.random() * 80,
                size,
                speed: 0.3 + Math.random() * 0.7,
                drift: (Math.random() - 0.5) * 0.3,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.015,
                opacity: 0.06 + Math.random() * 0.12,
                life: null,
                isBurst: false,
                hue: 0,
            }
        }

        function onMouseMove(e) {
            const rect = canvas.getBoundingClientRect()
            mouseRef.current.x = e.clientX - rect.left
            mouseRef.current.y = e.clientY - rect.top
            const particles = particlesRef.current
            for (let i = 0; i < 3; i++) {
                if (particles.length < 250) particles.push(createParticle(false, true))
            }
        }

        function onMouseLeave() {
            mouseRef.current.x = -1
            mouseRef.current.y = -1
        }

        canvas.addEventListener('mousemove', onMouseMove)
        canvas.addEventListener('mouseleave', onMouseLeave)

        function tick(now) {
            if (!running) return
            rafRef.current = requestAnimationFrame(tick)
            if (!visibleRef.current) return
            if (now - lastTick < FRAME_INTERVAL) return
            lastTick = now

            ctx.clearRect(0, 0, canvas.width, canvas.height)
            const diamondImage = imgRef.current
            if (!diamondImage) return

            const particles = particlesRef.current
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i]
                p.y += p.speed
                p.x += p.drift
                p.rotation += p.rotSpeed

                if (p.isBurst) {
                    p.life -= 0.016
                    p.speed *= 0.97
                    p.drift *= 0.97
                    if (p.life <= 0) { particles.splice(i, 1); continue }
                } else if (p.y > canvas.height + p.size) {
                    Object.assign(p, createParticle(false, false))
                }

                const alpha = p.isBurst ? p.opacity * p.life : p.opacity

                ctx.save()
                ctx.globalAlpha = alpha
                ctx.translate(p.x, p.y)
                ctx.rotate(p.rotation)
                if (p.isBurst) {
                    ctx.filter = `hue-rotate(${p.hue}deg) brightness(1.5)`
                }
                ctx.drawImage(diamondImage, -p.size / 2, -p.size / 2, p.size, p.size)
                ctx.restore()
            }
        }

        const io = new IntersectionObserver(([entry]) => {
            visibleRef.current = entry.isIntersecting
        }, { threshold: 0 })
        io.observe(canvas.parentElement)

        const ro = new ResizeObserver(() => resize())
        ro.observe(canvas.parentElement)

        return () => {
            running = false
            cancelAnimationFrame(rafRef.current)
            canvas.removeEventListener('mousemove', onMouseMove)
            canvas.removeEventListener('mouseleave', onMouseLeave)
            io.disconnect()
            ro.disconnect()
        }
    }, [])

    return (
        <div className="relative overflow-hidden">
            {/* Background gradient */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0" style={{
                    background: 'linear-gradient(180deg, #0a0520 0%, #1a0a30 25%, #0d0618 50%, var(--color-primary) 100%)',
                }} />
                <div className="absolute top-0 left-1/4 w-[600px] h-[400px] rounded-full opacity-25 blur-3xl"
                    style={{ background: 'radial-gradient(ellipse, #8b5cf6, transparent 70%)' }}
                />
                <div className="absolute top-10 right-1/4 w-[500px] h-[350px] rounded-full opacity-20 blur-3xl"
                    style={{ background: 'radial-gradient(ellipse, #f59e0b, transparent 70%)' }}
                />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[900px] h-[300px] rounded-full opacity-15 blur-3xl"
                    style={{ background: 'radial-gradient(ellipse, #ec4899, transparent 60%)' }}
                />
                <div className="absolute inset-0" style={{
                    background: 'radial-gradient(ellipse at center, transparent 40%, rgba(6,5,26,0.8) 100%)',
                }} />
            </div>

            {/* Confetti canvas */}
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ zIndex: 1 }} />

            <div className="relative max-w-5xl mx-auto px-4 pt-28 pb-20 text-center" style={{ zIndex: 2, pointerEvents: 'none' }}>
                <span className="inline-block text-xs font-bold uppercase tracking-[0.3em] mb-4 anniv-glow-text"
                    style={{ color: '#f59e0b' }}
                >
                    February 19 &mdash; March 19, 2026
                </span>
                <h1 className="font-heading text-5xl sm:text-6xl lg:text-7xl font-black mb-5 leading-[1.1]">
                    <span className="block text-white drop-shadow-lg">1 Month of</span>
                    <span className="block mt-1 anniv-title-gradient">
                        SmiteComp
                    </span>
                </h1>
                <p className="text-white/70 text-base sm:text-lg max-w-2xl mx-auto mb-6 leading-relaxed">
                    From zero to {fmt(STATS.totalUsers)} users, {fmt(STATS.totalGames)} games played across 4 leagues,
                    and {fmtShort(STATS.totalCards)} cards collected.
                    Here's what one month of community looks like.
                </p>

                {/* Floating stat pills */}
                <div className="flex flex-wrap justify-center gap-3">
                    {[
                        { label: 'Users', value: STATS.totalUsers },
                        { label: 'Leagues', value: STATS.totalLeagues },
                        { label: 'Teams', value: STATS.totalTeams },
                        { label: 'Seasons', value: STATS.totalSeasons },
                    ].map(s => (
                        <div key={s.label} className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 text-sm"
                            style={{ background: 'rgba(255,255,255,0.04)' }}
                        >
                            <span className="font-bold text-white">{fmt(s.value)}</span>
                            <span className="text-white/50">{s.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Decorative floating diamonds */}
            <div className="hidden sm:block pointer-events-none" style={{ zIndex: 2 }}>
                <img src={diamondsImg} alt="" className="absolute left-8 top-1/2 w-10 h-10 opacity-20 rotate-12"
                    style={{ animation: 'anniv-float 4s ease-in-out infinite' }}
                />
                <img src={diamondsImg} alt="" className="absolute right-8 top-1/3 w-12 h-12 opacity-15 -rotate-12"
                    style={{ animation: 'anniv-float 5s ease-in-out 1s infinite' }}
                />
            </div>
        </div>
    )
}

// ─── By The Numbers (big hero stats grid) ────────────────

function ByTheNumbers() {
    const stats = [
        { label: 'Sets Played', value: STATS.totalMatches, icon: '🏟️' },
        { label: 'Games Played', value: STATS.totalGames, icon: '⚔️' },
        { label: 'Active Players', value: STATS.totalPlayers, icon: '🎮' },
        { label: 'Total Kills', value: STATS.totalKills, icon: '💀' },
        { label: 'Total Assists', value: STATS.totalAssists, icon: '🤝' },
        { label: 'Damage Dealt', value: STATS.totalDamage, icon: '💥' },
        { label: 'Damage Mitigated', value: STATS.totalMitigated, icon: '🛡️' },
        { label: 'Packs Opened', value: STATS.totalPacksOpened, icon: '🎴' },
    ]

    return (
        <section>
            <SectionHeader title="By The Numbers" subtitle="The big picture after 30 days" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {stats.map(s => (
                    <div key={s.label}
                        className="rounded-xl border border-white/8 p-4 text-center transition-all hover:border-white/15 hover:scale-[1.02]"
                        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))' }}
                    >
                        <div className="text-2xl mb-1">{s.icon}</div>
                        <div className="text-xl sm:text-2xl font-bold font-heading text-white">
                            {s.value >= 1_000_000 ? fmtShort(s.value) : fmt(s.value)}
                        </div>
                        <div className="text-xs text-white/50 mt-0.5">{s.label}</div>
                    </div>
                ))}
            </div>
        </section>
    )
}

// ─── Site Traffic Section ────────────────────────────────

function SiteTrafficSection() {
    return (
        <section>
            <SectionHeader
                title="Site Traffic"
                subtitle="How people found and used SmiteComp"
                accent="#6366f1"
            />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {[
                    { label: 'Page Loads', value: fmtShort(STATS.totalPageLoads) },
                    { label: 'Visits', value: fmtShort(STATS.totalVisits) },
                    { label: 'Peak Day', value: `${fmtShort(STATS.peakDay.views)} views` },
                    { label: 'Desktop / Mobile', value: `${Math.round(STATS.deviceSplit.desktop / (STATS.deviceSplit.desktop + STATS.deviceSplit.mobile) * 100)}% / ${Math.round(STATS.deviceSplit.mobile / (STATS.deviceSplit.desktop + STATS.deviceSplit.mobile) * 100)}%` },
                ].map(s => (
                    <div key={s.label}
                        className="rounded-xl border p-4 text-center"
                        style={{
                            background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(99,102,241,0.02))',
                            borderColor: 'rgba(99,102,241,0.15)',
                        }}
                    >
                        <div className="text-lg sm:text-xl font-bold font-heading text-white">{s.value}</div>
                        <div className="text-xs text-white/50">{s.label}</div>
                    </div>
                ))}
            </div>

        </section>
    )
}

// ─── Competitive Section ─────────────────────────────────

function CompetitiveSection() {
    return (
        <section>
            <SectionHeader
                title="The Battlefield"
                subtitle="Combat stats across all leagues and divisions"
                accent="#ef4444"
            />

            {/* Records */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                <RecordCard
                    label="Highest Single-Game Kills"
                    value={STATS.topSingleGameKills.kills}
                    detail={`${STATS.topSingleGameKills.name} as ${STATS.topSingleGameKills.god_played}`}
                    sub={STATS.topSingleGameKills.team_name}
                    accent="#ef4444"
                />
                <RecordCard
                    label="Highest Single-Game Damage"
                    value={fmt(STATS.topSingleGameDamage.damage)}
                    detail={`${STATS.topSingleGameDamage.name} as ${STATS.topSingleGameDamage.god_played}`}
                    sub={STATS.topSingleGameDamage.team_name}
                    accent="#f97316"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Top5Card
                    title="Kill Leaders"
                    items={STATS.topKillers.map(p => ({
                        name: p.name,
                        value: fmt(p.total_kills),
                        color: p.team_color,
                        sub: p.team_name,
                    }))}
                    accent="#ef4444"
                />
                <Top5Card
                    title="KDA Leaders"
                    items={STATS.topKDA.map(p => ({
                        name: p.name,
                        value: p.kda,
                        color: p.team_color,
                        sub: `${p.games} games`,
                    }))}
                    accent="#f59e0b"
                    valueLabel="KDA"
                />
                <Top5Card
                    title="Damage Leaders"
                    items={STATS.topDamage.map(p => ({
                        name: p.name,
                        value: fmtShort(p.total_damage),
                        color: p.team_color,
                        sub: p.team_name,
                    }))}
                    accent="#f97316"
                />
            </div>

            {/* Per-Game Averages */}
            <h3 className="text-sm font-bold uppercase tracking-wider text-white/60 mt-8 mb-4">Per-Game Averages</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <Top5Card
                    title="Kills / Game"
                    items={STATS.avgKillsPerGame.map(p => ({
                        name: p.name,
                        value: p.avg,
                        color: p.team_color,
                        sub: `${p.games} games`,
                    }))}
                    accent="#ef4444"
                />
                <Top5Card
                    title="Damage / Game"
                    items={STATS.avgDamagePerGame.map(p => ({
                        name: p.name,
                        value: p.avg,
                        color: p.team_color,
                        sub: `${p.games} games`,
                    }))}
                    accent="#f97316"
                />
                <Top5Card
                    title="Deaths / Game"
                    items={STATS.avgDeathsPerGame.map(p => ({
                        name: p.name,
                        value: p.avg,
                        color: p.team_color,
                        sub: `${p.games} games`,
                    }))}
                    accent="#8b5cf6"
                />
                <Top5Card
                    title="Mitigation / Game"
                    items={STATS.avgMitigationPerGame.map(p => ({
                        name: p.name,
                        value: p.avg,
                        color: p.team_color,
                        sub: `${p.games} games`,
                    }))}
                    accent="#3b82f6"
                />
            </div>

            {/* God Stats */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Most Played Gods */}
                <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white/60 mb-3">Most Played Gods</h3>
                    <div className="flex flex-wrap gap-2">
                        {STATS.topGods.map((g, i) => (
                            <div key={g.god}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/8 text-sm"
                                style={{
                                    background: `rgba(239, 68, 68, ${0.08 - i * 0.006})`,
                                    borderColor: `rgba(239, 68, 68, ${0.2 - i * 0.015})`,
                                }}
                            >
                                <span className="font-bold text-white/80">#{i + 1}</span>
                                <span className="text-white/90">{g.god}</span>
                                <span className="text-white/40">{g.picks} picks</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* God Win Rates */}
                <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white/60 mb-3">Highest Win Rate Gods <span className="text-white/30 normal-case font-normal">(min 10 picks)</span></h3>
                    <div className="flex flex-wrap gap-2">
                        {STATS.godWinRates.map((g, i) => (
                            <div key={g.god}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/8 text-sm"
                                style={{
                                    background: `rgba(34, 197, 94, ${0.08 - i * 0.006})`,
                                    borderColor: `rgba(34, 197, 94, ${0.2 - i * 0.015})`,
                                }}
                            >
                                <span className="font-bold text-white/80">#{i + 1}</span>
                                <span className="text-white/90">{g.god}</span>
                                <span className="text-green-400/70">{g.win_rate}%</span>
                                <span className="text-white/30">{g.picks}g</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    )
}

// ─── Passion Section ─────────────────────────────────────

function PassionSection() {
    return (
        <section>
            <SectionHeader
                title="Passion"
                subtitle="The lifeblood of the community"
                accent="#a855f7"
                icon={<img src={passionCoin} alt="" className="w-6 h-6" />}
            />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {[
                    { label: 'Total Earned', value: fmt(STATS.totalPassionEarned), icon: '🔥' },
                    { label: 'Transactions', value: fmt(STATS.totalPassionTransactions), icon: '📊' },
                    { label: 'Challenges Done', value: fmt(STATS.challengesCompleted), icon: '✅' },
                    { label: 'Active Earners', value: fmt(STATS.uniquePassionEarners), icon: '👥' },
                ].map(s => (
                    <div key={s.label}
                        className="rounded-xl border p-4 text-center"
                        style={{
                            background: 'linear-gradient(135deg, rgba(168,85,247,0.06), rgba(168,85,247,0.02))',
                            borderColor: 'rgba(168,85,247,0.15)',
                        }}
                    >
                        <div className="text-lg mb-0.5">{s.icon}</div>
                        <div className="text-lg sm:text-xl font-bold font-heading text-white">{s.value}</div>
                        <div className="text-xs text-white/50">{s.label}</div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Top5Card
                    title="Top Earners"
                    items={STATS.topPassionEarners.map(p => ({
                        name: p.name,
                        value: fmt(p.total_earned),
                        sub: 'Passion earned',
                    }))}
                    accent="#a855f7"
                    valueLabel="Earned"
                />
                <div className="rounded-xl border p-5"
                    style={{
                        background: 'linear-gradient(135deg, rgba(168,85,247,0.06), rgba(168,85,247,0.02))',
                        borderColor: 'rgba(168,85,247,0.15)',
                    }}
                >
                    <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: '#a855f7' }}>
                        Records
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <div className="text-white/50 text-xs uppercase tracking-wider mb-1">Longest Daily Streak</div>
                            <div className="text-2xl font-bold font-heading text-white">
                                {STATS.topStreak.longest_streak} days
                            </div>
                            <div className="text-sm text-white/40">{STATS.topStreak.name}</div>
                        </div>
                        <div>
                            <div className="text-white/50 text-xs uppercase tracking-wider mb-1">Avg Passion Per Earner</div>
                            <div className="text-2xl font-bold font-heading text-white">
                                {fmt(Math.round(STATS.totalPassionEarned / STATS.uniquePassionEarners))}
                            </div>
                        </div>
                        <div>
                            <div className="text-white/50 text-xs uppercase tracking-wider mb-1">Challenges Per User</div>
                            <div className="text-2xl font-bold font-heading text-white">
                                {(STATS.challengesCompleted / STATS.uniquePassionEarners).toFixed(1)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

// ─── Coin Flip Section ───────────────────────────────────

function CoinFlipSection() {
    return (
        <section>
            <SectionHeader
                title="Coin Flip"
                subtitle="Heads or tails — 768K times and counting"
                accent="#eab308"
                icon={<img src={passionCoin} alt="" className="w-6 h-6" />}
            />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {[
                    { label: 'Total Flips', value: fmtShort(STATS.totalFlips) },
                    { label: 'Heads Landed', value: fmtShort(STATS.totalHeads) },
                    { label: 'Tails Landed', value: fmtShort(STATS.totalFlips - STATS.totalHeads) },
                    { label: 'Unique Flippers', value: fmt(STATS.uniqueFlippers) },
                ].map(s => (
                    <div key={s.label}
                        className="rounded-xl border p-4 text-center"
                        style={{
                            background: 'linear-gradient(135deg, rgba(234,179,8,0.06), rgba(234,179,8,0.02))',
                            borderColor: 'rgba(234,179,8,0.15)',
                        }}
                    >
                        <div className="text-lg sm:text-xl font-bold font-heading text-white">{s.value}</div>
                        <div className="text-xs text-white/50">{s.label}</div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Top5Card
                    title="Most Flips"
                    items={STATS.topFlippers.slice(0, 5).map(p => ({
                        name: p.name,
                        value: fmtShort(p.total_flips),
                        sub: `${Math.round(p.total_heads / p.total_flips * 100)}% heads`,
                    }))}
                    accent="#eab308"
                />
                <div>
                    <Top5Card
                        title="Longest Win Streak"
                        items={STATS.topFlipStreaks.map(p => ({
                            name: p.name,
                            value: `${p.best_streak} in a row`,
                        }))}
                        accent="#f59e0b"
                    />
                </div>
            </div>

            {/* Bottom 5 flippers */}
            <div className="mt-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-white/60 mb-3">Honorable Mentions (6-10)</h3>
                <div className="flex flex-wrap gap-2">
                    {STATS.topFlippers.slice(5).map((p, i) => (
                        <div key={p.name}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/8 text-sm"
                            style={{ background: 'rgba(234,179,8,0.04)' }}
                        >
                            <span className="font-bold text-white/60">#{i + 6}</span>
                            <span className="text-white/80">{p.name}</span>
                            <span className="text-white/40">{fmtShort(p.total_flips)} flips</span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

// ─── Forge Section ───────────────────────────────────────

function ForgeSection() {
    return (
        <section>
            <SectionHeader
                title="Fantasy Forge"
                subtitle="Player investment market in full swing"
                accent="#e86520"
                icon={<img src={sparkImg} alt="" className="w-6 h-6" />}
            />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {[
                    { label: 'Transactions', value: fmt(STATS.forgeTransactions) },
                    { label: 'Sparks Fueled', value: fmt(STATS.totalSparksFueled) },
                    { label: 'Sparks Cooled', value: fmt(STATS.totalSparksCooled) },
                    { label: 'Passion Volume', value: fmt(STATS.forgeVolume) },
                ].map(s => (
                    <div key={s.label}
                        className="rounded-xl border p-4 text-center"
                        style={{
                            background: 'linear-gradient(135deg, rgba(232,101,32,0.08), rgba(232,101,32,0.02))',
                            borderColor: 'rgba(232,101,32,0.2)',
                        }}
                    >
                        <div className="text-lg sm:text-xl font-bold font-heading text-white">{s.value}</div>
                        <div className="text-xs text-white/50">{s.label}</div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Top5Card
                    title="Biggest Buyers"
                    items={STATS.topBuyers.map(p => ({
                        name: p.name,
                        value: fmt(p.total_spent),
                        sub: `${p.total_sparks} Sparks bought`,
                    }))}
                    accent="#e86520"
                />
                <Top5Card
                    title="Biggest Sellers"
                    items={STATS.topSellers.map(p => ({
                        name: p.name,
                        value: fmt(p.total_earned),
                        sub: `${p.total_sparks} Sparks sold`,
                    }))}
                    accent="#d4a030"
                />
                <Top5Card
                    title="Highest Market Cap"
                    items={STATS.topInvestedPlayers.map(p => ({
                        name: p.name,
                        value: fmt(p.market_cap),
                        sub: 'Market cap',
                    }))}
                    accent="#ffaa33"
                />
            </div>

            <div className="mt-4 text-center">
                <span className="text-sm text-white/40">
                    {fmt(STATS.uniqueForgeUsers)} unique traders
                </span>
            </div>
        </section>
    )
}

// ─── Vault Section ───────────────────────────────────────

function VaultSection() {
    return (
        <section>
            <SectionHeader
                title="The Vault"
                subtitle="Card collecting, trading, and battling"
                accent="#00e5ff"
            />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {[
                    { label: 'Cards in Circulation', value: fmtShort(STATS.totalCards) },
                    { label: 'Packs Opened', value: fmtShort(STATS.totalPacksOpened) },
                    { label: 'Trades Completed', value: fmt(STATS.totalTrades) },
                    { label: 'Gifts Sent', value: fmt(STATS.totalGifts) },
                    { label: 'Marketplace Listings', value: fmt(STATS.totalListings) },
                    { label: 'Bounties Posted', value: fmt(STATS.totalBounties) },
                    { label: 'Binders Created', value: fmt(STATS.totalBinders) },
                    { label: 'Unique Collectors', value: fmt(STATS.uniqueVaultUsers) },
                ].map(s => (
                    <div key={s.label}
                        className="rounded-xl border p-4 text-center"
                        style={{
                            background: 'linear-gradient(135deg, rgba(0,229,255,0.06), rgba(0,229,255,0.01))',
                            borderColor: 'rgba(0,229,255,0.15)',
                        }}
                    >
                        <div className="text-lg sm:text-xl font-bold font-heading text-white">{s.value}</div>
                        <div className="text-xs text-white/50">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Card generation highlights */}
            <div className="grid grid-cols-2 gap-3 mb-6">
                {[
                    { label: 'Total Cards Generated', value: fmtShort(STATS.totalCardsGenerated), color: '#00e5ff' },
                    { label: 'Unique Cards Pulled', value: fmt(STATS.uniqueCardsPulled), color: '#ec4899' },
                ].map(s => (
                    <div key={s.label}
                        className="rounded-xl border p-4 text-center"
                        style={{
                            background: `linear-gradient(135deg, ${s.color}12, ${s.color}05)`,
                            borderColor: `${s.color}30`,
                        }}
                    >
                        <div className="text-2xl sm:text-3xl font-black font-heading" style={{ color: s.color }}>
                            {s.value}
                        </div>
                        <div className="text-xs text-white/50 mt-1">{s.label}</div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Top5Card
                    title="Top Collectors"
                    items={STATS.topCollectors.map(p => ({
                        name: p.name,
                        value: fmt(p.card_count),
                        sub: 'cards owned',
                    }))}
                    accent="#00e5ff"
                />
                <Top5Card
                    title="Most Packs Opened"
                    items={STATS.topPackOpeners.map(p => ({
                        name: p.name,
                        value: fmt(p.packs_opened),
                        sub: 'packs',
                    }))}
                    accent="#b44aff"
                />
                <Top5Card
                    title="Top Traders"
                    items={STATS.topTraders.map(p => ({
                        name: p.name,
                        value: fmt(p.trade_count),
                        sub: 'trades',
                    }))}
                    accent="#ff2d78"
                />
            </div>
        </section>
    )
}

// ─── Community Section ───────────────────────────────────

function CommunitySection() {
    return (
        <section>
            <SectionHeader
                title="Community"
                subtitle="Built by players, for players"
                accent="#22c55e"
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Scrim Requests', value: STATS.totalScrims, icon: '📅' },
                    { label: 'Referrals', value: STATS.totalReferrals, icon: '🔗' },
                    { label: 'God Tier Lists', value: STATS.totalGodTierlists, icon: '📋' },
                    { label: 'Community Teams', value: STATS.totalCommunityTeams, icon: '👥' },
                    { label: 'Tier List Posts', value: STATS.totalTierlistPosts, icon: '📝' },
                    { label: 'Tier List Likes', value: STATS.totalTierlistLikes, icon: '❤️' },
                    { label: 'Feedback Sent', value: STATS.totalFeedback, icon: '💬' },
                    { label: 'Registered Users', value: STATS.totalUsers, icon: '🌟' },
                ].map(s => (
                    <div key={s.label}
                        className="rounded-xl border p-4 text-center"
                        style={{
                            background: 'linear-gradient(135deg, rgba(34,197,94,0.05), rgba(34,197,94,0.01))',
                            borderColor: 'rgba(34,197,94,0.12)',
                        }}
                    >
                        <div className="text-lg mb-0.5">{s.icon}</div>
                        <div className="text-lg font-bold font-heading text-white">{fmt(s.value)}</div>
                        <div className="text-xs text-white/50">{s.label}</div>
                    </div>
                ))}
            </div>

            <div className="mt-6 rounded-xl border p-5"
                style={{
                    background: 'linear-gradient(135deg, rgba(34,197,94,0.04), rgba(34,197,94,0.01))',
                    borderColor: 'rgba(34,197,94,0.12)',
                }}
            >
                <h3 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: '#22c55e' }}>
                    Match Reporters
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {STATS.topReporters.map((p, i) => (
                        <div key={p.name} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                            style={{ background: 'rgba(34,197,94,0.04)' }}
                        >
                            <span className="text-sm text-white/50 w-5">{i + 1}.</span>
                            <span className="text-sm font-semibold text-white truncate flex-1">{p.name}</span>
                            <span className="text-sm font-bold text-white/70">{p.matches_reported}</span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

// ─── Personal Section (logged-in only) ───────────────────

function PersonalSection({ personal }) {
    const items = []

    if (personal.competitive) {
        const c = personal.competitive
        items.push(
            { label: 'Your Games Played', value: fmt(c.gamesPlayed) },
            { label: 'Your Kills', value: fmt(c.kills) },
            { label: 'Your Deaths', value: fmt(c.deaths) },
            { label: 'Your Assists', value: fmt(c.assists) },
        )
        if (c.damage > 0) items.push({ label: 'Your Damage Dealt', value: fmt(c.damage) })
    }

    if (personal.passion) {
        const p = personal.passion
        items.push(
            { label: 'Your Passion Earned', value: fmt(p.totalEarned) },
            { label: 'Your Current Balance', value: fmt(p.balance) },
            { label: 'Your Longest Streak', value: `${p.longestStreak} days` },
        )
    }

    if (personal.challengesCompleted > 0) {
        items.push({ label: 'Your Challenges Completed', value: fmt(personal.challengesCompleted) })
    }

    if (personal.forge) {
        items.push(
            { label: 'Your Forge Trades', value: fmt(personal.forge.transactions) },
            { label: 'Your Sparks Held', value: fmt(personal.forge.sparksHeld) },
        )
    }

    if (personal.vault) {
        const v = personal.vault
        items.push(
            { label: 'Your Cards Owned', value: fmt(v.cardsOwned) },
            { label: 'Your Packs Opened', value: fmt(v.packsOpened) },
        )
        if (v.wins + v.losses > 0) {
            items.push({ label: 'Your Battle Record', value: `${v.wins}W - ${v.losses}L` })
        }
    }

    if (items.length === 0) return null

    return (
        <section>
            <SectionHeader
                title="Your First Month"
                subtitle="Your personal stats at a glance"
                accent="#ec4899"
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {items.map(s => (
                    <div key={s.label}
                        className="rounded-xl border p-4 text-center"
                        style={{
                            background: 'linear-gradient(135deg, rgba(236,72,153,0.06), rgba(236,72,153,0.02))',
                            borderColor: 'rgba(236,72,153,0.15)',
                        }}
                    >
                        <div className="text-lg font-bold font-heading text-white">{s.value}</div>
                        <div className="text-xs text-white/50">{s.label}</div>
                    </div>
                ))}
            </div>
        </section>
    )
}

// ─── Shared Components ───────────────────────────────────

function SectionHeader({ title, subtitle, accent, icon }) {
    return (
        <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
                {icon}
                <h2 className="font-heading text-2xl sm:text-3xl font-bold" style={accent ? { color: accent } : {}}>
                    {title}
                </h2>
            </div>
            {subtitle && <p className="text-sm text-white/40">{subtitle}</p>}
            <div className="mt-3 h-px" style={{
                background: accent
                    ? `linear-gradient(90deg, ${accent}40, transparent)`
                    : 'linear-gradient(90deg, rgba(255,255,255,0.1), transparent)',
            }} />
        </div>
    )
}

function Top5Card({ title, items, accent = '#fff', valueLabel }) {
    const medals = ['🥇', '🥈', '🥉', '4.', '5.']
    return (
        <div className="rounded-xl border p-5"
            style={{
                background: `linear-gradient(135deg, ${accent}10, ${accent}05)`,
                borderColor: `${accent}25`,
            }}
        >
            <h3 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: accent }}>
                {title}
            </h3>
            <div className="space-y-2.5">
                {items.map((item, i) => (
                    <div key={item.name} className="flex items-center gap-3">
                        <span className="text-sm w-6 text-center shrink-0">
                            {medals[i]}
                        </span>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                {item.color && (
                                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                                )}
                                <span className="text-sm font-semibold text-white truncate">{item.name}</span>
                            </div>
                            {item.sub && <div className="text-xs text-white/30 truncate">{item.sub}</div>}
                        </div>
                        <span className="text-sm font-bold text-white/80 shrink-0">{item.value}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

function RecordCard({ label, value, detail, sub, accent }) {
    return (
        <div className="rounded-xl border p-5 text-center"
            style={{
                background: `linear-gradient(135deg, ${accent}10, ${accent}05)`,
                borderColor: `${accent}25`,
            }}
        >
            <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: accent }}>{label}</div>
            <div className="text-3xl sm:text-4xl font-black font-heading text-white mb-1">{value}</div>
            <div className="text-sm text-white/70">{detail}</div>
            {sub && <div className="text-xs text-white/40 mt-0.5">{sub}</div>}
        </div>
    )
}

// ─── Styles ──────────────────────────────────────────────

const anniversaryStyles = `
    .anniv-title-gradient {
        background: linear-gradient(135deg, #f59e0b, #ec4899, #8b5cf6, #3b82f6);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-size: 200% 200%;
        animation: anniv-gradient-shift 4s ease-in-out infinite;
        filter: drop-shadow(0 2px 8px rgba(245,158,11,0.3));
    }
    .anniv-glow-text {
        text-shadow: 0 0 20px rgba(245,158,11,0.3);
    }
    @keyframes anniv-gradient-shift {
        0%, 100% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
    }
    @keyframes anniv-float {
        0%, 100% { transform: translateY(0) rotate(var(--tw-rotate, 0deg)); }
        50% { transform: translateY(-12px) rotate(var(--tw-rotate, 0deg)); }
    }
`

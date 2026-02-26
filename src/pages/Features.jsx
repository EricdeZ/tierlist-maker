import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import PageTitle from '../components/PageTitle'
import Navbar from '../components/layout/Navbar'
import {
    BarChart3, Trophy, Swords, Users, UserCircle, TrendingUp,
    Flame, Target, Gift, ShoppingBag, Award,
    LayoutGrid, Star, Sparkles, LineChart, Briefcase,
    ScrollText, Tv, FileText, MessageSquare, Heart,
    Handshake, UserPlus, ArrowUpDown, Layers, ListFilter,
    Dices, Lock, ChevronRight
} from 'lucide-react'

const CoffeeIcon = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
        <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
        <line x1="6" x2="6" y1="2" y2="4" />
        <line x1="10" x2="10" y1="2" y2="4" />
        <line x1="14" x2="14" y1="2" y2="4" />
    </svg>
)

const CATEGORIES = [
    { key: 'league', label: 'League & Stats' },
    { key: 'forge', label: 'Fantasy Forge' },
    { key: 'passion', label: 'Passion' },
    { key: 'predictions', label: 'Predictions' },
    { key: 'tierlists', label: 'Tier Lists' },
    { key: 'social', label: 'Social' },
    { key: 'tools', label: 'Tools & More' },
]

const FEATURES = [
    // League & Stats
    {
        category: 'league',
        name: 'Division Overview',
        description: 'Dashboard for each division with recent matches, player stats, and highlighted plays.',
        icon: LayoutGrid,
        color: '#60a5fa',
    },
    {
        category: 'league',
        name: 'Standings & Brackets',
        description: 'Live leaderboards and bracket views for every division in a league.',
        icon: Trophy,
        color: '#fbbf24',
    },
    {
        category: 'league',
        name: 'Match History & Details',
        description: 'Full match history with detailed per-game stats, god picks, bans, and KDA breakdowns.',
        icon: Swords,
        color: '#f87171',
    },
    {
        category: 'league',
        name: 'Player Stats',
        description: 'Aggregated player statistics across a division — kills, deaths, assists, KDA, and more.',
        icon: BarChart3,
        color: '#34d399',
    },
    {
        category: 'league',
        name: 'Team Rosters',
        description: 'Browse teams and their rosters with links to individual player profiles.',
        icon: Users,
        color: '#a78bfa',
    },
    {
        category: 'league',
        name: 'Player Profiles',
        description: 'Cross-season career stats, god pools, badges, and personal tier lists per player.',
        icon: UserCircle,
        color: '#38bdf8',
    },
    {
        category: 'league',
        name: 'League Overview',
        description: 'League-wide view combining all divisions — standings, recent matches, and top performers.',
        icon: Layers,
        color: '#c084fc',
    },
    {
        category: 'league',
        name: 'Organizations',
        description: 'Organization pages that group teams across seasons under a shared identity.',
        icon: Briefcase,
        color: '#fb923c',
    },
    {
        category: 'league',
        name: 'Browse Leagues',
        description: 'Discover all available leagues and divisions from a single page.',
        icon: ListFilter,
        color: '#94a3b8',
        link: '/leagues',
    },

    // Fantasy Forge
    {
        category: 'forge',
        name: 'Spark Market',
        description: 'Invest in players by buying and selling Sparks on a bonding curve. Prices rise and fall with demand.',
        icon: TrendingUp,
        color: '#f59e0b',
        isNew: true,
        link: '/forge',
    },
    {
        category: 'forge',
        name: 'Forge Portfolio',
        description: 'Track your holdings, transaction history, and profit/loss across all your Spark investments.',
        icon: Briefcase,
        color: '#fbbf24',
        isNew: true,
        link: '/forge',
    },
    {
        category: 'forge',
        name: 'Forge Leaderboard',
        description: 'Compete with other investors — ranked by total profit and ROI.',
        icon: Award,
        color: '#f97316',
        isNew: true,
        link: '/forge',
    },
    {
        category: 'forge',
        name: 'Forge Challenges',
        description: 'Weekly Forge-specific challenges to earn bonus Passion from your investments.',
        icon: Target,
        color: '#fb923c',
        isNew: true,
        link: '/forge',
    },
    {
        category: 'forge',
        name: 'Player Spark Pages',
        description: 'Detailed view per player with price charts, bonding curve visualization, and buy/sell interface.',
        icon: LineChart,
        color: '#fde047',
        isNew: true,
        link: '/forge',
    },

    // Passion System
    {
        category: 'passion',
        name: 'Passion Currency',
        description: 'Earn Passion by engaging with the site — daily claims, challenges, predictions, and more.',
        icon: Flame,
        color: '#f97316',
    },
    {
        category: 'passion',
        name: 'Challenges',
        description: 'Daily, weekly, and seasonal challenges with Passion rewards and tracked progress.',
        icon: Target,
        color: '#ef4444',
        link: '/challenges',
    },
    {
        category: 'passion',
        name: 'Passion Leaderboard',
        description: '27-rank SMITE 2 ladder system. Climb the ranks and compete for the top spot.',
        icon: Award,
        color: '#a855f7',
        link: '/leaderboard',
    },
    {
        category: 'passion',
        name: 'Coin Flip',
        description: 'Double or nothing — gamble your Passion on a coin flip.',
        icon: Dices,
        color: '#22c55e',
        link: '/coinflip',
    },
    {
        category: 'passion',
        name: 'Passion Shop',
        description: 'Spend your Passion on cosmetics and profile badges. Coming soon.',
        icon: ShoppingBag,
        color: '#ec4899',
        comingSoon: true,
        link: '/shop',
    },

    // Predictions
    {
        category: 'predictions',
        name: 'Match Predictions',
        description: 'Parimutuel betting on upcoming matches. Place predictions and win Passion based on the pool odds.',
        icon: ScrollText,
        color: '#8b5cf6',
        locked: true,
    },
    {
        category: 'predictions',
        name: 'Prediction Portfolio',
        description: 'Track your prediction history, win rate, and profit & loss over time.',
        icon: Briefcase,
        color: '#a78bfa',
        locked: true,
    },
    {
        category: 'predictions',
        name: 'Prediction Rankings',
        description: 'Leaderboard of the most accurate and profitable predictors.',
        icon: Trophy,
        color: '#c084fc',
        locked: true,
    },

    // Tier Lists
    {
        category: 'tierlists',
        name: 'Community Tier Lists',
        description: 'Browse and upvote tier lists created by other players in each division.',
        icon: LayoutGrid,
        color: '#06b6d4',
    },
    {
        category: 'tierlists',
        name: 'Tier List Creator',
        description: 'Drag-and-drop tier list builder with customizable tiers and image export.',
        icon: ArrowUpDown,
        color: '#14b8a6',
        link: '/tierlist',
    },
    {
        category: 'tierlists',
        name: 'God Tier List',
        description: 'Personal god tier list that shows on your profile. Set visibility to private, team, or public.',
        icon: Star,
        color: '#eab308',
        link: '/god-tierlist',
    },

    // Social & Community
    {
        category: 'social',
        name: 'Scrim Planner',
        description: 'Captains can post scrim requests — open or direct challenge — and pick between regular or fearless draft.',
        icon: Handshake,
        color: '#10b981',
        link: '/scrims',
    },
    {
        category: 'social',
        name: 'Refer a Friend',
        description: 'Share your referral code or QR link. Both you and your friend earn bonus Passion.',
        icon: UserPlus,
        color: '#3b82f6',
        isNew: true,
        link: '/referral',
    },
    {
        category: 'social',
        name: 'Feedback',
        description: 'Submit bug reports, feature requests, or general feedback directly from the site.',
        icon: MessageSquare,
        color: '#6366f1',
        link: '/feedback',
    },

    // Tools & More
    {
        category: 'tools',
        name: 'Draft Simulator',
        description: 'Practice drafting gods in turn order — a sandbox for planning your picks and bans.',
        icon: Sparkles,
        color: '#8b5cf6',
        link: '/draft',
    },
    {
        category: 'tools',
        name: 'Featured Stream',
        description: 'Watch the featured Twitch stream embedded directly on the site.',
        icon: Tv,
        color: '#a855f7',
        link: '/twitch',
    },
    {
        category: 'tools',
        name: 'What\'s New',
        description: 'In-app changelog showing the latest features and updates.',
        icon: Gift,
        color: '#f59e0b',
    },
    {
        category: 'tools',
        name: 'League Sign-up',
        description: 'Registration page for new leagues and seasons.',
        icon: FileText,
        color: '#64748b',
    },
]

function FeatureCard({ feature, index }) {
    const Icon = feature.icon
    const inner = (
        <>
            {/* Colored glow on hover — positioned behind card */}
            <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{
                    background: `radial-gradient(ellipse at 30% 50%, ${feature.color}12, transparent 70%)`,
                }}
            />
            {/* Top accent line */}
            <div
                className="absolute top-0 left-6 right-6 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: `linear-gradient(90deg, transparent, ${feature.color}40, transparent)` }}
            />
            <div className="relative flex items-start gap-5">
                <div
                    className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                    style={{
                        background: `linear-gradient(135deg, ${feature.color}20, ${feature.color}08)`,
                        boxShadow: `0 0 0 1px ${feature.color}15`,
                    }}
                >
                    <Icon
                        className="w-5.5 h-5.5 transition-all duration-300"
                        style={{ color: feature.color }}
                    />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                        <h3 className="font-heading font-bold text-[15px] text-(--color-text) transition-colors duration-300 group-hover:text-white">
                            {feature.name}
                        </h3>
                        {feature.locked && (
                            <Lock className="w-3.5 h-3.5 text-amber-400/60" />
                        )}
                        {feature.isNew && (
                            <span className="features-new-badge inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                                New
                            </span>
                        )}
                        {feature.comingSoon && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/25">
                                Soon
                            </span>
                        )}
                    </div>
                    <p className="text-[13px] text-(--color-text-secondary) leading-relaxed">
                        {feature.description}
                    </p>
                </div>
                {feature.link && (
                    <ChevronRight className="w-4 h-4 text-white/10 shrink-0 mt-1 transition-all duration-300 group-hover:text-white/40 group-hover:translate-x-1" />
                )}
            </div>
        </>
    )

    const baseClass = 'features-card group relative p-5 rounded-2xl border border-white/[0.06] transition-all duration-300 cursor-pointer'
    const style = {
        background: 'linear-gradient(145deg, rgba(255,255,255,0.03), transparent, rgba(255,255,255,0.01))',
        animationDelay: `${index * 0.04}s`,
    }

    if (feature.link) {
        return (
            <Link to={feature.link} className={baseClass} style={style}>
                {inner}
            </Link>
        )
    }

    return (
        <div className={baseClass} style={style}>
            {inner}
        </div>
    )
}

export default function Features() {
    const [showNewFirst, setShowNewFirst] = useState(false)
    const [activeCategory, setActiveCategory] = useState(null)

    const filtered = useMemo(() => {
        let list = FEATURES
        if (activeCategory) {
            list = list.filter(f => f.category === activeCategory)
        }
        if (showNewFirst) {
            list = [...list].sort((a, b) => {
                if (a.isNew && !b.isNew) return -1
                if (!a.isNew && b.isNew) return 1
                return 0
            })
        }
        return list
    }, [activeCategory, showNewFirst])

    const newCount = FEATURES.filter(f => f.isNew).length

    return (
        <>
            <PageTitle title="Features" />
            <Navbar title="Features" />

            <style>{`
                @keyframes features-card-enter {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes features-glow-pulse {
                    0%, 100% { opacity: 0.6; }
                    50% { opacity: 1; }
                }
                @keyframes features-badge-shimmer {
                    0% { background-position: -100% 0; }
                    100% { background-position: 200% 0; }
                }
                .features-card {
                    animation: features-card-enter 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
                }
                .features-card:hover {
                    border-color: rgba(255,255,255,0.12);
                    transform: translateY(-4px);
                    box-shadow:
                        0 12px 40px rgba(0,0,0,0.4),
                        0 0 0 1px rgba(255,255,255,0.06);
                }
                .features-new-badge {
                    background-size: 200% 100%;
                    background-image: linear-gradient(
                        110deg,
                        rgba(16,185,129,0.15) 0%,
                        rgba(16,185,129,0.15) 40%,
                        rgba(52,211,153,0.3) 50%,
                        rgba(16,185,129,0.15) 60%,
                        rgba(16,185,129,0.15) 100%
                    );
                    animation: features-badge-shimmer 3s ease-in-out infinite;
                }
                .features-support-banner {
                    background: linear-gradient(
                        135deg,
                        rgba(248,197,106,0.06),
                        rgba(15,20,35,0.9) 40%,
                        rgba(248,197,106,0.04)
                    );
                }
                .features-support-banner:hover {
                    transform: translateY(-2px);
                    box-shadow:
                        0 8px 32px rgba(248,197,106,0.12),
                        0 0 0 1px rgba(248,197,106,0.2);
                }
            `}</style>

            <div className="max-w-5xl mx-auto px-4 py-8 pt-24">
                {/* Support banner */}
                <Link
                    to="/support"
                    className="features-support-banner group flex items-center gap-5 p-5 sm:p-6 rounded-2xl border border-(--color-accent)/20 transition-all duration-300 mb-10"
                >
                    <div
                        className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                        style={{ background: 'linear-gradient(135deg, rgba(248,197,106,0.2), rgba(248,197,106,0.05))' }}
                    >
                        <Heart className="w-6 h-6 text-(--color-accent)" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-heading font-bold text-base text-(--color-text) group-hover:text-(--color-accent) transition-colors duration-300">
                            Support smitecomp.com
                        </h3>
                        <p className="text-sm text-(--color-text-secondary) mt-0.5">
                            This is a community passion project. Help keep it running and growing.
                        </p>
                    </div>
                    <div className="shrink-0 hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-heading font-bold transition-all duration-300 group-hover:scale-105"
                        style={{ background: 'linear-gradient(135deg, rgba(248,197,106,0.15), rgba(248,197,106,0.05))', color: 'var(--color-accent)' }}>
                        <CoffeeIcon className="w-4 h-4" />
                        Learn how
                    </div>
                </Link>

                {/* Hero header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl sm:text-5xl font-heading font-bold text-(--color-text) mb-4 tracking-tight">
                        Everything in one place
                    </h1>
                    <p className="text-base text-(--color-text-secondary) max-w-xl mx-auto leading-relaxed">
                        League stats, fantasy markets, gamification, tier lists, predictions, and more — built for the competitive SMITE 2 community.
                    </p>
                </div>

                {/* Controls */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-8">
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setActiveCategory(null)}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                                !activeCategory
                                    ? 'bg-(--color-accent) text-white shadow-lg shadow-(--color-accent)/20'
                                    : 'bg-white/5 text-(--color-text-secondary) hover:bg-white/10 hover:text-(--color-text)'
                            }`}
                        >
                            All
                        </button>
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat.key}
                                onClick={() => setActiveCategory(cat.key)}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                                    activeCategory === cat.key
                                        ? 'bg-(--color-accent) text-white shadow-lg shadow-(--color-accent)/20'
                                        : 'bg-white/5 text-(--color-text-secondary) hover:bg-white/10 hover:text-(--color-text)'
                                }`}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => setShowNewFirst(v => !v)}
                        className={`shrink-0 flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                            showNewFirst
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/10'
                                : 'bg-white/5 text-(--color-text-secondary) hover:bg-white/10 border border-transparent'
                        }`}
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        New first
                        {newCount > 0 && (
                            <span className="bg-emerald-500/25 text-emerald-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                                {newCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* Feature grid */}
                <div key={`${activeCategory}-${showNewFirst}`} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filtered.map((feature, i) => (
                        <FeatureCard key={feature.name} feature={feature} index={i} />
                    ))}
                </div>

                {/* Count */}
                <div className="text-center mt-10 text-xs text-(--color-text-secondary)/60">
                    {filtered.length} feature{filtered.length !== 1 ? 's' : ''}
                    {activeCategory ? ` in ${CATEGORIES.find(c => c.key === activeCategory)?.label}` : ' and counting'}
                </div>
            </div>
        </>
    )
}

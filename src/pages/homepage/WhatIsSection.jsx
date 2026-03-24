import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
    Trophy, Scroll, Crown, ListOrdered, Swords,
    CalendarSearch, Layers, TrendingUp,
    BarChart3, Users, ChevronRight
} from 'lucide-react'
import './WhatIsSection.css'

const DiscordIcon = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
    </svg>
)

const SECONDARY_FEATURES = [
    {
        icon: <Scroll />,
        title: 'Patch Notes',
        desc: 'Stay current with the latest balance changes, god updates, and item adjustments.',
        to: '/patchnotes',
    },
    {
        icon: <Crown />,
        title: 'God Tier List',
        desc: 'Rank every SMITE 2 god in classic S-F tiers. Drag and drop, then export as a shareable image.',
        to: '/god-tierlist',
    },
    {
        icon: <ListOrdered />,
        title: 'Player Tier List',
        desc: 'Rank players by role with drag-and-drop. Export as shareable images.',
        to: '/tierlist',
    },
]

const TOOL_FEATURES = [
    {
        icon: <Swords />,
        title: 'Draft Simulator',
        desc: 'Practice pick/ban strategy with the full god pool. Supports Regular, Fearless, and series formats.',
        to: '/draft',
    },
    {
        icon: <CalendarSearch />,
        title: 'Scrim Planner',
        desc: 'Post open scrim requests or send direct challenges. Find practice partners for your team.',
        to: '/scrims',
    },
    {
        icon: <Layers />,
        title: 'Card Game',
        desc: 'Open packs, collect god cards with unique abilities, and trade with the community.',
        to: '/vault',
    },
    {
        icon: <TrendingUp />,
        title: 'Fantasy Forge',
        desc: 'A player investment market driven by real match performance. Build a portfolio, climb the leaderboard.',
        to: '/forge',
    },
]

function FeatureCard({ icon, title, desc, to }) {
    return (
        <Link to={to} className="wis-card">
            <div className="wis-card-header">
                <div className="wis-card-icon">{icon}</div>
                <span className="wis-card-title">{title}</span>
            </div>
            <p className="wis-card-desc">{desc}</p>
        </Link>
    )
}

export default function WhatIsSection() {
    const { user, login, loading: authLoading } = useAuth()

    return (
        <section className="wis-section" id="about">
            <div className="wis-grid-overlay" />
            <div className="wis-ambient-glow" />
            <div className="wis-ambient-glow-secondary" />
            <div className="wis-accent-line" />
            <div className="wis-edge wis-edge--top" />
            <div className="wis-edge wis-edge--bottom" />

            <div className="wis-content">
                {/* Header */}
                <div className="wis-header">
                    <h2 className="wis-title">What is smitecomp.com?</h2>
                    <p className="wis-tagline">
                        The ultimate tactical layer for community-run SMITE 2 leagues.
                    </p>
                </div>

                {/* Hero Card — Competitive Hub */}
                <div className="wis-hero">
                    <div className="wis-hero-content">
                        <div className="wis-hero-icon">
                            <Trophy />
                        </div>
                        <h3 className="wis-hero-title">Competitive Hub</h3>
                        <p className="wis-hero-desc">
                            The heart of the SMITE 2 amateur scene. Live standings, full player stats,
                            match history, and head-to-head breakdowns for every community league and season.
                        </p>
                        <div className="wis-hero-actions">
                            <span className="wis-ghost-btn">
                                <BarChart3 />
                                Live Stats
                            </span>
                            <span className="wis-ghost-btn">
                                <Users />
                                Global Rankings
                            </span>
                        </div>
                    </div>
                    <div className="wis-hero-visual">
                        {!authLoading && (
                            user ? (
                                <Link to="/" className="wis-access-btn">
                                    Access Hub
                                    <ChevronRight />
                                </Link>
                            ) : (
                                <button onClick={login} className="wis-access-btn">
                                    <DiscordIcon className="w-4 h-4" />
                                    Connect to Get Started
                                </button>
                            )
                        )}
                    </div>
                </div>

                {/* Secondary Grid — 3-col */}
                <div className="wis-secondary-grid">
                    {SECONDARY_FEATURES.map(f => (
                        <FeatureCard key={f.title} {...f} />
                    ))}
                </div>

                {/* Tool Grid — 2x2 */}
                <div className="wis-tool-grid">
                    {TOOL_FEATURES.map(f => (
                        <FeatureCard key={f.title} {...f} />
                    ))}
                </div>

                {/* Discord Login Banner */}
                {!authLoading && !user && (
                    <div className="wis-discord-banner">
                        <div className="wis-discord-text">
                            <h3>Ready to jump in?</h3>
                            <p>Log in with Discord to claim your profile, track stats, and join a league.</p>
                        </div>
                        <button onClick={login} className="wis-discord-btn">
                            <DiscordIcon />
                            Log in with Discord
                        </button>
                    </div>
                )}
            </div>
        </section>
    )
}

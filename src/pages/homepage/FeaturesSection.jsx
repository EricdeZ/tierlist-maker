import { Trophy, BarChart3, Calendar, ListOrdered, Shield, User } from 'lucide-react'

const FEATURES = [
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
]

const FeaturesSection = () => {
    return (
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
                    {FEATURES.map((feature) => (
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
    )
}

export default FeaturesSection

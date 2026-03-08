import { Link } from 'react-router-dom'
import { Swords, ChevronRight, ListOrdered, User, Crown } from 'lucide-react'

const DiscordIcon = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
    </svg>
)

const ToolsSection = ({ user, linkedPlayer, login, authLoading }) => {
    return (
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
                    <ToolCard to="/draft" icon={<Swords className="w-6 h-6 text-(--color-accent)" />} title="Draft Simulator">
                        Practice pick/ban strategy with the full SMITE 2 god pool. Supports Regular, Fearless, and multi-game series formats.
                    </ToolCard>

                    <ToolCard to="/tierlist" icon={<ListOrdered className="w-6 h-6 text-(--color-accent)" />} title="Player Tier Lists">
                        Rank players by role with drag-and-drop. Export as shareable images and compare your rankings with the community.
                    </ToolCard>

                    <ToolCard to="/god-tierlist" icon={<Crown className="w-6 h-6 text-(--color-accent)" />} title="God Tier List">
                        Rank every SMITE 2 god in classic S/A/B/C/D/F tiers. Drag and drop to create your definitive tier list and export as an image.
                    </ToolCard>

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
    )
}

const ToolCard = ({ to, icon, title, children }) => (
    <Link
        to={to}
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
                    {icon}
                </div>
                <h3 className="font-heading text-xl font-bold text-(--color-text) group-hover:text-(--color-accent) transition-colors">
                    {title}
                </h3>
            </div>
            <p className="text-sm text-(--color-text-secondary) leading-relaxed mb-5">
                {children}
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
)

export default ToolsSection

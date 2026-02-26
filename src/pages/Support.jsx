import { Link } from 'react-router-dom'
import PageTitle from '../components/PageTitle'
import Navbar from '../components/layout/Navbar'
import { Bug, Lightbulb, MessageCircle, Share2, Mic, Heart, ExternalLink } from 'lucide-react'

const DiscordIcon = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
    </svg>
)

const CoffeeIcon = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
        <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
        <line x1="6" x2="6" y1="2" y2="4" />
        <line x1="10" x2="10" y1="2" y2="4" />
        <line x1="14" x2="14" y1="2" y2="4" />
    </svg>
)

function handleShare() {
    if (navigator.share) {
        navigator.share({
            title: 'SMITE 2 Companion',
            text: 'Check out smitecomp.com — stats, standings, and tools for competitive SMITE 2 leagues!',
            url: 'https://smitecomp.com',
        }).catch(() => {})
    } else {
        navigator.clipboard.writeText('Check out smitecomp.com — stats, standings, and tools for competitive SMITE 2 leagues! https://smitecomp.com')
            .then(() => alert('Link copied to clipboard!'))
            .catch(() => {})
    }
}

export default function Support() {
    return (
        <>
            <PageTitle title="How to Support smitecomp.com" />
            <Navbar title="Support" />

            <div className="max-w-3xl mx-auto px-4 py-8 pt-24">
                {/* Header */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-(--color-accent)/10 mb-4">
                        <Heart className="w-7 h-7 text-(--color-accent)" />
                    </div>
                    <h1 className="text-3xl font-heading font-bold text-(--color-text) mb-3">
                        How to Support smitecomp.com
                    </h1>
                    <p className="text-sm text-(--color-text-secondary) max-w-lg mx-auto leading-relaxed">
                        This project runs on community love. Here are a few ways you can help keep it going and make it even better.
                    </p>
                </div>

                {/* Support Financially — moved to top */}
                <div className="mb-8">
                    <div
                        className="relative overflow-hidden rounded-2xl border border-(--color-accent)/20 p-8 text-center"
                        style={{ background: 'linear-gradient(135deg, rgba(248,197,106,0.05), var(--color-secondary), rgba(248,197,106,0.03))' }}
                    >
                        <div
                            className="absolute top-0 right-0 w-48 h-48 opacity-10 pointer-events-none"
                            style={{ background: 'radial-gradient(circle at top right, var(--color-accent), transparent 70%)' }}
                        />
                        <div
                            className="absolute bottom-0 left-0 w-48 h-48 opacity-10 pointer-events-none"
                            style={{ background: 'radial-gradient(circle at bottom left, var(--color-accent), transparent 70%)' }}
                        />

                        <div className="relative z-10">
                            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-(--color-accent)/15 mb-4">
                                <CoffeeIcon className="w-7 h-7 text-(--color-accent)" />
                            </div>
                            <h3 className="font-heading text-xl font-bold text-(--color-text) mb-3">
                                Support smitecomp.com Financially
                            </h3>
                            <p className="text-sm text-(--color-text-secondary) leading-relaxed max-w-md mx-auto mb-6">
                                This is a pure passion project. I'm going to keep building and maintaining it regardless — but if it could sustain itself, that would be amazing.
                            </p>
                            <a
                                href="https://buymeacoffee.com/brudiv"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2.5 px-7 py-3 rounded-xl font-heading font-bold text-base transition-all duration-300 hover:scale-[1.03] hover:shadow-lg hover:shadow-(--color-accent)/20"
                                style={{ background: 'linear-gradient(135deg, #FFDD00, #FFB800)', color: '#1a1a1a' }}
                            >
                                <CoffeeIcon className="w-5 h-5" />
                                Support smitecomp.com
                            </a>
                        </div>
                    </div>
                </div>

                {/* Cards */}
                <div className="space-y-4">
                    {/* Report Bugs */}
                    <Link
                        to="/feedback"
                        className="group flex items-start gap-4 p-5 rounded-xl border border-white/10 hover:border-red-400/30 transition-all duration-300 hover:-translate-y-0.5"
                        style={{ background: 'linear-gradient(135deg, var(--color-secondary), var(--color-primary))' }}
                    >
                        <div className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.15)' }}>
                            <Bug className="w-5 h-5 text-red-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-heading font-bold text-(--color-text) mb-1 group-hover:text-red-400 transition-colors">
                                Report Bugs
                            </h3>
                            <p className="text-sm text-(--color-text-secondary) leading-relaxed">
                                Found something broken? Let us know so we can fix it. Every bug report helps make the site more reliable.
                            </p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-(--color-text-secondary)/40 shrink-0 mt-1 group-hover:text-red-400 transition-colors" />
                    </Link>

                    {/* Give Feedback */}
                    <Link
                        to="/feedback"
                        className="group flex items-start gap-4 p-5 rounded-xl border border-white/10 hover:border-indigo-400/30 transition-all duration-300 hover:-translate-y-0.5"
                        style={{ background: 'linear-gradient(135deg, var(--color-secondary), var(--color-primary))' }}
                    >
                        <div className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.15)' }}>
                            <MessageCircle className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-heading font-bold text-(--color-text) mb-1 group-hover:text-indigo-400 transition-colors">
                                Give Feedback
                            </h3>
                            <p className="text-sm text-(--color-text-secondary) leading-relaxed">
                                Tell us what you think — what's working, what's not, and what could be better. Your feedback shapes the roadmap.
                            </p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-(--color-text-secondary)/40 shrink-0 mt-1 group-hover:text-indigo-400 transition-colors" />
                    </Link>

                    {/* Submit Ideas */}
                    <Link
                        to="/feedback"
                        className="group flex items-start gap-4 p-5 rounded-xl border border-white/10 hover:border-amber-400/30 transition-all duration-300 hover:-translate-y-0.5"
                        style={{ background: 'linear-gradient(135deg, var(--color-secondary), var(--color-primary))' }}
                    >
                        <div className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.15)' }}>
                            <Lightbulb className="w-5 h-5 text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-heading font-bold text-(--color-text) mb-1 group-hover:text-amber-400 transition-colors">
                                Submit Ideas
                            </h3>
                            <p className="text-sm text-(--color-text-secondary) leading-relaxed">
                                Have a feature idea or suggestion? We're always looking for ways to make the platform better for the community.
                            </p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-(--color-text-secondary)/40 shrink-0 mt-1 group-hover:text-amber-400 transition-colors" />
                    </Link>

                    {/* Spread the Word */}
                    <button
                        onClick={handleShare}
                        className="group w-full flex items-start gap-4 p-5 rounded-xl border border-white/10 hover:border-green-400/30 transition-all duration-300 hover:-translate-y-0.5 text-left cursor-pointer"
                        style={{ background: 'linear-gradient(135deg, var(--color-secondary), var(--color-primary))' }}
                    >
                        <div className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.15)' }}>
                            <Share2 className="w-5 h-5 text-green-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-heading font-bold text-(--color-text) mb-1 group-hover:text-green-400 transition-colors">
                                Spread the Word
                            </h3>
                            <p className="text-sm text-(--color-text-secondary) leading-relaxed">
                                Share smitecomp.com with your friends, teammates, and community. The more people who know about it, the better it gets for everyone.
                            </p>
                        </div>
                        <Share2 className="w-4 h-4 text-(--color-text-secondary)/40 shrink-0 mt-1 group-hover:text-green-400 transition-colors" />
                    </button>

                    {/* Apply as Match Reporter */}
                    <div
                        className="group flex items-start gap-4 p-5 rounded-xl border border-white/10"
                        style={{ background: 'linear-gradient(135deg, var(--color-secondary), var(--color-primary))' }}
                    >
                        <div className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'rgba(88,101,242,0.15)' }}>
                            <Mic className="w-5 h-5 text-[#5865F2]" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-heading font-bold text-(--color-text) mb-1">
                                Apply to be a Match Reporter
                            </h3>
                            <p className="text-sm text-(--color-text-secondary) leading-relaxed">
                                Help us keep match data up to date by becoming a reporter. Reach out to <span className="text-[#5865F2] font-semibold">@brudif</span> on Discord to get started.
                            </p>
                            <div className="flex items-center gap-1.5 mt-2 text-xs text-[#5865F2]">
                                <DiscordIcon className="w-3.5 h-3.5" />
                                <span className="font-medium">@brudif</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

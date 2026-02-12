import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePassion } from '../context/PassionContext'
import { challengeService } from '../services/database'
import passionCoin from '../assets/passion/passion.png'

const DiscordIcon = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z" />
    </svg>
)

function selectFeaturedChallenge(challenges, isLoggedIn) {
    const all = Object.values(challenges).flat()
    const active = all.filter(ch => !ch.completed)
    if (active.length === 0) return null

    // For unauthenticated users, prioritize the sign-in challenge
    if (!isLoggedIn) {
        const signIn = active.find(ch => ch.statKey === 'discord_linked')
        if (signIn) return signIn
    }

    // 1. Claimable — ready for immediate reward
    const claimable = active.filter(ch => ch.claimable)
    if (claimable.length > 0) {
        return claimable.sort((a, b) => b.reward - a.reward)[0]
    }

    // 2. Close to completion (>50% progress) — momentum
    const close = active.filter(ch => ch.progress > 0.5)
    if (close.length > 0) {
        return close.sort((a, b) => b.progress - a.progress)[0]
    }

    // 3. Any with progress — keep going
    const started = active.filter(ch => ch.progress > 0)
    if (started.length > 0) {
        return started.sort((a, b) => b.progress - a.progress)[0]
    }

    // 4. Lowest target — easiest to start for newcomers
    return active.sort((a, b) => a.targetValue - b.targetValue)[0]
}

export default function ChallengeBanner() {
    const { user, login } = useAuth()
    const { claimableCount } = usePassion()
    const [challenge, setChallenge] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        challengeService.getAll()
            .then(data => {
                const featured = selectFeaturedChallenge(data.challenges || {}, !!user)
                setChallenge(featured)
            })
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [user])

    if (loading || !challenge) return null

    const pct = Math.round(challenge.progress * 100)
    const isSignInChallenge = !user && challenge.statKey === 'discord_linked'

    // Unauthenticated + sign-in challenge: show login banner
    if (isSignInChallenge) {
        return (
            <button
                onClick={login}
                className="group block w-full rounded-xl border border-[#5865F2]/25 bg-(--color-secondary) overflow-hidden transition-all hover:border-[#5865F2]/50 hover:-translate-y-0.5 cursor-pointer text-left"
            >
                <div className="flex items-center gap-4 p-4 sm:p-5">
                    <div className="w-10 h-10 rounded-lg bg-[#5865F2]/15 flex items-center justify-center shrink-0">
                        <DiscordIcon className="w-5 h-5 text-[#5865F2]" />
                    </div>

                    <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-[#5865F2] uppercase tracking-wider">
                            Challenge
                        </span>
                        <div className="text-sm font-semibold text-(--color-text) truncate">{challenge.title}</div>
                        <p className="text-xs text-(--color-text-secondary)/60 mt-0.5">{challenge.description}</p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-sm font-bold" style={{ color: '#f8c56a' }}>+{challenge.reward}</span>
                        <img src={passionCoin} alt="" className="w-4 h-4" />
                        <svg className="w-4 h-4 text-(--color-text-secondary)/40 group-hover:text-[#5865F2] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </div>
                </div>
            </button>
        )
    }

    return (
        <Link
            to="/challenges"
            className="group block rounded-xl border border-(--color-accent)/20 bg-(--color-secondary) overflow-hidden transition-all hover:border-(--color-accent)/40 hover:-translate-y-0.5"
        >
            <div className="flex items-center gap-4 p-4 sm:p-5">
                {/* Star icon */}
                <div className="w-10 h-10 rounded-lg bg-(--color-accent)/10 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-(--color-accent)" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round"
                            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                </div>

                {/* Challenge info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-(--color-accent) uppercase tracking-wider">
                            {challenge.claimable ? 'Ready to Claim!' : 'Challenge'}
                        </span>
                        {claimableCount > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-px rounded-full"
                                style={{ background: '#f8c56a', color: '#0a0f1a' }}>
                                {claimableCount} ready
                            </span>
                        )}
                    </div>
                    <div className="text-sm font-semibold text-(--color-text) truncate">{challenge.title}</div>
                    <div className="flex items-center gap-3 mt-1.5">
                        <div className="flex-1 h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full"
                                style={{
                                    width: `${pct}%`,
                                    background: challenge.claimable
                                        ? 'linear-gradient(90deg, #4ade80, #22c55e)'
                                        : 'linear-gradient(90deg, #d4a04a, #f8c56a)',
                                }}
                            />
                        </div>
                        <span className="text-[11px] font-bold text-(--color-text-secondary)/60 tabular-nums shrink-0">{pct}%</span>
                    </div>
                </div>

                {/* Reward + arrow */}
                <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-sm font-bold" style={{ color: '#f8c56a' }}>+{challenge.reward}</span>
                    <img src={passionCoin} alt="" className="w-4 h-4" />
                    <svg className="w-4 h-4 text-(--color-text-secondary)/40 group-hover:text-(--color-accent) transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                </div>
            </div>
        </Link>
    )
}

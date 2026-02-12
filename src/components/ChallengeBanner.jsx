import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePassion } from '../context/PassionContext'
import { challengeService } from '../services/database'
import passionCoin from '../assets/passion/passion.png'

function selectFeaturedChallenge(challenges) {
    const all = Object.values(challenges).flat()
    const active = all.filter(ch => !ch.completed)
    if (active.length === 0) return null

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
    const { user } = useAuth()
    const { claimableCount } = usePassion()
    const [challenge, setChallenge] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!user) { setLoading(false); return }
        challengeService.getAll()
            .then(data => {
                const featured = selectFeaturedChallenge(data.challenges || {})
                setChallenge(featured)
            })
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [user])

    if (loading || !user || !challenge) return null

    const pct = Math.round(challenge.progress * 100)

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

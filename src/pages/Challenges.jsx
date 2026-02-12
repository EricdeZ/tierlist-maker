import { useState, useEffect, useCallback, useMemo } from 'react'
import { challengeService } from '../services/database'
import { usePassion } from '../context/PassionContext'
import { useAuth } from '../context/AuthContext'
import PageTitle from '../components/PageTitle'
import SimpleNav from '../components/layout/SimpleNav'
import RankBanner from '../components/RankBanner'
import passionCoin from '../assets/passion/passion.png'

const DiscordIcon = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z" />
    </svg>
)

// ─── Category border colors ───────────────────────
const CATEGORY_BORDERS = {
    engagement:  'border-l-blue-400',
    league:      'border-l-emerald-400',
    performance: 'border-l-orange-400',
    social:      'border-l-purple-400',
}

// ─── Flying coins — straight line to passion balance ───
function spawnFlyingCoins(sourceEl, coinSrc) {
    const target = document.getElementById('passion-balance-coin')
    if (!sourceEl || !target) return

    const sr = sourceEl.getBoundingClientRect()
    const tr = target.getBoundingClientRect()
    const sx = sr.left + sr.width / 2
    const sy = sr.top + sr.height / 2
    const tx = tr.left + tr.width / 2
    const ty = tr.top + tr.height / 2

    for (let i = 0; i < 8; i++) {
        const coin = document.createElement('img')
        coin.src = coinSrc
        const size = 16 + Math.random() * 10
        coin.style.cssText = `position:fixed;left:0;top:0;width:${size}px;height:${size}px;z-index:9999;pointer-events:none;will-change:transform;`
        document.body.appendChild(coin)

        // Spread out start positions around the button
        const spreadX = (Math.random() - 0.5) * 100
        const spreadY = (Math.random() - 0.5) * 40
        const startX = sx + spreadX
        const startY = sy + spreadY

        const duration = 800 + Math.random() * 400
        const delay = i * 70

        const hs = size / 2
        const anim = coin.animate([
            {
                transform: `translate(${startX - hs}px, ${startY - hs}px) scale(1)`,
                opacity: 1,
            },
            {
                transform: `translate(${tx - hs}px, ${ty - hs}px) scale(0.4)`,
                opacity: 0.3,
            },
        ], {
            duration,
            delay,
            easing: 'ease-in',
            fill: 'forwards',
        })

        anim.onfinish = () => coin.remove()
    }
}


// ─── Smart challenge grouping and sorting ──────────
function buildDisplayList(challenges) {
    const flat = Object.values(challenges).flat()

    const groups = {}
    for (const ch of flat) {
        const key = ch.statKey || ch.id
        if (!groups[key]) groups[key] = []
        groups[key].push(ch)
    }

    const display = []
    for (const tiers of Object.values(groups)) {
        tiers.sort((a, b) => a.targetValue - b.targetValue)
        let shownNext = false
        for (const ch of tiers) {
            if (ch.completed) {
                display.push(ch)
            } else if (!shownNext) {
                display.push(ch)
                shownNext = true
            }
        }
    }

    display.sort((a, b) => {
        if (a.completed && !b.completed) return -1
        if (!a.completed && b.completed) return 1
        if (a.completed && b.completed) {
            const da = a.completedAt ? new Date(a.completedAt) : 0
            const db = b.completedAt ? new Date(b.completedAt) : 0
            return db - da
        }
        if (a.claimable && !b.claimable) return -1
        if (!a.claimable && b.claimable) return 1
        if (a.progress !== b.progress) return b.progress - a.progress
        return a.targetValue - b.targetValue
    })

    return display
}


// ═══════════════════════════════════════════════════
// Main Challenges Page
// ═══════════════════════════════════════════════════
export default function Challenges() {
    const { user, login, loading: authLoading } = useAuth()
    const { updateFromClaim, challengeNotifications } = usePassion()
    const [challengeData, setChallengeData] = useState({})
    const [loading, setLoading] = useState(true)
    const [claimingId, setClaimingId] = useState(null)
    const [justClaimed, setJustClaimed] = useState({})

    const loadChallenges = useCallback(() => {
        return challengeService.getAll()
            .then(data => setChallengeData(data.challenges || {}))
            .catch(err => console.error('Failed to load challenges:', err))
            .finally(() => setLoading(false))
    }, [])

    useEffect(() => { loadChallenges() }, [loadChallenges])

    useEffect(() => {
        if (challengeNotifications.length > 0) loadChallenges()
    }, [challengeNotifications.length, loadChallenges])

    const displayList = useMemo(() => buildDisplayList(challengeData), [challengeData])

    const handleClaim = async (challengeId, buttonEl) => {
        setClaimingId(challengeId)
        try {
            const result = await challengeService.claim(challengeId)
            if (result.success) {
                spawnFlyingCoins(buttonEl, passionCoin)
                setTimeout(() => updateFromClaim(result), 700)
                setJustClaimed(prev => ({ ...prev, [challengeId]: result.earned }))
                setTimeout(() => {
                    const scrollY = window.scrollY
                    loadChallenges().then(() => {
                        requestAnimationFrame(() => window.scrollTo(0, scrollY))
                    })
                }, 900)
            }
        } catch (err) {
            console.error('Failed to claim challenge:', err)
        } finally {
            setClaimingId(null)
        }
    }

    return (
        <div className="min-h-screen bg-(--color-primary) text-(--color-text)">
            <SimpleNav title="Challenges" />
            <PageTitle title="Challenges" />

            <div className="max-w-5xl mx-auto px-4 pt-24 pb-8">

                {/* Rank progression banner */}
                <RankBanner />

                {/* Page header */}
                <div className="mt-8 mb-6">
                    <h1 className="text-2xl sm:text-3xl font-bold font-heading">Challenges</h1>
                    <p className="text-sm text-(--color-text-secondary)/70 mt-1">
                        Complete challenges to earn Passion and rank up
                    </p>
                </div>

                {/* Sign-in prompt for unauthenticated users */}
                {!authLoading && !user && (
                    <div className="mb-6 rounded-xl bg-[#5865F2]/10 border border-[#5865F2]/25 p-5 text-center">
                        <p className="text-sm text-(--color-text-secondary) mb-3">
                            Sign in with Discord to track your progress, complete challenges, and earn Passion
                        </p>
                        <button
                            onClick={login}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-semibold transition-colors cursor-pointer"
                        >
                            <DiscordIcon className="w-4 h-4" />
                            Login with Discord
                        </button>
                    </div>
                )}

                {/* Challenge grid */}
                {loading ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="h-40 rounded-xl bg-(--color-secondary) border border-white/[0.06] animate-pulse" />
                        ))}
                    </div>
                ) : displayList.length === 0 ? (
                    <div className="text-center py-16 text-(--color-text-secondary)/50">
                        No challenges available yet.
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                        {displayList.map((ch, i) => (
                            <ChallengeCard
                                key={ch.id}
                                challenge={ch}
                                index={i}
                                claimingId={claimingId}
                                justClaimed={justClaimed[ch.id]}
                                onClaim={handleClaim}
                                isLoggedIn={!!user}
                            />
                        ))}
                    </div>
                )}
            </div>

            <style>{`
                @keyframes card-enter {
                    0% { opacity: 0; transform: translateY(16px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                @keyframes shimmer-sweep {
                    0%, 100% { transform: translateX(-100%) skewX(-15deg); }
                    50% { transform: translateX(250%) skewX(-15deg); }
                }
                @keyframes claim-glow {
                    0% { box-shadow: 0 0 0 0 rgba(248, 197, 106, 0); }
                    30% { box-shadow: 0 0 25px 4px rgba(248, 197, 106, 0.35); }
                    100% { box-shadow: 0 0 0 0 rgba(248, 197, 106, 0); }
                }
                @keyframes progress-fill {
                    0% { width: 0%; }
                }
            `}</style>
        </div>
    )
}


// ═══════════════════════════════════════════════════
// Challenge Card
// ═══════════════════════════════════════════════════
function ChallengeCard({ challenge: ch, index, claimingId, justClaimed, onClaim, isLoggedIn }) {
    const pct = Math.round(ch.progress * 100)
    const borderClass = CATEGORY_BORDERS[ch.category] || CATEGORY_BORDERS.engagement
    const isClaiming = claimingId === ch.id
    const isClaimable = isLoggedIn && ch.claimable && !justClaimed && !ch.completed

    return (
        <div
            className={`
                relative rounded-xl border-l-[3px] ${borderClass}
                bg-(--color-secondary) border border-white/[0.06]
                overflow-hidden transition-all duration-300
                ${ch.completed ? 'opacity-50' : ''}
                ${isClaimable ? 'border-r-(--color-accent)/25 border-t-(--color-accent)/25 border-b-(--color-accent)/25' : ''}
            `}
            style={{
                animation: `card-enter 0.4s ease-out ${index * 0.06}s both`,
                ...(justClaimed ? { animation: `claim-glow 1.2s ease-out` } : {}),
            }}
        >
            {isClaimable && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div
                        className="absolute inset-0 w-1/3"
                        style={{
                            background: 'linear-gradient(90deg, transparent, rgba(248,197,106,0.06), transparent)',
                            animation: 'shimmer-sweep 4s ease-in-out infinite',
                        }}
                    />
                </div>
            )}

            <div className="relative p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="min-w-0">
                        <h3 className="font-bold text-sm sm:text-base font-heading leading-tight">{ch.title}</h3>
                        <p className="text-xs text-(--color-text-secondary)/60 mt-0.5 leading-relaxed">{ch.description}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 mt-0.5">
                        <span className="text-sm font-bold" style={{ color: '#f8c56a' }}>+{ch.reward}</span>
                        <img src={passionCoin} alt="" className="w-4 h-4" />
                    </div>
                </div>

                {ch.type === 'repeatable' && (
                    <span className="inline-block text-[10px] text-(--color-text-secondary)/50 border border-white/[0.08] rounded px-1.5 py-px mb-2">
                        Repeatable
                    </span>
                )}

                <div className="mt-3">
                    <div className="flex justify-between items-baseline text-[11px] mb-1.5">
                        <span className="text-(--color-text-secondary)/60 tabular-nums">
                            {ch.currentValue?.toLocaleString()} / {ch.targetValue?.toLocaleString()}
                        </span>
                        <span className={`font-bold tabular-nums ${pct >= 100 ? 'text-(--color-accent)' : 'text-(--color-text-secondary)/60'}`}>
                            {pct}%
                        </span>
                    </div>
                    <div className="h-[5px] bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                                width: `${pct}%`,
                                background: ch.completed
                                    ? 'rgba(74, 222, 128, 0.5)'
                                    : 'linear-gradient(90deg, #d4a04a, #f8c56a)',
                                animation: 'progress-fill 0.8s ease-out',
                            }}
                        />
                    </div>
                </div>

                {isClaimable && (
                    <button
                        onClick={(e) => onClaim(ch.id, e.currentTarget)}
                        disabled={isClaiming}
                        className="mt-4 w-full py-2.5 rounded-lg font-bold text-sm transition-all disabled:opacity-50 cursor-pointer"
                        style={{
                            background: 'linear-gradient(135deg, #c4922e, #f8c56a, #c4922e)',
                            color: '#0a0f1a',
                        }}
                    >
                        {isClaiming ? 'Claiming...' : 'Claim Reward'}
                    </button>
                )}

                {justClaimed && (
                    <div className="mt-3 flex items-center justify-center gap-2 py-2 rounded-lg bg-(--color-accent)/[0.08] border border-(--color-accent)/20">
                        <img src={passionCoin} alt="" className="w-4 h-4" />
                        <span className="text-sm font-bold" style={{ color: '#f8c56a' }}>+{justClaimed} Claimed!</span>
                    </div>
                )}

                {ch.completed && !justClaimed && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-green-400/70">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span>Claimed {ch.completedAt ? new Date(ch.completedAt).toLocaleDateString() : ''}</span>
                    </div>
                )}
            </div>
        </div>
    )
}

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { challengeService } from '../../services/database'
import { usePassion } from '../../context/PassionContext'
import { TIER_MAP, getTierColor, getTierLabel } from '../../config/challengeTiers'
import passionCoin from '../../assets/passion/passion.png'
import forgeLogo from '../../assets/forge.png'
import sparkIcon from '../../assets/spark.png'
import { Flame, Snowflake, TrendingUp, Eye, Target, Award, CheckCircle } from 'lucide-react'

const FORGE_STAT_KEYS = new Set([
    'sparks_fueled', 'sparks_cooled', 'forge_profit',
    'forge_days_visited', 'forge_tutorial_completed',
    'forge_perf_updates_held', 'forge_days_holding',
    'starter_sparks_used',
])

const STAT_ICONS = {
    sparks_fueled: Flame,
    sparks_cooled: Snowflake,
    forge_profit: TrendingUp,
    forge_days_visited: Eye,
    forge_tutorial_completed: Award,
    forge_perf_updates_held: TrendingUp,
    forge_days_holding: Eye,
    starter_sparks_used: Flame,
}

const STAT_LABELS = {
    sparks_fueled: 'Fuel',
    sparks_cooled: 'Cool',
    forge_profit: 'Profit',
    forge_days_visited: 'Visit',
    forge_tutorial_completed: 'Tutorial',
    forge_perf_updates_held: 'Holding',
    forge_days_holding: 'Holding',
    starter_sparks_used: 'Starter',
}

// Flying coins animation for claim
function spawnForgeCoins(sourceEl) {
    const targets = document.querySelectorAll('#passion-balance-coin')
    let target = null
    for (const el of targets) {
        const r = el.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) { target = el; break }
    }
    if (!sourceEl || !target) return

    const sr = sourceEl.getBoundingClientRect()
    const tr = target.getBoundingClientRect()
    const sx = sr.left + sr.width / 2
    const sy = sr.top + sr.height / 2
    const tx = tr.left + tr.width / 2
    const ty = tr.top + tr.height / 2

    for (let i = 0; i < 8; i++) {
        const coin = document.createElement('img')
        coin.src = passionCoin
        const size = 16 + Math.random() * 10
        coin.style.cssText = `position:fixed;left:0;top:0;width:${size}px;height:${size}px;z-index:9999;pointer-events:none;will-change:transform;`
        document.body.appendChild(coin)

        const spreadX = (Math.random() - 0.5) * 100
        const spreadY = (Math.random() - 0.5) * 40
        const startX = sx + spreadX
        const startY = sy + spreadY
        const duration = 800 + Math.random() * 400
        const delay = i * 70
        const hs = size / 2

        const anim = coin.animate([
            { transform: `translate(${startX - hs}px, ${startY - hs}px) scale(1)`, opacity: 1 },
            { transform: `translate(${tx - hs}px, ${ty - hs}px) scale(0.4)`, opacity: 0.3 },
        ], { duration, delay, easing: 'ease-in', fill: 'forwards' })

        anim.onfinish = () => coin.remove()
    }
}

function buildForgeDisplayList(challenges) {
    const flat = Object.values(challenges).flat()
        .filter(ch => FORGE_STAT_KEYS.has(ch.statKey))

    // Group by stat_key, show next uncompleted per chain + any claimable
    const groups = {}
    for (const ch of flat) {
        const key = ch.statKey
        if (!groups[key]) groups[key] = []
        groups[key].push(ch)
    }

    const display = []
    const completed = []

    for (const chain of Object.values(groups)) {
        chain.sort((a, b) => a.targetValue - b.targetValue)
        let shownNext = false
        for (const ch of chain) {
            if (ch.completed && !ch.claimable) {
                completed.push(ch)
                continue
            }
            if (!shownNext) {
                display.push(ch)
                shownNext = true
            } else if (ch.claimable) {
                display.push(ch)
            }
        }
    }

    display.sort((a, b) => {
        if (a.claimable && !b.claimable) return -1
        if (!a.claimable && b.claimable) return 1
        if (a.progress !== b.progress) return b.progress - a.progress
        return a.targetValue - b.targetValue
    })

    return { active: display, completed }
}


export default function ForgeChallengesTab({ loading: parentLoading }) {
    const { updateFromClaim, challengeNotifications } = usePassion()
    const [challengeData, setChallengeData] = useState({})
    const [loading, setLoading] = useState(true)
    const [claimingId, setClaimingId] = useState(null)
    const [justClaimed, setJustClaimed] = useState({})
    const [showCompleted, setShowCompleted] = useState(false)

    const loadChallenges = useCallback(() => {
        return challengeService.getAll()
            .then(data => setChallengeData(data.challenges || {}))
            .catch(err => console.error('Failed to load forge challenges:', err))
            .finally(() => setLoading(false))
    }, [])

    useEffect(() => { loadChallenges() }, [loadChallenges])

    useEffect(() => {
        if (challengeNotifications.length > 0) loadChallenges()
    }, [challengeNotifications.length, loadChallenges])

    const { active, completed } = useMemo(() => buildForgeDisplayList(challengeData), [challengeData])

    const handleClaim = async (challengeId, buttonEl) => {
        setClaimingId(challengeId)
        try {
            const result = await challengeService.claim(challengeId)
            if (result.success) {
                spawnForgeCoins(buttonEl)
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

    if (parentLoading || loading) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <img src={forgeLogo} alt="" className="w-24 h-24 object-contain forge-logo-float opacity-40 mb-3" />
                <div className="forge-head text-[var(--forge-text-dim)] text-lg tracking-wider">Loading challenges...</div>
                <div className="w-32 h-1 mt-2 rounded-full overflow-hidden bg-[var(--forge-edge)]">
                    <div className="h-full forge-shimmer rounded-full" style={{ background: 'var(--forge-flame)' }} />
                </div>
            </div>
        )
    }

    if (active.length === 0 && completed.length === 0) {
        return (
            <div className="text-center py-12">
                <Target className="mx-auto mb-3 opacity-30" size={40} style={{ color: 'var(--forge-text-dim)' }} />
                <p className="forge-body text-[var(--forge-text-dim)]">No forge challenges available yet.</p>
            </div>
        )
    }

    const displayList = showCompleted ? completed : active

    return (
        <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="relative pb-2 mb-4 border-b border-[var(--forge-border)]">
                <h2 className="forge-head text-xl font-bold tracking-wider flex items-center gap-2">
                    <Target size={18} className="text-[var(--forge-flame)]" style={{ filter: 'drop-shadow(0 0 6px rgba(232,101,32,0.4))' }} />
                    <span className="text-[var(--forge-flame-bright)]">Forge Contracts</span>
                </h2>
                <p className="forge-body text-sm text-[var(--forge-text-dim)] mt-1">
                    Complete objectives to earn Passion
                </p>
                <div className="forge-section-accent" />
            </div>

            {/* Toggle active / completed */}
            <div className="flex gap-1 mb-5">
                <button
                    onClick={() => setShowCompleted(false)}
                    className={`px-4 py-1.5 forge-head text-sm font-semibold tracking-wider transition-all ${
                        !showCompleted
                            ? 'text-[var(--forge-flame-bright)] bg-[var(--forge-flame)]/10 border border-[var(--forge-flame)]/25'
                            : 'text-[var(--forge-text-dim)] border border-transparent hover:text-[var(--forge-text-mid)]'
                    }`}
                >
                    Active ({active.length})
                </button>
                {completed.length > 0 && (
                    <button
                        onClick={() => setShowCompleted(true)}
                        className={`px-4 py-1.5 forge-head text-sm font-semibold tracking-wider transition-all ${
                            showCompleted
                                ? 'text-[var(--forge-gain)] bg-[var(--forge-gain)]/10 border border-[var(--forge-gain)]/25'
                                : 'text-[var(--forge-text-dim)] border border-transparent hover:text-[var(--forge-text-mid)]'
                        }`}
                    >
                        Completed ({completed.length})
                    </button>
                )}
            </div>

            {displayList.length === 0 ? (
                <div className="text-center py-12 text-[var(--forge-text-dim)]">
                    {showCompleted ? 'No completed contracts yet.' : 'All contracts completed!'}
                </div>
            ) : (
                <div className="flex flex-col gap-3 forge-stagger">
                    {displayList.map((ch, i) => (
                        <ForgeChallengeCard
                            key={ch.id}
                            challenge={ch}
                            index={i}
                            claimingId={claimingId}
                            justClaimed={justClaimed[ch.id]}
                            onClaim={handleClaim}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}


function ForgeChallengeCard({ challenge: ch, index, claimingId, justClaimed, onClaim }) {
    const pct = Math.round(ch.progress * 100)
    const tierColor = getTierColor(ch.tier)
    const isClaiming = claimingId === ch.id
    const isClaimable = ch.claimable && !justClaimed && !ch.completed
    const StatIcon = STAT_ICONS[ch.statKey] || Flame
    const statLabel = STAT_LABELS[ch.statKey] || ''

    return (
        <div
            className={`forge-challenge-card relative bg-[var(--forge-panel)] border overflow-hidden transition-all ${
                isClaimable
                    ? 'border-[var(--forge-gold)]/40 forge-challenge-claimable'
                    : ch.completed && !ch.claimable
                    ? 'border-[var(--forge-gain)]/20 opacity-70'
                    : 'border-[var(--forge-edge)]'
            }`}
        >
            {/* Left tier accent */}
            <div className="absolute top-0 left-0 w-[3px] h-full" style={{ background: tierColor }} />

            {/* Claimable shimmer */}
            {isClaimable && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div
                        className="absolute inset-0 w-1/3"
                        style={{
                            background: 'linear-gradient(90deg, transparent, rgba(232,101,32,0.06), transparent)',
                            animation: 'forge-challenge-shimmer 4s ease-in-out infinite',
                        }}
                    />
                </div>
            )}

            <div className="relative p-3 sm:p-4 pl-4 sm:pl-5 flex items-start gap-3 sm:gap-4">
                {/* Icon badge */}
                <div
                    className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 flex items-center justify-center"
                    style={{
                        background: `linear-gradient(135deg, ${tierColor}20, ${tierColor}08)`,
                        border: `1px solid ${tierColor}30`,
                    }}
                >
                    <StatIcon size={22} style={{ color: tierColor }} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3 mb-1">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                                <h3 className="forge-head text-sm sm:text-base font-bold tracking-wider text-[var(--forge-text)]">{ch.title}</h3>
                                {ch.givesBadge && (
                                    <Award size={14} className="text-[var(--forge-gold-bright)] flex-shrink-0" />
                                )}
                            </div>
                            <p className="forge-body text-xs sm:text-sm text-[var(--forge-text-dim)] leading-relaxed">{ch.description}</p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                            {/* Tier badge */}
                            <span
                                className="forge-head text-[0.65rem] font-bold tracking-wider px-2 py-0.5"
                                style={{ backgroundColor: `${tierColor}18`, color: tierColor, border: `1px solid ${tierColor}25` }}
                            >
                                {TIER_MAP[ch.tier]?.image && <img src={TIER_MAP[ch.tier].image} alt="" className="w-3.5 h-3.5 object-contain inline mr-1" />}
                                {getTierLabel(ch.tier)}
                            </span>
                            {/* Reward */}
                            <div className="flex items-center gap-1">
                                <span className="forge-num text-base font-bold text-[var(--forge-gold-bright)]">+{ch.reward}</span>
                                <img src={passionCoin} alt="" className="w-4 h-4" />
                            </div>
                        </div>
                    </div>

                    {/* Category tag */}
                    <div className="flex items-center gap-2 mt-1.5 mb-2.5">
                        <span className="forge-head text-[0.6rem] font-semibold tracking-widest px-1.5 py-px text-[var(--forge-text-dim)] bg-[var(--forge-surface)] border border-[var(--forge-border)]">
                            {statLabel}
                        </span>
                        {ch.type === 'repeatable' && (
                            <span className="forge-head text-[0.6rem] font-semibold tracking-widest px-1.5 py-px text-[var(--forge-flame)] bg-[var(--forge-flame)]/8 border border-[var(--forge-flame)]/15">
                                Repeatable
                            </span>
                        )}
                    </div>

                    {/* Progress bar */}
                    <div>
                        <div className="flex justify-between items-baseline text-xs mb-1.5">
                            <span className="forge-num text-[var(--forge-text-dim)]">
                                {ch.currentValue?.toLocaleString()} / {ch.targetValue?.toLocaleString()}
                            </span>
                            <span className={`forge-num font-bold ${pct >= 100 ? 'text-[var(--forge-gold-bright)]' : 'text-[var(--forge-text-dim)]'}`}>
                                {pct}%
                            </span>
                        </div>
                        <div className="h-[6px] bg-[var(--forge-surface)] overflow-hidden" style={{ clipPath: 'polygon(2px 0, 100% 0, calc(100% - 2px) 100%, 0 100%)' }}>
                            <div
                                className="h-full transition-all duration-700"
                                style={{
                                    width: `${Math.min(pct, 100)}%`,
                                    background: ch.completed
                                        ? 'linear-gradient(90deg, rgba(74,222,128,0.4), rgba(74,222,128,0.7))'
                                        : `linear-gradient(90deg, ${tierColor}80, ${tierColor})`,
                                    clipPath: 'polygon(2px 0, 100% 0, calc(100% - 2px) 100%, 0 100%)',
                                    animation: 'forge-progress-fill 0.8s ease-out',
                                }}
                            />
                        </div>
                    </div>

                    {/* Claim button */}
                    {isClaimable && (
                        <button
                            onClick={(e) => onClaim(ch.id, e.currentTarget)}
                            disabled={isClaiming}
                            className="mt-3 w-full py-2.5 forge-head text-sm font-bold tracking-wider text-white cursor-pointer forge-clip-btn transition-all disabled:opacity-50"
                            style={{
                                background: 'linear-gradient(135deg, var(--forge-flame), var(--forge-ember))',
                                boxShadow: '0 4px 20px rgba(232,101,32,0.3)',
                            }}
                        >
                            {isClaiming ? 'Claiming...' : 'Claim Reward'}
                        </button>
                    )}

                    {/* Just claimed */}
                    {justClaimed && (
                        <div className="mt-3 flex items-center justify-center gap-2 py-2 bg-[var(--forge-gain)]/8 border border-[var(--forge-gain)]/20">
                            <img src={passionCoin} alt="" className="w-4 h-4" />
                            <span className="forge-num text-sm font-bold text-[var(--forge-gold-bright)]">+{justClaimed} Claimed!</span>
                        </div>
                    )}

                    {/* Completed state */}
                    {ch.completed && !justClaimed && (
                        <div className="mt-2.5 flex items-center gap-2 text-xs text-[var(--forge-gain)]">
                            <CheckCircle size={14} />
                            <span className="forge-body">Claimed {ch.completedAt ? new Date(ch.completedAt).toLocaleDateString() : ''}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

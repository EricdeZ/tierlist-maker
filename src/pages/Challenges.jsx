import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { challengeService } from '../services/database'
import { usePassion } from '../context/PassionContext'
import { useAuth } from '../context/AuthContext'
import PageTitle from '../components/PageTitle'
import Navbar from '../components/layout/Navbar'
import RankBanner from '../components/RankBanner'
import { CHALLENGE_TIERS, TIER_MAP, getTierColor, getTierLabel } from '../config/challengeTiers'
import passionCoin from '../assets/passion/passion.png'
import uniqueIcon from '../assets/ranks/unique.png'

const DiscordIcon = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z" />
    </svg>
)

// ─── Flying coins — straight line to passion balance ───
function spawnFlyingCoins(sourceEl, coinSrc) {
    // Two PassionDisplay instances exist (desktop + mobile); pick the visible one
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
        coin.src = coinSrc
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
function buildDisplayList(challenges, activeTier) {
    // "Completed" view: all completed challenges across every tier
    if (activeTier === 'completed') {
        return Object.values(challenges).flat()
            .filter(ch => ch.completed)
            .sort((a, b) => {
                const da = a.completedAt ? new Date(a.completedAt) : 0
                const db = b.completedAt ? new Date(b.completedAt) : 0
                return db - da
            })
    }

    // When filtering by a specific tier, show incomplete + claimable only
    // Unique tier: always show all (including taken) as a showcase
    if (activeTier !== 'all') {
        const tierChallenges = activeTier === 'unique'
            ? (challenges[activeTier] || [])
            : (challenges[activeTier] || []).filter(ch => !ch.completed || ch.claimable)
        return [...tierChallenges].sort((a, b) => {
            if (a.claimable && !b.claimable) return -1
            if (!a.claimable && b.claimable) return 1
            if (a.progress !== b.progress) return b.progress - a.progress
            return a.targetValue - b.targetValue
        })
    }

    // "All" view: use smart grouping by stat_key chains, hide completed
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
            // Always show unique challenges (even taken) as a showcase
            if (ch.tier === 'unique') {
                display.push(ch)
                continue
            }
            if (ch.completed) continue
            if (!shownNext) {
                display.push(ch)
                shownNext = true
            }
        }
    }

    // Also include claimable challenges that are technically "completed" but not yet claimed
    for (const ch of flat) {
        if (ch.claimable && !display.find(d => d.id === ch.id)) display.push(ch)
    }

    display.sort((a, b) => {
        if (a.claimable && !b.claimable) return -1
        if (!a.claimable && b.claimable) return 1
        if (a.progress !== b.progress) return b.progress - a.progress
        return a.targetValue - b.targetValue
    })

    return display
}


// ═══════════════════════════════════════════════════
// Tier Filter Bar — horizontal scroll with fade hint
// ═══════════════════════════════════════════════════
function TierFilterBar({ availableTiers, activeTier, setActiveTier, completedCount }) {
    const scrollRef = useRef(null)
    const [canScroll, setCanScroll] = useState(false)
    const [atEnd, setAtEnd] = useState(false)

    const checkOverflow = useCallback(() => {
        const el = scrollRef.current
        if (!el) return
        const overflows = el.scrollWidth > el.clientWidth + 2
        setCanScroll(overflows)
        setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2)
    }, [])

    useEffect(() => {
        checkOverflow()
        const ro = new ResizeObserver(checkOverflow)
        if (scrollRef.current) ro.observe(scrollRef.current)
        return () => ro.disconnect()
    }, [checkOverflow, availableTiers])

    const handleScroll = () => {
        const el = scrollRef.current
        if (!el) return
        setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2)
    }

    const scrollRight = () => {
        scrollRef.current?.scrollBy({ left: 160, behavior: 'smooth' })
    }

    return (
        <div className="relative mb-6">
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex gap-1.5 overflow-x-auto py-1 tier-filter-scroll sm:flex-wrap"
                style={canScroll ? { paddingRight: '2.5rem' } : undefined}
            >
                <button
                    onClick={() => setActiveTier('all')}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                        activeTier === 'all'
                            ? 'bg-(--color-accent) text-(--color-primary)'
                            : 'bg-white/[0.06] text-(--color-text-secondary)/70 hover:bg-white/10'
                    }`}
                >
                    All
                </button>
                {availableTiers.map(tier => (
                    <button
                        key={tier.key}
                        onClick={() => setActiveTier(tier.key)}
                        className="px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer shrink-0 inline-flex items-center gap-1.5"
                        style={
                            activeTier === tier.key
                                ? { backgroundColor: tier.color, color: '#0a0f1a' }
                                : { backgroundColor: 'rgba(255,255,255,0.04)', color: `${tier.color}cc` }
                        }
                    >
                        {tier.image && <img src={tier.image} alt="" className="w-4 h-4 object-contain" />}
                        {tier.label}
                    </button>
                ))}
                {completedCount > 0 && (
                    <button
                        onClick={() => setActiveTier('completed')}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                            activeTier === 'completed'
                                ? 'bg-green-500/80 text-(--color-primary)'
                                : 'bg-white/[0.06] text-green-400/70 hover:bg-white/10'
                        }`}
                    >
                        Completed ({completedCount})
                    </button>
                )}
            </div>

            {/* Fade + wiggle arrow hint */}
            {canScroll && !atEnd && (
                <button
                    onClick={scrollRight}
                    className="absolute right-0 top-0 bottom-0 w-10 flex items-center justify-end cursor-pointer"
                    style={{ background: 'linear-gradient(to right, transparent, var(--color-primary) 60%)' }}
                    aria-label="Scroll for more tiers"
                >
                    <svg className="w-4 h-4 text-(--color-text-secondary) tier-arrow-wiggle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            )}
        </div>
    )
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
    const [activeTier, setActiveTier] = useState('all')

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

    const displayList = useMemo(() => buildDisplayList(challengeData, activeTier), [challengeData, activeTier])

    // Count how many tiers have challenges (for showing filter)
    const availableTiers = useMemo(() => {
        return CHALLENGE_TIERS.filter(t => challengeData[t.key]?.length > 0)
    }, [challengeData])

    const completedCount = useMemo(() => {
        return Object.values(challengeData).flat().filter(ch => ch.completed).length
    }, [challengeData])

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
            <Navbar title="Challenges" />
            <PageTitle title="Challenges - Earn Passion" description="Complete challenges to earn Passion and climb the ranks on SMITE 2 Companion. Daily challenges, achievement badges, and career milestones." />

            <div className="max-w-5xl mx-auto px-4 pt-24 pb-8">

                {/* Rank progression banner */}
                <RankBanner />

                {/* Page header */}
                <div className="mt-8 mb-4">
                    <h1 className="text-2xl sm:text-3xl font-bold font-heading">Challenges</h1>
                    <p className="text-sm text-(--color-text-secondary)/70 mt-1">
                        Complete challenges to earn Passion and rank up
                    </p>
                </div>

                {/* Tier filter pills */}
                {!loading && availableTiers.length > 1 && (
                    <TierFilterBar
                        availableTiers={availableTiers}
                        activeTier={activeTier}
                        setActiveTier={setActiveTier}
                        completedCount={completedCount}
                    />
                )}

                {/* Sign-in prompt for unauthenticated users */}
                {!authLoading && !user && (
                    <div className="flex items-center justify-between gap-4 mb-6 px-5 py-4 rounded-xl border border-(--color-accent)/15 bg-(--color-accent)/[0.04]">
                        <div className="flex items-center gap-3 min-w-0">
                            <img src={passionCoin} alt="" className="w-8 h-8 shrink-0 opacity-60" />
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-(--color-text)">Show your Passion!</p>
                                <p className="text-xs text-(--color-text-secondary)/50">Log in to track progress, complete challenges, and earn Passion</p>
                            </div>
                        </div>
                        <button
                            onClick={login}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs text-white transition-all hover:opacity-90 active:scale-95 cursor-pointer shrink-0"
                            style={{ backgroundColor: '#5865F2' }}
                        >
                            <DiscordIcon className="w-4 h-4" />
                            Log in with Discord
                        </button>
                    </div>
                )}

                {/* Unique tier disclaimer */}
                {activeTier === 'unique' && !loading && (
                    <div className="flex items-center gap-3 mb-6 px-5 py-4 rounded-xl border border-[#d4a539]/20 bg-[#d4a539]/[0.04]">
                        <img src={uniqueIcon} alt="" className="w-8 h-8 shrink-0 object-contain" />
                        <div className="min-w-0">
                            <p className="text-sm font-bold" style={{ color: '#d4a539' }}>Unique Challenges</p>
                            <p className="text-xs text-(--color-text-secondary)/50">
                                These challenges can only be claimed once — by one person, ever. Once taken, they are displayed here as a showcase.
                            </p>
                        </div>
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
                        {activeTier === 'completed' ? 'No completed challenges yet.' :
                         activeTier !== 'all' ? `No ${getTierLabel(activeTier)} challenges yet.` :
                         'No challenges available yet.'}
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
                                userId={user?.id}
                                showTierBadge={activeTier === 'all'}
                            />
                        ))}
                    </div>
                )}
            </div>

            <style>{`
                .tier-filter-scroll {
                    scrollbar-width: none;
                    -ms-overflow-style: none;
                }
                .tier-filter-scroll::-webkit-scrollbar {
                    display: none;
                }
                @keyframes tier-arrow-wiggle {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(3px); }
                    75% { transform: translateX(-1px); }
                }
                .tier-arrow-wiggle {
                    animation: tier-arrow-wiggle 1.2s ease-in-out infinite;
                }
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
function ChallengeCard({ challenge: ch, index, claimingId, justClaimed, onClaim, isLoggedIn, showTierBadge, userId }) {
    const pct = Math.round(ch.progress * 100)
    const tierColor = getTierColor(ch.tier)
    const isClaiming = claimingId === ch.id
    const isClaimable = isLoggedIn && ch.claimable && !justClaimed && !ch.completed
    const holders = ch.holders
    const isGrandfathered = holders?.some(h => h.userId === userId)
    const takenByOther = ch.tier === 'unique' && holders?.length > 0 && !isGrandfathered

    return (
        <div
            className={`
                relative rounded-xl
                bg-(--color-secondary) border border-white/[0.06]
                overflow-hidden transition-all duration-300
                ${(ch.completed && !ch.claimable) || takenByOther ? 'opacity-60' : ''}
                ${isClaimable ? 'border-r-(--color-accent)/25 border-t-(--color-accent)/25 border-b-(--color-accent)/25' : ''}
            `}
            style={{
                borderLeftWidth: '3px',
                borderLeftColor: tierColor,
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
                        <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="font-bold text-sm sm:text-base font-heading leading-tight">{ch.title}</h3>
                            {ch.givesBadge && (
                                <span className="text-xs" title="Earns a profile badge">&#9733;</span>
                            )}
                        </div>
                        <p className="text-xs text-(--color-text-secondary)/60 leading-relaxed">{ch.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 mt-0.5">
                        {showTierBadge && (
                            <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded inline-flex items-center gap-1"
                                style={{ backgroundColor: `${tierColor}20`, color: tierColor }}
                            >
                                {TIER_MAP[ch.tier]?.image && <img src={TIER_MAP[ch.tier].image} alt="" className="w-3.5 h-3.5 object-contain" />}
                                {getTierLabel(ch.tier)}
                            </span>
                        )}
                        <div className="flex items-center gap-1">
                            <span className="text-sm font-bold" style={{ color: '#f8c56a' }}>+{ch.reward}</span>
                            <img src={passionCoin} alt="" className="w-4 h-4" />
                        </div>
                    </div>
                </div>

                {ch.type === 'repeatable' && (
                    <span className="inline-block text-[10px] text-(--color-text-secondary)/50 border border-white/[0.08] rounded px-1.5 py-px mb-2">
                        Repeatable
                    </span>
                )}
                {ch.tier === 'unique' && !holders?.length && (
                    <span className="inline-block text-[10px] border rounded px-1.5 py-px mb-2" style={{ color: '#d4a539', borderColor: '#d4a53940' }}>
                        Unclaimed
                    </span>
                )}

                {/* Taken unique challenge — showcase layout */}
                {takenByOther && holders?.length > 0 && (
                    <div className="mt-3 rounded-lg px-3 py-3 bg-[#d4a539]/[0.06] border border-[#d4a539]/15">
                        <div className="text-[10px] uppercase tracking-wider font-bold mb-2.5" style={{ color: '#d4a539' }}>
                            Claimed by
                        </div>
                        <div className="flex flex-col gap-2">
                            {holders.map(h => (
                                <div key={h.userId} className="flex items-center gap-2.5">
                                    {h.avatar && h.discordId ? (
                                        <img
                                            src={`https://cdn.discordapp.com/avatars/${h.discordId}/${h.avatar}.png?size=64`}
                                            alt=""
                                            className="w-7 h-7 rounded-full ring-2 ring-[#d4a539]/30"
                                        />
                                    ) : (
                                        <div className="w-7 h-7 rounded-full bg-white/10 ring-2 ring-[#d4a539]/30" />
                                    )}
                                    <div>
                                        <span className="text-sm font-bold" style={{ color: '#d4a539' }}>
                                            {h.username}
                                        </span>
                                        {h.claimedAt && (
                                            <span className="text-[10px] text-(--color-text-secondary)/40 ml-2">
                                                {new Date(h.claimedAt).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Own holder display (grandfathered) */}
                {!takenByOther && holders?.length > 0 && (
                    <div className="flex flex-col gap-1.5 mb-2">
                        {holders.map(h => (
                            <div key={h.userId} className="flex items-center gap-2">
                                {h.avatar && h.discordId ? (
                                    <img
                                        src={`https://cdn.discordapp.com/avatars/${h.discordId}/${h.avatar}.png?size=32`}
                                        alt=""
                                        className="w-5 h-5 rounded-full"
                                    />
                                ) : (
                                    <div className="w-5 h-5 rounded-full bg-white/10" />
                                )}
                                <span className="text-[11px] font-bold" style={{ color: '#d4a539' }}>
                                    {h.username}
                                </span>
                                <span className="text-[10px] text-(--color-text-secondary)/40">
                                    {h.claimedAt ? new Date(h.claimedAt).toLocaleDateString() : ''}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Progress bar — hidden for taken unique challenges */}
                {!takenByOther && (
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
                                        : `linear-gradient(90deg, ${tierColor}99, ${tierColor})`,
                                    animation: 'progress-fill 0.8s ease-out',
                                }}
                            />
                        </div>
                    </div>
                )}

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

                {ch.completed && !justClaimed && !takenByOther && (
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

import { useMemo } from 'react'
import { usePassion } from '../context/PassionContext'
import { RANK_THRESHOLDS, getRank, getNextRank, formatRank } from '../config/ranks'
import RankBadge from './RankBadge'
import passionCoin from '../assets/passion/passion.png'

function divisionLabel(r) {
    if (!r.division) return r.name
    const num = r.division === 'III' ? 3 : r.division === 'II' ? 2 : 1
    return `${r.name} ${num}`
}

export default function RankBanner({ totalEarned: propTotal }) {
    const ctx = usePassion()
    const totalEarned = propTotal ?? ctx.totalEarned
    const rank = propTotal != null ? getRank(propTotal) : ctx.rank
    const nextRank = propTotal != null ? getNextRank(propTotal) : ctx.nextRank

    const nextRankProgressPct = nextRank
        ? ((totalEarned - rank.minPassion) / (nextRank.minPassion - rank.minPassion)) * 100
        : 100

    const { milestones, tiers, progressPct } = useMemo(() => {
        // Find current rank index
        let currentIdx = 0
        for (let i = 0; i < RANK_THRESHOLDS.length; i++) {
            if (totalEarned >= RANK_THRESHOLDS[i].minPassion) currentIdx = i
        }

        // Find start of current tier (first entry with same name)
        let tierStart = currentIdx
        while (tierStart > 0 && RANK_THRESHOLDS[tierStart - 1].name === RANK_THRESHOLDS[currentIdx].name) {
            tierStart--
        }

        // Find first index of NEXT tier
        let nextTierFirst = currentIdx + 1
        while (nextTierFirst < RANK_THRESHOLDS.length && RANK_THRESHOLDS[nextTierFirst].name === RANK_THRESHOLDS[currentIdx].name) {
            nextTierFirst++
        }

        // Milestones: from tierStart to first of next tier (inclusive)
        let end = Math.min(nextTierFirst + 1, RANK_THRESHOLDS.length)
        let start = tierStart

        // Ensure minimum 4 milestones — pad from left then right
        while (end - start < 4 && start > 0) start--
        while (end - start < 4 && end < RANK_THRESHOLDS.length) end++

        const ms = RANK_THRESHOLDS.slice(start, end)

        // Progress: position within the visible range
        const first = ms[0]
        const last = ms[ms.length - 1]
        const range = last.minPassion - first.minPassion
        const pct = range > 0
            ? Math.min(((totalEarned - first.minPassion) / range) * 100, 100)
            : 100

        // Unique tiers for bottom row (deduplicated by name)
        const t = []
        const seen = new Set()
        for (const r of RANK_THRESHOLDS) {
            if (!seen.has(r.name)) {
                seen.add(r.name)
                t.push(r)
            }
        }

        return { milestones: ms, tiers: t, progressPct: pct }
    }, [totalEarned])

    return (
        <>
        {/* ═══ Mobile compact view ═══ */}
        <div className="sm:hidden rounded-xl border border-white/[0.08] bg-(--color-secondary) overflow-hidden">
            <div className="px-4 py-4 flex flex-col items-center gap-4">
                <div style={{ filter: 'drop-shadow(0 0 10px rgba(248,197,106,0.3))' }}>
                    <RankBadge rank={rank} size="2xl" />
                </div>
                <div className="flex-1 min-w-0 w-full items-center text-center">
                    <div className="text-sm font-bold font-heading text-(--color-accent)">
                        {formatRank(rank)}
                    </div>
                    <div className="flex items-center justify-center gap-1.5 mt-1">
                        <img src={passionCoin} alt="" className="w-8 h-8" />
                        <span className="text-2xl font-bold font-heading" style={{ color: '#f8c56a' }}>
                            {totalEarned.toLocaleString()}
                        </span>
                    </div>
                    {nextRank ? (
                        <div className="mt-2">
                            <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-1000 ease-out"
                                    style={{
                                        width: `${nextRankProgressPct}%`,
                                        background: 'linear-gradient(90deg, #d4a04a, #f8c56a)',
                                    }}
                                />
                            </div>
                            <div className="text-[10px] text-(--color-text-secondary)/50 mt-1">
                                {nextRank.passionNeeded} to {formatRank(nextRank)}
                            </div>
                        </div>
                    ) : (
                        <div className="text-[10px] font-medium mt-1" style={{ color: '#f8c56a' }}>
                            Maximum Rank
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* ═══ Desktop full view ═══ */}
        <div className="hidden sm:block rounded-xl border border-white/[0.08] bg-(--color-secondary) overflow-hidden">
            {/* Milestone progression */}
            <div className="px-6 sm:px-10 pt-6 pb-5">
                {/* Rank badges with labels */}
                <div className="flex justify-between items-end mb-3">
                    {milestones.map((m, i) => {
                        const isActive = m.minPassion === rank.minPassion
                            && m.name === rank.name && m.division === rank.division
                        const isFuture = totalEarned < m.minPassion
                        return (
                            <div key={`${m.name}-${m.division}-${i}`}
                                className="flex flex-col items-center transition-all duration-500"
                                style={{ opacity: isFuture ? 0.35 : 1 }}
                            >
                                <div className="transition-transform duration-500 overflow-visible"
                                    style={isActive ? {
                                        filter: 'drop-shadow(0 0 12px rgba(248,197,106,0.35))',
                                    } : undefined}
                                >
                                    <RankBadge rank={m} size={'xl'} />
                                </div>
                                <span className={`text-[10px] sm:text-xs mt-1.5 px-2.5 py-0.5 rounded font-semibold ${
                                    isActive
                                        ? 'bg-(--color-accent)/10 text-(--color-accent) border border-(--color-accent)/25'
                                        : 'text-(--color-text-secondary)/60'
                                }`}>
                                    {divisionLabel(m)}
                                </span>
                            </div>
                        )
                    })}
                </div>

                {/* Progress bar */}
                <div className="relative px-[55px]">
                    <div className="h-[6px] bg-white/[0.08] rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-1000 ease-out"
                            style={{
                                width: `${progressPct}%`,
                                background: 'linear-gradient(90deg, #d4a04a, #f8c56a, #ffe4a0)',
                            }}
                        />
                    </div>
                </div>


                {/* Current passion + "to go" */}
                <div className="text-center mt-4">
                    <div className="flex items-center justify-center gap-2">
                        <img src={passionCoin} alt="" className="w-10 h-10" />
                        <span className="text-2xl font-bold font-heading" style={{ color: '#f8c56a' }}>
                            {totalEarned.toLocaleString()}
                        </span>
                    </div>
                    {!nextRank && (
                        <div className="text-xs font-medium mt-1" style={{ color: '#f8c56a' }}>
                            Maximum Rank
                        </div>
                    )}
                </div>
            </div>

            {/* All tiers row */}
            <div className="hidden md:block border-t border-white/[0.06] px-3 py-3 overflow-hidden">
                <div className="flex justify-between w-full items-center gap-1 sm:gap-1.5">
                    {tiers.map(tier => {
                        const reached = totalEarned >= tier.minPassion
                        const isCurrent = tier.name === rank.name
                        return (
                            <div key={tier.name} className={`flex flex-col items-center flex-1 min-w-0 transition-opacity ${
                                !reached ? 'opacity-25' : ''
                            }`}>
                                <RankBadge rank={{ ...tier, division: null }} size="md" />
                                <span className="text-[8px] sm:text-[9px] text-(--color-text-secondary)/50 mt-0.5 tabular-nums">
                                    {tier.minPassion > 0 ? tier.minPassion.toLocaleString() : '0'}
                                </span>
                                <span className={`text-[7px] sm:text-[8px] mt-0.5 px-1 sm:px-1.5 py-px rounded font-medium ${
                                    isCurrent
                                        ? 'bg-(--color-accent)/10 text-(--color-accent)'
                                        : 'text-(--color-text-secondary)/50'
                                }`}>
                                    {tier.name}
                                </span>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
        </>
    )
}

import { Target, Gift } from 'lucide-react'
import DashboardWidget from './DashboardWidget'

const TIER_STYLES = {
    bronze:   { color: 'text-amber-600',  dot: 'bg-amber-600' },
    silver:   { color: 'text-slate-400',  dot: 'bg-slate-400' },
    gold:     { color: 'text-yellow-400', dot: 'bg-yellow-400' },
    platinum: { color: 'text-cyan-400',   dot: 'bg-cyan-400' },
}

function barColor(pct) {
    if (pct >= 80) return 'bg-emerald-400'
    if (pct >= 50) return 'bg-emerald-500'
    return 'bg-emerald-700'
}

export default function ChallengesProgress({ challenges, claimableCount }) {
    const sorted = (challenges || [])
        .filter(c => !c.completed && c.progress < c.targetValue)
        .map(c => ({ ...c, pct: (c.progress / c.targetValue) * 100 }))
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 3)

    return (
        <DashboardWidget title="Challenges" icon={<Target size={16} />} linkTo="/challenges" accent="emerald">
            <div className="space-y-3">
                {claimableCount > 0 && (
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <Gift size={13} className="text-emerald-400 shrink-0" />
                        <span className="text-xs font-bold text-emerald-400">{claimableCount} reward{claimableCount !== 1 ? 's' : ''} to claim!</span>
                    </div>
                )}

                {sorted.length === 0 && claimableCount === 0 && (
                    <p className="text-sm text-(--color-text-secondary) py-2 text-center">Complete challenges to earn Passion</p>
                )}

                {sorted.map(c => {
                    const tier = TIER_STYLES[c.tier] || TIER_STYLES.bronze
                    return (
                        <div key={c.id}>
                            <div className="flex justify-between text-xs mb-1">
                                <div className="flex items-center gap-1.5 truncate pr-2 min-w-0">
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tier.dot}`} />
                                    <span className="truncate">{c.title}</span>
                                </div>
                                <span className="text-(--color-text-secondary) shrink-0">{c.progress}/{c.targetValue}</span>
                            </div>
                            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${barColor(c.pct)}`} style={{ width: `${c.pct}%` }} />
                            </div>
                        </div>
                    )
                })}
            </div>
        </DashboardWidget>
    )
}

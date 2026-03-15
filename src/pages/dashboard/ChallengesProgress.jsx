import { Target } from 'lucide-react'
import DashboardWidget from './DashboardWidget'

export default function ChallengesProgress({ challenges, claimableCount }) {
    // Sort by completion percentage descending, take closest 3
    const sorted = (challenges || [])
        .filter(c => c.current_value < c.target_value)
        .map(c => ({ ...c, pct: (c.current_value / c.target_value) * 100 }))
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 3)

    return (
        <DashboardWidget title="Challenges" icon={<Target size={16} />} linkTo="/challenges" accent="emerald">
            <div className="space-y-3">
                {claimableCount > 0 && (
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-emerald-500/10">
                        <span className="text-xs font-bold text-emerald-400">{claimableCount} reward{claimableCount !== 1 ? 's' : ''} to claim!</span>
                    </div>
                )}

                {sorted.length === 0 && claimableCount === 0 && (
                    <p className="text-sm text-(--color-text-secondary) py-2 text-center">Complete challenges to earn Passion</p>
                )}

                {sorted.map(c => (
                    <div key={c.id}>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="truncate pr-2">{c.title}</span>
                            <span className="text-(--color-text-secondary) shrink-0">{c.current_value}/{c.target_value}</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${c.pct}%` }} />
                        </div>
                    </div>
                ))}
            </div>
        </DashboardWidget>
    )
}

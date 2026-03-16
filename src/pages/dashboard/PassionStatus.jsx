import { Flame } from 'lucide-react'
import DashboardWidget from './DashboardWidget'
import RankBadge from '../../components/RankBadge'
import { formatRank } from '../../config/ranks'

export default function PassionStatus({ balance, rank, nextRank, totalEarned, currentStreak, canClaimDaily, onClaimDaily }) {
    const progressPct = nextRank
        ? Math.min(100, ((totalEarned - (rank?.minPassion || 0)) / ((nextRank?.minPassion || 1) - (rank?.minPassion || 0))) * 100)
        : 100

    return (
        <DashboardWidget title="Passion" icon={<Flame size={16} />} linkTo="/leaderboard" accent="amber">
            <div className="flex flex-col gap-3">
                {/* Rank badge + name on one line */}
                <div className="flex items-center gap-3">
                    <RankBadge rank={rank} size="lg" />
                    <div>
                        <p className="font-heading font-bold text-sm leading-tight">{formatRank(rank) || 'Unranked'}</p>
                        <p className="text-2xl font-bold leading-tight">{(balance || 0).toLocaleString()}</p>
                        <p className="text-xs text-amber-400/70">Passion</p>
                    </div>
                </div>

                {/* Streak */}
                {currentStreak > 0 && (
                    <div className="flex items-center gap-1.5">
                        <Flame size={13} className="text-orange-400" />
                        <span className="text-sm font-semibold">{currentStreak} day streak</span>
                    </div>
                )}

                {/* Progress bar */}
                {nextRank && (
                    <div>
                        <div className="flex justify-between text-xs text-(--color-text-secondary) mb-1">
                            <span>{formatRank(rank)}</span>
                            <span>{formatRank(nextRank)}</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                        </div>
                    </div>
                )}

                {/* Daily claim */}
                {canClaimDaily && (
                    <button
                        onClick={onClaimDaily}
                        className="w-full py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-1.5"
                    >
                        <Flame size={14} />
                        Claim Daily Passion
                    </button>
                )}
            </div>
        </DashboardWidget>
    )
}

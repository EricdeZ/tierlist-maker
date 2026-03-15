import { Flame } from 'lucide-react'
import DashboardWidget from './DashboardWidget'

export default function PassionStatus({ balance, rank, nextRank, totalEarned, currentStreak, canClaimDaily, onClaimDaily }) {
    const progressPct = nextRank
        ? Math.min(100, ((totalEarned - (rank?.threshold || 0)) / ((nextRank?.threshold || 1) - (rank?.threshold || 0))) * 100)
        : 100

    return (
        <DashboardWidget title="Passion" icon={<Flame size={16} />} linkTo="/leaderboard" accent="amber" className="md:row-span-2">
            <div className="flex flex-col gap-3">
                {/* Rank badge */}
                <div className="text-center">
                    {rank?.image && <img src={rank.image} alt={rank.name} className="w-16 h-16 mx-auto mb-1" />}
                    <p className="font-heading font-bold text-sm">{rank?.name || 'Unranked'}</p>
                </div>

                {/* Balance */}
                <div className="text-center">
                    <p className="text-2xl font-bold">{(balance || 0).toLocaleString()}</p>
                    <p className="text-xs text-(--color-text-secondary)">Passion</p>
                </div>

                {/* Streak */}
                {currentStreak > 0 && (
                    <div className="flex items-center justify-center gap-1.5">
                        <Flame size={14} className="text-orange-400" />
                        <span className="text-sm font-semibold">{currentStreak} day streak</span>
                    </div>
                )}

                {/* Progress bar */}
                {nextRank && (
                    <div>
                        <div className="flex justify-between text-xs text-(--color-text-secondary) mb-1">
                            <span>{rank?.name}</span>
                            <span>{nextRank.name}</span>
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
                        className="w-full py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors"
                    >
                        Claim Daily Passion
                    </button>
                )}
            </div>
        </DashboardWidget>
    )
}

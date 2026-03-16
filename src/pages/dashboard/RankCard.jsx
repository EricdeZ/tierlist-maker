import { Award } from 'lucide-react'
import DashboardWidget from './DashboardWidget'
import RankBadge from '../../components/RankBadge'
import { formatRank } from '../../config/ranks'

export default function RankCard({ rank, nextRank, totalEarned }) {
    const progressPct = nextRank
        ? Math.min(100, ((totalEarned - (rank?.minPassion || 0)) / ((nextRank?.minPassion || 1) - (rank?.minPassion || 0))) * 100)
        : 100

    const passionToNext = nextRank ? nextRank.minPassion - totalEarned : 0

    return (
        <DashboardWidget title="SmiteComp Rank" icon={<Award size={16} />} linkTo="/leaderboard" accent="amber">
            <div className="flex items-center gap-4">
                <RankBadge rank={rank} size="xl" />
                <div className="flex-1 min-w-0">
                    <p className="font-heading font-bold text-lg leading-tight">{formatRank(rank) || 'Unranked'}</p>

                    {nextRank ? (
                        <>
                            <div className="mt-2">
                                <div className="flex justify-between text-[11px] text-(--color-text-secondary) mb-1">
                                    <span>{formatRank(rank)}</span>
                                    <span>{formatRank(nextRank)}</span>
                                </div>
                                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all"
                                        style={{ width: `${progressPct}%` }}
                                    />
                                </div>
                            </div>
                            <p className="text-[11px] text-(--color-text-secondary) mt-1">
                                {passionToNext.toLocaleString()} Passion to <span className="text-amber-400">{formatRank(nextRank)}</span>
                            </p>
                        </>
                    ) : (
                        <p className="text-xs text-amber-400/70 mt-1">Max rank achieved</p>
                    )}
                </div>
            </div>
        </DashboardWidget>
    )
}

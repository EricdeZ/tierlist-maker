import { Coins } from 'lucide-react'
import DashboardWidget from './DashboardWidget'

export default function CoresClaim({ balance, currentStreak, canClaimDaily, onClaimDaily }) {
    return (
        <DashboardWidget title="Cores" icon={<Coins size={16} />} accent="teal">
            <div className="space-y-3">
                <div className="flex items-center gap-3">
                    {/* Icon circle */}
                    <div className="w-10 h-10 rounded-full bg-teal-500/15 flex items-center justify-center shrink-0">
                        <Coins size={20} className="text-teal-400" />
                    </div>

                    <div>
                        <p className="text-2xl font-bold text-teal-300 leading-tight">{(balance || 0).toLocaleString()}</p>
                        {currentStreak > 0 && (
                            <p className="text-xs text-(--color-text-secondary)">{currentStreak}d streak</p>
                        )}
                    </div>
                </div>

                {canClaimDaily && (
                    <>
                        <div className="border-t border-white/10" />
                        <button
                            onClick={onClaimDaily}
                            className="w-full py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition-colors"
                        >
                            Claim Daily Cores
                        </button>
                    </>
                )}
            </div>
        </DashboardWidget>
    )
}

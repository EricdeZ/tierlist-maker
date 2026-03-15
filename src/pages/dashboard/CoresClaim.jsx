import { Coins } from 'lucide-react'
import DashboardWidget from './DashboardWidget'

export default function CoresClaim({ balance, currentStreak, canClaimDaily, onClaimDaily }) {
    return (
        <DashboardWidget title="Cores" icon={<Coins size={16} />} accent="teal">
            <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                    <p className="text-xl font-bold">{(balance || 0).toLocaleString()}</p>
                    {currentStreak > 0 && (
                        <span className="text-xs text-(--color-text-secondary)">{currentStreak}d streak</span>
                    )}
                </div>

                {canClaimDaily && (
                    <button
                        onClick={onClaimDaily}
                        className="w-full py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-colors"
                    >
                        Claim Daily Cores
                    </button>
                )}
            </div>
        </DashboardWidget>
    )
}

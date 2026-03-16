import coresIcon from '../../assets/ember.png'
import DashboardWidget from './DashboardWidget'

export default function CoresClaim({ balance, currentStreak, canClaimDaily, onClaimDaily }) {
    return (
        <DashboardWidget title="Cores" icon={<img src={coresIcon} alt="" className="w-4 h-4 object-contain" />} accent="teal">
            <div className="space-y-3">
                <div className="flex items-center gap-3">
                    {/* Icon circle */}
                    <div className="w-10 h-10 rounded-full bg-teal-500/15 flex items-center justify-center shrink-0">
                        <img src={coresIcon} alt="" className="w-8 h-8 object-contain" />
                    </div>

                    <div>
                        <p className="text-3xl font-bold text-teal-300 leading-tight" style={{ textShadow: '0 0 12px rgba(20, 184, 166, 0.5), 0 0 24px rgba(20, 184, 166, 0.25)' }}>
                            {(balance || 0).toLocaleString()}
                        </p>
                        {currentStreak > 0 && (
                            <p className="text-xs text-(--color-text-secondary) flex items-center gap-1">
                                <img src={coresIcon} alt="" className="w-3 h-3 object-contain" />
                                {currentStreak}d streak
                            </p>
                        )}
                    </div>
                </div>

                {canClaimDaily && (
                    <>
                        <div className="border-t border-white/10" />
                        <button
                            onClick={onClaimDaily}
                            className="w-full py-1.5 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-500 hover:from-teal-500 hover:to-cyan-400 text-white text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                        >
                            <img src={coresIcon} alt="" className="w-3.5 h-3.5 object-contain" />
                            Claim Daily Cores
                        </button>
                    </>
                )}
            </div>
        </DashboardWidget>
    )
}

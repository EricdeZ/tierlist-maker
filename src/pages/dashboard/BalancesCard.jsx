import { Wallet } from 'lucide-react'
import passionCoin from '../../assets/passion/passion.png'
import coresIcon from '../../assets/ember.png'
import DashboardWidget from './DashboardWidget'

export default function BalancesCard({
    passionBalance, passionStreak, canClaimPassion, onClaimPassion,
    coresBalance, coresStreak, canClaimCores, onClaimCores,
}) {
    return (
        <DashboardWidget title="Balances" icon={<Wallet size={16} />} accent="amber">
            <div className="space-y-3">
                {/* Passion row */}
                <div className="flex items-center gap-3">
                    <img src={passionCoin} alt="" className="w-9 h-9 object-contain shrink-0" />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                            <p className="text-xl font-bold leading-tight" style={{ textShadow: '0 0 10px rgba(245,158,11,0.4)' }}>
                                {(passionBalance || 0).toLocaleString()}
                            </p>
                            <span className="text-xs text-amber-400/70">Passion</span>
                        </div>
                        {passionStreak > 0 && (
                            <p className="text-[11px] text-(--color-text-secondary)">{passionStreak}d streak</p>
                        )}
                    </div>
                    {canClaimPassion && (
                        <button
                            onClick={onClaimPassion}
                            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0"
                        >
                            <img src={passionCoin} alt="" className="w-3.5 h-3.5 object-contain" />
                            Claim
                        </button>
                    )}
                </div>

                <div className="h-px bg-white/10" />

                {/* Cores row */}
                <div className="flex items-center gap-3">
                    <img src={coresIcon} alt="" className="w-9 h-9 object-contain shrink-0" />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                            <p className="text-xl font-bold text-teal-300 leading-tight" style={{ textShadow: '0 0 10px rgba(20,184,166,0.4)' }}>
                                {(coresBalance || 0).toLocaleString()}
                            </p>
                            <span className="text-xs text-teal-400/70">Cores</span>
                        </div>
                        {coresStreak > 0 && (
                            <p className="text-[11px] text-(--color-text-secondary)">{coresStreak}d streak</p>
                        )}
                    </div>
                    {canClaimCores && (
                        <button
                            onClick={onClaimCores}
                            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-500 hover:from-teal-500 hover:to-cyan-400 text-white text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0"
                        >
                            <img src={coresIcon} alt="" className="w-3.5 h-3.5 object-contain" />
                            Claim
                        </button>
                    )}
                </div>
            </div>
        </DashboardWidget>
    )
}

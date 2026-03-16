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
                            className="px-3 py-1.5 rounded text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0"
                            style={{
                                background: 'linear-gradient(135deg, #d97706, #f59e0b)',
                                boxShadow: '0 0 12px rgba(245,158,11,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
                                letterSpacing: '0.08em',
                            }}
                            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 20px rgba(245,158,11,0.5), inset 0 1px 0 rgba(255,255,255,0.15)'}
                            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 12px rgba(245,158,11,0.3), inset 0 1px 0 rgba(255,255,255,0.15)'}
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
                            className="px-3 py-1.5 rounded text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0"
                            style={{
                                background: 'linear-gradient(135deg, #0d9488, #06b6d4)',
                                boxShadow: '0 0 12px rgba(6,182,212,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
                                letterSpacing: '0.08em',
                            }}
                            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 20px rgba(6,182,212,0.5), inset 0 1px 0 rgba(255,255,255,0.15)'}
                            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 12px rgba(6,182,212,0.3), inset 0 1px 0 rgba(255,255,255,0.15)'}
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

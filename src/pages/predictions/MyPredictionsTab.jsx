import { TrendingUp, Target } from 'lucide-react'
import passionCoin from '../../assets/passion/passion.png'

function DashboardStat({ label, value, icon, color }) {
    return (
        <div className="flex-1 py-4 px-3 text-center min-w-0">
            <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/30 mb-1.5">{label}</div>
            <div className="flex items-center justify-center gap-1 text-lg sm:text-xl font-bold tabular-nums truncate" style={{ color: color || 'white' }}>
                {icon && <img src={icon} alt="" className="w-4 h-4 flex-shrink-0" />}
                {value}
            </div>
        </div>
    )
}

export function MyPredictionsTab({ predictions, stats, loading, error, user, login }) {
    if (!user) {
        return (
            <div className="py-20 text-center">
                <TrendingUp className="w-12 h-12 text-white/10 mx-auto mb-4" />
                <h3 className="text-base font-heading font-bold text-white/60 mb-1">Your Portfolio</h3>
                <p className="text-white/40 text-sm mb-5">Log in to track your prediction history.</p>
                <button onClick={login}
                    className="px-5 py-2.5 rounded-lg text-white text-sm font-semibold cursor-pointer transition-all hover:opacity-90"
                    style={{ backgroundColor: '#5865F2' }}>
                    Login with Discord
                </button>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="w-10 h-10 border-2 border-white/10 border-t-[#f8c56a] rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div>
            {stats && (
                <div className="flex items-stretch rounded-xl overflow-hidden mb-8" style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <DashboardStat label="Accuracy" value={`${stats.accuracy}%`}
                        color={stats.accuracy >= 60 ? '#22c55e' : stats.accuracy >= 40 ? '#f8c56a' : '#ef4444'} />
                    <div className="w-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                    <DashboardStat label="Pending" value={stats.pending} />
                    <div className="w-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                    <DashboardStat label="Wagered" value={stats.totalWagered} icon={passionCoin} />
                    <div className="w-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                    <DashboardStat label="Net P&L" value={stats.netPL >= 0 ? `+${stats.netPL}` : stats.netPL} icon={passionCoin}
                        color={stats.netPL >= 0 ? '#22c55e' : '#ef4444'} />
                </div>
            )}

            {predictions.length === 0 ? (
                <div className="py-16 text-center">
                    <Target className="w-12 h-12 text-white/10 mx-auto mb-4" />
                    <p className="text-white/40 text-sm">No predictions yet. Head to Markets to place your first pick.</p>
                </div>
            ) : (
                <div className="space-y-1">
                    {predictions.map((p, i) => {
                        const statusColor = p.status === 'won' ? '#22c55e' : p.status === 'lost' ? '#ef4444' : p.status === 'refunded' ? '#eab308' : 'rgba(248,197,106,0.4)'
                        return (
                            <div key={p.id} className="flex items-center gap-3 py-3 px-3 rounded-lg pred-card-enter"
                                style={{
                                    animationDelay: `${i * 25}ms`,
                                    background: p.status === 'won' ? 'rgba(34,197,94,0.05)' : p.status === 'lost' ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.03)',
                                }}>
                                <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: statusColor }} />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-white truncate">{p.team1.name} vs {p.team2.name}</div>
                                    <div className="text-[10px] text-white/40 mt-0.5">
                                        {p.leagueName} · {p.divisionName} · Picked <span className="text-white/60">{p.predictedTeamName}</span>
                                    </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    {p.status === 'won' && p.payoutAmount > 0 && (
                                        <div className="flex items-center gap-1 text-sm font-bold text-green-400">+{p.payoutAmount} <img src={passionCoin} alt="" className="w-3.5 h-3.5" /></div>
                                    )}
                                    {p.status === 'lost' && p.wagerAmount > 0 && (
                                        <div className="flex items-center gap-1 text-sm text-red-400/60">-{p.wagerAmount} <img src={passionCoin} alt="" className="w-3.5 h-3.5 opacity-50" /></div>
                                    )}
                                    {p.status === 'pending' && (
                                        <div className="text-[10px] text-white/40">{p.wagerAmount > 0 ? <span className="flex items-center gap-1"><img src={passionCoin} alt="" className="w-3 h-3" />{p.wagerAmount}</span> : 'Free'}</div>
                                    )}
                                    {p.payoutMultiplier && <div className="text-[9px] text-white/30 mt-0.5">{p.payoutMultiplier}x</div>}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

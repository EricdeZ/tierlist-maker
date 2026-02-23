import { Zap, Flame, Snowflake, Wallet } from 'lucide-react'
import TeamLogo from '../../components/TeamLogo'
import passionCoin from '../../assets/passion/passion.png'
import { getHeatTier } from './forgeConstants'

function StatBlock({ label, value, icon: Icon, color, prefix = '', raw = false }) {
    return (
        <div className="flex-1 bg-[var(--forge-panel)] p-3 relative overflow-hidden"
            style={{ clipPath: 'polygon(0 0, 100% 0, calc(100% - 6px) 100%, 0 100%)' }}
        >
            <div className="forge-head text-[0.75rem] font-semibold tracking-wider text-[var(--forge-text-dim)] mb-1 flex items-center gap-1">
                {Icon && <Icon size={11} />}
                {label}
            </div>
            <div className={`forge-num text-2xl ${color || 'text-[var(--forge-gold-bright)]'}`}>
                {raw ? value : (
                    <>
                        {prefix}
                        <img src={passionCoin} alt="" className="w-4 h-4 inline mr-1 -mt-0.5" />
                        {typeof value === 'number' ? value.toLocaleString() : value}
                    </>
                )}
            </div>
        </div>
    )
}

export default function ForgePortfolioTab({ portfolio, loading, onCool }) {
    if (loading) {
        return (
            <div className="text-center py-12">
                <div className="forge-head text-[var(--forge-text-dim)] text-lg tracking-wider">Loading your Sparks...</div>
            </div>
        )
    }

    if (!portfolio || portfolio.holdings.length === 0) {
        return (
            <div className="text-center py-12">
                <Zap className="mx-auto mb-3 opacity-30" size={40} style={{ color: 'var(--forge-text-dim)' }} />
                <p className="forge-body text-[var(--forge-text-dim)]">You haven't fueled any players yet.</p>
                <p className="text-xs text-[var(--forge-text-dim)] mt-1 opacity-60">Head to The Forge to get started!</p>
            </div>
        )
    }

    const { stats } = portfolio

    return (
        <div>
            {/* Portfolio stat strip */}
            {stats && (
                <div className="flex gap-[2px] mb-6 bg-[var(--forge-border)]">
                    <StatBlock label="Portfolio" value={stats.totalValue} icon={Wallet} />
                    <StatBlock label="Invested" value={stats.totalInvested} />
                    <StatBlock
                        label="Unrealized"
                        value={stats.unrealizedPL}
                        color={stats.unrealizedPL >= 0 ? 'text-[var(--forge-gain)]' : 'text-[var(--forge-loss)]'}
                        prefix={stats.unrealizedPL >= 0 ? '+' : ''}
                    />
                    <StatBlock
                        label="Return"
                        value={`${stats.plPercent >= 0 ? '+' : ''}${stats.plPercent}%`}
                        color={stats.plPercent >= 0 ? 'text-[var(--forge-gain)]' : 'text-[var(--forge-loss)]'}
                        raw
                    />
                </div>
            )}

            {/* Holdings */}
            <div className="space-y-[2px]">
                {portfolio.holdings.map(h => {
                    const tier = getHeatTier(h.priceChange24h)

                    return (
                        <div
                            key={h.sparkId}
                            className={`forge-${tier} flex items-center gap-3 p-3 bg-[var(--forge-panel)] border border-transparent hover:border-[var(--forge-border-lt)] transition-all`}
                        >
                            {/* Heat bar */}
                            <div className="w-1 h-10 rounded-sm forge-heat-bar" />

                            <TeamLogo slug={h.teamSlug} name={h.teamName} size={28} />

                            <div className="flex-1 min-w-0">
                                <div className="forge-body font-bold text-base">{h.playerName}</div>
                                <div className="text-sm text-[var(--forge-text-dim)] flex items-center gap-1">
                                    <TeamLogo slug={h.teamSlug} name={h.teamName} size={14} />
                                    <span style={{ color: h.teamColor }}>{h.teamName}</span>
                                    {h.role && <span className="opacity-60"> &middot; {h.role}</span>}
                                    <span className="opacity-60"> &middot; <span className="forge-num">{h.sparks}</span> Spark{h.sparks !== 1 ? 's' : ''}</span>
                                </div>
                            </div>

                            <div className="text-right">
                                <div className="flex items-center gap-1 justify-end">
                                    <img src={passionCoin} alt="" className="w-3.5 h-3.5" />
                                    <span className="forge-num text-base forge-price-text">{h.currentValue.toLocaleString()}</span>
                                </div>
                                <div className={`forge-num text-sm ${h.unrealizedPL >= 0 ? 'text-[var(--forge-gain)]' : 'text-[var(--forge-loss)]'}`}>
                                    {h.unrealizedPL >= 0 ? '+' : ''}{h.unrealizedPL.toLocaleString()}
                                </div>
                            </div>

                            <button
                                onClick={() => onCool(h.sparkId, h.playerName, { sparks: h.sparks })}
                                className="p-2 bg-[var(--forge-cool)]/8 text-[var(--forge-cool)] hover:bg-[var(--forge-cool)]/15 transition-colors forge-clip-btn"
                                title="Cool"
                            >
                                <Snowflake size={14} />
                            </button>
                        </div>
                    )
                })}
            </div>

            {/* Recent Transactions */}
            {portfolio.transactions?.length > 0 && (
                <div className="mt-6">
                    <div className="relative pb-2 mb-3 border-b border-[var(--forge-border)]">
                        <h3 className="forge-head text-base font-bold tracking-wider text-[var(--forge-text-mid)]">
                            Recent Activity
                        </h3>
                        <div className="forge-section-accent" />
                    </div>
                    <div className="space-y-1">
                        {portfolio.transactions.map(t => (
                            <div key={t.id} className="flex items-center gap-3 px-3 py-2 bg-[var(--forge-panel)]/40 text-base">
                                {t.type === 'fuel' ? (
                                    <Flame size={14} className="text-[var(--forge-flame)] flex-shrink-0" />
                                ) : (
                                    <Snowflake size={14} className="text-[var(--forge-cool)] flex-shrink-0" />
                                )}
                                <span className="forge-body flex-1 min-w-0 truncate">
                                    {t.type === 'fuel' ? 'Fueled' : t.type === 'cool' ? 'Cooled' : 'Liquidated'} {t.playerName}
                                    <span className="opacity-50"> (<span className="forge-num">{t.sparks}</span> Spark{t.sparks !== 1 ? 's' : ''})</span>
                                </span>
                                <span className={`forge-num font-medium ${t.type === 'fuel' ? 'text-[var(--forge-loss)]' : 'text-[var(--forge-gain)]'}`}>
                                    {t.type === 'fuel' ? '-' : '+'}{t.totalCost.toLocaleString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

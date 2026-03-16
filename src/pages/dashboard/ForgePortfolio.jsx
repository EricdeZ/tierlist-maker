import { TrendingUp, Zap } from 'lucide-react'
import DashboardWidget from './DashboardWidget'
import PromoCard from './PromoCard'
import TeamLogo from '../../components/TeamLogo'

function PLBadge({ value }) {
    if (value == null) return null
    const positive = value >= 0
    return (
        <span className={`text-xs font-semibold shrink-0 ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
            {positive ? '+' : ''}{value.toLocaleString()}
        </span>
    )
}

export default function ForgePortfolio({ portfolio, marketClosed, forgeLeagueSlug, error }) {
    if (marketClosed) {
        return (
            <DashboardWidget title="Fantasy Forge" icon={<TrendingUp size={16} />} accent="cyan">
                <p className="text-sm text-(--color-text-secondary) py-4 text-center">Markets are currently closed</p>
            </DashboardWidget>
        )
    }

    if (error || !portfolio) {
        return (
            <DashboardWidget title="Fantasy Forge" icon={<TrendingUp size={16} />} linkTo="/forge" accent="cyan">
                <PromoCard
                    title="Invest in Players"
                    description="Build a portfolio and compete on the leaderboard"
                    ctaText="Enter the Forge"
                    ctaLink="/forge"
                    icon={<TrendingUp size={28} />}
                />
            </DashboardWidget>
        )
    }

    const holdings = portfolio.holdings || []
    const totalValue = holdings.reduce((s, h) => s + (h.currentValue || 0), 0)
    const realizedPL = portfolio.stats?.realizedPL ?? null
    const linkTo = forgeLeagueSlug ? `/forge/${forgeLeagueSlug}` : '/forge'

    return (
        <DashboardWidget title="Fantasy Forge" icon={<TrendingUp size={16} />} linkTo={linkTo} accent="cyan">
            <div className="space-y-3">
                {/* Portfolio value */}
                <div>
                    <p className="text-2xl font-bold">{totalValue.toLocaleString()} <span className="text-sm font-normal text-(--color-text-secondary)">Sparks</span></p>
                    <div className="flex items-center gap-3 mt-0.5">
                        <p className="text-xs text-(--color-text-secondary)">Portfolio Value</p>
                        {realizedPL !== null && (
                            <span className="text-xs text-(--color-text-secondary)">
                                Realized: <PLBadge value={realizedPL} />
                            </span>
                        )}
                    </div>
                </div>

                {/* Top holdings */}
                {holdings.length === 0 && (
                    <p className="text-xs text-(--color-text-secondary)">No holdings yet — invest to get started</p>
                )}
                {holdings.length > 0 && (
                    <div className="space-y-1.5">
                        <p className="text-[10px] text-(--color-text-secondary) uppercase tracking-wider font-semibold">Top {Math.min(3, holdings.length)} of {holdings.length} holdings</p>
                        {holdings.slice(0, 3).map(h => (
                            <div key={h.sparkId} className="flex items-center gap-2 text-sm">
                                <TeamLogo
                                    name={h.teamName}
                                    color={h.teamColor}
                                    size={18}
                                    className="shrink-0"
                                />
                                <span className="flex-1 truncate">{h.playerName}</span>
                                <div className="flex items-center gap-0.5 shrink-0 text-xs text-(--color-text-secondary)">
                                    <Zap size={10} className="text-cyan-400" />
                                    {h.sparks}
                                </div>
                                <PLBadge value={h.unrealizedPL} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </DashboardWidget>
    )
}

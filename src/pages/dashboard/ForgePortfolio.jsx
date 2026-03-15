import { TrendingUp } from 'lucide-react'
import DashboardWidget from './DashboardWidget'
import PromoCard from './PromoCard'

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

    const linkTo = forgeLeagueSlug ? `/forge/${forgeLeagueSlug}` : '/forge'

    return (
        <DashboardWidget title="Fantasy Forge" icon={<TrendingUp size={16} />} linkTo={linkTo} accent="cyan">
            <div className="space-y-3">
                {/* Portfolio value */}
                <div>
                    <p className="text-xl font-bold">{(portfolio.totalValue || 0).toLocaleString()} Sparks</p>
                    <p className="text-xs text-(--color-text-secondary)">Portfolio Value</p>
                </div>

                {/* Top holdings */}
                {portfolio.holdings?.length > 0 && (
                    <div className="space-y-1.5">
                        {portfolio.holdings.slice(0, 3).map(h => (
                            <div key={h.sparkId} className="flex justify-between text-sm">
                                <span className="truncate">{h.playerName}</span>
                                <span className="text-(--color-text-secondary) shrink-0 ml-2">{h.currentPrice}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </DashboardWidget>
    )
}

import { Layers } from 'lucide-react'
import DashboardWidget from './DashboardWidget'
import PromoCard from './PromoCard'

export default function VaultOverview({ vaultData, startingFive, pendingGifts, pendingTrades, error }) {
    if (error || !vaultData) {
        return (
            <DashboardWidget title="The Vault" icon={<Layers size={16} />} linkTo="/vault" accent="violet">
                <PromoCard
                    title="Open Your First Pack"
                    description="Collect player cards, build your Starting Five"
                    ctaText="Enter the Vault"
                    ctaLink="/vault"
                    icon={<Layers size={28} />}
                />
            </DashboardWidget>
        )
    }

    const cardCount = vaultData.totalCards || 0
    const uniqueCount = vaultData.uniqueCards || 0
    const incomeReady = startingFive?.incomeCollectible
    const pendingCount = (pendingGifts || 0) + (pendingTrades || 0)

    return (
        <DashboardWidget title="The Vault" icon={<Layers size={16} />} linkTo="/vault" accent="violet">
            <div className="space-y-3">
                {/* Card counts */}
                <div className="flex gap-4">
                    <div>
                        <p className="text-xl font-bold">{cardCount}</p>
                        <p className="text-xs text-(--color-text-secondary)">Cards</p>
                    </div>
                    <div>
                        <p className="text-xl font-bold">{uniqueCount}</p>
                        <p className="text-xs text-(--color-text-secondary)">Unique</p>
                    </div>
                </div>

                {/* Starting Five preview */}
                {startingFive?.slots && (
                    <div className="flex gap-1">
                        {['solo', 'jungle', 'mid', 'support', 'carry'].map(role => {
                            const slot = startingFive.slots.find(s => s.role === role)
                            return (
                                <div key={role} className="w-10 h-10 rounded bg-white/10 overflow-hidden flex items-center justify-center text-[10px] text-(--color-text-secondary) uppercase">
                                    {slot?.card?.image_url ? (
                                        <img src={slot.card.image_url} alt="" className="w-full h-full object-cover" />
                                    ) : role[0]}
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Pending items */}
                {pendingCount > 0 && (
                    <p className="text-xs text-violet-400 font-semibold">{pendingCount} pending {pendingCount === 1 ? 'item' : 'items'}</p>
                )}

                {/* Income */}
                {incomeReady && (
                    <p className="text-xs text-emerald-400 font-semibold">Income ready to collect!</p>
                )}
            </div>
        </DashboardWidget>
    )
}

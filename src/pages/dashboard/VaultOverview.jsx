import { Layers } from 'lucide-react'
import DashboardWidget from './DashboardWidget'
import PromoCard from './PromoCard'

const RARITY_BORDER = {
    common: 'border-slate-500',
    uncommon: 'border-green-500',
    rare: 'border-blue-500',
    epic: 'border-purple-500',
    legendary: 'border-amber-500',
    unique: 'border-rose-500',
}

const SLOT_ROLES = ['solo', 'jungle', 'mid', 'support', 'carry']

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

    const collection = vaultData.collection || []
    const cardCount = collection.length
    const uniqueCount = new Set(collection.map(c => c.defId)).size
    const incomeReady = (startingFive?.passionPending > 0) || (startingFive?.coresPending > 0)
    const pendingCount = (pendingGifts || 0) + (pendingTrades || 0) + (vaultData.pendingTradeCount || 0)
    const packsOpened = vaultData.stats?.packsOpened ?? null

    const slots = startingFive?.cards
        ? SLOT_ROLES.map(role => startingFive.cards.find(c => c.slotRole === role) || null)
        : null

    return (
        <DashboardWidget title="The Vault" icon={<Layers size={16} />} linkTo="/vault" accent="violet">
            <div className="space-y-3">
                {/* Card counts */}
                <div className="flex gap-6">
                    <div>
                        <p className="text-2xl font-bold">{cardCount}</p>
                        <p className="text-xs text-(--color-text-secondary)">Cards</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold">{uniqueCount}</p>
                        <p className="text-xs text-(--color-text-secondary)">Unique</p>
                    </div>
                    {packsOpened !== null && (
                        <div>
                            <p className="text-2xl font-bold">{packsOpened}</p>
                            <p className="text-xs text-(--color-text-secondary)">Packs</p>
                        </div>
                    )}
                </div>

                {/* Starting Five preview */}
                {slots && (
                    <div className="flex gap-1.5">
                        {slots.map((card, i) => {
                            const role = SLOT_ROLES[i]
                            const borderClass = card ? (RARITY_BORDER[card.rarity] || 'border-slate-500') : 'border-white/10'
                            return (
                                <div
                                    key={role}
                                    className={`w-10 h-12 rounded border-2 ${borderClass} bg-white/5 overflow-hidden flex items-center justify-center`}
                                    title={card ? `${card.godName} (${role})` : role}
                                >
                                    {card?.imageUrl ? (
                                        <img src={card.imageUrl} alt={card.godName} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-[9px] text-(--color-text-secondary) uppercase">{role[0]}</span>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Income / pending */}
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {incomeReady && (
                        <p className="text-xs text-emerald-400 font-semibold">
                            Income ready
                            {startingFive.passionPending > 0 && ` · +${startingFive.passionPending} Passion`}
                            {startingFive.coresPending > 0 && ` · +${startingFive.coresPending} Cores`}
                        </p>
                    )}
                    {pendingCount > 0 && (
                        <p className="text-xs text-violet-400 font-semibold">
                            {pendingCount} pending {pendingCount === 1 ? 'item' : 'items'}
                        </p>
                    )}
                </div>
            </div>
        </DashboardWidget>
    )
}

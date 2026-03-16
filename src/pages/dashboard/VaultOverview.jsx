import { Layers, Package, Sparkles, Gift, Repeat2 } from 'lucide-react'
import DashboardWidget from './DashboardWidget'
import PromoCard from './PromoCard'
import passionCoin from '../../assets/passion/passion.png'
import coresIcon from '../../assets/ember.png'
import soloImg from '../../assets/roles/solo.webp'
import jungleImg from '../../assets/roles/jungle.webp'
import midImg from '../../assets/roles/mid.webp'
import suppImg from '../../assets/roles/supp.webp'
import adcImg from '../../assets/roles/adc.webp'

const RARITY_BORDER = {
    common: 'border-slate-500',
    uncommon: 'border-green-500',
    rare: 'border-blue-500',
    epic: 'border-purple-500',
    legendary: 'border-amber-500',
    mythic: 'border-red-500',
    unique: 'border-rose-300',
}

const RARITY_GLOW = {
    common: '',
    uncommon: 'shadow-[0_0_6px_rgba(34,197,94,0.2)]',
    rare: 'shadow-[0_0_6px_rgba(59,130,246,0.25)]',
    epic: 'shadow-[0_0_8px_rgba(168,85,247,0.3)]',
    legendary: 'shadow-[0_0_8px_rgba(245,158,11,0.35)]',
    mythic: 'shadow-[0_0_10px_rgba(239,68,68,0.35)]',
    unique: 'shadow-[0_0_10px_rgba(251,113,133,0.35)]',
}

const SLOT_ROLES = ['solo', 'jungle', 'mid', 'support', 'carry']
const ROLE_ICONS = { solo: soloImg, jungle: jungleImg, mid: midImg, support: suppImg, carry: adcImg }

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
    const packsOpened = vaultData.stats?.packsOpened ?? null

    const slots = startingFive?.cards
        ? SLOT_ROLES.map(role => startingFive.cards.find(c => c.slotRole === role) || null)
        : null

    return (
        <DashboardWidget title="The Vault" icon={<Layers size={16} />} linkTo="/vault" accent="violet">
            <div className="space-y-3">
                {/* Card counts */}
                <div className="flex gap-5">
                    <div className="flex items-center gap-2">
                        <Layers size={14} className="text-violet-400 shrink-0" />
                        <div>
                            <p className="text-lg font-bold leading-tight">{cardCount}</p>
                            <p className="text-[10px] text-(--color-text-secondary)">Cards</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Sparkles size={14} className="text-violet-400 shrink-0" />
                        <div>
                            <p className="text-lg font-bold leading-tight">{uniqueCount}</p>
                            <p className="text-[10px] text-(--color-text-secondary)">Unique</p>
                        </div>
                    </div>
                    {packsOpened !== null && (
                        <div className="flex items-center gap-2">
                            <Package size={14} className="text-violet-400 shrink-0" />
                            <div>
                                <p className="text-lg font-bold leading-tight">{packsOpened}</p>
                                <p className="text-[10px] text-(--color-text-secondary)">Packs</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Starting Five preview */}
                {slots && (
                    <div className="flex gap-1.5">
                        {slots.map((card, i) => {
                            const role = SLOT_ROLES[i]
                            const borderClass = card ? (RARITY_BORDER[card.rarity] || 'border-slate-500') : 'border-white/10'
                            const glowClass = card ? (RARITY_GLOW[card.rarity] || '') : ''
                            const roleIcon = ROLE_ICONS[role]
                            return (
                                <div
                                    key={role}
                                    className={`w-10 h-13 rounded border-2 ${borderClass} ${glowClass} bg-white/5 overflow-hidden flex flex-col items-center justify-center relative`}
                                    title={card ? `${card.godName || 'Card'} (${role})` : role}
                                >
                                    {card?.imageUrl ? (
                                        <img src={card.imageUrl} alt={card.godName} className="w-full h-full object-cover object-[center_20%]" />
                                    ) : (
                                        <img src={roleIcon} alt={role} className="w-5 h-5 object-contain opacity-40" />
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Income / pending */}
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                    {incomeReady && (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                            {startingFive.passionPending > 0 && (
                                <span className="flex items-center gap-0.5"><img src={passionCoin} alt="" className="w-3.5 h-3.5 object-contain" />+{Math.floor(startingFive.passionPending)}</span>
                            )}
                            {startingFive.coresPending > 0 && (
                                <span className="flex items-center gap-0.5"><img src={coresIcon} alt="" className="w-3.5 h-3.5 object-contain" />+{Math.floor(startingFive.coresPending)}</span>
                            )}
                            <span>to collect</span>
                        </div>
                    )}
                    {(pendingGifts > 0 || pendingTrades > 0) && (
                        <div className="flex items-center gap-2 text-xs text-violet-400 font-semibold">
                            {pendingGifts > 0 && (
                                <span className="flex items-center gap-0.5"><Gift size={11} />{pendingGifts}</span>
                            )}
                            {pendingTrades > 0 && (
                                <span className="flex items-center gap-0.5"><Repeat2 size={11} />{pendingTrades}</span>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </DashboardWidget>
    )
}

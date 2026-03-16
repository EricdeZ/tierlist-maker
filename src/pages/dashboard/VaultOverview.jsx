import { Link } from 'react-router-dom'
import { Layers, Package, Sparkles, Gift, Repeat2 } from 'lucide-react'
import PromoCard from './PromoCard'
import passionCoin from '../../assets/passion/passion.png'
import coresIcon from '../../assets/ember.png'
import soloImg from '../../assets/roles/solo.webp'
import jungleImg from '../../assets/roles/jungle.webp'
import midImg from '../../assets/roles/mid.webp'
import suppImg from '../../assets/roles/supp.webp'
import adcImg from '../../assets/roles/adc.webp'

const RARITY_BORDER = {
    common: '#94a3b8', uncommon: '#22c55e', rare: '#3b82f6',
    epic: '#a855f7', legendary: '#ff8c00', mythic: '#ef4444', unique: '#e8e8ff',
}

const SLOT_ROLES = ['solo', 'jungle', 'mid', 'support', 'carry']
const ROLE_ICONS = { solo: soloImg, jungle: jungleImg, mid: midImg, support: suppImg, carry: adcImg }

const CYAN = '#00e5ff'

export default function VaultOverview({ vaultData, startingFive, pendingGifts, pendingTrades, error }) {
    if (error || !vaultData) {
        return (
            <div
                className="relative overflow-hidden rounded-xl col-span-1 p-4 sm:p-5 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20"
                style={{ background: 'rgba(4,8,16,0.92)', border: '1px solid #111a2a' }}
            >
                <WidgetHeader />
                <PromoCard
                    title="Open Your First Pack"
                    description="Collect player cards, build your Starting Five"
                    ctaText="Enter the Vault"
                    ctaLink="/vault"
                    icon={<Layers size={28} />}
                />
            </div>
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
        <div
            className="relative overflow-hidden rounded-xl col-span-1 p-4 sm:p-5 transition-all duration-300 ease-out hover:-translate-y-0.5 group"
            style={{
                background: 'rgba(4,8,16,0.92)',
                border: '1px solid #111a2a',
                boxShadow: '0 0 0 0 rgba(0,229,255,0)',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,229,255,0.25)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#111a2a'}
        >
            {/* Cyber grid background */}
            <div
                className="absolute inset-0 opacity-[0.04] pointer-events-none"
                style={{
                    backgroundImage: 'linear-gradient(rgba(0,229,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,.3) 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                }}
            />
            {/* Top cyan line */}
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${CYAN}60, transparent)` }} />
            {/* Corner brackets */}
            <div className="absolute top-1.5 left-1.5 w-3 h-3 pointer-events-none" style={{ borderTop: `1px solid ${CYAN}`, borderLeft: `1px solid ${CYAN}`, opacity: 0.4 }} />
            <div className="absolute top-1.5 right-1.5 w-3 h-3 pointer-events-none" style={{ borderTop: `1px solid ${CYAN}`, borderRight: `1px solid ${CYAN}`, opacity: 0.4 }} />
            <div className="absolute bottom-1.5 left-1.5 w-3 h-3 pointer-events-none" style={{ borderBottom: `1px solid ${CYAN}`, borderLeft: `1px solid ${CYAN}`, opacity: 0.4 }} />
            <div className="absolute bottom-1.5 right-1.5 w-3 h-3 pointer-events-none" style={{ borderBottom: `1px solid ${CYAN}`, borderRight: `1px solid ${CYAN}`, opacity: 0.4 }} />

            <div className="relative">
                <WidgetHeader />

                <div className="space-y-3">
                    {/* Card counts */}
                    <div className="flex gap-5">
                        <Stat icon={<Layers size={13} />} value={cardCount} label="Cards" />
                        <Stat icon={<Sparkles size={13} />} value={uniqueCount} label="Unique" />
                        {packsOpened !== null && <Stat icon={<Package size={13} />} value={packsOpened} label="Packs" />}
                    </div>

                    {/* Starting Five preview */}
                    {slots && (
                        <div className="flex gap-1.5">
                            {slots.map((card, i) => {
                                const role = SLOT_ROLES[i]
                                const rarityColor = card ? (RARITY_BORDER[card.rarity] || '#94a3b8') : '#111a2a'
                                const roleIcon = ROLE_ICONS[role]
                                return (
                                    <div
                                        key={role}
                                        className="w-10 h-13 rounded overflow-hidden flex items-center justify-center relative"
                                        style={{
                                            border: `2px solid ${rarityColor}`,
                                            background: 'rgba(4,6,14,0.85)',
                                            boxShadow: card ? `0 0 8px ${rarityColor}30` : 'none',
                                        }}
                                        title={card ? `${card.godName || 'Card'} (${role})` : role}
                                    >
                                        {card?.imageUrl ? (
                                            <img src={card.imageUrl} alt={card.godName} className="w-full h-full object-cover object-[center_20%]" />
                                        ) : (
                                            <img src={roleIcon} alt={role} className="w-5 h-5 object-contain opacity-30" />
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Income / pending */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                        {incomeReady && (
                            <div
                                className="flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded"
                                style={{ color: CYAN, background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.15)' }}
                            >
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
                            <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: '#ff2d78' }}>
                                {pendingGifts > 0 && <span className="flex items-center gap-0.5"><Gift size={11} />{pendingGifts}</span>}
                                {pendingTrades > 0 && <span className="flex items-center gap-0.5"><Repeat2 size={11} />{pendingTrades}</span>}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

function WidgetHeader() {
    return (
        <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
                <Layers size={16} style={{ color: CYAN, filter: `drop-shadow(0 0 4px rgba(0,229,255,0.4))` }} />
                <h3 className="font-bold text-sm uppercase tracking-widest" style={{ color: '#e0e8f0', letterSpacing: '0.12em' }}>The Vault</h3>
            </div>
            <Link to="/vault" className="text-xs transition-colors hover:opacity-80" style={{ color: `${CYAN}80` }}>
                View all &rarr;
            </Link>
        </div>
    )
}

function Stat({ icon, value, label }) {
    return (
        <div className="flex items-center gap-2">
            <span style={{ color: CYAN, filter: 'drop-shadow(0 0 3px rgba(0,229,255,0.3))' }}>{icon}</span>
            <div>
                <p className="text-lg font-bold leading-tight" style={{ color: '#e0e8f0', textShadow: '0 0 8px rgba(0,229,255,0.15)' }}>{value}</p>
                <p className="text-[10px]" style={{ color: '#6a7a8a' }}>{label}</p>
            </div>
        </div>
    )
}

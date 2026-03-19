import { Link } from 'react-router-dom'
import { Layers, Package, Sparkles, Gift, Repeat2 } from 'lucide-react'
import PromoCard from './PromoCard'
import TradingCard from '../../components/TradingCard'
import passionCoin from '../../assets/passion/passion.png'
import coresIcon from '../../assets/ember.png'
import soloImg from '../../assets/roles/solo.webp'
import jungleImg from '../../assets/roles/jungle.webp'
import midImg from '../../assets/roles/mid.webp'
import suppImg from '../../assets/roles/supp.webp'
import adcImg from '../../assets/roles/adc.webp'

const SLOT_ROLES = ['solo', 'jungle', 'mid', 'support', 'adc']
const ROLE_ICONS = { solo: soloImg, jungle: jungleImg, mid: midImg, support: suppImg, adc: adcImg }

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

    const slots = startingFive?.currentSeason?.slots
        ? SLOT_ROLES.map(role => startingFive.currentSeason.slots[role]?.card || null)
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
                        <Stat icon={<Sparkles size={13} />} value={uniqueCount} label="Collected" />
                        {packsOpened !== null && <Stat icon={<Package size={13} />} value={packsOpened} label="Packs" />}
                    </div>

                    {/* Starting Five preview — real mini cards */}
                    {slots && (
                        <div className="flex gap-1.5 items-end">
                            {slots.map((card, i) => {
                                const role = SLOT_ROLES[i]
                                const roleIcon = ROLE_ICONS[role]
                                if (!card) {
                                    return (
                                        <div
                                            key={role}
                                            className="w-[52px] aspect-[63/88] rounded overflow-hidden flex items-center justify-center"
                                            style={{ border: '1px dashed #1a2838', background: 'rgba(4,6,14,0.6)' }}
                                            title={role}
                                        >
                                            <img src={roleIcon} alt={role} className="w-5 h-5 object-contain opacity-25" />
                                        </div>
                                    )
                                }
                                const cd = card.cardData || {}
                                return (
                                    <div key={role} className="w-[52px]" title={`${card.godName || 'Card'} (${role})`}>
                                        <TradingCard
                                            playerName={card.godName}
                                            teamName={cd.teamName || ''}
                                            teamColor={cd.teamColor || '#6366f1'}
                                            role={card.role || cd.role || 'ADC'}
                                            avatarUrl={card.imageUrl || ''}
                                            rarity={card.rarity}
                                            isFirstEdition={card.isFirstEdition}
                                            bestGod={card.bestGodName ? { name: card.bestGodName } : null}
                                            size={52}
                                        />
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Income / pending */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                        {incomeReady && (
                            <button
                                className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded transition-all cursor-pointer"
                                style={{
                                    color: '#fff',
                                    background: `linear-gradient(135deg, #0891b2, ${CYAN})`,
                                    boxShadow: `0 0 12px rgba(0,229,255,0.3), inset 0 1px 0 rgba(255,255,255,0.15)`,
                                    letterSpacing: '0.08em',
                                }}
                                onMouseEnter={e => e.currentTarget.style.boxShadow = `0 0 20px rgba(0,229,255,0.5), inset 0 1px 0 rgba(255,255,255,0.15)`}
                                onMouseLeave={e => e.currentTarget.style.boxShadow = `0 0 12px rgba(0,229,255,0.3), inset 0 1px 0 rgba(255,255,255,0.15)`}
                                onClick={() => window.location.href = '/vault'}
                            >
                                {startingFive.passionPending > 0 && (
                                    <span className="flex items-center gap-0.5"><img src={passionCoin} alt="" className="w-3.5 h-3.5 object-contain" />+{Math.floor(startingFive.passionPending)}</span>
                                )}
                                {startingFive.coresPending > 0 && (
                                    <span className="flex items-center gap-0.5"><img src={coresIcon} alt="" className="w-3.5 h-3.5 object-contain" />+{Math.floor(startingFive.coresPending)}</span>
                                )}
                                <span>Collect</span>
                            </button>
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

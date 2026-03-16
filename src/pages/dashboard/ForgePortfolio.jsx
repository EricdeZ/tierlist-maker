import { Link } from 'react-router-dom'
import { TrendingUp, Flame } from 'lucide-react'
import PromoCard from './PromoCard'
import TeamLogo from '../../components/TeamLogo'
import sparkIcon from '../../assets/spark.png'

const FIRE = '#e86520'
const GOLD = '#ffcc44'

function PLBadge({ value }) {
    if (value == null) return null
    const positive = value >= 0
    return (
        <span className="text-xs font-semibold shrink-0" style={{ color: positive ? '#44cc66' : '#ee4444' }}>
            {positive ? '+' : ''}{value.toLocaleString()}
        </span>
    )
}

export default function ForgePortfolio({ portfolio, marketClosed, forgeLeagueSlug, error }) {
    if (marketClosed) {
        return (
            <ForgeShell>
                <ForgeHeader />
                <p className="text-sm py-4 text-center" style={{ color: '#6a6050' }}>Markets are currently closed</p>
            </ForgeShell>
        )
    }

    if (error || !portfolio) {
        return (
            <ForgeShell>
                <ForgeHeader linkTo="/forge" />
                <PromoCard
                    title="Invest in Players"
                    description="Build a portfolio and compete on the leaderboard"
                    ctaText="Enter the Forge"
                    ctaLink="/forge"
                    icon={<TrendingUp size={28} />}
                />
            </ForgeShell>
        )
    }

    const holdings = portfolio.holdings || []
    const totalValue = holdings.reduce((s, h) => s + (h.currentValue || 0), 0)
    const totalInvested = holdings.reduce((s, h) => s + (h.totalInvested || 0), 0)
    const totalPL = totalValue - totalInvested
    const linkTo = forgeLeagueSlug ? `/forge/${forgeLeagueSlug}` : '/forge'

    return (
        <ForgeShell>
            {/* Fire glow at bottom */}
            <div
                className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at 50% 100%, rgba(232,101,32,0.08), transparent 70%)' }}
            />

            <div className="relative">
                <ForgeHeader linkTo={linkTo} />

                <div className="space-y-3">
                    {/* Portfolio value */}
                    <div>
                        <div className="flex items-baseline gap-2">
                            <img src={sparkIcon} alt="" className="w-5 h-5 object-contain shrink-0 self-center" style={{ filter: `drop-shadow(0 0 4px ${GOLD}80)` }} />
                            <p className="text-2xl font-bold" style={{ color: '#e0dcd4', textShadow: `0 0 12px rgba(232,101,32,0.3)` }}>
                                {totalValue.toLocaleString()}
                            </p>
                            <span className="text-sm font-normal" style={{ color: '#6a6050' }}>Sparks</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                            <p className="text-xs" style={{ color: '#6a6050' }}>Portfolio Value</p>
                            {totalPL !== 0 && <PLBadge value={totalPL} />}
                        </div>
                    </div>

                    {/* Top holdings */}
                    {holdings.length === 0 && (
                        <p className="text-xs" style={{ color: '#6a6050' }}>No holdings yet — fuel players to invest</p>
                    )}
                    {holdings.length > 0 && (
                        <div className="space-y-1">
                            <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#6a6050' }}>
                                Top {Math.min(3, holdings.length)} of {holdings.length}
                            </p>
                            {holdings.slice(0, 3).map(h => {
                                const isHot = h.unrealizedPL > 0
                                return (
                                    <div
                                        key={h.sparkId}
                                        className="flex items-center gap-2 text-sm px-2 py-1 rounded transition-colors"
                                        style={{
                                            background: isHot ? 'rgba(232,101,32,0.04)' : 'transparent',
                                            borderLeft: `2px solid ${isHot ? FIRE : '#333'}`,
                                        }}
                                    >
                                        <TeamLogo slug={h.teamSlug} name={h.teamName} color={h.teamColor} size={18} className="shrink-0" />
                                        <Link to={`/forge${forgeLeagueSlug ? `/${forgeLeagueSlug}` : ''}/${h.playerSlug || ''}`} className="flex-1 truncate hover:underline" style={{ color: '#e0dcd4' }} onClick={e => e.stopPropagation()}>{h.playerName}</Link>
                                        <div className="flex items-center gap-0.5 shrink-0 text-xs" style={{ color: '#6a6050' }}>
                                            <img src={sparkIcon} alt="" className="w-3 h-3 object-contain" />
                                            {h.sparks}
                                        </div>
                                        <PLBadge value={h.unrealizedPL} />
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </ForgeShell>
    )
}

function ForgeShell({ children }) {
    return (
        <div
            className="relative overflow-hidden rounded-xl col-span-1 p-4 sm:p-5 transition-all duration-300 ease-out hover:-translate-y-0.5"
            style={{
                background: 'rgba(14,14,14,0.85)',
                border: '1px solid #222',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(232,101,32,0.3)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(232,101,32,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.boxShadow = 'none' }}
        >
            {/* Top fire line */}
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${FIRE}60, ${GOLD}40, transparent)` }} />
            {children}
        </div>
    )
}

function ForgeHeader({ linkTo }) {
    return (
        <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
                <Flame size={16} style={{ color: FIRE, filter: `drop-shadow(0 0 4px ${FIRE}80)` }} />
                <h3 className="font-bold text-sm uppercase tracking-widest" style={{ color: '#e0dcd4', letterSpacing: '0.12em' }}>Fantasy Forge</h3>
            </div>
            {linkTo && (
                <Link to={linkTo} className="text-xs transition-colors hover:opacity-80" style={{ color: `${FIRE}80` }}>
                    View all &rarr;
                </Link>
            )}
        </div>
    )
}

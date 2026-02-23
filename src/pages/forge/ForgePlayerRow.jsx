import { useEffect, useRef } from 'react'
import { Flame, Snowflake } from 'lucide-react'
import TeamLogo from '../../components/TeamLogo'
import { getHeatTier, SPARK_COLORS, FALLBACK_HISTORY } from './forgeConstants'
import { drawSparkline } from './forgeCanvas'

export default function ForgePlayerRow({ player, selected, marketStatus, userTeamId, onSelect, onFuel, onCool }) {
    const chartRef = useRef(null)
    const tier = getHeatTier(player.priceChange24h)
    const isOpen = marketStatus === 'open'
    const isOwnTeam = userTeamId && player.teamId === userTeamId
    const change = player.priceChange24h
    const isUp = change > 0
    const isDown = change < 0
    const initials = player.playerName.slice(0, 2).toUpperCase()
    const teamColor = player.teamColor || '#666'

    // Draw sparkline (fallback to flat line at 100 if no data)
    useEffect(() => {
        if (!chartRef.current) return
        const data = player.historyData?.length ? player.historyData : FALLBACK_HISTORY
        const hasData = player.historyData?.length > 0
        const colors = hasData ? SPARK_COLORS[tier] : SPARK_COLORS.neutral
        drawSparkline(chartRef.current, data, { lineColor: colors.line, fillColor: colors.fill })
    }, [player.historyData, tier])

    return (
        <div
            className={`forge-${tier} grid items-center bg-[var(--forge-panel)] py-2 cursor-pointer border border-transparent transition-all hover:bg-[var(--forge-panel)]/80 hover:border-[var(--forge-border)] hover:translate-x-1 group ${
                selected ? 'forge-row-selected' : ''
            }`}
            style={{
                gridTemplateColumns: '4px 46px 1.4fr 0.7fr 100px 0.5fr 0.5fr 130px',
            }}
            onClick={() => onSelect(player)}
        >
            {/* Heat bar */}
            <div className="w-1 h-full forge-heat-bar" />

            {/* Avatar */}
            <div className="flex justify-center">
                <div
                    className="w-9 h-9 forge-clip-hex flex items-center justify-center font-extrabold text-[0.95rem] text-white"
                    style={{
                        background: player.godImageUrl
                            ? `url(${player.godImageUrl}) center/cover`
                            : `linear-gradient(135deg, ${teamColor}80, ${teamColor})`,
                        textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                    }}
                >
                    {!player.godImageUrl && initials}
                </div>
            </div>

            {/* Info */}
            <div className="px-2.5">
                <div className="forge-body text-[1.05rem] font-bold flex items-center gap-1.5">
                    {player.playerName}
                    {player.holding && player.holding.sparks > 0 && (
                        <span className="forge-num text-[0.75rem] text-[var(--forge-gold)] bg-[var(--forge-gold)]/8 border border-[var(--forge-gold)]/15 px-1">
                            {player.holding.sparks} held
                        </span>
                    )}
                </div>
                <div className="text-[0.95rem] text-[var(--forge-text-dim)] flex items-center gap-1 mt-px">
                    <TeamLogo slug={player.teamSlug} name={player.teamName} size={12} />
                    <span style={{ color: teamColor }}>{player.teamName}</span>
                    {player.role && (
                        <span className="forge-head text-[0.7rem] font-semibold tracking-wider ml-1">{player.role}</span>
                    )}
                </div>
            </div>

            {/* Price */}
            <div className="px-2.5 text-right">
                <div className="forge-num text-[1.25rem] forge-price-text">
                    {Math.round(player.currentPrice).toLocaleString()}
                </div>
                <div className="text-[0.7rem] text-[var(--forge-text-dim)] uppercase tracking-wider">Heat</div>
            </div>

            {/* Mini sparkline */}
            <div className="h-7 px-0.5 opacity-60 hidden sm:block">
                <canvas ref={chartRef} />
            </div>

            {/* Delta */}
            <div className="text-center px-2">
                <span className={`forge-num text-[0.9rem] px-1.5 py-0.5 rounded-sm ${
                    change != null
                        ? (isUp ? 'text-[var(--forge-gain)] bg-[var(--forge-gain)]/6' :
                           isDown ? 'text-[var(--forge-loss)] bg-[var(--forge-loss)]/6' :
                           'text-white')
                        : 'text-white'
                }`}>
                    {change != null ? `${isUp ? '+' : ''}${change.toFixed(1)}%` : '\u00B10%'}
                </span>
            </div>

            {/* Sparks */}
            <div className="text-center px-2 hidden sm:block">
                <div className="forge-num text-[0.95rem] text-[var(--forge-text-mid)]">{player.totalSparks}</div>
                <div className="text-[0.65rem] text-[var(--forge-text-dim)] uppercase tracking-wider">sparks</div>
            </div>

            {/* Actions (revealed on hover, always visible on mobile) */}
            <div className="flex gap-1 px-1.5 opacity-0 group-hover:opacity-100 sm:opacity-0 max-sm:opacity-100 transition-opacity">
                {isOpen && !isOwnTeam && (
                    <>
                        <button
                            onClick={e => { e.stopPropagation(); onFuel(player) }}
                            className="py-1.5 px-3 forge-head text-[0.95rem] font-semibold tracking-wider text-white cursor-pointer forge-clip-btn transition-all hover:shadow-[0_2px_14px_rgba(232,101,32,0.5)]"
                            style={{
                                background: 'var(--forge-flame)',
                                boxShadow: '0 2px 8px rgba(232,101,32,0.25)',
                            }}
                        >
                            Fuel
                        </button>
                        {player.holding && player.holding.sparks > 0 && (
                            <button
                                onClick={e => { e.stopPropagation(); onCool(player) }}
                                className="py-1.5 px-3 forge-head text-[0.95rem] font-semibold tracking-wider text-[var(--forge-cool)] bg-[var(--forge-cool)]/6 border border-[var(--forge-cool)]/15 cursor-pointer transition-colors hover:bg-[var(--forge-cool)]/12"
                            >
                                Cool
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

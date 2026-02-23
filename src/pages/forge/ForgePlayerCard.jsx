import { useEffect, useRef } from 'react'
import { Flame, Snowflake } from 'lucide-react'
import TeamLogo from '../../components/TeamLogo'
import sparkIcon from '../../assets/spark.png'
import { getHeatTier, getActiveChange, SPARK_COLORS, FALLBACK_HISTORY } from './forgeConstants'
import { drawSparkline } from './forgeCanvas'

export default function ForgePlayerCard({ player, selected, marketStatus, userTeamId, isOwner, changeView, onSelect, onFuel, onCool }) {
    const chartRef = useRef(null)
    const change = getActiveChange(player, changeView)
    const tier = getHeatTier(change)
    const isOpen = marketStatus === 'open'
    const isOwnTeam = !isOwner && userTeamId && player.teamId === userTeamId
    const isUp = change > 0
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
            className={`forge-player-card bg-[var(--forge-panel)] border border-[var(--forge-edge)] overflow-hidden cursor-pointer relative ${
                selected ? 'forge-card-selected' : ''
            } forge-${tier}`}
            onClick={() => onSelect(player)}
        >
            {/* Top heat bar */}
            <div className="h-[3px] bg-[var(--forge-surface)]">
                <div className="h-full forge-heat-fill transition-all" />
            </div>

            <div className="p-4">
                {/* Top row: avatar + name */}
                <div className="flex items-center gap-2.5 mb-2.5">
                    <div
                        className="w-11 h-11 flex-shrink-0 forge-clip-hex flex items-center justify-center font-extrabold text-xs text-white"
                        style={{
                            background: player.godImageUrl
                                ? `url(${player.godImageUrl}) center/cover`
                                : `linear-gradient(135deg, ${teamColor}80, ${teamColor})`,
                            textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                        }}
                    >
                        {!player.godImageUrl && initials}
                    </div>
                    <div>
                        <div className="forge-body text-[1.1rem] font-bold">{player.playerName}</div>
                        <div className="text-[0.85rem] text-[var(--forge-text-dim)] flex items-center gap-1 mt-px">
                            <TeamLogo slug={player.teamSlug} name={player.teamName} size={12} />
                            {player.teamName}
                            {player.role && (
                                <span className="forge-head text-[0.7rem] font-semibold tracking-wider ml-1">{player.role}</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Price row */}
                <div className="flex items-baseline justify-between mb-2">
                    <div className="forge-num text-[1.6rem] forge-price-text">
                        {Math.round(player.currentPrice).toLocaleString()}
                    </div>
                    <div className={`forge-num text-[0.9rem] ${
                        change != null ? (isUp ? 'text-[var(--forge-gain)]' : 'text-[var(--forge-loss)]') : 'text-white'
                    }`}>
                        {change != null ? (
                            <>
                                {isUp ? '\u25B2' : '\u25BC'} {isUp ? '+' : ''}{change.toFixed(1)}%
                            </>
                        ) : '\u00B10%'}
                    </div>
                </div>

                {/* Sparkline */}
                <div className="h-8 mb-2 opacity-60">
                    <canvas ref={chartRef} />
                </div>

                {/* Stats strip */}
                <div className="flex gap-px bg-[var(--forge-border)] mb-2.5">
                    <div className="flex-1 text-center py-1.5 bg-[var(--forge-surface)]">
                        <div className="forge-num text-[0.95rem]">
                            {player.perfMultiplier != null ? `${player.perfMultiplier.toFixed(2)}x` : '--'}
                        </div>
                        <div className="text-[0.65rem] uppercase tracking-wider text-[var(--forge-text-dim)]">Perf</div>
                    </div>
                    <div className="flex-1 text-center py-1.5 bg-[var(--forge-surface)]">
                        <div className="forge-num text-[0.95rem] flex items-center justify-center gap-1">
                            <img src={sparkIcon} alt="" className="w-3.5 h-3.5 object-contain" />
                            {player.totalSparks}
                        </div>
                        <div className="text-[0.65rem] uppercase tracking-wider text-[var(--forge-text-dim)]">Sparks</div>
                    </div>
                    <div className="flex-1 text-center py-1.5 bg-[var(--forge-surface)]">
                        <div className="forge-num text-[0.95rem]">{player.holding?.sparks || '-'}</div>
                        <div className="text-[0.65rem] uppercase tracking-wider text-[var(--forge-text-dim)]">Held</div>
                    </div>
                </div>

                {/* Action buttons */}
                {isOpen && !isOwnTeam && (
                    <div className="flex gap-1">
                        <button
                            onClick={e => { e.stopPropagation(); onFuel(player) }}
                            className="flex-1 py-2 px-2.5 forge-head text-[0.85rem] font-semibold tracking-wider text-white cursor-pointer forge-clip-btn forge-btn-fuel flex items-center justify-center gap-1"
                            style={{
                                background: 'linear-gradient(135deg, var(--forge-flame), var(--forge-ember))',
                                boxShadow: '0 2px 10px rgba(232,101,32,0.25)',
                            }}
                        >
                            <Flame size={12} />
                            Fuel
                        </button>
                        {player.holding && player.holding.sparks > 0 && (
                            <button
                                onClick={e => { e.stopPropagation(); onCool(player) }}
                                className="flex-1 py-2 px-2.5 forge-head text-[0.85rem] font-semibold tracking-wider text-[var(--forge-cool)] bg-[var(--forge-cool)]/6 border border-[var(--forge-cool)]/15 cursor-pointer forge-clip-btn forge-btn-cool flex items-center justify-center gap-1"
                            >
                                <Snowflake size={12} />
                                Cool
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

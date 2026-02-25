import { useEffect, useRef } from 'react'
import { Flame, Snowflake, Crown } from 'lucide-react'
import TeamLogo from '../../components/TeamLogo'
import sparkIcon from '../../assets/spark.png'
import { getHeatTier, getActiveChange, SPARK_COLORS, FALLBACK_HISTORY } from './forgeConstants'
import { drawSparkline } from './forgeCanvas'
import { usePlayerAvatar } from './usePlayerAvatar'

const RANK_LABELS = ['', '1st', '2nd', '3rd']

export default function ForgePlayerCard({ player, selected, marketStatus, userTeamId, isOwner, changeView, seasonSlugs, onSelect, onFuel, onCool, tutorialIndex, rank }) {
    const chartRef = useRef(null)
    const change = getActiveChange(player, changeView)
    const tier = getHeatTier(change)
    const isOpen = marketStatus === 'open'
    const isOwnTeam = userTeamId && player.teamId === userTeamId
    const isUp = change > 0
    const initials = player.playerName.slice(0, 2).toUpperCase()
    const teamColor = player.teamColor || '#666'
    const avatarUrl = usePlayerAvatar(player)
    const profileUrl = seasonSlugs
        ? `/${seasonSlugs.leagueSlug}/${seasonSlugs.divisionSlug}/players/${player.playerSlug}`
        : `/profile/${player.playerSlug}`

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
            } forge-${tier} ${rank === 1 ? 'forge-top-1' : ''}`}
            data-spark-id={player.sparkId}
            data-tutorial={tutorialIndex != null ? `player-card-${tutorialIndex}` : undefined}
            onClick={() => onSelect(player)}
        >
            {/* Fire/Frost overlays */}
            {tier === 'blazing' && (
                <>
                    <div className="forge-fire-overlay" />
                    <div className="forge-fire-bottom-glow" />
                </>
            )}
            {tier === 'cooling' && (
                <>
                    <div className="forge-frost-overlay" />
                    <div className="forge-frost-top-glow" />
                </>
            )}

            {/* Rank badge */}
            {rank && rank <= 3 && (
                <div className={`absolute top-2 right-2 z-10 forge-rank-badge forge-rank-badge-${rank}`}>
                    {rank === 1 ? (
                        <div className="flex items-center gap-1">
                            <Crown size={16} />
                            <span className="forge-head text-sm font-bold tracking-wider">{RANK_LABELS[rank]}</span>
                        </div>
                    ) : (
                        <span className="forge-head text-sm font-bold tracking-wider">{RANK_LABELS[rank]}</span>
                    )}
                </div>
            )}

            {/* Top heat bar */}
            <div className="h-[3px] bg-[var(--forge-surface)]">
                <div className="h-full forge-heat-fill transition-all" />
            </div>

            <div className="p-4 relative z-[1]">
                {/* Top row: avatar + name */}
                <div className="flex items-center gap-2.5 mb-2.5">
                    <div
                        className="w-12 h-12 flex-shrink-0 forge-clip-hex flex items-center justify-center font-extrabold text-xs text-white"
                        style={{
                            background: avatarUrl
                                ? `url(${avatarUrl}) center/cover`
                                : `linear-gradient(135deg, ${teamColor}80, ${teamColor})`,
                            textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                        }}
                    >
                        {!avatarUrl && initials}
                    </div>
                    <div>
                        <a
                            href={profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="forge-body text-[1.1rem] font-bold forge-profile-link block"
                            onClick={e => e.stopPropagation()}
                        >
                            {player.playerName}
                        </a>
                        <div className="text-[0.85rem] text-[var(--forge-text-dim)] flex items-center gap-1 mt-px">
                            <TeamLogo slug={player.teamSlug} name={player.teamName} size={16} color={player.teamColor} />
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
                            <img src={sparkIcon} alt="" className="w-8 h-8 object-contain forge-spark-icon" />
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
                            data-tutorial="fuel-btn"
                            className="flex-1 py-2 px-2.5 forge-head text-[0.85rem] font-semibold tracking-wider text-white cursor-pointer forge-clip-btn forge-btn-fuel flex items-center justify-center gap-1.5"
                            style={{
                                background: 'linear-gradient(135deg, var(--forge-flame), var(--forge-ember))',
                                boxShadow: '0 2px 10px rgba(232,101,32,0.25)',
                            }}
                        >
                            <Flame size={14} />
                            Fuel
                        </button>
                        {player.holding && player.holding.sparks > 0 && (
                            <button
                                onClick={e => { e.stopPropagation(); onCool(player) }}
                                className="flex-1 py-2 px-2.5 forge-head text-[0.85rem] font-semibold tracking-wider text-[var(--forge-cool)] bg-[var(--forge-cool)]/6 border border-[var(--forge-cool)]/15 cursor-pointer forge-clip-btn forge-btn-cool flex items-center justify-center gap-1.5"
                            >
                                <Snowflake size={14} />
                                Cool
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

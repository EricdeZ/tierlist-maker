import { useState, useEffect, useRef } from 'react'
import { Flame, Snowflake, ChevronDown } from 'lucide-react'
import TeamLogo from '../../components/TeamLogo'
import sparkIcon from '../../assets/spark.png'
import passionCoin from '../../assets/passion/passion.png'
import passiontailsImg from '../../assets/passion/passiontails.png'
import { getHeatTier, getActiveChange, SPARK_COLORS, FALLBACK_HISTORY } from './forgeConstants'
import { drawSparkline } from './forgeCanvas'
import { usePlayerAvatar } from './usePlayerAvatar'

export default function ForgePlayerRow({ player, selected, marketStatus, userTeamId, isOwner, changeView, seasonSlugs, onSelect, onFuel, onCool }) {
    const [expanded, setExpanded] = useState(false)
    const chartRef = useRef(null)
    const expandChartRef = useRef(null)

    const change = getActiveChange(player, changeView)
    const tier = getHeatTier(change)
    const isOpen = marketStatus === 'open'
    const isOwnTeam = !isOwner && userTeamId && player.teamId === userTeamId
    const isUp = change > 0
    const isDown = change < 0
    const initials = player.playerName.slice(0, 2).toUpperCase()
    const teamColor = player.teamColor || '#666'
    const avatarUrl = usePlayerAvatar(player)
    const profileUrl = seasonSlugs
        ? `/${seasonSlugs.leagueSlug}/${seasonSlugs.divisionSlug}/players/${player.playerSlug}`
        : `/profile/${player.playerSlug}`

    const perfValue = player.perfMultiplier
    const perfColor = perfValue >= 1.5 ? 'text-[var(--forge-flame-bright)]'
        : perfValue >= 1.0 ? 'text-[var(--forge-gold)]'
        : perfValue >= 0.7 ? 'text-[var(--forge-cool)]'
        : 'text-[var(--forge-loss)]'

    // Draw compact sparkline
    useEffect(() => {
        if (!chartRef.current) return
        const data = player.historyData?.length ? player.historyData : FALLBACK_HISTORY
        const hasData = player.historyData?.length > 0
        const colors = hasData ? SPARK_COLORS[tier] : SPARK_COLORS.neutral
        drawSparkline(chartRef.current, data, { lineColor: colors.line, fillColor: colors.fill })
    }, [player.historyData, tier])

    // Draw expanded sparkline when opened
    useEffect(() => {
        if (!expanded || !expandChartRef.current) return
        const data = player.historyData?.length ? player.historyData : FALLBACK_HISTORY
        const hasData = player.historyData?.length > 0
        const colors = hasData ? SPARK_COLORS[tier] : SPARK_COLORS.neutral
        drawSparkline(expandChartRef.current, data, { lineColor: colors.line, fillColor: colors.fill })
    }, [expanded, player.historyData, tier])

    const handleRowClick = () => {
        setExpanded(!expanded)
        onSelect(player)
    }

    return (
        <div
            className={`forge-${tier} forge-player-row-wrapper group bg-[var(--forge-panel)] border border-transparent cursor-pointer ${
                selected ? 'forge-row-selected' : ''
            } ${expanded ? 'forge-row-expanded' : ''}`}
            data-spark-id={player.sparkId}
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

            {/* Compact row */}
            <div
                className="forge-player-row grid items-center py-2.5 relative z-[2]"
                style={{
                    gridTemplateColumns: '4px 50px 1.4fr 80px 0.7fr 100px 0.5fr 0.5fr',
                }}
                onClick={handleRowClick}
            >
                {/* Heat bar */}
                <div className="w-1 h-full forge-heat-bar" />

                {/* Avatar */}
                <div className="flex justify-center">
                    <div
                        className="w-10 h-10 forge-clip-hex flex items-center justify-center font-extrabold text-[0.95rem] text-white"
                        style={{
                            background: avatarUrl
                                ? `url(${avatarUrl}) center/cover`
                                : `linear-gradient(135deg, ${teamColor}80, ${teamColor})`,
                            textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                        }}
                    >
                        {!avatarUrl && initials}
                    </div>
                </div>

                {/* Info */}
                <div className="px-2.5 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <a
                            href={profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="forge-body text-[1.05rem] font-bold forge-profile-link truncate"
                            onClick={e => e.stopPropagation()}
                        >
                            {player.playerName}
                        </a>
                        {player.holding && player.holding.sparks > 0 && (
                            <span className="forge-num text-[0.7rem] text-[var(--forge-gold)] bg-[var(--forge-gold)]/8 border border-[var(--forge-gold)]/15 px-1 flex-shrink-0">
                                {player.holding.sparks} held
                            </span>
                        )}
                    </div>
                    <div className="text-[0.9rem] text-[var(--forge-text-dim)] flex items-center gap-1 mt-px">
                        <TeamLogo slug={player.teamSlug} name={player.teamName} size={16} color={player.teamColor} />
                        <span style={{ color: teamColor }}>{player.teamName}</span>
                        {player.role && (
                            <span className="forge-head text-[0.65rem] font-semibold tracking-wider ml-0.5 opacity-70">{player.role}</span>
                        )}
                        {perfValue != null && (
                            <span className={`forge-num text-[0.8rem] ml-1 ${perfColor}`}>
                                {perfValue.toFixed(2)}x
                            </span>
                        )}
                    </div>
                </div>

                {/* Status badge column — Passionless or Coinflip champion */}
                <div className="flex items-center justify-center">
                    {!player.isConnected ? (
                        <div className="flex flex-col items-center gap-0.5" title="Not connected to an account">
                            <img src={passiontailsImg} alt="" className="w-7 h-7 object-contain opacity-40" />
                            <span className="forge-head text-[0.55rem] font-bold tracking-widest text-[var(--forge-text-dim)] opacity-50">
                                Passionless
                            </span>
                        </div>
                    ) : player.bestStreak > 9 ? (
                        <div className="flex flex-col items-center gap-0.5" title={`Coinflip streak: ${player.bestStreak}`}>
                            <img src={passionCoin} alt="" className="w-7 h-7 object-contain forge-coinflip-badge" />
                            <span className="forge-num text-[0.7rem] text-[var(--forge-gold-bright)]">
                                {player.bestStreak}
                            </span>
                        </div>
                    ) : null}
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

                {/* Sparks + expand chevron */}
                <div className="text-center px-2 hidden sm:block">
                    <div className="forge-num text-[0.95rem] text-[var(--forge-text-mid)] flex items-center justify-center gap-1">
                        <img src={sparkIcon} alt="" className="w-8 h-8 object-contain forge-spark-icon" />
                        {player.totalSparks}
                        <ChevronDown
                            size={14}
                            className={`text-[var(--forge-text-dim)] transition-transform duration-300 ml-0.5 ${expanded ? 'rotate-180' : ''}`}
                        />
                    </div>
                    <div className="text-[0.65rem] text-[var(--forge-text-dim)] uppercase tracking-wider">sparks</div>
                </div>
            </div>

            {/* Expanded details panel (click-toggled) */}
            <div className="forge-row-expand">
                <div className="px-4 pb-3 pt-2 flex items-start gap-5 relative z-[2] border-t border-[var(--forge-border)]/50 forge-expand-stagger">
                    {/* Bigger sparkline chart */}
                    <div className="w-[150px] h-[50px] flex-shrink-0 opacity-80">
                        <canvas ref={expandChartRef} />
                    </div>

                    {/* Detailed stats */}
                    <div className="flex gap-5 flex-1 flex-wrap items-end">
                        {perfValue != null && (
                            <div>
                                <div className="text-[0.6rem] uppercase tracking-wider text-[var(--forge-text-dim)] mb-0.5">Performance</div>
                                <div className={`forge-num text-lg ${perfColor}`} style={perfValue >= 1.2 ? {
                                    background: 'linear-gradient(180deg, var(--forge-gold-bright), var(--forge-flame))',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                } : {}}>
                                    {perfValue.toFixed(2)}x
                                </div>
                            </div>
                        )}
                        <div>
                            <div className="text-[0.6rem] uppercase tracking-wider text-[var(--forge-text-dim)] mb-0.5">Total Sparks</div>
                            <div className="forge-num text-lg text-[var(--forge-text)] flex items-center gap-1">
                                <img src={sparkIcon} alt="" className="w-8 h-8 object-contain forge-spark-icon" />
                                {player.totalSparks}
                            </div>
                        </div>
                        {player.holding && player.holding.sparks > 0 && (
                            <>
                                <div>
                                    <div className="text-[0.6rem] uppercase tracking-wider text-[var(--forge-text-dim)] mb-0.5">Your Sparks</div>
                                    <div className="forge-num text-lg text-[var(--forge-gold)]">
                                        {player.holding.sparks}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[0.6rem] uppercase tracking-wider text-[var(--forge-text-dim)] mb-0.5">Value</div>
                                    <div className="forge-num text-lg text-[var(--forge-gold-bright)]">
                                        {Math.round(player.currentPrice * player.holding.sparks).toLocaleString()}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Fuel/Cool buttons */}
                    {isOpen && !isOwnTeam && (
                        <div className="flex gap-2 flex-shrink-0 items-start">
                            <button
                                onClick={e => { e.stopPropagation(); onFuel(player) }}
                                data-tutorial="fuel-btn"
                                className="py-2 px-4 forge-head text-[0.85rem] font-semibold tracking-wider text-white cursor-pointer forge-clip-btn forge-btn-fuel flex items-center gap-1.5"
                                style={{
                                    background: 'linear-gradient(135deg, var(--forge-flame), var(--forge-ember))',
                                    boxShadow: '0 2px 12px rgba(232,101,32,0.3)',
                                }}
                            >
                                <Flame size={14} />
                                Fuel
                            </button>
                            {player.holding && (player.holding.sparks - (player.holding.tutorialSparks || 0)) > 0 && (
                                <button
                                    onClick={e => { e.stopPropagation(); onCool(player) }}
                                    className="py-2 px-4 forge-head text-[0.85rem] font-semibold tracking-wider text-[var(--forge-cool)] bg-[var(--forge-cool)]/8 border border-[var(--forge-cool)]/20 cursor-pointer forge-clip-btn forge-btn-cool flex items-center gap-1.5"
                                >
                                    <Snowflake size={14} />
                                    Cool
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

import { useEffect, useRef, useState } from 'react'
import { Flame, Snowflake, ChevronDown } from 'lucide-react'
import TeamLogo from '../../components/TeamLogo'
import sparkIcon from '../../assets/spark.png'
import passionCoin from '../../assets/passion/passion.png'
import passiontailsImg from '../../assets/passion/passiontails.png'
import { getHeatTier, getActiveChange, SPARK_COLORS, FALLBACK_HISTORY } from './forgeConstants'
import { drawSparkline } from './forgeCanvas'
import { usePlayerAvatar } from './usePlayerAvatar'

export default function ForgePlayerRow({ player, selected, marketStatus, userTeamId, isOwner, changeView, seasonSlugs, onSelect, onSpotlight, onFuel, onCool, isLeagueWide, leagueSlug, userTeamBySeasonId, openMarketIds }) {
    const chartRef = useRef(null)
    const mobileChartRef = useRef(null)
    const [expanded, setExpanded] = useState(false)

    const change = getActiveChange(player, changeView)
    const tier = getHeatTier(change)
    const isOpen = isLeagueWide
        ? (openMarketIds || []).includes(player.marketId)
        : marketStatus === 'open'
    const isOwnTeam = isLeagueWide
        ? (userTeamBySeasonId?.[player.seasonId] && userTeamBySeasonId[player.seasonId] === player.teamId)
        : (userTeamId && player.teamId === userTeamId)
    const isUp = change > 0
    const isDown = change < 0
    const initials = player.playerName.slice(0, 2).toUpperCase()
    const teamColor = player.teamColor || '#666'
    const avatarUrl = usePlayerAvatar(player)
    const profileUrl = isLeagueWide && player.divisionSlug
        ? `/${leagueSlug}/${player.divisionSlug}/players/${player.playerSlug}`
        : seasonSlugs
            ? `/${seasonSlugs.leagueSlug}/${seasonSlugs.divisionSlug}/players/${player.playerSlug}`
            : `/profile/${player.playerSlug}`

    const perfValue = player.perfMultiplier
    const perfColor = perfValue >= 1.5 ? 'text-[var(--forge-flame-bright)]'
        : perfValue >= 1.0 ? 'text-[var(--forge-gold)]'
        : perfValue >= 0.7 ? 'text-[var(--forge-cool)]'
        : 'text-[var(--forge-loss)]'

    // Draw compact sparkline
    useEffect(() => {
        const data = player.historyData?.length ? player.historyData : FALLBACK_HISTORY
        const hasData = player.historyData?.length > 0
        const colors = hasData ? SPARK_COLORS[tier] : SPARK_COLORS.neutral
        if (chartRef.current) {
            drawSparkline(chartRef.current, data, { lineColor: colors.line, fillColor: colors.fill })
        }
        if (mobileChartRef.current) {
            drawSparkline(mobileChartRef.current, data, { lineColor: colors.line, fillColor: colors.fill })
        }
    }, [player.historyData, tier, expanded])

    const handleRowClick = (e) => {
        // On mobile, toggle expanded view instead of navigating
        if (window.innerWidth < 640) {
            setExpanded(prev => !prev)
        } else if (onSpotlight) {
            onSpotlight(player)
        } else {
            onSelect(player)
        }
    }

    return (
        <div
            className={`forge-${tier} forge-player-row-wrapper group bg-[var(--forge-panel)] border border-transparent cursor-pointer ${
                selected ? 'forge-row-selected' : ''
            }`}
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

            {/* Mobile name row — full width so it never truncates badly */}
            <div className="sm:hidden flex items-center gap-2 px-2.5 pt-2 pb-0.5 relative z-[2]" onClick={handleRowClick}>
                <a
                    href={profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="forge-body text-[0.95rem] font-bold forge-profile-link truncate"
                    onClick={e => e.stopPropagation()}
                >
                    {player.playerName}
                </a>
                {player.holding && player.holding.sparks > 0 && (
                    <span className="forge-num text-[0.65rem] text-[var(--forge-gold)] bg-[var(--forge-gold)]/8 border border-[var(--forge-gold)]/15 px-1 flex-shrink-0">
                        {player.holding.sparks} held
                    </span>
                )}
            </div>

            {/* Compact row */}
            <div
                className="forge-player-row grid items-center py-1 sm:py-2.5 relative z-[2]"
                style={{
                    gridTemplateColumns: '4px 50px 1.4fr 80px 0.7fr 100px 0.5fr 140px',
                }}
                onClick={handleRowClick}
            >
                {/* Heat bar */}
                <div className="w-1 h-full forge-heat-bar" />

                {/* Avatar */}
                <div className="flex justify-center">
                    <div
                        className="w-8 h-8 sm:w-10 sm:h-10 forge-clip-hex flex items-center justify-center font-extrabold text-[0.8rem] sm:text-[0.95rem] text-white"
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
                <div className="px-2 sm:px-2.5 min-w-0">
                    {/* Name — desktop only (mobile has its own row above) */}
                    <div className="hidden sm:flex items-center gap-1.5">
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
                    {/* Desktop: team + role + perf on one line */}
                    <div className="hidden sm:flex text-[0.85rem] text-[var(--forge-text-dim)] items-center gap-1 mt-px overflow-hidden">
                        <TeamLogo slug={player.teamSlug} name={player.teamName} size={14} color={player.teamColor} className="flex-shrink-0" />
                        <span style={{ color: teamColor }} className="truncate">{player.teamName}</span>
                        {isLeagueWide && player.divisionName && (
                            <span className="forge-head text-[0.6rem] font-semibold tracking-wider text-[var(--forge-flame)] bg-[var(--forge-flame)]/8 border border-[var(--forge-flame)]/15 px-1 flex-shrink-0">
                                {player.divisionName}
                            </span>
                        )}
                        {player.role && (
                            <span className="forge-head text-[0.65rem] font-semibold tracking-wider ml-0.5 opacity-70 flex-shrink-0">{player.role}</span>
                        )}
                        {perfValue != null && (
                            <span className={`forge-num text-[0.8rem] ml-1 flex-shrink-0 ${perfColor}`}>
                                {perfValue.toFixed(2)}x
                            </span>
                        )}
                    </div>
                    {/* Mobile: team on line 1, role + perf on line 2 */}
                    <div className="sm:hidden text-[0.75rem] text-[var(--forge-text-dim)]">
                        <div className="flex items-center gap-1 overflow-hidden">
                            <TeamLogo slug={player.teamSlug} name={player.teamName} size={13} color={player.teamColor} className="flex-shrink-0" />
                            <span style={{ color: teamColor }} className="truncate">{player.teamName}</span>
                            {isLeagueWide && player.divisionName && (
                                <span className="forge-head text-[0.55rem] font-semibold tracking-wider text-[var(--forge-flame)] bg-[var(--forge-flame)]/8 border border-[var(--forge-flame)]/15 px-0.5 flex-shrink-0">
                                    {player.divisionName}
                                </span>
                            )}
                        </div>
                        {(player.role || perfValue != null) && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                                {player.role && (
                                    <span className="forge-head text-[0.6rem] font-semibold tracking-wider opacity-70">{player.role}</span>
                                )}
                                {perfValue != null && (
                                    <span className={`forge-num text-[0.7rem] ${perfColor}`}>
                                        {perfValue.toFixed(2)}x
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Status badge column — Passionless or Coinflip champion */}
                <div className="forge-col-badge flex items-center justify-center">
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
                <div className="forge-col-sparkline h-7 px-0.5 opacity-60 hidden sm:block">
                    <canvas ref={chartRef} />
                </div>

                {/* Delta */}
                <div className="forge-col-delta text-center px-2">
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

                {/* Actions */}
                <div className="flex items-center justify-end gap-1 px-2">
                    {isOpen && !isOwnTeam && (
                        <button
                            onClick={e => { e.stopPropagation(); onFuel(player) }}
                            data-tutorial="fuel-btn"
                            className="py-1.5 px-3 forge-head text-[0.75rem] font-semibold tracking-wider text-white cursor-pointer forge-clip-btn forge-btn-fuel flex items-center gap-1"
                            style={{
                                background: 'linear-gradient(135deg, var(--forge-flame), var(--forge-ember))',
                                boxShadow: '0 2px 8px rgba(232,101,32,0.2)',
                            }}
                        >
                            <Flame size={12} />
                            Fuel
                        </button>
                    )}
                    {isOpen && player.holding && (player.holding.sparks - (player.holding.tutorialSparks || 0)) > 0 && (
                        <button
                            onClick={e => { e.stopPropagation(); onCool(player) }}
                            className="py-1.5 px-3 forge-head text-[0.75rem] font-semibold tracking-wider text-[var(--forge-cool)] bg-[var(--forge-cool)]/8 border border-[var(--forge-cool)]/20 cursor-pointer forge-clip-btn forge-btn-cool flex items-center gap-1"
                        >
                            <Snowflake size={12} />
                            Cool
                        </button>
                    )}
                </div>
            </div>

            {/* Mobile expanded section — price history + delta */}
            {expanded && (
                <div className="sm:hidden relative z-[2] px-3 pb-2 flex items-center gap-3 border-t border-[var(--forge-edge)]/30">
                    <div className="h-8 flex-1 opacity-70">
                        <canvas ref={mobileChartRef} />
                    </div>
                    <span className={`forge-num text-[0.85rem] px-1.5 py-0.5 rounded-sm flex-shrink-0 ${
                        change != null
                            ? (isUp ? 'text-[var(--forge-gain)] bg-[var(--forge-gain)]/6' :
                               isDown ? 'text-[var(--forge-loss)] bg-[var(--forge-loss)]/6' :
                               'text-white')
                            : 'text-white'
                    }`}>
                        {change != null ? `${isUp ? '+' : ''}${change.toFixed(1)}%` : '\u00B10%'}
                    </span>
                    {player.totalSparks != null && (
                        <span className="forge-num text-[0.75rem] text-[var(--forge-text-dim)] flex items-center gap-0.5 flex-shrink-0">
                            <img src={sparkIcon} alt="" className="w-4 h-4 object-contain" />
                            {player.totalSparks}
                        </span>
                    )}
                </div>
            )}

            {/* Mobile expand indicator */}
            <div className="sm:hidden flex justify-center pb-0.5 relative z-[2]">
                <ChevronDown size={12} className={`text-[var(--forge-text-dim)] opacity-40 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </div>

        </div>
    )
}

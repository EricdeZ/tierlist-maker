import { useEffect, useRef } from 'react'
import { Flame, Snowflake } from 'lucide-react'
import TeamLogo from '../../components/TeamLogo'
import sparkIcon from '../../assets/spark.png'
import { getHeatTier, getActiveChange, SPARK_COLORS, FALLBACK_HISTORY } from './forgeConstants'
import { drawSparkline } from './forgeCanvas'

export default function ForgeHero({ player, historyData, marketStatus, userTeamId, isOwner, changeView, onFuel, onCool }) {
    const chartRef = useRef(null)
    const nameRef = useRef(null)
    const prevPlayerRef = useRef(null)

    // Animate name transition when player changes
    useEffect(() => {
        if (!player || !nameRef.current) return
        if (prevPlayerRef.current && prevPlayerRef.current !== player.sparkId) {
            const el = nameRef.current
            el.style.opacity = '0'
            el.style.transform = 'translateY(8px)'
            requestAnimationFrame(() => {
                el.style.transition = 'all 0.3s ease'
                el.style.opacity = '1'
                el.style.transform = 'translateY(0)'
                setTimeout(() => { el.style.transition = '' }, 350)
            })
        }
        prevPlayerRef.current = player.sparkId
    }, [player?.sparkId])

    // Draw sparkline (fallback to flat line at 100 if no data)
    useEffect(() => {
        if (!chartRef.current) return
        const data = historyData?.length ? historyData : FALLBACK_HISTORY
        const hasData = historyData?.length > 0
        const change = getActiveChange(player, changeView)
        const tier = getHeatTier(change)
        const colors = hasData ? (SPARK_COLORS[tier] || SPARK_COLORS.warm) : SPARK_COLORS.neutral
        drawSparkline(chartRef.current, data, { lineColor: colors.line, fillColor: colors.fill })
    }, [historyData, player?.priceChange24h, player?.priceChange7d, changeView])

    if (!player) return null

    const change = getActiveChange(player, changeView)
    const tier = getHeatTier(change)
    const isOpen = marketStatus === 'open'
    const isOwnTeam = !isOwner && userTeamId && player.teamId === userTeamId
    const isUp = change > 0
    const isDown = change < 0
    const initials = player.playerName.slice(0, 2).toUpperCase()
    const teamColor = player.teamColor || '#666'
    const changeLabel = changeView === '7d' ? '7d Change' : '24h Change'

    return (
        <div className="forge-hero relative mb-4 bg-[var(--forge-panel)] border border-[var(--forge-edge)] overflow-hidden min-h-[200px] flex">
            {/* Left accent line */}
            <div className="absolute top-0 left-0 w-[3px] h-full forge-accent-line z-10" />

            {/* Diagonal background accent */}
            <div
                className="absolute top-0 right-0 w-1/2 h-full pointer-events-none"
                style={{
                    background: 'linear-gradient(135deg, transparent 0%, rgba(232,101,32,0.02) 40%, rgba(255,61,0,0.05) 100%)',
                    clipPath: 'polygon(30% 0, 100% 0, 100% 100%, 0% 100%)',
                }}
            />

            {/* God/team color faded background */}
            <div
                className="absolute top-0 right-0 w-[280px] h-full pointer-events-none opacity-12 hover:opacity-18 transition-opacity"
                style={{
                    background: `linear-gradient(135deg, ${teamColor}40, ${teamColor}80)`,
                    maskImage: 'linear-gradient(90deg, transparent, black 40%)',
                    WebkitMaskImage: 'linear-gradient(90deg, transparent, black 40%)',
                }}
            />

            {/* Main content */}
            <div className="flex-1 p-7 flex items-center gap-7 relative z-[1]">
                {/* Tag */}
                <div className="absolute top-3 left-8 forge-head text-[0.75rem] font-semibold tracking-[0.25em] text-[var(--forge-flame)] flex items-center gap-1.5">
                    <span className="w-3 h-px bg-[var(--forge-flame)]" />
                    {tier === 'blazing' ? 'Hottest Spark' : 'Selected Spark'}
                </div>

                {/* Hex avatar */}
                <div className="w-24 h-24 flex-shrink-0 relative">
                    {/* Glow */}
                    <div className="absolute -inset-5 rounded-full forge-hex-glow"
                        style={{ background: 'radial-gradient(circle, rgba(232,101,32,0.2), transparent 70%)' }}
                    />
                    {/* Spinning border */}
                    <div className="absolute -inset-[5px] forge-clip-hex forge-hex-outer" />
                    {/* Inner hex */}
                    <div
                        className="relative w-full h-full forge-clip-hex flex items-center justify-center text-2xl font-extrabold text-white z-[1]"
                        style={{
                            background: player.godImageUrl
                                ? `url(${player.godImageUrl}) center/cover`
                                : `linear-gradient(135deg, ${teamColor}90, ${teamColor})`,
                            textShadow: '0 2px 8px rgba(0,0,0,0.6)',
                        }}
                    >
                        {!player.godImageUrl && initials}
                    </div>
                </div>

                {/* Info */}
                <div className="flex-1">
                    <div
                        ref={nameRef}
                        className="forge-head text-[2.6rem] font-bold tracking-wide leading-none mb-1"
                    >
                        {player.playerName}
                    </div>
                    <div className="flex items-center gap-2 text-[1rem] text-[var(--forge-text-mid)] mb-3.5">
                        <TeamLogo slug={player.teamSlug} name={player.teamName} size={18} color={player.teamColor} />
                        <span>{player.teamName}</span>
                        {player.role && (
                            <span className="forge-head text-[0.8rem] font-semibold tracking-wider px-2 py-0.5 bg-[var(--forge-flame)]/8 border border-[var(--forge-flame)]/15 text-[var(--forge-flame-bright)]">
                                {player.role}
                            </span>
                        )}
                    </div>
                    <div className="flex gap-6">
                        <div>
                            <div className={`forge-num text-[1.9rem] leading-none ${tier === 'cooling' ? 'text-[var(--forge-cool)]' : ''}`}
                                style={tier !== 'cooling' ? {
                                    background: 'linear-gradient(180deg, var(--forge-gold-bright), var(--forge-flame))',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    filter: 'drop-shadow(0 0 6px rgba(232,101,32,0.25))',
                                } : {}}
                            >
                                {Math.round(player.currentPrice).toLocaleString()}
                            </div>
                            <div className="forge-head text-[0.75rem] font-medium tracking-wider text-[var(--forge-text-dim)] mt-0.5">Heat</div>
                        </div>
                        <div>
                            <div className={`forge-num text-[1.9rem] leading-none ${isUp ? 'text-[var(--forge-gain)]' : isDown ? 'text-[var(--forge-loss)]' : 'text-white'}`}>
                                {change != null ? `${isUp ? '+' : ''}${change.toFixed(1)}%` : '\u00B10%'}
                            </div>
                            <div className="forge-head text-[0.75rem] font-medium tracking-wider text-[var(--forge-text-dim)] mt-0.5">{changeLabel}</div>
                        </div>
                        {player.perfMultiplier != null && (
                            <div>
                                <div className="forge-num text-[1.9rem] leading-none" style={{
                                    background: 'linear-gradient(180deg, var(--forge-gold-bright), var(--forge-flame))',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                }}>
                                    {player.perfMultiplier.toFixed(2)}x
                                </div>
                                <div className="forge-head text-[0.75rem] font-medium tracking-wider text-[var(--forge-text-dim)] mt-0.5">Performance</div>
                            </div>
                        )}
                        <div>
                            <div className="forge-num text-[1.9rem] leading-none text-[var(--forge-text)] flex items-center gap-1.5">
                                <img src={sparkIcon} alt="" className="w-5 h-5 object-contain inline -mt-0.5" />
                                {player.totalSparks}
                            </div>
                            <div className="forge-head text-[0.75rem] font-medium tracking-wider text-[var(--forge-text-dim)] mt-0.5">Sparks</div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                {isOpen && !isOwnTeam && (
                    <div className="flex flex-col gap-2 flex-shrink-0">
                        <button
                            onClick={() => onFuel(player)}
                            className="forge-clip-btn forge-btn-fuel forge-head text-[1rem] font-bold tracking-wider px-5 py-3 text-white flex items-center gap-2"
                            style={{
                                background: 'linear-gradient(135deg, var(--forge-flame), var(--forge-ember))',
                                boxShadow: '0 4px 20px rgba(232,101,32,0.3)',
                            }}
                        >
                            <Flame size={16} />
                            Fuel This Spark
                        </button>
                        {player.holding && player.holding.sparks > 0 && (
                            <button
                                onClick={() => onCool(player)}
                                className="forge-clip-btn forge-btn-cool forge-head text-[1rem] font-bold tracking-wider px-5 py-3 text-[var(--forge-cool)] bg-[var(--forge-cool)]/6 border border-[var(--forge-cool)]/20 flex items-center gap-2"
                            >
                                <Snowflake size={16} />
                                Cool
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Hero sparkline background */}
            <div className="absolute bottom-0 right-0 w-[45%] h-[70px] opacity-35 pointer-events-none">
                <canvas ref={chartRef} />
            </div>
        </div>
    )
}

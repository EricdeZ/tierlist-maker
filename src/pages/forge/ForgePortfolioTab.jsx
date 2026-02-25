import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { Zap, Flame, Snowflake, Wallet } from 'lucide-react'
import TeamLogo from '../../components/TeamLogo'
import sparkIcon from '../../assets/spark.png'
import forgeLogo from '../../assets/forge.png'
import passionCoin from '../../assets/passion/passion.png'
import { getHeatTier, SPARK_COLORS, FALLBACK_HISTORY } from './forgeConstants'
import { drawSparkline, drawPortfolioChart } from './forgeCanvas'

function StatBlock({ label, value, icon: Icon, color, prefix = '', raw = false }) {
    return (
        <div className="flex-1 bg-[var(--forge-panel)] p-3 relative overflow-hidden"
            style={{ clipPath: 'polygon(0 0, 100% 0, calc(100% - 6px) 100%, 0 100%)' }}
        >
            <div className="forge-head text-[0.75rem] font-semibold tracking-wider text-[var(--forge-text-dim)] mb-1 flex items-center gap-1">
                {Icon && <Icon size={11} />}
                {label}
            </div>
            <div className={`forge-num text-2xl ${color || 'text-[var(--forge-gold-bright)]'}`}>
                {raw ? value : (
                    <>
                        {prefix}
                        <img src={passionCoin} alt="" className="w-4 h-4 inline mr-1 -mt-0.5" />
                        {typeof value === 'number' ? value.toLocaleString() : value}
                    </>
                )}
            </div>
        </div>
    )
}

function HoldingSparkline({ historyData }) {
    const ref = useRef(null)
    const data = historyData?.length ? historyData.map(h => h.price) : FALLBACK_HISTORY
    const hasData = historyData?.length > 0

    useEffect(() => {
        if (!ref.current) return
        const last = data[data.length - 1]
        const first = data[0]
        const change = first > 0 ? ((last - first) / first) * 100 : 0
        const tier = change > 10 ? 'blazing' : change >= 0 ? 'warm' : 'cooling'
        const colors = hasData ? SPARK_COLORS[tier] : SPARK_COLORS.neutral
        drawSparkline(ref.current, data, { lineColor: colors.line, fillColor: colors.fill })
    }, [data, hasData])

    return (
        <div className="forge-holding-sparkline">
            <canvas ref={ref} />
        </div>
    )
}

function formatEventTime(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
        ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function getHoldingChange(holding, historyData) {
    // % change based on average buy price vs current price
    if (holding.avgBuyPrice > 0) {
        return ((holding.currentPrice - holding.avgBuyPrice) / holding.avgBuyPrice) * 100
    }
    return 0
}

const TRIGGER_LABELS = {
    fuel: 'Fueled',
    tutorial_fuel: 'Starter Spark',
    cool: 'Cooled',
    performance: 'Performance Update',
    init: 'Initial Price',
}

export default function ForgePortfolioTab({ portfolio, portfolioHistories, loading, seasonSlugs, onCool }) {
    const chartRef = useRef(null)
    const chartInteraction = useRef(null)
    const [tooltip, setTooltip] = useState(null)

    // Build composite portfolio timeline from all holdings' histories
    const portfolioTimeline = useMemo(() => {
        if (!portfolio?.holdings?.length || !portfolioHistories) return null

        // Collect all events from all holdings, tagged with player info
        const allEvents = []
        for (const h of portfolio.holdings) {
            const hist = portfolioHistories[h.sparkId]
            if (!hist?.length) continue
            for (const entry of hist) {
                allEvents.push({
                    sparkId: h.sparkId,
                    playerName: h.playerName,
                    value: entry.price * h.sparks,
                    price: entry.price,
                    trigger: entry.trigger,
                    createdAt: entry.createdAt,
                    sparks: h.sparks,
                })
            }
        }

        if (allEvents.length < 2) return null

        // Sort by time and build composite timeline
        allEvents.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

        // Build cumulative portfolio value at each event point
        // Track last known price for each sparkId
        const lastPrice = {}
        const timeline = []

        for (const ev of allEvents) {
            lastPrice[ev.sparkId] = ev.price

            // Calculate total portfolio value at this point
            let totalValue = 0
            for (const h of portfolio.holdings) {
                const p = lastPrice[h.sparkId] || h.currentPrice
                totalValue += p * h.sparks
            }

            timeline.push({
                value: Math.round(totalValue),
                trigger: ev.trigger,
                playerName: ev.playerName,
                createdAt: ev.createdAt,
            })
        }

        return timeline
    }, [portfolio, portfolioHistories])

    // Draw the big portfolio chart
    useEffect(() => {
        if (!chartRef.current || !portfolioTimeline) return
        chartInteraction.current = drawPortfolioChart(chartRef.current, portfolioTimeline, {
            lineColor: '#e86520',
            fillColor: 'rgba(232,101,32,0.15)',
        })
    }, [portfolioTimeline])

    const handleChartMove = useCallback((e) => {
        if (!chartInteraction.current || !chartRef.current) return
        const rect = chartRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        const hit = chartInteraction.current.getEventAt(x, y)
        if (hit) {
            setTooltip({
                x: hit.x,
                y: hit.y - 12,
                trigger: hit.trigger,
                value: hit.value,
                playerName: hit.playerName,
                createdAt: hit.createdAt,
                isLine: hit.isLine,
            })
        } else {
            setTooltip(null)
        }
    }, [])

    const handleChartLeave = useCallback(() => setTooltip(null), [])

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <img src={forgeLogo} alt="" className="w-24 h-24 object-contain forge-logo-float opacity-40 mb-3" />
                <div className="forge-head text-[var(--forge-text-dim)] text-lg tracking-wider">Loading your Sparks...</div>
                <div className="w-32 h-1 mt-2 rounded-full overflow-hidden bg-[var(--forge-edge)]">
                    <div className="h-full forge-shimmer rounded-full" style={{ background: 'var(--forge-flame)' }} />
                </div>
            </div>
        )
    }

    if (!portfolio || portfolio.holdings.length === 0) {
        return (
            <div className="text-center py-12">
                <img src={sparkIcon} alt="" className="w-16 h-16 object-contain mx-auto mb-3 opacity-30" />
                <p className="forge-body text-[var(--forge-text-dim)]">You haven't fueled any players yet.</p>
                <p className="text-xs text-[var(--forge-text-dim)] mt-1 opacity-60">Head to The Forge to get started!</p>
            </div>
        )
    }

    const { stats } = portfolio

    return (
        <div>
            {/* Portfolio stat strip */}
            {stats && (
                <div className="forge-stat-strip flex gap-[2px] mb-4 bg-[var(--forge-border)]">
                    <StatBlock label="Portfolio" value={stats.totalValue} icon={Wallet} />
                    <StatBlock label="Invested" value={stats.totalInvested} />
                    <StatBlock
                        label="Unrealized"
                        value={stats.unrealizedPL}
                        color={stats.unrealizedPL >= 0 ? 'text-[var(--forge-gain)]' : 'text-[var(--forge-loss)]'}
                        prefix={stats.unrealizedPL >= 0 ? '+' : ''}
                    />
                    <StatBlock
                        label="Return"
                        value={`${stats.plPercent >= 0 ? '+' : ''}${stats.plPercent}%`}
                        color={stats.plPercent >= 0 ? 'text-[var(--forge-gain)]' : 'text-[var(--forge-loss)]'}
                        raw
                    />
                </div>
            )}

            {/* Big Interactive Portfolio Chart */}
            {portfolioTimeline && (
                <>
                    <div className="relative pb-1.5 mb-2 border-b border-[var(--forge-border)]">
                        <h2 className="forge-head text-base font-bold tracking-wider text-[var(--forge-text-mid)] flex items-center gap-2">
                            <Zap size={14} className="text-[var(--forge-flame)]" />
                            Portfolio Value Over Time
                        </h2>
                        <div className="forge-section-accent" />
                    </div>
                    <div className="forge-portfolio-chart">
                        <canvas
                            ref={chartRef}
                            onMouseMove={handleChartMove}
                            onMouseLeave={handleChartLeave}
                        />
                        {tooltip && (
                            <div
                                className="forge-chart-tooltip"
                                style={{
                                    left: Math.min(Math.max(tooltip.x, 60), chartRef.current?.parentElement?.offsetWidth - 60 || 9999),
                                    top: Math.max(tooltip.y - 48, 4),
                                }}
                            >
                                <div className="forge-num text-sm text-[var(--forge-gold-bright)]">
                                    {Math.round(tooltip.value).toLocaleString()} Heat
                                </div>
                                {tooltip.trigger && !tooltip.isLine && (
                                    <div className="flex items-center gap-1 mt-0.5">
                                        {(tooltip.trigger === 'fuel' || tooltip.trigger === 'tutorial_fuel') && <Flame size={11} className="text-[var(--forge-flame)]" />}
                                        {tooltip.trigger === 'cool' && <Snowflake size={11} className="text-[var(--forge-cool)]" />}
                                        {tooltip.trigger === 'performance' && <Zap size={11} className="text-[var(--forge-gold)]" />}
                                        <span className="text-[var(--forge-text-mid)] text-xs">
                                            {TRIGGER_LABELS[tooltip.trigger] || tooltip.trigger}
                                        </span>
                                    </div>
                                )}
                                {tooltip.playerName && !tooltip.isLine && (
                                    <div className="text-[var(--forge-text-dim)] text-xs">{tooltip.playerName}</div>
                                )}
                                {tooltip.createdAt && (
                                    <div className="text-[var(--forge-text-dim)] text-[0.65rem] mt-0.5 opacity-60">
                                        {formatEventTime(tooltip.createdAt)}
                                    </div>
                                )}
                            </div>
                        )}
                        {/* Chart legend */}
                        <div className="absolute bottom-1 right-2 flex items-center gap-3 text-[0.6rem] text-[var(--forge-text-dim)] forge-head tracking-wider">
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-[var(--forge-flame)]" /> Fuel
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-[var(--forge-cool)]" /> Cool
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-[var(--forge-gold)]" /> Perf
                            </span>
                        </div>
                    </div>
                </>
            )}

            {/* Holdings header */}
            <div className="relative pb-1.5 mb-2 border-b border-[var(--forge-border)]">
                <h2 className="forge-head text-base font-bold tracking-wider text-[var(--forge-text-mid)]">
                    Holdings
                </h2>
                <div className="forge-section-accent" />
            </div>

            {/* Holdings with mini sparklines + % change */}
            <div className="space-y-[2px] forge-stagger">
                {portfolio.holdings.map(h => {
                    const change = getHoldingChange(h, portfolioHistories?.[h.sparkId])
                    const tier = getHeatTier(change)
                    const isUp = change > 0
                    const isDown = change < 0
                    const histData = portfolioHistories?.[h.sparkId]
                    const profileUrl = h.playerSlug
                        ? (seasonSlugs
                            ? `/${seasonSlugs.leagueSlug}/${seasonSlugs.divisionSlug}/players/${h.playerSlug}`
                            : `/profile/${h.playerSlug}`)
                        : null

                    return (
                        <div
                            key={h.sparkId}
                            className={`forge-${tier} forge-holding flex flex-wrap items-center gap-2 sm:gap-3 p-2.5 sm:p-3 bg-[var(--forge-panel)] border border-transparent`}
                        >
                            {/* Heat bar */}
                            <div className="w-1 h-10 rounded-sm forge-heat-bar hidden sm:block" />

                            <TeamLogo slug={h.teamSlug} name={h.teamName} size={28} color={h.teamColor} />

                            <div className="flex-1 min-w-0">
                                <div className="forge-body font-bold text-sm sm:text-base truncate">
                                    {profileUrl ? (
                                        <a
                                            href={profileUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="forge-profile-link"
                                        >
                                            {h.playerName}
                                        </a>
                                    ) : h.playerName}
                                </div>
                                <div className="text-xs sm:text-sm text-[var(--forge-text-dim)] flex items-center gap-1 flex-wrap">
                                    <span style={{ color: h.teamColor }} className="truncate">{h.teamName}</span>
                                    <span className="opacity-60 flex items-center gap-0.5">
                                        &middot;
                                        <img src={sparkIcon} alt="" className="w-5 h-5 sm:w-6 sm:h-6 object-contain forge-spark-icon" />
                                        <span className="forge-num">{h.sparks}</span>
                                    </span>
                                    {h.tutorialSparks > 0 && (
                                        <span className="forge-head text-[0.6rem] font-semibold tracking-wider text-[var(--forge-flame)] bg-[var(--forge-flame)]/8 border border-[var(--forge-flame)]/15 px-1">
                                            {h.tutorialSparks} free
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Mini sparkline */}
                            <div className="hidden sm:block">
                                <HoldingSparkline historyData={histData} />
                            </div>

                            {/* % change */}
                            <div className="text-center flex-shrink-0">
                                <span className={`forge-num text-xs sm:text-sm px-1.5 py-0.5 rounded-sm ${
                                    isUp ? 'text-[var(--forge-gain)] bg-[var(--forge-gain)]/6'
                                    : isDown ? 'text-[var(--forge-loss)] bg-[var(--forge-loss)]/6'
                                    : 'text-white'
                                }`}>
                                    {isUp ? '+' : ''}{change.toFixed(1)}%
                                </span>
                            </div>

                            {/* Value + P&L */}
                            <div className="text-right flex-shrink-0">
                                <div className="flex items-center gap-1 justify-end">
                                    <img src={passionCoin} alt="" className="w-3.5 h-3.5" />
                                    <span className="forge-num text-sm sm:text-base forge-price-text">{h.currentValue.toLocaleString()}</span>
                                </div>
                                <div className={`forge-num text-xs sm:text-sm ${h.unrealizedPL >= 0 ? 'text-[var(--forge-gain)]' : 'text-[var(--forge-loss)]'}`}>
                                    {h.unrealizedPL >= 0 ? '+' : ''}{h.unrealizedPL.toLocaleString()}
                                </div>
                            </div>

                            {h.coolableSparks > 0 ? (
                                <button
                                    onClick={() => onCool(h.sparkId, h.playerName, { sparks: h.sparks, coolableSparks: h.coolableSparks })}
                                    className="p-1.5 sm:p-2 bg-[var(--forge-cool)]/8 text-[var(--forge-cool)] forge-btn-cool forge-clip-btn flex items-center gap-1"
                                    title={h.tutorialSparks > 0 ? `Cool up to ${h.coolableSparks} Sparks` : 'Cool'}
                                >
                                    <Snowflake size={14} />
                                </button>
                            ) : (
                                <div
                                    className="p-1.5 sm:p-2 bg-[var(--forge-edge)]/30 text-[var(--forge-text-dim)] opacity-40 forge-clip-btn"
                                    title="Free Sparks cannot be cooled"
                                >
                                    <Snowflake size={14} />
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Recent Transactions */}
            {portfolio.transactions?.length > 0 && (
                <div className="mt-6">
                    <div className="relative pb-2 mb-3 border-b border-[var(--forge-border)]">
                        <h3 className="forge-head text-base font-bold tracking-wider text-[var(--forge-text-mid)]">
                            Recent Activity
                        </h3>
                        <div className="forge-section-accent" />
                    </div>
                    <div className="space-y-1">
                        {portfolio.transactions.map(t => (
                            <div key={t.id} className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 bg-[var(--forge-panel)]/40 text-sm sm:text-base hover:bg-[var(--forge-panel)]/60 transition-colors">
                                {(t.type === 'fuel' || t.type === 'tutorial_fuel') ? (
                                    <Flame size={16} className="text-[var(--forge-flame)] flex-shrink-0" />
                                ) : (
                                    <Snowflake size={16} className="text-[var(--forge-cool)] flex-shrink-0" />
                                )}
                                <span className="forge-body flex-1 min-w-0 truncate">
                                    {t.type === 'tutorial_fuel' ? 'Starter Spark' : t.type === 'fuel' ? 'Fueled' : t.type === 'cool' ? 'Cooled' : 'Liquidated'} {t.playerName}
                                    <span className="opacity-50 inline-flex items-center gap-0.5 ml-1">
                                        (<img src={sparkIcon} alt="" className="w-6 h-6 object-contain inline" />
                                        <span className="forge-num">{t.sparks}</span> Spark{t.sparks !== 1 ? 's' : ''})
                                    </span>
                                </span>
                                <span className={`forge-num font-medium ${
                                    t.type === 'tutorial_fuel' ? 'text-[var(--forge-flame-bright)]'
                                    : t.type === 'fuel' ? 'text-[var(--forge-loss)]'
                                    : 'text-[var(--forge-gain)]'
                                }`}>
                                    {t.type === 'tutorial_fuel' ? 'FREE' : `${t.type === 'fuel' ? '-' : '+'}${t.totalCost.toLocaleString()}`}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

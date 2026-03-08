import { useState, useEffect, useRef, useMemo } from 'react'
import { Zap, Flame, Snowflake, Wallet } from 'lucide-react'
import { createChart, LineSeries, LineStyle, CrosshairMode, createSeriesMarkers } from 'lightweight-charts'
import TeamLogo from '../../components/TeamLogo'
import sparkIcon from '../../assets/spark.png'
import forgeLogo from '../../assets/forge.png'
import passionCoin from '../../assets/passion/passion.png'
import { getHeatTier, SPARK_COLORS, FALLBACK_HISTORY, HOLDINGS_SORT_OPTIONS } from './forgeConstants'
import { drawSparkline } from './forgeCanvas'

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

function getHoldingChange(holding, changeView, historyData) {
    if (changeView === 'all' || !changeView) {
        if (holding.avgBuyPrice > 0) {
            return ((holding.currentPrice - holding.avgBuyPrice) / holding.avgBuyPrice) * 100
        }
        return 0
    }

    if (!historyData || historyData.length === 0) {
        if (holding.avgBuyPrice > 0) {
            return ((holding.currentPrice - holding.avgBuyPrice) / holding.avgBuyPrice) * 100
        }
        return 0
    }

    const now = Date.now()
    const cutoff = changeView === '24h' ? now - 86400_000 : now - 7 * 86400_000

    let basePrice = null
    for (let i = historyData.length - 1; i >= 0; i--) {
        if (new Date(historyData[i].createdAt).getTime() <= cutoff) {
            basePrice = historyData[i].price
            break
        }
    }
    if (basePrice == null) basePrice = historyData[0].price
    if (basePrice <= 0) return 0

    return ((holding.currentPrice - basePrice) / basePrice) * 100
}

const TRIGGER_LABELS = {
    fuel: 'Fueled',
    tutorial_fuel: 'Starter Spark',
    referral_fuel: 'Referral Spark',
    cool: 'Cooled',
    liquidate: 'Liquidated',
    performance: 'Performance Update',
    init: 'Initial Price',
}

const CHART_LAYERS_KEY = 'smite2_forge_chart_layers'
const DEFAULT_LAYERS = { worth: true, invested: true, fuel: true, cool: true, perf: true }

function loadChartLayers() {
    try {
        const stored = localStorage.getItem(CHART_LAYERS_KEY)
        return stored ? { ...DEFAULT_LAYERS, ...JSON.parse(stored) } : DEFAULT_LAYERS
    } catch { return DEFAULT_LAYERS }
}

function buildMarkers(timeline, chartLayers) {
    const markers = []
    for (const p of timeline) {
        if (!p.trigger || p.trigger === 'init') continue
        const isFuel = ['fuel', 'tutorial_fuel', 'referral_fuel'].includes(p.trigger)
        const isCool = ['cool', 'liquidate'].includes(p.trigger)
        const isPerf = p.trigger === 'performance'
        if (isFuel && !chartLayers.fuel) continue
        if (isCool && !chartLayers.cool) continue
        if (isPerf && !chartLayers.perf) continue
        markers.push({
            time: Math.floor(new Date(p.t).getTime() / 1000),
            position: isCool ? 'belowBar' : 'aboveBar',
            color: isFuel ? '#e86520' : isCool ? '#4499bb' : '#f0c840',
            shape: isPerf ? 'circle' : isFuel ? 'arrowUp' : 'arrowDown',
            size: 0,
        })
    }
    markers.sort((a, b) => a.time - b.time)
    return markers
}

export default function ForgePortfolioTab({ portfolio, portfolioHistories, portfolioTimeline, loading, seasonSlugs, isLeagueWide, leagueSlug, coolingLocked, fuelingLocked, changeView, onFuel, onCool }) {
    const chartContainerRef = useRef(null)
    const chartInstanceRef = useRef(null)
    const worthSeriesRef = useRef(null)
    const basisSeriesRef = useRef(null)
    const markersRef = useRef(null)
    const [tooltip, setTooltip] = useState(null)
    const [chartLayers, setChartLayers] = useState(loadChartLayers)
    const [holdingsSort, setHoldingsSort] = useState('value-desc')

    const toggleLayer = (key) => {
        setChartLayers(prev => {
            const next = { ...prev, [key]: !prev[key] }
            localStorage.setItem(CHART_LAYERS_KEY, JSON.stringify(next))
            return next
        })
    }

    // Create / recreate the lightweight-charts instance when timeline data changes
    useEffect(() => {
        if (!chartContainerRef.current || !portfolioTimeline?.length || portfolioTimeline.length < 2) return

        // Dispose previous chart
        if (chartInstanceRef.current) {
            chartInstanceRef.current.remove()
            chartInstanceRef.current = null
        }

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { color: 'transparent' },
                textColor: '#999088',
                fontFamily: 'Rajdhani, sans-serif',
                fontSize: 11,
            },
            grid: {
                vertLines: { color: 'rgba(34,34,34,0.5)' },
                horzLines: { color: 'rgba(34,34,34,0.5)' },
            },
            crosshair: {
                mode: CrosshairMode.Normal,
                vertLine: { color: 'rgba(232,101,32,0.3)', style: LineStyle.Dashed, labelBackgroundColor: '#1a1410' },
                horzLine: { color: 'rgba(232,101,32,0.3)', style: LineStyle.Dashed, labelBackgroundColor: '#1a1410' },
            },
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
                borderColor: 'rgba(34,34,34,0.8)',
                fixLeftEdge: true,
                fixRightEdge: true,
            },
            rightPriceScale: {
                borderColor: 'rgba(34,34,34,0.8)',
            },
            handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: false, vertTouchDrag: false },
            handleScale: { mouseWheel: true, pinch: false, axisPressedMouseMove: true },
        })

        chartInstanceRef.current = chart

        // Worth line (solid orange)
        const worthSeries = chart.addSeries(LineSeries,{
            color: '#e86520',
            lineWidth: 2,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 4,
            crosshairMarkerBackgroundColor: '#e86520',
            lastValueVisible: false,
            priceLineVisible: false,
            visible: chartLayers.worth,
        })

        // Cost basis line (dashed white)
        const basisSeries = chart.addSeries(LineSeries,{
            color: 'rgba(255,255,255,0.35)',
            lineWidth: 1.5,
            lineStyle: LineStyle.Dashed,
            crosshairMarkerVisible: false,
            lastValueVisible: false,
            priceLineVisible: false,
            visible: chartLayers.invested,
        })

        // Convert timeline data — deduplicate timestamps by keeping the last entry per second
        const worthMap = new Map()
        const basisMap = new Map()
        for (const p of portfolioTimeline) {
            const time = Math.floor(new Date(p.t).getTime() / 1000)
            worthMap.set(time, { time, value: p.worth })
            basisMap.set(time, { time, value: p.basis })
        }
        const worthData = [...worthMap.values()].sort((a, b) => a.time - b.time)
        const basisData = [...basisMap.values()].sort((a, b) => a.time - b.time)

        worthSeries.setData(worthData)
        basisSeries.setData(basisData)

        // Event markers
        markersRef.current = createSeriesMarkers(worthSeries, buildMarkers(portfolioTimeline, chartLayers))

        worthSeriesRef.current = worthSeries
        basisSeriesRef.current = basisSeries

        // Custom tooltip via crosshair
        chart.subscribeCrosshairMove((param) => {
            if (!param.time || !param.point) {
                setTooltip(null)
                return
            }
            const worthValue = param.seriesData.get(worthSeries)
            const basisValue = param.seriesData.get(basisSeries)
            const ts = param.time
            const match = portfolioTimeline.find(p =>
                Math.floor(new Date(p.t).getTime() / 1000) === ts
            )
            setTooltip({
                x: param.point.x,
                y: param.point.y,
                worth: worthValue?.value ?? 0,
                basis: basisValue?.value ?? 0,
                trigger: match?.trigger,
                playerName: match?.playerName,
                createdAt: match?.t,
                isLine: !match?.trigger || match.trigger === 'init',
            })
        })

        // Apply initial time range
        if (changeView === 'all' || !changeView) {
            chart.timeScale().fitContent()
        } else {
            const now = Math.floor(Date.now() / 1000)
            const offset = changeView === '24h' ? 86400 : 7 * 86400
            chart.timeScale().setVisibleRange({ from: now - offset, to: now })
        }

        // Resize observer
        const resizeObserver = new ResizeObserver(() => {
            if (chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth })
            }
        })
        resizeObserver.observe(chartContainerRef.current)

        return () => {
            resizeObserver.disconnect()
            chart.remove()
            chartInstanceRef.current = null
            worthSeriesRef.current = null
            basisSeriesRef.current = null
            markersRef.current = null
        }
    }, [portfolioTimeline])

    // Update layer visibility without full chart recreation
    useEffect(() => {
        if (!chartInstanceRef.current) return
        if (worthSeriesRef.current) {
            worthSeriesRef.current.applyOptions({ visible: chartLayers.worth })
        }
        if (basisSeriesRef.current) {
            basisSeriesRef.current.applyOptions({ visible: chartLayers.invested })
        }
        if (markersRef.current && portfolioTimeline) {
            markersRef.current.setMarkers(buildMarkers(portfolioTimeline, chartLayers))
        }
    }, [chartLayers, portfolioTimeline])

    // Update visible range when changeView changes (without recreating chart)
    useEffect(() => {
        if (!chartInstanceRef.current) return
        const ts = chartInstanceRef.current.timeScale()
        if (changeView === 'all' || !changeView) {
            ts.fitContent()
        } else {
            const now = Math.floor(Date.now() / 1000)
            const offset = changeView === '24h' ? 86400 : 7 * 86400
            ts.setVisibleRange({ from: now - offset, to: now })
        }
    }, [changeView])

    // Sorted holdings
    const sortedHoldings = useMemo(() => {
        if (!portfolio?.holdings) return []
        const list = [...portfolio.holdings]
        const [key, dir] = holdingsSort.split('-')
        list.sort((a, b) => {
            let va, vb
            if (key === 'value') { va = a.currentValue; vb = b.currentValue }
            else if (key === 'pl') { va = a.unrealizedPL; vb = b.unrealizedPL }
            else if (key === 'change') {
                va = getHoldingChange(a, changeView, portfolioHistories?.[a.sparkId])
                vb = getHoldingChange(b, changeView, portfolioHistories?.[b.sparkId])
            }
            else if (key === 'price') { va = a.currentPrice; vb = b.currentPrice }
            else if (key === 'sparks') { va = a.sparks; vb = b.sparks }
            else if (key === 'name') { va = a.playerName; vb = b.playerName }
            if (typeof va === 'string') return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
            return dir === 'asc' ? va - vb : vb - va
        })
        return list
    }, [portfolio?.holdings, holdingsSort, changeView, portfolioHistories])

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
    const changeLabel = changeView === '24h' ? '24h' : changeView === '7d' ? '7d' : 'all-time'

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

            {/* Interactive Portfolio Chart (lightweight-charts) */}
            {portfolioTimeline?.length >= 2 && (
                <>
                    <div className="relative pb-1.5 mb-2 border-b border-[var(--forge-border)]">
                        <h2 className="forge-head text-base font-bold tracking-wider text-[var(--forge-text-mid)] flex items-center gap-2">
                            <Zap size={14} className="text-[var(--forge-flame)]" />
                            Portfolio Worth vs Invested
                        </h2>
                        <div className="forge-section-accent" />
                    </div>
                    <div className="forge-portfolio-chart relative" style={{ touchAction: 'none' }}>
                        <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
                        {tooltip && (
                            <div
                                className="forge-chart-tooltip"
                                style={{
                                    left: Math.min(Math.max(tooltip.x, 60), chartContainerRef.current?.offsetWidth - 60 || 9999),
                                    top: Math.max(tooltip.y - 58, 4),
                                }}
                            >
                                <div className="forge-num text-sm text-[var(--forge-gold-bright)]">
                                    {Math.round(tooltip.worth).toLocaleString()} Worth
                                </div>
                                <div className="forge-num text-xs text-[var(--forge-text-dim)]">
                                    {Math.round(tooltip.basis).toLocaleString()} Invested
                                </div>
                                {tooltip.trigger && !tooltip.isLine && (
                                    <div className="flex items-center gap-1 mt-0.5">
                                        {(tooltip.trigger === 'fuel' || tooltip.trigger === 'tutorial_fuel' || tooltip.trigger === 'referral_fuel') && <Flame size={11} className="text-[var(--forge-flame)]" />}
                                        {(tooltip.trigger === 'cool' || tooltip.trigger === 'liquidate') && <Snowflake size={11} className="text-[var(--forge-cool)]" />}
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
                    </div>
                    {/* Chart layer toggles — below chart */}
                    <div className="flex items-center justify-end gap-1 mt-1 mb-3 forge-head tracking-wider">
                        {[
                            { key: 'worth', label: 'Worth', color: 'var(--forge-flame)', swatch: 'line' },
                            { key: 'invested', label: 'Invested', color: 'rgba(255,255,255,0.4)', swatch: 'dashed' },
                            { key: 'fuel', label: 'Fuel', color: 'var(--forge-flame)' },
                            { key: 'cool', label: 'Cool', color: 'var(--forge-cool)' },
                            { key: 'perf', label: 'Perf', color: 'var(--forge-gold)' },
                        ].map(l => (
                            <button
                                key={l.key}
                                onClick={() => toggleLayer(l.key)}
                                className={`flex items-center gap-1 px-1.5 py-0.5 text-[0.6rem] cursor-pointer transition-opacity ${
                                    chartLayers[l.key] ? 'opacity-100' : 'opacity-30'
                                }`}
                            >
                                {l.swatch === 'line' ? (
                                    <span className="w-3 h-0 border-t-2" style={{ borderColor: l.color }} />
                                ) : l.swatch === 'dashed' ? (
                                    <span className="w-4 h-0 border-t border-dashed" style={{ borderColor: l.color }} />
                                ) : (
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                                )}
                                <span style={{ color: chartLayers[l.key] ? l.color : 'var(--forge-text-dim)' }}>{l.label}</span>
                            </button>
                        ))}
                    </div>
                </>
            )}

            {/* Holdings header with sort controls */}
            <div className="relative pb-1.5 mb-2 border-b border-[var(--forge-border)] flex items-center justify-between flex-wrap gap-1">
                <h2 className="forge-head text-base font-bold tracking-wider text-[var(--forge-text-mid)]">
                    Holdings
                </h2>
                <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
                    {HOLDINGS_SORT_OPTIONS.map(o => (
                        <button
                            key={o.key}
                            onClick={() => setHoldingsSort(o.key)}
                            className={`flex-shrink-0 px-2 py-0.5 forge-head text-[0.6rem] sm:text-xs font-semibold tracking-wider cursor-pointer transition-colors ${
                                holdingsSort === o.key
                                    ? 'bg-[var(--forge-flame)]/15 border border-[var(--forge-flame)]/40 text-[var(--forge-flame-bright)]'
                                    : 'text-[var(--forge-text-dim)] border border-transparent hover:text-[var(--forge-text-mid)]'
                            }`}
                        >
                            {o.label}
                        </button>
                    ))}
                </div>
                <div className="forge-section-accent" />
            </div>

            {/* Holdings with mini sparklines + % change + per-spark price */}
            <div className="space-y-[2px] forge-stagger">
                {sortedHoldings.map(h => {
                    const change = getHoldingChange(h, changeView, portfolioHistories?.[h.sparkId])
                    const tier = getHeatTier(change)
                    const isUp = change > 0
                    const isDown = change < 0
                    const histData = portfolioHistories?.[h.sparkId]
                    const profileUrl = h.playerSlug
                        ? (isLeagueWide && h.divisionSlug
                            ? `/forge/${leagueSlug}/${h.divisionSlug}/player/${h.playerSlug}`
                            : seasonSlugs
                                ? `/forge/${seasonSlugs.leagueSlug}/${seasonSlugs.divisionSlug}/player/${h.playerSlug}`
                                : null)
                        : null

                    return (
                        <div
                            key={h.sparkId}
                            className={`forge-${tier} forge-holding flex flex-wrap items-center gap-2 sm:gap-3 p-2.5 sm:p-3 bg-[var(--forge-panel)] border border-transparent`}
                        >
                            {/* Heat bar */}
                            <div className="w-1 h-10 rounded-sm forge-heat-bar hidden sm:block" />

                            {!h.isFreeAgent && (
                                <TeamLogo slug={h.teamSlug} name={h.teamName} size={28} color={h.teamColor} />
                            )}

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
                                    {h.isFreeAgent ? (
                                        <span className="forge-head text-[0.7rem] font-semibold tracking-wider opacity-70">Free Agent</span>
                                    ) : (
                                        <span style={{ color: h.teamColor }} className="truncate">{h.teamName}</span>
                                    )}
                                    {isLeagueWide && h.divisionName && (
                                        <span className="forge-head text-[0.6rem] font-semibold tracking-wider text-[var(--forge-flame)] bg-[var(--forge-flame)]/8 border border-[var(--forge-flame)]/15 px-1 flex-shrink-0">
                                            {h.divisionName}
                                        </span>
                                    )}
                                    <span className="opacity-60 flex items-center gap-0.5">
                                        &middot;
                                        <img src={sparkIcon} alt="" className="w-5 h-5 sm:w-6 sm:h-6 object-contain forge-spark-icon" />
                                        <span className="forge-num">{h.sparks}</span>
                                    </span>
                                    <span className="opacity-60 flex items-center gap-0.5 sm:hidden">
                                        &middot;
                                        <span className="forge-num">{Math.round(h.currentPrice).toLocaleString()}/ea</span>
                                    </span>
                                    {h.tutorialSparks > 0 && (
                                        <span className="forge-head text-[0.6rem] font-semibold tracking-wider text-[var(--forge-flame)] bg-[var(--forge-flame)]/8 border border-[var(--forge-flame)]/15 px-1">
                                            {h.tutorialSparks} free
                                        </span>
                                    )}
                                    {h.referralSparks > 0 && (
                                        <span className="forge-head text-[0.6rem] font-semibold tracking-wider text-[var(--forge-gold)] bg-[var(--forge-gold)]/8 border border-[var(--forge-gold)]/15 px-1">
                                            {h.referralSparks} referral
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Mini sparkline */}
                            <div className="hidden sm:block">
                                <HoldingSparkline historyData={histData} />
                            </div>

                            {/* Per-spark price (desktop) */}
                            <div className="text-center flex-shrink-0 hidden sm:block">
                                <div className="flex items-center gap-0.5 justify-center">
                                    <img src={passionCoin} alt="" className="w-3 h-3" />
                                    <span className="forge-num text-xs text-[var(--forge-text-mid)]">
                                        {Math.round(h.currentPrice).toLocaleString()}
                                    </span>
                                </div>
                                <div className="text-[0.55rem] text-[var(--forge-text-dim)] uppercase tracking-wider">per spark</div>
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
                                <div className="text-[0.5rem] text-[var(--forge-text-dim)] mt-0.5">{changeLabel}</div>
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

                            {!fuelingLocked ? (
                                <button
                                    onClick={() => onFuel(h.sparkId, h.playerName, h.currentPrice)}
                                    className="p-1.5 sm:p-2 bg-[var(--forge-flame)]/8 text-[var(--forge-flame)] forge-btn-fuel forge-clip-btn flex items-center gap-1"
                                    title="Fuel"
                                >
                                    <Flame size={14} />
                                </button>
                            ) : (
                                <div
                                    className="p-1.5 sm:p-2 bg-[var(--forge-edge)]/30 text-[var(--forge-text-dim)] opacity-40 forge-clip-btn"
                                    title="Fueling is currently locked"
                                >
                                    <Flame size={14} />
                                </div>
                            )}
                            {!coolingLocked && h.coolableSparks > 0 ? (
                                <button
                                    onClick={() => onCool(h.sparkId, h.playerName, { sparks: h.sparks, coolableSparks: h.coolableSparks })}
                                    className="p-1.5 sm:p-2 bg-[var(--forge-cool)]/8 text-[var(--forge-cool)] forge-btn-cool forge-clip-btn flex items-center gap-1"
                                    title={(h.tutorialSparks > 0 || h.referralSparks > 0) ? `Cool up to ${h.coolableSparks} Sparks` : 'Cool'}
                                >
                                    <Snowflake size={14} />
                                </button>
                            ) : (
                                <div
                                    className="p-1.5 sm:p-2 bg-[var(--forge-edge)]/30 text-[var(--forge-text-dim)] opacity-40 forge-clip-btn"
                                    title={coolingLocked ? 'Cooling is currently locked' : 'Free Sparks cannot be cooled'}
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
                                {(t.type === 'fuel' || t.type === 'tutorial_fuel' || t.type === 'referral_fuel') ? (
                                    <Flame size={16} className="text-[var(--forge-flame)] flex-shrink-0" />
                                ) : (
                                    <Snowflake size={16} className="text-[var(--forge-cool)] flex-shrink-0" />
                                )}
                                <span className="forge-body flex-1 min-w-0 truncate">
                                    {t.type === 'tutorial_fuel' ? 'Starter Spark' : t.type === 'referral_fuel' ? 'Referral Spark' : t.type === 'fuel' ? 'Fueled' : t.type === 'cool' ? 'Cooled' : 'Liquidated'} {t.playerName}
                                    <span className="opacity-50 inline-flex items-center gap-0.5 ml-1">
                                        (<img src={sparkIcon} alt="" className="w-6 h-6 object-contain inline" />
                                        <span className="forge-num">{t.sparks}</span> Spark{t.sparks !== 1 ? 's' : ''})
                                    </span>
                                </span>
                                <span className={`forge-num font-medium ${
                                    (t.type === 'tutorial_fuel' || t.type === 'referral_fuel') ? 'text-[var(--forge-flame-bright)]'
                                    : t.type === 'fuel' ? 'text-[var(--forge-loss)]'
                                    : 'text-[var(--forge-gain)]'
                                }`}>
                                    {(t.type === 'tutorial_fuel' || t.type === 'referral_fuel') ? 'FREE' : `${t.type === 'fuel' ? '-' : '+'}${t.totalCost.toLocaleString()}`}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Flame } from 'lucide-react'
import { forgeService } from '../../../services/database'
import sparkIcon from '../../../assets/spark.png'
import forgeLogo from '../../../assets/forge.png'
import { drawSparkline } from '../../forge/forgeCanvas'
import { getHeatTier, SPARK_COLORS, FALLBACK_HISTORY } from '../../forge/forgeConstants'
import '../../forge/forge.css'

export default function ForgeBanner({ spark, leagueSlug, divisionSlug }) {
    const chartRef = useRef(null)
    const [historyData, setHistoryData] = useState(null)

    useEffect(() => {
        if (!spark) return
        forgeService.getHistory(spark.sparkId).then(res => {
            setHistoryData(res.history || [])
        }).catch(() => {})
    }, [spark?.sparkId])

    useEffect(() => {
        if (!chartRef.current || !historyData) return
        const data = historyData.length ? historyData.map(h => h.price) : FALLBACK_HISTORY
        const hasData = historyData.length > 0
        const change = spark.priceChange24h
        const tier = getHeatTier(change)
        const colors = hasData ? SPARK_COLORS[tier] : SPARK_COLORS.neutral
        drawSparkline(chartRef.current, data, { lineColor: colors.line, fillColor: colors.fill })
    }, [historyData, spark])

    if (!spark) return null

    const change = spark.priceChange24h
    const tier = getHeatTier(change)
    const isUp = change > 0
    const isDown = change < 0
    const perfColor = spark.perfMultiplier >= 1.5 ? 'text-[var(--forge-flame-bright)]'
        : spark.perfMultiplier >= 1.0 ? 'text-[var(--forge-gold)]'
        : spark.perfMultiplier >= 0.7 ? 'text-[var(--forge-cool)]'
        : 'text-[var(--forge-loss)]'

    return (
        <div className="mb-6">
            <Link
                to={`/forge/${leagueSlug}/${divisionSlug}/player/${spark.playerSlug}`}
                className={`forge-${tier} block bg-[var(--forge-panel)] border border-[var(--forge-edge)] hover:border-[var(--forge-flame)]/30 transition-colors relative overflow-hidden group`}
            >
                {/* Left flame accent */}
                <div className="absolute top-0 left-0 w-[3px] h-full forge-accent-line" />

                <div className="p-3 sm:p-4 flex items-center gap-2.5 sm:gap-4 relative z-[1]">
                    {/* Forge logo */}
                    <img src={forgeLogo} alt="" className="w-10 h-10 sm:w-16 sm:h-16 object-contain forge-logo-glow flex-shrink-0" />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <div className="forge-head text-[0.7rem] font-semibold tracking-[0.2em] text-[var(--forge-flame)] mb-0.5 flex items-center gap-1.5">
                            <Flame size={10} />
                            Fantasy Forge
                        </div>
                        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                            {/* Price */}
                            <div>
                                <span className="forge-num text-lg text-[var(--forge-gold-bright)]">
                                    {Math.round(spark.currentPrice).toLocaleString()}
                                </span>
                                <span className="forge-head text-[0.6rem] tracking-wider text-[var(--forge-text-dim)] ml-1">Heat</span>
                            </div>
                            {/* Change */}
                            {change != null && (
                                <span className={`forge-num text-sm ${isUp ? 'text-[var(--forge-gain)]' : isDown ? 'text-[var(--forge-loss)]' : 'text-white'}`}>
                                    {isUp ? '+' : ''}{change.toFixed(1)}%
                                </span>
                            )}
                            {/* Performance */}
                            {spark.perfMultiplier != null && (
                                <div className="flex items-center gap-1">
                                    <span className={`forge-num text-sm ${perfColor}`}>{spark.perfMultiplier.toFixed(2)}x</span>
                                    <span className="forge-head text-[0.6rem] tracking-wider text-[var(--forge-text-dim)]">Perf</span>
                                </div>
                            )}
                            {/* Sparks */}
                            <div className="flex items-center gap-1">
                                <img src={sparkIcon} alt="" className="w-5 h-5 object-contain" />
                                <span className="forge-num text-sm text-[var(--forge-text-mid)]">{spark.totalSparks}</span>
                                <span className="forge-head text-[0.6rem] tracking-wider text-[var(--forge-text-dim)]">Sparks</span>
                            </div>
                        </div>
                    </div>

                    {/* Mini sparkline */}
                    <div className="w-[100px] h-[32px] flex-shrink-0 opacity-60 hidden sm:block">
                        <canvas ref={chartRef} />
                    </div>

                    {/* CTA */}
                    <div className="forge-head text-[0.65rem] sm:text-[0.75rem] font-semibold tracking-wider text-[var(--forge-flame)] group-hover:text-[var(--forge-flame-bright)] transition-colors flex-shrink-0">
                        <span className="hidden sm:inline">View in Forge</span><span className="sm:hidden">Forge</span> →
                    </div>
                </div>
            </Link>
        </div>
    )
}

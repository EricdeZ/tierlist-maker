import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { usePassion } from '../../context/PassionContext'
import { forgeService, leagueService } from '../../services/database'
import PageTitle from '../../components/PageTitle'
import Navbar from '../../components/layout/Navbar'
import forgeLogo from '../../assets/forge.png'
import sparkIcon from '../../assets/spark.png'
import passionCoin from '../../assets/passion/passion.png'
import passiontailsImg from '../../assets/passion/passiontails.png'
import { Flame, Snowflake, Zap, Trophy, Target } from 'lucide-react'
import { FORGE_COLORS } from './forgeConstants'
import { createEmberSystem, drawPortfolioChart } from './forgeCanvas'
import ForgeHero from './ForgeHero'
import ForgeTradeModal from './ForgeTradeModal'
import ForgeToast from './ForgeToast'
import './forge.css'

const CHANGE_VIEW_KEY = 'smite2_forge_change_view'

export default function ForgePlayerPage() {
    const { leagueSlug, divisionSlug, playerSlug } = useParams()
    const navigate = useNavigate()
    const { user, login, loading: authLoading } = useAuth()
    const { balance, refreshBalance } = usePassion()

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [seasonId, setSeasonId] = useState(null)
    const [market, setMarket] = useState(null)
    const [player, setPlayer] = useState(null)
    const [historyData, setHistoryData] = useState([])
    const [freeSparksRemaining, setFreeSparksRemaining] = useState(0)
    const [referralSparksAvailable, setReferralSparksAvailable] = useState(0)
    const [tutorialCompleted, setTutorialCompleted] = useState(null)
    const [userTeamId, setUserTeamId] = useState(null)
    const [isOwner, setIsOwner] = useState(false)

    const [changeView, setChangeView] = useState(() => {
        try { return localStorage.getItem(CHANGE_VIEW_KEY) || '24h' }
        catch { return '24h' }
    })

    // Trade modal state
    const [tradeModal, setTradeModal] = useState(null)
    const [tradeAmount, setTradeAmount] = useState(1)
    const [trading, setTrading] = useState(false)
    const [tradeResult, setTradeResult] = useState(null)
    const [tradeError, setTradeError] = useState(null)
    const [toastMessage, setToastMessage] = useState(null)

    // Canvas refs
    const bgCanvasRef = useRef(null)
    const chartRef = useRef(null)
    const chartInteraction = useRef(null)
    const [tooltip, setTooltip] = useState(null)

    // Ember background
    useEffect(() => {
        if (!bgCanvasRef.current) return
        const system = createEmberSystem(bgCanvasRef.current)
        system.start()
        const handleResize = () => system.resize()
        window.addEventListener('resize', handleResize)
        return () => { system.stop(); window.removeEventListener('resize', handleResize) }
    }, [user])

    // Resolve season and load data
    useEffect(() => {
        if (!leagueSlug || !divisionSlug) return
        let cancelled = false

        const load = async () => {
            try {
                setLoading(true)
                const full = await leagueService.getBySlug(leagueSlug)
                if (cancelled) return
                const div = full?.divisions?.find(d => d.slug === divisionSlug)
                if (!div?.seasons?.length) {
                    setError('Division not found')
                    return
                }
                const season = div.seasons.find(s => s.is_active) || div.seasons[0]
                setSeasonId(season.id)

                const [marketData, tutStatus] = await Promise.all([
                    forgeService.getMarket(season.id),
                    user ? forgeService.getTutorialStatus(season.id).catch(() => ({ completed: true })) : Promise.resolve({ completed: true }),
                ])
                if (cancelled) return

                setMarket(marketData.market)
                setUserTeamId(marketData.userTeamId || null)
                setIsOwner(marketData.isOwner || false)
                setFreeSparksRemaining(marketData.freeSparksRemaining ?? 0)
                setReferralSparksAvailable(marketData.referralSparksAvailable ?? 0)
                setTutorialCompleted(tutStatus.completed)

                const found = (marketData.players || []).find(p => p.playerSlug === playerSlug)
                if (!found) {
                    setError('Player not found in this market')
                    return
                }
                setPlayer(found)

                // Load price history
                const histData = await forgeService.getHistory(found.sparkId)
                if (!cancelled) setHistoryData(histData.history || [])
            } catch (err) {
                if (!cancelled) setError(err.message)
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => { cancelled = true }
    }, [leagueSlug, divisionSlug, playerSlug, user])

    // Draw interactive chart
    useEffect(() => {
        if (!chartRef.current || !historyData.length) return
        const timeline = historyData.map(h => ({
            worth: h.price,
            basis: h.price,
            trigger: h.trigger,
            t: h.createdAt,
            playerName: player?.playerName,
        }))
        if (timeline.length >= 2) {
            chartInteraction.current = drawPortfolioChart(chartRef.current, timeline, {
                lineColor: FORGE_COLORS.flame,
                fillColor: 'rgba(232,101,32,0.15)',
                showBasis: false,
            })
        }
    }, [historyData, player])

    const handleChartMove = useCallback((e) => {
        if (!chartInteraction.current || !chartRef.current) return
        const rect = chartRef.current.getBoundingClientRect()
        const hit = chartInteraction.current.getEventAt(e.clientX - rect.left, e.clientY - rect.top)
        setTooltip(hit ? { ...hit, y: hit.y - 12 } : null)
    }, [])

    // Trade handlers
    const openTrade = (mode) => {
        setTradeModal({ player, mode })
        setTradeAmount(1)
        setTradeResult(null)
        setTradeError(null)
    }

    const executeTrade = async () => {
        if (!tradeModal || tradeAmount < 1) return
        setTrading(true)
        setTradeError(null)
        setTradeResult(null)
        try {
            let result
            if (tradeModal.mode === 'fuel') {
                result = await forgeService.fuel(tradeModal.player.sparkId, tradeAmount)
            } else {
                result = await forgeService.cool(tradeModal.player.sparkId, tradeAmount)
            }
            setTradeResult(result)
            refreshBalance()
            setToastMessage(tradeModal.mode === 'fuel'
                ? `Spark Fueled! +${tradeAmount} to ${player.playerName}`
                : `Cooled ${tradeAmount} Spark${tradeAmount !== 1 ? 's' : ''} from ${player.playerName}`)
            // Reload data
            setTimeout(async () => {
                const data = await forgeService.getMarket(seasonId)
                const updated = (data.players || []).find(p => p.playerSlug === playerSlug)
                if (updated) setPlayer(updated)
                setFreeSparksRemaining(data.freeSparksRemaining ?? 0)
                const hist = await forgeService.getHistory(updated?.sparkId || player.sparkId)
                setHistoryData(hist.history || [])
            }, 500)
        } catch (err) {
            setTradeError(err.message || 'Trade failed')
        } finally {
            setTrading(false)
        }
    }

    const executeFreeFuel = async (sparkId) => {
        setTrading(true)
        setTradeError(null)
        setTradeResult(null)
        try {
            const result = await forgeService.tutorialFuel(sparkId)
            if (result.freeSparksRemaining != null) setFreeSparksRemaining(result.freeSparksRemaining)
            setTradeResult({ ...result, isFreeSpark: true })
            setToastMessage(`Starter Spark Fueled! +1 to ${player.playerName}`)
            setTimeout(async () => {
                const data = await forgeService.getMarket(seasonId)
                const updated = (data.players || []).find(p => p.playerSlug === playerSlug)
                if (updated) setPlayer(updated)
                setFreeSparksRemaining(data.freeSparksRemaining ?? 0)
                const hist = await forgeService.getHistory(updated?.sparkId || player.sparkId)
                setHistoryData(hist.history || [])
            }, 500)
        } catch (err) {
            setTradeError(err.message || 'Failed to use Starter Spark')
        } finally {
            setTrading(false)
        }
    }

    const executeReferralFuel = async (sparkId) => {
        setTrading(true)
        setTradeError(null)
        setTradeResult(null)
        try {
            const result = await forgeService.referralFuel(sparkId)
            setReferralSparksAvailable(prev => Math.max(0, prev - 1))
            setTradeResult({ ...result, isReferralSpark: true })
            setToastMessage(`Referral Spark Fueled! +1 to ${player.playerName}`)
            setTimeout(async () => {
                const data = await forgeService.getMarket(seasonId)
                const updated = (data.players || []).find(p => p.playerSlug === playerSlug)
                if (updated) setPlayer(updated)
                setFreeSparksRemaining(data.freeSparksRemaining ?? 0)
                setReferralSparksAvailable(data.referralSparksAvailable ?? 0)
                const hist = await forgeService.getHistory(updated?.sparkId || player.sparkId)
                setHistoryData(hist.history || [])
            }, 500)
        } catch (err) {
            setTradeError(err.message || 'Failed to use Referral Spark')
        } finally {
            setTrading(false)
        }
    }

    // Loading / auth gate
    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-(--color-primary) text-(--color-text)">
                <Navbar title="Fantasy Forge" />
                <PageTitle title="Fantasy Forge" />
                <div className="flex flex-col items-center justify-center pt-48">
                    <img src={forgeLogo} alt="" className="w-40 h-40 object-contain forge-logo-float forge-logo-glow mb-4" />
                    <div className="forge-head text-lg font-semibold tracking-wider text-[var(--forge-text-mid)]">Loading Spark...</div>
                    <div className="w-48 h-1 mt-3 rounded-full overflow-hidden bg-[var(--forge-edge)]">
                        <div className="h-full forge-shimmer rounded-full" style={{ background: 'var(--forge-flame)' }} />
                    </div>
                </div>
            </div>
        )
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-(--color-primary) text-(--color-text)">
                <Navbar title="Fantasy Forge" />
                <PageTitle title="Fantasy Forge" />
                <div className="max-w-lg mx-auto px-4 pt-32 text-center">
                    <img src={forgeLogo} alt="" className="w-48 h-48 object-contain mx-auto mb-6 forge-logo-float forge-logo-glow" />
                    <h2 className="forge-head text-3xl font-bold tracking-wider mb-2">Fantasy Forge</h2>
                    <p className="forge-body text-[var(--forge-text-mid)] mb-6">Sign in to view player Spark profiles.</p>
                    <button onClick={login} className="forge-clip-btn forge-btn-fuel forge-head text-base font-bold tracking-wider px-6 py-3 text-white"
                        style={{ background: 'linear-gradient(135deg, var(--forge-flame), var(--forge-ember))', boxShadow: '0 4px 20px rgba(232,101,32,0.3)' }}>
                        Sign in to Enter the Forge
                    </button>
                </div>
            </div>
        )
    }

    if (error || !player) {
        return (
            <div className="min-h-screen bg-(--color-primary) text-(--color-text)">
                <Navbar title="Fantasy Forge" />
                <PageTitle title="Fantasy Forge" />
                <div className="max-w-lg mx-auto px-4 pt-32 text-center">
                    <p className="text-[var(--forge-loss)]">{error || 'Player not found'}</p>
                    <Link to={`/forge/${leagueSlug}/${divisionSlug}`} className="text-[var(--forge-flame)] mt-4 inline-block">
                        Back to the Forge
                    </Link>
                </div>
            </div>
        )
    }

    const forgeUrl = `/forge/${leagueSlug}/${divisionSlug}`

    const TRIGGER_LABELS = {
        fuel: 'Fueled', tutorial_fuel: 'Starter Spark', cool: 'Cooled',
        performance: 'Performance Update', init: 'Initial Price',
    }

    return (
        <div className="min-h-screen bg-(--color-primary) text-(--color-text) relative overflow-hidden">
            <Navbar title="Fantasy Forge" />
            <PageTitle title={`${player.playerName} — Fantasy Forge`} description={`${player.playerName}'s Spark profile in the Fantasy Forge`} />

            {/* Background ember canvas */}
            <canvas ref={bgCanvasRef} className="fixed inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }} />

            <ForgeToast message={toastMessage} onDone={() => setToastMessage(null)} />

            {/* Tutorial gate popup */}
            {tutorialCompleted === false && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={e => { if (e.target === e.currentTarget) navigate(forgeUrl) }}>
                    <div className="border border-[var(--forge-border)] p-6 w-full max-w-sm mx-4" style={{ background: 'linear-gradient(180deg, #1a1510, #0d0b08)', borderColor: 'var(--forge-edge)' }}>
                        <div className="text-center">
                            <img src={forgeLogo} alt="" className="w-32 h-32 object-contain mx-auto mb-4 forge-logo-glow" />
                            <h3 className="forge-head text-xl font-bold tracking-wider text-[var(--forge-flame-bright)] mb-2">Complete the Tutorial</h3>
                            <p className="forge-body text-[var(--forge-text-mid)] mb-5">
                                You need to complete the Forge tutorial before viewing player profiles. Head to the main Forge page to get started!
                            </p>
                            <button
                                onClick={() => navigate(forgeUrl)}
                                className="forge-clip-btn forge-btn-fuel forge-head text-base font-bold tracking-wider px-6 py-3 text-white w-full"
                                style={{ background: 'linear-gradient(135deg, var(--forge-flame), var(--forge-ember))', boxShadow: '0 4px 20px rgba(232,101,32,0.3)' }}
                            >
                                <Flame size={16} className="inline mr-2" />
                                Go to the Forge
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="relative" style={{ zIndex: 1 }}>
                <div className="max-w-[900px] mx-auto px-3 sm:px-5 pt-20 pb-20">

                    {/* Navigation */}
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-4">
                        <Link
                            to={forgeUrl}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--forge-panel)] border border-[var(--forge-border)] hover:border-[var(--forge-flame)]/30 text-[var(--forge-text-mid)] hover:text-[var(--forge-flame-bright)] transition-all forge-head text-[0.8rem] tracking-wider"
                        >
                            <Flame size={13} />
                            Market
                        </Link>
                        <Link
                            to={`${forgeUrl}/portfolio`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--forge-panel)] border border-[var(--forge-border)] hover:border-[var(--forge-flame)]/30 text-[var(--forge-text-mid)] hover:text-[var(--forge-flame-bright)] transition-all forge-head text-[0.8rem] tracking-wider"
                        >
                            <img src={sparkIcon} alt="" className="w-4 h-4 object-contain" />
                            My Sparks
                        </Link>
                        <Link
                            to={`${forgeUrl}/leaderboard`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--forge-panel)] border border-[var(--forge-border)] hover:border-[var(--forge-flame)]/30 text-[var(--forge-text-mid)] hover:text-[var(--forge-flame-bright)] transition-all forge-head text-[0.8rem] tracking-wider"
                        >
                            <Trophy size={13} />
                            Hall of Flame
                        </Link>
                        <Link
                            to={`${forgeUrl}/challenges`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--forge-panel)] border border-[var(--forge-border)] hover:border-[var(--forge-flame)]/30 text-[var(--forge-text-mid)] hover:text-[var(--forge-flame-bright)] transition-all forge-head text-[0.8rem] tracking-wider"
                        >
                            <Target size={13} />
                            Contracts
                        </Link>
                    </div>

                    {/* Hero banner */}
                    <ForgeHero
                        player={player}
                        historyData={historyData}
                        marketStatus={market?.status}
                        userTeamId={userTeamId}
                        isOwner={isOwner}
                        changeView={changeView}
                        seasonSlugs={{ leagueSlug, divisionSlug }}
                        onFuel={() => openTrade('fuel')}
                        onCool={() => openTrade('cool')}
                    />

                    {/* Badges + Holdings */}
                    {((!player.isConnected) || (player.isConnected && player.bestStreak > 9) || (player.holding?.sparks > 0)) && (
                        <div className="bg-[var(--forge-panel)] border border-[var(--forge-edge)] p-2.5 sm:p-3 -mt-2 mb-6 flex items-center gap-2 sm:gap-4 flex-wrap">
                            {!player.isConnected && (
                                <div className="flex items-center gap-1" title="Not connected to an account">
                                    <img src={passiontailsImg} alt="" className="w-5 h-5 object-contain opacity-40" />
                                    <span className="forge-head text-[0.65rem] font-bold tracking-widest text-[var(--forge-text-dim)] opacity-50">Passionless</span>
                                </div>
                            )}
                            {player.isConnected && player.bestStreak > 9 && (
                                <div className="flex items-center gap-1" title={`Coinflip streak: ${player.bestStreak}`}>
                                    <img src={passionCoin} alt="" className="w-5 h-5 object-contain forge-coinflip-badge" />
                                    <span className="forge-num text-[0.8rem] text-[var(--forge-gold-bright)]">{player.bestStreak}</span>
                                </div>
                            )}
                            {player.holding && player.holding.sparks > 0 && (
                                <div className="flex items-center gap-3 ml-auto">
                                    <span className="forge-head text-[0.75rem] font-semibold tracking-wider text-[var(--forge-gold)]">Your Holdings</span>
                                    <span className="forge-num text-[var(--forge-gold)]">
                                        <img src={sparkIcon} alt="" className="w-6 h-6 object-contain inline" /> {player.holding.sparks} Spark{player.holding.sparks !== 1 ? 's' : ''}
                                    </span>
                                    <span className="forge-num text-[var(--forge-gold-bright)]">
                                        <img src={passionCoin} alt="" className="w-4 h-4 inline mr-0.5" />
                                        {Math.round(player.currentPrice * player.holding.sparks).toLocaleString()}
                                    </span>
                                    {player.holding.tutorialSparks > 0 && (
                                        <span className="forge-head text-[0.65rem] font-semibold tracking-wider text-[var(--forge-flame)] bg-[var(--forge-flame)]/8 border border-[var(--forge-flame)]/15 px-1">
                                            {player.holding.tutorialSparks} free
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Price History Chart */}
                    {historyData.length >= 2 && (
                        <>
                            <div className="relative pb-1.5 mb-2 border-b border-[var(--forge-border)]">
                                <h2 className="forge-head text-base font-bold tracking-wider text-[var(--forge-text-mid)] flex items-center gap-2">
                                    <Zap size={14} className="text-[var(--forge-flame)]" />
                                    Price History
                                </h2>
                                <div className="forge-section-accent" />
                            </div>
                            <div className="forge-portfolio-chart mb-6">
                                <canvas ref={chartRef} onMouseMove={handleChartMove} onMouseLeave={() => setTooltip(null)} />
                                {tooltip && (
                                    <div className="forge-chart-tooltip" style={{
                                        left: Math.min(Math.max(tooltip.x, 60), chartRef.current?.parentElement?.offsetWidth - 60 || 9999),
                                        top: Math.max(tooltip.y - 48, 4),
                                    }}>
                                        <div className="forge-num text-sm text-[var(--forge-gold-bright)]">
                                            {Math.round(tooltip.worth).toLocaleString()} Heat
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
                                        {tooltip.createdAt && (
                                            <div className="text-[var(--forge-text-dim)] text-[0.65rem] mt-0.5 opacity-60">
                                                {new Date(tooltip.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
                                                    ' ' + new Date(tooltip.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                            </div>
                                        )}
                                    </div>
                                )}
                                {/* Chart legend */}
                                <div className="absolute bottom-1 right-2 flex items-center gap-3 text-[0.6rem] text-[var(--forge-text-dim)] forge-head tracking-wider">
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--forge-flame)]" /> Fuel</span>
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--forge-cool)]" /> Cool</span>
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--forge-gold)]" /> Perf</span>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Trade Modal */}
            {tradeModal && (
                <ForgeTradeModal
                    player={tradeModal.player}
                    mode={tradeModal.mode}
                    amount={tradeAmount}
                    setAmount={setTradeAmount}
                    balance={balance}
                    trading={trading}
                    result={tradeResult}
                    error={tradeError}
                    freeSparksRemaining={freeSparksRemaining}
                    referralSparksAvailable={referralSparksAvailable}
                    onExecute={executeTrade}
                    onFreeFuel={executeFreeFuel}
                    onReferralFuel={executeReferralFuel}
                    onClose={() => setTradeModal(null)}
                />
            )}
        </div>
    )
}

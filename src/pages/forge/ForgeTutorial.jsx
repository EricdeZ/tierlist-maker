import { useState, useEffect, useCallback, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Flame, Search } from 'lucide-react'
import { forgeService } from '../../services/database'
import sparkIcon from '../../assets/spark.png'
import forgeLogo from '../../assets/forge.png'

// ─── Step definitions ───
const STEPS = [
    {
        id: 'welcome',
        title: 'Welcome to the Forge',
        body: 'The Fantasy Forge is a player investment market. Fuel the players you believe in, and watch their value rise with demand and performance.',
        placement: 'center',
        btnText: "Let's Go",
    },
    {
        id: 'search',
        title: 'Find a Player to Invest In',
        placement: 'bottom',
        btnText: null, // Auto-advances when 1 eligible player remains
        interactive: true,
    },
    {
        id: 'player-card',
        title: 'Player Sparks',
        body: 'Each player has a Spark value driven by a bonding curve. The more Sparks people buy, the higher the price goes. The Performance multiplier adjusts based on how well they play.',
        placement: 'right',
        btnText: 'Got It',
    },
    {
        id: 'fuel-prompt',
        title: 'Your First Starter Spark',
        body: 'You get 3 free Starter Sparks! Click the Fuel button to invest your first one in this player. Starter Sparks can\'t be sold, but you\'ll keep any profit when the season ends.',
        placement: 'top',
        btnText: null,
        waitForFuel: true,
        interactive: true,
    },
    {
        id: 'fuel-result',
        title: 'Spark Fueled!',
        body: 'The price increased because you added a Spark. This is the bonding curve — each Spark purchased drives the price up for the next buyer. You have 2 Starter Sparks left to use on any player!',
        placement: 'right',
        btnText: 'Next',
    },
    {
        id: 'performance',
        title: 'Performance Influence',
        body: 'The Performance multiplier (Perf) adjusts weekly based on real match stats. Strong performers see their value climb; underperformers cool off. Skill drives prices, not just hype.',
        placement: 'bottom',
        btnText: 'Next',
    },
    {
        id: 'cooling',
        title: 'Cooling (Selling)',
        body: 'When you want to take profits, you Cool your Sparks. There is a 10% Cooling Tax on all sales — so timing matters. However, if you hold until the season ends, liquidation pays out at full value with no tax. Your free Starter Sparks can\'t be cooled, but Sparks you buy with Passion can.',
        placement: 'center',
        btnText: 'Next',
    },
    {
        id: 'complete',
        title: 'Tutorial Complete!',
        body: 'You\'re ready to trade! You have 2 Starter Sparks left — use them on any player from the market. Claim the "Forge Apprentice" challenge for 125 Passion to start buying with Passion too!',
        placement: 'center',
        btnText: 'Enter the Forge',
        isComplete: true,
    },
]

// ─── Dynamic target selector based on step + chosen player ───
function getStepTarget(stepId, tutorialPlayer) {
    const sparkId = tutorialPlayer?.sparkId
    switch (stepId) {
        case 'search':
            return '[data-tutorial="search-input"]'
        case 'player-card':
        case 'fuel-result':
            return sparkId ? `[data-spark-id="${sparkId}"]` : null
        case 'fuel-prompt':
            return sparkId ? `[data-spark-id="${sparkId}"] [data-tutorial="fuel-btn"]` : null
        case 'performance':
            return '[data-tutorial="hero-perf"]'
        default:
            return null
    }
}

// ─── Spotlight + Tooltip positioning ───
function useTargetRect(selector, active) {
    const [rect, setRect] = useState(null)
    const observerRef = useRef(null)

    useLayoutEffect(() => {
        if (!active || !selector) {
            setRect(null)
            return
        }

        const measure = () => {
            const el = document.querySelector(selector)
            if (el) {
                const r = el.getBoundingClientRect()
                setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
            } else {
                setRect(null)
            }
        }

        // Initial measurement with delay for DOM paint
        const timer = setTimeout(measure, 80)

        // Observe resizes
        const el = document.querySelector(selector)
        if (el) {
            observerRef.current = new ResizeObserver(measure)
            observerRef.current.observe(el)
        }

        window.addEventListener('scroll', measure, true)
        window.addEventListener('resize', measure)

        return () => {
            clearTimeout(timer)
            observerRef.current?.disconnect()
            window.removeEventListener('scroll', measure, true)
            window.removeEventListener('resize', measure)
        }
    }, [selector, active])

    return rect
}

function getTooltipStyle(placement, rect) {
    const pad = 16
    const isMobile = window.innerWidth < 768

    // Center placement (no target) — uses inset+margin instead of transform
    // because the tooltip-in animation overrides transform via fill-forwards
    if (!rect || placement === 'center') {
        return {
            position: 'fixed',
            inset: 0,
            margin: 'auto',
            maxWidth: '400px',
            width: '90vw',
            height: 'fit-content',
        }
    }

    const effectivePlacement = isMobile ? 'bottom' : placement

    switch (effectivePlacement) {
        case 'right':
            return {
                position: 'fixed',
                top: Math.max(pad, rect.top),
                left: rect.left + rect.width + pad,
                maxWidth: Math.min(360, window.innerWidth - rect.left - rect.width - pad * 2),
            }
        case 'left':
            return {
                position: 'fixed',
                top: Math.max(pad, rect.top),
                right: window.innerWidth - rect.left + pad,
                maxWidth: Math.min(360, rect.left - pad * 2),
            }
        case 'top':
            return {
                position: 'fixed',
                bottom: window.innerHeight - rect.top + pad,
                left: Math.max(pad, rect.left + rect.width / 2 - 180),
                maxWidth: '360px',
            }
        case 'bottom':
        default:
            return {
                position: 'fixed',
                top: rect.top + rect.height + pad,
                left: Math.max(pad, rect.left + rect.width / 2 - 180),
                maxWidth: '360px',
            }
    }
}

// ─── Overlay rendering helpers ───
// For interactive steps: 4 dark divs forming a frame with a clickable hole
// For non-interactive targeted steps: single cutout with box-shadow (blocks everything)
// For center steps: full dark overlay
const PAD = 6
const DARK = 'rgba(0,0,0,0.78)'

function InteractiveOverlay({ rect, showPulse }) {
    if (!rect) return <div className="absolute inset-0" style={{ backgroundColor: DARK }} />
    const t = rect.top - PAD
    const l = rect.left - PAD
    const w = rect.width + PAD * 2
    const h = rect.height + PAD * 2
    return (
        <>
            {/* Top */}
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: Math.max(0, t), background: DARK, pointerEvents: 'auto' }} />
            {/* Bottom */}
            <div style={{ position: 'fixed', top: t + h, left: 0, right: 0, bottom: 0, background: DARK, pointerEvents: 'auto' }} />
            {/* Left */}
            <div style={{ position: 'fixed', top: t, left: 0, width: Math.max(0, l), height: h, background: DARK, pointerEvents: 'auto' }} />
            {/* Right */}
            <div style={{ position: 'fixed', top: t, left: l + w, right: 0, height: h, background: DARK, pointerEvents: 'auto' }} />
            {/* Pulse ring (visual only, no pointer blocking) */}
            {showPulse && (
                <div
                    className="forge-tutorial-pulse"
                    style={{
                        position: 'fixed',
                        top: t,
                        left: l,
                        width: w,
                        height: h,
                        borderRadius: 6,
                        pointerEvents: 'none',
                    }}
                />
            )}
        </>
    )
}


// ─── Main Tutorial Component ───
export default function ForgeTutorial({
    players, seasonId, marketOpen, onTutorialFuel, onSelectFeatured, onComplete,
    search, setSearch, filteredPlayers, userTeamId, isOwner,
    isReplay, onReplayComplete,
}) {
    const [status, setStatus] = useState('loading') // loading | active | done
    const [step, setStep] = useState(0)
    const [fueling, setFueling] = useState(false)
    const [tutorialPlayer, setTutorialPlayer] = useState(null)

    const currentStep = STEPS[step]
    const isInteractive = currentStep?.interactive && status === 'active'
    const targetSelector = status === 'active' ? getStepTarget(currentStep?.id, tutorialPlayer) : null
    const targetRect = useTargetRect(targetSelector, status === 'active')

    // ── Block scroll while tutorial is active ──
    useEffect(() => {
        if (status !== 'active') return
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = '' }
    }, [status])

    // ── Check tutorial status on mount / handle replay ──
    useEffect(() => {
        if (isReplay) {
            setStep(0)
            setTutorialPlayer(null)
            setSearchLocked(false)
            setOwnTeamBlocked(false)
            setSearch('')
            setStatus('active')
            return
        }
        if (!seasonId) return
        let cancelled = false
        forgeService.getTutorialStatus(seasonId).then(data => {
            if (cancelled) return
            setStatus(data.completed ? 'done' : 'active')
        }).catch(() => {
            if (!cancelled) setStatus('done') // fail silently
        })
        return () => { cancelled = true }
    }, [seasonId, isReplay])

    // ── Monitor search results for step 1 (search) ──
    const [ownTeamBlocked, setOwnTeamBlocked] = useState(false)
    const [searchLocked, setSearchLocked] = useState(false) // lock search after match

    // Check if a player is on the user's team (applies to everyone, including owners)
    const isPlayerOwnTeam = useCallback((player) => {
        if (!userTeamId) return false
        return player.teamId === userTeamId
    }, [userTeamId])

    useEffect(() => {
        if (status !== 'active' || step !== 1) return
        if (!filteredPlayers || !search.trim()) {
            setOwnTeamBlocked(false)
            return
        }

        if (filteredPlayers.length === 1) {
            const player = filteredPlayers[0]
            if (isPlayerOwnTeam(player)) {
                setOwnTeamBlocked(true)
            } else {
                // Valid player found — lock search and advance
                setOwnTeamBlocked(false)
                setSearchLocked(true)
                setTutorialPlayer(player)
                const timer = setTimeout(() => setStep(2), 600)
                return () => clearTimeout(timer)
            }
        } else {
            setOwnTeamBlocked(false)
        }
    }, [status, step, filteredPlayers, search, isPlayerOwnTeam])

    // Lock the search input when a player is matched
    useEffect(() => {
        if (!searchLocked) return
        const input = document.querySelector('[data-tutorial="search-input"]')
        if (input) {
            input.setAttribute('readonly', '')
            return () => input.removeAttribute('readonly')
        }
    }, [searchLocked])

    // ── Handle "Fuel" click during fuel-prompt step ──
    const handleTutorialFuel = useCallback(async () => {
        if (fueling || !tutorialPlayer) return

        setFueling(true)
        try {
            const result = await forgeService.tutorialFuel(tutorialPlayer.sparkId)
            onTutorialFuel?.(tutorialPlayer, result)
            setTimeout(() => {
                setStep(4) // fuel-result
                setFueling(false)
            }, 1500)
        } catch (err) {
            console.error('Tutorial fuel failed:', err)
            setFueling(false)
            if (err.message?.includes('already completed')) {
                // Skip to fuel-result with existing data
                setStep(4)
            }
        }
    }, [tutorialPlayer, fueling, onTutorialFuel])

    // ── Force row expansion + fuel button visible during fuel-prompt step ──
    // ForgePlayerRow now has an expandable section with fuel/cool buttons
    // We force the row wrapper to expand so the user can click Fuel during the tutorial
    useEffect(() => {
        if (status !== 'active' || step !== 3) return
        if (!tutorialPlayer) return

        // Force the row wrapper to expand (shows the fuel button panel)
        const wrapper = document.querySelector(
            `[data-spark-id="${tutorialPlayer.sparkId}"]`
        )
        if (wrapper) {
            wrapper.classList.add('forge-row-force-expand')
        }

        // Also ensure the fuel button's container is visible
        const fuelBtn = document.querySelector(
            `[data-spark-id="${tutorialPlayer.sparkId}"] [data-tutorial="fuel-btn"]`
        )
        const container = fuelBtn?.parentElement
        if (container) {
            container.style.opacity = '1'
        }

        return () => {
            wrapper?.classList.remove('forge-row-force-expand')
            if (container) container.style.opacity = ''
        }
    }, [status, step, tutorialPlayer])

    // ── Listen for Fuel button click during fuel-prompt step ──
    useEffect(() => {
        if (status !== 'active' || step !== 3) return
        if (!tutorialPlayer) return

        const selector = `[data-spark-id="${tutorialPlayer.sparkId}"] [data-tutorial="fuel-btn"]`

        const handleClick = (e) => {
            const fuelBtn = e.target.closest(selector)
            if (fuelBtn) {
                e.preventDefault()
                e.stopPropagation()
                handleTutorialFuel()
            }
        }

        document.addEventListener('click', handleClick, true)
        return () => document.removeEventListener('click', handleClick, true)
    }, [status, step, tutorialPlayer, handleTutorialFuel])

    // ── During replay, skip the fuel step (already completed) ──
    useEffect(() => {
        if (status === 'active' && step === 3 && isReplay) {
            setStep(4) // Skip fuel-prompt, go to fuel-result
        }
    }, [status, step, isReplay])

    // ── Select the tutorial target as featured player on performance step ──
    useEffect(() => {
        if (status === 'active' && step === 5 && tutorialPlayer) {
            onSelectFeatured?.(tutorialPlayer)
        }
    }, [status, step, tutorialPlayer, onSelectFeatured])

    // ── Advance step ──
    const advance = () => {
        if (step < STEPS.length - 1) {
            setStep(step + 1)
        } else {
            finish()
        }
    }

    const finish = () => {
        setStatus('done')
        setSearchLocked(false)
        setSearch('')
        onComplete?.()
        if (isReplay) onReplayComplete?.()
    }

    const dismiss = () => {
        setStatus('done')
        setSearchLocked(false)
        setSearch('')
        if (isReplay) onReplayComplete?.()
    }

    // ── Render nothing if done/loading ──
    if (status === 'loading' || status === 'done') return null

    // ── Active tutorial overlay ──
    if (status !== 'active') return null

    const tooltipStyle = getTooltipStyle(currentStep.placement, targetRect)

    // Search step state
    const showOwnTeamWarning = currentStep?.id === 'search' && ownTeamBlocked

    const getSearchBody = () => {
        const base = 'Use the search bar to find a player you want to invest in. Type a name until only one player remains.'
        const teamNote = userTeamId ? ' You can\'t fuel players on your own team.' : ''
        if (!search.trim()) return base + teamNote
        const total = filteredPlayers?.length || 0
        if (total === 0) return 'No players found. Try a different search.'
        if (ownTeamBlocked) return 'Clear your search and try a player on a different team.'
        if (total > 1) return `${total} players match. Keep typing to narrow it down.`
        return base + teamNote
    }

    // Determine overlay approach
    const hasTarget = targetSelector && targetRect

    return createPortal(
        <div
            className="forge-tutorial-overlay fixed inset-0 z-[80]"
            style={{ pointerEvents: isInteractive ? 'none' : undefined }}
        >
            {/* Overlay: interactive steps use 4-div frame, others use cutout or full dark */}
            {isInteractive ? (
                <InteractiveOverlay rect={targetRect} showPulse={currentStep.waitForFuel} />
            ) : hasTarget ? (
                <>
                    <div className="absolute inset-0" style={{ backgroundColor: 'transparent' }} />
                    <div
                        className="forge-tutorial-cutout absolute"
                        style={{
                            top: targetRect.top - PAD,
                            left: targetRect.left - PAD,
                            width: targetRect.width + PAD * 2,
                            height: targetRect.height + PAD * 2,
                        }}
                    />
                </>
            ) : (
                <div className="absolute inset-0" style={{ backgroundColor: DARK }} />
            )}

            {/* Tooltip */}
            <div
                className="forge-tutorial-tooltip bg-[var(--color-primary)] border border-[var(--forge-flame)]/25 p-5 z-[81]"
                style={{ ...tooltipStyle, pointerEvents: 'auto' }}
            >
                {/* Top accent line */}
                <div
                    className="h-[2px] -mx-5 -mt-5 mb-4"
                    style={{ background: 'linear-gradient(90deg, var(--forge-flame), var(--forge-ember), transparent)' }}
                />

                {/* Step indicator */}
                <div className="forge-head text-[0.7rem] font-semibold tracking-[0.2em] text-[var(--forge-text-dim)] mb-2">
                    STEP {step + 1} OF {STEPS.length}
                </div>

                {/* Icon for welcome/complete */}
                {(currentStep.id === 'welcome' || currentStep.isComplete) && (
                    <div className="flex justify-center mb-3">
                        {currentStep.isComplete ? (
                            <img src={sparkIcon} alt="" className="w-16 h-16 object-contain" style={{ filter: 'drop-shadow(0 0 12px rgba(232,101,32,0.5))' }} />
                        ) : (
                            <img src={forgeLogo} alt="" className="w-12 h-12 object-contain forge-logo-glow" />
                        )}
                    </div>
                )}

                {/* Search icon for search step */}
                {currentStep.id === 'search' && (
                    <div className="flex justify-center mb-3">
                        <Search size={28} className="text-[var(--forge-flame)]" />
                    </div>
                )}

                {/* Title */}
                <h3 className="forge-head text-xl font-bold tracking-wider mb-2 text-[var(--forge-text)]">
                    {currentStep.title}
                </h3>

                {/* Body */}
                <p className="forge-body text-sm leading-relaxed text-[var(--forge-text-mid)] mb-4">
                    {currentStep.id === 'search' ? getSearchBody() : (
                        currentStep.id === 'fuel-result' && isReplay
                            ? 'When you Fuel a player, the bonding curve increases the price. Each Spark purchased drives the price up for the next buyer. Use your remaining Starter Sparks on any player!'
                            : currentStep.body
                    )}
                </p>

                {/* Own-team warning */}
                {showOwnTeamWarning && (
                    <div className="mb-4 px-3 py-2.5 bg-[var(--forge-loss)]/10 border border-[var(--forge-loss)]/25 text-sm">
                        <div className="forge-head text-[var(--forge-loss)] font-bold tracking-wider text-xs mb-1">
                            CAN'T FUEL THIS PLAYER
                        </div>
                        <div className="forge-body text-[var(--forge-text-mid)] leading-relaxed">
                            You can't fuel yourself or players on your own team. Clear your search and try a player on a rival team.
                        </div>
                    </div>
                )}

                {/* Fuel loading state */}
                {currentStep.waitForFuel && fueling && (
                    <div className="flex items-center gap-2 mb-4 text-[var(--forge-flame-bright)] forge-head text-sm tracking-wider">
                        <Flame size={14} className="animate-pulse" />
                        Fueling Starter Spark...
                    </div>
                )}

                {/* Action button */}
                {currentStep.btnText && (
                    <button
                        onClick={advance}
                        className={`w-full py-2.5 forge-head text-sm font-bold tracking-wider text-white forge-clip-btn ${
                            currentStep.isComplete ? 'text-base py-3' : ''
                        }`}
                        style={{
                            background: 'linear-gradient(135deg, var(--forge-flame), var(--forge-ember))',
                            boxShadow: '0 2px 12px rgba(232,101,32,0.25)',
                        }}
                    >
                        {currentStep.btnText}
                    </button>
                )}

                {/* Fuel prompt hint */}
                {currentStep.waitForFuel && !fueling && (
                    <div className="forge-body text-xs text-center text-[var(--forge-text-dim)] mt-1">
                        Click the <Flame size={11} className="inline text-[var(--forge-flame)]" /> Fuel button on the player card
                    </div>
                )}

                {/* Progress dots */}
                <div className="flex items-center justify-center gap-1.5 mt-4">
                    {STEPS.map((_, i) => (
                        <div
                            key={i}
                            className={`forge-tutorial-dot ${
                                i === step ? 'active' : i < step ? 'completed' : 'pending'
                            }`}
                        />
                    ))}
                </div>

                {/* Skip link */}
                {!currentStep.isComplete && (
                    <button
                        onClick={dismiss}
                        className="block mx-auto mt-3 forge-body text-xs text-[var(--forge-text-dim)] hover:text-[var(--forge-text-mid)] transition-colors"
                    >
                        Skip tutorial
                    </button>
                )}
            </div>
        </div>,
        document.body,
    )
}

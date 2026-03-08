import { useState, useCallback } from 'react'
import { forgeService } from '../../services/database'
import { fireBurst } from './forgeCanvas'

export default function useForgeTrade({
    market,
    refreshBalance,
    loadData,
    setFreeSparksRemaining,
    setReferralSparksAvailable,
    setToastMessage,
    fxCanvasRef,
    flashRef,
    containerRef,
}) {
    const [tradeModal, setTradeModal] = useState(null)
    const [tradeAmount, setTradeAmount] = useState(1)
    const [trading, setTrading] = useState(false)
    const [tradeResult, setTradeResult] = useState(null)
    const [tradeError, setTradeError] = useState(null)

    const triggerFuelSpectacle = useCallback((playerName, sparkCount) => {
        const isMobile = window.innerWidth < 640

        if (!isMobile && fxCanvasRef.current) {
            const cx = window.innerWidth / 2
            const cy = window.innerHeight / 2
            fireBurst(fxCanvasRef.current, cx, cy, 40)
        }

        if (!isMobile && flashRef.current) {
            flashRef.current.classList.add('active')
            setTimeout(() => flashRef.current?.classList.remove('active'), 150)
        }

        if (!isMobile && containerRef.current) {
            containerRef.current.classList.add('forge-shaking')
            setTimeout(() => containerRef.current?.classList.remove('forge-shaking'), 400)
        }

        const amount = sparkCount || tradeAmount
        setToastMessage(`Spark Fueled! +${amount} to ${playerName}`)
    }, [tradeAmount, fxCanvasRef, flashRef, containerRef, setToastMessage])

    const openTrade = useCallback((player, mode) => {
        if (mode === 'fuel' && market?.fuelingLocked) {
            setTradeModal({ player, mode })
            setTradeError('Fueling is currently locked')
            setTradeResult(null)
            return
        }
        if (mode === 'cool' && market?.coolingLocked) {
            setTradeModal({ player, mode })
            setTradeError('Cooling is currently locked')
            setTradeResult(null)
            return
        }
        setTradeModal({ player, mode })
        setTradeAmount(1)
        setTradeResult(null)
        setTradeError(null)
    }, [market])

    const executeTrade = useCallback(async () => {
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

            if (tradeModal.mode === 'fuel') {
                triggerFuelSpectacle(tradeModal.player.playerName)
            } else {
                setToastMessage(`Cooled ${tradeAmount} Spark${tradeAmount !== 1 ? 's' : ''} from ${tradeModal.player.playerName}`)
            }

            setTimeout(() => loadData(), 500)
        } catch (err) {
            setTradeError(err.message || 'Trade failed')
        } finally {
            setTrading(false)
        }
    }, [tradeModal, tradeAmount, refreshBalance, triggerFuelSpectacle, loadData, setToastMessage])

    const executeFreeFuel = useCallback(async (sparkId) => {
        setTrading(true)
        setTradeError(null)
        setTradeResult(null)

        try {
            const result = await forgeService.tutorialFuel(sparkId)
            if (result.freeSparksRemaining != null) setFreeSparksRemaining(result.freeSparksRemaining)
            setTradeResult({ ...result, isFreeSpark: true })
            triggerFuelSpectacle(tradeModal.player.playerName, 1)
            setTimeout(() => loadData(), 500)
        } catch (err) {
            setTradeError(err.message || 'Failed to use Starter Spark')
        } finally {
            setTrading(false)
        }
    }, [tradeModal, triggerFuelSpectacle, setFreeSparksRemaining, loadData])

    const executeReferralFuel = useCallback(async (sparkId) => {
        setTrading(true)
        setTradeError(null)
        setTradeResult(null)

        try {
            const result = await forgeService.referralFuel(sparkId)
            setReferralSparksAvailable(prev => Math.max(0, prev - 1))
            setTradeResult({ ...result, isReferralSpark: true })
            triggerFuelSpectacle(tradeModal.player.playerName, 1)
            setTimeout(() => loadData(), 500)
        } catch (err) {
            setTradeError(err.message || 'Failed to use Referral Spark')
        } finally {
            setTrading(false)
        }
    }, [tradeModal, triggerFuelSpectacle, setReferralSparksAvailable, loadData])

    const handleTutorialFuel = useCallback((player, result) => {
        triggerFuelSpectacle(player.playerName, result.sparks || 1)
        if (result.freeSparksRemaining != null) setFreeSparksRemaining(result.freeSparksRemaining)
        setTimeout(() => loadData(), 500)
    }, [triggerFuelSpectacle, setFreeSparksRemaining, loadData])

    const handleTutorialComplete = useCallback(() => {
        loadData()
    }, [loadData])

    return {
        tradeModal, setTradeModal,
        tradeAmount, setTradeAmount,
        trading, tradeResult, tradeError,
        openTrade, executeTrade,
        executeFreeFuel, executeReferralFuel,
        handleTutorialFuel, handleTutorialComplete,
    }
}

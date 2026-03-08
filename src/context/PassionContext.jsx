import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { passionService, emberService } from '../services/database'
import { getRank, getNextRank } from '../config/ranks'

const PassionContext = createContext(null)

export const PassionProvider = ({ children }) => {
    const { user, loading: authLoading } = useAuth()
    const location = useLocation()
    const [balance, setBalance] = useState(0)
    const [totalEarned, setTotalEarned] = useState(0)
    const [currentStreak, setCurrentStreak] = useState(0)
    const [longestStreak, setLongestStreak] = useState(0)
    const [canClaimDaily, setCanClaimDaily] = useState(false)
    const [lastDailyClaim, setLastDailyClaim] = useState(null)
    const [claimableCount, setClaimableCount] = useState(0)
    const [inDiscord, setInDiscord] = useState(false)
    const [loading, setLoading] = useState(true)
    const [rankUpInfo, setRankUpInfo] = useState(null)
    const [challengeNotifications, setChallengeNotifications] = useState([])
    const [ember, setEmber] = useState({ balance: 0, currentStreak: 0, canClaimDaily: false, lastDailyClaim: null })
    const initialLoadDone = useRef(false)

    const rank = getRank(totalEarned)
    const nextRank = getNextRank(totalEarned)

    const refreshBalance = useCallback(async () => {
        if (!user) return
        try {
            const data = await passionService.getBalance()
            setBalance(data.balance)
            setTotalEarned(data.totalEarned)
            setCurrentStreak(data.currentStreak)
            setLongestStreak(data.longestStreak)
            setCanClaimDaily(data.canClaimDaily)
            setLastDailyClaim(data.lastDailyClaim || null)
            setClaimableCount(data.claimableCount || 0)
            setInDiscord(!!data.inDiscord)
            if (data.ember) setEmber(data.ember)
        } catch (err) {
            console.error('Failed to fetch passion balance:', err)
        }
    }, [user])

    // Fetch balance when user logs in
    useEffect(() => {
        if (authLoading) return
        if (!user) {
            setBalance(0)
            setTotalEarned(0)
            setCurrentStreak(0)
            setLongestStreak(0)
            setCanClaimDaily(false)
            setLastDailyClaim(null)
            setClaimableCount(0)
            setInDiscord(false)
            setEmber({ balance: 0, currentStreak: 0, canClaimDaily: false, lastDailyClaim: null })
            setLoading(false)
            initialLoadDone.current = false
            return
        }

        setLoading(true)
        refreshBalance().finally(() => {
            setLoading(false)
            initialLoadDone.current = true
        })
    }, [user, authLoading, refreshBalance])

    // Refetch balance on route change (after initial load)
    useEffect(() => {
        if (!user || !initialLoadDone.current) return
        refreshBalance()
    }, [location.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

    const addChallengeNotification = useCallback((challenges) => {
        if (!challenges || challenges.length === 0) return
        const withIds = challenges.map(ch => ({ ...ch, notifId: Date.now() + Math.random() }))
        setChallengeNotifications(prev => [...prev, ...withIds])
    }, [])

    const dismissChallengeNotification = useCallback((notifId) => {
        setChallengeNotifications(prev => prev.filter(n => n.notifId !== notifId))
    }, [])

    const claimDaily = useCallback(async () => {
        if (!user) return null
        try {
            const result = await passionService.claimDaily()
            if (result.alreadyClaimed) return result

            setBalance(result.balance)
            setTotalEarned(result.totalEarned)
            setCurrentStreak(result.streak)
            setCanClaimDaily(false)

            if (result.rankedUp) {
                setRankUpInfo({ rank: result.rank })
            }

            if (result.newlyClaimable?.length > 0) {
                addChallengeNotification(result.newlyClaimable)
                setClaimableCount(prev => prev + result.newlyClaimable.length)
            }

            return result
        } catch (err) {
            console.error('Failed to claim daily:', err)
            return null
        }
    }, [user, addChallengeNotification])

    const claimEmberDaily = useCallback(async () => {
        if (!user) return null
        try {
            const result = await emberService.claimDaily()
            if (result.alreadyClaimed) return result
            setEmber(prev => ({
                ...prev,
                balance: result.balance,
                currentStreak: result.streak,
                canClaimDaily: false,
            }))
            return result
        } catch (err) {
            console.error('Failed to claim ember daily:', err)
            return null
        }
    }, [user])

    const trackAction = useCallback(async (type, referenceId = null) => {
        if (!user) return null
        try {
            const result = await passionService.earn(type, referenceId)
            if (result.newlyClaimable?.length > 0) {
                addChallengeNotification(result.newlyClaimable)
                setClaimableCount(prev => prev + result.newlyClaimable.length)
            }
            return result
        } catch (err) {
            console.error('Failed to track action:', err)
            return null
        }
    }, [user, addChallengeNotification])

    const updateFromClaim = useCallback((result) => {
        setBalance(result.balance)
        setTotalEarned(result.totalEarned)
        setClaimableCount(result.claimableCount ?? 0)
        if (result.rankedUp) {
            setRankUpInfo({ rank: result.rank })
        }
    }, [])

    const dismissRankUp = useCallback(() => setRankUpInfo(null), [])
    const triggerRankUp = useCallback((overrideRank = null) => setRankUpInfo({ overrideRank }), [])

    const value = useMemo(() => ({
        balance,
        totalEarned,
        currentStreak,
        longestStreak,
        canClaimDaily,
        lastDailyClaim,
        claimableCount,
        inDiscord,
        ember,
        rank,
        nextRank,
        loading,
        rankUpInfo,
        challengeNotifications,
        claimDaily,
        claimEmberDaily,
        trackAction,
        refreshBalance,
        updateFromClaim,
        dismissRankUp,
        triggerRankUp,
        addChallengeNotification,
        dismissChallengeNotification,
    }), [
        balance, totalEarned, currentStreak, longestStreak, canClaimDaily,
        lastDailyClaim, claimableCount, inDiscord, ember, rank, nextRank,
        loading, rankUpInfo, challengeNotifications, claimDaily, claimEmberDaily,
        trackAction, refreshBalance, updateFromClaim, dismissRankUp, triggerRankUp,
        addChallengeNotification, dismissChallengeNotification,
    ])

    return (
        <PassionContext.Provider value={value}>
            {children}
        </PassionContext.Provider>
    )
}

export const usePassion = () => {
    const ctx = useContext(PassionContext)
    if (ctx === null) {
        throw new Error('usePassion must be used within a PassionProvider')
    }
    return ctx
}

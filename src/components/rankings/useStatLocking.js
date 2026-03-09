import { useState, useCallback, useRef, useEffect } from 'react'
import { roles } from './constants'

export function useStatLocking({ rankings, setRankings, statsMap, teams, savedLockedStats, savedSelectedStat }) {
    const [selectedStat, setSelectedStat] = useState(savedSelectedStat || 'none')
    const [lockedStats, setLockedStats] = useState(savedLockedStats || {})
    const [applyAllOpen, setApplyAllOpen] = useState(false)
    const [applyPlacedOpen, setApplyPlacedOpen] = useState(false)
    const applyAllRef = useRef(null)
    const applyPlacedRef = useRef(null)

    // Close apply-all / apply-placed dropdowns on outside click
    useEffect(() => {
        if (!applyAllOpen && !applyPlacedOpen) return
        const handleClick = (e) => {
            if (applyAllOpen && applyAllRef.current && !applyAllRef.current.contains(e.target)) {
                setApplyAllOpen(false)
            }
            if (applyPlacedOpen && applyPlacedRef.current && !applyPlacedRef.current.contains(e.target)) {
                setApplyPlacedOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [applyAllOpen, applyPlacedOpen])

    const getStatValue = useCallback((playerName, statType) => {
        if (statType === 'none') return null
        const stats = statsMap.get(playerName)
        if (!stats) return null

        switch (statType) {
            case 'kda': return { value: stats.kda.toFixed(2), label: 'KDA' }
            case 'killsPerGame': return { value: stats.avgStats.avgKills.toFixed(1), label: 'K/G' }
            case 'deathsPerGame': return { value: stats.avgStats.avgDeaths.toFixed(1), label: 'D/G' }
            case 'assistsPerGame': return { value: stats.avgStats.avgAssists.toFixed(1), label: 'A/G' }
            case 'damagePerGame': return { value: Math.round(stats.avgStats.avgDamage).toLocaleString(), label: 'Dmg/G' }
            case 'mitigationsPerGame': return { value: Math.round(stats.avgStats.avgMitigated).toLocaleString(), label: 'Mit/G' }
            default: return null
        }
    }, [statsMap])

    const getNumericStatValue = useCallback((playerName, statType) => {
        const stats = statsMap.get(playerName)
        if (!stats) return -Infinity
        switch (statType) {
            case 'kda': return stats.kda
            case 'killsPerGame': return stats.avgStats.avgKills
            case 'deathsPerGame': return stats.avgStats.avgDeaths
            case 'assistsPerGame': return stats.avgStats.avgAssists
            case 'damagePerGame': return stats.avgStats.avgDamage
            case 'mitigationsPerGame': return stats.avgStats.avgMitigated
            default: return -Infinity
        }
    }, [statsMap])

    const lockPlayerStat = useCallback((playerName) => {
        if (selectedStat !== 'none' && !lockedStats[playerName]) {
            setLockedStats(prev => ({ ...prev, [playerName]: selectedStat }))
        }
    }, [selectedStat, lockedStats])

    const unlockPlayerStat = useCallback((playerName) => {
        setLockedStats(prev => {
            const updated = { ...prev }
            delete updated[playerName]
            return updated
        })
    }, [])

    const applyAllByStat = useCallback((statType) => {
        if (!teams || statType === 'none') return

        // Gather all players grouped by their primary role (skip players with 0 games)
        const byRole = { SOLO: [], JUNGLE: [], MID: [], SUPPORT: [], ADC: [] }
        for (const team of teams) {
            for (const p of team.playersWithRoles || []) {
                const role = p.role?.toUpperCase()
                if (role && byRole[role]) {
                    const stats = statsMap.get(p.name)
                    if (stats && stats.stats.gamesPlayed > 0) {
                        byRole[role].push(p.name)
                    }
                }
            }
        }

        // Sort each role group by the stat (deaths ascending, everything else descending)
        const ascending = statType === 'deathsPerGame'
        for (const role of roles) {
            byRole[role].sort((a, b) => {
                const va = getNumericStatValue(a, statType)
                const vb = getNumericStatValue(b, statType)
                return ascending ? va - vb : vb - va
            })
        }

        // Lock all players to this stat
        const newLocked = {}
        for (const role of roles) {
            for (const name of byRole[role]) {
                newLocked[name] = statType
            }
        }

        setRankings(byRole)
        setSelectedStat(statType)
        setLockedStats(newLocked)
        setApplyAllOpen(false)
    }, [teams, statsMap, getNumericStatValue, setRankings])

    const applyToPlacedByStat = useCallback((statType) => {
        if (statType === 'none') return

        const ascending = statType === 'deathsPerGame'
        const newRankings = {}
        const newLocked = { ...lockedStats }

        for (const role of roles) {
            const sorted = [...(rankings[role] || [])].sort((a, b) => {
                const va = getNumericStatValue(a, statType)
                const vb = getNumericStatValue(b, statType)
                return ascending ? va - vb : vb - va
            })
            newRankings[role] = sorted
            for (const name of sorted) {
                newLocked[name] = statType
            }
        }

        setRankings(newRankings)
        setSelectedStat(statType)
        setLockedStats(newLocked)
        setApplyPlacedOpen(false)
    }, [rankings, lockedStats, getNumericStatValue, setRankings])

    return {
        selectedStat,
        setSelectedStat,
        lockedStats,
        setLockedStats,
        applyAllOpen,
        setApplyAllOpen,
        applyPlacedOpen,
        setApplyPlacedOpen,
        applyAllRef,
        applyPlacedRef,
        lockPlayerStat,
        unlockPlayerStat,
        getStatValue,
        getNumericStatValue,
        applyAllByStat,
        applyToPlacedByStat,
    }
}

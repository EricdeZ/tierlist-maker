// src/components/DragDropRankings.jsx - Refactored to use DivisionContext
import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { FEATURE_FLAGS } from '../config/featureFlags'
import { exportRankingsAsImage } from '../utils/canvasExport'
import { getContrastColor } from '../utils/colorContrast'
import {
    saveRankingsToStorage,
    loadRankingsFromStorage,
    clearRankingsFromStorage
} from '../utils/localStorage'
import { useDivision } from '../context/DivisionContext'
import { usePlayerStats } from '../hooks/usePlayerStats'
import { usePassion } from '../context/PassionContext'
import TeamLogo from './TeamLogo'

// Import role images
import soloImage from '../assets/roles/solo.webp'
import jungleImage from '../assets/roles/jungle.webp'
import midImage from '../assets/roles/mid.webp'
import suppImage from '../assets/roles/supp.webp'
import adcImage from '../assets/roles/adc.webp'

const roles = ['SOLO', 'JUNGLE', 'MID', 'SUPPORT', 'ADC']

const roleImages = {
    'SOLO': soloImage,
    'JUNGLE': jungleImage,
    'MID': midImage,
    'SUPPORT': suppImage,
    'ADC': adcImage
}

const STAT_TYPES = [
    { key: 'none', label: 'No Stats', buttonLabel: 'No Stats' },
    { key: 'kda', label: 'KDA', buttonLabel: 'KDA' },
    { key: 'killsPerGame', label: 'K/G', buttonLabel: 'Kills / Game' },
    { key: 'deathsPerGame', label: 'D/G', buttonLabel: 'Deaths / Game' },
    { key: 'assistsPerGame', label: 'A/G', buttonLabel: 'Assists / Game' },
    { key: 'damagePerGame', label: 'Dmg/G', buttonLabel: 'Damage / Game' },
    { key: 'mitigationsPerGame', label: 'Mit/G', buttonLabel: 'Mitigations / Game' },
]

const DragDropRankings = ({ divisionSlug: propDivisionSlug } = {}) => {
    // Use DivisionContext instead of hardcoded hook
    const { teams: rawTeams, players: rawPlayers, league, division, season, loading, error } = useDivision()
    const { divisionSlug: routeSlug } = useParams()
    const divisionSlug = propDivisionSlug || routeSlug
    const { data: playerStatsData } = usePlayerStats()
    const { trackAction } = usePassion()

    const [isMobile, setIsMobile] = useState(false)
    const [mobileRole, setMobileRole] = useState('SOLO')
    const [spotlightPlayer, setSpotlightPlayer] = useState(null)
    const [spotlightPos, setSpotlightPos] = useState({ x: window.innerWidth - 260, y: 80 })
    const [isDraggingSpotlight, setIsDraggingSpotlight] = useState(false)
    const spotlightDragOffset = useRef({ x: 0, y: 0 })

    // Format teams to match the shape the component expects
    const teams = useMemo(() => {
        if (!rawTeams || !rawPlayers) return []

        return rawTeams.map(team => {
            const teamPlayers = rawPlayers
                .filter(p => p.team_id === team.id)
                .map(p => ({
                    name: p.name,
                    slug: p.slug,
                    role: p.role,
                    secondary_role: p.secondary_role
                }))

            return {
                id: team.slug,
                name: team.name,
                color: team.color,
                players: teamPlayers.map(p => p.name),
                playersWithRoles: teamPlayers
            }
        })
    }, [rawTeams, rawPlayers])

    // Build a lookup map from player name to stats
    const statsMap = useMemo(() => {
        const map = new Map()
        for (const p of playerStatsData) {
            map.set(p.name, p)
        }
        return map
    }, [playerStatsData])

    // Scope localStorage key by division so rankings don't bleed across divisions
    const storageKey = divisionSlug ? `tierlist-rankings-${divisionSlug}` : 'tierlist-rankings'

    // Load all saved state from localStorage in one read
    const [savedData] = useState(() => loadRankingsFromStorage(storageKey))

    const [rankings, setRankings] = useState(
        savedData?.rankings || { SOLO: [], JUNGLE: [], MID: [], SUPPORT: [], ADC: [] }
    )
    const [selectedStat, setSelectedStat] = useState(savedData?.selectedStat || 'none')
    // Locked stats: when a player is placed, we snapshot the current selectedStat
    const [lockedStats, setLockedStats] = useState(savedData?.playerStatOverrides || {})

    const [draggedItem, setDraggedItem] = useState(null)
    const [dragOverZone, setDragOverZone] = useState(null)
    const [dragOverIndex, setDragOverIndex] = useState(null)
    const [isExporting, setIsExporting] = useState(false)
    const [applyAllOpen, setApplyAllOpen] = useState(false)
    const applyAllRef = useRef(null)
    const [teamsPanelOpen, setTeamsPanelOpen] = useState(true)
    const [teamsPanelPosition, setTeamsPanelPosition] = useState('bottom') // 'bottom' | 'right'
    const [teamsPanelHeight, setTeamsPanelHeight] = useState(0)

    const rankingsRef = useRef(null)
    const teamsPanelRef = useRef(null)

    // Check for mobile/small screen
    useEffect(() => {
        const checkScreenSize = () => {
            setIsMobile(window.innerWidth < 800)
        }
        checkScreenSize()
        window.addEventListener('resize', checkScreenSize)
        return () => window.removeEventListener('resize', checkScreenSize)
    }, [])

    // Auto-save rankings to localStorage whenever rankings or stat prefs change
    const hasTrackedSave = useRef(false)
    useEffect(() => {
        const hasAnyRankings = Object.values(rankings).some(roleArray => roleArray.length > 0)
        if (hasAnyRankings || selectedStat !== 'none') {
            saveRankingsToStorage(rankings, storageKey, {
                selectedStat,
                playerStatOverrides: lockedStats,
            })
            // Track tier list save once per session for challenge progress
            if (hasAnyRankings && !hasTrackedSave.current) {
                hasTrackedSave.current = true
                trackAction('tier_list_save', storageKey)
            }
        }
    }, [rankings, storageKey, selectedStat, lockedStats, trackAction])

    // Cleanup drag state
    useEffect(() => {
        const handleDragEnd = () => {
            setDraggedItem(null)
            setDragOverZone(null)
            setDragOverIndex(null)
        }
        document.addEventListener('dragend', handleDragEnd)
        document.addEventListener('mouseup', handleDragEnd)
        return () => {
            document.removeEventListener('dragend', handleDragEnd)
            document.removeEventListener('mouseup', handleDragEnd)
        }
    }, [])

    // Auto-scroll when dragging near viewport edges
    useEffect(() => {
        const EDGE_ZONE = 80
        const SCROLL_SPEED = 12

        const onDragOver = (e) => {
            const y = e.clientY
            if (y < EDGE_ZONE) {
                window.scrollBy(0, -SCROLL_SPEED)
            } else if (y > window.innerHeight - EDGE_ZONE) {
                window.scrollBy(0, SCROLL_SPEED)
            }
        }

        window.addEventListener('dragover', onDragOver)
        return () => window.removeEventListener('dragover', onDragOver)
    }, [])

    // Spotlight modal dragging
    useEffect(() => {
        if (!isDraggingSpotlight) return

        const onMouseMove = (e) => {
            setSpotlightPos({
                x: Math.max(0, Math.min(window.innerWidth - 232, e.clientX - spotlightDragOffset.current.x)),
                y: Math.max(0, Math.min(window.innerHeight - 100, e.clientY - spotlightDragOffset.current.y)),
            })
        }
        const onMouseUp = () => setIsDraggingSpotlight(false)

        window.addEventListener('mousemove', onMouseMove)
        window.addEventListener('mouseup', onMouseUp)
        return () => {
            window.removeEventListener('mousemove', onMouseMove)
            window.removeEventListener('mouseup', onMouseUp)
        }
    }, [isDraggingSpotlight])

    // Measure floating panel height so we can pad the content to prevent overlap
    useEffect(() => {
        const panel = teamsPanelRef.current
        if (!panel || !teamsPanelOpen || teamsPanelPosition !== 'bottom') {
            setTeamsPanelHeight(0)
            return
        }

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setTeamsPanelHeight(entry.target.offsetHeight)
            }
        })

        // Set initial height
        setTeamsPanelHeight(panel.offsetHeight)
        observer.observe(panel)

        return () => observer.disconnect()
    }, [teamsPanelOpen, teamsPanelPosition])

    // Utility functions
    const getPlayerByName = (playerName) => {
        if (!teams) return null
        for (const team of teams) {
            const player = team.playersWithRoles?.find(p => p.name === playerName)
            if (player) return player
        }
        return null
    }

    const getPlayerRole = (playerName) => {
        const player = getPlayerByName(playerName)
        return player ? player.role : ''
    }

    const getPlayerTeamColor = (playerName) => {
        if (!teams) return '#6b7280'
        const team = teams.find(team => team.players.includes(playerName))
        return team ? team.color : '#6b7280'
    }

    const getPlayerTeamName = (playerName) => {
        if (!teams) return 'Unknown Team'
        const team = teams.find(team => team.players.includes(playerName))
        return team ? team.name : 'Unknown Team'
    }

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

    // Build a lookup from player name → slug for profile links
    const playerSlugMap = useMemo(() => {
        const map = new Map()
        if (!teams) return map
        for (const team of teams) {
            for (const p of team.playersWithRoles || []) {
                if (p.slug) map.set(p.name, p.slug)
            }
        }
        return map
    }, [teams])

    const applyAllByStat = useCallback((statType) => {
        if (!teams || statType === 'none') return

        // Gather all players grouped by their primary role
        const byRole = { SOLO: [], JUNGLE: [], MID: [], SUPPORT: [], ADC: [] }
        for (const team of teams) {
            for (const p of team.playersWithRoles || []) {
                const role = p.role?.toUpperCase()
                if (role && byRole[role]) {
                    byRole[role].push(p.name)
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
    }, [teams, getNumericStatValue])

    const [applyPlacedOpen, setApplyPlacedOpen] = useState(false)
    const applyPlacedRef = useRef(null)

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
    }, [rankings, lockedStats, getNumericStatValue])

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

    // Lock a player's stat at the current selectedStat when they're first placed
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

    // Compute set of all ranked players (used to hide from teams panel)
    const rankedPlayers = useMemo(() => new Set(Object.values(rankings).flat()), [rankings])

    // Loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-(--color-accent) mx-auto mb-4"></div>
                    <p className="text-(--color-text-secondary)">Loading league data...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-4 bg-red-900/30 border border-red-500/30 rounded-xl">
                <h3 className="font-bold text-red-400">Failed to Load Data</h3>
                <p className="text-red-300/80">{error}</p>
            </div>
        )
    }

    if (!league) {
        return (
            <div className="p-4 bg-yellow-900/30 border border-yellow-500/30 rounded-xl">
                <h3 className="font-bold text-yellow-400">League Not Found</h3>
                <p className="text-yellow-300/80">League not found in database.</p>
            </div>
        )
    }

    if (!teams || teams.length === 0) {
        return (
            <div className="p-4 bg-yellow-900/30 border border-yellow-500/30 rounded-xl">
                <h3 className="font-bold text-yellow-400">No Teams Found</h3>
                <p className="text-yellow-300/80">No teams found for this division.</p>
            </div>
        )
    }

    // --- Drag & Drop handlers ---
    const handleDragStart = (e, player, sourceTeam, sourceRole = null, sourceIndex = null) => {
        setSpotlightPlayer(player)
        setDraggedItem({
            player,
            sourceTeam,
            sourceRole,
            sourceIndex,
            type: sourceRole ? 'ranking' : 'team'
        })
        e.dataTransfer.effectAllowed = 'move'
    }

    const handleDragEnd = () => {
        setTimeout(() => {
            setDraggedItem(null)
            setDragOverZone(null)
            setDragOverIndex(null)
        }, 50)
    }

    const handleDragOver = (e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
    }

    const handleDragEnter = (e, role, index = null) => {
        e.preventDefault()
        setDragOverZone(role)
        setDragOverIndex(index)
    }

    const handleDragLeave = (e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
            setDragOverZone(null)
            setDragOverIndex(null)
        }
    }

    const handleDrop = (e, targetRole, targetIndex = null) => {
        e.preventDefault()
        setDragOverZone(null)
        setDragOverIndex(null)
        if (!draggedItem) return

        const { player, sourceRole, sourceIndex } = draggedItem

        if (sourceRole && targetRole) {
            if (sourceRole === targetRole) {
                if (sourceIndex === targetIndex) {
                    setDraggedItem(null)
                    return
                }
                setRankings(prev => {
                    const newList = [...prev[sourceRole]]
                    const [movedPlayer] = newList.splice(sourceIndex, 1)
                    const insertIndex = targetIndex !== null ? targetIndex : newList.length
                    newList.splice(insertIndex, 0, movedPlayer)
                    return { ...prev, [sourceRole]: newList }
                })
            } else {
                setRankings(prev => {
                    const sourceList = [...prev[sourceRole]]
                    sourceList.splice(sourceIndex, 1)
                    const targetList = [...prev[targetRole]]
                    const insertIndex = targetIndex !== null ? targetIndex : targetList.length
                    targetList.splice(insertIndex, 0, player)
                    return { ...prev, [sourceRole]: sourceList, [targetRole]: targetList }
                })
            }
        } else if (!sourceRole && targetRole) {
            // New placement from teams panel — lock the current stat
            lockPlayerStat(player)
            setRankings(prev => {
                const newList = [...prev[targetRole]]
                const insertIndex = targetIndex !== null ? targetIndex : newList.length
                newList.splice(insertIndex, 0, player)
                return { ...prev, [targetRole]: newList }
            })
        }

        setDraggedItem(null)
    }

    const removeFromRanking = (role, index) => {
        const player = rankings[role][index]
        setRankings(prev => ({
            ...prev,
            [role]: prev[role].filter((_, i) => i !== index)
        }))
        if (player) unlockPlayerStat(player)
    }

    const clearAllRankings = () => {
        setRankings({ SOLO: [], JUNGLE: [], MID: [], SUPPORT: [], ADC: [] })
        setLockedStats({})
        clearRankingsFromStorage(storageKey)
    }

    const exportAsImageHandler = async () => {
        setIsExporting(true)
        try {
            const hasAnyStats = Object.keys(lockedStats).length > 0
            const statInfo = hasAnyStats
                ? { lockedStats, getStatValue }
                : null
            const title = `${league.slug.toUpperCase()} Tierlist`
            const subtitle = division?.name ? `${division.name}${season ? ` \u2014 ${season.name}` : ''}` : undefined
            exportRankingsAsImage(rankings, teams, 'player-rankings', title, statInfo, subtitle)
        } finally {
            setTimeout(() => setIsExporting(false), 1000)
        }
    }

    const getDisplayRankings = (role) => {
        if (!draggedItem || dragOverZone !== role) return rankings[role]

        const { player, sourceRole, sourceIndex } = draggedItem

        if (!sourceRole) {
            const newList = [...rankings[role]]
            const insertIndex = dragOverIndex !== null ? dragOverIndex : newList.length
            newList.splice(insertIndex, 0, player)
            return newList
        }

        if (sourceRole === role) {
            const newList = [...rankings[role]]
            newList.splice(sourceIndex, 1)
            if (dragOverIndex !== null) {
                const adjustedIndex = dragOverIndex > sourceIndex ? dragOverIndex - 1 : dragOverIndex
                newList.splice(adjustedIndex, 0, player)
            } else {
                newList.push(player)
            }
            return newList
        } else {
            const newList = [...rankings[role]]
            const insertIndex = dragOverIndex !== null ? dragOverIndex : newList.length
            newList.splice(insertIndex, 0, player)
            return newList
        }
    }

    const addToMobileRanking = (player) => {
        lockPlayerStat(player)
        setRankings(prev => {
            // Prevent duplicates in the same role
            if (prev[mobileRole].includes(player)) return prev
            // Remove from any other role first
            const updated = { ...prev }
            for (const role of roles) {
                if (role !== mobileRole && updated[role].includes(player)) {
                    updated[role] = updated[role].filter(p => p !== player)
                }
            }
            return { ...updated, [mobileRole]: [...updated[mobileRole], player] }
        })
    }

    const removeFromMobileRanking = (role, index) => {
        const player = rankings[role][index]
        setRankings(prev => ({
            ...prev,
            [role]: prev[role].filter((_, i) => i !== index)
        }))
        if (player) unlockPlayerStat(player)
    }

    const moveMobileRanking = (role, index, direction) => {
        setRankings(prev => {
            const list = [...prev[role]]
            const newIndex = index + direction
            if (newIndex < 0 || newIndex >= list.length) return prev
            ;[list[index], list[newIndex]] = [list[newIndex], list[index]]
            return { ...prev, [role]: list }
        })
    }

    if (isMobile) {
        const currentRanking = rankings[mobileRole] || []

        return (
            <div className="px-3 py-4">
                <h2 className="text-lg font-bold text-(--color-text) mb-2 font-heading text-center">
                    {league.name} Tierlist
                </h2>

                {/* Stat selector */}
                <div className="flex gap-1 mb-3 overflow-x-auto">
                    {STAT_TYPES.map(st => (
                        <button
                            key={st.key}
                            onClick={() => setSelectedStat(st.key)}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex-shrink-0 transition-colors ${
                                selectedStat === st.key
                                    ? 'bg-(--color-accent) text-(--color-primary)'
                                    : 'bg-white/10 text-(--color-text-secondary) hover:bg-white/15'
                            }`}
                        >
                            {st.buttonLabel}
                        </button>
                    ))}
                </div>

                {/* Role tabs */}
                <div className="flex gap-1 mb-4 overflow-x-auto">
                    {roles.map(role => (
                        <button
                            key={role}
                            onClick={() => setMobileRole(role)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold flex-shrink-0 transition-colors ${
                                mobileRole === role
                                    ? 'bg-(--color-accent) text-(--color-primary)'
                                    : 'bg-white/10 text-(--color-text-secondary) hover:bg-white/15'
                            }`}
                        >
                            <img src={roleImages[role]} alt="" className="w-4 h-4 object-contain" />
                            {role}
                            {rankings[role].length > 0 && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                    mobileRole === role ? 'bg-white/20' : 'bg-white/10'
                                }`}>
                                    {rankings[role].length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Current ranking for selected role */}
                <div className="bg-(--color-secondary) rounded-xl border border-white/10 p-3 mb-4">
                    <h3 className="text-xs font-bold text-(--color-text-secondary) uppercase tracking-wider mb-2">
                        {mobileRole} Ranking
                    </h3>
                    {currentRanking.length === 0 ? (
                        <p className="text-sm text-(--color-text-secondary)/50 italic py-4 text-center">
                            Tap players below to add
                        </p>
                    ) : (
                        <div className="space-y-1.5">
                            {currentRanking.map((player, index) => {
                                const teamColor = getPlayerTeamColor(player)
                                const textColor = getContrastColor(teamColor)
                                const locked = lockedStats[player]
                                const stat = locked ? getStatValue(player, locked) : null
                                return (
                                    <div
                                        key={`${mobileRole}-${player}-${index}`}
                                        className="flex items-center gap-2 rounded-lg overflow-hidden"
                                        style={{ backgroundColor: teamColor, color: textColor }}
                                    >
                                        <span className="text-xs font-bold w-7 text-center flex-shrink-0 py-2 bg-black/10">
                                            {index + 1}
                                        </span>
                                        <span className="text-sm font-medium flex-1 py-2 min-w-0 truncate">{player}</span>
                                        {stat && (
                                            <span
                                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/20 flex-shrink-0"
                                                style={{ color: textColor }}
                                            >
                                                {stat.value} {stat.label}
                                            </span>
                                        )}
                                        <div className="flex items-center flex-shrink-0">
                                            <button
                                                onClick={() => moveMobileRanking(mobileRole, index, -1)}
                                                disabled={index === 0}
                                                className="px-2 py-2 text-xs disabled:opacity-20 hover:bg-white/10 transition-colors"
                                                style={{ color: textColor }}
                                            >
                                                ▲
                                            </button>
                                            <button
                                                onClick={() => moveMobileRanking(mobileRole, index, 1)}
                                                disabled={index === currentRanking.length - 1}
                                                className="px-2 py-2 text-xs disabled:opacity-20 hover:bg-white/10 transition-colors"
                                                style={{ color: textColor }}
                                            >
                                                ▼
                                            </button>
                                            <button
                                                onClick={() => removeFromMobileRanking(mobileRole, index)}
                                                className="px-2.5 py-2 text-xs hover:bg-white/10 transition-colors"
                                                style={{ color: textColor }}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Available players */}
                <div className="bg-(--color-secondary) rounded-xl border border-white/10 p-3 mb-4">
                    <h3 className="text-xs font-bold text-(--color-text-secondary) uppercase tracking-wider mb-2">
                        Available Players
                    </h3>
                    <div className="space-y-3">
                        {teams.map(team => {
                            const teamTextColor = getContrastColor(team.color)
                            const availablePlayers = team.players.filter(p => !rankedPlayers.has(p))
                            if (availablePlayers.length === 0) return null

                            return (
                                <div key={team.id}>
                                    <div
                                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded mb-1 flex items-center gap-1.5"
                                        style={{ backgroundColor: team.color, color: teamTextColor }}
                                    >
                                        <TeamLogo slug={team.id} name={team.name} size={14} />
                                        {team.name}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {availablePlayers.map(player => {
                                            const previewStat = getStatValue(player, selectedStat)
                                            return (
                                                <button
                                                    key={player}
                                                    onClick={() => addToMobileRanking(player)}
                                                    className="text-xs px-2.5 py-1.5 rounded font-medium transition-colors flex items-center gap-1.5 hover:opacity-80"
                                                    style={{ backgroundColor: team.color, color: teamTextColor }}
                                                >
                                                    <span>{player}</span>
                                                    {previewStat && (
                                                        <span className="text-[10px] opacity-75">{previewStat.value}</span>
                                                    )}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    <button
                        onClick={clearAllRankings}
                        className="flex-1 px-4 py-2.5 bg-white/10 text-(--color-text) rounded-lg text-sm font-medium hover:bg-white/20 transition-colors"
                    >
                        Clear All
                    </button>
                    <button
                        onClick={exportAsImageHandler}
                        disabled={isExporting}
                        className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                        style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-primary)' }}
                    >
                        {isExporting ? 'Exporting...' : 'Export Image'}
                    </button>
                </div>
            </div>
        )
    }

    // Dynamic bottom padding based on measured panel height
    const bottomPadding = teamsPanelOpen && teamsPanelPosition === 'bottom'
        ? `${Math.max(teamsPanelHeight, 200) + 16}px`
        : undefined

    return (
        <div className="relative" style={{ paddingBottom: bottomPadding }}>
            {/* Custom scrollbar styles for the teams panel */}
            <style>{`
                .teams-panel-scroll::-webkit-scrollbar {
                    height: 8px;
                }
                .teams-panel-scroll::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 4px;
                }
                .teams-panel-scroll::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.15);
                    border-radius: 4px;
                }
                .teams-panel-scroll::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.25);
                }
                /* Firefox */
                .teams-panel-scroll {
                    scrollbar-width: thin;
                    scrollbar-color: rgba(255, 255, 255, 0.15) rgba(255, 255, 255, 0.05);
                }
            `}</style>

            {/* Rankings Container */}
            <div ref={rankingsRef} className="rankings-container mb-6 bg-(--color-secondary) p-6 rounded-xl border border-white/10">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-(--color-text) font-heading">
                        {league.slug.toUpperCase()} Tierlist
                    </h2>
                    <p className="text-sm text-(--color-text-secondary) mt-1">
                        {division?.name}{season ? ` \u2014 ${season.name}` : ''}
                    </p>
                </div>

                {/* Ranking Grid */}
                <div className="grid grid-cols-5 gap-4 mb-4"
                     style={{
                         transition: 'padding 0.2s',
                     }}
                >
                    {roles.map(role => (
                        <div
                            key={role}
                            className="bg-(--color-primary) rounded-lg shadow-lg flex flex-col min-h-96"
                            onDragOver={handleDragOver}
                            onDragEnter={(e) => handleDragEnter(e, role)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, role)}
                        >
                            <div className="text-lg font-semibold text-(--color-text) bg-white/5 py-3 rounded-t flex items-center justify-center gap-2">
                                <img src={roleImages[role]} alt='' className="w-6 h-6 object-contain" />
                                <span>{role}</span>
                            </div>
                            <div className={`p-2 rounded border-2 border-transparent transition-colors grow min-h-90 ${
                                dragOverZone === role ? 'bg-blue-900/20 border-blue-400/30' : ''
                            }`}>
                                {getDisplayRankings(role).map((player, index) => {
                                    const teamColor = getPlayerTeamColor(player)
                                    const textColor = getContrastColor(teamColor)
                                    const isDraggedItem = draggedItem && draggedItem.player === player
                                    const isOriginalPosition = draggedItem &&
                                        draggedItem.sourceRole === role &&
                                        draggedItem.sourceIndex === index &&
                                        rankings[role][index] === player
                                    const locked = lockedStats[player]
                                    const stat = locked ? getStatValue(player, locked) : null

                                    return (
                                        <div key={`${role}-${player}-${index}`}>
                                            <div
                                                className="h-3 -mb-1"
                                                onDragOver={handleDragOver}
                                                onDragEnter={(e) => {
                                                    e.stopPropagation()
                                                    handleDragEnter(e, role, index)
                                                }}
                                                onDrop={(e) => {
                                                    e.stopPropagation()
                                                    handleDrop(e, role, index)
                                                }}
                                            />
                                            <div
                                                className={`px-2.5 py-2 rounded shadow cursor-move border group hover:shadow-md transition-all ${
                                                    isDraggedItem && isOriginalPosition ? 'opacity-30' :
                                                        isDraggedItem && draggedItem.sourceRole !== role ? 'opacity-70 scale-95' : ''
                                                }`}
                                                style={{ backgroundColor: teamColor, borderColor: teamColor, color: textColor }}
                                                draggable
                                                onMouseDown={() => setSpotlightPlayer(player)}
                                                onDragStart={(e) => handleDragStart(e, player, null, role, index)}
                                                onDragEnd={handleDragEnd}
                                                onDragOver={handleDragOver}
                                                onDragEnter={(e) => {
                                                    e.stopPropagation()
                                                    handleDragEnter(e, role, index)
                                                }}
                                                onDrop={(e) => {
                                                    e.stopPropagation()
                                                    handleDrop(e, role, index)
                                                }}
                                                title={`${player} (${getPlayerTeamName(player)})`}
                                            >
                                                <div className="flex justify-between items-center gap-1">
                                                    <span className="text-sm font-medium truncate min-w-0">{player}</span>
                                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                                        {stat && (
                                                            <span className="text-[10px] font-bold opacity-75 tabular-nums whitespace-nowrap">
                                                                {stat.value} <span className="font-medium opacity-80">{stat.label}</span>
                                                            </span>
                                                        )}
                                                        <button
                                                            onClick={() => removeFromRanking(role, index)}
                                                            className="opacity-0 group-hover:opacity-100 text-sm transition-opacity"
                                                            style={{ color: textColor }}
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}

                                <div
                                    className="h-3"
                                    onDragOver={handleDragOver}
                                    onDragEnter={(e) => {
                                        e.stopPropagation()
                                        handleDragEnter(e, role, getDisplayRankings(role).length)
                                    }}
                                    onDrop={(e) => {
                                        e.stopPropagation()
                                        handleDrop(e, role, getDisplayRankings(role).length)
                                    }}
                                />

                                {getDisplayRankings(role).length === 0 && (
                                    <div className="text-(--color-text-secondary) text-center py-8 text-sm italic">
                                        Drop players here
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Watermark */}
                <div className="text-center">
                    <span className="text-[11px] text-(--color-text-secondary)/30 font-medium tracking-wide">Created on smitecomp.com</span>
                </div>
            </div>

            {/* Floating Teams Panel - Toggle Button (visible when panel is closed) */}
            {!teamsPanelOpen && (
                <button
                    onClick={() => setTeamsPanelOpen(true)}
                    className="fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg font-semibold text-sm shadow-lg transition-all hover:scale-105"
                    style={{
                        backgroundColor: 'var(--color-accent)',
                        color: 'var(--color-primary)',
                    }}
                >
                    Show Teams
                </button>
            )}

            {/* Floating Teams Panel - Bottom */}
            {teamsPanelOpen && teamsPanelPosition === 'bottom' && (
                <div
                    ref={teamsPanelRef}
                    className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10"
                    style={{
                        backgroundColor: 'var(--color-secondary)',
                        boxShadow: '0 -4px 30px rgba(0,0,0,0.5)',
                    }}
                >
                    {/* Panel header */}
                    <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/5 gap-2">
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                            {STAT_TYPES.map(st => (
                                <button
                                    key={st.key}
                                    onClick={() => setSelectedStat(st.key)}
                                    className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                                        selectedStat === st.key
                                            ? 'bg-(--color-accent) text-(--color-primary)'
                                            : 'bg-white/10 text-(--color-text-secondary) hover:bg-white/15'
                                    }`}
                                >
                                    {st.buttonLabel}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                            <div ref={applyAllRef} className="relative">
                                <button
                                    onClick={() => setApplyAllOpen(prev => !prev)}
                                    className="px-2.5 py-1 rounded text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 transition-colors"
                                >
                                    Apply All
                                </button>
                                {applyAllOpen && (
                                    <div className="absolute bottom-full mb-1 right-0 bg-(--color-primary) border border-white/15 rounded-lg shadow-xl overflow-hidden min-w-36 z-50">
                                        <div className="px-3 py-1.5 text-[10px] font-bold text-(--color-text-secondary) uppercase tracking-wider border-b border-white/10">
                                            Sort all by stat
                                        </div>
                                        {STAT_TYPES.filter(st => st.key !== 'none').map(st => (
                                            <button
                                                key={st.key}
                                                onClick={() => applyAllByStat(st.key)}
                                                className="w-full text-left px-3 py-2 text-xs text-(--color-text) hover:bg-white/10 transition-colors"
                                            >
                                                {st.buttonLabel}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div ref={applyPlacedRef} className="relative">
                                <button
                                    onClick={() => setApplyPlacedOpen(prev => !prev)}
                                    className="px-2.5 py-1 rounded text-xs font-semibold bg-blue-600/60 text-white hover:bg-blue-500/60 transition-colors"
                                >
                                    Re-sort Placed
                                </button>
                                {applyPlacedOpen && (
                                    <div className="absolute bottom-full mb-1 right-0 bg-(--color-primary) border border-white/15 rounded-lg shadow-xl overflow-hidden min-w-36 z-50">
                                        <div className="px-3 py-1.5 text-[10px] font-bold text-(--color-text-secondary) uppercase tracking-wider border-b border-white/10">
                                            Re-sort placed by
                                        </div>
                                        {STAT_TYPES.filter(st => st.key !== 'none').map(st => (
                                            <button
                                                key={st.key}
                                                onClick={() => applyToPlacedByStat(st.key)}
                                                className="w-full text-left px-3 py-2 text-xs text-(--color-text) hover:bg-white/10 transition-colors"
                                            >
                                                {st.buttonLabel}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={clearAllRankings}
                                className="px-2.5 py-1 rounded text-xs font-medium bg-white/10 text-(--color-text-secondary) hover:bg-white/20 transition-colors"
                            >
                                Clear
                            </button>
                            <button
                                onClick={exportAsImageHandler}
                                disabled={isExporting}
                                className="px-2.5 py-1 rounded text-xs font-semibold transition-colors disabled:opacity-50"
                                style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-primary)' }}
                            >
                                {isExporting ? '...' : 'Export'}
                            </button>
                            <button
                                onClick={() => setTeamsPanelPosition('right')}
                                className="px-2 py-1 rounded text-xs font-medium bg-white/10 text-(--color-text-secondary) hover:bg-white/20 transition-colors"
                            >
                                Dock Right
                            </button>
                            <button
                                onClick={() => setTeamsPanelOpen(false)}
                                className="px-2 py-1 rounded text-xs font-medium bg-white/10 text-(--color-text-secondary) hover:bg-white/20 transition-colors"
                            >
                                Hide
                            </button>
                        </div>
                    </div>
                    {/* Horizontally scrollable team cards */}
                    <div className="teams-panel-scroll overflow-x-auto overflow-y-hidden px-4 py-3">
                        <div className="flex gap-4" style={{ minWidth: 'fit-content' }}>
                            {teams.map(team => {
                                const teamTextColor = getContrastColor(team.color)
                                const available = team.players.filter(p => !rankedPlayers.has(p))
                                if (available.length === 0) return null
                                return (
                                    <div key={team.id} className="flex-shrink-0 rounded-lg border border-white/10 p-3" style={{ width: '14rem', backgroundColor: 'var(--color-primary)' }}>
                                        <h4
                                            className="text-xs font-bold text-center py-1.5 px-2 rounded mb-2 truncate flex items-center justify-center gap-1.5"
                                            style={{ backgroundColor: team.color, color: teamTextColor }}
                                            title={team.name}
                                        >
                                            <TeamLogo slug={team.id} name={team.name} size={16} />
                                            {team.name}
                                        </h4>
                                        <div className="space-y-1">
                                            {available.map((player, index) => {
                                                const playerRole = getPlayerRole(player)
                                                const roleImage = playerRole ? roleImages[playerRole.toUpperCase()] : null
                                                const previewStat = getStatValue(player, selectedStat)

                                                return (
                                                    <div
                                                        key={`${team.id}-${player}-${index}`}
                                                        className="p-1.5 rounded cursor-move text-xs hover:opacity-80 transition-opacity flex items-center justify-between gap-1"
                                                        style={{ backgroundColor: team.color, color: teamTextColor }}
                                                        draggable
                                                        onDragStart={(e) => handleDragStart(e, player, team.id)}
                                                        onDragEnd={handleDragEnd}
                                                    >
                                                        <span className="truncate">{player}</span>
                                                        <div className="flex items-center gap-1 flex-shrink-0">
                                                            {previewStat && (
                                                                <span className="text-[10px] opacity-75">{previewStat.value}</span>
                                                            )}
                                                            {roleImage && (
                                                                <img src={roleImage} alt={playerRole} className="w-4 h-4 object-contain" />
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Draggable Player Spotlight */}
            {spotlightPlayer && (() => {
                const sp = statsMap.get(spotlightPlayer)
                if (!sp) return null
                const teamColor = getPlayerTeamColor(spotlightPlayer)
                const textColor = getContrastColor(teamColor)
                const playerRole = getPlayerRole(spotlightPlayer)
                const roleImage = playerRole ? roleImages[playerRole.toUpperCase()] : null
                const statRows = [
                    { label: 'KDA', value: sp.kda.toFixed(2) },
                    { label: 'K/G', value: sp.avgStats.avgKills.toFixed(1) },
                    { label: 'D/G', value: sp.avgStats.avgDeaths.toFixed(1) },
                    { label: 'A/G', value: sp.avgStats.avgAssists.toFixed(1) },
                    { label: 'Dmg/G', value: Math.round(sp.avgStats.avgDamage).toLocaleString() },
                    { label: 'Mit/G', value: Math.round(sp.avgStats.avgMitigated).toLocaleString() },
                    { label: 'Games', value: sp.stats.gamesPlayed },
                    { label: 'Win %', value: `${sp.winRate.toFixed(0)}%` },
                ]
                return (
                    <div
                        className="fixed z-30 rounded-xl border border-white/10 overflow-hidden shadow-xl select-none"
                        style={{
                            width: '14.5rem',
                            backgroundColor: 'var(--color-secondary)',
                            left: `${spotlightPos.x}px`,
                            top: `${spotlightPos.y}px`,
                        }}
                    >
                        {/* Drag handle + player header */}
                        <div
                            className="px-3 py-2.5 flex items-center gap-2"
                            style={{
                                backgroundColor: teamColor,
                                color: textColor,
                                cursor: isDraggingSpotlight ? 'grabbing' : 'grab',
                            }}
                            onMouseDown={(e) => {
                                e.preventDefault()
                                spotlightDragOffset.current = {
                                    x: e.clientX - spotlightPos.x,
                                    y: e.clientY - spotlightPos.y,
                                }
                                setIsDraggingSpotlight(true)
                            }}
                        >
                            {/* Drag grip indicator */}
                            <div className="flex flex-col gap-[2px] flex-shrink-0 opacity-40 mr-0.5">
                                <div className="flex gap-[2px]"><span className="w-[3px] h-[3px] rounded-full bg-current" /><span className="w-[3px] h-[3px] rounded-full bg-current" /></div>
                                <div className="flex gap-[2px]"><span className="w-[3px] h-[3px] rounded-full bg-current" /><span className="w-[3px] h-[3px] rounded-full bg-current" /></div>
                                <div className="flex gap-[2px]"><span className="w-[3px] h-[3px] rounded-full bg-current" /><span className="w-[3px] h-[3px] rounded-full bg-current" /></div>
                            </div>
                            {roleImage && (
                                <img src={roleImage} alt={playerRole} className="w-5 h-5 object-contain flex-shrink-0 opacity-80" />
                            )}
                            <div className="min-w-0 flex-1">
                                <div className="font-bold text-sm truncate">{spotlightPlayer}</div>
                                <div className="text-[10px] opacity-75">{getPlayerTeamName(spotlightPlayer)}</div>
                            </div>
                            <button
                                onClick={() => setSpotlightPlayer(null)}
                                className="text-xs opacity-50 hover:opacity-100 transition-opacity flex-shrink-0"
                                style={{ color: textColor }}
                            >
                                ✕
                            </button>
                        </div>
                        {/* Stats */}
                        <div className="px-3 py-2">
                            {statRows.map(row => (
                                <div key={row.label} className="flex justify-between items-center py-1 border-b border-white/5 last:border-0">
                                    <span className="text-[11px] text-(--color-text-secondary)">{row.label}</span>
                                    <span className="text-[11px] font-bold text-(--color-text) tabular-nums">{row.value}</span>
                                </div>
                            ))}
                        </div>
                        {/* Profile link */}
                        {playerSlugMap.get(spotlightPlayer) && (
                            <div className="px-3 pb-2">
                                <Link
                                    to={`/${league.slug}/${division?.slug}/players/${playerSlugMap.get(spotlightPlayer)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block text-center text-[11px] font-semibold py-1.5 rounded bg-white/10 text-(--color-accent) hover:bg-white/15 transition-colors"
                                >
                                    View Profile
                                </Link>
                            </div>
                        )}
                    </div>
                )
            })()}

            {/* Floating Teams Panel - Right */}
            {teamsPanelOpen && teamsPanelPosition === 'right' && (
                <div
                    className="fixed top-0 right-0 bottom-0 z-40 border-l border-white/10 overflow-y-auto teams-panel-scroll"
                    style={{
                        width: '13rem',
                        backgroundColor: 'var(--color-secondary)',
                        boxShadow: '-4px 0 30px rgba(0,0,0,0.5)',
                    }}
                >
                    {/* Panel header */}
                    <div className="px-3 py-2 border-b border-white/10 bg-white/5 sticky top-0 z-10 space-y-2" style={{ backgroundColor: 'var(--color-secondary)' }}>
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-(--color-text) font-heading">Teams</h3>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setTeamsPanelPosition('bottom')}
                                    className="px-2 py-1 rounded text-xs font-medium bg-white/10 text-(--color-text-secondary) hover:bg-white/20 transition-colors"
                                    title="Dock to bottom"
                                >
                                    ↓
                                </button>
                                <button
                                    onClick={() => setTeamsPanelOpen(false)}
                                    className="px-2 py-1 rounded text-xs font-medium bg-white/10 text-(--color-text-secondary) hover:bg-white/20 transition-colors"
                                    title="Hide panel"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {STAT_TYPES.map(st => (
                                <button
                                    key={st.key}
                                    onClick={() => setSelectedStat(st.key)}
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                                        selectedStat === st.key
                                            ? 'bg-(--color-accent) text-(--color-primary)'
                                            : 'bg-white/10 text-(--color-text-secondary) hover:bg-white/15'
                                    }`}
                                >
                                    {st.buttonLabel}
                                </button>
                            ))}
                        </div>
                        <div className="relative" ref={applyAllRef}>
                            <button
                                onClick={() => setApplyAllOpen(prev => !prev)}
                                className="w-full px-2 py-1 rounded text-[10px] font-semibold bg-blue-600 text-white hover:bg-blue-500 transition-colors"
                            >
                                Apply All
                            </button>
                            {applyAllOpen && (
                                <div className="absolute top-full mt-1 left-0 right-0 bg-(--color-primary) border border-white/15 rounded-lg shadow-xl overflow-hidden z-50">
                                    <div className="px-2 py-1 text-[9px] font-bold text-(--color-text-secondary) uppercase tracking-wider border-b border-white/10">
                                        Sort all by stat
                                    </div>
                                    {STAT_TYPES.filter(st => st.key !== 'none').map(st => (
                                        <button
                                            key={st.key}
                                            onClick={() => applyAllByStat(st.key)}
                                            className="w-full text-left px-2 py-1.5 text-[10px] text-(--color-text) hover:bg-white/10 transition-colors"
                                        >
                                            {st.buttonLabel}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="relative" ref={applyPlacedRef}>
                            <button
                                onClick={() => setApplyPlacedOpen(prev => !prev)}
                                className="w-full px-2 py-1 rounded text-[10px] font-semibold bg-blue-600/60 text-white hover:bg-blue-500/60 transition-colors"
                            >
                                Re-sort Placed
                            </button>
                            {applyPlacedOpen && (
                                <div className="absolute top-full mt-1 left-0 right-0 bg-(--color-primary) border border-white/15 rounded-lg shadow-xl overflow-hidden z-50">
                                    <div className="px-2 py-1 text-[9px] font-bold text-(--color-text-secondary) uppercase tracking-wider border-b border-white/10">
                                        Re-sort placed by
                                    </div>
                                    {STAT_TYPES.filter(st => st.key !== 'none').map(st => (
                                        <button
                                            key={st.key}
                                            onClick={() => applyToPlacedByStat(st.key)}
                                            className="w-full text-left px-2 py-1.5 text-[10px] text-(--color-text) hover:bg-white/10 transition-colors"
                                        >
                                            {st.buttonLabel}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex gap-1">
                            <button
                                onClick={clearAllRankings}
                                className="flex-1 px-2 py-1 rounded text-[10px] font-medium bg-white/10 text-(--color-text-secondary) hover:bg-white/20 transition-colors"
                            >
                                Clear
                            </button>
                            <button
                                onClick={exportAsImageHandler}
                                disabled={isExporting}
                                className="flex-1 px-2 py-1 rounded text-[10px] font-semibold transition-colors disabled:opacity-50"
                                style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-primary)' }}
                            >
                                {isExporting ? '...' : 'Export'}
                            </button>
                        </div>
                    </div>
                    {/* Vertically scrollable team cards */}
                    <div className="p-3 space-y-3">
                        {teams.map(team => {
                            const teamTextColor = getContrastColor(team.color)
                            const available = team.players.filter(p => !rankedPlayers.has(p))
                            if (available.length === 0) return null
                            return (
                                <div key={team.id} className="rounded-lg border border-white/10 p-2" style={{ backgroundColor: 'var(--color-primary)' }}>
                                    <h4
                                        className="text-xs font-bold text-center py-1.5 px-2 rounded mb-2 truncate flex items-center justify-center gap-1.5"
                                        style={{ backgroundColor: team.color, color: teamTextColor }}
                                        title={team.name}
                                    >
                                        <TeamLogo slug={team.id} name={team.name} size={16} />
                                        {team.name}
                                    </h4>
                                    <div className="space-y-1">
                                        {available.map((player, index) => {
                                            const playerRole = getPlayerRole(player)
                                            const roleImage = playerRole ? roleImages[playerRole.toUpperCase()] : null
                                            const previewStat = getStatValue(player, selectedStat)

                                            return (
                                                <div
                                                    key={`${team.id}-${player}-${index}`}
                                                    className="p-1.5 rounded cursor-move text-xs hover:opacity-80 transition-opacity flex items-center justify-between gap-1"
                                                    style={{ backgroundColor: team.color, color: teamTextColor }}
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e, player, team.id)}
                                                    onDragEnd={handleDragEnd}
                                                >
                                                    <span className="truncate">{player}</span>
                                                    <div className="flex items-center gap-1 flex-shrink-0">
                                                        {previewStat && (
                                                            <span className="text-[10px] opacity-75">{previewStat.value}</span>
                                                        )}
                                                        {roleImage && (
                                                            <img src={roleImage} alt={playerRole} className="w-4 h-4 object-contain" />
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}

export default DragDropRankings
// src/components/DragDropRankings.jsx - Refactored to use DivisionContext
import { useState, useRef, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { FEATURE_FLAGS } from '../config/featureFlags'
import { useImageExport } from '../hooks/useImageExport'
import { exportRankingsAsImage } from '../utils/canvasExport'
import {
    saveRankingsToStorage,
    loadRankingsFromStorage,
    clearRankingsFromStorage
} from '../utils/localStorage'
import { useDivision } from '../context/DivisionContext'

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

const DragDropRankings = () => {
    // Use DivisionContext instead of hardcoded hook
    const { teams: rawTeams, players: rawPlayers, league, loading, error } = useDivision()
    const { divisionSlug } = useParams()

    const [isMobile, setIsMobile] = useState(false)

    // Format teams to match the shape the component expects
    const teams = useMemo(() => {
        if (!rawTeams || !rawPlayers) return []

        return rawTeams.map(team => {
            const teamPlayers = rawPlayers
                .filter(p => p.team_id === team.id)
                .map(p => ({
                    name: p.name,
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

    // Scope localStorage key by division so rankings don't bleed across divisions
    const storageKey = divisionSlug ? `tierlist-rankings-${divisionSlug}` : 'tierlist-rankings'

    // Initialize rankings with localStorage data if available
    const [rankings, setRankings] = useState(() => {
        const savedRankings = loadRankingsFromStorage(storageKey)
        return savedRankings || {
            SOLO: [],
            JUNGLE: [],
            MID: [],
            SUPPORT: [],
            ADC: []
        }
    })

    const [draggedItem, setDraggedItem] = useState(null)
    const [dragOverZone, setDragOverZone] = useState(null)
    const [dragOverIndex, setDragOverIndex] = useState(null)
    const [isExporting, setIsExporting] = useState(false)

    const rankingsRef = useRef(null)
    const { exportAsImage } = useImageExport()

    // Check for mobile/small screen
    useEffect(() => {
        const checkScreenSize = () => {
            setIsMobile(window.innerWidth < 800)
        }
        checkScreenSize()
        window.addEventListener('resize', checkScreenSize)
        return () => window.removeEventListener('resize', checkScreenSize)
    }, [])

    // Auto-save rankings to localStorage whenever rankings change
    useEffect(() => {
        const hasAnyRankings = Object.values(rankings).some(roleArray => roleArray.length > 0)
        if (hasAnyRankings) {
            saveRankingsToStorage(rankings, storageKey)
        }
    }, [rankings, storageKey])

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

    // --- Drag & Drop handlers (unchanged) ---
    const handleDragStart = (e, player, sourceTeam, sourceRole = null, sourceIndex = null) => {
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
        setRankings(prev => ({
            ...prev,
            [role]: prev[role].filter((_, i) => i !== index)
        }))
    }

    const clearAllRankings = () => {
        setRankings({ SOLO: [], JUNGLE: [], MID: [], SUPPORT: [], ADC: [] })
        clearRankingsFromStorage(storageKey)
    }

    const exportRankingsJSON = () => {
        const data = { rankings, timestamp: new Date().toISOString() }
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'rankings.json'
        a.click()
        URL.revokeObjectURL(url)
    }

    const exportAsImageHandler = async () => {
        setIsExporting(true)
        try {
            exportRankingsAsImage(rankings, teams, 'player-rankings')
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

    if (isMobile) {
        return (
            <div>
                <div className="absolute inset-0 top-13 bg-(--color-primary)/95 backdrop-blur-sm z-50 flex border-t border-white/10">
                    <div className="text-center p-8 max-w-sm mx-auto">
                        <div className="text-6xl mb-4">📱</div>
                        <h3 className="text-xl font-semibold text-(--color-text) mb-3">Desktop Only</h3>
                        <p className="text-(--color-text-secondary) mb-4">
                            The drag-and-drop ranking feature is only available on desktop browsers with screens wider than 800px.
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="relative">
            {/* Rankings Container */}
            <div ref={rankingsRef} className="rankings-container mb-6 bg-(--color-secondary) p-6 rounded-xl border border-white/10">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-(--color-text) mb-2 font-heading">
                        {league.name} Tierlist
                    </h2>
                </div>

                {/* Ranking Grid */}
                <div className="grid grid-cols-5 gap-4 mb-8">
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
                                    const isDraggedItem = draggedItem && draggedItem.player === player
                                    const isOriginalPosition = draggedItem &&
                                        draggedItem.sourceRole === role &&
                                        draggedItem.sourceIndex === index &&
                                        rankings[role][index] === player

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
                                                className={`p-3 rounded shadow cursor-move border group hover:shadow-md transition-all ${
                                                    isDraggedItem && isOriginalPosition ? 'opacity-30' :
                                                        isDraggedItem && draggedItem.sourceRole !== role ? 'opacity-70 scale-95' : ''
                                                }`}
                                                style={{ backgroundColor: teamColor, borderColor: teamColor }}
                                                draggable
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
                                                <div className="flex justify-between items-center">
                                                    <span className="text-white text-sm font-medium">{player}</span>
                                                    <button
                                                        onClick={() => removeFromRanking(role, index)}
                                                        className="opacity-0 group-hover:opacity-100 text-white hover:text-red-200 text-sm transition-opacity ml-2 flex-shrink-0"
                                                    >
                                                        ✕
                                                    </button>
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

                {FEATURE_FLAGS.ENABLE_EXPORT_IMPORT && (
                    <div className="export-controls flex justify-center gap-4">
                        <button
                            onClick={clearAllRankings}
                            className="px-6 py-2 bg-white/10 text-(--color-text) rounded-lg hover:bg-white/20 transition-colors"
                        >
                            Clear All
                        </button>
                    </div>
                )}
            </div>

            {/* Teams Section */}
            <div className="bg-(--color-secondary) rounded-xl border border-white/10 p-6">
                <h2 className="text-2xl font-bold text-(--color-text) text-center mb-6 font-heading">Teams</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {teams.map(team => (
                        <div key={team.id} className="bg-(--color-primary) rounded-lg border border-white/10 p-4">
                            <h3
                                className="text-lg font-semibold text-center py-2 px-3 rounded text-white mb-3"
                                style={{ backgroundColor: team.color }}
                            >
                                {team.name}
                            </h3>
                            <div className="space-y-2">
                                {team.players.map((player, index) => {
                                    const playerRole = getPlayerRole(player)
                                    const roleImage = playerRole ? roleImages[playerRole.toUpperCase()] : null

                                    return (
                                        <div
                                            key={`${team.id}-${player}-${index}`}
                                            className="p-2 rounded cursor-move text-sm text-white hover:opacity-80 transition-opacity flex items-center justify-between"
                                            style={{ backgroundColor: team.color }}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, player, team.id)}
                                            onDragEnd={handleDragEnd}
                                        >
                                            <span>{player}</span>
                                            {roleImage && (
                                                <img src={roleImage} alt={playerRole} className="w-6 h-6 object-contain flex-shrink-0" />
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default DragDropRankings
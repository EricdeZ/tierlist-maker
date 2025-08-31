// src/components/DragDropRankings.jsx - Fixed version
import { useState, useRef, useEffect } from 'react'
import teamsData from '../data/teams.json'
import playersData from '../data/players.json'
import { FEATURE_FLAGS } from '../config/featureFlags'
import { useImageExport } from '../hooks/useImageExport'
import { exportRankingsAsImage } from '../utils/canvasExport'
import {
    saveRankingsToStorage,
    loadRankingsFromStorage,
    clearRankingsFromStorage
} from '../utils/localStorage'

// Import role images
import soloImage from '../assets/roles/solo.webp'
import jungleImage from '../assets/roles/jungle.webp'
import midImage from '../assets/roles/mid.webp'
import suppImage from '../assets/roles/supp.webp'
import adcImage from '../assets/roles/adc.webp'

const roles = ['SOLO', 'JUNGLE', 'MID', 'SUPPORT', 'ADC']

// Role image mapping
const roleImages = {
    'SOLO': soloImage,
    'JUNGLE': jungleImage,
    'MID': midImage,
    'SUPPORT': suppImage,
    'ADC': adcImage
}

// Utility functions for player data
const getPlayerByName = (playerName) => {
    return playersData.find(p => p.name === playerName)
}

const getPlayerRole = (playerName) => {
    const player = getPlayerByName(playerName)
    return player ? player.role.toUpperCase() : ''
}

const getPlayerTracker = (playerName) => {
    const player = getPlayerByName(playerName)
    return player ? player.tracker : ''
}

const getPlayerTeamColor = (playerName, teams) => {
    const team = teams.find(team => team.players.includes(playerName))
    return team ? team.color : '#6b7280'
}

const getPlayerTeamName = (playerName, teams) => {
    const team = teams.find(team => team.players.includes(playerName))
    return team ? team.name : 'Unknown Team'
}

const DragDropRankings = () => {
    const [teams] = useState(teamsData)
    const [isMobile, setIsMobile] = useState(false)

    // Initialize rankings with localStorage data if available
    const [rankings, setRankings] = useState(() => {
        const savedRankings = loadRankingsFromStorage()
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

    // Ref for the rankings container to export as image
    const rankingsRef = useRef(null)
    const { exportAsImage } = useImageExport()

    // Check for mobile/small screen
    useEffect(() => {
        const checkScreenSize = () => {
            setIsMobile(window.innerWidth < 800)
        }

        // Check initial size
        checkScreenSize()

        // Add resize listener
        window.addEventListener('resize', checkScreenSize)

        // Cleanup
        return () => window.removeEventListener('resize', checkScreenSize)
    }, [])

    // Auto-save rankings to localStorage whenever rankings change
    useEffect(() => {
        // Only save if there are actually some rankings (avoid saving empty initial state)
        const hasAnyRankings = Object.values(rankings).some(roleArray => roleArray.length > 0)
        if (hasAnyRankings) {
            saveRankingsToStorage(rankings)
        }
    }, [rankings])

    // FIXED: Add cleanup effect to reset drag state
    useEffect(() => {
        const handleDragEnd = () => {
            setDraggedItem(null)
            setDragOverZone(null)
            setDragOverIndex(null)
        }

        // Listen for dragend events on the document to catch failed drags
        document.addEventListener('dragend', handleDragEnd)

        // Also listen for mouse up events as a fallback
        document.addEventListener('mouseup', handleDragEnd)

        return () => {
            document.removeEventListener('dragend', handleDragEnd)
            document.removeEventListener('mouseup', handleDragEnd)
        }
    }, [])

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

    // FIXED: Add dragend handler to clear state
    const handleDragEnd = (e) => {
        // Small delay to allow drop to complete if successful
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

        // FIXED: Clear drag state immediately on successful drop
        setDragOverZone(null)
        setDragOverIndex(null)

        if (!draggedItem) return

        const { player, sourceRole, sourceIndex } = draggedItem

        if (sourceRole && targetRole) {
            // Moving within or between ranking columns
            if (sourceRole === targetRole) {
                // Same column reordering
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
                // Between different columns
                setRankings(prev => {
                    const sourceList = [...prev[sourceRole]]
                    sourceList.splice(sourceIndex, 1)

                    const targetList = [...prev[targetRole]]
                    const insertIndex = targetIndex !== null ? targetIndex : targetList.length
                    targetList.splice(insertIndex, 0, player)

                    return {
                        ...prev,
                        [sourceRole]: sourceList,
                        [targetRole]: targetList
                    }
                })
            }
        } else if (!sourceRole && targetRole) {
            // From teams to rankings - use specific position if provided
            setRankings(prev => {
                const newList = [...prev[targetRole]]
                const insertIndex = targetIndex !== null ? targetIndex : newList.length
                newList.splice(insertIndex, 0, player)
                return {
                    ...prev,
                    [targetRole]: newList
                }
            })
        }

        // FIXED: Clear drag state after successful drop
        setDraggedItem(null)
    }

    const removeFromRanking = (role, index) => {
        setRankings(prev => ({
            ...prev,
            [role]: prev[role].filter((_, i) => i !== index)
        }))
    }

    const clearAllRankings = () => {
        setRankings({
            SOLO: [],
            JUNGLE: [],
            MID: [],
            SUPPORT: [],
            ADC: []
        })
        // Clear from localStorage when user explicitly clears all
        clearRankingsFromStorage()
    }

    const exportRankings = () => {
        const data = {
            rankings,
            timestamp: new Date().toISOString()
        }
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
            console.log('Using canvas export for better Tailwind 4.x compatibility')
            exportRankingsAsImage(rankings, teams, 'player-rankings')
        } finally {
            setTimeout(() => setIsExporting(false), 1000)
        }
    }

    // FIXED: Improved display rankings logic
    const getDisplayRankings = (role) => {
        // If no drag in progress, return actual rankings
        if (!draggedItem || dragOverZone !== role) {
            return rankings[role]
        }

        const { player, sourceRole, sourceIndex } = draggedItem

        // If dragging from teams, show the player inserted at hover position
        if (!sourceRole) {
            const newList = [...rankings[role]]
            const insertIndex = dragOverIndex !== null ? dragOverIndex : newList.length
            newList.splice(insertIndex, 0, player)
            return newList
        }

        // If dragging within rankings, show live shuffle
        if (sourceRole === role) {
            // Same column - show reordered list
            const newList = [...rankings[role]]
            newList.splice(sourceIndex, 1) // Remove from original position

            // Find where to insert based on drag position
            if (dragOverIndex !== null) {
                const adjustedIndex = dragOverIndex > sourceIndex ? dragOverIndex - 1 : dragOverIndex
                newList.splice(adjustedIndex, 0, player)
            } else {
                newList.push(player) // Add to end if no specific index
            }
            return newList
        } else {
            // Between columns - add at hover position
            const newList = [...rankings[role]]
            const insertIndex = dragOverIndex !== null ? dragOverIndex : newList.length
            newList.splice(insertIndex, 0, player)
            return newList
        }
    }

    if(isMobile) {
        return (
            <div className={` ${FEATURE_FLAGS.COMPACT_MODE ? '' : ''}`}>
                <div className="absolute inset-0 top-13 bg-white bg-opacity-95 backdrop-blur-sm z-50 flex border-t-1 ">
                    <div className="text-center p-8 max-w-sm mx-auto">
                        <div className="text-6xl mb-4">📱</div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-3">
                            Desktop Only
                        </h3>
                        <p className="text-gray-600 mb-4">
                            The drag-and-drop ranking feature is only available on desktop browsers with screens wider than 800px.
                        </p>
                        <p className="text-sm text-gray-500">
                            Please use a desktop to access this feature.
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className={`relative ${FEATURE_FLAGS.COMPACT_MODE ? 'space-y-4' : ''}`}>
            {/* Rankings Container */}
            <div ref={rankingsRef} className="rankings-container mb-6 bg-gray-50 p-6 rounded-lg">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Ishtar Tierlist</h2>
                </div>

                {/* Ranking Grid */}
                <div className="grid grid-cols-5 gap-4 mb-8">
                    {roles.map(role => (
                        <div
                            key={role}
                            className={`bg-white rounded-lg shadow-lg flex flex-col ${
                                FEATURE_FLAGS.COMPACT_MODE ? 'min-h-64' : 'min-h-96'
                            }`}
                            onDragOver={handleDragOver}
                            onDragEnter={(e) => handleDragEnter(e, role)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, role)}
                        >
                            <div className={`text-lg font-semibold text-gray-900 bg-gray-100 py-3 rounded-t flex items-center justify-center gap-2 ${
                                FEATURE_FLAGS.COMPACT_MODE ? 'mb-0' : 'mb-0'
                            }`}>
                                <img
                                    src={roleImages[role]}
                                    alt={role}
                                    className="w-6 h-6 object-contain"
                                />
                                <span>{role}</span>
                            </div>
                            <div className={`p-2 rounded border-2 border-none transition-colors grow ${
                                FEATURE_FLAGS.COMPACT_MODE ? 'min-h-48' : 'min-h-90'
                            } ${dragOverZone === role ? 'bg-blue-100 border-blue-400' : 'border-gray-300'}`}>
                                {getDisplayRankings(role).map((player, index) => {
                                    const teamColor = getPlayerTeamColor(player, teams)
                                    const isDraggedItem = draggedItem && draggedItem.player === player
                                    // FIXED: More precise check for original position
                                    const isOriginalPosition = draggedItem &&
                                        draggedItem.sourceRole === role &&
                                        draggedItem.sourceIndex === index &&
                                        rankings[role][index] === player

                                    return (
                                        <div key={`${role}-${player}-${index}`}>
                                            {/* Drop zone above each item */}
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
                                                style={{
                                                    backgroundColor: teamColor,
                                                    borderColor: teamColor,
                                                }}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, player, null, role, index)}
                                                onDragEnd={handleDragEnd} // FIXED: Add dragend handler
                                                onDragOver={handleDragOver}
                                                onDragEnter={(e) => {
                                                    e.stopPropagation()
                                                    handleDragEnter(e, role, index)
                                                }}
                                                onDrop={(e) => {
                                                    e.stopPropagation()
                                                    handleDrop(e, role, index)
                                                }}
                                                title={`${player} (${getPlayerTeamName(player, teams)})`}
                                            >
                                                <div className="flex justify-between items-center">
                                                    <span className="text-white text-sm font-medium">
                                                        {player}
                                                    </span>
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

                                {/* Drop zone at the end for last position */}
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
                                    <div className="text-gray-500 text-center py-8 text-sm italic">
                                        Drop players here
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                {/* Header Controls */}
                {FEATURE_FLAGS.ENABLE_EXPORT_IMPORT && (
                    <div className="export-controls flex justify-center gap-4">
                        <button
                            onClick={clearAllRankings}
                            className="px-6 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors"
                            title="Clear all rankings and saved progress"
                        >
                            Clear All
                        </button>
                    </div>
                )}
            </div>

            {/* Teams Section - source for dragging */}
            <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className={`text-2xl font-bold text-gray-900 text-center ${
                    FEATURE_FLAGS.COMPACT_MODE ? 'mb-4' : 'mb-6'
                }`}>
                    Teams
                </h2>
                <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 ${
                    FEATURE_FLAGS.COMPACT_MODE ? 'gap-4' : 'gap-6'
                }`}>
                    {teams.map(team => (
                        <div
                            key={team.id}
                            className="bg-white rounded-lg border border-gray-300 p-4"
                        >
                            <h3
                                className={`text-lg font-semibold text-center py-2 px-3 rounded text-white ${
                                    FEATURE_FLAGS.COMPACT_MODE ? 'mb-2' : 'mb-3'
                                }`}
                                style={{ backgroundColor: team.color }}
                            >
                                {team.name}
                            </h3>
                            <div className="space-y-2">
                                {team.players.map((player, index) => {
                                    const playerRole = getPlayerRole(player)
                                    const roleImage = playerRole ? roleImages[playerRole] : null

                                    return (
                                        <div
                                            key={`${team.id}-${player}-${index}`}
                                            className="p-2 rounded cursor-move text-sm text-white hover:opacity-80 transition-opacity flex items-center justify-between"
                                            style={{ backgroundColor: team.color }}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, player, team.id)}
                                            onDragEnd={handleDragEnd} // FIXED: Add dragend handler
                                        >
                                            <span>{player}</span>
                                            {roleImage && (
                                                <img
                                                    src={roleImage}
                                                    alt={playerRole}
                                                    className="w-6 h-6 object-contain flex-shrink-0"
                                                />
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Instructions */}
            {FEATURE_FLAGS.SHOW_INSTRUCTIONS && (
                <div className="bg-white rounded-lg p-6 shadow-lg">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">How to Use:</h3>
                    <ul className="text-gray-600 text-sm space-y-1">
                        <li>• Drag players from teams to role columns to rank them</li>
                        <li>• Reorder players within columns by dragging them to different positions</li>
                        <li>• Move players between role columns by dragging</li>
                        <li>• Click the ✕ button to remove players from rankings</li>
                        <li>• Your rankings are automatically saved and will be restored when you return</li>
                        {FEATURE_FLAGS.ENABLE_EXPORT_IMPORT && (
                            <>
                                <li>• Use "Clear All" to reset all rankings and delete saved progress</li>
                                <li>• Use "Export JSON" to download your rankings as JSON</li>
                                <li>• Use "Export as Image" to download your rankings as PNG</li>
                            </>
                        )}
                    </ul>
                </div>
            )}
        </div>
    )
}

export default DragDropRankings
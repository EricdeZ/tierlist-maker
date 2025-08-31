// src/components/DragDropRankings.jsx - Updated to use database
import { useState, useRef, useEffect } from 'react'
import { FEATURE_FLAGS } from '../config/featureFlags'
import { useImageExport } from '../hooks/useImageExport'
import { exportRankingsAsImage } from '../utils/canvasExport'
import {
    saveRankingsToStorage,
    loadRankingsFromStorage,
    clearRankingsFromStorage
} from '../utils/localStorage'
import { useBabylonLeague, useTeamsLegacyFormat } from '../hooks/useDatabase'

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

const DragDropRankings = () => {
    // Use database hooks instead of JSON imports
    const { league, loading: leagueLoading, error: leagueError, leagueId } = useBabylonLeague()
    const { data: teams, loading: teamsLoading, error: teamsError } = useTeamsLegacyFormat(leagueId)

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

        checkScreenSize()
        window.addEventListener('resize', checkScreenSize)
        return () => window.removeEventListener('resize', checkScreenSize)
    }, [])

    // Auto-save rankings to localStorage whenever rankings change
    useEffect(() => {
        const hasAnyRankings = Object.values(rankings).some(roleArray => roleArray.length > 0)
        if (hasAnyRankings) {
            saveRankingsToStorage(rankings)
        }
    }, [rankings])

    // Cleanup effect to reset drag state
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

    // Utility functions - now work with database data
    const getPlayerByName = (playerName) => {
        if (!teams) return null

        for (const team of teams) {
            const player = team.players.find(p => p === playerName)
            if (player) {
                // Return player info - we'll need to enhance this later
                return { name: player }
            }
        }
        return null
    }

    const getPlayerRole = (playerName) => {
        // This will need to be updated when we have proper player role data from database
        // For now, return empty string as fallback
        return ''
    }

    const getPlayerTeamColor = (playerName, teams) => {
        if (!teams) return '#6b7280'

        const team = teams.find(team => team.players.includes(playerName))
        return team ? team.color : '#6b7280'
    }

    const getPlayerTeamName = (playerName, teams) => {
        if (!teams) return 'Unknown Team'

        const team = teams.find(team => team.players.includes(playerName))
        return team ? team.name : 'Unknown Team'
    }

    // Loading states
    if (leagueLoading || teamsLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading league data...</p>
                </div>
            </div>
        )
    }

    // Error states
    if (leagueError || teamsError) {
        return (
            <div className="p-4 bg-red-100 rounded mb-4">
                <h3 className="font-bold text-red-800">Failed to Load Data</h3>
                <p className="text-red-600">
                    {leagueError || teamsError}
                </p>
                <p className="text-sm text-red-500 mt-2">
                    Check your database connection and API functions.
                </p>
            </div>
        )
    }

    // No league found
    if (!league) {
        return (
            <div className="p-4 bg-yellow-100 rounded mb-4">
                <h3 className="font-bold text-yellow-800">League Not Found</h3>
                <p className="text-yellow-600">
                    Babylon League not found in database. Please check your data migration.
                </p>
            </div>
        )
    }

    // No teams data
    if (!teams || teams.length === 0) {
        return (
            <div className="p-4 bg-yellow-100 rounded mb-4">
                <h3 className="font-bold text-yellow-800">No Teams Found</h3>
                <p className="text-yellow-600">
                    No teams found for {league.name}. Please check your team data migration.
                </p>
            </div>
        )
    }

    // Rest of your existing drag and drop logic remains the same...
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

    const handleDragEnd = (e) => {
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

                    return {
                        ...prev,
                        [sourceRole]: sourceList,
                        [targetRole]: targetList
                    }
                })
            }
        } else if (!sourceRole && targetRole) {
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

    const getDisplayRankings = (role) => {
        if (!draggedItem || dragOverZone !== role) {
            return rankings[role]
        }

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
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        {league.name} Tierlist
                    </h2>
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
                                                style={{
                                                    backgroundColor: teamColor,
                                                    borderColor: teamColor,
                                                }}
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

            {/* Teams Section - now uses database data */}
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
                                            onDragEnd={handleDragEnd}
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
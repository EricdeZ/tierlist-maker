import { useState, useEffect } from 'react'

export function useDragDrop({ rankings, setRankings, lockPlayerStat, showSpotlight, setSpotlightPlayer }) {
    const [draggedItem, setDraggedItem] = useState(null)
    const [dragOverZone, setDragOverZone] = useState(null)
    const [dragOverIndex, setDragOverIndex] = useState(null)

    // Cleanup drag state on global dragend/mouseup
    useEffect(() => {
        const handleGlobalDragEnd = () => {
            setDraggedItem(null)
            setDragOverZone(null)
            setDragOverIndex(null)
        }
        document.addEventListener('dragend', handleGlobalDragEnd)
        document.addEventListener('mouseup', handleGlobalDragEnd)
        return () => {
            document.removeEventListener('dragend', handleGlobalDragEnd)
            document.removeEventListener('mouseup', handleGlobalDragEnd)
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

    const handleDragStart = (e, player, sourceTeam, sourceRole = null, sourceIndex = null) => {
        if (showSpotlight) setSpotlightPlayer(player)
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

    return {
        draggedItem,
        dragOverZone,
        dragOverIndex,
        handleDragStart,
        handleDragEnd,
        handleDragOver,
        handleDragEnter,
        handleDragLeave,
        handleDrop,
        getDisplayRankings,
    }
}

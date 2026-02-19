// src/pages/GodTierList.jsx — SMITE 2 God Tier List (S/A/B/C/D/F)
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { godService } from '../services/database'
import { usePassion } from '../context/PassionContext'
import { saveGodTierList, loadGodTierList, clearGodTierList } from '../utils/godTierListStorage'
import { exportGodTierListAsImage } from '../utils/godTierListCanvasExport'
import PageTitle from '../components/PageTitle'
import Navbar from '../components/layout/Navbar'

const TIERS = ['S', 'A', 'B', 'C', 'D', 'F']

const TIER_COLORS = {
    S: { bg: '#dc2626', label: 'S' },
    A: { bg: '#ea580c', label: 'A' },
    B: { bg: '#ca8a04', label: 'B' },
    C: { bg: '#16a34a', label: 'C' },
    D: { bg: '#2563eb', label: 'D' },
    F: { bg: '#7c3aed', label: 'F' },
}

const EMPTY_TIERS = { S: [], A: [], B: [], C: [], D: [], F: [] }

export default function GodTierList() {
    const { trackAction } = usePassion()
    const hasTrackedSave = useRef(false)
    const isInitialMount = useRef(true)

    const [gods, setGods] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [tiers, setTiers] = useState(EMPTY_TIERS)
    const [searchQuery, setSearchQuery] = useState('')
    const [isExporting, setIsExporting] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const [mobileTier, setMobileTier] = useState('S')

    // Drag state
    const [draggedGod, setDraggedGod] = useState(null) // { godId, sourceTier }
    const [dragOverTier, setDragOverTier] = useState(null)
    const [dragOverIndex, setDragOverIndex] = useState(null)

    // God lookup map
    const godsMap = useMemo(() => new Map(gods.map(g => [g.id, g])), [gods])

    // Set of placed god IDs
    const placedGodIds = useMemo(
        () => new Set(TIERS.flatMap(t => tiers[t])),
        [tiers]
    )

    // Available gods (not placed + search filter)
    const availableGods = useMemo(() => {
        const q = searchQuery.toLowerCase()
        return gods.filter(g =>
            !placedGodIds.has(g.id) &&
            g.name.toLowerCase().includes(q)
        )
    }, [gods, placedGodIds, searchQuery])

    // Check mobile
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 800)
        check()
        window.addEventListener('resize', check)
        return () => window.removeEventListener('resize', check)
    }, [])

    // Load gods + restore from localStorage
    useEffect(() => {
        godService.getAll()
            .then(data => {
                setGods(data)
                // Restore tiers from localStorage, filter stale IDs
                const saved = loadGodTierList()
                if (saved) {
                    const validIds = new Set(data.map(g => g.id))
                    const filtered = {}
                    for (const t of TIERS) {
                        filtered[t] = (saved[t] || []).filter(id => validIds.has(id))
                    }
                    setTiers(filtered)
                }
                setLoading(false)
            })
            .catch(err => {
                console.error('Failed to load gods:', err)
                setError('Failed to load gods')
                setLoading(false)
            })
    }, [])

    // Auto-save on tiers change
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false
            return
        }
        const hasAny = TIERS.some(t => tiers[t].length > 0)
        if (hasAny) {
            saveGodTierList(tiers)
            if (!hasTrackedSave.current) {
                hasTrackedSave.current = true
                trackAction('tier_list_save', 'god-tierlist')
            }
        }
    }, [tiers, trackAction])

    // Cleanup drag state on global events
    useEffect(() => {
        const cleanup = () => {
            setDraggedGod(null)
            setDragOverTier(null)
            setDragOverIndex(null)
        }
        document.addEventListener('dragend', cleanup)
        return () => document.removeEventListener('dragend', cleanup)
    }, [])

    // Auto-scroll near edges while dragging
    useEffect(() => {
        const EDGE = 80, SPEED = 12
        const onDragOver = (e) => {
            if (e.clientY < EDGE) window.scrollBy(0, -SPEED)
            else if (e.clientY > window.innerHeight - EDGE) window.scrollBy(0, SPEED)
        }
        window.addEventListener('dragover', onDragOver)
        return () => window.removeEventListener('dragover', onDragOver)
    }, [])

    // --- Drag handlers ---
    const handleDragStart = (e, godId, sourceTier = null) => {
        setDraggedGod({ godId, sourceTier })
        e.dataTransfer.effectAllowed = 'move'
    }

    const handleDragOver = (e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
    }

    const handleDragEnter = (e, tier, index = null) => {
        e.preventDefault()
        setDragOverTier(tier)
        setDragOverIndex(index)
    }

    const handleDragLeave = (e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
            setDragOverTier(null)
            setDragOverIndex(null)
        }
    }

    const handleDrop = (e, targetTier, targetIndex = null) => {
        e.preventDefault()
        setDragOverTier(null)
        setDragOverIndex(null)
        if (!draggedGod) return

        const { godId, sourceTier } = draggedGod

        setTiers(prev => {
            const next = { ...prev }

            if (sourceTier && targetTier) {
                // Moving between tiers or reordering
                if (sourceTier === targetTier) {
                    const list = [...prev[sourceTier]]
                    const srcIdx = list.indexOf(godId)
                    if (srcIdx === -1) return prev
                    list.splice(srcIdx, 1)
                    const insertIdx = targetIndex !== null ? Math.min(targetIndex, list.length) : list.length
                    list.splice(insertIdx, 0, godId)
                    next[sourceTier] = list
                } else {
                    const srcList = [...prev[sourceTier]]
                    srcList.splice(srcList.indexOf(godId), 1)
                    const tgtList = [...prev[targetTier]]
                    const insertIdx = targetIndex !== null ? Math.min(targetIndex, tgtList.length) : tgtList.length
                    tgtList.splice(insertIdx, 0, godId)
                    next[sourceTier] = srcList
                    next[targetTier] = tgtList
                }
            } else if (!sourceTier && targetTier) {
                // From pool into tier
                const tgtList = [...prev[targetTier]]
                const insertIdx = targetIndex !== null ? Math.min(targetIndex, tgtList.length) : tgtList.length
                tgtList.splice(insertIdx, 0, godId)
                next[targetTier] = tgtList
            }

            return next
        })

        setDraggedGod(null)
    }

    const removeFromTier = (tier, godId) => {
        setTiers(prev => ({
            ...prev,
            [tier]: prev[tier].filter(id => id !== godId),
        }))
    }

    const clearAll = () => {
        setTiers({ ...EMPTY_TIERS })
        clearGodTierList()
    }

    const handleExport = async () => {
        setIsExporting(true)
        try {
            await exportGodTierListAsImage(tiers, godsMap)
        } finally {
            setTimeout(() => setIsExporting(false), 1000)
        }
    }

    // Get display list with drag preview
    const getDisplayTier = useCallback((tier) => {
        if (!draggedGod || dragOverTier !== tier) return tiers[tier]

        const { godId, sourceTier } = draggedGod
        let list

        if (!sourceTier) {
            // From pool
            list = [...tiers[tier]]
            const insertIdx = dragOverIndex !== null ? Math.min(dragOverIndex, list.length) : list.length
            list.splice(insertIdx, 0, godId)
        } else if (sourceTier === tier) {
            // Reorder within same tier
            list = [...tiers[tier]]
            const srcIdx = list.indexOf(godId)
            if (srcIdx === -1) return tiers[tier]
            list.splice(srcIdx, 1)
            const insertIdx = dragOverIndex !== null ? Math.min(dragOverIndex, list.length) : list.length
            list.splice(insertIdx, 0, godId)
        } else {
            // From another tier
            list = [...tiers[tier]]
            const insertIdx = dragOverIndex !== null ? Math.min(dragOverIndex, list.length) : list.length
            list.splice(insertIdx, 0, godId)
        }

        return list
    }, [draggedGod, dragOverTier, dragOverIndex, tiers])

    // --- Mobile handlers ---
    const addToMobileTier = (godId) => {
        setTiers(prev => {
            if (prev[mobileTier].includes(godId)) return prev
            return { ...prev, [mobileTier]: [...prev[mobileTier], godId] }
        })
    }

    const moveMobile = (tier, index, direction) => {
        setTiers(prev => {
            const list = [...prev[tier]]
            const newIdx = index + direction
            if (newIdx < 0 || newIdx >= list.length) return prev
            ;[list[index], list[newIdx]] = [list[newIdx], list[index]]
            return { ...prev, [tier]: list }
        })
    }

    // --- Render ---
    if (loading) {
        return (
            <>
                <Navbar title="God Tier List" />
                <div className="min-h-screen flex items-center justify-center">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-(--color-accent) mx-auto mb-4" />
                        <p className="text-(--color-text-secondary)">Loading gods...</p>
                    </div>
                </div>
            </>
        )
    }

    if (error) {
        return (
            <>
                <Navbar title="God Tier List" />
                <div className="min-h-screen flex items-center justify-center">
                    <div className="text-red-400 text-lg">{error}</div>
                </div>
            </>
        )
    }

    const totalPlaced = placedGodIds.size

    // ============ MOBILE ============
    if (isMobile) {
        const currentTierGods = tiers[mobileTier] || []

        return (
            <div className="min-h-screen">
                <Navbar title="God Tier List" />
                <PageTitle title="SMITE 2 God Tier List Maker" description="Create your SMITE 2 god tier list. Rank every god in classic S/A/B/C/D/F tiers, export as image, and share with your friends." />

                <div className="pt-20 px-3 pb-4">
                    {/* Tier tabs */}
                    <div className="flex gap-1.5 mb-4">
                        {TIERS.map(t => (
                            <button
                                key={t}
                                onClick={() => setMobileTier(t)}
                                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                                    mobileTier === t
                                        ? 'text-white shadow-lg'
                                        : 'bg-white/5 text-(--color-text-secondary) hover:bg-white/10'
                                }`}
                                style={mobileTier === t ? { backgroundColor: TIER_COLORS[t].bg } : undefined}
                            >
                                {t}
                                {tiers[t].length > 0 && (
                                    <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full ${
                                        mobileTier === t ? 'bg-white/20' : 'bg-white/10'
                                    }`}>
                                        {tiers[t].length}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Current tier gods */}
                    <div className="bg-(--color-secondary) rounded-xl border border-white/10 p-3 mb-4">
                        <h3 className="text-xs font-bold text-(--color-text-secondary) uppercase tracking-wider mb-2">
                            {mobileTier} Tier
                        </h3>
                        {currentTierGods.length === 0 ? (
                            <p className="text-sm text-(--color-text-secondary)/50 italic py-4 text-center">
                                Tap gods below to add
                            </p>
                        ) : (
                            <div className="space-y-1.5">
                                {currentTierGods.map((godId, index) => {
                                    const god = godsMap.get(godId)
                                    if (!god) return null
                                    return (
                                        <div
                                            key={godId}
                                            className="flex items-center gap-2 rounded-lg overflow-hidden bg-white/5"
                                        >
                                            <img
                                                src={god.image_url}
                                                alt={god.name}
                                                className="w-10 h-10 object-cover flex-shrink-0 rounded-l-lg"
                                            />
                                            <span className="text-sm font-medium text-(--color-text) flex-1 min-w-0 truncate">
                                                {god.name}
                                            </span>
                                            <div className="flex items-center flex-shrink-0">
                                                <button
                                                    onClick={() => moveMobile(mobileTier, index, -1)}
                                                    disabled={index === 0}
                                                    className="px-2 py-2 text-xs text-(--color-text-secondary) disabled:opacity-20 hover:bg-white/10 transition-colors"
                                                >
                                                    ▲
                                                </button>
                                                <button
                                                    onClick={() => moveMobile(mobileTier, index, 1)}
                                                    disabled={index === currentTierGods.length - 1}
                                                    className="px-2 py-2 text-xs text-(--color-text-secondary) disabled:opacity-20 hover:bg-white/10 transition-colors"
                                                >
                                                    ▼
                                                </button>
                                                <button
                                                    onClick={() => removeFromTier(mobileTier, godId)}
                                                    className="px-2.5 py-2 text-xs text-(--color-text-secondary) hover:text-red-400 hover:bg-white/10 transition-colors"
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

                    {/* God pool */}
                    <div className="bg-(--color-secondary) rounded-xl border border-white/10 p-3 mb-4">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xs font-bold text-(--color-text-secondary) uppercase tracking-wider">
                                Available Gods
                            </h3>
                            <span className="text-[10px] text-(--color-text-secondary)">
                                {availableGods.length} remaining
                            </span>
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search gods..."
                            className="w-full px-3 py-2 rounded-lg bg-(--color-primary) border border-white/10 text-(--color-text) placeholder:text-(--color-text-secondary)/50 text-sm mb-3 focus:outline-none focus:border-(--color-accent)/50"
                        />
                        <div className="grid grid-cols-5 gap-2">
                            {availableGods.map(god => (
                                <button
                                    key={god.id}
                                    onClick={() => addToMobileTier(god.id)}
                                    className="relative aspect-square rounded-lg overflow-hidden border border-white/10 hover:border-white/30 transition-colors"
                                >
                                    <img
                                        src={god.image_url}
                                        alt={god.name}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                    />
                                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-0.5 py-0.5">
                                        <span className="text-[8px] text-white font-medium truncate block text-center">
                                            {god.name}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                        <button
                            onClick={clearAll}
                            className="flex-1 px-4 py-2.5 bg-white/10 text-(--color-text) rounded-lg text-sm font-medium hover:bg-white/20 transition-colors"
                        >
                            Clear All
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={isExporting || totalPlaced === 0}
                            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                            style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-primary)' }}
                        >
                            {isExporting ? 'Exporting...' : 'Export Image'}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // ============ DESKTOP ============
    return (
        <div className="min-h-screen">
            <Navbar title="God Tier List" />
            <PageTitle title="SMITE 2 God Tier List Maker" description="Create your SMITE 2 god tier list. Rank every god in classic S/A/B/C/D/F tiers, export as image, and share with your friends." />

            <div className="max-w-7xl mx-auto pt-24 pb-8 px-4 sm:px-6 lg:px-8">
                {/* Header + Actions */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-(--color-text) font-heading">
                            God Tier List
                        </h1>
                        <p className="text-sm text-(--color-text-secondary) mt-1">
                            Drag gods into tiers to rank them
                            {totalPlaced > 0 && (
                                <span className="ml-2 text-(--color-accent)">
                                    {totalPlaced} placed
                                </span>
                            )}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={clearAll}
                            className="px-4 py-2 bg-white/10 text-(--color-text) rounded-lg text-sm font-medium hover:bg-white/20 transition-colors"
                        >
                            Clear All
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={isExporting || totalPlaced === 0}
                            className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                            style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-primary)' }}
                        >
                            {isExporting ? 'Exporting...' : 'Export Image'}
                        </button>
                    </div>
                </div>

                {/* Tier rows */}
                <div className="space-y-2 mb-8">
                    {TIERS.map(tier => {
                        const displayGods = getDisplayTier(tier)
                        const isOver = dragOverTier === tier

                        return (
                            <div
                                key={tier}
                                className={`flex rounded-xl border transition-colors overflow-hidden ${
                                    isOver
                                        ? 'border-(--color-accent)/40 bg-(--color-accent)/5'
                                        : 'border-white/10'
                                }`}
                                onDragOver={handleDragOver}
                                onDragEnter={(e) => handleDragEnter(e, tier)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, tier)}
                            >
                                {/* Tier label */}
                                <div
                                    className="flex items-center justify-center w-16 sm:w-20 flex-shrink-0 text-xl sm:text-2xl font-bold text-white font-heading"
                                    style={{ backgroundColor: TIER_COLORS[tier].bg }}
                                >
                                    {tier}
                                </div>

                                {/* Drop zone — h-16 card = 64px + p-2 top/bottom = 80px */}
                                <div className="flex-1 flex flex-wrap items-start content-start gap-1.5 p-2 min-h-20 bg-(--color-secondary)">
                                    {displayGods.map((godId, index) => {
                                        const god = godsMap.get(godId)
                                        if (!god) return null
                                        const isDragging = draggedGod?.godId === godId && draggedGod?.sourceTier === tier

                                        return (
                                            <div
                                                key={`${tier}-${godId}`}
                                                onDragOver={handleDragOver}
                                                onDragEnter={(e) => {
                                                    e.stopPropagation()
                                                    handleDragEnter(e, tier, index)
                                                }}
                                                onDrop={(e) => {
                                                    e.stopPropagation()
                                                    handleDrop(e, tier, index)
                                                }}
                                            >
                                                <div
                                                    className={`relative w-16 h-16 rounded-lg overflow-hidden cursor-grab active:cursor-grabbing group transition-all ${
                                                        isDragging
                                                            ? 'opacity-30'
                                                            : 'ring-1 ring-white/10 hover:ring-white/30'
                                                    }`}
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e, godId, tier)}
                                                >
                                                    <img
                                                        src={god.image_url}
                                                        alt={god.name}
                                                        className="w-full h-full object-cover"
                                                        loading="lazy"
                                                    />
                                                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-0.5 py-0.5">
                                                        <span className="text-[9px] text-white font-medium truncate block text-center">
                                                            {god.name}
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            removeFromTier(tier, godId)
                                                        }}
                                                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })}

                                    {/* End-of-row drop zone */}
                                    <div
                                        className="flex-1 min-w-[3rem] h-16"
                                        onDragOver={handleDragOver}
                                        onDragEnter={(e) => {
                                            e.stopPropagation()
                                            handleDragEnter(e, tier, displayGods.length)
                                        }}
                                        onDrop={(e) => {
                                            e.stopPropagation()
                                            handleDrop(e, tier, displayGods.length)
                                        }}
                                    />

                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* God Pool */}
                <div className="bg-(--color-secondary) rounded-xl border border-white/10 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-bold text-(--color-text) font-heading uppercase tracking-wider">
                            God Pool
                        </h2>
                        <span className="text-xs text-(--color-text-secondary)">
                            {availableGods.length} available
                        </span>
                    </div>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search gods..."
                        className="w-full px-4 py-2 rounded-lg bg-(--color-primary) border border-white/10 text-(--color-text) placeholder:text-(--color-text-secondary)/50 focus:outline-none focus:border-(--color-accent)/50 text-sm mb-4"
                    />
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2">
                        {availableGods.map(god => (
                            <div
                                key={god.id}
                                className="relative aspect-square rounded-lg overflow-hidden border-2 border-white/10 hover:border-white/30 cursor-grab active:cursor-grabbing transition-colors"
                                draggable
                                onDragStart={(e) => handleDragStart(e, god.id, null)}
                            >
                                <img
                                    src={god.image_url}
                                    alt={god.name}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                />
                                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-0.5 py-0.5">
                                    <span className="text-[9px] text-white font-medium truncate block text-center">
                                        {god.name}
                                    </span>
                                </div>
                            </div>
                        ))}
                        {availableGods.length === 0 && searchQuery && (
                            <div className="col-span-full text-center py-4 text-sm text-(--color-text-secondary)/50 italic">
                                No gods match "{searchQuery}"
                            </div>
                        )}
                        {availableGods.length === 0 && !searchQuery && (
                            <div className="col-span-full text-center py-4 text-sm text-(--color-text-secondary)/50 italic">
                                All gods placed!
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

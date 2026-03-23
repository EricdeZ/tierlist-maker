import { useState, useCallback, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Save, Download, Send, Check, X, ZoomIn, ZoomOut, Eye, Layers, FilePlus, FolderOpen } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { vaultDashboardService } from '../../services/database'
import CardCanvas from './preview/CardCanvas'
import CardSidebar from './editor/CardSidebar'
import RaritySetPanel from './editor/RaritySetPanel'
import RarityStrip from './editor/RarityStrip'
import HoloPreview from './preview/HoloPreview'
import { exportCardToPNG, downloadBlob } from './preview/ExportCanvas'

const CARD_TYPES = ['player', 'god', 'item', 'consumable', 'minion', 'buff', 'custom']
const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'full_art']
const ZOOM_LEVELS = [75, 100, 125, 150]

const STATUS_COLORS = {
    draft: 'bg-gray-600',
    pending_review: 'bg-yellow-600',
    approved: 'bg-green-600',
    rejected: 'bg-red-600',
}

const inputClass = 'px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500'

const STORAGE_KEY = 'vault-studio-draft'

function loadDraft() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        return raw ? JSON.parse(raw) : null
    } catch { return null }
}

// Seed nextId from restored elements to avoid ID collisions
let nextId = (() => {
    const draft = loadDraft()
    if (!draft?.elements?.length) return 1
    let max = 0
    for (const el of draft.elements) {
        const num = parseInt(el.id?.split('-')[1]) || 0
        if (num > max) max = num
    }
    return max + 1
})()

function seedNextId(elements) {
    if (!elements?.length) return
    let max = 0
    for (const el of elements) {
        const num = parseInt(el.id?.split('-')[1]) || 0
        if (num > max) max = num
    }
    if (max >= nextId) nextId = max + 1
}

export default function CardCreator() {
    const { hasPermission } = useAuth()
    const canApprove = hasPermission('vault_approve')
    const initialized = useRef(false)
    const location = useLocation()
    const navigate = useNavigate()

    const saved = useRef(loadDraft())

    const [name, setName] = useState(() => saved.current?.name || '')
    const [cardType, setCardType] = useState(() => saved.current?.cardType || 'player')
    const [rarity, setRarity] = useState(() => saved.current?.rarity || 'full_art')
    const [zoom, setZoom] = useState(100)

    // Card elements (images, text, stats, effects)
    const [elements, setElements] = useState(() => saved.current?.elements || [])
    const [selectedId, setSelectedId] = useState(null)
    const [border, setBorder] = useState(() => saved.current?.border || { enabled: true, color: '#d4af37', width: 3, radius: 12 })

    // Save state
    const [saveTarget, setSaveTarget] = useState(() => saved.current?.saveTarget || null)
    const [status, setStatus] = useState(() => saved.current?.status || 'draft')
    const [dirty, setDirty] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)
    const [showHolo, setShowHolo] = useState(false)
    const [showRaritySet, setShowRaritySet] = useState(false)
    const [cardData, setCardData] = useState(() => saved.current?.cardData || {
        name: '', imageUrl: '', serialNumber: '001', role: 'mid', class: 'Mage',
        subtitle: '', topStatLabel: '', topStatValue: '', blocks: [],
    })

    // Persist to localStorage on changes
    useEffect(() => {
        if (!initialized.current) { initialized.current = true; return }
        const draft = { name, cardType, rarity, elements, border, saveTarget, status, cardData }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
    }, [name, cardType, rarity, elements, border, saveTarget, status, cardData])

    // Auto-sync card name and first image into cardData
    useEffect(() => {
        const firstImg = elements.find(el => el.type === 'image' && el.url && !el.url.startsWith('blob:'))
        setCardData(prev => ({
            ...prev,
            name: prev.name || name,
            imageUrl: prev.imageUrl || firstImg?.url || '',
        }))
    }, [name, elements])

    // Load draft/template from navigation state
    const loadedRef = useRef(false)
    useEffect(() => {
        if (loadedRef.current) return
        const state = location.state
        if (!state) return

        const load = async () => {
            try {
                let data, type
                if (state.loadDraft) {
                    const res = await vaultDashboardService.getDraft(state.loadDraft)
                    data = res.draft
                    type = 'draft'
                } else if (state.loadTemplate) {
                    const res = await vaultDashboardService.getTemplate(state.loadTemplate)
                    data = res.template
                    type = 'template'
                }
                if (!data) return

                const td = typeof data.template_data === 'string' ? JSON.parse(data.template_data) : data.template_data
                setName(data.name || '')
                setCardType(data.card_type || 'player')
                setRarity(data.rarity || 'full_art')
                setElements(td?.elements || [])
                setBorder(td?.border || { enabled: true, color: '#d4af37', width: 3, radius: 12 })
                setSaveTarget({ type, id: data.id })
                setStatus(data.status || 'draft')
                if (td?.cardData) setCardData(td.cardData)
                setDirty(false)
                seedNextId(td?.elements)
                loadedRef.current = true
                // Clear navigation state so refresh doesn't re-fetch
                navigate(location.pathname, { replace: true, state: null })
            } catch (e) {
                console.error('Failed to load:', e)
                setError(e.message)
            }
        }
        load()
    }, [location.state, location.pathname, navigate])

    const selectedElement = elements.find(el => el.id === selectedId) || null

    const updateElement = useCallback((id, updates) => {
        setElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el))
        setDirty(true)
    }, [])

    const deleteElement = useCallback((id) => {
        setElements(prev => prev.filter(el => el.id !== id))
        if (selectedId === id) setSelectedId(null)
        setDirty(true)
    }, [selectedId])

    const reorderElements = useCallback((orderedIds) => {
        // orderedIds is top-to-bottom (highest z first)
        setElements(prev => prev.map(el => {
            const idx = orderedIds.indexOf(el.id)
            return idx >= 0 ? { ...el, z: (orderedIds.length - 1 - idx) * 10 } : el
        }))
        setDirty(true)
    }, [])

    // Resize image client-side to stay under 2MB upload limit
    const resizeImage = useCallback((file) => {
        const MAX_BYTES = 1.8 * 1024 * 1024 // target under 2MB limit
        if (file.size <= MAX_BYTES && /^image\/webp$/.test(file.type)) return Promise.resolve(file)
        return new Promise((resolve) => {
            const img = new Image()
            img.onload = () => {
                const tryCompress = (maxDim, quality) => {
                    const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
                    const canvas = document.createElement('canvas')
                    canvas.width = Math.round(img.width * scale)
                    canvas.height = Math.round(img.height * scale)
                    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
                    canvas.toBlob((blob) => {
                        if (blob.size > MAX_BYTES && quality > 0.4) {
                            tryCompress(maxDim * 0.75, quality - 0.15)
                        } else {
                            URL.revokeObjectURL(img.src)
                            resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' }))
                        }
                    }, 'image/webp', quality)
                }
                tryCompress(2048, 0.85)
            }
            img.onerror = () => resolve(file)
            img.src = URL.createObjectURL(file)
        })
    }, [])

    // Upload image to R2 and replace blob URL
    const handleUploadImage = useCallback(async (file, elementId) => {
        try {
            const resized = await resizeImage(file)
            const res = await vaultDashboardService.uploadAsset(resized, {
                name: file.name.replace(/\.[^.]+$/, ''),
                category: 'character',
                tags: [],
            })
            if (res.success && res.asset?.url) {
                setElements(prev => prev.map(el =>
                    el.id === elementId
                        ? { ...el, url: res.asset.url, assetId: res.asset.id, _pendingFile: undefined }
                        : el
                ))
            }
        } catch (e) {
            console.error('Upload failed:', e)
        }
    }, [resizeImage])

    // Upload shared structured card image to R2
    const handleUploadRarityImage = useCallback(async (file) => {
        try {
            const resized = await resizeImage(file)
            const res = await vaultDashboardService.uploadAsset(resized, {
                name: file.name.replace(/\.[^.]+$/, ''),
                category: 'character',
                tags: [],
            })
            if (res.success && res.asset?.url) {
                setCardData(prev => ({ ...prev, imageUrl: res.asset.url }))
                setDirty(true)
            }
        } catch (e) {
            console.error('Rarity image upload failed:', e)
        }
    }, [resizeImage])

    // Add image from file (drop or browse)
    const addImageFromFile = useCallback((file, x = 0, y = 0) => {
        const url = URL.createObjectURL(file)
        const id = `img-${nextId++}`
        const count = elements.filter(el => el.type === 'image').length
        const isFirst = count === 0

        const img = new Image()
        img.onload = () => {
            let w, h
            if (isFirst) {
                // First image fills card
                w = 300; h = 420
            } else {
                const ratio = img.naturalWidth / img.naturalHeight
                // Fit within card bounds, preserving aspect ratio
                if (ratio >= 300 / 420) {
                    w = Math.min(img.naturalWidth, 300)
                    h = Math.round(w / ratio)
                } else {
                    h = Math.min(img.naturalHeight, 420)
                    w = Math.round(h * ratio)
                }
            }
            setElements(prev => [...prev, {
                id,
                type: 'image',
                name: isFirst ? 'Background' : `Image ${count + 1}`,
                url,
                _pendingFile: file,
                x, y,
                w, h,
                z: prev.length,
                opacity: 1,
                visible: true,
            }])
            setSelectedId(id)
            setDirty(true)
        }
        img.src = url
        handleUploadImage(file, id)
    }, [elements, handleUploadImage])

    const addText = useCallback(() => {
        const id = `txt-${nextId++}`
        setElements(prev => [...prev, {
            id,
            type: 'text',
            name: 'Text',
            content: 'Player Name',
            font: 'Cinzel',
            fontSize: 20,
            color: '#ffffff',
            bold: false,
            shadow: true,
            x: 80, y: 30,
            z: elements.length + 10,
            visible: true,
        }])
        setSelectedId(id)
        setDirty(true)
    }, [elements.length])

    const addStats = useCallback(() => {
        const id = `stats-${nextId++}`
        setElements(prev => [...prev, {
            id,
            type: 'stats',
            name: 'Stats',
            stats: { KDA: '3.5', Damage: '25k', Win: '70%' },
            color: '#ffffff',
            bgColor: 'rgba(0,0,0,0.7)',
            x: 20, y: 300,
            w: 120, h: 80,
            z: elements.length + 10,
            visible: true,
        }])
        setSelectedId(id)
        setDirty(true)
    }, [elements.length])

    const addEffect = useCallback((effectName = 'rainbow') => {
        const id = `fx-${nextId++}`
        setElements(prev => [...prev, {
            id,
            type: 'effect',
            name: effectName,
            effectName,
            opacity: 1,
            z: prev.length + 100,
            visible: true,
        }])
        setSelectedId(id)
        setDirty(true)
    }, [])

    const addNameBanner = useCallback(() => {
        const id = `banner-${nextId++}`
        setElements(prev => [...prev, {
            id, type: 'name-banner', name: 'Name Banner',
            playerName: 'Player Name', roleLabel: 'ADC', role: 'adc',
            font: "'Segoe UI', system-ui, sans-serif", fontSize: 16,
            x: 0, y: 0, w: 300, z: prev.length + 10, visible: true,
        }])
        setSelectedId(id)
        setDirty(true)
    }, [])

    const addStatsBlock = useCallback(() => {
        const id = `sblock-${nextId++}`
        setElements(prev => [...prev, {
            id, type: 'stats-block', name: 'Stats Block', role: 'adc',
            font: "'Segoe UI', system-ui, sans-serif", fontSize: 10,
            rows: [
                { label: 'KDA', value: '3.5', sub: '5/2/4' },
            ],
            record: { winRate: '70%', record: '7W-3L', games: '10' },
            x: 0, y: 280, w: 300, z: prev.length + 10, visible: true,
        }])
        setSelectedId(id)
        setDirty(true)
    }, [])

    const addTextBlock = useCallback(() => {
        const id = `tblock-${nextId++}`
        setElements(prev => [...prev, {
            id, type: 'text-block', name: 'Text Block', role: 'adc',
            title: '', content: 'Description text here',
            font: "'Segoe UI', system-ui, sans-serif", fontSize: 10, color: '',
            x: 10, y: 270, w: 280, h: 60, z: prev.length + 10, visible: true,
        }])
        setSelectedId(id)
        setDirty(true)
    }, [])

    const addSubtitle = useCallback(() => {
        const id = `sub-${nextId++}`
        setElements(prev => [...prev, {
            id, type: 'subtitle', name: 'Subtitle', role: 'adc',
            text: 'Guardian \u00b7 Physical', color: '',
            font: "'Segoe UI', system-ui, sans-serif", fontSize: 9,
            showBg: false,
            x: 0, y: 255, w: 300, z: prev.length + 10, visible: true,
        }])
        setSelectedId(id)
        setDirty(true)
    }, [])

    const addFooter = useCallback(() => {
        const id = `ftr-${nextId++}`
        setElements(prev => [...prev, {
            id, type: 'footer', name: 'Footer', role: 'adc',
            leftText: '#001', rightText: 'LEGENDARY', counterPad: 3,
            font: "'Segoe UI', system-ui, sans-serif", fontSize: 9,
            showBg: false,
            x: 0, y: 395, w: 300, z: prev.length + 10, visible: true,
        }])
        setSelectedId(id)
        setDirty(true)
    }, [])

    // Save
    const handleSave = useCallback(async (type) => {
        setSaving(true)
        setError(null)
        try {
            // Strip non-serializable props (File objects, blob URLs without R2 upload)
            const cleanElements = elements.map(({ _pendingFile, ...el }) => {
                // Replace blob URLs with null if not yet uploaded to R2
                if (el.type === 'image' && el.url?.startsWith('blob:') && !el.assetId) {
                    return { ...el, url: null }
                }
                return el
            })
            const templateData = { elements: cleanElements, border, cardData }
            const payload = {
                name: name || 'Untitled',
                card_type: cardType,
                rarity,
                template_data: templateData,
            }
            if (type === 'template') {
                if (saveTarget?.type === 'template') payload.id = saveTarget.id
                const res = await vaultDashboardService.saveTemplate(payload)
                setSaveTarget({ type: 'template', id: res.template?.id })
                setStatus(res.template?.status || 'draft')
            } else {
                if (saveTarget?.type === 'draft') payload.id = saveTarget.id
                const res = await vaultDashboardService.saveDraft(payload)
                setSaveTarget({ type: 'draft', id: res.draft?.id })
                setStatus(res.draft?.status || 'draft')
            }
            setDirty(false)
        } catch (e) {
            console.error('Save failed:', e)
            setError(e.message)
        } finally {
            setSaving(false)
        }
    }, [name, cardType, rarity, elements, border, saveTarget])

    const handleSubmit = useCallback(async () => {
        if (!saveTarget) return
        await vaultDashboardService.submitForReview(saveTarget.type, saveTarget.id)
        setStatus('pending_review')
    }, [saveTarget])

    const handleNew = useCallback(() => {
        if (dirty && !window.confirm('You have unsaved changes. Start a new card?')) return
        setName('')
        setCardType('player')
        setRarity('full_art')
        setElements([])
        setSelectedId(null)
        setBorder({ enabled: true, color: '#d4af37', width: 3, radius: 12 })
        setSaveTarget(null)
        setStatus('draft')
        setCardData({ name: '', imageUrl: '', serialNumber: '001', role: 'mid', class: 'Mage', subtitle: '', topStatLabel: '', topStatValue: '', blocks: [] })
        setDirty(false)
        setError(null)
        localStorage.removeItem(STORAGE_KEY)
    }, [dirty])

    const handleExport = useCallback(async () => {
        const el = document.querySelector('[data-card-preview]')
        if (!el) return
        const blob = await exportCardToPNG(el)
        if (blob) downloadBlob(blob, `${name || 'card'}.png`)
    }, [name])

    return (
        <div className="flex flex-col h-[calc(100vh-80px)]">
            {/* Top Bar */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-700/50 flex-wrap bg-gray-900/50">
                <button onClick={handleNew}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                    title="New card">
                    <FilePlus size={14} /> New
                </button>
                <button onClick={() => navigate('/vault-dashboard/drafts')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                    title="Load draft or template">
                    <FolderOpen size={14} /> Load
                </button>

                <div className="w-px h-6 bg-gray-700/50" />

                <input
                    type="text" value={name} onChange={e => { setName(e.target.value); setDirty(true) }}
                    placeholder="Card name..."
                    className={`${inputClass} w-44`}
                />

                <select value={cardType} onChange={e => { setCardType(e.target.value); setDirty(true) }} className={inputClass}>
                    {CARD_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>

                <select value={rarity} onChange={e => { setRarity(e.target.value); setDirty(true) }} className={inputClass}>
                    {RARITIES.map(r => <option key={r} value={r}>{r === 'full_art' ? 'Full Art' : r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>

                <div className="flex-1" />

                <button onClick={() => handleSave('draft')} disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50">
                    <Save size={14} /> Draft
                </button>
                <button onClick={() => handleSave('template')} disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-700 hover:bg-amber-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50">
                    <Save size={14} /> Template
                </button>
                <button onClick={handleExport}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors">
                    <Download size={14} /> PNG
                </button>
            </div>

            {error && <div className="px-4 py-1.5 bg-red-900/50 border-b border-red-700 text-red-300 text-xs">{error}</div>}

            {/* Main: Sidebar + Canvas */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left sidebar */}
                <div className="w-[280px] border-r border-gray-700/50 overflow-y-auto p-3 bg-gray-900/30">
                    <CardSidebar
                        elements={elements}
                        selectedId={selectedId}
                        selectedElement={selectedElement}
                        onSelect={setSelectedId}
                        onAddImage={addImageFromFile}
                        onAddText={addText}
                        onAddStats={addStats}
                        onAddEffect={addEffect}
                        onAddNameBanner={addNameBanner}
                        onAddStatsBlock={addStatsBlock}
                        onAddTextBlock={addTextBlock}
                        onAddSubtitle={addSubtitle}
                        onAddFooter={addFooter}
                        onUpdateElement={updateElement}
                        onDeleteElement={deleteElement}
                        onReorder={reorderElements}
                        border={border}
                        onBorderChange={(b) => { setBorder(b); setDirty(true) }}
                        onUploadImage={handleUploadImage}
                    />
                </div>

                {/* Canvas area */}
                <div className="flex-1 flex flex-col items-center bg-gray-950/50 overflow-auto p-8">
                    {/* Toolbar */}
                    <div className="flex items-center gap-3 mb-4">
                        <div className="flex items-center gap-1">
                            <ZoomOut size={14} className="text-gray-600" />
                            {ZOOM_LEVELS.map(z => (
                                <button key={z} onClick={() => setZoom(z)}
                                    className={`px-2 py-0.5 text-xs rounded transition-colors ${zoom === z ? 'bg-amber-600 text-white' : 'text-gray-500 hover:text-white'}`}>
                                    {z}%
                                </button>
                            ))}
                            <ZoomIn size={14} className="text-gray-600" />
                        </div>
                        <button
                            onClick={() => setShowHolo(h => !h)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                                showHolo ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                            }`}
                        >
                            <Eye size={13} /> Holo Preview
                        </button>
                        <button
                            onClick={() => setShowRaritySet(r => !r)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                                showRaritySet ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                            }`}
                        >
                            <Layers size={13} /> Rarity Set
                        </button>
                    </div>

                    <div className="flex items-start gap-8">
                        <div data-card-preview style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}>
                            <CardCanvas
                                elements={elements}
                                selectedId={selectedId}
                                onSelect={setSelectedId}
                                onUpdateElement={updateElement}
                                onDeleteElement={deleteElement}
                                onDropImage={addImageFromFile}
                                border={border}
                                zoom={zoom}
                            />
                        </div>

                        {showHolo && elements.length > 0 && (
                            <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}>
                                <HoloPreview elements={elements} border={border} />
                            </div>
                        )}
                    </div>

                    {/* Rarity Strip — central, below main card */}
                    {showRaritySet && (
                        <div className="mt-6 w-full">
                            <RarityStrip
                                cardData={cardData}
                                onCardDataChange={(d) => { setCardData(d); setDirty(true) }}
                                cardType={cardType}
                                elements={elements}
                                border={border}
                                onUploadRarityImage={handleUploadRarityImage}
                            />
                        </div>
                    )}
                </div>

                {/* Card Data panel (structured card fields) */}
                {showRaritySet && (
                    <div className="w-[280px] border-l border-gray-700/50 overflow-y-auto p-3 bg-gray-900/30">
                        <RaritySetPanel
                            cardData={cardData}
                            onCardDataChange={(d) => { setCardData(d); setDirty(true) }}
                            cardType={cardType}
                            elements={elements}
                            border={border}
                        />
                    </div>
                )}
            </div>

            {/* Status Bar */}
            <div className="flex items-center gap-3 px-4 py-1.5 border-t border-gray-700/50 text-xs bg-gray-900/50">
                <span className={`w-1.5 h-1.5 rounded-full ${dirty ? 'bg-yellow-400' : 'bg-green-400'}`} />
                <span className="text-gray-500">{dirty ? 'Unsaved' : 'Saved'}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] text-white ${STATUS_COLORS[status] || 'bg-gray-600'}`}>
                    {status.replace('_', ' ')}
                </span>
                <div className="flex-1" />
                {status === 'draft' && saveTarget && (
                    <button onClick={handleSubmit} disabled={saving || dirty}
                        className="px-3 py-1 bg-blue-700 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50">
                        <Send size={12} className="inline mr-1" /> Submit for Review
                    </button>
                )}
                {canApprove && status === 'pending_review' && (
                    <>
                        <button onClick={async () => { await vaultDashboardService.approve(saveTarget.type, saveTarget.id); setStatus('approved') }}
                            className="px-3 py-1 bg-green-700 hover:bg-green-600 text-white rounded-lg transition-colors">
                            <Check size={12} className="inline mr-1" /> Approve
                        </button>
                        <button onClick={async () => { await vaultDashboardService.reject(saveTarget.type, saveTarget.id); setStatus('rejected') }}
                            className="px-3 py-1 bg-red-700 hover:bg-red-600 text-white rounded-lg transition-colors">
                            <X size={12} className="inline mr-1" /> Reject
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}

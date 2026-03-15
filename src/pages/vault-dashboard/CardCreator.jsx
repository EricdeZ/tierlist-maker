import { useState, useCallback } from 'react'
import { Save, Download, Send, Check, X, ZoomIn, ZoomOut } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { vaultDashboardService } from '../../services/database'
import CardCanvas from './preview/CardCanvas'
import CardSidebar from './editor/CardSidebar'
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

let nextId = 1

export default function CardCreator() {
    const { hasPermission } = useAuth()
    const canApprove = hasPermission('vault_approve')

    const [name, setName] = useState('')
    const [cardType, setCardType] = useState('player')
    const [rarity, setRarity] = useState('full_art')
    const [zoom, setZoom] = useState(100)

    // Card elements (images, text, stats, effects)
    const [elements, setElements] = useState([])
    const [selectedId, setSelectedId] = useState(null)
    const [border, setBorder] = useState({ enabled: true, color: '#d4af37', width: 3, radius: 12 })

    // Save state
    const [saveTarget, setSaveTarget] = useState(null)
    const [status, setStatus] = useState('draft')
    const [dirty, setDirty] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

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

    // Upload image to R2 and replace blob URL
    const handleUploadImage = useCallback(async (file, elementId) => {
        try {
            const res = await vaultDashboardService.uploadAsset(file, {
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
    }, [])

    // Add image from file (drop or browse)
    const addImageFromFile = useCallback((file, x = 0, y = 0) => {
        const url = URL.createObjectURL(file)
        const id = `img-${nextId++}`
        const count = elements.filter(el => el.type === 'image').length
        setElements(prev => [...prev, {
            id,
            type: 'image',
            name: count === 0 ? 'Background' : `Image ${count + 1}`,
            url,
            _pendingFile: file,
            x, y,
            w: count === 0 ? 300 : 150,
            h: count === 0 ? 420 : 200,
            z: prev.length,
            opacity: 1,
            visible: true,
        }])
        setSelectedId(id)
        setDirty(true)
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

    const addEffect = useCallback(() => {
        const id = `fx-${nextId++}`
        setElements(prev => [...prev, {
            id,
            type: 'effect',
            name: 'Holo Effect',
            effectName: 'rainbow',
            opacity: 0.3,
            z: 100,
            visible: true,
        }])
        setSelectedId(id)
        setDirty(true)
    }, [])

    // Save
    const handleSave = useCallback(async (type) => {
        setSaving(true)
        setError(null)
        try {
            const templateData = { elements, border }
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
                        onAddImage={addImageFromFile}
                        onAddText={addText}
                        onAddStats={addStats}
                        onAddEffect={addEffect}
                        onUpdateElement={updateElement}
                        onDeleteElement={deleteElement}
                        border={border}
                        onBorderChange={(b) => { setBorder(b); setDirty(true) }}
                        onUploadImage={handleUploadImage}
                    />
                </div>

                {/* Canvas area */}
                <div className="flex-1 flex flex-col items-center justify-center bg-gray-950/50 overflow-auto p-8">
                    {/* Zoom */}
                    <div className="flex items-center gap-1 mb-4">
                        <ZoomOut size={14} className="text-gray-600" />
                        {ZOOM_LEVELS.map(z => (
                            <button key={z} onClick={() => setZoom(z)}
                                className={`px-2 py-0.5 text-xs rounded transition-colors ${zoom === z ? 'bg-amber-600 text-white' : 'text-gray-500 hover:text-white'}`}>
                                {z}%
                            </button>
                        ))}
                        <ZoomIn size={14} className="text-gray-600" />
                    </div>

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
                </div>
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

import { useState, useCallback } from 'react'
import { Save, Download, Send, Check, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { vaultDashboardService } from '../../services/database'
import TemplateModeControls from './editor/TemplateModeControls'
import FullArtModeControls from './editor/FullArtModeControls'
import CardPreview from './preview/CardPreview'
import { exportCardToPNG, downloadBlob } from './preview/ExportCanvas'

const CARD_TYPES = ['player', 'god', 'item', 'consumable', 'minion', 'buff', 'custom']
const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'full_art']

const STATUS_COLORS = {
    draft: 'bg-gray-600',
    pending_review: 'bg-yellow-600',
    approved: 'bg-green-600',
    rejected: 'bg-red-600',
}

const inputClass = 'px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500'

function defaultTemplateData(cardType, rarity) {
    return {
        mode: 'template',
        baseCard: {
            type: cardType,
            frameStyle: 'default',
            rarity,
            holoType: null,
            customName: '',
            customStats: null,
            customImage: '',
            flavorText: '',
        },
        layers: [],
    }
}

export default function CardCreator() {
    const { hasPermission } = useAuth()
    const canApprove = hasPermission('vault_approve')
    const [mode, setMode] = useState('template')
    const [cardType, setCardType] = useState('player')
    const [rarity, setRarity] = useState('common')
    const [name, setName] = useState('')

    const [templateData, setTemplateData] = useState(() => defaultTemplateData('player', 'common'))

    const [selectedLayerId, setSelectedLayerId] = useState(null)
    const [saveTarget, setSaveTarget] = useState(null)
    const [status, setStatus] = useState('draft')
    const [dirty, setDirty] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    const markDirty = useCallback(() => setDirty(true), [])

    const handleModeSwitch = useCallback((newMode) => {
        setMode(newMode)
        if (newMode === 'template' && rarity === 'full_art') {
            setRarity('common')
            setTemplateData(prev => ({
                ...prev,
                mode: 'template',
                baseCard: { ...prev.baseCard, rarity: 'common' },
            }))
        } else {
            setTemplateData(prev => ({ ...prev, mode: newMode }))
        }
        markDirty()
    }, [rarity, markDirty])

    const handleRarityChange = useCallback((newRarity) => {
        setRarity(newRarity)
        if (newRarity === 'full_art') {
            setMode('full_art')
            setTemplateData(prev => ({
                ...prev,
                mode: 'full_art',
                baseCard: { ...prev.baseCard, rarity: newRarity },
            }))
        } else {
            setTemplateData(prev => ({
                ...prev,
                baseCard: { ...prev.baseCard, rarity: newRarity },
            }))
        }
        markDirty()
    }, [markDirty])

    const handleCardTypeChange = useCallback((newType) => {
        setCardType(newType)
        setTemplateData(prev => ({
            ...prev,
            baseCard: { ...prev.baseCard, type: newType },
        }))
        markDirty()
    }, [markDirty])

    const handleBaseCardUpdate = useCallback((updates) => {
        setTemplateData(prev => ({
            ...prev,
            baseCard: { ...prev.baseCard, ...updates },
        }))
        markDirty()
    }, [markDirty])

    const handleSave = useCallback(async (type) => {
        setSaving(true)
        setError(null)
        try {
            const data = {
                ...templateData,
                mode,
                baseCard: { ...templateData.baseCard, type: cardType, rarity },
            }
            const payload = { name: name || 'Untitled', card_type: cardType, rarity, template_data: data }
            let result
            if (type === 'template') {
                if (saveTarget?.type === 'template' && saveTarget.id) {
                    payload.id = saveTarget.id
                }
                result = await vaultDashboardService.saveTemplate(payload)
                setSaveTarget({ type: 'template', id: result.template?.id || saveTarget?.id })
                setStatus(result.template?.status || 'draft')
            } else {
                if (saveTarget?.type === 'draft' && saveTarget.id) {
                    payload.id = saveTarget.id
                }
                result = await vaultDashboardService.saveDraft(payload)
                setSaveTarget({ type: 'draft', id: result.draft?.id || saveTarget?.id })
                setStatus(result.draft?.status || 'draft')
            }
            setDirty(false)
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }, [name, cardType, rarity, mode, templateData, saveTarget])

    const handleSubmitForReview = useCallback(async () => {
        if (!saveTarget) return
        setSaving(true)
        setError(null)
        try {
            await vaultDashboardService.submitForReview(saveTarget.type, saveTarget.id)
            setStatus('pending_review')
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }, [saveTarget])

    const handleApprove = useCallback(async () => {
        if (!saveTarget) return
        setSaving(true)
        try {
            await vaultDashboardService.approve(saveTarget.type, saveTarget.id)
            setStatus('approved')
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }, [saveTarget])

    const handleReject = useCallback(async () => {
        if (!saveTarget) return
        setSaving(true)
        try {
            await vaultDashboardService.reject(saveTarget.type, saveTarget.id)
            setStatus('rejected')
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }, [saveTarget])

    const handleExportPng = useCallback(async () => {
        const el = document.querySelector('[data-card-preview]')
        if (!el) return
        const blob = await exportCardToPNG(el)
        if (blob) {
            downloadBlob(blob, `${name || 'card'}.png`)
            if (saveTarget) {
                const file = new File([blob], 'thumbnail.png', { type: 'image/png' })
                await vaultDashboardService.exportThumbnail(file, saveTarget.type, saveTarget.id)
            }
        }
    }, [name, saveTarget])

    // Upload image to R2 and replace blob URL in the layer
    const handleUploadImage = useCallback(async (file, layerId) => {
        try {
            const res = await vaultDashboardService.uploadAsset(file, {
                name: file.name.replace(/\.[^.]+$/, ''),
                category: 'character',
                tags: [],
            })
            if (res.success && res.asset?.url) {
                setTemplateData(prev => ({
                    ...prev,
                    layers: (prev.layers || []).map(l =>
                        l.id === layerId
                            ? { ...l, url: res.asset.url, assetId: res.asset.id, _pendingFile: undefined }
                            : l
                    ),
                }))
            }
        } catch (e) {
            console.error('Image upload failed:', e)
        }
    }, [])

    // Handle image drop on the canvas — create layer + upload
    const handleDropImage = useCallback((file) => {
        const objectUrl = URL.createObjectURL(file)
        const layers = templateData.layers || []
        const count = layers.filter(l => l.type === 'image').length
        const layerName = count === 0 ? 'Background' : count === 1 ? 'Character' : `Image ${count + 1}`
        const layerId = `image-drop-${Date.now()}`
        const newLayer = {
            id: layerId,
            type: 'image',
            name: layerName,
            url: objectUrl,
            _pendingFile: file,
            position: { x: 0, y: 0 },
            size: { w: '100%', h: '100%' },
            z: layers.length,
            opacity: 1,
            blendMode: 'normal',
            visible: true,
        }
        setTemplateData(prev => ({ ...prev, layers: [...(prev.layers || []), newLayer] }))
        setSelectedLayerId(layerId)
        markDirty()
        handleUploadImage(file, layerId)
    }, [templateData.layers, markDirty, handleUploadImage])

    return (
        <div className="flex flex-col h-full">
            {/* Top Bar */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-700 flex-wrap">
                <input
                    type="text"
                    value={name}
                    onChange={e => { setName(e.target.value); markDirty() }}
                    placeholder="Card name..."
                    className={`${inputClass} w-48`}
                />

                {/* Mode toggle */}
                <div className="flex rounded-lg overflow-hidden border border-gray-700">
                    <button
                        onClick={() => handleModeSwitch('template')}
                        className={`px-3 py-1.5 text-sm transition-colors ${mode === 'template' ? 'bg-amber-600 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        Template
                    </button>
                    <button
                        onClick={() => handleModeSwitch('full_art')}
                        className={`px-3 py-1.5 text-sm transition-colors ${mode === 'full_art' ? 'bg-amber-600 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        Full Art
                    </button>
                </div>

                <select
                    value={cardType}
                    onChange={e => handleCardTypeChange(e.target.value)}
                    className={inputClass}
                >
                    {CARD_TYPES.map(t => (
                        <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                </select>

                <select
                    value={rarity}
                    onChange={e => handleRarityChange(e.target.value)}
                    className={inputClass}
                >
                    {RARITIES.map(r => (
                        <option key={r} value={r}>
                            {r === 'full_art' ? 'Full Art' : r.charAt(0).toUpperCase() + r.slice(1)}
                        </option>
                    ))}
                </select>

                <div className="flex-1" />

                <button
                    onClick={() => handleSave('draft')}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                >
                    <Save size={14} />
                    Save Draft
                </button>
                <button
                    onClick={() => handleSave('template')}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-700 hover:bg-amber-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                >
                    <Save size={14} />
                    Save Template
                </button>
                <button
                    onClick={handleExportPng}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                >
                    <Download size={14} />
                    Export PNG
                </button>
            </div>

            {/* Error display */}
            {error && (
                <div className="px-4 py-2 bg-red-900/50 border-b border-red-700 text-red-300 text-sm">
                    {error}
                </div>
            )}

            {/* Main Area */}
            <div className="flex flex-1 gap-4 p-4 overflow-hidden">
                {/* Left panel — controls */}
                <div className="w-[400px] overflow-y-auto pr-2">
                    {mode === 'template' ? (
                        <TemplateModeControls
                            cardType={cardType}
                            rarity={rarity}
                            baseCard={templateData.baseCard}
                            onUpdate={handleBaseCardUpdate}
                        />
                    ) : (
                        <FullArtModeControls
                            layers={templateData.layers || []}
                            onLayersChange={(layers) => {
                                setTemplateData(prev => ({ ...prev, layers }))
                                markDirty()
                            }}
                            onUploadImage={handleUploadImage}
                        />
                    )}
                </div>

                {/* Right panel — preview */}
                <div className="flex-1 flex items-center justify-center">
                    <CardPreview
                        mode={mode}
                        templateData={templateData}
                        onDropImage={handleDropImage}
                        selectedLayerId={selectedLayerId}
                        onSelectLayer={setSelectedLayerId}
                    />
                </div>
            </div>

            {/* Status Bar */}
            <div className="flex items-center gap-3 px-4 py-2 border-t border-gray-700 text-sm">
                <span className={`w-2 h-2 rounded-full ${dirty ? 'bg-yellow-400' : 'bg-green-400'}`} />
                <span className="text-gray-400">{dirty ? 'Unsaved changes' : 'Saved'}</span>

                <span className={`px-2 py-0.5 rounded text-xs text-white ${STATUS_COLORS[status] || 'bg-gray-600'}`}>
                    {status.replace('_', ' ')}
                </span>

                <div className="flex-1" />

                {status === 'draft' && saveTarget && (
                    <button
                        onClick={handleSubmitForReview}
                        disabled={saving || dirty}
                        className="flex items-center gap-1.5 px-3 py-1 bg-blue-700 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                    >
                        <Send size={14} />
                        Submit for Review
                    </button>
                )}

                {canApprove && status === 'pending_review' && (
                    <>
                        <button
                            onClick={handleApprove}
                            disabled={saving}
                            className="flex items-center gap-1.5 px-3 py-1 bg-green-700 hover:bg-green-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                        >
                            <Check size={14} />
                            Approve
                        </button>
                        <button
                            onClick={handleReject}
                            disabled={saving}
                            className="flex items-center gap-1.5 px-3 py-1 bg-red-700 hover:bg-red-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                        >
                            <X size={14} />
                            Reject
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}

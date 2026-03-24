import { useState, useRef } from 'react'
import { ImagePlus, X } from 'lucide-react'
import StructuredCard from '../preview/StructuredCard'
import MiniCardPreview from '../preview/MiniCardPreview'
import TradingCardHolo from '../../../components/TradingCardHolo'
import { RARITIES, RARITY_HOLO_MAP } from '../../../data/vault/economy'
import { STAFF_CARD_THEMES } from '../preview/prebuiltRenderers'

const STRUCTURED_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary']
const FULL_ART_RARITIES = ['mythic', 'unique']

const HOLO_EFFECTS = [
    'none', 'common', 'amazing',
    'galaxy', 'vstar', 'shiny', 'ultra',
    'radiant', 'sparkle', 'rainbow-alt', 'cosmos',
    'rainbow', 'secret', 'gold',
]

const input = 'px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500'
const label = 'block text-[10px] text-gray-500 mb-1 uppercase tracking-wider'

export default function RarityStrip({ cardData, onCardDataChange, cardType, elements, border, onUploadRarityImage }) {
    const [selected, setSelected] = useState(null)
    const [dragOver, setDragOver] = useState(null)
    const fileRef = useRef(null)
    const overrides = cardData.rarityOverrides || {}

    const footerEl = elements.find(el => el.type === 'footer' && el.visible !== false)
    const bannerEl = elements.find(el => el.type === 'name-banner' && el.visible !== false)
    const subtitleEl = elements.find(el => el.type === 'subtitle' && el.visible !== false)

    // Convert canvas stats-block / text-block elements into structured card blocks
    const canvasBlocks = (() => {
        const visible = elements.filter(el => el.visible !== false && (el.type === 'stats-block' || el.type === 'text-block'))
        if (!visible.length) return null
        // Sort by vertical position so they appear in order
        const sorted = [...visible].sort((a, b) => (a.y ?? 0) - (b.y ?? 0))
        return sorted.map(el => {
            if (el.type === 'stats-block') {
                return { type: 'stats', rows: el.rows || [] }
            }
            return { type: 'text', title: el.title || '', content: el.content || '' }
        })
    })()

    const updateOverride = (rarity, updates) => {
        const current = overrides[rarity] || {}
        onCardDataChange({
            ...cardData,
            rarityOverrides: {
                ...overrides,
                [rarity]: { ...current, ...updates },
            },
        })
    }

    const getOverride = (rarity) => overrides[rarity] || {}
    const sel = selected ? getOverride(selected) : null

    const handleDrop = (e) => {
        e.preventDefault()
        setDragOver(null)
        const file = e.dataTransfer?.files?.[0]
        if (!file || !file.type.startsWith('image/')) return
        handleImageFile(file)
    }

    const handleImageFile = (file) => {
        const url = URL.createObjectURL(file)
        onCardDataChange({ ...cardData, imageUrl: url })
        if (onUploadRarityImage) onUploadRarityImage(file)
    }

    const handleFilePick = (e) => {
        const file = e.target.files?.[0]
        if (file) handleImageFile(file)
        e.target.value = ''
    }

    return (
        <div className="w-full">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFilePick} />

            {/* Shared image controls */}
            <div className="flex items-center justify-center gap-3 mb-3">
                <button onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 hover:text-white hover:border-amber-500 transition-colors">
                    <ImagePlus size={12} /> Set Image
                </button>
                <span className="text-[10px] text-gray-500">or drag & drop onto any card</span>
                {cardData.imageUrl && (
                    <>
                        <button onClick={() => onCardDataChange({ ...cardData, imageUrl: '' })}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] text-red-400 hover:text-red-300 bg-red-500/10 rounded transition-colors">
                            <X size={10} /> Clear
                        </button>
                        <div className="flex items-center gap-2 ml-2">
                            <label className="text-[10px] text-gray-500">X:{cardData.imageX ?? 50}%</label>
                            <input type="range" min={0} max={100} value={cardData.imageX ?? 50}
                                onChange={e => onCardDataChange({ ...cardData, imageX: parseInt(e.target.value) })}
                                className="w-20 accent-amber-500" />
                            <label className="text-[10px] text-gray-500">Y:{cardData.imageY ?? 50}%</label>
                            <input type="range" min={0} max={100} value={cardData.imageY ?? 50}
                                onChange={e => onCardDataChange({ ...cardData, imageY: parseInt(e.target.value) })}
                                className="w-20 accent-amber-500" />
                            <label className="text-[10px] text-gray-500">Zoom:{cardData.imageZoom ?? 100}%</label>
                            <input type="range" min={100} max={300} value={cardData.imageZoom ?? 100}
                                onChange={e => onCardDataChange({ ...cardData, imageZoom: parseInt(e.target.value) })}
                                className="w-20 accent-amber-500" />
                            <input
                                type="color"
                                value={cardData.imageBgColor || '#000000'}
                                onChange={e => onCardDataChange({ ...cardData, imageBgColor: e.target.value })}
                                className="w-6 h-6 rounded border border-gray-700 cursor-pointer bg-transparent"
                                title="Image background color"
                            />
                            {cardData.imageBgColor && (
                                <button onClick={() => { const { imageBgColor, ...rest } = cardData; onCardDataChange(rest) }}
                                    className="text-[10px] text-red-400 hover:text-red-300">
                                    <X size={10} />
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Rarity previews row */}
            <div className="flex items-end justify-center gap-3 flex-wrap"
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(null)}
                onDrop={handleDrop}
            >
                {STRUCTURED_RARITIES.map(r => {
                    const o = getOverride(r)
                    const holoEffect = o.holoEffect || RARITY_HOLO_MAP[r] || 'common'
                    const card = (
                        <StructuredCard
                            cardData={cardData}
                            rarity={r}
                            cardType={cardType}
                            size="120px"
                            overrides={o}
                            footer={footerEl}
                            banner={bannerEl}
                            subtitleEl={subtitleEl}
                            canvasBlocks={canvasBlocks}
                        />
                    )
                    return (
                        <div key={r}
                            className={`cursor-pointer rounded-lg p-1.5 transition-all ${
                                selected === r
                                    ? 'bg-gray-800/80 ring-2 ring-amber-500/60 scale-105'
                                    : 'hover:bg-gray-800/40'
                            } ${dragOver ? 'ring-2 ring-blue-400/40' : ''}`}
                            onClick={() => setSelected(selected === r ? null : r)}
                        >
                            {holoEffect !== 'none' ? (
                                <TradingCardHolo rarity={holoEffect} role={cardData.role || 'adc'} holoType="full" size="120px">
                                    {card}
                                </TradingCardHolo>
                            ) : card}
                            <p className="text-center text-[10px] mt-1 font-semibold" style={{ color: RARITIES[r]?.color }}>
                                {RARITIES[r]?.name}
                            </p>
                        </div>
                    )
                })}

                {FULL_ART_RARITIES.map(r => (
                    <div key={r} className="rounded-lg p-1.5 opacity-50">
                        <MiniCardPreview templateData={{ elements, border }} />
                        <p className="text-center text-[10px] mt-1 font-semibold" style={{ color: RARITIES[r]?.color }}>
                            {RARITIES[r]?.name}
                        </p>
                    </div>
                ))}
            </div>

            {/* Enlarged preview + controls */}
            {selected && sel && (
                <div className="mt-4 flex items-start justify-center gap-6">
                    {/* Big preview */}
                    <div className="flex flex-col items-center">
                        {(() => {
                            const o = getOverride(selected)
                            const holoEffect = o.holoEffect || RARITY_HOLO_MAP[selected] || 'common'
                            const bigCard = (
                                <StructuredCard
                                    cardData={cardData}
                                    rarity={selected}
                                    cardType={cardType}
                                    size="240px"
                                    overrides={o}
                                    footer={footerEl}
                                    banner={bannerEl}
                                    subtitleEl={subtitleEl}
                                    canvasBlocks={canvasBlocks}
                                />
                            )
                            return holoEffect !== 'none' ? (
                                <TradingCardHolo rarity={holoEffect} role={cardData.role || 'adc'} holoType="full" size="240px">
                                    {bigCard}
                                </TradingCardHolo>
                            ) : bigCard
                        })()}
                        <p className="text-center text-xs mt-2 font-semibold" style={{ color: RARITIES[selected]?.color }}>
                            {RARITIES[selected]?.name}
                        </p>
                    </div>

                    {/* Settings */}
                <div className="bg-gray-900/70 border border-gray-700/50 rounded-xl p-4 min-w-[280px]">
                    <h4 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: RARITIES[selected]?.color }}>
                        {RARITIES[selected]?.name} Settings
                    </h4>

                    {/* Staff card theme picker */}
                    {(cardData.role === 'staff' || cardData.role === 'cheerleader') && (
                        <div className="mb-3">
                            <label className={label}>Card Theme</label>
                            <div className="grid grid-cols-4 gap-1.5">
                                {Object.entries(STAFF_CARD_THEMES).map(([key, theme]) => {
                                    const active = (cardData.staffTheme || 'gold') === key
                                    return (
                                        <button key={key} onClick={() => onCardDataChange({ ...cardData, staffTheme: key })}
                                            className={`px-1.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                                                active
                                                    ? 'ring-2 ring-amber-500/60 scale-105'
                                                    : 'hover:opacity-80'
                                            }`}
                                            style={{
                                                background: theme.bodyBg,
                                                color: theme.textBright,
                                                border: `1px solid ${theme.bodyBorder}`,
                                            }}
                                        >
                                            <span style={{ color: theme.accentLight }}>{theme.label}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={label}>Holo Effect</label>
                            <select
                                value={sel.holoEffect || RARITY_HOLO_MAP[selected] || 'common'}
                                onChange={e => updateOverride(selected, { holoEffect: e.target.value })}
                                className={`${input} w-full`}
                            >
                                {HOLO_EFFECTS.map(h => (
                                    <option key={h} value={h}>{h === 'none' ? 'None' : h}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={label}>Background</label>
                            <div className="flex gap-1">
                                <input
                                    type="color"
                                    value={sel.bgColor || '#1a1a2e'}
                                    onChange={e => updateOverride(selected, { bgColor: e.target.value })}
                                    className="w-8 h-8 rounded border border-gray-700 cursor-pointer bg-transparent"
                                />
                                <input
                                    type="text"
                                    value={sel.bgColor || ''}
                                    onChange={e => updateOverride(selected, { bgColor: e.target.value })}
                                    placeholder="Auto"
                                    className={`${input} flex-1`}
                                />
                            </div>
                        </div>
                    </div>
                </div>
                </div>
            )}
        </div>
    )
}

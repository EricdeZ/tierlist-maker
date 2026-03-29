# Card Fan Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fan showcase tool inside CollectionShowcase that lets staff select 1-5 cards, arrange them in a configurable fanned layout, and export a transparent PNG.

**Architecture:** Single new component `FanShowcase.jsx` rendered at the top of the existing `CollectionShowcase.jsx`. Uses existing `VaultCard` for rendering, `html-to-image` for export. No API changes needed — collection entries are already loaded.

**Tech Stack:** React 19, Tailwind CSS 4, html-to-image (existing dep), VaultCard component

---

### File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/pages/vault-dashboard/FanShowcase.jsx` | Create | Card picker, fan preview with CSS transforms, control sliders, PNG export |
| `src/pages/vault-dashboard/CollectionShowcase.jsx` | Modify | Import and render `FanShowcase` above entry rows, pass entries + collection |

---

### Task 1: Create FanShowcase component with card selection

**Files:**
- Create: `src/pages/vault-dashboard/FanShowcase.jsx`

- [ ] **Step 1: Create FanShowcase with card picker UI**

```jsx
import { useState, useRef, useCallback } from 'react'
import { toPng } from 'html-to-image'
import { RARITIES } from '../../data/vault/economy'
import VaultCard from '../vault/components/VaultCard'
import { Download, X, ChevronDown, GripVertical, ImageIcon } from 'lucide-react'

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'unique']
const MAX_CARDS = 5

const DEFAULT_SETTINGS = {
    angle: 15,
    overlap: 40,
    cardSize: 240,
    arc: 15,
}

export default function FanShowcase({ entries, collection }) {
    const [open, setOpen] = useState(false)
    const [selected, setSelected] = useState([]) // [{ entry, rarity }]
    const [settings, setSettings] = useState(DEFAULT_SETTINGS)
    const [exporting, setExporting] = useState(false)
    const fanRef = useRef(null)

    const addCard = useCallback((entry, rarity = 'rare') => {
        if (selected.length >= MAX_CARDS) return
        setSelected(prev => [...prev, { entry, rarity, id: `${entry.id}-${Date.now()}` }])
    }, [selected.length])

    const removeCard = useCallback((id) => {
        setSelected(prev => prev.filter(s => s.id !== id))
    }, [])

    const updateRarity = useCallback((id, rarity) => {
        setSelected(prev => prev.map(s => s.id === id ? { ...s, rarity } : s))
    }, [])

    const moveCard = useCallback((fromIdx, toIdx) => {
        setSelected(prev => {
            const next = [...prev]
            const [moved] = next.splice(fromIdx, 1)
            next.splice(toIdx, 0, moved)
            return next
        })
    }, [])

    const updateSetting = useCallback((key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }))
    }, [])

    const exportPNG = useCallback(async () => {
        if (!fanRef.current || selected.length === 0) return
        setExporting(true)
        try {
            const el = fanRef.current
            const rect = el.getBoundingClientRect()
            const dataUrl = await toPng(el, {
                width: Math.ceil(rect.width),
                height: Math.ceil(rect.height),
                pixelRatio: 2,
                backgroundColor: null,
                filter: (node) => !node.dataset?.fanBg,
            })
            const a = document.createElement('a')
            a.href = dataUrl
            a.download = `${collection?.slug || 'showcase'}-fan.png`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
        } catch (err) {
            console.error('Fan export failed:', err)
        } finally {
            setExporting(false)
        }
    }, [selected, collection])

    if (!open) {
        return (
            <button
                onClick={() => setOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 border border-amber-600/30 transition-colors cursor-pointer mb-6"
            >
                <ImageIcon className="w-4 h-4" />
                Generate Promo Image
            </button>
        )
    }

    return (
        <div className="mb-8 bg-white/[0.02] border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-white">Fan Showcase</h2>
                <button onClick={() => setOpen(false)} className="text-white/30 hover:text-white/60 cursor-pointer">
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Card Picker */}
            <div className="mb-4">
                <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">
                    Click a card to add ({selected.length}/{MAX_CARDS})
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {entries.map(entry => {
                        const td = typeof entry.template_data === 'string' ? JSON.parse(entry.template_data) : entry.template_data
                        return (
                            <button
                                key={entry.id}
                                onClick={() => addCard(entry)}
                                disabled={selected.length >= MAX_CARDS}
                                className="flex-shrink-0 flex flex-col items-center gap-1 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed group"
                            >
                                <div className="rounded overflow-hidden ring-1 ring-white/10 group-hover:ring-amber-500/50 transition-all">
                                    <VaultCard
                                        card={{
                                            rarity: 'rare',
                                            cardType: entry.card_type || 'custom',
                                            blueprintId: entry.blueprint_id,
                                            _blueprintData: {
                                                elements: td?.elements,
                                                border: td?.border,
                                                cardData: td?.cardData,
                                                cardType: entry.card_type || 'custom',
                                            },
                                        }}
                                        size={60}
                                    />
                                </div>
                                <span className="text-[9px] text-white/40 max-w-[60px] truncate">{entry.template_name}</span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Selected Cards with Rarity Pickers */}
            {selected.length > 0 && (
                <div className="mb-4">
                    <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Selected — drag to reorder</div>
                    <div className="flex gap-2 flex-wrap">
                        {selected.map((sel, idx) => (
                            <SelectedCard
                                key={sel.id}
                                sel={sel}
                                idx={idx}
                                total={selected.length}
                                onRemove={() => removeCard(sel.id)}
                                onRarityChange={(r) => updateRarity(sel.id, r)}
                                onMoveLeft={idx > 0 ? () => moveCard(idx, idx - 1) : null}
                                onMoveRight={idx < selected.length - 1 ? () => moveCard(idx, idx + 1) : null}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Fan Preview */}
            {selected.length > 0 && (
                <div className="mb-4">
                    <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Preview</div>
                    <div className="relative rounded-lg overflow-hidden" style={{ background: 'repeating-conic-gradient(#1a1a2e 0% 25%, #12121f 0% 50%) 0 0 / 20px 20px' }}>
                        <div data-fan-bg="true" className="absolute inset-0" style={{ background: 'repeating-conic-gradient(#1a1a2e 0% 25%, #12121f 0% 50%) 0 0 / 20px 20px' }} />
                        <FanPreview ref={fanRef} selected={selected} settings={settings} entries={entries} />
                    </div>
                </div>
            )}

            {/* Controls */}
            {selected.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <SliderControl label="Fan Angle" value={settings.angle} min={5} max={40} unit="°" onChange={v => updateSetting('angle', v)} />
                    <SliderControl label="Overlap" value={settings.overlap} min={20} max={80} unit="%" onChange={v => updateSetting('overlap', v)} />
                    <SliderControl label="Card Size" value={settings.cardSize} min={150} max={350} unit="px" onChange={v => updateSetting('cardSize', v)} />
                    <SliderControl label="Arc" value={settings.arc} min={0} max={50} unit="px" onChange={v => updateSetting('arc', v)} />
                </div>
            )}

            {/* Export */}
            {selected.length > 0 && (
                <button
                    onClick={exportPNG}
                    disabled={exporting}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer disabled:opacity-50"
                >
                    <Download className="w-3.5 h-3.5" />
                    {exporting ? 'Exporting...' : 'Export PNG (Transparent)'}
                </button>
            )}
        </div>
    )
}

/* --- Sub-components --- */

function SelectedCard({ sel, idx, total, onRemove, onRarityChange, onMoveLeft, onMoveRight }) {
    const [pickerOpen, setPickerOpen] = useState(false)
    const td = typeof sel.entry.template_data === 'string' ? JSON.parse(sel.entry.template_data) : sel.entry.template_data

    return (
        <div className="relative flex flex-col items-center gap-1 bg-white/5 rounded-lg p-2">
            <div className="flex items-center gap-1 mb-1">
                {onMoveLeft && (
                    <button onClick={onMoveLeft} className="text-white/20 hover:text-white/50 cursor-pointer text-[10px]">&larr;</button>
                )}
                <span className="text-[9px] text-white/30 font-mono">{idx + 1}</span>
                {onMoveRight && (
                    <button onClick={onMoveRight} className="text-white/20 hover:text-white/50 cursor-pointer text-[10px]">&rarr;</button>
                )}
            </div>
            <div className="rounded overflow-hidden">
                <VaultCard
                    card={{
                        rarity: sel.rarity,
                        cardType: sel.entry.card_type || 'custom',
                        blueprintId: sel.entry.blueprint_id,
                        _blueprintData: {
                            elements: td?.elements,
                            border: td?.border,
                            cardData: td?.cardData,
                            cardType: sel.entry.card_type || 'custom',
                        },
                    }}
                    size={50}
                />
            </div>
            {/* Rarity picker */}
            <div className="relative">
                <button
                    onClick={() => setPickerOpen(!pickerOpen)}
                    className="flex items-center gap-0.5 text-[9px] font-bold cursor-pointer px-1.5 py-0.5 rounded"
                    style={{ color: RARITIES[sel.rarity]?.color || '#9ca3af' }}
                >
                    {RARITIES[sel.rarity]?.name || sel.rarity}
                    <ChevronDown className="w-2.5 h-2.5" />
                </button>
                {pickerOpen && (
                    <div className="absolute z-20 top-full left-0 mt-1 bg-gray-900 border border-white/10 rounded-lg py-1 min-w-[80px] shadow-xl">
                        {RARITY_ORDER.map(r => (
                            <button
                                key={r}
                                onClick={() => { onRarityChange(r); setPickerOpen(false) }}
                                className="block w-full text-left px-2 py-1 text-[10px] font-bold hover:bg-white/10 cursor-pointer"
                                style={{ color: RARITIES[r]?.color || '#9ca3af' }}
                            >
                                {RARITIES[r]?.name || r}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <button
                onClick={onRemove}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center text-[8px] hover:bg-red-500 cursor-pointer"
            >
                <X className="w-2.5 h-2.5" />
            </button>
        </div>
    )
}

import { forwardRef } from 'react'

const FanPreview = forwardRef(function FanPreview({ selected, settings, entries }, ref) {
    const { angle, overlap, cardSize, arc } = settings
    const count = selected.length
    const cardHeight = cardSize * (88 / 63)
    const center = (count - 1) / 2

    // Calculate spacing from overlap: higher overlap% = less spacing
    const spacing = cardSize * (1 - overlap / 100)

    // Calculate total width needed
    const totalSpread = spacing * (count - 1)
    const maxRotation = angle * Math.ceil(count / 2)
    const rotationPadding = Math.sin(maxRotation * Math.PI / 180) * cardHeight * 0.5
    const containerWidth = totalSpread + cardSize + rotationPadding * 2
    const arcMax = arc * (center * center || 1)
    const containerHeight = cardHeight + arcMax + 40

    return (
        <div
            ref={ref}
            className="relative mx-auto"
            style={{
                width: containerWidth,
                height: containerHeight,
                minHeight: 200,
            }}
        >
            {selected.map((sel, idx) => {
                const td = typeof sel.entry.template_data === 'string' ? JSON.parse(sel.entry.template_data) : sel.entry.template_data
                const offset = idx - center
                const rotation = angle * offset
                const xOffset = spacing * offset
                const yOffset = arc * offset * offset

                return (
                    <div
                        key={sel.id}
                        className="absolute"
                        style={{
                            left: '50%',
                            top: 20,
                            transform: `translateX(${xOffset - cardSize / 2}px) translateY(${yOffset}px) rotate(${rotation}deg)`,
                            transformOrigin: 'center bottom',
                            zIndex: count - Math.abs(Math.round(offset)),
                            filter: `drop-shadow(0 8px 24px rgba(0,0,0,0.6))`,
                        }}
                    >
                        <VaultCard
                            card={{
                                rarity: sel.rarity,
                                cardType: sel.entry.card_type || 'custom',
                                blueprintId: sel.entry.blueprint_id,
                                _blueprintData: {
                                    elements: td?.elements,
                                    border: td?.border,
                                    cardData: td?.cardData,
                                    cardType: sel.entry.card_type || 'custom',
                                },
                            }}
                            size={cardSize}
                        />
                    </div>
                )
            })}
        </div>
    )
})

function SliderControl({ label, value, min, max, unit, onChange }) {
    return (
        <div className="bg-white/5 rounded-lg p-2">
            <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-white/40 uppercase tracking-wider">{label}</span>
                <span className="text-[11px] text-white/70 font-mono">{value}{unit}</span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                value={value}
                onChange={e => onChange(Number(e.target.value))}
                className="w-full h-1 accent-amber-500 cursor-pointer"
            />
        </div>
    )
}
```

- [ ] **Step 2: Verify the file was created correctly**

Run: `node -e "try { require.resolve('./src/pages/vault-dashboard/FanShowcase.jsx') } catch { process.exit(0) }; console.log('exists')"`

---

### Task 2: Wire FanShowcase into CollectionShowcase

**Files:**
- Modify: `src/pages/vault-dashboard/CollectionShowcase.jsx`

- [ ] **Step 1: Add FanShowcase import and render it above entry rows**

Add import at the top of the file, after existing imports:

```jsx
import FanShowcase from './FanShowcase'
```

Then in the JSX return, add `<FanShowcase>` between the description paragraph and the entries section. Replace the return block (lines 31-49) with:

```jsx
    return (
        <div className="max-w-7xl mx-auto">
            <button onClick={onBack} className="text-xs text-white/40 hover:text-white/70 mb-4 cursor-pointer">&larr; Back</button>

            <h1 className="text-xl font-bold text-white mb-1">{collection?.name || 'Collection'} — Showcase</h1>
            {collection?.description && (
                <p className="text-sm text-white/40 mb-6">{collection.description}</p>
            )}

            {entries.length > 0 && (
                <FanShowcase entries={entries} collection={collection} />
            )}

            {entries.length === 0 ? (
                <div className="text-center py-20 text-white/30 text-sm">No cards in this collection</div>
            ) : (
                <div className="space-y-8">
                    {entries.map(entry => (
                        <EntryRow key={entry.id} entry={entry} />
                    ))}
                </div>
            )}
        </div>
    )
```

- [ ] **Step 2: Verify the app compiles**

Run: `cd C:/Users/Eric/WebstormProjects/tierlist-maker && npx vite build --mode development 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add src/pages/vault-dashboard/FanShowcase.jsx src/pages/vault-dashboard/CollectionShowcase.jsx
git commit -m "feat(vault): add fan showcase tool for collection promo images"
```

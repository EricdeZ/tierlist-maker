import { useState, useEffect, useCallback } from 'react'
import { CONSUMABLES } from '../../../data/cardclash/buffs'
import { RARITIES } from '../../../data/cardclash/economy'
import { cardclashAdminService } from '../../../services/database'
import GameCard from '../../cardclash/components/GameCard'

const INPUT = 'w-full bg-[var(--color-secondary)] border border-white/10 rounded-lg px-3 py-2 text-sm'
const LABEL = 'block text-xs text-[var(--color-text-secondary)] mb-1'

export default function CCAdminConsumables() {
  const [selectedConsumable, setSelectedConsumable] = useState(null)
  const [previewRarity, setPreviewRarity] = useState('rare')
  const [overrides, setOverrides] = useState({})

  useEffect(() => {
    cardclashAdminService.getDefinitionOverrides('consumable').then(data => {
      const map = {}
      for (const o of (data.overrides || [])) {
        map[o.definitionId] = o.metadata
      }
      setOverrides(map)
    }).catch(() => {})
  }, [])

  const getConsumableWithOverride = useCallback((c) => {
    const override = overrides[c.id]
    if (!override) return c
    return {
      ...c,
      ...override.name && { name: override.name },
      ...override.description && { description: override.description },
      ...override.color && { color: override.color },
      ...override.manaCost !== undefined && { manaCost: override.manaCost },
      ...override.uses !== undefined && { uses: override.uses },
      metadata: override,
      imageUrl: override.custom_image_url || c.imageUrl,
    }
  }, [overrides])

  const handleSaveOverride = async (consumable, metadata) => {
    await cardclashAdminService.saveDefinitionOverride('consumable', consumable.id, metadata)
    setOverrides(prev => ({ ...prev, [consumable.id]: metadata }))
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-1 items-center">
        <span className="text-xs text-[var(--color-text-secondary)] mr-2">Preview rarity:</span>
        {['common', 'uncommon', 'rare', 'epic', 'legendary'].map(r => (
          <button key={r} onClick={() => setPreviewRarity(r)}
            className={`px-2 py-1 text-xs rounded font-bold capitalize ${previewRarity === r ? 'text-black' : 'bg-[var(--color-secondary)] text-[var(--color-text-secondary)]'}`}
            style={previewRarity === r ? { backgroundColor: RARITIES[r]?.color } : undefined}>{r}</button>
        ))}
      </div>

      <div className="flex flex-wrap gap-4">
        {CONSUMABLES.map(c => (
          <div key={c.id} onClick={() => setSelectedConsumable(c)} className="cursor-pointer hover:scale-105 transition-transform">
            <GameCard type="consumable" rarity={previewRarity} data={getConsumableWithOverride(c)} />
            <div className="text-center mt-1 text-xs text-[var(--color-text-secondary)]">
              {overrides[c.id] ? <span className="text-amber-400">Custom</span> : 'Default'}
            </div>
          </div>
        ))}
      </div>

      {/* Table view */}
      <div className="bg-[var(--color-secondary)] rounded-xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs text-[var(--color-text-secondary)] uppercase tracking-wider">
                <th className="p-3">ID</th>
                <th className="p-3">Name</th>
                <th className="p-3">Uses</th>
                <th className="p-3">Mana</th>
                <th className="p-3">Description</th>
                <th className="p-3">Override</th>
              </tr>
            </thead>
            <tbody>
              {CONSUMABLES.map(c => (
                <tr key={c.id} className="border-b border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => setSelectedConsumable(c)}>
                  <td className="p-3 text-xs text-[var(--color-text-secondary)]">{c.id}</td>
                  <td className="p-3 font-medium">
                    <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: c.color }} />
                    {c.name}
                  </td>
                  <td className="p-3 font-mono text-xs">{c.uses}</td>
                  <td className="p-3 font-mono text-xs">{c.manaCost}</td>
                  <td className="p-3 text-xs max-w-sm truncate text-[var(--color-text-secondary)]">{c.description}</td>
                  <td className="p-3 text-xs">
                    {overrides[c.id] ? <span className="text-amber-400">Custom</span> : <span className="text-[var(--color-text-secondary)]">Default</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t border-white/10 text-xs text-[var(--color-text-secondary)]">{CONSUMABLES.length} consumables total</div>
      </div>

      {selectedConsumable && (
        <ConsumableDetailModal
          consumable={selectedConsumable}
          override={overrides[selectedConsumable.id] || {}}
          onSave={handleSaveOverride}
          onClose={() => setSelectedConsumable(null)}
        />
      )}
    </div>
  )
}

function ConsumableDetailModal({ consumable, override, onSave, onClose }) {
  const [offsetX, setOffsetX] = useState(override.image_offset_x || 0)
  const [offsetY, setOffsetY] = useState(override.image_offset_y || 0)
  const [zoom, setZoom] = useState(override.image_zoom || 1)
  const [customImageUrl, setCustomImageUrl] = useState(override.custom_image_url || '')

  const [name, setName] = useState(override.name || consumable.name)
  const [description, setDescription] = useState(override.description || consumable.description)
  const [color, setColor] = useState(override.color || consumable.color)
  const [manaCost, setManaCost] = useState(override.manaCost ?? consumable.manaCost)
  const [uses, setUses] = useState(override.uses ?? consumable.uses)

  const [saving, setSaving] = useState(false)
  const [previewRarity, setPreviewRarity] = useState('rare')

  const buildMetadata = () => {
    const metadata = {}
    if (offsetX !== 0) metadata.image_offset_x = offsetX
    if (offsetY !== 0) metadata.image_offset_y = offsetY
    if (zoom !== 1) metadata.image_zoom = zoom
    if (customImageUrl) metadata.custom_image_url = customImageUrl
    if (name !== consumable.name) metadata.name = name
    if (description !== consumable.description) metadata.description = description
    if (color !== consumable.color) metadata.color = color
    if (Number(manaCost) !== consumable.manaCost) metadata.manaCost = Number(manaCost)
    if (Number(uses) !== consumable.uses) metadata.uses = Number(uses)
    return metadata
  }

  const hasChanges = JSON.stringify(buildMetadata()) !== JSON.stringify(
    Object.keys(override).length ? override : {}
  )

  const handleSave = async () => {
    setSaving(true)
    await onSave(consumable, buildMetadata())
    setSaving(false)
  }

  const handleReset = () => {
    setOffsetX(0); setOffsetY(0); setZoom(1); setCustomImageUrl('')
    setName(consumable.name); setDescription(consumable.description)
    setColor(consumable.color); setManaCost(consumable.manaCost); setUses(consumable.uses)
  }

  const handleMouseDown = (e) => {
    e.preventDefault()
    const startX = e.clientX, startY = e.clientY, startOX = offsetX, startOY = offsetY
    const onMove = (e) => { setOffsetX(Math.round(startOX + (e.clientX - startX))); setOffsetY(Math.round(startOY + (e.clientY - startY))) }
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const previewData = {
    ...consumable,
    name,
    description,
    color,
    manaCost: Number(manaCost),
    uses: Number(uses),
    imageUrl: customImageUrl || consumable.imageUrl,
    metadata: { image_offset_x: offsetX, image_offset_y: offsetY, image_zoom: zoom },
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--color-bg)] rounded-2xl border border-white/10 w-full max-w-3xl max-h-[90vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-lg font-bold">
            <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ backgroundColor: consumable.color }} />
            {consumable.name} <span className="text-sm text-[var(--color-text-secondary)] font-normal">({consumable.id})</span>
          </h2>
          <button onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5 grid md:grid-cols-[1fr_280px] gap-6">
          <div className="space-y-4">
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider">Card Properties</h4>

              <div>
                <label className={LABEL}>Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className={INPUT} />
              </div>

              <div>
                <label className={LABEL}>Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
                  className={INPUT + ' resize-y'} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={LABEL}>Mana Cost</label>
                  <input type="number" min={0} max={10} value={manaCost} onChange={e => setManaCost(e.target.value)} className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Uses</label>
                  <input type="number" min={1} max={10} value={uses} onChange={e => setUses(e.target.value)} className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Color</label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-8 h-8 rounded border border-white/10 cursor-pointer" />
                    <input type="text" value={color} onChange={e => setColor(e.target.value)} className={INPUT + ' font-mono'} />
                  </div>
                </div>
              </div>
            </div>

            {/* Image positioning */}
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Image Positioning</h4>

              <div>
                <label className={LABEL}>Custom Image URL (optional)</label>
                <input type="text" value={customImageUrl} onChange={e => setCustomImageUrl(e.target.value)}
                  placeholder="Leave empty for default image" className={INPUT + ' font-mono'} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={LABEL}>Offset X: {offsetX}px</label>
                  <input type="range" min={-100} max={100} value={offsetX} onChange={e => setOffsetX(parseInt(e.target.value))} className="w-full accent-amber-500" />
                </div>
                <div>
                  <label className={LABEL}>Offset Y: {offsetY}px</label>
                  <input type="range" min={-100} max={100} value={offsetY} onChange={e => setOffsetY(parseInt(e.target.value))} className="w-full accent-amber-500" />
                </div>
                <div>
                  <label className={LABEL}>Zoom: {zoom.toFixed(2)}x</label>
                  <input type="range" min={50} max={200} value={Math.round(zoom * 100)} onChange={e => setZoom(parseInt(e.target.value) / 100)} className="w-full accent-amber-500" />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={handleSave} disabled={saving || !hasChanges}
                className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold transition-colors disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={handleReset} className="text-xs text-[var(--color-text-secondary)] hover:text-white">
                Reset all to defaults
              </button>
              {!hasChanges && <span className="text-xs text-[var(--color-text-secondary)]">No changes</span>}
            </div>
          </div>

          <div className="flex flex-col items-center gap-4">
            <h4 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Live Preview</h4>
            <div className="flex gap-1 mb-2">
              {['common', 'rare', 'epic', 'legendary'].map(r => (
                <button key={r} onClick={() => setPreviewRarity(r)}
                  className={`px-2 py-0.5 text-[10px] rounded font-bold capitalize ${previewRarity === r ? 'text-black' : 'bg-[var(--color-secondary)] text-[var(--color-text-secondary)]'}`}
                  style={previewRarity === r ? { backgroundColor: RARITIES[r]?.color } : undefined}>{r}</button>
              ))}
            </div>
            <div className="cursor-grab active:cursor-grabbing" onMouseDown={handleMouseDown}>
              <GameCard type="consumable" rarity={previewRarity} data={previewData} />
            </div>
            <div className="text-center text-[10px] text-[var(--color-text-secondary)]">
              Offset: ({offsetX}, {offsetY}) &middot; Zoom: {zoom.toFixed(2)}x
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

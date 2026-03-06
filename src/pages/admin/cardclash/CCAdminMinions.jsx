import { useState, useEffect, useCallback } from 'react'
import { MINIONS } from '../../../data/cardclash/minions'
import { RARITIES } from '../../../data/cardclash/economy'
import { cardclashAdminService } from '../../../services/database'
import GameCard from '../../cardclash/components/GameCard'

export default function CCAdminMinions() {
  const [selectedMinion, setSelectedMinion] = useState(null)
  const [previewRarity, setPreviewRarity] = useState('rare')
  const [overrides, setOverrides] = useState({})

  useEffect(() => {
    cardclashAdminService.getDefinitionOverrides('minion').then(data => {
      const map = {}
      for (const o of (data.overrides || [])) {
        map[o.definitionId] = o.metadata
      }
      setOverrides(map)
    }).catch(() => {})
  }, [])

  const getMinionWithOverride = useCallback((minion) => {
    const override = overrides[minion.type]
    if (!override) return minion
    return { ...minion, metadata: override, imageUrl: override.custom_image_url || minion.imageUrl }
  }, [overrides])

  const handleSaveOverride = async (minion, metadata) => {
    await cardclashAdminService.saveDefinitionOverride('minion', minion.type, metadata)
    setOverrides(prev => ({ ...prev, [minion.type]: metadata }))
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
        {MINIONS.map(m => (
          <div key={m.type} onClick={() => setSelectedMinion(m)} className="cursor-pointer hover:scale-105 transition-transform">
            <GameCard type="minion" rarity={previewRarity} data={getMinionWithOverride(m)} />
            <div className="text-center mt-1 text-xs text-[var(--color-text-secondary)]">
              {overrides[m.type] ? <span className="text-amber-400">Custom</span> : 'Default'}
            </div>
          </div>
        ))}
      </div>

      {selectedMinion && (
        <MinionDetailModal
          minion={selectedMinion}
          override={overrides[selectedMinion.type] || {}}
          onSave={handleSaveOverride}
          onClose={() => setSelectedMinion(null)}
        />
      )}
    </div>
  )
}

function MinionDetailModal({ minion, override, onSave, onClose }) {
  const [offsetX, setOffsetX] = useState(override.image_offset_x || 0)
  const [offsetY, setOffsetY] = useState(override.image_offset_y || 0)
  const [zoom, setZoom] = useState(override.image_zoom || 1)
  const [customImageUrl, setCustomImageUrl] = useState(override.custom_image_url || '')
  const [saving, setSaving] = useState(false)
  const [previewRarity, setPreviewRarity] = useState('rare')

  const hasChanges = offsetX !== (override.image_offset_x || 0)
    || offsetY !== (override.image_offset_y || 0)
    || zoom !== (override.image_zoom || 1)
    || customImageUrl !== (override.custom_image_url || '')

  const handleSave = async () => {
    setSaving(true)
    const metadata = { image_offset_x: offsetX, image_offset_y: offsetY, image_zoom: zoom }
    if (customImageUrl) metadata.custom_image_url = customImageUrl
    await onSave(minion, metadata)
    setSaving(false)
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
    ...minion,
    imageUrl: customImageUrl || minion.imageUrl,
    metadata: { image_offset_x: offsetX, image_offset_y: offsetY, image_zoom: zoom },
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--color-bg)] rounded-2xl border border-white/10 w-full max-w-3xl max-h-[90vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-lg font-bold">{minion.name}</h2>
          <button onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5 grid md:grid-cols-[1fr_280px] gap-6">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-black/20 rounded-lg p-3">
                <div className="text-xs text-[var(--color-text-secondary)]">HP</div>
                <div className="font-bold">{minion.hp}</div>
              </div>
              <div className="bg-black/20 rounded-lg p-3">
                <div className="text-xs text-[var(--color-text-secondary)]">Attack</div>
                <div className="font-bold">{minion.attack}</div>
              </div>
              <div className="bg-black/20 rounded-lg p-3">
                <div className="text-xs text-[var(--color-text-secondary)]">Defense</div>
                <div className="font-bold">{minion.defense}</div>
              </div>
            </div>

            <div className="bg-black/20 rounded-lg p-4">
              <p className="text-sm text-[var(--color-text-secondary)]">{minion.description}</p>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Image Positioning</h4>

              <div>
                <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Custom Image URL (optional)</label>
                <input type="text" value={customImageUrl} onChange={e => setCustomImageUrl(e.target.value)}
                  placeholder="Leave empty for default image"
                  className="w-full bg-[var(--color-secondary)] border border-white/10 rounded-lg px-3 py-2 text-sm font-mono" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Offset X: {offsetX}px</label>
                  <input type="range" min={-100} max={100} value={offsetX} onChange={e => setOffsetX(parseInt(e.target.value))} className="w-full accent-amber-500" />
                </div>
                <div>
                  <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Offset Y: {offsetY}px</label>
                  <input type="range" min={-100} max={100} value={offsetY} onChange={e => setOffsetY(parseInt(e.target.value))} className="w-full accent-amber-500" />
                </div>
                <div>
                  <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Zoom: {zoom.toFixed(2)}x</label>
                  <input type="range" min={50} max={200} value={Math.round(zoom * 100)} onChange={e => setZoom(parseInt(e.target.value) / 100)} className="w-full accent-amber-500" />
                </div>
              </div>

              <button onClick={() => { setOffsetX(0); setOffsetY(0); setZoom(1); setCustomImageUrl('') }}
                className="text-xs text-[var(--color-text-secondary)] hover:text-white">Reset to defaults</button>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={handleSave} disabled={saving || !hasChanges}
                className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold transition-colors disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Image Settings'}
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
              <GameCard type="minion" rarity={previewRarity} data={previewData} />
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

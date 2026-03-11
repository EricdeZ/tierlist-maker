import { useState, useRef } from 'react'
import { RARITIES } from '../../../data/vault/economy'
import GameCard from '../../vault/components/GameCard'
import { GODS } from '../../../data/vault/gods'

const ALL_HOLO_TYPES = [
  'common', 'holo', 'amazing', 'reverse', 'galaxy', 'vstar', 'shiny', 'ultra',
  'radiant', 'sparkle', 'rainbow-alt', 'cosmos', 'rainbow', 'secret', 'gold',
]

const RARITY_OPTIONS = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']

export default function CCCardEditor({ card, onUpdate, onDelete, onClose }) {
  const [rarity, setRarity] = useState(card.rarity)
  const [holoEffect, setHoloEffect] = useState(card.holoEffect)
  const [power, setPower] = useState(card.power)
  const [level, setLevel] = useState(card.level)
  const [xp, setXp] = useState(card.xp)
  const [imageUrl, setImageUrl] = useState(card.imageUrl)
  const [metadata, setMetadata] = useState(card.metadata || {})
  const [saving, setSaving] = useState(false)

  // Image offset controls
  const [offsetX, setOffsetX] = useState(metadata.image_offset_x || 0)
  const [offsetY, setOffsetY] = useState(metadata.image_offset_y || 0)
  const [zoom, setZoom] = useState(metadata.image_zoom || 1)

  // Dragging state for image positioning
  const imageRef = useRef(null)
  const dragRef = useRef(null)

  const handleMouseDown = (e) => {
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const startOffsetX = offsetX
    const startOffsetY = offsetY

    const handleMouseMove = (e) => {
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      setOffsetX(Math.round(startOffsetX + dx))
      setOffsetY(Math.round(startOffsetY + dy))
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleSave = async () => {
    setSaving(true)
    const newMetadata = {
      ...metadata,
      image_offset_x: offsetX,
      image_offset_y: offsetY,
      image_zoom: zoom,
      holo_type: holoEffect,
    }
    await onUpdate(card.id, {
      rarity,
      holo_effect: holoEffect,
      power: parseInt(power),
      level: parseInt(level),
      xp: parseInt(xp),
      image_url: imageUrl,
      metadata: newMetadata,
    })
    setSaving(false)
  }

  // Build preview data object for GameCard
  const god = GODS.find(g => g.slug === card.godId || g.name === card.godName) || {}
  const previewData = {
    ...god,
    name: card.godName,
    class: card.godClass,
    imageUrl: imageUrl,
    serialNumber: card.serialNumber,
    ability: god.ability,
    metadata: {
      image_offset_x: offsetX,
      image_offset_y: offsetY,
      image_zoom: zoom,
    },
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[var(--color-bg)] rounded-2xl border border-white/10 w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div>
            <h2 className="text-lg font-bold">Edit Card #{card.id}</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {card.godName} &middot; Owned by {card.ownerName} &middot; {card.acquiredVia}
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 grid md:grid-cols-[1fr_280px] gap-6">
          {/* Form */}
          <div className="space-y-4">
            {/* Rarity + Holo */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">Rarity</label>
                <select
                  value={rarity}
                  onChange={e => setRarity(e.target.value)}
                  className="w-full bg-[var(--color-secondary)] border border-white/10 rounded-lg px-3 py-2 text-sm"
                >
                  {RARITY_OPTIONS.map(r => (
                    <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">Holo Effect</label>
                <select
                  value={holoEffect}
                  onChange={e => setHoloEffect(e.target.value)}
                  className="w-full bg-[var(--color-secondary)] border border-white/10 rounded-lg px-3 py-2 text-sm"
                >
                  {ALL_HOLO_TYPES.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Power / Level / XP */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">Power</label>
                <input
                  type="number"
                  value={power}
                  onChange={e => setPower(e.target.value)}
                  min={1} max={99}
                  className="w-full bg-[var(--color-secondary)] border border-white/10 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">Level</label>
                <input
                  type="number"
                  value={level}
                  onChange={e => setLevel(e.target.value)}
                  min={1} max={5}
                  className="w-full bg-[var(--color-secondary)] border border-white/10 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">XP</label>
                <input
                  type="number"
                  value={xp}
                  onChange={e => setXp(e.target.value)}
                  min={0}
                  className="w-full bg-[var(--color-secondary)] border border-white/10 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* Image URL */}
            <div>
              <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">Image URL</label>
              <input
                type="text"
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                className="w-full bg-[var(--color-secondary)] border border-white/10 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>

            {/* Image positioning */}
            <div className="bg-black/20 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Image Position</h4>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Drag the preview image to reposition, or use the sliders below.
              </p>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Offset X: {offsetX}px</label>
                  <input
                    type="range"
                    min={-100} max={100}
                    value={offsetX}
                    onChange={e => setOffsetX(parseInt(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Offset Y: {offsetY}px</label>
                  <input
                    type="range"
                    min={-100} max={100}
                    value={offsetY}
                    onChange={e => setOffsetY(parseInt(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Zoom: {zoom.toFixed(2)}x</label>
                  <input
                    type="range"
                    min={50} max={200}
                    value={Math.round(zoom * 100)}
                    onChange={e => setZoom(parseInt(e.target.value) / 100)}
                    className="w-full accent-amber-500"
                  />
                </div>
              </div>

              <button
                onClick={() => { setOffsetX(0); setOffsetY(0); setZoom(1) }}
                className="text-xs text-[var(--color-text-secondary)] hover:text-white"
              >
                Reset to defaults
              </button>
            </div>

            {/* Metadata JSON */}
            <div>
              <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">Raw Metadata (JSON)</label>
              <textarea
                value={JSON.stringify({ ...metadata, image_offset_x: offsetX, image_offset_y: offsetY, image_zoom: zoom, holo_type: holoEffect }, null, 2)}
                readOnly
                rows={4}
                className="w-full bg-[var(--color-secondary)] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-[var(--color-text-secondary)]"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={() => onDelete(card.id)}
                className="px-4 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm font-bold transition-colors border border-red-500/20"
              >
                Delete Card
              </button>
              <button onClick={onClose} className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-white">
                Cancel
              </button>
            </div>

          </div>

          {/* Live preview */}
          <div className="flex flex-col items-center gap-4">
            <h4 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Live Preview</h4>

            {/* Draggable card preview */}
            <div
              ref={imageRef}
              className="cursor-grab active:cursor-grabbing"
              onMouseDown={handleMouseDown}
            >
              <GameCard type="god" rarity={rarity} data={previewData} />
            </div>

            <div className="text-center space-y-1">
              <div className="text-xs text-[var(--color-text-secondary)]">
                <span className="font-bold" style={{ color: RARITIES[rarity]?.color }}>{rarity}</span>
                {' '}&middot; {holoEffect}
              </div>
              <div className="text-xs text-[var(--color-text-secondary)]">
                Power {power} &middot; Lvl {level} &middot; #{card.serialNumber}
              </div>
              <div className="text-[10px] text-[var(--color-text-secondary)]">
                Offset: ({offsetX}, {offsetY}) &middot; Zoom: {zoom.toFixed(2)}x
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

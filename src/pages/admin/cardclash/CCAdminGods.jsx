import { useState, useMemo, useEffect, useCallback } from 'react'
import { GODS, CLASS_ROLE, CLASS_DAMAGE, getGodImageUrl } from '../../../data/cardclash/gods'
import { RARITIES } from '../../../data/cardclash/economy'
import { cardclashAdminService } from '../../../services/database'
import GameCard from '../../cardclash/components/GameCard'

const CLASSES = ['All', 'Guardian', 'Warrior', 'Assassin', 'Mage', 'Hunter']
const ABILITY_TYPES = ['All', 'damage', 'aoe_damage', 'heal', 'buff', 'debuff', 'cc', 'execute', 'shield', 'summon', 'global', 'stealth', 'mobility', 'rotate', 'gank', 'split', 'vision', 'zone', 'objective', 'wave', 'invade']

export default function CCAdminGods() {
  const [classFilter, setClassFilter] = useState('All')
  const [abilityFilter, setAbilityFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [previewRarity, setPreviewRarity] = useState('rare')
  const [selectedGod, setSelectedGod] = useState(null)
  const [viewMode, setViewMode] = useState('table')
  const [overrides, setOverrides] = useState({})

  useEffect(() => {
    cardclashAdminService.getDefinitionOverrides('god').then(data => {
      const map = {}
      for (const o of (data.overrides || [])) {
        map[o.definitionId] = o.metadata
      }
      setOverrides(map)
    }).catch(() => {})
  }, [])

  const getGodWithOverride = useCallback((god) => {
    const override = overrides[god.slug]
    if (!override) return god
    return { ...god, metadata: override }
  }, [overrides])

  const filtered = useMemo(() => {
    let gods = [...GODS]
    if (classFilter !== 'All') gods = gods.filter(g => g.class === classFilter)
    if (abilityFilter !== 'All') gods = gods.filter(g => g.ability?.type === abilityFilter)
    if (search) gods = gods.filter(g => g.name.toLowerCase().includes(search.toLowerCase()))
    return gods
  }, [classFilter, abilityFilter, search])

  const abilityDistribution = useMemo(() => {
    const counts = {}
    GODS.forEach(g => {
      const t = g.ability?.type || 'none'
      counts[t] = (counts[t] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [])

  const handleSaveOverride = async (god, metadata) => {
    await cardclashAdminService.saveDefinitionOverride('god', god.slug, metadata)
    setOverrides(prev => ({ ...prev, [god.slug]: metadata }))
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {CLASSES.filter(c => c !== 'All').map(cls => {
          const count = GODS.filter(g => g.class === cls).length
          return (
            <div key={cls} className="bg-[var(--color-secondary)] rounded-xl border border-white/10 p-3 text-center">
              <div className="text-lg font-bold">{count}</div>
              <div className="text-xs text-[var(--color-text-secondary)]">{cls}s</div>
              <div className="text-[10px] text-[var(--color-text-secondary)]">{CLASS_ROLE[cls]} &middot; {CLASS_DAMAGE[cls]}</div>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search gods..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-[var(--color-bg)] border border-white/10 rounded-lg px-3 py-2 text-sm w-48"
        />
        <div className="flex gap-1">
          {CLASSES.map(cls => (
            <button
              key={cls}
              onClick={() => setClassFilter(cls)}
              className={`px-2 py-1 text-xs rounded font-bold ${
                classFilter === cls ? 'bg-amber-500/20 text-amber-400' : 'bg-[var(--color-secondary)] text-[var(--color-text-secondary)] hover:bg-white/10'
              }`}
            >
              {cls}
            </button>
          ))}
        </div>
        <select
          value={abilityFilter}
          onChange={e => setAbilityFilter(e.target.value)}
          className="bg-[var(--color-bg)] border border-white/10 rounded-lg px-3 py-2 text-sm"
        >
          {ABILITY_TYPES.map(t => (
            <option key={t} value={t}>{t === 'All' ? 'All Ability Types' : t}</option>
          ))}
        </select>
        <div className="flex gap-1 ml-auto">
          <button onClick={() => setViewMode('table')} className={`px-3 py-1.5 text-xs rounded ${viewMode === 'table' ? 'bg-white/10 text-white' : 'text-[var(--color-text-secondary)]'}`}>Table</button>
          <button onClick={() => setViewMode('cards')} className={`px-3 py-1.5 text-xs rounded ${viewMode === 'cards' ? 'bg-white/10 text-white' : 'text-[var(--color-text-secondary)]'}`}>Cards</button>
        </div>
      </div>

      {/* Card view */}
      {viewMode === 'cards' && (
        <>
          <div className="flex gap-1 items-center">
            <span className="text-xs text-[var(--color-text-secondary)] mr-2">Preview rarity:</span>
            {['common', 'uncommon', 'rare', 'epic', 'legendary'].map(r => (
              <button
                key={r}
                onClick={() => setPreviewRarity(r)}
                className={`px-2 py-1 text-xs rounded font-bold capitalize ${previewRarity === r ? 'text-black' : 'bg-[var(--color-secondary)] text-[var(--color-text-secondary)]'}`}
                style={previewRarity === r ? { backgroundColor: RARITIES[r]?.color } : undefined}
              >{r}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-4">
            {filtered.map(god => (
              <div key={god.id} onClick={() => setSelectedGod(god)} className="cursor-pointer hover:scale-105 transition-transform">
                <GameCard type="god" rarity={previewRarity} data={getGodWithOverride(god)} />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Table view */}
      {viewMode === 'table' && (
        <div className="bg-[var(--color-secondary)] rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs text-[var(--color-text-secondary)] uppercase tracking-wider">
                  <th className="p-3">ID</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Class</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Dmg Type</th>
                  <th className="p-3">Ability</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Mana</th>
                  <th className="p-3">CD</th>
                  <th className="p-3">Value</th>
                  <th className="p-3">Img Override</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(god => (
                  <tr key={god.id} className="border-b border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => setSelectedGod(god)}>
                    <td className="p-3 text-xs text-[var(--color-text-secondary)]">{god.id}</td>
                    <td className="p-3 font-medium">{god.name}</td>
                    <td className="p-3">{god.class}</td>
                    <td className="p-3 text-xs uppercase">{CLASS_ROLE[god.class]}</td>
                    <td className="p-3 text-xs">{CLASS_DAMAGE[god.class]}</td>
                    <td className="p-3 text-xs max-w-xs truncate" title={god.ability?.description}>{god.ability?.name}</td>
                    <td className="p-3"><span className="px-1.5 py-0.5 rounded bg-white/5 text-xs">{god.ability?.type}</span></td>
                    <td className="p-3 font-mono text-xs">{god.ability?.manaCost}</td>
                    <td className="p-3 font-mono text-xs">{god.ability?.cooldown}</td>
                    <td className="p-3 font-mono text-xs">{god.ability?.value}</td>
                    <td className="p-3 text-xs">
                      {overrides[god.slug] ? (
                        <span className="text-amber-400">Custom</span>
                      ) : (
                        <span className="text-[var(--color-text-secondary)]">Default</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-white/10 text-xs text-[var(--color-text-secondary)]">
            Showing {filtered.length} of {GODS.length} gods
          </div>
        </div>
      )}

      {/* God detail modal with image editor */}
      {selectedGod && (
        <GodDetailModal
          god={selectedGod}
          override={overrides[selectedGod.slug] || {}}
          onSave={handleSaveOverride}
          onClose={() => setSelectedGod(null)}
        />
      )}

      {/* Ability type distribution */}
      <div className="bg-[var(--color-secondary)] rounded-xl border border-white/10 p-5">
        <h3 className="text-sm font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">Ability Type Distribution</h3>
        <div className="flex flex-wrap gap-2">
          {abilityDistribution.map(([type, count]) => (
            <div key={type} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/20">
              <span className="text-sm font-medium">{type}</span>
              <span className="text-xs text-amber-400 font-bold">{count}</span>
              <div className="w-16 h-1.5 rounded-full bg-white/10">
                <div className="h-full rounded-full bg-amber-500" style={{ width: `${(count / GODS.length) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function GodDetailModal({ god, override, onSave, onClose }) {
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
    const metadata = {
      image_offset_x: offsetX,
      image_offset_y: offsetY,
      image_zoom: zoom,
    }
    if (customImageUrl) metadata.custom_image_url = customImageUrl
    await onSave(god, metadata)
    setSaving(false)
  }

  const handleMouseDown = (e) => {
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const startOX = offsetX
    const startOY = offsetY
    const onMove = (e) => {
      setOffsetX(Math.round(startOX + (e.clientX - startX)))
      setOffsetY(Math.round(startOY + (e.clientY - startY)))
    }
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const previewData = {
    ...god,
    imageUrl: customImageUrl || undefined,
    metadata: { image_offset_x: offsetX, image_offset_y: offsetY, image_zoom: zoom },
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--color-bg)] rounded-2xl border border-white/10 w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-lg font-bold">{god.name}</h2>
          <button onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5 grid md:grid-cols-[1fr_280px] gap-6">
          <div className="space-y-4">
            {/* Info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-black/20 rounded-lg p-3">
                <div className="text-xs text-[var(--color-text-secondary)]">Class</div>
                <div className="font-bold">{god.class}</div>
              </div>
              <div className="bg-black/20 rounded-lg p-3">
                <div className="text-xs text-[var(--color-text-secondary)]">Role</div>
                <div className="font-bold uppercase">{CLASS_ROLE[god.class]}</div>
              </div>
              <div className="bg-black/20 rounded-lg p-3">
                <div className="text-xs text-[var(--color-text-secondary)]">Damage Type</div>
                <div className="font-bold">{CLASS_DAMAGE[god.class]}</div>
              </div>
              <div className="bg-black/20 rounded-lg p-3">
                <div className="text-xs text-[var(--color-text-secondary)]">Image Key</div>
                <div className="font-mono text-sm">{god.imageKey}</div>
              </div>
            </div>

            {god.ability && (
              <div className="bg-black/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-bold text-amber-400">{god.ability.name}</span>
                  <span className="px-1.5 py-0.5 rounded bg-white/10 text-xs">{god.ability.type}</span>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{god.ability.description}</p>
                <div className="flex gap-4 mt-3 text-xs text-[var(--color-text-secondary)]">
                  <span>Mana: <strong className="text-white">{god.ability.manaCost}</strong></span>
                  <span>Cooldown: <strong className="text-white">{god.ability.cooldown}t</strong></span>
                  <span>Value: <strong className="text-white">{god.ability.value}</strong></span>
                </div>
              </div>
            )}

            {/* Image positioning */}
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Image Positioning</h4>
              <p className="text-xs text-[var(--color-text-secondary)]">
                These settings apply to all cards of this god. Drag the card preview or use sliders.
              </p>

              <div>
                <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Custom Image URL (optional)</label>
                <input
                  type="text"
                  value={customImageUrl}
                  onChange={e => setCustomImageUrl(e.target.value)}
                  placeholder="Leave empty for default CDN image"
                  className="w-full bg-[var(--color-secondary)] border border-white/10 rounded-lg px-3 py-2 text-sm font-mono"
                />
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

              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setOffsetX(0); setOffsetY(0); setZoom(1); setCustomImageUrl('') }}
                  className="text-xs text-[var(--color-text-secondary)] hover:text-white"
                >
                  Reset to defaults
                </button>
              </div>
            </div>

            {/* Save */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Image Settings'}
              </button>
              {!hasChanges && <span className="text-xs text-[var(--color-text-secondary)]">No changes</span>}
            </div>
          </div>

          {/* Live preview */}
          <div className="flex flex-col items-center gap-4">
            <h4 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Live Preview</h4>

            <div className="flex gap-1 mb-2">
              {['common', 'rare', 'epic', 'legendary'].map(r => (
                <button
                  key={r}
                  onClick={() => setPreviewRarity(r)}
                  className={`px-2 py-0.5 text-[10px] rounded font-bold capitalize ${previewRarity === r ? 'text-black' : 'bg-[var(--color-secondary)] text-[var(--color-text-secondary)]'}`}
                  style={previewRarity === r ? { backgroundColor: RARITIES[r]?.color } : undefined}
                >{r}</button>
              ))}
            </div>

            <div className="cursor-grab active:cursor-grabbing" onMouseDown={handleMouseDown}>
              <GameCard type="god" rarity={previewRarity} data={previewData} />
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

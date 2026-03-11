import { useState, useMemo, useEffect, useCallback } from 'react'
import { ITEMS } from '../../../data/vault/items'
import { RARITIES } from '../../../data/vault/economy'
import { cardclashAdminService } from '../../../services/database'
import GameCard from '../../vault/components/GameCard'

const CATEGORIES = ['All', ...new Set(ITEMS.map(i => i.category))]
const STAT_KEYS = ['attack', 'defense', 'hp', 'mana']

export default function CCAdminItems() {
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [previewRarity, setPreviewRarity] = useState('rare')
  const [selectedItem, setSelectedItem] = useState(null)
  const [viewMode, setViewMode] = useState('table')
  const [overrides, setOverrides] = useState({})

  useEffect(() => {
    cardclashAdminService.getDefinitionOverrides('item').then(data => {
      const map = {}
      for (const o of (data.overrides || [])) {
        map[o.definitionId] = o.metadata
      }
      setOverrides(map)
    }).catch(() => {})
  }, [])

  const getItemWithOverride = useCallback((item) => {
    const override = overrides[String(item.id)]
    if (!override) return item
    return {
      ...item,
      ...override.name && { name: override.name },
      ...override.category && { category: override.category },
      ...override.manaCost !== undefined && { manaCost: override.manaCost },
      metadata: override,
      effects: override.effects ? { ...item.effects, ...override.effects } : item.effects,
      passive: override.passive ? { ...item.passive, ...override.passive } : item.passive,
    }
  }, [overrides])

  const filtered = useMemo(() => {
    let items = [...ITEMS]
    if (categoryFilter !== 'All') items = items.filter(i => i.category === categoryFilter)
    if (search) items = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    return items
  }, [categoryFilter, search])

  const catCounts = useMemo(() => {
    const counts = {}
    ITEMS.forEach(i => { counts[i.category] = (counts[i.category] || 0) + 1 })
    return counts
  }, [])

  const handleSaveOverride = async (item, metadata) => {
    await cardclashAdminService.saveDefinitionOverride('item', String(item.id), metadata)
    setOverrides(prev => ({ ...prev, [String(item.id)]: metadata }))
  }

  return (
    <div className="space-y-6">
      {/* Category summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(catCounts).map(([cat, count]) => (
          <div key={cat} className="bg-[var(--color-secondary)] rounded-xl border border-white/10 p-3 cursor-pointer hover:bg-white/5" onClick={() => setCategoryFilter(cat)}>
            <div className="text-lg font-bold">{count}</div>
            <div className="text-xs text-[var(--color-text-secondary)]">{cat}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input type="text" placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)}
          className="bg-[var(--color-bg)] border border-white/10 rounded-lg px-3 py-2 text-sm w-48" />
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          className="bg-[var(--color-bg)] border border-white/10 rounded-lg px-3 py-2 text-sm">
          {CATEGORIES.map(c => <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>)}
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
              <button key={r} onClick={() => setPreviewRarity(r)}
                className={`px-2 py-1 text-xs rounded font-bold capitalize ${previewRarity === r ? 'text-black' : 'bg-[var(--color-secondary)] text-[var(--color-text-secondary)]'}`}
                style={previewRarity === r ? { backgroundColor: RARITIES[r]?.color } : undefined}>{r}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-4">
            {filtered.map(item => (
              <div key={item.id} onClick={() => setSelectedItem(item)} className="cursor-pointer hover:scale-105 transition-transform">
                <GameCard type="item" rarity={previewRarity} data={getItemWithOverride(item)} />
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
                  <th className="p-3">Category</th>
                  <th className="p-3">Cost</th>
                  <th className="p-3">Effects</th>
                  <th className="p-3">Passive</th>
                  <th className="p-3">Override</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id} className="border-b border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => setSelectedItem(item)}>
                    <td className="p-3 text-xs text-[var(--color-text-secondary)]">{item.id}</td>
                    <td className="p-3 font-medium">{item.name}</td>
                    <td className="p-3 text-xs">{item.category}</td>
                    <td className="p-3 font-mono text-xs">{item.manaCost}</td>
                    <td className="p-3 text-xs">
                      {item.effects && Object.entries(item.effects).map(([k, v]) => <span key={k} className="mr-2">+{v} {k}</span>)}
                    </td>
                    <td className="p-3 text-xs max-w-xs truncate text-[var(--color-text-secondary)]" title={item.passive?.description}>
                      {item.passive?.name}: {item.passive?.description}
                    </td>
                    <td className="p-3 text-xs">
                      {overrides[String(item.id)] ? <span className="text-amber-400">Custom</span> : <span className="text-[var(--color-text-secondary)]">Default</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-white/10 text-xs text-[var(--color-text-secondary)]">Showing {filtered.length} of {ITEMS.length} items</div>
        </div>
      )}

      {/* Item detail modal */}
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          override={overrides[String(selectedItem.id)] || {}}
          onSave={handleSaveOverride}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  )
}

const INPUT = 'w-full bg-[var(--color-secondary)] border border-white/10 rounded-lg px-3 py-2 text-sm'
const LABEL = 'block text-xs text-[var(--color-text-secondary)] mb-1'

function ItemDetailModal({ item, override, onSave, onClose }) {
  // Image positioning
  const [offsetX, setOffsetX] = useState(override.image_offset_x || 0)
  const [offsetY, setOffsetY] = useState(override.image_offset_y || 0)
  const [zoom, setZoom] = useState(override.image_zoom || 1)
  const [customImageUrl, setCustomImageUrl] = useState(override.custom_image_url || '')

  // Editable card properties
  const [name, setName] = useState(override.name || item.name)
  const [category, setCategory] = useState(override.category || item.category)
  const [manaCost, setManaCost] = useState(override.manaCost ?? item.manaCost)
  const [passiveName, setPassiveName] = useState(override.passive?.name || item.passive?.name || '')
  const [passiveDesc, setPassiveDesc] = useState(override.passive?.description || item.passive?.description || '')

  // Effects as individual fields
  const [effectAttack, setEffectAttack] = useState(override.effects?.attack ?? item.effects?.attack ?? '')
  const [effectDefense, setEffectDefense] = useState(override.effects?.defense ?? item.effects?.defense ?? '')
  const [effectHp, setEffectHp] = useState(override.effects?.hp ?? item.effects?.hp ?? '')
  const [effectMana, setEffectMana] = useState(override.effects?.mana ?? item.effects?.mana ?? '')

  const [saving, setSaving] = useState(false)
  const [previewRarity, setPreviewRarity] = useState('rare')

  const buildMetadata = () => {
    const metadata = {}
    if (offsetX !== 0) metadata.image_offset_x = offsetX
    if (offsetY !== 0) metadata.image_offset_y = offsetY
    if (zoom !== 1) metadata.image_zoom = zoom
    if (customImageUrl) metadata.custom_image_url = customImageUrl
    if (name !== item.name) metadata.name = name
    if (category !== item.category) metadata.category = category
    if (Number(manaCost) !== item.manaCost) metadata.manaCost = Number(manaCost)
    // Effects
    const effects = {}
    if (effectAttack !== '' && Number(effectAttack) !== (item.effects?.attack ?? '')) effects.attack = Number(effectAttack)
    if (effectDefense !== '' && Number(effectDefense) !== (item.effects?.defense ?? '')) effects.defense = Number(effectDefense)
    if (effectHp !== '' && Number(effectHp) !== (item.effects?.hp ?? '')) effects.hp = Number(effectHp)
    if (effectMana !== '' && Number(effectMana) !== (item.effects?.mana ?? '')) effects.mana = Number(effectMana)
    if (Object.keys(effects).length > 0) metadata.effects = effects
    // Passive
    const passive = {}
    if (passiveName !== (item.passive?.name || '')) passive.name = passiveName
    if (passiveDesc !== (item.passive?.description || '')) passive.description = passiveDesc
    if (Object.keys(passive).length > 0) metadata.passive = passive
    return metadata
  }

  const hasChanges = JSON.stringify(buildMetadata()) !== JSON.stringify(
    Object.keys(override).length ? override : {}
  )

  const handleSave = async () => {
    setSaving(true)
    await onSave(item, buildMetadata())
    setSaving(false)
  }

  const handleReset = () => {
    setOffsetX(0); setOffsetY(0); setZoom(1); setCustomImageUrl('')
    setName(item.name); setCategory(item.category); setManaCost(item.manaCost)
    setPassiveName(item.passive?.name || ''); setPassiveDesc(item.passive?.description || '')
    setEffectAttack(item.effects?.attack ?? ''); setEffectDefense(item.effects?.defense ?? '')
    setEffectHp(item.effects?.hp ?? ''); setEffectMana(item.effects?.mana ?? '')
  }

  const handleMouseDown = (e) => {
    e.preventDefault()
    const startX = e.clientX, startY = e.clientY, startOX = offsetX, startOY = offsetY
    const onMove = (e) => { setOffsetX(Math.round(startOX + (e.clientX - startX))); setOffsetY(Math.round(startOY + (e.clientY - startY))) }
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const currentEffects = {}
  if (effectAttack !== '') currentEffects.attack = Number(effectAttack)
  if (effectDefense !== '') currentEffects.defense = Number(effectDefense)
  if (effectHp !== '') currentEffects.hp = Number(effectHp)
  if (effectMana !== '') currentEffects.mana = Number(effectMana)

  const previewData = {
    ...item,
    name,
    category,
    manaCost: Number(manaCost),
    imageUrl: customImageUrl || undefined,
    metadata: { image_offset_x: offsetX, image_offset_y: offsetY, image_zoom: zoom },
    effects: Object.keys(currentEffects).length ? currentEffects : item.effects,
    passive: { ...item.passive, name: passiveName, description: passiveDesc },
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--color-bg)] rounded-2xl border border-white/10 w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-lg font-bold">{item.name} <span className="text-sm text-[var(--color-text-secondary)] font-normal">({item.slug})</span></h2>
          <button onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5 grid md:grid-cols-[1fr_280px] gap-6">
          <div className="space-y-4">
            {/* Card Properties */}
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider">Card Properties</h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Name</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Category</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} className={INPUT}>
                    {[...new Set(ITEMS.map(i => i.category))].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={LABEL}>Mana Cost</label>
                <input type="number" min={0} max={10} value={manaCost} onChange={e => setManaCost(e.target.value)} className={INPUT + ' w-24'} />
              </div>
            </div>

            {/* Effects */}
            <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-green-400 uppercase tracking-wider">Stat Effects</h4>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className={LABEL}>Attack</label>
                  <input type="number" min={0} max={20} value={effectAttack} onChange={e => setEffectAttack(e.target.value)} placeholder="-" className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Defense</label>
                  <input type="number" min={0} max={20} value={effectDefense} onChange={e => setEffectDefense(e.target.value)} placeholder="-" className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>HP</label>
                  <input type="number" min={0} max={50} value={effectHp} onChange={e => setEffectHp(e.target.value)} placeholder="-" className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Mana</label>
                  <input type="number" min={0} max={20} value={effectMana} onChange={e => setEffectMana(e.target.value)} placeholder="-" className={INPUT} />
                </div>
              </div>
            </div>

            {/* Passive */}
            <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider">Passive</h4>
              <div>
                <label className={LABEL}>Passive Name</label>
                <input type="text" value={passiveName} onChange={e => setPassiveName(e.target.value)} className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Passive Description</label>
                <textarea value={passiveDesc} onChange={e => setPassiveDesc(e.target.value)} rows={2}
                  className={INPUT + ' resize-y'} />
              </div>
            </div>

            {/* Image positioning */}
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Image Positioning</h4>

              <div>
                <label className={LABEL}>Custom Image URL (optional)</label>
                <input type="text" value={customImageUrl} onChange={e => setCustomImageUrl(e.target.value)}
                  placeholder="Leave empty for default CDN image" className={INPUT + ' font-mono'} />
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

            {/* Actions */}
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

          {/* Live preview */}
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
              <GameCard type="item" rarity={previewRarity} data={previewData} />
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

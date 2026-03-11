import { useState, useEffect, useCallback, useMemo } from 'react'
import PageTitle from '../../components/PageTitle'
import { packCreatorService } from '../../services/database'

const CARD_TYPES = ['god', 'item', 'consumable', 'player']
const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']
const RARITY_COLORS = {
  common: '#9ca3af', uncommon: '#22c55e', rare: '#3b82f6',
  epic: '#a855f7', legendary: '#ff8c00', mythic: '#ef4444',
}

const GROUP_LABELS = ['', 'A', 'B', 'C', 'D', 'E']
const DEFAULT_SLOT = { types: ['god', 'item', 'consumable'], typeWeights: {}, minRarity: 'common', maxRarity: null, group: '' }

function SlotEditor({ slot, index, onChange, onRemove, onDuplicate, onMoveUp, onMoveDown, isFirst, isLast }) {
  const updateField = (field, value) => onChange({ ...slot, [field]: value })

  const toggleType = (type) => {
    const types = slot.types.includes(type)
      ? slot.types.filter(t => t !== type)
      : [...slot.types, type]
    if (types.length === 0) return
    const weights = { ...slot.typeWeights }
    Object.keys(weights).forEach(k => { if (!types.includes(k)) delete weights[k] })
    onChange({ ...slot, types, typeWeights: weights })
  }

  const setWeight = (type, value) => {
    const weights = { ...slot.typeWeights, [type]: parseInt(value) || 0 }
    if (weights[type] <= 0) delete weights[type]
    const hasAny = Object.keys(weights).length > 0
    onChange({ ...slot, typeWeights: weights, ...(hasAny ? { weightByCardCount: false } : {}) })
  }

  const hasWeights = Object.keys(slot.typeWeights || {}).length > 0

  return (
    <div className={`p-3 rounded-lg bg-white/[0.03] border space-y-2 ${
      slot.group ? 'border-amber-500/30' : 'border-white/10'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/30 font-mono w-8">#{index + 1}</span>
          {slot.group && <span className="text-[10px] font-bold text-amber-400/80 bg-amber-500/10 px-1.5 py-0.5 rounded">{slot.group}</span>}
          <div className="flex items-center gap-1">
            <button onClick={onMoveUp} disabled={isFirst} className="text-white/20 hover:text-white/50 disabled:opacity-30 cursor-pointer text-xs px-1">^</button>
            <button onClick={onMoveDown} disabled={isLast} className="text-white/20 hover:text-white/50 disabled:opacity-30 cursor-pointer text-xs px-1">v</button>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <select
            value={slot.group || ''}
            onChange={e => updateField('group', e.target.value || '')}
            className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[11px] text-white"
          >
            <option value="">No group</option>
            {GROUP_LABELS.filter(g => g).map(g => <option key={g} value={g}>Group {g}</option>)}
          </select>
          <button onClick={onDuplicate} className="text-xs text-blue-400/60 hover:text-blue-400 cursor-pointer px-1">Dupe</button>
          <button onClick={onRemove} className="text-xs text-red-400/60 hover:text-red-400 cursor-pointer px-1">Remove</button>
        </div>
      </div>

      {/* Card types */}
      <div>
        <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Card Types</div>
        <div className="flex flex-wrap gap-1.5">
          {CARD_TYPES.map(type => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                slot.types.includes(type)
                  ? 'bg-white/15 text-white border border-white/30'
                  : 'bg-white/[0.03] text-white/30 border border-white/5 hover:border-white/15'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Type weights */}
      {slot.types.length > 1 && (
        <div>
          <div className="flex items-center gap-2">
            <div className="text-[10px] text-white/40 uppercase tracking-wider">Weights</div>
            <span className="text-[10px] text-white/20">
              {hasWeights ? 'custom' : slot.weightByCardCount ? 'by card pool size' : 'equal chance'}
            </span>
          </div>
          {!hasWeights && (
            <label className="flex items-center gap-1.5 mt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={!!slot.weightByCardCount}
                onChange={e => updateField('weightByCardCount', e.target.checked)}
                className="accent-amber-500"
              />
              <span className="text-[11px] text-white/40">Weight by card pool size</span>
            </label>
          )}
          <div className="flex flex-wrap gap-2 mt-1">
            {slot.types.map(type => (
              <div key={type} className="flex items-center gap-1">
                <span className="text-[10px] text-white/40 w-14">{type}</span>
                <input
                  type="number"
                  min="0"
                  value={slot.typeWeights?.[type] || ''}
                  onChange={e => setWeight(type, e.target.value)}
                  placeholder="—"
                  className="w-12 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-xs text-white text-center"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rarity range */}
      <div className="flex gap-3">
        <div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Min Rarity</div>
          <select
            value={slot.minRarity || 'common'}
            onChange={e => updateField('minRarity', e.target.value)}
            className="px-2 py-1 rounded bg-white/5 border border-white/10 text-xs text-white"
          >
            {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Max Rarity</div>
          <select
            value={slot.maxRarity || ''}
            onChange={e => updateField('maxRarity', e.target.value || null)}
            className="px-2 py-1 rounded bg-white/5 border border-white/10 text-xs text-white"
          >
            <option value="">No cap</option>
            {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}

function DivisionPicker({ divisions, selected, onChange }) {
  const grouped = useMemo(() => {
    const map = {}
    for (const d of divisions) {
      if (!map[d.leagueId]) map[d.leagueId] = { leagueName: d.leagueName, divisions: [] }
      map[d.leagueId].divisions.push(d)
    }
    return Object.entries(map)
  }, [divisions])

  const toggle = (id) => {
    onChange(selected.includes(id) ? selected.filter(d => d !== id) : [...selected, id])
  }

  const toggleLeague = (leagueId) => {
    const leagueDivs = divisions.filter(d => d.leagueId === leagueId).map(d => d.id)
    const allSelected = leagueDivs.every(id => selected.includes(id))
    if (allSelected) {
      onChange(selected.filter(id => !leagueDivs.includes(id)))
    } else {
      onChange([...new Set([...selected, ...leagueDivs])])
    }
  }

  return (
    <div className="space-y-2">
      <div className="text-[10px] text-white/40 uppercase tracking-wider">Player Pool — Divisions {selected.length > 0 ? `(${selected.length} selected)` : '(all)'}</div>
      {selected.length === 0 && (
        <div className="text-xs text-white/30 italic">No filter — player cards pull from all divisions</div>
      )}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {grouped.map(([leagueId, { leagueName, divisions: divs }]) => {
          const allSelected = divs.every(d => selected.includes(d.id))
          const someSelected = divs.some(d => selected.includes(d.id))
          return (
            <div key={leagueId}>
              <button
                onClick={() => toggleLeague(parseInt(leagueId))}
                className={`text-xs font-semibold mb-0.5 cursor-pointer transition-colors ${
                  allSelected ? 'text-amber-400' : someSelected ? 'text-amber-400/60' : 'text-white/50 hover:text-white/70'
                }`}
              >
                {allSelected ? '[-]' : someSelected ? '[~]' : '[+]'} {leagueName}
              </button>
              <div className="flex flex-wrap gap-1 ml-3">
                {divs.map(d => (
                  <button
                    key={d.id}
                    onClick={() => toggle(d.id)}
                    className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                      selected.includes(d.id)
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'bg-white/[0.03] text-white/30 border border-white/5 hover:border-white/15'
                    }`}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      {selected.length > 0 && (
        <button onClick={() => onChange([])} className="text-[10px] text-white/30 hover:text-white/50 cursor-pointer underline">
          Clear filter (use all divisions)
        </button>
      )}
    </div>
  )
}

function PackForm({ initial, divisions, onSave, onCancel, saving }) {
  const isEdit = !!initial?.id
  const [form, setForm] = useState({
    id: initial?.id || '',
    name: initial?.name || '',
    description: initial?.description || '',
    cost: initial?.cost ?? '',
    color: initial?.color || '#d2b138',
    divisionIds: initial?.divisionIds || [],
    slots: initial?.slots?.map(s => ({ ...DEFAULT_SLOT, ...s })) || [{ ...DEFAULT_SLOT }],
    groupConstraints: initial?.groupConstraints || {},
    sortOrder: initial?.sortOrder ?? 0,
  })

  const updateSlot = (index, updated) => {
    const slots = [...form.slots]
    slots[index] = updated
    setForm(f => ({ ...f, slots }))
  }
  const removeSlot = (index) => setForm(f => ({ ...f, slots: f.slots.filter((_, i) => i !== index) }))
  const addSlot = () => setForm(f => ({ ...f, slots: [...f.slots, { ...DEFAULT_SLOT }] }))
  const duplicateSlot = (index) => {
    const slots = [...form.slots]
    slots.splice(index + 1, 0, JSON.parse(JSON.stringify(slots[index])))
    setForm(f => ({ ...f, slots }))
  }
  const moveSlot = (index, dir) => {
    const slots = [...form.slots]
    const target = index + dir
    if (target < 0 || target >= slots.length) return
    ;[slots[index], slots[target]] = [slots[target], slots[index]]
    setForm(f => ({ ...f, slots }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    // Clean slots: remove empty group labels
    const cleanedSlots = form.slots.map(s => {
      const { group, ...rest } = s
      return group ? { ...rest, group } : rest
    })
    // Clean group constraints: remove groups with no constraints
    const cleanedConstraints = {}
    for (const [g, constraints] of Object.entries(form.groupConstraints)) {
      const valid = constraints.filter(c => c.type && (c.min > 0 || c.max > 0))
      if (valid.length > 0) cleanedConstraints[g] = valid
    }
    onSave({
      ...form,
      slots: cleanedSlots,
      groupConstraints: cleanedConstraints,
      cost: parseInt(form.cost) || 0,
      cardsPerPack: form.slots.length,
      category: 'configured',
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 rounded-xl bg-white/5 border border-white/10">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-white/50 mb-1">ID (slug)</label>
          <input
            value={form.id}
            onChange={e => setForm(f => ({ ...f, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
            disabled={isEdit}
            placeholder="my-custom-pack"
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white disabled:opacity-50"
            required
          />
        </div>
        <div>
          <label className="block text-xs text-white/50 mb-1">Name</label>
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Custom Pack"
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white"
            required
          />
        </div>
        <div>
          <label className="block text-xs text-white/50 mb-1">Cost (Cores)</label>
          <input
            type="number"
            min="0"
            value={form.cost}
            onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-white/50 mb-1">Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.color}
              onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
              className="w-8 h-8 rounded border border-white/10 bg-transparent cursor-pointer"
            />
            <input
              type="text"
              value={form.color}
              onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
              className="flex-1 px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white font-mono"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs text-white/50 mb-1">Description</label>
        <input
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Optional description"
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white"
        />
      </div>

      {/* Division picker */}
      <DivisionPicker
        divisions={divisions}
        selected={form.divisionIds}
        onChange={ids => setForm(f => ({ ...f, divisionIds: ids }))}
      />

      {/* Slot builder */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-white/50 font-semibold uppercase tracking-wider">
            Slots ({form.slots.length} cards)
          </div>
          <button type="button" onClick={addSlot} className="text-xs text-green-400 hover:text-green-300 cursor-pointer">
            + Add Slot
          </button>
        </div>
        <div className="space-y-2">
          {form.slots.map((slot, i) => (
            <SlotEditor
              key={i}
              slot={slot}
              index={i}
              onChange={s => updateSlot(i, s)}
              onRemove={() => removeSlot(i)}
              onDuplicate={() => duplicateSlot(i)}
              onMoveUp={() => moveSlot(i, -1)}
              onMoveDown={() => moveSlot(i, 1)}
              isFirst={i === 0}
              isLast={i === form.slots.length - 1}
            />
          ))}
        </div>
      </div>

      {/* Group constraints editor */}
      {(() => {
        const activeGroups = [...new Set(form.slots.map(s => s.group).filter(Boolean))].sort()
        if (activeGroups.length === 0) return null

        const updateConstraint = (group, idx, field, value) => {
          const gc = { ...form.groupConstraints }
          gc[group] = [...(gc[group] || [])]
          gc[group][idx] = { ...gc[group][idx], [field]: field === 'type' ? value : parseInt(value) || 0 }
          setForm(f => ({ ...f, groupConstraints: gc }))
        }
        const addConstraint = (group) => {
          const gc = { ...form.groupConstraints }
          gc[group] = [...(gc[group] || []), { type: 'player', min: 0, max: 0 }]
          setForm(f => ({ ...f, groupConstraints: gc }))
        }
        const removeConstraint = (group, idx) => {
          const gc = { ...form.groupConstraints }
          gc[group] = (gc[group] || []).filter((_, i) => i !== idx)
          if (gc[group].length === 0) delete gc[group]
          setForm(f => ({ ...f, groupConstraints: gc }))
        }

        return (
          <div>
            <div className="text-xs text-white/50 font-semibold uppercase tracking-wider mb-2">
              Group Constraints
            </div>
            <div className="text-[10px] text-white/30 mb-2">
              Control how many of each card type appear across grouped slots
            </div>
            <div className="space-y-3">
              {activeGroups.map(group => {
                const groupSlotCount = form.slots.filter(s => s.group === group).length
                const constraints = form.groupConstraints[group] || []
                return (
                  <div key={group} className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-amber-400">Group {group}</span>
                        <span className="text-[10px] text-white/30">{groupSlotCount} slots</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => addConstraint(group)}
                        className="text-[11px] text-amber-400/60 hover:text-amber-400 cursor-pointer"
                      >
                        + Add Constraint
                      </button>
                    </div>
                    {constraints.length === 0 && (
                      <div className="text-[11px] text-white/20 italic">No constraints — types assigned randomly</div>
                    )}
                    {constraints.map((c, ci) => (
                      <div key={ci} className="flex items-center gap-2">
                        <select
                          value={c.type}
                          onChange={e => updateConstraint(group, ci, 'type', e.target.value)}
                          className="px-2 py-1 rounded bg-white/5 border border-white/10 text-xs text-white"
                        >
                          {CARD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-white/30">min</span>
                          <input
                            type="number"
                            min="0"
                            max={groupSlotCount}
                            value={c.min || 0}
                            onChange={e => updateConstraint(group, ci, 'min', e.target.value)}
                            className="w-10 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-xs text-white text-center"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-white/30">max</span>
                          <input
                            type="number"
                            min="0"
                            max={groupSlotCount}
                            value={c.max || 0}
                            onChange={e => updateConstraint(group, ci, 'max', e.target.value)}
                            className="w-10 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-xs text-white text-center"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeConstraint(group, ci)}
                          className="text-red-400/50 hover:text-red-400 cursor-pointer text-xs ml-1"
                        >
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Summary */}
      <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
        <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Preview</div>
        <div className="text-xs text-white/60 space-y-0.5">
          <div><span className="text-white font-medium">{form.name || '(unnamed)'}</span> — {form.slots.length} cards, {form.cost || 0} Cores</div>
          {form.divisionIds.length > 0 && (
            <div>Player pool: {form.divisionIds.length} division{form.divisionIds.length !== 1 ? 's' : ''}</div>
          )}
          {form.slots.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="text-white/30 font-mono w-6">#{i+1}</span>
              {s.group && <span className="text-amber-400/60 text-[10px] font-bold">[{s.group}]</span>}
              <span>{s.types.join('/')}</span>
              <span style={{ color: RARITY_COLORS[s.minRarity] }}>{s.minRarity}+</span>
              {s.maxRarity && <span className="text-white/30">cap: <span style={{ color: RARITY_COLORS[s.maxRarity] }}>{s.maxRarity}</span></span>}
              {Object.keys(s.typeWeights || {}).length > 0 && <span className="text-white/20">(weighted)</span>}
              {s.weightByCardCount && !Object.keys(s.typeWeights || {}).length && <span className="text-white/20">(by pool size)</span>}
            </div>
          ))}
          {Object.entries(form.groupConstraints).filter(([, c]) => c.length > 0).map(([g, constraints]) => (
            <div key={g} className="text-amber-400/50 mt-0.5">
              Group {g}: {constraints.map(c => `${c.type} ${c.min}-${c.max}`).join(', ')}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={saving || !form.id || !form.name || form.slots.length === 0}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {saving ? 'Saving...' : isEdit ? 'Update Pack Type' : 'Create Pack Type'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white/70 cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

export default function PackCreator() {
  const [packTypes, setPackTypes] = useState([])
  const [divisions, setDivisions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [mode, setMode] = useState(null) // null | 'create' | packId (edit)
  const [template, setTemplate] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await packCreatorService.load()
      setPackTypes(data.packTypes)
      setDivisions(data.divisions)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (data) => {
    setSaving(true)
    try {
      if (mode === 'create') {
        const result = await packCreatorService.create(data)
        setPackTypes(prev => [...prev, result.packType])
      } else {
        const result = await packCreatorService.update(data)
        setPackTypes(prev => prev.map(p => p.id === data.id ? result.packType : p))
      }
      setMode(null)
      setTemplate(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (id) => {
    try {
      const data = await packCreatorService.toggle(id)
      setPackTypes(prev => prev.map(p => p.id === id ? data.packType : p))
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm(`Delete pack type "${id}"? This cannot be undone.`)) return
    try {
      await packCreatorService.delete(id)
      setPackTypes(prev => prev.filter(p => p.id !== id))
    } catch (err) {
      setError(err.message)
    }
  }

  const editingPack = mode && mode !== 'create' ? packTypes.find(p => p.id === mode) : null

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" /></div>

  return (
    <div className="max-w-3xl mx-auto pb-8 px-4">
      <PageTitle title="Pack Creator" noindex />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Pack Creator</h1>
        {!mode && (
          <button
            onClick={() => setMode('create')}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 transition-colors cursor-pointer"
          >
            + New Pack Type
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline cursor-pointer">dismiss</button>
        </div>
      )}

      {/* Create / Edit form */}
      {mode && (
        <div className="mb-6">
          <PackForm
            initial={mode === 'create' ? template : editingPack}
            divisions={divisions}
            onSave={handleSave}
            onCancel={() => { setMode(null); setTemplate(null) }}
            saving={saving}
          />
        </div>
      )}

      {/* Pack types list */}
      <div className="space-y-2">
        {packTypes.map(pt => (
          <div
            key={pt.id}
            className={`p-4 rounded-xl border transition-colors ${
              pt.enabled
                ? 'bg-white/5 border-white/10'
                : 'bg-white/[0.02] border-white/5 opacity-60'
            }`}
          >
            <div className="flex items-center gap-4">
              {pt.color && (
                <div className="w-3 h-8 rounded-full shrink-0" style={{ background: pt.color }} />
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-white">{pt.name}</span>
                  <span className="text-xs text-white/20 font-mono">{pt.id}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold ${
                    pt.enabled ? 'bg-green-500/10 text-green-400' : 'bg-white/10 text-white/40'
                  }`}>
                    {pt.enabled ? 'Active' : 'Disabled'}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/30 uppercase tracking-wider">
                    {pt.slots ? 'configured' : pt.category}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-white/40">
                  <span>{pt.cardsPerPack} cards</span>
                  <span>{pt.cost} Cores</span>
                  {pt.divisionIds?.length > 0 && <span>{pt.divisionIds.length} div{pt.divisionIds.length !== 1 ? 's' : ''}</span>}
                  {pt.slots && <span>{pt.slots.length} slots configured</span>}
                  {pt.groupConstraints && Object.keys(pt.groupConstraints).length > 0 && (
                    <span className="text-amber-400/40">
                      groups: {Object.entries(pt.groupConstraints).map(([g, c]) =>
                        `${g}(${c.map(r => `${r.type}:${r.min}-${r.max}`).join(',')})`
                      ).join(' ')}
                    </span>
                  )}
                  {!pt.slots && pt.guarantees?.length > 0 && (
                    <span>{pt.guarantees.map(g => `${g.count}x ${g.minRarity}+`).join(', ')}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => { setTemplate({ ...pt, id: '' }); setMode('create') }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-white/50 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Template
                </button>
                <button
                  onClick={() => setMode(pt.id)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-colors cursor-pointer"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleToggle(pt.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    pt.enabled
                      ? 'text-white/50 bg-white/5 hover:bg-white/10'
                      : 'text-green-400 bg-green-500/10 hover:bg-green-500/20'
                  }`}
                >
                  {pt.enabled ? 'Disable' : 'Enable'}
                </button>
                <button
                  onClick={() => handleDelete(pt.id)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

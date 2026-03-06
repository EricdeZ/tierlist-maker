import { useState, useEffect, useCallback } from 'react'
import { cardclashAdminService } from '../../../services/database'
import { RARITIES } from '../../../data/cardclash/economy'
import CCCardEditor from './CCCardEditor'

const RARITY_OPTIONS = ['all', 'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']

const ALL_HOLO_TYPES = [
  'common', 'holo', 'amazing', 'reverse', 'galaxy', 'vstar', 'shiny', 'ultra',
  'radiant', 'sparkle', 'rainbow-alt', 'cosmos', 'rainbow', 'secret', 'gold',
]

export default function CCAdminCards() {
  const [cards, setCards] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [rarity, setRarity] = useState('all')
  const [holo, setHolo] = useState('all')
  const [offset, setOffset] = useState(0)
  const [selectedCard, setSelectedCard] = useState(null)
  const [selected, setSelected] = useState(new Set())

  const limit = 50

  const loadCards = useCallback(async () => {
    setLoading(true)
    try {
      const params = { limit, offset }
      if (search) params.search = search
      if (rarity !== 'all') params.rarity = rarity
      if (holo !== 'all') params.holo = holo
      const data = await cardclashAdminService.listCards(params)
      setCards(data.cards || [])
      setTotal(data.total || 0)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }, [search, rarity, holo, offset])

  useEffect(() => { loadCards() }, [loadCards])

  const handleUpdateCard = async (id, updates) => {
    const data = await cardclashAdminService.updateCard(id, updates)
    if (data.card) {
      setCards(prev => prev.map(c => c.id === id ? data.card : c))
      setSelectedCard(data.card)
    }
  }

  const handleDeleteCard = async (id) => {
    if (!confirm('Delete this card? This cannot be undone.')) return
    await cardclashAdminService.deleteCard(id)
    setCards(prev => prev.filter(c => c.id !== id))
    setSelectedCard(null)
  }

  const handleBulkUpdate = async (updates) => {
    if (!selected.size) return
    await cardclashAdminService.bulkUpdateCards([...selected], updates)
    setSelected(new Set())
    loadCards()
  }

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search god name or owner..."
          value={search}
          onChange={e => { setSearch(e.target.value); setOffset(0) }}
          className="bg-[var(--color-bg)] border border-white/10 rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-text-secondary)] w-64"
        />

        <select
          value={rarity}
          onChange={e => { setRarity(e.target.value); setOffset(0) }}
          className="bg-[var(--color-bg)] border border-white/10 rounded-lg px-3 py-2 text-sm text-[var(--color-text)]"
        >
          {RARITY_OPTIONS.map(r => (
            <option key={r} value={r}>{r === 'all' ? 'All Rarities' : r.charAt(0).toUpperCase() + r.slice(1)}</option>
          ))}
        </select>

        <select
          value={holo}
          onChange={e => { setHolo(e.target.value); setOffset(0) }}
          className="bg-[var(--color-bg)] border border-white/10 rounded-lg px-3 py-2 text-sm text-[var(--color-text)]"
        >
          <option value="all">All Holo Types</option>
          {ALL_HOLO_TYPES.map(h => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>

        <span className="text-xs text-[var(--color-text-secondary)] ml-auto">
          {total} total cards
        </span>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <span className="text-sm text-amber-400 font-bold">{selected.size} selected</span>
          <select
            onChange={e => { if (e.target.value) handleBulkUpdate({ holo_effect: e.target.value }); e.target.value = '' }}
            className="bg-[var(--color-bg)] border border-white/10 rounded px-2 py-1 text-xs"
          >
            <option value="">Set Holo Effect...</option>
            {ALL_HOLO_TYPES.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
          <select
            onChange={e => { if (e.target.value) handleBulkUpdate({ rarity: e.target.value }); e.target.value = '' }}
            className="bg-[var(--color-bg)] border border-white/10 rounded px-2 py-1 text-xs"
          >
            <option value="">Set Rarity...</option>
            {RARITY_OPTIONS.filter(r => r !== 'all').map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-[var(--color-text-secondary)] hover:text-white ml-auto"
          >
            Clear
          </button>
        </div>
      )}

      {/* Card table */}
      <div className="bg-[var(--color-secondary)] rounded-xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs text-[var(--color-text-secondary)] uppercase tracking-wider">
                <th className="p-3 w-8">
                  <input
                    type="checkbox"
                    checked={selected.size === cards.length && cards.length > 0}
                    onChange={() => {
                      if (selected.size === cards.length) setSelected(new Set())
                      else setSelected(new Set(cards.map(c => c.id)))
                    }}
                  />
                </th>
                <th className="p-3">God</th>
                <th className="p-3">Owner</th>
                <th className="p-3">Rarity</th>
                <th className="p-3">Holo</th>
                <th className="p-3">Power</th>
                <th className="p-3">Lvl</th>
                <th className="p-3">Serial</th>
                <th className="p-3">Source</th>
                <th className="p-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="p-8 text-center text-[var(--color-text-secondary)]">Loading...</td></tr>
              ) : cards.length === 0 ? (
                <tr><td colSpan={10} className="p-8 text-center text-[var(--color-text-secondary)]">No cards found</td></tr>
              ) : cards.map(card => (
                <tr
                  key={card.id}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                  onClick={() => setSelectedCard(card)}
                >
                  <td className="p-3" onClick={e => { e.stopPropagation(); toggleSelect(card.id) }}>
                    <input type="checkbox" checked={selected.has(card.id)} readOnly />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: RARITIES[card.rarity]?.color }} />
                      <span className="font-medium">{card.godName}</span>
                      <span className="text-xs text-[var(--color-text-secondary)]">{card.godClass}</span>
                    </div>
                  </td>
                  <td className="p-3 text-[var(--color-text-secondary)]">{card.ownerName}</td>
                  <td className="p-3">
                    <span className="text-xs font-bold capitalize" style={{ color: RARITIES[card.rarity]?.color }}>
                      {card.rarity}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-[var(--color-text-secondary)]">{card.holoEffect}</td>
                  <td className="p-3 font-mono">{card.power}</td>
                  <td className="p-3 text-[var(--color-text-secondary)]">{card.level}</td>
                  <td className="p-3 text-xs text-[var(--color-text-secondary)]">#{card.serialNumber}</td>
                  <td className="p-3 text-xs text-[var(--color-text-secondary)]">{card.acquiredVia}</td>
                  <td className="p-3">
                    <button
                      onClick={e => { e.stopPropagation(); setSelectedCard(card) }}
                      className="text-xs text-amber-400 hover:text-amber-300"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-between p-3 border-t border-white/10">
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className="px-3 py-1 text-xs rounded bg-white/5 hover:bg-white/10 disabled:opacity-30"
            >
              Previous
            </button>
            <span className="text-xs text-[var(--color-text-secondary)]">
              {offset + 1}-{Math.min(offset + limit, total)} of {total}
            </span>
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= total}
              className="px-3 py-1 text-xs rounded bg-white/5 hover:bg-white/10 disabled:opacity-30"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Card editor modal */}
      {selectedCard && (
        <CCCardEditor
          card={selectedCard}
          onUpdate={handleUpdateCard}
          onDelete={handleDeleteCard}
          onClose={() => setSelectedCard(null)}
        />
      )}
    </div>
  )
}

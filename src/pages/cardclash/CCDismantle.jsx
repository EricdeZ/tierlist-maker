import { useState, useMemo, useCallback } from 'react'
import { useCardClash } from './CardClashContext'
import { RARITIES } from '../../data/cardclash/economy'
import GameCard from './components/GameCard'
import TradingCard from '../../components/TradingCard'
import { Hammer, Check, Trash2, Info } from 'lucide-react'
import emberIcon from '../../assets/ember.png'

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']
const CARD_SIZE = 130

function getCardType(card) {
  return card.cardType || 'god'
}

function toGameCardData(card, override) {
  const type = getCardType(card)
  const cd = card.cardData || {}
  const base = {
    name: card.godName, class: card.godClass, imageUrl: override?.custom_image_url || card.imageUrl,
    id: card.godId, serialNumber: card.serialNumber, metadata: override || undefined,
  }
  if (type === 'god') return { ...base, ability: card.ability || cd.ability, imageKey: cd?.imageKey }
  if (type === 'item') return { ...base, category: cd.category || card.godClass, manaCost: cd.manaCost || 3, effects: cd.effects || {}, passive: cd.passive, imageKey: cd?.imageKey }
  if (type === 'consumable') return { ...base, color: cd.color || '#10b981', description: cd.description || '', manaCost: cd.manaCost || 1 }
  return base
}

const EMPTY_STATS = {
  gamesPlayed: 0, wins: 0, winRate: 0, kda: 0,
  avgDamage: 0, avgMitigated: 0, totalKills: 0, totalDeaths: 0, totalAssists: 0,
}

function toPlayerCardProps(card) {
  const cd = card.cardData || {}
  return {
    playerName: card.godName, teamName: cd.teamName || '', teamColor: cd.teamColor || '#6366f1',
    role: cd.role || card.role || 'ADC', avatarUrl: card.imageUrl || '',
    leagueName: cd.leagueName || '', divisionName: cd.divisionName || '',
    stats: EMPTY_STATS,
    isFirstEdition: card.isFirstEdition || false,
  }
}

function CoresLabel({ value, className = '', iconSize = 'h-4' }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {value}
      <img src={emberIcon} alt="Cores" className={`${iconSize} w-auto object-contain`} />
    </span>
  )
}

export default function CCDismantle() {
  const { collection, dismantleCards, startingFive, getDefOverride } = useCardClash()
  const [selected, setSelected] = useState(new Set())
  const [dismantling, setDismantling] = useState(false)
  const [result, setResult] = useState(null)
  const [filterRarity, setFilterRarity] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [showRates, setShowRates] = useState(false)
  const [visibleCount, setVisibleCount] = useState(50)

  const s5CardIds = useMemo(() =>
    new Set((startingFive?.cards || []).map(c => c.id)),
  [startingFive])

  const cards = useMemo(() => {
    let list = collection.filter(c => !s5CardIds.has(c.id))
    if (filterRarity !== 'all') list = list.filter(c => c.rarity === filterRarity)
    if (filterType !== 'all') list = list.filter(c => getCardType(c) === filterType)
    return list
  }, [collection, filterRarity, filterType, s5CardIds])

  const visibleCards = useMemo(() => cards.slice(0, visibleCount), [cards, visibleCount])
  const hasMore = visibleCount < cards.length

  const toggle = useCallback((id) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
    setResult(null)
  }, [])

  const selectAllVisible = useCallback(() => {
    setSelected(prev => {
      const next = new Set(prev)
      for (const c of cards) next.add(c.id)
      return next
    })
    setResult(null)
  }, [cards])

  const clearSelection = useCallback(() => {
    setSelected(new Set())
    setResult(null)
  }, [])

  const { rawTotal, coresTotal, selectedCount, breakdown } = useMemo(() => {
    let raw = 0
    const counts = {}
    let count = 0
    for (const card of collection) {
      if (!selected.has(card.id)) continue
      count++
      const val = RARITIES[card.rarity]?.dismantleValue || 0
      raw += val
      counts[card.rarity] = (counts[card.rarity] || 0) + 1
    }
    return { rawTotal: raw, coresTotal: Math.floor(raw), selectedCount: count, breakdown: counts }
  }, [collection, selected])

  const handleDismantle = async () => {
    if (coresTotal < 1 || dismantling) return
    setDismantling(true)
    try {
      const ids = [...selected]
      const res = await dismantleCards(ids)
      setResult(res)
      setSelected(new Set())
    } catch (err) {
      setResult({ error: err.message || 'Failed to dismantle' })
    }
    setDismantling(false)
  }

  if (collection.length === 0) {
    return (
      <div className="text-center py-20 text-[var(--cd-text-dim)]">
        <Hammer className="w-16 h-16 mx-auto mb-4 opacity-20" />
        <p className="text-lg font-bold cd-head">No cards to dismantle</p>
        <p className="text-sm mt-1">Open some packs first!</p>
      </div>
    )
  }

  return (
    <div className="pb-32">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-bold cd-head text-[var(--cd-text)] flex items-center gap-2">
            <Hammer className="w-5 h-5 text-[var(--cd-cyan)] shrink-0" />
            Dismantle
          </h2>
          <p className="text-[11px] sm:text-xs text-[var(--cd-text-dim)] mt-1">
            Select cards to break down into Cores.
          </p>
        </div>
        <button
          onClick={() => setShowRates(!showRates)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cd-head border border-[var(--cd-border)] text-[var(--cd-text-mid)] hover:bg-white/[0.03] transition-all cursor-pointer"
        >
          <Info className="w-3.5 h-3.5" />
          Rates
        </button>
      </div>

      {/* Rates panel */}
      {showRates && (
        <div className="mb-4 p-4 rounded-lg border border-[var(--cd-border)] bg-[var(--cd-surface)]/60">
          <div className="text-xs font-bold cd-head text-[var(--cd-text-mid)] mb-2 uppercase tracking-wider">Dismantle Rates</div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {RARITY_ORDER.map(r => {
              const info = RARITIES[r]
              return (
                <div key={r} className="text-center p-2 rounded-lg bg-black/20">
                  <div className="text-xs font-bold cd-head" style={{ color: info.color }}>{info.name}</div>
                  <div className="text-lg font-bold cd-num text-[var(--cd-text)] flex items-center justify-center gap-1">
                    {info.dismantleValue}
                    <img src={emberIcon} alt="" className="h-4 w-auto object-contain" />
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-[10px] text-[var(--cd-text-dim)] mt-2 flex items-center gap-1">
            1 Standard Pack = <CoresLabel value="10" iconSize="h-3.5" />. Values are summed and rounded down.
          </p>
        </div>
      )}

      {/* Filters + bulk actions */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select
          value={filterType}
          onChange={e => { setFilterType(e.target.value); setVisibleCount(50) }}
          className="px-3 py-1.5 rounded-lg text-xs font-bold cd-head bg-[var(--cd-surface)] border border-[var(--cd-border)] text-[var(--cd-text)] cursor-pointer"
        >
          <option value="all">All Types</option>
          <option value="god">Gods</option>
          <option value="item">Items</option>
          <option value="consumable">Consumables</option>
          <option value="player">Players</option>
        </select>

        <select
          value={filterRarity}
          onChange={e => { setFilterRarity(e.target.value); setVisibleCount(50) }}
          className="px-3 py-1.5 rounded-lg text-xs font-bold cd-head bg-[var(--cd-surface)] border border-[var(--cd-border)] text-[var(--cd-text)] cursor-pointer"
        >
          <option value="all">All Rarities</option>
          {RARITY_ORDER.map(r => (
            <option key={r} value={r}>{RARITIES[r].name}</option>
          ))}
        </select>

        <div className="flex gap-2 ml-auto">
          <button
            onClick={selectAllVisible}
            className="px-3 py-1.5 rounded-lg text-xs font-bold cd-head border border-[var(--cd-border)] text-[var(--cd-text-mid)] hover:bg-white/[0.03] transition-all cursor-pointer"
          >
            Select All
          </button>
          {selected.size > 0 && (
            <button
              onClick={clearSelection}
              className="px-3 py-1.5 rounded-lg text-xs font-bold cd-head border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
            >
              Clear ({selected.size})
            </button>
          )}
        </div>
      </div>

      {/* Card grid */}
      <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
        {visibleCards.map(card => (
          <DismantleSlot
            key={card.id}
            card={card}
            isSelected={selected.has(card.id)}
            onToggle={toggle}
            override={getDefOverride(card)}
          />
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => setVisibleCount(prev => prev + 50)}
            className="px-5 py-2 rounded-lg text-xs font-bold cd-head border border-[var(--cd-border)] text-[var(--cd-text-mid)] hover:bg-white/[0.03] transition-all cursor-pointer"
          >
            Load More ({cards.length - visibleCount} remaining)
          </button>
        </div>
      )}

      {cards.length === 0 && (
        <div className="text-center py-12 text-[var(--cd-text-dim)] text-sm">
          No cards match the current filters.
        </div>
      )}

      {/* Result toast */}
      {result && (
        <div className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-lg border text-sm font-bold cd-head ${
          result.error
            ? 'bg-red-500/10 border-red-500/20 text-red-400'
            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
        }`}>
          {result.error
            ? result.error
            : <span className="flex items-center gap-1">
                Dismantled {result.dismantled} card{result.dismantled > 1 ? 's' : ''} for
                <CoresLabel value={result.emberGained} iconSize="h-4" />
              </span>
          }
        </div>
      )}

      {/* Bottom bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--cd-border)] bg-[#0a0e14]/95 backdrop-blur-md">
          <div className="max-w-[1400px] mx-auto px-4 py-3 sm:py-4 flex flex-col sm:flex-row items-center gap-3 sm:gap-6">
            {/* Breakdown */}
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <div className="text-sm sm:text-base text-white cd-head font-bold shrink-0">
                <span className="text-[var(--cd-cyan)] cd-num">{selectedCount}</span> card{selectedCount !== 1 ? 's' : ''}
              </div>
              <div className="flex gap-1 sm:gap-2 flex-wrap">
                {RARITY_ORDER.map(r => {
                  const count = breakdown[r]
                  if (!count) return null
                  return (
                    <span key={r} className="text-[10px] sm:text-xs cd-num px-1 sm:px-1.5 py-0.5 rounded font-bold" style={{ color: RARITIES[r].color, backgroundColor: RARITIES[r].color + '15' }}>
                      {count}<span className="hidden sm:inline"> {RARITIES[r].name}</span>
                    </span>
                  )
                })}
              </div>
            </div>

            {/* Value preview */}
            <div className="text-right">
              <div className="text-[11px] text-white/60 uppercase tracking-wider cd-head font-bold">Value</div>
              <div className="flex items-center gap-1.5">
                <span className={`text-2xl font-bold cd-num ${coresTotal >= 1 ? 'text-white' : 'text-red-400'}`}>
                  {coresTotal}
                </span>
                {rawTotal !== coresTotal && (
                  <span className="text-sm text-white/40 cd-num">({rawTotal.toFixed(1)})</span>
                )}
                <img src={emberIcon} alt="Cores" className="h-6 w-auto object-contain" />
              </div>
              {coresTotal < 1 && (
                <div className="text-[11px] text-red-400 font-bold">Min. 1 Core required</div>
              )}
            </div>

            {/* Dismantle button */}
            <button
              onClick={handleDismantle}
              disabled={coresTotal < 1 || dismantling}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold cd-head uppercase tracking-wider transition-all cursor-pointer ${
                coresTotal >= 1
                  ? 'bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 hover:shadow-[0_0_20px_rgba(239,68,68,0.15)]'
                  : 'bg-white/5 border border-white/10 text-white/20 cursor-not-allowed'
              }`}
            >
              {dismantling ? (
                <div className="cd-spinner w-4 h-4" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Dismantle
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function DismantleSlot({ card, isSelected, onToggle, override }) {
  const type = getCardType(card)
  const isPlayer = type === 'player'
  const rarityInfo = RARITIES[card.rarity] || RARITIES.common

  return (
    <div
      className={`relative cursor-pointer transition-all duration-150 rounded-lg ${
        isSelected
          ? 'ring-2 ring-[var(--cd-cyan)] shadow-[0_0_12px_rgba(34,211,238,0.2)] scale-[0.97]'
          : 'hover:scale-[1.02] opacity-80 hover:opacity-100'
      }`}
      onClick={() => onToggle(card.id)}
    >
      {isPlayer ? (
        <TradingCard {...toPlayerCardProps(card)} variant="player" rarity={card.rarity} size={CARD_SIZE} />
      ) : (
        <GameCard type={type} rarity={card.rarity} data={toGameCardData(card, override)} size={CARD_SIZE} />
      )}

      {/* Selection checkmark */}
      {isSelected && (
        <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[var(--cd-cyan)] flex items-center justify-center shadow-lg">
          <Check className="w-3 h-3 text-black" strokeWidth={3} />
        </div>
      )}

      {/* Value badge */}
      <div
        className="absolute bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[10px] font-bold cd-num flex items-center gap-0.5"
        style={{ backgroundColor: rarityInfo.color + '20', color: rarityInfo.color }}
      >
        {rarityInfo.dismantleValue}
        <img src={emberIcon} alt="" className="h-3 w-auto object-contain" />
      </div>
    </div>
  )
}

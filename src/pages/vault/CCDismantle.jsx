import { useState, useMemo, useCallback, useEffect } from 'react'
import { useVault } from './VaultContext'
import { RARITIES, DISMANTLE_TIERS, getDismantleMultiplier, calcDismantleTotal } from '../../data/vault/economy'
import GameCard from './components/GameCard'
import VaultCard from './components/VaultCard'
import TradingCard from '../../components/TradingCard'
import { Hammer, Check, Trash2, Info, Copy } from 'lucide-react'
import emberIcon from '../../assets/ember.png'

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'unique']
const DISMANTLE_RARITIES = RARITY_ORDER.filter(r => r !== 'unique')
const HOLO_TYPES = ['holo', 'reverse', 'full']
const HOLO_TYPE_LABELS = { holo: 'Holo', reverse: 'Reverse', full: 'Full Art' }
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
    signatureUrl: card.signatureUrl || undefined,
  }
  if (type === 'god') return { ...base, role: card.role, ability: card.ability || cd.ability, imageKey: cd?.imageKey }
  if (type === 'item') return { ...base, category: cd.category || card.godClass, manaCost: cd.manaCost || 3, effects: cd.effects || {}, passive: cd.passive, imageKey: cd?.imageKey }
  if (type === 'consumable') return { ...base, color: cd.color || '#10b981', description: cd.description || '', manaCost: cd.manaCost || 1 }
  return base
}

function toPlayerCardProps(card) {
  const cd = card.cardData || {}
  return {
    playerName: card.godName, teamName: cd.teamName || '', teamColor: cd.teamColor || '#6366f1',
    role: cd.role || card.role || 'ADC', avatarUrl: card.imageUrl || '',
    leagueName: cd.leagueName || '', divisionName: cd.divisionName || '',
    seasonName: cd.seasonName || '',
    bestGod: card.bestGodName ? { name: card.bestGodName } : null,
    stats: cd.stats || null,
    isFirstEdition: card.isFirstEdition || false,
    isConnected: card.isConnected,
    defId: card.defId,
    rarity: card.rarity,
    signatureUrl: card.signatureUrl || undefined,
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

function useResetCountdown() {
  const [timeLeft, setTimeLeft] = useState('')
  useEffect(() => {
    const calc = () => {
      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setUTCHours(24, 0, 0, 0)
      const diff = tomorrow - now
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft(`${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`)
    }
    calc()
    const id = setInterval(calc, 1000)
    return () => clearInterval(id)
  }, [])
  return timeLeft
}

function SalvageGauge({ dismantledToday, dismantledValueToday = 0, currentRate }) {
  const pressure = Math.min(((1 - currentRate) / 0.9) * 100, 100)
  const needleAngle = -90 + (pressure / 100) * 180
  const resetIn = useResetCountdown()
  const getColor = (pct) => {
    if (pct < 5) return '#00e5ff'
    if (pct < 25) return '#22c55e'
    if (pct < 60) return '#ff8c00'
    if (pct < 85) return '#ff2d78'
    return '#ef4444'
  }
  const color = getColor(pressure)
  const statusLabel = currentRate >= 1 ? 'OPTIMAL' : currentRate >= 0.5 ? 'REDUCED' : currentRate >= 0.25 ? 'LOW' : 'MINIMAL'

  return (
    <div className="flex flex-col items-center">
      <div className="text-[11px] text-white/35 uppercase tracking-[0.2em] font-bold mb-1 cd-head">Salvage Rate</div>
      <div className="relative w-36 h-20">
        <div className="absolute inset-0 rounded-full"
          style={{ background: `radial-gradient(ellipse at 50% 90%, ${color}12, transparent 70%)`, filter: 'blur(12px)' }} />
        <svg viewBox="0 0 200 110" className="w-full h-full relative z-1">
          <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#111a2a" strokeWidth="16" strokeLinecap="round" />
          <path d="M 20 100 A 80 80 0 0 1 43 43" fill="none" stroke="#00e5ff" strokeWidth="13" strokeLinecap="round" opacity="0.5" />
          <path d="M 46 40 A 80 80 0 0 1 100 20" fill="none" stroke="#22c55e" strokeWidth="13" opacity="0.5" />
          <path d="M 100 20 A 80 80 0 0 1 154 40" fill="none" stroke="#ff8c00" strokeWidth="13" opacity="0.5" />
          <path d="M 157 43 A 80 80 0 0 1 180 100" fill="none" stroke="#ef4444" strokeWidth="13" strokeLinecap="round" opacity="0.5" />
          {pressure > 0 && (
            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
              strokeDasharray={`${pressure * 2.51} 251`} opacity="0.8"
              style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
          )}
          {[...Array(11)].map((_, i) => {
            const angle = (180 - i * 18) * Math.PI / 180
            return <line key={i} x1={100 + 68 * Math.cos(angle)} y1={100 - 68 * Math.sin(angle)}
              x2={100 + 63 * Math.cos(angle)} y2={100 - 63 * Math.sin(angle)} stroke="white" strokeWidth="1" opacity="0.15" />
          })}
          <g transform={`rotate(${needleAngle}, 100, 100)`} style={{ transition: 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
            <line x1="100" y1="100" x2="100" y2="28" stroke={color} strokeWidth="3" strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
          </g>
          <circle cx="100" cy="100" r="8" fill="#0a0f1a" stroke={color} strokeWidth="2" opacity="0.8" />
          <circle cx="100" cy="100" r="3" fill={color} opacity="0.9" />
          <text x="15" y="108" fill="white" opacity="0.15" fontSize="7" fontFamily="'Share Tech Mono', monospace" textAnchor="start">100%</text>
          <text x="185" y="108" fill="white" opacity="0.15" fontSize="7" fontFamily="'Share Tech Mono', monospace" textAnchor="end">10%</text>
        </svg>
      </div>
      <div className="flex items-center gap-1.5 mt-0.5">
        <div className="text-lg font-bold tabular-nums cd-num cd-text-glow" style={{ color }}>{Math.round(currentRate * 100)}%</div>
        <div className="text-[11px] font-bold uppercase tracking-wider cd-head" style={{ color: color + 'bb' }}>{statusLabel}</div>
      </div>
      <div className="text-[11px] text-white/30 mt-0.5 cd-mono">{Math.round(dismantledValueToday * 10) / 10} Cores today ({dismantledToday} cards)</div>
      {dismantledToday > 0 && (
        <div className="text-[10px] text-white/20 mt-0.5 cd-mono">Resets in {resetIn}</div>
      )}
    </div>
  )
}

export default function CCDismantle() {
  const { collection, dismantleCards, startingFive, binderCards, getDefOverride, stats, lockedCardIds: apiLockedCardIds } = useVault()
  const dismantledToday = stats?.dismantledToday || 0
  const dismantledValueToday = stats?.dismantledValueToday || 0
  const [selected, setSelected] = useState(new Set())
  const [dismantling, setDismantling] = useState(false)
  const [result, setResult] = useState(null)
  const [filterRarity, setFilterRarity] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [filterHolo, setFilterHolo] = useState('all')
  const [filterDuplicates, setFilterDuplicates] = useState(false)
  const [showRates, setShowRates] = useState(true)
  const [visibleCount, setVisibleCount] = useState(50)

  const lockedCardIds = useMemo(() => {
    const ids = new Set()
    for (const lineup of [startingFive?.currentSeason, startingFive?.allStar]) {
      if (!lineup?.slots) continue
      for (const slot of Object.values(lineup.slots)) {
        if (slot.card?.id) ids.add(slot.card.id)
        if (slot.godCard?.id) ids.add(slot.godCard.id)
        if (slot.itemCard?.id) ids.add(slot.itemCard.id)
      }
    }
    if (startingFive?.consumableCard?.id) ids.add(startingFive.consumableCard.id)
    for (const bc of (binderCards || [])) {
      if (bc.card?.id) ids.add(bc.card.id)
    }
    for (const id of (apiLockedCardIds || [])) {
      ids.add(id)
    }
    return ids
  }, [startingFive, binderCards, apiLockedCardIds])

  const cards = useMemo(() => {
    let list = collection.filter(c => !lockedCardIds.has(c.id) && c.rarity !== 'unique')
    if (filterRarity !== 'all') list = list.filter(c => c.rarity === filterRarity)
    if (filterType !== 'all') list = list.filter(c => getCardType(c) === filterType)
    if (filterHolo !== 'all') list = list.filter(c => c.holoType === filterHolo)
    if (filterDuplicates) {
      const groups = new Map()
      for (const c of list) {
        const key = `${c.godId}:${c.rarity}:${c.holoType || ''}`
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key).push(c)
      }
      list = []
      for (const group of groups.values()) {
        if (group.length < 2) continue
        group.sort((a, b) => (b.level || 1) - (a.level || 1) || (b.power || 0) - (a.power || 0) || a.id - b.id)
        list.push(...group.slice(1))
      }
    }
    list.sort((a, b) => {
      const nameComp = (a.godName || '').localeCompare(b.godName || '')
      if (nameComp !== 0) return nameComp
      const teamComp = (a.cardData?.teamName || '').localeCompare(b.cardData?.teamName || '')
      if (teamComp !== 0) return teamComp
      const rarityComp = RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)
      if (rarityComp !== 0) return rarityComp
      return HOLO_TYPES.indexOf(a.holoType) - HOLO_TYPES.indexOf(b.holoType)
    })
    return list
  }, [collection, filterRarity, filterType, filterHolo, filterDuplicates, lockedCardIds])

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

  const currentMultiplier = getDismantleMultiplier(dismantledValueToday)

  const { fullValue, coresTotal, selectedCount, breakdown } = useMemo(() => {
    const selectedCards = []
    const counts = {}
    let fullVal = 0
    for (const card of collection) {
      if (!selected.has(card.id)) continue
      selectedCards.push(card)
      fullVal += RARITIES[card.rarity]?.dismantleValue || 0
      counts[card.rarity] = (counts[card.rarity] || 0) + 1
    }
    const adjusted = calcDismantleTotal(selectedCards, dismantledValueToday)
    return { fullValue: Math.floor(Math.round(fullVal * 10) / 10), coresTotal: adjusted, selectedCount: selectedCards.length, breakdown: counts }
  }, [collection, selected, dismantledValueToday])

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
          <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start">
            <SalvageGauge dismantledToday={dismantledToday} dismantledValueToday={dismantledValueToday} currentRate={currentMultiplier} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold cd-head text-[var(--cd-text-mid)] mb-2 uppercase tracking-wider">Base Rates</div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {DISMANTLE_RARITIES.map(r => {
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
              <div className="mt-3 pt-3 border-t border-[var(--cd-border)]">
                <div className="text-xs font-bold cd-head text-[var(--cd-text-mid)] mb-2 uppercase tracking-wider">Daily Diminishing Returns</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {DISMANTLE_TIERS.map((tier, i) => {
                    const prevUpTo = i === 0 ? 0 : DISMANTLE_TIERS[i - 1].upTo
                    const label = tier.upTo === Infinity ? `${prevUpTo}+` : `${prevUpTo}–${tier.upTo}`
                    const isActive = dismantledValueToday >= prevUpTo && dismantledValueToday < tier.upTo
                    return (
                      <div key={i} className={`p-2 rounded-lg ${isActive ? 'bg-[var(--cd-cyan)]/10 border border-[var(--cd-cyan)]/30' : 'bg-black/20'}`}>
                        <div className="text-[var(--cd-text-dim)] cd-head">Cores {label}</div>
                        <div className={`font-bold cd-num ${isActive ? 'text-[var(--cd-cyan)]' : 'text-[var(--cd-text)]'}`}>
                          {Math.round(tier.rate * 100)}% value
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
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
          {DISMANTLE_RARITIES.map(r => (
            <option key={r} value={r}>{RARITIES[r].name}</option>
          ))}
        </select>

        <select
          value={filterHolo}
          onChange={e => { setFilterHolo(e.target.value); setVisibleCount(50) }}
          className="px-3 py-1.5 rounded-lg text-xs font-bold cd-head bg-[var(--cd-surface)] border border-[var(--cd-border)] text-[var(--cd-text)] cursor-pointer"
        >
          <option value="all">All Holo Types</option>
          {HOLO_TYPES.map(h => (
            <option key={h} value={h}>{HOLO_TYPE_LABELS[h]}</option>
          ))}
        </select>

        <button
          onClick={() => { setFilterDuplicates(d => !d); setVisibleCount(50) }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cd-head border transition-all cursor-pointer ${
            filterDuplicates
              ? 'border-[var(--cd-cyan)]/40 bg-[var(--cd-cyan)]/10 text-[var(--cd-cyan)]'
              : 'border-[var(--cd-border)] text-[var(--cd-text-mid)] hover:bg-white/[0.03]'
          }`}
        >
          <Copy className="w-3.5 h-3.5" />
          Duplicates
        </button>

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
        <div className="fixed bottom-[68px] sidebar:bottom-0 left-0 right-0 z-40 border-t border-[var(--cd-border)] bg-[#0a0e14]/95 backdrop-blur-md">
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
                {fullValue > coresTotal && (
                  <span className="text-sm text-white/40 cd-num line-through">({fullValue})</span>
                )}
                <img src={emberIcon} alt="Cores" className="h-6 w-auto object-contain" />
              </div>
              {coresTotal < 1 && (
                <div className="text-[11px] text-red-400 font-bold">Min. 1 Core required</div>
              )}
              {currentMultiplier < 1 && (
                <div className="text-[10px] text-amber-400 font-bold">{Math.round(currentMultiplier * 100)}% rate ({Math.round(dismantledValueToday)} Cores today)</div>
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
  const { getTemplate } = useVault()
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
      {type === 'collection' ? (
        <VaultCard card={card} getTemplate={getTemplate} size={CARD_SIZE} holo={false} />
      ) : isPlayer ? (
        <TradingCard {...toPlayerCardProps(card)} rarity={card.rarity} size={CARD_SIZE} />
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

import { useState, useMemo, useEffect, useRef } from 'react'
import { Heart, Lock, Copy } from 'lucide-react'
import { useVault } from '../VaultContext'
import GameCard from '../components/GameCard'
import VaultCard from '../components/VaultCard'
import TradingCard from '../../../components/TradingCard'

const CARD_SIZE = 130
const MIN_TRADE_PILE = 10
const PAGE_SIZE = 40

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']
const TYPE_ORDER = ['player', 'god', 'item', 'consumable', 'collection']

function tiebreak(a, b) {
  const ta = TYPE_ORDER.indexOf(getCardType(a))
  const tb = TYPE_ORDER.indexOf(getCardType(b))
  if (ta !== tb) return (ta === -1 ? 99 : ta) - (tb === -1 ? 99 : tb)
  const ra = RARITY_ORDER.indexOf(a.rarity)
  const rb = RARITY_ORDER.indexOf(b.rarity)
  if (ra !== rb) return rb - ra // higher rarity first
  return (a.godName || '').localeCompare(b.godName || '')
}
const HOLO_TYPE_LABELS = { holo: 'Holo', reverse: 'Reverse', full: 'Full Art' }
const SORT_OPTIONS = [
  { value: 'pile-first', label: 'Trade Pile First' },
  { value: 'name-asc', label: 'Name A–Z' },
  { value: 'name-desc', label: 'Name Z–A' },
  { value: 'rarity-asc', label: 'Rarity ↑' },
  { value: 'rarity-desc', label: 'Rarity ↓' },
  { value: 'newest', label: 'Newest' },
  { value: 'power', label: 'Power' },
]

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
    passiveName: card.passiveName || undefined,
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

export default function TradePileManager({ collection, lockedCardIds, tradePile, onToggle, tradePileCount, onStartSwiping }) {
  const { getDefOverride, getBlueprint } = useVault()
  const [filterRarity, setFilterRarity] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [filterHolo, setFilterHolo] = useState('all')
  const [filterDuplicates, setFilterDuplicates] = useState(false)
  const [sortBy, setSortBy] = useState('pile-first')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const sentinelRef = useRef(null)

  const filtered = useMemo(() => {
    if (!collection) return []
    let list = collection.filter(card => {
      if (card.rarity === 'unique' || card.rarity === 'common' || card.rarity === 'uncommon') return false
      // Hide locked cards unless they're already in the trade pile
      if (lockedCardIds.has(card.id) && !tradePile.has(card.id)) return false
      if (filterRarity !== 'all' && card.rarity !== filterRarity) return false
      if (filterType !== 'all' && getCardType(card) !== filterType) return false
      if (filterHolo !== 'all' && card.holoType !== filterHolo) return false
      return true
    })
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
    return list
  }, [collection, lockedCardIds, tradePile, filterRarity, filterType, filterHolo, filterDuplicates])

  // Snapshot tradePile at sort time so toggling doesn't re-sort
  const sortPileRef = useRef(tradePile)
  useEffect(() => { sortPileRef.current = tradePile }, [sortBy, filterRarity, filterType, filterHolo, filterDuplicates]) // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = useMemo(() => {
    const pileSnap = sortPileRef.current
    return [...filtered].sort((a, b) => {
      if (sortBy === 'pile-first') {
        const aInPile = pileSnap.has(a.id) ? 0 : 1
        const bInPile = pileSnap.has(b.id) ? 0 : 1
        if (aInPile !== bInPile) return aInPile - bInPile
        const aLocked = lockedCardIds.has(a.id) ? 1 : 0
        const bLocked = lockedCardIds.has(b.id) ? 1 : 0
        if (aLocked !== bLocked) return aLocked - bLocked
      }

      let primary = 0
      switch (sortBy) {
        case 'name-asc':
          primary = (a.godName || '').localeCompare(b.godName || '')
          break
        case 'name-desc':
          primary = (b.godName || '').localeCompare(a.godName || '')
          break
        case 'rarity-asc':
          primary = RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)
          break
        case 'rarity-desc':
          primary = RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity)
          break
        case 'newest':
          primary = (b.id || 0) - (a.id || 0)
          break
        case 'power':
          primary = (b.power || 0) - (a.power || 0)
          break
        default:
          primary = (a.godName || '').localeCompare(b.godName || '')
      }
      return primary !== 0 ? primary : tiebreak(a, b)
    })
  }, [filtered, lockedCardIds, sortBy])

  const visibleCards = useMemo(() => sorted.slice(0, visibleCount), [sorted, visibleCount])
  const hasMore = visibleCount < sorted.length

  // Reset visible count when filters/sort change
  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [filterRarity, filterType, filterHolo, filterDuplicates, sortBy])

  // Intersection observer for infinite scroll
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisibleCount(prev => prev + PAGE_SIZE)
    }, { rootMargin: '200px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore])

  const progressPct = Math.min((tradePileCount / MIN_TRADE_PILE) * 100, 100)
  const meetsMinimum = tradePileCount >= MIN_TRADE_PILE

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-bold cd-head tracking-wider" style={{ color: 'var(--cd-text)' }}>
            Trade Pile
          </span>
          <span className="text-sm cd-num font-bold" style={{ color: meetsMinimum ? 'var(--cd-magenta)' : 'var(--cd-text-dim)' }}>
            {tradePileCount}/{MIN_TRADE_PILE}
            {meetsMinimum && <span className="text-xs ml-1 opacity-70">+</span>}
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--cd-surface)' }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progressPct}%`,
              background: meetsMinimum
                ? 'var(--cd-magenta)'
                : `linear-gradient(90deg, var(--cd-magenta), color-mix(in srgb, var(--cd-magenta) 40%, transparent))`,
            }}
          />
        </div>
        {!meetsMinimum ? (
          <p className="text-[11px] mt-1" style={{ color: 'var(--cd-text-dim)' }}>
            Add {MIN_TRADE_PILE - tradePileCount} more card{MIN_TRADE_PILE - tradePileCount !== 1 ? 's' : ''} to start matching
          </p>
        ) : (
          <div className="flex items-center justify-between mt-2">
            <p className="text-[11px]" style={{ color: 'var(--cd-text-dim)' }}>
              Ready to match! Add more cards to improve your chances, or start swiping.
            </p>
            <button
              onClick={onStartSwiping}
              className="flex-shrink-0 ml-3 px-3 py-1 rounded-lg text-xs font-bold cd-head tracking-wider text-white transition-all active:scale-95 cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #ec4899, #be185d)', boxShadow: '0 0 12px rgba(236,72,153,0.3)' }}
            >
              Start Swiping
            </button>
          </div>
        )}
      </div>

      {/* Filters — matches CCDismantle pattern */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={filterRarity}
          onChange={e => setFilterRarity(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs font-bold cd-head bg-[var(--cd-surface)] border border-[var(--cd-border)] text-[var(--cd-text)] cursor-pointer"
        >
          <option value="all">All Rarities</option>
          {RARITY_ORDER.filter(r => r !== 'common' && r !== 'uncommon').map(r => (
            <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>
          ))}
        </select>

        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs font-bold cd-head bg-[var(--cd-surface)] border border-[var(--cd-border)] text-[var(--cd-text)] cursor-pointer"
        >
          <option value="all">All Types</option>
          <option value="player">Player</option>
          <option value="god">God</option>
          <option value="item">Item</option>
          <option value="consumable">Consumable</option>
        </select>

        <select
          value={filterHolo}
          onChange={e => setFilterHolo(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs font-bold cd-head bg-[var(--cd-surface)] border border-[var(--cd-border)] text-[var(--cd-text)] cursor-pointer"
        >
          <option value="all">All Holos</option>
          {Object.entries(HOLO_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <button
          onClick={() => setFilterDuplicates(d => !d)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cd-head border transition-all cursor-pointer ${
            filterDuplicates
              ? 'border-[var(--cd-cyan)]/40 bg-[var(--cd-cyan)]/10 text-[var(--cd-cyan)]'
              : 'border-[var(--cd-border)] text-[var(--cd-text-mid)] hover:bg-white/[0.03]'
          }`}
        >
          <Copy className="w-3.5 h-3.5" />
          Duplicates
        </button>

        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs font-bold cd-head bg-[var(--cd-surface)] border border-[var(--cd-border)] text-[var(--cd-text)] cursor-pointer"
        >
          {SORT_OPTIONS.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Card grid */}
      {sorted.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'var(--cd-text-dim)' }}>
          <Heart className="w-10 h-10 mx-auto mb-2 opacity-20" />
          <p className="text-sm font-bold cd-head">
            {collection?.length === 0 ? 'No cards in your collection' : 'No cards match filters'}
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
          {visibleCards.map(card => {
            const inPile = tradePile.has(card.id)
            const locked = lockedCardIds.has(card.id)
            const type = getCardType(card)
            const isPlayer = type === 'player'
            const override = getDefOverride(card)

            return (
              <div
                key={card.id}
                className={`relative isolate cursor-pointer rounded-lg ${locked ? 'opacity-45' : ''}`}
                onClick={() => {
                  if (locked) return
                  onToggle(card.id)
                }}
              >
                {(card.blueprintId || card.cardData?._blueprintData) ? (
                  <VaultCard card={card} getBlueprint={getBlueprint} size={CARD_SIZE} holo={false} />
                ) : isPlayer ? (
                  <TradingCard {...toPlayerCardProps(card)} rarity={card.rarity} size={CARD_SIZE} />
                ) : (
                  <GameCard type={type} rarity={card.rarity} data={toGameCardData(card, override)} size={CARD_SIZE} />
                )}

                {/* Trade pile overlay */}
                {inPile && (
                  <div className="absolute inset-0 z-10 rounded-lg bg-pink-500/20 border-2 border-pink-500/60 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-pink-500/80 flex items-center justify-center">
                      <Heart className="w-4 h-4 text-white fill-white" />
                    </div>
                  </div>
                )}

                {/* Locked overlay */}
                {locked && (
                  <div className="absolute inset-0 z-10 rounded-lg bg-black/40 flex items-center justify-center">
                  </div>
                )}
              </div>
            )
          })}
          {hasMore && <div ref={sentinelRef} className="w-full h-4" />}
        </div>
      )}
    </div>
  )
}

import { useState, useMemo, useCallback, useEffect } from 'react'
import { X, Search } from 'lucide-react'
import GameCard from '../components/GameCard'
import TradingCard from '../../../components/TradingCard'
import TradingCardHolo from '../../../components/TradingCardHolo'
import { getHoloEffect } from '../../../data/vault/economy'
import { GODS } from '../../../data/vault/gods'
import { ITEMS } from '../../../data/vault/items'
import { CONSUMABLES } from '../../../data/vault/buffs'
import { useVault } from '../VaultContext'
import { tradematchService } from '../../../services/database'

const GOD_MAP = new Map(GODS.map(g => [g.slug, g]))
const ITEM_MAP = new Map(ITEMS.map(i => [String(i.id), i]))
const CONSUMABLE_MAP = new Map(CONSUMABLES.map(c => [c.id, c]))
const DATA_MAPS = { god: GOD_MAP, item: ITEM_MAP, consumable: CONSUMABLE_MAP }
const ROLE_SUFFIXES = ['-solo', '-jungle', '-mid', '-support', '-adc']

function resolveDataMap(type, godId) {
  const dataMap = DATA_MAPS[type]
  if (!dataMap) return null
  const key = godId?.replace(/^(item|consumable)-/, '') || godId
  let data = dataMap.get(key)
  if (!data && type === 'god') {
    for (const suffix of ROLE_SUFFIXES) {
      if (key.endsWith(suffix)) {
        data = dataMap.get(key.slice(0, -suffix.length))
        if (data) break
      }
    }
  }
  return data
}

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']
const TYPE_ORDER = ['player', 'god', 'item', 'consumable']

function apiCardSort(a, b) {
  const cdA = a.card_data ? (typeof a.card_data === 'string' ? JSON.parse(a.card_data) : a.card_data) : {}
  const cdB = b.card_data ? (typeof b.card_data === 'string' ? JSON.parse(b.card_data) : b.card_data) : {}
  const typeA = a.card_type || cdA.cardType || 'god'
  const typeB = b.card_type || cdB.cardType || 'god'
  // Sort by type first
  const ta = TYPE_ORDER.indexOf(typeA)
  const tb = TYPE_ORDER.indexOf(typeB)
  if (ta !== tb) return (ta === -1 ? 99 : ta) - (tb === -1 ? 99 : tb)
  // Then rarity (higher first)
  const ra = RARITY_ORDER.indexOf(a.rarity)
  const rb = RARITY_ORDER.indexOf(b.rarity)
  if (ra !== rb) return rb - ra
  // Then name
  return (a.god_name || '').localeCompare(b.god_name || '')
}

const CARD_SIZE = 80

function PickerCard({ card, onSelect, disabled }) {
  const { getDefOverride } = useVault()
  const cd = card.card_data ? (typeof card.card_data === 'string' ? JSON.parse(card.card_data) : card.card_data) : {}
  const type = card.card_type || cd.cardType || 'god'
  const isPlayer = type === 'player' || cd.teamName
  const holoType = card.holo_type || card.holoType || null
  const holoEffect = holoType ? getHoloEffect(card.rarity) : null

  let inner
  if (isPlayer) {
    inner = (
      <TradingCard
        playerName={card.god_name || card.player_name}
        teamName={cd.teamName || ''}
        teamColor={cd.teamColor || '#6366f1'}
        role={cd.role || 'ADC'}
        avatarUrl={card.image_url || ''}
        rarity={card.rarity}
        leagueName={cd.leagueName || ''}
        divisionName={cd.divisionName || ''}
        bestGod={cd.bestGodName ? { name: cd.bestGodName } : null}
        isConnected={cd.isConnected}
        isFirstEdition={card.serial_number === 1}
        signatureUrl={cd.signatureUrl}
        size={CARD_SIZE}
        holo={holoEffect ? { rarity: holoEffect, holoType: holoType || 'reverse' } : undefined}
      />
    )
  } else {
    const rawData = resolveDataMap(type, card.god_id)
    const override = getDefOverride({ cardType: type, godId: card.god_id })
    const resolvedData = rawData && override
      ? { ...rawData, metadata: override, imageUrl: override.custom_image_url || rawData.imageUrl }
      : rawData

    const gameCardEl = (
      <GameCard
        type={type}
        rarity={card.rarity}
        data={resolvedData || { name: card.god_name, slug: card.god_id, imageUrl: card.image_url }}
        size={CARD_SIZE}
      />
    )
    inner = holoEffect ? (
      <TradingCardHolo rarity={holoEffect} holoType={holoType || 'reverse'} size={CARD_SIZE}>
        {gameCardEl}
      </TradingCardHolo>
    ) : gameCardEl
  }

  return (
    <button
      onClick={() => !disabled && onSelect(card)}
      disabled={disabled}
      className={`relative rounded-lg transition-all cursor-pointer ${disabled ? 'opacity-30 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}
    >
      {inner}
    </button>
  )
}

export default function CardPicker({ side, partnerId, existingCardIds, onAdd, onClose }) {
  const [cards, setCards] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const load = side === 'mine'
      ? tradematchService.tradePile()
      : tradematchService.tradePileView(partnerId)

    load.then(data => {
      if (!cancelled) {
        setCards(data.cards || [])
        setLoading(false)
      }
    }).catch(() => {
      if (!cancelled) { setCards([]); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [side, partnerId])

  const filtered = useMemo(() => {
    if (!cards) return []
    let list = cards.filter(c => !existingCardIds.has(c.card_id))
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        (c.god_name || '').toLowerCase().includes(q) ||
        (c.rarity || '').toLowerCase().includes(q)
      )
    }
    return list.sort(apiCardSort)
  }, [cards, existingCardIds, search])

  const handleSelect = useCallback((card) => {
    onAdd(card.card_id)
    onClose()
  }, [onAdd, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative w-full max-w-lg max-h-[80vh] rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden"
        style={{ background: 'var(--cd-surface)', border: '1px solid var(--cd-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--cd-border)]">
          <h3 className="cd-head text-sm font-bold tracking-wider uppercase" style={{ color: 'var(--cd-text)' }}>
            {side === 'mine' ? 'Your Trade Pile' : "Their Trade Pile"}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer">
            <X className="w-4 h-4" style={{ color: 'var(--cd-text-dim)' }} />
          </button>
        </div>

        <div className="px-4 py-2 border-b border-[var(--cd-border)]">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--cd-text-dim)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search cards..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-[var(--cd-edge)] text-[var(--cd-text)] border border-[var(--cd-border)] outline-none focus:border-[var(--cd-cyan)]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--cd-cyan)', borderTopColor: 'transparent' }} />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: 'var(--cd-text-dim)' }}>
              {search ? 'No matching cards' : 'No available cards'}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 justify-center">
              {filtered.map(card => (
                <PickerCard
                  key={card.card_id}
                  card={card}
                  onSelect={handleSelect}
                  disabled={existingCardIds.has(card.card_id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

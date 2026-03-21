import { useState, useMemo, useCallback, useEffect } from 'react'
import { X, Search } from 'lucide-react'
import GameCard from '../components/GameCard'
import TradingCard from '../../../components/TradingCard'
import TradingCardHolo from '../../../components/TradingCardHolo'
import { getHoloEffect } from '../../../data/vault/economy'
import { useVault } from '../VaultContext'
import { tradematchService } from '../../../services/database'

const CARD_SIZE = 80

function PickerCard({ card, onSelect, disabled }) {
  const { getDefOverride } = useVault()
  const cd = card.card_data ? (typeof card.card_data === 'string' ? JSON.parse(card.card_data) : card.card_data) : {}
  const type = card.card_type || cd.cardType || 'god'
  const isPlayer = type === 'player' || cd.teamName
  const override = !isPlayer ? getDefOverride({ cardType: type, godId: card.god_id }) : null
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
    const gameCardEl = (
      <GameCard
        type={type}
        rarity={card.rarity}
        data={{
          name: card.god_name || card.player_name,
          imageUrl: override?.custom_image_url || card.image_url,
          id: card.god_id,
          serialNumber: card.serial_number,
          metadata: override || undefined,
          role: cd.role,
          ability: cd.ability,
          class: cd.class,
          category: cd.category,
          manaCost: cd.manaCost,
          effects: cd.effects,
          passive: cd.passive,
          color: cd.color,
          description: cd.description,
          imageKey: cd.imageKey,
        }}
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

export default function CardPicker({ side, tradeId, partnerId, existingCardIds, onAdd, onClose }) {
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
    return list
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

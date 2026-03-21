import { useState, useEffect, useCallback, useMemo } from 'react'
import { ArrowLeft, Send, Check, X, RotateCcw, Loader2, AlertTriangle, Gem } from 'lucide-react'
import GameCard from '../components/GameCard'
import TradingCard from '../../../components/TradingCard'
import TradingCardHolo from '../../../components/TradingCardHolo'
import { getHoloEffect } from '../../../data/vault/economy'
import { useVault } from '../VaultContext'
import { tradematchService } from '../../../services/database'
import CardPicker from './CardPicker'

const CARD_SIZE = 90

function OfferCard({ card, onRemove, showRemove }) {
  const { getDefOverride } = useVault()
  const cd = card.card_data ? (typeof card.card_data === 'string' ? JSON.parse(card.card_data) : card.card_data) : {}
  const type = card.card_type || cd.cardType || 'god'
  const isPlayer = type === 'player' || cd.teamName
  const override = !isPlayer ? getDefOverride({ cardType: type, godId: card.god_id }) : null
  const holoType = card.holo_type || card.holoType || null
  const holoEffect = holoType ? getHoloEffect(card.rarity) : null
  const unavailable = card.available === false

  let inner
  if (isPlayer) {
    inner = (
      <TradingCard
        playerName={card.god_name}
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
          name: card.god_name,
          imageUrl: override?.custom_image_url || card.image_url,
          id: card.god_id,
          serialNumber: card.serial_number,
          metadata: override || undefined,
          role: cd.role, ability: cd.ability, class: cd.class,
          category: cd.category, manaCost: cd.manaCost,
          effects: cd.effects, passive: cd.passive,
          color: cd.color, description: cd.description, imageKey: cd.imageKey,
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
    <div className="relative group">
      {inner}
      {unavailable && (
        <div className="absolute inset-0 rounded-lg flex items-center justify-center bg-red-900/60 border-2 border-red-500/60">
          <div className="text-center">
            <AlertTriangle className="w-4 h-4 text-red-400 mx-auto mb-0.5" />
            <span className="text-[9px] font-bold text-red-300 cd-head">UNAVAILABLE</span>
          </div>
        </div>
      )}
      {showRemove && (
        <button
          onClick={() => onRemove(card.card_id)}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
        >
          <X className="w-3 h-3" strokeWidth={3} />
        </button>
      )}
    </div>
  )
}

function AddCardSlot({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center rounded-lg border-2 border-dashed transition-all cursor-pointer hover:border-[var(--cd-cyan)] hover:bg-[var(--cd-cyan)]/5"
      style={{
        width: CARD_SIZE, height: CARD_SIZE * 1.4,
        borderColor: 'var(--cd-border)',
      }}
    >
      <span className="text-2xl font-light" style={{ color: 'var(--cd-text-dim)' }}>+</span>
    </button>
  )
}

export default function Negotiation({ tradeId, userId, onBack, onComplete }) {
  const [offer, setOffer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [pickerSide, setPickerSide] = useState(null)
  const [coreInput, setCoreInput] = useState('')

  const fetchOffer = useCallback(async () => {
    try {
      const data = await tradematchService.offerDetail(tradeId)
      setOffer(data)
      const isA = data.trade.player_a_id === userId
      const myCore = isA ? data.trade.player_a_core : data.trade.player_b_core
      setCoreInput(myCore > 0 ? String(myCore) : '')
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [tradeId, userId])

  useEffect(() => { fetchOffer() }, [fetchOffer])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchOffer()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [fetchOffer])

  const trade = offer?.trade
  const isA = trade?.player_a_id === userId
  const partnerId = isA ? trade?.player_b_id : trade?.player_a_id
  const partnerName = isA ? trade?.player_b_name : trade?.player_a_name

  const myCards = useMemo(() =>
    (offer?.cards || []).filter(c => c.offered_by === userId),
  [offer, userId])

  const theirCards = useMemo(() =>
    (offer?.cards || []).filter(c => c.offered_by !== userId),
  [offer, userId])

  const allCardIds = useMemo(() =>
    new Set((offer?.cards || []).map(c => c.card_id)),
  [offer])

  const myCore = trade ? (isA ? trade.player_a_core : trade.player_b_core) : 0
  const theirCore = trade ? (isA ? trade.player_b_core : trade.player_a_core) : 0

  const hasUnavailable = (offer?.cards || []).some(c => !c.available)
  const isPendingFromMe = trade?.offer_status === 'pending' && trade?.offer_by === userId
  const isPendingFromThem = trade?.offer_status === 'pending' && trade?.offer_by !== userId
  const isNegotiating = trade?.offer_status === 'negotiating'
  const canEdit = isNegotiating || isPendingFromThem
  const canSend = canEdit && !hasUnavailable && (myCards.length > 0 || myCore > 0)

  const doAction = useCallback(async (fn) => {
    setActionLoading(true)
    setError(null)
    try {
      await fn()
      await fetchOffer()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }, [fetchOffer])

  const handleAddCard = useCallback((cardId) => {
    doAction(() => tradematchService.offerAddCard(tradeId, cardId))
  }, [tradeId, doAction])

  const handleRemoveCard = useCallback((cardId) => {
    doAction(() => tradematchService.offerRemoveCard(tradeId, cardId))
  }, [tradeId, doAction])

  const handleSetCore = useCallback(() => {
    const amt = parseInt(coreInput) || 0
    doAction(() => tradematchService.offerSetCore(tradeId, amt))
  }, [tradeId, coreInput, doAction])

  const handleSend = useCallback(() => {
    doAction(() => tradematchService.offerSend(tradeId))
  }, [tradeId, doAction])

  const handleAccept = useCallback(async () => {
    setActionLoading(true)
    setError(null)
    try {
      await tradematchService.offerAccept(tradeId, trade.offer_version)
      setSuccess('Trade completed!')
      setTimeout(() => onComplete(), 2000)
    } catch (err) {
      setError(err.message)
      await fetchOffer()
    } finally {
      setActionLoading(false)
    }
  }, [tradeId, trade?.offer_version, fetchOffer, onComplete])

  const handleCancel = useCallback(() => {
    doAction(async () => {
      await tradematchService.offerCancel(tradeId)
      onBack()
    })
  }, [tradeId, doAction, onBack])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--cd-cyan)' }} />
      </div>
    )
  }

  if (!trade) {
    return (
      <div className="text-center py-12">
        <p className="text-sm" style={{ color: 'var(--cd-text-dim)' }}>{error || 'Trade not found'}</p>
        <button onClick={onBack} className="mt-4 text-xs text-[var(--cd-cyan)] cursor-pointer">Go back</button>
      </div>
    )
  }

  return (
    <div className="pb-8">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 mb-4 text-xs font-bold cd-head tracking-wider cursor-pointer transition-colors hover:text-[var(--cd-cyan)]"
        style={{ color: 'var(--cd-text-dim)' }}
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Matches
      </button>

      <div className="flex items-center justify-between mb-4 px-3 py-2 rounded-xl" style={{ background: 'var(--cd-surface)', border: '1px solid var(--cd-border)' }}>
        <span className="text-sm font-semibold" style={{ color: 'var(--cd-text)' }}>
          Trading with <span style={{ color: 'var(--cd-cyan)' }}>@{partnerName}</span>
        </span>
        <span className={`text-[10px] font-bold cd-head tracking-wider px-2 py-0.5 rounded-full ${
          isPendingFromMe ? 'bg-amber-500/15 text-amber-400'
          : isPendingFromThem ? 'bg-emerald-500/15 text-emerald-400'
          : 'bg-[var(--cd-cyan)]/15 text-[var(--cd-cyan)]'
        }`}>
          {isPendingFromMe ? 'WAITING...' : isPendingFromThem ? 'THEIR OFFER' : 'NEGOTIATING'}
        </span>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl p-4" style={{ background: 'var(--cd-surface)', border: '1px solid var(--cd-border)' }}>
          <h3 className="cd-head text-xs font-bold tracking-wider uppercase mb-3" style={{ color: 'var(--cd-text-dim)' }}>
            Your Offer
          </h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {myCards.map(card => (
              <OfferCard key={card.card_id} card={card} onRemove={handleRemoveCard} showRemove={canEdit} />
            ))}
            {canEdit && <AddCardSlot onClick={() => setPickerSide('mine')} />}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Gem className="w-3.5 h-3.5 text-amber-400" />
            {canEdit ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  value={coreInput}
                  onChange={e => setCoreInput(e.target.value)}
                  onBlur={handleSetCore}
                  placeholder="0"
                  className="w-20 px-2 py-1 rounded text-xs bg-[var(--cd-edge)] text-[var(--cd-text)] border border-[var(--cd-border)] outline-none focus:border-[var(--cd-cyan)]"
                />
                <span className="text-[10px]" style={{ color: 'var(--cd-text-dim)' }}>Cores</span>
              </div>
            ) : (
              <span className="text-xs font-semibold" style={{ color: 'var(--cd-text)' }}>{myCore} Cores</span>
            )}
          </div>
        </div>

        <div className="rounded-xl p-4" style={{ background: 'var(--cd-surface)', border: '1px solid var(--cd-border)' }}>
          <h3 className="cd-head text-xs font-bold tracking-wider uppercase mb-3" style={{ color: 'var(--cd-text-dim)' }}>
            You Want
          </h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {theirCards.map(card => (
              <OfferCard key={card.card_id} card={card} onRemove={handleRemoveCard} showRemove={canEdit} />
            ))}
            {canEdit && <AddCardSlot onClick={() => setPickerSide('theirs')} />}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Gem className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-semibold" style={{ color: 'var(--cd-text)' }}>{theirCore} Cores</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        {isPendingFromMe && (
          <p className="text-xs" style={{ color: 'var(--cd-text-dim)' }}>
            Waiting for @{partnerName} to respond...
          </p>
        )}

        {isPendingFromThem && (
          <>
            <button
              onClick={handleAccept}
              disabled={actionLoading || hasUnavailable}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold cd-head tracking-wider text-white transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 0 16px rgba(34,197,94,0.3)' }}
            >
              <Check className="w-4 h-4" strokeWidth={3} />
              Accept
            </button>
            <button
              onClick={() => setError(null)}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold cd-head tracking-wider transition-all active:scale-95 cursor-pointer"
              style={{ color: 'var(--cd-cyan)', background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)' }}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Counter
            </button>
          </>
        )}

        {isNegotiating && (
          <button
            onClick={handleSend}
            disabled={actionLoading || !canSend}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold cd-head tracking-wider text-white transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 0 16px rgba(99,102,241,0.3)' }}
          >
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send Offer
          </button>
        )}

        <button
          onClick={handleCancel}
          disabled={actionLoading}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold cd-head tracking-wider text-red-400 transition-all active:scale-95 cursor-pointer border border-red-500/20 hover:bg-red-500/5"
        >
          <X className="w-3.5 h-3.5" />
          Cancel
        </button>
      </div>

      {pickerSide && (
        <CardPicker
          side={pickerSide === 'mine' ? 'mine' : 'theirs'}
          tradeId={tradeId}
          partnerId={partnerId}
          existingCardIds={allCardIds}
          onAdd={handleAddCard}
          onClose={() => setPickerSide(null)}
        />
      )}
    </div>
  )
}

import { useState, useEffect, useCallback, useMemo } from 'react'
import { ArrowLeft, Send, Check, X, RotateCcw, Loader2, AlertTriangle, RefreshCw, Heart } from 'lucide-react'
import emberIcon from '../../../assets/ember.png'
import GameCard from '../components/GameCard'
import TradingCard from '../../../components/TradingCard'
import TradingCardHolo from '../../../components/TradingCardHolo'
import { getHoloEffect } from '../../../data/vault/economy'
import { GODS } from '../../../data/vault/gods'
import { ITEMS } from '../../../data/vault/items'
import { CONSUMABLES } from '../../../data/vault/buffs'
import { useVault } from '../VaultContext'
import { tradematchService } from '../../../services/database'
import CardPicker from './CardPicker'

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

const CARD_SIZE = 90

function OfferCard({ card, onRemove, showRemove }) {
  const { getDefOverride } = useVault()
  const cd = card.card_data ? (typeof card.card_data === 'string' ? JSON.parse(card.card_data) : card.card_data) : {}
  const type = card.card_type || cd.cardType || 'god'
  const isPlayer = type === 'player' || cd.teamName
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
      {holoType && (
        <div className="mt-0.5 text-center">
          <span className="text-[8px] font-bold cd-head tracking-wider px-1.5 py-0.5 rounded" style={{
            color: holoType === 'full' ? '#a855f7' : holoType === 'reverse' ? 'var(--cd-cyan)' : '#f8c56a',
            background: holoType === 'full' ? 'rgba(168,85,247,0.12)' : holoType === 'reverse' ? 'rgba(0,229,255,0.1)' : 'rgba(248,197,106,0.12)',
          }}>
            {holoType === 'full' ? 'FULL ART' : holoType === 'reverse' ? 'REVERSE' : 'HOLO'}
          </span>
        </div>
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

function TradeCelebration({ partnerName, partnerAvatar, partnerDiscordId, onDone }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm" style={{ animation: 'cd-fade-in 0.3s ease-out' }}>
      <div className="flex flex-col items-center gap-6 px-6 text-center">
        <h2 className="text-2xl font-bold cd-head tracking-wider" style={{ color: 'var(--cd-magenta)', textShadow: '0 0 30px rgba(236,72,153,0.5)', animation: 'pulse 2s ease-in-out infinite' }}>
          Trade Complete!
        </h2>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[var(--cd-magenta)]" style={{ animation: 'cd-fade-in 0.5s ease-out 0.2s both' }}>
            {partnerDiscordId && partnerAvatar ? (
              <img src={`https://cdn.discordapp.com/avatars/${partnerDiscordId}/${partnerAvatar}.webp?size=128`} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xl font-bold text-white cd-head" style={{ background: 'var(--cd-magenta)' }}>
                {partnerName?.[0]?.toUpperCase() || '?'}
              </div>
            )}
          </div>
          <Heart className="w-8 h-8" style={{ color: 'var(--cd-magenta)', fill: 'var(--cd-magenta)', animation: 'pulse 1s ease-in-out infinite' }} />
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[var(--cd-cyan)]" style={{ animation: 'cd-fade-in 0.5s ease-out 0.4s both' }}>
            <div className="w-full h-full flex items-center justify-center text-xl font-bold text-black" style={{ background: 'var(--cd-cyan)' }}>
              You
            </div>
          </div>
        </div>
        <p className="text-sm" style={{ color: 'var(--cd-text-dim)' }}>
          Cards have been swapped with <span style={{ color: 'var(--cd-magenta)' }}>@{partnerName}</span>
        </p>
        <button
          onClick={onDone}
          className="px-6 py-2.5 rounded-xl text-xs font-bold cd-head tracking-wider text-white transition-all active:scale-95 cursor-pointer"
          style={{ background: 'linear-gradient(135deg, #ec4899, #be185d)', boxShadow: '0 0 20px rgba(236,72,153,0.4)' }}
        >
          Back to Matches
        </button>
      </div>
    </div>
  )
}

export default function Negotiation({ tradeId, userId, onBack, onComplete }) {
  const [offer, setOffer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [completed, setCompleted] = useState(false)
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
      // If trade is completed or no longer active, show celebration instead of error
      if (err.message?.includes('no longer active') || err.message?.includes('not found')) {
        setCompleted(true)
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }, [tradeId, userId])

  useEffect(() => { fetchOffer() }, [fetchOffer])

  // Poll every 10s for updates + refetch on tab focus
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchOffer()
    }, 10000)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchOffer()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
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
  const isMyTurn = isNegotiating && (!trade?.offer_by || trade?.offer_by === userId)
  const isTheirTurn = isNegotiating && trade?.offer_by && trade?.offer_by !== userId
  const canEdit = isMyTurn || isPendingFromThem
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
      setCompleted(true)
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

  if (completed) {
    return (
      <TradeCelebration
        partnerName={partnerName || offer?.trade?.player_b_name || offer?.trade?.player_a_name}
        partnerAvatar={isA ? offer?.trade?.player_b_avatar : offer?.trade?.player_a_avatar}
        partnerDiscordId={isA ? offer?.trade?.player_b_discord_id : offer?.trade?.player_a_discord_id}
        onDone={onComplete}
      />
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
        <div className="flex items-center gap-2">
          <button
            onClick={fetchOffer}
            disabled={actionLoading}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold cd-head tracking-wider transition-all cursor-pointer active:scale-95 ${
              actionLoading ? 'opacity-50' : 'hover:bg-[var(--cd-cyan)]/10'
            }`}
            style={{ color: 'var(--cd-cyan)', border: '1px solid rgba(0,229,255,0.2)' }}
          >
            <RefreshCw className={`w-3 h-3 ${actionLoading ? 'animate-spin' : ''}`} />
            Update Status
          </button>
          <span className={`text-[10px] font-bold cd-head tracking-wider px-2 py-0.5 rounded-full ${
            (isPendingFromMe || isTheirTurn) ? 'bg-amber-500/15 text-amber-400'
            : isPendingFromThem ? 'bg-emerald-500/15 text-emerald-400'
            : 'bg-[var(--cd-cyan)]/15 text-[var(--cd-cyan)]'
          }`}>
            {isPendingFromMe ? 'WAITING...' : isTheirTurn ? 'THEIR TURN' : isPendingFromThem ? 'THEIR OFFER' : 'YOUR TURN'}
          </span>
        </div>
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
            <img src={emberIcon} alt="" className="h-3.5 w-auto object-contain" />
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
            <img src={emberIcon} alt="" className="h-3.5 w-auto object-contain" />
            <span className="text-xs font-semibold" style={{ color: 'var(--cd-text)' }}>{theirCore} Cores</span>
          </div>
        </div>
      </div>

      {/* Activity log */}
      <div className="mb-6 px-3 py-2.5 rounded-xl text-xs space-y-1.5" style={{ background: 'var(--cd-surface)', border: '1px solid var(--cd-border)' }}>
        <p className="font-bold cd-head tracking-wider text-[10px] uppercase mb-2" style={{ color: 'var(--cd-text-dim)' }}>Activity</p>
        <p style={{ color: 'var(--cd-text-dim)' }}>
          Match created {new Date(trade.created_at).toLocaleDateString()}
        </p>
        {trade.offer_version > 0 && (
          <p style={{ color: 'var(--cd-text-dim)' }}>
            {trade.offer_version} offer{trade.offer_version > 1 ? 's' : ''} exchanged
          </p>
        )}
        {isPendingFromMe && (
          <p className="font-semibold" style={{ color: '#f59e0b' }}>
            You sent an offer — waiting for @{partnerName}
          </p>
        )}
        {isTheirTurn && (
          <p className="font-semibold" style={{ color: '#f59e0b' }}>
            @{partnerName} is working on a counter-offer...
          </p>
        )}
        {isPendingFromThem && (
          <p className="font-semibold" style={{ color: '#22c55e' }}>
            @{partnerName} sent you an offer — review it!
          </p>
        )}
        {isMyTurn && trade.offer_version === 0 && (
          <p style={{ color: 'var(--cd-text-dim)' }}>
            No offers sent yet — make the first move!
          </p>
        )}
        {isMyTurn && trade.offer_version > 0 && (
          <p style={{ color: 'var(--cd-text-dim)' }}>
            Offer returned — make your changes and send
          </p>
        )}
      </div>

      <div className="flex items-center justify-center gap-3">
        {(isPendingFromMe || isTheirTurn) && (
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

        {isMyTurn && (
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
          partnerId={partnerId}
          existingCardIds={allCardIds}
          onAdd={handleAddCard}
          onClose={() => setPickerSide(null)}
        />
      )}
    </div>
  )
}

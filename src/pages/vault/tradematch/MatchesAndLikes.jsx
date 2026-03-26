import { useState, useCallback } from 'react'
import { Heart, Clock, MessageCircle, ChevronDown, ChevronUp, Check, X } from 'lucide-react'
import GameCard from '../components/GameCard'
import TradingCard from '../../../components/TradingCard'
import TradingCardHolo from '../../../components/TradingCardHolo'
import { getHoloEffect } from '../../../data/vault/economy'
import { GODS } from '../../../data/vault/gods'
import { ITEMS } from '../../../data/vault/items'
import { CONSUMABLES } from '../../../data/vault/buffs'
import { useVault } from '../VaultContext'
import VaultCard from '../components/VaultCard'
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

function timeRemaining(createdAt) {
  const ms = 24 * 60 * 60 * 1000 - (Date.now() - new Date(createdAt).getTime())
  if (ms <= 0) return 'Expired'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h === 0) return `${m}m left`
  return `${h}h ${m}m left`
}

function Avatar({ discord_id, avatar, username, size = 40 }) {
  const hasSrc = discord_id && avatar
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      {hasSrc ? (
        <img
          src={`https://cdn.discordapp.com/avatars/${discord_id}/${avatar}.webp?size=64`}
          alt={username}
          className="rounded-full object-cover w-full h-full"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
            const fb = e.currentTarget.parentElement.querySelector('.avatar-fallback')
            if (fb) fb.style.display = 'flex'
          }}
        />
      ) : null}
      <div
        className="avatar-fallback rounded-full items-center justify-center absolute inset-0 font-bold text-white cd-head"
        style={{
          display: hasSrc ? 'none' : 'flex',
          background: (['#6366f1', '#ec4899', '#06b6d4', '#f59e0b', '#22c55e'])[(username?.charCodeAt(0) || 0) % 5],
          fontSize: size * 0.4,
        }}
      >
        {username?.[0]?.toUpperCase() || '?'}
      </div>
    </div>
  )
}

function CardThumb({ card, showHolo = true }) {
  const { getDefOverride, getBlueprint } = useVault()
  const cd = card.card_data || {}
  const type = card.card_type || cd.cardType || 'god'
  const isCollection = !!card.blueprint_id || !!cd._blueprintData
  const isPlayer = type === 'player' || cd.teamName
  const holoType = card.holo_type || card.holoType || null
  const holoEffect = showHolo && holoType ? getHoloEffect(card.rarity) : null
  const size = 70

  let inner
  if (isCollection) {
    inner = (
      <VaultCard
        card={{ ...card, cardType: card.card_type, blueprintId: card.blueprint_id, _blueprintData: cd._blueprintData }}
        getBlueprint={getBlueprint}
        size={size}
        holo={false}
      />
    )
  } else if (isPlayer) {
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
        size={size}
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
        size={size}
      />
    )
    inner = holoEffect ? (
      <TradingCardHolo rarity={holoEffect} holoType={holoType || 'reverse'} size={size}>
        {gameCardEl}
      </TradingCardHolo>
    ) : gameCardEl
  }

  return (
    <div>
      {inner}
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

function MatchItem({ match, onOpenTrade, onCloseMatch, userId }) {
  const remaining = timeRemaining(match.created_at)
  const expiringSoon = remaining !== 'Expired' && !remaining.includes('h')
  const isPendingFromMe = match.offer_status === 'pending' && match.offer_by === userId
  const isPendingFromThem = match.offer_status === 'pending' && match.offer_by !== userId
  const [closing, setClosing] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)

  const borderColor = isPendingFromThem ? 'rgba(236,72,153,0.5)' : 'rgba(236,72,153,0.2)'
  const bgGlow = isPendingFromThem ? 'rgba(236,72,153,0.08)' : 'rgba(236,72,153,0.03)'

  const handleClose = async (e) => {
    e.stopPropagation()
    if (!confirmClose) {
      setConfirmClose(true)
      return
    }
    setClosing(true)
    try {
      await onCloseMatch(match.id)
    } catch {
      setClosing(false)
      setConfirmClose(false)
    }
  }

  const handleCancelClose = (e) => {
    e.stopPropagation()
    setConfirmClose(false)
  }

  return (
    <div
      className="w-full text-left flex items-center gap-3 rounded-xl px-4 py-3 transition-all cursor-pointer"
      style={{ background: bgGlow, border: `1px solid ${borderColor}` }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--cd-magenta)'; e.currentTarget.style.background = 'rgba(236,72,153,0.1)' }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = borderColor; e.currentTarget.style.background = bgGlow }}
      onClick={() => onOpenTrade(match.id)}
    >
      <div className="relative">
        <Avatar discord_id={match.partner_discord_id} avatar={match.partner_avatar} username={match.partner_name} size={48} />
        <Heart className="absolute -bottom-1 -right-1 w-4 h-4 text-[var(--cd-magenta)] fill-[var(--cd-magenta)]" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate" style={{ color: 'var(--cd-text)' }}>
          @{match.partner_name}
        </p>
        <div className="flex items-center gap-1 mt-0.5">
          <Clock className="w-3 h-3 flex-shrink-0" style={{ color: expiringSoon ? '#f59e0b' : 'var(--cd-text-dim)' }} />
          <span className="text-xs" style={{ color: expiringSoon ? '#f59e0b' : 'var(--cd-text-dim)' }}>
            {remaining}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {isPendingFromThem ? (
          <span className="px-3 py-1 rounded-lg text-xs font-bold cd-head tracking-wider text-white"
            style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
            REVIEW
          </span>
        ) : isPendingFromMe ? (
          <span className="px-3 py-1 rounded-lg text-xs font-bold cd-head tracking-wider text-amber-400 border border-amber-500/30">
            SENT
          </span>
        ) : (
          <span className="px-3 py-1 rounded-lg text-xs font-bold cd-head tracking-wider text-white"
            style={{ background: 'linear-gradient(135deg, #ec4899, #be185d)' }}>
            OPEN
          </span>
        )}

        {confirmClose ? (
          <div className="flex items-center gap-1">
            <button
              onClick={handleClose}
              disabled={closing}
              className="px-2 py-1 rounded-lg text-[10px] font-bold cd-head tracking-wider text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-all cursor-pointer active:scale-95"
            >
              {closing ? '...' : 'CONFIRM'}
            </button>
            <button
              onClick={handleCancelClose}
              className="p-1 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-all cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
            title="Close match"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

function LikeGroup({ like, onLikesTrade }) {
  const [expanded, setExpanded] = useState(false)
  const [theirCards, setTheirCards] = useState(null)
  const [loadingPile, setLoadingPile] = useState(false)
  const [selectedCard, setSelectedCard] = useState(null)

  const loadTheirPile = useCallback(async () => {
    if (theirCards) { setExpanded(e => !e); return }
    setLoadingPile(true)
    setExpanded(true)
    try {
      const data = await tradematchService.tradePileView(like.user_id)
      setTheirCards(data.cards || [])
    } catch {
      setTheirCards([])
    }
    setLoadingPile(false)
  }, [like.user_id, theirCards])

  return (
    <div
      className="rounded-xl px-4 py-3 flex flex-col gap-3"
      style={{
        background: 'rgba(236,72,153,0.06)',
        border: '1px solid rgba(236,72,153,0.2)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar discord_id={like.discord_id} avatar={like.avatar} username={like.username} size={40} />
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate" style={{ color: 'var(--cd-text)' }}>
              @{like.username}
            </p>
            <p className="text-xs" style={{ color: 'var(--cd-text-dim)' }}>
              liked {like.cards.length} {like.cards.length === 1 ? 'card' : 'cards'}
            </p>
          </div>
        </div>

        <button
          onClick={() => onLikesTrade(like.user_id, like.cards[0]?.card_id)}
          className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold cd-head tracking-wider text-white transition-all active:scale-95 cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, #ec4899, #be185d)',
            boxShadow: '0 0 12px rgba(236,72,153,0.3)',
          }}
        >
          Start Trade
        </button>
      </div>

      {/* Your cards they liked */}
      {like.cards.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold cd-head mb-1.5" style={{ color: 'var(--cd-text-dim)' }}>
            Your cards they liked
          </p>
          <div className="flex gap-2 flex-wrap">
            {like.cards.map((card) => (
              <CardThumb key={card.card_id} card={card} showHolo={false} />
            ))}
          </div>
        </div>
      )}

      {/* View their trade pile */}
      <button
        onClick={loadTheirPile}
        className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold cd-head tracking-wider cursor-pointer transition-all"
        style={{
          color: 'var(--cd-cyan)',
          background: 'rgba(0,229,255,0.06)',
          border: '1px solid rgba(0,229,255,0.15)',
        }}
      >
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {expanded ? 'Hide their cards' : 'View their trade pile'}
      </button>

      {/* Their trade pile — expanded */}
      {expanded && (
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold cd-head mb-1.5" style={{ color: 'var(--cd-text-dim)' }}>
            Their trade pile {selectedCard && '— tap a card you want'}
          </p>
          {loadingPile ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--cd-cyan)', borderTopColor: 'transparent' }} />
            </div>
          ) : !theirCards?.length ? (
            <p className="text-xs text-center py-4" style={{ color: 'var(--cd-text-dim)' }}>No cards in their trade pile</p>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {theirCards.map((card) => {
                const isSelected = selectedCard === card.card_id
                return (
                  <div
                    key={card.card_id}
                    className={`relative isolate cursor-pointer rounded-lg ${isSelected ? '' : 'opacity-70 hover:opacity-100'}`}
                    onClick={() => setSelectedCard(isSelected ? null : card.card_id)}
                  >
                    <CardThumb card={card} showHolo={false} />
                    {isSelected && (
                      <div className="absolute inset-0 z-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,229,255,0.15)', border: '2px solid rgba(0,229,255,0.6)' }}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'var(--cd-cyan)' }}>
                          <Check className="w-3.5 h-3.5 text-black" strokeWidth={3} />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function MatchesAndLikes({ matches, likes, onOpenTrade, onCloseMatch, onLikesTrade, loading, userId }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--cd-cyan)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 pb-8">
      {/* Active Matches — dominant section */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <Heart className="w-5 h-5" style={{ color: 'var(--cd-magenta)', fill: 'var(--cd-magenta)' }} />
          <h2 className="cd-head text-lg font-bold tracking-wider uppercase" style={{ color: 'var(--cd-magenta)' }}>
            Your Matches
          </h2>
          {matches?.length > 0 && (
            <span
              className="px-2.5 py-0.5 rounded-full text-xs font-bold cd-head text-white"
              style={{ background: 'var(--cd-magenta)' }}
            >
              {matches.length}
            </span>
          )}
        </div>

        {!matches?.length ? (
          <div className="text-center py-10 rounded-xl" style={{ background: 'rgba(236,72,153,0.04)', border: '1px dashed rgba(236,72,153,0.2)' }}>
            <Heart className="w-8 h-8 mx-auto mb-2 opacity-20" style={{ color: 'var(--cd-magenta)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--cd-text-dim)' }}>No matches yet</p>
            <p className="text-xs mt-1" style={{ color: 'var(--cd-text-dim)' }}>Keep swiping to find your next trade partner!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {matches.map((match) => (
              <MatchItem key={match.id} match={match} onOpenTrade={onOpenTrade} onCloseMatch={onCloseMatch} userId={userId} />
            ))}
          </div>
        )}
      </section>

      {/* Likes — secondary section */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="cd-head text-sm font-bold tracking-wider uppercase" style={{ color: 'var(--cd-text-dim)' }}>
            Interested in your cards
          </h2>
        </div>

        {!likes?.length ? (
          <p className="text-sm py-8 text-center" style={{ color: 'var(--cd-text-dim)' }}>
            No likes yet — keep swiping!
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {likes.map((like) => (
              <LikeGroup key={like.user_id} like={like} onLikesTrade={onLikesTrade} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

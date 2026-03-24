import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Lock, Heart, X as XIcon, Sparkles, Filter } from 'lucide-react'
import GameCard from '../components/GameCard'
import TradingCard from '../../../components/TradingCard'
import TradingCardHolo from '../../../components/TradingCardHolo'
import { getHoloEffect } from '../../../data/vault/economy'
import { GODS } from '../../../data/vault/gods'
import { ITEMS } from '../../../data/vault/items'
import { CONSUMABLES } from '../../../data/vault/buffs'
import { getLeagueLogo } from '../../../utils/leagueImages'
import { useVault } from '../VaultContext'
import VaultCard from '../components/VaultCard'

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

const RARITY_COLORS = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
  mythic: '#ef4444',
  unique: '#ec4899',
}

const HOLO_LABELS = { holo: 'Holo', reverse: 'Reverse Holo', full: 'Full Art' }
const RARITY_FILTER_OPTIONS = ['rare', 'epic', 'legendary', 'mythic', 'unique']
const HOLO_FILTER_OPTIONS = [
  { value: 'holo', label: 'Holo' },
  { value: 'reverse', label: 'Reverse' },
  { value: 'full', label: 'Full Art' },
]

const SWIPE_THRESHOLD = 0.3 // fraction of screen width
const VELOCITY_THRESHOLD = 0.6 // px/ms — fast flick bypasses distance threshold
const THROW_DISTANCE = 1.5 // multiplier of screen width for exit
const STACK_SIZE = 3 // cards visible in stack
const LOAD_MORE_BUFFER = 3 // trigger onLoadMore when this many cards remain

function avatarUrl(card) {
  if (card.owner_avatar && card.owner_discord_id) {
    return `https://cdn.discordapp.com/avatars/${card.owner_discord_id}/${card.owner_avatar}.webp?size=64`
  }
  return null
}

export default function Swiper({ feedCards, onSwipeRight, onSwipeLeft, onMatch, onLoadMore, onCardSeen, locked, loading, empty, onGoToPile }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [swiping, setSwiping] = useState(false) // true during async swipe processing
  const [filterRarity, setFilterRarity] = useState('all')
  const [filterHolo, setFilterHolo] = useState('all')

  const filteredCards = useMemo(() => {
    if (!feedCards?.length) return feedCards
    if (filterRarity === 'all' && filterHolo === 'all') return feedCards
    return feedCards.filter(c => {
      if (filterRarity !== 'all' && c.rarity !== filterRarity) return false
      if (filterHolo !== 'all') {
        if (filterHolo === 'none' && c.holo_type) return false
        if (filterHolo !== 'none' && c.holo_type !== filterHolo) return false
      }
      return true
    })
  }, [feedCards, filterRarity, filterHolo])

  // Reset index when filters change
  useEffect(() => { setCurrentIndex(0) }, [filterRarity, filterHolo])

  // Refs for 60fps drag — no re-renders during gesture
  const cardRef = useRef(null)
  const likeRef = useRef(null)
  const nopeRef = useRef(null)
  const startPos = useRef({ x: 0, y: 0 })
  const currentPos = useRef({ x: 0, y: 0 })
  const isDragging = useRef(false)
  const velocity = useRef({ x: 0, y: 0 })
  const lastMoveTime = useRef(0)
  const lastMovePos = useRef({ x: 0, y: 0 })
  const animating = useRef(false)

  const card = filteredCards?.[currentIndex] || null

  // Trigger load more when nearing end
  const remaining = filteredCards ? filteredCards.length - currentIndex : 0
  useEffect(() => {
    if (remaining <= LOAD_MORE_BUFFER && remaining > 0 && onLoadMore) {
      onLoadMore()
    }
  }, [remaining, onLoadMore])

  const applyTransform = useCallback((dx, dy) => {
    const el = cardRef.current
    if (!el) return
    const rotate = dx * 0.06 // degrees per pixel
    const clampedRotate = Math.max(-30, Math.min(30, rotate))
    const dist = Math.abs(dx)
    const shadowSpread = Math.min(dist * 0.08, 30)
    el.style.transform = `translate(${dx}px, ${dy}px) rotate(${clampedRotate}deg)`
    el.style.boxShadow = `0 ${4 + shadowSpread * 0.3}px ${20 + shadowSpread}px rgba(0,0,0,${0.3 + dist * 0.001})`
    el.style.transition = 'none'

    // LIKE / NOPE indicator opacity
    const screenW = window.innerWidth
    const progress = Math.min(Math.abs(dx) / (screenW * SWIPE_THRESHOLD), 1)
    if (likeRef.current) {
      likeRef.current.style.opacity = dx > 0 ? progress : 0
    }
    if (nopeRef.current) {
      nopeRef.current.style.opacity = dx < 0 ? progress : 0
    }
  }, [])

  const resetCard = useCallback(() => {
    const el = cardRef.current
    if (!el) return
    el.style.transition = 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.5s ease'
    el.style.transform = 'translate(0px, 0px) rotate(0deg)'
    el.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)'
    if (likeRef.current) {
      likeRef.current.style.transition = 'opacity 0.3s ease'
      likeRef.current.style.opacity = 0
    }
    if (nopeRef.current) {
      nopeRef.current.style.transition = 'opacity 0.3s ease'
      nopeRef.current.style.opacity = 0
    }
  }, [])

  const throwCard = useCallback((direction) => {
    // direction: 1 = right, -1 = left
    const el = cardRef.current
    if (!el) return
    const screenW = window.innerWidth
    const exitX = direction * screenW * THROW_DISTANCE
    const exitY = -50
    const rotate = direction * 30
    el.style.transition = 'transform 0.45s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.45s ease'
    el.style.transform = `translate(${exitX}px, ${exitY}px) rotate(${rotate}deg)`
    el.style.opacity = '0'

    // Flash the correct indicator
    if (direction > 0 && likeRef.current) {
      likeRef.current.style.transition = 'none'
      likeRef.current.style.opacity = 1
    } else if (direction < 0 && nopeRef.current) {
      nopeRef.current.style.transition = 'none'
      nopeRef.current.style.opacity = 1
    }
  }, [])

  const advanceCard = useCallback(() => {
    setCurrentIndex(i => i + 1)
    // Reset opacity for next card
    requestAnimationFrame(() => {
      const el = cardRef.current
      if (el) {
        el.style.transition = 'none'
        el.style.transform = 'translate(0px, 0px) rotate(0deg)'
        el.style.opacity = '1'
        el.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)'
      }
      if (likeRef.current) likeRef.current.style.opacity = 0
      if (nopeRef.current) nopeRef.current.style.opacity = 0
    })
  }, [])

  const executeSwipe = useCallback(async (direction) => {
    if (animating.current || swiping || !card) return
    animating.current = true
    setSwiping(true)
    throwCard(direction)

    const cardId = card.card_id
    if (onCardSeen) onCardSeen(cardId)

    // Wait for throw animation, then advance immediately
    await new Promise(r => setTimeout(r, 450))
    advanceCard()
    animating.current = false
    setSwiping(false)

    // Fire API call in background — don't block the UI
    if (direction > 0) {
      onSwipeRight(cardId).then(result => {
        if (result?.matched) onMatch(result)
      }).catch(() => {})
    } else {
      onSwipeLeft(cardId).catch(() => {})
    }
  }, [card, swiping, throwCard, advanceCard, onSwipeRight, onSwipeLeft, onMatch, onCardSeen])

  const handlePointerDown = useCallback((e) => {
    if (animating.current || swiping) return
    isDragging.current = true
    const pt = { x: e.clientX, y: e.clientY }
    startPos.current = pt
    currentPos.current = { x: 0, y: 0 }
    lastMovePos.current = pt
    lastMoveTime.current = Date.now()
    velocity.current = { x: 0, y: 0 }

    if (cardRef.current) {
      cardRef.current.setPointerCapture(e.pointerId)
    }
  }, [swiping])

  const handlePointerMove = useCallback((e) => {
    if (!isDragging.current) return
    const now = Date.now()
    const dt = now - lastMoveTime.current
    const dx = e.clientX - startPos.current.x
    const dy = e.clientY - startPos.current.y

    if (dt > 0) {
      velocity.current = {
        x: (e.clientX - lastMovePos.current.x) / dt,
        y: (e.clientY - lastMovePos.current.y) / dt,
      }
    }

    lastMovePos.current = { x: e.clientX, y: e.clientY }
    lastMoveTime.current = now
    currentPos.current = { x: dx, y: dy }

    applyTransform(dx, dy)
  }, [applyTransform])

  const handlePointerUp = useCallback((e) => {
    if (!isDragging.current) return
    isDragging.current = false

    if (cardRef.current) {
      cardRef.current.releasePointerCapture(e.pointerId)
    }

    const dx = currentPos.current.x
    const screenW = window.innerWidth
    const fraction = Math.abs(dx) / screenW
    const vx = velocity.current.x // px/ms

    // Decide: swipe or snap back
    if (fraction > SWIPE_THRESHOLD || Math.abs(vx) > VELOCITY_THRESHOLD) {
      const direction = dx > 0 ? 1 : (dx < 0 ? -1 : (vx > 0 ? 1 : -1))
      executeSwipe(direction)
    } else {
      resetCard()
    }
  }, [executeSwipe, resetCard])

  // Button swipes for non-touch users
  const handleButtonSwipe = useCallback((direction) => {
    executeSwipe(direction)
  }, [executeSwipe])

  // ── Locked state (trade pile too small) ──
  if (locked) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ background: 'var(--cd-surface)', border: '2px solid var(--cd-border)' }}
        >
          <Heart className="w-9 h-9" style={{ color: 'var(--cd-text-dim)' }} />
        </div>
        <h3
          className="text-xl font-bold cd-head tracking-wider mb-2"
          style={{ color: 'var(--cd-text)' }}
        >
          Not Enough Cards
        </h3>
        <p className="text-sm max-w-xs mb-4" style={{ color: 'var(--cd-text-mid)' }}>
          You need at least 10 cards in your trade pile before you can start swiping. Add more cards to get going!
        </p>
        {onGoToPile && (
          <button
            onClick={onGoToPile}
            className="px-4 py-2 rounded-lg text-xs font-bold cd-head tracking-wider text-white transition-all active:scale-95 cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #ec4899, #be185d)', boxShadow: '0 0 12px rgba(236,72,153,0.3)' }}
          >
            Go to Trade Pile
          </button>
        )}
      </div>
    )
  }

  // ── Loading state ──
  if (loading || (!empty && !feedCards?.length)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6">
        <div className="w-10 h-10 rounded-full border-2 animate-spin mb-4" style={{ borderColor: 'var(--cd-cyan)', borderTopColor: 'transparent' }} />
        <p className="text-sm" style={{ color: 'var(--cd-text-mid)' }}>Finding cards...</p>
      </div>
    )
  }

  // ── Empty state (truly no cards available) ──
  if (!feedCards?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ background: 'var(--cd-surface)', border: '2px solid var(--cd-border)' }}
        >
          <Heart className="w-9 h-9" style={{ color: 'var(--cd-text-dim)' }} />
        </div>
        <h3
          className="text-xl font-bold cd-head tracking-wider mb-2"
          style={{ color: 'var(--cd-text)' }}
        >
          No More Cards
        </h3>
        <p className="text-sm max-w-xs" style={{ color: 'var(--cd-text-mid)' }}>
          Check back later for new cards in the feed, or expand your trade pile.
        </p>
      </div>
    )
  }

  const hasActiveFilters = filterRarity !== 'all' || filterHolo !== 'all'

  // ── Filter empty state ──
  if (hasActiveFilters && !filteredCards?.length) {
    return (
      <div className="flex flex-col items-center gap-6">
        <SwipeFilters
          filterRarity={filterRarity} setFilterRarity={setFilterRarity}
          filterHolo={filterHolo} setFilterHolo={setFilterHolo}
        />
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <Filter className="w-8 h-8 mb-3 opacity-20" style={{ color: 'var(--cd-text-dim)' }} />
          <p className="text-sm font-bold cd-head mb-1" style={{ color: 'var(--cd-text-mid)' }}>No cards match filters</p>
          <p className="text-xs" style={{ color: 'var(--cd-text-dim)' }}>Try adjusting your rarity or holo filters.</p>
        </div>
      </div>
    )
  }

  // ── All cards swiped ──
  if (currentIndex >= filteredCards.length) {
    return (
      <div className="flex flex-col items-center gap-6">
        {hasActiveFilters && (
          <SwipeFilters
            filterRarity={filterRarity} setFilterRarity={setFilterRarity}
            filterHolo={filterHolo} setFilterHolo={setFilterHolo}
          />
        )}
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
            style={{ background: 'var(--cd-surface)', border: '2px solid var(--cd-border)' }}
          >
            <Heart className="w-9 h-9" style={{ color: 'var(--cd-text-dim)' }} />
          </div>
          <h3 className="text-xl font-bold cd-head tracking-wider mb-2" style={{ color: 'var(--cd-text)' }}>
            All Caught Up
          </h3>
          <p className="text-sm max-w-xs" style={{ color: 'var(--cd-text-mid)' }}>
            You've seen all available cards. Check back later for new ones!
          </p>
        </div>
      </div>
    )
  }

  // ── Card stack ──
  const visibleCards = []
  for (let i = 0; i < STACK_SIZE && (currentIndex + i) < filteredCards.length; i++) {
    visibleCards.push(filteredCards[currentIndex + i])
  }

  return (
    <div className="flex flex-col items-center gap-6 py-4 select-none overflow-hidden">
      <style>{`.swipe-card-content, .swipe-card-content * { user-select: none !important; -webkit-user-select: none !important; } .swipe-card-content img { -webkit-user-drag: none !important; user-drag: none !important; pointer-events: none !important; }`}</style>

      {/* Filters */}
      <SwipeFilters
        filterRarity={filterRarity} setFilterRarity={setFilterRarity}
        filterHolo={filterHolo} setFilterHolo={setFilterHolo}
      />

      {/* Stack container — sized by the card component */}
      <div
        className="relative"
        style={{ width: 'min(85vw, 340px)' }}
      >
        {visibleCards.map((c, i) => {
          const isTop = i === 0
          const stackOffset = i * 6
          const stackScale = 1 - i * 0.04

          return (
            <div
              key={c.card_id}
              ref={isTop ? cardRef : undefined}
              className={`${isTop ? 'relative' : 'absolute inset-0'} rounded-2xl`}
              style={{
                zIndex: STACK_SIZE - i,
                transform: isTop ? 'translate(0px, 0px) rotate(0deg)' : `translateY(${stackOffset}px) scale(${stackScale})`,
                transformOrigin: 'center bottom',
                boxShadow: isTop ? '0 4px 20px rgba(0,0,0,0.3)' : '0 2px 10px rgba(0,0,0,0.2)',
                touchAction: 'none',
                willChange: isTop ? 'transform' : undefined,
                pointerEvents: isTop ? 'auto' : 'none',
                transition: isTop ? undefined : 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              }}
              onPointerDown={isTop ? handlePointerDown : undefined}
              onPointerMove={isTop ? handlePointerMove : undefined}
              onPointerUp={isTop ? handlePointerUp : undefined}
            >
              <SwipeCard card={c} containerWidth={Math.min(window.innerWidth * 0.85, 340)} />

              {/* LIKE / NOPE indicators — only on top card */}
              {isTop && (
                <>
                  <div
                    ref={likeRef}
                    className="absolute top-8 left-6 px-4 py-2 rounded-lg font-black text-3xl cd-head tracking-widest"
                    style={{
                      opacity: 0,
                      color: '#22c55e',
                      border: '3px solid #22c55e',
                      background: 'rgba(34, 197, 94, 0.12)',
                      transform: 'rotate(-15deg)',
                      pointerEvents: 'none',
                    }}
                  >
                    LIKE
                  </div>
                  <div
                    ref={nopeRef}
                    className="absolute top-8 right-6 px-4 py-2 rounded-lg font-black text-3xl cd-head tracking-widest"
                    style={{
                      opacity: 0,
                      color: '#ef4444',
                      border: '3px solid #ef4444',
                      background: 'rgba(239, 68, 68, 0.12)',
                      transform: 'rotate(15deg)',
                      pointerEvents: 'none',
                    }}
                  >
                    NOPE
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-8">
        <button
          onClick={() => handleButtonSwipe(-1)}
          disabled={swiping}
          className="w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer disabled:opacity-40"
          style={{
            background: 'var(--cd-surface)',
            border: '2px solid rgba(239, 68, 68, 0.3)',
            boxShadow: '0 0 15px rgba(239, 68, 68, 0.08)',
          }}
          aria-label="Pass"
        >
          <XIcon className="w-6 h-6" style={{ color: '#ef4444' }} />
        </button>
        <button
          onClick={() => handleButtonSwipe(1)}
          disabled={swiping}
          className="w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer disabled:opacity-40"
          style={{
            background: 'var(--cd-surface)',
            border: '2px solid rgba(34, 197, 94, 0.3)',
            boxShadow: '0 0 15px rgba(34, 197, 94, 0.08)',
          }}
          aria-label="Like"
        >
          <Heart className="w-6 h-6" style={{ color: '#22c55e' }} />
        </button>
      </div>
    </div>
  )
}

function SwipeFilters({ filterRarity, setFilterRarity, filterHolo, setFilterHolo }) {
  return (
    <div className="flex items-center gap-2 flex-wrap justify-center w-full px-2">
      <select
        value={filterRarity}
        onChange={e => setFilterRarity(e.target.value)}
        className="px-3 py-1.5 rounded-lg text-xs font-bold cd-head bg-[var(--cd-surface)] border border-[var(--cd-border)] text-[var(--cd-text)] cursor-pointer"
      >
        <option value="all">All Rarities</option>
        {RARITY_FILTER_OPTIONS.map(r => (
          <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>
        ))}
      </select>

      <select
        value={filterHolo}
        onChange={e => setFilterHolo(e.target.value)}
        className="px-3 py-1.5 rounded-lg text-xs font-bold cd-head bg-[var(--cd-surface)] border border-[var(--cd-border)] text-[var(--cd-text)] cursor-pointer"
      >
        <option value="all">All Holos</option>
        {HOLO_FILTER_OPTIONS.map(h => (
          <option key={h.value} value={h.value}>{h.label}</option>
        ))}
        <option value="none">Non-Holo Only</option>
      </select>
    </div>
  )
}

// Build game card data from a snake_case feed card + def override
function feedCardToGameData(card, cd, override) {
  const type = card.card_type || cd.cardType || 'god'
  const base = {
    name: card.god_name,
    imageUrl: override?.custom_image_url || card.image_url,
    id: card.god_id,
    serialNumber: card.serial_number,
    metadata: override || undefined,
    signatureUrl: cd.signatureUrl,
  }
  if (type === 'god') return { ...base, role: cd.role, ability: cd.ability, class: cd.class, imageKey: cd.imageKey }
  if (type === 'item') return { ...base, category: cd.category || cd.class, manaCost: cd.manaCost || 3, effects: cd.effects || {}, passive: cd.passive, imageKey: cd.imageKey }
  if (type === 'consumable') return { ...base, color: cd.color || '#10b981', description: cd.description || '', manaCost: cd.manaCost || 1 }
  return base
}

// Resolve def override for a snake_case feed card
function getFeedCardOverride(getDefOverride, card, cd) {
  const type = card.card_type || cd.cardType || 'god'
  if (type === 'player') return null
  // getDefOverride expects camelCase card shape — adapt
  return getDefOverride({ cardType: type, godId: card.god_id })
}

// ── Individual card visual ──
function SwipeCard({ card, containerWidth }) {
  const { getDefOverride, getTemplate } = useVault()
  const avatar = avatarUrl(card)
  const cd = card.card_data || {}
  const type = card.card_type || cd.cardType || 'god'
  const isCollection = type === 'collection'
  const isPlayer = type === 'player'
  const holoType = card.holo_type || null
  const holoEffect = holoType ? getHoloEffect(card.rarity) : null
  const holoLabel = holoType ? HOLO_LABELS[holoType] : null
  const leagueLogo = cd.leagueSlug ? getLeagueLogo(cd.leagueSlug, cd.leagueImageUrl) : null
  const teamLogo = cd.teamLogoUrl || null
  const cardSize = containerWidth || 300

  let cardEl
  if (isCollection) {
    const holoType = card.holo_type || null
    const holoEffect = holoType ? getHoloEffect(card.rarity) : null
    cardEl = (
      <VaultCard
        card={{ ...card, cardType: 'collection', templateId: card.template_id, _templateData: cd._templateData }}
        getTemplate={getTemplate}
        size={cardSize}
        holo={!!holoEffect}
      />
    )
  } else if (isPlayer) {
    cardEl = (
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
        size={cardSize}
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
        size={cardSize}
      />
    )
    cardEl = holoEffect ? (
      <TradingCardHolo rarity={holoEffect} holoType={holoType || 'reverse'} size={cardSize}>
        {gameCardEl}
      </TradingCardHolo>
    ) : gameCardEl
  }

  return (
    <div className="relative isolate swipe-card-content">
      {/* The actual card */}
      {cardEl}

      {/* Info overlay — pinned to bottom */}
      <div className="absolute inset-x-0 bottom-0 z-20 rounded-b-lg overflow-hidden">
        <div className="bg-black/50 backdrop-blur-md px-3 py-2.5 flex items-center gap-2">
          {/* Owner */}
          {avatar ? (
            <img src={avatar} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0 border border-white/20" />
          ) : (
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 bg-white/10 text-white/50 border border-white/20">
              {card.owner_name?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <span className="text-xs text-white/90 truncate font-medium min-w-0">
            {card.owner_name || 'Unknown'}
          </span>

          {/* Right side badges */}
          <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
            {/* League icon */}
            {leagueLogo && <img src={leagueLogo} alt="" className="w-5 h-5 rounded-sm object-contain" />}
            {/* Team icon */}
            {teamLogo && <img src={teamLogo} alt="" className="w-5 h-5 rounded-sm object-contain" />}
            {/* Rarity badge */}
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold cd-head uppercase" style={{
              background: `${RARITY_COLORS[card.rarity] || '#9ca3af'}25`,
              color: RARITY_COLORS[card.rarity] || '#9ca3af',
            }}>
              {card.rarity}
            </span>
            {/* Holo badge */}
            {holoLabel && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold cd-head" style={{ background: '#ffd70025', color: '#ffd700' }}>
                <Sparkles className="w-3 h-3" />
                {holoLabel}
              </span>
            )}
            {/* New badge */}
            {card.is_novel && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold cd-head" style={{ background: 'rgba(0,229,255,0.25)', color: '#00e5ff' }}>
                NEW
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

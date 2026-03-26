import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import PackArt from './PackArt'
import GameCard from './GameCard'
import VaultCard from './VaultCard'
import TradingCard from '../../../components/TradingCard'
import TradingCardHolo from '../../../components/TradingCardHolo'
import { RARITIES, getHoloEffect } from '../../../data/vault/economy'
import { useVault } from '../VaultContext'
import cardBackImg from '../../../assets/card_backsite.png'
import './PackOpening.css'

function CardBack() {
  return (
    <div style={{ aspectRatio: '63 / 88', width: '100%', overflow: 'hidden' }}>
      <img src={cardBackImg} alt="" draggable={false}
        style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block' }} />
    </div>
  )
}

const RARITY_TIER = { common: 5, uncommon: 4, rare: 3, epic: 2, legendary: 1, mythic: 0, unique: -1 }

function getCardType(card) {
  return card.cardType || card.card_type || 'god'
}

function toGameCardData(card, override) {
  const type = getCardType(card)
  const cd = card.cardData || card.card_data || {}
  const base = {
    name: card.godName || card.god_name || card.name,
    class: card.godClass || card.god_class || card.class,
    imageUrl: override?.custom_image_url || card.imageUrl || card.image_url,
    id: card.godId || card.god_id || card.id,
    serialNumber: card.serialNumber || card.serial_number,
    metadata: override || undefined,
    signatureUrl: card.signatureUrl || card.signature_url || undefined,
  }
  if (type === 'god') {
    return { ...base, role: card.role, ability: card.ability || cd.ability, imageKey: cd.imageKey }
  }
  if (type === 'item') {
    return { ...base, category: cd.category || card.class, manaCost: cd.manaCost || 3, effects: cd.effects || {}, passive: cd.passive, imageKey: cd.imageKey }
  }
  if (type === 'consumable') {
    return { ...base, color: cd.color || '#10b981', description: cd.description || 'Consumable card', manaCost: cd.manaCost || 1 }
  }
  return base
}

function toPlayerCardProps(card) {
  const cd = card.cardData || card.card_data || {}
  return {
    playerName: card.godName || card.god_name || card.name,
    teamName: cd.teamName || '',
    teamColor: cd.teamColor || '#6366f1',
    seasonName: cd.seasonName || '',
    leagueName: cd.leagueName || '',
    divisionName: cd.divisionName || '',
    role: cd.role || card.role || 'ADC',
    avatarUrl: card.imageUrl || card.image_url || '',
    stats: cd.stats || null,
    bestGod: cd.bestGod || null,
    isFirstEdition: card.isFirstEdition || card.is_first_edition || false,
    isConnected: cd.isConnected,
    signatureUrl: card.signatureUrl || card.signature_url || undefined,
  }
}

/**
 * Reusable card renderer — both card types use container queries for native scaling.
 * Pass holo=false to skip the TradingCardHolo wrapper (e.g. inside flip animation).
 */
function PackCard({ card, size, holo = true, override }) {
  const { getTemplate } = useVault()
  const type = getCardType(card)
  const holoEffect = getHoloEffect(card.rarity)
  const holoType = card.holoType || card.holo_type || 'reverse'

  if (card.templateId) {
    return <VaultCard card={card} getTemplate={getTemplate} size={size} holo={holo} />
  }

  const isPlayer = type === 'player'
  if (isPlayer) {
    return (
      <TradingCard
        {...toPlayerCardProps(card)}
        rarity={card.rarity}
        size={size}
        holo={holo ? { rarity: holoEffect, holoType } : undefined}
      />
    )
  }

  const role = card.role || 'mid'
  const gameCard = <GameCard type={type} rarity={card.rarity} data={toGameCardData(card, override)} />
  if (holo) {
    return (
      <TradingCardHolo rarity={holoEffect} role={role} holoType={holoType} size={size}>
        {gameCard}
      </TradingCardHolo>
    )
  }
  return gameCard
}

function SummaryView({ cards, result, onOpenMore, onClose }) {
  const { getDefOverride } = useVault()
  const gridRef = useRef(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const [zoomedIdx, setZoomedIdx] = useState(null)
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 920

  // Lock scroll on parent when zoom is active + arrow key navigation
  useEffect(() => {
    if (zoomedIdx === null) return
    const el = document.querySelector('.pack-opening')
    if (!el) return
    el.style.overflowY = 'hidden'
    const prevent = (e) => e.preventDefault()
    el.addEventListener('wheel', prevent, { passive: false })
    el.addEventListener('touchmove', prevent, { passive: false })
    const handleKey = (e) => {
      if (e.key === 'ArrowLeft' && zoomedIdx > 0) { e.preventDefault(); setZoomedIdx(zoomedIdx - 1) }
      else if (e.key === 'ArrowRight' && zoomedIdx < cards.length - 1) { e.preventDefault(); setZoomedIdx(zoomedIdx + 1) }
      else if (e.key === 'Escape' || e.key === ' ') { e.preventDefault(); setZoomedIdx(null) }
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      el.style.overflowY = ''
      el.removeEventListener('wheel', prevent)
      el.removeEventListener('touchmove', prevent)
      window.removeEventListener('keydown', handleKey)
    }
  }, [zoomedIdx, cards.length])

  const cardSize = useMemo(() => {
    if (typeof window === 'undefined') return 200
    const w = window.innerWidth
    const h = window.innerHeight
    if (w <= 920) {
      // Mobile: use most of screen height, cap at 80% viewport width for spacing
      // Overhead: summary padding (80) + gaps (60) + title (25) + dots (20) + buttons (44) + grid padding (60) ≈ 290
      const availableHeight = h - 290
      const fromHeight = Math.floor(availableHeight * 63 / 88)
      const fromWidth = Math.floor(w * 0.8)
      return Math.min(fromHeight, fromWidth)
    }
    // Desktop: use available height, fit all cards in one row
    const availableHeight = h - 180
    const maxFromHeight = Math.floor(availableHeight * 63 / 88)
    const availableWidth = w - 80
    const perCard = Math.floor((availableWidth - (cards.length - 1) * 12) / cards.length)
    return Math.min(maxFromHeight, perCard)
  }, [cards.length])

  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const onScroll = () => {
      const children = el.children
      if (!children.length) return
      const center = el.scrollLeft + el.clientWidth / 2
      let closest = 0
      let minDist = Infinity
      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        const childCenter = child.offsetLeft - el.offsetLeft + child.offsetWidth / 2
        const dist = Math.abs(center - childCenter)
        if (dist < minDist) { minDist = dist; closest = i }
      }
      setActiveIdx(closest)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [cards.length])

  const scrollTo = useCallback((idx) => {
    const el = gridRef.current
    if (!el || !el.children[idx]) return
    el.children[idx].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [])

  return (
    <div className="pack-opening__summary">
      <h2 className="pack-opening__summary-title">{result.packName}</h2>
      <div className="pack-opening__summary-grid" ref={gridRef} style={{ '--card-size': `${cardSize}px` }}>
        {cards.map((card, i) => (
          <div
            key={i}
            className="pack-opening__summary-card"
            style={{ '--si': i, cursor: 'pointer' }}
            onClickCapture={(e) => { e.stopPropagation(); isMobile ? scrollTo(i) : setZoomedIdx(i) }}
          >
            <PackCard card={card} size={cardSize} holo override={getDefOverride(card)} />
            {card.isNew && <div className="pack-opening__summary-new">NEW</div>}
          </div>
        ))}
      </div>
      {/* Mobile dots */}
      <div className="pack-opening__summary-dots">
        {cards.map((_, i) => (
          <span
            key={i}
            className={`pack-opening__summary-dot${i === activeIdx ? ' active' : ''}`}
            onClick={() => scrollTo(i)}
          />
        ))}
      </div>
      {/* Desktop zoom overlay */}
      {zoomedIdx !== null && (
        <div className="pack-opening__zoom-overlay" onClick={() => setZoomedIdx(null)}>
          <div className="pack-opening__zoom-card" onClick={e => e.stopPropagation()}>
            <PackCard card={cards[zoomedIdx]} size={340} holo override={getDefOverride(cards[zoomedIdx])} />
            {cards[zoomedIdx].isNew && <div className="pack-opening__zoom-new">NEW</div>}
          </div>
          <div className="pack-opening__zoom-nav">
            <button
              className="pack-opening__zoom-arrow"
              disabled={zoomedIdx === 0}
              onClick={(e) => { e.stopPropagation(); setZoomedIdx(zoomedIdx - 1) }}
            >‹</button>
            <span className="pack-opening__zoom-counter">{zoomedIdx + 1} / {cards.length}</span>
            <button
              className="pack-opening__zoom-arrow"
              disabled={zoomedIdx === cards.length - 1}
              onClick={(e) => { e.stopPropagation(); setZoomedIdx(zoomedIdx + 1) }}
            >›</button>
          </div>
        </div>
      )}
      <div className="pack-opening__summary-actions">
        {onOpenMore && (
          <button onClick={onOpenMore} className="pack-opening__summary-btn pack-opening__summary-btn--primary">
            Open More
          </button>
        )}
        <button onClick={onClose} className="pack-opening__summary-btn pack-opening__summary-btn--secondary">
          Close
        </button>
      </div>
    </div>
  )
}

export default function PackOpening({ result, packType, onClose, onOpenMore, skipTear, skipToStack, onReplay }) {
  const { getDefOverride, packTypesMap } = useVault()
  const packColor = packType === 'promo-gift' ? '#d4af37' : packTypesMap?.[packType]?.color
  const [phase, setPhase] = useState(skipToStack ? 'stack' : skipTear ? 'ripping' : 'enter')
  const [tearProgress, setTearProgress] = useState(0)
  const [tearSide, setTearSide] = useState(null)
  const [sparks, setSparks] = useState([])
  const [revealedSet, setRevealedSet] = useState(new Set())
  const [cardFlipped, setCardFlipped] = useState(false)
  const [flipPhase, setFlipPhase] = useState(null) // null | 'anticipation' | 'flipping' | 'revealed'
  const [revealParticles, setRevealParticles] = useState([])
  const [anticipationSparks, setAnticipationSparks] = useState([])
  const [rarityBanner, setRarityBanner] = useState(null)
  const bannerKeyRef = useRef(0)

  const packRef = useRef(null)
  const tearRef = useRef({ active: false, side: null, maxProgress: 0 })
  const sparkIdRef = useRef(0)
  const flipLockRef = useRef(false)
  const particleIdRef = useRef(0)
  const antSparkTimerRef = useRef(null)

  const isMixed = (result.packType || '').includes('mixed') || result.cards.some(c => c._revealOrder != null || c.card_type)
  const cards = useMemo(() => {
    const sorted = [...result.cards]
    if (isMixed && sorted.some(c => c._revealOrder != null)) {
      // Mixed packs: use assigned reveal order
      sorted.sort((a, b) => (a._revealOrder ?? 99) - (b._revealOrder ?? 99))
    } else {
      // Rarity packs: common first, rarest last
      sorted.sort((a, b) => (RARITY_TIER[b.rarity] ?? 5) - (RARITY_TIER[a.rarity] ?? 5))
    }
    return sorted
  }, [result.cards, isMixed])

  const topIndex = useMemo(() => {
    for (let i = 0; i < cards.length; i++) {
      if (!revealedSet.has(i)) return i
    }
    return -1
  }, [cards, revealedSet])

  const allRevealed = topIndex === -1
  const rarestIndex = Math.max(cards.length - 2, 0)
  const rarestColor = RARITIES[cards[rarestIndex]?.rarity]?.color || '#fff'
  const rarestTier = RARITY_TIER[cards[rarestIndex]?.rarity] ?? 5

  // ─── Phase transitions ───
  useEffect(() => {
    let t
    switch (phase) {
      case 'enter': t = setTimeout(() => setPhase('ready'), 600); break
      case 'ripping': t = setTimeout(() => setPhase('emerging'), 3500); break
      case 'emerging': t = setTimeout(() => setPhase('stack'), 2500); break
      /* collecting phase removed — go straight to summary */
    }
    return () => clearTimeout(t)
  }, [phase, cards.length])

  useEffect(() => {
    if (phase === 'stack' && allRevealed) {
      const t = setTimeout(() => setPhase('summary'), 500)
      return () => clearTimeout(t)
    }
  }, [phase, allRevealed])

  // ─── Sparkle spawner ───
  const spawnSparks = useCallback((x, y) => {
    const count = 5 + Math.floor(Math.random() * 5)
    const batch = Array.from({ length: count }, () => ({
      id: sparkIdRef.current++,
      x, y,
      tx: (Math.random() - 0.5) * 90,
      ty: (Math.random() - 0.5) * 60 - 20,
      size: 1.5 + Math.random() * 3.5,
      dur: 0.2 + Math.random() * 0.4,
    }))
    setSparks(prev => [...prev.slice(-60), ...batch])
  }, [])

  // ─── Reveal particle burst ───
  const spawnRevealParticles = useCallback((tier, color) => {
    const count = tier <= 0 ? 40 : tier <= 1 ? 25 : tier <= 2 ? 15 : 8
    const spread = tier <= 0 ? 280 : tier <= 1 ? 220 : tier <= 2 ? 170 : 130
    const batch = Array.from({ length: count }, () => {
      const angle = Math.random() * Math.PI * 2
      const dist = (0.4 + Math.random() * 0.6) * spread
      return {
        id: particleIdRef.current++,
        tx: Math.cos(angle) * dist,
        ty: Math.sin(angle) * dist - spread * 0.15,
        size: 2 + Math.random() * (tier <= 1 ? 6 : 4),
        dur: 0.5 + Math.random() * 0.6,
        color: Math.random() > 0.3 ? color : '#fff',
      }
    })
    setRevealParticles(batch)
    setTimeout(() => setRevealParticles([]), 1500)
  }, [])

  // ─── Anticipation rising sparks — spawn intermittently during wait ───
  const startAnticipationSparks = useCallback((color, tier) => {
    const interval = tier <= 0 ? 80 : tier <= 1 ? 120 : tier <= 2 ? 180 : 250
    const id = setInterval(() => {
      const count = tier <= 0 ? 3 : tier <= 1 ? 2 : 1
      const batch = Array.from({ length: count }, () => ({
        id: particleIdRef.current++,
        x: (Math.random() - 0.5) * 200,
        y: -(120 + Math.random() * 180),
        size: 2 + Math.random() * 3,
        dur: 0.6 + Math.random() * 0.6,
        delay: Math.random() * 0.15,
      }))
      setAnticipationSparks(prev => [...prev.slice(-30), ...batch])
    }, interval)
    antSparkTimerRef.current = id
  }, [])

  const stopAnticipationSparks = useCallback(() => {
    if (antSparkTimerRef.current) {
      clearInterval(antSparkTimerRef.current)
      antSparkTimerRef.current = null
    }
    setTimeout(() => setAnticipationSparks([]), 1200)
  }, [])

  // Cleanup anticipation spark timer on unmount
  useEffect(() => () => {
    if (antSparkTimerRef.current) clearInterval(antSparkTimerRef.current)
  }, [])

  // ─── Auto sparks during ripping — scaled by rarest card ───
  useEffect(() => {
    if (phase !== 'ripping') return
    // mythic=0 → 8-12 sparks, legendary=1 → 6-9, epic=2 → 4-7, rare=3 → 3-5, uncommon/common → 2-3
    const sparkBase = rarestTier <= 0 ? 8 : rarestTier <= 1 ? 6 : rarestTier <= 2 ? 4 : rarestTier <= 3 ? 3 : 2
    const sparkRange = rarestTier <= 0 ? 5 : rarestTier <= 1 ? 4 : rarestTier <= 2 ? 4 : rarestTier <= 3 ? 3 : 2
    const sparkSize = rarestTier <= 1 ? 3 : rarestTier <= 2 ? 2.5 : 2
    const sparkSpread = rarestTier <= 1 ? 180 : rarestTier <= 2 ? 150 : 120
    const sparkInterval = rarestTier <= 1 ? 60 : rarestTier <= 2 ? 80 : 100
    const delay = setTimeout(() => {
      const interval = setInterval(() => {
        const count = sparkBase + Math.floor(Math.random() * sparkRange)
        const x = 15 + Math.random() * 70
        const batch = Array.from({ length: count }, () => ({
          id: sparkIdRef.current++,
          x,
          y: 9,
          tx: (Math.random() - 0.5) * sparkSpread,
          ty: -(Math.random() * 100 + 30),
          size: sparkSize + Math.random() * 4,
          dur: 0.5 + Math.random() * 0.7,
        }))
        setSparks(prev => [...prev.slice(-150), ...batch])
      }, sparkInterval)
      sparkIntervalRef.current = interval
    }, 1800)
    const sparkIntervalRef = { current: null }
    return () => { clearTimeout(delay); if (sparkIntervalRef.current) clearInterval(sparkIntervalRef.current) }
  }, [phase, rarestTier])

  // ─── Tear handlers ───
  const onTearDown = useCallback((e) => {
    if (phase !== 'ready' && phase !== 'tearing') return
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = packRef.current.getBoundingClientRect()
    tearRef.current.active = true
    tearRef.current.packLeft = rect.left
    tearRef.current.packWidth = rect.width
    if (tearRef.current.startRelX === undefined) {
      tearRef.current.startRelX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    }
    if (phase === 'ready') setPhase('tearing')
  }, [phase])

  const onTearMove = useCallback((e) => {
    if (!tearRef.current.active) return
    const { packLeft, packWidth } = tearRef.current
    const relX = Math.max(0, Math.min(1, (e.clientX - packLeft) / packWidth))
    if (!tearRef.current.side) {
      const delta = relX - tearRef.current.startRelX
      if (Math.abs(delta) < 0.03) return
      tearRef.current.side = delta > 0 ? 'left' : 'right'
      setTearSide(tearRef.current.side)
    }
    const side = tearRef.current.side
    const progress = side === 'left' ? relX : 1 - relX
    const distance = Math.abs(relX - tearRef.current.startRelX)
    if (progress > tearRef.current.maxProgress) {
      tearRef.current.maxProgress = progress
      setTearProgress(progress)
      spawnSparks(side === 'left' ? progress * 100 : (1 - progress) * 100, 9)
    }
    if (tearRef.current.maxProgress >= 0.95 && distance >= 0.25) {
      tearRef.current.active = false
      setTearProgress(1)
      setTimeout(() => setPhase('ripping'), 150)
    }
  }, [spawnSparks])

  const onTearUp = useCallback(() => { tearRef.current.active = false }, [])

  const isLastCard = topIndex >= 0 && topIndex === cards.length - 1

  // ─── Card click handler — flip-locked so animation always completes ───
  const onCardClick = useCallback(() => {
    if (phase !== 'stack' || topIndex < 0 || flipLockRef.current) return

    if (!cardFlipped) {
      flipLockRef.current = true
      const tier = RARITY_TIER[cards[topIndex]?.rarity] ?? 5
      const last = topIndex === cards.length - 1

      // Anticipation phase duration scales with rarity
      // Common: 0ms, Uncommon: 0ms, Rare: 100ms, Epic: 600ms, Legendary: 1000ms, Mythic: 1400ms
      // Last card adds extra: +400ms for rare+, +800ms for legendary+
      const baseAnticipation = tier <= 0 ? 1400 : tier <= 1 ? 1000 : tier <= 2 ? 600 : tier <= 3 ? 300 : 0
      const lastBonus = last ? (tier <= 1 ? 800 : tier <= 3 ? 400 : 100) : 0
      const anticipationMs = baseAnticipation + lastBonus

      // Flip duration: Common 250ms → Mythic 800ms, last card +200ms (epic+) / +100ms (rare-)
      const flipMs = tier <= 0 ? 800 : tier <= 1 ? 700 : tier <= 2 ? 600 : tier <= 3 ? 300 : 250
      const totalFlipMs = flipMs + (last ? (tier <= 2 ? 200 : 100) : 0)

      // Hold time after reveal: let effects breathe
      const holdMs = tier <= 0 ? 1200 : tier <= 1 ? 800 : tier <= 2 ? 500 : 200

      const cardColor = RARITIES[cards[topIndex]?.rarity]?.color || '#fff'

      const doReveal = () => {
        setFlipPhase('revealed')
        stopAnticipationSparks()
        if (tier <= 3) spawnRevealParticles(tier, cardColor)
        // Show rarity banner for rare+
        if (tier <= 2) {
          const rarityName = cards[topIndex]?.rarity?.toUpperCase() || ''
          bannerKeyRef.current++
          setRarityBanner({ name: rarityName, color: cardColor, tier, key: bannerKeyRef.current })
          setTimeout(() => setRarityBanner(null), tier <= 0 ? 2000 : tier <= 1 ? 1500 : 1000)
        }
        setTimeout(() => { flipLockRef.current = false }, holdMs)
      }

      if (anticipationMs > 0) {
        setFlipPhase('anticipation')
        if (tier <= 3) startAnticipationSparks(cardColor, tier)
        setTimeout(() => {
          stopAnticipationSparks()
          setCardFlipped(true)
          setFlipPhase('flipping')
          setTimeout(doReveal, totalFlipMs)
        }, anticipationMs)
      } else {
        setCardFlipped(true)
        setFlipPhase('flipping')
        setTimeout(doReveal, totalFlipMs)
      }
    } else {
      // Dismiss the revealed card
      flipLockRef.current = true
      setRevealedSet(prev => new Set([...prev, topIndex]))
      setCardFlipped(false)
      setFlipPhase(null)
      setRarityBanner(null)
      stopAnticipationSparks()
      setTimeout(() => { flipLockRef.current = false }, 350)
    }
  }, [phase, cardFlipped, topIndex, cards])

  // ─── Keyboard: Space / Arrow keys flip cards in stack phase ───
  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (phase === 'stack' && (e.key === ' ' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault()
        onCardClick()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [phase, onCardClick])

  // ─── Computed ───
  const tearLineLeft = tearSide === 'right' ? (1 - tearProgress) * 100 : 0
  const tearLineWidth = tearProgress * 100
  const showPack = ['enter', 'ready', 'tearing', 'ripping', 'emerging'].includes(phase)

  // Flip reveal effect state
  const topCard = topIndex >= 0 ? cards[topIndex] : null
  const topTier = topCard ? (RARITY_TIER[topCard.rarity] ?? 5) : 5
  const topColor = topCard ? (RARITIES[topCard.rarity]?.color || '#fff') : '#fff'

  const shakeClass = flipPhase === 'anticipation'
    ? topTier <= 0 ? 'shake-mythic' : topTier <= 1 ? 'shake-legendary' : topTier <= 2 ? 'shake-epic' : ''
    : ''

  let veilClass = '', veilDim = ''
  if (flipPhase === 'anticipation' || flipPhase === 'flipping') {
    veilDim = topTier <= 0 ? 'mythic' : topTier <= 1 ? 'legendary' : topTier <= 2 ? 'epic' : topTier <= 3 ? 'rare' : ''
  } else if (flipPhase === 'revealed' && localStorage.getItem('cc_reduce_flash') !== 'true') {
    veilClass = topTier <= 0 ? 'flash-mythic' : topTier <= 1 ? 'flash-legendary' : topTier <= 2 ? 'flash-epic' : topTier <= 3 ? 'flash' : ''
  }

  const fanOffsets = useMemo(() => {
    const n = cards.length
    const angleStep = 7
    const xStep = 18
    return cards.map((_, i) => ({
      x: ((n - 1) / 2 - i) * xStep,
      rot: ((n - 1) / 2 - i) * angleStep,
    }))
  }, [cards])

  const getFlipTime = (card, idx) => {
    const tier = RARITY_TIER[card?.rarity] ?? 5
    const last = idx === cards.length - 1
    const ms = (tier <= 0 ? 800 : tier <= 1 ? 700 : tier <= 2 ? 600 : tier <= 3 ? 300 : 250) + (last ? (tier <= 2 ? 200 : 100) : 0)
    return `${ms}ms`
  }

  const getAnticipationTime = (card, idx) => {
    const tier = RARITY_TIER[card?.rarity] ?? 5
    const last = idx === cards.length - 1
    const base = tier <= 0 ? 1400 : tier <= 1 ? 1000 : tier <= 2 ? 600 : tier <= 3 ? 300 : 0
    const bonus = last ? (tier <= 1 ? 800 : tier <= 3 ? 400 : 100) : 0
    return `${base + bonus}ms`
  }

  return createPortal(
    <div className="pack-opening" data-phase={phase}>
      <div className="pack-opening__bg" />

      {/* ═══ Pack Area ═══ */}
      {showPack && (
        <>
          <div className="pack-opening__pack-area">
            <div className="pack-opening__pack-inner" ref={packRef}>
              <PackArt tier={packType} name={result.packName} cardCount={cards.length} color={packColor} />
            </div>

            {(phase === 'ripping' || phase === 'emerging') && (
              <>
                <div className="pack-opening__torn-top">
                  <PackArt tier={packType} name={result.packName} cardCount={cards.length} color={packColor} />
                </div>
                <div className="pack-opening__rarity-glow" style={{ '--rc': rarestColor }} />
                <div className="pack-opening__shine" style={{ '--rc': rarestColor }} />
              </>
            )}

            {phase === 'ready' && (
              <>
                <div className="pack-opening__edge-dot pack-opening__edge-dot--left" />
                <div className="pack-opening__edge-dot pack-opening__edge-dot--right" />
              </>
            )}

            {tearProgress > 0 && phase !== 'ripping' && phase !== 'emerging' && (
              <div className="pack-opening__tear-line" data-side={tearSide}
                style={{ left: `${tearLineLeft}%`, width: `${tearLineWidth}%`, '--progress': tearProgress }} />
            )}

            {sparks.map(s => (
              <div key={s.id} className="pack-opening__spark" style={{
                left: `${s.x}%`, top: `${s.y}%`,
                '--tx': `${s.tx}px`, '--ty': `${s.ty}px`,
                '--size': `${s.size}px`, '--dur': `${s.dur}s`,
              }} />
            ))}
          </div>

          {(phase === 'ready' || phase === 'tearing') && (
            <div className="pack-opening__tear-zone"
              onPointerDown={onTearDown} onPointerMove={onTearMove}
              onPointerUp={onTearUp} onPointerCancel={onTearUp}
              onDragStart={e => e.preventDefault()} />
          )}
        </>
      )}

      {/* ═══ Screen veil — dim during anticipation, flash on reveal ═══ */}
      {phase === 'stack' && (flipPhase || veilClass) && (
        <div
          className={`pack-opening__flip-veil ${veilClass}`}
          data-dim={veilDim || undefined}
        />
      )}

      {/* ═══ Rarity name banner ═══ */}
      {rarityBanner && (
        <div
          key={rarityBanner.key}
          className={`pack-opening__rarity-banner${rarityBanner.tier <= 0 ? ' tier-0' : ''}`}
          style={{ '--banner-color': rarityBanner.color }}
        >
          {rarityBanner.name}
        </div>
      )}

      {/* ═══ Cards — emerge, fan, then flip-to-reveal in place ═══ */}
      {(phase === 'emerging' || phase === 'stack') && !allRevealed && (
        <div className={`pack-opening__emerging-cards ${shakeClass}`}>
          {cards.map((card, i) => {
            const isTop = i === topIndex
            const isFlipped = isTop && cardFlipped
            const isDismissed = revealedSet.has(i)
            const isLast = i === cards.length - 1
            const cardColor = RARITIES[card.rarity]?.color || '#fff'
            const tier = RARITY_TIER[card.rarity] ?? 5
            const topFlipPhase = isTop ? flipPhase : null
            return (
              <div key={i}
                className={`pack-opening__emerging-card${i === rarestIndex ? ' rarest' : ''}${isFlipped ? ' flipped' : ''}${isDismissed ? ' dismissed' : ''}${isLast ? ' last-card' : ''}${topFlipPhase === 'anticipation' ? ' anticipation' : ''}${topFlipPhase === 'revealed' ? ' revealed' : ''}`}
                data-rarity={card.rarity}
                data-tier={tier}
                style={{
                  '--ei': i, '--et': cards.length,
                  '--fx': `${fanOffsets[i].x}px`,
                  '--fr': `${fanOffsets[i].rot}deg`,
                  '--flip-time': getFlipTime(card, i),
                  '--anticipation-time': getAnticipationTime(card, i),
                  '--card-color': cardColor,
                  zIndex: isDismissed ? 0 : (cards.length - i),
                  ...(i === rarestIndex ? { '--rc': rarestColor } : {}),
                }}
                onClick={phase === 'stack' && isTop && !isDismissed ? onCardClick : undefined}
              >
                {/* Spinning rays behind card (legendary+) */}
                {isTop && topFlipPhase === 'revealed' && tier <= 1 && (
                  <div className={`pack-opening__reveal-rays active${tier === 0 ? ' mythic-rays' : ''}`} />
                )}
                <div className="pack-opening__ec-flip">
                  <div className="pack-opening__ec-back"><CardBack /></div>
                  <div className="pack-opening__ec-front">
                    <PackCard card={card} holo={false} override={getDefOverride(card)} />
                    {isTop && topFlipPhase === 'revealed' && (
                      <div className={`pack-opening__holo-shimmer${tier <= 1 ? ' holo-intense' : tier <= 2 ? ' holo-medium' : ''}`}
                        style={{ '--holo-color': cardColor }} />
                    )}
                    {isTop && topFlipPhase === 'revealed' && card.isNew && (
                      <div className="pack-opening__flip-new">NEW</div>
                    )}
                  </div>
                </div>
                {/* Expanding ring burst (epic+) */}
                {isTop && topFlipPhase === 'revealed' && tier <= 2 && (
                  <>
                    <div className={`pack-opening__reveal-ring${tier <= 1 ? ' ring-big' : ''} active`} />
                    {tier <= 0 && (
                      <div className="pack-opening__reveal-ring ring-big active" style={{ animationDelay: '0.15s' }} />
                    )}
                  </>
                )}
              </div>
            )
          })}

          {/* Anticipation rising sparks */}
          {anticipationSparks.map(s => (
            <div key={s.id} className="pack-opening__anticipation-spark" style={{
              '--as-x': `${s.x}px`, '--as-y': `${s.y}px`,
              '--as-size': `${s.size}px`, '--as-dur': `${s.dur}s`,
              '--as-delay': `${s.delay}s`,
            }} />
          ))}

          {/* Reveal particles */}
          {revealParticles.map(p => (
            <div key={p.id} className="pack-opening__reveal-particle" style={{
              '--p-tx': `${p.tx}px`, '--p-ty': `${p.ty}px`,
              '--p-size': `${p.size}px`, '--p-dur': `${p.dur}s`,
              '--p-color': p.color,
            }} />
          ))}

          {phase === 'stack' && (
            <>
              <div className="pack-opening__counter" style={{ position: 'absolute', bottom: '-50px' }}>
                {revealedSet.size} / {cards.length}
              </div>
              <p className="pack-opening__stack-hint" style={{ position: 'absolute', bottom: '-75px' }}>
                {flipPhase === 'anticipation' ? '...' : cardFlipped ? 'Tap for next' : isLastCard && isMixed ? 'Wildcard — tap to reveal!' : isLastCard ? 'Last card — tap to reveal!' : 'Tap to reveal'}
              </p>
            </>
          )}
        </div>
      )}

      {phase === 'ready' && <p className="pack-opening__hint">Swipe across to tear open</p>}

      {/* ═══ Summary — show all cards after reveal ═══ */}
      {phase === 'summary' && (
        <SummaryView cards={cards} result={result} onOpenMore={onOpenMore} onClose={onClose} />
      )}

      {onReplay && (
        <button onClick={onReplay} style={{
          position: 'fixed', top: 12, right: 12, zIndex: 999,
          padding: '6px 14px', fontSize: 11, fontWeight: 700, letterSpacing: 1,
          background: 'rgba(180,120,0,0.25)', border: '1px solid rgba(200,150,50,0.4)',
          borderRadius: 4, color: '#fbbf24', cursor: 'pointer',
        }}>
          REPLAY
        </button>
      )}
    </div>,
    document.body
  )
}

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import GameCard from './GameCard'
import TradingCard from '../../../components/TradingCard'
import TradingCardHolo from '../../../components/TradingCardHolo'
import { RARITIES, getHoloEffect } from '../../../data/vault/economy'
import cardBackImg from '../../../assets/card_backsite.png'
import './PackOpening.css'

const RARITY_TIER = { common: 5, uncommon: 4, rare: 3, epic: 2, legendary: 1, mythic: 0, unique: -1 }

function CardBack() {
  return (
    <div style={{ aspectRatio: '63 / 88', width: '100%', overflow: 'hidden' }}>
      <img src={cardBackImg} alt="" draggable={false}
        style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block' }} />
    </div>
  )
}

function getCardType(card) {
  return card.cardType || card.card_type || 'god'
}

function toGameCardData(card) {
  const type = getCardType(card)
  const cd = card.cardData || card.card_data || {}
  const base = {
    name: card.godName || card.god_name,
    class: card.godClass || card.god_class,
    imageUrl: card.imageUrl || card.image_url,
    id: card.godId || card.god_id,
    serialNumber: card.serialNumber || card.serial_number,
  }
  if (type === 'god') return { ...base, role: card.role, ability: card.ability || cd.ability, imageKey: cd.imageKey }
  if (type === 'item') return { ...base, category: cd.category || card.class, manaCost: cd.manaCost || 3, effects: cd.effects || {}, passive: cd.passive, imageKey: cd.imageKey }
  if (type === 'consumable') return { ...base, color: cd.color || '#10b981', description: cd.description || 'Consumable card', manaCost: cd.manaCost || 1 }
  return base
}

function toPlayerCardProps(card) {
  const cd = card.cardData || card.card_data || {}
  return {
    playerName: card.godName || card.god_name,
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
  }
}

function FlipCard({ card }) {
  const type = getCardType(card)
  if (type === 'player') {
    return <TradingCard {...toPlayerCardProps(card)} rarity={card.rarity} />
  }
  return <GameCard type={type} rarity={card.rarity} data={toGameCardData(card)} />
}

function SummaryCard({ card }) {
  const type = getCardType(card)
  const holoEffect = getHoloEffect(card.rarity)
  const holoType = card.holoType || card.holo_type || 'reverse'

  if (type === 'player') {
    return <TradingCard {...toPlayerCardProps(card)} rarity={card.rarity} holo={{ rarity: holoEffect, holoType }} />
  }
  const gameCard = <GameCard type={type} rarity={card.rarity} data={toGameCardData(card)} />
  return (
    <TradingCardHolo rarity={holoEffect} role={card.role || 'mid'} holoType={holoType}>
      {gameCard}
    </TradingCardHolo>
  )
}

export default function MiniPackFlip({ cards, onClose }) {
  const [revealedSet, setRevealedSet] = useState(new Set())
  const [cardFlipped, setCardFlipped] = useState(false)
  const [flipPhase, setFlipPhase] = useState(null)
  const [showSummary, setShowSummary] = useState(false)
  const flipLockRef = useRef(false)

  const topIndex = useMemo(() => {
    for (let i = 0; i < cards.length; i++) {
      if (!revealedSet.has(i)) return i
    }
    return -1
  }, [cards, revealedSet])

  const allRevealed = topIndex === -1

  useEffect(() => {
    if (allRevealed) {
      const t = setTimeout(() => setShowSummary(true), 400)
      return () => clearTimeout(t)
    }
  }, [allRevealed])

  const fanOffsets = useMemo(() => {
    const n = cards.length
    const angleStep = n === 1 ? 0 : 7
    const xStep = n === 1 ? 0 : 18
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

  const onCardClick = useCallback(() => {
    if (topIndex < 0 || flipLockRef.current) return

    if (!cardFlipped) {
      flipLockRef.current = true
      const tier = RARITY_TIER[cards[topIndex]?.rarity] ?? 5
      const last = topIndex === cards.length - 1

      const baseAnticipation = tier <= 0 ? 1400 : tier <= 1 ? 1000 : tier <= 2 ? 600 : tier <= 3 ? 300 : 0
      const lastBonus = last ? (tier <= 1 ? 800 : tier <= 3 ? 400 : 100) : 0
      const anticipationMs = baseAnticipation + lastBonus

      const flipMs = tier <= 0 ? 800 : tier <= 1 ? 700 : tier <= 2 ? 600 : tier <= 3 ? 300 : 250
      const totalFlipMs = flipMs + (last ? (tier <= 2 ? 200 : 100) : 0)
      const holdMs = tier <= 0 ? 1200 : tier <= 1 ? 800 : tier <= 2 ? 500 : 200

      const doReveal = () => {
        setFlipPhase('revealed')
        setTimeout(() => { flipLockRef.current = false }, holdMs)
      }

      if (anticipationMs > 0) {
        setFlipPhase('anticipation')
        setTimeout(() => {
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
      flipLockRef.current = true
      setRevealedSet(prev => new Set([...prev, topIndex]))
      setCardFlipped(false)
      setFlipPhase(null)
      setTimeout(() => { flipLockRef.current = false }, 350)
    }
  }, [cardFlipped, topIndex, cards])

  // Keyboard support
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        if (showSummary) { onClose(); return }
        onCardClick()
      }
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onCardClick, onClose, showSummary])

  const topCard = topIndex >= 0 ? cards[topIndex] : null
  const topTier = topCard ? (RARITY_TIER[topCard.rarity] ?? 5) : 5
  const isLastCard = topIndex >= 0 && topIndex === cards.length - 1

  const shakeClass = flipPhase === 'anticipation'
    ? topTier <= 0 ? 'shake-mythic' : topTier <= 1 ? 'shake-legendary' : topTier <= 2 ? 'shake-epic' : ''
    : ''

  let veilDim = ''
  if (flipPhase === 'anticipation' || flipPhase === 'flipping') {
    veilDim = topTier <= 0 ? 'mythic' : topTier <= 1 ? 'legendary' : topTier <= 2 ? 'epic' : topTier <= 3 ? 'rare' : ''
  }

  return createPortal(
    <div className="pack-opening" data-phase="stack">
      <div className="pack-opening__bg" onClick={showSummary ? onClose : undefined} />

      {(flipPhase || false) && (
        <div className={`pack-opening__flip-veil`} data-dim={veilDim || undefined} />
      )}

      {!showSummary && !allRevealed && (
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
                className={`pack-opening__emerging-card${isFlipped ? ' flipped' : ''}${isDismissed ? ' dismissed' : ''}${isLast ? ' last-card' : ''}${topFlipPhase === 'anticipation' ? ' anticipation' : ''}${topFlipPhase === 'revealed' ? ' revealed' : ''}`}
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
                  opacity: 1,
                  animation: 'none',
                }}
                onClick={isTop && !isDismissed ? onCardClick : undefined}
              >
                <div className="pack-opening__ec-flip">
                  <div className="pack-opening__ec-back"><CardBack /></div>
                  <div className="pack-opening__ec-front">
                    <FlipCard card={card} />
                  </div>
                </div>
              </div>
            )
          })}

          <div className="pack-opening__counter" style={{ position: 'absolute', bottom: '-50px' }}>
            {revealedSet.size} / {cards.length}
          </div>
          <p className="pack-opening__stack-hint" style={{ position: 'absolute', bottom: '-75px' }}>
            {flipPhase === 'anticipation' ? '...' : cardFlipped ? 'Tap for next' : isLastCard ? 'Last card — tap to reveal!' : 'Tap to reveal'}
          </p>
        </div>
      )}

      {showSummary && (
        <div className="pack-opening__summary" onClick={onClose}>
          <div className="pack-opening__summary-grid" onClick={e => e.stopPropagation()}>
            {cards.map((card, i) => (
              <div key={i} className="pack-opening__summary-card">
                <SummaryCard card={card} />
              </div>
            ))}
          </div>
          <button onClick={onClose} className="pack-opening__close-btn">Done</button>
        </div>
      )}
    </div>,
    document.body
  )
}

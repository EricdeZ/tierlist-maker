import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import PackArt from './PackArt'
import GameCard from './GameCard'
import { RARITIES } from '../../../data/cardclash/economy'
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

const RARITY_TIER = { common: 5, uncommon: 4, rare: 3, epic: 2, legendary: 1, mythic: 0 }

function toGameCardData(card) {
  return {
    name: card.godName || card.name,
    class: card.godClass || card.class,
    imageUrl: card.imageUrl,
    ability: card.ability,
    id: card.godId || card.id,
    serialNumber: card.serialNumber,
  }
}

export default function PackOpening({ result, packType, onClose, skipTear, skipToStack, onReplay }) {
  const [phase, setPhase] = useState(skipToStack ? 'stack' : skipTear ? 'ripping' : 'enter')
  const [tearProgress, setTearProgress] = useState(0)
  const [tearSide, setTearSide] = useState(null)
  const [sparks, setSparks] = useState([])
  const [revealedSet, setRevealedSet] = useState(new Set())
  const [cardFlipped, setCardFlipped] = useState(false)

  const packRef = useRef(null)
  const tearRef = useRef({ active: false, side: null, maxProgress: 0 })
  const sparkIdRef = useRef(0)

  const cards = useMemo(() =>
    [...result.cards].sort((a, b) => (RARITY_TIER[b.rarity] ?? 5) - (RARITY_TIER[a.rarity] ?? 5)),
    [result.cards]
  )

  const topIndex = useMemo(() => {
    for (let i = 0; i < cards.length; i++) {
      if (!revealedSet.has(i)) return i
    }
    return -1
  }, [cards, revealedSet])

  const allRevealed = topIndex === -1
  const currentCard = topIndex >= 0 ? cards[topIndex] : null
  const currentTier = currentCard ? (RARITY_TIER[currentCard.rarity] ?? 5) : 5
  const rarestIndex = Math.max(cards.length - 2, 0)
  const rarestColor = RARITIES[cards[rarestIndex]?.rarity]?.color || '#fff'
  const rarestTier = RARITY_TIER[cards[rarestIndex]?.rarity] ?? 5

  // ─── Phase transitions ───
  useEffect(() => {
    let t
    switch (phase) {
      case 'enter': t = setTimeout(() => setPhase('ready'), 900); break
      case 'ripping': t = setTimeout(() => setPhase('emerging'), 5500); break
      case 'emerging': t = setTimeout(() => setPhase('stack'), 3500); break
      case 'collecting': t = setTimeout(() => setPhase('done'), 600 + cards.length * 120); break
    }
    return () => clearTimeout(t)
  }, [phase, cards.length])

  useEffect(() => {
    if (phase === 'stack' && allRevealed) {
      const t = setTimeout(() => setPhase('collecting'), 500)
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
    }, 3000)
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

  // ─── Card click handler ───
  const onCardClick = useCallback(() => {
    if (phase !== 'stack' || topIndex < 0) return
    if (!cardFlipped) {
      setCardFlipped(true)
    } else {
      setRevealedSet(prev => new Set([...prev, topIndex]))
      setCardFlipped(false)
    }
  }, [phase, cardFlipped, topIndex])

  // ─── Computed ───
  const tearLineLeft = tearSide === 'right' ? (1 - tearProgress) * 100 : 0
  const tearLineWidth = tearProgress * 100
  const showPack = ['enter', 'ready', 'tearing', 'ripping', 'emerging'].includes(phase)

  const fanOffsets = useMemo(() => {
    const n = cards.length
    const angleStep = 7
    const xStep = 18
    return cards.map((_, i) => ({
      x: ((n - 1) / 2 - i) * xStep,
      rot: ((n - 1) / 2 - i) * angleStep,
    }))
  }, [cards])

  const flipTime = currentTier <= 1 ? '1s' : currentTier <= 2 ? '0.8s' : currentTier <= 3 ? '0.6s' : '0.4s'

  return (
    <div className="pack-opening" data-phase={phase}>
      <div className="pack-opening__bg" />

      {/* ═══ Pack Area ═══ */}
      {showPack && (
        <>
          <div className="pack-opening__pack-area">
            <div className="pack-opening__pack-inner" ref={packRef}>
              <PackArt tier={packType} name={result.packName} cardCount={cards.length} />
            </div>

            {(phase === 'ripping' || phase === 'emerging') && (
              <>
                <div className="pack-opening__torn-top">
                  <PackArt tier={packType} name={result.packName} cardCount={cards.length} />
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

      {/* ═══ Cards — emerge, fan, then flip-to-reveal in place ═══ */}
      {(phase === 'emerging' || phase === 'stack') && !allRevealed && (
        <div className="pack-opening__emerging-cards">
          {cards.map((card, i) => {
            const isTop = i === topIndex
            const isFlipped = isTop && cardFlipped
            const isDismissed = revealedSet.has(i)
            return (
              <div key={i}
                className={`pack-opening__emerging-card${i === rarestIndex ? ' rarest' : ''}${isFlipped ? ' flipped' : ''}${isDismissed ? ' dismissed' : ''}`}
                style={{
                  '--ei': i, '--et': cards.length,
                  '--fx': `${fanOffsets[i].x}px`,
                  '--fr': `${fanOffsets[i].rot}deg`,
                  '--flip-time': flipTime,
                  zIndex: isDismissed ? 0 : (cards.length - i),
                  ...(i === rarestIndex ? { '--rc': rarestColor } : {}),
                }}
                onClick={phase === 'stack' && isTop && !isDismissed ? onCardClick : undefined}
              >
                <div className="pack-opening__ec-flip">
                  <div className="pack-opening__ec-back"><CardBack /></div>
                  <div className="pack-opening__ec-front">
                    <GameCard type="god" rarity={card.rarity} data={toGameCardData(card)} />
                  </div>
                </div>

              </div>
            )
          })}

          {phase === 'stack' && (
            <>
              <div className="pack-opening__counter" style={{ position: 'absolute', bottom: '-50px' }}>
                {revealedSet.size} / {cards.length}
              </div>
              <p className="pack-opening__stack-hint" style={{ position: 'absolute', bottom: '-75px' }}>
                {cardFlipped ? 'Tap for next' : 'Tap to reveal'}
              </p>
            </>
          )}
        </div>
      )}

      {/* ═══ Collecting — cards fly to binder ═══ */}
      {phase === 'collecting' && (
        <div className="pack-opening__collect-area">
          <div className="pack-opening__binder-target">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="56" height="56">
              <path d="M4 19.5v-15A2.5 2.5 0 016.5 2H20v20H6.5a2.5 2.5 0 010-5H20" />
            </svg>
          </div>
          {cards.map((_, i) => (
            <div key={i} className="pack-opening__fly-card" style={{ '--fi': i, '--ft': cards.length }}>
              <CardBack />
            </div>
          ))}
        </div>
      )}

      {phase === 'ready' && <p className="pack-opening__hint">Swipe across to tear open</p>}

      {phase === 'done' && (
        <div className="pack-opening__done-area">
          <div className="pack-opening__done-binder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
              <path d="M4 19.5v-15A2.5 2.5 0 016.5 2H20v20H6.5a2.5 2.5 0 010-5H20" />
            </svg>
          </div>
          <p className="pack-opening__done-summary">{cards.length} cards collected</p>
          <button onClick={onClose} className="pack-opening__close-btn">DONE</button>
        </div>
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
    </div>
  )
}

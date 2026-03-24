import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import PackArt from '../vault/components/PackArt'
import GameCard from '../vault/components/GameCard'
import { RARITIES } from '../../data/vault/economy'
import './VaultPromoSection.css'

const GOD_CDN = 'https://cdn.smitesource.com/cdn-cgi/image/width=256,format=auto,quality=75/Gods'

const SCRIPTED_CARDS = [
  { name: 'Ymir',     class: 'Guardian', role: 'support', rarity: 'common',    imageKey: 'Ymir',     id: 76,
    ability: { name: 'Glacial Strike', type: 'zone', description: 'Channel 2 turns in your zone. Then explode: 18 damage to all enemies in your zone. They are frozen (skip 1 turn). Objective zoning', manaCost: 6, cooldown: 5 } },
  { name: 'Bellona',  class: 'Warrior',  role: 'solo',    rarity: 'uncommon',  imageKey: 'Bellona',  id: 16,
    ability: { name: 'Rally Point', type: 'zone', description: 'Plant flag in current zone: allies here gain +3 DEF and clear waves 50% faster for 3 turns. Zone persists if you leave', manaCost: 4, cooldown: 4 } },
  { name: 'Athena',   class: 'Guardian', role: 'support', rarity: 'rare',      imageKey: 'Athena',   id: 12,
    ability: { name: 'Defender of Olympus', type: 'global', description: 'Teleport to any allied god on the map. Grant them +5 DEF for 2 turns and taunt all enemies in that zone', manaCost: 5, cooldown: 4 } },
  { name: 'Poseidon', class: 'Mage',     role: 'mid',     rarity: 'epic',      imageKey: 'Poseidon', id: 58,
    ability: { name: 'Release the Kraken', type: 'zone', description: 'Summon Kraken in your zone. Deal 12 damage to all enemies there and knock them into adjacent zones. Zone is impassable for 1 turn', manaCost: 6, cooldown: 4 } },
  { name: 'Zeus',     class: 'Mage',     role: 'mid',     rarity: 'legendary', imageKey: 'Zeus',     id: 77,
    ability: { name: 'Lightning Storm', type: 'zone', description: 'Place storm over any zone for 2 turns. Enemies inside take 5 damage per turn and cannot use abilities. Zone denial tool', manaCost: 5, cooldown: 3 } },
  { name: 'Ares',     class: 'Guardian', role: 'support', rarity: 'mythic',    imageKey: 'Ares',     id: 9,
    ability: { name: 'No Escape', type: 'cc', description: 'Pull all enemy gods within 2 zones toward your location. They are forced into your zone and skip their next action. Ultimate engage', manaCost: 5, cooldown: 4 } },
].map(c => ({
  ...c,
  imageUrl: `${GOD_CDN}/${c.imageKey}/Default/t_GodCard_${c.imageKey}.png`,
  serialNumber: `SC-${String(c.id).padStart(4, '0')}`,
}))


/* ─── Shape Grid Canvas Background ─── */

function ShapeGrid() {
  const canvasRef = useRef(null)
  const visibleRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let frame
    let time = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    const obs = new IntersectionObserver(
      ([e]) => { visibleRef.current = e.isIntersecting },
      { threshold: 0 },
    )
    obs.observe(canvas)

    const GRID = 52
    const SIZE = 6

    const draw = () => {
      frame = requestAnimationFrame(draw)
      if (!visibleRef.current) return
      time += 0.1
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      ctx.clearRect(0, 0, w, h)

      for (let gx = GRID / 2; gx < w + GRID; gx += GRID) {
        for (let gy = GRID / 2; gy < h + GRID; gy += GRID) {
          const col = Math.floor(gx / GRID)
          const row = Math.floor(gy / GRID)
          const idx = col * 7 + row * 13
          const rot = time * 0.012 + idx * 0.4
          const pulse = 0.7 + 0.3 * Math.sin(time * 0.006 + idx * 0.5)

          ctx.save()
          ctx.translate(gx, gy)
          ctx.rotate(rot)
          ctx.globalAlpha = 0.035 + 0.02 * Math.sin(time * 0.008 + idx * 0.3)
          ctx.strokeStyle = '#00e5ff'
          ctx.lineWidth = 0.8

          const s = SIZE * pulse
          const shape = idx % 4
          ctx.beginPath()
          if (shape === 0) {
            ctx.moveTo(0, -s); ctx.lineTo(s, 0); ctx.lineTo(0, s); ctx.lineTo(-s, 0); ctx.closePath()
          } else if (shape === 1) {
            ctx.moveTo(-s, 0); ctx.lineTo(s, 0); ctx.moveTo(0, -s); ctx.lineTo(0, s)
          } else if (shape === 2) {
            ctx.arc(0, 0, s * 0.6, 0, Math.PI * 2)
          } else {
            ctx.moveTo(0, -s); ctx.lineTo(s * 0.87, s * 0.5); ctx.lineTo(-s * 0.87, s * 0.5); ctx.closePath()
          }
          ctx.stroke()
          ctx.restore()
        }
      }
    }

    frame = requestAnimationFrame(draw)
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      obs.disconnect()
    }
  }, [])

  return <canvas ref={canvasRef} className="vp-grid" />
}


/* ─── Vault Promo Section ─── */

export default function VaultPromoSection() {
  // idle → shake → burst → fan → done
  const [phase, setPhase] = useState('idle')
  const [visibleCards, setVisibleCards] = useState(0)
  const timersRef = useRef([])

  const clear = () => { timersRef.current.forEach(clearTimeout); timersRef.current = [] }
  const later = (fn, ms) => { timersRef.current.push(setTimeout(fn, ms)) }

  // Preload god images on mount
  useEffect(() => {
    SCRIPTED_CARDS.forEach(c => { const img = new Image(); img.src = c.imageUrl })
    return clear
  }, [])

  const openPack = useCallback(() => {
    if (phase !== 'idle') return
    clear()
    setVisibleCards(0)
    setPhase('shake')

    later(() => {
      setPhase('burst')
      later(() => {
        setPhase('fan')
        SCRIPTED_CARDS.forEach((_, i) => {
          later(() => setVisibleCards(i + 1), i * 180)
        })
        later(() => setPhase('done'), SCRIPTED_CARDS.length * 180 + 400)
      }, 400)
    }, 400)
  }, [phase])

  const replay = useCallback(() => {
    if (phase !== 'done') return
    clear()
    setPhase('idle')
    setVisibleCards(0)
  }, [phase])

  const fanGeo = useMemo(() => {
    const n = SCRIPTED_CARDS.length
    return SCRIPTED_CARDS.map((_, i) => ({
      x: ((n - 1) / 2 - i) * 42,
      rot: ((n - 1) / 2 - i) * 6,
    }))
  }, [])

  const showPack = phase === 'idle' || phase === 'shake' || phase === 'burst'
  const showFan = phase === 'fan' || phase === 'done'

  return (
    <section className="vp-section">
      {/* Full-bleed dark vault background */}
      <div className="vp-bg" />
      <ShapeGrid />

      {/* Ambient center glow */}
      <div className="vp-ambient" />

      <div className="vp-content">
        {/* Header */}
        <div className="vp-header">
          <div className="vp-title">
            <span className="vp-title__the">THE</span>
            <span className="vp-title__vault">VAULT</span>
          </div>
          <p className="vp-subtitle">
            Open packs. Collect cards. Trade with the community.
          </p>
        </div>

        {/* Pack / Cards showcase */}
        <div className="vp-showcase">
          {showPack && (
            <div
              className={`vp-pack ${phase === 'shake' ? 'vp-pack--shake' : ''} ${phase === 'burst' ? 'vp-pack--burst' : ''}`}
              onClick={openPack}
            >
              <PackArt
                tier="osl-mixed"
                name="OSL Pack"
                subtitle="Olympus Series"
                cardCount={6}
              />
              {phase === 'idle' && (
                <div className="vp-pack__hint">Click to open</div>
              )}
            </div>
          )}

          {(phase === 'shake' || phase === 'burst') && (
            <div className={`vp-flash ${phase === 'burst' ? 'vp-flash--burst' : ''}`} />
          )}

          {showFan && (
            <div className="vp-fan">
              {SCRIPTED_CARDS.map((card, i) => {
                const visible = i < visibleCards || phase === 'done'
                const rarityColor = RARITIES[card.rarity]?.color || '#fff'
                const rMod = card.rarity === 'mythic' ? 'vp-card--mythic'
                  : card.rarity === 'legendary' ? 'vp-card--legendary'
                  : card.rarity === 'epic' ? 'vp-card--epic' : ''
                return (
                  <div
                    key={card.id}
                    className={`vp-card ${visible ? 'vp-card--in' : ''} ${rMod}`}
                    style={{
                      '--fx': `${fanGeo[i].x}px`,
                      '--fr': `${fanGeo[i].rot}deg`,
                      '--rc': rarityColor,
                      zIndex: i + 1,
                    }}
                  >
                    <GameCard type="god" rarity={card.rarity} data={card} size="130px" />
                    {visible && (
                      <span className="vp-card__tag" style={{ color: rarityColor }}>
                        {RARITIES[card.rarity]?.name}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {phase === 'done' && (
            <button className="vp-replay" onClick={replay}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
              Replay
            </button>
          )}
        </div>

        {/* CTA */}
        <div className="vp-cta-row">
          <Link to="/vault" className="vp-cta">
            Enter The Vault
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Edge accents */}
      <div className="vp-edge vp-edge--top" />
      <div className="vp-edge vp-edge--bottom" />
    </section>
  )
}

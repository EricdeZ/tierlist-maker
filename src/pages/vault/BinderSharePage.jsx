import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { vaultService } from '../../services/database'
import GameCard from './components/GameCard'
import TradingCard from '../../components/TradingCard'
import { ChevronLeft, ChevronRight, BookMarked } from 'lucide-react'
import Navbar from '../../components/layout/Navbar'
import PageTitle from '../../components/PageTitle'
import './binder.css'
import './compdeck.css'

const PAGES = 10
const SLOTS_PER_PAGE = 9

function lighten(hex, pct) {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(
    Math.min(255, r + Math.round((255 - r) * pct / 100)),
    Math.min(255, g + Math.round((255 - g) * pct / 100)),
    Math.min(255, b + Math.round((255 - b) * pct / 100))
  )
}

function darken(hex, pct) {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(
    Math.max(0, Math.round(r * (1 - pct / 100))),
    Math.max(0, Math.round(g * (1 - pct / 100))),
    Math.max(0, Math.round(b * (1 - pct / 100)))
  )
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

function getBinderBg(color) {
  return `linear-gradient(145deg, ${lighten(color, 20)}, ${color}, ${darken(color, 20)})`
}

function toGameCardData(card) {
  const type = card.cardType || 'god'
  const cd = card.cardData || {}
  const base = {
    name: card.godName, class: card.godClass, imageUrl: card.imageUrl,
    id: card.godId, serialNumber: card.serialNumber, metadata: card.metadata || undefined,
  }
  if (type === 'god') return { ...base, ability: card.ability || cd.ability, imageKey: cd?.imageKey }
  if (type === 'item') return { ...base, category: cd.category || card.godClass, manaCost: cd.manaCost || 3, effects: cd.effects || {}, passive: cd.passive, imageKey: cd?.imageKey }
  if (type === 'consumable') return { ...base, color: cd.color || '#10b981', description: cd.description || '', manaCost: cd.manaCost || 1 }
  return base
}

function toPlayerCardProps(card) {
  const cd = card.cardData || {}
  return {
    playerName: card.godName, teamName: cd.teamName || '', teamColor: cd.teamColor || '#6366f1',
    role: cd.role || card.role || 'ADC', avatarUrl: card.imageUrl || '',
    leagueName: cd.leagueName || '', divisionName: cd.divisionName || '',
    seasonName: cd.seasonName || '',
    bestGod: cd.bestGod
      ? { ...cd.bestGod, ...(card.bestGodName ? { name: card.bestGodName } : {}) }
      : (card.bestGodName ? { name: card.bestGodName } : null),
    isFirstEdition: card.isFirstEdition || false,
    isConnected: cd.isConnected,
  }
}

function ShareCardRender({ card }) {
  const isPlayer = (card.cardType || 'god') === 'player'
  if (isPlayer) {
    return <TradingCard {...toPlayerCardProps(card)} rarity={card.rarity} />
  }
  return <GameCard type={card.cardType || 'god'} rarity={card.rarity} data={toGameCardData(card)} />
}

export default function BinderSharePage() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [spread, setSpread] = useState(0)
  const [showCover, setShowCover] = useState(true)
  const [flipping, setFlipping] = useState(null)

  useEffect(() => {
    vaultService.getBinderView(token)
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message || 'Failed to load binder'); setLoading(false) })
  }, [token])

  const cardsBySlot = useMemo(() => {
    if (!data) return {}
    const map = {}
    for (const entry of data.cards) {
      map[`${entry.page}-${entry.slot}`] = entry.card
    }
    return map
  }, [data])

  const leftPage = spread * 2 + 1
  const rightPage = spread * 2 + 2
  const color = data?.binder?.color || '#8b5e3c'

  const flipForward = () => {
    if (spread >= 4 || flipping) return
    setFlipping('forward')
    setTimeout(() => { setSpread(s => s + 1); setFlipping(null) }, 550)
  }

  const flipBackward = () => {
    if (flipping) return
    if (spread === 0) { setShowCover(true); return }
    setFlipping('backward')
    setTimeout(() => { setSpread(s => s - 1); setFlipping(null) }, 550)
  }

  if (loading) {
    return (
      <div className="compdeck">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <div className="cd-spinner w-8 h-8" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="compdeck">
        <Navbar />
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <h1 className="text-2xl font-bold mb-2">Binder Not Found</h1>
          <p className="text-white/40">{error}</p>
        </div>
      </div>
    )
  }

  const binderTitle = data?.owner?.username
    ? `${data.owner.username}'s ${data.binder?.name || 'Binder'} - The Vault`
    : 'Shared Binder - The Vault'

  if (showCover) {
    return (
      <div className="compdeck">
        <PageTitle title={binderTitle} />
        <Navbar />
        <div className="flex flex-col items-center gap-6 py-12 px-4 max-w-[1400px] mx-auto">
          {data.owner && (
            <div className="flex items-center gap-3 mb-2">
              {data.owner.avatar && (
                <img src={data.owner.avatar} alt="" className="w-8 h-8 rounded-full" />
              )}
              <span className="text-white/60 text-sm">{data.owner.username}'s Binder</span>
            </div>
          )}
          <div
            className="binder-cover"
            style={{ background: getBinderBg(color) }}
            onClick={() => setShowCover(false)}
          >
            <BookMarked size={48} className="opacity-20 absolute top-6 right-6" style={{ color: 'rgba(255,255,255,0.15)' }} />
            <div className="binder-cover__title">{data.binder.name}</div>
            <div className="binder-cover__subtitle">Card Binder</div>
            <div className="binder-cover__subtitle" style={{ fontSize: 12, opacity: 0.3 }}>
              {data.cards.length} / {PAGES * SLOTS_PER_PAGE} cards
            </div>
          </div>
          <button
            onClick={() => setShowCover(false)}
            className="px-4 py-2 rounded-lg bg-[var(--cd-cyan)]/10 border border-[var(--cd-cyan)]/20 text-[var(--cd-cyan)] text-sm font-bold cd-head tracking-wider hover:bg-[var(--cd-cyan)]/20 transition-all cursor-pointer"
          >
            Open Binder
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="compdeck">
      <PageTitle title={binderTitle} />
      <Navbar />
      <div className="max-w-[1400px] mx-auto px-4 py-6">
        {data.owner && (
          <div className="flex items-center gap-3 mb-4">
            {data.owner.avatar && (
              <img src={data.owner.avatar} alt="" className="w-6 h-6 rounded-full" />
            )}
            <span className="text-white/50 text-sm">{data.owner.username}'s</span>
            <span className="text-white/70 text-sm font-bold cd-head tracking-wider">{data.binder.name}</span>
            <span className="text-white/20 text-xs ml-auto">Pages {leftPage}-{rightPage}</span>
          </div>
        )}

        <div className="binder-flip-container" style={{ perspective: '2400px' }}>
          <div className="binder-spread">
            <ReadOnlyPage page={leftPage} side="left" color={color} cardsBySlot={cardsBySlot} />
            <div className="binder-spine" />
            <ReadOnlyPage page={rightPage} side="right" color={color} cardsBySlot={cardsBySlot} />

            {flipping === 'forward' && (
              <div className="binder-flip-page binder-flip-page--forward">
                <div className="binder-flip-front">
                  <PageContent page={rightPage} color={color} cardsBySlot={cardsBySlot} />
                </div>
                <div className="binder-flip-back">
                  <PageContent page={rightPage + 1} color={color} cardsBySlot={cardsBySlot} />
                </div>
              </div>
            )}
            {flipping === 'backward' && (
              <div className="binder-flip-page binder-flip-page--backward">
                <div className="binder-flip-front">
                  <PageContent page={leftPage} color={color} cardsBySlot={cardsBySlot} />
                </div>
                <div className="binder-flip-back">
                  <PageContent page={leftPage - 1} color={color} cardsBySlot={cardsBySlot} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center gap-6 mt-4">
          <button onClick={flipBackward} disabled={flipping} className="flex items-center gap-1 px-3 py-2 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/5 transition-all cursor-pointer disabled:opacity-30">
            <ChevronLeft size={18} />
            <span className="text-xs cd-head tracking-wider">{spread === 0 ? 'Cover' : 'Prev'}</span>
          </button>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: 5 }, (_, i) => (
              <button key={i} onClick={() => { if (!flipping) setSpread(i) }} className={`w-2 h-2 rounded-full transition-all cursor-pointer ${i === spread ? 'bg-[var(--cd-cyan)] scale-125' : 'bg-white/15 hover:bg-white/30'}`} />
            ))}
          </div>
          <button onClick={flipForward} disabled={spread >= 4 || flipping} className="flex items-center gap-1 px-3 py-2 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/5 transition-all cursor-pointer disabled:opacity-30">
            <span className="text-xs cd-head tracking-wider">Next</span>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

function ReadOnlyPage({ page, side, color, cardsBySlot }) {
  return (
    <div className={`binder-page binder-page--${side}`} style={{ background: getBinderBg(darken(color, 40)) }}>
      <div className="binder-grid">
        {Array.from({ length: SLOTS_PER_PAGE }, (_, i) => {
          const slot = i + 1
          const key = `${page}-${slot}`
          const card = cardsBySlot[key]
          return (
            <div key={key} className={`binder-slot ${card ? 'binder-slot--filled' : 'binder-slot--empty'}`} style={{ cursor: 'default' }}>
              {card && <ShareCardRender card={card} />}
            </div>
          )
        })}
      </div>
      <div className="binder-page-num">{page}</div>
    </div>
  )
}

function PageContent({ page, color, cardsBySlot }) {
  if (page < 1 || page > PAGES) return <div style={{ background: getBinderBg(darken(color, 40)), width: '100%', height: '100%' }} />
  return (
    <div style={{ background: getBinderBg(darken(color, 40)), width: '100%', height: '100%', padding: 16, display: 'flex', flexDirection: 'column' }}>
      <div className="binder-grid">
        {Array.from({ length: SLOTS_PER_PAGE }, (_, i) => {
          const slot = i + 1
          const key = `${page}-${slot}`
          const card = cardsBySlot[key]
          return (
            <div key={key} className={`binder-slot ${card ? 'binder-slot--filled' : 'binder-slot--empty'}`}>
              {card && <ShareCardRender card={card} />}
            </div>
          )
        })}
      </div>
      <div className="binder-page-num">{page}</div>
    </div>
  )
}

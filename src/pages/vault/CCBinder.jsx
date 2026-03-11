import { useState, useMemo, useCallback, useEffect } from 'react'
import { useVault } from './VaultContext'
import GameCard from './components/GameCard'
import TradingCard from '../../components/TradingCard'
import { ChevronLeft, ChevronRight, Share2, Settings, X, Check, BookMarked } from 'lucide-react'
import './binder.css'

const PAGES = 10
const SLOTS_PER_PAGE = 9
const BINDER_COLORS = [
  { id: '#8b5e3c', name: 'Leather' },
  { id: '#1a1a2e', name: 'Midnight' },
  { id: '#2d1b1b', name: 'Crimson' },
  { id: '#1b2d1b', name: 'Forest' },
  { id: '#1b1b2d', name: 'Royal' },
  { id: '#2d2d1b', name: 'Gold' },
  { id: '#2d1b2d', name: 'Amethyst' },
  { id: '#1b2d2d', name: 'Teal' },
  { id: '#111111', name: 'Obsidian' },
  { id: '#2a1f14', name: 'Espresso' },
]

function getBinderBg(color) {
  return `linear-gradient(145deg, ${lighten(color, 20)}, ${color}, ${darken(color, 20)})`
}

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

export default function CCBinder() {
  const { collection, binder, binderCards, saveBinder, binderSlotCard, binderUnslotCard, binderGenerateShare } = useVault()

  const [spread, setSpread] = useState(0) // 0-4 (each spread = 2 pages)
  const [showCover, setShowCover] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [pickerSlot, setPickerSlot] = useState(null) // { page, slot }
  const [flipping, setFlipping] = useState(null) // 'forward' | 'backward' | null
  const [binderName, setBinderName] = useState('')
  const [binderColor, setBinderColor] = useState('#8b5e3c')
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (binder) {
      setBinderName(binder.name || 'My Collection')
      setBinderColor(binder.color || '#8b5e3c')
    }
  }, [binder])

  const cardsBySlot = useMemo(() => {
    const map = {}
    for (const entry of binderCards) {
      map[`${entry.page}-${entry.slot}`] = entry.card
    }
    return map
  }, [binderCards])

  const binderCardIds = useMemo(() => new Set(binderCards.map(e => e.card.id)), [binderCards])

  const leftPage = spread * 2 + 1
  const rightPage = spread * 2 + 2

  const flipForward = useCallback(() => {
    if (spread >= 4 || flipping) return
    setFlipping('forward')
    setTimeout(() => {
      setSpread(s => s + 1)
      setFlipping(null)
    }, 550)
  }, [spread, flipping])

  const flipBackward = useCallback(() => {
    if (flipping) return
    if (spread === 0) {
      setShowCover(true)
      return
    }
    setFlipping('backward')
    setTimeout(() => {
      setSpread(s => s - 1)
      setFlipping(null)
    }, 550)
  }, [spread, flipping])

  const handleSlotClick = useCallback((page, slot) => {
    const key = `${page}-${slot}`
    if (cardsBySlot[key]) return
    setPickerSlot({ page, slot })
  }, [cardsBySlot])

  const handlePickCard = useCallback(async (cardId) => {
    if (!pickerSlot) return
    await binderSlotCard(cardId, pickerSlot.page, pickerSlot.slot)
    setPickerSlot(null)
  }, [pickerSlot, binderSlotCard])

  const handleRemoveCard = useCallback(async (page, slot, e) => {
    e.stopPropagation()
    await binderUnslotCard(page, slot)
  }, [binderUnslotCard])

  const handleSaveSettings = useCallback(async () => {
    setSaving(true)
    try {
      await saveBinder(binderName, binderColor)
    } finally {
      setSaving(false)
    }
  }, [saveBinder, binderName, binderColor])

  const handleShare = useCallback(async () => {
    const token = binder?.shareToken || await binderGenerateShare()
    const url = `${window.location.origin}/vault/binder/${token}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [binder, binderGenerateShare])

  const color = binder?.color || binderColor

  // Cover view
  if (showCover) {
    return (
      <div className="flex flex-col items-center gap-6 py-8">
        <div
          className="binder-cover"
          style={{ background: getBinderBg(color) }}
          onClick={() => setShowCover(false)}
        >
          <BookMarked size={48} className="opacity-20 absolute top-6 right-6" style={{ color: 'rgba(255,255,255,0.15)' }} />
          <div className="binder-cover__title">{binder?.name || 'My Collection'}</div>
          <div className="binder-cover__subtitle">Card Binder</div>
          <div className="binder-cover__subtitle" style={{ fontSize: 12, opacity: 0.3 }}>
            {binderCards.length} / {PAGES * SLOTS_PER_PAGE} cards
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCover(false)}
            className="px-4 py-2 rounded-lg bg-[var(--cd-cyan)]/10 border border-[var(--cd-cyan)]/20 text-[var(--cd-cyan)] text-sm font-bold cd-head tracking-wider hover:bg-[var(--cd-cyan)]/20 transition-all cursor-pointer"
          >
            Open Binder
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setShowSettings(true); setShowCover(false) }}
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/10 transition-all cursor-pointer"
          >
            <Settings size={16} />
          </button>
          <button
            onClick={handleShare}
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/10 transition-all cursor-pointer"
          >
            {copied ? <Check size={16} className="text-green-400" /> : <Share2 size={16} />}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="py-4">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCover(true)}
            className="text-sm text-white/40 hover:text-white/70 cd-head tracking-wider cursor-pointer"
          >
            Cover
          </button>
          <span className="text-white/15">|</span>
          <span className="text-sm text-white/30 cd-head tracking-wider">
            Pages {leftPage}-{rightPage} of {PAGES}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded-md transition-all cursor-pointer ${showSettings ? 'bg-[var(--cd-cyan)]/10 text-[var(--cd-cyan)]' : 'text-white/30 hover:text-white/60'}`}
          >
            <Settings size={14} />
          </button>
          <button
            onClick={handleShare}
            className="p-1.5 rounded-md text-white/30 hover:text-white/60 transition-all cursor-pointer"
          >
            {copied ? <Check size={14} className="text-green-400" /> : <Share2 size={14} />}
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="binder-settings p-4 rounded-lg bg-white/[0.03] border border-white/10 mb-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] text-white/30 cd-head tracking-widest mb-1.5">COLLECTION NAME</label>
            <input
              type="text"
              value={binderName}
              onChange={e => setBinderName(e.target.value)}
              maxLength={40}
              className="w-full px-3 py-1.5 rounded-md bg-black/30 border border-white/10 text-white text-sm outline-none focus:border-[var(--cd-cyan)]/40"
            />
          </div>
          <div>
            <label className="block text-[10px] text-white/30 cd-head tracking-widest mb-1.5">BINDER COLOR</label>
            <div className="binder-color-picker">
              {BINDER_COLORS.map(c => (
                <button
                  key={c.id}
                  onClick={() => setBinderColor(c.id)}
                  className={`binder-color-swatch ${binderColor === c.id ? 'binder-color-swatch--active' : ''}`}
                  style={{ background: getBinderBg(c.id) }}
                  title={c.name}
                />
              ))}
            </div>
          </div>
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="px-4 py-1.5 rounded-md bg-[var(--cd-cyan)]/10 border border-[var(--cd-cyan)]/20 text-[var(--cd-cyan)] text-xs font-bold cd-head tracking-wider hover:bg-[var(--cd-cyan)]/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      )}

      {/* Book */}
      <div className="binder-flip-container" style={{ perspective: '2400px' }}>
        <div className="binder-spread">
          {/* Left page */}
          <BinderPage
            page={leftPage}
            side="left"
            color={color}
            cardsBySlot={cardsBySlot}
            onSlotClick={handleSlotClick}
            onRemoveCard={handleRemoveCard}
          />

          {/* Spine */}
          <div className="binder-spine" />

          {/* Right page */}
          <BinderPage
            page={rightPage}
            side="right"
            color={color}
            cardsBySlot={cardsBySlot}
            onSlotClick={handleSlotClick}
            onRemoveCard={handleRemoveCard}
          />

          {/* Page flip animation overlay */}
          {flipping === 'forward' && (
            <div className="binder-flip-page binder-flip-page--forward">
              <div className="binder-flip-front">
                <BinderPageContent page={rightPage} side="right" color={color} cardsBySlot={cardsBySlot} />
              </div>
              <div className="binder-flip-back">
                <BinderPageContent page={rightPage + 1} side="left" color={color} cardsBySlot={cardsBySlot} />
              </div>
            </div>
          )}

          {flipping === 'backward' && (
            <div className="binder-flip-page binder-flip-page--backward">
              <div className="binder-flip-front">
                <BinderPageContent page={leftPage} side="left" color={color} cardsBySlot={cardsBySlot} />
              </div>
              <div className="binder-flip-back">
                <BinderPageContent page={leftPage - 1} side="right" color={color} cardsBySlot={cardsBySlot} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-center gap-6 mt-4">
        <button
          onClick={flipBackward}
          disabled={flipping}
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/5 transition-all cursor-pointer disabled:opacity-30"
        >
          <ChevronLeft size={18} />
          <span className="text-xs cd-head tracking-wider">{spread === 0 ? 'Cover' : 'Prev'}</span>
        </button>

        <div className="flex items-center gap-1.5">
          {Array.from({ length: 5 }, (_, i) => (
            <button
              key={i}
              onClick={() => { if (!flipping) setSpread(i) }}
              className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                i === spread ? 'bg-[var(--cd-cyan)] scale-125' : 'bg-white/15 hover:bg-white/30'
              }`}
            />
          ))}
        </div>

        <button
          onClick={flipForward}
          disabled={spread >= 4 || flipping}
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/5 transition-all cursor-pointer disabled:opacity-30"
        >
          <span className="text-xs cd-head tracking-wider">Next</span>
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Card picker modal */}
      {pickerSlot && (
        <CardPicker
          collection={collection}
          binderCardIds={binderCardIds}
          onPick={handlePickCard}
          onClose={() => setPickerSlot(null)}
          targetPage={pickerSlot.page}
          targetSlot={pickerSlot.slot}
        />
      )}
    </div>
  )
}

function BinderPage({ page, side, color, cardsBySlot, onSlotClick, onRemoveCard }) {
  return (
    <div
      className={`binder-page binder-page--${side}`}
      style={{ background: getBinderBg(darken(color, 40)) }}
    >
      <div className="binder-grid">
        {Array.from({ length: SLOTS_PER_PAGE }, (_, i) => {
          const slot = i + 1
          const key = `${page}-${slot}`
          const card = cardsBySlot[key]
          return (
            <div
              key={key}
              className={`binder-slot ${card ? 'binder-slot--filled' : 'binder-slot--empty'}`}
              onClick={() => !card && onSlotClick(page, slot)}
            >
              {card && (
                <>
                  <BinderCardRender card={card} />
                  <button
                    className="binder-slot__remove"
                    onClick={(e) => onRemoveCard(page, slot, e)}
                  >
                    <X size={10} />
                  </button>
                </>
              )}
            </div>
          )
        })}
      </div>
      <div className="binder-page-num">{page}</div>
    </div>
  )
}

// Non-interactive page content for flip animation
function BinderPageContent({ page, color, cardsBySlot }) {
  if (page < 1 || page > PAGES) return <div style={{ background: getBinderBg(darken(color, 40)), width: '100%', height: '100%' }} />

  return (
    <div
      style={{
        background: getBinderBg(darken(color, 40)),
        width: '100%',
        height: '100%',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div className="binder-grid">
        {Array.from({ length: SLOTS_PER_PAGE }, (_, i) => {
          const slot = i + 1
          const key = `${page}-${slot}`
          const card = cardsBySlot[key]
          return (
            <div
              key={key}
              className={`binder-slot ${card ? 'binder-slot--filled' : 'binder-slot--empty'}`}
            >
              {card && <BinderCardRender card={card} />}
            </div>
          )
        })}
      </div>
      <div className="binder-page-num">{page}</div>
    </div>
  )
}

function CardPicker({ collection, binderCardIds, onPick, onClose, targetPage, targetSlot }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('player')

  const available = useMemo(() => {
    let cards = collection.filter(c => !binderCardIds.has(c.id))

    if (filter !== 'all') {
      cards = cards.filter(c => (c.cardType || 'god') === filter)
    }

    if (search.length >= 2) {
      const q = search.toLowerCase()
      cards = cards.filter(c =>
        c.godName?.toLowerCase().includes(q) ||
        c.cardData?.teamName?.toLowerCase().includes(q)
      )
    }

    return cards.slice(0, 100)
  }, [collection, binderCardIds, search, filter])

  return (
    <div className="binder-picker-overlay" onClick={onClose}>
      <div className="binder-picker" onClick={e => e.stopPropagation()}>
        <div className="binder-picker__header">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold cd-head tracking-wider text-white/70">
              Select Card — Page {targetPage}, Slot {targetSlot}
            </span>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-2 px-4 pt-3">
          <div className="flex items-center gap-1.5">
            {[
              { key: 'player', label: 'Players' },
              { key: 'god', label: 'Gods' },
              { key: 'item', label: 'Items' },
              { key: 'consumable', label: 'Consumables' },
              { key: 'all', label: 'All' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold cd-head tracking-wider border transition-all cursor-pointer ${
                  filter === f.key
                    ? 'bg-[var(--cd-cyan)]/10 text-[var(--cd-cyan)] border-[var(--cd-cyan)]/30'
                    : 'bg-transparent text-white/30 border-white/10 hover:text-white/50 hover:border-white/20'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Search cards..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 rounded-md bg-black/30 border border-white/10 text-white text-sm outline-none focus:border-[var(--cd-cyan)]/40"
            autoFocus
          />
        </div>

        <div className="binder-picker__grid">
          {available.length === 0 && (
            <div className="col-span-full text-center text-white/30 text-sm py-8">
              No available cards found
            </div>
          )}
          {available.map(card => {
            const isPlayer = (card.cardType || 'god') === 'player'
            return (
              <div
                key={card.id}
                className="binder-picker__card"
                onClick={() => onPick(card.id)}
              >
                {isPlayer ? (
                  <TradingCard {...toPlayerCardProps(card)} variant="player" rarity={card.rarity} size={130} />
                ) : (
                  <GameCard type={card.cardType || 'god'} rarity={card.rarity} data={toGameCardData(card)} compact size={130} />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const EMPTY_STATS = {
  gamesPlayed: 0, wins: 0, winRate: 0, kda: 0,
  avgDamage: 0, avgMitigated: 0,
  totalKills: 0, totalDeaths: 0, totalAssists: 0,
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
    stats: EMPTY_STATS,
    bestGod: cd.bestGod
      ? { ...cd.bestGod, ...(card.bestGodName ? { name: card.bestGodName } : {}) }
      : (card.bestGodName ? { name: card.bestGodName } : null),
    isFirstEdition: card.isFirstEdition || false,
  }
}

function BinderCardRender({ card }) {
  const isPlayer = (card.cardType || 'god') === 'player'
  if (isPlayer) {
    return <TradingCard {...toPlayerCardProps(card)} variant="player" rarity={card.rarity} />
  }
  return <GameCard type={card.cardType || 'god'} rarity={card.rarity} data={toGameCardData(card)} />
}

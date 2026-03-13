import { useState, useMemo, useCallback, useRef, forwardRef, Fragment } from 'react'
import { useVault } from './VaultContext'
import { useAuth } from '../../context/AuthContext'
import { GODS, CLASS_ROLE } from '../../data/vault/gods'
import { ITEMS } from '../../data/vault/items'
import { CONSUMABLES } from '../../data/vault/buffs'
import './CCBlackMarket.css'

const RARITY_COLORS = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#ff8c00',
  mythic: '#ef4444',
}

const RARITY_LABELS = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
  mythic: 'Mythic',
}

const REWARD_TIERS = {
  common: 3,
  uncommon: 5,
  rare: 7,
  epic: 10,
  legendary: 15,
  mythic: 'choose',
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))


// ─── SVG Hand Component ───────────────────────────────────

function ShadowyHand({ phase }) {
  const isOpen = phase === 'idle' || phase === 'dragging' || phase === 'return'

  return (
    <svg viewBox="0 0 200 280" fill="none" xmlns="http://www.w3.org/2000/svg" className="bm-hand-svg">
      <defs>
        <radialGradient id="bm-hand-glow" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="rgba(139,0,0,0.3)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <linearGradient id="bm-hand-fill" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#0a0008" />
          <stop offset="60%" stopColor="#120010" />
          <stop offset="100%" stopColor="#0a0008" />
        </linearGradient>
        <filter id="bm-hand-shadow">
          <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="rgba(139,0,0,0.4)" />
        </filter>
      </defs>

      {/* Glow behind hand */}
      <ellipse cx="100" cy="120" rx="90" ry="100" fill="url(#bm-hand-glow)" />

      {isOpen ? (
        /* Open palm — fingers spread, reaching up */
        <g filter="url(#bm-hand-shadow)">
          {/* Palm base */}
          <path d="M60 180 C60 150, 65 140, 70 130 L70 125 C72 118, 78 115, 82 115 L118 115 C122 115, 128 118, 130 125 L130 130 C135 140, 140 150, 140 180 L140 240 C140 260, 130 270, 100 270 C70 270, 60 260, 60 240 Z"
            fill="url(#bm-hand-fill)" stroke="rgba(139,0,0,0.25)" strokeWidth="1" />
          {/* Thumb — left, angled out */}
          <path d="M62 160 C55 150, 42 135, 38 118 C35 105, 40 95, 48 98 C54 100, 58 110, 60 125 L62 140"
            fill="url(#bm-hand-fill)" stroke="rgba(139,0,0,0.2)" strokeWidth="1" />
          {/* Index finger */}
          <path d="M78 115 C76 95, 74 70, 72 45 C71 32, 76 25, 82 26 C88 27, 90 35, 89 48 L86 80 L85 115"
            fill="url(#bm-hand-fill)" stroke="rgba(139,0,0,0.2)" strokeWidth="1" />
          {/* Middle finger — tallest */}
          <path d="M93 115 C92 90, 91 60, 90 30 C89 15, 95 8, 101 9 C107 10, 110 18, 109 33 L106 75 L104 115"
            fill="url(#bm-hand-fill)" stroke="rgba(139,0,0,0.2)" strokeWidth="1" />
          {/* Ring finger */}
          <path d="M110 115 C112 92, 114 68, 115 48 C116 35, 121 28, 126 30 C131 32, 132 40, 131 52 L128 82 L122 115"
            fill="url(#bm-hand-fill)" stroke="rgba(139,0,0,0.2)" strokeWidth="1" />
          {/* Pinky */}
          <path d="M128 125 C132 108, 136 90, 138 72 C139 60, 144 55, 149 58 C153 61, 153 70, 151 80 L146 105 L140 130"
            fill="url(#bm-hand-fill)" stroke="rgba(139,0,0,0.2)" strokeWidth="1" />
          {/* Knuckle highlights */}
          <ellipse cx="82" cy="115" rx="5" ry="3" fill="rgba(139,0,0,0.08)" />
          <ellipse cx="100" cy="112" rx="5" ry="3" fill="rgba(139,0,0,0.08)" />
          <ellipse cx="118" cy="115" rx="5" ry="3" fill="rgba(139,0,0,0.08)" />
        </g>
      ) : (
        /* Closed fist — fingers clenched */
        <g filter="url(#bm-hand-shadow)">
          {/* Fist body */}
          <path d="M58 130 C58 110, 65 90, 75 85 L80 82 C85 78, 95 76, 105 76 L120 78 C130 80, 138 88, 142 100 L144 115 C146 130, 144 150, 140 170 L138 200 C136 230, 128 260, 100 270 C72 260, 64 230, 62 200 L60 170 C58 155, 57 140, 58 130 Z"
            fill="url(#bm-hand-fill)" stroke="rgba(139,0,0,0.25)" strokeWidth="1" />
          {/* Thumb wrapped over */}
          <path d="M60 130 C52 125, 44 115, 44 105 C44 95, 50 90, 56 92 C62 94, 66 102, 66 112 L64 125"
            fill="url(#bm-hand-fill)" stroke="rgba(139,0,0,0.2)" strokeWidth="1" />
          {/* Finger ridges across fist */}
          <path d="M70 95 C80 88, 100 84, 120 88 C130 90, 136 96, 138 105"
            fill="none" stroke="rgba(139,0,0,0.12)" strokeWidth="1.5" />
          <path d="M68 108 C78 102, 100 98, 125 102 C132 104, 138 108, 140 115"
            fill="none" stroke="rgba(139,0,0,0.1)" strokeWidth="1" />
          <path d="M66 120 C76 115, 100 112, 128 116 C134 118, 140 122, 142 128"
            fill="none" stroke="rgba(139,0,0,0.08)" strokeWidth="1" />
          {/* Knuckle bumps */}
          <ellipse cx="82" cy="86" rx="6" ry="4" fill="rgba(139,0,0,0.1)" />
          <ellipse cx="100" cy="83" rx="6" ry="4" fill="rgba(139,0,0,0.1)" />
          <ellipse cx="118" cy="86" rx="6" ry="4" fill="rgba(139,0,0,0.1)" />
        </g>
      )}

      {/* Bottom fog/shadow */}
      <rect x="0" y="240" width="200" height="40" fill="url(#bm-hand-fill)" opacity="0.6" />
      <ellipse cx="100" cy="260" rx="80" ry="20" fill="rgba(10,0,8,0.9)" />
    </svg>
  )
}


// ─── Hand Drop Zone ──────────────────────────────────────

const HandDropZone = forwardRef(function HandDropZone({
  phase, selectedCard, reward, onDrop, onDragOver, onDragLeave, onCollect, isDragOver, isMobile, onMobileTurnIn,
}, ref) {
  const isActive = isDragOver || (isMobile && selectedCard && phase === 'idle')
  const rewardPacks = reward?.type === 'packs' ? reward.count : 0
  const isMythicReward = reward?.type === 'mythic_choice'

  return (
    <div
      ref={ref}
      className={`bm-drop-zone rounded-xl relative ${isActive ? 'bm-drop-zone-active' : ''} ${phase === 'grab' ? 'bm-phase-grab' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Shadow particles */}
      <div className="bm-particles">
        {[...Array(8)].map((_, i) => <div key={i} className="bm-particle" />)}
      </div>

      {/* Phase: idle / dragging */}
      {(phase === 'idle' || phase === 'dragging') && (
        <div className="flex flex-col items-center gap-2 z-10 relative">
          <div className={`bm-hand-svg ${phase === 'idle' ? 'bm-hand-idle' : 'bm-hand-dragging'}`}>
            <ShadowyHand phase={phase} />
          </div>
          {!selectedCard && (
            <p className="text-xs text-white/25 cd-head tracking-widest mt-1">
              {isMobile ? 'Select a card below' : 'Drag a card here'}
            </p>
          )}
          {isMobile && selectedCard && phase === 'idle' && (
            <button
              onClick={onMobileTurnIn}
              className="mt-2 px-5 py-2 rounded-lg text-sm font-bold cd-head uppercase tracking-wider bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 transition-all cursor-pointer z-10"
            >
              Turn In
            </button>
          )}
        </div>
      )}

      {/* Phase: grab */}
      {phase === 'grab' && (
        <div className="flex flex-col items-center z-10 relative">
          <div className="bm-hand-svg bm-hand-grab">
            <ShadowyHand phase={phase} />
          </div>
        </div>
      )}

      {/* Phase: devour */}
      {phase === 'devour' && (
        <div className="flex flex-col items-center z-10 relative">
          <div className="bm-hand-svg bm-hand-devour">
            <ShadowyHand phase={phase} />
          </div>
        </div>
      )}

      {/* Phase: return */}
      {phase === 'return' && (
        <div className="flex flex-col items-center gap-3 z-10 relative bm-reward-fade-in">
          <div className="bm-hand-svg bm-hand-return">
            <ShadowyHand phase={phase} />
          </div>
          {rewardPacks > 0 && (
            <div className="bm-reward-packs">
              {[...Array(Math.min(rewardPacks, 15))].map((_, i) => (
                <div key={i} className="bm-reward-pack">
                  <svg viewBox="0 0 20 26" width="16" height="20" fill="none">
                    <rect x="1" y="1" width="18" height="24" rx="2" fill="rgba(139,0,0,0.3)" stroke="rgba(200,0,0,0.4)" strokeWidth="1" />
                    <line x1="4" y1="8" x2="16" y2="8" stroke="rgba(200,0,0,0.3)" strokeWidth="0.5" />
                    <line x1="4" y1="12" x2="16" y2="12" stroke="rgba(200,0,0,0.2)" strokeWidth="0.5" />
                  </svg>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Phase: collect */}
      {phase === 'collect' && (
        <div className="flex flex-col items-center gap-4 z-10 relative bm-reward-fade-in">
          <div className="bm-hand-svg bm-hand-collect">
            <ShadowyHand phase="idle" />
          </div>

          {rewardPacks > 0 && (
            <div className="text-center">
              <div className="text-2xl font-bold cd-num text-red-400 mb-1">+{rewardPacks}</div>
              <div className="text-xs text-white/40 cd-head tracking-wider">League Packs</div>
            </div>
          )}

          {isMythicReward && (
            <div className="text-center">
              <div className="text-lg font-bold cd-head text-red-400 tracking-wider">Mythic Choice</div>
              <div className="text-xs text-white/30 mt-1">Choose any mythic card from the catalog</div>
            </div>
          )}

          <button
            onClick={onCollect}
            className="px-6 py-2.5 rounded-lg text-sm font-bold cd-head uppercase tracking-wider bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 hover:shadow-[0_0_20px_rgba(200,0,0,0.2)] transition-all cursor-pointer"
          >
            {isMythicReward ? 'Choose Your Mythic' : 'Collect'}
          </button>
        </div>
      )}
    </div>
  )
})


// ─── Brudih Card Item ────────────────────────────────────

function BrudihCardItem({ card, isSelected, onSelect, onDragStart, onDragEnd, dragging }) {
  const color = RARITY_COLORS[card.rarity] || RARITY_COLORS.common
  const league = card.cardData?.leagueName || ''
  const reward = REWARD_TIERS[card.rarity]

  return (
    <div
      className={`bm-card-item rounded-lg p-3 border shrink-0 ${
        isSelected
          ? 'bm-card-item-selected border-red-500/40'
          : 'border-[rgba(139,0,0,0.15)] hover:border-[rgba(139,0,0,0.35)]'
      } ${dragging ? 'bm-card-dragging' : ''}`}
      style={{ background: `linear-gradient(135deg, ${color}08, rgba(10,0,8,0.9))`, width: 110 }}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onSelect}
    >
      <div className="text-[10px] font-bold cd-head tracking-wider mb-1 truncate" style={{ color }}>
        {RARITY_LABELS[card.rarity] || card.rarity}
      </div>
      <div className="text-sm font-bold text-white/90 cd-head tracking-wide truncate">Brudih</div>
      {league && (
        <div className="text-[10px] text-white/30 cd-mono mt-0.5 uppercase">{league}</div>
      )}
      <div className="mt-2 text-[10px] text-white/20 cd-head tracking-wider">
        {reward === 'choose' ? 'Mythic pick' : `${reward} packs`}
      </div>
    </div>
  )
}


// ─── Brudih Card Grid ────────────────────────────────────

function BrudihCardGrid({ cards, selectedCard, onSelect, onDragStart, onDragEnd, draggingId, isMobile }) {
  if (cards.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-white/15 text-4xl mb-3">&#9760;</div>
        <p className="text-sm font-bold cd-head text-white/25 tracking-wider">No Brudih Cards</p>
        <p className="text-xs text-white/15 mt-1">Find Brudih player cards in packs to trade here.</p>
      </div>
    )
  }

  if (isMobile) {
    return (
      <div className="bm-mobile-scroll">
        {cards.map(card => (
          <BrudihCardItem
            key={card.id}
            card={card}
            isSelected={selectedCard?.id === card.id}
            onSelect={() => onSelect(card)}
            onDragStart={() => {}}
            onDragEnd={() => {}}
            dragging={false}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map(card => (
        <BrudihCardItem
          key={card.id}
          card={card}
          isSelected={selectedCard?.id === card.id}
          onSelect={() => onSelect(card)}
          onDragStart={(e) => onDragStart(e, card)}
          onDragEnd={onDragEnd}
          dragging={draggingId === card.id}
        />
      ))}
    </div>
  )
}


// ─── Exchange Rates ──────────────────────────────────────

function ExchangeRates() {
  return (
    <div className="bm-panel rounded-lg p-4">
      <div className="text-xs font-bold cd-head text-white/30 tracking-widest mb-3 uppercase">Exchange Rates</div>
      <div className="bm-rates-grid">
        {Object.entries(REWARD_TIERS).map(([rarity, reward]) => (
          <Fragment key={rarity}>
            <div className="bm-rate-cell">
              <div className="text-[11px] font-bold cd-head" style={{ color: RARITY_COLORS[rarity] }}>
                {RARITY_LABELS[rarity]}
              </div>
              <div className="text-sm font-bold cd-num text-white/70 mt-1">
                {reward === 'choose' ? (
                  <span className="text-red-400">Mythic Pick</span>
                ) : (
                  <>{reward} packs</>
                )}
              </div>
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  )
}


// ─── Mythic Selection Modal ──────────────────────────────

function MythicSelectionModal({ onSelect, onClose }) {
  const [tab, setTab] = useState('gods')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [claiming, setClaiming] = useState(false)

  const catalog = useMemo(() => {
    const gods = GODS.map(g => ({
      cardType: 'god',
      godId: g.slug,
      godName: g.name,
      godClass: g.class,
      role: CLASS_ROLE[g.class] || 'mid',
      label: g.name,
      sublabel: g.class,
    }))
    const items = ITEMS.map(it => ({
      cardType: 'item',
      godId: 'item-' + it.id,
      godName: it.name,
      label: it.name,
      sublabel: it.type || 'Item',
    }))
    const consumables = CONSUMABLES.map(c => ({
      cardType: 'consumable',
      godId: 'consumable-' + c.id,
      godName: c.name,
      label: c.name,
      sublabel: 'Consumable',
    }))
    return { gods, items, consumables }
  }, [])

  const filtered = useMemo(() => {
    const list = catalog[tab] || []
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(item => item.label.toLowerCase().includes(q))
  }, [catalog, tab, search])

  const tabs = [
    { key: 'gods', label: 'Gods' },
    { key: 'items', label: 'Items' },
    { key: 'consumables', label: 'Consumables' },
  ]

  const handleConfirm = async () => {
    if (!selected || claiming) return
    setClaiming(true)
    try {
      await onSelect(selected)
    } catch {
      setClaiming(false)
    }
  }

  return (
    <div className="bm-mythic-modal">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div>
          <h2 className="text-lg font-bold cd-head text-red-400 tracking-wider">Choose Your Mythic</h2>
          <p className="text-[11px] text-white/30 mt-0.5">Select any card to receive as a Mythic</p>
        </div>
        <button
          onClick={onClose}
          className="text-white/30 hover:text-white/60 text-2xl leading-none transition-colors cursor-pointer px-2"
        >
          &times;
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 mb-3">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSelected(null) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold cd-head tracking-wider transition-all cursor-pointer ${
              tab === t.key
                ? 'bg-red-500/15 border border-red-500/30 text-red-400'
                : 'border border-transparent text-white/30 hover:text-white/50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-4 mb-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search..."
          className="w-full px-3 py-2 rounded-lg text-sm bg-[rgba(10,0,8,0.8)] border border-[rgba(139,0,0,0.2)] text-white/80 placeholder-white/20 focus:border-[rgba(200,0,0,0.4)] focus:outline-none transition-colors"
        />
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-white/20 text-sm">No results</div>
        ) : (
          <div className="bm-mythic-grid">
            {filtered.map(item => (
              <button
                key={item.godId}
                onClick={() => setSelected(item)}
                className={`bm-mythic-item ${selected?.godId === item.godId ? 'bm-mythic-item-selected' : ''}`}
              >
                <div className="text-sm font-bold text-white/80 truncate">{item.label}</div>
                <div className="text-[11px] text-white/30 mt-0.5">{item.sublabel}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Confirm bar */}
      {selected && (
        <div className="px-4 py-3 border-t border-[rgba(139,0,0,0.2)] bg-[rgba(10,0,8,0.95)] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-bold text-white/80 truncate">{selected.label}</div>
            <div className="text-[11px] text-white/30">{selected.sublabel} — Mythic</div>
          </div>
          <button
            onClick={handleConfirm}
            disabled={claiming}
            className="px-5 py-2 rounded-lg text-sm font-bold cd-head uppercase tracking-wider bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 transition-all cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {claiming ? <div className="cd-spinner w-4 h-4" /> : 'Confirm'}
          </button>
        </div>
      )}
    </div>
  )
}


// ─── Main Component ──────────────────────────────────────

export default function CCBlackMarket() {
  const { collection, blackMarketTurnIn, blackMarketClaimMythic, stats } = useVault()
  const { user } = useAuth()

  const [phase, setPhase] = useState('idle')
  const [selectedCard, setSelectedCard] = useState(null)
  const [reward, setReward] = useState(null)
  const [error, setError] = useState(null)
  const [showMythicModal, setShowMythicModal] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [draggingId, setDraggingId] = useState(null)

  const dropRef = useRef(null)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640

  const brudihCards = useMemo(() =>
    collection.filter(c => c.cardType === 'player' && c.godName === 'Brudih'),
  [collection])

  const brudihsTurnedIn = stats?.brudihsTurnedIn || 0

  // ── Animation handler ──

  const handleTurnIn = useCallback(async (card) => {
    if (phase !== 'idle') return
    setSelectedCard(card)
    setError(null)
    setPhase('grab')
    await sleep(400)
    setPhase('devour')
    try {
      const result = await blackMarketTurnIn(card.id)
      await sleep(600)
      setReward(result.reward)
      setPhase('return')
      await sleep(800)
      setPhase('collect')
    } catch (err) {
      setError(err.message || 'Turn-in failed')
      setPhase('idle')
      setSelectedCard(null)
    }
  }, [phase, blackMarketTurnIn])

  // ── Collect handler ──

  const handleCollect = useCallback(() => {
    if (reward?.type === 'mythic_choice') {
      setShowMythicModal(true)
    } else {
      setPhase('idle')
      setSelectedCard(null)
      setReward(null)
    }
  }, [reward])

  // ── Mythic claim ──

  const handleMythicSelect = useCallback(async (catalogItem) => {
    try {
      await blackMarketClaimMythic({
        cardType: catalogItem.cardType,
        godId: catalogItem.godId,
        godName: catalogItem.godName,
        godClass: catalogItem.godClass,
        role: catalogItem.role,
      })
      setShowMythicModal(false)
      setPhase('idle')
      setSelectedCard(null)
      setReward(null)
    } catch (err) {
      setError(err.message || 'Mythic claim failed')
      throw err
    }
  }, [blackMarketClaimMythic])

  // ── Drag and drop ──

  const handleDragStart = useCallback((e, card) => {
    setDraggingId(card.id)
    setSelectedCard(card)
    setPhase('dragging')
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', card.id)
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggingId(null)
    setIsDragOver(false)
    if (phase === 'dragging') {
      setPhase('idle')
    }
  }, [phase])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragOver(false)
    setDraggingId(null)
    if (selectedCard) {
      handleTurnIn(selectedCard)
    }
  }, [selectedCard, handleTurnIn])

  // ── Mobile tap select ──

  const handleCardSelect = useCallback((card) => {
    if (phase !== 'idle') return
    setError(null)
    if (isMobile) {
      setSelectedCard(prev => prev?.id === card.id ? null : card)
    } else {
      setSelectedCard(card)
    }
  }, [phase, isMobile])

  const handleMobileTurnIn = useCallback(() => {
    if (selectedCard && phase === 'idle') {
      handleTurnIn(selectedCard)
    }
  }, [selectedCard, phase, handleTurnIn])

  // ── Render ──

  if (!user) {
    return (
      <div className="text-center py-20 text-white/25">
        <p className="text-lg font-bold cd-head">Sign in to access the Black Market</p>
      </div>
    )
  }

  return (
    <div className="bm-container pb-32 relative">
      <div className="bm-vignette" />

      <div className="relative z-10">
        {/* Header */}
        <div className="mb-4">
          <h2 className="text-lg sm:text-xl font-bold cd-head text-red-400 flex items-center gap-2 tracking-wider">
            <span className="text-2xl opacity-60">&#9760;</span>
            Black Market
          </h2>
          <p className="text-[11px] sm:text-xs text-white/25 mt-1">
            Turn in Brudih player cards for league packs. The shadier the card, the better the payout.
          </p>
        </div>

        {/* Counter banner */}
        <div className="bm-counter-banner rounded-lg px-4 py-2.5 mb-4 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-white/25 cd-head tracking-wider uppercase">Held</span>
            <span className="text-lg font-bold cd-num text-red-400">{brudihCards.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-white/25 cd-head tracking-wider uppercase">Turned In</span>
            <span className="text-lg font-bold cd-num text-white/50">{brudihsTurnedIn}</span>
          </div>
        </div>

        {/* Error toast */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 text-sm font-bold cd-head">
            {error}
            <button onClick={() => setError(null)} className="ml-3 text-white/30 hover:text-white/60 cursor-pointer">&times;</button>
          </div>
        )}

        {/* Desktop: side-by-side */}
        <div className="hidden sm:grid sm:grid-cols-[1fr_1.2fr] gap-4">
          {/* Left: cards */}
          <div className="bm-panel rounded-xl p-4">
            <div className="text-xs font-bold cd-head text-white/30 tracking-widest mb-3 uppercase">Your Brudih Cards</div>
            <BrudihCardGrid
              cards={brudihCards}
              selectedCard={selectedCard}
              onSelect={handleCardSelect}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              draggingId={draggingId}
              isMobile={false}
            />
          </div>

          {/* Right: drop zone */}
          <HandDropZone
            ref={dropRef}
            phase={phase}
            selectedCard={selectedCard}
            reward={reward}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onCollect={handleCollect}
            isDragOver={isDragOver}
            isMobile={false}
          />
        </div>

        {/* Mobile: stacked */}
        <div className="sm:hidden flex flex-col gap-4">
          {/* Hand on top */}
          <HandDropZone
            ref={dropRef}
            phase={phase}
            selectedCard={selectedCard}
            reward={reward}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onCollect={handleCollect}
            isDragOver={isDragOver}
            isMobile={true}
            onMobileTurnIn={handleMobileTurnIn}
          />

          {/* Cards below */}
          <div className="bm-panel rounded-xl p-4">
            <div className="text-xs font-bold cd-head text-white/30 tracking-widest mb-3 uppercase">Your Brudih Cards</div>
            <BrudihCardGrid
              cards={brudihCards}
              selectedCard={selectedCard}
              onSelect={handleCardSelect}
              onDragStart={() => {}}
              onDragEnd={() => {}}
              draggingId={null}
              isMobile={true}
            />
          </div>

          {/* Rates on mobile below cards */}
          <ExchangeRates />
        </div>

        {/* Desktop: rates below grid */}
        <div className="hidden sm:block mt-4">
          <ExchangeRates />
        </div>
      </div>

      {/* Mythic modal */}
      {showMythicModal && (
        <MythicSelectionModal
          onSelect={handleMythicSelect}
          onClose={() => setShowMythicModal(false)}
        />
      )}
    </div>
  )
}

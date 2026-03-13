import { useState, useMemo, useCallback, useEffect, useRef, Fragment } from 'react'
import { useVault } from './VaultContext'
import { useAuth } from '../../context/AuthContext'
import { bountyService, vaultService } from '../../services/database'
import { GODS, CLASS_ROLE } from '../../data/vault/gods'
import { ITEMS } from '../../data/vault/items'
import { CONSUMABLES } from '../../data/vault/buffs'
import { MINIONS } from '../../data/vault/minions'
import TradingCard from '../../components/TradingCard'
import PackArt from './components/PackArt'
import { Loader2 } from 'lucide-react'
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

const RARITY_GLOW = {
  common: '20px',
  uncommon: '30px',
  rare: '45px',
  epic: '60px',
  legendary: '80px',
  mythic: '110px',
}

const RARITY_GLOW_ALPHA = {
  common: '0.25',
  uncommon: '0.35',
  rare: '0.45',
  epic: '0.55',
  legendary: '0.65',
  mythic: '0.8',
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))


// ─── Render a TradingCard from a brudih card object ─────

function renderCard(card, size) {
  const cd = card.cardData || {}
  return (
    <TradingCard
      playerName={cd.playerName || card.godName}
      teamName={cd.teamName || ''}
      teamColor={cd.teamColor || '#6366f1'}
      role={cd.role || card.role || 'ADC'}
      avatarUrl={cd.avatarUrl || card.imageUrl || ''}
      rarity={card.rarity}
      leagueName={cd.leagueName || ''}
      divisionName={cd.divisionName || ''}
      bestGod={card.bestGodName ? { name: card.bestGodName } : null}
      isConnected={card.isConnected}
      isFirstEdition={cd.isFirstEdition}
      size={size}
    />
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
  const [playerResults, setPlayerResults] = useState([])
  const [playerSearching, setPlayerSearching] = useState(false)
  const debounceRef = useRef(null)

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
    const minions = MINIONS.map(m => ({
      cardType: 'minion',
      godId: 'minion-' + m.type,
      godName: m.name,
      label: m.name,
      sublabel: m.type.charAt(0).toUpperCase() + m.type.slice(1) + ' Minion',
    }))
    return { gods, items, consumables, minions }
  }, [])

  // Debounced API search for players (same as bounty board)
  const searchPlayerDefs = useCallback((term) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!term || term.length < 2) {
      setPlayerResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setPlayerSearching(true)
      try {
        const res = await bountyService.searchPlayers(term)
        setPlayerResults((res.players || [])
          .filter(p => p.player_name !== 'Brudih')
          .map(p => ({
            cardType: 'player',
            godId: 'player-' + p.player_name,
            godName: p.player_name,
            label: p.player_name,
            sublabel: [p.role, p.team_name].filter(Boolean).join(' · ') || 'Player',
            avatarUrl: p.avatar_url || null,
            teamColor: p.team_color,
          })))
      } catch {
        setPlayerResults([])
      }
      setPlayerSearching(false)
    }, 250)
  }, [])

  const filtered = useMemo(() => {
    if (tab === 'players') return playerResults
    const list = catalog[tab] || []
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(item => item.label.toLowerCase().includes(q) || item.sublabel?.toLowerCase().includes(q))
  }, [catalog, tab, search, playerResults])

  const tabs = [
    { key: 'gods', label: 'Gods' },
    { key: 'players', label: 'Players' },
    { key: 'items', label: 'Items' },
    { key: 'consumables', label: 'Consumables' },
    { key: 'minions', label: 'Minions' },
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
    <div className="bm-mythic-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bm-mythic-modal">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
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
        <div className="flex gap-1 px-5 mb-3 flex-wrap">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSelected(null); setSearch(''); setPlayerResults([]) }}
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
        <div className="px-5 mb-3 relative">
          <input
            type="text"
            value={search}
            onChange={e => {
              setSearch(e.target.value)
              if (tab === 'players') searchPlayerDefs(e.target.value)
            }}
            placeholder={tab === 'players' ? 'Type a player name...' : 'Search...'}
            className="w-full px-3 py-2 rounded-lg text-sm bg-black/40 border border-[rgba(139,0,0,0.25)] text-white/80 placeholder-white/20 focus:border-[rgba(200,0,0,0.4)] focus:outline-none transition-colors"
          />
          {tab === 'players' && playerSearching && (
            <Loader2 size={14} className="absolute right-8 top-1/2 -translate-y-1/2 text-white/30 animate-spin" />
          )}
        </div>

        {/* Grid / Player list */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 min-h-0">
          {tab === 'players' ? (
            /* Autocomplete list for players */
            filtered.length === 0 ? (
              <div className="text-center py-8 text-white/20 text-sm">
                {playerSearching ? 'Searching...' : !search.trim() || search.length < 2 ? 'Type a player name to search' : 'No players found'}
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {filtered.map(item => (
                  <button
                    key={item.godId}
                    onClick={() => setSelected(item)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all cursor-pointer ${
                      selected?.godId === item.godId
                        ? 'bg-red-500/15 border border-red-500/30'
                        : 'border border-transparent hover:bg-white/5'
                    }`}
                  >
                    {item.avatarUrl ? (
                      <img src={item.avatarUrl} alt="" className="w-9 h-9 rounded-full shrink-0 object-cover border border-white/10" />
                    ) : (
                      <div
                        className="w-9 h-9 rounded-full shrink-0 border border-white/10 flex items-center justify-center text-xs font-bold"
                        style={{ background: item.teamColor || 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)' }}
                      >
                        {item.label.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white/80 truncate">{item.label}</div>
                      <div className="text-[11px] text-white/30 truncate">{item.sublabel}</div>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : (
            /* Standard grid for other tabs */
            filtered.length === 0 ? (
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
                    <div className="text-[11px] text-white/30 mt-0.5 truncate">{item.sublabel}</div>
                  </button>
                ))}
              </div>
            )
          )}
        </div>

        {/* Confirm bar */}
        {selected && (
          <div className="px-5 py-3 border-t border-[rgba(139,0,0,0.2)] bg-black/30 flex items-center justify-between gap-3 rounded-b-xl">
            <div className="flex items-center gap-2.5 min-w-0">
              {selected.avatarUrl && (
                <img src={selected.avatarUrl} alt="" className="w-8 h-8 rounded-full shrink-0 object-cover border border-white/10" />
              )}
              <div className="min-w-0">
                <div className="text-sm font-bold text-white/80 truncate">{selected.label}</div>
                <div className="text-[11px] text-white/30">{selected.sublabel} — Mythic</div>
              </div>
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
    </div>
  )
}


// ─── Main Component ──────────────────────────────────────

export default function CCBlackMarket() {
  const { collection, blackMarketTurnIn, blackMarketClaimMythic, stats, refreshCollection } = useVault()
  const { user, hasPermission } = useAuth()
  const isOwner = hasPermission('permission_manage')

  const [phase, setPhase] = useState('idle') // idle | turning-in | reward
  const [selectedCard, setSelectedCard] = useState(null)
  const [reward, setReward] = useState(null)
  const [error, setError] = useState(null)
  const [showMythicModal, setShowMythicModal] = useState(false)
  const [leagueFilter, setLeagueFilter] = useState('all')
  const [dragState, setDragState] = useState(null)
  const [slotHover, setSlotHover] = useState(false)

  const slotRef = useRef(null)
  const turnInRef = useRef(null)

  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 639px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const handler = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const brudihCards = useMemo(() =>
    collection.filter(c => c.cardType === 'player' && c.godName === 'Brudih'),
  [collection])

  const leagues = useMemo(() => {
    const set = new Set(brudihCards.map(c => c.cardData?.leagueName).filter(Boolean))
    return ['all', ...set]
  }, [brudihCards])

  const filteredCards = leagueFilter === 'all'
    ? brudihCards
    : brudihCards.filter(c => c.cardData?.leagueName === leagueFilter)

  const brudihsTurnedIn = stats?.brudihsTurnedIn || 0
  const pendingMythicClaim = stats?.pendingMythicClaim || 0

  // ── Turn in ──

  const handleTurnIn = useCallback(async (card) => {
    if (phase !== 'idle') return
    setSelectedCard(card)
    setError(null)
    setPhase('turning-in')
    try {
      const result = await blackMarketTurnIn(card.id)
      await sleep(600)
      setReward(result.reward)
      setPhase('reward')
    } catch (err) {
      setError(err.message || 'Turn-in failed')
      setPhase('idle')
      setSelectedCard(null)
    }
  }, [phase, blackMarketTurnIn])

  turnInRef.current = handleTurnIn

  // ── Collect ──

  const handleCollect = useCallback(() => {
    if (reward?.type === 'mythic_choice') {
      setShowMythicModal(true)
    } else {
      setPhase('idle')
      setSelectedCard(null)
      setReward(null)
      refreshCollection()
    }
  }, [reward, refreshCollection])

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

  // ── Pointer-based drag (desktop) ──

  const handlePointerDown = useCallback((e, card) => {
    if (phase !== 'idle' || isMobile) return
    e.preventDefault()
    setSelectedCard(card)
    setDragState({ card, x: e.clientX, y: e.clientY })
  }, [phase, isMobile])

  useEffect(() => {
    if (!dragState) return

    const onMove = (e) => {
      setDragState(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)
      if (slotRef.current) {
        const r = slotRef.current.getBoundingClientRect()
        setSlotHover(
          e.clientY < r.bottom + 60 &&
          e.clientX > r.left - 40 &&
          e.clientX < r.right + 40
        )
      }
    }

    const onUp = (e) => {
      let dropped = false
      if (slotRef.current && dragState.card) {
        const r = slotRef.current.getBoundingClientRect()
        if (
          e.clientY >= r.top - 50 && e.clientY <= r.bottom + 50 &&
          e.clientX >= r.left - 40 && e.clientX <= r.right + 40
        ) {
          dropped = true
          turnInRef.current?.(dragState.card)
        }
      }
      if (!dropped) {
        setSelectedCard(null)
      }
      setDragState(null)
      setSlotHover(false)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [dragState])

  // ── Drag ghost skew ──

  let dragStyle = {}
  if (dragState) {
    dragStyle = { left: dragState.x, top: dragState.y, transform: 'translate(-50%, -50%)' }
    if (slotRef.current) {
      const slotRect = slotRef.current.getBoundingClientRect()
      const slotY = slotRect.top + slotRect.height / 2
      const distance = Math.max(0, dragState.y - slotY)
      const maxDist = window.innerHeight * 0.4
      const progress = Math.max(0, Math.min(1, 1 - distance / maxDist))
      const rotateX = progress * 55
      const scaleX = 1 - progress * 0.3
      dragStyle.transform = `translate(-50%, -50%) perspective(600px) rotateX(${rotateX}deg) scaleX(${scaleX})`
    }
  }

  // ── Mobile tap ──

  const handleCardClick = useCallback((card) => {
    if (phase !== 'idle') return
    if (isMobile) {
      setSelectedCard(prev => prev?.id === card.id ? null : card)
    }
  }, [phase, isMobile])

  const handleMobileTurnIn = useCallback(() => {
    if (selectedCard && phase === 'idle') handleTurnIn(selectedCard)
  }, [selectedCard, phase, handleTurnIn])

  // ── Fan layout math ──

  const total = filteredCards.length
  const maxAngle = total <= 1 ? 0 : Math.min(35, Math.max(10, total * 4.5))
  const cardSize = isMobile
    ? (total > 8 ? 80 : 95)
    : (total > 10 ? 100 : total > 6 ? 115 : 130)

  // ── Reset helper ──

  const resetAll = () => {
    setPhase('idle')
    setSelectedCard(null)
    setReward(null)
    setError(null)
    setShowMythicModal(false)
    setDragState(null)
    setSlotHover(false)
  }

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
            Turn in Brudih player cards for league packs.
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

        {/* Pending mythic claim */}
        {pendingMythicClaim > 0 && phase === 'idle' && (
          <div className="mb-4 mx-auto max-w-md text-center">
            <button
              onClick={() => setShowMythicModal(true)}
              className="px-6 py-2 rounded-lg bg-red-900/30 border border-red-500/30 text-red-400 cd-head tracking-wider text-sm font-bold hover:bg-red-900/40 transition-colors cursor-pointer animate-pulse"
            >
              Claim Your Mythic Card
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 text-sm font-bold cd-head">
            {error}
            <button onClick={() => setError(null)} className="ml-3 text-white/30 hover:text-white/60 cursor-pointer">&times;</button>
          </div>
        )}

        {/* Debug panel (owner) */}
        {isOwner && (
          <div className="mb-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
            <div className="text-[10px] text-yellow-500/60 cd-head tracking-widest uppercase mb-2">Debug Controls</div>
            <div className="flex flex-wrap gap-1.5">
              {['idle', 'turning-in', 'reward'].map(p => (
                <button
                  key={p}
                  onClick={() => {
                    if (p === 'turning-in' || p === 'reward') {
                      setSelectedCard({ id: 'debug', rarity: 'rare', godName: 'Brudih', cardData: { leagueName: 'bsl' } })
                    }
                    if (p === 'reward') {
                      setReward({ type: 'packs', packType: 'bsl-mixed', count: 7 })
                    }
                    setPhase(p)
                  }}
                  className={`px-2 py-1 rounded text-[10px] font-bold cd-head tracking-wider border cursor-pointer transition-all ${
                    phase === p
                      ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400'
                      : 'border-yellow-500/10 text-yellow-500/40 hover:text-yellow-500/60'
                  }`}
                >
                  {p}
                </button>
              ))}
              <span className="w-px h-5 bg-yellow-500/10 self-center mx-1" />
              {['common', 'uncommon', 'rare', 'epic', 'legendary'].map(r => (
                <button
                  key={r}
                  onClick={async () => {
                    const fakeCard = { id: 'debug', rarity: r, godName: 'Brudih', cardData: { leagueName: 'bsl' } }
                    setSelectedCard(fakeCard)
                    setError(null)
                    setPhase('turning-in')
                    await sleep(600)
                    setReward({ type: 'packs', packType: 'bsl-mixed', count: REWARD_TIERS[r] })
                    setPhase('reward')
                  }}
                  className="px-2 py-1 rounded text-[10px] font-bold cd-head tracking-wider border border-yellow-500/10 cursor-pointer transition-all"
                  style={{ color: RARITY_COLORS[r] }}
                >
                  {r}
                </button>
              ))}
              <button
                onClick={async () => {
                  const fakeCard = { id: 'debug', rarity: 'mythic', godName: 'Brudih', cardData: { leagueName: 'bsl' } }
                  setSelectedCard(fakeCard)
                  setError(null)
                  setPhase('turning-in')
                  await vaultService.blackMarketDebugPending()
                  await refreshCollection()
                  await sleep(600)
                  setReward({ type: 'mythic_choice' })
                  setPhase('reward')
                }}
                className="px-2 py-1 rounded text-[10px] font-bold cd-head tracking-wider border border-yellow-500/10 cursor-pointer transition-all"
                style={{ color: RARITY_COLORS.mythic }}
              >
                mythic
              </button>
              <span className="w-px h-5 bg-yellow-500/10 self-center mx-1" />
              <button
                onClick={async () => {
                  await vaultService.blackMarketDebugPending()
                  await refreshCollection()
                  setShowMythicModal(true)
                }}
                className="px-2 py-1 rounded text-[10px] font-bold cd-head tracking-wider border border-yellow-500/10 text-yellow-500/40 hover:text-yellow-500/60 cursor-pointer transition-all"
              >
                modal
              </button>
              <button
                onClick={resetAll}
                className="px-2 py-1 rounded text-[10px] font-bold cd-head tracking-wider border border-yellow-500/10 text-yellow-500/40 hover:text-yellow-500/60 cursor-pointer transition-all"
              >
                reset
              </button>
            </div>
            <div className="text-[10px] text-yellow-500/30 mt-1.5">Phase: <span className="text-yellow-500/50">{phase}</span></div>
          </div>
        )}

        {/* ═══ INSERT SLOT ═══ */}
        <div className="bm-slot-section mb-8">
          <div className="text-[10px] text-white cd-head tracking-[0.25em] uppercase text-center mb-2">Insert</div>
          <div
            ref={slotRef}
            className={`bm-slot ${slotHover ? 'bm-slot-hover' : ''} ${phase === 'turning-in' ? 'bm-slot-processing' : ''}`}
            style={slotHover && selectedCard ? {
              '--glow-size': RARITY_GLOW[selectedCard.rarity] || '30px',
              '--glow-alpha': RARITY_GLOW_ALPHA[selectedCard.rarity] || '0.4',
            } : undefined}
          >
            {phase === 'turning-in' && <div className="bm-slot-shimmer" />}
          </div>

          {/* Reward preview under slot — fixed height to prevent layout jump */}
          <div className="text-center mt-2 h-4">
            {selectedCard && (phase === 'idle' || dragState) && (
              <div className="text-[10px] text-white/20 cd-head tracking-wider">
                {selectedCard.rarity === 'mythic'
                  ? 'Mythic card of your choice'
                  : `${REWARD_TIERS[selectedCard.rarity]} ${(selectedCard.cardData?.leagueName || '').toUpperCase()} Packs`}
              </div>
            )}
          </div>

          {/* Mobile turn-in button */}
          {isMobile && selectedCard && phase === 'idle' && (
            <div className="text-center mt-3">
              <button onClick={handleMobileTurnIn} className="bm-turn-in-btn cd-head">
                Turn In
              </button>
            </div>
          )}
        </div>

        {/* ═══ CARD FAN ═══ */}
        {phase !== 'reward' && (
          <>
            {/* League filter */}
            {leagues.length > 2 && (
              <div className="flex gap-1.5 mb-3 flex-wrap justify-center">
                {leagues.map(league => (
                  <button
                    key={league}
                    onClick={() => setLeagueFilter(league)}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold cd-head tracking-wider uppercase transition-all cursor-pointer ${
                      leagueFilter === league
                        ? 'bg-red-500/15 border border-red-500/30 text-red-400'
                        : 'border border-transparent text-white/25 hover:text-white/40'
                    }`}
                  >
                    {league === 'all' ? 'All' : league}
                  </button>
                ))}
              </div>
            )}

            {filteredCards.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-white/15 text-4xl mb-3">&#9760;</div>
                <p className="text-sm font-bold cd-head text-white/25 tracking-wider">No Brudih Cards</p>
                <p className="text-xs text-white/15 mt-1">Find Brudih player cards in packs to trade here.</p>
              </div>
            ) : (
              <div className="bm-fan" style={{ height: isMobile ? 260 : 380 }}>
                {filteredCards.map((card, i) => {
                  const t = total <= 1 ? 0 : (i - (total - 1) / 2) / Math.max(1, (total - 1) / 2)
                  const angle = t * maxAngle
                  const isDragging = dragState?.card.id === card.id
                  const isSelected = selectedCard?.id === card.id && isMobile

                  return (
                    <div
                      key={card.id}
                      className={`bm-fan-card ${isDragging ? 'bm-fan-card-ghost' : ''} ${isSelected ? 'bm-fan-card-selected' : ''}`}
                      style={{
                        '--angle': `${angle}deg`,
                        zIndex: isDragging ? 0 : (isSelected ? 100 : 50 - Math.abs(Math.round(t * 50))),
                      }}
                      onPointerDown={(e) => handlePointerDown(e, card)}
                      onClick={() => handleCardClick(card)}
                    >
                      {renderCard(card, cardSize)}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ═══ OUTPUT SECTION (reward) ═══ */}
        {phase === 'reward' && reward && (
          <div className="bm-output bm-panel rounded-xl p-6 text-center max-w-md mx-auto">
            {reward.type === 'packs' && (
              <div className="flex flex-col items-center gap-3">
                <div className="flex justify-center" style={{ transform: 'translateX(-24px)' }}>
                  {[...Array(Math.min(reward.count, 7))].map((_, i) => (
                    <div key={i} className="bm-reward-pack-card" style={{ marginLeft: i === 0 ? 0 : -20 }}>
                      <PackArt
                        tier={reward.packType || 'mixed'}
                        name=""
                        subtitle=""
                        cardCount={6}
                        seed={i}
                        compact
                      />
                    </div>
                  ))}
                </div>
                <div className="text-2xl font-bold cd-num text-red-400">+{reward.count}</div>
                <div className="text-xs text-white/40 cd-head tracking-wider">
                  {reward.packType?.replace('-mixed', '').toUpperCase()} Packs
                </div>
              </div>
            )}

            {reward.type === 'mythic_choice' && (
              <div className="flex flex-col items-center gap-2">
                <div className="bm-mythic-reward-glow">
                  <div className="text-5xl">&#9733;</div>
                </div>
                <div className="text-lg font-bold cd-head text-red-400 tracking-wider">Mythic Choice</div>
                <div className="text-xs text-white/30">Choose any mythic card from the catalog</div>
              </div>
            )}

            <button onClick={handleCollect} className="bm-collect-btn cd-head mt-4">
              {reward.type === 'mythic_choice' ? 'Choose Your Mythic' : 'Collect'}
            </button>
          </div>
        )}

        {/* ═══ EXCHANGE RATES ═══ */}
        <div className="mt-8">
          <ExchangeRates />
        </div>
      </div>

      {/* Floating drag ghost */}
      {dragState && (
        <div className="bm-drag-ghost" style={dragStyle}>
          {renderCard(dragState.card, 90)}
        </div>
      )}

      {/* Mythic modal */}
      {showMythicModal && (
        <MythicSelectionModal
          onSelect={handleMythicSelect}
          onClose={() => {
            setShowMythicModal(false)
            setPhase('idle')
            setSelectedCard(null)
            setReward(null)
          }}
        />
      )}
    </div>
  )
}

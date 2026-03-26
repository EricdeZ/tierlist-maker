import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { usePassion } from '../../context/PassionContext'
import { useVault } from './VaultContext'
import { tradingService } from '../../services/database'
import { RARITIES } from '../../data/vault/economy'
import CardEffectDisplay from './components/CardEffectDisplay'
import { GODS } from '../../data/vault/gods'
import { ITEMS } from '../../data/vault/items'
import { CONSUMABLES } from '../../data/vault/buffs'
import GameCard from './components/GameCard'
import VaultCard from './components/VaultCard'
import TradingCard from '../../components/TradingCard'
import PackArt from './components/PackArt'
import CardZoomModal from './components/CardZoomModal'
import emberIcon from '../../assets/ember.png'
import { Search, X, Handshake, Loader2, Check, Plus, History, ChevronLeft, ChevronRight, Filter, Wifi, WifiOff, Timer, ArrowLeftRight, Package, RefreshCw } from 'lucide-react'

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'unique']
const TYPE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'god', label: 'Gods' },
  { key: 'player', label: 'Players' },
  { key: 'item', label: 'Items' },
  { key: 'consumable', label: 'Consumables' },
]

const GOD_MAP = new Map(GODS.map(g => [g.slug, g]))
const ITEM_MAP = new Map(ITEMS.map(i => [String(i.id), i]))
const CONSUMABLE_MAP = new Map(CONSUMABLES.map(c => [c.id, c]))
const DATA_MAPS = { god: GOD_MAP, item: ITEM_MAP, consumable: CONSUMABLE_MAP }


function CoreLabel({ value, size = 'sm', className = '' }) {
  const sizes = { xs: 'h-3', sm: 'h-3.5', md: 'h-4', lg: 'h-5' }
  const textSizes = { xs: 'text-[10px]', sm: 'text-xs', md: 'text-sm', lg: 'text-base' }
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <img src={emberIcon} alt="" className={`${sizes[size]} w-auto object-contain`} />
      <span className={`cd-num ${textSizes[size]} text-orange-400`}>{value}</span>
    </span>
  )
}

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 640)
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 640)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return mobile
}

export default function CCTrading() {
  const { user } = useAuth()
  const passionCtx = usePassion()
  const { collection, pendingTradeCount, setPendingTradeCount, startingFive, binderCards, refreshCollection, inventory, lockedPackIds } = useVault()

  const lockedCardIds = useMemo(() => {
    const ids = new Set()
    for (const lineup of [startingFive?.currentSeason, startingFive?.allStar]) {
      if (!lineup?.slots) continue
      for (const slot of Object.values(lineup.slots)) {
        if (slot.card?.id) ids.add(slot.card.id)
        if (slot.godCard?.id) ids.add(slot.godCard.id)
        if (slot.itemCard?.id) ids.add(slot.itemCard.id)
      }
    }
    for (const bc of (binderCards || [])) {
      if (bc.card?.id) ids.add(bc.card.id)
    }
    return ids
  }, [startingFive, binderCards])

  const [searchParams, setSearchParams] = useSearchParams()
  const view = searchParams.get('subtab') || 'inbox'
  const setView = useCallback((key) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (key === 'inbox') next.delete('subtab'); else next.set('subtab', key)
      return next
    })
  }, [setSearchParams])
  const [pending, setPending] = useState([])
  const [historyTrades, setHistoryTrades] = useState([])
  const [activeTrade, setActiveTrade] = useState(() => {
    const tid = new URLSearchParams(window.location.search).get('tradeId')
    return tid ? parseInt(tid) : null
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchModal, setSearchModal] = useState(false)

  // Invite polling state
  const [invitePolling, setInvitePolling] = useState(null)
  const invitePollRef = useRef(null)
  const invitePollingRef = useRef(invitePolling)
  invitePollingRef.current = invitePolling
  const passionCtxRef = useRef(passionCtx)
  passionCtxRef.current = passionCtx

  const fetchPending = useCallback(async () => {
    try {
      const data = await tradingService.pending()
      setPending(data.trades || [])
      const active = (data.trades || []).find(t => t.status === 'active')
      if (active) {
        setActiveTrade(active.id)
        setView('room')
        if (invitePollingRef.current) {
          clearInterval(invitePollRef.current)
          setInvitePolling(null)
        }
      }
    } catch (err) {
      console.error('Failed to fetch pending trades:', err)
    }
  }, [setView])

  const fetchHistory = useCallback(async () => {
    try {
      const data = await tradingService.history()
      setHistoryTrades(data.trades || [])
    } catch (err) {
      console.error('Failed to fetch trade history:', err)
    }
  }, [])

  useEffect(() => { fetchPending() }, [fetchPending])

  useEffect(() => {
    if (view === 'history') fetchHistory()
  }, [view, fetchHistory])

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(''), 4000)
      return () => clearTimeout(t)
    }
  }, [success])

  // Invite polling
  useEffect(() => {
    if (!invitePolling) return
    const { startTime, tradeId } = invitePolling

    invitePollRef.current = setInterval(async () => {
      const elapsed = Date.now() - startTime
      if (elapsed >= 45000) {
        clearInterval(invitePollRef.current)
        setInvitePolling(null)
        try { await tradingService.cancel(tradeId) } catch {}
        fetchPending()
        return
      }
      await fetchPending()
    }, 2000)

    return () => clearInterval(invitePollRef.current)
  }, [invitePolling, fetchPending])

  const handleCreate = async (targetUserId) => {
    setError('')
    try {
      const result = await tradingService.create(targetUserId)
      setSearchModal(false)
      setSuccess('Trade invite sent!')
      await fetchPending()
      if (result?.trade?.id) {
        setInvitePolling({ tradeId: result.trade.id, startTime: Date.now() })
      }
    } catch (err) {
      setError(err.message)
    }
  }

  const handleJoin = async (tradeId) => {
    setError('')
    try {
      await tradingService.join(tradeId)
      setActiveTrade(tradeId)
      setView('room')
    } catch (err) {
      setError(err.message)
    }
  }

  const handleTradeEnd = useCallback(() => {
    setActiveTrade(null)
    setView('inbox')
    fetchPending()
    refreshCollection()
    passionCtxRef.current?.refreshBalance?.()
    setPendingTradeCount?.(0)
  }, [setView, fetchPending, refreshCollection, setPendingTradeCount])

  const inviteTimeLeft = invitePolling
    ? Math.max(0, 45 - Math.floor((Date.now() - invitePolling.startTime) / 1000))
    : 0

  return (
    <div className="pb-12">
      {(error || success) && (
        <div className={`mb-4 px-4 py-2 rounded text-sm font-medium ${
          error ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
        }`}>
          {error || success}
          <button onClick={() => { setError(''); setSuccess('') }} className="ml-2 opacity-50 hover:opacity-100">
            <X className="w-3 h-3 inline" />
          </button>
        </div>
      )}

      {view !== 'room' && (
        <div className="flex items-center gap-2 sm:gap-4 mb-6 flex-wrap">
          <button
            onClick={() => setView('inbox')}
            className={`cd-head flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold uppercase tracking-wider transition-all cursor-pointer border ${
              view === 'inbox'
                ? 'bg-[var(--cd-cyan)]/10 text-[var(--cd-cyan)] border-[var(--cd-cyan)]/30'
                : 'text-white/40 border-white/10 hover:text-white/60'
            }`}
          >
            <Handshake className="w-4 h-4" />
            Trades
            {pending.filter(t => t.status === 'waiting' && !t.isInitiator).length > 0 && (
              <span className="w-2 h-2 rounded-full bg-[var(--cd-magenta)] animate-pulse" />
            )}
          </button>
          <button
            onClick={() => setView('history')}
            className={`cd-head flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold uppercase tracking-wider transition-all cursor-pointer border ${
              view === 'history'
                ? 'bg-[var(--cd-cyan)]/10 text-[var(--cd-cyan)] border-[var(--cd-cyan)]/30'
                : 'text-white/40 border-white/10 hover:text-white/60'
            }`}
          >
            <History className="w-4 h-4" />
            History
          </button>
          <button
            onClick={() => setSearchModal(true)}
            className="cd-head flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold uppercase tracking-wider transition-all cursor-pointer border bg-[var(--cd-magenta)]/10 text-[var(--cd-magenta)] border-[var(--cd-magenta)]/30 hover:bg-[var(--cd-magenta)]/20"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Start </span>Trade
          </button>
          <button
            onClick={fetchPending}
            className="cd-head p-2 text-white/30 hover:text-white/60 border border-white/10 hover:border-white/20 transition-all cursor-pointer rounded"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )}

      {view === 'inbox' && (
        <InboxView
          trades={pending}
          onJoin={handleJoin}
          onCancel={async (id) => {
            try {
              await tradingService.cancel(id)
              if (invitePolling?.tradeId === id) {
                clearInterval(invitePollRef.current)
                setInvitePolling(null)
              }
              fetchPending()
            } catch (err) { setError(err.message) }
          }}
          onEnterRoom={(id) => { setActiveTrade(id); setView('room') }}
          invitePolling={invitePolling}
          inviteTimeLeft={inviteTimeLeft}
        />
      )}

      {view === 'history' && <HistoryView trades={historyTrades} />}

      {view === 'room' && activeTrade && (
        <TradeRoom
          tradeId={activeTrade}
          collection={collection}
          userId={user?.id}
          coreBalance={passionCtx?.ember?.balance ?? 0}
          onEnd={handleTradeEnd}
          setError={setError}
          setSuccess={setSuccess}
          lockedCardIds={lockedCardIds}
          inventory={inventory}
          lockedPackIds={lockedPackIds}
        />
      )}

      {searchModal && (
        <UserSearchModal
          onClose={() => setSearchModal(false)}
          onSelect={handleCreate}
          currentUserId={user?.id}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════
// Inbox View
// ═══════════════════════════════════════
function InboxView({ trades, onJoin, onCancel, onEnterRoom, invitePolling, inviteTimeLeft }) {
  const invites = trades.filter(t => t.status === 'waiting' && !t.isInitiator)
  const sent = trades.filter(t => t.status === 'waiting' && t.isInitiator)
  const active = trades.filter(t => t.status === 'active')

  const [, setTick] = useState(0)
  useEffect(() => {
    if (!invitePolling) return
    const iv = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(iv)
  }, [invitePolling])

  if (trades.length === 0 && !invitePolling) {
    return (
      <div className="text-center py-20 text-white/30">
        <Handshake className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="cd-head text-lg">No active trades</p>
        <p className="text-sm mt-1">Start a trade with another player</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {active.length > 0 && (
        <div>
          <h3 className="cd-head text-sm text-emerald-400 mb-3 tracking-wider">Active Trade</h3>
          {active.map(t => (
            <TradeRow key={t.id} trade={t} action="Enter" onAction={() => onEnterRoom(t.id)} />
          ))}
        </div>
      )}

      {invites.length > 0 && (
        <div>
          <h3 className="cd-head text-sm text-[var(--cd-magenta)] mb-3 tracking-wider">Incoming Invites</h3>
          {invites.map(t => (
            <TradeRow key={t.id} trade={t} action="Join" onAction={() => onJoin(t.id)} onCancel={() => onCancel(t.id)} />
          ))}
        </div>
      )}

      {sent.length > 0 && (
        <div>
          <h3 className="cd-head text-sm text-white/40 mb-3 tracking-wider">Sent Invites</h3>
          {sent.map(t => (
            <TradeRow
              key={t.id}
              trade={t}
              action={invitePolling?.tradeId === t.id ? null : 'Waiting...'}
              actionDisabled
              onCancel={() => onCancel(t.id)}
              countdown={invitePolling?.tradeId === t.id ? inviteTimeLeft : null}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TradeRow({ trade, action, actionDisabled, onAction, onCancel, countdown }) {
  return (
    <div className="flex items-center gap-3 sm:gap-4 bg-[var(--cd-surface)] border border-[var(--cd-border)] rounded-lg p-3 sm:p-4 mb-2">
      {trade.partnerAvatar && (
        <img src={trade.partnerAvatar} alt="" className="w-8 h-8 rounded-full shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-white truncate">{trade.partnerName}</div>
        <div className="text-[10px] text-white/30">
          {new Date(trade.createdAt).toLocaleString()}
        </div>
      </div>

      {countdown !== null && countdown !== undefined && (
        <div className="flex items-center gap-1.5 shrink-0">
          <Timer className="w-3.5 h-3.5 text-[var(--cd-cyan)] animate-pulse" />
          <div className="relative w-8 h-8">
            <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/5" />
              <circle
                cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="2"
                className="text-[var(--cd-cyan)]"
                strokeDasharray={`${(countdown / 45) * 87.96} 87.96`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 1s linear' }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[9px] cd-num text-[var(--cd-cyan)]">
              {countdown}
            </span>
          </div>
        </div>
      )}

      {onAction && action && (
        <button
          onClick={onAction}
          disabled={actionDisabled}
          className="cd-head text-[10px] sm:text-xs font-bold uppercase tracking-wider px-3 sm:px-4 py-2 rounded
            bg-[var(--cd-cyan)]/10 text-[var(--cd-cyan)] border border-[var(--cd-cyan)]/30
            hover:bg-[var(--cd-cyan)]/20 transition-all cursor-pointer
            disabled:opacity-50 disabled:cursor-default shrink-0"
        >
          {action}
        </button>
      )}
      {onCancel && (
        <button
          onClick={onCancel}
          className="cd-head text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2.5 sm:px-3 py-2 rounded
            text-red-400/60 border border-red-500/20 hover:bg-red-500/10 transition-all cursor-pointer shrink-0"
        >
          <X className="w-3.5 h-3.5 sm:hidden" />
          <span className="hidden sm:inline">Cancel</span>
        </button>
      )}
    </div>
  )
}

// ═══════════════════════════════════════
// History View
// ═══════════════════════════════════════
function HistoryView({ trades }) {
  if (trades.length === 0) {
    return (
      <div className="text-center py-20 text-white/30">
        <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="cd-head text-lg">No trade history</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {trades.map(t => (
        <div key={t.id} className="flex items-center gap-4 bg-[var(--cd-surface)] border border-[var(--cd-border)] rounded-lg p-4 opacity-60">
          {t.partnerAvatar && (
            <img src={t.partnerAvatar} alt="" className="w-8 h-8 rounded-full" />
          )}
          <div className="flex-1">
            <div className="text-sm font-bold text-white">{t.partnerName}</div>
            <div className="text-[10px] text-white/30">
              {new Date(t.completedAt || t.createdAt).toLocaleString()}
            </div>
          </div>
          <span className={`cd-head text-[10px] uppercase tracking-wider ${
            t.status === 'completed' ? 'text-emerald-400' : 'text-white/30'
          }`}>
            {t.status}
          </span>
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════
// User Search Modal
// ═══════════════════════════════════════
function UserSearchModal({ onClose, onSelect, currentUserId }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const debounceRef = useRef(null)

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      setSearchError('')
      try {
        const data = await tradingService.searchUsers(query)
        setResults((data.users || []).filter(u => u.id !== currentUserId))
      } catch (err) {
        setSearchError(err.message)
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query, currentUserId])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--cd-surface)] border border-[var(--cd-border)] sm:rounded-xl rounded-t-xl p-5 sm:p-6 max-w-sm w-full sm:mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="cd-head text-lg text-[var(--cd-magenta)] tracking-wider mb-4">Start Trade</h3>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by username..."
            className="w-full bg-[var(--cd-edge)] border border-[var(--cd-border)] text-white text-sm pl-9 pr-3 py-2.5 rounded placeholder-white/20 focus:outline-none focus:border-[var(--cd-cyan)]/50"
            autoFocus
          />
        </div>

        {searchError && <div className="text-sm text-red-400 mb-3">{searchError}</div>}

        <div className="max-h-60 overflow-y-auto space-y-1">
          {searching ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 text-[var(--cd-cyan)] animate-spin" />
            </div>
          ) : results.length > 0 ? (
            results.map(u => (
              <button
                key={u.id}
                onClick={() => onSelect(u.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded hover:bg-[var(--cd-edge)] transition-all cursor-pointer text-left active:bg-[var(--cd-edge)]"
              >
                {u.discord_avatar && u.discord_id ? (
                  <img
                    src={`https://cdn.discordapp.com/avatars/${u.discord_id}/${u.discord_avatar}.webp?size=32`}
                    alt="" className="w-7 h-7 rounded-full"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-white/10" />
                )}
                <span className="text-sm text-white">{u.discord_username}</span>
              </button>
            ))
          ) : query.length >= 2 && !searching ? (
            <div className="text-center py-4 text-white/30 text-sm">No users found</div>
          ) : null}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full text-sm font-bold uppercase py-2.5 rounded border border-white/10 text-white/40 hover:text-white/60 active:bg-white/5 transition-all cursor-pointer cd-head"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
// Trade Room
// ═══════════════════════════════════════
function TradeRoom({ tradeId, collection, userId, coreBalance, onEnd, setError, setSuccess, lockedCardIds, inventory, lockedPackIds }) {
  const { getDefOverride } = useVault()
  const isMobile = useIsMobile()
  const [trade, setTrade] = useState(null)
  const [tradeCards, setTradeCards] = useState([])
  const [tradePacks, setTradePacks] = useState([])
  const [actionLoading, setActionLoading] = useState(false)
  const [coreInput, setCoreInput] = useState('')
  const [connected, setConnected] = useState(true)
  const [lastPollTime, setLastPollTime] = useState(null)
  const [zoomedCard, setZoomedCard] = useState(null)
  const pollRef = useRef(null)
  const pollCountRef = useRef(0)

  // Mobile: tabbed offer panels
  const [mobileOfferTab, setMobileOfferTab] = useState('mine') // 'mine' | 'theirs'
  // Mobile: bottom sheet collection picker
  const [pickerOpen, setPickerOpen] = useState(false)
  const [packPickerOpen, setPackPickerOpen] = useState(false)

  // Collection filters
  const [searchQuery, setSearchQuery] = useState('')
  const [rarityFilter, setRarityFilter] = useState(null)
  const [typeFilter, setTypeFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(true)

  const poll = useCallback(async () => {
    try {
      const data = await tradingService.poll(tradeId)
      setTrade(data.trade)
      setTradeCards(data.cards || [])
      setTradePacks(data.packs || [])
      setConnected(true)
      setLastPollTime(Date.now())
      pollCountRef.current++

      if (['completed', 'cancelled', 'expired'].includes(data.trade.status)) {
        if (data.trade.status === 'completed') setSuccess('Trade completed!')
        else if (data.trade.status === 'cancelled') setError('Trade was cancelled')
        else if (data.trade.status === 'expired') setError('Trade expired')
        clearInterval(pollRef.current)
        setTimeout(onEnd, 2000)
      }
    } catch (err) {
      console.error('Poll error:', err)
      setConnected(false)
    }
  }, [tradeId, onEnd, setError, setSuccess])

  useEffect(() => {
    poll()
    pollRef.current = setInterval(() => {
      pollCountRef.current++
      if (pollCountRef.current > 5 && pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = setInterval(poll, 3000)
      }
      poll()
    }, 1500)
    return () => clearInterval(pollRef.current)
  }, [poll])

  const myCards = useMemo(() =>
    tradeCards.filter(tc => tc.offeredBy === userId),
  [tradeCards, userId])

  const theirCards = useMemo(() =>
    tradeCards.filter(tc => tc.offeredBy !== userId),
  [tradeCards, userId])

  const myCardIds = useMemo(() =>
    new Set(myCards.map(tc => tc.cardId)),
  [myCards])

  const myPacks = useMemo(() =>
    tradePacks.filter(tp => tp.offeredBy === userId),
  [tradePacks, userId])

  const theirPacks = useMemo(() =>
    tradePacks.filter(tp => tp.offeredBy !== userId),
  [tradePacks, userId])

  const availablePacks = useMemo(() => {
    const lockedSet = new Set(lockedPackIds || [])
    const inTradeSet = new Set(myPacks.map(p => p.packInventoryId))
    return (inventory || []).filter(p => !lockedSet.has(p.id) && !inTradeSet.has(p.id))
  }, [inventory, lockedPackIds, myPacks])

  const availableCards = useMemo(() => {
    let cards = collection.filter(c => !myCardIds.has(c.id) && !lockedCardIds.has(c.id))

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      cards = cards.filter(c =>
        (c.godName || '').toLowerCase().includes(q) ||
        (c.rarity || '').toLowerCase().includes(q) ||
        (c.cardType || '').toLowerCase().includes(q)
      )
    }

    if (rarityFilter) {
      cards = cards.filter(c => c.rarity === rarityFilter)
    }

    if (typeFilter !== 'all') {
      cards = cards.filter(c => (c.cardType || 'god') === typeFilter)
    }

    return cards
  }, [collection, myCardIds, lockedCardIds, searchQuery, rarityFilter, typeFilter])

  const handleAddCard = async (cardId) => {
    setActionLoading(true)
    try {
      await tradingService.addCard(tradeId, cardId)
      await poll()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleRemoveCard = async (cardId) => {
    setActionLoading(true)
    try {
      await tradingService.removeCard(tradeId, cardId)
      await poll()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleAddPack = async (packInventoryId) => {
    setActionLoading(true)
    try {
      await tradingService.addPack(tradeId, packInventoryId)
      await poll()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleRemovePack = async (packInventoryId) => {
    setActionLoading(true)
    try {
      await tradingService.removePack(tradeId, packInventoryId)
      await poll()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleSetCore = async () => {
    const amount = parseInt(coreInput) || 0
    setActionLoading(true)
    try {
      await tradingService.setCore(tradeId, amount)
      await poll()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleReady = async () => {
    setActionLoading(true)
    try {
      await tradingService.ready(tradeId)
      await poll()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleConfirm = async () => {
    setActionLoading(true)
    try {
      const result = await tradingService.confirm(tradeId)
      if (result.status === 'completed') {
        setSuccess('Trade completed!')
        clearInterval(pollRef.current)
        setTimeout(onEnd, 2000)
      } else {
        await poll()
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancel = async () => {
    try {
      await tradingService.cancel(tradeId)
      onEnd()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleZoomCard = (card) => {
    if (!card) return
    if (card.blueprintId) {
      setZoomedCard({ collectionCard: card, holoType: card.holoType })
      return
    }
    if (card.cardType === 'player' && card.defId) {
      const cd = typeof card.cardData === 'string' ? JSON.parse(card.cardData) : card.cardData
      setZoomedCard({
        playerCard: {
          defId: card.defId,
          playerName: cd?.playerName || card.godName,
          teamName: cd?.teamName,
          teamColor: cd?.teamColor,
          role: card.role || cd?.role,
          avatarUrl: cd?.avatarUrl || card.imageUrl || '',
          rarity: card.rarity,
          leagueName: cd?.leagueName,
          divisionName: cd?.divisionName,
          seasonName: cd?.seasonName,
          isConnected: card.isConnected,
          isFirstEdition: card.isFirstEdition,
          bestGod: card.bestGodName ? { name: card.bestGodName } : null,
        },
        holoType: card.holoType,
      })
    } else {
      const dataMap = DATA_MAPS[card.cardType]
      const key = card.godId?.replace(/^(item|consumable)-/, '') || card.godId
      const rawData = dataMap?.get(key)
      const override = getDefOverride(card)
      const data = rawData && override
        ? { ...rawData, metadata: override, imageUrl: override.custom_image_url || rawData.imageUrl }
        : rawData
      setZoomedCard({
        gameCard: {
          type: card.cardType,
          identifier: card.godId,
          rarity: card.rarity,
          data: data || { name: card.godName, slug: card.godId },
        },
        holoType: card.holoType,
      })
    }
  }

  if (!trade) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-[var(--cd-cyan)] animate-spin" />
      </div>
    )
  }

  const bothReady = trade.myReady && trade.theirReady
  const canConfirm = bothReady && !trade.myConfirmed
  const hasCoreOffer = (trade.myCore > 0) || (trade.theirCore > 0)

  // ─── Mobile Trade Room ───
  if (isMobile) {
    return (
      <div className="pb-24 trade-room-active">
        {/* Mobile header */}
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {trade.partnerAvatar && (
              <img src={trade.partnerAvatar} alt="" className="w-7 h-7 rounded-full shrink-0" />
            )}
            <div className="min-w-0">
              <span className="text-[10px] text-white/40 cd-head tracking-wider">with </span>
              <span className="text-xs font-bold text-white truncate">{trade.partnerName}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className={`${connected ? 'text-emerald-400/60' : 'text-red-400/60'}`}>
              {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            </div>
            <button
              onClick={handleCancel}
              className="cd-head text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded
                text-red-400 border border-red-500/30 active:bg-red-500/10 transition-all cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Mobile status bar */}
        <div className="flex items-center justify-center gap-3 mb-3 py-1.5 px-3 rounded-lg bg-[var(--cd-edge)] border border-[var(--cd-border)]">
          <StatusBadge label="You" ready={trade.myReady} confirmed={trade.myConfirmed} />
          <ArrowLeftRight className="w-3.5 h-3.5 text-white/20" />
          <StatusBadge label={trade.partnerName?.split('#')[0] || 'Partner'} ready={trade.theirReady} confirmed={trade.theirConfirmed} />
        </div>

        {/* Mobile tabbed offer panels */}
        <div className="flex gap-1 mb-2">
          <button
            onClick={() => setMobileOfferTab('mine')}
            className={`flex-1 cd-head text-[10px] font-bold uppercase tracking-wider py-2 rounded-t-lg border-b-2 transition-all cursor-pointer ${
              mobileOfferTab === 'mine'
                ? 'text-[var(--cd-cyan)] border-[var(--cd-cyan)] bg-[var(--cd-surface)]'
                : 'text-white/30 border-transparent'
            }`}
          >
            Your Offer ({myCards.length + myPacks.length})
            {trade.myReady && <Check className="w-3 h-3 inline ml-1 text-emerald-400" />}
          </button>
          <button
            onClick={() => setMobileOfferTab('theirs')}
            className={`flex-1 cd-head text-[10px] font-bold uppercase tracking-wider py-2 rounded-t-lg border-b-2 transition-all cursor-pointer ${
              mobileOfferTab === 'theirs'
                ? 'text-[var(--cd-magenta)] border-[var(--cd-magenta)] bg-[var(--cd-surface)]'
                : 'text-white/30 border-transparent'
            }`}
          >
            Their Offer ({theirCards.length + theirPacks.length})
            {trade.theirReady && <Check className="w-3 h-3 inline ml-1 text-emerald-400" />}
          </button>
        </div>

        {/* Single active panel */}
        <div className="bg-[var(--cd-surface)] border border-[var(--cd-border)] rounded-lg p-3 mb-3" style={{ minHeight: 160 }}>
          {mobileOfferTab === 'mine' ? (
            <>
              <MobileCardSlideshow
                cards={myCards}
                onRemoveCard={handleRemoveCard}
                onZoomCard={handleZoomCard}
                canRemove={!trade.myReady && !actionLoading}
                emptyText={myPacks.length === 0 ? 'Tap + below to add cards or packs' : undefined}
              />
              {myPacks.length > 0 && (
                <div className="mt-2 pt-2 border-t border-[var(--cd-border)]">
                  <div className="text-[9px] text-white/30 cd-head uppercase tracking-wider mb-1.5">Packs</div>
                  <div className="flex gap-2 overflow-x-auto pb-1 cd-scrollbar-hide">
                    {myPacks.map(tp => (
                      <div key={tp.id} className="relative shrink-0" style={{ width: 80 }}>
                        <PackArt tier={tp.pack.packTypeId} name={tp.pack.name} cardCount={tp.pack.cardsPerPack} color={tp.pack.color} seed={tp.packInventoryId} compact />
                        {!trade.myReady && !actionLoading && (
                          <button
                            onClick={() => handleRemovePack(tp.packInventoryId)}
                            className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center cursor-pointer z-10 shadow-lg"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <MobileCardSlideshow
                cards={theirCards}
                onZoomCard={handleZoomCard}
                emptyText={theirPacks.length === 0 ? "Partner hasn't added items yet" : undefined}
              />
              {theirPacks.length > 0 && (
                <div className="mt-2 pt-2 border-t border-[var(--cd-border)]">
                  <div className="text-[9px] text-white/30 cd-head uppercase tracking-wider mb-1.5">Packs</div>
                  <div className="flex gap-2 overflow-x-auto pb-1 cd-scrollbar-hide">
                    {theirPacks.map(tp => (
                      <div key={tp.id} className="shrink-0" style={{ width: 80 }}>
                        <PackArt tier={tp.pack.packTypeId} name={tp.pack.name} cardCount={tp.pack.cardsPerPack} color={tp.pack.color} seed={tp.packInventoryId} compact />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Core exchange compact */}
        <div className="bg-[var(--cd-surface)] border border-[var(--cd-border)] rounded-lg p-3 mb-3">
          {mobileOfferTab === 'mine' ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <img src={emberIcon} alt="" className="h-3.5 w-auto object-contain" />
                <span className="cd-head text-[9px] text-white/40 uppercase tracking-wider">Your Core Offer</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <img src={emberIcon} alt="" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-auto object-contain" />
                  <input
                    type="number"
                    min="0"
                    max="10000"
                    value={coreInput}
                    onChange={(e) => setCoreInput(Math.min(10000, e.target.value))}
                    placeholder="0"
                    disabled={trade.myReady}
                    className="w-full bg-[var(--cd-edge)] border border-[var(--cd-border)] text-orange-400 text-sm pl-7 pr-3 py-1.5 rounded placeholder-white/15 focus:outline-none cd-num disabled:opacity-50"
                  />
                </div>
                <button
                  onClick={handleSetCore}
                  disabled={actionLoading || trade.myReady}
                  className="cd-head text-[10px] font-bold uppercase px-3 py-1.5 rounded border border-[var(--cd-border)] text-white/40 active:bg-white/5 transition-all cursor-pointer disabled:opacity-30"
                >
                  Set
                </button>
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <div className="flex items-center gap-1 text-[10px] text-white/20">
                  <span>Balance:</span>
                  <CoreLabel value={coreBalance} size="xs" />
                </div>
                {trade.myCore > 0 && (
                  <div className="flex items-center gap-1 text-[10px] text-white/30">
                    <span>Offering:</span>
                    <CoreLabel value={trade.myCore} size="xs" />
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <ArrowLeftRight className="w-3.5 h-3.5 text-orange-400/60" />
                <span className="cd-head text-[9px] text-white/40 uppercase tracking-wider">Core Exchange</span>
              </div>
              {hasCoreOffer ? (
                <div className="flex items-center gap-4">
                  {trade.myCore > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-white/40 text-[10px]">You send</span>
                      <CoreLabel value={trade.myCore} size="xs" />
                    </div>
                  )}
                  {trade.theirCore > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-white/40 text-[10px]">You get</span>
                      <CoreLabel value={trade.theirCore} size="xs" className="!text-emerald-400" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-[10px] text-white/20">No Core in this trade</div>
              )}
            </>
          )}
        </div>

        {/* Add cards/packs buttons (mobile) */}
        {!trade.myReady && mobileOfferTab === 'mine' && (
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setPickerOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-[var(--cd-cyan)]/30 text-[var(--cd-cyan)]/60 active:bg-[var(--cd-cyan)]/5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span className="cd-head text-xs font-bold uppercase tracking-wider">Add Cards</span>
            </button>
            <button
              onClick={() => setPackPickerOpen(true)}
              disabled={availablePacks.length === 0}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-[var(--cd-magenta)]/30 text-[var(--cd-magenta)]/60 active:bg-[var(--cd-magenta)]/5 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-default"
            >
              <Package className="w-4 h-4" />
              <span className="cd-head text-xs font-bold uppercase tracking-wider">Add Packs</span>
            </button>
          </div>
        )}

        {/* Sticky action bar */}
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-[var(--cd-bg)]/95 backdrop-blur-sm border-t border-[var(--cd-border)] p-3 cd-safe-area-pb">
          {!trade.myReady ? (
            <button
              onClick={handleReady}
              disabled={actionLoading}
              className="w-full cd-head text-xs font-bold uppercase tracking-wider py-3 rounded-lg
                bg-emerald-500/10 text-emerald-400 border border-emerald-500/30
                active:bg-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Lock In & Ready'}
            </button>
          ) : canConfirm ? (
            <button
              onClick={handleConfirm}
              disabled={actionLoading}
              className="w-full cd-head text-sm font-bold uppercase tracking-wider py-3 rounded-lg
                bg-[var(--cd-magenta)]/15 text-[var(--cd-magenta)] border-2 border-[var(--cd-magenta)]/40
                active:bg-[var(--cd-magenta)]/25 transition-all cursor-pointer disabled:opacity-50 animate-pulse"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirm Trade'}
            </button>
          ) : trade.myConfirmed ? (
            <div className="text-center py-2">
              <div className="cd-head text-xs text-emerald-400/60 uppercase tracking-wider flex items-center justify-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Waiting for partner...
              </div>
            </div>
          ) : (
            <div className="text-center py-2">
              <div className="cd-head text-xs text-emerald-400/60 uppercase tracking-wider flex items-center justify-center gap-1">
                <Check className="w-3 h-3" /> Ready — waiting for partner
              </div>
            </div>
          )}
        </div>

        {/* Mobile collection picker bottom sheet */}
        {pickerOpen && (
          <MobileCollectionSheet
            cards={availableCards}
            onAdd={(id) => { handleAddCard(id) }}
            onClose={() => setPickerOpen(false)}
            disabled={actionLoading || trade.myReady}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            rarityFilter={rarityFilter}
            setRarityFilter={setRarityFilter}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            showFilters={showFilters}
            setShowFilters={setShowFilters}
          />
        )}

        {/* Mobile pack picker bottom sheet */}
        {packPickerOpen && (
          <PackPickerSheet
            packs={availablePacks}
            onAdd={(id) => { handleAddPack(id) }}
            onClose={() => setPackPickerOpen(false)}
            disabled={actionLoading || trade.myReady}
          />
        )}

        {/* Zoom modal */}
        {zoomedCard && (
          <CardZoomModal
            onClose={() => setZoomedCard(null)}
            collectionCard={zoomedCard.collectionCard}
            gameCard={zoomedCard.gameCard}
            playerCard={zoomedCard.playerCard}
            holoType={zoomedCard.holoType}
          />
        )}
      </div>
    )
  }

  // ─── Desktop Trade Room ───
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          {trade.partnerAvatar && (
            <img src={trade.partnerAvatar} alt="" className="w-8 h-8 rounded-full shrink-0" />
          )}
          <div className="min-w-0">
            <span className="cd-head text-sm text-white/40 tracking-wider">Trading with</span>
            <span className="text-sm font-bold text-white ml-2 truncate">{trade.partnerName}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className={`flex items-center gap-1 text-[9px] cd-head uppercase tracking-wider ${connected ? 'text-emerald-400/60' : 'text-red-400/60'}`}>
            {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            <span>{connected ? 'Live' : 'Reconnecting...'}</span>
          </div>
          <button
            onClick={handleCancel}
            className="cd-head text-xs font-bold uppercase tracking-wider px-4 py-2 rounded
              text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-all cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-center gap-4 mb-4 py-2 px-4 rounded-lg bg-[var(--cd-edge)] border border-[var(--cd-border)]">
        <StatusBadge label="You" ready={trade.myReady} confirmed={trade.myConfirmed} />
        <ArrowLeftRight className="w-4 h-4 text-white/20" />
        <StatusBadge label={trade.partnerName?.split('#')[0] || 'Partner'} ready={trade.theirReady} confirmed={trade.theirConfirmed} />
      </div>

      {/* Trade area: two columns */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <TradeOfferPanel
          title="Your Offer"
          titleColor="var(--cd-cyan)"
          cards={myCards}
          packs={myPacks}
          coreAmount={trade.myCore}
          isReady={trade.myReady}
          itemCount={myCards.length + myPacks.length}
          onRemoveCard={handleRemoveCard}
          onRemovePack={handleRemovePack}
          onZoomCard={handleZoomCard}
          canRemove={!trade.myReady && !actionLoading}
        />
        <TradeOfferPanel
          title="Their Offer"
          titleColor="var(--cd-magenta)"
          cards={theirCards}
          packs={theirPacks}
          coreAmount={trade.theirCore}
          isReady={trade.theirReady}
          itemCount={theirCards.length + theirPacks.length}
          onZoomCard={handleZoomCard}
        />
      </div>

      {/* Core section */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-[var(--cd-surface)] border border-[var(--cd-border)] rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <img src={emberIcon} alt="" className="h-4 w-auto object-contain" />
            <span className="cd-head text-[10px] text-white/40 uppercase tracking-wider">Your Core Offer</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <img src={emberIcon} alt="" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-auto object-contain" />
              <input
                type="number"
                min="0"
                max="10000"
                value={coreInput}
                onChange={(e) => setCoreInput(Math.min(10000, e.target.value))}
                placeholder="0"
                disabled={trade.myReady}
                className="w-full bg-[var(--cd-edge)] border border-[var(--cd-border)] text-orange-400 text-sm pl-8 pr-3 py-1.5 rounded placeholder-white/15 focus:outline-none cd-num disabled:opacity-50"
              />
            </div>
            <button
              onClick={handleSetCore}
              disabled={actionLoading || trade.myReady}
              className="cd-head text-[10px] font-bold uppercase px-3 py-1.5 rounded border border-[var(--cd-border)] text-white/40 hover:text-white/60 transition-all cursor-pointer disabled:opacity-30"
            >
              Set
            </button>
          </div>
          <div className="flex items-center gap-1 mt-1.5 text-[10px] text-white/20">
            <span>Balance:</span>
            <CoreLabel value={coreBalance} size="xs" />
          </div>
        </div>

        <div className="bg-[var(--cd-surface)] border border-[var(--cd-border)] rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <ArrowLeftRight className="w-3.5 h-3.5 text-orange-400/60" />
            <span className="cd-head text-[10px] text-white/40 uppercase tracking-wider">Core Exchange</span>
          </div>
          {hasCoreOffer ? (
            <div className="space-y-1.5">
              {trade.myCore > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-white/40 text-xs">You send</span>
                  <CoreLabel value={trade.myCore} size="sm" />
                </div>
              )}
              {trade.theirCore > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-white/40 text-xs">You receive</span>
                  <CoreLabel value={trade.theirCore} size="sm" className="!text-emerald-400" />
                </div>
              )}
              {trade.myCore > 0 && trade.theirCore > 0 && (
                <div className="pt-1 border-t border-[var(--cd-border)] flex items-center gap-2 text-sm">
                  <span className="text-white/40 text-xs">Net</span>
                  <CoreLabel
                    value={`${trade.theirCore - trade.myCore > 0 ? '+' : ''}${trade.theirCore - trade.myCore}`}
                    size="sm"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="text-[11px] text-white/20 py-2">No Core in this trade</div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="mb-6">
        {!trade.myReady ? (
          <button
            onClick={handleReady}
            disabled={actionLoading}
            className="w-full cd-head text-xs font-bold uppercase tracking-wider py-3 rounded-lg
              bg-emerald-500/10 text-emerald-400 border border-emerald-500/30
              hover:bg-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Lock In & Ready'}
          </button>
        ) : canConfirm ? (
          <button
            onClick={handleConfirm}
            disabled={actionLoading}
            className="w-full cd-head text-sm font-bold uppercase tracking-wider py-3 rounded-lg
              bg-[var(--cd-magenta)]/15 text-[var(--cd-magenta)] border-2 border-[var(--cd-magenta)]/40
              hover:bg-[var(--cd-magenta)]/25 transition-all cursor-pointer disabled:opacity-50 animate-pulse"
          >
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirm Trade'}
          </button>
        ) : trade.myConfirmed ? (
          <div className="w-full text-center py-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
            <div className="cd-head text-xs text-emerald-400/60 uppercase tracking-wider flex items-center justify-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Waiting for partner to confirm...
            </div>
          </div>
        ) : (
          <div className="w-full text-center py-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
            <div className="cd-head text-xs text-emerald-400/60 uppercase tracking-wider flex items-center justify-center gap-1">
              <Check className="w-3 h-3" /> Ready — waiting for partner
            </div>
          </div>
        )}
      </div>

      {/* Desktop collection picker */}
      {!trade.myReady && (
        <div className="border-t border-[var(--cd-border)] pt-4">
          <div className="flex items-center justify-between mb-3 gap-2">
            <h3 className="cd-head text-sm text-white/40 tracking-wider">
              Your Collection
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/20 cd-num">{availableCards.length} cards</span>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-1.5 rounded transition-all cursor-pointer ${showFilters ? 'bg-[var(--cd-cyan)]/10 text-[var(--cd-cyan)]' : 'text-white/30 hover:text-white/50'}`}
              >
                <Filter className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {showFilters && (
            <CollectionFilters
              searchQuery={searchQuery} setSearchQuery={setSearchQuery}
              rarityFilter={rarityFilter} setRarityFilter={setRarityFilter}
              typeFilter={typeFilter} setTypeFilter={setTypeFilter}
            />
          )}

          <div className="flex flex-wrap gap-2 max-h-[550px] overflow-y-auto pr-1">
            {availableCards.map(card => (
              <CollectionPickerCard
                key={card.id}
                card={card}
                onAdd={() => handleAddCard(card.id)}
                disabled={actionLoading || trade.myReady}
              />
            ))}
            {availableCards.length === 0 && (
              <div className="col-span-full text-center py-8 text-white/20 text-xs">
                {searchQuery || rarityFilter || typeFilter !== 'all'
                  ? 'No cards match your filters'
                  : 'No available cards'
                }
              </div>
            )}
          </div>

          {/* Desktop pack inventory */}
          {availablePacks.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[var(--cd-border)]">
              <div className="flex items-center justify-between mb-3 gap-2">
                <h3 className="cd-head text-sm text-white/40 tracking-wider">
                  Your Packs
                </h3>
                <span className="text-[10px] text-white/20 cd-num">{availablePacks.length} packs</span>
              </div>
              <div className="flex flex-wrap gap-3">
                {availablePacks.map(pack => (
                  <button
                    key={pack.id}
                    onClick={() => handleAddPack(pack.id)}
                    disabled={actionLoading || trade.myReady}
                    className="bg-[var(--cd-surface)] border border-[var(--cd-border)] rounded p-1.5 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-default hover:border-[var(--cd-cyan)]/30 group"
                    style={{ width: 110 }}
                  >
                    <PackArt tier={pack.packTypeId || pack.packType?.packTypeId || 'standard'} name={pack.name || pack.packType?.name} cardCount={pack.cardsPerPack || pack.packType?.cardsPerPack} color={pack.color || pack.packType?.color} seed={pack.id} compact />
                    <div className="text-[8px] font-bold text-white truncate mt-0.5 px-0.5 group-hover:text-[var(--cd-cyan)] transition-colors">{pack.name || pack.packType?.name || 'Pack'}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Zoom modal */}
      {zoomedCard && (
        <CardZoomModal
          onClose={() => setZoomedCard(null)}
          collectionCard={zoomedCard.collectionCard}
          gameCard={zoomedCard.gameCard}
          playerCard={zoomedCard.playerCard}
          holoType={zoomedCard.holoType}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════
// Status Badge
// ═══════════════════════════════════════
function StatusBadge({ label, ready, confirmed }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${
        confirmed ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]'
          : ready ? 'bg-emerald-400/60'
          : 'bg-white/10'
      }`} />
      <span className="text-[10px] cd-head uppercase tracking-wider text-white/50 max-w-[80px] truncate">{label}</span>
      {confirmed && <Check className="w-3 h-3 text-emerald-400" />}
    </div>
  )
}

// ═══════════════════════════════════════
// Mobile Card Slideshow
// ═══════════════════════════════════════
function MobileCardSlideshow({ cards, onRemoveCard, onZoomCard, canRemove, emptyText }) {
  const scrollRef = useRef(null)
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const handler = () => {
      const cardW = 110
      const idx = Math.round(el.scrollLeft / cardW)
      setActiveIdx(Math.min(idx, cards.length - 1))
    }
    el.addEventListener('scroll', handler, { passive: true })
    return () => el.removeEventListener('scroll', handler)
  }, [cards.length])

  if (cards.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[120px] text-white/15 text-xs cd-head">
        {emptyText || 'No cards'}
      </div>
    )
  }

  return (
    <div>
      <div
        ref={scrollRef}
        className="flex gap-2.5 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory cd-scrollbar-hide"
      >
        {cards.map((tc, i) => (
          <MobileTradeCard
            key={tc.cardId}
            tradeCard={tc}
            onRemove={onRemoveCard ? () => onRemoveCard(tc.cardId) : undefined}
            onZoom={() => onZoomCard?.(tc.card)}
            canRemove={canRemove}
          />
        ))}
      </div>

      {/* Pagination dots */}
      {cards.length > 2 && (
        <div className="flex justify-center gap-1 mt-1.5">
          {cards.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all ${
                i === activeIdx ? 'w-4 h-1.5 bg-white/40' : 'w-1.5 h-1.5 bg-white/10'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function MobileTradeCard({ tradeCard, onRemove, onZoom, canRemove }) {
  const { getDefOverride, getBlueprint } = useVault()
  const { card } = tradeCard
  const rarityInfo = RARITIES[card.rarity] || RARITIES.common
  const isCollection = !!card.blueprintId
  const isPlayer = card.cardType === 'player'

  let cardData = null
  if (isPlayer && card.cardData) {
    cardData = typeof card.cardData === 'string' ? JSON.parse(card.cardData) : card.cardData
  }

  const dataMap = !isPlayer && !isCollection ? DATA_MAPS[card.cardType] : null
  const dataKey = card.godId?.replace(/^(item|consumable)-/, '') || card.godId
  const rawData = dataMap?.get(dataKey)
  const override = !isPlayer ? getDefOverride(card) : null
  const resolvedData = rawData && override
    ? { ...rawData, metadata: override, imageUrl: override.custom_image_url || rawData.imageUrl }
    : rawData

  return (
    <div className="relative shrink-0 snap-center" style={{ width: 105 }}>
      <button
        onClick={onZoom}
        className="w-full cursor-pointer active:scale-95 transition-transform"
      >
        <div>
          {isCollection ? (
            <VaultCard card={card} getBlueprint={getBlueprint} size={105} holo={false} />
          ) : isPlayer ? (
              <TradingCard
                playerName={cardData?.playerName || card.godName}
                teamName={cardData?.teamName || ''}
                teamColor={cardData?.teamColor || '#6366f1'}
                role={cardData?.role || card.role || 'ADC'}
                avatarUrl={cardData?.avatarUrl || card.imageUrl || ''}
                rarity={card.rarity}
                leagueName={cardData?.leagueName || ''}
                divisionName={cardData?.divisionName || ''}
                stats={cardData?.stats || null}
                bestGod={card.bestGodName ? { name: card.bestGodName } : null}
                isFirstEdition={cardData?.isFirstEdition}
                isConnected={card.isConnected}
                signatureUrl={card.signatureUrl}
                size={105}
              />
          ) : (
            <div style={{ width: 105 }}>
              <GameCard
                type={card.cardType}
                rarity={card.rarity}
                data={{ ...(resolvedData || { name: card.godName, slug: card.godId }), signatureUrl: card.signatureUrl }}
                size={105}
              />
            </div>
          )}
        </div>
        <div className="mt-1 text-[8px] font-bold text-white truncate text-center">{card.godName}</div>
        <div className="text-[7px] uppercase cd-head text-center" style={{ color: rarityInfo.color }}>{card.rarity}</div>
        <CardEffectDisplay card={card} />
      </button>

      {/* Always-visible remove badge on mobile */}
      {canRemove && onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center cursor-pointer z-10 shadow-lg"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

// ═══════════════════════════════════════
// Mobile Collection Bottom Sheet
// ═══════════════════════════════════════
function MobileCollectionSheet({ cards, onAdd, onClose, disabled, searchQuery, setSearchQuery, rarityFilter, setRarityFilter, typeFilter, setTypeFilter, showFilters, setShowFilters }) {
  const [closing, setClosing] = useState(false)

  const handleClose = () => {
    setClosing(true)
    setTimeout(onClose, 200)
  }

  return (
    <div
      className={`fixed inset-0 z-40 flex items-end bg-black/60 backdrop-blur-sm ${closing ? 'cd-overlay-exit' : 'cd-overlay-enter'}`}
      onClick={handleClose}
    >
      <div
        className={`w-full bg-[var(--cd-bg)] border-t border-[var(--cd-border)] rounded-t-2xl max-h-[85vh] flex flex-col ${
          closing ? 'cd-sheet-exit' : 'cd-sheet-enter'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/15" />
        </div>

        {/* Sheet header */}
        <div className="flex items-center justify-between px-4 pb-2">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-[var(--cd-cyan)]" />
            <span className="cd-head text-sm text-white/60 tracking-wider">Add Cards</span>
            <span className="text-[10px] text-white/20 cd-num">({cards.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-1.5 rounded transition-all cursor-pointer ${showFilters ? 'bg-[var(--cd-cyan)]/10 text-[var(--cd-cyan)]' : 'text-white/30'}`}
            >
              <Filter className="w-4 h-4" />
            </button>
            <button onClick={handleClose} className="p-1.5 text-white/40 active:text-white/70 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="px-4 pb-2">
            <CollectionFilters
              searchQuery={searchQuery} setSearchQuery={setSearchQuery}
              rarityFilter={rarityFilter} setRarityFilter={setRarityFilter}
              typeFilter={typeFilter} setTypeFilter={setTypeFilter}
              compact
            />
          </div>
        )}

        {/* Card grid */}
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <div className="flex flex-wrap gap-2 justify-center">
            {cards.map(card => (
              <CollectionPickerCard
                key={card.id}
                card={card}
                onAdd={() => onAdd(card.id)}
                disabled={disabled}
                mobile
              />
            ))}
            {cards.length === 0 && (
              <div className="col-span-full text-center py-12 text-white/20 text-xs">
                {searchQuery || rarityFilter || typeFilter !== 'all'
                  ? 'No cards match your filters'
                  : 'No available cards'
                }
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
// Pack Picker Sheet (mobile)
// ═══════════════════════════════════════
function PackPickerSheet({ packs, onAdd, onClose, disabled }) {
  const [closing, setClosing] = useState(false)

  const handleClose = () => {
    setClosing(true)
    setTimeout(onClose, 200)
  }

  return (
    <div
      className={`fixed inset-0 z-40 flex items-end bg-black/60 backdrop-blur-sm ${closing ? 'cd-overlay-exit' : 'cd-overlay-enter'}`}
      onClick={handleClose}
    >
      <div
        className={`w-full bg-[var(--cd-bg)] border-t border-[var(--cd-border)] rounded-t-2xl max-h-[70vh] flex flex-col ${
          closing ? 'cd-sheet-exit' : 'cd-sheet-enter'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/15" />
        </div>

        <div className="flex items-center justify-between px-4 pb-2">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-[var(--cd-magenta)]" />
            <span className="cd-head text-sm text-white/60 tracking-wider">Add Packs</span>
            <span className="text-[10px] text-white/20 cd-num">({packs.length})</span>
          </div>
          <button onClick={handleClose} className="p-1.5 text-white/40 active:text-white/70 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <div className="flex flex-wrap gap-3 justify-center">
            {packs.map(pack => (
              <button
                key={pack.id}
                onClick={() => onAdd(pack.id)}
                disabled={disabled}
                className="bg-[var(--cd-surface)] border border-[var(--cd-border)] rounded p-1.5 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-default active:border-[var(--cd-cyan)]/30 active:bg-[var(--cd-cyan)]/5"
                style={{ width: 100 }}
              >
                <PackArt tier={pack.packTypeId || pack.packType?.packTypeId || 'standard'} name={pack.name || pack.packType?.name} cardCount={pack.cardsPerPack || pack.packType?.cardsPerPack} color={pack.color || pack.packType?.color} seed={pack.id} compact />
                <div className="text-[8px] font-bold text-white truncate mt-0.5 px-0.5">{pack.name || pack.packType?.name || 'Pack'}</div>
              </button>
            ))}
            {packs.length === 0 && (
              <div className="col-span-full text-center py-12 text-white/20 text-xs">
                No available packs
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
// Collection Filters (shared)
// ═══════════════════════════════════════
function CollectionFilters({ searchQuery, setSearchQuery, rarityFilter, setRarityFilter, typeFilter, setTypeFilter, compact }) {
  return (
    <div className={`space-y-2 ${compact ? '' : 'mb-3'}`}>
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search cards..."
          className="w-full bg-[var(--cd-edge)] border border-[var(--cd-border)] text-white text-xs pl-8 pr-8 py-2 rounded placeholder-white/20 focus:outline-none focus:border-[var(--cd-cyan)]/50"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 active:text-white/60 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Type filter */}
      <div className="flex gap-1 overflow-x-auto cd-scrollbar-hide pb-0.5">
        {TYPE_FILTERS.map(tf => (
          <button
            key={tf.key}
            onClick={() => setTypeFilter(tf.key)}
            className={`shrink-0 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider cd-head border transition-all cursor-pointer ${
              typeFilter === tf.key
                ? 'bg-[var(--cd-cyan)]/10 text-[var(--cd-cyan)] border-[var(--cd-cyan)]/30'
                : 'text-white/30 border-white/5 active:text-white/50'
            }`}
          >
            {tf.label}
          </button>
        ))}
      </div>

      {/* Rarity filter */}
      <div className="flex gap-1 overflow-x-auto cd-scrollbar-hide pb-0.5">
        <button
          onClick={() => setRarityFilter(null)}
          className={`shrink-0 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider cd-head border transition-all cursor-pointer ${
            !rarityFilter
              ? 'bg-white/5 text-white/60 border-white/10'
              : 'text-white/20 border-white/5 active:text-white/40'
          }`}
        >
          All
        </button>
        {RARITY_ORDER.map(r => {
          const ri = RARITIES[r]
          return (
            <button
              key={r}
              onClick={() => setRarityFilter(rarityFilter === r ? null : r)}
              className={`shrink-0 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider cd-head border transition-all cursor-pointer ${
                rarityFilter === r
                  ? 'bg-current/10 border-current'
                  : 'text-white/20 border-white/5 active:text-white/40'
              }`}
              style={rarityFilter === r ? { color: ri.color, borderColor: `${ri.color}44` } : undefined}
            >
              {ri.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
// Desktop Trade Offer Panel
// ═══════════════════════════════════════
function TradeOfferPanel({ title, titleColor, cards, packs = [], coreAmount, isReady, itemCount, onRemoveCard, onRemovePack, onZoomCard, canRemove }) {
  return (
    <div className="bg-[var(--cd-surface)] border border-[var(--cd-border)] rounded-lg p-4 flex flex-col" style={{ minHeight: 220 }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="cd-head text-sm tracking-wider" style={{ color: titleColor }}>{title}</h3>
          {isReady && <Check className="w-3.5 h-3.5 text-emerald-400" />}
        </div>
        <span className="cd-num text-[10px] text-white/30">{itemCount} items</span>
      </div>

      <div className="flex-1 min-h-0">
        {cards.length === 0 && packs.length === 0 ? (
          <div className="flex items-center justify-center h-full min-h-[120px] text-white/10 text-xs cd-head">
            No items added
          </div>
        ) : (
          <>
            {cards.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {cards.map(tc => (
                  <DesktopTradeCardSlot
                    key={tc.cardId}
                    tradeCard={tc}
                    onRemove={onRemoveCard ? () => onRemoveCard(tc.cardId) : undefined}
                    onZoom={() => onZoomCard?.(tc.card)}
                    canRemove={canRemove}
                  />
                ))}
              </div>
            )}
            {packs.length > 0 && (
              <div className={cards.length > 0 ? 'mt-2 pt-2 border-t border-[var(--cd-border)]' : ''}>
                <div className="text-[9px] text-white/30 cd-head uppercase tracking-wider mb-1.5">Packs</div>
                <div className="flex flex-wrap gap-2">
                  {packs.map(tp => (
                    <div key={tp.id} className="relative group" style={{ width: 90 }}>
                      <PackArt tier={tp.pack.packTypeId} name={tp.pack.name} cardCount={tp.pack.cardsPerPack} color={tp.pack.color} seed={tp.packInventoryId} compact />
                      {canRemove && onRemovePack && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onRemovePack(tp.packInventoryId) }}
                          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center
                            opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {coreAmount > 0 && (
        <div className="mt-2 pt-2 border-t border-[var(--cd-border)] flex items-center gap-1.5">
          <span className="text-[10px] text-white/30">+</span>
          <CoreLabel value={coreAmount} size="sm" />
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════
// Desktop Trade Card Slot
// ═══════════════════════════════════════
function DesktopTradeCardSlot({ tradeCard, onRemove, onZoom, canRemove }) {
  const { getDefOverride, getBlueprint } = useVault()
  const { card } = tradeCard
  const rarityInfo = RARITIES[card.rarity] || RARITIES.common
  const isCollection = !!card.blueprintId
  const isPlayer = card.cardType === 'player'

  let cardData = null
  if (isPlayer && card.cardData) {
    cardData = typeof card.cardData === 'string' ? JSON.parse(card.cardData) : card.cardData
  }

  const dataMap = !isPlayer ? DATA_MAPS[card.cardType] : null
  const dataKey = card.godId?.replace(/^(item|consumable)-/, '') || card.godId
  const rawData = dataMap?.get(dataKey)
  const override = !isPlayer ? getDefOverride(card) : null
  const resolvedData = rawData && override
    ? { ...rawData, metadata: override, imageUrl: override.custom_image_url || rawData.imageUrl }
    : rawData

  return (
    <div className="relative group" style={{ width: 100 }}>
      <button
        onClick={onZoom}
        className="w-full cursor-pointer transition-transform hover:scale-105 active:scale-95"
      >
        <div>
          {isCollection ? (
            <VaultCard card={card} getBlueprint={getBlueprint} size={100} holo={false} />
          ) : isPlayer ? (
            <TradingCard
              playerName={cardData?.playerName || card.godName}
              teamName={cardData?.teamName || ''}
              teamColor={cardData?.teamColor || '#6366f1'}
              role={cardData?.role || card.role || 'ADC'}
              avatarUrl={cardData?.avatarUrl || card.imageUrl || ''}
              rarity={card.rarity}
              leagueName={cardData?.leagueName || ''}
              divisionName={cardData?.divisionName || ''}
              stats={cardData?.stats || null}
              bestGod={card.bestGodName ? { name: card.bestGodName } : null}
              isFirstEdition={cardData?.isFirstEdition}
              isConnected={card.isConnected}
              signatureUrl={card.signatureUrl}
              size={100}
            />
          ) : (
            <GameCard
              type={card.cardType}
              rarity={card.rarity}
              data={{ ...(resolvedData || { name: card.godName, slug: card.godId }), signatureUrl: card.signatureUrl }}
              size={100}
            />
          )}
        </div>
        <div className="mt-1 text-[8px] font-bold text-white truncate text-center" style={{ maxWidth: 100 }}>{card.godName}</div>
        <div className="text-[7px] uppercase cd-head text-center" style={{ color: rarityInfo.color }}>{card.rarity}</div>
        <CardEffectDisplay card={card} />
      </button>

      {canRemove && onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center
            opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}

// ═══════════════════════════════════════
// Collection Picker Card
// ═══════════════════════════════════════
function CollectionPickerCard({ card, onAdd, disabled, mobile }) {
  const { getDefOverride, getBlueprint } = useVault()
  const rarityInfo = RARITIES[card.rarity] || RARITIES.common
  const isCollection = !!card.blueprintId
  const isPlayer = (card.cardType || 'god') === 'player'
  const cardSize = mobile ? 100 : 130

  let cardData = null
  if (isPlayer && card.cardData) {
    cardData = typeof card.cardData === 'string' ? JSON.parse(card.cardData) : card.cardData
  }

  const dataMap = !isPlayer ? DATA_MAPS[card.cardType] : null
  const dataKey = card.godId?.replace(/^(item|consumable)-/, '') || card.godId
  const rawData = dataMap?.get(dataKey)
  const override = !isPlayer ? getDefOverride(card) : null
  const resolvedData = rawData && override
    ? { ...rawData, metadata: override, imageUrl: override.custom_image_url || rawData.imageUrl }
    : rawData

  return (
    <button
      onClick={onAdd}
      disabled={disabled}
      style={{ width: cardSize + 10 }}
      className={`bg-[var(--cd-surface)] border border-[var(--cd-border)] rounded p-1 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-default group ${
        mobile ? 'active:border-[var(--cd-cyan)]/30 active:bg-[var(--cd-cyan)]/5' : 'hover:border-[var(--cd-cyan)]/30'
      }`}
    >
      <div className="rounded overflow-hidden">
        {isCollection ? (
          <VaultCard card={card} getBlueprint={getBlueprint} size={cardSize} holo={false} />
        ) : isPlayer ? (
          <TradingCard
            playerName={cardData?.playerName || card.godName}
            teamName={cardData?.teamName || ''}
            teamColor={cardData?.teamColor || '#6366f1'}
            role={cardData?.role || card.role || 'ADC'}
            avatarUrl={cardData?.avatarUrl || card.imageUrl || ''}
            rarity={card.rarity}
            leagueName={cardData?.leagueName || ''}
            divisionName={cardData?.divisionName || ''}
            stats={cardData?.stats || null}
            bestGod={card.bestGodName ? { name: card.bestGodName } : null}
            isFirstEdition={card.isFirstEdition || false}
            isConnected={card.isConnected}
            signatureUrl={card.signatureUrl}
            size={cardSize}
          />
        ) : (
          <GameCard
            type={card.cardType}
            rarity={card.rarity}
            data={{ ...(resolvedData || { name: card.godName, slug: card.godId }), signatureUrl: card.signatureUrl }}
            size={cardSize}
          />
        )}
      </div>
      <div className={`text-[8px] font-bold text-white truncate mt-0.5 px-0.5 ${mobile ? '' : 'group-hover:text-[var(--cd-cyan)]'} transition-colors`} style={{ maxWidth: cardSize }}>{card.godName}</div>
      <div className="text-[7px] uppercase cd-head px-0.5" style={{ color: rarityInfo.color }}>{card.rarity}</div>
      <CardEffectDisplay card={card} />
    </button>
  )
}

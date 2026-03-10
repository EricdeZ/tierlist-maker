import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { usePassion } from '../../context/PassionContext'
import { useCardClash } from './CardClashContext'
import { tradingService } from '../../services/database'
import { RARITIES } from '../../data/cardclash/economy'
import { Search, X, Handshake, Loader2, Check, Plus, History } from 'lucide-react'

export default function CCTrading() {
  const { user } = useAuth()
  const passionCtx = usePassion()
  const { collection, pendingTradeCount, setPendingTradeCount } = useCardClash()

  const [view, setView] = useState('inbox')
  const [pending, setPending] = useState([])
  const [historyTrades, setHistoryTrades] = useState([])
  const [activeTrade, setActiveTrade] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchModal, setSearchModal] = useState(false)

  const fetchPending = useCallback(async () => {
    try {
      const data = await tradingService.pending()
      setPending(data.trades || [])
      const active = (data.trades || []).find(t => t.status === 'active')
      if (active) {
        setActiveTrade(active.id)
        setView('room')
      }
    } catch (err) {
      console.error('Failed to fetch pending trades:', err)
    }
  }, [])

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

  const handleCreate = async (targetUserId) => {
    setError('')
    try {
      await tradingService.create(targetUserId)
      setSearchModal(false)
      setSuccess('Trade invite sent!')
      fetchPending()
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

  const handleTradeEnd = () => {
    setActiveTrade(null)
    setView('inbox')
    fetchPending()
    passionCtx?.refreshBalance?.()
    setPendingTradeCount?.(0)
  }

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
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => setView('inbox')}
            className={`cd-head flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-wider transition-all cursor-pointer border ${
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
            className={`cd-head flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-wider transition-all cursor-pointer border ${
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
            className="cd-head flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-wider transition-all cursor-pointer border bg-[var(--cd-magenta)]/10 text-[var(--cd-magenta)] border-[var(--cd-magenta)]/30 hover:bg-[var(--cd-magenta)]/20"
          >
            <Plus className="w-4 h-4" />
            Start Trade
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
              fetchPending()
            } catch (err) { setError(err.message) }
          }}
          onEnterRoom={(id) => { setActiveTrade(id); setView('room') }}
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
function InboxView({ trades, onJoin, onCancel, onEnterRoom }) {
  const invites = trades.filter(t => t.status === 'waiting' && !t.isInitiator)
  const sent = trades.filter(t => t.status === 'waiting' && t.isInitiator)
  const active = trades.filter(t => t.status === 'active')

  if (trades.length === 0) {
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
            <TradeRow key={t.id} trade={t} action="Waiting..." actionDisabled onCancel={() => onCancel(t.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function TradeRow({ trade, action, actionDisabled, onAction, onCancel }) {
  return (
    <div className="flex items-center gap-4 bg-[var(--cd-surface)] border border-[var(--cd-border)] rounded-lg p-4 mb-2">
      {trade.partnerAvatar && (
        <img src={trade.partnerAvatar} alt="" className="w-8 h-8 rounded-full" />
      )}
      <div className="flex-1">
        <div className="text-sm font-bold text-white">{trade.partnerName}</div>
        <div className="text-[10px] text-white/30">
          {new Date(trade.createdAt).toLocaleString()}
        </div>
      </div>
      {onAction && (
        <button
          onClick={onAction}
          disabled={actionDisabled}
          className="cd-head text-xs font-bold uppercase tracking-wider px-4 py-2 rounded
            bg-[var(--cd-cyan)]/10 text-[var(--cd-cyan)] border border-[var(--cd-cyan)]/30
            hover:bg-[var(--cd-cyan)]/20 transition-all cursor-pointer
            disabled:opacity-50 disabled:cursor-default"
        >
          {action}
        </button>
      )}
      {onCancel && (
        <button
          onClick={onCancel}
          className="cd-head text-xs font-bold uppercase tracking-wider px-3 py-2 rounded
            text-red-400/60 border border-red-500/20 hover:bg-red-500/10 transition-all cursor-pointer"
        >
          Cancel
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

  const doSearch = async () => {
    if (query.length < 2) return
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
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--cd-surface)] border border-[var(--cd-border)] rounded-xl p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="cd-head text-lg text-[var(--cd-magenta)] tracking-wider mb-4">Start Trade</h3>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
            placeholder="Search by username..."
            className="flex-1 bg-[var(--cd-edge)] border border-[var(--cd-border)] text-white text-sm px-3 py-2 rounded placeholder-white/20 focus:outline-none focus:border-[var(--cd-cyan)]/50"
            autoFocus
          />
          <button
            onClick={doSearch}
            disabled={query.length < 2}
            className="px-3 py-2 bg-[var(--cd-cyan)]/10 text-[var(--cd-cyan)] border border-[var(--cd-cyan)]/30 rounded cursor-pointer hover:bg-[var(--cd-cyan)]/20 transition-all disabled:opacity-30"
          >
            <Search className="w-4 h-4" />
          </button>
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
                className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-[var(--cd-edge)] transition-all cursor-pointer text-left"
              >
                {u.discord_avatar && u.discord_id ? (
                  <img
                    src={`https://cdn.discordapp.com/avatars/${u.discord_id}/${u.discord_avatar}.webp?size=32`}
                    alt="" className="w-6 h-6 rounded-full"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-white/10" />
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
          className="mt-4 w-full text-sm font-bold uppercase py-2 rounded border border-white/10 text-white/40 hover:text-white/60 transition-all cursor-pointer cd-head"
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
function TradeRoom({ tradeId, collection, userId, coreBalance, onEnd, setError, setSuccess }) {
  const [trade, setTrade] = useState(null)
  const [tradeCards, setTradeCards] = useState([])
  const [actionLoading, setActionLoading] = useState(false)
  const [coreInput, setCoreInput] = useState('')
  const pollRef = useRef(null)

  const poll = useCallback(async () => {
    try {
      const data = await tradingService.poll(tradeId)
      setTrade(data.trade)
      setTradeCards(data.cards || [])

      if (['completed', 'cancelled', 'expired'].includes(data.trade.status)) {
        if (data.trade.status === 'completed') setSuccess('Trade completed!')
        else if (data.trade.status === 'cancelled') setError('Trade was cancelled')
        else if (data.trade.status === 'expired') setError('Trade expired')
        clearInterval(pollRef.current)
        setTimeout(onEnd, 2000)
      }
    } catch (err) {
      console.error('Poll error:', err)
    }
  }, [tradeId, onEnd, setError, setSuccess])

  useEffect(() => {
    poll()
    pollRef.current = setInterval(poll, 3000)
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

  const availableCards = useMemo(() =>
    collection.filter(c => !myCardIds.has(c.id)),
  [collection, myCardIds])

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

  if (!trade) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-[var(--cd-cyan)] animate-spin" />
      </div>
    )
  }

  const bothReady = trade.myReady && trade.theirReady
  const canConfirm = bothReady && !trade.myConfirmed

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {trade.partnerAvatar && (
            <img src={trade.partnerAvatar} alt="" className="w-8 h-8 rounded-full" />
          )}
          <div>
            <span className="cd-head text-sm text-white/40 tracking-wider">Trading with</span>
            <span className="text-sm font-bold text-white ml-2">{trade.partnerName}</span>
          </div>
        </div>
        <button
          onClick={handleCancel}
          className="cd-head text-xs font-bold uppercase tracking-wider px-4 py-2 rounded
            text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-all cursor-pointer"
        >
          Cancel Trade
        </button>
      </div>

      {/* Trade area: two columns */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* My offer */}
        <div className="bg-[var(--cd-surface)] border border-[var(--cd-border)] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="cd-head text-sm text-[var(--cd-cyan)] tracking-wider">Your Offer</h3>
            {trade.myReady && <Check className="w-4 h-4 text-emerald-400" />}
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3 min-h-[100px]">
            {myCards.map(tc => (
              <TradeCardSlot
                key={tc.cardId}
                card={tc.card}
                onRemove={() => handleRemoveCard(tc.cardId)}
                disabled={actionLoading || trade.myReady}
              />
            ))}
          </div>

          <div className="flex items-center gap-2 mb-3">
            <input
              type="number"
              min="0"
              value={coreInput}
              onChange={(e) => setCoreInput(e.target.value)}
              placeholder="Core..."
              disabled={trade.myReady}
              className="flex-1 bg-[var(--cd-edge)] border border-[var(--cd-border)] text-orange-400 text-sm px-3 py-1.5 rounded placeholder-white/15 focus:outline-none cd-num disabled:opacity-50"
            />
            <button
              onClick={handleSetCore}
              disabled={actionLoading || trade.myReady}
              className="cd-head text-[10px] font-bold uppercase px-3 py-1.5 rounded border border-[var(--cd-border)] text-white/40 hover:text-white/60 transition-all cursor-pointer disabled:opacity-30"
            >
              Set
            </button>
          </div>
          {trade.myCore > 0 && (
            <div className="text-sm text-orange-400 cd-num mb-3">+ {trade.myCore} Core</div>
          )}
          <div className="text-[10px] text-white/20 mb-3">Balance: {coreBalance} Core</div>

          {!trade.myReady ? (
            <button
              onClick={handleReady}
              disabled={actionLoading}
              className="w-full cd-head text-xs font-bold uppercase tracking-wider py-2 rounded
                bg-emerald-500/10 text-emerald-400 border border-emerald-500/30
                hover:bg-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              Ready
            </button>
          ) : canConfirm ? (
            <button
              onClick={handleConfirm}
              disabled={actionLoading}
              className="w-full cd-head text-xs font-bold uppercase tracking-wider py-2 rounded
                bg-[var(--cd-magenta)]/10 text-[var(--cd-magenta)] border border-[var(--cd-magenta)]/30
                hover:bg-[var(--cd-magenta)]/20 transition-all cursor-pointer disabled:opacity-50 animate-pulse"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirm Trade'}
            </button>
          ) : trade.myConfirmed ? (
            <div className="w-full text-center cd-head text-xs text-emerald-400/60 uppercase tracking-wider py-2">
              Waiting for partner...
            </div>
          ) : (
            <div className="w-full text-center cd-head text-xs text-emerald-400/60 uppercase tracking-wider py-2">
              <Check className="w-3 h-3 inline mr-1" /> Ready
            </div>
          )}
        </div>

        {/* Their offer */}
        <div className="bg-[var(--cd-surface)] border border-[var(--cd-border)] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="cd-head text-sm text-[var(--cd-magenta)] tracking-wider">Their Offer</h3>
            {trade.theirReady && <Check className="w-4 h-4 text-emerald-400" />}
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3 min-h-[100px]">
            {theirCards.map(tc => (
              <TradeCardSlot key={tc.cardId} card={tc.card} />
            ))}
          </div>

          {trade.theirCore > 0 && (
            <div className="text-sm text-orange-400 cd-num mb-3">+ {trade.theirCore} Core</div>
          )}

          <div className="text-center text-[10px] text-white/30 cd-head uppercase tracking-wider py-2">
            {trade.theirConfirmed ? (
              <span className="text-emerald-400">Confirmed</span>
            ) : trade.theirReady ? (
              <span className="text-emerald-400"><Check className="w-3 h-3 inline mr-1" /> Ready</span>
            ) : (
              'Not ready'
            )}
          </div>
        </div>
      </div>

      {/* Collection picker */}
      <div className="border-t border-[var(--cd-border)] pt-4">
        <h3 className="cd-head text-sm text-white/40 tracking-wider mb-3">
          Your Collection — click to add
        </h3>
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 max-h-[300px] overflow-y-auto">
          {availableCards.map(card => {
            const rarityInfo = RARITIES[card.rarity] || RARITIES.common
            return (
              <button
                key={card.id}
                onClick={() => handleAddCard(card.id)}
                disabled={actionLoading || trade.myReady}
                className="bg-[var(--cd-surface)] border border-[var(--cd-border)] rounded p-1.5 hover:border-[var(--cd-cyan)]/30 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-default"
              >
                <div className="aspect-square bg-[var(--cd-edge)] rounded flex items-center justify-center mb-1 overflow-hidden">
                  {card.imageUrl ? (
                    <img src={card.imageUrl} alt={card.godName} className="w-full h-full object-contain" />
                  ) : (
                    <div className="text-[8px] text-white/40 text-center px-0.5">{card.godName}</div>
                  )}
                </div>
                <div className="text-[9px] font-bold text-white truncate">{card.godName}</div>
                <div className="text-[8px] uppercase cd-head" style={{ color: rarityInfo.color }}>{card.rarity}</div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
// Trade Card Slot
// ═══════════════════════════════════════
function TradeCardSlot({ card, onRemove, disabled }) {
  const rarityInfo = RARITIES[card.rarity] || RARITIES.common
  return (
    <div className="relative bg-[var(--cd-edge)] border border-[var(--cd-border)] rounded p-1.5 group">
      <div className="aspect-square rounded flex items-center justify-center overflow-hidden mb-1">
        {card.imageUrl ? (
          <img src={card.imageUrl} alt={card.godName} className="w-full h-full object-contain" />
        ) : (
          <div className="text-[8px] text-white/40 text-center">{card.godName}</div>
        )}
      </div>
      <div className="text-[9px] font-bold text-white truncate">{card.godName}</div>
      <div className="text-[8px] uppercase cd-head" style={{ color: rarityInfo.color }}>{card.rarity}</div>
      {onRemove && !disabled && (
        <button
          onClick={onRemove}
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center
            opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </div>
  )
}

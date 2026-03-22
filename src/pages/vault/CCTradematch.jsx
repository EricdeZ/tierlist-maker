import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Heart, Layers, Users, RefreshCw } from 'lucide-react'
import { useVault } from './VaultContext'
import { useAuth } from '../../context/AuthContext'

import { tradematchService } from '../../services/database'
import TradePileManager from './tradematch/TradePileManager'
import Swiper from './tradematch/Swiper'
import MatchSplash from './tradematch/MatchSplash'
import MatchesAndLikes from './tradematch/MatchesAndLikes'
import Negotiation from './tradematch/Negotiation'

const SUB_VIEWS = [
  { key: 'pile', label: 'Trade Pile', icon: Layers, desc: 'Pick cards you\'re willing to trade. Need at least 20 to start swiping.' },
  { key: 'swiper', label: 'Swipe', icon: Heart, desc: 'Swipe right on cards you want. If they like yours too, it\'s a match!' },
  { key: 'matches', label: 'Matches', icon: Users, desc: 'Negotiate trades with your matches. Send offers, counter, or accept.' },
]

export default function CCTradematch() {
  const { user } = useAuth()
  const { collection, lockedCardIds: apiLockedCardIds, startingFive, binderCards, setMatchTradeCount, setMatchTradePendingCount } = useVault()
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
    if (startingFive?.consumableCard?.id) ids.add(startingFive.consumableCard.id)
    for (const bc of (binderCards || [])) {
      if (bc.card?.id) ids.add(bc.card.id)
    }
    for (const id of (apiLockedCardIds || [])) {
      ids.add(id)
    }
    return ids
  }, [startingFive, binderCards, apiLockedCardIds])

  const [searchParams, setSearchParams] = useSearchParams()
  const subView = searchParams.get('sub') || 'pile'
  const setSubView = useCallback((key) => {
    const next = new URLSearchParams(window.location.search)
    if (key === 'pile') { next.delete('sub') } else { next.set('sub', key) }
    setSearchParams(next, { replace: true })
  }, [setSearchParams])
  const [tradePile, setTradePile] = useState(new Set())
  const [tradePileCount, setTradePileCount] = useState(0)
  const [feedCards, setFeedCards] = useState([])
  const [matchResult, setMatchResult] = useState(null)
  const [matches, setMatches] = useState([])
  const [likes, setLikes] = useState([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTradeId, setActiveTradeId] = useState(null)

  // Reusable fetch callbacks
  const fetchPile = useCallback(async (silent) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const data = await tradematchService.tradePile()
      const ids = new Set((data.cards || []).map(c => c.card_id))
      setTradePile(ids)
      setTradePileCount(data.count ?? ids.size)
    } catch (err) { console.error('Failed to load trade pile:', err) }
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  const fetchFeed = useCallback(async (silent) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const data = await tradematchService.swipeFeed()
      setFeedCards(data.cards || [])
    } catch (err) { console.error('Failed to load swipe feed:', err) }
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  const fetchMatchesAndLikes = useCallback(async (silent) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const [matchData, likeData] = await Promise.all([
        tradematchService.matches(),
        tradematchService.likes(),
      ])
      const m = matchData.matches || []
      setMatches(m)
      setLikes(likeData.likes || [])
      setMatchTradeCount(m.length)
      const pending = m.filter(t => (t.offer_status === 'pending' && t.offer_by !== user?.id) || (t.offer_status === 'negotiating' && !t.offer_by)).length
      setMatchTradePendingCount(pending)
    } catch (err) { console.error('Failed to load matches:', err) }
    finally { setLoading(false); setRefreshing(false) }
  }, [user?.id, setMatchTradeCount, setMatchTradePendingCount])

  const handleRefresh = useCallback(() => {
    if (subView === 'pile') fetchPile(true)
    else if (subView === 'swiper') fetchFeed(true)
    else if (subView === 'matches') fetchMatchesAndLikes(true)
  }, [subView, fetchPile, fetchFeed, fetchMatchesAndLikes])

  // Load trade pile on mount
  useEffect(() => { fetchPile() }, [fetchPile])

  // Refetch on every tab switch
  useEffect(() => {
    if (subView === 'swiper') fetchFeed()
    else if (subView === 'matches') fetchMatchesAndLikes()
    else if (subView === 'pile') fetchPile()
  }, [subView]) // eslint-disable-line react-hooks/exhaustive-deps

  // Poll matches every 15s + refetch on tab focus
  useEffect(() => {
    if (subView !== 'matches') return
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchMatchesAndLikes(true)
    }, 15000)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchMatchesAndLikes(true)
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [subView, fetchMatchesAndLikes])

  const handleToggleTradePile = useCallback(async (cardId) => {
    const inPile = tradePile.has(cardId)
    // Optimistic update
    if (inPile) {
      setTradePile(prev => { const next = new Set(prev); next.delete(cardId); return next })
      setTradePileCount(prev => prev - 1)
    } else {
      setTradePile(prev => new Set(prev).add(cardId))
      setTradePileCount(prev => prev + 1)
    }
    try {
      if (inPile) {
        await tradematchService.tradePileRemove(cardId)
      } else {
        await tradematchService.tradePileAdd(cardId)
      }
    } catch (err) {
      // Revert on failure
      console.error('Failed to toggle trade pile:', err)
      if (inPile) {
        setTradePile(prev => new Set(prev).add(cardId))
        setTradePileCount(prev => prev + 1)
      } else {
        setTradePile(prev => { const next = new Set(prev); next.delete(cardId); return next })
        setTradePileCount(prev => prev - 1)
      }
    }
  }, [tradePile])

  const handleSwipeRight = useCallback(async (cardId) => {
    try {
      const result = await tradematchService.swipe(cardId)
      return result
    } catch (err) {
      console.error('Failed to swipe:', err)
      return null
    }
  }, [])

  const handleSwipeLeft = useCallback(() => {
    // No API call needed — just advance locally
  }, [])

  const handleMatch = useCallback((data) => {
    setMatchResult(data)
  }, [])

  const handleLoadMoreFeed = useCallback(async () => {
    try {
      const data = await tradematchService.swipeFeed(feedCards.length)
      setFeedCards(prev => [...prev, ...(data.cards || [])])
    } catch (err) {
      console.error('Failed to load more feed:', err)
    }
  }, [feedCards.length])

  const handleLikesTrade = useCallback(async (likerId, cardId) => {
    try {
      const result = await tradematchService.likesTrade(likerId, cardId)
      // Reload matches + likes
      const [matchData, likeData] = await Promise.all([
        tradematchService.matches(),
        tradematchService.likes(),
      ])
      setMatches(matchData.matches || [])
      setLikes(likeData.likes || [])
      setMatchTradeCount(matchData.matches?.length || 0)
      return result
    } catch (err) {
      console.error('Failed to create trade from like:', err)
    }
  }, [setMatchTradeCount])

  const handleOpenTrade = useCallback((tradeId) => {
    setActiveTradeId(tradeId)
  }, [])

  const refetchMatches = useCallback(() => {
    Promise.all([
      tradematchService.matches(),
      tradematchService.likes(),
    ]).then(([matchData, likeData]) => {
      setMatches(matchData.matches || [])
      setLikes(likeData.likes || [])
      setMatchTradeCount(matchData.matches?.length || 0)
    }).catch(() => {})
  }, [setMatchTradeCount])

  const handleNegotiationBack = useCallback(() => {
    setActiveTradeId(null)
    refetchMatches()
  }, [refetchMatches])

  const handleNegotiationComplete = useCallback(() => {
    setActiveTradeId(null)
    refetchMatches()
  }, [refetchMatches])

  const handleDismissMatch = useCallback(() => {
    setMatchResult(null)
  }, [])

  const pileIsLocked = tradePileCount < 20

  if (activeTradeId) {
    return (
      <div>
        <Negotiation
          tradeId={activeTradeId}
          userId={user?.id}
          onBack={handleNegotiationBack}
          onComplete={handleNegotiationComplete}
        />
      </div>
    )
  }

  return (
    <div>
      {/* Sub-view switcher */}
      <div className="flex items-center gap-1 mb-4 bg-[var(--cd-surface)] rounded-lg p-1 border border-[var(--cd-border)]">
        {SUB_VIEWS.map(sv => {
          const Icon = sv.icon
          const active = subView === sv.key
          return (
            <button
              key={sv.key}
              onClick={() => setSubView(sv.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-bold uppercase tracking-widest transition-all cursor-pointer cd-head ${
                active
                  ? 'bg-[var(--cd-cyan)]/15 text-[var(--cd-cyan)] cd-text-glow'
                  : 'text-white/30 hover:text-white/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden min-[400px]:inline">{sv.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab description + refresh */}
      <div className="flex items-center justify-between mb-4 px-1">
        <p className="text-xs" style={{ color: 'var(--cd-text-dim)' }}>
          {SUB_VIEWS.find(sv => sv.key === subView)?.desc}
        </p>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-all cursor-pointer flex-shrink-0 ml-2"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} style={{ color: 'var(--cd-text-dim)' }} />
        </button>
      </div>

      {/* Match splash overlay */}
      {matchResult && (
        <MatchSplash
          matchData={matchResult}
          partnerName={matchResult.their_card?.owner_name}
          onOpenTrade={handleOpenTrade}
          onDismiss={handleDismissMatch}
        />
      )}

      {/* Sub-views */}
      {subView === 'pile' && (
        <TradePileManager
          collection={collection}
          lockedCardIds={lockedCardIds}
          tradePile={tradePile}
          onToggle={handleToggleTradePile}
          tradePileCount={tradePileCount}
          loading={loading}
        />
      )}

      {subView === 'swiper' && (
        <Swiper
          feedCards={feedCards}
          onSwipeRight={handleSwipeRight}
          onSwipeLeft={handleSwipeLeft}
          onMatch={handleMatch}
          onLoadMore={handleLoadMoreFeed}
          locked={pileIsLocked}
          loading={loading}
          empty={!loading && feedCards.length === 0}
        />
      )}

      {subView === 'matches' && (
        <MatchesAndLikes
          matches={matches}
          likes={likes}
          onOpenTrade={handleOpenTrade}
          onLikesTrade={handleLikesTrade}
          loading={loading}
          userId={user?.id}
        />
      )}
    </div>
  )
}

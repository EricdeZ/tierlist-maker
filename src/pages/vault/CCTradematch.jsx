import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Heart, Layers, Users } from 'lucide-react'
import { useVault } from './VaultContext'
import { useAuth } from '../../context/AuthContext'

import { tradematchService } from '../../services/database'
import TradePileManager from './tradematch/TradePileManager'
import Swiper from './tradematch/Swiper'
import MatchSplash from './tradematch/MatchSplash'
import MatchesAndLikes from './tradematch/MatchesAndLikes'
import Negotiation from './tradematch/Negotiation'

const SUB_VIEWS = [
  { key: 'pile', label: 'Trade Pile', icon: Layers },
  { key: 'swiper', label: 'Swipe', icon: Heart },
  { key: 'matches', label: 'Matches', icon: Users },
]

export default function CCTradematch() {
  const { user } = useAuth()
  const { collection, lockedCardIds: apiLockedCardIds, startingFive, binderCards, setMatchTradeCount } = useVault()
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
  const [activeTradeId, setActiveTradeId] = useState(null)

  // Load trade pile on mount
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    tradematchService.tradePile().then(data => {
      if (cancelled) return
      const ids = new Set((data.cards || []).map(c => c.card_id))
      setTradePile(ids)
      
      setTradePileCount(data.count ?? ids.size)
      setLoading(false)
    }).catch(err => {
      if (!cancelled) { console.error('Failed to load trade pile:', err); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [])

  // Load feed when switching to swiper
  useEffect(() => {
    if (subView !== 'swiper') return
    let cancelled = false
    setLoading(true)
    tradematchService.swipeFeed().then(data => {
      if (cancelled) return
      setFeedCards(data.cards || [])
      setLoading(false)
    }).catch(err => {
      if (!cancelled) { console.error('Failed to load swipe feed:', err); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [subView])

  // Load matches + likes when switching to matches view
  useEffect(() => {
    if (subView !== 'matches') return
    let cancelled = false
    setLoading(true)
    Promise.all([
      tradematchService.matches(),
      tradematchService.likes(),
    ]).then(([matchData, likeData]) => {
      if (cancelled) return
      setMatches(matchData.matches || [])
      setLikes(likeData.likes || [])
      setLoading(false)
    }).catch(err => {
      if (!cancelled) { console.error('Failed to load matches:', err); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [subView])

  // Refetch matches on tab visibility change
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && subView === 'matches') {
        Promise.all([
          tradematchService.matches(),
          tradematchService.likes(),
        ]).then(([matchData, likeData]) => {
          setMatches(matchData.matches || [])
          setLikes(likeData.likes || [])
        }).catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [subView])

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

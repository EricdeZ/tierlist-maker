import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Heart, Layers, Users, RefreshCw, HelpCircle, X } from 'lucide-react'
import { useVault } from './VaultContext'
import { useAuth } from '../../context/AuthContext'

import { tradematchService } from '../../services/database'
import TradePileManager from './tradematch/TradePileManager'
import Swiper from './tradematch/Swiper'
import MatchSplash from './tradematch/MatchSplash'
import MatchesAndLikes from './tradematch/MatchesAndLikes'
import Negotiation from './tradematch/Negotiation'

const SUB_VIEWS = [
  { key: 'pile', label: 'Trade Pile', icon: Layers, desc: 'Pick cards you\'re willing to trade. Need at least 10 to start swiping.' },
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
  const [showTutorial, setShowTutorial] = useState(false)

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
      const newCards = data.cards || []
      // Only replace if we got cards — keep existing for looping if backend returns empty
      if (newCards.length > 0) setFeedCards(newCards)
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

  const pileIsLocked = tradePileCount < 10

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

      {/* Tab description + actions */}
      <div className="flex items-center justify-between mb-4 px-1">
        <p className="text-xs" style={{ color: 'var(--cd-text-dim)' }}>
          {SUB_VIEWS.find(sv => sv.key === subView)?.desc}
        </p>
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          <button
            onClick={() => setShowTutorial(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold cd-head tracking-wider transition-all cursor-pointer active:scale-95 hover:bg-white/5"
            style={{ color: 'var(--cd-text-dim)' }}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="hidden min-[480px]:inline">How It Works</span>
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold cd-head tracking-wider transition-all cursor-pointer active:scale-95 ${
              refreshing ? 'opacity-50' : 'hover:bg-[var(--cd-cyan)]/10'
            }`}
            style={{ color: 'var(--cd-cyan)', border: '1px solid rgba(0,229,255,0.2)' }}
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
            Update Status
          </button>
        </div>
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
          onStartSwiping={() => setSubView('swiper')}
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
          onGoToPile={() => setSubView('pile')}
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

      {showTutorial && <TradeMatchTutorial onClose={() => setShowTutorial(false)} />}
    </div>
  )
}

function TradeMatchTutorial({ onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      style={{ animation: 'cd-fade-in 0.2s ease-out' }}
    >
      <div
        className="relative w-full max-w-lg max-h-[100dvh] sm:max-h-[80vh] bg-[var(--cd-surface)] border border-[var(--cd-border)] sm:rounded-xl rounded-none overflow-hidden sm:mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--cd-border)]">
          <h3 className="text-base font-bold cd-head text-[var(--cd-text)] tracking-wider">How TradeMatch Works</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 text-sm text-white/60" style={{ maxHeight: 'calc(80vh - 70px)' }}>
          <div>
            <h4 className="font-bold text-white/80 cd-head tracking-wider text-xs mb-1">WHAT IS TRADEMATCH?</h4>
            <p>TradeMatch is a Tinder-style card trading system. Instead of searching for specific users to trade with, you swipe through cards other players have marked for trade. When two players like each other's cards, it's a match — and you can negotiate a trade.</p>
          </div>

          <div>
            <h4 className="font-bold text-[var(--cd-magenta)] cd-head tracking-wider text-xs mb-1 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" /> TRADE PILE
            </h4>
            <p>Start by building your trade pile — select cards from your collection that you're willing to trade. Only <span className="text-white/80 font-semibold">rare or higher</span> cards are eligible. You need at least <span className="text-white/80 font-semibold">10 cards</span> in your pile before you can start swiping. Locked cards (Starting 5, binder, marketplace listings) can't be added. Use the <span className="text-[var(--cd-cyan)]">Duplicates</span> filter to quickly find spare cards.</p>
          </div>

          <div>
            <h4 className="font-bold text-[var(--cd-magenta)] cd-head tracking-wider text-xs mb-1 flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5" /> SWIPE
            </h4>
            <p>Browse cards from other players' trade piles. <span className="text-emerald-400 font-semibold">Swipe right</span> on cards you want, <span className="text-red-400 font-semibold">swipe left</span> to pass. If the other player has also swiped right on one of your cards, it's a match! Cards from players who already liked your cards appear first in the feed.</p>
          </div>

          <div>
            <h4 className="font-bold text-[var(--cd-magenta)] cd-head tracking-wider text-xs mb-1 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> MATCHES
            </h4>
            <p>When you match, both cards are pre-loaded into a trade offer. Click on a match to open the negotiation screen where you can:</p>
            <ul className="list-disc list-inside mt-1.5 space-y-1 text-white/50">
              <li>Add or remove cards from either side</li>
              <li>Add Cores to sweeten the deal</li>
              <li>Send your offer and wait for a response</li>
              <li>Accept, counter, or cancel incoming offers</li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white/80 cd-head tracking-wider text-xs mb-1">NEGOTIATION FLOW</h4>
            <p>Trades are <span className="text-white/80 font-semibold">asynchronous</span> — you don't need to be online at the same time. When you send an offer, the other player sees it next time they check. They can accept it instantly, or counter with changes. The offer goes back and forth until both sides agree or someone cancels.</p>
          </div>

          <div>
            <h4 className="font-bold text-white/80 cd-head tracking-wider text-xs mb-1">CARD AVAILABILITY</h4>
            <p>Cards are <span className="text-white/80 font-semibold">not locked</span> during negotiation — you can still trade or sell them elsewhere. If a card becomes unavailable (traded, sold, dismantled), it shows as <span className="text-red-400 font-semibold">unavailable</span> in the offer and must be removed before sending.</p>
          </div>

          <div>
            <h4 className="font-bold text-white/80 cd-head tracking-wider text-xs mb-1">LIKES</h4>
            <p>In the Matches tab, you can also see who has swiped right on your cards — even before a mutual match. You can view their trade pile and start a trade directly from a like.</p>
          </div>

          <div>
            <h4 className="font-bold text-white/80 cd-head tracking-wider text-xs mb-1">TIPS</h4>
            <ul className="list-disc list-inside space-y-1 text-white/50">
              <li>Add plenty of cards to your trade pile to get more matches</li>
              <li>Use <span className="text-[var(--cd-cyan)]">Update Status</span> to check for new offers</li>
              <li>You can have up to <span className="text-white/80 font-semibold">15</span> active negotiations at once</li>
              <li>Inactive trades expire after 24 hours of no activity</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

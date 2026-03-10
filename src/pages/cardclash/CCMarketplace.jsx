import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { usePassion } from '../../context/PassionContext'
import { useCardClash } from './CardClashContext'
import { marketplaceService } from '../../services/database'
import { RARITIES } from '../../data/cardclash/economy'
import GameCard from './components/GameCard'
import TradingCard from '../../components/TradingCard'
import CardZoomModal from './components/CardZoomModal'
import { Search, X, ChevronLeft, ChevronRight, Tag, ShoppingCart, Plus, Loader2, AlertTriangle } from 'lucide-react'

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']
const CARD_TYPES = ['god', 'item', 'consumable', 'player']
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'rarity_asc', label: 'Rarity: Low to High' },
  { value: 'rarity_desc', label: 'Rarity: High to Low' },
]

const FEE_RATE = 0.02
const MIN_FEE = 1
const MAX_LISTINGS = 15
const BROWSE_CARD_SIZE = 140
const CREATE_CARD_SIZE = 120

const EMPTY_STATS = {
  gamesPlayed: 0, wins: 0, winRate: 0, kda: 0,
  avgDamage: 0, avgMitigated: 0,
  totalKills: 0, totalDeaths: 0, totalAssists: 0,
}

function calcFee(price) {
  return Math.max(Math.floor(price * FEE_RATE), MIN_FEE)
}

function buildCardData(card) {
  const d = card.cardData || {}
  return {
    name: card.godName,
    class: card.godClass,
    imageUrl: card.imageUrl,
    serialNumber: card.serialNumber,
    role: card.role || d.role,
    id: d.itemId || d.consumableId || card.serialNumber,
    ...d,
  }
}

function MarketCard({ card, size }) {
  if (card.cardType === 'player') {
    const d = card.cardData || {}
    return (
      <TradingCard
        playerName={card.godName}
        teamName={d.teamName}
        teamColor={d.teamColor}
        role={card.role || d.role}
        avatarUrl={card.imageUrl}
        variant="player"
        rarity={card.rarity}
        leagueName={d.leagueName}
        divisionName={d.divisionName}
        stats={EMPTY_STATS}
        size={size}
      />
    )
  }
  return <GameCard type={card.cardType || 'god'} rarity={card.rarity} data={buildCardData(card)} size={size} />
}

export default function CCMarketplace() {
  const { user } = useAuth()
  const passionCtx = usePassion()
  const { collection, refreshCollection } = useCardClash()

  const [view, setView] = useState('browse')
  const [listings, setListings] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [myListings, setMyListings] = useState(null)
  const [myActiveCount, setMyActiveCount] = useState(0)

  // Filters
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [rarity, setRarity] = useState([])
  const [cardType, setCardType] = useState([])
  const [sort, setSort] = useState('newest')

  // Modals
  const [buyModal, setBuyModal] = useState(null)
  const [createModal, setCreateModal] = useState(null)
  const [zoomedCard, setZoomedCard] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const limit = 24

  const fetchListings = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = { page: String(page), limit: String(limit), sort }
      if (rarity.length) params.rarity = rarity.join(',')
      if (cardType.length) params.cardType = cardType.join(',')
      if (search) params.search = search
      const data = await marketplaceService.list(params)
      setListings(data.listings || [])
      setTotal(data.total || 0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [page, sort, rarity, cardType, search])

  const fetchMyListings = useCallback(async () => {
    try {
      const data = await marketplaceService.getMyListings()
      setMyListings(data.listings || [])
      setMyActiveCount(data.activeCount || 0)
    } catch (err) {
      console.error('Failed to fetch my listings:', err)
    }
  }, [])

  useEffect(() => {
    if (view === 'browse') fetchListings()
  }, [view, fetchListings])

  useEffect(() => {
    if (view === 'my-listings') fetchMyListings()
  }, [view, fetchMyListings])

  const handleSearch = () => {
    setSearch(searchInput)
    setPage(0)
  }

  const toggleRarity = (r) => {
    setRarity(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])
    setPage(0)
  }

  const toggleCardType = (t) => {
    setCardType(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
    setPage(0)
  }

  const totalPages = Math.ceil(total / limit)

  const listedCardIds = useMemo(() => {
    if (!myListings) return new Set()
    return new Set(myListings.filter(l => l.status === 'active').map(l => l.cardId))
  }, [myListings])

  const listableCards = useMemo(() => {
    return collection.filter(c => !listedCardIds.has(c.id))
  }, [collection, listedCardIds])

  const handleBuy = async (listingId) => {
    setActionLoading(true)
    setError('')
    try {
      const result = await marketplaceService.buy({ listingId })
      setSuccess(`Purchased for ${result.price} Core (+ ${result.fee} Core fee)`)
      setBuyModal(null)
      fetchListings()
      refreshCollection?.()
      passionCtx?.refreshBalance?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleCreate = async (cardId, price) => {
    setActionLoading(true)
    setError('')
    try {
      await marketplaceService.create({ cardId, price })
      setSuccess('Listing created!')
      setCreateModal(null)
      fetchMyListings()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancel = async (listingId) => {
    setActionLoading(true)
    setError('')
    try {
      await marketplaceService.cancel(listingId)
      setSuccess('Listing cancelled')
      fetchMyListings()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(''), 4000)
      return () => clearTimeout(t)
    }
  }, [success])

  const handleCardZoom = (card) => {
    const type = card.cardType || 'god'
    if (type === 'player') {
      setZoomedCard({ playerCard: {
        defId: card.defId || card.cardData?.defId,
        playerName: card.godName,
        teamName: card.cardData?.teamName,
        teamColor: card.cardData?.teamColor,
        role: card.role,
        avatarUrl: card.imageUrl,
        rarity: card.rarity,
        leagueName: card.cardData?.leagueName,
        divisionName: card.cardData?.divisionName,
      }})
    } else {
      setZoomedCard({ gameCard: { type, rarity: card.rarity, data: buildCardData(card) } })
    }
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

      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => setView('browse')}
          className={`cd-head flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-wider transition-all cursor-pointer border ${
            view === 'browse'
              ? 'bg-[var(--cd-cyan)]/10 text-[var(--cd-cyan)] border-[var(--cd-cyan)]/30'
              : 'text-white/40 border-white/10 hover:text-white/60'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          Browse
        </button>
        <button
          onClick={() => { setView('my-listings'); if (!myListings) fetchMyListings() }}
          className={`cd-head flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-wider transition-all cursor-pointer border ${
            view === 'my-listings'
              ? 'bg-[var(--cd-cyan)]/10 text-[var(--cd-cyan)] border-[var(--cd-cyan)]/30'
              : 'text-white/40 border-white/10 hover:text-white/60'
          }`}
        >
          <Tag className="w-4 h-4" />
          My Listings
          {myActiveCount > 0 && (
            <span className="ml-1 text-xs bg-[var(--cd-cyan)]/20 px-1.5 py-0.5 rounded">{myActiveCount}/{MAX_LISTINGS}</span>
          )}
        </button>
        <button
          onClick={() => { setView('create'); if (!myListings) fetchMyListings() }}
          className={`cd-head flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-wider transition-all cursor-pointer border ${
            view === 'create'
              ? 'bg-[var(--cd-magenta)]/10 text-[var(--cd-magenta)] border-[var(--cd-magenta)]/30'
              : 'text-white/40 border-white/10 hover:text-white/60'
          }`}
        >
          <Plus className="w-4 h-4" />
          Sell Card
        </button>
      </div>

      {view === 'browse' && (
        <BrowseView
          listings={listings} total={total} page={page} totalPages={totalPages} loading={loading}
          search={searchInput} setSearch={setSearchInput} onSearch={handleSearch}
          rarity={rarity} toggleRarity={toggleRarity}
          cardType={cardType} toggleCardType={toggleCardType}
          sort={sort} setSort={(s) => { setSort(s); setPage(0) }}
          setPage={setPage}
          onBuy={(listing) => setBuyModal(listing)}
          onZoom={handleCardZoom}
          userId={user?.id}
        />
      )}

      {view === 'my-listings' && (
        <MyListingsView listings={myListings} onCancel={handleCancel} onZoom={handleCardZoom} actionLoading={actionLoading} />
      )}

      {view === 'create' && (
        <CreateListingView
          cards={listableCards}
          activeCount={myActiveCount}
          onCreate={(cardId) => setCreateModal(collection.find(c => c.id === cardId))}
          onZoom={handleCardZoom}
        />
      )}

      {buyModal && (
        <BuyModal
          listing={buyModal}
          onClose={() => setBuyModal(null)}
          onConfirm={handleBuy}
          loading={actionLoading}
          coreBalance={passionCtx?.ember?.balance ?? 0}
        />
      )}

      {createModal && (
        <CreateModal
          card={createModal}
          onClose={() => setCreateModal(null)}
          onCreate={handleCreate}
          loading={actionLoading}
        />
      )}

      {zoomedCard && (
        <CardZoomModal
          onClose={() => setZoomedCard(null)}
          gameCard={zoomedCard.gameCard}
          playerCard={zoomedCard.playerCard}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════
// Browse View
// ═══════════════════════════════════════
function BrowseView({
  listings, total, page, totalPages, loading,
  search, setSearch, onSearch,
  rarity, toggleRarity,
  cardType, toggleCardType,
  sort, setSort,
  setPage, onBuy, onZoom, userId,
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <div className="relative flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearch()}
              placeholder="Search cards..."
              className="w-full bg-[var(--cd-surface)] border border-[var(--cd-border)] text-white text-sm px-3 py-2 pr-8 rounded placeholder-white/20 focus:outline-none focus:border-[var(--cd-cyan)]/50"
            />
            <button onClick={onSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 cursor-pointer">
              <Search className="w-4 h-4" />
            </button>
          </div>
        </div>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="bg-[var(--cd-surface)] border border-[var(--cd-border)] text-white text-sm px-3 py-2 rounded focus:outline-none cursor-pointer"
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-[10px] text-white/30 uppercase tracking-wider cd-head">Rarity:</span>
        {RARITY_ORDER.map(r => (
          <button
            key={r}
            onClick={() => toggleRarity(r)}
            className={`text-xs px-2.5 py-1 rounded border transition-all cursor-pointer cd-head ${
              rarity.includes(r)
                ? 'border-current bg-current/10'
                : 'border-white/10 text-white/30 hover:text-white/50'
            }`}
            style={rarity.includes(r) ? { color: RARITIES[r].color } : {}}
          >
            {r}
          </button>
        ))}

        <span className="text-[10px] text-white/30 uppercase tracking-wider cd-head ml-3">Type:</span>
        {CARD_TYPES.map(t => (
          <button
            key={t}
            onClick={() => toggleCardType(t)}
            className={`text-xs px-2.5 py-1 rounded border transition-all cursor-pointer cd-head ${
              cardType.includes(t)
                ? 'border-[var(--cd-cyan)]/50 text-[var(--cd-cyan)] bg-[var(--cd-cyan)]/10'
                : 'border-white/10 text-white/30 hover:text-white/50'
            }`}
          >
            {t}
          </button>
        ))}

        {(rarity.length > 0 || cardType.length > 0) && (
          <button
            onClick={() => { rarity.forEach(r => toggleRarity(r)); cardType.forEach(t => toggleCardType(t)) }}
            className="text-xs text-white/30 hover:text-white/50 ml-2 cursor-pointer"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="text-xs text-white/30 mb-3 cd-head">
        {total} listing{total !== 1 ? 's' : ''} found
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-[var(--cd-cyan)] animate-spin" />
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-20 text-white/30">
          <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="cd-head text-lg">No listings found</p>
          <p className="text-sm mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-4">
          {listings.map(listing => (
            <ListingCard
              key={listing.id}
              listing={listing}
              onBuy={() => onBuy(listing)}
              onZoom={() => onZoom(listing.card)}
              isSelf={listing.sellerId === userId}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="text-white/40 hover:text-white disabled:opacity-20 cursor-pointer disabled:cursor-default"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-white/50 cd-mono">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="text-white/40 hover:text-white disabled:opacity-20 cursor-pointer disabled:cursor-default"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </>
  )
}

// ═══════════════════════════════════════
// Listing Card
// ═══════════════════════════════════════
function ListingCard({ listing, onBuy, onZoom, isSelf }) {
  const { card } = listing

  return (
    <div className="flex flex-col items-center" style={{ width: BROWSE_CARD_SIZE }}>
      <div className="card-zoomable" onClick={onZoom}>
        <MarketCard card={card} size={BROWSE_CARD_SIZE} />
      </div>

      <div className="w-full mt-2 space-y-1.5">
        <div className="flex items-center gap-1.5">
          {listing.sellerAvatar && (
            <img src={listing.sellerAvatar} alt="" className="w-3.5 h-3.5 rounded-full" />
          )}
          <span className="text-[10px] text-white/30 truncate">{listing.sellerName}</span>
        </div>

        <div className="text-sm font-bold text-orange-400 cd-num">
          {listing.price} <span className="text-[10px] text-orange-400/60">Core</span>
        </div>

        {!isSelf ? (
          <button
            onClick={onBuy}
            className="w-full text-[10px] font-bold uppercase tracking-wider py-1.5 rounded
              bg-[var(--cd-cyan)]/10 text-[var(--cd-cyan)] border border-[var(--cd-cyan)]/30
              hover:bg-[var(--cd-cyan)]/20 hover:shadow-[0_0_12px_rgba(0,229,255,0.15)]
              transition-all cursor-pointer cd-head"
          >
            Buy Now
          </button>
        ) : (
          <div className="text-[10px] text-white/20 text-center uppercase cd-head py-1.5">Your listing</div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
// My Listings View
// ═══════════════════════════════════════
function MyListingsView({ listings, onCancel, onZoom, actionLoading }) {
  if (!listings) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-[var(--cd-cyan)] animate-spin" />
      </div>
    )
  }

  if (listings.length === 0) {
    return (
      <div className="text-center py-20 text-white/30">
        <Tag className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="cd-head text-lg">No listings yet</p>
        <p className="text-sm mt-1">Sell a card to get started</p>
      </div>
    )
  }

  const active = listings.filter(l => l.status === 'active')
  const past = listings.filter(l => l.status !== 'active')

  return (
    <div>
      {active.length > 0 && (
        <>
          <h3 className="cd-head text-sm text-[var(--cd-cyan)] mb-3 tracking-wider">Active Listings ({active.length}/{MAX_LISTINGS})</h3>
          <div className="flex flex-wrap gap-4 mb-8">
            {active.map(listing => (
                <div key={listing.id} className="flex flex-col items-center" style={{ width: BROWSE_CARD_SIZE }}>
                  <div className="card-zoomable" onClick={() => onZoom(listing.card)}>
                    <MarketCard card={listing.card} size={BROWSE_CARD_SIZE} />
                  </div>
                  <div className="w-full mt-2 space-y-1.5">
                    <div className="text-sm font-bold text-orange-400 cd-num">
                      {listing.price} <span className="text-[10px] text-orange-400/60">Core</span>
                    </div>
                    <button
                      onClick={() => onCancel(listing.id)}
                      disabled={actionLoading}
                      className="w-full text-[10px] font-bold uppercase tracking-wider py-1.5 rounded
                        bg-red-500/10 text-red-400 border border-red-500/30
                        hover:bg-red-500/20 transition-all cursor-pointer cd-head
                        disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
            ))}
          </div>
        </>
      )}

      {past.length > 0 && (
        <>
          <h3 className="cd-head text-sm text-white/40 mb-3 tracking-wider">History</h3>
          <div className="flex flex-wrap gap-4">
            {past.map(listing => (
                <div key={listing.id} className="flex flex-col items-center opacity-50" style={{ width: BROWSE_CARD_SIZE }}>
                  <MarketCard card={listing.card} size={BROWSE_CARD_SIZE} />
                  <div className="w-full mt-2 space-y-1">
                    <div className="text-sm font-bold text-orange-400/60 cd-num">
                      {listing.price} <span className="text-[10px]">Core</span>
                    </div>
                    <div className={`text-[10px] text-center uppercase cd-head ${
                      listing.status === 'sold' ? 'text-emerald-400' : 'text-white/30'
                    }`}>
                      {listing.status === 'sold' ? `Sold to ${listing.buyerName || 'someone'}` : 'Cancelled'}
                    </div>
                  </div>
                </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════
// Create Listing View
// ═══════════════════════════════════════
function CreateListingView({ cards, activeCount, onCreate, onZoom }) {
  const [filter, setFilter] = useState('')

  const filtered = useMemo(() => {
    if (!filter) return cards
    const q = filter.toLowerCase()
    return cards.filter(c => c.godName.toLowerCase().includes(q))
  }, [cards, filter])

  if (activeCount >= MAX_LISTINGS) {
    return (
      <div className="text-center py-20 text-amber-400">
        <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p className="cd-head text-lg">Listing Limit Reached</p>
        <p className="text-sm mt-1 text-white/40">Cancel an existing listing to create a new one</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className="cd-head text-sm text-[var(--cd-cyan)] tracking-wider">Select a card to sell</span>
        <span className="text-xs text-white/30">({activeCount}/{MAX_LISTINGS} slots used)</span>
      </div>

      <div className="relative mb-4 max-w-sm">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter your cards..."
          className="w-full bg-[var(--cd-surface)] border border-[var(--cd-border)] text-white text-sm px-3 py-2 rounded placeholder-white/20 focus:outline-none focus:border-[var(--cd-cyan)]/50"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-white/30">
          <p className="text-sm">No cards available to sell</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {filtered.map(card => (
              <div
                key={card.id}
                className="cursor-pointer card-zoomable"
                onClick={() => onCreate(card.id)}
              >
                <MarketCard card={card} size={CREATE_CARD_SIZE} />
              </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════
// Buy Modal
// ═══════════════════════════════════════
function BuyModal({ listing, onClose, onConfirm, loading, coreBalance }) {
  const { card } = listing
  const price = listing.price
  const fee = calcFee(price)
  const totalCost = price + fee
  const canAfford = coreBalance >= totalCost

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--cd-surface)] border border-[var(--cd-border)] rounded-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="cd-head text-lg text-[var(--cd-cyan)] tracking-wider mb-4">Confirm Purchase</h3>

        <div className="flex justify-center mb-4">
          <MarketCard card={card} size={160} />
        </div>

        <div className="space-y-1.5 text-sm mb-4">
          <div className="flex justify-between">
            <span className="text-white/50">Price</span>
            <span className="text-white font-bold cd-num">{price} Core</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/50">Fee (2%)</span>
            <span className="text-white/70 cd-num">{fee} Core</span>
          </div>
          <div className="border-t border-[var(--cd-border)] pt-1.5 flex justify-between font-bold">
            <span className="text-white/70">Total</span>
            <span className="text-white cd-num">{totalCost} Core</span>
          </div>
        </div>

        <div className="text-[11px] text-white/30 mb-4">
          Your balance: {coreBalance} Core
        </div>

        {!canAfford && (
          <div className="text-sm text-red-400 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Insufficient Core balance
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 text-sm font-bold uppercase py-2 rounded border border-white/10 text-white/40 hover:text-white/60 transition-all cursor-pointer cd-head"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(listing.id)}
            disabled={loading || !canAfford}
            className="flex-1 text-sm font-bold uppercase py-2 rounded
              bg-[var(--cd-cyan)]/10 text-[var(--cd-cyan)] border border-[var(--cd-cyan)]/30
              hover:bg-[var(--cd-cyan)]/20 hover:shadow-[0_0_12px_rgba(0,229,255,0.15)]
              transition-all cursor-pointer cd-head
              disabled:opacity-50 disabled:cursor-default"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
// Create Listing Modal
// ═══════════════════════════════════════
function CreateModal({ card, onClose, onCreate, loading }) {
  const [price, setPrice] = useState('')
  const priceNum = parseInt(price) || 0
  const fee = priceNum > 0 ? calcFee(priceNum) : 0
  const canSubmit = priceNum >= 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--cd-surface)] border border-[var(--cd-border)] rounded-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="cd-head text-lg text-[var(--cd-magenta)] tracking-wider mb-4">Create Listing</h3>

        <div className="flex justify-center mb-4">
          <MarketCard card={card} size={160} />
        </div>

        <div className="mb-3">
          <label className="text-[10px] text-white/40 uppercase cd-head tracking-wider block mb-1">Price (Core)</label>
          <input
            type="number"
            min="1"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Amount..."
            className="w-full bg-[var(--cd-edge)] border border-[var(--cd-border)] text-orange-400 text-sm px-3 py-2 rounded placeholder-white/15 focus:outline-none focus:border-orange-500/50 cd-num"
          />
        </div>

        {fee > 0 && (
          <div className="text-[11px] text-white/30 mb-4">
            Buyer fee: {fee} Core &middot; Seller fee (you): {fee} Core
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 text-sm font-bold uppercase py-2 rounded border border-white/10 text-white/40 hover:text-white/60 transition-all cursor-pointer cd-head"
          >
            Cancel
          </button>
          <button
            onClick={() => onCreate(card.id, priceNum)}
            disabled={loading || !canSubmit}
            className="flex-1 text-sm font-bold uppercase py-2 rounded
              bg-[var(--cd-magenta)]/10 text-[var(--cd-magenta)] border border-[var(--cd-magenta)]/30
              hover:bg-[var(--cd-magenta)]/20 hover:shadow-[0_0_12px_rgba(255,45,120,0.15)]
              transition-all cursor-pointer cd-head
              disabled:opacity-50 disabled:cursor-default"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'List for Sale'}
          </button>
        </div>
      </div>
    </div>
  )
}

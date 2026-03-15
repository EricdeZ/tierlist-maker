import { RARITIES } from '../../../data/vault/economy'
import WantedPoster from '../components/WantedPoster'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const CARD_TYPES = ['god', 'player', 'item', 'consumable']
const HOLO_TYPES = ['holo', 'reverse', 'full']
const HOLO_LABELS = { holo: 'Holo', reverse: 'Reverse', full: 'Full Art' }
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'unique']
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'reward_desc', label: 'Reward: High to Low' },
  { value: 'reward_asc', label: 'Reward: Low to High' },
  { value: 'expiring', label: 'Expiring Soon' },
]
const PAGE_SIZE = 24

export default function BountyGrid({
  bounties, total, page, setPage,
  filters, setFilters,
  sort, setSort,
  fulfillableIds, myBountyIds, myBountyHistory,
  onFulfill, onCancel,
  showFulfillable, setShowFulfillable,
  showMine, setShowMine,
}) {
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const toggleFilter = (key, value) => {
    setFilters(prev => {
      const arr = prev[key] || []
      return {
        ...prev,
        [key]: arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value],
      }
    })
    setPage(0)
  }

  const hasFilters =
    (filters.rarity?.length > 0) ||
    (filters.cardType?.length > 0) ||
    (filters.holoType?.length > 0) ||
    showFulfillable ||
    showMine

  const clearAll = () => {
    setFilters({ rarity: [], cardType: [], holoType: [] })
    setShowFulfillable(false)
    setShowMine(false)
    setPage(0)
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-4">
        {/* Quick filters */}
        <button
          onClick={() => { setShowFulfillable(!showFulfillable); setPage(0) }}
          className={`text-[10px] sm:text-xs px-2 sm:px-2.5 py-1 rounded border transition-all cursor-pointer cd-head ${
            showFulfillable
              ? 'border-[var(--cd-cyan)]/50 text-[var(--cd-cyan)] bg-[var(--cd-cyan)]/10'
              : 'border-white/10 text-white/30 hover:text-white/50'
          }`}
        >
          Can Turn In
        </button>
        <button
          onClick={() => { setShowMine(!showMine); setPage(0) }}
          className={`text-[10px] sm:text-xs px-2 sm:px-2.5 py-1 rounded border transition-all cursor-pointer cd-head ${
            showMine
              ? 'border-[#ff8c00]/50 text-[#ff8c00] bg-[#ff8c00]/10'
              : 'border-white/10 text-white/30 hover:text-white/50'
          }`}
        >
          My Bounties
        </button>

        <span className="text-[10px] text-white/20 mx-1">|</span>

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value); setPage(0) }}
          className="bg-[var(--cd-surface)] border border-[var(--cd-border)] text-white text-[10px] sm:text-xs px-2 py-1 rounded focus:outline-none cursor-pointer"
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <span className="text-[10px] text-white/20 mx-1">|</span>

        {/* Rarity pills */}
        <span className="text-[10px] text-white/30 uppercase tracking-wider cd-head">Rarity:</span>
        {RARITY_ORDER.map(r => (
          <button
            key={r}
            onClick={() => toggleFilter('rarity', r)}
            className={`text-[10px] sm:text-xs px-2 sm:px-2.5 py-1 rounded border transition-all cursor-pointer cd-head ${
              filters.rarity?.includes(r)
                ? 'border-current bg-current/10'
                : 'border-white/10 text-white/30 hover:text-white/50'
            }`}
            style={filters.rarity?.includes(r) ? { color: RARITIES[r].color } : {}}
          >
            {r}
          </button>
        ))}

        {/* Card type */}
        <span className="text-[10px] text-white/30 uppercase tracking-wider cd-head sm:ml-3">Type:</span>
        {CARD_TYPES.map(t => (
          <button
            key={t}
            onClick={() => toggleFilter('cardType', t)}
            className={`text-[10px] sm:text-xs px-2 sm:px-2.5 py-1 rounded border transition-all cursor-pointer cd-head ${
              filters.cardType?.includes(t)
                ? 'border-[var(--cd-cyan)]/50 text-[var(--cd-cyan)] bg-[var(--cd-cyan)]/10'
                : 'border-white/10 text-white/30 hover:text-white/50'
            }`}
          >
            {t}
          </button>
        ))}

        {/* Holo type */}
        <span className="text-[10px] text-white/30 uppercase tracking-wider cd-head sm:ml-3">Holo:</span>
        {HOLO_TYPES.map(h => (
          <button
            key={h}
            onClick={() => toggleFilter('holoType', h)}
            className={`text-[10px] sm:text-xs px-2 sm:px-2.5 py-1 rounded border transition-all cursor-pointer cd-head ${
              filters.holoType?.includes(h)
                ? 'border-[var(--cd-purple)]/50 text-[var(--cd-purple)] bg-[var(--cd-purple)]/10'
                : 'border-white/10 text-white/30 hover:text-white/50'
            }`}
          >
            {HOLO_LABELS[h]}
          </button>
        ))}

        {/* Clear all */}
        {hasFilters && (
          <button
            onClick={clearAll}
            className="text-xs text-white/30 hover:text-white/50 ml-2 cursor-pointer"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Results count */}
      <div className="text-xs text-white/30 mb-3 cd-head">
        {total} bount{total !== 1 ? 'ies' : 'y'} found
      </div>

      {/* Grid */}
      {bounties.length === 0 ? (
        <div className="text-center py-16 text-white/30">
          <p className="cd-head text-lg">No bounties found</p>
          <p className="text-sm mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-4 justify-center sm:justify-start">
          {bounties.map(b => (
            <WantedPoster
              key={b.id}
              bounty={b}
              size="sm"
              canFulfill={fulfillableIds?.includes(b.id)}
              isMine={myBountyIds?.includes(b.id)}
              onFulfill={onFulfill}
              onCancel={onCancel}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
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

      {/* My bounty history */}
      {showMine && myBountyHistory?.length > 0 && (
        <div className="mt-8">
          <div className="border-t mb-5" style={{ borderColor: 'rgba(255,140,0,0.1)' }} />
          <div className="text-xs text-white/30 uppercase tracking-wider cd-head mb-3">
            History ({myBountyHistory.length})
          </div>
          <div className="flex flex-wrap gap-4 justify-center sm:justify-start">
            {myBountyHistory.map(b => (
              <WantedPoster
                key={b.id}
                bounty={b}
                size="sm"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

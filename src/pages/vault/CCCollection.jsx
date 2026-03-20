import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { vaultService } from '../../services/database'
import { getGameCardEntries, getPlayerCardNumber, TOTAL_GAME_CARDS } from '../../data/vault/cardIndex'
import { RARITIES } from '../../data/vault/economy'
import { GODS } from '../../data/vault/gods'
import { ITEMS } from '../../data/vault/items'
import { CONSUMABLES } from '../../data/vault/buffs'
import GameCard from './components/GameCard'
import TradingCard from '../../components/TradingCard'
import CardZoomModal from './components/CardZoomModal'
import { getLeagueLogo } from '../../utils/leagueImages'
import { getDivisionImage } from '../../utils/divisionImages'
import { Library, Trophy, Eye, EyeOff, ChevronDown, ChevronRight, Search, X, Clock, ArrowUpDown } from 'lucide-react'

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'unique']
const BATCH_SIZE = 50

const SORT_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'alpha-asc', label: 'A → Z' },
  { value: 'alpha-desc', label: 'Z → A' },
  { value: 'rarity-desc', label: 'Rarity (Highest)' },
  { value: 'rarity-asc', label: 'Rarity (Lowest)' },
  { value: 'duplicates', label: 'Most Duplicates' },
]

// Only types acquirable in packs
const COLLECTION_TYPES = ['god', 'item', 'consumable']

const GAME_SECTIONS = [
  { type: 'god', label: 'Gods', icon: '⚔' },
  { type: 'item', label: 'Items', icon: '🛡' },
  { type: 'consumable', label: 'Consumables', icon: '🧪' },
]

// Full data lookups for rendering actual cards
const GOD_MAP = new Map(GODS.map(g => [g.slug, g]))
const ITEM_MAP = new Map(ITEMS.map(i => [String(i.id), i]))
const CONSUMABLE_MAP = new Map(CONSUMABLES.map(c => [c.id, c]))
const DATA_MAPS = { god: GOD_MAP, item: ITEM_MAP, consumable: CONSUMABLE_MAP }

function entryGodId(entry, type) {
  if (type === 'god') return entry.identifier
  return entry.godId
}

function entryDataKey(entry, type) {
  return entry.identifier || entry.godId?.replace(/^(item|consumable)-/, '')
}

function highestRarity(ownedRarities) {
  for (let i = RARITY_ORDER.length - 1; i >= 0; i--) {
    if (ownedRarities.includes(RARITY_ORDER[i])) return RARITY_ORDER[i]
  }
  return 'common'
}

function seasonNumber(seasonSlug) {
  return seasonSlug?.replace(/\D/g, '') || '1'
}

// Cache
const CATALOG_TTL = 60 * 60 * 1000
const SET_DEF_TTL = 24 * 60 * 60 * 1000

function cacheGet(key, ttl) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const { ts, data } = JSON.parse(raw)
    if (Date.now() - ts > ttl) { localStorage.removeItem(key); return null }
    return data
  } catch { return null }
}

function cacheSet(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })) } catch {}
}

const CARD_SIZE = 150
const PLAYER_CARD_SIZE = 160

export default function CCCollection() {
  const [loading, setLoading] = useState(true)
  const [catalog, setCatalog] = useState(null)
  const [owned, setOwned] = useState(null)
  const [setDefs, setSetDefs] = useState({})
  const [loadingSet, setLoadingSet] = useState(null)
  const [activeSection, setActiveSection] = useState('god')
  const [defOverrides, setDefOverrides] = useState({})
  const [zoomedCard, setZoomedCard] = useState(null)
  const [viewMode, setViewMode] = useState('all') // 'all' | 'owned'
  const [rarityFilter, setRarityFilter] = useState(null)
  const [displayLimit, setDisplayLimit] = useState(BATCH_SIZE)
  const [sortMode, setSortMode] = useState('default')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [recentPulls, setRecentPulls] = useState([])
  const [recentOpen, setRecentOpen] = useState(false)
  const searchTimerRef = useRef(null)
  const loadedSetsRef = useRef(new Set())

  const switchSection = useCallback((section) => {
    setActiveSection(section)
    setSearchQuery('')
    setSearchResults(null)
  }, [])

  useEffect(() => {
    const loadData = async () => {
      try {
        let cat = cacheGet('cd-catalog', CATALOG_TTL)
        const ownedPromise = vaultService.getCollectionOwned()
        const overridesPromise = vaultService.getDefinitionOverrides().catch(() => ({ overrides: {} }))

        if (!cat) {
          cat = await vaultService.getCollectionCatalog()
          cacheSet('cd-catalog', cat)
        }

        const [ownedData, overridesData] = await Promise.all([ownedPromise, overridesPromise])
        setCatalog(cat)
        setOwned(ownedData)
        setRecentPulls(ownedData.recentPulls || [])
        setDefOverrides(overridesData.overrides || {})
      } catch {}
      setLoading(false)
    }
    loadData()
  }, [])

  const applyOverride = useCallback((type, id, data) => {
    let override = defOverrides[`${type}:${id}`]
    if (!override && type === 'god' && data.role) {
      override = defOverrides[`god:${id.replace(`-${data.role}`, '')}`]
    }
    if (!override) return data
    return { ...data, metadata: override, imageUrl: override.custom_image_url || data.imageUrl }
  }, [defOverrides])

  const loadPlayerSet = useCallback(async (setKey) => {
    if (loadedSetsRef.current.has(setKey)) return
    loadedSetsRef.current.add(setKey)

    const cached = cacheGet(`cd-set3-${setKey}`, SET_DEF_TTL)
    if (cached) {
      setSetDefs(prev => ({ ...prev, [setKey]: cached }))
      return
    }

    setLoadingSet(setKey)
    try {
      const data = await vaultService.getCollectionSet(setKey)
      cacheSet(`cd-set3-${setKey}`, data.cards)
      setSetDefs(prev => ({ ...prev, [setKey]: data.cards }))
    } catch {}
    setLoadingSet(null)
  }, [])

  useEffect(() => {
    if (activeSection.startsWith('player:') && activeSection !== 'player:all') {
      loadPlayerSet(activeSection.replace('player:', ''))
    }
  }, [activeSection, loadPlayerSet])

  // Reset display limit when switching sections or filters
  useEffect(() => {
    setDisplayLimit(BATCH_SIZE)
  }, [activeSection, viewMode, rarityFilter, sortMode])

  // Debounced player card search
  useEffect(() => {
    clearTimeout(searchTimerRef.current)
    if (searchQuery.trim().length < 2) {
      setSearchResults(null)
      setSearchLoading(false)
      return
    }
    setSearchLoading(true)
    searchTimerRef.current = setTimeout(async () => {
      try {
        const data = await vaultService.searchCollection(searchQuery.trim())
        setSearchResults(data.results)
      } catch {
        setSearchResults([])
      }
      setSearchLoading(false)
    }, 300)
    return () => clearTimeout(searchTimerRef.current)
  }, [searchQuery])

  // Build game entries with ownership merged (only collectible types)
  const gameEntries = useMemo(() => {
    if (!owned) return {}
    const result = {}
    for (const type of COLLECTION_TYPES) {
      const entries = getGameCardEntries(type)
      result[type] = entries.map(e => {
        const godId = entryGodId(e, type)
        const ownedRarities = owned.gameCards?.[`${type}:${godId}`] || []
        return { ...e, collected: ownedRarities.length > 0, ownedRarities }
      })
    }
    return result
  }, [owned])

  // Derived data — all hooks must be above early returns
  // Use defIds from catalog to compute collected counts without needing lazy-loaded set defs
  const playerSets = useMemo(() => {
    if (!catalog || !owned) return []
    return (catalog.playerSets || []).filter(s => s.seasonActive).map(set => {
      const collected = (set.defIds || []).filter(id => !!owned.playerCards?.[id]).length
      return { ...set, collected }
    })
  }, [catalog, owned])

  const leagueSeasonGroups = useMemo(() => {
    const groups = new Map()
    for (const set of playerSets) {
      const groupKey = `${set.leagueSlug}-${set.seasonSlug}`
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          key: groupKey,
          leagueSlug: set.leagueSlug,
          seasonSlug: set.seasonSlug,
          seasonActive: set.seasonActive,
          label: `${set.leagueSlug.toUpperCase()} (S${seasonNumber(set.seasonSlug)})`,
          divisions: [],
        })
      }
      groups.get(groupKey).divisions.push(set)
    }
    return [...groups.values()]
  }, [playerSets])

  // Load all player sets when "All Players" is selected
  useEffect(() => {
    if (activeSection === 'player:all') {
      for (const set of playerSets) loadPlayerSet(set.key)
    }
  }, [activeSection, playerSets, loadPlayerSet])

  const { gameTotals, totalGameCollected, totalGameCards } = useMemo(() => {
    const totals = {}
    let collected = 0
    let total = 0
    for (const type of COLLECTION_TYPES) {
      const entries = gameEntries[type] || []
      const c = entries.filter(e => e.collected).length
      totals[type] = { total: entries.length, collected: c }
      collected += c
      total += entries.length
    }
    return { gameTotals: totals, totalGameCollected: collected, totalGameCards: total }
  }, [gameEntries])

  const totalPlayerCards = playerSets.reduce((s, set) => s + set.total, 0)
  const totalPlayerCollected = playerSets.reduce((s, set) => s + set.collected, 0)

  const isPlayerSection = activeSection.startsWith('player:')
  const activePlayerSetKey = isPlayerSection ? activeSection.replace('player:', '') : null
  const activePlayerSetMeta = activePlayerSetKey
    ? playerSets.find(s => s.key === activePlayerSetKey)
    : null

  const activePlayerCards = useMemo(() => {
    if (!activePlayerSetKey || !setDefs[activePlayerSetKey] || !owned) return []
    return setDefs[activePlayerSetKey].map(d => ({
      ...d,
      collected: !!owned.playerCards?.[d.defId],
      ownedRarities: owned.playerCards?.[d.defId] || [],
      feRarities: owned.firstEditions?.[d.defId] || [],
    }))
  }, [activePlayerSetKey, setDefs, owned])

  // All player cards across all sets (for "All Players" view)
  const allPlayerCards = useMemo(() => {
    if (activeSection !== 'player:all' || !owned) return []
    const cards = []
    for (const set of playerSets) {
      const defs = setDefs[set.key]
      if (!defs) continue
      for (const d of defs) {
        cards.push({
          ...d,
          collected: !!owned.playerCards?.[d.defId],
          ownedRarities: owned.playerCards?.[d.defId] || [],
          feRarities: owned.firstEditions?.[d.defId] || [],
          _setMeta: set,
        })
      }
    }
    return cards
  }, [activeSection, playerSets, setDefs, owned])

  const allSetsLoaded = activeSection === 'player:all' ? playerSets.every(s => setDefs[s.key]) : true

  // Unified filtered entries for active section
  const filteredEntries = useMemo(() => {
    let entries
    if (COLLECTION_TYPES.includes(activeSection)) {
      entries = gameEntries[activeSection] || []
    } else if (activeSection === 'player:all') {
      entries = allPlayerCards
    } else if (activeSection.startsWith('player:')) {
      entries = activePlayerCards
    } else {
      return []
    }
    if (viewMode === 'owned') entries = entries.filter(e => e.collected)
    if (rarityFilter) entries = entries.filter(e => e.ownedRarities?.includes(rarityFilter))

    if (sortMode !== 'default') {
      entries = [...entries]
      const getName = e => (e.name || e.playerName || '').toLowerCase()
      const getHighestRarityIndex = e => {
        if (!e.ownedRarities?.length) return -1
        return Math.max(...e.ownedRarities.map(r => RARITY_ORDER.indexOf(r)))
      }
      entries.sort((a, b) => {
        switch (sortMode) {
          case 'alpha-asc': return getName(a).localeCompare(getName(b))
          case 'alpha-desc': return getName(b).localeCompare(getName(a))
          case 'rarity-desc': return getHighestRarityIndex(b) - getHighestRarityIndex(a)
          case 'rarity-asc': return getHighestRarityIndex(a) - getHighestRarityIndex(b)
          case 'duplicates': return (b.ownedRarities?.length || 0) - (a.ownedRarities?.length || 0)
          default: return 0
        }
      })
    }

    return entries
  }, [activeSection, gameEntries, allPlayerCards, activePlayerCards, viewMode, rarityFilter, sortMode])

  const hasMore = displayLimit < filteredEntries.length
  const remaining = filteredEntries.length - displayLimit

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="cd-spinner w-8 h-8" />
      </div>
    )
  }

  if (!catalog || !owned) {
    return (
      <div className="text-center py-20 text-[var(--cd-text-dim)]">
        <Library className="w-16 h-16 mx-auto mb-4 opacity-20" />
        <p className="text-lg font-bold cd-head">Failed to load collection</p>
      </div>
    )
  }

  return (
    <div className="p-0 sm:p-6">
      <div className="mb-6 cd-section-accent pb-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[var(--cd-text)] cd-head">Collection</h1>
          <button
            onClick={() => setViewMode(v => v === 'all' ? 'owned' : 'all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer cd-head ${
              viewMode === 'owned'
                ? 'bg-[var(--cd-cyan)]/15 text-[var(--cd-cyan)] border border-[var(--cd-cyan)]/25'
                : 'bg-white/[0.04] text-[var(--cd-text-mid)] border border-transparent hover:bg-white/[0.06]'
            }`}
          >
            {viewMode === 'owned' ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {viewMode === 'owned' ? 'Owned' : 'All'}
          </button>
        </div>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--cd-text-dim)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search player cards..."
            className="w-full pl-9 pr-8 py-2 rounded-lg bg-[var(--cd-surface)] border border-[var(--cd-border)] text-sm text-[var(--cd-text)] placeholder-[var(--cd-text-dim)] focus:outline-none focus:border-[var(--cd-cyan)]/40 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--cd-text-dim)] hover:text-[var(--cd-text)] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-6 mt-2 text-sm">
          <div className="text-[var(--cd-text-mid)]">
            Game Cards: <span className="text-[var(--cd-cyan)] cd-num font-bold">{totalGameCollected}</span>
            <span className="text-[var(--cd-text-dim)]">/{totalGameCards}</span>
          </div>
          {totalPlayerCards > 0 && (
            <div className="text-[var(--cd-text-mid)]">
              Player Cards: <span className="text-[var(--cd-cyan)] cd-num font-bold">{totalPlayerCollected}</span>
              <span className="text-[var(--cd-text-dim)]">/{totalPlayerCards}</span>
            </div>
          )}
        </div>
      </div>

      {recentPulls.length > 0 && (
        <RecentPulls
          pulls={recentPulls}
          open={recentOpen}
          onToggle={() => setRecentOpen(o => !o)}
          defOverrides={defOverrides}
          applyOverride={applyOverride}
          onZoom={setZoomedCard}
          owned={owned}
        />
      )}

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* Sidebar — horizontal pills on mobile, vertical on desktop */}
        <div className="lg:w-52 lg:shrink-0">
          {/* Mobile: horizontal scrollable pills */}
          <div className="lg:hidden relative">
          <div className="flex gap-2 overflow-x-auto pb-2 pr-6" style={{ scrollbarWidth: 'none' }}>
            {GAME_SECTIONS.map(s => {
              const active = activeSection === s.type
              return (
                <button
                  key={s.type}
                  onClick={() => switchSection(s.type)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer cd-head ${
                    active
                      ? 'bg-[var(--cd-cyan)]/15 text-[var(--cd-cyan)] border border-[var(--cd-cyan)]/25'
                      : 'bg-white/[0.04] text-[var(--cd-text-mid)] hover:bg-white/[0.06]'
                  }`}
                >
                  <span>{s.icon}</span>
                  <span>{s.label}</span>
                </button>
              )
            })}
            {playerSets.length > 0 && (
              <button
                onClick={() => switchSection('player:all')}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer cd-head ${
                  activeSection === 'player:all'
                    ? 'bg-[var(--cd-cyan)]/15 text-[var(--cd-cyan)] border border-[var(--cd-cyan)]/25'
                    : 'bg-white/[0.04] text-[var(--cd-text-mid)] hover:bg-white/[0.06]'
                }`}
              >
                <span>All Players</span>
              </button>
            )}
            {leagueSeasonGroups.flatMap(group =>
              group.divisions.map(set => {
                const active = activeSection === `player:${set.key}`
                const divImg = getDivisionImage(set.leagueSlug, set.divisionSlug, set.divisionTier)
                return (
                  <button
                    key={set.key}
                    onClick={() => switchSection(`player:${set.key}`)}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer cd-head ${
                      active
                        ? 'bg-[var(--cd-cyan)]/15 text-[var(--cd-cyan)] border border-[var(--cd-cyan)]/25'
                        : 'bg-white/[0.04] text-[var(--cd-text-mid)] hover:bg-white/[0.06]'
                    }`}
                  >
                    {divImg && <img src={divImg} alt="" className="w-4 h-4 object-contain shrink-0" />}
                    <span>{set.divisionName || 'Division'}</span>
                  </button>
                )
              })
            )}
          </div>
          {/* Scroll arrow hint */}
          <div className="absolute right-0 top-0 bottom-2 w-8 flex items-center justify-center pointer-events-none" style={{ background: 'linear-gradient(to right, transparent, var(--cd-edge))' }}>
            <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
          </div>

          {/* Desktop: existing vertical sidebar */}
          <div className="hidden lg:block space-y-1">
            <div className="text-[10px] text-[var(--cd-text-dim)] uppercase tracking-wider font-bold mb-2 cd-head">Game Cards</div>
            {GAME_SECTIONS.map(s => {
              const t = gameTotals[s.type] || { total: 0, collected: 0 }
              const active = activeSection === s.type
              return (
                <button
                  key={s.type}
                  onClick={() => switchSection(s.type)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer cd-head text-left ${
                    active
                      ? 'bg-[var(--cd-cyan)]/10 text-[var(--cd-cyan)] border border-[var(--cd-cyan)]/20'
                      : 'text-[var(--cd-text-mid)] hover:bg-white/[0.03] hover:text-[var(--cd-text)]'
                  }`}
                >
                  <span className="text-xs">{s.icon}</span>
                  <span className="flex-1">{s.label}</span>
                  <span className="text-xs cd-num text-[var(--cd-text)]">{t.collected}/{t.total}</span>
                </button>
              )
            })}

            {leagueSeasonGroups.length > 0 && (
              <>
                <div className="text-[10px] text-[var(--cd-text-dim)] uppercase tracking-wider font-bold mt-4 mb-2 cd-head">Player Sets</div>
                <button
                  onClick={() => switchSection('player:all')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer cd-head text-left ${
                    activeSection === 'player:all'
                      ? 'bg-[var(--cd-cyan)]/10 text-[var(--cd-cyan)] border border-[var(--cd-cyan)]/20'
                      : 'text-[var(--cd-text-mid)] hover:bg-white/[0.03] hover:text-[var(--cd-text)]'
                  }`}
                >
                  <span className="flex-1">All Players</span>
                  <span className="text-xs cd-num text-[var(--cd-text)]">{totalPlayerCollected}/{totalPlayerCards}</span>
                </button>
                {leagueSeasonGroups.map(group => {
                  const leagueLogo = getLeagueLogo(group.leagueSlug)
                  return (
                    <div key={group.key}>
                      <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold text-[var(--cd-text-dim)] uppercase tracking-wider cd-head">
                        {leagueLogo && <img src={leagueLogo} alt="" className="w-4 h-4 object-contain" />}
                        <span>{group.label}</span>
                      </div>
                      {group.divisions.map(set => {
                        const active = activeSection === `player:${set.key}`
                        const divImg = getDivisionImage(set.leagueSlug, set.divisionSlug, set.divisionTier)
                        return (
                          <button
                            key={set.key}
                            onClick={() => switchSection(`player:${set.key}`)}
                            className={`w-full flex items-center gap-2 px-3 pl-6 py-1.5 rounded-lg text-sm font-bold transition-all cursor-pointer cd-head text-left ${
                              active
                                ? 'bg-[var(--cd-cyan)]/10 text-[var(--cd-cyan)] border border-[var(--cd-cyan)]/20'
                                : 'text-[var(--cd-text-mid)] hover:bg-white/[0.03] hover:text-[var(--cd-text)]'
                            }`}
                          >
                            {divImg && <img src={divImg} alt="" className="w-4 h-4 object-contain shrink-0" />}
                            <span className="flex-1 truncate">{set.divisionName || `Division ${set.divisionTier}`}</span>
                            <span className="text-xs cd-num text-[var(--cd-text)]">{set.collected}/{set.total}</span>
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Search results mode */}
          {searchQuery.trim().length >= 2 ? (
            <div>
              <h2 className="text-lg font-bold cd-head text-[var(--cd-text)] mb-3">
                Search: "{searchQuery.trim()}"
              </h2>
              {searchLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="cd-spinner w-6 h-6" />
                </div>
              ) : !searchResults || searchResults.length === 0 ? (
                <div className="text-center py-16 text-[var(--cd-text-dim)]">
                  <Search className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm font-bold cd-head">No player cards found</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
                  {searchResults.filter(card => {
                    if (viewMode === 'owned' && !owned.playerCards?.[card.defId]) return false
                    if (rarityFilter && !(owned.playerCards?.[card.defId] || []).includes(rarityFilter)) return false
                    return true
                  }).map(card => {
                    const collected = !!owned.playerCards?.[card.defId]
                    const ownedRarities = owned.playerCards?.[card.defId] || []
                    const meta = {
                      leagueSlug: card.leagueSlug,
                      divisionTier: card.divisionTier,
                      divisionSlug: card.divisionSlug,
                      divisionName: card.divisionName,
                      seasonSlug: card.seasonSlug,
                    }
                    return (
                      <PlayerSlot
                        key={card.defId}
                        card={{ ...card, collected, ownedRarities, feRarities: owned.firstEditions?.[card.defId] || [] }}
                        meta={meta}
                        onZoom={setZoomedCard}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
          <>
          <div className="flex items-center gap-3 mb-4">
            <RarityFilterBar rarityFilter={rarityFilter} setRarityFilter={setRarityFilter} />
            <SortDropdown sortMode={sortMode} setSortMode={setSortMode} />
          </div>

          {COLLECTION_TYPES.includes(activeSection) && (
            <GameCardGrid
              type={activeSection}
              entries={filteredEntries.slice(0, displayLimit)}
              totals={gameTotals[activeSection]}
              applyOverride={applyOverride}
              onZoom={setZoomedCard}
            />
          )}

          {activeSection === 'player:all' && (
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-lg font-bold cd-head text-[var(--cd-text)]">All Player Cards</h2>
                {totalPlayerCollected === totalPlayerCards && totalPlayerCards > 0 && (
                  <Trophy className="w-4 h-4 text-[var(--cd-gold)]" />
                )}
              </div>
              <ProgressBar collected={totalPlayerCollected} total={totalPlayerCards} />
              {filteredEntries.length === 0 ? (
                <div className="text-center py-12 text-[var(--cd-text-dim)]">
                  <Library className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm font-bold cd-head">No cards {rarityFilter || viewMode === 'owned' ? 'found' : 'available'}</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
                  {filteredEntries.slice(0, displayLimit).map(card => (
                    <PlayerSlot key={card.defId} card={card} meta={card._setMeta} onZoom={setZoomedCard} />
                  ))}
                </div>
              )}
              {!allSetsLoaded && (
                <div className="flex items-center justify-center py-4">
                  <div className="cd-spinner w-5 h-5 mr-2" />
                  <span className="text-xs text-[var(--cd-text-dim)]">Loading more sets...</span>
                </div>
              )}
            </div>
          )}

          {isPlayerSection && activeSection !== 'player:all' && activePlayerSetMeta && (
            loadingSet === activePlayerSetKey ? (
              <div className="flex items-center justify-center py-20">
                <div className="cd-spinner w-8 h-8" />
              </div>
            ) : (
              <PlayerCardGrid
                meta={activePlayerSetMeta}
                cards={filteredEntries.slice(0, displayLimit)}
                onZoom={setZoomedCard}
              />
            )
          )}

          {hasMore && (
            <div className="flex justify-center mt-6">
              <button
                onClick={() => setDisplayLimit(l => l + BATCH_SIZE)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[var(--cd-surface)] border border-[var(--cd-border)] text-sm font-bold text-[var(--cd-text-mid)] hover:bg-white/[0.06] hover:text-[var(--cd-text)] transition-all cursor-pointer cd-head"
              >
                <ChevronDown className="w-4 h-4" />
                Load More ({remaining} remaining)
              </button>
            </div>
          )}
          </>
          )}
        </div>
      </div>

      {zoomedCard && (
        <CardZoomModal
          onClose={() => setZoomedCard(null)}
          gameCard={zoomedCard.gameCard}
          playerCard={zoomedCard.playerCard}
          canSell={zoomedCard.canSell}
        />
      )}
    </div>
  )
}

function ProgressBar({ collected, total, color }) {
  const pct = total > 0 ? (collected / total) * 100 : 0
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="flex-1 h-1.5 bg-[var(--cd-edge)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color || 'var(--cd-cyan)', boxShadow: `0 0 8px ${color || 'var(--cd-cyan)'}66` }}
        />
      </div>
      <span className="text-xs cd-num text-[var(--cd-text-mid)] shrink-0">
        {collected}/{total} <span className="text-[var(--cd-text-dim)]">({Math.round(pct)}%)</span>
      </span>
    </div>
  )
}

function DuplicateCount({ ownedRarities }) {
  const count = ownedRarities.length
  if (count < 2) return null
  return (
    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-[var(--cd-surface)] border border-[var(--cd-border)] text-[10px] font-bold text-[var(--cd-text-mid)] cd-num px-1 z-10">
      x{count}
    </span>
  )
}

function RarityPips({ ownedRarities }) {
  const distinct = [...new Set(ownedRarities)]
  return (
    <div className="flex gap-0.5 justify-center mt-1">
      {RARITY_ORDER.map(r => {
        const owned = distinct.includes(r)
        const info = RARITIES[r]
        return (
          <div
            key={r}
            className="w-1.5 h-1.5 rounded-full transition-all"
            style={{
              backgroundColor: owned ? info?.color : 'var(--cd-edge)',
              boxShadow: owned ? `0 0 4px ${info?.color}88` : 'none',
            }}
            title={`${info?.name || r}${owned ? ' ✓' : ''}`}
          />
        )
      })}
    </div>
  )
}

function SortDropdown({ sortMode, setSortMode }) {
  return (
    <div className="relative shrink-0 ml-auto">
      <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--cd-text-dim)] pointer-events-none" />
      <select
        value={sortMode}
        onChange={e => setSortMode(e.target.value)}
        className="appearance-none pl-7 pr-6 py-1 rounded-full text-[11px] font-bold bg-white/[0.03] text-[var(--cd-text-mid)] border border-transparent hover:bg-white/[0.06] cursor-pointer cd-head focus:outline-none focus:border-[var(--cd-cyan)]/40"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
      >
        {SORT_OPTIONS.map(o => (
          <option key={o.value} value={o.value} className="bg-[#1a1a2e] text-white">{o.label}</option>
        ))}
      </select>
    </div>
  )
}

function RarityFilterBar({ rarityFilter, setRarityFilter }) {
  return (
    <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
      <button
        onClick={() => setRarityFilter(null)}
        className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer cd-head ${
          !rarityFilter
            ? 'bg-white/10 text-[var(--cd-text)] border border-white/20'
            : 'bg-white/[0.03] text-[var(--cd-text-dim)] hover:bg-white/[0.06] border border-transparent'
        }`}
      >
        All Rarities
      </button>
      {RARITY_ORDER.map(r => {
        const info = RARITIES[r]
        const active = rarityFilter === r
        return (
          <button
            key={r}
            onClick={() => setRarityFilter(active ? null : r)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer cd-head border ${
              active
                ? ''
                : 'bg-white/[0.03] text-[var(--cd-text-dim)] hover:bg-white/[0.06] border-transparent'
            }`}
            style={active ? {
              backgroundColor: `${info.color}20`,
              color: info.color,
              borderColor: `${info.color}40`,
            } : undefined}
          >
            {info.name}
          </button>
        )
      })}
    </div>
  )
}

// ═══ Recent Pulls ═══

function RecentPulls({ pulls, open, onToggle, applyOverride, onZoom, owned }) {
  return (
    <div className="mb-4">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 w-full text-left px-1 py-1.5 group cursor-pointer"
      >
        {open
          ? <ChevronDown className="w-4 h-4 text-[var(--cd-text-dim)] group-hover:text-[var(--cd-text-mid)] transition-colors" />
          : <ChevronRight className="w-4 h-4 text-[var(--cd-text-dim)] group-hover:text-[var(--cd-text-mid)] transition-colors" />
        }
        <Clock className="w-3.5 h-3.5 text-[var(--cd-text-dim)]" />
        <span className="text-sm font-bold text-[var(--cd-text-mid)] cd-head">Recent Pulls</span>
        <span className="text-xs text-[var(--cd-text-dim)] cd-num">{pulls.length}</span>
      </button>
      {open && (
        <div className="flex flex-wrap gap-3 justify-center lg:justify-start mt-2 px-1">
          {pulls.map(card => (
            <RecentPullCard key={card.id} card={card} applyOverride={applyOverride} onZoom={onZoom} owned={owned} />
          ))}
        </div>
      )}
    </div>
  )
}

function RecentPullCard({ card, applyOverride, onZoom, owned }) {
  if (card.cardType === 'player') {
    const isFirstEdition = card.isFirstEdition || false
    const ownedRarities = owned?.playerCards?.[card.defId] || []
    const handleZoom = () => onZoom({
      playerCard: {
        defId: card.defId,
        playerName: card.playerName,
        teamName: card.teamName,
        teamColor: card.teamColor,
        role: card.role,
        avatarUrl: card.avatarUrl,
        bestGodName: card.bestGodName || null,
        bestGod: card.bestGodName ? { name: card.bestGodName } : null,
        isConnected: card.isConnected,
        isFirstEdition,
        rarity: card.rarity,
        leagueName: card.leagueSlug?.toUpperCase() || '',
        divisionName: `Division ${card.divisionTier}`,
        ownedRarities,
      },
      canSell: true,
    })
    return (
      <div className="flex flex-col items-center card-zoomable" onClick={handleZoom}>
        <TradingCard
          playerName={card.playerName}
          teamName={card.teamName}
          teamColor={card.teamColor}
          role={card.role}
          avatarUrl={card.avatarUrl}
          rarity={card.rarity}
          leagueName={card.leagueSlug?.toUpperCase() || ''}
          divisionName={`Division ${card.divisionTier}`}
          bestGod={card.bestGodName ? { name: card.bestGodName } : null}
          isConnected={card.isConnected}
          isFirstEdition={isFirstEdition}
          signatureUrl={card.signatureUrl}
          size={CARD_SIZE}
        />
      </div>
    )
  }

  // Game card
  const dataMap = DATA_MAPS[card.cardType]
  const identifier = card.godId?.replace(/^(item|consumable)-/, '') || card.godId
  const fullData = dataMap?.get(card.cardType === 'god' ? card.godId : identifier)
  if (!fullData) return null
  const data = applyOverride(card.cardType, card.cardType === 'god' ? card.godId : identifier, fullData)

  return (
    <div
      className="flex flex-col items-center card-zoomable"
      onClick={() => onZoom({
        gameCard: { type: card.cardType, rarity: card.rarity, data, identifier: card.godId, ownedRarities: owned?.gameCards?.[`${card.cardType}:${card.godId}`] || [] },
        canSell: true,
      })}
    >
      <GameCard type={card.cardType} rarity={card.rarity} data={card.signatureUrl ? { ...data, signatureUrl: card.signatureUrl } : data} size={CARD_SIZE} />
    </div>
  )
}

// ═══ Game card grids ═══

function GameCardGrid({ type, entries, totals, applyOverride, onZoom }) {
  const section = GAME_SECTIONS.find(s => s.type === type)

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-lg font-bold cd-head text-[var(--cd-text)]">{section?.label || type}</h2>
        {totals?.collected === totals?.total && totals?.total > 0 && (
          <Trophy className="w-4 h-4 text-[var(--cd-gold)]" />
        )}
      </div>
      <ProgressBar collected={totals?.collected || 0} total={totals?.total || 0} />

      {entries.length === 0 ? (
        <div className="text-center py-12 text-[var(--cd-text-dim)]">
          <Library className="w-10 h-10 mx-auto mb-2 opacity-20" />
          <p className="text-sm font-bold cd-head">No cards owned</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
          {entries.map(entry => (
            <CollectionSlot key={entry.index} entry={entry} type={type} applyOverride={applyOverride} onZoom={onZoom} />
          ))}
        </div>
      )}
    </div>
  )
}

function CollectionSlot({ entry, type, applyOverride, onZoom }) {
  if (entry.collected) {
    const dataKey = entryDataKey(entry, type)
    const dataMap = DATA_MAPS[type]
    const fullData = dataMap?.get(dataKey)
    if (!fullData) return null
    const rarity = highestRarity(entry.ownedRarities)
    const data = applyOverride(type, dataKey, fullData)

    return (
      <div className="flex flex-col items-center card-zoomable" onClick={() => onZoom({ gameCard: { type, rarity, data, identifier: entryGodId(entry, type), ownedRarities: entry.ownedRarities }, canSell: true })}>
        <div className="relative">
          <GameCard type={type} rarity={rarity} data={data} size={CARD_SIZE} />
          <DuplicateCount ownedRarities={entry.ownedRarities} />
        </div>
        <RarityPips ownedRarities={entry.ownedRarities} />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center">
      <div
        className="rounded-lg border border-[var(--cd-border)] bg-[var(--cd-surface)]/40 flex flex-col items-center justify-center"
        style={{ width: CARD_SIZE, aspectRatio: '63/88' }}
      >
        <div className="text-[9px] cd-num text-[var(--cd-text-dim)] mb-1">{entry.index}</div>
        <div className="text-[11px] font-bold text-[var(--cd-text-dim)] cd-head text-center px-2 leading-tight">{entry.name}</div>
        <div className="text-[10px] text-[var(--cd-text-dim)]/60 mt-0.5">???</div>
      </div>
    </div>
  )
}

// ═══ Player card grid ═══

function PlayerCardGrid({ meta, cards, onZoom }) {
  const teams = useMemo(() => {
    const map = new Map()
    for (const card of cards) {
      const team = card.teamName || 'Free Agent'
      if (!map.has(team)) map.set(team, { name: team, color: card.teamColor, cards: [] })
      map.get(team).cards.push(card)
    }
    return [...map.values()]
  }, [cards])

  const leagueLogo = getLeagueLogo(meta.leagueSlug)
  const divImg = getDivisionImage(meta.leagueSlug, meta.divisionSlug, meta.divisionTier)
  const divLabel = meta.divisionName || `Division ${meta.divisionTier}`

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        {leagueLogo && <img src={leagueLogo} alt="" className="w-6 h-6 object-contain" />}
        <h2 className="text-lg font-bold cd-head text-[var(--cd-text)]">
          {meta.leagueSlug.toUpperCase()} (S{seasonNumber(meta.seasonSlug)})
        </h2>
        {divImg && <img src={divImg} alt="" className="w-5 h-5 object-contain" />}
        <span className="text-base font-bold cd-head text-[var(--cd-text-mid)]">{divLabel}</span>
        {meta.collected === meta.total && meta.total > 0 && (
          <Trophy className="w-4 h-4 text-[var(--cd-gold)]" />
        )}
      </div>
      <ProgressBar collected={meta.collected} total={meta.total} />

      {cards.length === 0 ? (
        <div className="text-center py-12 text-[var(--cd-text-dim)]">
          <Library className="w-10 h-10 mx-auto mb-2 opacity-20" />
          <p className="text-sm font-bold cd-head">No cards owned</p>
        </div>
      ) : (
      <div className="space-y-6">
        {teams.map(team => (
          <div key={team.name}>
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: team.color || '#6b7280', boxShadow: `0 0 6px ${team.color || '#6b7280'}66` }}
              />
              <span className="text-xs font-bold text-[var(--cd-text-mid)] uppercase tracking-wider cd-head">
                {team.name}
              </span>
            </div>

            <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
              {team.cards.map(card => (
                <PlayerSlot key={card.defId} card={card} meta={meta} onZoom={onZoom} />
              ))}
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  )
}

function PlayerSlot({ card, meta, onZoom }) {
  const cardNumber = getPlayerCardNumber(meta.leagueSlug, meta.divisionTier, meta.seasonSlug, card.cardIndex)

  if (card.collected) {
    const rarity = highestRarity(card.ownedRarities)
    const isFirstEdition = card.feRarities?.includes(rarity) || false

    const handleZoom = () => onZoom({
      playerCard: {
        defId: card.defId,
        playerName: card.playerName,
        teamName: card.teamName,
        teamColor: card.teamColor,
        role: card.role,
        avatarUrl: card.avatarUrl,
        bestGodName: card.bestGodName || null,
        bestGod: card.bestGodName ? { name: card.bestGodName } : null,
        isConnected: card.isConnected,
        isFirstEdition,
        rarity,
        leagueName: meta.leagueSlug.toUpperCase(),
        divisionName: meta.divisionName || `Division ${meta.divisionTier}`,
        seasonName: card.seasonName || '',
        ownedRarities: card.ownedRarities,
      },
      canSell: true,
    })

    return (
      <div className="flex flex-col items-center card-zoomable" onClick={handleZoom}>
        <div className="relative">
          <TradingCard
            playerName={card.playerName}
            teamName={card.teamName}
            teamColor={card.teamColor}
            role={card.role}
            avatarUrl={card.avatarUrl}
            rarity={rarity}
            leagueName={meta.leagueSlug.toUpperCase()}
            divisionName={meta.divisionName || `Division ${meta.divisionTier}`}
            bestGod={card.bestGodName ? { name: card.bestGodName } : null}
            isConnected={card.isConnected}
            isFirstEdition={isFirstEdition}
            size={PLAYER_CARD_SIZE}
          />
          <DuplicateCount ownedRarities={card.ownedRarities} />
        </div>
        <RarityPips ownedRarities={card.ownedRarities} />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center">
      <div
        className="rounded-lg border border-[var(--cd-border)] bg-[var(--cd-surface)]/40 flex flex-col items-center justify-center"
        style={{ width: PLAYER_CARD_SIZE, aspectRatio: '63/88' }}
      >
        <div className="text-[9px] cd-num text-[var(--cd-text-dim)] mb-1">{cardNumber}</div>
        <div className="text-[11px] font-bold text-[var(--cd-text-dim)] cd-head text-center px-2 leading-tight">{card.playerName}</div>
        <div className="text-[10px] text-[var(--cd-text-dim)]/60 mt-0.5">???</div>
      </div>
    </div>
  )
}

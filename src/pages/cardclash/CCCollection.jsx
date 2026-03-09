import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { cardclashService } from '../../services/database'
import { getGameCardEntries, getPlayerCardNumber, GAME_CARD_TYPES, TOTAL_GAME_CARDS } from '../../data/cardclash/cardIndex'
import { RARITIES } from '../../data/cardclash/economy'
import { GODS } from '../../data/cardclash/gods'
import { ITEMS } from '../../data/cardclash/items'
import { MINIONS } from '../../data/cardclash/minions'
import { BUFFS, CONSUMABLES } from '../../data/cardclash/buffs'
import GameCard from './components/GameCard'
import TradingCard from '../../components/TradingCard'
import { Library, Trophy } from 'lucide-react'

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']
const BATTLEFIELD_TYPES = ['minion', 'buff', 'consumable']

const GAME_SECTIONS = [
  { type: 'god', label: 'Gods', icon: '⚔' },
  { type: 'item', label: 'Items', icon: '🛡' },
  { type: 'battlefield', label: 'Battlefield', icon: '🏟' },
]

const BATTLEFIELD_LABELS = { minion: 'Minions', buff: 'Buffs', consumable: 'Consumables' }

// Full data lookups for rendering actual cards
const GOD_MAP = new Map(GODS.map(g => [g.slug, g]))
const ITEM_MAP = new Map(ITEMS.map(i => [String(i.id), i]))
const MINION_MAP = new Map(MINIONS.map(m => [m.type, m]))
const BUFF_MAP = new Map(BUFFS.map(b => [b.id, b]))
const CONSUMABLE_MAP = new Map(CONSUMABLES.map(c => [c.id, c]))
const DATA_MAPS = { god: GOD_MAP, item: ITEM_MAP, minion: MINION_MAP, buff: BUFF_MAP, consumable: CONSUMABLE_MAP }

function entryGodId(entry, type) {
  if (type === 'god') return entry.identifier
  return entry.godId
}

function entryDataKey(entry, type) {
  return entry.identifier || entry.godId?.replace(/^(item|minion|buff|consumable)-/, '')
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
const PLAYER_SLOT_SCALE = PLAYER_CARD_SIZE / 340

export default function CCCollection() {
  const [loading, setLoading] = useState(true)
  const [catalog, setCatalog] = useState(null)
  const [owned, setOwned] = useState(null)
  const [setDefs, setSetDefs] = useState({})
  const [loadingSet, setLoadingSet] = useState(null)
  const [activeSection, setActiveSection] = useState('god')
  const [defOverrides, setDefOverrides] = useState({})
  const loadedSetsRef = useRef(new Set())

  useEffect(() => {
    const loadData = async () => {
      try {
        let cat = cacheGet('cd-catalog', CATALOG_TTL)
        const ownedPromise = cardclashService.getCollectionOwned()
        const overridesPromise = cardclashService.getDefinitionOverrides().catch(() => ({ overrides: {} }))

        if (!cat) {
          cat = await cardclashService.getCollectionCatalog()
          cacheSet('cd-catalog', cat)
        }

        const [ownedData, overridesData] = await Promise.all([ownedPromise, overridesPromise])
        setCatalog(cat)
        setOwned(ownedData)
        setDefOverrides(overridesData.overrides || {})
      } catch {}
      setLoading(false)
    }
    loadData()
  }, [])

  const applyOverride = useCallback((type, id, data) => {
    const override = defOverrides[`${type}:${id}`]
    if (!override) return data
    return { ...data, metadata: override, imageUrl: override.custom_image_url || data.imageUrl }
  }, [defOverrides])

  const loadPlayerSet = useCallback(async (setKey) => {
    if (loadedSetsRef.current.has(setKey)) return
    loadedSetsRef.current.add(setKey)

    const cached = cacheGet(`cd-set-${setKey}`, SET_DEF_TTL)
    if (cached) {
      setSetDefs(prev => ({ ...prev, [setKey]: cached }))
      return
    }

    setLoadingSet(setKey)
    try {
      const data = await cardclashService.getCollectionSet(setKey)
      cacheSet(`cd-set-${setKey}`, data.cards)
      setSetDefs(prev => ({ ...prev, [setKey]: data.cards }))
    } catch {}
    setLoadingSet(null)
  }, [])

  useEffect(() => {
    if (activeSection.startsWith('player:')) {
      loadPlayerSet(activeSection.replace('player:', ''))
    }
  }, [activeSection, loadPlayerSet])

  // Build game entries with ownership merged
  const gameEntries = useMemo(() => {
    if (!owned) return {}
    const result = {}
    for (const type of GAME_CARD_TYPES) {
      const entries = getGameCardEntries(type)
      result[type] = entries.map(e => {
        const godId = entryGodId(e, type)
        const ownedRarities = owned.gameCards?.[`${type}:${godId}`] || []
        return { ...e, collected: ownedRarities.length > 0, ownedRarities }
      })
    }
    return result
  }, [owned])

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

  // Game card totals (per type + battlefield combined)
  const gameTotals = {}
  let totalGameCollected = 0
  for (const type of GAME_CARD_TYPES) {
    const entries = gameEntries[type] || []
    const collected = entries.filter(e => e.collected).length
    gameTotals[type] = { total: entries.length, collected }
    totalGameCollected += collected
  }
  // Battlefield combined total
  gameTotals.battlefield = {
    total: BATTLEFIELD_TYPES.reduce((s, t) => s + (gameTotals[t]?.total || 0), 0),
    collected: BATTLEFIELD_TYPES.reduce((s, t) => s + (gameTotals[t]?.collected || 0), 0),
  }

  // Player sets with collected counts + grouped by league+season
  const playerSets = (catalog.playerSets || []).map(set => {
    const defs = setDefs[set.key]
    let collected = 0
    if (defs) collected = defs.filter(d => !!owned.playerCards?.[d.defId]).length
    return { ...set, collected }
  })

  // Group: league+season → divisions
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

  const totalPlayerCards = playerSets.reduce((s, set) => s + set.total, 0)
  const totalPlayerCollected = playerSets.reduce((s, set) => s + set.collected, 0)

  const isPlayerSection = activeSection.startsWith('player:')
  const activePlayerSetKey = isPlayerSection ? activeSection.replace('player:', '') : null
  const activePlayerSetMeta = activePlayerSetKey
    ? playerSets.find(s => s.key === activePlayerSetKey)
    : null

  const activePlayerCards = activePlayerSetKey && setDefs[activePlayerSetKey]
    ? setDefs[activePlayerSetKey].map(d => ({
        ...d,
        collected: !!owned.playerCards?.[d.defId],
        ownedRarities: owned.playerCards?.[d.defId] || [],
      }))
    : []

  return (
    <div className="p-6">
      <div className="mb-6 cd-section-accent pb-3">
        <h1 className="text-2xl font-bold text-[var(--cd-text)] cd-head">Collection</h1>
        <div className="flex gap-6 mt-2 text-sm">
          <div className="text-[var(--cd-text-mid)]">
            Game Cards: <span className="text-[var(--cd-cyan)] cd-num font-bold">{totalGameCollected}</span>
            <span className="text-[var(--cd-text-dim)]">/{TOTAL_GAME_CARDS}</span>
          </div>
          {totalPlayerCards > 0 && (
            <div className="text-[var(--cd-text-mid)]">
              Player Cards: <span className="text-[var(--cd-cyan)] cd-num font-bold">{totalPlayerCollected}</span>
              <span className="text-[var(--cd-text-dim)]">/{totalPlayerCards}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-52 shrink-0 space-y-1">
          <div className="text-[10px] text-[var(--cd-text-dim)] uppercase tracking-wider font-bold mb-2 cd-head">Game Cards</div>
          {GAME_SECTIONS.map(s => {
            const t = gameTotals[s.type] || { total: 0, collected: 0 }
            const active = activeSection === s.type
            return (
              <button
                key={s.type}
                onClick={() => setActiveSection(s.type)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer cd-head text-left ${
                  active
                    ? 'bg-[var(--cd-cyan)]/10 text-[var(--cd-cyan)] border border-[var(--cd-cyan)]/20'
                    : 'text-[var(--cd-text-mid)] hover:bg-white/[0.03] hover:text-[var(--cd-text)]'
                }`}
              >
                <span className="text-xs">{s.icon}</span>
                <span className="flex-1">{s.label}</span>
                <span className="text-[10px] cd-num opacity-60">{t.collected}/{t.total}</span>
              </button>
            )
          })}

          {leagueSeasonGroups.length > 0 && (
            <>
              <div className="text-[10px] text-[var(--cd-text-dim)] uppercase tracking-wider font-bold mt-4 mb-2 cd-head">Player Sets</div>
              {leagueSeasonGroups.map(group => (
                <div key={group.key}>
                  <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold text-[var(--cd-text-dim)] uppercase tracking-wider cd-head">
                    <span>{group.label}</span>
                    {group.seasonActive && <span className="text-[8px] text-emerald-400">LIVE</span>}
                  </div>
                  {group.divisions.map(set => {
                    const active = activeSection === `player:${set.key}`
                    return (
                      <button
                        key={set.key}
                        onClick={() => setActiveSection(`player:${set.key}`)}
                        className={`w-full flex items-center gap-2 px-3 pl-6 py-1.5 rounded-lg text-sm font-bold transition-all cursor-pointer cd-head text-left ${
                          active
                            ? 'bg-[var(--cd-cyan)]/10 text-[var(--cd-cyan)] border border-[var(--cd-cyan)]/20'
                            : 'text-[var(--cd-text-mid)] hover:bg-white/[0.03] hover:text-[var(--cd-text)]'
                        }`}
                      >
                        <span className="flex-1 truncate">Division {set.divisionTier}</span>
                        <span className="text-[10px] cd-num opacity-60">{set.collected}/{set.total}</span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {activeSection === 'god' && (
            <GameCardGrid
              type="god"
              entries={gameEntries.god || []}
              totals={gameTotals.god}
              applyOverride={applyOverride}
            />
          )}
          {activeSection === 'item' && (
            <GameCardGrid
              type="item"
              entries={gameEntries.item || []}
              totals={gameTotals.item}
              applyOverride={applyOverride}
            />
          )}
          {activeSection === 'battlefield' && (
            <BattlefieldGrid
              gameEntries={gameEntries}
              gameTotals={gameTotals}
              applyOverride={applyOverride}
            />
          )}
          {isPlayerSection && activePlayerSetMeta && (
            loadingSet === activePlayerSetKey ? (
              <div className="flex items-center justify-center py-20">
                <div className="cd-spinner w-8 h-8" />
              </div>
            ) : (
              <PlayerCardGrid
                meta={activePlayerSetMeta}
                cards={activePlayerCards}
              />
            )
          )}
        </div>
      </div>
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

function RarityPips({ ownedRarities }) {
  return (
    <div className="flex gap-0.5 justify-center mt-1">
      {RARITY_ORDER.map(r => {
        const owned = ownedRarities.includes(r)
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

// ═══ Game card grids ═══

function GameCardGrid({ type, entries, totals, applyOverride, label }) {
  const section = GAME_SECTIONS.find(s => s.type === type)

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-lg font-bold cd-head text-[var(--cd-text)]">{label || section?.label || type}</h2>
        {totals?.collected === totals?.total && totals?.total > 0 && (
          <Trophy className="w-4 h-4 text-[var(--cd-gold)]" />
        )}
      </div>
      <ProgressBar collected={totals?.collected || 0} total={totals?.total || 0} />

      <div className="flex flex-wrap gap-3">
        {entries.map(entry => (
          <CollectionSlot key={entry.index} entry={entry} type={type} applyOverride={applyOverride} />
        ))}
      </div>
    </div>
  )
}

function BattlefieldGrid({ gameEntries, gameTotals, applyOverride }) {
  const bf = gameTotals.battlefield
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-lg font-bold cd-head text-[var(--cd-text)]">Battlefield</h2>
        {bf?.collected === bf?.total && bf?.total > 0 && (
          <Trophy className="w-4 h-4 text-[var(--cd-gold)]" />
        )}
      </div>
      <ProgressBar collected={bf?.collected || 0} total={bf?.total || 0} />

      <div className="space-y-6">
        {BATTLEFIELD_TYPES.map(type => (
          <div key={type}>
            <h3 className="text-xs font-bold text-[var(--cd-text-dim)] uppercase tracking-wider mb-3 cd-head">{BATTLEFIELD_LABELS[type]}</h3>
            <div className="flex flex-wrap gap-3">
              {(gameEntries[type] || []).map(entry => (
                <CollectionSlot key={entry.index} entry={entry} type={type} applyOverride={applyOverride} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CollectionSlot({ entry, type, applyOverride }) {
  if (entry.collected) {
    const dataKey = entryDataKey(entry, type)
    const dataMap = DATA_MAPS[type]
    const fullData = dataMap?.get(dataKey)
    if (!fullData) return null
    const rarity = highestRarity(entry.ownedRarities)
    const data = applyOverride(type, dataKey, fullData)

    return (
      <div className="flex flex-col items-center">
        <GameCard type={type} rarity={rarity} data={data} size={CARD_SIZE} />
        <RarityPips ownedRarities={entry.ownedRarities} />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center">
      <div
        className="rounded-lg border border-[var(--cd-edge)] bg-[var(--cd-edge)]/30 flex flex-col items-center justify-center opacity-40"
        style={{ width: CARD_SIZE, aspectRatio: '63/88' }}
      >
        <div className="text-[9px] cd-num text-[var(--cd-text-dim)] mb-1">{entry.index}</div>
        <div className="text-[11px] font-bold text-[var(--cd-text-mid)] cd-head text-center px-2 leading-tight">{entry.name}</div>
        <div className="text-[10px] text-[var(--cd-text-dim)] mt-0.5">???</div>
      </div>
    </div>
  )
}

// ═══ Player card grid ═══

function PlayerCardGrid({ meta, cards }) {
  const teams = useMemo(() => {
    const map = new Map()
    for (const card of cards) {
      const team = card.teamName || 'Free Agent'
      if (!map.has(team)) map.set(team, { name: team, color: card.teamColor, cards: [] })
      map.get(team).cards.push(card)
    }
    return [...map.values()]
  }, [cards])

  const divLabel = `Division ${meta.divisionTier}`

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-lg font-bold cd-head text-[var(--cd-text)]">
          {meta.leagueSlug.toUpperCase()} (S{seasonNumber(meta.seasonSlug)})
          <span className="text-[var(--cd-text-mid)] ml-2 text-base">{divLabel}</span>
        </h2>
        {meta.seasonActive && (
          <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold uppercase cd-head">Live</span>
        )}
        {meta.collected === meta.total && meta.total > 0 && (
          <Trophy className="w-4 h-4 text-[var(--cd-gold)]" />
        )}
      </div>
      <ProgressBar collected={meta.collected} total={meta.total} />

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

            <div className="flex flex-wrap gap-3">
              {team.cards.map(card => (
                <PlayerSlot key={card.defId} card={card} meta={meta} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PlayerSlot({ card, meta }) {
  const cardNumber = getPlayerCardNumber(meta.leagueSlug, meta.divisionTier, meta.seasonSlug, card.cardIndex)

  if (card.collected) {
    const rarity = highestRarity(card.ownedRarities)

    return (
      <div className="flex flex-col items-center">
        <div className="card-overview-slot" style={{ width: PLAYER_CARD_SIZE, aspectRatio: '63/88', '--slot-scale': PLAYER_SLOT_SCALE }}>
          <TradingCard
            playerName={card.playerName}
            teamName={card.teamName}
            teamColor={card.teamColor}
            role={card.role}
            avatarUrl={card.avatarUrl}
            variant="player"
            rarity={rarity}
            leagueName={meta.leagueSlug.toUpperCase()}
            divisionName={`Division ${meta.divisionTier}`}
          />
        </div>
        <RarityPips ownedRarities={card.ownedRarities} />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center">
      <div
        className="rounded-lg border border-[var(--cd-edge)] bg-[var(--cd-edge)]/30 flex flex-col items-center justify-center opacity-40"
        style={{ width: PLAYER_CARD_SIZE, aspectRatio: '63/88' }}
      >
        <div className="text-[9px] cd-num text-[var(--cd-text-dim)] mb-1">{cardNumber}</div>
        <div className="text-[11px] font-bold text-[var(--cd-text-mid)] cd-head text-center px-2 leading-tight">{card.playerName}</div>
        <div className="text-[10px] text-[var(--cd-text-dim)] mt-0.5">???</div>
      </div>
    </div>
  )
}

import { useState, useMemo, useEffect, useCallback } from 'react'
import GameCard from './components/GameCard'
import TradingCard from '../../components/TradingCard'
import TradingCardHolo from '../../components/TradingCardHolo'
import { GODS } from '../../data/cardclash/gods'
import { ITEMS } from '../../data/cardclash/items'
import { MINIONS } from '../../data/cardclash/minions'
import { BUFFS, CONSUMABLES } from '../../data/cardclash/buffs'
import { RARITIES } from '../../data/cardclash/economy'
import { cardclashService } from '../../services/database'

const SAMPLE_PLAYER = {
  playerName: 'Azulisc',
  teamName: 'Fallen Angels',
  teamColor: '#4A0093',
  seasonName: 'BSL Season 2',
  leagueName: 'BSL',
  divisionName: 'Division 1',
  role: 'JUNGLE',
  avatarUrl: 'https://cdn.discordapp.com/avatars/478745217873477633/56256acfe4e67cf501be26394773edd5.png?size=256',
  stats: {
    gamesPlayed: 14, wins: 12, winRate: 85.7, kda: 4.3,
    avgDamage: 21886, avgMitigated: 13313,
    totalKills: 102, totalDeaths: 40, totalAssists: 141,
  },
  bestGod: {
    name: 'Medusa',
    imageUrl: 'https://smitebrain.com/cdn-cgi/image/width=80,height=80,f=auto,fit=cover/https://images.smitebrain.com/images/gods/icons/medusa',
    games: 3, winRate: 100,
  },
}

const OVERVIEW_HOLO_MAP = {
  common: 'common', uncommon: 'holo', rare: 'galaxy',
  epic: 'cosmos', legendary: 'gold', mythic: 'rainbow',
}

const CARD_TYPES = [
  { key: 'overview', label: 'Overview' },
  { key: 'gods', label: 'Gods', count: GODS.length },
  { key: 'items', label: 'Items', count: ITEMS.length },
  { key: 'minions', label: 'Minions', count: MINIONS.length },
  { key: 'buffs', label: 'Buffs', count: BUFFS.length },
  { key: 'consumables', label: 'Consumables', count: CONSUMABLES.length },
]

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']

const GOD_CLASSES = ['All', 'Guardian', 'Warrior', 'Assassin', 'Mage', 'Hunter']

export default function CCCardCatalog() {
  const [activeType, setActiveType] = useState('overview')
  const [selectedRarity, setSelectedRarity] = useState('all')
  const [classFilter, setClassFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [cardSize, setCardSize] = useState(240)
  const [defOverrides, setDefOverrides] = useState({})

  // Load definition overrides (image positioning per god/item)
  useEffect(() => {
    cardclashService.getDefinitionOverrides().then(data => {
      setDefOverrides(data.overrides || {})
    }).catch(() => {})
  }, [])

  const applyOverride = useCallback((type, id, data) => {
    const override = defOverrides[`${type}:${id}`]
    if (!override) return data
    return { ...data, metadata: override, imageUrl: override.custom_image_url || data.imageUrl }
  }, [defOverrides])

  const filteredGods = useMemo(() => {
    let gods = [...GODS]
    if (classFilter !== 'All') gods = gods.filter(g => g.class === classFilter)
    if (search) gods = gods.filter(g => g.name.toLowerCase().includes(search.toLowerCase()))
    return gods
  }, [classFilter, search])

  const filteredItems = useMemo(() => {
    if (!search) return ITEMS
    return ITEMS.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
  }, [search])

  const rarities = selectedRarity === 'all' ? RARITY_ORDER : [selectedRarity]

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Card Catalog</h1>
        <p className="text-sm text-gray-400 mt-1">
          {GODS.length} gods, {ITEMS.length} items, {MINIONS.length} minions, {BUFFS.length} buffs, {CONSUMABLES.length} consumables &mdash; {RARITY_ORDER.length} rarities each
        </p>
      </div>

      {/* Type tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {CARD_TYPES.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveType(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer ${
              activeType === t.key
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
            }`}
          >
            {t.label}{t.count != null && <span className="text-xs opacity-60"> ({t.count})</span>}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 w-48"
        />

        {/* Rarity filter */}
        <div className="flex gap-1">
          <button
            onClick={() => setSelectedRarity('all')}
            className={`px-2 py-1 text-xs rounded font-bold ${
              selectedRarity === 'all' ? 'bg-white/20 text-white' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
            }`}
          >
            All
          </button>
          {RARITY_ORDER.map(r => (
            <button
              key={r}
              onClick={() => setSelectedRarity(r)}
              className={`px-2 py-1 text-xs rounded font-bold capitalize ${
                selectedRarity === r ? 'text-black' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
              }`}
              style={selectedRarity === r ? { backgroundColor: RARITIES[r]?.color } : undefined}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Class filter (gods only) */}
        {activeType === 'gods' && (
          <div className="flex gap-1">
            {GOD_CLASSES.map(cls => (
              <button
                key={cls}
                onClick={() => setClassFilter(cls)}
                className={`px-2 py-1 text-xs rounded font-bold ${
                  classFilter === cls ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
                }`}
              >
                {cls}
              </button>
            ))}
          </div>
        )}

        {/* Card size slider */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-gray-500">{cardSize}px</span>
          <input type="range" min={100} max={400} value={cardSize} onChange={e => setCardSize(parseInt(e.target.value))} className="w-24 accent-amber-500" />
        </div>
      </div>

      {/* Overview — one of each type side by side */}
      {activeType === 'overview' && (
        <div className="space-y-10">
          {rarities.map(rarity => (
            <RaritySection key={rarity} rarity={rarity}>
              <div className="flex flex-col items-center gap-2">
                <div className="card-overview-slot" style={{ width: cardSize, height: cardSize * (88 / 63), '--slot-scale': cardSize / 340 }}>
                  <TradingCardHolo rarity={OVERVIEW_HOLO_MAP[rarity] || 'common'} role="JUNGLE" holoType="holo">
                    <TradingCard {...SAMPLE_PLAYER} variant="player" rarity={rarity} />
                  </TradingCardHolo>
                </div>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Player (Holo)</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="card-overview-slot" style={{ width: cardSize, height: cardSize * (88 / 63), '--slot-scale': cardSize / 340 }}>
                  <TradingCardHolo rarity={OVERVIEW_HOLO_MAP[rarity] || 'common'} role="JUNGLE" holoType="reverse">
                    <TradingCard {...SAMPLE_PLAYER} variant="player" rarity={rarity} />
                  </TradingCardHolo>
                </div>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Player (Rev)</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="card-overview-slot" style={{ width: cardSize, height: cardSize * (88 / 63), '--slot-scale': cardSize / 340 }}>
                  <TradingCardHolo rarity={OVERVIEW_HOLO_MAP[rarity] || 'common'} role="JUNGLE" holoType="full">
                    <TradingCard {...SAMPLE_PLAYER} variant="player" rarity={rarity} />
                  </TradingCardHolo>
                </div>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Player (Full)</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <TradingCardHolo rarity={OVERVIEW_HOLO_MAP[rarity] || 'common'} role="ADC" holoType="reverse" size={cardSize}>
                  <GameCard type="god" rarity={rarity} data={applyOverride('god', GODS[0].slug, GODS[0])} />
                </TradingCardHolo>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">God</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <TradingCardHolo rarity={OVERVIEW_HOLO_MAP[rarity] || 'common'} role="ADC" holoType="reverse" size={cardSize}>
                  <GameCard type="item" rarity={rarity} data={applyOverride('item', ITEMS[0].id, ITEMS[0])} />
                </TradingCardHolo>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Item</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <TradingCardHolo rarity={OVERVIEW_HOLO_MAP[rarity] || 'common'} role="ADC" holoType="reverse" size={cardSize}>
                  <GameCard type="minion" rarity={rarity} data={applyOverride('minion', MINIONS[0].type, MINIONS[0])} />
                </TradingCardHolo>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Minion</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <TradingCardHolo rarity={OVERVIEW_HOLO_MAP[rarity] || 'common'} role="ADC" holoType="reverse" size={cardSize}>
                  <GameCard type="buff" rarity={rarity} data={applyOverride('buff', BUFFS[0].id, BUFFS[0])} />
                </TradingCardHolo>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Buff</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <TradingCardHolo rarity={OVERVIEW_HOLO_MAP[rarity] || 'common'} role="ADC" holoType="reverse" size={cardSize}>
                  <GameCard type="consumable" rarity={rarity} data={applyOverride('consumable', CONSUMABLES[0].id, CONSUMABLES[0])} />
                </TradingCardHolo>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Consumable</span>
              </div>
            </RaritySection>
          ))}
        </div>
      )}

      {/* Card grid by rarity */}
      {activeType === 'gods' && (
        <div className="space-y-10">
          {rarities.map(rarity => (
            <RaritySection key={rarity} rarity={rarity}>
              {filteredGods.map(god => (
                <GameCard key={god.id} type="god" rarity={rarity} data={applyOverride('god', god.slug, god)} size={cardSize} />
              ))}
            </RaritySection>
          ))}
        </div>
      )}

      {activeType === 'items' && (
        <div className="space-y-10">
          {rarities.map(rarity => {
            const categories = [...new Set(filteredItems.map(i => i.category))]
            return (
              <RaritySection key={rarity} rarity={rarity}>
                {categories.map(cat => (
                  <div key={cat} className="col-span-full">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 mt-2">{cat}</h4>
                    <div className="flex flex-wrap gap-4">
                      {filteredItems.filter(i => i.category === cat).map(item => (
                        <GameCard key={item.id} type="item" rarity={rarity} data={applyOverride('item', item.id, item)} size={cardSize} />
                      ))}
                    </div>
                  </div>
                ))}
              </RaritySection>
            )
          })}
        </div>
      )}

      {activeType === 'minions' && (
        <div className="space-y-10">
          {rarities.map(rarity => (
            <RaritySection key={rarity} rarity={rarity}>
              {MINIONS.map(m => (
                <GameCard key={m.type} type="minion" rarity={rarity} data={applyOverride('minion', m.type, m)} size={cardSize} />
              ))}
            </RaritySection>
          ))}
        </div>
      )}

      {activeType === 'buffs' && (
        <div className="space-y-10">
          {rarities.map(rarity => (
            <RaritySection key={rarity} rarity={rarity}>
              {BUFFS.map(b => (
                <GameCard key={b.id} type="buff" rarity={rarity} data={applyOverride('buff', b.id, b)} size={cardSize} />
              ))}
            </RaritySection>
          ))}
        </div>
      )}

      {activeType === 'consumables' && (
        <div className="space-y-10">
          {rarities.map(rarity => (
            <RaritySection key={rarity} rarity={rarity}>
              {CONSUMABLES.map(c => (
                <GameCard key={c.id} type="consumable" rarity={rarity} data={applyOverride('consumable', c.id, c)} size={cardSize} />
              ))}
            </RaritySection>
          ))}
        </div>
      )}
    </div>
  )
}

function RaritySection({ rarity, children }) {
  const info = RARITIES[rarity]
  return (
    <div>
      <div className="flex items-center gap-3 mb-4 sticky top-16 z-10 bg-(--color-bg)/95 backdrop-blur-sm py-2">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: info?.color }} />
        <h3 className="text-lg font-bold uppercase tracking-wider" style={{ color: info?.color }}>
          {info?.name || rarity}
        </h3>
      </div>
      <div className="flex flex-wrap gap-4">
        {children}
      </div>
    </div>
  )
}

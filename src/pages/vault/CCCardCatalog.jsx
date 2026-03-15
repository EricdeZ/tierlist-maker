import { useState, useMemo, useEffect, useCallback } from 'react'
import GameCard from './components/GameCard'
import TradingCard from '../../components/TradingCard'
import TradingCardHolo from '../../components/TradingCardHolo'
import CardZoomModal from './components/CardZoomModal'
import { GODS } from '../../data/vault/gods'
import { ITEMS } from '../../data/vault/items'
import { CONSUMABLES } from '../../data/vault/buffs'
import { RARITIES, getHoloEffect } from '../../data/vault/economy'
import { vaultService } from '../../services/database'

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


const CARD_TYPES = [
  { key: 'overview', label: 'Overview' },
  { key: 'gods', label: 'Gods', count: GODS.length },
  { key: 'items', label: 'Items', count: ITEMS.length },
  { key: 'consumables', label: 'Consumables', count: CONSUMABLES.length },
]

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'unique']

const GOD_CLASSES = ['All', 'Guardian', 'Warrior', 'Assassin', 'Mage', 'Hunter']

export default function CCCardCatalog() {
  const [activeType, setActiveType] = useState('overview')
  const [selectedRarity, setSelectedRarity] = useState('all')
  const [classFilter, setClassFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [cardSize, setCardSize] = useState(240)
  const [defOverrides, setDefOverrides] = useState({})
  const [zoomedCard, setZoomedCard] = useState(null)

  // Load definition overrides (image positioning per god/item)
  useEffect(() => {
    vaultService.getDefinitionOverrides().then(data => {
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
    <div className="p-2 sm:p-6">
      <div className="mb-6 cd-section-accent pb-3">
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--cd-text)] cd-head">Card Catalog</h1>
        <p className="text-xs sm:text-sm text-[var(--cd-text-mid)] mt-1">
          <span className="cd-num text-[var(--cd-cyan)]">{GODS.length}</span> gods, <span className="cd-num text-[var(--cd-cyan)]">{ITEMS.length}</span> items, <span className="cd-num text-[var(--cd-cyan)]">{CONSUMABLES.length}</span> consumables &mdash; {RARITY_ORDER.length} rarities each
        </p>
      </div>

      {/* Type tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {CARD_TYPES.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveType(t.key)}
            className={`cd-clip-tag px-5 py-2 text-sm font-bold transition-all cursor-pointer cd-head tracking-wider ${
              activeType === t.key
                ? 'cd-pill-active'
                : 'bg-[var(--cd-edge)] text-[var(--cd-text-mid)] border border-[var(--cd-border)] cd-pill hover:bg-[var(--cd-border)]'
            }`}
          >
            {t.label}{t.count != null && <span className="text-xs opacity-60 cd-num"> ({t.count})</span>}
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
          className="cd-input rounded-lg px-3 py-1.5 text-sm w-48"
        />

        {/* Rarity filter */}
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setSelectedRarity('all')}
            className={`px-2.5 py-1 text-xs rounded font-bold transition-all cd-head ${
              selectedRarity === 'all' ? 'bg-white/20 text-white' : 'bg-[var(--cd-edge)] text-[var(--cd-text-dim)] cd-pill hover:bg-[var(--cd-border)]'
            }`}
          >
            All
          </button>
          {RARITY_ORDER.map(r => (
            <button
              key={r}
              onClick={() => setSelectedRarity(r)}
              className={`px-2.5 py-1 text-xs rounded font-bold capitalize transition-all cd-head ${
                selectedRarity === r ? 'text-black' : 'bg-[var(--cd-edge)] text-[var(--cd-text-dim)] cd-pill hover:bg-[var(--cd-border)]'
              }`}
              style={selectedRarity === r ? { backgroundColor: RARITIES[r]?.color, boxShadow: `0 0 10px ${RARITIES[r]?.color}44` } : undefined}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Class filter (gods only) */}
        {activeType === 'gods' && (
          <div className="flex flex-wrap gap-1">
            {GOD_CLASSES.map(cls => (
              <button
                key={cls}
                onClick={() => setClassFilter(cls)}
                className={`px-2.5 py-1 text-xs rounded font-bold transition-all cd-head ${
                  classFilter === cls ? 'cd-pill-active' : 'bg-[var(--cd-edge)] text-[var(--cd-text-dim)] cd-pill hover:bg-[var(--cd-border)]'
                }`}
              >
                {cls}
              </button>
            ))}
          </div>
        )}

        {/* Card size slider */}
        <div className="hidden sm:flex items-center gap-2 ml-auto">
          <span className="text-xs text-[var(--cd-text-dim)] cd-mono">{cardSize}px</span>
          <input type="range" min={100} max={400} value={cardSize} onChange={e => setCardSize(parseInt(e.target.value))} className="w-24" />
        </div>
      </div>

      {/* Overview — one of each type side by side */}
      {activeType === 'overview' && (
        <div className="space-y-10">
          {rarities.map(rarity => (
            <RaritySection key={rarity} rarity={rarity}>
              {rarity === 'common' ? (
                <div className="flex flex-col items-center gap-2">
                  <TradingCard {...SAMPLE_PLAYER} rarity={rarity} size={cardSize} holo={{ rarity: getHoloEffect(rarity), holoType: 'reverse' }} />
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">Player</span>
                </div>
              ) : (
                <>
                  {['holo', 'reverse', 'full'].map(holoType => (
                    <div key={holoType} className="flex flex-col items-center gap-2">
                      <TradingCard {...SAMPLE_PLAYER} rarity={rarity} size={cardSize} holo={{ rarity: getHoloEffect(rarity), holoType }} />
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                        Player ({holoType === 'holo' ? 'Holo' : holoType === 'reverse' ? 'Rev' : 'Full'})
                      </span>
                    </div>
                  ))}
                </>
              )}
              <div className="flex flex-col items-center gap-2">
                <TradingCardHolo rarity={getHoloEffect(rarity)} role="ADC" holoType="reverse" size={cardSize}>
                  <GameCard type="god" rarity={rarity} data={applyOverride('god', GODS[0].slug, GODS[0])} />
                </TradingCardHolo>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">God</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <TradingCardHolo rarity={getHoloEffect(rarity)} role="ADC" holoType="reverse" size={cardSize}>
                  <GameCard type="item" rarity={rarity} data={applyOverride('item', ITEMS[0].id, ITEMS[0])} />
                </TradingCardHolo>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Item</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <TradingCardHolo rarity={getHoloEffect(rarity)} role="ADC" holoType="reverse" size={cardSize}>
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
              {filteredGods.map(god => {
                const data = applyOverride('god', god.slug, god)
                return (
                  <div key={god.id} className="card-zoomable" onClick={() => setZoomedCard({ gameCard: { type: 'god', rarity, data } })}>
                    <GameCard type="god" rarity={rarity} data={data} size={cardSize} />
                  </div>
                )
              })}
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
                      {filteredItems.filter(i => i.category === cat).map(item => {
                        const data = applyOverride('item', item.id, item)
                        return (
                          <div key={item.id} className="card-zoomable" onClick={() => setZoomedCard({ gameCard: { type: 'item', rarity, data } })}>
                            <GameCard type="item" rarity={rarity} data={data} size={cardSize} />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </RaritySection>
            )
          })}
        </div>
      )}

      {activeType === 'consumables' && (
        <div className="space-y-10">
          {rarities.map(rarity => (
            <RaritySection key={rarity} rarity={rarity}>
              {CONSUMABLES.map(c => {
                const data = applyOverride('consumable', c.id, c)
                return (
                  <div key={c.id} className="card-zoomable" onClick={() => setZoomedCard({ gameCard: { type: 'consumable', rarity, data } })}>
                    <GameCard type="consumable" rarity={rarity} data={data} size={cardSize} />
                  </div>
                )
              })}
            </RaritySection>
          ))}
        </div>
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

function RaritySection({ rarity, children }) {
  const info = RARITIES[rarity]
  return (
    <div>
      <div className="text-center py-4 mb-4">
        <h3
          className="text-2xl cd-rarity-neon"
          style={{ '--cd-rarity-color': info?.color }}
        >
          {info?.name || rarity}
        </h3>
      </div>
      <div className="cd-full-bleed">
        <div className="flex flex-wrap gap-4 cd-stagger justify-center px-4">
          {children}
        </div>
      </div>
    </div>
  )
}

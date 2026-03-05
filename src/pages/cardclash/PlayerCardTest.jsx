import TradingCard from '../../components/TradingCard'
import TradingCardHolo from '../../components/TradingCardHolo'
import { RARITIES } from '../../data/cardclash/economy'

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary']
const RARITY_HOLO_MAP = {
  common: 'common',
  uncommon: 'holo',
  rare: 'galaxy',
  epic: 'cosmos',
  legendary: 'gold',
}

const SAMPLE = {
  playerName: 'Azulisc',
  teamName: 'Fallen Angels',
  teamColor: '#4A0093',
  seasonName: 'BSL Season 2',
  leagueName: 'BSL',
  divisionName: 'Division 1',
  role: 'JUNGLE',
  avatarUrl: null,
  stats: {
    gamesPlayed: 14,
    wins: 12,
    winRate: 85.7,
    kda: 4.3,
    avgDamage: 21886,
    avgMitigated: 13313,
    totalKills: 102,
    totalDeaths: 40,
    totalAssists: 141,
  },
  bestGod: {
    name: 'Medusa',
    imageUrl: null,
    games: 3,
    winRate: 100,
  },
}

export default function PlayerCardTest() {
  return (
    <div style={{ padding: 24, background: '#111', minHeight: '100vh' }}>
      <h1 style={{ color: '#fff', marginBottom: 16, fontSize: 20 }}>Player Card Test</h1>

      <h2 style={{ color: '#aaa', marginBottom: 12, fontSize: 14 }}>All rarities (Jungle)</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginBottom: 40 }}>
        {RARITY_ORDER.map(r => (
          <div key={r} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <TradingCardHolo rarity={RARITY_HOLO_MAP[r]} role="JUNGLE" holoType="reverse">
              <TradingCard {...SAMPLE} variant="player" />
            </TradingCardHolo>
            <span style={{ color: RARITIES[r]?.color, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
              {RARITIES[r]?.name}
            </span>
          </div>
        ))}
      </div>

      <h2 style={{ color: '#aaa', marginBottom: 12, fontSize: 14 }}>Scaled to 240px (overview size)</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
        <div className="card-overview-slot">
          <TradingCardHolo rarity="holo" role="JUNGLE" holoType="reverse">
            <TradingCard {...SAMPLE} variant="player" />
          </TradingCardHolo>
        </div>
        <div className="card-overview-slot">
          <TradingCard {...SAMPLE} variant="player" />
        </div>
      </div>

      <h2 style={{ color: '#aaa', marginBottom: 12, marginTop: 40, fontSize: 14 }}>Without holo (bare card)</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
        <TradingCard {...SAMPLE} variant="player" />
        <TradingCard {...SAMPLE} variant="player" role="SOLO" />
        <TradingCard {...SAMPLE} variant="player" role="SUPPORT" />
      </div>
    </div>
  )
}

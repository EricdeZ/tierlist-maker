import TradingCard from '../../components/TradingCard'
import TradingCardHolo from '../../components/TradingCardHolo'
import GameCard from './components/GameCard'
import { GODS } from '../../data/cardclash/gods'
import { ITEMS } from '../../data/cardclash/items'
import { MINIONS } from '../../data/cardclash/minions'
import { BUFFS, CONSUMABLES } from '../../data/cardclash/buffs'
import { RARITIES } from '../../data/cardclash/economy'

const SAMPLE = {
  playerName: 'Azulisc',
  teamName: 'Fallen Angels',
  teamColor: '#4A0093',
  seasonName: 'BSL Season 2',
  leagueName: 'BSL',
  divisionName: 'Division 1',
  role: 'JUNGLE',
  avatarUrl: 'https://cdn.discordapp.com/avatars/478745217873477633/56256acfe4e67cf501be26394773edd5.png?size=256',
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
    imageUrl: 'https://smitebrain.com/cdn-cgi/image/width=80,height=80,f=auto,fit=cover/https://images.smitebrain.com/images/gods/icons/medusa',
    games: 3,
    winRate: 100,
  },
}

export default function PlayerCardTest() {
  return (
    <div style={{ padding: 24, background: '#111', minHeight: '100vh' }}>
      <h1 style={{ color: '#fff', marginBottom: 16, fontSize: 20 }}>Card Size Comparison</h1>

      <h2 style={{ color: '#aaa', marginBottom: 12, fontSize: 14 }}>Overview — all types side by side (240px)</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div className="card-overview-slot">
            <TradingCardHolo rarity="holo" role="JUNGLE" holoType="reverse">
              <TradingCard {...SAMPLE} variant="player" />
            </TradingCardHolo>
          </div>
          <span style={{ color: '#aaa', fontSize: 10, textTransform: 'uppercase' }}>Player</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <GameCard type="god" rarity="rare" data={GODS[0]} />
          <span style={{ color: '#aaa', fontSize: 10, textTransform: 'uppercase' }}>God</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <GameCard type="item" rarity="rare" data={ITEMS[0]} />
          <span style={{ color: '#aaa', fontSize: 10, textTransform: 'uppercase' }}>Item</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <GameCard type="minion" rarity="rare" data={MINIONS[0]} />
          <span style={{ color: '#aaa', fontSize: 10, textTransform: 'uppercase' }}>Minion</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <GameCard type="buff" rarity="rare" data={BUFFS[0]} />
          <span style={{ color: '#aaa', fontSize: 10, textTransform: 'uppercase' }}>Buff</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <GameCard type="consumable" rarity="rare" data={CONSUMABLES[0]} />
          <span style={{ color: '#aaa', fontSize: 10, textTransform: 'uppercase' }}>Consumable</span>
        </div>
      </div>

      <h2 style={{ color: '#aaa', marginBottom: 12, marginTop: 40, fontSize: 14 }}>GameCards only — checking image alignment</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <GameCard type="god" rarity="epic" data={GODS[0]} />
        <GameCard type="item" rarity="epic" data={ITEMS[0]} />
        <GameCard type="minion" rarity="epic" data={MINIONS[0]} />
        <GameCard type="buff" rarity="epic" data={BUFFS[0]} />
        <GameCard type="consumable" rarity="epic" data={CONSUMABLES[0]} />
      </div>
    </div>
  )
}

import { useState, useMemo } from 'react';
import { useCardClash } from './CardClashContext';
import { getRankedTier, RANKED_TIERS } from '../../data/cardclash/economy';

const TABS = ['elo', 'wins', 'collection', 'streaks'];

// Generate fake leaderboard data
function generatePlayers(count = 50) {
  const adjectives = ['Mighty', 'Swift', 'Dark', 'Golden', 'Silent', 'Burning', 'Frozen', 'Storm', 'Shadow', 'Divine'];
  const nouns = ['Phoenix', 'Dragon', 'Wolf', 'Eagle', 'Titan', 'Knight', 'Sage', 'Blade', 'Arrow', 'Shield'];

  return Array.from({ length: count }, (_, i) => {
    const elo = Math.max(600, Math.floor(1800 - (i * 20) + (Math.random() - 0.5) * 100));
    const wins = Math.max(0, Math.floor(200 - i * 3 + (Math.random() - 0.5) * 40));
    const losses = Math.max(0, Math.floor(wins * (0.4 + Math.random() * 0.8)));
    return {
      id: `player-${i}`,
      name: `${adjectives[Math.floor(Math.random() * adjectives.length)]}${nouns[Math.floor(Math.random() * nouns.length)]}${Math.floor(Math.random() * 100)}`,
      elo,
      wins,
      losses,
      winRate: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0,
      cards: Math.floor(20 + Math.random() * 200),
      bestStreak: Math.floor(3 + Math.random() * 15),
      tier: getRankedTier(elo),
    };
  });
}

export default function Leaderboard() {
  const { elo, stats } = useCardClash();
  const [tab, setTab] = useState('elo');
  const myTier = getRankedTier(elo);

  const [players] = useState(() => generatePlayers(50));

  const sorted = useMemo(() => {
    const list = [...players];
    switch (tab) {
      case 'elo': list.sort((a, b) => b.elo - a.elo); break;
      case 'wins': list.sort((a, b) => b.wins - a.wins); break;
      case 'collection': list.sort((a, b) => b.cards - a.cards); break;
      case 'streaks': list.sort((a, b) => b.bestStreak - a.bestStreak); break;
    }
    return list;
  }, [players, tab]);

  // Find where player would rank
  const myRank = useMemo(() => {
    switch (tab) {
      case 'elo': return sorted.filter(p => p.elo > elo).length + 1;
      case 'wins': return sorted.filter(p => p.wins > stats.wins).length + 1;
      case 'collection': return sorted.length + 1;
      case 'streaks': return sorted.filter(p => p.bestStreak > stats.bestStreak).length + 1;
      default: return sorted.length + 1;
    }
  }, [sorted, tab, elo, stats]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-1">Leaderboard</h1>
      <p className="text-sm text-gray-400 mb-6">See how you stack up against other players</p>

      {/* Your rank card */}
      <div className="bg-gray-900 border border-gold/30 rounded-xl p-4 mb-6 flex items-center gap-6">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-2xl font-black text-black">
          #{myRank}
        </div>
        <div className="flex-1">
          <div className="font-bold text-white text-lg">You</div>
          <div className="text-sm text-gray-400">{myTier.name} - {elo} ELO</div>
        </div>
        <div className="grid grid-cols-3 gap-6 text-center">
          <div>
            <div className="text-lg font-bold text-green-400">{stats.wins}</div>
            <div className="text-xs text-gray-500">Wins</div>
          </div>
          <div>
            <div className="text-lg font-bold text-red-400">{stats.losses}</div>
            <div className="text-xs text-gray-500">Losses</div>
          </div>
          <div>
            <div className="text-lg font-bold text-purple-400">{stats.bestStreak}</div>
            <div className="text-xs text-gray-500">Best Streak</div>
          </div>
        </div>
      </div>

      {/* Tier distribution */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
        <h3 className="text-sm font-bold text-white mb-3">Tier Distribution</h3>
        <div className="flex gap-2">
          {RANKED_TIERS.map(tier => {
            const count = players.filter(p => p.tier.name === tier.name).length;
            const pct = Math.round((count / players.length) * 100);
            return (
              <div key={tier.name} className="flex-1 text-center">
                <div
                  className="h-20 rounded-t flex items-end justify-center"
                  style={{ backgroundColor: `${tier.color}15` }}
                >
                  <div
                    className="w-full rounded-t transition-all"
                    style={{
                      height: `${Math.max(pct * 2, 4)}%`,
                      backgroundColor: `${tier.color}60`,
                    }}
                  />
                </div>
                <div className="text-[10px] font-bold mt-1" style={{ color: tier.color }}>{tier.name}</div>
                <div className="text-[10px] text-gray-600">{count}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-900 rounded-lg p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded text-sm font-bold capitalize transition-colors ${
              tab === t ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t === 'elo' ? 'ELO Rating' : t === 'wins' ? 'Total Wins' : t === 'collection' ? 'Collection' : 'Win Streaks'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500 text-xs">
              <th className="py-3 px-4 text-left w-16">#</th>
              <th className="py-3 px-4 text-left">Player</th>
              <th className="py-3 px-4 text-left">Tier</th>
              <th className="py-3 px-4 text-right">ELO</th>
              <th className="py-3 px-4 text-right">W/L</th>
              <th className="py-3 px-4 text-right">Win%</th>
              {tab === 'collection' && <th className="py-3 px-4 text-right">Cards</th>}
              {tab === 'streaks' && <th className="py-3 px-4 text-right">Best Streak</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 25).map((player, i) => (
              <tr
                key={player.id}
                className={`border-b border-gray-800/50 ${i < 3 ? 'bg-gray-800/30' : 'hover:bg-gray-800/20'}`}
              >
                <td className="py-3 px-4">
                  <span className={`font-bold ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-orange-600' : 'text-gray-500'}`}>
                    {i + 1}
                  </span>
                </td>
                <td className="py-3 px-4 font-bold text-white">{player.name}</td>
                <td className="py-3 px-4">
                  <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ color: player.tier.color, backgroundColor: `${player.tier.color}15` }}>
                    {player.tier.name}
                  </span>
                </td>
                <td className="py-3 px-4 text-right text-purple-400 font-bold">{player.elo}</td>
                <td className="py-3 px-4 text-right">
                  <span className="text-green-400">{player.wins}</span>
                  <span className="text-gray-600">/</span>
                  <span className="text-red-400">{player.losses}</span>
                </td>
                <td className="py-3 px-4 text-right text-gray-300">{player.winRate}%</td>
                {tab === 'collection' && <td className="py-3 px-4 text-right text-cyan-400">{player.cards}</td>}
                {tab === 'streaks' && <td className="py-3 px-4 text-right text-amber-400">{player.bestStreak}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

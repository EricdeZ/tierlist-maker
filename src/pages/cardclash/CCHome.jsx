import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCardClash } from './CardClashContext';
import { getRankedTierFromElo } from './engine/CardClash';

export default function Home() {
  const { passion, embers, elo, collection, stats, lineup, generateStarterCollection, loaded } = useCardClash();
  const [, setSearchParams] = useSearchParams();

  const setTab = (key) => setSearchParams(key === 'home' ? {} : { tab: key });

  // Auto-generate starter cards on first visit
  useEffect(() => {
    if (loaded && collection.length === 0) {
      generateStarterCollection();
    }
  }, [loaded, collection.length, generateStarterCollection]);

  const tier = getRankedTierFromElo(elo);
  const filledSlots = Object.values(lineup).filter(Boolean).length;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-black bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
          SMITE CARD CLASH
        </h1>
        <p className="text-gray-400 mt-2 text-lg">Collect gods. Build decks. Conquer lanes.</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Passion" value={passion.toLocaleString()} color="text-amber-400" />
        <StatCard label="Cards" value={collection.length} color="text-blue-400" />
        <StatCard label="Rank" value={tier.name} color="text-purple-400" />
        <StatCard label="Win Rate" value={stats.wins + stats.losses > 0 ? `${Math.round(stats.wins / (stats.wins + stats.losses) * 100)}%` : '-'} color="text-green-400" />
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <ActionCard
          onClick={() => setTab('collection')}
          title="My Collection"
          description={`${collection.length} cards collected. Browse, filter, and manage your gods.`}
          gradient="from-blue-500/20 to-indigo-500/20"
          border="border-blue-500/30"
          cta="View Collection"
        />
        <ActionCard
          onClick={() => setTab('packs')}
          title="Open Packs"
          description="Spend Passion to open card packs and expand your collection"
          gradient="from-amber-500/20 to-orange-500/20"
          border="border-amber-500/30"
          cta="Browse Packs"
        />
        <ActionCard
          onClick={() => setTab('lineup')}
          title="Starting Five"
          description={`${filledSlots}/5 slots filled. Earn passive Passion income daily!`}
          gradient="from-green-500/20 to-cyan-500/20"
          border="border-green-500/30"
          cta="Manage Lineup"
        />
        <ActionCard
          onClick={() => setTab('clash')}
          title="Card Clash"
          description="Battle your Starting Five against other players"
          gradient="from-red-500/20 to-purple-500/20"
          border="border-red-500/30"
          cta={filledSlots < 5 ? `Need ${5 - filledSlots} more cards in lineup` : 'Find Match'}
          disabled={filledSlots < 5}
        />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-4">
        <QuickLink onClick={() => setTab('todo')} label="Roadmap" count="See what's planned" />
        <QuickLink
          label="Embers"
          count={`${embers} — Disenchant cards to earn`}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function ActionCard({ onClick, title, description, gradient, border, cta, disabled }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      className={`block text-left bg-gradient-to-br ${gradient} border ${border} rounded-xl p-6 transition-all ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.01] hover:border-opacity-60 cursor-pointer'
      }`}
    >
      <h2 className="text-xl font-bold text-white mb-1">{title}</h2>
      <p className="text-sm text-gray-400 mb-4">{description}</p>
      <span className={`text-sm font-bold ${disabled ? 'text-gray-500' : 'text-gold'}`}>{cta} &rarr;</span>
    </button>
  );
}

function QuickLink({ onClick, label, count }) {
  return (
    <button onClick={onClick} className={`bg-gray-900 border border-gray-800 rounded-lg p-3 transition-colors text-left ${onClick ? 'hover:border-gray-700 cursor-pointer' : ''}`}>
      <div className="text-sm font-bold text-white">{label}</div>
      <div className="text-xs text-gray-500">{count}</div>
    </button>
  );
}

import { useState, useMemo } from 'react';
import { useCardClash } from './CardClashContext';
import GodCard from './components/GodCard';
import { calculateDailyIncome, calculateAccruedIncome } from './economy/PassiveIncome';
import { RARITIES, SYNERGIES } from '../../data/cardclash/economy';

const ROLES = ['solo', 'jungle', 'mid', 'support', 'adc'];

const ROLE_LABELS = {
  solo: { name: 'Solo', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
  jungle: { name: 'Jungle', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30' },
  mid: { name: 'Mid', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30' },
  support: { name: 'Support', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/30' },
  adc: { name: 'ADC', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
};

export default function StartingFive() {
  const { lineup, collection, setLineupCard, collectIncome, lastCollected } = useCardClash();
  const [selectingRole, setSelectingRole] = useState(null);
  const [collectedAmount, setCollectedAmount] = useState(null);

  const income = useMemo(() => calculateDailyIncome(lineup), [lineup]);
  const accrued = useMemo(() => calculateAccruedIncome(income.daily, lastCollected), [income.daily, lastCollected]);

  // Cards available for a specific role
  const availableCards = useMemo(() => {
    if (!selectingRole) return [];
    return collection
      .filter(card => {
        // Must match role OR be a fill
        const cardRole = card.role || card.roleAffinity;
        return cardRole === selectingRole || cardRole === 'fill';
      })
      .filter(card => {
        // Not already in another lineup slot
        return !Object.entries(lineup).some(([role, c]) => role !== selectingRole && c?.id === card.id);
      })
      .sort((a, b) => (b.power || 0) - (a.power || 0));
  }, [selectingRole, collection, lineup]);

  const handleCollect = async () => {
    const amount = await collectIncome();
    setCollectedAmount(amount);
    setTimeout(() => setCollectedAmount(null), 3000);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold">Starting Five</h1>
          <p className="text-sm text-gray-400">Set one card per role to earn passive Passion income daily</p>
        </div>

        <div className="text-right">
          <div className="text-sm text-gray-400">Daily Income</div>
          <div className="text-2xl font-bold text-amber-400">{income.daily.toFixed(1)} Passion/day</div>
          {accrued > 0 && (
            <button
              onClick={handleCollect}
              className="mt-2 px-4 py-1.5 bg-amber-500 text-black rounded font-bold text-sm hover:bg-amber-400 transition-colors"
            >
              Collect {Math.floor(accrued)} Passion
            </button>
          )}
          {collectedAmount !== null && (
            <div className="text-green-400 text-sm mt-1 animate-pulse">+{collectedAmount} Passion collected!</div>
          )}
        </div>
      </div>

      {/* Lineup slots */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        {ROLES.map(role => {
          const card = lineup[role];
          const roleInfo = ROLE_LABELS[role];
          const roleIncome = income.breakdown[role];

          return (
            <div key={role} className="text-center">
              <div className={`text-sm font-bold ${roleInfo.color} mb-2`}>{roleInfo.name}</div>

              {card ? (
                <div className="relative">
                  <GodCard card={card} size="small" onClick={() => setSelectingRole(role)} />
                  <button
                    onClick={() => setLineupCard(role, null)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 rounded-full text-white text-xs font-bold hover:bg-red-500"
                  >
                    x
                  </button>
                  <div className="mt-2 text-xs text-amber-400 font-bold">
                    +{roleIncome?.total?.toFixed(1) || 0}/day
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setSelectingRole(role)}
                  className={`w-36 h-52 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 hover:border-opacity-60 transition-colors ${roleInfo.bg}`}
                >
                  <span className="text-3xl text-gray-600">+</span>
                  <span className="text-xs text-gray-500">Select {roleInfo.name}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Income breakdown */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
        <h3 className="text-sm font-bold text-white mb-3">Income Breakdown</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {income.breakdown.teamSynergy && (
            <div className="bg-gray-800 rounded p-2">
              <span className="text-green-400">Team Synergy</span>
              <span className="float-right text-green-300">+{(income.breakdown.teamSynergy.bonus * 100).toFixed(0)}%</span>
            </div>
          )}
          {income.breakdown.seasonSynergy && (
            <div className="bg-gray-800 rounded p-2">
              <span className="text-blue-400">Season Synergy</span>
              <span className="float-right text-blue-300">+{(income.breakdown.seasonSynergy.bonus * 100).toFixed(0)}%</span>
            </div>
          )}
          {income.breakdown.completeness && (
            <div className="bg-gray-800 rounded p-2">
              <span className="text-purple-400">All 5 Filled</span>
              <span className="float-right text-purple-300">+{(income.breakdown.completeness.bonus * 100).toFixed(0)}%</span>
            </div>
          )}
          {income.breakdown.powerBonus && (
            <div className="bg-gray-800 rounded p-2">
              <span className="text-amber-400">Power Bonus (avg {income.breakdown.powerBonus.avgPower})</span>
              <span className="float-right text-amber-300">+{income.breakdown.powerBonus.bonus}/day</span>
            </div>
          )}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-800 flex justify-between">
          <span className="text-gray-400">Weekly projection</span>
          <span className="text-amber-400 font-bold">{income.weekly.toFixed(1)} Passion</span>
        </div>
      </div>

      {/* Card selector modal */}
      {selectingRole && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-8" onClick={() => setSelectingRole(null)}>
          <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-4xl w-full max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Select {ROLE_LABELS[selectingRole].name} Card</h3>
              <button onClick={() => setSelectingRole(null)} className="text-gray-400 hover:text-white">&times;</button>
            </div>

            {availableCards.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No cards available for this role. Open packs to find {selectingRole} cards!</p>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                {availableCards.map(card => (
                  <GodCard
                    key={card.id}
                    card={card}
                    onClick={() => {
                      setLineupCard(selectingRole, card.id);
                      setSelectingRole(null);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

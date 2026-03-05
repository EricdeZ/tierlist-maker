import { useState, useMemo, useCallback } from 'react';
import { useCardClash } from './CardClashContext';
import { resolveCardClash, calculateElo, calculateRewards, getRankedTierFromElo } from './engine/CardClash';
import { GODS, getGodCardStats, getGodImageUrl } from '../../data/cardclash/gods';
import { GAME_MODES, RANKED_TIERS } from '../../data/cardclash/economy';

const ROLES = ['solo', 'jungle', 'mid', 'support', 'adc'];
const ROLE_LABELS = { solo: 'Solo', jungle: 'Jungle', mid: 'Mid', support: 'Support', adc: 'ADC' };

export default function CardClash() {
  const { lineup, elo, passion, stats, collection, reportBattle, testMode } = useCardClash();
  const [mode, setMode] = useState('quick');
  const [matchResult, setMatchResult] = useState(null);
  const [searching, setSearching] = useState(false);

  const filledSlots = Object.values(lineup).filter(Boolean).length;
  const canPlay = filledSlots === 5;
  const tier = getRankedTierFromElo(elo);

  // Generate AI opponent lineup
  const generateOpponent = useCallback(() => {
    const opponentLineup = {};
    const usedGods = new Set();

    for (const role of ROLES) {
      // Pick a random god appropriate for the role
      const classForRole = { solo: 'Warrior', jungle: 'Assassin', mid: 'Mage', support: 'Guardian', adc: 'Hunter' };
      const cls = classForRole[role];
      const candidates = GODS.filter(g => g.class === cls && !usedGods.has(g.id));
      const god = candidates[Math.floor(Math.random() * candidates.length)];
      if (god) {
        usedGods.add(god.id);
        const stats = getGodCardStats(god);
        // Generate power based on player's ELO (harder opponents at higher ELO)
        const basePower = 35 + Math.floor(Math.random() * 30) + Math.floor(elo / 100);
        opponentLineup[role] = {
          godName: god.name,
          godClass: god.class,
          role,
          imageUrl: getGodImageUrl(god),
          power: Math.min(basePower, 95),
          rarity: basePower > 80 ? 'epic' : basePower > 60 ? 'rare' : basePower > 40 ? 'uncommon' : 'common',
          level: Math.ceil(basePower / 25),
          levelBonus: Math.min(Math.floor(basePower / 20), 5),
          stats: {
            kda: (1 + Math.random() * 3).toFixed(2),
            winRate: 40 + Math.floor(Math.random() * 25),
            avgDamage: 5000 + Math.floor(Math.random() * 15000),
            avgMitigated: 3000 + Math.floor(Math.random() * 12000),
          },
          ability: god.ability,
        };
      }
    }
    return opponentLineup;
  }, [elo]);

  const handleFindMatch = useCallback(() => {
    if (!canPlay) return;

    setSearching(true);
    setMatchResult(null);

    // Simulate matchmaking delay
    setTimeout(async () => {
      const opponent = generateOpponent();
      const result = resolveCardClash(lineup, opponent, mode);

      const isWinner = result.winner === 1;

      // Calculate display values client-side
      const rewards = calculateRewards(mode, isWinner);
      const opponentElo = elo + Math.floor((Math.random() - 0.5) * 200);
      const eloCalc = mode === 'ranked' ? calculateElo(
        isWinner ? elo : opponentElo,
        isWinner ? opponentElo : elo
      ) : null;
      const displayEloChange = eloCalc ? (isWinner ? eloCalc.newWinnerElo - elo : eloCalc.newLoserElo - elo) : 0;

      // Report to server (updates stats, elo, passion)
      try {
        const serverResult = await reportBattle(mode, isWinner);
        setMatchResult({
          ...result,
          opponent,
          isWinner,
          rewards,
          eloChange: serverResult.eloChange || displayEloChange,
        });
      } catch {
        // Still show result even if server call fails
        setMatchResult({
          ...result,
          opponent,
          isWinner,
          rewards,
          eloChange: displayEloChange,
        });
      }
      setSearching(false);
    }, 1500);
  }, [canPlay, lineup, mode, elo, generateOpponent, reportBattle]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold">Card Clash</h1>
          <p className="text-sm text-gray-400">Battle your Starting Five against opponents</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-400">Ranked Tier</div>
          <div className="text-xl font-bold text-purple-400">{tier.name}</div>
          <div className="text-sm text-gray-500">{elo} ELO</div>
        </div>
      </div>

      {/* Mode selector */}
      <div className="flex gap-3 mb-6">
        {Object.entries(GAME_MODES).filter(([k]) => k !== 'tournament').map(([key, config]) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              mode === key ? 'bg-gold/20 text-gold border border-gold/30' : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
            }`}
          >
            {config.name}
            {config.entryFee > 0 && <span className="ml-1 text-xs text-amber-400">({config.entryFee}P)</span>}
          </button>
        ))}
      </div>

      {/* Mode info */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
        {mode === 'quick' && <p className="text-sm text-gray-400">Free to play. Win 5 Passion per match. Cooldown: 3 matches/hour.</p>}
        {mode === 'ranked' && <p className="text-sm text-gray-400">Entry: 10 Passion. Win: 18 Passion. ELO-based matchmaking. Weekly rewards by tier.</p>}
        {mode === 'wager' && <p className="text-sm text-gray-400">Challenge mode. Stake 25-500 Passion. Winner takes 90% of pot (10% house tax).</p>}
      </div>

      {/* Find match button */}
      <div className="text-center mb-8">
        {!canPlay ? (
          <div className="text-gray-500">
            <p className="text-lg">Fill all 5 lineup slots to play</p>
            <p className="text-sm">{filledSlots}/5 slots filled</p>
          </div>
        ) : searching ? (
          <div className="animate-pulse">
            <div className="text-xl text-gold">Searching for opponent...</div>
            <div className="mt-2 w-48 h-1 bg-gray-800 rounded mx-auto overflow-hidden">
              <div className="h-full bg-gold animate-[pulse_1s_ease-in-out_infinite] w-1/2" />
            </div>
          </div>
        ) : (
          <button
            onClick={handleFindMatch}
            className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-black font-bold rounded-xl text-lg hover:from-amber-400 hover:to-orange-500 transition-all hover:scale-105"
          >
            Find Match
          </button>
        )}
      </div>

      {/* Match result */}
      {matchResult && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className={`text-center text-3xl font-black mb-4 ${matchResult.isWinner ? 'text-green-400' : 'text-red-400'}`}>
            {matchResult.isWinner ? 'VICTORY' : 'DEFEAT'}
          </div>

          <div className="text-center text-sm text-gray-400 mb-6">
            Score: {matchResult.p1Wins} - {matchResult.p2Wins}
          </div>

          {/* Lane results */}
          <div className="space-y-3 mb-6">
            {matchResult.lanes.map((lane, i) => (
              <div key={i} className="flex items-center gap-4 bg-gray-800 rounded-lg p-3">
                <div className="w-20 text-right">
                  <div className="text-xs text-gray-400">{ROLE_LABELS[lane.role]}</div>
                </div>

                <div className="flex-1 flex items-center gap-3">
                  {/* Player card */}
                  <div className={`flex-1 text-right ${lane.winner === 1 ? 'text-green-400' : 'text-gray-500'}`}>
                    <div className="text-sm font-bold">{lineup[lane.role]?.godName || '?'}</div>
                    <div className="text-xs">{lane.p1Score}</div>
                  </div>

                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    lane.winner === 1 ? 'bg-green-500/20 text-green-400' : lane.winner === 2 ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-gray-400'
                  }`}>
                    {lane.winner === 1 ? 'W' : lane.winner === 2 ? 'L' : '-'}
                  </div>

                  {/* Opponent card */}
                  <div className={`flex-1 text-left ${lane.winner === 2 ? 'text-red-400' : 'text-gray-500'}`}>
                    <div className="text-sm font-bold">{matchResult.opponent[lane.role]?.godName || '?'}</div>
                    <div className="text-xs">{lane.p2Score}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Rewards */}
          <div className="flex justify-center gap-6 text-center">
            <div>
              <div className={`text-lg font-bold ${matchResult.rewards.passion >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                {matchResult.rewards.passion >= 0 ? '+' : ''}{matchResult.rewards.passion} Passion
              </div>
            </div>
            {matchResult.eloChange !== 0 && (
              <div>
                <div className={`text-lg font-bold ${matchResult.eloChange >= 0 ? 'text-purple-400' : 'text-red-400'}`}>
                  {matchResult.eloChange >= 0 ? '+' : ''}{matchResult.eloChange} ELO
                </div>
              </div>
            )}
            <div>
              <div className="text-lg font-bold text-cyan-400">+{matchResult.rewards.xp} XP</div>
              <div className="text-xs text-gray-500">per card</div>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="mt-8 grid grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-green-400">{stats.wins}</div>
          <div className="text-xs text-gray-500">Wins</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-red-400">{stats.losses}</div>
          <div className="text-xs text-gray-500">Losses</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-amber-400">{stats.streak}</div>
          <div className="text-xs text-gray-500">Current Streak</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-purple-400">{stats.bestStreak}</div>
          <div className="text-xs text-gray-500">Best Streak</div>
        </div>
      </div>
    </div>
  );
}

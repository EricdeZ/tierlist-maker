// Card Clash - simplified PvP battle system (Starting Five vs Starting Five)
// Separate from the full 3-lane game - this is the quick matchmaking mode

import { GAME_MODES, RANKED_TIERS } from '../../../data/cardclash/economy';

// Lane roles for Starting Five battles
const ROLES = ['solo', 'jungle', 'mid', 'support', 'adc'];

// Role-specific stat weights for battle score calculation
const ROLE_WEIGHTS = {
  solo:    { hp: 0.2, attack: 0.2, defense: 0.4, abilityPower: 0.2 },
  jungle:  { hp: 0.1, attack: 0.4, defense: 0.1, abilityPower: 0.4 },
  mid:     { hp: 0.1, attack: 0.1, defense: 0.1, abilityPower: 0.7 },
  support: { hp: 0.3, attack: 0.1, defense: 0.4, abilityPower: 0.2 },
  adc:     { hp: 0.1, attack: 0.5, defense: 0.1, abilityPower: 0.3 },
};

// Resolve a Starting Five vs Starting Five battle
export function resolveCardClash(lineup1, lineup2, mode = 'quick') {
  const results = {
    mode,
    lanes: [],
    p1Wins: 0,
    p2Wins: 0,
    winner: null,
    details: [],
  };

  for (const role of ROLES) {
    const card1 = lineup1[role];
    const card2 = lineup2[role];

    if (!card1 && !card2) {
      results.lanes.push({ role, winner: 'draw', p1Score: 0, p2Score: 0 });
      continue;
    }
    if (!card1) {
      results.p2Wins++;
      results.lanes.push({ role, winner: 2, p1Score: 0, p2Score: 1 });
      continue;
    }
    if (!card2) {
      results.p1Wins++;
      results.lanes.push({ role, winner: 1, p1Score: 1, p2Score: 0 });
      continue;
    }

    const p1Score = calculateBattleScore(card1, role);
    const p2Score = calculateBattleScore(card2, role);

    if (p1Score > p2Score) {
      results.p1Wins++;
      results.lanes.push({ role, winner: 1, p1Score, p2Score, p1Card: card1, p2Card: card2 });
    } else if (p2Score > p1Score) {
      results.p2Wins++;
      results.lanes.push({ role, winner: 2, p1Score, p2Score, p1Card: card1, p2Card: card2 });
    } else {
      // Tie: higher power wins, then coin flip
      if (card1.power > card2.power) {
        results.p1Wins++;
        results.lanes.push({ role, winner: 1, p1Score, p2Score, p1Card: card1, p2Card: card2 });
      } else if (card2.power > card1.power) {
        results.p2Wins++;
        results.lanes.push({ role, winner: 2, p1Score, p2Score, p1Card: card1, p2Card: card2 });
      } else {
        const coinFlip = Math.random() > 0.5 ? 1 : 2;
        if (coinFlip === 1) results.p1Wins++;
        else results.p2Wins++;
        results.lanes.push({ role, winner: coinFlip, p1Score, p2Score, p1Card: card1, p2Card: card2, tieBreak: true });
      }
    }
  }

  results.winner = results.p1Wins > results.p2Wins ? 1 : results.p2Wins > results.p1Wins ? 2 : (Math.random() > 0.5 ? 1 : 2);

  return results;
}

// Calculate battle score for a card in a specific role
function calculateBattleScore(card, role) {
  const weights = ROLE_WEIGHTS[role];
  const power = card.power || 50;
  const levelBonus = card.levelBonus || 0;

  // Base stat score from card power + level
  const effectivePower = power + levelBonus;

  // Role weight adjustments
  const statScore = (
    (card.stats?.kda || 1) * weights.attack * 10 +
    (card.stats?.avgDamage || 5000) / 1000 * weights.abilityPower +
    (card.stats?.avgMitigated || 5000) / 1000 * weights.defense +
    (card.stats?.winRate || 50) / 10 * weights.hp
  );

  // Random factor: 70% skill, 30% luck
  const randomFactor = 0.7 + Math.random() * 0.3;

  // Role affinity bonus: +20% if card's role matches
  const affinityBonus = card.role?.toLowerCase() === role ? 1.2 : 1.0;

  return Math.round(effectivePower * randomFactor * affinityBonus + statScore);
}

// ELO calculation
export function calculateElo(winnerElo, loserElo, kFactor = 32) {
  const expectedWin = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const expectedLose = 1 - expectedWin;

  return {
    newWinnerElo: Math.round(winnerElo + kFactor * (1 - expectedWin)),
    newLoserElo: Math.round(loserElo + kFactor * (0 - expectedLose)),
  };
}

// Calculate rewards for a match
export function calculateRewards(mode, isWinner, wagerAmount = 0) {
  const modeConfig = GAME_MODES[mode];
  if (!modeConfig) return { passion: 0, xp: 0 };

  let passion = 0;
  let xp = 0;

  if (isWinner) {
    if (mode === 'wager') {
      passion = Math.floor(wagerAmount * 2 * (1 - modeConfig.houseTax)); // winner gets 90% of pool
    } else {
      passion = modeConfig.winReward;
    }
    xp = 25; // per card in lineup
  } else {
    if (mode === 'wager') {
      passion = -wagerAmount;
    } else if (mode === 'ranked') {
      passion = -modeConfig.entryFee;
    }
    xp = 5;
  }

  return { passion, xp };
}

// Quick matchmaking - find opponent with similar ELO
export function findMatch(playerElo, playerPool) {
  // Sort by ELO distance
  const sorted = playerPool
    .filter(p => Math.abs(p.elo - playerElo) < 300) // within 300 ELO
    .sort((a, b) => Math.abs(a.elo - playerElo) - Math.abs(b.elo - playerElo));

  return sorted[0] || null;
}

// Get ranked tier from ELO
export function getRankedTierFromElo(elo) {
  for (let i = RANKED_TIERS.length - 1; i >= 0; i--) {
    if (elo >= RANKED_TIERS[i].minElo) return RANKED_TIERS[i];
  }
  return RANKED_TIERS[0];
}

export default {
  resolveCardClash,
  calculateElo,
  calculateRewards,
  findMatch,
  getRankedTierFromElo,
};

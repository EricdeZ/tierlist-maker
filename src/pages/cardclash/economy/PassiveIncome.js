// Starting Five passive income calculator

import { RARITIES, SYNERGIES, POWER_BONUSES, INCOME } from '../../../data/cardclash/economy';

// Calculate daily passive income from a Starting Five lineup
export function calculateDailyIncome(lineup, options = {}) {
  const {
    performanceMultipliers = {}, // { role: multiplier } from Forge
    teamIds = {},                // { role: teamId } to detect team synergy
    seasonIds = {},              // { role: seasonId } to detect season synergy
    orgIds = {},                 // { role: orgId } to detect org synergy
    rivalPairs = [],             // [[teamId1, teamId2], ...] teams that played each other
    hasForgeHolding = {},        // { role: boolean } whether user holds Sparks
  } = options;

  const roles = ['solo', 'jungle', 'mid', 'support', 'adc'];
  const breakdown = {};
  let totalIncome = 0;
  let filledSlots = 0;

  // Per-card income
  for (const role of roles) {
    const card = lineup[role];
    if (!card) {
      breakdown[role] = { base: 0, multipliers: [], total: 0, empty: true };
      continue;
    }

    filledSlots++;
    const rarityInfo = RARITIES[card.rarity] || RARITIES.common;
    let base = rarityInfo.passiveIncome;
    const multipliers = [];

    // Performance multiplier (from Forge system)
    const perfMult = performanceMultipliers[role] || 1.0;
    if (perfMult !== 1.0) {
      multipliers.push({ name: 'Performance', value: perfMult });
    }

    // Forge holding bonus
    if (hasForgeHolding[role]) {
      multipliers.push({ name: 'Forge Holder', value: 1 + SYNERGIES.forgeHolding.bonus });
    }

    // Calculate role income
    let roleIncome = base;
    for (const mult of multipliers) {
      roleIncome *= mult.value;
    }

    breakdown[role] = {
      card: card.godName,
      rarity: card.rarity,
      base,
      multipliers,
      subtotal: Math.round(roleIncome * 100) / 100,
    };
  }

  // Team synergy check
  const teamCounts = {};
  for (const role of roles) {
    const teamId = teamIds[role];
    if (teamId) teamCounts[teamId] = (teamCounts[teamId] || 0) + 1;
  }

  let teamSynergyBonus = 1;
  for (const [teamId, count] of Object.entries(teamCounts)) {
    if (count >= 5) {
      teamSynergyBonus = 1 + SYNERGIES.teammates.fullSquad;
      breakdown.teamSynergy = { type: 'Full Squad', bonus: SYNERGIES.teammates.fullSquad, teamId };
    } else if (count >= 2) {
      teamSynergyBonus = Math.max(teamSynergyBonus, 1 + SYNERGIES.teammates.bonus);
      breakdown.teamSynergy = { type: 'Teammates', bonus: SYNERGIES.teammates.bonus, count, teamId };
    }
  }

  // Season synergy check
  const seasonSet = new Set(roles.map(r => seasonIds[r]).filter(Boolean));
  let seasonSynergyBonus = 1;
  if (seasonSet.size === 1 && filledSlots === 5) {
    seasonSynergyBonus = 1 + SYNERGIES.sameSeason.bonus;
    breakdown.seasonSynergy = { bonus: SYNERGIES.sameSeason.bonus };
  }

  // Organization synergy check
  const orgCounts = {};
  for (const role of roles) {
    const orgId = orgIds[role];
    if (orgId) orgCounts[orgId] = (orgCounts[orgId] || 0) + 1;
  }

  let orgSynergyBonus = 1;
  for (const [orgId, count] of Object.entries(orgCounts)) {
    if (count >= 2) {
      orgSynergyBonus = Math.max(orgSynergyBonus, 1 + SYNERGIES.organization.bonus);
      breakdown.orgSynergy = { bonus: SYNERGIES.organization.bonus, count, orgId };
    }
  }

  // Rival synergy check
  let rivalBonus = 0;
  const lineupTeams = new Set(roles.map(r => teamIds[r]).filter(Boolean));
  for (const [t1, t2] of rivalPairs) {
    if (lineupTeams.has(t1) && lineupTeams.has(t2)) {
      rivalBonus += SYNERGIES.rivals.bonus;
    }
  }
  const rivalSynergyBonus = 1 + rivalBonus;

  // Completeness bonus
  const completenessBonus = filledSlots === 5 ? (1 + SYNERGIES.completeness.bonus) : 1;
  if (filledSlots === 5) {
    breakdown.completeness = { bonus: SYNERGIES.completeness.bonus };
  }

  // Calculate total with synergies
  for (const role of roles) {
    if (breakdown[role].empty) continue;
    let roleTotal = breakdown[role].subtotal;
    roleTotal *= teamSynergyBonus;
    roleTotal *= seasonSynergyBonus;
    roleTotal *= orgSynergyBonus;
    roleTotal *= rivalSynergyBonus;
    roleTotal *= completenessBonus;
    breakdown[role].total = Math.round(roleTotal * 100) / 100;
    totalIncome += breakdown[role].total;
  }

  // Power bonus (flat)
  const avgPower = filledSlots > 0
    ? Math.round(roles.reduce((sum, r) => sum + (lineup[r]?.power || 0), 0) / filledSlots)
    : 0;

  let powerBonus = 0;
  for (const tier of POWER_BONUSES) {
    if (avgPower >= tier.minAvg && avgPower <= tier.maxAvg) {
      powerBonus = tier.bonus;
      break;
    }
  }

  if (powerBonus > 0) {
    breakdown.powerBonus = { avgPower, bonus: powerBonus };
    totalIncome += powerBonus;
  }

  return {
    daily: Math.round(totalIncome * 100) / 100,
    weekly: Math.round(totalIncome * 7 * 100) / 100,
    breakdown,
    filledSlots,
    avgPower,
  };
}

// Calculate accrued income since last collection
export function calculateAccruedIncome(dailyRate, lastCollectedAt) {
  if (!lastCollectedAt) return dailyRate; // first collection = 1 day

  const now = Date.now();
  const elapsed = now - lastCollectedAt;
  const days = elapsed / (1000 * 60 * 60 * 24);
  const cappedDays = Math.min(days, INCOME.maxAccrualDays);

  return Math.round(dailyRate * cappedDays * 100) / 100;
}

export default { calculateDailyIncome, calculateAccruedIncome };

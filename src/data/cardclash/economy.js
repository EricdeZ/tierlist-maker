// Economy constants for the card game

// Card rarities and their holographic effects (from existing TradingCardHolo system)
export const RARITIES = {
  common:    { tier: 5, name: 'Common',    holoEffects: ['common'],                        dropRate: 0.45, color: '#9ca3af', passiveIncome: 1, emberValue: 5,   craftCost: 25,  targetedCraftCost: 50 },
  uncommon:  { tier: 4, name: 'Uncommon',  holoEffects: ['holo', 'amazing', 'reverse'],     dropRate: 0.28, color: '#22c55e', passiveIncome: 2, emberValue: 15,  craftCost: 75,  targetedCraftCost: 150 },
  rare:      { tier: 3, name: 'Rare',      holoEffects: ['galaxy', 'vstar', 'shiny', 'ultra'], dropRate: 0.17, color: '#3b82f6', passiveIncome: 4, emberValue: 40,  craftCost: 200, targetedCraftCost: 400 },
  epic:      { tier: 2, name: 'Epic',      holoEffects: ['radiant', 'sparkle', 'rainbow-alt', 'cosmos'], dropRate: 0.08, color: '#a855f7', passiveIncome: 7, emberValue: 100, craftCost: 500, targetedCraftCost: 1000 },
  legendary: { tier: 1, name: 'Legendary', holoEffects: ['rainbow', 'secret', 'gold'],     dropRate: 0.02, color: '#ff8c00', passiveIncome: 12, emberValue: 300, craftCost: 1500, targetedCraftCost: 3000 },
  mythic:    { tier: 0, name: 'Mythic',    holoEffects: ['rainbow', 'secret', 'gold', 'cosmos'], dropRate: 0.005, color: '#ef4444', passiveIncome: 20, emberValue: 750, craftCost: 5000, targetedCraftCost: 10000 },
};

// Pack types
export const PACKS = {
  standard: { name: 'Standard Pack', cost: 75, cards: 3, guarantees: [{ minRarity: 'uncommon', count: 1 }] },
  premium:  { name: 'Premium Pack',  cost: 200, cards: 5, guarantees: [{ minRarity: 'rare', count: 1 }] },
  elite:    { name: 'Elite Pack',    cost: 500, cards: 5, guarantees: [{ minRarity: 'epic', count: 1 }, { minRarity: 'rare', count: 2 }] },
  legendary:{ name: 'Legendary Pack', cost: 1500, cards: 7, guarantees: [{ minRarity: 'legendary', count: 1 }] },
};

// Card Clash game modes
export const GAME_MODES = {
  quick:      { name: 'Quick Match',  entryFee: 0,  winReward: 5,   losePenalty: 0,   matchmake: 'random' },
  ranked:     { name: 'Ranked Match', entryFee: 10, winReward: 18,  losePenalty: 0,   matchmake: 'elo' },
  wager:      { name: 'Wager Match',  entryFee: 0,  winReward: 0,   losePenalty: 0,   matchmake: 'challenge', houseTax: 0.10, minWager: 25, maxWager: 500 },
  tournament: { name: 'Tournament',   entryFee: 0,  winReward: 0,   losePenalty: 0,   matchmake: 'swiss', prizes: { 1: { passion: 200, pack: 'elite' }, 2: { passion: 100, pack: 'premium' }, 3: { passion: 100, pack: 'premium' }, top8: { passion: 50, pack: 'standard' }, participation: { passion: 10 } } },
};

// Card Clash ranked tiers
export const RANKED_TIERS = [
  { name: 'Bronze',   minElo: 0,    maxElo: 999,  weeklyReward: 10,   rewardPack: null },
  { name: 'Silver',   minElo: 1000, maxElo: 1199, weeklyReward: 25,   rewardPack: null },
  { name: 'Gold',     minElo: 1200, maxElo: 1399, weeklyReward: 50,   rewardPack: null },
  { name: 'Platinum', minElo: 1400, maxElo: 1599, weeklyReward: 100,  rewardPack: null },
  { name: 'Diamond',  minElo: 1600, maxElo: 1799, weeklyReward: 150,  rewardPack: null },
  { name: 'Master',   minElo: 1800, maxElo: 9999, weeklyReward: 200,  rewardPack: 'standard' },
];

// Card leveling
export const CARD_LEVELS = [
  { level: 1, xpRequired: 0,    powerBonus: 0 },
  { level: 2, xpRequired: 100,  powerBonus: 1 },
  { level: 3, xpRequired: 300,  powerBonus: 2 },
  { level: 4, xpRequired: 600,  powerBonus: 3 },
  { level: 5, xpRequired: 1000, powerBonus: 5 },
];

// XP sources
export const XP_SOURCES = {
  dailyLineup: 10,
  clashWin: 25,
  clashLoss: 5,
};

// Marketplace fees
export const MARKETPLACE = {
  listingFeePercent: 5, // 5% of sale price
  maxActiveListings: 10,
  listingDurationDays: 7,
};

// Trade limits
export const TRADING = {
  maxCardsPerSide: 5,
  maxPassionPerSide: 5000,
  expiryHours: 24,
};

// Starting Five lineup synergies
export const SYNERGIES = {
  teammates: { min: 2, bonus: 0.15, fullSquad: 0.50, description: '2+ same team: +15% each. Full team: +50%' },
  sameSeason: { count: 5, bonus: 0.20, description: 'All 5 from same season: +20%' },
  organization: { min: 2, bonus: 0.10, description: '2+ same org: +10% each' },
  rivals: { bonus: 0.05, description: 'Cards from teams that played each other: +5% per pair' },
  completeness: { bonus: 0.10, description: 'All 5 slots filled: +10%' },
  forgeHolding: { bonus: 0.05, description: 'Own Sparks in card\'s player: +5%' },
};

// Power bonus tiers
export const POWER_BONUSES = [
  { minAvg: 40, maxAvg: 59, bonus: 1 },
  { minAvg: 60, maxAvg: 79, bonus: 3 },
  { minAvg: 80, maxAvg: 99, bonus: 5 },
];

// Passive income collection
export const INCOME = {
  maxAccrualDays: 7,
  collectionCooldownMs: 0, // can collect anytime
};

// Upgrade costs (combine 3 copies + embers)
export const UPGRADE = {
  copiesRequired: 3,
  powerBonusOnUpgrade: 5,
  // ember cost = target rarity's craftCost
};

export function getRankedTier(elo) {
  return RANKED_TIERS.find(t => elo >= t.minElo && elo <= t.maxElo) || RANKED_TIERS[0];
}

export function getCardLevel(xp) {
  for (let i = CARD_LEVELS.length - 1; i >= 0; i--) {
    if (xp >= CARD_LEVELS[i].xpRequired) return CARD_LEVELS[i];
  }
  return CARD_LEVELS[0];
}

export function getRarityInfo(rarity) {
  return RARITIES[rarity] || RARITIES.common;
}

export function getRandomHoloEffect(rarity) {
  const info = getRarityInfo(rarity);
  return info.holoEffects[Math.floor(Math.random() * info.holoEffects.length)];
}

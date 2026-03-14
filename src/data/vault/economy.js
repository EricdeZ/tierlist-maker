// Economy constants for Card Clash

// Card rarities and their holographic effects
export const RARITIES = {
  common:    { tier: 5, name: 'Common',    holoEffects: ['common'],                        dropRate: 0.60, color: '#9ca3af', emberValue: 5,   craftCost: 25,  targetedCraftCost: 50,   dismantleValue: 0.2 },
  uncommon:  { tier: 4, name: 'Uncommon',  holoEffects: ['holo', 'amazing', 'reverse'],     dropRate: 0.30, color: '#22c55e', emberValue: 15,  craftCost: 75,  targetedCraftCost: 150,  dismantleValue: 1 },
  rare:      { tier: 3, name: 'Rare',      holoEffects: ['galaxy', 'vstar', 'shiny', 'ultra'], dropRate: 0.06, color: '#3b82f6', emberValue: 40,  craftCost: 200, targetedCraftCost: 400,  dismantleValue: 3 },
  epic:      { tier: 2, name: 'Epic',      holoEffects: ['radiant', 'sparkle', 'rainbow-alt', 'cosmos'], dropRate: 0.025, color: '#a855f7', emberValue: 100, craftCost: 500, targetedCraftCost: 1000, dismantleValue: 8 },
  legendary: { tier: 1, name: 'Legendary', holoEffects: ['rainbow', 'secret', 'gold'],     dropRate: 0.003, color: '#ff8c00', emberValue: 300, craftCost: 1500, targetedCraftCost: 3000, dismantleValue: 25 },
  mythic:    { tier: 0, name: 'Mythic',    holoEffects: ['rainbow', 'secret', 'gold', 'cosmos'], dropRate: 0.0005, color: '#ef4444', emberValue: 750, craftCost: 5000, targetedCraftCost: 10000, dismantleValue: 75 },
};

// Pack types — costs are in Ember
export const PACKS = {
  standard: { name: 'Standard Pack', cost: 10, cards: 3, guarantees: [{ minRarity: 'uncommon', count: 1 }], category: 'rarity' },
  premium:  { name: 'Premium Pack',  cost: 27, cards: 5, guarantees: [{ minRarity: 'rare', count: 1 }], category: 'rarity' },
  elite:    { name: 'Elite Pack',    cost: 65, cards: 5, guarantees: [{ minRarity: 'epic', count: 1 }, { minRarity: 'rare', count: 2 }], category: 'rarity' },
  legendary:{ name: 'Legendary Pack', cost: 200, cards: 7, guarantees: [{ minRarity: 'legendary', count: 1 }], category: 'rarity' },
  mixed:    { name: 'Mixed Pack',    cost: 20, cards: 6, guarantees: [], category: 'mixed',
    description: '1 guaranteed Player Card, random mix of types, rare slot + wildcard' },
  'osl-mixed': { name: 'OSL Pack', cost: 20, cards: 6, guarantees: [], category: 'mixed',
    leagueId: 2, leagueSlug: 'osl', leagueName: 'Olympus Smite League', color: '#d2b138',
    description: 'OSL players only — gods, items, consumables & an Olympus player card' },
  'bsl-mixed': { name: 'BSL Pack', cost: 20, cards: 6, guarantees: [], category: 'mixed',
    leagueId: 3, leagueSlug: 'bsl', leagueName: 'Babylon Smite League', color: '#2795cf',
    description: 'BSL players only — gods, items, consumables & a Babylon player card' },
  gift: { name: 'Gift Pack', cost: 0, cards: 7, guarantees: [], category: 'mixed',
    description: 'A gift from a friend! Contains 7 cards from both leagues.' },
};

// Canonical holo effect per rarity — one fixed effect per tier
export const RARITY_HOLO_MAP = {
  common: 'common', uncommon: 'holo', rare: 'galaxy',
  epic: 'cosmos', legendary: 'gold', mythic: 'rainbow',
};

export function getHoloEffect(rarity) {
  return RARITY_HOLO_MAP[rarity] || 'common';
}

export function getRarityInfo(rarity) {
  return RARITIES[rarity] || RARITIES.common;
}

export function getRandomHoloEffect(rarity) {
  const info = getRarityInfo(rarity);
  return info.holoEffects[Math.floor(Math.random() * info.holoEffects.length)];
}

// Dismantle diminishing returns — tiers based on cumulative base value (Cores) dismantled today
export const DISMANTLE_TIERS = [
  { upTo: 120, rate: 1.0 },
  { upTo: 160, rate: 0.75 },
  { upTo: 200, rate: 0.5 },
  { upTo: Infinity, rate: 0.25 },
];

export function getDismantleMultiplier(valueAccumulated) {
  for (const tier of DISMANTLE_TIERS) {
    if (valueAccumulated < tier.upTo) return tier.rate;
  }
  return 0.1;
}

// Split a single card's base value across tier boundaries
function applyTieredValue(base, cumulativeBase) {
  let remaining = base;
  let value = 0;
  let pos = cumulativeBase;
  for (const tier of DISMANTLE_TIERS) {
    if (remaining <= 0) break;
    if (pos >= tier.upTo) continue;
    const chunk = tier.upTo === Infinity ? remaining : Math.min(tier.upTo - pos, remaining);
    value += chunk * tier.rate;
    remaining -= chunk;
    pos += chunk;
  }
  return value;
}

export function calcDismantleTotal(cards, dismantledValueToday) {
  const sorted = [...cards].sort((a, b) => (RARITIES[b.rarity]?.dismantleValue || 0) - (RARITIES[a.rarity]?.dismantleValue || 0));
  let total = 0;
  let cumulativeBase = dismantledValueToday;
  for (const card of sorted) {
    const base = RARITIES[card.rarity]?.dismantleValue || 0;
    total += applyTieredValue(base, cumulativeBase);
    cumulativeBase += base;
  }
  return Math.floor(Math.round(total * 10) / 10);
}

// Marketplace fee constants (Core-only)
export const MARKETPLACE = {
  feePercent: 0.02,
  minFee: 1,          // minimum 1 Core fee per side
  maxListings: 15,
};

// Starting 5 passive income rates (per day, per card)
export const STARTING_FIVE_RATES = {
  holo: { uncommon: 2, rare: 4, epic: 6, legendary: 10, mythic: 16 },
  reverse: { uncommon: 2, rare: 3, epic: 5, legendary: 8, mythic: 12 },
  full: {
    passion: { uncommon: 1.2, rare: 2.4, epic: 3.6, legendary: 6, mythic: 9.6 },
    cores: { uncommon: 1.2, rare: 1.8, epic: 3, legendary: 4.8, mythic: 7.2 },
  },
};

export const STARTING_FIVE_CAP_DAYS = 2;

// Attachment bonuses — percentage multipliers on the player's base income
// God cards give larger bonuses than items; cores bonuses are higher than passion
export const ATTACHMENT_BONUSES = {
  god: {
    passion: { uncommon: 0.08, rare: 0.14, epic: 0.22, legendary: 0.38, mythic: 0.50 },
    cores:   { uncommon: 0.15, rare: 0.25, epic: 0.40, legendary: 0.65, mythic: 0.80 },
  },
  item: {
    passion: { uncommon: 0.03, rare: 0.07, epic: 0.14, legendary: 0.22, mythic: 0.30 },
    cores:   { uncommon: 0.08, rare: 0.16, epic: 0.30, legendary: 0.48, mythic: 0.60 },
  },
};

export const FULL_HOLO_ATTACHMENT_RATIO = 0.6;
export const GOD_SYNERGY_BONUS = 0.30;
// Consumable slot — rarity-based total boost (non-linear scaling)
export const CONSUMABLE_SLOT_SCALING = {
  common: 0.50, uncommon: 0.60, rare: 0.80, epic: 1.00, legendary: 1.40, mythic: 2.00,
};

// Per-consumable passion/cores spread (ratios sum to 1.0)
export const CONSUMABLE_SPREADS = {
  'health-pot':  { passion: 0.75, cores: 0.25 },
  'mana-pot':    { passion: 0.25, cores: 0.75 },
  'multi-pot':   { passion: 0.50, cores: 0.50 },
  'elixir-str':  { passion: 1.00, cores: 0.00 },
  'elixir-int':  { passion: 0.00, cores: 1.00 },
  'ward':        { passion: 0.60, cores: 0.40 },
  'sentry':      { passion: 0.40, cores: 0.60 },
};

export function getConsumableBoost(consumableId, rarity) {
  const total = CONSUMABLE_SLOT_SCALING[rarity] || 0;
  const spread = CONSUMABLE_SPREADS[consumableId] || { passion: 0.5, cores: 0.5 };
  return {
    passionBoost: total * spread.passion,
    coresBoost: total * spread.cores,
  };
}

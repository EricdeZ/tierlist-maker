// Economy constants for Card Clash

// Card rarities and their holographic effects
export const RARITIES = {
  common:    { tier: 5, name: 'Common',    holoEffects: ['common'],                        dropRate: 0.60, color: '#9ca3af', emberValue: 5,   craftCost: 25,  targetedCraftCost: 50,   dismantleValue: 0.2 },
  uncommon:  { tier: 4, name: 'Uncommon',  holoEffects: ['holo', 'amazing', 'reverse'],     dropRate: 0.30, color: '#22c55e', emberValue: 15,  craftCost: 75,  targetedCraftCost: 150,  dismantleValue: 1 },
  rare:      { tier: 3, name: 'Rare',      holoEffects: ['galaxy', 'vstar', 'shiny', 'ultra'], dropRate: 0.06, color: '#3b82f6', emberValue: 40,  craftCost: 200, targetedCraftCost: 400,  dismantleValue: 3 },
  epic:      { tier: 2, name: 'Epic',      holoEffects: ['radiant', 'sparkle', 'rainbow-alt', 'cosmos'], dropRate: 0.025, color: '#a855f7', emberValue: 100, craftCost: 500, targetedCraftCost: 1000, dismantleValue: 8 },
  legendary: { tier: 1, name: 'Legendary', holoEffects: ['rainbow', 'secret', 'gold'],     dropRate: 0.003, color: '#ff8c00', emberValue: 300, craftCost: 1500, targetedCraftCost: 3000, dismantleValue: 25 },
  mythic:    { tier: 0, name: 'Mythic',    holoEffects: ['rainbow', 'secret', 'gold', 'cosmos'], dropRate: 0.00045, color: '#ef4444', emberValue: 750, craftCost: 5000, targetedCraftCost: 10000, dismantleValue: 75 },
  unique:    { tier: -1, name: 'Unique',  holoEffects: ['unique'], dropRate: 0.00005, color: '#e8e8ff', emberValue: 1050, craftCost: 0, targetedCraftCost: 0, dismantleValue: 0 },
  full_art:  { tier: 0, holoEffects: ['rainbow', 'secret', 'gold', 'cosmos', 'galaxy', 'radiant'], dropRate: 0, color: '#d4af37', emberValue: 0, dismantleValue: 0, craftCost: 0 },
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
  epic: 'cosmos', legendary: 'gold', mythic: 'rainbow', unique: 'unique',
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
function applyTieredValue(base, cumulativeBase, tiers = DISMANTLE_TIERS) {
  let remaining = base;
  let value = 0;
  let pos = cumulativeBase;
  for (const tier of tiers) {
    if (remaining <= 0) break;
    if (pos >= tier.upTo) continue;
    const chunk = tier.upTo === Infinity ? remaining : Math.min(tier.upTo - pos, remaining);
    value += chunk * tier.rate;
    remaining -= chunk;
    pos += chunk;
  }
  return value;
}

export function calcDismantleTotal(cards, dismantledValueToday, thresholdMult = 1) {
  const tiers = thresholdMult > 1
    ? DISMANTLE_TIERS.map(t => ({ ...t, upTo: t.upTo === Infinity ? Infinity : t.upTo * thresholdMult }))
    : DISMANTLE_TIERS;
  const sorted = [...cards].sort((a, b) => (RARITIES[b.rarity]?.dismantleValue || 0) - (RARITIES[a.rarity]?.dismantleValue || 0));
  let total = 0;
  let cumulativeBase = dismantledValueToday;
  for (const card of sorted) {
    const base = RARITIES[card.rarity]?.dismantleValue || 0;
    total += applyTieredValue(base, cumulativeBase, tiers);
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

// Starting 5 — flat income per day per holo card (Cores)
export const S5_FLAT_CORES = {
  uncommon: 0.62, rare: 1.47, epic: 3.25, legendary: 6.27, mythic: 6.59, unique: 7.28,
};

// Starting 5 — flat income per day per holo card (Passion)
export const S5_FLAT_PASSION = {
  uncommon: 0.039, rare: 0.093, epic: 0.201, legendary: 0.387, mythic: 0.403, unique: 0.449,
};

// Starting 5 — reverse card multiplier (additive stacking)
export const S5_REVERSE_MULT = {
  uncommon: 1.116, rare: 1.194, epic: 1.356, legendary: 1.426, mythic: 1.465, unique: 1.589,
};

// Flat income scale factor (compensates for additive stacking)
export const S5_FLAT_SCALE = 0.7;

// Multiplier scale factor (amplifies reverse card mult bonuses under additive stacking)
export const S5_MULT_SCALE = 4.5;

// Full cards get 44% of both flat and mult
export const S5_FULL_RATIO = 0.44;

// Bench slot effectiveness
export const S5_BENCH_EFFECTIVENESS = 0.50;

// All-Star lineup output modifier
export const S5_ALLSTAR_MODIFIER = 0.615;

// Attachment bonuses — holo attachments: % boost to flat values
export const S5_ATT_FLAT = {
  god:  { uncommon: 0.06, rare: 0.10, epic: 0.20, legendary: 0.29, mythic: 0.33, unique: 0.44 },
  item: { uncommon: 0.04, rare: 0.06, epic: 0.13, legendary: 0.18, mythic: 0.20, unique: 0.27 },
};

// Attachment bonuses — reverse attachments: additive to multiplier
export const S5_ATT_MULT = {
  god:  { uncommon: 0.030, rare: 0.050, epic: 0.100, legendary: 0.145, mythic: 0.160, unique: 0.215 },
  item: { uncommon: 0.015, rare: 0.025, epic: 0.050, legendary: 0.070, mythic: 0.078, unique: 0.108 },
};

// Full attachment ratio (60% of pure type's bonus)
export const S5_FULL_ATT_RATIO = 0.6;

export const GOD_SYNERGY_BONUS = 0.40;
export const TEAM_SYNERGY_BONUS = { 2: 0.20, 3: 0.30, 4: 0.45, 5: 0.60, 6: 0.60 };

export const STARTING_FIVE_CAP_DAYS = 2;

export const CONSUMABLE_EFFECTS = {
  'health-pot': {
    type: 'instant', effect: 'cap-fill',
    values: { common: 0.08, uncommon: 0.14, rare: 0.25, epic: 0.42, legendary: 0.68, mythic: 1.00 },
  },
  'mana-pot': {
    type: 'buff', effect: 'rate-boost',
    values: { common: 0.10, uncommon: 0.22, rare: 0.48, epic: 1.00, legendary: 1.90, mythic: 3.00 },
  },
  'multi-pot': {
    type: 'buff', effect: 'rate-cap-boost',
    rateValues: { common: 0.03, uncommon: 0.06, rare: 0.12, epic: 0.20, legendary: 0.35, mythic: 0.60 },
    capValues: { common: 0.15, uncommon: 0.25, rare: 0.50, epic: 0.90, legendary: 1.50, mythic: 2.50 },
  },
  'elixir-str': {
    type: 'buff', effect: 'collect-mult',
    values: { common: 1.10, uncommon: 1.20, rare: 1.35, epic: 1.55, legendary: 1.85, mythic: 2.30 },
  },
  'elixir-int': {
    type: 'buff', effect: 'dismantle-boost',
    values: { common: 1.25, uncommon: 1.45, rare: 1.80, epic: 2.40, legendary: 3.50, mythic: 5.30 },
  },
  'ward': {
    type: 'buff', effect: 'cap-increase',
    values: { common: 0.25, uncommon: 0.50, rare: 1.00, epic: 1.75, legendary: 3.00, mythic: 5.00 },
  },
  'sentry': {
    type: 'instant', effect: 'jackpot',
    values: { common: 10, uncommon: 25, rare: 60, epic: 130, legendary: 280, mythic: 500 },
  },
};

export const CONSUMABLE_MAX_SLOTS = 3;

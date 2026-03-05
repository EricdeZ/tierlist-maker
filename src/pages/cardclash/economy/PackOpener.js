// Pack opening system - determines which cards you get from packs

import { PACKS, RARITIES, getRandomHoloEffect } from '../../../data/cardclash/economy';
import { GODS, getGodCardStats, getGodImageUrl } from '../../../data/cardclash/gods';

// Open a pack and return the cards
export function openPack(packType, availableTemplates = null) {
  const pack = PACKS[packType];
  if (!pack) throw new Error(`Unknown pack type: ${packType}`);

  const cards = [];
  const guarantees = [...pack.guarantees];

  // Fill guaranteed slots first
  for (const guarantee of guarantees) {
    for (let i = 0; i < guarantee.count; i++) {
      const rarity = rollGuaranteedRarity(guarantee.minRarity);
      cards.push(generateCard(rarity, availableTemplates));
    }
  }

  // Fill remaining slots with weighted random
  while (cards.length < pack.cards) {
    const rarity = rollRarity();
    cards.push(generateCard(rarity, availableTemplates));
  }

  return {
    packType,
    packName: pack.name,
    cards,
    openedAt: Date.now(),
  };
}

// Roll a random rarity based on drop rates
function rollRarity() {
  const roll = Math.random();
  let cumulative = 0;

  for (const [key, info] of Object.entries(RARITIES)) {
    cumulative += info.dropRate;
    if (roll < cumulative) return key;
  }

  return 'common';
}

// Roll a rarity that's at least as good as the minimum
function rollGuaranteedRarity(minRarity) {
  const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  const minIndex = rarityOrder.indexOf(minRarity);

  // Roll normally, but re-roll if below minimum
  let rarity = rollRarity();
  let attempts = 0;

  while (rarityOrder.indexOf(rarity) < minIndex && attempts < 100) {
    rarity = rollRarity();
    attempts++;
  }

  // If we couldn't roll high enough, just give the minimum
  if (rarityOrder.indexOf(rarity) < minIndex) {
    rarity = minRarity;
  }

  return rarity;
}

// Generate a card of a specific rarity
function generateCard(rarity, availableTemplates = null) {
  // If templates provided, pick from those. Otherwise generate from gods list
  const rarityInfo = RARITIES[rarity];

  // Pick a random god
  const god = GODS[Math.floor(Math.random() * GODS.length)];
  const stats = getGodCardStats(god);

  // Calculate power rating based on rarity tier
  const powerRange = getPowerRange(rarity);
  const power = powerRange.min + Math.floor(Math.random() * (powerRange.max - powerRange.min + 1));

  // Pick a holographic effect for this rarity
  const holoEffect = getRandomHoloEffect(rarity);

  return {
    templateId: null, // will be set when persisted to DB
    godId: god.id,
    godName: god.name,
    godClass: god.class,
    role: stats.roleAffinity,
    imageUrl: getGodImageUrl(god),
    rarity,
    holoEffect,
    power,
    stats: {
      hp: stats.hp + Math.floor(Math.random() * 10),
      attack: stats.attack + Math.floor(Math.random() * 3),
      defense: stats.defense + Math.floor(Math.random() * 3),
      kda: (1 + Math.random() * 4).toFixed(2),
      winRate: Math.floor(40 + Math.random() * 30),
      gamesPlayed: Math.floor(5 + Math.random() * 30),
      avgDamage: Math.floor(5000 + Math.random() * 20000),
      avgMitigated: Math.floor(3000 + Math.random() * 15000),
    },
    ability: god.ability,
    level: 1,
    xp: 0,
    levelBonus: 0,
    isNew: true,
  };
}

function getPowerRange(rarity) {
  switch (rarity) {
    case 'legendary': return { min: 85, max: 99 };
    case 'epic':      return { min: 70, max: 84 };
    case 'rare':      return { min: 55, max: 69 };
    case 'uncommon':  return { min: 40, max: 54 };
    case 'common':
    default:          return { min: 20, max: 39 };
  }
}

// Calculate pack expected value (for economy balancing)
export function getPackExpectedValue(packType) {
  const pack = PACKS[packType];
  if (!pack) return 0;

  // Simulate 10000 packs and average ember value
  let totalEmberValue = 0;
  const iterations = 10000;

  for (let i = 0; i < iterations; i++) {
    const result = openPack(packType);
    for (const card of result.cards) {
      totalEmberValue += RARITIES[card.rarity].emberValue;
    }
  }

  return {
    avgEmberValue: Math.round(totalEmberValue / iterations),
    cost: pack.cost,
    roi: ((totalEmberValue / iterations) / pack.cost * 100).toFixed(1) + '%',
  };
}

export default { openPack, getPackExpectedValue };

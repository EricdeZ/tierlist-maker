// Deck building rules and validation for SMITE Card Clash

import { GODS, getGodCardStats, CLASS_STATS } from '../../../data/cardclash/gods';
import { ITEMS } from '../../../data/cardclash/items';
import { MINIONS } from '../../../data/cardclash/minions';

export const DECK_RULES = {
  minGods: 5,        // need at least 5 gods (one per role)
  maxGods: 10,       // up to 10 gods
  minItems: 5,       // at least 5 items
  maxItems: 15,      // up to 15 items
  minMinions: 3,     // at least 3 minion cards
  maxMinions: 8,     // up to 8 minion cards
  totalMin: 20,      // minimum deck size
  totalMax: 30,      // maximum deck size
  maxCopies: 2,      // max 2 copies of any card
  requiredRoles: ['solo', 'jungle', 'mid', 'support', 'adc'], // must have at least 1 god per role affinity
};

// Validate a deck
export function validateDeck(deck) {
  const errors = [];

  // Count totals
  const godCount = deck.gods.length;
  const itemCount = deck.items.length;
  const minionCount = deck.minions.length;
  const total = godCount + itemCount + minionCount;

  if (godCount < DECK_RULES.minGods) errors.push(`Need at least ${DECK_RULES.minGods} gods (have ${godCount})`);
  if (godCount > DECK_RULES.maxGods) errors.push(`Max ${DECK_RULES.maxGods} gods (have ${godCount})`);
  if (itemCount < DECK_RULES.minItems) errors.push(`Need at least ${DECK_RULES.minItems} items (have ${itemCount})`);
  if (itemCount > DECK_RULES.maxItems) errors.push(`Max ${DECK_RULES.maxItems} items (have ${itemCount})`);
  if (minionCount < DECK_RULES.minMinions) errors.push(`Need at least ${DECK_RULES.minMinions} minion cards (have ${minionCount})`);
  if (minionCount > DECK_RULES.maxMinions) errors.push(`Max ${DECK_RULES.maxMinions} minion cards (have ${minionCount})`);
  if (total < DECK_RULES.totalMin) errors.push(`Deck too small: need ${DECK_RULES.totalMin} cards (have ${total})`);
  if (total > DECK_RULES.totalMax) errors.push(`Deck too large: max ${DECK_RULES.totalMax} cards (have ${total})`);

  // Check role coverage
  const roleMap = { solo: false, jungle: false, mid: false, support: false, adc: false };
  for (const god of deck.gods) {
    const godData = GODS.find(g => g.id === god.godId);
    if (godData) {
      const role = god.assignedRole || getGodCardStats(godData).roleAffinity;
      roleMap[role] = true;
    }
  }
  for (const role of DECK_RULES.requiredRoles) {
    if (!roleMap[role]) errors.push(`Missing a god for ${role} role`);
  }

  // Check duplicates
  const counts = {};
  for (const card of [...deck.gods, ...deck.items, ...deck.minions]) {
    const key = card.godId || card.itemId || card.minionType;
    counts[key] = (counts[key] || 0) + 1;
    if (counts[key] > DECK_RULES.maxCopies) {
      errors.push(`Too many copies of ${card.name} (max ${DECK_RULES.maxCopies})`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// Create a starter deck from gods, items, minions the player owns
export function createStarterDeck() {
  // Pick one god per role (lowest cost from each class)
  const roles = ['solo', 'jungle', 'mid', 'support', 'adc'];
  const classForRole = { solo: 'Warrior', jungle: 'Assassin', mid: 'Mage', support: 'Guardian', adc: 'Hunter' };

  const gods = roles.map(role => {
    const cls = classForRole[role];
    const godsOfClass = GODS.filter(g => g.class === cls);
    const god = godsOfClass[Math.floor(Math.random() * godsOfClass.length)];
    const stats = getGodCardStats(god);
    return {
      cardType: 'god',
      godId: god.id,
      name: god.name,
      ...stats,
      manaCost: getGodManaCost(god),
      assignedRole: role,
    };
  });

  // Add 5 more random gods
  const usedIds = new Set(gods.map(g => g.godId));
  const extraGods = GODS.filter(g => !usedIds.has(g.id))
    .sort(() => Math.random() - 0.5)
    .slice(0, 5)
    .map(god => {
      const stats = getGodCardStats(god);
      return {
        cardType: 'god',
        godId: god.id,
        name: god.name,
        ...stats,
        manaCost: getGodManaCost(god),
      };
    });

  // Pick items
  const items = ITEMS
    .filter(i => i.category !== 'Relic' && i.category !== 'Consumable')
    .sort(() => Math.random() - 0.5)
    .slice(0, 8)
    .map(item => ({
      cardType: 'item',
      itemId: item.id,
      name: item.name,
      ...item,
    }));

  // Add 2 relics
  const relics = ITEMS
    .filter(i => i.category === 'Relic')
    .sort(() => Math.random() - 0.5)
    .slice(0, 2)
    .map(item => ({
      cardType: 'item',
      itemId: item.id,
      name: item.name,
      ...item,
    }));

  // Minion cards
  const playableMinions = MINIONS.filter(m => !m.isAutoSpawn || m.type === 'brute' || m.type === 'siege');
  const minions = [];
  for (let i = 0; i < 5; i++) {
    const m = playableMinions[i % playableMinions.length];
    minions.push({
      cardType: 'minion',
      minionType: m.type,
      name: m.name,
      ...m,
    });
  }

  return {
    gods: [...gods, ...extraGods],
    items: [...items, ...relics],
    minions,
  };
}

function getGodManaCost(god) {
  // Cost based on class + ability power
  const baseCosts = { Guardian: 4, Warrior: 4, Assassin: 5, Mage: 5, Hunter: 5 };
  return baseCosts[god.class] || 5;
}

// Calculate deck power rating (for matchmaking)
export function getDeckPower(deck) {
  let power = 0;

  for (const god of deck.gods) {
    const godData = GODS.find(g => g.id === god.godId);
    if (godData) {
      const stats = CLASS_STATS[godData.class];
      power += stats.hp + stats.attack * 3 + stats.defense * 2;
    }
  }

  for (const item of deck.items) {
    power += (item.effects?.attack || 0) * 3 + (item.effects?.defense || 0) * 2 + (item.effects?.hp || 0);
  }

  return Math.round(power / (deck.gods.length + deck.items.length));
}

export default { validateDeck, createStarterDeck, getDeckPower, DECK_RULES };

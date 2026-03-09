// Card collection index — deterministic card numbers for game cards
// IMPORTANT: Never insert items into the middle of arrays in gods.js, items.js, etc.
// Always append new entries to the end to keep index numbers stable.

import { GODS } from './gods'
import { ITEMS } from './items'
import { MINIONS } from './minions'
import { BUFFS, CONSUMABLES } from './buffs'

const PREFIXES = { god: 'G', item: 'I', minion: 'M', buff: 'B', consumable: 'C' }

// Build lookup maps once
const godIndexMap = new Map(GODS.map((g, i) => [g.slug, i + 1]))
const itemIndexMap = new Map(ITEMS.map((item, i) => [String(item.id), i + 1]))
const minionIndexMap = new Map(MINIONS.map((m, i) => [m.type, i + 1]))
const buffIndexMap = new Map(BUFFS.map((b, i) => [b.id, i + 1]))
const consumableIndexMap = new Map(CONSUMABLES.map((c, i) => [c.id, i + 1]))

const INDEX_MAPS = {
  god: godIndexMap,
  item: itemIndexMap,
  minion: minionIndexMap,
  buff: buffIndexMap,
  consumable: consumableIndexMap,
}

// Pad number to 3 digits
function pad(n) {
  return String(n).padStart(3, '0')
}

/**
 * Get the card index string for a game card.
 * @param {'god'|'item'|'minion'|'buff'|'consumable'} type
 * @param {string} identifier - slug for gods, id for items/buffs/consumables, type for minions
 * @returns {string|null} e.g. 'G-001', 'I-032', null if not found
 */
export function getGameCardIndex(type, identifier) {
  const map = INDEX_MAPS[type]
  if (!map) return null
  const idx = map.get(identifier)
  if (!idx) return null
  return `${PREFIXES[type]}-${pad(idx)}`
}

/**
 * Get the total count for a game card category.
 */
export function getGameCardTotal(type) {
  const map = INDEX_MAPS[type]
  return map ? map.size : 0
}

/**
 * Get all game card entries for a category (for collection page).
 * Returns array of { index, identifier, name, extra }
 */
export function getGameCardEntries(type) {
  switch (type) {
    case 'god':
      return GODS.map((g, i) => ({
        index: `G-${pad(i + 1)}`,
        identifier: g.slug,
        name: g.name,
        class: g.class,
        imageKey: g.imageKey,
      }))
    case 'item':
      return ITEMS.map((item, i) => ({
        index: `I-${pad(i + 1)}`,
        identifier: String(item.id),
        godId: `item-${item.id}`,
        name: item.name,
        category: item.category,
        imageKey: item.imageKey,
      }))
    case 'minion':
      return MINIONS.map((m, i) => ({
        index: `M-${pad(i + 1)}`,
        identifier: m.type,
        godId: `minion-${m.type}`,
        name: m.name,
      }))
    case 'buff':
      return BUFFS.map((b, i) => ({
        index: `B-${pad(i + 1)}`,
        identifier: b.id,
        godId: `buff-${b.id}`,
        name: b.name,
        color: b.color,
      }))
    case 'consumable':
      return CONSUMABLES.map((c, i) => ({
        index: `C-${pad(i + 1)}`,
        identifier: c.id,
        godId: `consumable-${c.id}`,
        name: c.name,
        color: c.color,
      }))
    default:
      return []
  }
}

/**
 * Build the player card number string from definition fields.
 * e.g. "bsl-d1-s2-014"
 */
export function getPlayerCardNumber(leagueSlug, divisionTier, seasonSlug, cardIndex) {
  // Extract season number from slug (e.g. "season-2" → "2")
  const seasonNum = seasonSlug.replace(/\D/g, '') || '1'
  return `${leagueSlug}-d${divisionTier}-s${seasonNum}-${pad(cardIndex)}`
}

/** All game card types */
export const GAME_CARD_TYPES = ['god', 'item', 'minion', 'buff', 'consumable']

/** Total count of all game cards */
export const TOTAL_GAME_CARDS = GODS.length + ITEMS.length + MINIONS.length + BUFFS.length + CONSUMABLES.length

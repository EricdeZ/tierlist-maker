// Starting 5 — passive income from slotted cards
import { grantEmber } from './ember.js'
import { grantPassion } from './passion.js'

const RATES = {
  holo: { uncommon: 1, rare: 2, epic: 3, legendary: 5, mythic: 8 },
  reverse: { uncommon: 1, rare: 1.5, epic: 2.5, legendary: 4, mythic: 6 },
  full: {
    passion: { uncommon: 0.6, rare: 1.2, epic: 1.8, legendary: 3, mythic: 4.8 },
    cores: { uncommon: 0.6, rare: 0.9, epic: 1.5, legendary: 2.4, mythic: 3.6 },
  },
}

const CAP_DAYS = 2
const HOURS_PER_DAY = 24

export function getCardRates(holoType, rarity) {
  if (!holoType) return { passionPerHour: 0, coresPerHour: 0 }
  let passionDaily = 0, coresDaily = 0
  if (holoType === 'holo') {
    passionDaily = RATES.holo[rarity] || 0
  } else if (holoType === 'reverse') {
    coresDaily = RATES.reverse[rarity] || 0
  } else if (holoType === 'full') {
    passionDaily = RATES.full.passion[rarity] || 0
    coresDaily = RATES.full.cores[rarity] || 0
  }
  return {
    passionPerHour: passionDaily / HOURS_PER_DAY,
    coresPerHour: coresDaily / HOURS_PER_DAY,
  }
}

function getTotalDailyRates(cards) {
  let totalPassion = 0, totalCores = 0
  for (const card of cards) {
    const { passionPerHour, coresPerHour } = getCardRates(card.holo_type, card.rarity)
    totalPassion += passionPerHour * HOURS_PER_DAY
    totalCores += coresPerHour * HOURS_PER_DAY
  }
  return { totalPassionPerDay: totalPassion, totalCoresPerDay: totalCores }
}

async function ensureState(sql, userId) {
  await sql`
    INSERT INTO cc_starting_five_state (user_id)
    VALUES (${userId})
    ON CONFLICT (user_id) DO NOTHING
  `
}

export async function tick(sql, userId) {
  await ensureState(sql, userId)

  const cards = await sql`
    SELECT l.role AS slot_role, c.*
    FROM cc_lineups l
    JOIN cc_cards c ON l.card_id = c.id
    WHERE l.user_id = ${userId} AND l.card_id IS NOT NULL
  `

  const [state] = await sql`
    SELECT * FROM cc_starting_five_state WHERE user_id = ${userId}
  `

  if (!state || !state.last_tick || cards.length === 0) {
    await sql`
      UPDATE cc_starting_five_state
      SET last_tick = NOW()
      WHERE user_id = ${userId}
    `
    return {
      cards,
      passionPending: Number(state?.passion_pending) || 0,
      coresPending: Number(state?.cores_pending) || 0,
      lastTick: new Date().toISOString(),
    }
  }

  const now = new Date()
  const lastTick = new Date(state.last_tick)
  const elapsedHours = (now - lastTick) / (1000 * 60 * 60)

  if (elapsedHours < 0.001) {
    return {
      cards,
      passionPending: Number(state.passion_pending) || 0,
      coresPending: Number(state.cores_pending) || 0,
      lastTick: state.last_tick,
    }
  }

  let passionAccrued = 0, coresAccrued = 0
  for (const card of cards) {
    const { passionPerHour, coresPerHour } = getCardRates(card.holo_type, card.rarity)
    passionAccrued += passionPerHour * elapsedHours
    coresAccrued += coresPerHour * elapsedHours
  }

  const { totalPassionPerDay, totalCoresPerDay } = getTotalDailyRates(cards)
  const passionCap = totalPassionPerDay * CAP_DAYS
  const coresCap = totalCoresPerDay * CAP_DAYS

  let newPassion = Math.min((Number(state.passion_pending) || 0) + passionAccrued, passionCap)
  let newCores = Math.min((Number(state.cores_pending) || 0) + coresAccrued, coresCap)

  await sql`
    UPDATE cc_starting_five_state
    SET passion_pending = ${newPassion},
        cores_pending = ${newCores},
        last_tick = NOW()
    WHERE user_id = ${userId}
  `

  return {
    cards,
    passionPending: newPassion,
    coresPending: newCores,
    lastTick: now.toISOString(),
    passionCap,
    coresCap,
  }
}

export async function collectIncome(sql, userId) {
  const state = await tick(sql, userId)

  const passionToGrant = Math.floor(state.passionPending)
  const coresToGrant = Math.floor(state.coresPending)
  const passionRemainder = state.passionPending - passionToGrant
  const coresRemainder = state.coresPending - coresToGrant

  if (passionToGrant > 0) {
    await grantPassion(sql, userId, 'starting_five', passionToGrant, 'Starting 5 passive income')
  }
  if (coresToGrant > 0) {
    await grantEmber(sql, userId, 'starting_five', coresToGrant, 'Starting 5 passive income')
  }

  await sql`
    UPDATE cc_starting_five_state
    SET passion_pending = ${passionRemainder},
        cores_pending = ${coresRemainder}
    WHERE user_id = ${userId}
  `

  return {
    ...state,
    passionPending: passionRemainder,
    coresPending: coresRemainder,
    passionGranted: passionToGrant,
    coresGranted: coresToGrant,
  }
}

export async function slotCard(sql, userId, cardId, role) {
  const validRoles = ['solo', 'jungle', 'mid', 'support', 'adc']
  if (!validRoles.includes(role)) throw new Error('Invalid role')

  const [card] = await sql`
    SELECT id, rarity, holo_type, role, card_type
    FROM cc_cards WHERE id = ${cardId} AND owner_id = ${userId}
  `
  if (!card) throw new Error('Card not found')
  if (!card.holo_type && card.rarity !== 'common') throw new Error('Card has no holo type')
  if (card.card_type !== 'player') throw new Error('Only player cards can be slotted')
  if (card.role !== role) throw new Error(`Card role (${card.role}) does not match slot (${role})`)

  const [listing] = await sql`
    SELECT id FROM cc_market_listings
    WHERE card_id = ${cardId} AND status = 'active'
  `
  if (listing) throw new Error('Card is listed on marketplace — unlist it first')

  const [existing] = await sql`
    SELECT role FROM cc_lineups
    WHERE user_id = ${userId} AND card_id = ${cardId}
  `
  if (existing) throw new Error(`Card is already slotted in ${existing.role}`)

  await collectIncome(sql, userId)

  await sql`
    INSERT INTO cc_lineups (user_id, role, card_id, slotted_at)
    VALUES (${userId}, ${role}, ${cardId}, NOW())
    ON CONFLICT (user_id, role)
    DO UPDATE SET card_id = ${cardId}, slotted_at = NOW()
  `

  return await tick(sql, userId)
}

export async function unslotCard(sql, userId, role) {
  const validRoles = ['solo', 'jungle', 'mid', 'support', 'adc']
  if (!validRoles.includes(role)) throw new Error('Invalid role')

  await collectIncome(sql, userId)

  await sql`
    UPDATE cc_lineups
    SET card_id = NULL, slotted_at = NULL
    WHERE user_id = ${userId} AND role = ${role}
  `

  return await tick(sql, userId)
}

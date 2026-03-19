// Starting 5 — passive income from slotted cards
import { grantEmber } from './ember.js'
import { grantPassion } from './passion.js'

const S5_FLAT_CORES = {
  uncommon: 0.80, rare: 1.90, epic: 3.50, legendary: 7.60, mythic: 8.75, unique: 10.10,
}
const S5_FLAT_PASSION = {
  uncommon: 0.05, rare: 0.12, epic: 0.22, legendary: 0.47, mythic: 0.54, unique: 0.63,
}
const S5_REVERSE_MULT = {
  uncommon: 1.15, rare: 1.25, epic: 1.40, legendary: 1.50, mythic: 1.65, unique: 1.85,
}
const S5_FULL_RATIO = 0.44
const S5_BENCH_EFFECTIVENESS = 0.50
const S5_ALLSTAR_MODIFIER = 0.615

const S5_ATT_FLAT = {
  god:  { uncommon: 0.06, rare: 0.10, epic: 0.16, legendary: 0.25, mythic: 0.35, unique: 0.48 },
  item: { uncommon: 0.04, rare: 0.06, epic: 0.10, legendary: 0.15, mythic: 0.22, unique: 0.30 },
}
const S5_ATT_MULT = {
  god:  { uncommon: 0.030, rare: 0.050, epic: 0.080, legendary: 0.125, mythic: 0.175, unique: 0.240 },
  item: { uncommon: 0.015, rare: 0.025, epic: 0.040, legendary: 0.060, mythic: 0.085, unique: 0.120 },
}
const S5_FULL_ATT_RATIO = 0.6
const GOD_SYNERGY_BONUS = 0.30
const TEAM_SYNERGY_BONUS = { 2: 0.10, 3: 0.20, 4: 0.35, 5: 0.50 }
const FULL_HOLO_RATIO = S5_FULL_ATT_RATIO

// Lower number = higher rarity (matches RARITIES.tier in economy.js)
const RARITY_TIER = { common: 5, uncommon: 4, rare: 3, epic: 2, legendary: 1, mythic: 0, unique: -1 }

const CONSUMABLE_SLOT_SCALING = {
  common: 0.50, uncommon: 0.60, rare: 0.80, epic: 1.00, legendary: 1.40, mythic: 2.00, unique: 2.80,
}
const CONSUMABLE_SPREADS = {
  'health-pot':  { passion: 0.75, cores: 0.25 },
  'mana-pot':    { passion: 0.25, cores: 0.75 },
  'multi-pot':   { passion: 0.50, cores: 0.50 },
  'elixir-str':  { passion: 1.00, cores: 0.00 },
  'elixir-int':  { passion: 0.00, cores: 1.00 },
  'ward':        { passion: 0.60, cores: 0.40 },
  'sentry':      { passion: 0.40, cores: 0.60 },
}

export function getConsumableBoost(consumableId, rarity) {
  const total = CONSUMABLE_SLOT_SCALING[rarity] || 0
  const spread = CONSUMABLE_SPREADS[consumableId] || { passion: 0.5, cores: 0.5 }
  return { passionBoost: total * spread.passion, coresBoost: total * spread.cores }
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

function getAttachmentMultiplier(attachment, type, synergy = false) {
  if (!attachment || !attachment.holo_type || !attachment.rarity) return { passionMult: 1, coresMult: 1 }
  const bonuses = ATTACHMENT_BONUSES[type]
  if (!bonuses) return { passionMult: 1, coresMult: 1 }

  let passionBonus = bonuses.passion[attachment.rarity] || 0
  let coresBonus = bonuses.cores[attachment.rarity] || 0

  if (synergy && type === 'god') {
    passionBonus *= (1 + GOD_SYNERGY_BONUS)
    coresBonus *= (1 + GOD_SYNERGY_BONUS)
  }

  let passionMult = 1, coresMult = 1
  if (attachment.holo_type === 'holo') {
    passionMult = 1 + passionBonus
  } else if (attachment.holo_type === 'reverse') {
    coresMult = 1 + coresBonus
  } else if (attachment.holo_type === 'full') {
    passionMult = 1 + passionBonus * FULL_HOLO_RATIO
    coresMult = 1 + coresBonus * FULL_HOLO_RATIO
  }
  return { passionMult, coresMult }
}

function checkSynergy(playerCard, godCard) {
  if (!playerCard?.best_god_name || !godCard?.god_name) return false
  return godCard.god_name.toLowerCase() === playerCard.best_god_name.toLowerCase()
}

export function getSlotRates(playerCard, godCard, itemCard) {
  const base = getCardRates(playerCard.holo_type, playerCard.rarity)
  const synergy = checkSynergy(playerCard, godCard)
  const god = getAttachmentMultiplier(godCard, 'god', synergy)
  const item = getAttachmentMultiplier(itemCard, 'item')
  return {
    passionPerHour: base.passionPerHour * god.passionMult * item.passionMult,
    coresPerHour: base.coresPerHour * god.coresMult * item.coresMult,
  }
}

export function getAttachmentBonusInfo(attachment, type, synergy = false) {
  if (!attachment || !attachment.holo_type) return { passionBonus: 0, coresBonus: 0 }
  const bonuses = ATTACHMENT_BONUSES[type]
  if (!bonuses) return { passionBonus: 0, coresBonus: 0 }
  let pB = bonuses.passion[attachment.rarity] || 0
  let cB = bonuses.cores[attachment.rarity] || 0
  if (synergy && type === 'god') {
    pB *= (1 + GOD_SYNERGY_BONUS)
    cB *= (1 + GOD_SYNERGY_BONUS)
  }
  if (attachment.holo_type === 'holo') return { passionBonus: +pB.toFixed(4), coresBonus: 0 }
  if (attachment.holo_type === 'reverse') return { passionBonus: 0, coresBonus: +cB.toFixed(4) }
  if (attachment.holo_type === 'full') return { passionBonus: +(pB * FULL_HOLO_RATIO).toFixed(4), coresBonus: +(cB * FULL_HOLO_RATIO).toFixed(4) }
  return { passionBonus: 0, coresBonus: 0 }
}

function reshapeAttachments(row) {
  const godCard = row.god_id ? {
    id: row.god_id, rarity: row.god_rarity, holo_type: row.god_holo_type,
    card_type: row.god_card_type, role: row.god_role, card_data: row.god_card_data,
    god_name: row.god_god_name, god_class: row.god_god_class, image_url: row.god_image_url,
    holo_effect: row.god_holo_effect, serial_number: row.god_serial_number, god_id: row.god_god_id,
    ability: row.god_ability, def_id: row.god_def_id, is_first_edition: row.god_is_first_edition,
  } : null
  const itemCard = row.item_id ? {
    id: row.item_id, rarity: row.item_rarity, holo_type: row.item_holo_type,
    card_type: row.item_card_type, card_data: row.item_card_data,
    god_name: row.item_god_name, god_class: row.item_god_class, image_url: row.item_image_url,
    holo_effect: row.item_holo_effect, serial_number: row.item_serial_number, god_id: row.item_god_id,
    def_id: row.item_def_id, is_first_edition: row.item_is_first_edition,
  } : null
  return { godCard, itemCard }
}

function isRoleMismatch(card) {
  return card.slot_role && card.role && card.role !== card.slot_role && card.role !== 'fill'
}

function getTotalDailyRates(cards, teamCounts = {}) {
  let totalPassion = 0, totalCores = 0
  for (const card of cards) {
    if (isRoleMismatch(card)) continue
    const { godCard, itemCard } = reshapeAttachments(card)
    const { passionPerHour, coresPerHour } = getSlotRates(card, godCard, itemCard)
    const teamBonus = 1 + (TEAM_SYNERGY_BONUS[teamCounts[card.team_id]] || 0)
    totalPassion += passionPerHour * teamBonus * HOURS_PER_DAY
    totalCores += coresPerHour * teamBonus * HOURS_PER_DAY
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
    SELECT l.role AS slot_role, c.*, pd.best_god_name, pd.team_id AS team_id,
      pu.discord_id AS player_discord_id, pu.discord_avatar AS player_discord_avatar,
      COALESCE(pup.allow_discord_avatar, true) AS allow_discord_avatar,
      g.id AS god_id, g.rarity AS god_rarity, g.holo_type AS god_holo_type,
      g.card_type AS god_card_type, g.role AS god_role, g.card_data AS god_card_data,
      g.god_name AS god_god_name, g.god_class AS god_god_class, g.image_url AS god_image_url,
      g.holo_effect AS god_holo_effect, g.serial_number AS god_serial_number, g.god_id AS god_god_id,
      g.ability AS god_ability, g.def_id AS god_def_id, g.is_first_edition AS god_is_first_edition,
      i.id AS item_id, i.rarity AS item_rarity, i.holo_type AS item_holo_type,
      i.card_type AS item_card_type, i.card_data AS item_card_data,
      i.god_name AS item_god_name, i.god_class AS item_god_class, i.image_url AS item_image_url,
      i.holo_effect AS item_holo_effect, i.serial_number AS item_serial_number, i.god_id AS item_god_id,
      i.def_id AS item_def_id, i.is_first_edition AS item_is_first_edition
    FROM cc_lineups l
    JOIN cc_cards c ON l.card_id = c.id
    LEFT JOIN cc_player_defs pd ON c.def_id = pd.id AND c.card_type = 'player'
    LEFT JOIN users pu ON pu.linked_player_id = pd.player_id
    LEFT JOIN user_preferences pup ON pup.user_id = pu.id
    LEFT JOIN cc_cards g ON l.god_card_id = g.id
    LEFT JOIN cc_cards i ON l.item_card_id = i.id
    WHERE l.user_id = ${userId} AND l.card_id IS NOT NULL
  `

  for (const card of cards) {
    const { godCard, itemCard } = reshapeAttachments(card)
    card._godCard = godCard
    card._itemCard = itemCard
  }

  const [state] = await sql`
    SELECT * FROM cc_starting_five_state WHERE user_id = ${userId}
  `

  // Fetch slotted consumable (if any)
  const [consumableCard] = state?.consumable_card_id ? await sql`
    SELECT * FROM cc_cards WHERE id = ${state.consumable_card_id}
  ` : [null]

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
      consumableCard: consumableCard || null,
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
      consumableCard: consumableCard || null,
    }
  }

  const teamCounts = {}
  for (const card of cards) {
    if (!isRoleMismatch(card) && card.team_id) teamCounts[card.team_id] = (teamCounts[card.team_id] || 0) + 1
  }

  let passionAccrued = 0, coresAccrued = 0
  for (const card of cards) {
    if (isRoleMismatch(card)) continue
    const { passionPerHour, coresPerHour } = getSlotRates(card, card._godCard, card._itemCard)
    const teamBonus = 1 + (TEAM_SYNERGY_BONUS[teamCounts[card.team_id]] || 0)
    passionAccrued += passionPerHour * teamBonus * elapsedHours
    coresAccrued += coresPerHour * teamBonus * elapsedHours
  }

  // Cap always uses unboosted rates (before consumable, but including team synergy)
  const { totalPassionPerDay, totalCoresPerDay } = getTotalDailyRates(cards, teamCounts)
  const passionCap = totalPassionPerDay * CAP_DAYS
  const coresCap = totalCoresPerDay * CAP_DAYS

  // Apply consumable boost to accrued amounts (not cap)
  if (consumableCard?.card_data?.consumableId) {
    const boost = getConsumableBoost(consumableCard.card_data.consumableId, consumableCard.rarity)
    passionAccrued *= (1 + boost.passionBoost)
    coresAccrued *= (1 + boost.coresBoost)
  }

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
    consumableCard: consumableCard || null,
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

export async function slotCard(sql, userId, cardId, role, slotType = 'player') {
  const validRoles = ['solo', 'jungle', 'mid', 'support', 'adc']
  if (!validRoles.includes(role)) throw new Error('Invalid role')

  const [card] = await sql`
    SELECT id, rarity, holo_type, role, card_type
    FROM cc_cards WHERE id = ${cardId} AND owner_id = ${userId}
  `
  if (!card) throw new Error('Card not found')

  const [listing] = await sql`
    SELECT id FROM cc_market_listings
    WHERE card_id = ${cardId} AND status = 'active'
  `
  if (listing) throw new Error('Card is listed on marketplace — unlist it first')

  const [inBinder] = await sql`
    SELECT id FROM cc_binder_cards WHERE card_id = ${cardId} LIMIT 1
  `
  if (inBinder) throw new Error('Card is in your binder — remove it first')

  if (slotType === 'player') {
    if (!card.holo_type && card.rarity !== 'common') throw new Error('Card has no holo type')
    if (card.card_type !== 'player') throw new Error('Only player cards can be slotted')
    if (card.role !== role && card.role !== 'fill') throw new Error(`Card role (${card.role}) does not match slot (${role})`)

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

    // Check if existing god/item attachments still meet the new player's rarity floor
    const [slot] = await sql`
      SELECT god_card_id, item_card_id FROM cc_lineups
      WHERE user_id = ${userId} AND role = ${role}
    `
    if (slot) {
      if (slot.god_card_id) {
        const [godCard] = await sql`SELECT rarity FROM cc_cards WHERE id = ${slot.god_card_id}`
        if (godCard && RARITY_TIER[godCard.rarity] > RARITY_TIER[card.rarity]
          && !(card.rarity === 'unique' && godCard.rarity === 'mythic')) {
          await sql`UPDATE cc_lineups SET god_card_id = NULL WHERE user_id = ${userId} AND role = ${role}`
        }
      }
      if (slot.item_card_id) {
        const [itemCard] = await sql`SELECT rarity FROM cc_cards WHERE id = ${slot.item_card_id}`
        if (itemCard && RARITY_TIER[itemCard.rarity] > RARITY_TIER[card.rarity]
          && !(card.rarity === 'unique' && itemCard.rarity === 'mythic')) {
          await sql`UPDATE cc_lineups SET item_card_id = NULL WHERE user_id = ${userId} AND role = ${role}`
        }
      }
    }
  } else {
    // god or item attachment
    if (!card.holo_type) throw new Error('Attachment must have a holo type')
    if (card.card_type !== slotType) throw new Error(`Card type (${card.card_type}) does not match slot type (${slotType})`)

    if (slotType === 'god' && card.role !== role && card.role !== 'fill') {
      throw new Error(`God card role (${card.role}) does not match slot (${role})`)
    }

    // A player card must already exist in the slot
    const [playerSlot] = await sql`
      SELECT card_id FROM cc_lineups
      WHERE user_id = ${userId} AND role = ${role} AND card_id IS NOT NULL
    `
    if (!playerSlot) throw new Error('No player card in this slot — slot a player first')

    // Check rarity floor: attachment rarity cannot be worse than player rarity
    // Exception: unique players allow mythic attachments
    const [playerCard] = await sql`SELECT rarity FROM cc_cards WHERE id = ${playerSlot.card_id}`
    if (playerCard && RARITY_TIER[card.rarity] > RARITY_TIER[playerCard.rarity]
      && !(playerCard.rarity === 'unique' && card.rarity === 'mythic')) {
      throw new Error('Attachment rarity cannot be lower than the player card rarity')
    }

    // Check not already attached elsewhere
    if (slotType === 'god') {
      const [alreadyAttached] = await sql`SELECT role FROM cc_lineups WHERE user_id = ${userId} AND god_card_id = ${cardId}`
      if (alreadyAttached) throw new Error(`Card is already attached in ${alreadyAttached.role}`)
    } else {
      const [alreadyAttached] = await sql`SELECT role FROM cc_lineups WHERE user_id = ${userId} AND item_card_id = ${cardId}`
      if (alreadyAttached) throw new Error(`Card is already attached in ${alreadyAttached.role}`)
    }

    await collectIncome(sql, userId)

    if (slotType === 'god') {
      await sql`UPDATE cc_lineups SET god_card_id = ${cardId} WHERE user_id = ${userId} AND role = ${role}`
    } else {
      await sql`UPDATE cc_lineups SET item_card_id = ${cardId} WHERE user_id = ${userId} AND role = ${role}`
    }
  }

  return await tick(sql, userId)
}

export async function unslotCard(sql, userId, role) {
  const validRoles = ['solo', 'jungle', 'mid', 'support', 'adc']
  if (!validRoles.includes(role)) throw new Error('Invalid role')

  await collectIncome(sql, userId)

  await sql`
    UPDATE cc_lineups
    SET card_id = NULL, slotted_at = NULL, god_card_id = NULL, item_card_id = NULL
    WHERE user_id = ${userId} AND role = ${role}
  `

  return await tick(sql, userId)
}

export async function unslotAttachment(sql, userId, role, slotType) {
  const validRoles = ['solo', 'jungle', 'mid', 'support', 'adc']
  if (!validRoles.includes(role)) throw new Error('Invalid role')
  if (slotType !== 'god' && slotType !== 'item') throw new Error('slotType must be god or item')

  await collectIncome(sql, userId)

  if (slotType === 'god') {
    await sql`UPDATE cc_lineups SET god_card_id = NULL WHERE user_id = ${userId} AND role = ${role}`
  } else {
    await sql`UPDATE cc_lineups SET item_card_id = NULL WHERE user_id = ${userId} AND role = ${role}`
  }

  return await tick(sql, userId)
}

export async function slotConsumable(sql, userId, cardId) {
  const [card] = await sql`
    SELECT id, rarity, card_type, card_data FROM cc_cards
    WHERE id = ${cardId} AND owner_id = ${userId}
  `
  if (!card) throw new Error('Card not found')
  if (card.card_type !== 'consumable') throw new Error('Only consumable cards can be slotted')

  const [listing] = await sql`
    SELECT id FROM cc_market_listings WHERE card_id = ${cardId} AND status = 'active'
  `
  if (listing) throw new Error('Card is listed on marketplace — unlist it first')

  const [inTrade] = await sql`
    SELECT tc.id FROM cc_trade_cards tc JOIN cc_trades t ON tc.trade_id = t.id
    WHERE tc.card_id = ${cardId} AND t.status IN ('waiting', 'active') LIMIT 1
  `
  if (inTrade) throw new Error('Card is in an active trade — cancel the trade first')

  const [inBinder] = await sql`
    SELECT id FROM cc_binder_cards WHERE card_id = ${cardId} LIMIT 1
  `
  if (inBinder) throw new Error('Card is in your binder — remove it first')

  // Collect pending income before changing rates
  await collectIncome(sql, userId)
  await ensureState(sql, userId)

  // Destroy current consumable (if any)
  const [state] = await sql`
    SELECT consumable_card_id FROM cc_starting_five_state WHERE user_id = ${userId}
  `
  if (state?.consumable_card_id) {
    await sql`DELETE FROM cc_cards WHERE id = ${state.consumable_card_id}`
  }

  // Slot new consumable
  await sql`
    UPDATE cc_starting_five_state
    SET consumable_card_id = ${cardId}
    WHERE user_id = ${userId}
  `

  return await tick(sql, userId)
}

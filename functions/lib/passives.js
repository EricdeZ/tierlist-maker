// Staff card passive engine — tuning tables, state management, context modifiers

// ════════════════════════════════════════════
// Tuning Tables (see staff-passives-tuning.md)
// ════════════════════════════════════════════

const ODDS_BOOST = {
  uncommon: 1.05, rare: 1.10, epic: 1.18, legendary: 1.28, mythic: 1.40, unique: 1.55,
}

const HOLO_BOOST_WEIGHT = {
  uncommon: 1.5, rare: 2.0, epic: 3.0, legendary: 4.5, mythic: 6.0, unique: 8.0,
}

const UNIQUE_HUNTER_REDIRECT = {
  uncommon: 0.15, rare: 0.25, epic: 0.35, legendary: 0.50, mythic: 0.65, unique: 0.80,
}

const COLLECTOR_BOOST_MULT = {
  uncommon: 1.5, rare: 2.0, epic: 3.0, legendary: 4.5, mythic: 6.5, unique: 9.0,
}

const CARD_REROLL = {
  uncommon: { hoursPerCharge: 48, maxCharges: 1 },
  rare:      { hoursPerCharge: 36, maxCharges: 2 },
  epic:      { hoursPerCharge: 24, maxCharges: 2 },
  legendary: { hoursPerCharge: 18, maxCharges: 3 },
  mythic:    { hoursPerCharge: 12, maxCharges: 3 },
  unique:    { hoursPerCharge: 8,  maxCharges: 4 },
}

const PACK_REROLL = {
  uncommon: { hoursPerCharge: 72, maxCharges: 1, lowCardLossBias: 0.45 },
  rare:      { hoursPerCharge: 48, maxCharges: 1, lowCardLossBias: 0.50 },
  epic:      { hoursPerCharge: 36, maxCharges: 2, lowCardLossBias: 0.55 },
  legendary: { hoursPerCharge: 24, maxCharges: 2, lowCardLossBias: 0.62 },
  mythic:    { hoursPerCharge: 18, maxCharges: 3, lowCardLossBias: 0.70 },
  unique:    { hoursPerCharge: 12, maxCharges: 3, lowCardLossBias: 0.75 },
}

const CARD_GENERATOR = {
  uncommon: { hoursPerCharge: 8,  maxCharges: 5,  rarityCap: 'uncommon' },
  rare:      { hoursPerCharge: 6,  maxCharges: 7,  rarityCap: 'rare' },
  epic:      { hoursPerCharge: 4,  maxCharges: 10, rarityCap: 'epic' },
  legendary: { hoursPerCharge: 3,  maxCharges: 14, rarityCap: 'legendary' },
  mythic:    { hoursPerCharge: 2,  maxCharges: 17, rarityCap: 'mythic' },
  unique:    { hoursPerCharge: 1,  maxCharges: 20, rarityCap: 'unique' },
}

const SWAP_COOLDOWN_HOURS = {
  odds_boost: 12, holo_boost: 12, card_reroll: 24, pack_reroll: 24,
  unique_hunter: 6, collector_boost: 12, card_generator: 48,
}

export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'unique']

// ════════════════════════════════════════════
// Passive state: read
// ════════════════════════════════════════════

function getChargeConfig(passiveName, staffRarity) {
  if (passiveName === 'card_reroll') return CARD_REROLL[staffRarity]
  if (passiveName === 'pack_reroll') return PACK_REROLL[staffRarity]
  if (passiveName === 'card_generator') return CARD_GENERATOR[staffRarity]
  return null
}

function computeCharges(state, config) {
  if (!config) return { charges: 0, maxCharges: 0, chargeProgressPct: 0, nextChargeIn: null }

  const now = Date.now()
  const lastCharged = new Date(state.last_charged_at).getTime()
  const elapsedMs = Math.max(0, now - lastCharged)
  const msPerCharge = config.hoursPerCharge * 3600_000

  const earnedCharges = Math.floor(elapsedMs / msPerCharge)
  const totalCharges = Math.min(state.charges + earnedCharges, config.maxCharges)
  const atMax = totalCharges >= config.maxCharges

  const remainderMs = atMax ? 0 : elapsedMs - (earnedCharges * msPerCharge)
  const progressPct = atMax ? 1 : remainderMs / msPerCharge
  const nextChargeMs = atMax ? null : msPerCharge - remainderMs

  return {
    charges: totalCharges,
    maxCharges: config.maxCharges,
    chargeProgressPct: Math.round(progressPct * 100) / 100,
    nextChargeIn: nextChargeMs ? formatDuration(nextChargeMs) : null,
  }
}

function formatDuration(ms) {
  const hours = Math.floor(ms / 3600_000)
  const minutes = Math.floor((ms % 3600_000) / 60_000)
  if (hours > 0) return `${hours}h`
  return `${minutes}m`
}

export async function getActivePassive(sql, userId) {
  const rows = await sql`
    SELECT l.card_id, l.holo_choice, c.rarity, sp.name AS passive_name
    FROM cc_lineups l
    JOIN cc_cards c ON l.card_id = c.id
    JOIN cc_staff_passives sp ON c.passive_id = sp.id
    WHERE l.user_id = ${userId}
      AND l.lineup_type = 'current'
      AND l.role = 'staff'
      AND l.card_id IS NOT NULL
  `
  if (rows.length === 0) return null

  const row = rows[0]
  const state = await getPassiveState(sql, userId, row.passive_name)
  const config = getChargeConfig(row.passive_name, row.rarity)
  // Owner (user 1) always has max charges for testing
  const chargeInfo = config
    ? userId === 1
      ? { charges: config.maxCharges, maxCharges: config.maxCharges, chargeProgressPct: 1, nextChargeIn: null }
      : computeCharges(state, config)
    : null

  return {
    passiveName: row.passive_name,
    staffRarity: row.rarity,
    cardId: row.card_id,
    holoChoice: row.holo_choice || state.holo_choice,
    enabled: state.enabled,
    charges: chargeInfo?.charges ?? null,
    maxCharges: chargeInfo?.maxCharges ?? null,
    chargeProgressPct: chargeInfo?.chargeProgressPct ?? null,
    nextChargeIn: chargeInfo?.nextChargeIn ?? null,
  }
}

async function getPassiveState(sql, userId, passiveName) {
  const rows = await sql`
    SELECT * FROM cc_passive_state
    WHERE user_id = ${userId} AND passive_name = ${passiveName}
  `
  if (rows.length > 0) return rows[0]

  // No row yet — return defaults (row created on first slot)
  return { charges: 0, last_charged_at: new Date(), cooldown_until: null, enabled: true, holo_choice: null, generator_pool: 'god' }
}

// ════════════════════════════════════════════
// Passive state: write
// ════════════════════════════════════════════

export async function initPassiveState(sql, userId, passiveName) {
  await sql`
    INSERT INTO cc_passive_state (user_id, passive_name, charges, last_charged_at, enabled)
    VALUES (${userId}, ${passiveName}, 0, NOW(), true)
    ON CONFLICT (user_id, passive_name) DO NOTHING
  `
}

export async function spendCharge(sql, userId, passiveName, staffRarity) {
  // Owner (user 1) has unlimited charges
  if (userId === 1) return 99

  const config = getChargeConfig(passiveName, staffRarity)
  if (!config) throw new Error('Passive has no charges')

  const state = await getPassiveState(sql, userId, passiveName)
  const { charges } = computeCharges(state, config)
  if (charges <= 0) throw new Error('No charges available')

  // Materialize computed charges minus one, reset timer for partial progress
  const now = new Date()
  const lastCharged = new Date(state.last_charged_at)
  const msPerCharge = config.hoursPerCharge * 3600_000
  const elapsedMs = Math.max(0, now.getTime() - lastCharged.getTime())
  const earnedCharges = Math.floor(elapsedMs / msPerCharge)
  const newCharges = Math.min(state.charges + earnedCharges, config.maxCharges) - 1

  // Preserve partial progress toward next charge
  const remainderMs = elapsedMs - (earnedCharges * msPerCharge)
  const newLastCharged = new Date(now.getTime() - remainderMs)

  await sql`
    UPDATE cc_passive_state
    SET charges = ${newCharges}, last_charged_at = ${newLastCharged}
    WHERE user_id = ${userId} AND passive_name = ${passiveName}
  `

  return newCharges
}

export async function applySwapCooldown(sql, userId, passiveName) {
  const hours = SWAP_COOLDOWN_HOURS[passiveName]
  if (!hours) return

  await sql`
    INSERT INTO cc_passive_state (user_id, passive_name, cooldown_until)
    VALUES (${userId}, ${passiveName}, NOW() + ${hours + ' hours'}::interval)
    ON CONFLICT (user_id, passive_name)
    DO UPDATE SET cooldown_until = NOW() + ${hours + ' hours'}::interval
  `
}

export async function checkSwapCooldown(sql, userId) {
  const rows = await sql`
    SELECT passive_name, cooldown_until FROM cc_passive_state
    WHERE user_id = ${userId} AND cooldown_until > NOW()
    ORDER BY cooldown_until DESC LIMIT 1
  `
  if (rows.length === 0) return null
  return { passiveName: rows[0].passive_name, cooldownUntil: rows[0].cooldown_until }
}

export async function toggleUniqueHunter(sql, userId, enabled) {
  await sql`
    UPDATE cc_passive_state
    SET enabled = ${enabled}
    WHERE user_id = ${userId} AND passive_name = 'unique_hunter'
  `
}

export async function setHoloChoice(sql, userId, holoChoice) {
  if (!['holo', 'reverse', 'full'].includes(holoChoice)) throw new Error('Invalid holo choice')
  await sql`
    UPDATE cc_lineups SET holo_choice = ${holoChoice}
    WHERE user_id = ${userId} AND lineup_type = 'current' AND role = 'staff'
  `
  await sql`
    UPDATE cc_passive_state SET holo_choice = ${holoChoice}
    WHERE user_id = ${userId} AND passive_name = 'holo_boost'
  `
}

// ════════════════════════════════════════════
// Card Generator
// ════════════════════════════════════════════

export async function getGeneratedCards(sql, userId) {
  return await sql`
    SELECT id, card_data, rarity, created_at
    FROM cc_generated_cards
    WHERE user_id = ${userId} AND claimed_at IS NULL
    ORDER BY created_at DESC
  `
}

export async function claimAllGeneratedCards(sql, userId) {
  const gens = await sql`
    SELECT * FROM cc_generated_cards
    WHERE user_id = ${userId} AND claimed_at IS NULL
    ORDER BY created_at ASC
  `
  if (gens.length === 0) return []

  const cards = []
  for (const gen of gens) {
    const cd = gen.card_data
    const [inserted] = await sql`
      INSERT INTO cc_cards (
        owner_id, original_owner_id, god_id, god_name, god_class, role, rarity,
        serial_number, holo_effect, holo_type, image_url, acquired_via, card_type,
        card_data, def_id, blueprint_id, depicted_user_id
      ) VALUES (
        ${userId}, ${userId}, ${cd.god_id}, ${cd.god_name}, ${cd.god_class},
        ${cd.role}, ${cd.rarity}, ${cd.serial_number},
        ${cd.holo_effect}, ${cd.holo_type}, ${cd.image_url},
        'passive_generator', ${cd.card_type},
        ${cd.card_data ? JSON.stringify(cd.card_data) : null}::jsonb,
        ${cd.def_id || null}, ${cd.blueprint_id || null},
        ${cd.depicted_user_id || null}
      ) RETURNING *
    `
    cards.push(inserted)
  }

  const ids = gens.map(g => g.id)
  await sql`UPDATE cc_generated_cards SET claimed_at = NOW() WHERE id = ANY(${ids})`

  return cards
}

export async function claimGeneratedCard(sql, userId, generatedCardId) {
  const [gen] = await sql`
    SELECT * FROM cc_generated_cards
    WHERE id = ${generatedCardId} AND user_id = ${userId} AND claimed_at IS NULL
  `
  if (!gen) throw new Error('Card not found or already claimed')

  const cardData = gen.card_data

  const [inserted] = await sql`
    INSERT INTO cc_cards (
      owner_id, original_owner_id, god_id, god_name, god_class, role, rarity,
      serial_number, holo_effect, holo_type, image_url, acquired_via, card_type,
      card_data, def_id, blueprint_id, depicted_user_id
    ) VALUES (
      ${userId}, ${userId}, ${cardData.god_id}, ${cardData.god_name}, ${cardData.god_class},
      ${cardData.role}, ${cardData.rarity}, ${cardData.serial_number},
      ${cardData.holo_effect}, ${cardData.holo_type}, ${cardData.image_url},
      'passive_generator', ${cardData.card_type},
      ${cardData.card_data ? JSON.stringify(cardData.card_data) : null}::jsonb,
      ${cardData.def_id || null}, ${cardData.blueprint_id || null},
      ${cardData.depicted_user_id || null}
    ) RETURNING *
  `

  await sql`UPDATE cc_generated_cards SET claimed_at = NOW() WHERE id = ${generatedCardId}`

  return inserted
}

export async function generatePassiveCard(sql, userId, staffRarity) {
  const config = CARD_GENERATOR[staffRarity]
  if (!config) return null

  const { createOddsContext, rollRarityFromContext } = await import('./odds.js')
  const { generateCard, generateConsumableCard, generatePlayerCard } = await import('./vault.js')

  // Build boosted context capped at staff rarity
  const ctx = createOddsContext()
  const oddsBoostMult = ODDS_BOOST[staffRarity] || 1
  for (const r of RARITY_ORDER) {
    if (r !== 'common') ctx.rarity[r] *= oddsBoostMult
  }

  const rarity = rollRarityFromContext(ctx, 'common', config.rarityCap)

  // Pick randomly from combined pool: gods (50%), players (30%), consumables (20%)
  const roll = Math.random()
  let card
  if (roll < 0.5) {
    card = generateCard(rarity, ctx)
  } else if (roll < 0.8) {
    card = await generatePlayerCard(sql, rarity, null, ctx)
  } else {
    card = generateConsumableCard(rarity, ctx)
  }

  card.acquired_via = 'passive_generator'

  const [gen] = await sql`
    INSERT INTO cc_generated_cards (user_id, card_data, rarity)
    VALUES (${userId}, ${JSON.stringify(card)}::jsonb, ${rarity})
    RETURNING id, rarity, created_at
  `

  return gen
}

// ════════════════════════════════════════════
// Apply passive to OddsContext
// ════════════════════════════════════════════

export function applyPassiveToContext(ctx, passiveName, staffRarity, passiveState) {
  if (!passiveName || !staffRarity) return ctx
  const next = { ...ctx, rarity: { ...ctx.rarity }, holoType: { ...ctx.holoType } }

  switch (passiveName) {
    case 'odds_boost': {
      const mult = ODDS_BOOST[staffRarity] || 1
      for (const r of RARITY_ORDER) {
        if (r !== 'common') next.rarity[r] *= mult
      }
      break
    }

    case 'holo_boost': {
      const weight = HOLO_BOOST_WEIGHT[staffRarity] || 1
      const choice = passiveState?.holoChoice
      if (choice && next.holoType[choice] !== undefined) {
        next.holoType[choice] = weight
      }
      break
    }

    case 'unique_hunter': {
      if (passiveState?.enabled !== false) {
        next.blockedRarities = ['legendary', 'mythic']
        next._uniqueRedirectPct = UNIQUE_HUNTER_REDIRECT[staffRarity] || 0
      }
      break
    }

    case 'collector_boost': {
      next.collectorBoost = COLLECTOR_BOOST_MULT[staffRarity] || 1
      break
    }

    // card_reroll, pack_reroll, card_generator don't modify odds context
    // They are handled separately during pack opening
  }

  return next
}

// ════════════════════════════════════════════
// Pack Reroll: card removal weighting
// ════════════════════════════════════════════

export function pickCardToRemove(cards, staffRarity, rerollCount) {
  const config = PACK_REROLL[staffRarity]
  if (!config) return 0 // fallback: remove first

  // Sort indices by rarity (lowest first)
  const rarityIdx = Object.fromEntries(RARITY_ORDER.map((r, i) => [r, i]))
  const indices = cards.map((_, i) => i)
  indices.sort((a, b) => (rarityIdx[cards[a].rarity] || 0) - (rarityIdx[cards[b].rarity] || 0))

  // Base bias toward low-rarity cards, eroded by +15% per reroll toward rarest
  const baseBias = config.lowCardLossBias
  const erosion = rerollCount * 0.15
  const effectiveBias = Math.max(0.1, baseBias - erosion)

  // Split into bottom half and top half
  const midpoint = Math.ceil(indices.length / 2)
  const bottomHalf = indices.slice(0, midpoint)
  const topHalf = indices.slice(midpoint)

  if (Math.random() < effectiveBias) {
    return bottomHalf[Math.floor(Math.random() * bottomHalf.length)]
  } else {
    return topHalf[Math.floor(Math.random() * topHalf.length)]
  }
}

// Export tuning tables for frontend display
export { CARD_REROLL, PACK_REROLL, CARD_GENERATOR, SWAP_COOLDOWN_HOURS }

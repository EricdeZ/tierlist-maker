// Starting 5 — passive income from slotted cards
import { grantEmber } from './ember.js'
import { grantPassion } from './passion.js'
import { checkSwapCooldown, applySwapCooldown, initPassiveState } from './passives.js'

const S5_FLAT_CORES = {
  uncommon: 0.62, rare: 1.47, epic: 3.25, legendary: 6.27, mythic: 7.05, unique: 8.01,
}
const S5_FLAT_PASSION = {
  uncommon: 0.039, rare: 0.093, epic: 0.201, legendary: 0.387, mythic: 0.431, unique: 0.494,
}
const S5_REVERSE_MULT = {
  uncommon: 1.116, rare: 1.194, epic: 1.356, legendary: 1.426, mythic: 1.568, unique: 1.748,
}
const S5_FLAT_SCALE = 0.7
const S5_MULT_SCALE = 4.5
const S5_FULL_RATIO = 0.44
const S5_BENCH_EFFECTIVENESS = 0.50
export const S5_ALLSTAR_MODIFIER = 0.615

const S5_ATT_FLAT = {
  god:  { uncommon: 0.06, rare: 0.10, epic: 0.20, legendary: 0.29, mythic: 0.35, unique: 0.48 },
  item: { uncommon: 0.04, rare: 0.06, epic: 0.13, legendary: 0.18, mythic: 0.21, unique: 0.30 },
}
const S5_ATT_MULT = {
  god:  { uncommon: 0.030, rare: 0.050, epic: 0.100, legendary: 0.145, mythic: 0.171, unique: 0.237 },
  item: { uncommon: 0.015, rare: 0.025, epic: 0.050, legendary: 0.070, mythic: 0.083, unique: 0.119 },
}
const S5_FULL_ATT_RATIO = 0.6
const GOD_SYNERGY_BONUS = 0.40
export const TEAM_SYNERGY_BONUS = { 2: 0.20, 3: 0.30, 4: 0.45, 5: 0.60, 6: 0.60 }

// Staff card slots — flat cores/day + multiplier, no Passion
const S5_STAFF_FLAT_CORES = {
  uncommon: 0.02, rare: 0.05, epic: 0.10, legendary: 0.15, mythic: 0.20, unique: 0.25,
}
const S5_STAFF_MULT = {
  uncommon: 1.03, rare: 1.06, epic: 1.09, legendary: 1.12, mythic: 1.15, unique: 1.18,
}

// Lower number = higher rarity (matches RARITIES.tier in economy.js)
const RARITY_TIER = { common: 5, uncommon: 4, rare: 3, epic: 2, legendary: 1, mythic: 0, unique: -1 }

const CONSUMABLE_EFFECTS = {
  'health-pot': { type: 'instant', effect: 'cap-fill', values: { common: 0.08, uncommon: 0.14, rare: 0.25, epic: 0.42, legendary: 0.68, mythic: 1.00 } },
  'mana-pot': { type: 'buff', effect: 'rate-boost', values: { common: 0.10, uncommon: 0.22, rare: 0.48, epic: 1.00, legendary: 1.90, mythic: 3.00 } },
  'multi-pot': { type: 'buff', effect: 'rate-cap-boost', rateValues: { common: 0.03, uncommon: 0.06, rare: 0.12, epic: 0.20, legendary: 0.35, mythic: 0.60 }, capValues: { common: 0.15, uncommon: 0.25, rare: 0.50, epic: 0.90, legendary: 1.50, mythic: 2.50 } },
  'elixir-str': { type: 'buff', effect: 'collect-mult', values: { common: 1.10, uncommon: 1.20, rare: 1.35, epic: 1.55, legendary: 1.85, mythic: 2.30 } },
  'elixir-int': { type: 'buff', effect: 'dismantle-boost', values: { common: 1.25, uncommon: 1.45, rare: 1.80, epic: 2.40, legendary: 3.50, mythic: 5.30 } },
  'ward': { type: 'buff', effect: 'cap-increase', values: { common: 0.25, uncommon: 0.50, rare: 1.00, epic: 1.75, legendary: 3.00, mythic: 5.00 } },
  'sentry': { type: 'instant', effect: 'jackpot', values: { common: 10, uncommon: 25, rare: 60, epic: 130, legendary: 280, mythic: 500 } },
}
const CONSUMABLE_MAX_SLOTS = 3
export const CONSUMABLE_DAILY_CAP = 9

function dateToStr(d) {
  if (!d) return ''
  if (d instanceof Date) return d.toISOString().slice(0, 10)
  return String(d).slice(0, 10)
}

export function getBuffTotals(activeBuffs) {
  let totalRateBoost = 0
  let totalCapDays = 0
  let totalCollectMult = 1
  for (const buff of (activeBuffs || [])) {
    if (buff.rateBoost) totalRateBoost += buff.rateBoost
    if (buff.capDays) totalCapDays += buff.capDays
    if (buff.collectMult) totalCollectMult += (buff.collectMult - 1)
  }
  return { totalRateBoost, totalCapDays, totalCollectMult }
}

const CAP_DAYS = 2
const HOURS_PER_DAY = 24

// Returns a card's economic contribution based on holo type
export function getCardContribution(holoType, rarity, effectiveness = 1.0) {
  if (!holoType) return { type: 'none' }

  const baseFlat = (S5_FLAT_CORES[rarity] || 0) * S5_FLAT_SCALE * effectiveness
  const baseFlatP = (S5_FLAT_PASSION[rarity] || 0) * S5_FLAT_SCALE * effectiveness

  if (holoType === 'holo') {
    return { type: 'flat', cores: baseFlat, passion: baseFlatP }
  }
  if (holoType === 'reverse') {
    const baseMult = S5_REVERSE_MULT[rarity] || 1
    const multBonus = (baseMult - 1) * S5_MULT_SCALE * effectiveness
    return { type: 'mult', multiplier: 1 + multBonus }
  }
  if (holoType === 'full') {
    const cores = baseFlat * S5_FULL_RATIO
    const passion = baseFlatP * S5_FULL_RATIO
    const baseMult = S5_REVERSE_MULT[rarity] || 1
    const multBonus = (baseMult - 1) * S5_MULT_SCALE * S5_FULL_RATIO * effectiveness
    return { type: 'full', cores, passion, multiplier: 1 + multBonus }
  }
  return { type: 'none' }
}

export function getStaffContribution(rarity) {
  const cores = S5_STAFF_FLAT_CORES[rarity] || 0
  const mult = S5_STAFF_MULT[rarity] || 1
  if (cores === 0 && mult === 1) return { type: 'none' }
  return { type: 'staff', cores, passion: 0, multiplier: mult }
}

function getAttachmentBonus(attachment, type, playerHasFlat, playerHasMult, synergy = false) {
  if (!attachment?.holo_type || !attachment?.rarity) return { flatBoost: 0, multAdd: 0 }

  const attType = type // 'god' or 'item'
  let flatPct = S5_ATT_FLAT[attType]?.[attachment.rarity] || 0
  let multAdd = S5_ATT_MULT[attType]?.[attachment.rarity] || 0

  if (synergy && type === 'god') {
    flatPct *= (1 + GOD_SYNERGY_BONUS)
    multAdd *= (1 + GOD_SYNERGY_BONUS)
  }

  let resultFlat = 0, resultMult = 0

  if (attachment.holo_type === 'holo') {
    resultFlat = playerHasFlat ? flatPct : 0
  } else if (attachment.holo_type === 'reverse') {
    resultMult = playerHasMult ? multAdd : 0
  } else if (attachment.holo_type === 'full') {
    resultFlat = playerHasFlat ? flatPct * S5_FULL_ATT_RATIO : 0
    resultMult = playerHasMult ? multAdd * S5_FULL_ATT_RATIO : 0
  }

  return { flatBoost: resultFlat, multAdd: resultMult }
}

export function checkSynergy(playerCard, godCard) {
  if (!playerCard?.best_god_name || !godCard?.god_name) return false
  return godCard.god_name.toLowerCase() === playerCard.best_god_name.toLowerCase()
}

// Calculate a single lineup's daily output (before consumable)
export function calculateLineupOutput(cards, teamCounts = {}) {
  let totalFlatCores = 0, totalFlatPassion = 0, totalMult = 1.0

  for (const card of cards) {
    if (isRoleMismatch(card)) continue

    // Staff cards: dedicated path, no attachments, no team synergy
    if (card.card_type === 'staff') {
      const staffContrib = getStaffContribution(card.rarity)
      if (staffContrib.type === 'staff') {
        totalFlatCores += staffContrib.cores
        totalMult += (staffContrib.multiplier - 1)
      }
      continue
    }

    const effectiveness = card.isBench ? S5_BENCH_EFFECTIVENESS : 1.0
    const contrib = getCardContribution(card.holo_type, card.rarity, effectiveness)
    const synergy = checkSynergy(card, card._godCard)
    const playerHasFlat = contrib.type === 'flat' || contrib.type === 'full'
    const playerHasMult = contrib.type === 'mult' || contrib.type === 'full'

    const godBonus = getAttachmentBonus(card._godCard, 'god', playerHasFlat, playerHasMult, synergy)
    const itemBonus = getAttachmentBonus(card._itemCard, 'item', playerHasFlat, playerHasMult)

    // Per-card team synergy (bench now included in team counts)
    const cardTeamBonus = 1 + (TEAM_SYNERGY_BONUS[teamCounts[card.team_id]] || 0)

    // Attachment flat boosts — effectiveness already in contrib.cores/passion
    if (playerHasFlat) {
      const godFlatMult = 1 + godBonus.flatBoost
      const itemFlatMult = 1 + itemBonus.flatBoost
      totalFlatCores += contrib.cores * godFlatMult * itemFlatMult * cardTeamBonus
      totalFlatPassion += contrib.passion * godFlatMult * itemFlatMult * cardTeamBonus
    }

    // Attachment mult additions — scaled by effectiveness
    if (playerHasMult) {
      const slotMult = contrib.multiplier + godBonus.multAdd * effectiveness + itemBonus.multAdd * effectiveness
      const boostedMult = (slotMult - 1) * cardTeamBonus
      totalMult += boostedMult
    }
  }

  return {
    coresPerDay: totalFlatCores * totalMult,
    passionPerDay: totalFlatPassion * totalMult,
  }
}

export function getAttachmentBonusInfo(attachment, type, playerHoloType, synergy = false) {
  if (!attachment?.holo_type) return { flatBoost: 0, multAdd: 0, effectiveType: 'none' }
  const playerHasFlat = playerHoloType === 'holo' || playerHoloType === 'full'
  const playerHasMult = playerHoloType === 'reverse' || playerHoloType === 'full'
  const bonus = getAttachmentBonus(attachment, type, playerHasFlat, playerHasMult, synergy)
  return { ...bonus, effectiveType: bonus.flatBoost > 0 ? 'flat' : bonus.multAdd > 0 ? 'mult' : 'none' }
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

export function isRoleMismatch(card) {
  if (card.slot_role === 'bench' || card.slot_role === 'cheerleader' || card.slot_role === 'staff') return false
  return card.slot_role && card.role && card.role !== card.slot_role && card.role !== 'fill'
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
    SELECT l.role AS slot_role, l.lineup_type, c.*,
      sp.name AS passive_name,
      pd.best_god_name, pd.team_id AS team_id,
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
    LEFT JOIN cc_staff_passives sp ON c.passive_id = sp.id
    LEFT JOIN cc_player_defs pd ON c.def_id = pd.id AND c.card_type = 'player'
    LEFT JOIN LATERAL (
      SELECT u.id, u.discord_id, u.discord_avatar
      FROM users u WHERE u.linked_player_id = pd.player_id LIMIT 1
    ) pu ON true
    LEFT JOIN user_preferences pup ON pup.user_id = pu.id
    LEFT JOIN cc_cards g ON l.god_card_id = g.id
    LEFT JOIN cc_cards i ON l.item_card_id = i.id
    WHERE l.user_id = ${userId} AND l.card_id IS NOT NULL
  `

  for (const card of cards) {
    card.isBench = card.slot_role === 'bench'
    const { godCard, itemCard } = reshapeAttachments(card)
    card._godCard = godCard
    card._itemCard = itemCard
  }

  // Fetch most-played god (with stats) for each player card
  const playerDefIds = [...new Set(cards.filter(c => c.card_type === 'player' && c.def_id).map(c => c.def_id))]
  if (playerDefIds.length > 0) {
    const bestGodRows = await sql`
      SELECT DISTINCT ON (x.def_id) x.def_id, x.god_played, x.games, x.wins
      FROM (
        SELECT pd.id AS def_id, pgs.god_played,
               COUNT(*)::int AS games,
               COUNT(*) FILTER (
                 WHERE g.winner_team_id = CASE pgs.team_side WHEN 1 THEN m.team1_id WHEN 2 THEN m.team2_id END
               )::int AS wins
        FROM cc_player_defs pd
        JOIN league_players lp ON lp.player_id = pd.player_id AND lp.season_id = pd.season_id
        JOIN player_game_stats pgs ON pgs.league_player_id = lp.id AND pgs.god_played IS NOT NULL
        JOIN games g ON g.id = pgs.game_id AND g.is_completed = true
        JOIN matches m ON g.match_id = m.id
        WHERE pd.id = ANY(${playerDefIds})
          AND CASE pgs.team_side WHEN 1 THEN m.team1_id WHEN 2 THEN m.team2_id END = pd.team_id
        GROUP BY pd.id, pgs.god_played
      ) x
      ORDER BY x.def_id, x.games DESC, x.god_played ASC
    `
    const bestGodMap = {}
    for (const row of bestGodRows) {
      const slug = row.god_played.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
      bestGodMap[row.def_id] = {
        name: row.god_played,
        imageUrl: `https://smitebrain.com/cdn-cgi/image/width=80,height=80,f=auto,fit=cover/https://images.smitebrain.com/images/gods/icons/${slug}`,
        games: row.games,
        winRate: row.games > 0 ? Math.round((row.wins / row.games) * 1000) / 10 : 0,
      }
    }
    for (const card of cards) {
      if (card.card_type === 'player' && card.def_id) {
        card._bestGodFull = bestGodMap[card.def_id] || null
      }
    }
  }

  const csCards = cards.filter(c => c.lineup_type === 'current')
  const asCards = cards.filter(c => c.lineup_type === 'allstar')

  const [[state], [{ count: consumablesUsedToday }]] = await Promise.all([
    sql`SELECT * FROM cc_starting_five_state WHERE user_id = ${userId}`,
    sql`SELECT COUNT(*)::int AS count FROM cc_consumable_uses
        WHERE user_id = ${userId} AND created_at >= CURRENT_DATE AND created_at < CURRENT_DATE + INTERVAL '1 day'`,
  ])

  const activeBuffs = state?.active_buffs || []
  const { totalRateBoost, totalCapDays } = getBuffTotals(activeBuffs)

  const emptyOutput = { coresPerDay: 0, passionPerDay: 0 }

  if (!state || !state.last_tick || cards.length === 0) {
    await sql`
      UPDATE cc_starting_five_state
      SET last_tick = NOW()
      WHERE user_id = ${userId}
    `
    return {
      cards,
      csCards, asCards,
      csOutput: emptyOutput, asOutput: emptyOutput,
      passionPending: Number(state?.passion_pending) || 0,
      coresPending: Number(state?.cores_pending) || 0,
      passionCap: 0,
      coresCap: 0,
      lastTick: new Date().toISOString(),
      activeBuffs: state?.active_buffs || [],
      consumableSlotsUsed: state?.consumable_slots_used || 0,
      consumablesUsedToday,
      dismantleBoostMult: Number(state?.dismantle_boost_mult) || 1,
      dismantleBoostDate: state?.dismantle_boost_date || null,
    }
  }

  function getTeamCounts(lineupCards) {
    const counts = {}
    for (const card of lineupCards) {
      if (isRoleMismatch(card)) continue
      if (card.team_id) counts[card.team_id] = (counts[card.team_id] || 0) + 1
    }
    return counts
  }

  const csTeamCounts = getTeamCounts(csCards)
  const asTeamCounts = getTeamCounts(asCards)

  const csOutput = calculateLineupOutput(csCards, csTeamCounts)
  const asOutput = calculateLineupOutput(asCards, asTeamCounts)

  const combinedCoresPerDay = csOutput.coresPerDay + asOutput.coresPerDay * S5_ALLSTAR_MODIFIER
  const combinedPassionPerDay = csOutput.passionPerDay + asOutput.passionPerDay * S5_ALLSTAR_MODIFIER

  const coresCap = combinedCoresPerDay * (CAP_DAYS + totalCapDays)
  const passionCap = combinedPassionPerDay * (CAP_DAYS + totalCapDays)

  const now = new Date()
  const lastTick = new Date(state.last_tick)
  const elapsedHours = (now - lastTick) / (1000 * 60 * 60)

  if (elapsedHours < 0.001) {
    return {
      cards,
      csCards, asCards,
      csOutput, asOutput,
      passionPending: Number(state.passion_pending) || 0,
      coresPending: Number(state.cores_pending) || 0,
      passionCap,
      coresCap,
      lastTick: state.last_tick,
      activeBuffs: state?.active_buffs || [],
      consumableSlotsUsed: state?.consumable_slots_used || 0,
      consumablesUsedToday,
      dismantleBoostMult: Number(state?.dismantle_boost_mult) || 1,
      dismantleBoostDate: state?.dismantle_boost_date || null,
    }
  }

  let coresAccrued = (combinedCoresPerDay / HOURS_PER_DAY) * elapsedHours
  let passionAccrued = (combinedPassionPerDay / HOURS_PER_DAY) * elapsedHours

  if (totalRateBoost > 0) {
    coresAccrued *= (1 + totalRateBoost)
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
    csCards, asCards,
    csOutput, asOutput,
    passionPending: newPassion,
    coresPending: newCores,
    lastTick: now.toISOString(),
    passionCap,
    coresCap,
    activeBuffs: state?.active_buffs || [],
    consumableSlotsUsed: state?.consumable_slots_used || 0,
    consumablesUsedToday,
    dismantleBoostMult: Number(state?.dismantle_boost_mult) || 1,
    dismantleBoostDate: state?.dismantle_boost_date || null,
  }
}

export async function collectIncome(sql, userId) {
  const state = await tick(sql, userId)

  const { totalCollectMult } = getBuffTotals(state.activeBuffs)
  const passionToGrant = Math.floor(state.passionPending)
  const coresToGrant = Math.floor(state.coresPending * totalCollectMult)
  const passionRemainder = state.passionPending - passionToGrant
  const coresRemainder = state.coresPending * totalCollectMult - coresToGrant

  if (passionToGrant > 0) {
    await grantPassion(sql, userId, 'starting_five', passionToGrant, 'Starting 5 passive income')
  }
  if (coresToGrant > 0) {
    await grantEmber(sql, userId, 'starting_five', coresToGrant, 'Starting 5 passive income')
  }

  await sql`
    UPDATE cc_starting_five_state
    SET passion_pending = ${passionRemainder},
        cores_pending = ${coresRemainder},
        active_buffs = '[]',
        consumable_slots_used = 0
    WHERE user_id = ${userId}
  `

  return {
    ...state,
    passionPending: passionRemainder,
    coresPending: coresRemainder,
    passionGranted: passionToGrant,
    coresGranted: coresToGrant,
    activeBuffs: [],
    consumableSlotsUsed: 0,
  }
}

export async function slotCard(sql, userId, cardId, role, slotType = 'player', lineupType = 'current') {
  const validRoles = ['solo', 'jungle', 'mid', 'support', 'adc', 'bench', 'cheerleader', 'staff']
  if (!validRoles.includes(role)) throw new Error('Invalid role')
  if (!['current', 'allstar'].includes(lineupType)) throw new Error('Invalid lineup type')

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
    // Staff slots only accept staff cards
    if (role === 'cheerleader' || role === 'staff') {
      if (card.card_type !== 'staff') throw new Error('Only staff cards can be slotted in staff/cheerleader slots')

      // Enforce current lineup only
      if (lineupType !== 'current') throw new Error('Staff slots are only available in the current season lineup')

      // Check not already slotted
      const [existing] = await sql`
        SELECT role, lineup_type FROM cc_lineups
        WHERE user_id = ${userId} AND card_id = ${cardId}
      `
      if (existing) throw new Error(`Card is already slotted in ${existing.lineup_type}/${existing.role}`)

      // Check swap cooldown before slotting staff card
      if (role === 'staff') {
        const cooldown = await checkSwapCooldown(sql, userId)
        if (cooldown) {
          const remaining = Math.ceil((new Date(cooldown.cooldownUntil).getTime() - Date.now()) / 3600_000)
          throw new Error(`Staff slot on cooldown — ${remaining}h remaining`)
        }
      }

      await collectIncome(sql, userId)

      await sql`
        INSERT INTO cc_lineups (user_id, lineup_type, role, card_id, slotted_at)
        VALUES (${userId}, ${lineupType}, ${role}, ${cardId}, NOW())
        ON CONFLICT (user_id, lineup_type, role)
        DO UPDATE SET card_id = ${cardId}, god_card_id = NULL, item_card_id = NULL, slotted_at = NOW()
      `

      // Initialize passive state for the newly slotted staff card
      if (role === 'staff') {
        const [staffCard] = await sql`
          SELECT sp.name AS passive_name FROM cc_cards c
          JOIN cc_staff_passives sp ON c.passive_id = sp.id
          WHERE c.id = ${cardId}
        `
        if (staffCard) {
          await initPassiveState(sql, userId, staffCard.passive_name)
        }
      }
    } else {
      // Existing player card logic
      if (card.card_type === 'staff') throw new Error('Staff cards can only be slotted in cheerleader or staff slots')
      if (!card.holo_type && card.rarity !== 'common') throw new Error('Card has no holo type')
      if (card.card_type !== 'player') throw new Error('Only player cards can be slotted')
      if (role !== 'bench' && card.role !== role && card.role !== 'fill') {
        throw new Error(`Card role (${card.role}) does not match slot (${role})`)
      }

      const [existing] = await sql`
        SELECT role, lineup_type FROM cc_lineups
        WHERE user_id = ${userId} AND card_id = ${cardId}
      `
      if (existing) throw new Error(`Card is already slotted in ${existing.lineup_type}/${existing.role}`)

      await collectIncome(sql, userId)

      await sql`
        INSERT INTO cc_lineups (user_id, lineup_type, role, card_id, slotted_at)
        VALUES (${userId}, ${lineupType}, ${role}, ${cardId}, NOW())
        ON CONFLICT (user_id, lineup_type, role)
        DO UPDATE SET card_id = ${cardId}, slotted_at = NOW()
      `

      // Check if existing god/item attachments still meet the new player's rarity floor
      const [slot] = await sql`
        SELECT god_card_id, item_card_id FROM cc_lineups
        WHERE user_id = ${userId} AND lineup_type = ${lineupType} AND role = ${role}
      `
      if (slot) {
        if (slot.god_card_id) {
          const [godCard] = await sql`SELECT rarity FROM cc_cards WHERE id = ${slot.god_card_id}`
          if (godCard && RARITY_TIER[godCard.rarity] > RARITY_TIER[card.rarity]
            && !(card.rarity === 'unique' && godCard.rarity === 'mythic')) {
            await sql`UPDATE cc_lineups SET god_card_id = NULL WHERE user_id = ${userId} AND lineup_type = ${lineupType} AND role = ${role}`
          }
        }
        if (slot.item_card_id) {
          const [itemCard] = await sql`SELECT rarity FROM cc_cards WHERE id = ${slot.item_card_id}`
          if (itemCard && RARITY_TIER[itemCard.rarity] > RARITY_TIER[card.rarity]
            && !(card.rarity === 'unique' && itemCard.rarity === 'mythic')) {
            await sql`UPDATE cc_lineups SET item_card_id = NULL WHERE user_id = ${userId} AND lineup_type = ${lineupType} AND role = ${role}`
          }
        }
      }
    }
  } else {
    // god or item attachment
    if (!card.holo_type) throw new Error('Attachment must have a holo type')
    if (card.card_type !== slotType) throw new Error(`Card type (${card.card_type}) does not match slot type (${slotType})`)

    if (slotType === 'god' && role !== 'bench' && card.role !== role && card.role !== 'fill') {
      throw new Error(`God card role (${card.role}) does not match slot (${role})`)
    }

    // A player card must already exist in the slot
    const [playerSlot] = await sql`
      SELECT card_id FROM cc_lineups
      WHERE user_id = ${userId} AND lineup_type = ${lineupType} AND role = ${role} AND card_id IS NOT NULL
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
      await sql`UPDATE cc_lineups SET god_card_id = ${cardId} WHERE user_id = ${userId} AND lineup_type = ${lineupType} AND role = ${role}`
    } else {
      await sql`UPDATE cc_lineups SET item_card_id = ${cardId} WHERE user_id = ${userId} AND lineup_type = ${lineupType} AND role = ${role}`
    }
  }

  // Auto-remove from trade pile when slotted
  await sql`DELETE FROM cc_trade_pile WHERE card_id = ${cardId}`

  return await tick(sql, userId)
}

export async function unslotCard(sql, userId, role, lineupType = 'current') {
  const validRoles = ['solo', 'jungle', 'mid', 'support', 'adc', 'bench', 'cheerleader', 'staff']
  if (!validRoles.includes(role)) throw new Error('Invalid role')

  await collectIncome(sql, userId)

  // Apply swap cooldown when unslotting a staff card
  if (role === 'staff') {
    const [staffSlot] = await sql`
      SELECT c.passive_id, sp.name AS passive_name
      FROM cc_lineups l
      JOIN cc_cards c ON l.card_id = c.id
      JOIN cc_staff_passives sp ON c.passive_id = sp.id
      WHERE l.user_id = ${userId} AND l.lineup_type = ${lineupType} AND l.role = 'staff'
        AND l.card_id IS NOT NULL
    `
    if (staffSlot) {
      await applySwapCooldown(sql, userId, staffSlot.passive_name)
    }
  }

  await sql`
    UPDATE cc_lineups
    SET card_id = NULL, slotted_at = NULL, god_card_id = NULL, item_card_id = NULL
    WHERE user_id = ${userId} AND lineup_type = ${lineupType} AND role = ${role}
  `

  return await tick(sql, userId)
}

export async function unslotAttachment(sql, userId, role, slotType, lineupType = 'current') {
  const validRoles = ['solo', 'jungle', 'mid', 'support', 'adc', 'bench', 'cheerleader', 'staff']
  if (!validRoles.includes(role)) throw new Error('Invalid role')
  if (slotType !== 'god' && slotType !== 'item') throw new Error('slotType must be god or item')

  await collectIncome(sql, userId)

  if (slotType === 'god') {
    await sql`UPDATE cc_lineups SET god_card_id = NULL WHERE user_id = ${userId} AND lineup_type = ${lineupType} AND role = ${role}`
  } else {
    await sql`UPDATE cc_lineups SET item_card_id = NULL WHERE user_id = ${userId} AND lineup_type = ${lineupType} AND role = ${role}`
  }

  return await tick(sql, userId)
}

export async function useConsumable(sql, userId, cardId) {
  const [card] = await sql`
    SELECT id, rarity, card_type, card_data FROM cc_cards
    WHERE id = ${cardId} AND owner_id = ${userId}
    FOR UPDATE
  `
  if (!card) throw new Error('Card not found')
  if (card.card_type !== 'consumable') throw new Error('Only consumable cards can be used')

  const [listing] = await sql`
    SELECT id FROM cc_market_listings WHERE card_id = ${cardId} AND status = 'active'
  `
  if (listing) throw new Error('Card is listed on marketplace — unlist it first')

  const [inTrade] = await sql`
    SELECT tc.id FROM cc_trade_cards tc JOIN cc_trades t ON tc.trade_id = t.id
    WHERE tc.card_id = ${cardId} AND t.status IN ('waiting', 'active') AND t.mode = 'direct' LIMIT 1
  `
  if (inTrade) throw new Error('Card is in an active trade — cancel the trade first')

  const [inBinder] = await sql`
    SELECT id FROM cc_binder_cards WHERE card_id = ${cardId} LIMIT 1
  `
  if (inBinder) throw new Error('Card is in your binder — remove it first')

  await ensureState(sql, userId)

  const [s5State] = await sql`
    SELECT consumable_slots_used, active_buffs, dismantle_boost_mult, dismantle_boost_date
    FROM cc_starting_five_state WHERE user_id = ${userId}
  `
  if ((s5State?.consumable_slots_used || 0) >= CONSUMABLE_MAX_SLOTS) {
    throw new Error('All 3 consumable slots are used — collect income first')
  }

  const [{ count: usedTodayCount }] = await sql`
    SELECT COUNT(*)::int AS count FROM cc_consumable_uses
    WHERE user_id = ${userId} AND created_at >= CURRENT_DATE AND created_at < CURRENT_DATE + INTERVAL '1 day'
  `
  if (usedTodayCount >= CONSUMABLE_DAILY_CAP) {
    throw new Error(`Daily consumable limit reached (${CONSUMABLE_DAILY_CAP}/day)`)
  }

  const consumableId = card.card_data?.consumableId
  const config = CONSUMABLE_EFFECTS[consumableId]
  if (!config) throw new Error('Unknown consumable type')

  let result = { type: consumableId, effect: config.effect }

  if (config.effect === 'cap-fill') {
    const currentState = await tick(sql, userId)
    const fillPct = config.values[card.rarity] || 0
    const fillAmount = currentState.coresCap * fillPct
    const newPending = Math.min((Number(currentState.coresPending) || 0) + fillAmount, currentState.coresCap)
    await sql`
      UPDATE cc_starting_five_state
      SET cores_pending = ${newPending},
          consumable_slots_used = consumable_slots_used + 1
      WHERE user_id = ${userId}
    `
    result.value = Math.round(fillAmount * 100) / 100

  } else if (config.effect === 'jackpot') {
    const maxValue = config.values[card.rarity] || 10
    const jackpotAmount = Math.floor(Math.random() * maxValue) + 1
    await grantEmber(sql, userId, 'consumable_jackpot', jackpotAmount, `Sentry Ward jackpot (${card.rarity})`)
    await sql`
      UPDATE cc_starting_five_state
      SET consumable_slots_used = consumable_slots_used + 1
      WHERE user_id = ${userId}
    `
    result.value = jackpotAmount

  } else if (config.effect === 'rate-boost') {
    const rateBoost = config.values[card.rarity] || 0
    const buff = { type: consumableId, rarity: card.rarity, rateBoost }
    await sql`
      UPDATE cc_starting_five_state
      SET active_buffs = active_buffs || ${JSON.stringify(buff)}::jsonb,
          consumable_slots_used = consumable_slots_used + 1
      WHERE user_id = ${userId}
    `
    result.value = rateBoost

  } else if (config.effect === 'rate-cap-boost') {
    const rateBoost = config.rateValues[card.rarity] || 0
    const capDays = config.capValues[card.rarity] || 0
    const buff = { type: consumableId, rarity: card.rarity, rateBoost, capDays }
    await sql`
      UPDATE cc_starting_five_state
      SET active_buffs = active_buffs || ${JSON.stringify(buff)}::jsonb,
          consumable_slots_used = consumable_slots_used + 1
      WHERE user_id = ${userId}
    `
    result.value = { rateBoost, capDays }

  } else if (config.effect === 'collect-mult') {
    const collectMult = config.values[card.rarity] || 1
    const buff = { type: consumableId, rarity: card.rarity, collectMult }
    await sql`
      UPDATE cc_starting_five_state
      SET active_buffs = active_buffs || ${JSON.stringify(buff)}::jsonb,
          consumable_slots_used = consumable_slots_used + 1
      WHERE user_id = ${userId}
    `
    result.value = collectMult

  } else if (config.effect === 'cap-increase') {
    const capDays = config.values[card.rarity] || 0
    const buff = { type: consumableId, rarity: card.rarity, capDays }
    await sql`
      UPDATE cc_starting_five_state
      SET active_buffs = active_buffs || ${JSON.stringify(buff)}::jsonb,
          consumable_slots_used = consumable_slots_used + 1
      WHERE user_id = ${userId}
    `
    result.value = capDays

  } else if (config.effect === 'dismantle-boost') {
    const boostValue = config.values[card.rarity] || 1
    const currentMult = Number(s5State?.dismantle_boost_mult) || 1
    const today = new Date().toISOString().slice(0, 10)
    const isToday = dateToStr(s5State?.dismantle_boost_date) === today
    const newMult = isToday ? currentMult + (boostValue - 1) : boostValue
    await sql`
      UPDATE cc_starting_five_state
      SET dismantle_boost_mult = ${newMult},
          dismantle_boost_date = ${today},
          consumable_slots_used = consumable_slots_used + 1
      WHERE user_id = ${userId}
    `
    result.value = newMult
  }

  // Log the consumable use
  await sql`
    INSERT INTO cc_consumable_uses (user_id, card_id, consumable_id, rarity, effect)
    VALUES (${userId}, ${cardId}, ${consumableId}, ${card.rarity}, ${config.effect})
  `

  // Remove from trade pile before destroying
  await sql`DELETE FROM cc_trade_pile WHERE card_id = ${cardId}`
  // Detach any trade references to swipes for this card so CASCADE can proceed
  await sql`
    UPDATE cc_trades SET match_swipe_a_id = NULL
    WHERE match_swipe_a_id IN (SELECT id FROM cc_swipes WHERE card_id = ${cardId})
  `
  await sql`
    UPDATE cc_trades SET match_swipe_b_id = NULL
    WHERE match_swipe_b_id IN (SELECT id FROM cc_swipes WHERE card_id = ${cardId})
  `
  // Destroy the card (cascades to cc_swipes, cc_binder_cards, etc.)
  await sql`DELETE FROM cc_cards WHERE id = ${cardId}`

  return { ...(await tick(sql, userId)), consumableResult: result }
}

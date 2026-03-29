// Server-side Card Clash logic: pack opening
import { grantEmber } from './ember.js'
import { GODS, ITEMS, CONSUMABLES, CLASS_ROLE, getGodImageUrl, getItemImageUrl } from './vault-data.js'
import { computePlayerStats } from './vault-defs.js'
import { createOddsContext, applyPackOverrides, rollRarityFromContext, rollHoloTypeFromContext, selectFromPool, getContextForType, RARITY_ORDER as OddsRarityOrder } from './odds.js'

const RARITIES = {
  common:    { name: 'Common',    dropRate: 0.60, color: '#9ca3af', holoEffects: ['common'] },
  uncommon:  { name: 'Uncommon',  dropRate: 0.30, color: '#22c55e', holoEffects: ['holo', 'amazing', 'reverse'] },
  rare:      { name: 'Rare',      dropRate: 0.06, color: '#3b82f6', holoEffects: ['galaxy', 'vstar', 'shiny', 'ultra'] },
  epic:      { name: 'Epic',      dropRate: 0.035, color: '#a855f7', holoEffects: ['radiant', 'sparkle', 'rainbow-alt', 'cosmos'] },
  legendary: { name: 'Legendary', dropRate: 0.0065, color: '#ff8c00', holoEffects: ['rainbow', 'secret', 'gold'] },
  mythic:    { name: 'Mythic',    dropRate: 0.00075, color: '#ef4444', holoEffects: ['rainbow', 'secret', 'gold', 'cosmos'] },
  unique:    { name: 'Unique',    dropRate: 0.00035, color: '#e8e8ff', holoEffects: ['secret'] },
  full_art:  { name: 'Full Art',  dropRate: 0, color: '#d4af37', holoEffects: ['rainbow', 'secret', 'gold', 'cosmos', 'galaxy', 'radiant'] },
}

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'unique']

function rollRarity(minRarity = 'common', ctx = null) {
  if (ctx) return rollRarityFromContext(ctx, minRarity)
  return rollRarityFromContext(createOddsContext(), minRarity)
}

function rollRarityBounded(minRarity = 'common', maxRarity = null, ctx = null) {
  if (ctx) return rollRarityFromContext(ctx, minRarity, maxRarity)
  return rollRarityFromContext(createOddsContext(), minRarity, maxRarity)
}

// Fixed holo effect per rarity — matches catalog
const RARITY_HOLO_MAP = {
  common: 'common', uncommon: 'holo', rare: 'galaxy',
  epic: 'cosmos', legendary: 'gold', mythic: 'rainbow', unique: 'secret',
}

export function rollHoloEffect(rarity) {
  return RARITY_HOLO_MAP[rarity] || 'common'
}

export function rollHoloType(rarity, ctx = null) {
  if (ctx) return rollHoloTypeFromContext(ctx, rarity)
  if (rarity === 'common') return null
  const types = ['holo', 'reverse', 'full']
  return types[Math.floor(Math.random() * types.length)]
}

function generateCard(rarity, ctx = null) {
  if (rarity === 'unique') rarity = 'mythic'
  const god = ctx && ctx.collectorBoost > 0 ? selectFromPool(ctx, GODS, 'slug') : GODS[Math.floor(Math.random() * GODS.length)]
  const role = god.role || CLASS_ROLE[god.class] || 'mid'
  return {
    card_type: 'god',
    god_id: god.slug,
    god_name: god.name,
    god_class: god.class,
    role,
    rarity,
    serial_number: Math.floor(Math.random() * 9999) + 1,
    holo_effect: rollHoloEffect(rarity),
    holo_type: rollHoloType(rarity, ctx),
    image_url: getGodImageUrl(god),
    acquired_via: 'pack',
    card_data: {
      slug: god.slug,
      imageKey: god.imageKey,
      ability: god.ability,
    },
  }
}

function generateItemCard(rarity, ctx = null) {
  if (rarity === 'unique') rarity = 'mythic'
  const item = ctx && ctx.collectorBoost > 0 ? selectFromPool(ctx, ITEMS, 'id') : ITEMS[Math.floor(Math.random() * ITEMS.length)]
  return {
    card_type: 'item',
    god_id: `item-${item.id}`,
    god_name: item.name,
    god_class: item.category,
    role: null,
    rarity,
    serial_number: Math.floor(Math.random() * 9999) + 1,
    holo_effect: rollHoloEffect(rarity),
    holo_type: rollHoloType(rarity, ctx),
    image_url: getItemImageUrl(item),
    acquired_via: 'pack',
    card_data: {
      itemId: item.id,
      slug: item.slug,
      category: item.category,
      manaCost: item.manaCost,
      effects: item.effects,
      passive: item.passive,
    },
  }
}

function generateConsumableCard(rarity, ctx = null) {
  if (rarity === 'unique') rarity = 'mythic'
  const con = ctx && ctx.collectorBoost > 0 ? selectFromPool(ctx, CONSUMABLES, 'id') : CONSUMABLES[Math.floor(Math.random() * CONSUMABLES.length)]
  return {
    card_type: 'consumable',
    god_id: `consumable-${con.id}`,
    god_name: con.name,
    god_class: 'Consumable',
    role: null,
    rarity,
    serial_number: Math.floor(Math.random() * 9999) + 1,
    holo_effect: rollHoloEffect(rarity),
    holo_type: rollHoloType(rarity, ctx),
    image_url: con.imageUrl,
    acquired_via: 'pack',
    card_data: {
      consumableId: con.id,
      color: con.color,
      icon: con.icon,
      description: con.description,
      manaCost: con.manaCost,
      uses: con.uses,
    },
  }
}

async function generatePlayerCard(sql, rarity, leagueId, ctx = null) {
  // Try to use definitions first (preferred path)
  const defs = leagueId
    ? await sql`SELECT * FROM cc_player_defs WHERE league_id = ${leagueId} ORDER BY RANDOM() LIMIT 1`
    : await sql`SELECT * FROM cc_player_defs ORDER BY RANDOM() LIMIT 1`

  const def = defs[0]
  if (!def) {
    // Fallback: no defs generated yet, pick random league_player
    return generatePlayerCardLegacy(sql, rarity, leagueId)
  }

  // Unique rarity: only one unique card per def can exist globally
  if (rarity === 'unique') {
    const [existing] = await sql`SELECT 1 FROM cc_cards WHERE def_id = ${def.id} AND rarity = 'unique' LIMIT 1`
    if (existing) rarity = 'mythic'
  }

  // Get stats (frozen or live)
  const stats = def.frozen_stats || await computePlayerStats(sql, def.player_id, def.team_id, def.season_id)
  const role = (def.role || 'adc').toUpperCase()

  // Avatar: check current preference (def.avatar_url may be stale)
  let avatarUrl = null
  const [prefRow] = await sql`
    SELECT u.discord_id, u.discord_avatar,
           COALESCE(up.allow_discord_avatar, true) AS allow_avatar
    FROM users u
    LEFT JOIN user_preferences up ON up.user_id = u.id
    WHERE u.linked_player_id = ${def.player_id}
  `
  if (prefRow?.allow_avatar && prefRow.discord_id && prefRow.discord_avatar) {
    avatarUrl = `https://cdn.discordapp.com/avatars/${prefRow.discord_id}/${prefRow.discord_avatar}.webp?size=256`
  }

  return {
    card_type: 'player',
    god_id: `player-${def.player_id}-t${def.team_id}`,
    god_name: def.player_name,
    god_class: role,
    role: role.toLowerCase(),
    rarity,
    serial_number: Math.floor(Math.random() * 9999) + 1,
    holo_effect: rollHoloEffect(rarity),
    holo_type: rollHoloType(rarity, ctx),
    image_url: avatarUrl || '',
    acquired_via: 'pack',
    def_id: def.id,
    card_data: {
      defId: def.id,
      playerId: def.player_id,
      teamName: def.team_name,
      teamColor: def.team_color || '#6366f1',
      seasonName: def.season_slug,
      leagueName: def.league_slug,
      divisionName: def.division_slug,
      role,
      stats,
      bestGod: stats.bestGod,
      isConnected: !!prefRow,
    },
  }
}

// Legacy fallback when no cc_player_defs exist yet (unique not supported — no def_id)
async function generatePlayerCardLegacy(sql, rarity, leagueId) {
  if (rarity === 'unique') rarity = 'mythic'
  const players = leagueId
    ? await sql`
      SELECT lp.id as lp_id, lp.team_id, p.id, p.name, p.main_role,
             t.name as team_name, t.color as team_color,
             s.name as season_name, l.name as league_name, d.name as division_name,
             u.discord_id, u.discord_avatar
      FROM league_players lp
      JOIN players p ON p.id = lp.player_id
      JOIN seasons s ON lp.season_id = s.id AND s.league_id = ${leagueId}
      JOIN divisions d ON s.division_id = d.id
      JOIN leagues l ON s.league_id = l.id
      LEFT JOIN teams t ON t.id = lp.team_id
      LEFT JOIN LATERAL (
        SELECT lu.id, lu.discord_id, lu.discord_avatar
        FROM users lu WHERE lu.linked_player_id = p.id LIMIT 1
      ) u ON true
      WHERE lp.team_id IS NOT NULL
      ORDER BY RANDOM() LIMIT 1
    `
    : await sql`
      SELECT lp.id as lp_id, lp.team_id, p.id, p.name, p.main_role,
             t.name as team_name, t.color as team_color,
             s.name as season_name, l.name as league_name, d.name as division_name,
             u.discord_id, u.discord_avatar
      FROM league_players lp
      JOIN players p ON p.id = lp.player_id
      JOIN seasons s ON lp.season_id = s.id
      JOIN divisions d ON s.division_id = d.id
      JOIN leagues l ON s.league_id = l.id
      LEFT JOIN teams t ON t.id = lp.team_id
      LEFT JOIN LATERAL (
        SELECT lu.id, lu.discord_id, lu.discord_avatar
        FROM users lu WHERE lu.linked_player_id = p.id LIMIT 1
      ) u ON true
      WHERE lp.team_id IS NOT NULL
      ORDER BY RANDOM() LIMIT 1
    `
  const player = players[0]
  if (!player) return generateCard(rarity)

  const [stats] = await sql`
    SELECT COUNT(*)::int as games_played,
           COUNT(*) FILTER (WHERE g.winner_team_id = ${player.team_id})::int as wins,
           COALESCE(SUM(pgs.kills), 0)::int as total_kills,
           COALESCE(SUM(pgs.deaths), 0)::int as total_deaths,
           COALESCE(SUM(pgs.assists), 0)::int as total_assists,
           COALESCE(AVG(pgs.damage), 0)::int as avg_damage,
           COALESCE(AVG(pgs.mitigated), 0)::int as avg_mitigated
    FROM player_game_stats pgs
    JOIN games g ON g.id = pgs.game_id
    WHERE pgs.league_player_id = ${player.lp_id}
  `

  const bestGods = await sql`
    SELECT god_played, COUNT(*)::int as games,
           COUNT(*) FILTER (WHERE g.winner_team_id = ${player.team_id})::int as wins
    FROM player_game_stats pgs JOIN games g ON g.id = pgs.game_id
    WHERE pgs.league_player_id = ${player.lp_id} AND pgs.god_played IS NOT NULL
    GROUP BY god_played ORDER BY games DESC, god_played ASC LIMIT 1
  `

  let avatarUrl = null
  if (player.discord_id && player.discord_avatar) {
    const [pref] = await sql`
      SELECT COALESCE(up.allow_discord_avatar, true) AS allow_avatar
      FROM users u
      LEFT JOIN user_preferences up ON up.user_id = u.id
      WHERE u.linked_player_id = ${player.id}
    `
    if (pref?.allow_avatar !== false) {
      avatarUrl = `https://cdn.discordapp.com/avatars/${player.discord_id}/${player.discord_avatar}.webp?size=256`
    }
  }

  const gp = stats?.games_played || 0, w = stats?.wins || 0
  const k = stats?.total_kills || 0, d = stats?.total_deaths || 0, a = stats?.total_assists || 0
  const role = (player.main_role || 'adc').toUpperCase()

  let bestGodData = null
  if (bestGods[0]) {
    const bg = bestGods[0]
    const slug = bg.god_played.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
    bestGodData = {
      name: bg.god_played,
      imageUrl: `https://smitebrain.com/cdn-cgi/image/width=80,height=80,f=auto,fit=cover/https://images.smitebrain.com/images/gods/icons/${slug}`,
      games: bg.games,
      winRate: bg.games > 0 ? Math.round((bg.wins / bg.games) * 1000) / 10 : 0,
    }
  }

  return {
    card_type: 'player',
    god_id: `player-${player.id}`,
    god_name: player.name,
    god_class: role,
    role: role.toLowerCase(),
    rarity,
    serial_number: Math.floor(Math.random() * 9999) + 1,
    holo_effect: rollHoloEffect(rarity),
    holo_type: rollHoloType(rarity),
    image_url: avatarUrl || '',
    acquired_via: 'pack',
    card_data: {
      playerId: player.id,
      teamName: player.team_name,
      teamColor: player.team_color || '#6366f1',
      seasonName: player.season_name,
      leagueName: player.league_name,
      divisionName: player.division_name,
      role,
      isConnected: !!player.discord_id,
      stats: {
        gamesPlayed: gp, wins: w,
        winRate: gp > 0 ? Math.round((w / gp) * 1000) / 10 : 0,
        kda: d > 0 ? Math.round(((k + a / 2) / d) * 10) / 10 : k + a / 2,
        avgDamage: stats?.avg_damage || 0, avgMitigated: stats?.avg_mitigated || 0,
        totalKills: k, totalDeaths: d, totalAssists: a,
      },
      bestGod: bestGodData,
    },
  }
}

async function generatePlayerCardByDivisions(sql, rarity, divisionIds, ctx = null) {
  if (!divisionIds?.length) {
    return generatePlayerCard(sql, rarity, null, ctx)
  }
  const defs = await sql`
    SELECT * FROM cc_player_defs WHERE division_id = ANY(${divisionIds}) ORDER BY RANDOM() LIMIT 1
  `
  if (!defs[0]) {
    return generatePlayerCard(sql, rarity, null, ctx)
  }

  const def = defs[0]

  // Unique rarity: only one unique card per def can exist globally
  if (rarity === 'unique') {
    const [existing] = await sql`SELECT 1 FROM cc_cards WHERE def_id = ${def.id} AND rarity = 'unique' LIMIT 1`
    if (existing) rarity = 'mythic'
  }

  const stats = def.frozen_stats || await computePlayerStats(sql, def.player_id, def.team_id, def.season_id)
  const role = (def.role || 'adc').toUpperCase()

  let avatarUrl = null
  const [prefRow] = await sql`
    SELECT u.discord_id, u.discord_avatar,
           COALESCE(up.allow_discord_avatar, true) AS allow_avatar
    FROM users u
    LEFT JOIN user_preferences up ON up.user_id = u.id
    WHERE u.linked_player_id = ${def.player_id}
  `
  if (prefRow?.allow_avatar && prefRow.discord_id && prefRow.discord_avatar) {
    avatarUrl = `https://cdn.discordapp.com/avatars/${prefRow.discord_id}/${prefRow.discord_avatar}.webp?size=256`
  }

  return {
    card_type: 'player',
    god_id: `player-${def.player_id}-t${def.team_id}`,
    god_name: def.player_name,
    god_class: role,
    role: role.toLowerCase(),
    rarity,
    serial_number: Math.floor(Math.random() * 9999) + 1,
    holo_effect: rollHoloEffect(rarity),
    holo_type: rollHoloType(rarity, ctx),
    image_url: avatarUrl || '',
    acquired_via: 'pack',
    def_id: def.id,
    card_data: {
      defId: def.id,
      playerId: def.player_id,
      teamName: def.team_name,
      teamColor: def.team_color || '#6366f1',
      seasonName: def.season_slug,
      leagueName: def.league_slug,
      divisionName: def.division_slug,
      role,
      stats,
      bestGod: stats.bestGod,
      isConnected: !!prefRow,
    },
  }
}

async function generateCardByType(type, rarity, ctx = null, sql = null) {
  switch (type) {
    case 'item': return generateItemCard(rarity, ctx)
    case 'consumable': return generateConsumableCard(rarity, ctx)
    case 'staff': return sql ? generateStaffCard(sql, rarity, ctx) : generateCard(rarity, ctx)
    default: return generateCard(rarity, ctx)
  }
}

// ════════════════════════════════════════════
// Ensure stats row exists
// ════════════════════════════════════════════
export async function ensureStats(sql, userId) {
  await sql`INSERT INTO cc_stats (user_id) VALUES (${userId}) ON CONFLICT (user_id) DO NOTHING`
}

// ════════════════════════════════════════════
// Grant starter packs (2 OSL + 2 BSL) on first visit
// ════════════════════════════════════════════
export async function grantStarterPacks(sql, userId) {
  const [stats] = await sql`
    SELECT starter_packs_granted FROM cc_stats WHERE user_id = ${userId}
  `
  if (stats?.starter_packs_granted) return
  const packs = ['osl-mixed', 'osl-mixed', 'bsl-mixed', 'bsl-mixed']
  for (const packType of packs) {
    await sql`
      INSERT INTO cc_pack_inventory (user_id, pack_type_id, source)
      VALUES (${userId}, ${packType}, 'starter')
    `
  }
  await sql`UPDATE cc_stats SET starter_packs_granted = true WHERE user_id = ${userId}`
}

// ════════════════════════════════════════════
// Open a pack
// ════════════════════════════════════════════
export async function openPack(sql, userId, packType, { skipPayment = false, skipEnabledCheck = false, passive = null } = {}) {
  const [pack] = (skipPayment || skipEnabledCheck)
    ? await sql`SELECT * FROM cc_pack_types WHERE id = ${packType}`
    : await sql`SELECT * FROM cc_pack_types WHERE id = ${packType} AND enabled = true`
  if (!pack) throw new Error('Invalid pack type')

  if (!skipPayment && pack.cost > 0) {
    const [bal] = await sql`SELECT balance FROM ember_balances WHERE user_id = ${userId}`
    if (!bal || bal.balance < pack.cost) throw new Error('Not enough Ember')
    await grantEmber(sql, userId, 'cc_pack', -pack.cost, `Card Clash: ${pack.name}`)
  }

  // Build odds context
  let ctx = createOddsContext()
  ctx = applyPackOverrides(ctx, pack.odds_config)
  if (passive) {
    const { applyPassiveToContext } = await import('./passives.js')
    ctx = applyPassiveToContext(ctx, passive.passiveName, passive.staffRarity, passive)
  }

  // Load owned card def IDs for Collector Boost
  if (ctx.collectorBoost > 0) {
    const owned = await sql`SELECT DISTINCT def_id FROM cc_cards WHERE owner_id = ${userId} AND def_id IS NOT NULL`
    ctx.ownedDefIds = new Set(owned.map(r => r.def_id))
  }

  let cards
  if (pack.slots && pack.slots.length > 0) {
    cards = await generateConfiguredPack(sql, pack, ctx)
  } else if (pack.category === 'mixed') {
    cards = await generateMixedPack(sql, pack.league_id, ctx)
  } else {
    cards = generateRarityPack({ cards: pack.cards_per_pack, guarantees: pack.guarantees || [] }, ctx)
  }

  // Load staff passive IDs for random assignment to staff cards
  const hasStaff = cards.some(c => c.card_type === 'staff')
  let staffPassiveIds = []
  let staffPassiveMap = {}
  if (hasStaff) {
    const passives = await sql`SELECT id, name FROM cc_staff_passives`
    staffPassiveIds = passives.map(r => r.id)
    staffPassiveMap = Object.fromEntries(passives.map(r => [r.id, r.name]))
  }

  const newCards = []
  for (const card of cards) {
    // Atomic first-edition check + insert in a single statement to minimize race window.
    // First edition = first-ever pull of this player def_id at this rarity (only when Vault is public).
    const checkFE = process.env.VAULT_OPEN === 'true' && (
      (card.card_type === 'player' && !!card.def_id) ||
      (!!card.blueprint_id)
    )

    const passiveId = card.card_type === 'staff' && staffPassiveIds.length > 0
      ? staffPassiveIds[Math.floor(Math.random() * staffPassiveIds.length)]
      : null

    const [inserted] = await sql`
      INSERT INTO cc_cards (owner_id, original_owner_id, god_id, god_name, god_class, role, rarity, serial_number, holo_effect, holo_type, image_url, acquired_via, card_type, card_data, def_id, blueprint_id, is_first_edition, depicted_user_id, passive_id)
      SELECT ${userId}, ${userId}, ${card.god_id}, ${card.god_name}, ${card.god_class}, ${card.role}, ${card.rarity},
             ${card.serial_number}, ${card.holo_effect}, ${card.holo_type}, ${card.image_url},
             ${card.acquired_via}, ${card.card_type}, ${card.card_data ? JSON.stringify(card.card_data) : null}::jsonb,
             ${card.def_id || null},
             ${card.blueprint_id || null},
             ${checkFE}::boolean AND NOT EXISTS (
               SELECT 1 FROM cc_cards
               WHERE rarity = ${card.rarity}
                 AND (
                   (${card.blueprint_id || null}::int IS NOT NULL AND blueprint_id = ${card.blueprint_id || 0})
                   OR (${card.blueprint_id || null}::int IS NULL AND def_id = ${card.def_id || 0})
                 )
             ),
             ${card.depicted_user_id || null},
             ${passiveId}
      RETURNING *
    `
    if (card._revealOrder != null) inserted._revealOrder = card._revealOrder
    if (inserted.passive_id) inserted.passive_name = staffPassiveMap[inserted.passive_id] || null
    newCards.push(inserted)
  }

  await ensureStats(sql, userId)
  await sql`UPDATE cc_stats SET packs_opened = packs_opened + 1 WHERE user_id = ${userId}`
  const cardIds = newCards.map(c => c.id)
  const [packOpen] = await sql`
    INSERT INTO cc_pack_opens (user_id, pack_type_id, card_ids)
    VALUES (${userId}, ${pack.id}, ${JSON.stringify(cardIds)}::jsonb)
    RETURNING id
  `

  return { packName: pack.name, cards: newCards, packOpenId: packOpen.id }
}

export async function generateCardForReroll(sql, userId, oldRarity, ctx, { lockRarity = false } = {}) {
  const rarity = lockRarity ? oldRarity : rollRarity(oldRarity, ctx)

  // Unique rerolls must pull from available unique player defs
  if (rarity === 'unique') {
    const playerCard = await generateUniquePlayerForReroll(sql, rarity, ctx)
    if (playerCard) {
      const [inserted] = await sql`
        INSERT INTO cc_cards (owner_id, original_owner_id, god_id, god_name, god_class, role, rarity,
          serial_number, holo_effect, holo_type, image_url, acquired_via, card_type, card_data, def_id)
        VALUES (${userId}, ${userId}, ${playerCard.god_id}, ${playerCard.god_name}, ${playerCard.god_class}, ${playerCard.role},
          ${playerCard.rarity}, ${playerCard.serial_number}, ${playerCard.holo_effect}, ${playerCard.holo_type}, ${playerCard.image_url},
          'reroll', ${playerCard.card_type}, ${playerCard.card_data ? JSON.stringify(playerCard.card_data) : null}::jsonb,
          ${playerCard.def_id || null})
        RETURNING *
      `
      return inserted
    }
    // No available unique defs — fall through to mythic
  }

  const card = generateCard(rarity, ctx)
  card.holo_type = rollHoloType(rarity, ctx)

  const [inserted] = await sql`
    INSERT INTO cc_cards (owner_id, original_owner_id, god_id, god_name, god_class, role, rarity,
      serial_number, holo_effect, holo_type, image_url, acquired_via, card_type, card_data)
    VALUES (${userId}, ${userId}, ${card.god_id}, ${card.god_name}, ${card.god_class}, ${card.role},
      ${card.rarity}, ${card.serial_number}, ${card.holo_effect}, ${card.holo_type}, ${card.image_url},
      'reroll', ${card.card_type}, ${card.card_data ? JSON.stringify(card.card_data) : null}::jsonb)
    RETURNING *
  `
  return inserted
}

// Pick a player def that doesn't already have a unique card globally
async function generateUniquePlayerForReroll(sql, rarity, ctx) {
  const defs = await sql`
    SELECT pd.* FROM cc_player_defs pd
    WHERE pd.id NOT IN (
      SELECT DISTINCT def_id FROM cc_cards WHERE rarity = 'unique' AND def_id IS NOT NULL
    )
    ORDER BY RANDOM() LIMIT 1
  `
  if (defs.length === 0) return null

  const def = defs[0]
  const stats = def.frozen_stats || {}
  const role = (def.role || 'adc').toUpperCase()

  return {
    card_type: 'player',
    god_id: `player-${def.player_id}`,
    god_name: def.player_name || 'Unknown',
    god_class: def.team_name || '',
    role,
    rarity: 'unique',
    serial_number: Math.floor(Math.random() * 9999) + 1,
    holo_effect: rollHoloEffect('unique'),
    holo_type: rollHoloType('unique', ctx),
    image_url: def.avatar_url || '',
    def_id: def.id,
    card_data: {
      teamName: def.team_name,
      teamColor: def.team_color || '#6366f1',
      leagueName: def.league_name || '',
      divisionName: def.division_name || '',
      seasonName: def.season_name || '',
      stats,
    },
  }
}

function normalizeGuarantees(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  // Object format {"rare": 1, "epic": 2} → [{minRarity, count}]
  return Object.entries(raw).map(([minRarity, count]) => ({ minRarity, count }))
}

function generateRarityPack(pack, ctx = null) {
  const cards = []
  const guarantees = normalizeGuarantees(pack.guarantees)
  for (const g of guarantees) {
    for (let i = 0; i < g.count; i++) {
      cards.push(generateCard(rollRarity(g.minRarity, ctx), ctx))
    }
  }
  while (cards.length < pack.cards) {
    cards.push(generateCard(rollRarity('common', ctx), ctx))
  }
  return cards
}

async function generateMixedPack(sql, leagueId, ctx = null) {
  const nonPlayerTypes = ['god', 'item', 'consumable']
  const playerSlot = Math.floor(Math.random() * 5)

  // Distribute non-player slot types proportionally by card pool size
  const nonPlayerSlotCount = 4 // slots 0-4 minus playerSlot
  const typeAssignments = distributeTypesByPool(nonPlayerTypes, nonPlayerSlotCount, STATIC_POOL_SIZES)
  // Wildcard slot (5) also weighted by pool size (including player)
  const wildcardTypes = ['god', 'item', 'consumable', 'player']

  let typeIdx = 0
  const cards = []
  for (let i = 0; i < 6; i++) {
    const minRarity = i === 4 ? 'uncommon' : 'common'
    const rarity = rollRarity(minRarity, ctx)

    let type
    if (i === playerSlot) {
      type = 'player'
    } else if (i === 5) {
      type = pickWeightedType(wildcardTypes)
    } else {
      type = typeAssignments[typeIdx++]
    }

    const card = type === 'player'
      ? await generatePlayerCard(sql, rarity, leagueId, ctx)
      : await generateCardByType(type, rarity, ctx)
    card._revealOrder = i
    cards.push(card)
  }

  return cards
}

function pickWeightedType(types) {
  const weights = types.map(t => STATIC_POOL_SIZES[t] || 10)
  const total = weights.reduce((a, b) => a + b, 0)
  let roll = Math.random() * total
  for (let i = 0; i < types.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return types[i]
  }
  return types[types.length - 1]
}

const STATIC_POOL_SIZES = { god: GODS.length, item: ITEMS.length, consumable: CONSUMABLES.length, collection: 10 }

function pickTypeForSlot(slot) {
  const types = slot.types || ['god']
  if (types.length === 1) return types[0]
  // Use explicit typeWeights if provided, otherwise weight by pool size
  const weights = (slot.typeWeights && Object.keys(slot.typeWeights).length > 0)
    ? types.map(t => slot.typeWeights[t] || 0)
    : types.map(t => STATIC_POOL_SIZES[t] || 10)
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  let roll = Math.random() * totalWeight
  for (let i = 0; i < types.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return types[i]
  }
  return types[types.length - 1]
}

// Proportionally distribute types across N slots based on pool sizes.
// Guarantees at least 1 of each type when slots >= types, with remainder
// allocated randomly weighted by fractional share.
function distributeTypesByPool(types, count, poolSizes) {
  if (count === 0) return []
  const weights = types.map(t => poolSizes[t] || 1)
  const totalWeight = weights.reduce((a, b) => a + b, 0)

  // Floor allocation — each type gets at least its proportional floor
  const exact = weights.map(w => (w / totalWeight) * count)
  const allocation = exact.map(e => Math.floor(e))
  let remaining = count - allocation.reduce((a, b) => a + b, 0)

  // Distribute remaining slots randomly, weighted by fractional remainder
  const remainders = exact.map((e, i) => ({ i, frac: e - allocation[i] }))
  while (remaining > 0) {
    const totalFrac = remainders.reduce((sum, x) => sum + x.frac, 0)
    if (totalFrac <= 0) {
      // All equal — pick uniformly
      allocation[Math.floor(Math.random() * types.length)]++
    } else {
      let roll = Math.random() * totalFrac
      for (const x of remainders) {
        if (x.frac <= 0) continue
        roll -= x.frac
        if (roll <= 0) { allocation[x.i]++; x.frac = 0; break }
      }
    }
    remaining--
  }

  // Build and shuffle assignments
  const assignments = []
  for (let i = 0; i < types.length; i++) {
    for (let j = 0; j < allocation[i]; j++) assignments.push(types[i])
  }
  for (let i = assignments.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[assignments[i], assignments[j]] = [assignments[j], assignments[i]]
  }
  return assignments
}

async function generateConfiguredPack(sql, pack, ctx = null) {
  const slots = pack.slots || []
  const divisionIds = pack.division_ids || []
  const groupConstraints = pack.group_constraints || {}

  // Pre-assign forced types per slot based on group constraints
  const forcedTypes = new Array(slots.length).fill(null)

  for (const [groupName, constraints] of Object.entries(groupConstraints)) {
    // Find slot indices in this group
    const groupIndices = slots
      .map((s, i) => s.group === groupName ? i : -1)
      .filter(i => i >= 0)
    if (groupIndices.length === 0) continue

    // Track how many of each type we've assigned in this group
    const assigned = {}

    for (const constraint of constraints) {
      const { type, min } = constraint
      if (!min || min <= 0) continue

      // Find eligible slots (type is in their allowed types, not already forced)
      const eligible = groupIndices.filter(i =>
        !forcedTypes[i] && (slots[i].types || []).includes(type)
      )

      // Randomly pick `min` slots to force this type
      const shuffled = [...eligible].sort(() => Math.random() - 0.5)
      const toAssign = Math.min(min, shuffled.length)
      for (let j = 0; j < toAssign; j++) {
        forcedTypes[shuffled[j]] = type
        assigned[type] = (assigned[type] || 0) + 1
      }
    }

    // For remaining unforced slots in this group, respect max constraints
    for (const idx of groupIndices) {
      if (forcedTypes[idx]) continue
      const slot = slots[idx]
      // Filter out types that have hit their max
      let allowedTypes = (slot.types || ['god']).filter(t => {
        const constraint = constraints.find(c => c.type === t)
        if (!constraint?.max) return true
        return (assigned[t] || 0) < constraint.max
      })
      if (allowedTypes.length === 0) allowedTypes = (slot.types || ['god']).filter(t => t !== 'player')
      if (allowedTypes.length === 0) allowedTypes = ['god']
      const picked = pickWeightedType(allowedTypes)
      forcedTypes[idx] = picked
      assigned[picked] = (assigned[picked] || 0) + 1
    }
  }

  // Pre-distribute types for weightByCardCount slots (proportional to pool sizes)
  const wcIndices = []
  for (let i = 0; i < slots.length; i++) {
    if (!forcedTypes[i] && slots[i].weightByCardCount) wcIndices.push(i)
  }
  if (wcIndices.length > 0) {
    // Query player pool size if any slot includes player type
    let playerCount = 0
    if (wcIndices.some(i => (slots[i].types || []).includes('player'))) {
      const q = divisionIds.length > 0
        ? await sql`SELECT COUNT(DISTINCT lp.id)::int AS cnt FROM league_players lp JOIN seasons s ON s.id = lp.season_id WHERE s.division_id = ANY(${divisionIds})`
        : pack.league_id
          ? await sql`SELECT COUNT(DISTINCT lp.id)::int AS cnt FROM league_players lp JOIN seasons s ON s.id = lp.season_id JOIN divisions d ON d.id = s.division_id WHERE d.league_id = ${pack.league_id}`
          : await sql`SELECT COUNT(DISTINCT id)::int AS cnt FROM league_players`
      playerCount = q[0]?.cnt || 1
    }
    const poolSizes = { ...STATIC_POOL_SIZES, player: playerCount || 1 }

    // Group slots by their type set for batch distribution
    const typeGroups = {}
    for (const idx of wcIndices) {
      const types = slots[idx].types || ['god']
      const key = [...types].sort().join(',')
      if (!typeGroups[key]) typeGroups[key] = { types, indices: [] }
      typeGroups[key].indices.push(idx)
    }

    for (const { types, indices } of Object.values(typeGroups)) {
      const assignments = distributeTypesByPool(types, indices.length, poolSizes)
      for (let k = 0; k < indices.length; k++) {
        forcedTypes[indices[k]] = assignments[k]
      }
    }
  }

  // Generate cards
  const cards = []
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]

    // Legacy: handle old-format collection-only slots
    if (slot.type === 'collection' && slot.collectionId) {
      const card = await generateCollectionCard(sql, [slot.collectionId])
      if (card) {
        card._revealOrder = i
        cards.push(card)
      }
      continue
    }

    const type = forcedTypes[i] || pickTypeForSlot(slot)
    const typeCtx = getContextForType(ctx, type)
    const rarity = rollRarityBounded(slot.minRarity || 'common', slot.maxRarity || null, typeCtx)

    let card
    if (type === 'collection') {
      card = await generateCollectionCard(sql, slot.collectionIds || [], rarity)
      if (!card) card = await generateCardByType('god', rarity, typeCtx, sql)
    } else if (type === 'player') {
      card = divisionIds.length > 0
        ? await generatePlayerCardByDivisions(sql, rarity, divisionIds, typeCtx)
        : await generatePlayerCard(sql, rarity, pack.league_id, typeCtx)
    } else {
      card = await generateCardByType(type, rarity, typeCtx, sql)
    }
    card._revealOrder = i
    cards.push(card)
  }

  return cards
}

async function generateCollectionCard(sql, collectionIds, rarityOverride) {
  if (!collectionIds || collectionIds.length === 0) return null

  const entries = await sql`
    SELECT bp.id, bp.name, bp.card_type, bp.depicted_user_id, bp.template_data, e.collection_id
    FROM cc_collection_entries e
    JOIN cc_card_blueprints bp ON e.blueprint_id = bp.id AND bp.status = 'approved'
    JOIN cc_collections c ON e.collection_id = c.id
    WHERE e.collection_id = ANY(${collectionIds})
      AND c.status = 'active'
  `
  if (entries.length === 0) return null

  const blueprint = entries[Math.floor(Math.random() * entries.length)]
  // Resolve display name from template_data (cardData.name or name-banner element)
  const td = typeof blueprint.template_data === 'string' ? JSON.parse(blueprint.template_data) : blueprint.template_data
  const displayName = td?.cardData?.name
    || td?.elements?.find(el => el.type === 'name-banner')?.playerName
    || blueprint.name
  const rarity = rarityOverride || rollRarity('common')
  const holoEffect = rollHoloEffect(rarity)
  const holoType = rollHoloType(rarity)

  const [col] = await sql`SELECT name FROM cc_collections WHERE id = ${blueprint.collection_id}`

  return {
    god_id: `blueprint-${blueprint.id}`,
    god_name: displayName,
    god_class: blueprint.card_type || 'custom',
    role: blueprint.card_type || 'custom',
    rarity,
    serial_number: Math.floor(Math.random() * 9999) + 1,
    holo_effect: holoEffect,
    holo_type: holoType,
    image_url: null,
    acquired_via: 'pack',
    card_type: blueprint.card_type,
    card_data: { collectionId: blueprint.collection_id, collectionName: col?.name || 'Collection' },
    def_id: null,
    blueprint_id: blueprint.id,
    depicted_user_id: blueprint.depicted_user_id || null,
  }
}

async function generateStaffCard(sql, rarity, ctx = null) {
  const blueprints = await sql`
    SELECT id, name, card_type, depicted_user_id, template_data
    FROM cc_card_blueprints
    WHERE card_type = 'staff' AND status = 'approved'
  `
  if (blueprints.length === 0) return generateCard(rarity, ctx)

  const blueprint = ctx ? selectFromPool(ctx, blueprints) : blueprints[Math.floor(Math.random() * blueprints.length)]
  const td = typeof blueprint.template_data === 'string' ? JSON.parse(blueprint.template_data) : blueprint.template_data
  const displayName = td?.cardData?.name
    || td?.elements?.find(el => el.type === 'name-banner')?.playerName
    || blueprint.name
  const holoEffect = rollHoloEffect(rarity)
  const holoType = rollHoloType(rarity)

  return {
    god_id: `blueprint-${blueprint.id}`,
    god_name: displayName,
    god_class: 'staff',
    role: 'staff',
    rarity,
    serial_number: Math.floor(Math.random() * 9999) + 1,
    holo_effect: holoEffect,
    holo_type: holoType,
    image_url: null,
    acquired_via: 'pack',
    card_type: 'staff',
    card_data: {},
    def_id: null,
    blueprint_id: blueprint.id,
    depicted_user_id: blueprint.depicted_user_id || null,
  }
}

// Gift pack: 7 cards, both leagues
// Slot 0-3: god/item/consumable (common), one guaranteed player card
// Slot 4: guaranteed uncommon+ rarity upgrade
// Slot 5: wildcard (any type, weighted by pool size)
// Slot 6: wildcard (any type, weighted by pool size)
export async function generateGiftPack(sql) {
  const nonPlayerTypes = ['god', 'item', 'consumable']
  const wildcardTypes = ['god', 'item', 'consumable', 'player']
  const playerSlot = Math.floor(Math.random() * 4) // 0-3

  const cards = []
  for (let i = 0; i < 7; i++) {
    const minRarity = i === 4 ? 'uncommon' : 'common'
    const rarity = rollRarity(minRarity)

    let type
    if (i === playerSlot) {
      type = 'player'
    } else if (i >= 5) {
      type = pickWeightedType(wildcardTypes)
    } else {
      type = nonPlayerTypes[Math.floor(Math.random() * nonPlayerTypes.length)]
    }

    // No leagueId filter — pulls from both leagues
    const card = type === 'player'
      ? await generatePlayerCard(sql, rarity, null)
      : await generateCardByType(type, rarity)
    card.acquired_via = 'gift'
    card._revealOrder = i
    cards.push(card)
  }

  return cards
}

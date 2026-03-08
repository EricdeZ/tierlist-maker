// Server-side Card Clash logic: pack opening
import { grantEmber } from './ember.js'
import { GODS, ITEMS, CONSUMABLES, CLASS_ROLE, getGodImageUrl, getItemImageUrl } from './cardclash-data.js'

const RARITIES = {
  common:    { name: 'Common',    dropRate: 0.60, color: '#9ca3af', holoEffects: ['common'] },
  uncommon:  { name: 'Uncommon',  dropRate: 0.30, color: '#22c55e', holoEffects: ['holo', 'amazing', 'reverse'] },
  rare:      { name: 'Rare',      dropRate: 0.06, color: '#3b82f6', holoEffects: ['galaxy', 'vstar', 'shiny', 'ultra'] },
  epic:      { name: 'Epic',      dropRate: 0.025, color: '#a855f7', holoEffects: ['radiant', 'sparkle', 'rainbow-alt', 'cosmos'] },
  legendary: { name: 'Legendary', dropRate: 0.003, color: '#ff8c00', holoEffects: ['rainbow', 'secret', 'gold'] },
  mythic:    { name: 'Mythic',    dropRate: 0.0005, color: '#ef4444', holoEffects: ['rainbow', 'secret', 'gold', 'cosmos'] },
}

const PACKS = {
  standard:     { name: 'Standard Pack', cost: 10, cards: 3, guarantees: [{ minRarity: 'uncommon', count: 1 }] },
  premium:      { name: 'Premium Pack',  cost: 27, cards: 5, guarantees: [{ minRarity: 'rare', count: 1 }] },
  elite:        { name: 'Elite Pack',    cost: 65, cards: 5, guarantees: [{ minRarity: 'epic', count: 1 }, { minRarity: 'rare', count: 2 }] },
  legendary:    { name: 'Legendary Pack', cost: 200, cards: 7, guarantees: [{ minRarity: 'legendary', count: 1 }] },
  mixed:        { name: 'Mixed Pack',    cost: 20, cards: 6, guarantees: [] },
  'osl-mixed':  { name: 'OSL Pack',     cost: 20, cards: 6, guarantees: [], leagueId: 2 },
  'bsl-mixed':  { name: 'BSL Pack',     cost: 20, cards: 6, guarantees: [], leagueId: 3 },
}

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']

function rollRarity(minRarity = 'common') {
  const minIdx = RARITY_ORDER.indexOf(minRarity)
  const eligible = RARITY_ORDER.slice(minIdx)
  const totalWeight = eligible.reduce((sum, r) => sum + RARITIES[r].dropRate, 0)
  let roll = Math.random() * totalWeight
  for (const r of eligible) {
    roll -= RARITIES[r].dropRate
    if (roll <= 0) return r
  }
  return eligible[eligible.length - 1]
}

// Fixed holo effect per rarity — matches catalog
const RARITY_HOLO_MAP = {
  common: 'common', uncommon: 'holo', rare: 'galaxy',
  epic: 'cosmos', legendary: 'gold', mythic: 'rainbow',
}

function rollHoloEffect(rarity) {
  return RARITY_HOLO_MAP[rarity] || 'common'
}

function generateCard(rarity) {
  const god = GODS[Math.floor(Math.random() * GODS.length)]
  const role = CLASS_ROLE[god.class] || 'mid'
  return {
    card_type: 'god',
    god_id: god.slug,
    god_name: god.name,
    god_class: god.class,
    role,
    rarity,
    serial_number: Math.floor(Math.random() * 9999) + 1,
    holo_effect: rollHoloEffect(rarity),
    image_url: getGodImageUrl(god),
    acquired_via: 'pack',
    card_data: {
      slug: god.slug,
      imageKey: god.imageKey,
      ability: god.ability,
    },
  }
}

function generateItemCard(rarity) {
  const item = ITEMS[Math.floor(Math.random() * ITEMS.length)]
  return {
    card_type: 'item',
    god_id: `item-${item.id}`,
    god_name: item.name,
    god_class: item.category,
    role: null,
    rarity,
    serial_number: Math.floor(Math.random() * 9999) + 1,
    holo_effect: rollHoloEffect(rarity),
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

function generateConsumableCard(rarity) {
  const con = CONSUMABLES[Math.floor(Math.random() * CONSUMABLES.length)]
  return {
    card_type: 'consumable',
    god_id: `consumable-${con.id}`,
    god_name: con.name,
    god_class: 'Consumable',
    role: null,
    rarity,
    serial_number: Math.floor(Math.random() * 9999) + 1,
    holo_effect: rollHoloEffect(rarity),
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

async function generatePlayerCard(sql, rarity, leagueId) {
  // Pick a random player from the league with season/team context
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
      LEFT JOIN users u ON u.linked_player_id = p.id
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
      LEFT JOIN users u ON u.linked_player_id = p.id
      WHERE lp.team_id IS NOT NULL
      ORDER BY RANDOM() LIMIT 1
    `
  const player = players[0]
  if (!player) return generateCard(rarity)

  // Aggregate game stats for this player on this team
  const [stats] = await sql`
    SELECT
      COUNT(*)::int as games_played,
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

  // Find best god (most played)
  const bestGods = await sql`
    SELECT god_played, COUNT(*)::int as games,
           COUNT(*) FILTER (WHERE g.winner_team_id = ${player.team_id})::int as wins
    FROM player_game_stats pgs
    JOIN games g ON g.id = pgs.game_id
    WHERE pgs.league_player_id = ${player.lp_id}
      AND pgs.god_played IS NOT NULL
    GROUP BY god_played
    ORDER BY games DESC
    LIMIT 1
  `
  const bestGod = bestGods[0]

  let avatarUrl = null
  if (player.discord_id && player.discord_avatar) {
    avatarUrl = `https://cdn.discordapp.com/avatars/${player.discord_id}/${player.discord_avatar}.webp?size=256`
  } else if (bestGod) {
    const slug = bestGod.god_played.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
    avatarUrl = `https://smitebrain.com/cdn-cgi/image/width=256,height=256,f=auto,fit=cover/https://images.smitebrain.com/images/gods/icons/${slug}`
  }

  const gp = stats?.games_played || 0
  const w = stats?.wins || 0
  const k = stats?.total_kills || 0
  const d = stats?.total_deaths || 0
  const a = stats?.total_assists || 0
  const role = (player.main_role || 'adc').toUpperCase()

  let bestGodData = null
  if (bestGod) {
    const slug = bestGod.god_played.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
    bestGodData = {
      name: bestGod.god_played,
      imageUrl: `https://smitebrain.com/cdn-cgi/image/width=80,height=80,f=auto,fit=cover/https://images.smitebrain.com/images/gods/icons/${slug}`,
      games: bestGod.games,
      winRate: bestGod.games > 0 ? Math.round((bestGod.wins / bestGod.games) * 1000) / 10 : 0,
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
      stats: {
        gamesPlayed: gp,
        wins: w,
        winRate: gp > 0 ? Math.round((w / gp) * 1000) / 10 : 0,
        kda: d > 0 ? Math.round(((k + a / 2) / d) * 10) / 10 : k + a / 2,
        avgDamage: stats?.avg_damage || 0,
        avgMitigated: stats?.avg_mitigated || 0,
        totalKills: k,
        totalDeaths: d,
        totalAssists: a,
      },
      bestGod: bestGodData,
    },
  }
}

function generateCardByType(type, rarity) {
  switch (type) {
    case 'item': return generateItemCard(rarity)
    case 'consumable': return generateConsumableCard(rarity)
    default: return generateCard(rarity)
  }
}

// ════════════════════════════════════════════
// Ensure stats row exists
// ════════════════════════════════════════════
export async function ensureStats(sql, userId) {
  await sql`INSERT INTO cc_stats (user_id) VALUES (${userId}) ON CONFLICT (user_id) DO NOTHING`
}

// ════════════════════════════════════════════
// Open a pack
// ════════════════════════════════════════════
export async function openPack(sql, userId, packType, testMode) {
  const pack = PACKS[packType]
  if (!pack) throw new Error('Invalid pack type')

  if (!testMode && pack.cost > 0) {
    const [bal] = await sql`SELECT balance FROM ember_balances WHERE user_id = ${userId}`
    if (!bal || bal.balance < pack.cost) throw new Error('Not enough Ember')
    await grantEmber(sql, userId, 'cc_pack', -pack.cost, `Card Clash: ${pack.name}`)
  }

  let cards
  if (packType === 'mixed' || pack.leagueId) {
    cards = await generateMixedPack(sql, pack.leagueId)
  } else {
    cards = generateRarityPack(pack)
  }

  const newCards = []
  for (const card of cards) {
    const [inserted] = await sql`
      INSERT INTO cc_cards (owner_id, god_id, god_name, god_class, role, rarity, serial_number, holo_effect, image_url, acquired_via, card_type, card_data)
      VALUES (${userId}, ${card.god_id}, ${card.god_name}, ${card.god_class}, ${card.role}, ${card.rarity}, ${card.serial_number}, ${card.holo_effect}, ${card.image_url}, ${card.acquired_via}, ${card.card_type}, ${card.card_data ? JSON.stringify(card.card_data) : null})
      RETURNING *
    `
    if (card._revealOrder != null) inserted._revealOrder = card._revealOrder
    newCards.push(inserted)
  }

  await ensureStats(sql, userId)
  await sql`UPDATE cc_stats SET packs_opened = packs_opened + 1 WHERE user_id = ${userId}`

  return { packName: pack.name, cards: newCards }
}

function generateRarityPack(pack) {
  const cards = []
  const guarantees = [...pack.guarantees]
  for (const g of guarantees) {
    for (let i = 0; i < g.count; i++) {
      cards.push(generateCard(rollRarity(g.minRarity)))
    }
  }
  while (cards.length < pack.cards) {
    cards.push(generateCard(rollRarity('common')))
  }
  return cards
}

async function generateMixedPack(sql, leagueId) {
  const allTypes = ['god', 'item', 'consumable', 'player']
  const nonPlayerTypes = ['god', 'item', 'consumable']
  const playerSlot = Math.floor(Math.random() * 5)

  const cards = []
  for (let i = 0; i < 6; i++) {
    const minRarity = i === 4 ? 'uncommon' : 'common'
    const rarity = rollRarity(minRarity)

    let type
    if (i === playerSlot) {
      type = 'player'
    } else if (i === 5) {
      type = allTypes[Math.floor(Math.random() * allTypes.length)]
    } else {
      type = nonPlayerTypes[Math.floor(Math.random() * nonPlayerTypes.length)]
    }

    const card = type === 'player'
      ? await generatePlayerCard(sql, rarity, leagueId)
      : generateCardByType(type, rarity)
    card._revealOrder = i
    cards.push(card)
  }

  return cards
}

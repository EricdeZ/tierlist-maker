// Server-side Card Clash logic: pack opening, income, battle rewards
import { grantPassion } from './passion.js'

// Compact god list for server-side card generation (77 gods)
const GODS = [
  { id: 'achilles', name: 'Achilles', class: 'Warrior' },
  { id: 'agni', name: 'Agni', class: 'Mage' },
  { id: 'ah-muzen-cab', name: 'Ah Muzen Cab', class: 'Hunter' },
  { id: 'ah-puch', name: 'Ah Puch', class: 'Mage' },
  { id: 'amaterasu', name: 'Amaterasu', class: 'Warrior' },
  { id: 'anhur', name: 'Anhur', class: 'Hunter' },
  { id: 'anubis', name: 'Anubis', class: 'Mage' },
  { id: 'ao-kuang', name: 'Ao Kuang', class: 'Mage' },
  { id: 'aphrodite', name: 'Aphrodite', class: 'Mage' },
  { id: 'ares', name: 'Ares', class: 'Guardian' },
  { id: 'artemis', name: 'Artemis', class: 'Hunter' },
  { id: 'athena', name: 'Athena', class: 'Guardian' },
  { id: 'awilix', name: 'Awilix', class: 'Assassin' },
  { id: 'bacchus', name: 'Bacchus', class: 'Guardian' },
  { id: 'bakasura', name: 'Bakasura', class: 'Assassin' },
  { id: 'baron-samedi', name: 'Baron Samedi', class: 'Mage' },
  { id: 'bellona', name: 'Bellona', class: 'Warrior' },
  { id: 'cabrakan', name: 'Cabrakan', class: 'Guardian' },
  { id: 'cerberus', name: 'Cerberus', class: 'Guardian' },
  { id: 'cernunnos', name: 'Cernunnos', class: 'Hunter' },
  { id: 'chaac', name: 'Chaac', class: 'Warrior' },
  { id: 'chang-e', name: "Chang'e", class: 'Mage' },
  { id: 'chronos', name: 'Chronos', class: 'Mage' },
  { id: 'cu-chulainn', name: 'Cu Chulainn', class: 'Warrior' },
  { id: 'cupid', name: 'Cupid', class: 'Hunter' },
  { id: 'da-ji', name: 'Da Ji', class: 'Assassin' },
  { id: 'discordia', name: 'Discordia', class: 'Mage' },
  { id: 'erlang-shen', name: 'Erlang Shen', class: 'Warrior' },
  { id: 'fafnir', name: 'Fafnir', class: 'Guardian' },
  { id: 'fenrir', name: 'Fenrir', class: 'Assassin' },
  { id: 'freya', name: 'Freya', class: 'Mage' },
  { id: 'ganesha', name: 'Ganesha', class: 'Guardian' },
  { id: 'geb', name: 'Geb', class: 'Guardian' },
  { id: 'hades', name: 'Hades', class: 'Mage' },
  { id: 'he-bo', name: 'He Bo', class: 'Mage' },
  { id: 'hel', name: 'Hel', class: 'Mage' },
  { id: 'hercules', name: 'Hercules', class: 'Warrior' },
  { id: 'hou-yi', name: 'Hou Yi', class: 'Hunter' },
  { id: 'hun-batz', name: 'Hun Batz', class: 'Assassin' },
  { id: 'izanami', name: 'Izanami', class: 'Hunter' },
  { id: 'janus', name: 'Janus', class: 'Mage' },
  { id: 'jing-wei', name: 'Jing Wei', class: 'Hunter' },
  { id: 'kali', name: 'Kali', class: 'Assassin' },
  { id: 'khepri', name: 'Khepri', class: 'Guardian' },
  { id: 'kukulkan', name: 'Kukulkan', class: 'Mage' },
  { id: 'loki', name: 'Loki', class: 'Assassin' },
  { id: 'medusa', name: 'Medusa', class: 'Hunter' },
  { id: 'mercury', name: 'Mercury', class: 'Assassin' },
  { id: 'ne-zha', name: 'Ne Zha', class: 'Assassin' },
  { id: 'neith', name: 'Neith', class: 'Hunter' },
  { id: 'nemesis', name: 'Nemesis', class: 'Assassin' },
  { id: 'nike', name: 'Nike', class: 'Warrior' },
  { id: 'nox', name: 'Nox', class: 'Mage' },
  { id: 'nu-wa', name: 'Nu Wa', class: 'Mage' },
  { id: 'odin', name: 'Odin', class: 'Warrior' },
  { id: 'osiris', name: 'Osiris', class: 'Warrior' },
  { id: 'pele', name: 'Pele', class: 'Assassin' },
  { id: 'poseidon', name: 'Poseidon', class: 'Mage' },
  { id: 'ra', name: 'Ra', class: 'Mage' },
  { id: 'rama', name: 'Rama', class: 'Hunter' },
  { id: 'ravana', name: 'Ravana', class: 'Assassin' },
  { id: 'scylla', name: 'Scylla', class: 'Mage' },
  { id: 'serqet', name: 'Serqet', class: 'Assassin' },
  { id: 'sobek', name: 'Sobek', class: 'Guardian' },
  { id: 'sol', name: 'Sol', class: 'Mage' },
  { id: 'sun-wukong', name: 'Sun Wukong', class: 'Warrior' },
  { id: 'susano', name: 'Susano', class: 'Assassin' },
  { id: 'sylvanus', name: 'Sylvanus', class: 'Guardian' },
  { id: 'terra', name: 'Terra', class: 'Guardian' },
  { id: 'thanatos', name: 'Thanatos', class: 'Assassin' },
  { id: 'the-morrigan', name: 'The Morrigan', class: 'Mage' },
  { id: 'thor', name: 'Thor', class: 'Assassin' },
  { id: 'thoth', name: 'Thoth', class: 'Mage' },
  { id: 'tyr', name: 'Tyr', class: 'Warrior' },
  { id: 'vulcan', name: 'Vulcan', class: 'Mage' },
  { id: 'xbalanque', name: 'Xbalanque', class: 'Hunter' },
  { id: 'ymir', name: 'Ymir', class: 'Guardian' },
  { id: 'zeus', name: 'Zeus', class: 'Mage' },
]

const CLASS_ROLE = {
  Guardian: 'support', Warrior: 'solo', Assassin: 'jungle', Mage: 'mid', Hunter: 'adc',
}

const RARITIES = {
  common:    { name: 'Common',    dropRate: 0.45, color: '#9ca3af', holoEffects: ['common'] },
  uncommon:  { name: 'Uncommon',  dropRate: 0.28, color: '#22c55e', holoEffects: ['holo', 'amazing', 'reverse'] },
  rare:      { name: 'Rare',      dropRate: 0.17, color: '#3b82f6', holoEffects: ['galaxy', 'vstar', 'shiny', 'ultra'] },
  epic:      { name: 'Epic',      dropRate: 0.08, color: '#a855f7', holoEffects: ['radiant', 'sparkle', 'rainbow-alt', 'cosmos'] },
  legendary: { name: 'Legendary', dropRate: 0.02, color: '#ff8c00', holoEffects: ['rainbow', 'secret', 'gold'] },
  mythic:    { name: 'Mythic',    dropRate: 0.005, color: '#ef4444', holoEffects: ['rainbow', 'secret', 'gold', 'cosmos'] },
}

const PACKS = {
  standard: { name: 'Standard Pack', cost: 75, cards: 3, guarantees: [{ minRarity: 'uncommon', count: 1 }] },
  premium:  { name: 'Premium Pack',  cost: 200, cards: 5, guarantees: [{ minRarity: 'rare', count: 1 }] },
  elite:    { name: 'Elite Pack',    cost: 500, cards: 5, guarantees: [{ minRarity: 'epic', count: 1 }, { minRarity: 'rare', count: 2 }] },
  legendary:{ name: 'Legendary Pack', cost: 1500, cards: 7, guarantees: [{ minRarity: 'legendary', count: 1 }] },
  mixed:    { name: 'Mixed Pack',    cost: 150, cards: 6, guarantees: [] },
}

const GAME_MODES = {
  quick:  { entryFee: 0 },
  ranked: { entryFee: 10 },
  wager:  { entryFee: 0 },
}

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']

// Compact item list for mixed packs (subset of frontend items.js)
const ITEMS_LIST = [
  { id: 1, name: 'Deathbringer', slug: 'deathbringer', category: 'Physical Offense', imageKey: 'Items/T3/Icon_T3_Deathbringer' },
  { id: 2, name: 'Bloodforge', slug: 'bloodforge', category: 'Physical Offense', imageKey: 'Items/T3/Icon_T3_BloodForgedBlade' },
  { id: 3, name: "Titan's Bane", slug: 'titans-bane', category: 'Physical Offense', imageKey: 'Items/T3/Icon_T3_ObsidianMacuahuitl' },
  { id: 6, name: "Jotunn's Revenge", slug: 'jotunns-revenge', category: 'Physical Offense', imageKey: 'Items/T3/Icon_T3_JotunnsRevenge' },
  { id: 20, name: 'Rod of Tahuti', slug: 'rod-of-tahuti', category: 'Magical Offense', imageKey: 'Items/T3/Icon_T3_EldritchOrb' },
  { id: 21, name: 'Soul Reaver', slug: 'soul-reaver', category: 'Magical Offense', imageKey: 'Items/T3/Icon_T3_SoulDevourer' },
  { id: 22, name: "Chronos' Pendant", slug: 'chronos-pendant', category: 'Magical Offense', imageKey: 'Items/T3/Icon_T3_ChronosPendant' },
  { id: 40, name: 'Breastplate of Valor', slug: 'breastplate-of-valor', category: 'Physical Defense', imageKey: 'Items/TemporaryUI/SMITE1ItemIcons/Icon_BreastplateOfValor' },
  { id: 41, name: 'Hide of the Nemean Lion', slug: 'hide-of-the-nemean-lion', category: 'Physical Defense', imageKey: 'Items/T3/Icon_T3_HideoftheNemeanLion' },
  { id: 50, name: "Genji's Guard", slug: 'genjis-guard', category: 'Magical Defense', imageKey: 'Items/T3/Icon_T3_GenjisGuard' },
  { id: 60, name: 'Mantle of Discord', slug: 'mantle-of-discord', category: 'Utility', imageKey: 'Items/T3/Icon_T3_MantleOfDiscord' },
  { id: 62, name: "Magi's Cloak", slug: 'magis-cloak', category: 'Utility', imageKey: 'Items/T3/magisshelter' },
]

const CONSUMABLES_LIST = [
  { id: 'health-pot', name: 'Health Potion', color: '#ef4444', imageKey: 'S2_Icon_Buff_Pathfinder' },
  { id: 'mana-pot', name: 'Mana Potion', color: '#3b82f6', imageKey: 'S2_Icon_Buff_Primal' },
  { id: 'multi-pot', name: 'Multi Potion', color: '#a855f7', imageKey: 'S2_Icon_Buff_Inspiration' },
  { id: 'elixir-str', name: 'Elixir of Strength', color: '#f97316', imageKey: null },
  { id: 'elixir-int', name: 'Elixir of Intelligence', color: '#8b5cf6', imageKey: null },
  { id: 'ward', name: 'Vision Ward', color: '#22c55e', imageKey: null },
]

function getGodImageUrl(god) {
  const key = god.id.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('')
  return `https://cdn.smitesource.com/cdn-cgi/image/width=256,format=auto,quality=75/Gods/${key}/Default/t_GodPortrait_${key}.png`
}

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

function rollHoloEffect(rarity) {
  const effects = RARITIES[rarity]?.holoEffects || ['common']
  return effects[Math.floor(Math.random() * effects.length)]
}

function generateCard(rarity) {
  const god = GODS[Math.floor(Math.random() * GODS.length)]
  const role = CLASS_ROLE[god.class] || 'mid'
  const powerRanges = { common: [20, 45], uncommon: [35, 60], rare: [50, 75], epic: [65, 90], legendary: [80, 99] }
  const [min, max] = powerRanges[rarity] || [20, 45]
  const power = min + Math.floor(Math.random() * (max - min + 1))
  return {
    god_id: god.id,
    god_name: god.name,
    god_class: god.class,
    role,
    rarity,
    power,
    level: 1,
    xp: 0,
    serial_number: Math.floor(Math.random() * 9999) + 1,
    holo_effect: rollHoloEffect(rarity),
    image_url: getGodImageUrl(god),
    acquired_via: 'pack',
  }
}

function generateItemCard(rarity) {
  const item = ITEMS_LIST[Math.floor(Math.random() * ITEMS_LIST.length)]
  const powerRanges = { common: [15, 35], uncommon: [30, 50], rare: [45, 65], epic: [60, 80], legendary: [75, 95], mythic: [90, 99] }
  const [min, max] = powerRanges[rarity] || [15, 35]
  const power = min + Math.floor(Math.random() * (max - min + 1))
  return {
    card_type: 'item',
    god_id: `item-${item.id}`,
    god_name: item.name,
    god_class: item.category,
    role: null,
    rarity,
    power,
    level: 1, xp: 0,
    serial_number: Math.floor(Math.random() * 9999) + 1,
    holo_effect: rollHoloEffect(rarity),
    image_url: item.imageKey ? `https://cdn.smitesource.com/cdn-cgi/image/width=128,format=auto,quality=75/${item.imageKey}.png` : '',
    acquired_via: 'pack',
    card_data: { itemId: item.id, slug: item.slug, category: item.category },
  }
}

function generateConsumableCard(rarity) {
  const con = CONSUMABLES_LIST[Math.floor(Math.random() * CONSUMABLES_LIST.length)]
  const powerRanges = { common: [10, 30], uncommon: [25, 45], rare: [40, 60], epic: [55, 75], legendary: [70, 90], mythic: [85, 99] }
  const [min, max] = powerRanges[rarity] || [10, 30]
  const power = min + Math.floor(Math.random() * (max - min + 1))
  return {
    card_type: 'consumable',
    god_id: `consumable-${con.id}`,
    god_name: con.name,
    god_class: 'Consumable',
    role: null,
    rarity,
    power,
    level: 1, xp: 0,
    serial_number: Math.floor(Math.random() * 9999) + 1,
    holo_effect: rollHoloEffect(rarity),
    image_url: con.imageKey ? `https://wiki.smite2.com/images/${con.imageKey}.png` : '',
    acquired_via: 'pack',
    card_data: { consumableId: con.id, color: con.color },
  }
}

async function generatePlayerCard(sql, rarity) {
  // Pick a random player from the database
  const players = await sql`
    SELECT lp.id, lp.name, lp.main_role, t.name as team_name, t.color as team_color,
           u.discord_id, u.discord_avatar
    FROM league_players lp
    LEFT JOIN teams t ON t.id = lp.team_id
    LEFT JOIN users u ON u.id = lp.user_id
    ORDER BY RANDOM() LIMIT 1
  `
  const player = players[0]
  if (!player) return generateCard(rarity) // fallback to god card

  const powerRanges = { common: [25, 50], uncommon: [40, 65], rare: [55, 80], epic: [70, 92], legendary: [85, 99], mythic: [95, 99] }
  const [min, max] = powerRanges[rarity] || [25, 50]
  const power = min + Math.floor(Math.random() * (max - min + 1))

  let avatarUrl = null
  if (player.discord_id && player.discord_avatar) {
    avatarUrl = `https://cdn.discordapp.com/avatars/${player.discord_id}/${player.discord_avatar}.webp?size=256`
  }

  return {
    card_type: 'player',
    god_id: `player-${player.id}`,
    god_name: player.name,
    god_class: player.main_role || 'ADC',
    role: (player.main_role || 'adc').toLowerCase(),
    rarity,
    power,
    level: 1, xp: 0,
    serial_number: Math.floor(Math.random() * 9999) + 1,
    holo_effect: rollHoloEffect(rarity),
    image_url: avatarUrl || '',
    acquired_via: 'pack',
    card_data: {
      playerId: player.id,
      teamName: player.team_name,
      teamColor: player.team_color,
      role: player.main_role || 'ADC',
    },
  }
}

function generateCardByType(type, rarity) {
  switch (type) {
    case 'item': return generateItemCard(rarity)
    case 'consumable': return generateConsumableCard(rarity)
    default: return { ...generateCard(rarity), card_type: 'god' }
  }
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
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

  // Deduct Passion (unless test mode)
  if (!testMode && pack.cost > 0) {
    const [bal] = await sql`SELECT balance FROM passion_balances WHERE user_id = ${userId}`
    if (!bal || bal.balance < pack.cost) throw new Error('Not enough Passion')
    await grantPassion(sql, userId, 'cc_pack', -pack.cost, `Card Clash: ${pack.name}`)
  }

  let cards
  if (packType === 'mixed') {
    cards = await generateMixedPack(sql)
  } else {
    cards = generateRarityPack(pack)
  }

  // Insert cards into DB
  const newCards = []
  for (const card of cards) {
    const [inserted] = await sql`
      INSERT INTO cc_cards (owner_id, god_id, god_name, god_class, role, rarity, power, level, xp, serial_number, holo_effect, image_url, acquired_via, card_type, card_data)
      VALUES (${userId}, ${card.god_id}, ${card.god_name}, ${card.god_class}, ${card.role}, ${card.rarity}, ${card.power}, ${card.level}, ${card.xp}, ${card.serial_number}, ${card.holo_effect}, ${card.image_url}, ${card.acquired_via}, ${card.card_type || 'god'}, ${card.card_data ? JSON.stringify(card.card_data) : null})
      RETURNING *
    `
    // Preserve reveal order for mixed packs
    if (card._revealOrder != null) inserted._revealOrder = card._revealOrder
    newCards.push(inserted)
  }

  // Update stats
  await ensureStats(sql, userId)
  await sql`UPDATE cc_stats SET packs_opened = packs_opened + 1 WHERE user_id = ${userId}`

  return { packName: pack.name, cards: newCards }
}

function generateRarityPack(pack) {
  const cards = []
  const guarantees = [...pack.guarantees]
  for (const g of guarantees) {
    for (let i = 0; i < g.count; i++) {
      cards.push({ ...generateCard(rollRarity(g.minRarity)), card_type: 'god' })
    }
  }
  while (cards.length < pack.cards) {
    cards.push({ ...generateCard(rollRarity('common')), card_type: 'god' })
  }
  return cards
}

async function generateMixedPack(sql) {
  // 6 cards total:
  //   Slots 1-4: exactly 1 player card, rest are fully random type (god/item/consumable)
  //   Slot 5: guaranteed uncommon+ rarity, random type (not wildcard)
  //   Slot 6: complete wildcard — any type, any rarity
  const allTypes = ['god', 'item', 'consumable', 'player']
  const nonPlayerTypes = ['god', 'item', 'consumable']
  const baseCards = []

  // 1 guaranteed player card
  baseCards.push(await generatePlayerCard(sql, rollRarity('common')))

  // 3 random-type cards (god/item/consumable — could all be gods)
  for (let i = 0; i < 3; i++) {
    const type = nonPlayerTypes[Math.floor(Math.random() * nonPlayerTypes.length)]
    baseCards.push(generateCardByType(type, rollRarity('common')))
  }

  // Shuffle so the player card lands in a random position
  shuffle(baseCards)
  baseCards.forEach((c, i) => { c._revealOrder = i })

  // Card 5: guaranteed uncommon+ rarity, random type
  const rareType = allTypes[Math.floor(Math.random() * allTypes.length)]
  const rareRarity = rollRarity('uncommon')
  const card5 = rareType === 'player'
    ? await generatePlayerCard(sql, rareRarity)
    : generateCardByType(rareType, rareRarity)
  card5._revealOrder = 4

  // Card 6: complete wildcard — any type, any rarity
  const wcType = allTypes[Math.floor(Math.random() * allTypes.length)]
  const wcRarity = rollRarity('common')
  const card6 = wcType === 'player'
    ? await generatePlayerCard(sql, wcRarity)
    : generateCardByType(wcType, wcRarity)
  card6._revealOrder = 5

  return [...baseCards, card5, card6]
}

// ════════════════════════════════════════════
// Generate starter collection
// ════════════════════════════════════════════
export async function generateStarter(sql, userId) {
  // Check if user already has cards
  const [{ count }] = await sql`SELECT COUNT(*)::int as count FROM cc_cards WHERE owner_id = ${userId}`
  if (count > 0) return null

  const starterCards = []
  for (let i = 0; i < 10; i++) {
    const rarity = i < 5 ? 'uncommon' : 'common'
    starterCards.push(generateCard(rarity))
  }

  const inserted = []
  for (const card of starterCards) {
    const [row] = await sql`
      INSERT INTO cc_cards (owner_id, god_id, god_name, god_class, role, rarity, power, level, xp, serial_number, holo_effect, image_url, acquired_via)
      VALUES (${userId}, ${card.god_id}, ${card.god_name}, ${card.god_class}, ${card.role}, ${card.rarity}, ${card.power}, ${card.level}, ${card.xp}, ${card.serial_number}, ${card.holo_effect}, ${card.image_url}, 'starter')
      RETURNING *
    `
    inserted.push(row)
  }

  await ensureStats(sql, userId)
  return inserted
}

// ════════════════════════════════════════════
// Report battle result
// ════════════════════════════════════════════
export async function reportBattle(sql, userId, mode, isWinner, testMode) {
  const modeConfig = GAME_MODES[mode] || GAME_MODES.quick
  await ensureStats(sql, userId)

  const [stats] = await sql`SELECT * FROM cc_stats WHERE user_id = ${userId}`
  const oldElo = stats.elo

  // ELO change for ranked
  let eloChange = 0
  if (mode === 'ranked') {
    const k = 32
    const expected = 1 / (1 + Math.pow(10, (1000 - oldElo) / 400))
    const actual = isWinner ? 1 : 0
    eloChange = Math.round(k * (actual - expected))
  }

  // Update stats
  const newStreak = isWinner ? stats.streak + 1 : 0
  const newBestStreak = Math.max(stats.best_streak, newStreak)
  await sql`
    UPDATE cc_stats SET
      elo = elo + ${eloChange},
      wins = wins + ${isWinner ? 1 : 0},
      losses = losses + ${isWinner ? 0 : 1},
      streak = ${newStreak},
      best_streak = ${newBestStreak}
    WHERE user_id = ${userId}
  `

  // Give XP to lineup cards
  await sql`
    UPDATE cc_cards SET xp = xp + ${isWinner ? 25 : 10}
    WHERE id IN (SELECT card_id FROM cc_lineups WHERE user_id = ${userId} AND card_id IS NOT NULL)
  `

  const [updated] = await sql`SELECT * FROM cc_stats WHERE user_id = ${userId}`
  return { stats: updated, eloChange }
}

// ════════════════════════════════════════════
// Collect passive income
// ════════════════════════════════════════════
export async function collectIncome(sql, userId, testMode) {
  await ensureStats(sql, userId)
  const [stats] = await sql`SELECT last_income_collected FROM cc_stats WHERE user_id = ${userId}`

  // Calculate hours since last collection
  const last = stats.last_income_collected ? new Date(stats.last_income_collected).getTime() : 0
  const now = Date.now()
  const hoursSince = last ? (now - last) / (1000 * 60 * 60) : 24

  if (hoursSince < 1) return { amount: 0, message: 'Too soon to collect' }

  // Count filled lineup slots and calculate income
  const lineup = await sql`SELECT card_id FROM cc_lineups WHERE user_id = ${userId} AND card_id IS NOT NULL`
  if (lineup.length === 0) return { amount: 0, message: 'No cards in lineup' }

  // Base: 2 Passion per filled slot per day, prorated by hours (max 24h)
  const hoursToCredit = Math.min(hoursSince, 24)
  const dailyRate = lineup.length * 2
  const amount = Math.floor(dailyRate * (hoursToCredit / 24))

  if (amount <= 0) return { amount: 0, message: 'Not enough accrued' }

  await sql`UPDATE cc_stats SET last_income_collected = NOW() WHERE user_id = ${userId}`

  // Give XP to lineup cards
  await sql`
    UPDATE cc_cards SET xp = xp + 10
    WHERE id IN (SELECT card_id FROM cc_lineups WHERE user_id = ${userId} AND card_id IS NOT NULL)
  `

  if (!testMode && amount > 0) {
    await grantPassion(sql, userId, 'cc_income', amount, `Card Clash: Starting Five income (${lineup.length} cards)`)
  }

  return { amount }
}

// ════════════════════════════════════════════
// Disenchant card for embers
// ════════════════════════════════════════════
const EMBER_VALUES = { common: 5, uncommon: 15, rare: 40, epic: 100, legendary: 300 }

export async function disenchantCard(sql, userId, cardId) {
  const [card] = await sql`SELECT * FROM cc_cards WHERE id = ${cardId} AND owner_id = ${userId}`
  if (!card) throw new Error('Card not found')

  const embers = EMBER_VALUES[card.rarity] || 5

  // Remove from lineup if present
  await sql`UPDATE cc_lineups SET card_id = NULL WHERE user_id = ${userId} AND card_id = ${cardId}`
  // Delete card
  await sql`DELETE FROM cc_cards WHERE id = ${cardId}`
  // Add embers
  await ensureStats(sql, userId)
  await sql`UPDATE cc_stats SET embers = embers + ${embers} WHERE user_id = ${userId}`

  return { embersGained: embers }
}

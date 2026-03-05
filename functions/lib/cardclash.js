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
}

const PACKS = {
  standard: { name: 'Standard Pack', cost: 75, cards: 3, guarantees: [{ minRarity: 'uncommon', count: 1 }] },
  premium:  { name: 'Premium Pack',  cost: 200, cards: 5, guarantees: [{ minRarity: 'rare', count: 1 }] },
  elite:    { name: 'Elite Pack',    cost: 500, cards: 5, guarantees: [{ minRarity: 'epic', count: 1 }, { minRarity: 'rare', count: 2 }] },
  legendary:{ name: 'Legendary Pack', cost: 1500, cards: 7, guarantees: [{ minRarity: 'legendary', count: 1 }] },
}

const GAME_MODES = {
  quick:  { winReward: 5,  losePenalty: 0,  entryFee: 0 },
  ranked: { winReward: 18, losePenalty: 0,  entryFee: 10 },
  wager:  { winReward: 0,  losePenalty: 0,  entryFee: 0 },
}

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary']

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
    // Check balance first
    const [bal] = await sql`SELECT balance FROM passion_balances WHERE user_id = ${userId}`
    if (!bal || bal.balance < pack.cost) throw new Error('Not enough Passion')
    await grantPassion(sql, userId, 'cc_pack', -pack.cost, `Card Clash: ${pack.name}`)
  }

  // Generate cards with guaranteed rarities
  const cards = []
  const guarantees = [...pack.guarantees]

  // Fill guaranteed slots first
  for (const g of guarantees) {
    for (let i = 0; i < g.count; i++) {
      cards.push(generateCard(rollRarity(g.minRarity)))
    }
  }
  // Fill remaining with random
  while (cards.length < pack.cards) {
    cards.push(generateCard(rollRarity('common')))
  }

  // Insert cards into DB
  const newCards = []
  for (const card of cards) {
    const [inserted] = await sql`
      INSERT INTO cc_cards (owner_id, god_id, god_name, god_class, role, rarity, power, level, xp, serial_number, holo_effect, image_url, acquired_via)
      VALUES (${userId}, ${card.god_id}, ${card.god_name}, ${card.god_class}, ${card.role}, ${card.rarity}, ${card.power}, ${card.level}, ${card.xp}, ${card.serial_number}, ${card.holo_effect}, ${card.image_url}, ${card.acquired_via})
      RETURNING *
    `
    newCards.push(inserted)
  }

  // Update stats
  await ensureStats(sql, userId)
  await sql`UPDATE cc_stats SET packs_opened = packs_opened + 1 WHERE user_id = ${userId}`

  return { packName: pack.name, cards: newCards }
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

  // Passion reward
  let passionChange = 0
  if (isWinner) {
    passionChange = modeConfig.winReward
  } else {
    passionChange = -modeConfig.losePenalty
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

  // Grant/deduct Passion (unless test mode)
  if (!testMode && passionChange !== 0) {
    await grantPassion(sql, userId, 'cc_battle', passionChange,
      `Card Clash ${mode}: ${isWinner ? 'Victory' : 'Defeat'}`)
  }

  // Give XP to lineup cards
  await sql`
    UPDATE cc_cards SET xp = xp + ${isWinner ? 25 : 10}
    WHERE id IN (SELECT card_id FROM cc_lineups WHERE user_id = ${userId} AND card_id IS NOT NULL)
  `

  const [updated] = await sql`SELECT * FROM cc_stats WHERE user_id = ${userId}`
  return { stats: updated, eloChange, passionChange }
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

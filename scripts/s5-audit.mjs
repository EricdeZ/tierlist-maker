// Quick audit: compute Starting 5 output for every player under old (multiplicative) vs new (additive) stacking
import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'

// Load DATABASE_URL from .dev.vars
const devVars = readFileSync('.dev.vars', 'utf8')
const dbUrl = devVars.match(/^DATABASE_URL=(.+)$/m)?.[1]
if (!dbUrl) { console.error('No DATABASE_URL in .dev.vars'); process.exit(1) }
const sql = neon(dbUrl)

// --- Constants (mirrored from economy.js / starting-five.js) ---
const S5_FLAT_CORES = { uncommon: 0.80, rare: 1.90, epic: 4.20, legendary: 8.10, mythic: 8.50, unique: 9.40 }
const S5_FLAT_PASSION = { uncommon: 0.05, rare: 0.12, epic: 0.26, legendary: 0.50, mythic: 0.52, unique: 0.58 }
const S5_REVERSE_MULT = { uncommon: 1.15, rare: 1.25, epic: 1.46, legendary: 1.55, mythic: 1.60, unique: 1.76 }
const S5_FULL_RATIO = 0.44
const S5_BENCH_EFFECTIVENESS = 0.50
const S5_ALLSTAR_MODIFIER = 0.615
const S5_ATT_FLAT = {
  god:  { uncommon: 0.06, rare: 0.10, epic: 0.20, legendary: 0.29, mythic: 0.33, unique: 0.44 },
  item: { uncommon: 0.04, rare: 0.06, epic: 0.13, legendary: 0.18, mythic: 0.20, unique: 0.27 },
}
const S5_ATT_MULT = {
  god:  { uncommon: 0.030, rare: 0.050, epic: 0.100, legendary: 0.145, mythic: 0.160, unique: 0.215 },
  item: { uncommon: 0.015, rare: 0.025, epic: 0.050, legendary: 0.070, mythic: 0.078, unique: 0.108 },
}
const S5_FULL_ATT_RATIO = 0.6
const GOD_SYNERGY_BONUS = 0.40
const TEAM_SYNERGY_BONUS = { 2: 0.20, 3: 0.30, 4: 0.45, 5: 0.60 }

function getCardContribution(holoType, rarity, effectiveness = 1.0) {
  if (!holoType) return { type: 'none' }
  if (holoType === 'holo') {
    return { type: 'flat', cores: (S5_FLAT_CORES[rarity] || 0) * effectiveness, passion: (S5_FLAT_PASSION[rarity] || 0) * effectiveness }
  }
  if (holoType === 'reverse') {
    return { type: 'mult', multiplier: 1 + (S5_REVERSE_MULT[rarity] || 0) * effectiveness }
  }
  if (holoType === 'full') {
    return {
      type: 'full',
      cores: (S5_FLAT_CORES[rarity] || 0) * S5_FULL_RATIO * effectiveness,
      passion: (S5_FLAT_PASSION[rarity] || 0) * S5_FULL_RATIO * effectiveness,
      multiplier: 1 + ((S5_REVERSE_MULT[rarity] || 1) - 1) * S5_FULL_RATIO * effectiveness,
    }
  }
  return { type: 'none' }
}

function getAttachmentBonus(att, type, playerHasFlat, playerHasMult, synergy = false) {
  if (!att?.holo_type || !att?.rarity) return { flatBoost: 0, multAdd: 0 }
  let flatPct = S5_ATT_FLAT[type]?.[att.rarity] || 0
  let multAdd = S5_ATT_MULT[type]?.[att.rarity] || 0
  if (synergy && type === 'god') { flatPct *= 1 + GOD_SYNERGY_BONUS; multAdd *= 1 + GOD_SYNERGY_BONUS }
  let rF = 0, rM = 0
  if (att.holo_type === 'holo') rF = playerHasFlat ? flatPct : 0
  else if (att.holo_type === 'reverse') rM = playerHasMult ? multAdd : 0
  else if (att.holo_type === 'full') { rF = playerHasFlat ? flatPct * S5_FULL_ATT_RATIO : 0; rM = playerHasMult ? multAdd * S5_FULL_ATT_RATIO : 0 }
  return { flatBoost: rF, multAdd: rM }
}

function isRoleMismatch(card) {
  if (card.slot_role === 'bench') return false
  return card.slot_role && card.role && card.role !== card.slot_role && card.role !== 'fill'
}

function checkSynergy(player, god) {
  if (!player?.best_god_name || !god?.god_name) return false
  return god.god_name.toLowerCase() === player.best_god_name.toLowerCase()
}

// mode: 'mult' (old) or 'add' (new); flatScale multiplies flat constants
function calcLineupOutput(cards, teamCounts, mode, flatScale = 1.0) {
  let totalFlatCores = 0, totalFlatPassion = 0, totalMult = 1.0
  for (const card of cards) {
    if (isRoleMismatch(card)) continue
    const effectiveness = card.isBench ? S5_BENCH_EFFECTIVENESS : 1.0
    const contrib = getCardContribution(card.holo_type, card.rarity, effectiveness)
    // Apply flat scale
    if (contrib.cores !== undefined) contrib.cores *= flatScale
    if (contrib.passion !== undefined) contrib.passion *= flatScale
    const synergy = checkSynergy(card, card._godCard)
    const playerHasFlat = contrib.type === 'flat' || contrib.type === 'full'
    const playerHasMult = contrib.type === 'mult' || contrib.type === 'full'
    const godBonus = getAttachmentBonus(card._godCard, 'god', playerHasFlat, playerHasMult, synergy)
    const itemBonus = getAttachmentBonus(card._itemCard, 'item', playerHasFlat, playerHasMult)
    const cardTeamBonus = 1 + (TEAM_SYNERGY_BONUS[teamCounts[card.team_id]] || 0)
    if (playerHasFlat) {
      totalFlatCores += contrib.cores * (1 + godBonus.flatBoost) * (1 + itemBonus.flatBoost) * cardTeamBonus
      totalFlatPassion += contrib.passion * (1 + godBonus.flatBoost) * (1 + itemBonus.flatBoost) * cardTeamBonus
    }
    if (playerHasMult) {
      const slotMult = contrib.multiplier + godBonus.multAdd * effectiveness + itemBonus.multAdd * effectiveness
      if (mode === 'mult') {
        const boostedMult = 1 + (slotMult - 1) * cardTeamBonus
        totalMult *= boostedMult
      } else {
        const boostedMult = (slotMult - 1) * cardTeamBonus
        totalMult += boostedMult
      }
    }
  }
  return { coresPerDay: totalFlatCores * totalMult, passionPerDay: totalFlatPassion * totalMult }
}

async function main() {
  const rows = await sql`
    SELECT l.user_id, l.role AS slot_role, l.lineup_type, c.rarity, c.holo_type, c.card_type, c.role,
      pd.best_god_name, pd.team_id,
      g.rarity AS god_rarity, g.holo_type AS god_holo_type, g.god_name AS god_god_name,
      i.rarity AS item_rarity, i.holo_type AS item_holo_type,
      u.discord_username
    FROM cc_lineups l
    JOIN cc_cards c ON l.card_id = c.id
    LEFT JOIN cc_player_defs pd ON c.def_id = pd.id AND c.card_type = 'player'
    LEFT JOIN cc_cards g ON l.god_card_id = g.id
    LEFT JOIN cc_cards i ON l.item_card_id = i.id
    LEFT JOIN users u ON l.user_id = u.id
    WHERE l.card_id IS NOT NULL
    ORDER BY l.user_id, l.lineup_type, l.role
  `

  // Group by user
  const byUser = {}
  for (const row of rows) {
    const key = row.user_id
    if (!byUser[key]) byUser[key] = { username: row.discord_username, cards: [] }
    const card = {
      slot_role: row.slot_role,
      lineup_type: row.lineup_type,
      rarity: row.rarity,
      holo_type: row.holo_type,
      card_type: row.card_type,
      role: row.role,
      best_god_name: row.best_god_name,
      team_id: row.team_id,
      isBench: row.slot_role === 'bench',
      _godCard: row.god_rarity ? { rarity: row.god_rarity, holo_type: row.god_holo_type, god_name: row.god_god_name } : null,
      _itemCard: row.item_rarity ? { rarity: row.item_rarity, holo_type: row.item_holo_type } : null,
    }
    byUser[key].cards.push(card)
  }

  function getTeamCounts(cards) {
    const counts = {}
    for (const c of cards) {
      if (isRoleMismatch(c)) continue
      if (c.team_id) counts[c.team_id] = (counts[c.team_id] || 0) + 1
    }
    return counts
  }

  const FLAT_SCALES = [1.0, 1.5, 2.0, 2.5, 3.0]
  const avg = arr => arr.reduce((a,b) => a+b, 0) / arr.length
  const med = arr => { const s = [...arr].sort((a,b) => a-b); return s.length % 2 ? s[Math.floor(s.length/2)] : (s[s.length/2-1] + s[s.length/2]) / 2 }
  const p = (n, d=0) => n.toFixed(d)

  // Compute old (mult) once
  const players = []
  for (const [userId, data] of Object.entries(byUser)) {
    const csCards = data.cards.filter(c => c.lineup_type === 'current')
    const asCards = data.cards.filter(c => c.lineup_type === 'allstar')
    const csTc = getTeamCounts(csCards)
    const asTc = getTeamCounts(asCards)

    const oldCs = calcLineupOutput(csCards, csTc, 'mult')
    const oldAs = calcLineupOutput(asCards, asTc, 'mult')
    const oldCores = oldCs.coresPerDay + oldAs.coresPerDay * S5_ALLSTAR_MODIFIER
    const oldPassion = oldCs.passionPerDay + oldAs.passionPerDay * S5_ALLSTAR_MODIFIER

    const scaled = {}
    for (const s of FLAT_SCALES) {
      const newCs = calcLineupOutput(csCards, csTc, 'add', s)
      const newAs = calcLineupOutput(asCards, asTc, 'add', s)
      scaled[s] = {
        cores: newCs.coresPerDay + newAs.coresPerDay * S5_ALLSTAR_MODIFIER,
        passion: newCs.passionPerDay + newAs.passionPerDay * S5_ALLSTAR_MODIFIER,
      }
    }
    players.push({ username: data.username || userId, oldCores, oldPassion, scaled })
  }

  players.sort((a, b) => b.oldCores - a.oldCores)

  // Print comparison table — top 20, middle 10, bottom 10
  const indices = [
    ...Array.from({ length: Math.min(20, players.length) }, (_, i) => i),
    ...Array.from({ length: 10 }, (_, i) => Math.floor(players.length / 2) - 5 + i).filter(i => i >= 20 && i < players.length - 10),
    ...Array.from({ length: 10 }, (_, i) => Math.max(players.length - 10, 20) + i).filter(i => i < players.length),
  ]

  const scaleHeaders = FLAT_SCALES.map(s => `${s}x flat`.padEnd(12)).join('')
  console.log(`\n${'='.repeat(100)}`)
  console.log(`STARTING 5 — Additive stacking with flat scale factors (${players.length} players)`)
  console.log(`${'='.repeat(100)}\n`)
  console.log('Rank'.padEnd(6) + 'Username'.padEnd(22) + 'Old C/day'.padEnd(12) + scaleHeaders)
  console.log('-'.repeat(100))

  let lastIdx = -1
  for (const i of indices) {
    if (i > lastIdx + 1 && lastIdx !== -1) console.log('  ...')
    lastIdx = i
    const pl = players[i]
    const cols = FLAT_SCALES.map(s => p(pl.scaled[s].cores, 1).padEnd(12)).join('')
    console.log(
      `#${i + 1}`.padEnd(6) +
      (pl.username || '?').slice(0, 20).padEnd(22) +
      p(pl.oldCores, 1).padEnd(12) +
      cols
    )
  }

  // Summary
  const withIncome = players.filter(p => p.oldCores > 0)
  console.log(`\n${'='.repeat(100)}`)
  console.log(`SUMMARY (${withIncome.length} players with income)\n`)
  console.log('Metric'.padEnd(18) + 'Old (mult)'.padEnd(14) + FLAT_SCALES.map(s => `Add ${s}x`.padEnd(14)).join(''))
  console.log('-'.repeat(100))

  for (const [label, fn] of [['Median', med], ['Average', avg], ['Max', arr => Math.max(...arr)], ['P90', arr => [...arr].sort((a,b) => a-b)[Math.floor(arr.length * 0.9)]], ['P10', arr => [...arr].sort((a,b) => a-b)[Math.floor(arr.length * 0.1)]]]) {
    const oldArr = withIncome.map(p => p.oldCores)
    const row = label.padEnd(18) + p(fn(oldArr), 1).padEnd(14)
    + FLAT_SCALES.map(s => p(fn(withIncome.map(p => p.scaled[s].cores)), 1).padEnd(14)).join('')
    console.log(row)
  }
}

main().catch(e => { console.error(e); process.exit(1) })

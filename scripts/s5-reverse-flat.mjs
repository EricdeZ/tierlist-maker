// Test: giving reverse cards a fraction of holo's flat income to balance 2.5/2.5 split
// r_flat = 1/(1 + N*m) makes 3H/2R = 2H/3R exactly for a given rarity
import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'

const devVars = readFileSync('.dev.vars', 'utf8')
const dbUrl = devVars.match(/^DATABASE_URL=(.+)$/m)?.[1]
const sql = neon(dbUrl)

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
const FLAT_SCALE = 2.5

// r_flat: fraction of holo's flat that reverse cards also get
const REVERSE_FLAT_RATIO = 0.25

function getCardContribution(holoType, rarity, effectiveness = 1.0) {
  if (!holoType) return { type: 'none', cores: 0, passion: 0, multiplier: 1 }
  const baseFlatC = (S5_FLAT_CORES[rarity] || 0) * FLAT_SCALE * effectiveness
  const baseFlatP = (S5_FLAT_PASSION[rarity] || 0) * FLAT_SCALE * effectiveness
  if (holoType === 'holo') {
    return { type: 'flat', cores: baseFlatC, passion: baseFlatP, multiplier: 1 }
  }
  if (holoType === 'reverse') {
    const baseMult = S5_REVERSE_MULT[rarity] || 1
    const multBonus = (baseMult - 1) * effectiveness
    return {
      type: 'reverse',
      cores: baseFlatC * REVERSE_FLAT_RATIO,
      passion: baseFlatP * REVERSE_FLAT_RATIO,
      multiplier: 1 + multBonus,
    }
  }
  if (holoType === 'full') {
    const baseMult = S5_REVERSE_MULT[rarity] || 1
    return {
      type: 'full',
      cores: baseFlatC * S5_FULL_RATIO,
      passion: baseFlatP * S5_FULL_RATIO,
      multiplier: 1 + (baseMult - 1) * S5_FULL_RATIO * effectiveness,
    }
  }
  return { type: 'none', cores: 0, passion: 0, multiplier: 1 }
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

function calcLineupOutput(cards, teamCounts) {
  let totalFlatCores = 0, totalFlatPassion = 0, totalMult = 1.0
  for (const card of cards) {
    if (isRoleMismatch(card)) continue
    const effectiveness = card.isBench ? S5_BENCH_EFFECTIVENESS : 1.0
    const contrib = getCardContribution(card.holo_type, card.rarity, effectiveness)
    const synergy = checkSynergy(card, card._godCard)
    // Reverse now has flat too, so check based on values
    const playerHasFlat = contrib.cores > 0
    const playerHasMult = contrib.multiplier > 1
    const godBonus = getAttachmentBonus(card._godCard, 'god', playerHasFlat, playerHasMult, synergy)
    const itemBonus = getAttachmentBonus(card._itemCard, 'item', playerHasFlat, playerHasMult)
    const cardTeamBonus = 1 + (TEAM_SYNERGY_BONUS[teamCounts[card.team_id]] || 0)
    if (playerHasFlat) {
      totalFlatCores += contrib.cores * (1 + godBonus.flatBoost) * (1 + itemBonus.flatBoost) * cardTeamBonus
      totalFlatPassion += contrib.passion * (1 + godBonus.flatBoost) * (1 + itemBonus.flatBoost) * cardTeamBonus
    }
    if (playerHasMult) {
      const slotMult = contrib.multiplier + godBonus.multAdd * effectiveness + itemBonus.multAdd * effectiveness
      const boostedMult = (slotMult - 1) * cardTeamBonus
      totalMult += boostedMult
    }
  }
  return { coresPerDay: totalFlatCores * totalMult, passionPerDay: totalFlatPassion * totalMult }
}

// Also compute old multiplicative for comparison
function calcLineupOutputOld(cards, teamCounts) {
  let totalFlatCores = 0, totalFlatPassion = 0, totalMult = 1.0
  for (const card of cards) {
    if (isRoleMismatch(card)) continue
    const effectiveness = card.isBench ? S5_BENCH_EFFECTIVENESS : 1.0
    const holoType = card.holo_type
    let contrib
    if (!holoType) contrib = { type: 'none' }
    else if (holoType === 'holo') contrib = { type: 'flat', cores: (S5_FLAT_CORES[card.rarity] || 0) * effectiveness, passion: (S5_FLAT_PASSION[card.rarity] || 0) * effectiveness }
    else if (holoType === 'reverse') contrib = { type: 'mult', multiplier: 1 + ((S5_REVERSE_MULT[card.rarity] || 1) - 1) * effectiveness }
    else if (holoType === 'full') contrib = { type: 'full', cores: (S5_FLAT_CORES[card.rarity] || 0) * S5_FULL_RATIO * effectiveness, passion: (S5_FLAT_PASSION[card.rarity] || 0) * S5_FULL_RATIO * effectiveness, multiplier: 1 + ((S5_REVERSE_MULT[card.rarity] || 1) - 1) * S5_FULL_RATIO * effectiveness }
    else contrib = { type: 'none' }
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
      const boostedMult = 1 + (slotMult - 1) * cardTeamBonus
      totalMult *= boostedMult
    }
  }
  return { coresPerDay: totalFlatCores * totalMult, passionPerDay: totalFlatPassion * totalMult }
}

async function main() {
  // Part 1: Theoretical split analysis
  console.log('='.repeat(100))
  console.log(`REVERSE FLAT RATIO = ${REVERSE_FLAT_RATIO} | FLAT SCALE = ${FLAT_SCALE} | Additive stacking`)
  console.log('='.repeat(100))

  console.log('\n--- THEORETICAL: 5 main slots, no attachments, no synergy ---\n')
  console.log('Rarity'.padEnd(12) + '5H/0R'.padEnd(10) + '4H/1R'.padEnd(10) + '3H/2R'.padEnd(10) + '2H/3R'.padEnd(10) + '1H/4R'.padEnd(10) + '0H/5R'.padEnd(10) + 'Best'.padEnd(10) + '3v2 ratio')
  console.log('-'.repeat(100))
  for (const rarity of ['uncommon', 'rare', 'epic', 'legendary', 'mythic']) {
    const f = S5_FLAT_CORES[rarity] * FLAT_SCALE
    const m = S5_REVERSE_MULT[rarity] - 1
    const outputs = []
    for (let r = 0; r <= 5; r++) {
      const h = 5 - r
      const totalFlat = h * f + r * f * REVERSE_FLAT_RATIO
      const totalMult = 1 + r * m
      outputs.push(totalFlat * totalMult)
    }
    const bestIdx = outputs.indexOf(Math.max(...outputs))
    const ratio32 = (outputs[2] / outputs[3]).toFixed(3) // 3H/2R vs 2H/3R
    console.log(
      rarity.padEnd(12) +
      outputs.map(v => v.toFixed(1).padEnd(10)).join('') +
      `${5-bestIdx}H/${bestIdx}R`.padEnd(10) +
      ratio32
    )
  }

  // Part 2: What r_flat makes each rarity perfectly balanced?
  console.log('\n--- PERFECT r_flat per rarity (where 3H/2R = 2H/3R exactly) ---\n')
  for (const rarity of ['uncommon', 'rare', 'epic', 'legendary', 'mythic', 'unique']) {
    const m = S5_REVERSE_MULT[rarity] - 1
    const perfect = 1 / (1 + 5 * m)
    console.log(`  ${rarity.padEnd(12)} m=${m.toFixed(2)}  perfect r_flat=${perfect.toFixed(3)}  with 0.25: ratio=${(3*(1+2*m) / (2+0.75+3*m*0.25+2*(1+3*m)) ).toFixed(3)}`)
    // Actually let me compute ratio properly
    const f = 1 // normalized
    const r25_3h2r = (3*f + 2*f*0.25) * (1 + 2*m)
    const r25_2h3r = (2*f + 3*f*0.25) * (1 + 3*m)
    console.log(`           with r_flat=0.25: 3H/2R=${r25_3h2r.toFixed(3)} vs 2H/3R=${r25_2h3r.toFixed(3)} ratio=${(r25_3h2r/r25_2h3r).toFixed(4)}`)
  }

  // Part 3: Real player data
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

  const byUser = {}
  for (const row of rows) {
    if (!byUser[row.user_id]) byUser[row.user_id] = { username: row.discord_username, cards: [] }
    byUser[row.user_id].cards.push({
      slot_role: row.slot_role, lineup_type: row.lineup_type, rarity: row.rarity,
      holo_type: row.holo_type, card_type: row.card_type, role: row.role,
      best_god_name: row.best_god_name, team_id: row.team_id, isBench: row.slot_role === 'bench',
      _godCard: row.god_rarity ? { rarity: row.god_rarity, holo_type: row.god_holo_type, god_name: row.god_god_name } : null,
      _itemCard: row.item_rarity ? { rarity: row.item_rarity, holo_type: row.item_holo_type } : null,
    })
  }

  function getTeamCounts(cards) {
    const counts = {}
    for (const c of cards) { if (!isRoleMismatch(c) && c.team_id) counts[c.team_id] = (counts[c.team_id] || 0) + 1 }
    return counts
  }

  const results = []
  for (const [userId, data] of Object.entries(byUser)) {
    const csCards = data.cards.filter(c => c.lineup_type === 'current')
    const asCards = data.cards.filter(c => c.lineup_type === 'allstar')
    const csTc = getTeamCounts(csCards), asTc = getTeamCounts(asCards)

    const oldCs = calcLineupOutputOld(csCards, csTc), oldAs = calcLineupOutputOld(asCards, asTc)
    const oldCores = oldCs.coresPerDay + oldAs.coresPerDay * S5_ALLSTAR_MODIFIER

    const newCs = calcLineupOutput(csCards, csTc), newAs = calcLineupOutput(asCards, asTc)
    const newCores = newCs.coresPerDay + newAs.coresPerDay * S5_ALLSTAR_MODIFIER
    const newPassion = newCs.passionPerDay + newAs.passionPerDay * S5_ALLSTAR_MODIFIER

    results.push({ username: data.username || userId, oldCores, newCores, newPassion,
      holoCount: data.cards.filter(c => c.holo_type === 'holo').length,
      reverseCount: data.cards.filter(c => c.holo_type === 'reverse').length,
      fullCount: data.cards.filter(c => c.holo_type === 'full').length,
    })
  }
  results.sort((a, b) => b.oldCores - a.oldCores)

  const avg = arr => arr.reduce((a,b) => a+b, 0) / arr.length
  const med = arr => { const s = [...arr].sort((a,b) => a-b); return s.length % 2 ? s[Math.floor(s.length/2)] : (s[s.length/2-1] + s[s.length/2]) / 2 }

  console.log(`\n${'='.repeat(100)}`)
  console.log(`REAL PLAYER DATA — ${results.length} players (additive + 2.5x flat + reverse gets ${REVERSE_FLAT_RATIO * 100}% flat)`)
  console.log(`${'='.repeat(100)}\n`)
  console.log('Rank'.padEnd(6) + 'Username'.padEnd(22) + 'H/R/F'.padEnd(10) + 'Old C/day'.padEnd(14) + 'New C/day'.padEnd(14) + 'Delta'.padEnd(10))
  console.log('-'.repeat(80))

  // Show top 20, middle 10, bottom 10
  const show = [
    ...Array.from({ length: Math.min(20, results.length) }, (_, i) => i),
    ...Array.from({ length: 10 }, (_, i) => Math.floor(results.length / 2) - 5 + i).filter(i => i >= 20 && i < results.length - 10),
    ...Array.from({ length: 10 }, (_, i) => Math.max(results.length - 10, 20) + i).filter(i => i < results.length),
  ]
  let last = -1
  for (const i of show) {
    if (i > last + 1 && last !== -1) console.log('  ...')
    last = i
    const r = results[i]
    const delta = r.oldCores > 0 ? ((r.newCores / r.oldCores - 1) * 100).toFixed(1) : '0.0'
    console.log(
      `#${i+1}`.padEnd(6) +
      (r.username || '?').slice(0,20).padEnd(22) +
      `${r.holoCount}/${r.reverseCount}/${r.fullCount}`.padEnd(10) +
      r.oldCores.toFixed(1).padEnd(14) +
      r.newCores.toFixed(1).padEnd(14) +
      `${delta}%`
    )
  }

  const withIncome = results.filter(r => r.oldCores > 0)
  const oldArr = withIncome.map(r => r.oldCores)
  const newArr = withIncome.map(r => r.newCores)
  console.log(`\n${'='.repeat(80)}`)
  console.log('SUMMARY')
  console.log(`  ${''.padEnd(16)} ${'Old (mult)'.padEnd(14)} ${'New (add+rflat)'.padEnd(14)}`)
  console.log(`  ${'Median'.padEnd(16)} ${med(oldArr).toFixed(1).padEnd(14)} ${med(newArr).toFixed(1).padEnd(14)}`)
  console.log(`  ${'Average'.padEnd(16)} ${avg(oldArr).toFixed(1).padEnd(14)} ${avg(newArr).toFixed(1).padEnd(14)}`)
  console.log(`  ${'Max'.padEnd(16)} ${Math.max(...oldArr).toFixed(1).padEnd(14)} ${Math.max(...newArr).toFixed(1).padEnd(14)}`)
  console.log(`  ${'P90'.padEnd(16)} ${[...oldArr].sort((a,b) => a-b)[Math.floor(oldArr.length*0.9)].toFixed(1).padEnd(14)} ${[...newArr].sort((a,b) => a-b)[Math.floor(newArr.length*0.9)].toFixed(1).padEnd(14)}`)
  console.log(`  ${'P10'.padEnd(16)} ${[...oldArr].sort((a,b) => a-b)[Math.floor(oldArr.length*0.1)].toFixed(1).padEnd(14)} ${[...newArr].sort((a,b) => a-b)[Math.floor(newArr.length*0.1)].toFixed(1).padEnd(14)}`)

  // Key: how do reverse-heavy players fare now vs before?
  console.log(`\n--- REVERSE-HEAVY PLAYERS (5+ reverse cards, previously earning 0 or near-0 from flat) ---`)
  const reverseHeavy = results.filter(r => r.reverseCount >= 5 && r.holoCount <= 1 && r.fullCount <= 1)
  for (const r of reverseHeavy.slice(0, 15)) {
    const delta = r.oldCores > 0 ? ((r.newCores / r.oldCores - 1) * 100).toFixed(1) : 'N/A'
    console.log(`  ${r.username?.slice(0,20).padEnd(22)} H/R/F=${r.holoCount}/${r.reverseCount}/${r.fullCount}  old=${r.oldCores.toFixed(1).padEnd(10)} new=${r.newCores.toFixed(1).padEnd(10)} delta=${delta}%`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })

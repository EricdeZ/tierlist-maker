// Model: what mult values + flat scale combination keeps median constant
// while making 3H/2R ≈ 2H/3R?
//
// Formula: output = H*f * (1 + R*m)  where H+R=5
// Optimal R* = 2.5 - 1/(2m)
// For 3H/2R = 2H/3R: impossible exactly, but ratio = (3+6m)/(2+6m)
// As m grows, ratio → 1
//
// Strategy: multiply all S5_REVERSE_MULT bonuses by a factor K,
// divide S5_FLAT_SCALE by sqrt(K) to roughly preserve output,
// then check real player data

import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'
const devVars = readFileSync('.dev.vars', 'utf8')
const sql = neon(devVars.match(/^DATABASE_URL=(.+)$/m)?.[1])

const S5_FLAT_CORES = { uncommon: 0.80, rare: 1.90, epic: 4.20, legendary: 8.10, mythic: 8.50, unique: 9.40 }
const S5_FLAT_PASSION = { uncommon: 0.05, rare: 0.12, epic: 0.26, legendary: 0.50, mythic: 0.52, unique: 0.58 }
const S5_REVERSE_MULT = { uncommon: 1.15, rare: 1.25, epic: 1.46, legendary: 1.55, mythic: 1.60, unique: 1.76 }
const S5_FULL_RATIO = 0.44
const S5_ALLSTAR_MODIFIER = 0.615
const S5_BENCH_EFFECTIVENESS = 0.50
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
const TEAM_SYNERGY_BONUS = { 2: 0.20, 3: 0.30, 4: 0.45, 5: 0.60, 6: 0.60 }

function getAttBonus(att, type, hasFlat, hasMult, synergy) {
  if (!att?.holo_type || !att?.rarity) return { flatBoost: 0, multAdd: 0 }
  let fp = S5_ATT_FLAT[type]?.[att.rarity] || 0, ma = S5_ATT_MULT[type]?.[att.rarity] || 0
  if (synergy && type === 'god') { fp *= 1.4; ma *= 1.4 }
  let rF = 0, rM = 0
  if (att.holo_type === 'holo') rF = hasFlat ? fp : 0
  else if (att.holo_type === 'reverse') rM = hasMult ? ma : 0
  else if (att.holo_type === 'full') { rF = hasFlat ? fp * S5_FULL_ATT_RATIO : 0; rM = hasMult ? ma * S5_FULL_ATT_RATIO : 0 }
  return { flatBoost: rF, multAdd: rM }
}
function isRM(c) { return c.slot_role !== 'bench' && c.slot_role && c.role && c.role !== c.slot_role && c.role !== 'fill' }
function chkSyn(p, g) { return p?.best_god_name && g?.god_name && g.god_name.toLowerCase() === p.best_god_name.toLowerCase() }

// additive stacking, no reverse flat, parameterized flatScale and multScale
function calcNew(cards, tc, flatScale, multScale) {
  let fC = 0, fP = 0, tM = 1.0
  for (const card of cards) {
    if (isRM(card)) continue
    const eff = card.isBench ? 0.5 : 1.0
    const bFC = (S5_FLAT_CORES[card.rarity] || 0) * flatScale * eff
    const bFP = (S5_FLAT_PASSION[card.rarity] || 0) * flatScale * eff
    let cores = 0, passion = 0, mult = 1
    if (card.holo_type === 'holo') { cores = bFC; passion = bFP }
    else if (card.holo_type === 'reverse') {
      const baseMult = S5_REVERSE_MULT[card.rarity] || 1
      mult = 1 + ((baseMult - 1) * multScale) * eff
    }
    else if (card.holo_type === 'full') {
      cores = bFC * S5_FULL_RATIO; passion = bFP * S5_FULL_RATIO
      const baseMult = S5_REVERSE_MULT[card.rarity] || 1
      mult = 1 + ((baseMult - 1) * multScale) * S5_FULL_RATIO * eff
    }
    else continue
    const syn = chkSyn(card, card._godCard)
    const hasF = cores > 0, hasM = mult > 1
    const gB = getAttBonus(card._godCard, 'god', hasF, hasM, syn)
    const iB = getAttBonus(card._itemCard, 'item', hasF, hasM, false)
    const tb = 1 + (TEAM_SYNERGY_BONUS[tc[card.team_id]] || 0)
    if (hasF) { fC += cores * (1 + gB.flatBoost) * (1 + iB.flatBoost) * tb; fP += passion * (1 + gB.flatBoost) * (1 + iB.flatBoost) * tb }
    if (hasM) { tM += ((mult + gB.multAdd * eff + iB.multAdd * eff) - 1) * tb }
  }
  return { coresPerDay: fC * tM, passionPerDay: fP * tM }
}

function calcOld(cards, tc) {
  let fC = 0, fP = 0, tM = 1.0
  for (const card of cards) {
    if (isRM(card)) continue
    const eff = card.isBench ? 0.5 : 1.0
    let cores = 0, passion = 0, mult = 1, type = 'none'
    if (card.holo_type === 'holo') { type = 'flat'; cores = (S5_FLAT_CORES[card.rarity]||0)*eff; passion = (S5_FLAT_PASSION[card.rarity]||0)*eff }
    else if (card.holo_type === 'reverse') { type = 'mult'; mult = 1+((S5_REVERSE_MULT[card.rarity]||1)-1)*eff }
    else if (card.holo_type === 'full') { type = 'full'; cores = (S5_FLAT_CORES[card.rarity]||0)*S5_FULL_RATIO*eff; passion = (S5_FLAT_PASSION[card.rarity]||0)*S5_FULL_RATIO*eff; mult = 1+((S5_REVERSE_MULT[card.rarity]||1)-1)*S5_FULL_RATIO*eff }
    else continue
    const syn = chkSyn(card, card._godCard)
    const hasF = type === 'flat' || type === 'full', hasM = type === 'mult' || type === 'full'
    const gB = getAttBonus(card._godCard, 'god', hasF, hasM, syn)
    const iB = getAttBonus(card._itemCard, 'item', hasF, hasM, false)
    const tb = 1 + (TEAM_SYNERGY_BONUS[tc[card.team_id]] || 0)
    if (hasF) { fC += cores*(1+gB.flatBoost)*(1+iB.flatBoost)*tb; fP += passion*(1+gB.flatBoost)*(1+iB.flatBoost)*tb }
    if (hasM) { tM *= 1 + ((mult + gB.multAdd*eff + iB.multAdd*eff) - 1) * tb }
  }
  return { coresPerDay: fC * tM, passionPerDay: fP * tM }
}

function getTc(cards) {
  const c = {}; for (const x of cards) { if (!isRM(x) && x.team_id) c[x.team_id] = (c[x.team_id]||0)+1 }; return c
}

async function main() {
  const rows = await sql`
    SELECT l.user_id, l.role AS slot_role, l.lineup_type, c.rarity, c.holo_type, c.card_type, c.role,
      pd.best_god_name, pd.team_id, g.rarity AS god_rarity, g.holo_type AS god_holo_type,
      g.god_name AS god_god_name, i.rarity AS item_rarity, i.holo_type AS item_holo_type, u.discord_username
    FROM cc_lineups l JOIN cc_cards c ON l.card_id = c.id
    LEFT JOIN cc_player_defs pd ON c.def_id = pd.id AND c.card_type = 'player'
    LEFT JOIN cc_cards g ON l.god_card_id = g.id LEFT JOIN cc_cards i ON l.item_card_id = i.id
    LEFT JOIN users u ON l.user_id = u.id WHERE l.card_id IS NOT NULL
  `
  const byUser = {}
  for (const r of rows) {
    if (!byUser[r.user_id]) byUser[r.user_id] = { u: r.discord_username, cards: [] }
    byUser[r.user_id].cards.push({
      slot_role: r.slot_role, lineup_type: r.lineup_type, rarity: r.rarity,
      holo_type: r.holo_type, role: r.role, best_god_name: r.best_god_name,
      team_id: r.team_id, isBench: r.slot_role === 'bench',
      _godCard: r.god_rarity ? { rarity: r.god_rarity, holo_type: r.god_holo_type, god_name: r.god_god_name } : null,
      _itemCard: r.item_rarity ? { rarity: r.item_rarity, holo_type: r.item_holo_type } : null,
    })
  }

  // Compute old and per-config results for top 50%
  const users = []
  for (const data of Object.values(byUser)) {
    const cs = data.cards.filter(c => c.lineup_type === 'current'), as = data.cards.filter(c => c.lineup_type === 'allstar')
    const csTc = getTc(cs), asTc = getTc(as)
    const o1 = calcOld(cs, csTc), o2 = calcOld(as, asTc)
    const oldCores = o1.coresPerDay + o2.coresPerDay * S5_ALLSTAR_MODIFIER
    if (oldCores > 0) users.push({ u: data.u, cards: data.cards, oldCores, cs, as, csTc, asTc })
  }
  users.sort((a, b) => b.oldCores - a.oldCores)
  const topHalf = users.slice(0, Math.ceil(users.length / 2))

  const avg = a => a.reduce((x,y) => x+y, 0)/a.length
  const med = a => { const s = [...a].sort((x,y) => x-y); return s.length%2 ? s[Math.floor(s.length/2)] : (s[s.length/2-1]+s[s.length/2])/2 }

  // Part 1: Theoretical split analysis for different mult scales
  console.log('='.repeat(110))
  console.log('THEORETICAL: 5 slots, bare (no attachments), varying mult scale')
  console.log('='.repeat(110))
  console.log('\n  For 3H/2R vs 2H/3R ratio = (3+6m)/(2+6m) where m = (baseMult-1)*multScale')
  console.log('  Optimal R* = 2.5 - 1/(2m)\n')

  const CONFIGS = [
    { label: 'Current (1.4f, 1x mult)', flatScale: 1.4, multScale: 1.0 },
    { label: '1.0f, 2x mult', flatScale: 1.0, multScale: 2.0 },
    { label: '0.8f, 3x mult', flatScale: 0.8, multScale: 3.0 },
    { label: '0.7f, 4x mult', flatScale: 0.7, multScale: 4.0 },
    { label: '0.6f, 5x mult', flatScale: 0.6, multScale: 5.0 },
  ]

  console.log('Config'.padEnd(22) + 'Rarity'.padEnd(12) + 'm_eff'.padEnd(8) + 'R*'.padEnd(8) + '3H/2R'.padEnd(10) + '2H/3R'.padEnd(10) + 'Ratio'.padEnd(8) + '5H/0R'.padEnd(10) + '0H/5R'.padEnd(10))
  console.log('-'.repeat(110))

  for (const cfg of CONFIGS) {
    for (const rarity of ['epic', 'mythic']) {
      const f = (S5_FLAT_CORES[rarity] || 0) * cfg.flatScale
      const m = ((S5_REVERSE_MULT[rarity] || 1) - 1) * cfg.multScale
      const rStar = 2.5 - 1/(2*m)
      const splits = {}
      for (let r = 0; r <= 5; r++) {
        const h = 5 - r
        splits[`${h}H/${r}R`] = h * f * (1 + r * m)
      }
      const ratio = splits['3H/2R'] / splits['2H/3R']
      console.log(
        cfg.label.padEnd(22) +
        rarity.padEnd(12) +
        m.toFixed(2).padEnd(8) +
        rStar.toFixed(2).padEnd(8) +
        splits['3H/2R'].toFixed(1).padEnd(10) +
        splits['2H/3R'].toFixed(1).padEnd(10) +
        ratio.toFixed(3).padEnd(8) +
        splits['5H/0R'].toFixed(1).padEnd(10) +
        splits['0H/5R'].toFixed(1).padEnd(10)
      )
    }
    console.log('')
  }

  // Part 2: Real player data with each config
  const oldArr = topHalf.map(u => u.oldCores)

  console.log('='.repeat(110))
  console.log('REAL PLAYER DATA — top 50% active players')
  console.log('='.repeat(110))
  console.log('\nMetric'.padEnd(16) + 'Old (mult)'.padEnd(14) + CONFIGS.map(c => c.label.slice(0,16).padEnd(18)).join(''))
  console.log('-'.repeat(110))

  const configData = {}
  for (const cfg of CONFIGS) {
    configData[cfg.label] = topHalf.map(u => {
      const n1 = calcNew(u.cs, u.csTc, cfg.flatScale, cfg.multScale)
      const n2 = calcNew(u.as, u.asTc, cfg.flatScale, cfg.multScale)
      return n1.coresPerDay + n2.coresPerDay * S5_ALLSTAR_MODIFIER
    })
  }

  for (const [label, fn] of [['Median', med], ['Average', avg], ['Max', a => Math.max(...a)], ['P90', a => [...a].sort((x,y) => x-y)[Math.floor(a.length*0.9)]], ['P25', a => [...a].sort((x,y) => x-y)[Math.floor(a.length*0.25)]]]) {
    console.log(label.padEnd(16) + fn(oldArr).toFixed(1).padEnd(14) + CONFIGS.map(c => fn(configData[c.label]).toFixed(1).padEnd(18)).join(''))
  }

  // Part 3: How do all-reverse players fare?
  console.log('\n--- ALL-REVERSE PLAYERS (0 holo cards) ---')
  const allReverse = users.filter(u => u.cards.every(c => c.holo_type !== 'holo' || c.holo_type === null))
  for (const u of allReverse.slice(0, 10)) {
    const cols = CONFIGS.map(cfg => {
      const n1 = calcNew(u.cs, u.csTc, cfg.flatScale, cfg.multScale)
      const n2 = calcNew(u.as, u.asTc, cfg.flatScale, cfg.multScale)
      return (n1.coresPerDay + n2.coresPerDay * S5_ALLSTAR_MODIFIER).toFixed(1).padEnd(18)
    }).join('')
    console.log(`  ${(u.u||'?').slice(0,20).padEnd(22)} old=${u.oldCores.toFixed(1).padEnd(10)} ${cols}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })

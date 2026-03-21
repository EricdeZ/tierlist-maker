// Same sweep but only players above median (top 50% by old income)
import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'

const devVars = readFileSync('.dev.vars', 'utf8')
const sql = neon(devVars.match(/^DATABASE_URL=(.+)$/m)?.[1])

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
const REVERSE_FLAT_RATIO = 0.25

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

function calcNew(cards, tc, flatScale) {
  let fC = 0, fP = 0, tM = 1.0
  for (const card of cards) {
    if (isRM(card)) continue
    const eff = card.isBench ? 0.5 : 1.0
    const bFC = (S5_FLAT_CORES[card.rarity] || 0) * flatScale * eff
    const bFP = (S5_FLAT_PASSION[card.rarity] || 0) * flatScale * eff
    let cores = 0, passion = 0, mult = 1
    if (card.holo_type === 'holo') { cores = bFC; passion = bFP }
    else if (card.holo_type === 'reverse') { cores = bFC * REVERSE_FLAT_RATIO; passion = bFP * REVERSE_FLAT_RATIO; mult = 1 + ((S5_REVERSE_MULT[card.rarity] || 1) - 1) * eff }
    else if (card.holo_type === 'full') { cores = bFC * S5_FULL_RATIO; passion = bFP * S5_FULL_RATIO; mult = 1 + ((S5_REVERSE_MULT[card.rarity] || 1) - 1) * S5_FULL_RATIO * eff }
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

  // Compute per-user old values
  const users = []
  for (const [uid, data] of Object.entries(byUser)) {
    const cs = data.cards.filter(c => c.lineup_type === 'current'), as = data.cards.filter(c => c.lineup_type === 'allstar')
    const csTc = getTc(cs), asTc = getTc(as)
    const o1 = calcOld(cs, csTc), o2 = calcOld(as, asTc)
    const oldCores = o1.coresPerDay + o2.coresPerDay * S5_ALLSTAR_MODIFIER
    if (oldCores > 0) users.push({ u: data.u, cards: data.cards, oldCores, cs, as, csTc, asTc })
  }

  // Sort by old cores, take top 50%
  users.sort((a, b) => b.oldCores - a.oldCores)
  const topHalf = users.slice(0, Math.ceil(users.length / 2))

  const SCALES = [1.0, 1.25, 1.5, 1.75, 2.0]

  const avg = a => a.reduce((x,y) => x+y, 0)/a.length
  const med = a => { const s = [...a].sort((x,y) => x-y); return s.length%2 ? s[Math.floor(s.length/2)] : (s[s.length/2-1]+s[s.length/2])/2 }
  const p = (a,pct) => [...a].sort((x,y) => x-y)[Math.floor(a.length*pct)]

  console.log(`\nTotal players with income: ${users.length}`)
  console.log(`Top 50% cutoff: ${topHalf[topHalf.length-1].oldCores.toFixed(1)} cores/day (${topHalf.length} players)\n`)

  console.log(`${'='.repeat(110)}`)
  console.log(`TOP 50% ACTIVE PLAYERS — additive + reverse gets 25% flat`)
  console.log(`${'='.repeat(110)}\n`)
  console.log('Metric'.padEnd(16) + 'Old (mult)'.padEnd(14) + SCALES.map(s => `${s}x flat`.padEnd(14)).join(''))
  console.log('-'.repeat(110))

  const oldArr = topHalf.map(u => u.oldCores)
  const scaleData = {}
  for (const s of SCALES) {
    scaleData[s] = topHalf.map(u => {
      const n1 = calcNew(u.cs, u.csTc, s), n2 = calcNew(u.as, u.asTc, s)
      return n1.coresPerDay + n2.coresPerDay * S5_ALLSTAR_MODIFIER
    })
  }

  for (const [label, fn] of [['Median', med], ['Average', avg], ['Max', a => Math.max(...a)], ['P90', a => p(a,0.9)], ['P75', a => p(a,0.75)], ['P25', a => p(a,0.25)], ['Min', a => Math.min(...a)]]) {
    console.log(label.padEnd(16) + fn(oldArr).toFixed(1).padEnd(14) + SCALES.map(s => fn(scaleData[s]).toFixed(1).padEnd(14)).join(''))
  }

  // Also show per-player for top 30
  console.log(`\n--- TOP 30 PLAYERS ---\n`)
  console.log('Rank'.padEnd(6) + 'Username'.padEnd(22) + 'Old'.padEnd(12) + SCALES.map(s => `${s}x`.padEnd(12)).join(''))
  console.log('-'.repeat(90))
  for (let i = 0; i < Math.min(30, topHalf.length); i++) {
    const u = topHalf[i]
    const cols = SCALES.map(s => scaleData[s][i].toFixed(1).padEnd(12)).join('')
    console.log(`#${i+1}`.padEnd(6) + (u.u || '?').slice(0,20).padEnd(22) + u.oldCores.toFixed(1).padEnd(12) + cols)
  }
}

main().catch(e => { console.error(e); process.exit(1) })

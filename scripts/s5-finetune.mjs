// Fine-tune around 0.65f/4.5x — try slightly higher values
import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'
const devVars = readFileSync('.dev.vars', 'utf8')
const sql = neon(devVars.match(/^DATABASE_URL=(.+)$/m)?.[1])

const S5_FLAT_CORES = { uncommon: 0.80, rare: 1.90, epic: 4.20, legendary: 8.10, mythic: 8.50, unique: 9.40 }
const S5_FLAT_PASSION = { uncommon: 0.05, rare: 0.12, epic: 0.26, legendary: 0.50, mythic: 0.52, unique: 0.58 }
const S5_REVERSE_MULT = { uncommon: 1.15, rare: 1.25, epic: 1.46, legendary: 1.55, mythic: 1.60, unique: 1.76 }
const S5_FULL_RATIO = 0.44
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

function calcCurrent(cards, tc) {
  let fC = 0, fP = 0, tM = 1.0
  const FS = 1.4, RF = 0.25
  for (const card of cards) {
    if (isRM(card)) continue
    const eff = card.isBench ? 0.5 : 1.0
    const bFC = (S5_FLAT_CORES[card.rarity]||0)*FS*eff
    const bFP = (S5_FLAT_PASSION[card.rarity]||0)*FS*eff
    let cores = 0, passion = 0, mult = 1, hasF = false, hasM = false
    if (card.holo_type === 'holo') { hasF = true; cores = bFC; passion = bFP }
    else if (card.holo_type === 'reverse') { hasF = true; hasM = true; cores = bFC*RF; passion = bFP*RF; mult = 1+((S5_REVERSE_MULT[card.rarity]||1)-1)*eff }
    else if (card.holo_type === 'full') { hasF = true; hasM = true; cores = bFC*S5_FULL_RATIO; passion = bFP*S5_FULL_RATIO; mult = 1+((S5_REVERSE_MULT[card.rarity]||1)-1)*S5_FULL_RATIO*eff }
    else continue
    const syn = chkSyn(card, card._godCard)
    const gB = getAttBonus(card._godCard, 'god', hasF, hasM, syn)
    const iB = getAttBonus(card._itemCard, 'item', hasF, hasM, false)
    const tb = 1 + (TEAM_SYNERGY_BONUS[tc[card.team_id]] || 0)
    if (hasF) { fC += cores*(1+gB.flatBoost)*(1+iB.flatBoost)*tb; fP += passion*(1+gB.flatBoost)*(1+iB.flatBoost)*tb }
    if (hasM) { tM += ((mult + gB.multAdd*eff + iB.multAdd*eff) - 1) * tb }
  }
  return { c: fC * tM, p: fP * tM }
}

function calcP(cards, tc, fs, ms) {
  let fC = 0, fP = 0, tM = 1.0
  for (const card of cards) {
    if (isRM(card)) continue
    const eff = card.isBench ? 0.5 : 1.0
    const bFC = (S5_FLAT_CORES[card.rarity]||0)*fs*eff
    const bFP = (S5_FLAT_PASSION[card.rarity]||0)*fs*eff
    let cores = 0, passion = 0, mult = 1, hasF = false, hasM = false
    if (card.holo_type === 'holo') { hasF = true; cores = bFC; passion = bFP }
    else if (card.holo_type === 'reverse') { hasM = true; mult = 1+((S5_REVERSE_MULT[card.rarity]||1)-1)*ms*eff }
    else if (card.holo_type === 'full') { hasF = true; hasM = true; cores = bFC*S5_FULL_RATIO; passion = bFP*S5_FULL_RATIO; mult = 1+((S5_REVERSE_MULT[card.rarity]||1)-1)*ms*S5_FULL_RATIO*eff }
    else continue
    const syn = chkSyn(card, card._godCard)
    const gB = getAttBonus(card._godCard, 'god', hasF, hasM, syn)
    const iB = getAttBonus(card._itemCard, 'item', hasF, hasM, false)
    const tb = 1 + (TEAM_SYNERGY_BONUS[tc[card.team_id]] || 0)
    if (hasF) { fC += cores*(1+gB.flatBoost)*(1+iB.flatBoost)*tb; fP += passion*(1+gB.flatBoost)*(1+iB.flatBoost)*tb }
    if (hasM) { tM += ((mult + gB.multAdd*eff + iB.multAdd*eff) - 1) * tb }
  }
  return { c: fC * tM, p: fP * tM }
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

  const users = []
  for (const data of Object.values(byUser)) {
    const cs = data.cards.filter(c => c.lineup_type === 'current'), as = data.cards.filter(c => c.lineup_type === 'allstar')
    const csTc = getTc(cs), asTc = getTc(as)
    const b = calcCurrent(cs, csTc), bA = calcCurrent(as, asTc)
    const curC = b.c + bA.c * S5_ALLSTAR_MODIFIER
    if (curC > 0) users.push({ u: data.u, cs, as, csTc, asTc, curC,
      rev: data.cards.filter(c => c.holo_type === 'reverse').length,
      holo: data.cards.filter(c => c.holo_type === 'holo').length,
    })
  }
  users.sort((a, b) => b.curC - a.curC)
  const topHalf = users.slice(0, Math.ceil(users.length / 2))

  const CONFIGS = [
    { label: '0.65/4.5', fs: 0.65, ms: 4.5 },
    { label: '0.68/4.5', fs: 0.68, ms: 4.5 },
    { label: '0.70/4.5', fs: 0.70, ms: 4.5 },
    { label: '0.70/5.0', fs: 0.70, ms: 5.0 },
    { label: '0.72/4.5', fs: 0.72, ms: 4.5 },
    { label: '0.72/5.0', fs: 0.72, ms: 5.0 },
    { label: '0.75/4.5', fs: 0.75, ms: 4.5 },
    { label: '0.75/5.0', fs: 0.75, ms: 5.0 },
  ]

  for (const u of users) {
    u.p = {}
    for (const cfg of CONFIGS) {
      const n1 = calcP(u.cs, u.csTc, cfg.fs, cfg.ms)
      const n2 = calcP(u.as, u.asTc, cfg.fs, cfg.ms)
      u.p[cfg.label] = n1.c + n2.c * S5_ALLSTAR_MODIFIER
    }
  }

  const med = a => { const s = [...a].sort((x,y) => x-y); return s.length%2 ? s[Math.floor(s.length/2)] : (s[s.length/2-1]+s[s.length/2])/2 }
  const avg = a => a.reduce((x,y) => x+y, 0)/a.length

  console.log(`\n${'='.repeat(130)}`)
  console.log('FINE-TUNE — top 50% active, all vs current (rflat) code')
  console.log(`${'='.repeat(130)}\n`)
  console.log('Metric'.padEnd(14) + 'Current'.padEnd(12) + CONFIGS.map(c => c.label.padEnd(14)).join(''))
  console.log('-'.repeat(130))
  for (const [label, fn] of [['Median', med], ['Average', avg], ['Max', a => Math.max(...a)]]) {
    const curA = topHalf.map(u => u.curC)
    console.log(label.padEnd(14) + fn(curA).toFixed(1).padEnd(12) + CONFIGS.map(c => fn(topHalf.map(u => u.p[c.label])).toFixed(1).padEnd(14)).join(''))
  }

  // Worst-hit reverse-heavy players
  console.log(`\n--- REVERSE-HEAVY (rev > holo, top 15 by current income): delta vs current ---\n`)
  const revH = users.filter(u => u.rev > u.holo).sort((a,b) => b.curC - a.curC).slice(0, 15)
  console.log('Username'.padEnd(20) + 'Cur'.padEnd(8) + CONFIGS.map(c => c.label.padEnd(14)).join(''))
  console.log('-'.repeat(130))
  for (const u of revH) {
    const deltas = CONFIGS.map(c => {
      const d = ((u.p[c.label] / u.curC - 1) * 100).toFixed(0)
      return `${u.p[c.label].toFixed(0)} (${d > 0 ? '+' : ''}${d}%)`.padEnd(14)
    }).join('')
    console.log((u.u||'?').slice(0,18).padEnd(20) + u.curC.toFixed(0).padEnd(8) + deltas)
  }
}

main().catch(e => { console.error(e); process.exit(1) })

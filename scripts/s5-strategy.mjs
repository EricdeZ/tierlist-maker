// Analyze optimal holo/reverse split under additive stacking with 2.5x flat scale
// Tests all possible H/R/F splits for a 5-slot lineup at each rarity tier

const S5_FLAT_CORES = { uncommon: 0.80, rare: 1.90, epic: 4.20, legendary: 8.10, mythic: 8.50, unique: 9.40 }
const S5_REVERSE_MULT = { uncommon: 1.15, rare: 1.25, epic: 1.46, legendary: 1.55, mythic: 1.60, unique: 1.76 }
const S5_FULL_RATIO = 0.44
const FLAT_SCALE = 2.5

// No attachments, no team synergy — just raw card split analysis
function calcOutput(holoCount, reverseCount, fullCount, rarity) {
  const flatPerHolo = S5_FLAT_CORES[rarity] * FLAT_SCALE
  const multPerReverse = S5_REVERSE_MULT[rarity]
  const flatPerFull = S5_FLAT_CORES[rarity] * FLAT_SCALE * S5_FULL_RATIO
  const multPerFull = 1 + (S5_REVERSE_MULT[rarity] - 1) * S5_FULL_RATIO

  const totalFlat = holoCount * flatPerHolo + fullCount * flatPerFull
  // Additive: totalMult = 1 + sum of (mult - 1)
  const totalMult = 1 + reverseCount * (multPerReverse - 1) + fullCount * (multPerFull - 1)

  return totalFlat * totalMult
}

// With team synergy (5 same team = +60%) and mythic god+item attachments
const S5_ATT_FLAT = {
  god:  { uncommon: 0.06, rare: 0.10, epic: 0.20, legendary: 0.29, mythic: 0.33, unique: 0.44 },
  item: { uncommon: 0.04, rare: 0.06, epic: 0.13, legendary: 0.18, mythic: 0.20, unique: 0.27 },
}
const S5_ATT_MULT = {
  god:  { uncommon: 0.030, rare: 0.050, epic: 0.100, legendary: 0.145, mythic: 0.160, unique: 0.215 },
  item: { uncommon: 0.015, rare: 0.025, epic: 0.050, legendary: 0.070, mythic: 0.078, unique: 0.108 },
}

function calcOutputFull(holoCount, reverseCount, fullCount, rarity, teamSynergy = 0, attRarity = null, godSynergy = false) {
  const tb = 1 + teamSynergy
  const flatBase = S5_FLAT_CORES[rarity] * FLAT_SCALE
  const multBase = S5_REVERSE_MULT[rarity]

  // Attachment bonuses (same rarity as card if attRarity not specified)
  const ar = attRarity || rarity
  const godFlatPct = S5_ATT_FLAT.god[ar] || 0
  const itemFlatPct = S5_ATT_FLAT.item[ar] || 0
  const godMultAdd = S5_ATT_MULT.god[ar] || 0
  const itemMultAdd = S5_ATT_MULT.item[ar] || 0
  const synMult = godSynergy ? 1.4 : 1.0

  // Per holo card: flat * (1 + godFlat*syn) * (1 + itemFlat) * teamBonus
  const flatPerHolo = flatBase * (1 + godFlatPct * synMult) * (1 + itemFlatPct) * tb
  // Per reverse card: additive mult bonus = (baseMult - 1 + godMultAdd + itemMultAdd) * teamBonus
  const multBonusPerReverse = ((multBase - 1) + godMultAdd * synMult + itemMultAdd) * tb
  // Per full card
  const flatPerFull = flatBase * S5_FULL_RATIO * (1 + godFlatPct * 0.6 * synMult) * (1 + itemFlatPct * 0.6) * tb
  const multBonusPerFull = ((multBase - 1) * S5_FULL_RATIO + godMultAdd * 0.6 * synMult + itemMultAdd * 0.6) * tb

  const totalFlat = holoCount * flatPerHolo + fullCount * flatPerFull
  const totalMult = 1 + reverseCount * multBonusPerReverse + fullCount * multBonusPerFull

  return totalFlat * totalMult
}

console.log('='.repeat(100))
console.log('OPTIMAL HOLO/REVERSE SPLIT — 5 main slots, additive stacking, 2.5x flat scale')
console.log('='.repeat(100))

for (const scenario of [
  { name: 'BARE (no attachments, no synergy)', teamSynergy: 0, attRarity: null, godSynergy: false, useFull: false },
  { name: 'WITH SAME-RARITY ATTACHMENTS + TEAM SYNERGY (5)', teamSynergy: 0.60, attRarity: null, godSynergy: false, useFull: false },
  { name: 'WITH ATTACHMENTS + TEAM SYNERGY + GOD SYNERGY', teamSynergy: 0.60, attRarity: null, godSynergy: true, useFull: false },
  { name: 'WITH FULL-ART CARDS ALLOWED', teamSynergy: 0.60, attRarity: null, godSynergy: true, useFull: true },
]) {
  console.log(`\n--- ${scenario.name} ---\n`)
  console.log('Rarity'.padEnd(12) + 'Best Split'.padEnd(16) + 'Cores/day'.padEnd(12) + '| All splits (H/R/F → cores/day)')
  console.log('-'.repeat(100))

  for (const rarity of ['uncommon', 'rare', 'epic', 'legendary', 'mythic']) {
    let best = { output: 0, h: 0, r: 0, f: 0 }
    const allSplits = []

    for (let h = 0; h <= 5; h++) {
      for (let r = 0; r <= 5 - h; r++) {
        const f = scenario.useFull ? 5 - h - r : 0
        if (!scenario.useFull && h + r !== 5) continue

        let output
        if (scenario.name.startsWith('BARE')) {
          output = calcOutput(h, r, f, rarity)
        } else {
          output = calcOutputFull(h, r, f, rarity, scenario.teamSynergy, scenario.attRarity, scenario.godSynergy)
        }

        allSplits.push({ h, r, f, output })
        if (output > best.output) best = { output, h, r, f }
      }
    }

    const bestStr = scenario.useFull
      ? `${best.h}H/${best.r}R/${best.f}F`
      : `${best.h}H/${best.r}R`
    const splitsStr = allSplits
      .sort((a, b) => b.output - a.output)
      .map(s => {
        const label = scenario.useFull ? `${s.h}/${s.r}/${s.f}` : `${s.h}/${s.r}`
        return `${label}=${s.output.toFixed(1)}`
      })
      .join('  ')

    console.log(
      rarity.padEnd(12) +
      bestStr.padEnd(16) +
      best.output.toFixed(1).padEnd(12) +
      '| ' + splitsStr
    )
  }
}

// Show how the optimal split changes the gap between rare and mythic
console.log(`\n${'='.repeat(100)}`)
console.log('RARITY REWARD SCALING (best split per rarity, with attachments + team + god synergy)')
console.log(`${'='.repeat(100)}\n`)

const baseline = {}
for (const rarity of ['uncommon', 'rare', 'epic', 'legendary', 'mythic']) {
  let best = 0
  for (let h = 0; h <= 5; h++) {
    const r = 5 - h
    const output = calcOutputFull(h, r, 0, rarity, 0.60, null, true)
    if (output > best) best = output
  }
  baseline[rarity] = best
}

const uncommonBase = baseline.uncommon
for (const [rarity, val] of Object.entries(baseline)) {
  console.log(`  ${rarity.padEnd(12)} ${val.toFixed(1).padEnd(10)} (${(val / uncommonBase).toFixed(1)}x uncommon)`)
}

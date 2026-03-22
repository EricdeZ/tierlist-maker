import { TEAM_SYNERGY_BONUS } from '../../../data/vault/economy'

/**
 * Count team members in a lineup's slots (by teamId), excluding role-mismatched cards.
 * Returns Map<teamId, count>
 */
export function getTeamCounts(slots) {
  const counts = new Map()
  if (!slots) return counts
  for (const slotData of Object.values(slots)) {
    if (!slotData?.card) continue
    if (slotData.roleMismatch) continue
    const tid = slotData.card.teamId || slotData.card.cardData?.teamId
    if (!tid) continue
    counts.set(tid, (counts.get(tid) || 0) + 1)
  }
  return counts
}

/**
 * Given current team count and whether adding a card would change it,
 * return { currentBonus, newBonus, label } or null if no synergy preview applies.
 */
export function getTeamSynergyPreview(teamId, currentTeamCounts) {
  const current = currentTeamCounts.get(teamId) || 0
  const after = current + 1
  if (after < 2) return null
  const currentBonus = TEAM_SYNERGY_BONUS[current] || 0
  const newBonus = TEAM_SYNERGY_BONUS[after] || TEAM_SYNERGY_BONUS[6] || 0
  // At the bonus cap (60%), no improvement to show
  if (newBonus === currentBonus && currentBonus > 0) return null
  if (currentBonus === 0) {
    return { currentBonus: 0, newBonus, label: `+${Math.round(newBonus * 100)}% team` }
  }
  return {
    currentBonus,
    newBonus,
    label: `${Math.round(currentBonus * 100)}%→${Math.round(newBonus * 100)}% team`,
  }
}

/**
 * Check if a god card name matches a player's best god (case-insensitive).
 */
export function isGodSynergy(godName, bestGodName) {
  if (!godName || !bestGodName) return false
  return godName.toLowerCase() === bestGodName.toLowerCase()
}

/**
 * Check if an attachment's holo type is compatible with a player's holo type.
 * Holo attachments boost flat income (only useful on holo/full players).
 * Reverse attachments boost mult (only useful on reverse/full players).
 * Full attachments provide both (useful on any player).
 */
export function isHoloCompatible(playerHoloType, attachHoloType) {
  if (attachHoloType === 'full') return true
  if (playerHoloType === 'full') return true
  return playerHoloType === attachHoloType
}

/**
 * Build team synergy opportunities for the Synergy Planner.
 * Scans the full collection + both lineups.
 *
 * Returns array of: { teamId, teamName, teamColor, owned, slottedCurrent, slottedAllStar,
 *   currentBonus, nextCount, nextBonus }
 * Sorted by most actionable first.
 */
export function buildTeamOpportunities(collection, csSlots, asSlots) {
  // Count all owned holo player cards by team
  const teamInfo = new Map() // teamId -> { teamName, teamColor, owned }
  for (const card of collection) {
    if ((card.cardType || card.card_type) !== 'player') continue
    if (!card.holoType) continue
    const tid = card.teamId || card.cardData?.teamId
    if (!tid) continue
    if (!teamInfo.has(tid)) {
      const name = card.cardData?.teamName || ''
      const color = card.cardData?.teamColor || '#6366f1'
      teamInfo.set(tid, { teamName: name, teamColor: color, owned: 0 })
    }
    teamInfo.get(tid).owned++
  }

  // Count slotted per lineup
  const csCounts = getTeamCounts(csSlots)
  const asCounts = getTeamCounts(asSlots)

  const results = []
  for (const [tid, info] of teamInfo) {
    if (info.owned < 2) continue
    const cs = csCounts.get(tid) || 0
    const as = asCounts.get(tid) || 0
    const maxSlotted = Math.max(cs, as)
    const currentBonus = TEAM_SYNERGY_BONUS[maxSlotted] || 0
    if (currentBonus === 0) continue
    const nextCount = maxSlotted + 1
    const nextBonus = TEAM_SYNERGY_BONUS[nextCount] || TEAM_SYNERGY_BONUS[6] || 0
    results.push({
      teamId: tid, teamName: info.teamName, teamColor: info.teamColor,
      owned: info.owned, slottedCurrent: cs, slottedAllStar: as,
      currentBonus, nextCount, nextBonus,
    })
  }

  // Sort: most improvable first (have unslotted cards that can increase bonus)
  results.sort((a, b) => {
    const aRoom = a.owned - Math.max(a.slottedCurrent, a.slottedAllStar)
    const bRoom = b.owned - Math.max(b.slottedCurrent, b.slottedAllStar)
    if (bRoom !== aRoom) return bRoom - aRoom
    return b.owned - a.owned
  })

  return results
}

/**
 * Build god synergy opportunities for the Synergy Planner.
 * Scans both lineups' slotted players and checks collection for matching god cards.
 *
 * Returns array of: { playerName, lineup, bestGodName, status, godCard }
 * status: 'matched' | 'available' | 'available-ineligible' | 'not-owned'
 * Sorted: available first, available-ineligible second, matched third, not-owned last.
 */
const RARITY_TIER = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5, unique: 6 }

export function buildGodOpportunities(csSlots, asSlots, collection) {
  const results = []

  const processSlots = (slots, lineupLabel) => {
    if (!slots) return
    for (const [role, slotData] of Object.entries(slots)) {
      if (!slotData?.card) continue
      const bestGod = slotData.card.bestGodName
      if (!bestGod) continue
      const playerRarity = slotData.card.rarity
      const playerHolo = slotData.card.holoType

      // Check if god card is already attached and is a synergy match
      if (slotData.godCard && isGodSynergy(slotData.godCard.godName, bestGod)) {
        const holoMatch = isHoloCompatible(playerHolo, slotData.godCard.holoType)
        results.push({ playerName: slotData.card.godName, lineup: lineupLabel, role, bestGodName: bestGod, status: 'matched', godCard: slotData.godCard, holoMatch })
        continue
      }

      // Search collection for matching god cards (name match + holo required)
      const matchingGods = collection.filter(c =>
        (c.cardType || 'god') === 'god' && c.holoType && isGodSynergy(c.godName, bestGod)
      )

      if (matchingGods.length === 0) {
        results.push({ playerName: slotData.card.godName, lineup: lineupLabel, role, bestGodName: bestGod, status: 'not-owned', godCard: null, holoMatch: false })
      } else {
        // Sort by holo compatibility first, then rarity descending
        matchingGods.sort((a, b) => {
          const aCompat = isHoloCompatible(playerHolo, a.holoType) ? 1 : 0
          const bCompat = isHoloCompatible(playerHolo, b.holoType) ? 1 : 0
          if (bCompat !== aCompat) return bCompat - aCompat
          return (RARITY_TIER[b.rarity] || 0) - (RARITY_TIER[a.rarity] || 0)
        })
        const best = matchingGods[0]
        const holoMatch = isHoloCompatible(playerHolo, best.holoType)
        // Check if the best card is actually attachable (rarity floor check)
        const playerTier = RARITY_TIER[playerRarity] || 0
        const godTier = RARITY_TIER[best.rarity] || 0
        const meetsRarity = godTier >= playerTier || (playerRarity === 'unique' && best.rarity === 'mythic')
        const status = meetsRarity ? 'available' : 'available-ineligible'
        results.push({ playerName: slotData.card.godName, lineup: lineupLabel, role, bestGodName: bestGod, status, godCard: best, holoMatch })
      }
    }
  }

  processSlots(csSlots, 'Current Season')
  processSlots(asSlots, 'All-Star')

  // Sort: available > matched > not-owned
  const order = { available: 0, 'available-ineligible': 1, matched: 2, 'not-owned': 3 }
  results.sort((a, b) => (order[a.status] || 9) - (order[b.status] || 9))

  return results
}

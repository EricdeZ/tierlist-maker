# Starting 5: Synergy Discoverability QoL — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Starting 5 synergies (team + god) discoverable before committing to a slot — smart pickers with filters/indicators, plus a read-only Synergy Planner panel.

**Architecture:** All changes are client-side except two backend one-liners (`teamId` in `formatCard` + `d.team_id` in collection query). The pickers get filtering and synergy indicators computed from existing slot/collection data. A new `SynergyPlanner` component (extracted to its own file) aggregates synergy opportunities across both lineups.

**Tech Stack:** React 19, Tailwind CSS 4, existing vault economy constants

**Spec:** `docs/superpowers/specs/2026-03-21-s5-synergy-qol-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `functions/api/vault.js:167` | Add `d.team_id` to collection query |
| Modify | `functions/api/vault.js:2511` | Add `teamId` to `formatCard()` |
| Modify | `src/pages/vault/CCStartingFive.jsx:772-783` | Pass `slottedCards` to `CardPicker` for team synergy preview |
| Modify | `src/pages/vault/CCStartingFive.jsx:1564-1640` | `CardPicker` — add team filter bar + synergy preview |
| Modify | `src/pages/vault/CCStartingFive.jsx:785-797` | Thread `bestGodName` into `AttachmentPicker` call |
| Modify | `src/pages/vault/CCStartingFive.jsx:1643-1727` | `AttachmentPicker` — add synergy-first sorting + divider |
| Modify | `src/pages/vault/CCStartingFive.jsx:1730-1810` | `PickerCard` — add synergy badge + team synergy indicator |
| Modify | `src/pages/vault/CCStartingFive.jsx:680` | Insert `<SynergyPlanner>` between income summary and lineup slots |
| Create | `src/pages/vault/starting-five/SynergyPlanner.jsx` | Synergy Planner panel component |
| Create | `src/pages/vault/starting-five/synergyHelpers.js` | Pure helper functions for synergy calculations |

---

## Task 1: Expose `teamId` in backend

**Files:**
- Modify: `functions/api/vault.js:167` (collection query)
- Modify: `functions/api/vault.js:2509-2512` (formatCard)

- [ ] **Step 1: Add `d.team_id` to the collection query**

At `functions/api/vault.js:167`, the collection query selects `d.best_god_name, d.player_id AS def_player_id`. Add `d.team_id` to this SELECT:

```sql
SELECT c.*, d.best_god_name, d.team_id, d.player_id AS def_player_id,
```

Without this, collection cards would have `team_id = null` since `card_data` JSONB stores `teamName`/`teamColor` but not `teamId`.

- [ ] **Step 2: Add `teamId` to `formatCard()`**

In `functions/api/vault.js`, inside `formatCard()`, add `teamId` after the `bestGodName` line (line 2509):

```js
    bestGodName: row.best_god_name || null,
    teamId: row.team_id || row.card_data?.teamId || null,
    defPlayerId: row.def_player_id || null,
```

- [ ] **Step 3: Verify locally**

Run: `npm run dev:api` — confirm no startup errors. Hit any vault endpoint that returns cards and verify `teamId` appears in the JSON response for player-type cards.

- [ ] **Step 4: Commit**

```bash
git add functions/api/vault.js
git commit -m "feat(vault): expose teamId in collection query + formatCard for S5 synergy matching"
```

---

## Task 2: Synergy helper functions

Pure functions with no UI dependencies — used by both pickers and planner.

**Files:**
- Create: `src/pages/vault/starting-five/synergyHelpers.js`

- [ ] **Step 1: Create the helpers file**

```js
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
 * Mirrors server-side checkSynergy in functions/lib/starting-five.js:108-111.
 */
export function isGodSynergy(godName, bestGodName) {
  if (!godName || !bestGodName) return false
  return godName.toLowerCase() === bestGodName.toLowerCase()
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

      // Check if god card is already attached and is a synergy match
      if (slotData.godCard && isGodSynergy(slotData.godCard.godName, bestGod)) {
        results.push({ playerName: slotData.card.godName, lineup: lineupLabel, role, bestGodName: bestGod, status: 'matched', godCard: slotData.godCard })
        continue
      }

      // Search collection for matching god cards (name match + holo required)
      const matchingGods = collection.filter(c =>
        (c.cardType || 'god') === 'god' && c.holoType && isGodSynergy(c.godName, bestGod)
      )

      if (matchingGods.length === 0) {
        results.push({ playerName: slotData.card.godName, lineup: lineupLabel, role, bestGodName: bestGod, status: 'not-owned', godCard: null })
      } else {
        // Sort by rarity descending to pick the best card
        matchingGods.sort((a, b) => (RARITY_TIER[b.rarity] || 0) - (RARITY_TIER[a.rarity] || 0))
        const best = matchingGods[0]
        // Check if the best card is actually attachable (rarity floor check)
        const playerTier = RARITY_TIER[playerRarity] || 0
        const godTier = RARITY_TIER[best.rarity] || 0
        const meetsRarity = godTier >= playerTier || (playerRarity === 'unique' && best.rarity === 'mythic')
        const status = meetsRarity ? 'available' : 'available-ineligible'
        results.push({ playerName: slotData.card.godName, lineup: lineupLabel, role, bestGodName: bestGod, status, godCard: best })
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
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/vault/starting-five/synergyHelpers.js
git commit -m "feat(vault): S5 synergy helper functions for pickers and planner"
```

---

## Task 3: Team filter bar in Player Card Picker

**Files:**
- Modify: `src/pages/vault/CCStartingFive.jsx:772-783` (CardPicker call site)
- Modify: `src/pages/vault/CCStartingFive.jsx:1564-1640` (CardPicker component)

- [ ] **Step 1: Pass `activeSlots` to CardPicker**

At the `CardPicker` render site (~line 772), add `activeSlots={slots}` prop:

```jsx
      {pickerRole && (
        <CardPicker
          role={pickerRole}
          collection={collection}
          slottedCards={slottedCards}
          allSlottedIds={allSlottedIds}
          activeSlots={slots}
          onSelect={handleSlot}
          onClose={() => setPickerRole(null)}
          slotting={slotting}
          getDefOverride={getDefOverride}
          isBench={pickerRole === 'bench'}
        />
      )}
```

- [ ] **Step 2: Add team filter state and synergy preview to CardPicker**

Update the `CardPicker` function signature to accept `activeSlots`:

```jsx
function CardPicker({ role, collection, slottedCards, allSlottedIds, activeSlots, onSelect, onClose, slotting, getDefOverride, isBench }) {
```

Add state and computed values after existing `useMemo` for `eligibleCards`:

```jsx
  const [teamFilter, setTeamFilter] = useState(null)

  // Build team options from eligible cards
  const teamOptions = useMemo(() => {
    const teams = new Map()
    for (const card of eligibleCards) {
      const tid = card.teamId || card.cardData?.teamId
      const name = card.cardData?.teamName || ''
      const color = card.cardData?.teamColor || '#6366f1'
      if (!tid || !name) continue
      if (!teams.has(tid)) teams.set(tid, { teamId: tid, teamName: name, teamColor: color, count: 0 })
      teams.get(tid).count++
    }
    return [...teams.values()].sort((a, b) => b.count - a.count)
  }, [eligibleCards])

  // Filter by selected team
  const displayCards = useMemo(() => {
    if (!teamFilter) return eligibleCards
    return eligibleCards.filter(c => (c.teamId || c.cardData?.teamId) === teamFilter)
  }, [eligibleCards, teamFilter])

  // Team counts in active lineup for synergy preview
  const activeTeamCounts = useMemo(() => {
    return getTeamCounts(activeSlots)
  }, [activeSlots])
```

Add the import at the top of the file:

```js
import { getTeamCounts, getTeamSynergyPreview } from './starting-five/synergyHelpers'
```

- [ ] **Step 3: Render the team filter bar**

Inside `CardPicker`'s return, between the header `</div>` and the card grid `<div>`, add the filter bar:

```jsx
        {/* Team filter bar */}
        {teamOptions.length > 1 && (
          <div className="flex items-center gap-2 px-5 py-3 border-b border-[var(--cd-border)] overflow-x-auto">
            <button
              onClick={() => setTeamFilter(null)}
              className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-bold cd-head tracking-wider transition-colors cursor-pointer ${
                !teamFilter ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/50'
              }`}
            >
              All ({eligibleCards.length})
            </button>
            {teamOptions.map(t => (
              <button
                key={t.teamId}
                onClick={() => setTeamFilter(teamFilter === t.teamId ? null : t.teamId)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold cd-head tracking-wider transition-colors cursor-pointer ${
                  teamFilter === t.teamId ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/50'
                }`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.teamColor }} />
                {t.teamName} ({t.count})
              </button>
            ))}
          </div>
        )}
```

- [ ] **Step 4: Switch card grid to use `displayCards`**

In the card grid section, replace `eligibleCards` references with `displayCards`:

```jsx
          {displayCards.length === 0 ? (
            ...empty state...
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
              {displayCards.map(card => (
                <PickerCard
                  key={card.id}
                  card={card}
                  onSelect={() => onSelect(card.id, role)}
                  disabled={slotting}
                  override={getDefOverride(card)}
                  teamSynergyPreview={getTeamSynergyPreview(
                    card.teamId || card.cardData?.teamId,
                    activeTeamCounts
                  )}
                />
              ))}
            </div>
          )}
```

- [ ] **Step 5: Add `teamSynergyPreview` display to PickerCard**

Update `PickerCard` to accept and render the preview. Add `teamSynergyPreview` to destructured props:

```jsx
function PickerCard({ card, onSelect, disabled, override, holoMismatch, teamSynergyPreview }) {
```

After the existing income display section (after the `attachBonus` rendering), add:

```jsx
      {teamSynergyPreview && !holoMismatch && (
        <div className="text-[9px] font-bold cd-head text-sky-400 mt-0.5">
          {teamSynergyPreview.label}
        </div>
      )}
```

- [ ] **Step 6: Verify locally**

Run: `npm start` — open Starting 5, click a slot to open the player picker. Confirm:
1. Team filter bar appears with team-colored swatches
2. Clicking a team filters the grid
3. Cards show "+20% team" preview if slotting would create synergy

- [ ] **Step 7: Commit**

```bash
git add src/pages/vault/CCStartingFive.jsx
git commit -m "feat(vault): S5 player picker team filter bar + synergy preview"
```

---

## Task 4: God synergy sorting + divider in Attachment Picker

**Files:**
- Modify: `src/pages/vault/CCStartingFive.jsx:785-797` (AttachmentPicker call site)
- Modify: `src/pages/vault/CCStartingFive.jsx:1643-1727` (AttachmentPicker component)

- [ ] **Step 1: Thread `bestGodName` into AttachmentPicker**

At the `AttachmentPicker` render site (~line 786), add `bestGodName` prop:

```jsx
      {attachPickerState && (
        <AttachmentPicker
          role={attachPickerState.role}
          slotType={attachPickerState.slotType}
          collection={collection}
          allSlottedIds={allSlottedIds}
          playerRarity={slottedCards[attachPickerState.role]?.rarity}
          playerHoloType={slottedCards[attachPickerState.role]?.holoType}
          bestGodName={slottedCards[attachPickerState.role]?.bestGodName}
          onSelect={handleAttachSlot}
          onClose={() => setAttachPickerState(null)}
          slotting={slotting}
          getDefOverride={getDefOverride}
        />
      )}
```

- [ ] **Step 2: Add synergy sorting and section divider to AttachmentPicker**

Update function signature:

```jsx
function AttachmentPicker({ role, slotType, collection, allSlottedIds, playerRarity, playerHoloType, bestGodName, onSelect, onClose, slotting, getDefOverride }) {
```

In the `eligibleCards` useMemo, after the existing `.map()` that adds `_holoMismatch`, chain on synergy detection and update the sort:

```jsx
  const { synergyCards, otherCards } = useMemo(() => {
    const eligible = collection
      .filter(card => {
        const type = getCardType(card)
        if (type !== slotType) return false
        if (!card.holoType) return false
        if ((RARITY_TIER[card.rarity] || 0) < playerTier && !(playerRarity === 'unique' && card.rarity === 'mythic')) return false
        if (slotType === 'god' && role !== 'bench') {
          const cardRole = (card.role || card.cardData?.role || '').toLowerCase()
          if (cardRole !== role && cardRole !== 'fill') return false
        }
        if (allSlottedIds.has(card.id)) return false
        return true
      })
      .map(card => ({
        ...card,
        _holoMismatch: !isHoloMatch(playerHoloType, card.holoType),
        _isSynergy: slotType === 'god' && isGodSynergy(card.godName, bestGodName),
      }))

    const sortFn = (a, b) => {
      if (a._holoMismatch !== b._holoMismatch) return a._holoMismatch ? 1 : -1
      const rDiff = (RARITY_TIER[b.rarity] || 0) - (RARITY_TIER[a.rarity] || 0)
      if (rDiff !== 0) return rDiff
      return (a.godName || '').localeCompare(b.godName || '')
    }

    if (slotType !== 'god' || !bestGodName) {
      return { synergyCards: [], otherCards: eligible.sort(sortFn) }
    }
    return {
      synergyCards: eligible.filter(c => c._isSynergy).sort(sortFn),
      otherCards: eligible.filter(c => !c._isSynergy).sort(sortFn),
    }
  }, [collection, allSlottedIds, role, slotType, playerTier, playerHoloType, bestGodName])
```

Add the import for `isGodSynergy` (already added in Task 3's import line — just append):

```js
import { getTeamCounts, getTeamSynergyPreview, isGodSynergy } from './starting-five/synergyHelpers'
```

- [ ] **Step 3: Render synergy section divider**

Replace the existing card grid JSX inside AttachmentPicker with sectioned rendering:

```jsx
        <div className="p-5 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 70px)' }}>
          {synergyCards.length === 0 && otherCards.length === 0 ? (
            <div className="text-center py-12 text-white/30">
              {roleIcon && <img src={roleIcon} alt="" className="w-10 h-10 mx-auto mb-3 opacity-20 object-contain" />}
              <p className="text-sm cd-head tracking-wider">No eligible {slotType} cards</p>
              <p className="text-xs text-white/20 mt-1">
                {slotType === 'god'
                  ? `Need a holo god card with ${roleInfo?.label} role, ${playerRarity}+ rarity`
                  : `Need a holo item card, ${playerRarity}+ rarity`
                }
              </p>
            </div>
          ) : (
            <>
              {synergyCards.length > 0 && (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[11px] font-bold cd-head text-emerald-400 tracking-wider">SYNERGY MATCHES</span>
                    <span className="text-[10px] text-emerald-400/50 cd-head">+40% bonus</span>
                    <div className="flex-1 h-px bg-emerald-400/10" />
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 mb-5">
                    {synergyCards.map(card => (
                      <PickerCard
                        key={card.id}
                        card={card}
                        onSelect={() => onSelect(card.id, role, slotType)}
                        disabled={slotting}
                        override={getDefOverride(card)}
                        holoMismatch={card._holoMismatch}
                        isSynergy
                      />
                    ))}
                  </div>
                </>
              )}
              {otherCards.length > 0 && (
                <>
                  {synergyCards.length > 0 && (
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[11px] font-bold cd-head text-white/30 tracking-wider">OTHER GODS</span>
                      <div className="flex-1 h-px bg-white/[0.06]" />
                    </div>
                  )}
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                    {otherCards.map(card => (
                      <PickerCard
                        key={card.id}
                        card={card}
                        onSelect={() => onSelect(card.id, role, slotType)}
                        disabled={slotting}
                        override={getDefOverride(card)}
                        holoMismatch={card._holoMismatch}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
```

- [ ] **Step 4: Add synergy badge to PickerCard**

Add `isSynergy` to `PickerCard` destructured props:

```jsx
function PickerCard({ card, onSelect, disabled, override, holoMismatch, teamSynergyPreview, isSynergy }) {
```

After the card name display, add a synergy badge:

```jsx
      {isSynergy && !holoMismatch && (
        <div className="text-[8px] font-bold cd-head text-emerald-400 tracking-wider mt-0.5">SYNERGY</div>
      )}
```

- [ ] **Step 5: Verify locally**

Run: `npm start` — open Starting 5, slot a player card, then click the god attachment slot. Confirm:
1. God cards matching the player's best god appear in a "SYNERGY MATCHES" section at the top
2. Each synergy card shows a "SYNERGY" badge
3. Non-synergy cards appear below in "OTHER GODS" section
4. Item picker is unchanged (no sections)

- [ ] **Step 6: Commit**

```bash
git add src/pages/vault/CCStartingFive.jsx
git commit -m "feat(vault): S5 god attachment picker synergy sorting + divider"
```

---

## Task 5: Synergy Planner component

**Files:**
- Create: `src/pages/vault/starting-five/SynergyPlanner.jsx`

- [ ] **Step 1: Create the SynergyPlanner component**

```jsx
import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp, Users, Sparkles, Check, AlertCircle } from 'lucide-react'
import { TEAM_SYNERGY_BONUS } from '../../../data/vault/economy'
import { buildTeamOpportunities, buildGodOpportunities } from './synergyHelpers'
import { RARITIES } from '../../../data/vault/economy'

export default function SynergyPlanner({ collection, startingFive }) {
  const [expanded, setExpanded] = useState(false)

  const csSlots = startingFive?.currentSeason?.slots
  const asSlots = startingFive?.allStar?.slots

  const teamOpps = useMemo(
    () => buildTeamOpportunities(collection, csSlots, asSlots),
    [collection, csSlots, asSlots]
  )

  const godOpps = useMemo(
    () => buildGodOpportunities(csSlots, asSlots, collection),
    [csSlots, asSlots, collection]
  )

  const actionableCount = teamOpps.filter(t => t.owned > Math.max(t.slottedCurrent, t.slottedAllStar)).length
    + godOpps.filter(g => g.status === 'available').length

  if (teamOpps.length === 0 && godOpps.length === 0) return null

  return (
    <div className="cd-panel cd-corners rounded-xl mb-6 sm:mb-8 overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 sm:px-5 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-[var(--cd-cyan)]" />
          <span className="text-xs font-bold cd-head tracking-wider text-white/60">SYNERGY PLANNER</span>
          {actionableCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold cd-head bg-[var(--cd-cyan)]/10 text-[var(--cd-cyan)]">
              {actionableCount} tip{actionableCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={14} className="text-white/30" /> : <ChevronDown size={14} className="text-white/30" />}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-5 border-t border-[var(--cd-border)]">

          {/* Team Synergy Section */}
          {teamOpps.length > 0 && (
            <div className="pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Users size={12} className="text-sky-400" />
                <span className="text-[11px] font-bold cd-head text-sky-400 tracking-wider">TEAM SYNERGY</span>
              </div>
              <div className="space-y-2">
                {teamOpps.map(t => {
                  const maxSlotted = Math.max(t.slottedCurrent, t.slottedAllStar)
                  const room = t.owned - maxSlotted
                  return (
                    <div key={t.teamId} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-white/[0.02]">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.teamColor }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white/70 cd-head truncate">{t.teamName}</span>
                          <span className="text-[10px] text-white/30 cd-num">{t.owned} owned</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-white/40">
                          {t.slottedCurrent > 0 && <span>{t.slottedCurrent} in Current</span>}
                          {t.slottedCurrent > 0 && t.slottedAllStar > 0 && <span className="text-white/15">·</span>}
                          {t.slottedAllStar > 0 && <span>{t.slottedAllStar} in All-Star</span>}
                          {maxSlotted === 0 && <span className="text-white/25">none slotted</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {t.currentBonus > 0 ? (
                          <div className="text-[11px] font-bold cd-head text-sky-400">+{Math.round(t.currentBonus * 100)}%</div>
                        ) : (
                          <div className="text-[11px] font-bold cd-head text-white/20">—</div>
                        )}
                        {room > 0 && t.nextBonus > t.currentBonus && (
                          <div className="text-[9px] text-white/30 cd-head">
                            +1 → {Math.round(t.nextBonus * 100)}%
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* God Synergy Section */}
          {godOpps.length > 0 && (
            <div className={teamOpps.length > 0 ? '' : 'pt-4'}>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={12} className="text-emerald-400" />
                <span className="text-[11px] font-bold cd-head text-emerald-400 tracking-wider">GOD SYNERGY</span>
              </div>
              <div className="space-y-2">
                {godOpps.map((g, i) => {
                  const rarityColor = RARITIES[g.godCard?.rarity]?.color || '#9ca3af'
                  return (
                    <div key={`${g.lineup}-${g.role}-${i}`} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-white/[0.02]">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white/70 cd-head truncate">{g.playerName}</span>
                          <span className="text-[10px] text-white/25 cd-head">{g.lineup}</span>
                        </div>
                        <div className="text-[10px] text-white/40 mt-0.5">
                          Best god: <span className="text-white/60">{g.bestGodName}</span>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {g.status === 'matched' && (
                          <div className="flex items-center gap-1 text-emerald-400">
                            <Check size={12} />
                            <span className="text-[10px] font-bold cd-head">MATCHED</span>
                          </div>
                        )}
                        {g.status === 'available' && (
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] font-bold cd-head text-amber-400">AVAILABLE</span>
                            <span className="text-[9px] cd-head" style={{ color: rarityColor }}>
                              {g.godCard.rarity} {g.godCard.holoType}
                            </span>
                          </div>
                        )}
                        {g.status === 'available-ineligible' && (
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] font-bold cd-head text-white/30">OWNED</span>
                            <span className="text-[9px] cd-head text-white/20">rarity too low</span>
                          </div>
                        )}
                        {g.status === 'not-owned' && (
                          <div className="flex items-center gap-1 text-white/20">
                            <AlertCircle size={11} />
                            <span className="text-[10px] font-bold cd-head">NOT OWNED</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/vault/starting-five/SynergyPlanner.jsx
git commit -m "feat(vault): S5 Synergy Planner panel component"
```

---

## Task 6: Wire SynergyPlanner into CCStartingFive

**Files:**
- Modify: `src/pages/vault/CCStartingFive.jsx:1,680`

- [ ] **Step 1: Import SynergyPlanner**

Add to the imports at the top of `CCStartingFive.jsx`:

```js
import SynergyPlanner from './starting-five/SynergyPlanner'
```

- [ ] **Step 2: Insert SynergyPlanner between income summary and lineup slots**

At ~line 680 (after the income hero numbers IIFE `})()}` and before the `{/* 5 Role Slots */}` comment), insert:

```jsx
      <SynergyPlanner collection={collection} startingFive={startingFive} />
```

- [ ] **Step 3: Verify locally**

Run: `npm start` — open Starting 5. Confirm:
1. "SYNERGY PLANNER" header appears between income summary and lineup slots
2. Shows tip count badge if there are actionable opportunities
3. Clicking expands to show Team Synergy and God Synergy sections
4. Team section shows teams sorted by opportunity with bonus tiers
5. God section shows matched/available/not-owned status per player
6. Panel collapses back when clicking header again

- [ ] **Step 4: Commit**

```bash
git add src/pages/vault/CCStartingFive.jsx
git commit -m "feat(vault): wire SynergyPlanner into S5 view"
```

---

## Task 7: Final integration verification

**Files:** None (testing only)

- [ ] **Step 1: Full flow test**

Run: `npm start` — test the complete flow:

1. Open Starting 5 with an empty lineup → Synergy Planner should show opportunities based on collection
2. Slot 2 players from the same team → verify team synergy appears in planner and lineup
3. Open player picker for a third slot → verify team filter bar works, synergy preview shows "+30% team" for same-team cards
4. Attach a god card → verify synergy matches appear at top of attachment picker with "SYNERGY MATCHES" divider
5. Switch to All-Star tab → verify planner shows holistic view noting cards in both lineups
6. Collapse/expand planner → verify toggle works

- [ ] **Step 2: Edge case checks**

- Player with no `bestGodName` → no god synergy row in planner, no synergy section in attachment picker
- Only 1 card from a team in collection → team should NOT appear in planner
- Role-mismatch card slotted → should NOT count toward team synergy in preview or planner
- All god synergies already matched → god section should show all green checkmarks
- Empty collection → planner should not render at all

- [ ] **Step 3: Mobile responsive check**

- Team filter bar should scroll horizontally on small screens
- Synergy Planner should stack properly on mobile widths
- Attachment picker sections should work in 3-column mobile grid

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: No new errors.

- [ ] **Step 5: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "feat(vault): S5 synergy discoverability QoL — complete"
```

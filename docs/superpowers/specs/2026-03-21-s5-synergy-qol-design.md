# Starting 5: Synergy Discoverability QoL

**Date:** 2026-03-21
**Status:** Approved

## Problem

Starting 5 synergies (team synergy and god synergy) are only visible after committing to a slotting decision. The card pickers are flat lists with no filtering or synergy indicators. Users are confused about what synergies exist and how to optimize their lineups.

## Solution

Two complementary improvements:

1. **Smart Pickers** — enhance existing card pickers with filtering, synergy indicators, and preview information
2. **Synergy Planner** — a new read-only collapsible panel showing collection-wide synergy opportunities across both lineups

---

## 1. Smart Pickers

### Player Card Picker

**Team filter bar** — horizontal scrollable row of team color swatches + names at the top of the picker modal.
- Uses `cardData.teamColor` for swatches (team logos not available on collection cards)
- Only shows teams that have eligible cards in the filtered list
- Count badge per team (e.g. "Leviathans (4)")
- "All" option selected by default
- Tapping a team filters the card grid to that team only

**Team synergy preview** — on each card in the picker grid, below existing income stats:
- If slotting this player would create or improve a team synergy in the current lineup, show an indicator
- Format: "+20% team" (new synergy) or "20%→30% team" (upgrade existing)
- Calculated by counting how many cards from that player's team (by `teamId`) are already slotted in the active lineup, including the bench slot
- Role-mismatch cards (already slotted but flagged `roleMismatch`) are excluded from team synergy count, matching server-side logic
- No indicator if no team synergy would result (< 2 teammates after slotting)

### God Attachment Picker

**New prop required:** `AttachmentPicker` needs the slotted player's `bestGodName` threaded in (available from `slottedCards[role].bestGodName`).

**Synergy-first sorting** — god cards matching the player's `bestGodName` (case-insensitive, matching `checkSynergy` in `starting-five.js`) sort above all other eligible cards, regardless of rarity.

**Synergy section divider** — visual separator splitting the grid:
- Top section: "Synergy Matches" header — god cards that trigger the +40% synergy bonus
- Bottom section: "Other Gods" header — remaining eligible god cards in standard rarity sort

**Synergy badge on cards** — each synergy-matching god card gets a small "SYNERGY" badge visible in the picker, so the benefit is clear before selecting.

### Item Attachment Picker

No changes (no synergy mechanic for items).

---

## 2. Synergy Planner

### Placement & Behavior

- New component: `src/pages/vault/starting-five/SynergyPlanner.jsx` (extracted from main file to follow project split pattern)
- Collapsible panel within the Starting 5 view, above the lineup slots (below the income summary)
- Collapsed by default, header: "Synergy Planner" with an icon
- Expands inline (not a modal)
- Shows data from full collection across both lineups (holistic view)

### Team Synergy Section

A list of teams sorted by opportunity (most actionable first). Each entry shows:

| Field | Description |
|-------|-------------|
| Team name + color | Team color swatch + name (from `cardData.teamColor`/`teamName`) |
| Eligible cards owned | Count of holo player cards for this team in collection |
| Currently slotted | Count slotted, with lineup noted (e.g. "2 in Current, 1 in All-Star") |
| Bonus tier | Current bonus and next tier (e.g. "2 slotted → +20%, slot 1 more → +30%") |
| Unavailable cards | Cards locked in the other lineup shown dimmed/noted |

**Team matching:** Uses integer `teamId` (not string `teamName`) to avoid cross-league name collisions. Requires exposing `team_id` through `formatCard()` in vault.js (see Backend section).

**Filtering rules:**
- Only shows teams where user owns 2+ eligible holo player cards (below that, synergy is impossible)
- "Eligible" = any holo player card owned (has `holoType`), regardless of binder/marketplace lock state — planner shows potential, not just immediately actionable moves
- Role-mismatch slotted cards excluded from synergy counts
- Sorted by: teams with the most actionable slots first (have unslotted cards that could improve a bonus tier)

### God Synergy Section

A list of god synergy opportunities across all slotted players in both lineups. Each entry shows:

| Field | Description |
|-------|-------------|
| Player name | The slotted player card |
| Lineup | Which lineup they're in (Current Season / All-Star) |
| Best god | The player's `bestGodName` |
| Status | One of: "Matched" (checkmark), "Available" (in collection, not attached), "Available (ineligible)" (exists but can't attach due to rarity/role/holo mismatch), "Not Owned" |
| Card details | For "Available" status: the god card's rarity and holo type |

**God name matching:** Case-insensitive comparison of `godName` to `bestGodName`, matching the server-side `checkSynergy` function.

**Sorting:**
1. Available and attachable (actionable opportunities) — first
2. Available but ineligible (awareness) — second
3. Already matched — third
4. Not owned — last (grayed out)

### Behavior

- Read-only — no auto-slotting or "apply lineup" actions
- Users see opportunities, then navigate to slots and picker to act on them manually
- Data refreshes when Starting 5 state changes (slot/unslot)

---

## Files Affected

### Frontend (modify)
- `src/pages/vault/CCStartingFive.jsx` — Add team filter bar + synergy preview to `CardPicker`, add `bestGodName` prop + synergy sorting/divider to `AttachmentPicker`

### Frontend (new)
- `src/pages/vault/starting-five/SynergyPlanner.jsx` — Synergy Planner panel component

### Backend (modify)
- `functions/api/vault.js` — Add `teamId` to `formatCard()` output (one-line: `teamId: row.team_id || row.card_data?.teamId || null`)

### Data
- No database changes
- No new API endpoints
- Economy constants (`src/data/vault/economy.js`) already exported: `TEAM_SYNERGY_BONUS` thresholds used for planner calculations

---

## Out of Scope

- Auto-slotting / "apply recommended lineup"
- Item attachment picker changes
- Synergy notifications or push alerts
- Changes to synergy mechanics themselves (bonus values, stacking rules)
- Leaderboard changes
- Collapsed/expanded state persistence (can add later if needed)

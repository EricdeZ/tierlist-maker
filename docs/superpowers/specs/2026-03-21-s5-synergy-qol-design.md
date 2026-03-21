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

**Team filter bar** — horizontal scrollable row of team badges at the top of the picker modal.
- Only shows teams that have eligible cards in the filtered list
- Count badge per team (e.g. "Leviathans (4)")
- "All" option selected by default
- Tapping a team filters the card grid to that team only

**Team synergy preview** — on each card in the picker grid, below existing income stats:
- If slotting this player would create or improve a team synergy in the current lineup, show an indicator
- Format: "+20% team" (new synergy) or "20%→30% team" (upgrade existing)
- Calculated by counting how many cards from that player's team are already slotted in the active lineup
- No indicator if no team synergy would result (< 2 teammates after slotting)

### God Attachment Picker

**Synergy-first sorting** — god cards matching the player's `bestGodName` sort above all other eligible cards, regardless of rarity.

**Synergy section divider** — visual separator splitting the grid:
- Top section: "Synergy Matches" header — god cards that trigger the +40% synergy bonus
- Bottom section: "Other Gods" header — remaining eligible god cards in standard rarity sort

**Synergy badge on cards** — each synergy-matching god card gets a small "SYNERGY" badge visible in the picker, so the benefit is clear before selecting.

### Item Attachment Picker

No changes (no synergy mechanic for items).

---

## 2. Synergy Planner

### Placement & Behavior

- Collapsible panel within the Starting 5 view, above the lineup slots (below the income summary)
- Collapsed by default, header: "Synergy Planner" with an icon
- Expands inline (not a modal)
- Shows data from full collection across both lineups (holistic view)

### Team Synergy Section

A list of teams sorted by opportunity (most actionable first). Each entry shows:

| Field | Description |
|-------|-------------|
| Team name + color | Team badge/swatch |
| Eligible cards owned | Count of holo player cards for this team in collection |
| Currently slotted | Count slotted, with lineup noted (e.g. "2 in Current, 1 in All-Star") |
| Bonus tier | Current bonus and next tier (e.g. "2 slotted → +20%, slot 1 more → +30%") |
| Unavailable cards | Cards locked in the other lineup shown dimmed/noted |

**Filtering rules:**
- Only shows teams where user owns 2+ eligible holo player cards (below that, synergy is impossible)
- Sorted by: teams with the most actionable slots first (have unslotted cards that could improve a bonus tier)

### God Synergy Section

A list of god synergy opportunities across all slotted players in both lineups. Each entry shows:

| Field | Description |
|-------|-------------|
| Player name | The slotted player card |
| Lineup | Which lineup they're in (Current Season / All-Star) |
| Best god | The player's `bestGodName` |
| Status | One of: "Matched" (checkmark, god card attached), "Available" (god card in collection, not attached), "Not Owned" (no matching god card) |
| Card details | For "Available" status: the god card's rarity and holo type |

**Sorting:**
1. Available but unattached (actionable opportunities) — first
2. Already matched — second
3. Not owned — last (grayed out)

### Behavior

- Read-only — no auto-slotting or "apply lineup" actions
- Users see opportunities, then navigate to slots and picker to act on them manually
- Data refreshes when Starting 5 state changes (slot/unslot)

---

## Files Affected

### Frontend (modify)
- `src/pages/vault/CCStartingFive.jsx` — Add team filter bar + synergy preview to `CardPicker`, add synergy sorting + divider to `AttachmentPicker`, add `SynergyPlanner` panel

### Backend
- No backend changes required — all synergy data (team names, bestGodName, collection contents) is already available client-side from the existing Starting 5 and collection payloads

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

# Starting 5 — Design Spec

## Overview

A passive income system for the Card Clash vault. Players slot one card per SMITE role (adc, jungle, mid, support, solo) into a "Starting 5" lineup. Slotted cards generate Passion and/or Cores over time based on their holo type and rarity.

**Terminology note:** "Cores" is the user-facing name for the Ember currency (`ember_balances`).

## Holo Type System Rework

Every card uncommon+ rolls one of three holo types at creation (equal 33.3% odds):

- **holo** — earns Passion per hour
- **reverse** — earns Cores per hour
- **full** — earns both at 60% of the single-type rate

The existing visual holo effect (galaxy, cosmos, gold, etc.) remains tied to rarity. Holo type is a separate `holo_type` column on `cc_cards`.

Existing uncommon+ cards get a random holo type assigned via migration using `(ARRAY['holo','reverse','full'])[floor(random()*3)+1]`.

Commons have `holo_type = NULL` and cannot be slotted.

Only god and player cards have roles — item and consumable cards (`role: null`) cannot be slotted.

## Income Rates (per card, per day)

| Rarity    | Holo (Passion) | Reverse (Cores) | Full (Passion / Cores) |
|-----------|---------------|-----------------|----------------------|
| Uncommon  | 1             | 1               | 0.6 / 0.6           |
| Rare      | 2             | 1.5             | 1.2 / 0.9           |
| Epic      | 3             | 2.5             | 1.8 / 1.5           |
| Legendary | 5             | 4               | 3 / 2.4             |
| Mythic    | 8             | 6               | 4.8 / 3.6           |

Hourly rates = daily rate / 24.

Example team (1 legendary + 1 epic + 1 rare + 2 uncommon, all holo): 12 Passion/day.
Same team all reverse: 10 Cores/day.

Rates intentionally modest — set bonuses and synergies planned for later expansion.

## Accumulation Cap

Pending income caps at 2 days' worth of the currently slotted lineup's total daily rate. If all slots produce 12 Passion/day total, cap is 24 Passion pending. Upgrading a card adjusts the cap upward immediately. Income stops accruing at cap until collected.

## Data Model

### Reuse existing table: `cc_lineups`

The `cc_lineups` table already exists with the same structure (user_id, role, card_id). Add a `slotted_at` column:

```sql
ALTER TABLE cc_lineups ADD COLUMN IF NOT EXISTS slotted_at TIMESTAMPTZ DEFAULT NOW();
```

### New table: `cc_starting_five_state` (per-user income tracking)

| Column            | Type           | Notes                                    |
|-------------------|----------------|-------------------------------------------|
| user_id           | integer        | PK, FK to users                           |
| passion_pending   | numeric(10,4)  | Accumulated uncollected Passion            |
| cores_pending     | numeric(10,4)  | Accumulated uncollected Cores              |
| last_tick         | timestamptz    | Last server-side accrual calculation       |

### New column on `cc_cards`

- `holo_type` (text, nullable) — `holo`, `reverse`, or `full`. NULL for commons.

### Card generation changes

All card generation functions (`generateCard`, `generatePlayerCard`, `generateItemCard`, `generateConsumableCard`) must roll `holo_type` for uncommon+ cards. Items and consumables get the holo_type but still can't be slotted (no role).

## API Endpoints (on `/api/vault`)

- `GET ?action=starting-five` — returns slotted cards, pending income, per-hour rates, cap
- `POST ?action=slot-card` — body: `{ cardId, role }` — auto-collects pending, then slots card
- `POST ?action=unslot-card` — body: `{ role }` — auto-collects pending, then removes card
- `POST ?action=collect-income` — final tick calculation, moves pending into real balances, resets pending to 0

## Tick Mechanics

1. On any Starting 5 API call, server computes elapsed time since `last_tick`
2. If `last_tick` is NULL (first slot ever), set it to NOW — no elapsed time accrues
3. For each slotted card, adds `(rate_per_hour * elapsed_hours)` to pending, capped at 2-day max
4. Updates `last_tick = NOW()`
5. On collect: pending amounts are floored to integers for granting (Passion via passion system, Cores via `grantEmber`). Fractional remainder stays in pending — no loss from rounding.

## Slot/Swap Rules

- Only uncommon+ god or player cards with a matching role can be slotted
- Slotting or unslotting auto-collects pending income first (no loss)
- A card can only be in one slot (it's in your collection, just marked as active)
- Slotted cards cannot be listed on the marketplace — must unslot first
- Card deletion or ownership transfer (marketplace sale) auto-unslots with `ON DELETE SET NULL`

## Frontend

- New "Starting 5" section in the vault, likely as a prominent area within the existing vault tab structure
- 5 role-labeled slots displayed as a lineup (solo, jungle, mid, support, adc)
- Empty slots show role icon + "Slot Card" action
- Filled slots show the card with swap/remove options
- Click empty slot → picker modal filtered to owned uncommon+ god/player cards of that role
- Running client-side counter (pure JS timer from `last_tick` + rates) showing accumulating Passion/Cores
- "Collect" button to claim pending income
- Visual indicator when near or at cap (e.g., progress bar or color change)

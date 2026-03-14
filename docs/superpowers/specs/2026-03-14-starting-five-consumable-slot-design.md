# Starting 5 Consumable Slot

## Summary

Replace the current "use consumable for instant boost" mechanic with a permanent consumable slot on Starting 5. A slotted consumable increases the passive income **rate** (not the cap), meaning players must claim more frequently to avoid hitting the 2-day cap. The consumable is destroyed on replacement — there is no unslot action.

## What Changes

### Removed
- `useConsumable()` function and `use-consumable` API action
- Instant boost mechanic (percentage of current cap)
- `CONSUMABLE_BOOST` constant
- Consumable picker modal (use-and-destroy UI)

### Added
- Single global consumable slot on Starting 5
- `slot-consumable` API action
- Consumable rate multiplier applied during `tick()` income accrual
- Confirmation modal when replacing an already-slotted consumable

## Consumable Slot Rules

- One global slot (not per-role)
- Card must be `card_type = 'consumable'`
- Card cannot be listed on marketplace, in active trade (`cc_trade_cards`), or slotted elsewhere
- Slotting triggers income collection first (same as other slot changes)
- **Permanent** — stays slotted indefinitely until replaced
- **No unslot** — once slotted, the only way to remove is by replacing with another consumable
- **Destroyed on replace** — slotting a new consumable deletes the old one from `cc_cards`
- Confirmation modal before replacing: "This will destroy your [Rare Health Potion]. Continue?"
- While slotted, the consumable card is **locked** — cannot be traded, listed on marketplace, or moved to binder. Trading/marketplace/binder operations must check `cc_starting_five_state.consumable_card_id` before accepting a card.

## Rate Boost

The consumable multiplies the fill **rate** of Starting 5 income. The 2-day cap is calculated from **base rates only** (without consumable boost), so the cap stays the same — the consumable purely fills the same bucket faster.

### Rarity Scaling (non-linear)

| Rarity    | Total Boost | Multiplier |
|-----------|-------------|------------|
| Common    | 50%         | 1.5x       |
| Uncommon  | 65%         | 1.65x      |
| Rare      | 80%         | 1.8x       |
| Epic      | 100%        | 2.0x       |
| Legendary | 135%        | 2.35x      |
| Mythic    | 200%        | 3.0x       |

### Boost Split by Card (ratios at epic baseline)

Each consumable card type is identified by its `consumableId` field in `cc_cards.card_data` (e.g., `health-pot`, `mana-pot`).

| Card (consumableId)              | Passion | Cores |
|----------------------------------|---------|-------|
| Health Potion (`health-pot`)     | 75%     | 25%   |
| Mana Potion (`mana-pot`)         | 25%     | 75%   |
| Multi Potion (`multi-pot`)       | 50%     | 50%   |
| Elixir of Strength (`elixir-str`)| 100%    | 0%    |
| Elixir of Intelligence (`elixir-int`) | 0% | 100%  |
| Vision Ward (`ward`)             | 60%     | 40%   |
| Sentry Ward (`sentry`)           | 40%     | 60%   |

### Boost Calculation

For a given consumable with rarity R and card type C:
1. Look up `totalBoost` from rarity table (e.g., epic = 1.0)
2. Look up `passionRatio` and `coresRatio` from card spread table using `card_data.consumableId`
3. `passionBoost = totalBoost * passionRatio` (e.g., epic Health Potion = 1.0 * 0.75 = 0.75)
4. `coresBoost = totalBoost * coresRatio` (e.g., epic Health Potion = 1.0 * 0.25 = 0.25)
5. Apply to accrual rate: `boostedPassionRate = baseRate * (1 + passionBoost)`
6. Cap is calculated from unboosted base rates: `passionCap = unboostedTotalPassionPerDay * CAP_DAYS`

The consumable multiplier is applied as a **post-hoc multiplier on the total rates** in `tick()`, not inside `getSlotRates()`. This keeps per-card base rates clean and applies the consumable as a global modifier:
- `tick()` computes `totalPassionPerHour` and `totalCoresPerHour` from all slotted cards (using `getSlotRates` with god/item attachments as before)
- Then applies: `boostedPassionPerHour = totalPassionPerHour * (1 + passionBoost)`
- Cap is computed from `totalPassionPerHour` (unboosted): `passionCap = totalPassionPerHour * 24 * CAP_DAYS`
- Accrued amount uses boosted rate, capped at cap

Example: Epic Health Potion on a holo rare player card (4 Passion/day base):
- Passion rate: 4 * 1.75 = 7 Passion/day (boosted)
- Cap: 4 * 2 = 8 Passion (unboosted base * 2 days)
- Cores rate: unchanged for holo cards (they don't produce cores)

Example: Mythic Multi Potion on a full epic player card (3.6 Passion/day, 3 Cores/day base):
- Passion rate: 3.6 * (1 + 2.0 * 0.5) = 3.6 * 2.0 = 7.2 Passion/day
- Passion cap: 3.6 * 2 = 7.2 Passion (unboosted)
- Cores rate: 3.0 * (1 + 2.0 * 0.5) = 3.0 * 2.0 = 6.0 Cores/day
- Cores cap: 3.0 * 2 = 6.0 Cores (unboosted)

## Database Changes

Add column to `cc_starting_five_state`:
```sql
ALTER TABLE cc_starting_five_state
ADD COLUMN consumable_card_id INTEGER REFERENCES cc_cards(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX cc_s5_consumable_uniq
ON cc_starting_five_state(consumable_card_id)
WHERE consumable_card_id IS NOT NULL;
```

`ON DELETE SET NULL` ensures that if the consumable card is deleted externally (admin action, bug), the slot silently empties rather than causing FK violations. The frontend handles `consumableCard: null` gracefully.

## API Changes

### Removed
- `POST /api/vault?action=use-consumable` — deleted

### Added
- `POST /api/vault?action=slot-consumable` — `{ cardId }`
  - Validates card ownership, `card_type = 'consumable'`
  - Validates card not listed on marketplace (`cc_marketplace_listings`)
  - Validates card not in active trade (`cc_trade_cards`)
  - Collects pending income first
  - If existing consumable slotted: destroys it (`DELETE FROM cc_cards WHERE id = oldCardId`)
  - Sets `consumable_card_id` on `cc_starting_five_state`
  - Returns updated S5 response

### Modified
- `GET /api/vault?action=starting-five` — response includes `consumableCard` object
- `tick()` — applies consumable rate multiplier as post-hoc global modifier on total rates; cap uses unboosted rates

### Response Shape

The `consumableCard` field in the S5 response (null if no consumable slotted):
```json
{
  "consumableCard": {
    "id": 12345,
    "cardType": "consumable",
    "rarity": "epic",
    "consumableId": "health-pot",
    "name": "Health Potion",
    "imageUrl": "...",
    "passionBoostPct": 75,
    "coresBoostPct": 25
  }
}
```

The `passionBoostPct` / `coresBoostPct` are the final computed percentages for this card's rarity and type (e.g., epic Health Potion = 75% passion, 25% cores). The frontend can also compute these locally from `CONSUMABLE_SLOT_SCALING` and `CONSUMABLE_SPREADS`.

## Cross-System Locks

While a consumable is slotted, these systems must reject operations on that card:
- **Marketplace**: check `cc_starting_five_state.consumable_card_id` before listing
- **Trading**: check before adding to trade offer
- **Binder**: check before slotting into binder

Implementation: add a helper `isCardInS5Consumable(sql, cardId)` or extend the existing `isCardSlotted` checks.

## Files to Modify

| File | Changes |
|------|---------|
| `functions/lib/starting-five.js` | Remove `useConsumable`, add `slotConsumable`, apply consumable multiplier in `tick()` (post-hoc on totals), compute cap from unboosted rates |
| `functions/api/vault.js` | Replace `use-consumable` handler with `slot-consumable`, update `formatS5Response` to include `consumableCard` |
| `src/data/vault/economy.js` | Replace `CONSUMABLE_BOOST` with `CONSUMABLE_SLOT_SCALING` and `CONSUMABLE_SPREADS` |
| `src/pages/vault/CCStartingFive.jsx` | Replace consumable picker with slotted consumable display, add replace confirmation modal, update rate display and live ticker |
| `src/services/database.js` (or `api/vault.ts`) | Replace `useConsumable()` with `slotConsumable()` |
| `src/pages/vault/VaultContext.jsx` | Replace `boostS5WithConsumable` with `slotS5Consumable` |
| `functions/lib/marketplace.js` | Add consumable-slot check to listing validation |
| `functions/lib/trading.js` (or equivalent) | Add consumable-slot check to trade validation |
| DB migration | Add `consumable_card_id` column + unique index |

## Frontend UI

- Slotted consumable displayed near the income area (alongside the claim button)
- Shows the equipped consumable card image, name, rarity, and boost percentages (e.g., "+75% Passion, +25% Cores")
- Empty state: "+" button matching existing empty slot style — opens picker modal
- Picker modal lists owned consumables sorted by rarity (highest first), each showing passion/cores boost rates for its rarity
- Clicking a consumable in the picker when one is already slotted shows confirmation: "This will destroy your [Rare Health Potion]. Continue?"
- No unslot/remove button — locked once slotted
- Rate breakdown tooltip shows consumable boost as a separate line (e.g., "Consumable: +75% Passion")
- Live income ticker uses boosted rates (from `totalPassionPerHour` / `totalCoresPerHour` in response, which include consumable boost) but progress bar cap uses unboosted cap values

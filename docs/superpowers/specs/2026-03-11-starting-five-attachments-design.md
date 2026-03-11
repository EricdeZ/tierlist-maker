# Starting 5 Attachments — Design Spec

## Overview

Expand each Starting 5 slot from a single player card to a **player + god + item** trio. The god and item act as equipment that multiplicatively boost the player's base passive income. Gods provide larger bonuses than items. Cores bonuses are significantly higher than Passion bonuses, making attachments the primary Cores income driver.

## Attachment Rules

- Each slot can hold: **1 player card** (base, existing) + **1 god card** + **1 item card**
- **God** must match the slot's role — god cards already store the mapped SMITE role (`solo`/`jungle`/`mid`/`support`/`adc`) in their `role` column, so validation is simply `godCard.role === slotRole`
- **Item** has no role restriction — any item in any slot
- Both must have a **holo type** (holo/reverse/full) — commons (`holo_type = NULL`) cannot be attached
- Both must be **>= the player card's rarity** — use `RARITIES[rarity].tier` from `economy.js` where lower tier = higher rarity (mythic=0, common=5). Comparison: `attachmentTier <= playerTier` means attachment is at least as rare
- Same restrictions as player cards: can't be listed on marketplace, can't be in active trade, can't be slotted elsewhere

## Bonus Percentages

Bonuses are percentage multipliers on the player card's base income rate. The attachment's **holo type** determines which income type is boosted:

- **Holo** → Passion boost only
- **Reverse** → Cores boost only
- **Full** → 60% of both Passion and Cores boost values

### God Bonuses (by attachment rarity)

| Rarity    | Passion Boost | Cores Boost |
|-----------|:---:|:---:|
| Uncommon  | +8%  | +15% |
| Rare      | +14% | +25% |
| Epic      | +22% | +40% |
| Legendary | +38% | +65% |
| Mythic    | +50% | +80% |

### Item Bonuses (by attachment rarity)

| Rarity    | Passion Boost | Cores Boost |
|-----------|:---:|:---:|
| Uncommon  | +3%  | +8%  |
| Rare      | +7%  | +16% |
| Epic      | +14% | +30% |
| Legendary | +22% | +48% |
| Mythic    | +30% | +60% |

### Stacking

God and item boosts stack **multiplicatively** on the player's base rate.

**Example:** Mythic holo player (8 Passion/day) with mythic holo god (+50% Passion) and mythic holo item (+30% Passion):

`8 × 1.50 × 1.30 = 15.6 Passion/day`

**Example:** Legendary reverse player (4 Cores/day) with legendary full god (60% of +65% = +39% Cores) and epic reverse item (+30% Cores):

`4 × 1.39 × 1.30 = 7.228 Cores/day`

## Data Model

### Schema Changes

Add two columns to `cc_lineups` for god and item attachments:

```sql
ALTER TABLE cc_lineups ADD COLUMN god_card_id INTEGER REFERENCES cc_cards(id) ON DELETE SET NULL;
ALTER TABLE cc_lineups ADD COLUMN item_card_id INTEGER REFERENCES cc_cards(id) ON DELETE SET NULL;

-- Prevent same card from being attached in multiple slots
CREATE UNIQUE INDEX IF NOT EXISTS cc_lineups_god_uniq ON cc_lineups(god_card_id) WHERE god_card_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cc_lineups_item_uniq ON cc_lineups(item_card_id) WHERE item_card_id IS NOT NULL;
```

No new tables needed. The existing `cc_lineups` row per (user_id, role) now holds up to 3 card references: `card_id` (player), `god_card_id`, `item_card_id`. Partial unique indexes enforce that a card can only be attached once across all slots.

### Constants

Add to `economy.js`:

```javascript
export const ATTACHMENT_BONUSES = {
  god: {
    passion: { uncommon: 0.08, rare: 0.14, epic: 0.22, legendary: 0.38, mythic: 0.50 },
    cores:   { uncommon: 0.15, rare: 0.25, epic: 0.40, legendary: 0.65, mythic: 0.80 },
  },
  item: {
    passion: { uncommon: 0.03, rare: 0.07, epic: 0.14, legendary: 0.22, mythic: 0.30 },
    cores:   { uncommon: 0.08, rare: 0.16, epic: 0.30, legendary: 0.48, mythic: 0.60 },
  },
};

export const FULL_HOLO_ATTACHMENT_RATIO = 0.6; // full holo gets 60% of both bonuses
```

## Rate Calculation

Updated `getCardRates` logic (in `starting-five.js`):

1. Calculate base player rate (existing logic — `getCardRates(holoType, rarity)`)
2. For each attachment (god, item), compute the multiplier:
   - Look up the attachment's bonus from `ATTACHMENT_BONUSES[type][currency][rarity]`
   - If attachment holo is `'holo'` → only apply `passion` bonus (cores multiplier = 1.0)
   - If attachment holo is `'reverse'` → only apply `cores` bonus (passion multiplier = 1.0)
   - If attachment holo is `'full'` → apply both at 60% (e.g., `1 + bonus * 0.6`)
3. Multiply: `finalRate = baseRate × godMultiplier × itemMultiplier`

New export: `getSlotRates(playerCard, godCard, itemCard)` that returns `{ passionPerHour, coresPerHour }` with attachments factored in.

## API Changes

All on existing `/api/vault` endpoint:

### Modified Actions

- **`GET ?action=starting-five`** — response now includes `godCard` and `itemCard` per slot, plus attachment bonus details
- **`POST ?action=slot-card`** — add `slotType` param: `'player'` (default/existing), `'god'`, or `'item'`

### New Actions

- **`POST ?action=unslot-attachment`** — body: `{ role, slotType: 'god' | 'item' }` — auto-collects, then removes the attachment

### Validation (slot-card with god/item slotType)

1. Card exists and is owned by user
2. Card has holo_type
3. Card type matches slotType (`card_type = 'god'` or `card_type = 'item'`)
4. For gods: card role matches slot role
5. Card rarity >= player card's rarity in that slot (error if no player card slotted)
6. Card not listed on marketplace or in active trade
7. Card not already used as an attachment in another slot

### Response Format (updated)

```javascript
{
  cards: [
    {
      ...playerCardData,
      slotRole: 'solo',
      passionPerHour: 0.125,   // base rate
      coresPerHour: 0,
      godCard: { ...godCardData, passionBonus: 0.38, coresBonus: 0 } | null,
      itemCard: { ...itemCardData, passionBonus: 0.22, coresBonus: 0 } | null,
      effectivePassionPerHour: 0.2125,  // after multipliers
      effectiveCoresPerHour: 0,
    }
  ],
  // totals use effective rates
  totalPassionPerHour: ...,
  totalCoresPerHour: ...,
  ...rest
}
```

## Tick Calculation Update

### DB Query

`tick()` query JOINs god/item cards:

```sql
SELECT l.role AS slot_role, c.*,
  g.id AS god_id, g.rarity AS god_rarity, g.holo_type AS god_holo_type,
  g.card_type AS god_card_type, g.role AS god_role, g.card_data AS god_card_data,
  i.id AS item_id, i.rarity AS item_rarity, i.holo_type AS item_holo_type,
  i.card_type AS item_card_type, i.card_data AS item_card_data
FROM cc_lineups l
JOIN cc_cards c ON l.card_id = c.id
LEFT JOIN cc_cards g ON l.god_card_id = g.id
LEFT JOIN cc_cards i ON l.item_card_id = i.id
WHERE l.user_id = $1 AND l.card_id IS NOT NULL
```

### Row Reshaping

Each result row contains flat columns. Before use, reshape into structured objects:

```javascript
const godCard = row.god_id ? { id: row.god_id, rarity: row.god_rarity, holo_type: row.god_holo_type, ... } : null
const itemCard = row.item_id ? { id: row.item_id, rarity: row.item_rarity, holo_type: row.item_holo_type, ... } : null
```

### Accrual Loop

Uses `getSlotRates(playerCard, godCard, itemCard)` instead of `getCardRates(holoType, rarity)`:

```javascript
for (const row of rows) {
  const godCard = reshapeGod(row)
  const itemCard = reshapeItem(row)
  const { passionPerHour, coresPerHour } = getSlotRates(row, godCard, itemCard)
  passionAccrued += passionPerHour * elapsedHours
  coresAccrued += coresPerHour * elapsedHours
}
```

### Cap Calculation

`getTotalDailyRates()` must also use `getSlotRates()` so the 2-day cap reflects effective (post-multiplier) rates, not base player rates.

## Slot/Unslot Behavior

- **Slotting an attachment** auto-collects pending income first (same as player slot)
- **Unslotting a player** also clears its `god_card_id` and `item_card_id` in the same UPDATE
- **Swapping a player** for a different one: after replacing the player card, check each attachment's rarity against the new player's rarity. Clear any attachment that no longer meets the floor. This check happens inside `slotCard()` after the UPSERT.
- **Selling/dismantling** a card that's an attachment auto-removes it via `ON DELETE SET NULL`
- **Dismantling** validation: the existing check in `vault.js` that prevents dismantling slotted cards must expand its query to also check `god_card_id` and `item_card_id`

### Cross-cutting cc_lineups queries

All existing queries that check if a card is in `cc_lineups` must be updated to check all three columns. Affected locations:

- **Marketplace listing** (`marketplace.js`): check `card_id = $1 OR god_card_id = $1 OR item_card_id = $1`
- **Marketplace purchase** (`marketplace.js`): clearing lineup on ownership transfer must also `SET god_card_id = NULL WHERE god_card_id = ANY(...)` and same for `item_card_id`
- **Trading validation** (`trading.js`): check all three columns when verifying cards aren't slotted
- **Trade execution** (`trading.js`): clear all three column references on ownership transfer
- **Dismantle** (`vault.js`): expand the NOT EXISTS check to cover all three columns

## Frontend Changes

### Context Updates (VaultContext)

- `slotS5Card(cardId, role)` → `slotS5Card(cardId, role, slotType = 'player')` — add slotType param
- Add `unslotS5Attachment(role, slotType)` for removing god/item attachments
- Response parsing: extract `godCard`/`itemCard` from each card in the response array
- `slottedCardIds` set must include god and item card IDs (for collection filtering)

### Slot UI (CCStartingFive.jsx)

Each filled slot expands to show the player card with two smaller attachment areas:
- **God slot** — below or beside the player card, smaller card display with role icon
- **Item slot** — below or beside the god slot, smaller card display

Empty attachment slots show a "+" button (only visible when a player card is slotted). Clicking opens a filtered picker modal.

### Attachment Picker Modal

Reuses the existing card picker pattern but filtered for:
- **God picker**: owned god cards matching slot role, holo_type not null, rarity >= player rarity, not already attached elsewhere, not listed/trading
- **Item picker**: owned item cards, holo_type not null, rarity >= player rarity, not already attached elsewhere, not listed/trading

Collection filtering must exclude cards that are attached as `godCard` or `itemCard` in any slot (not just player card IDs).

### Rate Display

Each slot shows the effective (post-multiplier) rate instead of base rate. The live-ticking income counter (`useEffect` interval) must use `effectivePassionPerHour` and `effectiveCoresPerHour` from the response totals.

### Slot Animation

Attaching a god/item triggers a subtler version of the existing slot animation (scale based on attachment rarity, but shorter duration than player slotting).

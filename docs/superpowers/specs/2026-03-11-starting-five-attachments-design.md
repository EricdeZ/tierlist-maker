# Starting 5 Attachments — Design Spec

## Overview

Expand each Starting 5 slot from a single player card to a **player + god + item** trio. The god and item act as equipment that multiplicatively boost the player's base passive income. Gods provide larger bonuses than items. Cores bonuses are significantly higher than Passion bonuses, making attachments the primary Cores income driver.

## Attachment Rules

- Each slot can hold: **1 player card** (base, existing) + **1 god card** + **1 item card**
- **God** must match the slot's role (warrior→solo, assassin→jungle, mage→mid, guardian→support, hunter→adc)
- **Item** has no role restriction — any item in any slot
- Both must have a **holo type** (holo/reverse/full) — no non-holo attachments
- Both must be **>= the player card's rarity** (e.g., epic player requires epic+ god/item)
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
```

No new tables needed. The existing `cc_lineups` row per (user_id, role) now holds up to 3 card references: `card_id` (player), `god_card_id`, `item_card_id`.

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

All on existing `/api/cardclash` endpoint:

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

In `tick()`, the income accrual loop changes from:

```javascript
const { passionPerHour, coresPerHour } = getCardRates(card.holo_type, card.rarity)
```

to:

```javascript
const { passionPerHour, coresPerHour } = getSlotRates(card, card.godCard, card.itemCard)
```

The DB query in `tick()` needs to JOIN god/item cards:

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

## Slot/Unslot Behavior

- **Slotting an attachment** auto-collects pending income first (same as player slot)
- **Unslotting a player** also unslots its god and item (cascade clear)
- **Swapping a player** for a different one unslots attachments if they no longer meet the rarity floor
- **Selling/dismantling** a card that's an attachment auto-removes it via `ON DELETE SET NULL`
- **Marketplace listing** validation must also check attachment slots (can't list a card that's attached)

## Frontend Changes

### Slot UI (CCStartingFive.jsx)

Each filled slot expands to show the player card with two smaller attachment areas:
- **God slot** — below or beside the player card, smaller card display with role icon
- **Item slot** — below or beside the god slot, smaller card display

Empty attachment slots show a "+" button. Clicking opens a filtered picker modal.

### Attachment Picker Modal

Reuses the existing card picker pattern but filtered for:
- **God picker**: owned god cards matching slot role, holo_type not null, rarity >= player rarity, not already attached elsewhere, not listed/trading
- **Item picker**: owned item cards, holo_type not null, rarity >= player rarity, not already attached elsewhere, not listed/trading

### Rate Display

Each slot shows the effective (post-multiplier) rate instead of base rate. A tooltip or breakdown can show: `base × god bonus × item bonus = effective`.

### Slot Animation

Attaching a god/item triggers a subtler version of the existing slot animation (scale based on attachment rarity, but shorter duration than player slotting).

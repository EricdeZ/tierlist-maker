# Consumable System Overhaul + S5 Balance Pass

**Date**: 2026-03-23
**Status**: Draft

## Summary

Two changes in one pass:

1. **S5 income nerf** — 40% total output reduction via equal √0.6 (~22.5%) cuts to both flat income and reverse multiplier bonuses, preserving the 2.5 holo / 2.5 reverse optimal split.
2. **Consumable overhaul** — Replace permanent passive boost slot with single-use consumables. 3 slots per claim cycle, 7 distinct effects, super-linear rarity scaling. All effects are Cores-only (Passion removed from consumables).

---

## Part 1: S5 Balance Pass

### Goal

Reduce total S5 income output by 40% without shifting the optimal lineup composition away from a balanced holo/reverse split.

### Approach

Apply √0.6 ≈ 0.7746 multiplier to both flat income values and reverse multiplier bonuses. Since total output = flat × mult, the compound reduction is 0.7746 × 0.7746 = 0.6 (exactly 40%).

### New Values

**S5_FLAT_CORES** (per day per holo card):

| Rarity | Old | New |
|---|---|---|
| Uncommon | 0.80 | 0.62 |
| Rare | 1.90 | 1.47 |
| Epic | 4.20 | 3.25 |
| Legendary | 8.10 | 6.27 |
| Mythic | 8.50 | 6.59 |
| Unique | 9.40 | 7.28 |

**S5_FLAT_PASSION** (per day per holo card):

| Rarity | Old | New |
|---|---|---|
| Uncommon | 0.05 | 0.039 |
| Rare | 0.12 | 0.093 |
| Epic | 0.26 | 0.201 |
| Legendary | 0.50 | 0.387 |
| Mythic | 0.52 | 0.403 |
| Unique | 0.58 | 0.449 |

**S5_REVERSE_MULT** (bonus portion reduced by 22.5%):

| Rarity | Old | New |
|---|---|---|
| Uncommon | 1.15 | 1.116 |
| Rare | 1.25 | 1.194 |
| Epic | 1.46 | 1.356 |
| Legendary | 1.55 | 1.426 |
| Mythic | 1.60 | 1.465 |
| Unique | 1.76 | 1.589 |

### Unchanged

- S5_FLAT_SCALE (0.7)
- S5_MULT_SCALE (4.5)
- S5_FULL_RATIO (0.44)
- S5_BENCH_EFFECTIVENESS (0.50)
- S5_ALLSTAR_MODIFIER (0.615)
- All attachment bonuses (S5_ATT_FLAT, S5_ATT_MULT)
- Team synergy bonuses
- Cap days (2)

### Files Changed

- `src/data/vault/economy.js` — frontend constants
- `functions/lib/starting-five.js` — backend constants (mirrored)

---

## Part 2: Consumable Overhaul

### Current System (being replaced)

- Single permanent consumable slot on S5 state
- Slotting a consumable destroys the previous one
- Consumable provides passive % boost to S5 income rate (Passion + Cores split)
- `CONSUMABLE_SLOT_SCALING` (rarity → total boost) × `CONSUMABLE_SPREADS` (consumable → passion/cores ratio)

### New System

Consumables are single-use items destroyed on use. Users have 3 consumable slots per claim cycle. Effects are either instant (fire immediately) or buffs (persist until next collect, or until daily dismantle reset for elixir-int).

### The 7 Consumables

| ID | Name | Effect | Type | Clears on |
|---|---|---|---|---|
| `health-pot` | Health Potion | Fill X% of Cores cap instantly | Instant | Immediately |
| `mana-pot` | Mana Potion | +X% income rate | Buff | Collect |
| `multi-pot` | Multi Potion | +X% rate AND +X days cap | Buff | Collect |
| `elixir-str` | Elixir of Strength | Multiply next claim payout by X | Buff | Collect |
| `elixir-int` | Elixir of Intelligence | Expand dismantle DR thresholds by X | Buff | Daily dismantle reset |
| `ward` | Vision Ward | Add X days to cap | Buff | Collect |
| `sentry` | Sentry Ward | Random 1–X Cores (flat distribution) | Instant | Immediately |

### Rarity Scaling

All effects scale super-linearly (~1.6–2.1x per tier). No unique tier for consumables.

**health-pot — Cap Fill %** (~1.65x/tier):

| Rarity | Cap filled |
|---|---|
| Common | 8% |
| Uncommon | 14% |
| Rare | 25% |
| Epic | 42% |
| Legendary | 68% |
| Mythic | 100% |

**mana-pot — Rate Boost** (~2.1x/tier):

| Rarity | Rate boost |
|---|---|
| Common | +10% |
| Uncommon | +22% |
| Rare | +48% |
| Epic | +100% |
| Legendary | +190% |
| Mythic | +300% |

**multi-pot — Rate + Cap Boost**:

| Rarity | Rate boost | Cap bonus |
|---|---|---|
| Common | +3% | +0.15 days |
| Uncommon | +6% | +0.25 days |
| Rare | +12% | +0.5 days |
| Epic | +20% | +0.9 days |
| Legendary | +35% | +1.5 days |
| Mythic | +60% | +2.5 days |

**elixir-str — Collect Multiplier**:

| Rarity | Collect multiplier |
|---|---|
| Common | 1.10x |
| Uncommon | 1.20x |
| Rare | 1.35x |
| Epic | 1.55x |
| Legendary | 1.85x |
| Mythic | 2.30x |

**elixir-int — Dismantle Threshold Expansion**:

| Rarity | Multiplier | 100% tier | 75% tier | 50% tier | 25% tier |
|---|---|---|---|---|---|
| Common | ×1.25 | 0–150 | 150–200 | 200–250 | 250+ |
| Uncommon | ×1.45 | 0–174 | 174–232 | 232–290 | 290+ |
| Rare | ×1.80 | 0–216 | 216–288 | 288–360 | 360+ |
| Epic | ×2.40 | 0–288 | 288–384 | 384–480 | 480+ |
| Legendary | ×3.50 | 0–420 | 420–560 | 560–700 | 700+ |
| Mythic | ×5.30 | 0–636 | 636–848 | 848–1060 | 1060+ |

**ward — Cap Increase (days)**:

| Rarity | Cap bonus |
|---|---|
| Common | +0.25 days |
| Uncommon | +0.5 days |
| Rare | +1 day |
| Epic | +1.75 days |
| Legendary | +3 days |
| Mythic | +5 days |

**sentry — Jackpot (flat random distribution)**:

| Rarity | Range | Average |
|---|---|---|
| Common | 1–10 | 5.5 |
| Uncommon | 1–25 | 13 |
| Rare | 1–60 | 30.5 |
| Epic | 1–130 | 65.5 |
| Legendary | 1–280 | 140.5 |
| Mythic | 1–500 | 250.5 |

### Slot Rules

- **3 consumable slots** per claim cycle
- Both instants and buffs count toward the 3 slots
- **Duplicates allowed** — stack additively:
  - 3× mana-pot (mythic) = +900% rate (10x speed)
  - 3× elixir-str (mythic) = 1 + (1.3 × 3) = 4.9x collect
  - 3× sentry = 3 separate jackpot rolls
  - 3× health-pot = 300% cap fill (excess is wasted, capped at 100%)
  - 3× ward (mythic) = +15 days cap
  - 3× elixir-int (mythic) = ×13.9 thresholds (additive: 4.3 + 4.3 + 4.3 = 12.9 bonus, +1 base = ×13.9)
- Buff slots clear when user collects income
- Elixir-int persists until daily dismantle reset (independent of collect)
- Using a consumable **destroys the card permanently**

### Stacking Math

Additive stacking for all duplicate effects:

- **Rate boosts**: sum percentages. 2× mana-pot epic (+100% each) = +200% rate.
- **Collect multiplier**: sum bonuses above 1.0. 2× elixir-str epic (1.55x each) = 1 + 0.55 + 0.55 = 2.10x.
- **Cap days**: sum days. ward rare (+1d) + multi-pot epic (+0.9d) = +1.9 days cap.
- **Threshold mult**: sum bonuses above 1.0. 2× elixir-int rare (×1.80 each) = 1 + 0.8 + 0.8 = ×2.60.
- **Jackpot**: each sentry is an independent roll.
- **Cap fill**: sum percentages. health-pot epic (42%) + health-pot rare (25%) = 67% fill. Capped at 100%.

Mixed stacking across types:
- mana-pot rate boost + multi-pot rate boost = additive sum of rate percentages.
- ward cap days + multi-pot cap days = additive sum of cap day bonuses.

---

## Database Schema Changes

### Migration: Alter `cc_starting_five_state`

```sql
-- Remove old single consumable slot
ALTER TABLE cc_starting_five_state DROP COLUMN IF EXISTS consumable_card_id;

-- Add new consumable system columns
ALTER TABLE cc_starting_five_state
  ADD COLUMN active_buffs JSONB DEFAULT '[]',
  ADD COLUMN consumable_slots_used INTEGER DEFAULT 0;

-- Dismantle boost (persists until daily reset, independent of collect)
ALTER TABLE cc_starting_five_state
  ADD COLUMN dismantle_boost_mult NUMERIC(6,2) DEFAULT 1.0,
  ADD COLUMN dismantle_boost_date DATE;
```

### `active_buffs` JSONB Structure

Array of up to 3 entries:

```json
[
  { "type": "mana-pot", "rarity": "mythic", "rateBoost": 3.0 },
  { "type": "elixir-str", "rarity": "epic", "collectMult": 1.55 },
  { "type": "ward", "rarity": "rare", "capDays": 1.0 }
]
```

Each buff stores its pre-computed effect value so `tick()` doesn't need to re-derive from rarity tables.

### Cleanup

Drop the unique index on the old `consumable_card_id`:

```sql
DROP INDEX IF EXISTS cc_s5_consumable_uniq;
```

---

## Backend Changes

### `src/data/vault/economy.js`

**Remove:**
- `CONSUMABLE_SLOT_SCALING`
- `CONSUMABLE_SPREADS`
- `getConsumableBoost()`

**Add:**

```js
export const CONSUMABLE_EFFECTS = {
  'health-pot': {
    type: 'instant',
    effect: 'cap-fill',
    values: { common: 0.08, uncommon: 0.14, rare: 0.25, epic: 0.42, legendary: 0.68, mythic: 1.00 },
  },
  'mana-pot': {
    type: 'buff',
    effect: 'rate-boost',
    values: { common: 0.10, uncommon: 0.22, rare: 0.48, epic: 1.00, legendary: 1.90, mythic: 3.00 },
  },
  'multi-pot': {
    type: 'buff',
    effect: 'rate-cap-boost',
    rateValues: { common: 0.03, uncommon: 0.06, rare: 0.12, epic: 0.20, legendary: 0.35, mythic: 0.60 },
    capValues: { common: 0.15, uncommon: 0.25, rare: 0.50, epic: 0.90, legendary: 1.50, mythic: 2.50 },
  },
  'elixir-str': {
    type: 'buff',
    effect: 'collect-mult',
    values: { common: 1.10, uncommon: 1.20, rare: 1.35, epic: 1.55, legendary: 1.85, mythic: 2.30 },
  },
  'elixir-int': {
    type: 'buff',
    effect: 'dismantle-boost',
    values: { common: 1.25, uncommon: 1.45, rare: 1.80, epic: 2.40, legendary: 3.50, mythic: 5.30 },
  },
  'ward': {
    type: 'buff',
    effect: 'cap-increase',
    values: { common: 0.25, uncommon: 0.50, rare: 1.00, epic: 1.75, legendary: 3.00, mythic: 5.00 },
  },
  'sentry': {
    type: 'instant',
    effect: 'jackpot',
    values: { common: 10, uncommon: 25, rare: 60, epic: 130, legendary: 280, mythic: 500 },
  },
};

export const CONSUMABLE_MAX_SLOTS = 3;
```

### `functions/lib/starting-five.js`

**Remove:**
- `CONSUMABLE_SLOT_SCALING`, `CONSUMABLE_SPREADS`, `getConsumableBoost()`
- `slotConsumable()` function
- Consumable boost logic in `tick()` (lines 306-309)

**Add:**
- Mirror `CONSUMABLE_EFFECTS` and `CONSUMABLE_MAX_SLOTS` constants
- `useConsumable(sql, userId, cardId)` — new function:

```
1. Validate card ownership, type=consumable, not listed/traded/bindered
2. Load S5 state, check consumable_slots_used < 3
3. Read consumableId from card.card_data.consumableId
4. Look up effect config from CONSUMABLE_EFFECTS[consumableId]
5. Branch by type:
   INSTANT:
     health-pot: call tick() to get computed coresCap, fill pending by %, cap at 100%. Update cores_pending.
     sentry: roll random(1, maxValue), grant cores via grantEmber() (existing Cores grant function).
   BUFF:
     mana-pot/multi-pot/elixir-str/ward: append to active_buffs JSONB array
     elixir-int: set dismantle_boost_mult (additive with existing), set dismantle_boost_date = today
6. Increment consumable_slots_used
7. Auto-remove from trade pile (DELETE FROM cc_trade_pile — must happen before card deletion)
8. Destroy card (DELETE FROM cc_cards)
9. Return updated S5 state + effect result
```

**Modify `tick()`:**

```
1. Read active_buffs from S5 state (Neon auto-parses JSONB to JS objects)
2. Sum rate boosts: totalRateBoost = sum of all rateBoost values from mana-pot and multi-pot entries
3. Sum cap day bonuses: totalCapDays = sum of all capDays values from ward and multi-pot entries
4. Apply rate boost: coresAccrued *= (1 + totalRateBoost)
5. Apply cap bonus: coresCap = combinedCoresPerDay * (CAP_DAYS + totalCapDays)
6. Return shape adds: activeBuffs, consumableSlotsUsed, dismantleBoostMult, dismantleBoostDate
   (replaces old consumableCard field)
```

**Modify `collectIncome()`:**

```
1. Before granting: check active_buffs for elixir-str entries
2. Sum collect multiplier bonuses: totalCollectMult = 1 + sum(each.collectMult - 1)
3. Apply: coresToGrant = floor(coresPending * totalCollectMult)
4. After granting, UPDATE must include:
   SET active_buffs = '[]', consumable_slots_used = 0
   (critical — without this, buffs persist forever)
5. Do NOT clear dismantle_boost_mult (independent lifecycle)
```

**Modify dismantle flow** in `handleDismantle()` (`functions/api/vault.js` ~line 1467):

```
1. Read dismantle_boost_mult and dismantle_boost_date from cc_starting_five_state for user
2. If dismantle_boost_date = today AND dismantle_boost_mult > 1.0:
   multiply each DISMANTLE_TIERS[].upTo by dismantle_boost_mult
3. If dismantle_boost_date < today:
   reset dismantle_boost_mult to 1.0, clear date (lazy cleanup on next dismantle)
4. Note: if user uses elixir-int and never dismantles, the boost persists in DB
   until the next dismantle attempt after the day passes — this is intentional
```

Frontend `calcDismantleTotal()` in `economy.js` also uses `DISMANTLE_TIERS` for preview.
The API response must include the active dismantle boost so the frontend can show accurate previews.

**Health-pot cap calculation detail:**
Health-pot fills based on the *current computed cap* including any active ward/multi-pot cap bonuses.
Steps: call `tick()` first to get current state with computed `coresCap`, then
`fillAmount = coresCap * fillPercent`, `cores_pending = min(cores_pending + fillAmount, coresCap)`.

### `functions/api/vault.js`

**Remove:** `handleSlotConsumable` / `slot-consumable` action

**Add:** `use-consumable` action:

```
POST { action: 'use-consumable', cardId: number }
Response: {
  ...s5State,
  consumableResult: {
    type: 'health-pot' | 'sentry' | etc,
    effect: 'cap-fill' | 'jackpot' | 'buff-applied',
    value: number  // cores filled, jackpot amount, or buff value
  }
}
```

**Modify `formatS5Response()`:**

Replace old consumable fields with new structure:

```
Old response shape (remove):
  consumableCard: { ... card data, passionBoostPct, coresBoostPct }
  boostedCoresPerDay / boostedPassionPerDay

New response shape (add):
  activeBuffs: [{ type, rarity, ...effectValues }]  // from active_buffs JSONB
  consumableSlotsUsed: number                        // 0-3
  dismantleBoostMult: number                         // current multiplier (1.0 if none)
  dismantleBoostActive: boolean                      // true if date matches today
  effectiveRateBoost: number                         // pre-computed total rate boost %
  effectiveCapDays: number                           // pre-computed total bonus cap days
  effectiveCollectMult: number                       // pre-computed collect multiplier
```

---

## Frontend Changes

### `src/data/vault/buffs.js`

Update consumable descriptions to reflect S5 effects. The old card-battle descriptions (e.g., "Restore 8 HP") are replaced entirely — they're not used anywhere else:

| ID | New description |
|---|---|
| health-pot | "Fill {X}% of your Cores cap instantly." |
| mana-pot | "Boost income rate by {X}% until next collect." |
| multi-pot | "Boost rate by {X}% and cap by {Y} days until next collect." |
| elixir-str | "Multiply your next collect payout by {X}." |
| elixir-int | "Expand dismantle thresholds by {X} until daily reset." |
| ward | "Add {Y} days to your cap until next collect." |
| sentry | "Jackpot! Receive 1–{X} Cores instantly." |

### `src/pages/vault/CCStartingFive.jsx`

**Consumable display overhaul:**
- Replace single consumable slot with 3-slot row
- Show slots as: filled (with active buff icon), empty (with "USE" button), or locked (3/3 used)
- Show "X/3 used this cycle" counter
- Active buffs displayed with their effect values and rarity color

**Consumable picker changes:**
- Change action label from "Slot" to "Use"
- Remove "current one will be destroyed" warning (no replacement — it's additive)
- Show "This card will be consumed" confirmation
- Show effect preview with computed values based on card rarity
- Disable picker when 3/3 slots used

**Result feedback:**
- Sentry: show jackpot roll animation with final number
- Health-pot: show cores filled amount with fill animation
- Buffs: show buff icon appearing in slot with effect value

### `src/data/vault/economy.js`

- Remove `CONSUMABLE_SLOT_SCALING`, `CONSUMABLE_SPREADS`, `getConsumableBoost()`
- Add `CONSUMABLE_EFFECTS` and `CONSUMABLE_MAX_SLOTS` (shared with backend)

---

## Migration Considerations

### Existing Slotted Consumables

Players with a currently slotted consumable need migration:
- Return the slotted consumable card to their inventory (un-destroy it since it was never consumed in the new sense)
- Or: grant them the card's dismantle value as compensation
- **Recommended**: return to inventory. The card still exists in `cc_cards`, just clear the `consumable_card_id` reference before dropping the column.

### Data Migration Steps

1. Set all `consumable_card_id` to NULL (returns cards to inventory)
2. Drop column and index
3. Add new columns

```sql
-- Return existing slotted consumables to inventory
UPDATE cc_starting_five_state SET consumable_card_id = NULL
WHERE consumable_card_id IS NOT NULL;

-- Drop old system
DROP INDEX IF EXISTS cc_s5_consumable_uniq;
ALTER TABLE cc_starting_five_state DROP COLUMN IF EXISTS consumable_card_id;

-- Add new system
ALTER TABLE cc_starting_five_state
  ADD COLUMN active_buffs JSONB DEFAULT '[]',
  ADD COLUMN consumable_slots_used INTEGER DEFAULT 0,
  ADD COLUMN dismantle_boost_mult NUMERIC(6,2) DEFAULT 1.0,
  ADD COLUMN dismantle_boost_date DATE;
```

---

## Testing Considerations

- Verify S5 income output is exactly 60% of previous for same lineup
- Verify 2.5 holo / 2.5 reverse remains optimal split
- Test all 7 consumable effects individually
- Test additive stacking with duplicates (3× same type)
- Test mixed stacking (different types in 3 slots)
- Test slot limit enforcement (reject 4th consumable)
- Test collect clears buff slots and resets counter
- Test elixir-int persists through collect, clears on date change
- Test health-pot cap fill at 100% doesn't exceed cap
- Test sentry jackpot distribution is flat
- Test dismantle with active elixir-int applies expanded thresholds

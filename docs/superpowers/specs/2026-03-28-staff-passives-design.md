# Staff Passives — Design Spec

## Overview

Staff card passives are gameplay modifiers that activate when a staff card is slotted in the **staff** Starting 5 slot. Only one staff slot exists. Each staff card has a randomly assigned passive (from 7 types). The passive's power scales by the staff card's rarity.

Passives modify pack opening odds, card selection, and card generation. No passive reveals exact odds to the user — all UI uses qualitative language.

This spec also introduces a **dynamic odds engine** (`OddsContext`) that replaces the current static `rollRarity()` system, enabling passives and custom pack configurations to modify odds composably.

---

## The 7 Passives

### 1. Odds Boost
Increases overall card pull odds for non-common rarities during pack opening. Simple always-on modifier.

### 2. Holo Boost
Increases odds of pulling a specific holo type (holo/reverse/full). User selects which type when slotting the staff card in Starting 5. Choice persists until changed.

### 3. Card Reroll
Charge-based. After flipping a card during pack opening, eligible cards (at or below staff card's rarity) show a reroll icon. Tapping re-flips the card with a new pull. Full flip animation replays.

### 4. Pack Reroll
Charge-based. After all cards are revealed, a reroll option appears. The entire pack re-opens from scratch (same rarities, new cards). Each reroll removes 1 random card — higher rarity staff cards bias the removal toward lower-rarity cards. Multiple rerolls allowed per charge, but successive rerolls escalate the chance of losing the rarest card (+15% per reroll).

### 5. Unique Hunter
Toggle-based (enable/disable in Starting 5 UI). Blocks legendary and mythic pulls entirely. Their combined probability is redistributed: a portion funneled into unique chance, the remainder spread back to lower rarities. The portion going to unique scales by staff rarity.

### 6. Collector Boost
Weights card pool selection toward definitions the user doesn't already own. Always-on modifier during pack opening.

### 7. Card Generator
Charge-based. Passively generates claimable single-card mini-packs in the Starting 5 UI. Better odds than regular pulls. Rarity capped at the staff card's rarity. Higher rarity staff card = faster charge time.

---

## Swap Cooldown

When removing a staff card from the staff slot, a global cooldown prevents slotting another card. Duration depends on the **passive of the card being removed** (prevents hot-swapping between passives for different activities).

| Passive | Cooldown |
|---------|---------|
| Odds Boost | 12h |
| Holo Boost | 12h |
| Card Reroll | 24h |
| Pack Reroll | 24h |
| Unique Hunter | 6h |
| Collector Boost | 12h |
| Card Generator | 48h |

---

## Rarity Scaling Tables

See `2026-03-28-staff-passives-tuning.md` for all numeric tables. Values are tunable independently of this spec.

---

## Dynamic Odds Engine — OddsContext

### Problem

Current system uses static `RARITIES` with hardcoded `dropRate` values and `rollRarity(minRarity)`. Passives need to modify these dynamically, and the pack creator should also be able to define custom distributions per pack type.

### Solution

An `OddsContext` object that starts from base rates and flows through a chain of modifiers before being used to roll.

### Shape

```js
{
  // Rarity weights (modified by passives, pack config)
  rarity: { common: 0.60, uncommon: 0.30, rare: 0.06, epic: 0.035,
            legendary: 0.005, mythic: 0.0005, unique: 0.00005 },

  // Rarity constraints
  minRarity: 'common',
  maxRarity: null,
  blockedRarities: [],

  // Holo type weights (base: 1/1/1 = 33% each)
  holoType: { holo: 1, reverse: 1, full: 1 },

  // Card type weights (null = use pool-size weighting)
  cardType: { god: null, item: null, consumable: null, player: null, collection: null },

  // Collector Boost state
  ownedCardIds: null,
  collectorBoost: 0,
}
```

### Flow

```
createOddsContext()
  → applyPackOverrides(ctx, pack.odds_config)
  → applyPassive(ctx, passiveName, staffRarity, passiveState)
  → rollRarityFromContext(ctx) / rollHoloTypeFromContext(ctx) / selectFromPool(ctx, pool, ownedDefIds)
```

### Pack Creator Integration

`cc_pack_types` gains an `odds_config JSONB` column. Pack creators can override rarity weights, holo type weights, and card type weights per pack. These merge into the context before passive modifiers apply.

---

## Database Changes

### New Tables

**`cc_passive_state`** — Per-user passive charge and cooldown tracking:
```sql
CREATE TABLE cc_passive_state (
  user_id INTEGER NOT NULL,
  passive_name TEXT NOT NULL,
  charges INTEGER NOT NULL DEFAULT 0,
  last_charged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cooldown_until TIMESTAMPTZ,
  enabled BOOLEAN NOT NULL DEFAULT true,
  holo_choice TEXT,
  PRIMARY KEY (user_id, passive_name)
);
```

Charges are computed on read: `elapsed = NOW() - last_charged_at`, `pending = floor(elapsed / hours_per_charge)`, capped at max charges. No cron job needed.

**`cc_generated_cards`** — Pending cards from Card Generator:
```sql
CREATE TABLE cc_generated_cards (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  card_data JSONB NOT NULL,
  rarity TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_at TIMESTAMPTZ
);
```

**`cc_pack_sessions`** — Temporary pack state for rerolls:
```sql
CREATE TABLE cc_pack_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  cards JSONB NOT NULL,
  odds_context JSONB NOT NULL,
  reroll_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '10 minutes'
);
```

Sessions are created on pack open (when reroll charges are available) and referenced by reroll endpoints. Expired sessions are cleaned up opportunistically.

### Modified Tables

**`cc_pack_types`** — add column:
```sql
ALTER TABLE cc_pack_types ADD COLUMN odds_config JSONB;
```

**`cc_lineups`** — add column for Holo Boost selection:
```sql
ALTER TABLE cc_lineups ADD COLUMN holo_choice TEXT;
```

### No Changes

`cc_cards`, `cc_staff_passives` — already have the needed schema.

---

## Backend — New Files

### `functions/lib/odds.js`

The dynamic odds engine. Exports:

- `createOddsContext()` — returns base rates from current `RARITIES`
- `applyPackOverrides(ctx, oddsConfig)` — merges pack-level JSONB overrides onto context
- `rollRarityFromContext(ctx)` — weighted random rarity respecting `minRarity`, `maxRarity`, `blockedRarities`; redistributes blocked weight per Unique Hunter rules
- `rollHoloTypeFromContext(ctx)` — weighted random from `ctx.holoType`
- `selectFromPool(ctx, pool, ownedDefIds)` — picks a card definition from pool, weighting un-owned defs by `ctx.collectorBoost` multiplier

Replaces all current `rollRarity()`, `rollRarityBounded()`, and `rollHoloType()` calls in `vault.js`.

### `functions/lib/passives.js`

Passive engine + all tuning tables. Exports:

- All rarity scaling constants (imported from or mirroring the tuning doc)
- `getActivePassive(sql, userId)` — queries staff slot in `cc_lineups` → joins `cc_cards` + `cc_staff_passives` → returns `{ passiveName, staffRarity, state }` or `null`
- `getPassiveState(sql, userId)` — reads `cc_passive_state`, computes current charges from elapsed time
- `spendCharge(sql, userId, passiveName)` — decrements charge, updates `last_charged_at`
- `applySwapCooldown(sql, userId, passiveName)` — sets `cooldown_until` on the user's passive state
- `checkSwapCooldown(sql, userId)` — returns remaining cooldown or null
- `generatePassiveCard(sql, userId, staffRarity)` — rolls a card using boosted odds capped at staff rarity, inserts into `cc_generated_cards`
- `claimGeneratedCard(sql, userId, generatedCardId)` — moves card from `cc_generated_cards` to `cc_cards`
- `toggleUniqueHunter(sql, userId, enabled)` — updates `cc_passive_state.enabled`
- `applyPassiveToContext(ctx, passiveName, staffRarity, state)` — modifies an OddsContext based on the active passive

---

## Backend — Modified Files

### `functions/lib/vault.js`

- All `rollRarity()` / `rollRarityBounded()` / `rollHoloType()` calls replaced with context-aware versions from `odds.js`
- `openPack()` flow becomes:
  1. Build `OddsContext` from base rates
  2. Apply pack's `odds_config` overrides
  3. Query active passive → apply to context
  4. Pass context through to all `generateCard()`, `generateItemCard()`, etc.
  5. Return cards + reroll eligibility metadata
- `generateCard(ctx)`, `generateItemCard(ctx)`, `generatePlayerCard(sql, ctx)`, etc. — accept context instead of bare rarity
- Card Reroll: new `rerollCard(sql, userId, packSessionId, cardIndex)` — spends charge, generates replacement card using same context, returns new card
- Pack Reroll: new `rerollPack(sql, userId, packSessionId)` — spends charge, regenerates all cards with same rarity slots, removes one card weighted by bias table, returns new pack
- Pack sessions: `openPack()` now persists the generated pack to a `cc_pack_sessions` row (user_id, cards JSONB, odds_context JSONB, created_at, expires_at). Reroll endpoints reference this session. Sessions expire after 10 minutes (cleanup on next pack open).

### `functions/lib/starting-five.js`

- `slotCard()` for staff role: check swap cooldown via `checkSwapCooldown()`, save `holo_choice` to lineups if Holo Boost, initialize `cc_passive_state` row
- `unslotCard()` for staff role: call `applySwapCooldown()` based on the removed card's passive

### `functions/api/vault.js`

- Pack opening response includes `rerollState: { cardRerollCharges, packRerollCharges, eligibleCardIndices }` when a passive is active
- New action handlers:
  - `reroll-card` — validates charge + card index + rarity eligibility, calls reroll, returns new card
  - `reroll-pack` — validates charge, calls pack reroll, returns new pack
  - `claim-generated-card` — validates ownership, calls claim, returns card
  - `toggle-unique-hunter` — calls toggle, returns updated state
- Starting 5 fetch response extended with `passiveState` object

### `functions/api/vault-admin.js`

- Pack type create/update accepts `odds_config` JSONB field
- Validation: odds_config keys must be recognized (rarity/holoType/cardType), values must be positive numbers

---

## Frontend — New Components

### `src/pages/vault/starting-five/PassivePanel.jsx`

Compact panel integrated into the staff slot area of Starting 5. Shows:

- Passive icon + name + qualitative description
- Charge pips (filled/empty dots) for charge-based passives
- Cooldown timer ("Available in Xh") when on cooldown
- Holo Boost: icon-based selector for holo/reverse/full, highlights active choice
- Unique Hunter: clean toggle switch
- Card Generator: claimable cards as small glowing card-backs with pulse animation; tapping opens mini flip modal

### `src/pages/vault/components/RerollButton.jsx`

Subtle corner glyph on eligible cards during pack opening. Only renders if charges are available (no disabled/teasing states). Triggers card re-flip animation on tap.

### `src/pages/vault/components/MiniPackFlip.jsx`

Centered modal for Card Generator claims. Single card flip with same anticipation timing as pack opening, scaled to the card's rarity tier. Card slides out on dismiss.

---

## Frontend — Modified Components

### `src/pages/vault/components/PackOpening.jsx`

- After card flip: check if card is reroll-eligible (rarity <= staff rarity, charges available). If so, render `RerollButton` overlay. On reroll: card flips back face-down with shimmer, loading state during API call, then re-flips with full anticipation animation.
- After summary: if pack reroll charges available, show "Reroll" button below pack. On tap: all cards sweep back into pack, pack re-seals, full tear→emerge→flip sequence replays. One fewer card in new pack (visible but not highlighted). Successive rerolls change button text ("Reroll Again", "Reroll Once More").

### `src/pages/vault/CCStartingFive.jsx`

- Staff slot area gains `PassivePanel` below/beside the slot card
- Slotting a staff card with Holo Boost passive triggers holo choice selector before confirming
- Slotting checks swap cooldown — if active, show timer and block slot action

### `src/pages/vault/starting-five/PassivesGuide.jsx`

- Remove "Coming soon" banner
- Show live passive status if one is active
- Descriptions use qualitative language only

### Admin — Pack Creator

- Optional "Custom Odds" section when editing pack types
- Labeled sliders with qualitative labels ("Base", "Boosted", "High", "Very High")
- Preview shows relative rarity distribution as a simple bar chart (no percentages)
- Saves as `odds_config` JSONB

---

## Qualitative Language Map

All user-facing passive descriptions use these labels. No percentages or multipliers shown.

| Staff Rarity | Label |
|-------------|-------|
| uncommon | Minor |
| rare | Moderate |
| epic | Notable |
| legendary | Strong |
| mythic | Major |
| unique | Major |

---

## API Response Shapes

### Pack Opening (extended)

```json
{
  "cards": [ ... ],
  "rerollState": {
    "cardRerollCharges": 2,
    "packRerollCharges": 1,
    "eligibleCardIndices": [0, 1, 3]
  }
}
```

### Starting 5 Passive State

```json
{
  "passiveState": {
    "name": "card_reroll",
    "staffRarity": "epic",
    "charges": 2,
    "maxCharges": 2,
    "chargeProgressPct": 0.45,
    "nextChargeIn": "13h",
    "cooldownUntil": null,
    "enabled": true,
    "holoChoice": null,
    "generatedCards": []
  }
}
```

### Card Reroll Response

```json
{
  "newCard": { ... },
  "chargesRemaining": 1
}
```

### Pack Reroll Response

```json
{
  "cards": [ ... ],
  "chargesRemaining": 0
}
```

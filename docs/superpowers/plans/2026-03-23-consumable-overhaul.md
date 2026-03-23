# Consumable System Overhaul + S5 Balance Pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce S5 income by 40% and replace permanent consumable slot with single-use consumables (3 slots, 7 effects, destroyed on use).

**Architecture:** Backend constants updated in both `economy.js` (frontend) and `starting-five.js` (backend mirror). New `useConsumable()` function handles all 7 effects. `tick()` and `collectIncome()` modified to apply active buffs. Frontend replaces single consumable slot with 3-slot UI. DB migration adds JSONB `active_buffs` column and removes old `consumable_card_id`.

**Tech Stack:** React 19, Cloudflare Pages Functions, PostgreSQL/Neon, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-03-23-consumable-overhaul-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `database/migrations/137-consumable-overhaul.sql` | Schema migration |
| Modify | `src/data/vault/economy.js` | Remove old consumable constants, add `CONSUMABLE_EFFECTS` + `CONSUMABLE_MAX_SLOTS`, update S5 values, accept thresholdMult in dismantle calc |
| Modify | `functions/lib/starting-five.js` | Mirror S5 value changes, remove `slotConsumable()`, add `useConsumable()`, modify `tick()` + `collectIncome()`, export `getBuffTotals` |
| Modify | `functions/api/vault.js` | Replace `slot-consumable` with `use-consumable`, modify `formatS5Response()`, modify `handleDismantle()`, remove `consumable_card_id` refs |
| Modify | `functions/lib/marketplace.js` | Remove `consumable_card_id` queries |
| Modify | `functions/lib/trading.js` | Remove `consumable_card_id` queries |
| Modify | `functions/lib/tradematch.js` | Remove `consumable_card_id` queries |
| Modify | `src/services/database.js` | Replace `slotConsumable()` with `useConsumable()` service call |
| Modify | `src/data/vault/buffs.js` | Update consumable descriptions to S5 effect descriptions |
| Modify | `src/pages/vault/VaultContext.jsx` | Rewrite `slotS5Consumable` to `useS5Consumable` |
| Modify | `src/pages/vault/components/CardEffectDisplay.jsx` | Replace `CONSUMABLE_SLOT_SCALING`/`CONSUMABLE_SPREADS` with `CONSUMABLE_EFFECTS` |
| Modify | `src/pages/vault/CCStartingFive.jsx` | Replace single consumable slot with 3-slot UI, update picker, add result feedback |
| Modify | `src/pages/vault/CCDismantle.jsx` | Remove `consumableCard?.id` locked-card check, pass thresholdMult to preview |
| Modify | `src/pages/vault/CCMarketplace.jsx` | Remove `consumableCard?.id` locked-card check |
| Modify | `src/pages/vault/CCTradematch.jsx` | Remove `consumableCard?.id` locked-card check |
| Modify | `src/pages/vault/CCTrading.jsx` | Remove `consumableCard?.id` locked-card check |

---

### Task 1: Database Migration

**Files:**
- Create: `database/migrations/137-consumable-overhaul.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Return existing slotted consumables to inventory
UPDATE cc_starting_five_state SET consumable_card_id = NULL
WHERE consumable_card_id IS NOT NULL;

-- Drop old system
DROP INDEX IF EXISTS cc_s5_consumable_uniq;
ALTER TABLE cc_starting_five_state DROP COLUMN IF EXISTS consumable_card_id;

-- Add new consumable system columns
ALTER TABLE cc_starting_five_state
  ADD COLUMN IF NOT EXISTS active_buffs JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS consumable_slots_used INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dismantle_boost_mult NUMERIC(6,2) DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS dismantle_boost_date DATE;
```

- [ ] **Step 2: Run migration against dev database**

Run the migration SQL against the development database via the Neon console or psql.

- [ ] **Step 3: Verify migration**

Confirm the columns exist:
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'cc_starting_five_state'
ORDER BY ordinal_position;
```

Confirm `consumable_card_id` is gone and `active_buffs`, `consumable_slots_used`, `dismantle_boost_mult`, `dismantle_boost_date` exist.

- [ ] **Step 4: Commit**

```bash
git add database/migrations/137-consumable-overhaul.sql
git commit -m "feat(vault): add consumable overhaul migration"
```

---

### Task 2: S5 Balance Pass — Update Constants

> **Note:** These values may already be applied in the codebase from the current session. Verify before editing — if already correct, skip to commit.

**Files:**
- Modify: `src/data/vault/economy.js:102-115` (S5 flat/mult constants)
- Modify: `functions/lib/starting-five.js:5-13` (mirrored constants)

- [ ] **Step 1: Update frontend constants in `economy.js`**

Replace S5_FLAT_CORES (line 103-105):
```js
export const S5_FLAT_CORES = {
  uncommon: 0.62, rare: 1.47, epic: 3.25, legendary: 6.27, mythic: 6.59, unique: 7.28,
};
```

Replace S5_FLAT_PASSION (line 108-110):
```js
export const S5_FLAT_PASSION = {
  uncommon: 0.039, rare: 0.093, epic: 0.201, legendary: 0.387, mythic: 0.403, unique: 0.449,
};
```

Replace S5_REVERSE_MULT (line 113-115):
```js
export const S5_REVERSE_MULT = {
  uncommon: 1.116, rare: 1.194, epic: 1.356, legendary: 1.426, mythic: 1.465, unique: 1.589,
};
```

- [ ] **Step 2: Update backend constants in `starting-five.js`**

Apply the same values to lines 5-13 (no `export`, no semicolons — follows existing style):
```js
const S5_FLAT_CORES = {
  uncommon: 0.62, rare: 1.47, epic: 3.25, legendary: 6.27, mythic: 6.59, unique: 7.28,
}
const S5_FLAT_PASSION = {
  uncommon: 0.039, rare: 0.093, epic: 0.201, legendary: 0.387, mythic: 0.403, unique: 0.449,
}
const S5_REVERSE_MULT = {
  uncommon: 1.116, rare: 1.194, epic: 1.356, legendary: 1.426, mythic: 1.465, unique: 1.589,
}
```

- [ ] **Step 3: Verify dev server starts**

Run: `npm run dev`
Confirm no import errors or crashes.

- [ ] **Step 4: Commit**

```bash
git add src/data/vault/economy.js functions/lib/starting-five.js
git commit -m "feat(vault): 40% S5 income nerf via sqrt(0.6) balanced cut"
```

---

### Task 3: New Consumable Constants in `economy.js`

**Files:**
- Modify: `src/data/vault/economy.js:152-175` (remove old, add new)

- [ ] **Step 1: Remove old consumable constants**

Remove these exports (lines 152-175):
- `CONSUMABLE_SLOT_SCALING`
- `CONSUMABLE_SPREADS`
- `getConsumableBoost()` function

- [ ] **Step 2: Add new `CONSUMABLE_EFFECTS` and `CONSUMABLE_MAX_SLOTS`**

Add in place of removed code:

```js
export const CONSUMABLE_EFFECTS = {
  'health-pot': {
    type: 'instant', effect: 'cap-fill',
    values: { common: 0.08, uncommon: 0.14, rare: 0.25, epic: 0.42, legendary: 0.68, mythic: 1.00 },
  },
  'mana-pot': {
    type: 'buff', effect: 'rate-boost',
    values: { common: 0.10, uncommon: 0.22, rare: 0.48, epic: 1.00, legendary: 1.90, mythic: 3.00 },
  },
  'multi-pot': {
    type: 'buff', effect: 'rate-cap-boost',
    rateValues: { common: 0.03, uncommon: 0.06, rare: 0.12, epic: 0.20, legendary: 0.35, mythic: 0.60 },
    capValues: { common: 0.15, uncommon: 0.25, rare: 0.50, epic: 0.90, legendary: 1.50, mythic: 2.50 },
  },
  'elixir-str': {
    type: 'buff', effect: 'collect-mult',
    values: { common: 1.10, uncommon: 1.20, rare: 1.35, epic: 1.55, legendary: 1.85, mythic: 2.30 },
  },
  'elixir-int': {
    type: 'buff', effect: 'dismantle-boost',
    values: { common: 1.25, uncommon: 1.45, rare: 1.80, epic: 2.40, legendary: 3.50, mythic: 5.30 },
  },
  'ward': {
    type: 'buff', effect: 'cap-increase',
    values: { common: 0.25, uncommon: 0.50, rare: 1.00, epic: 1.75, legendary: 3.00, mythic: 5.00 },
  },
  'sentry': {
    type: 'instant', effect: 'jackpot',
    values: { common: 10, uncommon: 25, rare: 60, epic: 130, legendary: 280, mythic: 500 },
  },
};

export const CONSUMABLE_MAX_SLOTS = 3;
```

- [ ] **Step 3: Update `calcDismantleTotal` to accept optional threshold multiplier**

Modify `calcDismantleTotal` (line 83) to accept a `thresholdMult` parameter for frontend preview with active elixir-int:

```js
export function calcDismantleTotal(cards, dismantledValueToday, thresholdMult = 1) {
  const tiers = thresholdMult > 1
    ? DISMANTLE_TIERS.map(t => ({ ...t, upTo: t.upTo === Infinity ? Infinity : t.upTo * thresholdMult }))
    : DISMANTLE_TIERS;
  const sorted = [...cards].sort((a, b) => (RARITIES[b.rarity]?.dismantleValue || 0) - (RARITIES[a.rarity]?.dismantleValue || 0));
  let total = 0;
  let cumulativeBase = dismantledValueToday;
  for (const card of sorted) {
    const base = RARITIES[card.rarity]?.dismantleValue || 0;
    total += applyTieredValue(base, cumulativeBase, tiers);
    cumulativeBase += base;
  }
  return Math.floor(Math.round(total * 10) / 10);
}
```

Also update `applyTieredValue` (line 68) to accept tiers param:

```js
function applyTieredValue(base, cumulativeBase, tiers = DISMANTLE_TIERS) {
```

- [ ] **Step 4: Commit**

```bash
git add src/data/vault/economy.js
git commit -m "feat(vault): add CONSUMABLE_EFFECTS constants, remove old consumable system"
```

---

### Task 4: Backend — Rewrite `starting-five.js` Consumable Logic

**Files:**
- Modify: `functions/lib/starting-five.js`

This is the core task. Remove old consumable code, add `useConsumable()`, modify `tick()` and `collectIncome()`.

- [ ] **Step 1: Remove old consumable constants and `slotConsumable()`**

Remove lines 35-52 (old `CONSUMABLE_SLOT_SCALING`, `CONSUMABLE_SPREADS`, `getConsumableBoost`).
Remove the `slotConsumable()` function (lines 511-558).

- [ ] **Step 2: Add new consumable constants**

Add at the top of the file (after existing S5 constants):

```js
const CONSUMABLE_EFFECTS = {
  'health-pot': {
    type: 'instant', effect: 'cap-fill',
    values: { common: 0.08, uncommon: 0.14, rare: 0.25, epic: 0.42, legendary: 0.68, mythic: 1.00 },
  },
  'mana-pot': {
    type: 'buff', effect: 'rate-boost',
    values: { common: 0.10, uncommon: 0.22, rare: 0.48, epic: 1.00, legendary: 1.90, mythic: 3.00 },
  },
  'multi-pot': {
    type: 'buff', effect: 'rate-cap-boost',
    rateValues: { common: 0.03, uncommon: 0.06, rare: 0.12, epic: 0.20, legendary: 0.35, mythic: 0.60 },
    capValues: { common: 0.15, uncommon: 0.25, rare: 0.50, epic: 0.90, legendary: 1.50, mythic: 2.50 },
  },
  'elixir-str': {
    type: 'buff', effect: 'collect-mult',
    values: { common: 1.10, uncommon: 1.20, rare: 1.35, epic: 1.55, legendary: 1.85, mythic: 2.30 },
  },
  'elixir-int': {
    type: 'buff', effect: 'dismantle-boost',
    values: { common: 1.25, uncommon: 1.45, rare: 1.80, epic: 2.40, legendary: 3.50, mythic: 5.30 },
  },
  'ward': {
    type: 'buff', effect: 'cap-increase',
    values: { common: 0.25, uncommon: 0.50, rare: 1.00, epic: 1.75, legendary: 3.00, mythic: 5.00 },
  },
  'sentry': {
    type: 'instant', effect: 'jackpot',
    values: { common: 10, uncommon: 25, rare: 60, epic: 130, legendary: 280, mythic: 500 },
  },
}
const CONSUMABLE_MAX_SLOTS = 3
```

- [ ] **Step 3: Add exported helper to extract buff totals from `active_buffs` array**

```js
export function getBuffTotals(activeBuffs) {
  let totalRateBoost = 0
  let totalCapDays = 0
  let totalCollectMult = 1
  for (const buff of (activeBuffs || [])) {
    if (buff.rateBoost) totalRateBoost += buff.rateBoost
    if (buff.capDays) totalCapDays += buff.capDays
    if (buff.collectMult) totalCollectMult += (buff.collectMult - 1)
  }
  return { totalRateBoost, totalCapDays, totalCollectMult }
}
```

- [ ] **Step 4: Modify `tick()` to apply active buffs**

In the `tick()` function, make these changes:

a) Remove the old consumable card fetch (lines 237-240 — the `SELECT * FROM cc_cards WHERE id = ${state.consumable_card_id}` block).

b) Remove old consumable boost application (lines 305-310 — the `if (consumableCard?.card_data?.consumableId)` block).

c) After reading `state`, extract buff totals:
```js
const activeBuffs = state?.active_buffs || []
const { totalRateBoost, totalCapDays } = getBuffTotals(activeBuffs)
```

d) Modify cap calculation (line 281):
```js
const coresCap = combinedCoresPerDay * (CAP_DAYS + totalCapDays)
const passionCap = combinedPassionPerDay * (CAP_DAYS + totalCapDays)
```

e) After computing `coresAccrued` and `passionAccrued` (lines 302-303), apply rate boost to **Cores only** (all consumable effects are Cores-only per spec):
```js
if (totalRateBoost > 0) {
  coresAccrued *= (1 + totalRateBoost)
}
```

f) Update the return objects to replace `consumableCard` with new fields:
```js
activeBuffs: state?.active_buffs || [],
consumableSlotsUsed: state?.consumable_slots_used || 0,
dismantleBoostMult: Number(state?.dismantle_boost_mult) || 1,
dismantleBoostDate: state?.dismantle_boost_date || null,
```

Remove `consumableCard: consumableCard || null` from both return paths.

- [ ] **Step 5: Modify `collectIncome()` to apply elixir-str and clear buffs**

After `const state = await tick(sql, userId)` and before granting:

```js
// Apply collect multiplier from elixir-str buffs
const { totalCollectMult } = getBuffTotals(state.activeBuffs)
const passionToGrant = Math.floor(state.passionPending)
const coresToGrant = Math.floor(state.coresPending * totalCollectMult)
```

In the UPDATE statement at the end, add buff clearing:
```js
await sql`
  UPDATE cc_starting_five_state
  SET passion_pending = ${passionRemainder},
      cores_pending = ${coresRemainder},
      active_buffs = '[]',
      consumable_slots_used = 0
  WHERE user_id = ${userId}
`
```

- [ ] **Step 6: Add `useConsumable()` function**

Add this new exported function (replaces old `slotConsumable`):

```js
export async function useConsumable(sql, userId, cardId) {
  const [card] = await sql`
    SELECT id, rarity, card_type, card_data FROM cc_cards
    WHERE id = ${cardId} AND owner_id = ${userId}
  `
  if (!card) throw new Error('Card not found')
  if (card.card_type !== 'consumable') throw new Error('Only consumable cards can be used')

  const [listing] = await sql`
    SELECT id FROM cc_market_listings WHERE card_id = ${cardId} AND status = 'active'
  `
  if (listing) throw new Error('Card is listed on marketplace — unlist it first')

  const [inTrade] = await sql`
    SELECT tc.id FROM cc_trade_cards tc JOIN cc_trades t ON tc.trade_id = t.id
    WHERE tc.card_id = ${cardId} AND t.status IN ('waiting', 'active') AND t.mode = 'direct' LIMIT 1
  `
  if (inTrade) throw new Error('Card is in an active trade — cancel the trade first')

  const [inBinder] = await sql`
    SELECT id FROM cc_binder_cards WHERE card_id = ${cardId} LIMIT 1
  `
  if (inBinder) throw new Error('Card is in your binder — remove it first')

  await ensureState(sql, userId)

  const [s5State] = await sql`
    SELECT consumable_slots_used, active_buffs, dismantle_boost_mult, dismantle_boost_date
    FROM cc_starting_five_state WHERE user_id = ${userId}
  `
  if ((s5State?.consumable_slots_used || 0) >= CONSUMABLE_MAX_SLOTS) {
    throw new Error('All 3 consumable slots are used this cycle — collect income first')
  }

  const consumableId = card.card_data?.consumableId
  const config = CONSUMABLE_EFFECTS[consumableId]
  if (!config) throw new Error('Unknown consumable type')

  let result = { type: consumableId, effect: config.effect }

  if (config.effect === 'cap-fill') {
    // Health pot — fill % of current computed cap
    const currentState = await tick(sql, userId)
    const fillPct = config.values[card.rarity] || 0
    const fillAmount = currentState.coresCap * fillPct
    const newPending = Math.min((Number(currentState.coresPending) || 0) + fillAmount, currentState.coresCap)
    await sql`
      UPDATE cc_starting_five_state
      SET cores_pending = ${newPending},
          consumable_slots_used = consumable_slots_used + 1
      WHERE user_id = ${userId}
    `
    result.value = Math.round(fillAmount * 100) / 100

  } else if (config.effect === 'jackpot') {
    // Sentry — random 1 to max Cores
    const maxValue = config.values[card.rarity] || 10
    const jackpotAmount = Math.floor(Math.random() * maxValue) + 1
    await grantEmber(sql, userId, 'consumable_jackpot', jackpotAmount, `Sentry Ward jackpot (${card.rarity})`)
    await sql`
      UPDATE cc_starting_five_state
      SET consumable_slots_used = consumable_slots_used + 1
      WHERE user_id = ${userId}
    `
    result.value = jackpotAmount

  } else if (config.effect === 'rate-boost') {
    // Mana pot — add rate boost buff
    const rateBoost = config.values[card.rarity] || 0
    const buff = { type: consumableId, rarity: card.rarity, rateBoost }
    await sql`
      UPDATE cc_starting_five_state
      SET active_buffs = active_buffs || ${JSON.stringify(buff)}::jsonb,
          consumable_slots_used = consumable_slots_used + 1
      WHERE user_id = ${userId}
    `
    result.value = rateBoost

  } else if (config.effect === 'rate-cap-boost') {
    // Multi pot — rate + cap boost buff
    const rateBoost = config.rateValues[card.rarity] || 0
    const capDays = config.capValues[card.rarity] || 0
    const buff = { type: consumableId, rarity: card.rarity, rateBoost, capDays }
    await sql`
      UPDATE cc_starting_five_state
      SET active_buffs = active_buffs || ${JSON.stringify(buff)}::jsonb,
          consumable_slots_used = consumable_slots_used + 1
      WHERE user_id = ${userId}
    `
    result.value = { rateBoost, capDays }

  } else if (config.effect === 'collect-mult') {
    // Elixir str — collect multiplier buff
    const collectMult = config.values[card.rarity] || 1
    const buff = { type: consumableId, rarity: card.rarity, collectMult }
    await sql`
      UPDATE cc_starting_five_state
      SET active_buffs = active_buffs || ${JSON.stringify(buff)}::jsonb,
          consumable_slots_used = consumable_slots_used + 1
      WHERE user_id = ${userId}
    `
    result.value = collectMult

  } else if (config.effect === 'cap-increase') {
    // Ward — cap increase buff
    const capDays = config.values[card.rarity] || 0
    const buff = { type: consumableId, rarity: card.rarity, capDays }
    await sql`
      UPDATE cc_starting_five_state
      SET active_buffs = active_buffs || ${JSON.stringify(buff)}::jsonb,
          consumable_slots_used = consumable_slots_used + 1
      WHERE user_id = ${userId}
    `
    result.value = capDays

  } else if (config.effect === 'dismantle-boost') {
    // Elixir int — expand dismantle DR thresholds (additive with existing)
    const boostValue = config.values[card.rarity] || 1
    const currentMult = Number(s5State?.dismantle_boost_mult) || 1
    const today = new Date().toISOString().slice(0, 10)
    const isToday = String(s5State?.dismantle_boost_date || '').slice(0, 10) === today
    // Additive: add the bonus portion (value - 1) to current mult
    const newMult = isToday ? currentMult + (boostValue - 1) : boostValue
    await sql`
      UPDATE cc_starting_five_state
      SET dismantle_boost_mult = ${newMult},
          dismantle_boost_date = ${today},
          consumable_slots_used = consumable_slots_used + 1
      WHERE user_id = ${userId}
    `
    result.value = newMult
  }

  // Remove from trade pile before destroying
  await sql`DELETE FROM cc_trade_pile WHERE card_id = ${cardId}`
  // Destroy the card
  await sql`DELETE FROM cc_cards WHERE id = ${cardId}`

  return { ...(await tick(sql, userId)), consumableResult: result }
}
```

- [ ] **Step 7: Verify backend starts without errors**

Run: `npm run dev:api`
Confirm Wrangler starts without import/syntax errors.

- [ ] **Step 8: Commit**

```bash
git add functions/lib/starting-five.js
git commit -m "feat(vault): rewrite starting-five consumable logic for use-and-destroy system"
```

---

### Task 5: API Layer — `vault.js` Changes

**Files:**
- Modify: `functions/api/vault.js`

- [ ] **Step 1: Update imports**

At the top of vault.js, update the import from `starting-five.js`:
- Remove: `slotConsumable` from the import
- Add: `useConsumable` to the import
- Remove: `getConsumableBoost` if imported from starting-five.js (check — it may be from economy.js)

- [ ] **Step 2: Replace `slot-consumable` action with `use-consumable`**

In the action routing (around line 132), replace:
```js
case 'slot-consumable': return await handleSlotConsumable(sql, user, body)
```
with:
```js
case 'use-consumable': return await handleUseConsumable(sql, user, body)
```

- [ ] **Step 3: Replace `handleSlotConsumable` with `handleUseConsumable`**

Replace the function at lines 2006-2018:

Note: `formatS5Response` returns `{ statusCode, headers, body }` where body is already `JSON.stringify`'d. So `handleUseConsumable` must parse the body, inject `consumableResult`, and re-stringify:

```js
async function handleUseConsumable(sql, user, body) {
  const { cardId } = body
  if (!cardId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'cardId required' }) }
  }
  const state = await useConsumable(sql, user.id, cardId)

  getVaultStats(sql, user.id)
    .then(stats => pushChallengeProgress(sql, user.id, stats))
    .catch(err => console.error('Vault challenge push (use-consumable) failed:', err))

  const response = formatS5Response(state)
  const responseData = JSON.parse(response.body)
  responseData.consumableResult = state.consumableResult
  return { ...response, body: JSON.stringify(responseData) }
}
```

- [ ] **Step 4: Update `formatS5Response()` (lines 1786-1858)**

Remove old consumable fields and add new ones. Key changes:

a) Remove the `consumableCard` destructure from line 1787.
b) Remove the consumable boost calculation block (lines 1827-1837).
c) Remove `consumableCard`, `boostedCoresPerDay`, `boostedPassionPerDay` from the return object.
d) Add new fields to the return object:

```js
activeBuffs: state.activeBuffs || [],
consumableSlotsUsed: state.consumableSlotsUsed || 0,
dismantleBoostMult: state.dismantleBoostMult || 1,
dismantleBoostActive: state.dismantleBoostDate === new Date().toISOString().slice(0, 10),
effectiveRateBoost: (() => {
  const { totalRateBoost } = getBuffTotals(state.activeBuffs || [])
  return totalRateBoost
})(),
effectiveCapDays: (() => {
  const { totalCapDays } = getBuffTotals(state.activeBuffs || [])
  return totalCapDays
})(),
effectiveCollectMult: (() => {
  const { totalCollectMult } = getBuffTotals(state.activeBuffs || [])
  return totalCollectMult
})(),
```

Note: `getBuffTotals` needs to be importable or inlined. Since it's in `starting-five.js`, add it to the exports: `export { getBuffTotals }`.

- [ ] **Step 5: Update `handleDismantle()` to apply elixir-int boost**

In `handleDismantle()` (around line 1478), after authenticating the user and before the dismantle calculation:

```js
// Check for active dismantle boost
const [s5State] = await sql`
  SELECT dismantle_boost_mult, dismantle_boost_date
  FROM cc_starting_five_state WHERE user_id = ${user.id}
`
const today = new Date().toISOString().slice(0, 10)
let dismantleThresholdMult = 1
if (String(s5State?.dismantle_boost_date || '').slice(0, 10) === today && Number(s5State.dismantle_boost_mult) > 1) {
  dismantleThresholdMult = Number(s5State.dismantle_boost_mult)
} else if (s5State?.dismantle_boost_date && s5State.dismantle_boost_date < today) {
  // Lazy cleanup — reset stale boost
  await sql`
    UPDATE cc_starting_five_state
    SET dismantle_boost_mult = 1.0, dismantle_boost_date = NULL
    WHERE user_id = ${user.id}
  `
}
```

Then pass `dismantleThresholdMult` to the dismantle tier logic. Find where `DISMANTLE_TIERS` is used in the function and apply the multiplier to the `upTo` thresholds:

```js
const effectiveTiers = dismantleThresholdMult > 1
  ? DISMANTLE_TIERS.map(t => ({ ...t, upTo: t.upTo === Infinity ? Infinity : t.upTo * dismantleThresholdMult }))
  : DISMANTLE_TIERS
```

Use `effectiveTiers` instead of `DISMANTLE_TIERS` in the dismantle calculation within the handler.

- [ ] **Step 6: Verify API starts**

Run: `npm run dev:api`
Confirm no errors on startup.

- [ ] **Step 7: Commit**

```bash
git add functions/api/vault.js
git commit -m "feat(vault): replace slot-consumable with use-consumable API, update formatS5Response"
```

---

### Task 5b: Remove `consumable_card_id` References from Backend

**Files:**
- Modify: `functions/lib/marketplace.js`
- Modify: `functions/lib/trading.js`
- Modify: `functions/lib/tradematch.js`
- Modify: `functions/api/vault.js` (additional refs beyond Task 5)

The migration drops `consumable_card_id`. These files still reference it and will cause SQL errors.

- [ ] **Step 1: Clean up `marketplace.js`**

Search for `consumable_card_id` in this file. Remove any queries that check if a card is the active consumable (e.g., `WHERE consumable_card_id = ${cardId}`) and any updates that null out the consumable slot (e.g., `SET consumable_card_id = NULL WHERE consumable_card_id = ...`). These checks are no longer needed since consumables are destroyed on use, not slotted.

- [ ] **Step 2: Clean up `trading.js`**

Same as above — remove `consumable_card_id` queries and updates. These were checks preventing trading of slotted consumables, which no longer exist.

- [ ] **Step 3: Clean up `tradematch.js`**

Same — remove `consumable_card_id` queries and updates.

- [ ] **Step 4: Clean up remaining `vault.js` refs**

In `vault.js`, search for `consumable_card_id` beyond the already-handled `handleSlotConsumable` and `formatS5Response`. Remove refs in:
- `handleDismantle()` (around line 1505-1508): subquery excluding slotted consumable from dismantle
- Binder slot check (around line 2495-2498): preventing binder-slotting of active consumable

- [ ] **Step 5: Verify no remaining references**

Run: `grep -r "consumable_card_id" functions/`
Confirm zero results.

- [ ] **Step 6: Commit**

```bash
git add functions/lib/marketplace.js functions/lib/trading.js functions/lib/tradematch.js functions/api/vault.js
git commit -m "fix(vault): remove all consumable_card_id references after migration"
```

---

### Task 6: Frontend Service Layer

**Files:**
- Modify: `src/services/database.js:1085-1086`

- [ ] **Step 1: Replace `slotConsumable` with `useConsumable`**

Find and replace the service function (line 1085-1086):

```js
useConsumable(cardId) {
  return apiPost('vault', { action: 'use-consumable' }, { cardId })
},
```

- [ ] **Step 2: Commit**

```bash
git add src/services/database.js
git commit -m "feat(vault): update frontend service for use-consumable endpoint"
```

---

### Task 7: Update Consumable Descriptions in `buffs.js`

**Files:**
- Modify: `src/data/vault/buffs.js:37-67`

- [ ] **Step 1: Update descriptions to reflect S5 effects**

Replace the `description` field for each consumable in the `CONSUMABLES` array:

```js
{ id: 'health-pot', name: 'Health Potion', color: '#ef4444', icon: 'heart',
  imageUrl: `${WIKI}/Consumable_Health_Potion.png`,
  description: 'Fill a percentage of your Cores cap instantly.',
  manaCost: 1, uses: 1 },
{ id: 'mana-pot', name: 'Mana Potion', color: '#3b82f6', icon: 'droplet',
  imageUrl: `${WIKI}/Consumable_Mana_Potion.png`,
  description: 'Boost your income rate until next collect.',
  manaCost: 0, uses: 1 },
{ id: 'multi-pot', name: 'Multi Potion', color: '#a855f7', icon: 'sparkles',
  imageUrl: `${WIKI}/Consumable_Multi_Potion.png`,
  description: 'Boost your rate and extend your cap until next collect.',
  manaCost: 1, uses: 1 },
{ id: 'elixir-str', name: 'Elixir of Strength', color: '#f97316', icon: 'swords',
  imageUrl: `${WIKI}/Consumable_Elixir_of_Strength.png`,
  description: 'Multiply your next collect payout.',
  manaCost: 3, uses: 1 },
{ id: 'elixir-int', name: 'Elixir of Intelligence', color: '#8b5cf6', icon: 'brain',
  imageUrl: `${WIKI}/Consumable_Elixir_of_Intelligence.png`,
  description: 'Expand dismantle thresholds until daily reset.',
  manaCost: 3, uses: 1 },
{ id: 'ward', name: 'Vision Ward', color: '#22c55e', icon: 'eye',
  imageUrl: `${WIKI}/Consumable_Vision_Ward.png`,
  description: 'Add extra days to your cap until next collect.',
  manaCost: 1, uses: 1 },
{ id: 'sentry', name: 'Sentry Ward', color: '#f59e0b', icon: 'eye-off',
  imageUrl: `${WIKI}/Consumable_Vision_Ward.png`,
  description: 'Jackpot! Receive a random amount of Cores instantly.',
  manaCost: 1, uses: 1 },
```

- [ ] **Step 2: Commit**

```bash
git add src/data/vault/buffs.js
git commit -m "feat(vault): update consumable descriptions for new S5 effects"
```

---

### Task 7b: Update VaultContext and CardEffectDisplay

**Files:**
- Modify: `src/pages/vault/VaultContext.jsx`
- Modify: `src/pages/vault/components/CardEffectDisplay.jsx`

- [ ] **Step 1: Rewrite VaultContext consumable handler**

In `VaultContext.jsx`, find `slotS5Consumable` (around line 335-342). Rewrite it as `useS5Consumable`:

```js
const useS5Consumable = useCallback(async (cardId) => {
  const res = await vaultService.useConsumable(cardId)
  startingFiveRef.current = res
  setStartingFive(res)
  return res
}, [])
```

Remove any logic that references `startingFiveRef.current?.consumableCard?.id` or filters the old consumable from collections.

Update the context value export to expose `useS5Consumable` instead of `slotS5Consumable`.

- [ ] **Step 2: Update CardEffectDisplay**

In `CardEffectDisplay.jsx`, replace the import of `CONSUMABLE_SLOT_SCALING` and `CONSUMABLE_SPREADS` with `CONSUMABLE_EFFECTS`:

```js
import { CONSUMABLE_EFFECTS } from '../../../data/vault/economy'
```

Update the effect display logic to use `CONSUMABLE_EFFECTS[consumableId]` to show the effect description and rarity-scaled value instead of the old passion/cores split percentages.

- [ ] **Step 3: Remove `consumableCard?.id` locked-card checks**

In these files, search for `consumableCard?.id` and remove the check that prevents acting on the slotted consumable card (since cards are now destroyed on use, never slotted):
- `src/pages/vault/CCDismantle.jsx`
- `src/pages/vault/CCMarketplace.jsx`
- `src/pages/vault/CCTradematch.jsx`
- `src/pages/vault/CCTrading.jsx`

- [ ] **Step 4: Update CCDismantle to pass thresholdMult**

In `CCDismantle.jsx`, read `dismantleBoostMult` and `dismantleBoostActive` from the S5 state (via context or props). Pass the active boost multiplier to `calcDismantleTotal`:

```js
const thresholdMult = dismantleBoostActive ? dismantleBoostMult : 1
const total = calcDismantleTotal(selectedCards, dismantledValueToday, thresholdMult)
```

This ensures the dismantle preview shows accurate values when elixir-int is active.

- [ ] **Step 5: Commit**

```bash
git add src/pages/vault/VaultContext.jsx src/pages/vault/components/CardEffectDisplay.jsx src/pages/vault/CCDismantle.jsx src/pages/vault/CCMarketplace.jsx src/pages/vault/CCTradematch.jsx src/pages/vault/CCTrading.jsx
git commit -m "feat(vault): update VaultContext, CardEffectDisplay, and remove consumableCard refs"
```

---

### Task 8: Frontend — CCStartingFive Consumable UI Overhaul

**Files:**
- Modify: `src/pages/vault/CCStartingFive.jsx`

This is the largest frontend task. Replace single consumable slot with 3-slot system.

- [ ] **Step 1: Update state and data reading**

a) Remove references to `consumableCard` from the data reading (around line 239-240). Remove `boostedCoresPerDay` / `boostedPassionPerDay` references.

b) Add new state for consumable result feedback:
```js
const [consumableResult, setConsumableResult] = useState(null)
```

c) Read new fields from `startingFive` response:
```js
const activeBuffs = startingFive?.activeBuffs || []
const consumableSlotsUsed = startingFive?.consumableSlotsUsed || 0
const effectiveRateBoost = startingFive?.effectiveRateBoost || 0
const effectiveCapDays = startingFive?.effectiveCapDays || 0
const effectiveCollectMult = startingFive?.effectiveCollectMult || 1
const dismantleBoostMult = startingFive?.dismantleBoostMult || 1
const dismantleBoostActive = startingFive?.dismantleBoostActive || false
```

- [ ] **Step 2: Update the consumable handler**

Replace `handleSlotConsumable` (around line 383) with:

```js
const handleUseConsumable = useCallback(async (cardId) => {
  try {
    const res = await useS5Consumable(cardId)  // from VaultContext
    if (res.consumableResult) {
      setConsumableResult(res.consumableResult)
      setTimeout(() => setConsumableResult(null), 3000)
    }
    setShowConsumablePicker(false)
  } catch (err) {
    console.error('Failed to use consumable:', err)
  }
}, [useS5Consumable])
```

- [ ] **Step 3: Update income display section**

Replace the consumable boost lines in the income dashboard (around lines 403-404, 459, 486).

Remove the old `consumablePassionPph` / `consumableCoresCph` calculations and their display spans.

Add rate boost display if active:
```jsx
{effectiveRateBoost > 0 && (
  <span className="text-purple-400/60"> +{(effectiveRateBoost * 100).toFixed(0)}% rate buff</span>
)}
```

Add collect multiplier display if active:
```jsx
{effectiveCollectMult > 1 && (
  <span className="text-orange-400/60"> {effectiveCollectMult.toFixed(1)}x next collect</span>
)}
```

- [ ] **Step 4: Replace single consumable slot with 3-slot display**

Replace the consumable slot section (lines 497-535) with a 3-slot row:

```jsx
{/* Consumable Slots */}
<div className="flex flex-col items-center gap-1.5">
  <div className="text-[10px] font-bold text-white/40 cd-head tracking-wider">
    CONSUMABLES {consumableSlotsUsed}/3
  </div>
  <div className="flex gap-2 items-center">
    {activeBuffs.map((buff, i) => (
      <div key={i} className="flex flex-col items-center">
        <div
          className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-center"
          style={{ minWidth: 58 }}
        >
          <div className="text-[9px] font-bold cd-head text-white/60">{buff.type}</div>
          <div className="text-[10px] font-bold cd-num" style={{ color: RARITIES[buff.rarity]?.color }}>
            {buff.rateBoost && buff.capDays ? `+${(buff.rateBoost * 100).toFixed(0)}% +${buff.capDays}d` :
             buff.rateBoost ? `+${(buff.rateBoost * 100).toFixed(0)}%` :
             buff.capDays ? `+${buff.capDays}d` :
             buff.collectMult ? `${buff.collectMult}x` : ''}
          </div>
        </div>
      </div>
    ))}
    {consumableSlotsUsed < 3 && (
      <button
        onClick={() => setShowConsumablePicker(true)}
        className="group flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/[0.08] bg-white/[0.02] hover:border-amber-500/30 hover:bg-amber-500/[0.03] transition-all cursor-pointer"
        style={{ width: 58, height: 58 }}
        title="Use a consumable"
      >
        <Plus size={14} className="text-white/20 group-hover:text-amber-400 transition-colors" />
        <span className="text-[7px] text-white/20 group-hover:text-amber-400/60 font-bold cd-head tracking-wider mt-0.5 transition-colors">USE</span>
      </button>
    )}
  </div>
</div>
```

- [ ] **Step 5: Update ConsumablePicker modal**

In the ConsumablePicker component (lines 889-1011):

a) Change the action label from "Slot" to "Use".
b) Replace the boost preview (passionBoostPct / coresBoostPct) with effect-specific descriptions using `CONSUMABLE_EFFECTS`:

```jsx
import { CONSUMABLE_EFFECTS } from '../../data/vault/economy'

// In the card display, replace old boost percentages with:
const config = CONSUMABLE_EFFECTS[card.cardData?.consumableId]
const effectValue = config?.values?.[card.rarity] || config?.rateValues?.[card.rarity] || 0
```

Show the effect value based on type:
- cap-fill: `Fill ${(effectValue * 100).toFixed(0)}% cap`
- rate-boost: `+${(effectValue * 100).toFixed(0)}% rate`
- rate-cap-boost: `+${(config.rateValues[card.rarity] * 100).toFixed(0)}% rate, +${config.capValues[card.rarity]}d cap`
- collect-mult: `${effectValue}x collect`
- dismantle-boost: `x${effectValue} dismantle`
- cap-increase: `+${effectValue}d cap`
- jackpot: `1-${effectValue} Cores`

c) Change confirmation text from "This will destroy your current consumable" to "This card will be consumed".
d) Pass `handleUseConsumable` instead of `handleSlotConsumable` as the onSelect callback.
e) Disable the picker button when `consumableSlotsUsed >= 3`.

- [ ] **Step 6: Add consumable result feedback**

After the consumable slots section, add result display:

```jsx
{consumableResult && (
  <div className="text-center text-sm font-bold cd-num animate-fade-in">
    {consumableResult.effect === 'jackpot' && (
      <span className="text-amber-400">Jackpot! +{consumableResult.value} Cores</span>
    )}
    {consumableResult.effect === 'cap-fill' && (
      <span className="text-red-400">+{consumableResult.value.toFixed(1)} Cores filled</span>
    )}
    {consumableResult.effect === 'buff-applied' && (
      <span className="text-purple-400">Buff active!</span>
    )}
  </div>
)}
```

- [ ] **Step 7: Add dismantle boost indicator**

If the user has an active dismantle boost, show it somewhere visible:

```jsx
{dismantleBoostActive && dismantleBoostMult > 1 && (
  <div className="text-[10px] text-purple-400/80 font-bold cd-head">
    Dismantle boost active: x{dismantleBoostMult.toFixed(1)} thresholds
  </div>
)}
```

- [ ] **Step 8: Verify the page renders**

Run: `npm start`
Navigate to the Starting Five page. Confirm:
- 3-slot consumable area renders
- USE button appears when slots available
- No console errors

- [ ] **Step 9: Commit**

```bash
git add src/pages/vault/CCStartingFive.jsx
git commit -m "feat(vault): replace single consumable slot with 3-slot use-and-destroy UI"
```

---

### Task 9: End-to-End Verification

- [ ] **Step 1: Start full dev server**

Run: `npm start`

- [ ] **Step 2: Test S5 income display**

Navigate to Starting Five page. Confirm income values are lower than before (40% reduction). Check that rates display correctly for a slotted lineup.

- [ ] **Step 3: Test using a consumable**

1. Open consumable picker
2. Select a consumable card
3. Confirm it shows "This card will be consumed"
4. Use it
5. Confirm:
   - Card is destroyed (gone from inventory)
   - Effect applies (buff shows in slot, or instant effect fires)
   - Slot counter increments (1/3)
6. Use 2 more consumables
7. Confirm picker is disabled at 3/3

- [ ] **Step 4: Test collect clears buffs**

1. Use a buff consumable (mana-pot or ward)
2. Collect income
3. Confirm:
   - Buff slots are cleared (0/3)
   - Elixir-int boost persists (if used)

- [ ] **Step 5: Test dismantle with elixir-int**

1. Use an elixir-int consumable
2. Go to dismantle view
3. Confirm thresholds are expanded in the preview
4. Dismantle some cards
5. Confirm higher full-rate threshold

- [ ] **Step 6: Test sentry jackpot**

1. Use a sentry consumable
2. Confirm random Cores amount is granted
3. Confirm card is destroyed

- [ ] **Step 7: Test health-pot cap fill**

1. Let some income accrue (or use with partial pending)
2. Use health-pot
3. Confirm cores_pending increases by the correct % of cap

- [ ] **Step 8: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(vault): consumable overhaul adjustments from e2e testing"
```

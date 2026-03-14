# Starting 5 Consumable Slot Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the instant consumable boost with a permanent slotted consumable that increases Starting 5 fill rate.

**Architecture:** Add a `consumable_card_id` FK on `cc_starting_five_state`. Backend `tick()` applies the consumable's boost as a post-hoc multiplier on total rates while keeping cap calculated from unboosted rates. Frontend replaces the "Boost" button and picker modal with a slotted consumable display and replacement-with-confirmation flow.

**Tech Stack:** PostgreSQL (Neon), Cloudflare Pages Functions, React 19, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-03-14-starting-five-consumable-slot-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `database/migrations/XXX-s5-consumable-slot.sql` | Create | Add `consumable_card_id` column + unique index to `cc_starting_five_state` |
| `src/data/vault/economy.js` | Modify | Replace `CONSUMABLE_BOOST` with `CONSUMABLE_SLOT_SCALING` and `CONSUMABLE_SPREADS`, add `getConsumableBoost()` helper |
| `functions/lib/starting-five.js` | Modify | Remove `useConsumable`, add `slotConsumable`, add consumable multiplier constants, modify `tick()` to apply boost + unboosted cap |
| `functions/api/vault.js` | Modify | Replace `use-consumable` handler with `slot-consumable`, update `formatS5Response` to include `consumableCard`, update import |
| `functions/lib/trading.js` | Modify | Add consumable-slot check when validating trade card additions |
| `functions/lib/marketplace.js` | Modify | Add consumable-slot check when listing cards |
| `src/services/database.js` | Modify | Replace `useConsumable()` with `slotConsumable()` |
| `src/pages/vault/VaultContext.jsx` | Modify | Replace `boostS5WithConsumable` with `slotS5Consumable` |
| `src/pages/vault/CCStartingFive.jsx` | Modify | Replace boost button + ConsumablePicker with slotted consumable display + replacement confirmation |

---

## Task 1: Database Migration

**Files:**
- Create: `database/migrations/110-s5-consumable-slot.sql`

- [ ] **Step 1: Create migration file**

```sql
ALTER TABLE cc_starting_five_state
ADD COLUMN consumable_card_id INTEGER REFERENCES cc_cards(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX cc_s5_consumable_uniq
ON cc_starting_five_state(consumable_card_id)
WHERE consumable_card_id IS NOT NULL;
```

- [ ] **Step 2: Run migration against dev database**

Run the SQL against the Neon dev database to verify it executes cleanly.

- [ ] **Step 3: Commit**

```bash
git add database/migrations/110-s5-consumable-slot.sql
git commit -m "feat(vault): add consumable_card_id to cc_starting_five_state"
```

---

## Task 2: Shared Constants (economy.js)

**Files:**
- Modify: `src/data/vault/economy.js:112` (replace `CONSUMABLE_BOOST`)

- [ ] **Step 1: Replace CONSUMABLE_BOOST with new constants**

Replace line 112 (`export const CONSUMABLE_BOOST = ...`) with:

```javascript
// Consumable slot — rarity-based total boost (non-linear scaling)
export const CONSUMABLE_SLOT_SCALING = {
  common: 0.50, uncommon: 0.65, rare: 0.80, epic: 1.00, legendary: 1.35, mythic: 2.00,
};

// Per-consumable passion/cores spread (ratios sum to 1.0)
export const CONSUMABLE_SPREADS = {
  'health-pot':  { passion: 0.75, cores: 0.25 },
  'mana-pot':    { passion: 0.25, cores: 0.75 },
  'multi-pot':   { passion: 0.50, cores: 0.50 },
  'elixir-str':  { passion: 1.00, cores: 0.00 },
  'elixir-int':  { passion: 0.00, cores: 1.00 },
  'ward':        { passion: 0.60, cores: 0.40 },
  'sentry':      { passion: 0.40, cores: 0.60 },
};

// Compute final boost percentages for a consumable card
export function getConsumableBoost(consumableId, rarity) {
  const total = CONSUMABLE_SLOT_SCALING[rarity] || 0;
  const spread = CONSUMABLE_SPREADS[consumableId] || { passion: 0.5, cores: 0.5 };
  return {
    passionBoost: total * spread.passion,
    coresBoost: total * spread.cores,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/data/vault/economy.js
git commit -m "feat(vault): add consumable slot scaling and spread constants"
```

---

## Task 3: Backend — starting-five.js

**Files:**
- Modify: `functions/lib/starting-five.js`

This task modifies multiple parts of the file. Changes listed in order of appearance.

- [ ] **Step 1: Replace CONSUMABLE_BOOST constant with new constants**

Replace line 30 (`const CONSUMABLE_BOOST = { ... }`) with:

```javascript
const CONSUMABLE_SLOT_SCALING = {
  common: 0.50, uncommon: 0.65, rare: 0.80, epic: 1.00, legendary: 1.35, mythic: 2.00,
}
const CONSUMABLE_SPREADS = {
  'health-pot':  { passion: 0.75, cores: 0.25 },
  'mana-pot':    { passion: 0.25, cores: 0.75 },
  'multi-pot':   { passion: 0.50, cores: 0.50 },
  'elixir-str':  { passion: 1.00, cores: 0.00 },
  'elixir-int':  { passion: 0.00, cores: 1.00 },
  'ward':        { passion: 0.60, cores: 0.40 },
  'sentry':      { passion: 0.40, cores: 0.60 },
}

function getConsumableBoost(consumableId, rarity) {
  const total = CONSUMABLE_SLOT_SCALING[rarity] || 0
  const spread = CONSUMABLE_SPREADS[consumableId] || { passion: 0.5, cores: 0.5 }
  return { passionBoost: total * spread.passion, coresBoost: total * spread.cores }
}
```

- [ ] **Step 2: Modify `tick()` to fetch consumable and apply boost with unboosted cap**

After fetching `state` (line 175-177), also fetch the consumable card data:

```javascript
// Fetch slotted consumable (if any)
const [consumableCard] = state.consumable_card_id ? await sql`
  SELECT id, rarity, card_data FROM cc_cards WHERE id = ${state.consumable_card_id}
` : [null]
```

After the accrual loop (lines 206-211), apply consumable boost to the accrued amounts and compute cap from unboosted rates:

Replace the cap + pending calculation section (lines 213-218) with:

```javascript
const { totalPassionPerDay, totalCoresPerDay } = getTotalDailyRates(cards)
// Cap always uses unboosted rates
const passionCap = totalPassionPerDay * CAP_DAYS
const coresCap = totalCoresPerDay * CAP_DAYS

// Apply consumable boost to accrued amounts (not cap)
if (consumableCard?.card_data?.consumableId) {
  const boost = getConsumableBoost(consumableCard.card_data.consumableId, consumableCard.rarity)
  passionAccrued *= (1 + boost.passionBoost)
  coresAccrued *= (1 + boost.coresBoost)
}

let newPassion = Math.min((Number(state.passion_pending) || 0) + passionAccrued, passionCap)
let newCores = Math.min((Number(state.cores_pending) || 0) + coresAccrued, coresCap)
```

Update the return value to include the consumable card:

```javascript
return {
  cards,
  passionPending: newPassion,
  coresPending: newCores,
  lastTick: now.toISOString(),
  passionCap,
  coresCap,
  consumableCard,
}
```

Also update the early-return paths (lines 185-191 and 197-204) to include `consumableCard: null`.

- [ ] **Step 3: Add `slotConsumable` function**

Add after the `unslotAttachment` function (after line 401):

```javascript
export async function slotConsumable(sql, userId, cardId) {
  const [card] = await sql`
    SELECT id, rarity, card_type, card_data FROM cc_cards
    WHERE id = ${cardId} AND owner_id = ${userId}
  `
  if (!card) throw new Error('Card not found')
  if (card.card_type !== 'consumable') throw new Error('Only consumable cards can be slotted')

  // Check not listed on marketplace
  const [listing] = await sql`
    SELECT id FROM cc_market_listings WHERE card_id = ${cardId} AND status = 'active'
  `
  if (listing) throw new Error('Card is listed on marketplace — unlist it first')

  // Check not in active trade
  const [inTrade] = await sql`
    SELECT id FROM cc_trade_cards WHERE card_id = ${cardId}
  `
  if (inTrade) throw new Error('Card is in an active trade — cancel the trade first')

  // Check not in binder
  const [inBinder] = await sql`
    SELECT id FROM cc_binder_cards WHERE card_id = ${cardId} LIMIT 1
  `
  if (inBinder) throw new Error('Card is in your binder — remove it first')

  // Collect pending income before changing rates
  await collectIncome(sql, userId)
  await ensureState(sql, userId)

  // Get current consumable (if any) to destroy
  const [state] = await sql`
    SELECT consumable_card_id FROM cc_starting_five_state WHERE user_id = ${userId}
  `
  if (state?.consumable_card_id) {
    await sql`DELETE FROM cc_cards WHERE id = ${state.consumable_card_id}`
  }

  // Slot new consumable
  await sql`
    UPDATE cc_starting_five_state
    SET consumable_card_id = ${cardId}
    WHERE user_id = ${userId}
  `

  return await tick(sql, userId)
}
```

- [ ] **Step 4: Delete the `useConsumable` function**

Remove the entire `useConsumable` function (lines 403-444 in the original file).

- [ ] **Step 5: Update exports**

In the import line at `functions/api/vault.js:11`, `useConsumable` will be replaced with `slotConsumable`. Make sure `slotConsumable` is exported from starting-five.js.

- [ ] **Step 6: Commit**

```bash
git add functions/lib/starting-five.js
git commit -m "feat(vault): add slotConsumable, apply boost in tick, remove useConsumable"
```

---

## Task 4: Backend — vault.js API Handler

**Files:**
- Modify: `functions/api/vault.js:11,72,1255-1354`

- [ ] **Step 1: Update import**

Line 11 — replace `useConsumable` with `slotConsumable`:

```javascript
import { tick, collectIncome, slotCard, unslotCard, unslotAttachment, slotConsumable, getCardRates, getSlotRates, getAttachmentBonusInfo } from '../lib/starting-five.js'
```

- [ ] **Step 2: Update POST handler case**

Line 72 — replace:
```javascript
case 'use-consumable': return await handleUseConsumable(sql, user, body)
```
with:
```javascript
case 'slot-consumable': return await handleSlotConsumable(sql, user, body)
```

- [ ] **Step 3: Update `formatS5Response` to include consumable card and boosted rates**

In `formatS5Response` (lines 1255-1292), add consumable card to the response body. After computing `totalPassionPerHour` and `totalCoresPerHour` (lines 1275-1276), add:

```javascript
// Apply consumable boost to display rates (cap uses unboosted)
const consumable = state.consumableCard
let boostedPassionPerHour = totalPassionPerHour
let boostedCoresPerHour = totalCoresPerHour
let consumableResponse = null

if (consumable?.card_data?.consumableId) {
  const { getConsumableBoost: gcb } = await import('../lib/starting-five.js')
  // Inline the boost calc to avoid circular imports
  const SLOT_SCALING = { common: 0.50, uncommon: 0.65, rare: 0.80, epic: 1.00, legendary: 1.35, mythic: 2.00 }
  const SPREADS = {
    'health-pot': { passion: 0.75, cores: 0.25 }, 'mana-pot': { passion: 0.25, cores: 0.75 },
    'multi-pot': { passion: 0.50, cores: 0.50 }, 'elixir-str': { passion: 1.00, cores: 0.00 },
    'elixir-int': { passion: 0.00, cores: 1.00 }, 'ward': { passion: 0.60, cores: 0.40 },
    'sentry': { passion: 0.40, cores: 0.60 },
  }
  const total = SLOT_SCALING[consumable.rarity] || 0
  const spread = SPREADS[consumable.card_data.consumableId] || { passion: 0.5, cores: 0.5 }
  const passionBoost = total * spread.passion
  const coresBoost = total * spread.cores

  boostedPassionPerHour = totalPassionPerHour * (1 + passionBoost)
  boostedCoresPerHour = totalCoresPerHour * (1 + coresBoost)

  consumableResponse = {
    ...formatCard(consumable),
    passionBoostPct: Math.round(passionBoost * 100),
    coresBoostPct: Math.round(coresBoost * 100),
  }
}
```

Wait — that duplicates the constants. Better approach: since `getConsumableBoost` is already exported from starting-five.js and vault.js already imports from there, just import and use it directly. But `formatS5Response` is not async. Let's just duplicate the small helper inline in `formatS5Response` or import the constants.

**Revised approach:** Export `getConsumableBoost` from starting-five.js (it's a pure function). Import it in vault.js alongside the other imports. Then use it in `formatS5Response`:

Update the import (line 11) to also include `getConsumableBoost`:
```javascript
import { tick, collectIncome, slotCard, unslotCard, unslotAttachment, slotConsumable, getCardRates, getSlotRates, getAttachmentBonusInfo, getConsumableBoost } from '../lib/starting-five.js'
```

Then in `formatS5Response`, after `totalCoresPerHour`:

```javascript
const consumable = state.consumableCard
let boostedPassionPerHour = totalPassionPerHour
let boostedCoresPerHour = totalCoresPerHour
let consumableResponse = null

if (consumable?.card_data?.consumableId) {
  const boost = getConsumableBoost(consumable.card_data.consumableId, consumable.rarity)
  boostedPassionPerHour = totalPassionPerHour * (1 + boost.passionBoost)
  boostedCoresPerHour = totalCoresPerHour * (1 + boost.coresBoost)
  consumableResponse = {
    ...formatCard(consumable),
    passionBoostPct: Math.round(boost.passionBoost * 100),
    coresBoostPct: Math.round(boost.coresBoost * 100),
  }
}
```

Update the response body to use boosted rates for display and unboosted for cap:

```javascript
body: JSON.stringify({
  ...extra,
  cards: cardsWithRates,
  passionPending: state.passionPending,
  coresPending: state.coresPending,
  lastTick: state.lastTick,
  totalPassionPerHour: boostedPassionPerHour,
  totalCoresPerHour: boostedCoresPerHour,
  passionCap: state.passionCap || totalPassionPerHour * 48,
  coresCap: state.coresCap || totalCoresPerHour * 48,
  consumableCard: consumableResponse,
}),
```

Note: `passionCap` and `coresCap` use the unboosted `totalPassionPerHour` (not `boostedPassionPerHour`). This is the key design requirement.

- [ ] **Step 4: Replace `handleUseConsumable` with `handleSlotConsumable`**

Replace lines 1342-1354 with:

```javascript
async function handleSlotConsumable(sql, user, body) {
  const { cardId } = body
  if (!cardId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'cardId required' }) }
  }
  const state = await slotConsumable(sql, user.id, cardId)

  getVaultStats(sql, user.id)
    .then(stats => pushChallengeProgress(sql, user.id, stats))
    .catch(err => console.error('Vault challenge push (slot-consumable) failed:', err))

  return formatS5Response(state)
}
```

- [ ] **Step 5: Commit**

```bash
git add functions/api/vault.js
git commit -m "feat(vault): replace use-consumable with slot-consumable API handler"
```

---

## Task 5: Backend — Cross-System Locks

**Files:**
- Modify: `functions/lib/trading.js:114-119`
- Modify: `functions/lib/marketplace.js:30-35`

- [ ] **Step 1: Add consumable-slot check in trading.js**

After the existing `cc_lineups` check (line 116-119), add:

```javascript
// Check card not slotted as Starting 5 consumable
const [inS5Consumable] = await tx`
  SELECT user_id FROM cc_starting_five_state
  WHERE consumable_card_id = ${cardId}
`
if (inS5Consumable) throw new Error('Card is slotted in Starting 5 — replace it first')
```

- [ ] **Step 2: Add consumable-slot check in marketplace.js**

After the existing `cc_lineups` check (line 32-35), add:

```javascript
// Check card not slotted as Starting 5 consumable
const [inS5Consumable] = await sql`
  SELECT user_id FROM cc_starting_five_state
  WHERE consumable_card_id = ${cardId}
`
if (inS5Consumable) {
  return { statusCode: 400, headers, body: JSON.stringify({ error: 'Card is slotted in Starting 5 — replace it first' }) }
}
```

- [ ] **Step 3: Also update trade execution to clear consumable slot if traded card is a consumable**

In `trading.js`, in the trade execution section (around lines 279-294), after the existing `cc_lineups` cleanup for each side's cards, add:

```javascript
await tx`UPDATE cc_starting_five_state SET consumable_card_id = NULL WHERE consumable_card_id = ANY(${aCardIds})`
```

And for bCards:
```javascript
await tx`UPDATE cc_starting_five_state SET consumable_card_id = NULL WHERE consumable_card_id = ANY(${bCardIds})`
```

Similarly in `marketplace.js` purchase execution (around line 118-123), add:
```javascript
await tx`UPDATE cc_starting_five_state SET consumable_card_id = NULL WHERE consumable_card_id = ${listing.card_id}`
```

- [ ] **Step 4: Commit**

```bash
git add functions/lib/trading.js functions/lib/marketplace.js
git commit -m "feat(vault): add consumable-slot lock checks in trading and marketplace"
```

---

## Task 6: Frontend — Database Service

**Files:**
- Modify: `src/services/database.js:1061-1063`

- [ ] **Step 1: Replace useConsumable with slotConsumable**

Replace:
```javascript
useConsumable(cardId) {
    return apiPost('vault', { action: 'use-consumable' }, { cardId })
},
```

With:
```javascript
slotConsumable(cardId) {
    return apiPost('vault', { action: 'slot-consumable' }, { cardId })
},
```

- [ ] **Step 2: Commit**

```bash
git add src/services/database.js
git commit -m "feat(vault): replace useConsumable with slotConsumable API call"
```

---

## Task 7: Frontend — VaultContext

**Files:**
- Modify: `src/pages/vault/VaultContext.jsx:190-195,323`

- [ ] **Step 1: Replace boostS5WithConsumable with slotS5Consumable**

Replace lines 190-195:
```javascript
const boostS5WithConsumable = useCallback(async (cardId) => {
  const data = await vaultService.useConsumable(cardId)
  setStartingFive(data)
  setCollection(prev => prev.filter(c => c.id !== data.consumedCardId))
  return data
}, [])
```

With:
```javascript
const slotS5Consumable = useCallback(async (cardId) => {
  const data = await vaultService.slotConsumable(cardId)
  setStartingFive(data)
  // Remove the slotted card from collection (it's now locked)
  // If a previous consumable was destroyed, it was already removed server-side
  setCollection(prev => prev.filter(c => c.id !== cardId))
  return data
}, [])
```

Note: We also need to remove the previously-slotted consumable from collection if one existed. The server destroys it, but the client still has it in state. We can handle this by removing any card whose id matches the previous `startingFive.consumableCard?.id`:

```javascript
const slotS5Consumable = useCallback(async (cardId) => {
  const prevConsumableId = startingFive?.consumableCard?.id
  const data = await vaultService.slotConsumable(cardId)
  setStartingFive(data)
  setCollection(prev => prev.filter(c => c.id !== cardId && c.id !== prevConsumableId))
  return data
}, [startingFive?.consumableCard?.id])
```

- [ ] **Step 2: Update context provider value**

Line 323 — replace `boostS5WithConsumable` with `slotS5Consumable` in the provider value.

- [ ] **Step 3: Commit**

```bash
git add src/pages/vault/VaultContext.jsx
git commit -m "feat(vault): replace boostS5WithConsumable with slotS5Consumable in VaultContext"
```

---

## Task 8: Frontend — CCStartingFive.jsx

**Files:**
- Modify: `src/pages/vault/CCStartingFive.jsx`

This is the largest frontend change. The boost button, boost notification, and ConsumablePicker modal are all replaced with a slotted consumable display and replacement confirmation flow.

- [ ] **Step 1: Update imports**

Line 3 — remove `CONSUMABLE_BOOST` from the import, add `CONSUMABLE_SLOT_SCALING, CONSUMABLE_SPREADS, getConsumableBoost`:

```javascript
import { RARITIES, STARTING_FIVE_RATES, STARTING_FIVE_CAP_DAYS, ATTACHMENT_BONUSES, FULL_HOLO_ATTACHMENT_RATIO, GOD_SYNERGY_BONUS, CONSUMABLE_SLOT_SCALING, CONSUMABLE_SPREADS, getConsumableBoost, getHoloEffect } from '../../data/vault/economy'
```

- [ ] **Step 2: Update component destructuring and state**

Line 181 — replace `boostS5WithConsumable` with `slotS5Consumable`:
```javascript
const { collection, startingFive, slotS5Card, unslotS5Card, unslotS5Attachment, collectS5Income, slotS5Consumable, getDefOverride } = useVault()
```

Remove these state variables (lines 190-192):
- `showConsumablePicker` — keep but repurpose
- `usingConsumable` — keep but rename to `slottingConsumable`
- `boostNotif` — remove

Add new state:
```javascript
const [confirmReplace, setConfirmReplace] = useState(null) // card to confirm replacing with
```

- [ ] **Step 3: Replace handleUseConsumable with handleSlotConsumable**

Replace lines 320-333 with:

```javascript
const handleSlotConsumable = useCallback(async (cardId) => {
  const currentConsumable = startingFive?.consumableCard
  if (currentConsumable) {
    // Show confirmation before replacing
    setConfirmReplace(cardId)
    return
  }
  await doSlotConsumable(cardId)
}, [startingFive?.consumableCard])

const doSlotConsumable = useCallback(async (cardId) => {
  if (slottingConsumable) return
  setSlottingConsumable(true)
  try {
    await slotS5Consumable(cardId)
    setShowConsumablePicker(false)
    setConfirmReplace(null)
  } catch (err) {
    showError(err.message || 'Failed to slot consumable')
  } finally {
    setSlottingConsumable(false)
  }
}, [slottingConsumable, slotS5Consumable, showError])
```

- [ ] **Step 4: Replace the Boost button with slotted consumable display**

Replace the Boost button section (lines 436-445) with a consumable slot display:

```jsx
{/* Consumable slot */}
{startingFive?.consumableCard ? (
  <button
    onClick={() => setShowConsumablePicker(true)}
    className="group flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-[var(--cd-border)] hover:border-amber-500/30 transition-all cursor-pointer"
    title="Replace consumable (current one will be destroyed)"
  >
    <div className="w-8 h-8 rounded overflow-hidden">
      <TradingCardHolo rarity={getHoloEffect(startingFive.consumableCard.rarity)} role="ADC" holoType={startingFive.consumableCard.holoType || 'reverse'} size={32}>
        <GameCard type="consumable" rarity={startingFive.consumableCard.rarity} data={toGameCardData(startingFive.consumableCard, getDefOverride?.(startingFive.consumableCard))} size={32} />
      </TradingCardHolo>
    </div>
    <div className="text-left">
      <div className="text-[9px] text-white/40 cd-head">CONSUMABLE</div>
      <div className="flex items-center gap-1.5 text-[10px] font-bold cd-num">
        {startingFive.consumableCard.passionBoostPct > 0 && (
          <span className="text-amber-400">+{startingFive.consumableCard.passionBoostPct}%</span>
        )}
        {startingFive.consumableCard.coresBoostPct > 0 && (
          <span className="text-[var(--cd-cyan)]">+{startingFive.consumableCard.coresBoostPct}%</span>
        )}
      </div>
    </div>
    <ArrowRightLeft size={12} className="text-white/20 group-hover:text-white/40" />
  </button>
) : (
  <button
    onClick={() => setShowConsumablePicker(true)}
    disabled={!startingFive?.cards?.length}
    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-white/10 hover:border-amber-500/30 text-white/30 hover:text-amber-400 transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-30"
    title="Slot a consumable to boost income rate"
  >
    <Plus size={14} />
    <span className="text-[10px] font-bold cd-head tracking-wider">CONSUMABLE</span>
  </button>
)}
```

- [ ] **Step 5: Remove boostNotif rendering**

Remove the boostNotif section (lines 466-473).

- [ ] **Step 6: Update ConsumablePicker modal rendering**

Replace the ConsumablePicker usage (lines 555-563) to pass the new handler:

```jsx
{showConsumablePicker && (
  <ConsumablePicker
    collection={collection}
    allSlottedIds={allSlottedIds}
    onSelect={handleSlotConsumable}
    onClose={() => { setShowConsumablePicker(false); setConfirmReplace(null) }}
    using={slottingConsumable}
    getDefOverride={getDefOverride}
    currentConsumable={startingFive?.consumableCard}
  />
)}
```

- [ ] **Step 7: Rewrite the ConsumablePicker component**

Replace the `ConsumablePicker` function (lines 634-720) to show boost spreads instead of the old percentage, and include inline confirmation:

```jsx
function ConsumablePicker({ collection, allSlottedIds, onSelect, onClose, using, getDefOverride, currentConsumable }) {
  const [confirmCardId, setConfirmCardId] = useState(null)

  const eligibleCards = useMemo(() => {
    return collection
      .filter(card => {
        const type = getCardType(card)
        if (type !== 'consumable') return false
        if (allSlottedIds.has(card.id)) return false
        // Don't show the currently slotted consumable
        if (currentConsumable && card.id === currentConsumable.id) return false
        return true
      })
      .sort((a, b) => {
        const rDiff = (RARITY_TIER[b.rarity] || 0) - (RARITY_TIER[a.rarity] || 0)
        if (rDiff !== 0) return rDiff
        return (a.godName || '').localeCompare(b.godName || '')
      })
  }, [collection, allSlottedIds, currentConsumable])

  const handleSelect = useCallback((cardId) => {
    if (currentConsumable) {
      setConfirmCardId(cardId)
    } else {
      onSelect(cardId)
    }
  }, [currentConsumable, onSelect])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose} style={{ animation: 'cd-fade-in 0.2s ease-out' }}>
      <div className="relative w-full max-w-2xl max-h-[100dvh] sm:max-h-[80vh] bg-[var(--cd-surface)] border border-[var(--cd-border)] sm:rounded-xl rounded-none overflow-hidden sm:mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--cd-border)]">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-amber-400" />
            <h3 className="text-base font-bold cd-head text-[var(--cd-text)] tracking-wider">
              {currentConsumable ? 'Replace Consumable' : 'Slot Consumable'}
            </h3>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors cursor-pointer"><X size={20} /></button>
        </div>

        <div className="px-5 pt-3 pb-1 text-xs text-white/40">
          {currentConsumable
            ? 'Select a consumable to replace the current one. The current consumable will be destroyed.'
            : 'Slot a consumable to boost your Starting 5 income rate. Once slotted, it can only be removed by replacing it.'}
        </div>

        {/* Confirmation overlay */}
        {confirmCardId && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 backdrop-blur-sm rounded-xl">
            <div className="bg-[var(--cd-surface)] border border-red-500/30 rounded-xl p-6 mx-4 max-w-sm text-center">
              <Trash2 size={24} className="mx-auto mb-3 text-red-400" />
              <p className="text-sm text-white/80 mb-1 cd-head">Replace consumable?</p>
              <p className="text-xs text-white/40 mb-4">
                Your <span className="font-bold" style={{ color: RARITIES[currentConsumable?.rarity]?.color }}>{RARITIES[currentConsumable?.rarity]?.name}</span> {currentConsumable?.godName} will be <span className="text-red-400 font-bold">destroyed</span>.
              </p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => setConfirmCardId(null)} className="px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white/70 border border-white/10 cursor-pointer">Cancel</button>
                <button onClick={() => { onSelect(confirmCardId); setConfirmCardId(null) }} disabled={using} className="px-4 py-2 rounded-lg text-sm font-bold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 cursor-pointer disabled:opacity-50">
                  {using ? 'Replacing...' : 'Destroy & Replace'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="p-5 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 110px)' }}>
          {eligibleCards.length === 0 ? (
            <div className="text-center py-12 text-white/30">
              <Zap size={40} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm cd-head tracking-wider">No consumable cards</p>
              <p className="text-xs text-white/20 mt-1">Open packs to find consumables</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
              {eligibleCards.map(card => {
                const color = RARITIES[card.rarity]?.color || '#9ca3af'
                const consumableId = card.cardData?.consumableId
                const boost = consumableId ? getConsumableBoost(consumableId, card.rarity) : { passionBoost: 0, coresBoost: 0 }
                const override = getDefOverride?.(card)
                return (
                  <button
                    key={card.id}
                    onClick={() => handleSelect(card.id)}
                    disabled={using}
                    className="group flex flex-col items-center rounded-xl p-2 transition-all hover:bg-white/[0.04] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="transition-all group-hover:scale-[1.03]">
                      <TradingCardHolo rarity={getHoloEffect(card.rarity)} role="ADC" holoType={card.holoType || 'reverse'} size={120}>
                        <GameCard type="consumable" rarity={card.rarity} data={toGameCardData(card, override)} size={120} />
                      </TradingCardHolo>
                    </div>
                    <div className="mt-1.5 text-center" style={{ maxWidth: 120 }}>
                      <div className="text-[10px] font-bold text-white/60 truncate cd-head">{card.godName}</div>
                      <div className="flex items-center justify-center gap-1 mt-0.5">
                        <span className="text-[9px] font-bold cd-head" style={{ color }}>{RARITIES[card.rarity]?.name}</span>
                      </div>
                      <div className="flex items-center justify-center gap-1.5 mt-0.5 text-[10px] font-bold cd-num">
                        {boost.passionBoost > 0 && (
                          <span className="text-amber-400">+{Math.round(boost.passionBoost * 100)}%</span>
                        )}
                        {boost.coresBoost > 0 && (
                          <span className="text-[var(--cd-cyan)]">+{Math.round(boost.coresBoost * 100)}%</span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Commit**

```bash
git add src/pages/vault/CCStartingFive.jsx
git commit -m "feat(vault): replace consumable boost UI with slotted consumable display"
```

---

## Task 9: Manual Testing

- [ ] **Step 1: Start dev server**

Run: `npm start`

- [ ] **Step 2: Test empty slot state**

Navigate to Starting 5 page. Verify the empty consumable slot shows a "+" button with "CONSUMABLE" label. Verify it's disabled when no player cards are slotted.

- [ ] **Step 3: Test slotting a consumable**

Click the "+" button. Verify the picker shows consumable cards from your collection with passion/cores boost percentages. Select one. Verify it appears in the slot display with correct boost percentages.

- [ ] **Step 4: Test rate boost is applied**

Verify the income rate display reflects the boosted rate. Verify the cap values have NOT changed. The fill bar should fill faster.

- [ ] **Step 5: Test replacement with confirmation**

Click the slotted consumable to open the picker. Select a different consumable. Verify the confirmation modal appears showing the current card will be destroyed. Confirm. Verify the old card is gone from collection and the new one is slotted.

- [ ] **Step 6: Test cross-system locks**

Try to list the slotted consumable on marketplace — should fail. Try to add it to a trade — should fail.

- [ ] **Step 7: Final commit**

After all tests pass, ensure everything is committed.

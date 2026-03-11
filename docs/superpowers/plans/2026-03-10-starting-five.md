# Starting 5 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Starting 5" passive income system to the Card Clash vault — players slot one card per SMITE role, earning Passion/Cores based on holo type and rarity.

**Architecture:** New `holo_type` column on `cc_cards` (holo/reverse/full, rolled at creation). Reuse existing `cc_lineups` table for slot storage. New `cc_starting_five_state` table for income tracking. Server calculates accrual on load; frontend counts client-side between refreshes.

**Tech Stack:** PostgreSQL migration, Cloudflare Pages Functions (API), React (frontend component + context integration)

**Spec:** `docs/superpowers/specs/2026-03-10-starting-five-design.md`

---

## Chunk 1: Database & Backend

### Task 1: Database Migration

**Files:**
- Create: `database/migrations/085-starting-five.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Add holo_type to cc_cards (holo/reverse/full for uncommon+, NULL for common)
ALTER TABLE cc_cards ADD COLUMN IF NOT EXISTS holo_type TEXT;

-- Backfill existing uncommon+ cards with random holo type
UPDATE cc_cards
SET holo_type = (ARRAY['holo','reverse','full'])[floor(random()*3)+1]
WHERE rarity != 'common' AND holo_type IS NULL;

-- Add slotted_at to existing cc_lineups table
ALTER TABLE cc_lineups ADD COLUMN IF NOT EXISTS slotted_at TIMESTAMPTZ DEFAULT NOW();

-- Per-user Starting 5 income state
CREATE TABLE IF NOT EXISTS cc_starting_five_state (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    passion_pending NUMERIC(10,4) DEFAULT 0,
    cores_pending NUMERIC(10,4) DEFAULT 0,
    last_tick TIMESTAMPTZ
);
```

- [ ] **Step 2: Commit**

```bash
git add database/migrations/085-starting-five.sql
git commit -m "feat: add Starting 5 migration — holo_type column, income state table"
```

---

### Task 2: Add holo_type to Card Generation

**Files:**
- Modify: `functions/lib/vault.js:35-37` (rollHoloEffect) and lines 50, 71, 95, 140, 248 (each generate function)
- Modify: `src/data/vault/economy.js` (add rate constants)

- [ ] **Step 1: Add `rollHoloType` function to `functions/lib/vault.js`**

After the existing `rollHoloEffect` function (line 37), add:

```javascript
function rollHoloType(rarity) {
  if (rarity === 'common') return null
  const types = ['holo', 'reverse', 'full']
  return types[Math.floor(Math.random() * types.length)]
}
```

- [ ] **Step 2: Add `holo_type` to all card generation functions**

In `generateCard` (line 50 area), add `holo_type: rollHoloType(rarity),` after the `holo_effect` line.

Do the same in:
- `generateItemCard` (after line 71)
- `generateConsumableCard` (after line 95)
- `generatePlayerCard` (after line 140)
- `generatePlayerCardLegacy` (after line 248)

- [ ] **Step 3: Add `holo_type` to the INSERT statement**

In `openPack()` (line 309 area), the INSERT already lists columns. Add `holo_type` to both the column list and VALUES:

```sql
INSERT INTO cc_cards (owner_id, god_id, god_name, god_class, role, rarity, serial_number, holo_effect, holo_type, image_url, acquired_via, card_type, card_data, def_id)
VALUES (${userId}, ${card.god_id}, ${card.god_name}, ${card.god_class}, ${card.role}, ${card.rarity}, ${card.serial_number}, ${card.holo_effect}, ${card.holo_type}, ${card.image_url}, ${card.acquired_via}, ${card.card_type}, ${card.card_data ? JSON.stringify(card.card_data) : null}, ${card.def_id || null})
```

Also update the INSERT in `functions/api/vault.js` (the `handleOpenGift` function, around line 624) which has its own INSERT INTO cc_cards — add `holo_type` there too. Search both files for all `INSERT INTO cc_cards` to be thorough.

- [ ] **Step 4: Add `holoType` to `formatCard` in `functions/api/vault.js`**

In `formatCard` (around line 704), add after the `holoEffect` line:

```javascript
holoType: row.holo_type,
```

- [ ] **Step 5: Add Starting 5 rate constants to `src/data/vault/economy.js`**

After the `MARKETPLACE` export (line 53), add:

```javascript
// Starting 5 passive income rates (per day, per card)
export const STARTING_FIVE_RATES = {
  // holoType → { rarity → dailyRate }
  holo: {  // earns Passion
    uncommon: 1, rare: 2, epic: 3, legendary: 5, mythic: 8,
  },
  reverse: {  // earns Cores
    uncommon: 1, rare: 1.5, epic: 2.5, legendary: 4, mythic: 6,
  },
  full: {  // earns both at 60%
    passion: { uncommon: 0.6, rare: 1.2, epic: 1.8, legendary: 3, mythic: 4.8 },
    cores: { uncommon: 0.6, rare: 0.9, epic: 1.5, legendary: 2.4, mythic: 3.6 },
  },
};

// Accumulation cap: 2 days' worth
export const STARTING_FIVE_CAP_DAYS = 2;
```

- [ ] **Step 6: Commit**

```bash
git add functions/lib/vault.js functions/api/vault.js src/data/vault/economy.js
git commit -m "feat: add holo_type to card generation and Starting 5 rate constants"
```

---

### Task 3: Starting 5 Backend Logic

**Files:**
- Create: `functions/lib/starting-five.js`

This file handles all server-side Starting 5 logic: tick calculation, income collection, slot management.

- [ ] **Step 1: Create `functions/lib/starting-five.js`**

```javascript
// Starting 5 — passive income from slotted cards
import { grantEmber } from './ember.js'
import { grantPassion } from './passion.js'

// Income rates per day per card, keyed by holoType then rarity
const RATES = {
  holo: { uncommon: 1, rare: 2, epic: 3, legendary: 5, mythic: 8 },
  reverse: { uncommon: 1, rare: 1.5, epic: 2.5, legendary: 4, mythic: 6 },
  full: {
    passion: { uncommon: 0.6, rare: 1.2, epic: 1.8, legendary: 3, mythic: 4.8 },
    cores: { uncommon: 0.6, rare: 0.9, epic: 1.5, legendary: 2.4, mythic: 3.6 },
  },
}

const CAP_DAYS = 2
const HOURS_PER_DAY = 24

/**
 * Get per-hour rates for a single card.
 * Returns { passionPerHour, coresPerHour }
 */
export function getCardRates(holoType, rarity) {
  if (!holoType || rarity === 'common') return { passionPerHour: 0, coresPerHour: 0 }

  let passionDaily = 0, coresDaily = 0

  if (holoType === 'holo') {
    passionDaily = RATES.holo[rarity] || 0
  } else if (holoType === 'reverse') {
    coresDaily = RATES.reverse[rarity] || 0
  } else if (holoType === 'full') {
    passionDaily = RATES.full.passion[rarity] || 0
    coresDaily = RATES.full.cores[rarity] || 0
  }

  return {
    passionPerHour: passionDaily / HOURS_PER_DAY,
    coresPerHour: coresDaily / HOURS_PER_DAY,
  }
}

/**
 * Calculate total daily rates for all slotted cards.
 * Returns { totalPassionPerDay, totalCoresPerDay }
 */
function getTotalDailyRates(cards) {
  let totalPassion = 0, totalCores = 0
  for (const card of cards) {
    const { passionPerHour, coresPerHour } = getCardRates(card.holo_type, card.rarity)
    totalPassion += passionPerHour * HOURS_PER_DAY
    totalCores += coresPerHour * HOURS_PER_DAY
  }
  return { totalPassionPerDay: totalPassion, totalCoresPerDay: totalCores }
}

/**
 * Ensure state row exists for user.
 */
async function ensureState(sql, userId) {
  await sql`
    INSERT INTO cc_starting_five_state (user_id)
    VALUES (${userId})
    ON CONFLICT (user_id) DO NOTHING
  `
}

/**
 * Run a tick: calculate elapsed time, accrue income, cap it.
 * Call this before any Starting 5 read or mutation.
 * Returns the updated state + slotted cards.
 */
export async function tick(sql, userId) {
  await ensureState(sql, userId)

  // Get slotted cards (select all cc_cards columns for formatCard compatibility)
  const cards = await sql`
    SELECT l.role AS slot_role, c.*
    FROM cc_lineups l
    JOIN cc_cards c ON l.card_id = c.id
    WHERE l.user_id = ${userId} AND l.card_id IS NOT NULL
  `

  const [state] = await sql`
    SELECT * FROM cc_starting_five_state WHERE user_id = ${userId}
  `

  if (!state.last_tick || cards.length === 0) {
    // First time or no cards slotted — just set last_tick, no accrual
    await sql`
      UPDATE cc_starting_five_state
      SET last_tick = NOW()
      WHERE user_id = ${userId}
    `
    return {
      cards,
      passionPending: Number(state.passion_pending) || 0,
      coresPending: Number(state.cores_pending) || 0,
      lastTick: new Date().toISOString(),
    }
  }

  // Calculate elapsed hours
  const now = new Date()
  const lastTick = new Date(state.last_tick)
  const elapsedMs = now - lastTick
  const elapsedHours = elapsedMs / (1000 * 60 * 60)

  if (elapsedHours < 0.001) {
    // Less than ~4 seconds, skip tick
    return {
      cards,
      passionPending: Number(state.passion_pending) || 0,
      coresPending: Number(state.cores_pending) || 0,
      lastTick: state.last_tick,
    }
  }

  // Calculate accrual
  let passionAccrued = 0, coresAccrued = 0
  for (const card of cards) {
    const { passionPerHour, coresPerHour } = getCardRates(card.holo_type, card.rarity)
    passionAccrued += passionPerHour * elapsedHours
    coresAccrued += coresPerHour * elapsedHours
  }

  // Apply cap (2 days' worth)
  const { totalPassionPerDay, totalCoresPerDay } = getTotalDailyRates(cards)
  const passionCap = totalPassionPerDay * CAP_DAYS
  const coresCap = totalCoresPerDay * CAP_DAYS

  let newPassion = Math.min((Number(state.passion_pending) || 0) + passionAccrued, passionCap)
  let newCores = Math.min((Number(state.cores_pending) || 0) + coresAccrued, coresCap)

  await sql`
    UPDATE cc_starting_five_state
    SET passion_pending = ${newPassion},
        cores_pending = ${newCores},
        last_tick = NOW()
    WHERE user_id = ${userId}
  `

  return {
    cards,
    passionPending: newPassion,
    coresPending: newCores,
    lastTick: now.toISOString(),
    passionCap,
    coresCap,
  }
}

/**
 * Collect pending income — grants real Passion + Cores, resets pending.
 * Floors to integers for granting; fractional remainder stays pending.
 * Returns full state (like tick) plus granted amounts.
 */
export async function collectIncome(sql, userId) {
  const state = await tick(sql, userId)

  const passionToGrant = Math.floor(state.passionPending)
  const coresToGrant = Math.floor(state.coresPending)

  const passionRemainder = state.passionPending - passionToGrant
  const coresRemainder = state.coresPending - coresToGrant

  if (passionToGrant > 0) {
    await grantPassion(sql, userId, 'starting_five', passionToGrant, 'Starting 5 passive income')
  }
  if (coresToGrant > 0) {
    await grantEmber(sql, userId, 'starting_five', coresToGrant, 'Starting 5 passive income')
  }

  await sql`
    UPDATE cc_starting_five_state
    SET passion_pending = ${passionRemainder},
        cores_pending = ${coresRemainder}
    WHERE user_id = ${userId}
  `

  return {
    ...state,
    passionPending: passionRemainder,
    coresPending: coresRemainder,
    passionGranted: passionToGrant,
    coresGranted: coresToGrant,
  }
}

/**
 * Slot a card into a role. Auto-collects pending income first.
 */
export async function slotCard(sql, userId, cardId, role) {
  // Validate role
  const validRoles = ['solo', 'jungle', 'mid', 'support', 'adc']
  if (!validRoles.includes(role)) throw new Error('Invalid role')

  // Validate card ownership + eligibility
  const [card] = await sql`
    SELECT id, rarity, holo_type, role, card_type
    FROM cc_cards WHERE id = ${cardId} AND owner_id = ${userId}
  `
  if (!card) throw new Error('Card not found')
  if (card.rarity === 'common') throw new Error('Common cards cannot be slotted')
  if (!card.holo_type) throw new Error('Card has no holo type')
  if (!card.role) throw new Error('Only god and player cards can be slotted')
  if (card.role !== role) throw new Error(`Card role (${card.role}) does not match slot (${role})`)

  // Check card is not listed on marketplace
  const [listing] = await sql`
    SELECT id FROM cc_market_listings
    WHERE card_id = ${cardId} AND status = 'active'
  `
  if (listing) throw new Error('Card is listed on marketplace — unlist it first')

  // Check card is not already in another slot
  const [existing] = await sql`
    SELECT role FROM cc_lineups
    WHERE user_id = ${userId} AND card_id = ${cardId}
  `
  if (existing) throw new Error(`Card is already slotted in ${existing.role}`)

  // Auto-collect before swapping
  await collectIncome(sql, userId)

  // Upsert into lineups
  await sql`
    INSERT INTO cc_lineups (user_id, role, card_id, slotted_at)
    VALUES (${userId}, ${role}, ${cardId}, NOW())
    ON CONFLICT (user_id, role)
    DO UPDATE SET card_id = ${cardId}, slotted_at = NOW()
  `

  return await tick(sql, userId)
}

/**
 * Remove a card from a slot. Auto-collects pending income first.
 */
export async function unslotCard(sql, userId, role) {
  const validRoles = ['solo', 'jungle', 'mid', 'support', 'adc']
  if (!validRoles.includes(role)) throw new Error('Invalid role')

  // Auto-collect before removing
  await collectIncome(sql, userId)

  await sql`
    UPDATE cc_lineups
    SET card_id = NULL, slotted_at = NULL
    WHERE user_id = ${userId} AND role = ${role}
  `

  return await tick(sql, userId)
}
```

- [ ] **Step 2: Commit**

```bash
git add functions/lib/starting-five.js
git commit -m "feat: Starting 5 backend logic — tick, collect, slot/unslot"
```

---

### Task 4: Starting 5 API Endpoints

**Files:**
- Modify: `functions/api/vault.js:8` (imports), lines 34-44 (GET switch), lines 49-54 (POST switch)

- [ ] **Step 1: Add import**

At line 8 in `functions/api/vault.js`, after the existing imports, add:

```javascript
import { tick, collectIncome, slotCard, unslotCard, getCardRates } from '../lib/starting-five.js'
```

- [ ] **Step 2: Add GET action for `starting-five`**

In the GET switch (after line 42), add before the `default`:

```javascript
case 'starting-five': return await handleStartingFive(sql, user)
```

- [ ] **Step 3: Add POST actions**

In the POST switch (after line 53), add before the `default`:

```javascript
case 'slot-card': return await handleSlotCard(sql, user, body)
case 'unslot-card': return await handleUnslotCard(sql, user, body)
case 'collect-income': return await handleCollectIncome(sql, user)
```

- [ ] **Step 4: Add handler functions**

At the end of the file (before `formatCard`), add:

```javascript
// ═══ Starting 5 ═══

function formatS5Response(state, extra = {}) {
  const cardsWithRates = state.cards.map(c => ({
    ...formatCard(c),
    slotRole: c.slot_role,
    passionPerHour: getCardRates(c.holo_type, c.rarity).passionPerHour,
    coresPerHour: getCardRates(c.holo_type, c.rarity).coresPerHour,
  }))

  const totalPassionPerHour = cardsWithRates.reduce((s, c) => s + c.passionPerHour, 0)
  const totalCoresPerHour = cardsWithRates.reduce((s, c) => s + c.coresPerHour, 0)

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      ...extra,
      cards: cardsWithRates,
      passionPending: state.passionPending,
      coresPending: state.coresPending,
      lastTick: state.lastTick,
      totalPassionPerHour,
      totalCoresPerHour,
      passionCap: state.passionCap || totalPassionPerHour * 48,
      coresCap: state.coresCap || totalCoresPerHour * 48,
    }),
  }
}

async function handleStartingFive(sql, user) {
  const state = await tick(sql, user.id)
  return formatS5Response(state)
}

async function handleSlotCard(sql, user, body) {
  const { cardId, role } = body
  if (!cardId || !role) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'cardId and role required' }) }
  }
  const state = await slotCard(sql, user.id, cardId, role)
  return formatS5Response(state)
}

async function handleUnslotCard(sql, user, body) {
  const { role } = body
  if (!role) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'role required' }) }
  }
  const state = await unslotCard(sql, user.id, role)
  return formatS5Response(state)
}

async function handleCollectIncome(sql, user) {
  const result = await collectIncome(sql, user.id)
  return formatS5Response(result, {
    passionGranted: result.passionGranted,
    coresGranted: result.coresGranted,
  })
}
```

- [ ] **Step 5: Commit**

```bash
git add functions/api/vault.js
git commit -m "feat: Starting 5 API endpoints — load, slot, unslot, collect"
```

---

### Task 5: Service Layer

**Files:**
- Modify: `src/services/database.js:978` (vaultService object)

- [ ] **Step 1: Add Starting 5 methods to `vaultService`**

In the `vaultService` object (after the existing methods around line 1019), add:

```javascript
    loadStartingFive() {
        return apiCall('vault', { action: 'starting-five' })
    },
    slotCard(cardId, role) {
        return apiPost('vault', { action: 'slot-card' }, { cardId, role })
    },
    unslotCard(role) {
        return apiPost('vault', { action: 'unslot-card' }, { role })
    },
    collectIncome() {
        return apiPost('vault', { action: 'collect-income' }, {})
    },
```

- [ ] **Step 2: Commit**

```bash
git add src/services/database.js
git commit -m "feat: add Starting 5 service methods"
```

---

## Chunk 2: Frontend

### Task 6: VaultContext Integration

**Files:**
- Modify: `src/pages/vault/VaultContext.jsx`

- [ ] **Step 1: Add Starting 5 state and methods**

Add state after the existing `giftData` state (line 20):

```javascript
const [startingFive, setStartingFive] = useState(null)
```

Add a `loadStartingFive` callback after the `refreshGifts` callback:

```javascript
const loadStartingFive = useCallback(async () => {
  try {
    const data = await vaultService.loadStartingFive()
    setStartingFive(data)
  } catch (err) {
    console.error('Failed to load Starting 5:', err)
  }
}, [])

const slotCard = useCallback(async (cardId, role) => {
  const data = await vaultService.slotCard(cardId, role)
  setStartingFive(data)
  return data
}, [])

const unslotCard = useCallback(async (role) => {
  const data = await vaultService.unslotCard(role)
  setStartingFive(data)
  return data
}, [])

const collectS5Income = useCallback(async () => {
  const data = await vaultService.collectIncome()
  setStartingFive(data)
  await passionCtx?.refreshBalance?.()
  return data
}, [passionCtx])
```

Load Starting 5 when vault data loads (after the existing `refreshGifts` effect):

```javascript
useEffect(() => {
  if (loaded) loadStartingFive()
}, [loaded, loadStartingFive])
```

Add to the provider value (alongside existing exports):

```javascript
startingFive, loadStartingFive, slotCard, unslotCard, collectS5Income,
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/vault/VaultContext.jsx
git commit -m "feat: add Starting 5 state and methods to VaultContext"
```

---

### Task 7: Starting 5 UI Component

**Files:**
- Create: `src/pages/vault/CCStartingFive.jsx`
- Modify: `src/pages/VaultPage.jsx` (add tab)

- [ ] **Step 1: Create the Starting 5 component**

Create `src/pages/vault/CCStartingFive.jsx`. This component should:

1. Display 5 role slots in a row: solo, jungle, mid, support, adc
2. Each slot shows the slotted card (using `TradingCardHolo`) or an empty placeholder with the role name
3. A running income counter that ticks client-side using `requestAnimationFrame` or `setInterval`
4. A "Collect" button that calls `collectS5Income()`
5. Clicking an empty slot opens a card picker modal
6. Clicking a filled slot shows swap/remove options
7. Progress bars showing how close pending income is to the 2-day cap

The component uses `useVault()` to access:
- `startingFive` — server state (cards, pending, rates, cap)
- `collection` — all owned cards (for the picker)
- `slotCard(cardId, role)`, `unslotCard(role)`, `collectS5Income()`

**Key implementation details for the client-side counter:**

```javascript
// In a useEffect, set up an interval that updates displayed pending values
const [displayPassion, setDisplayPassion] = useState(0)
const [displayCores, setDisplayCores] = useState(0)

useEffect(() => {
  if (!startingFive) return
  // Initialize from server state
  setDisplayPassion(startingFive.passionPending)
  setDisplayCores(startingFive.coresPending)

  const { totalPassionPerHour, totalCoresPerHour, passionCap, coresCap } = startingFive
  if (totalPassionPerHour === 0 && totalCoresPerHour === 0) return

  const perSecondPassion = totalPassionPerHour / 3600
  const perSecondCores = totalCoresPerHour / 3600

  const interval = setInterval(() => {
    setDisplayPassion(prev => Math.min(prev + perSecondPassion, passionCap))
    setDisplayCores(prev => Math.min(prev + perSecondCores, coresCap))
  }, 1000)

  return () => clearInterval(interval)
}, [startingFive])
```

**Card picker modal:** Filter `collection` to cards matching the target role, uncommon+ rarity, with a `holoType`, not already slotted, and not item/consumable type. Show each card with its holo type indicator (Passion/Cores/Both icon).

The full component is a UI task — build it to match the existing vault aesthetic (dark theme, cyan accents, `cd-head` font classes, `cd-clip-tag` styled buttons). Use Lucide icons (`Flame` for Passion, `Hexagon` for Cores).

- [ ] **Step 2: Add the tab to `VaultPage.jsx`**

Add the lazy import after the existing imports (line 19):

```javascript
const CCStartingFive = lazy(() => import('./vault/CCStartingFive'))
```

Add to the `TABS` array (line 21-31), insert after 'packs':

```javascript
{ key: 'lineup', label: 'Starting 5', icon: Users },
```

(Import `Users` from lucide-react at line 6)

Add to `TAB_COMPONENTS` (line 33-43):

```javascript
lineup: CCStartingFive,
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/vault/CCStartingFive.jsx src/pages/VaultPage.jsx
git commit -m "feat: Starting 5 UI component and vault tab"
```

---

### Task 8: Marketplace & Trade Guards

**Files:**
- Modify: `functions/lib/marketplace.js` (listing creation + purchase handler)

- [ ] **Step 1: Add slotted-card check to marketplace listing creation**

When a user creates a marketplace listing, check if the card is slotted in Starting 5:

```javascript
const [slotted] = await sql`
  SELECT role FROM cc_lineups
  WHERE user_id = ${userId} AND card_id = ${cardId}
`
if (slotted) {
  throw new Error('Card is in your Starting 5 lineup — remove it first')
}
```

Find the listing creation handler in the marketplace code and add this check before the INSERT.

- [ ] **Step 2: Auto-unslot on ownership transfer**

In the `buyListing` function (marketplace purchase handler), after ownership is transferred via `UPDATE cc_cards SET owner_id = ...`, clear the card from the seller's lineup:

```javascript
await tx`UPDATE cc_lineups SET card_id = NULL, slotted_at = NULL WHERE card_id = ${listing.card_id}`
```

Do the same in any trading system transfer handler if one exists.

- [ ] **Step 3: Commit**

```bash
git add functions/lib/marketplace.js
git commit -m "feat: prevent listing Starting 5 cards on marketplace, auto-unslot on sale"
```

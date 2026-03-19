# Starting 5 Reward System Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current "holo type = currency" model with "holo type = economic role" (flat income / multiplier / mix), add two lineups (Current Season + All-Star) with bench slots, and rebalance the economy to reward higher rarities more aggressively.

**Architecture:** Economy constants shared between frontend (`src/data/vault/economy.js`) and backend (`functions/lib/starting-five.js` duplicates them). The calculation engine runs server-side in `starting-five.js`, with `tick()` accruing income and `collectIncome()` granting it. API handlers in `functions/api/vault.js` call the engine and format responses. Frontend in `CCStartingFive.jsx` (~1600 lines) renders lineup slots and uses `VaultContext` for state management.

**Tech Stack:** PostgreSQL (Neon), Cloudflare Pages Functions, React 19, Vite 7, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-03-19-starting-five-reward-redesign.md`

---

## File Map

### Modified Files
- `src/data/vault/economy.js` — Replace `STARTING_FIVE_RATES` and `ATTACHMENT_BONUSES` with new flat/mult tables
- `functions/lib/starting-five.js` — Rewrite calculation engine (getCardRates, getSlotRates, tick, slotCard, etc.)
- `functions/api/vault.js` — Update `formatS5Response()`, slot/unslot handlers, leaderboard
- `src/pages/vault/CCStartingFive.jsx` — Two lineup tabs, bench slot, updated rate display
- `src/pages/vault/VaultContext.jsx` — Extended state for two lineups
- `src/services/database.js` — Updated API calls with lineup_type parameter

### New Files
- `database/migrations/126-starting-five-redesign.sql` — Schema changes for two lineups + bench

---

### Task 1: Database Migration

**Files:**
- Create: `database/migrations/126-starting-five-redesign.sql`

This migration adds `lineup_type` to `cc_lineups` to support two lineups (Current Season + All-Star), adds `'bench'` as a valid role, and migrates existing data.

- [ ] **Step 1: Check for existing migration numbering**

```bash
ls database/migrations/ | tail -5
```

The next available number is 126 (after 125-delist-holos.sql).

- [ ] **Step 2: Write the migration**

```sql
-- Add lineup_type column ('current' or 'allstar') to cc_lineups
-- Default existing rows to 'current' (Current Season)
ALTER TABLE cc_lineups ADD COLUMN lineup_type TEXT NOT NULL DEFAULT 'current';

-- Drop old PK and create new one including lineup_type
ALTER TABLE cc_lineups DROP CONSTRAINT cc_lineups_pkey;
ALTER TABLE cc_lineups ADD PRIMARY KEY (user_id, lineup_type, role);

-- Drop existing inline role CHECK constraint (created in 070-card-clash.sql)
-- The auto-generated name may vary; query pg_constraint if this fails
ALTER TABLE cc_lineups DROP CONSTRAINT IF EXISTS cc_lineups_role_check;
-- Also try the common auto-generated name pattern
ALTER TABLE cc_lineups DROP CONSTRAINT IF EXISTS cc_lineups_check;

-- Add check constraints for the expanded schema
ALTER TABLE cc_lineups ADD CONSTRAINT cc_lineups_lineup_type_check
  CHECK (lineup_type IN ('current', 'allstar'));
ALTER TABLE cc_lineups ADD CONSTRAINT cc_lineups_role_check
  CHECK (role IN ('solo', 'jungle', 'mid', 'support', 'adc', 'bench'));

-- Existing unique indexes on god_card_id and item_card_id (from 095 migration)
-- already enforce global uniqueness across all lineups — keep them as-is

-- Add unique constraint: a card_id can only appear in one lineup across both types
-- (prevents same player card in both lineups)
CREATE UNIQUE INDEX cc_lineups_card_exclusivity ON cc_lineups (card_id) WHERE card_id IS NOT NULL;

-- Staff slot placeholder (TBD design, just add the column)
ALTER TABLE cc_starting_five_state ADD COLUMN staff_card_id INTEGER REFERENCES cc_cards(id) ON DELETE SET NULL;
```

- [ ] **Step 3: Run the migration locally**

```bash
npm run dev:api
```

Then apply the migration via your database tool against the local `.dev.vars` DATABASE_URL.

- [ ] **Step 4: Verify schema**

Check that `cc_lineups` now has `lineup_type` column, new PK, and the card exclusivity index works by attempting to insert the same card_id in both lineup types.

- [ ] **Step 5: Commit**

```bash
git add database/migrations/126-starting-five-redesign.sql
git commit -m "feat(s5): add lineup_type, bench role, card exclusivity migration"
```

---

### Task 2: Economy Constants

**Files:**
- Modify: `src/data/vault/economy.js:102-153`
- Modify: `functions/lib/starting-five.js:5-50` (duplicated constants)

Replace the old rate tables with the new flat + multiplier model. Both files maintain their own copies of these constants (the backend can't import from `src/`).

- [ ] **Step 1: Update `src/data/vault/economy.js`**

Replace lines 102-128 (STARTING_FIVE_RATES through GOD_SYNERGY_BONUS) with:

```js
// Starting 5 — flat income per day per holo card (Cores)
export const S5_FLAT_CORES = {
  uncommon: 0.80, rare: 1.90, epic: 3.50, legendary: 7.60, mythic: 8.75, unique: 10.10,
};

// Starting 5 — flat income per day per holo card (Passion)
export const S5_FLAT_PASSION = {
  uncommon: 0.05, rare: 0.12, epic: 0.22, legendary: 0.47, mythic: 0.54, unique: 0.63,
};

// Starting 5 — reverse card multiplier (multiplicative stacking)
export const S5_REVERSE_MULT = {
  uncommon: 1.15, rare: 1.25, epic: 1.40, legendary: 1.50, mythic: 1.65, unique: 1.85,
};

// Full cards get 44% of both flat and mult
export const S5_FULL_RATIO = 0.44;

// Bench slot effectiveness
export const S5_BENCH_EFFECTIVENESS = 0.50;

// All-Star lineup output modifier
export const S5_ALLSTAR_MODIFIER = 0.615;

// Attachment bonuses — holo attachments: % boost to flat values
export const S5_ATT_FLAT = {
  god:  { uncommon: 0.06, rare: 0.10, epic: 0.16, legendary: 0.25, mythic: 0.35, unique: 0.48 },
  item: { uncommon: 0.04, rare: 0.06, epic: 0.10, legendary: 0.15, mythic: 0.22, unique: 0.30 },
};

// Attachment bonuses — reverse attachments: additive to multiplier
export const S5_ATT_MULT = {
  god:  { uncommon: 0.030, rare: 0.050, epic: 0.080, legendary: 0.125, mythic: 0.175, unique: 0.240 },
  item: { uncommon: 0.015, rare: 0.025, epic: 0.040, legendary: 0.060, mythic: 0.085, unique: 0.120 },
};

// Full attachment ratio (60% of pure type's bonus)
export const S5_FULL_ATT_RATIO = 0.6;

export const GOD_SYNERGY_BONUS = 0.30;
export const TEAM_SYNERGY_BONUS = { 2: 0.10, 3: 0.20, 4: 0.35, 5: 0.50 };
```

Keep the old `STARTING_FIVE_RATES` and `ATTACHMENT_BONUSES` commented out temporarily for reference during development. Remove them before final commit.

Also keep exporting `STARTING_FIVE_CAP_DAYS` (unchanged, still 2).

- [ ] **Step 2: Update `functions/lib/starting-five.js` constants (lines 5-26)**

Replace with the same constant values (backend duplicate):

```js
const S5_FLAT_CORES = {
  uncommon: 0.80, rare: 1.90, epic: 3.50, legendary: 7.60, mythic: 8.75, unique: 10.10,
}
const S5_FLAT_PASSION = {
  uncommon: 0.05, rare: 0.12, epic: 0.22, legendary: 0.47, mythic: 0.54, unique: 0.63,
}
const S5_REVERSE_MULT = {
  uncommon: 1.15, rare: 1.25, epic: 1.40, legendary: 1.50, mythic: 1.65, unique: 1.85,
}
const S5_FULL_RATIO = 0.44
const S5_BENCH_EFFECTIVENESS = 0.50
const S5_ALLSTAR_MODIFIER = 0.615

const S5_ATT_FLAT = {
  god:  { uncommon: 0.06, rare: 0.10, epic: 0.16, legendary: 0.25, mythic: 0.35, unique: 0.48 },
  item: { uncommon: 0.04, rare: 0.06, epic: 0.10, legendary: 0.15, mythic: 0.22, unique: 0.30 },
}
const S5_ATT_MULT = {
  god:  { uncommon: 0.030, rare: 0.050, epic: 0.080, legendary: 0.125, mythic: 0.175, unique: 0.240 },
  item: { uncommon: 0.015, rare: 0.025, epic: 0.040, legendary: 0.060, mythic: 0.085, unique: 0.120 },
}
const S5_FULL_ATT_RATIO = 0.6
const GOD_SYNERGY_BONUS = 0.30
const TEAM_SYNERGY_BONUS = { 2: 0.10, 3: 0.20, 4: 0.35, 5: 0.50 }
```

- [ ] **Step 3: Commit**

```bash
git add src/data/vault/economy.js functions/lib/starting-five.js
git commit -m "feat(s5): replace rate tables with flat/mult economy constants"
```

---

### Task 3: Core Calculation Engine

**Files:**
- Modify: `functions/lib/starting-five.js:53-160` (getCardRates, getAttachmentMultiplier, getSlotRates, getTotalDailyRates)

Rewrite the rate calculation functions to implement the new flat + multiplicative model. This is the most critical task — all math flows from here.

**Key reference:** See the "Calculation Pseudocode" section in the spec for the exact algorithm.

- [ ] **Step 1: Replace `getCardRates()` (lines 53-68)**

The old function returned passionPerHour/coresPerHour. The new function returns the card's contribution to the flat pool OR the mult chain, depending on holo type.

```js
// Returns a card's economic contribution based on holo type
// For holo: { type: 'flat', cores, passion }
// For reverse: { type: 'mult', multiplier }
// For full: { type: 'full', cores, passion, multiplier }
export function getCardContribution(holoType, rarity, effectiveness = 1.0) {
  if (!holoType) return { type: 'none' }

  if (holoType === 'holo') {
    return {
      type: 'flat',
      cores: (S5_FLAT_CORES[rarity] || 0) * effectiveness,
      passion: (S5_FLAT_PASSION[rarity] || 0) * effectiveness,
    }
  }
  if (holoType === 'reverse') {
    const baseMult = S5_REVERSE_MULT[rarity] || 1
    // Bench effectiveness halves the bonus portion (not the 1.0 base)
    const multBonus = (baseMult - 1) * effectiveness
    return { type: 'mult', multiplier: 1 + multBonus }
  }
  if (holoType === 'full') {
    const cores = (S5_FLAT_CORES[rarity] || 0) * S5_FULL_RATIO * effectiveness
    const passion = (S5_FLAT_PASSION[rarity] || 0) * S5_FULL_RATIO * effectiveness
    const baseMult = S5_REVERSE_MULT[rarity] || 1
    const multBonus = (baseMult - 1) * S5_FULL_RATIO * effectiveness
    return { type: 'full', cores, passion, multiplier: 1 + multBonus }
  }
  return { type: 'none' }
}
```

- [ ] **Step 2: Replace `getAttachmentMultiplier()` (lines 70-93)**

New function returns either a flat boost percentage or an additive mult amount, depending on the attachment's holo type and what the player card supports.

```js
// Returns attachment's contribution to a slot
// playerHasFlat: true if player card contributes flat income (holo or full)
// playerHasMult: true if player card contributes multiplier (reverse or full)
function getAttachmentBonus(attachment, type, playerHasFlat, playerHasMult, synergy = false) {
  if (!attachment?.holo_type || !attachment?.rarity) return { flatBoostCores: 0, flatBoostPassion: 0, multAdd: 0 }

  const attType = type // 'god' or 'item'
  let flatPct = S5_ATT_FLAT[attType]?.[attachment.rarity] || 0
  let multAdd = S5_ATT_MULT[attType]?.[attachment.rarity] || 0

  if (synergy && type === 'god') {
    flatPct *= (1 + GOD_SYNERGY_BONUS)
    multAdd *= (1 + GOD_SYNERGY_BONUS)
  }

  let resultFlat = 0, resultMult = 0

  if (attachment.holo_type === 'holo') {
    // Holo attachment boosts flat only
    resultFlat = playerHasFlat ? flatPct : 0
  } else if (attachment.holo_type === 'reverse') {
    // Reverse attachment boosts mult only
    resultMult = playerHasMult ? multAdd : 0
  } else if (attachment.holo_type === 'full') {
    // Full boosts both at reduced rate
    resultFlat = playerHasFlat ? flatPct * S5_FULL_ATT_RATIO : 0
    resultMult = playerHasMult ? multAdd * S5_FULL_ATT_RATIO : 0
  }

  // resultFlat is the same percentage for both passion and cores
  return { flatBoost: resultFlat, multAdd: resultMult }
}
```

- [ ] **Step 3: Replace `getSlotRates()` (lines 100-109) and `getTotalDailyRates()` (lines 149-160)**

New function calculates an entire lineup's output using the flat x mult model:

```js
// Calculate a single lineup's daily output (before consumable)
// cards: array of slotted cards with _godCard, _itemCard, slot_role, and isBench flag
// teamCounts: { teamId: count } for starters only
export function calculateLineupOutput(cards, teamCounts = {}) {
  let totalFlatCores = 0, totalFlatPassion = 0, totalMult = 1.0

  for (const card of cards) {
    if (isRoleMismatch(card)) continue

    const effectiveness = card.isBench ? S5_BENCH_EFFECTIVENESS : 1.0
    const contrib = getCardContribution(card.holo_type, card.rarity, effectiveness)
    const synergy = checkSynergy(card, card._godCard)
    const playerHasFlat = contrib.type === 'flat' || contrib.type === 'full'
    const playerHasMult = contrib.type === 'mult' || contrib.type === 'full'

    // Use pre-reshaped attachments (set in tick() before calling this)
    const godCard = card._godCard
    const itemCard = card._itemCard
    const godBonus = getAttachmentBonus(godCard, 'god', playerHasFlat, playerHasMult, synergy)
    const itemBonus = getAttachmentBonus(itemCard, 'item', playerHasFlat, playerHasMult)

    // Apply attachment flat boosts (multiplicative per attachment)
    // NOTE: effectiveness is already baked into contrib.cores/passion via getCardContribution()
    // Attachment boosts are percentages on the (already-effective) flat value — NOT scaled by effectiveness again
    if (playerHasFlat) {
      const godFlatMult = 1 + godBonus.flatBoost
      const itemFlatMult = 1 + itemBonus.flatBoost
      totalFlatCores += contrib.cores * godFlatMult * itemFlatMult
      totalFlatPassion += contrib.passion * godFlatMult * itemFlatMult
    }

    // Apply attachment mult additions (additive to this card's multiplier)
    // Attachment mult additions ARE scaled by effectiveness (bench adds less to the multiplier)
    if (playerHasMult) {
      const slotMult = contrib.multiplier + godBonus.multAdd * effectiveness + itemBonus.multAdd * effectiveness
      totalMult *= slotMult
    }
  }

  // Team synergy applied to final output (starters only counted)
  const maxTeamCount = Math.max(...Object.values(teamCounts), 0)
  const teamBonus = 1 + (TEAM_SYNERGY_BONUS[maxTeamCount] || 0)

  return {
    coresPerDay: totalFlatCores * totalMult * teamBonus,
    passionPerDay: totalFlatPassion * totalMult * teamBonus,
  }
}
```

- [ ] **Step 3b: Fix `isRoleMismatch()` for bench**

The existing function would treat bench cards as role mismatches (bench !== card.role). Add a bench exception:

```js
function isRoleMismatch(card) {
  if (card.slot_role === 'bench') return false  // bench accepts any role
  return card.slot_role && card.role && card.role !== card.slot_role && card.role !== 'fill'
}
```

- [ ] **Step 4: Keep `getAttachmentBonusInfo()` for frontend display (lines 111-125)**

Update it to return the new bonus types:

```js
export function getAttachmentBonusInfo(attachment, type, playerHoloType, synergy = false) {
  if (!attachment?.holo_type) return { flatBoost: 0, multAdd: 0, effectiveType: 'none' }
  const playerHasFlat = playerHoloType === 'holo' || playerHoloType === 'full'
  const playerHasMult = playerHoloType === 'reverse' || playerHoloType === 'full'
  const bonus = getAttachmentBonus(attachment, type, playerHasFlat, playerHasMult, synergy)
  return { ...bonus, effectiveType: bonus.flatBoost > 0 ? 'flat' : bonus.multAdd > 0 ? 'mult' : 'none' }
}
```

- [ ] **Step 5: Verify locally**

Start the dev server and check the console for import errors. The tick() function will break at this point — that's expected, we fix it in Task 4.

- [ ] **Step 6: Commit**

```bash
git add functions/lib/starting-five.js
git commit -m "feat(s5): rewrite calculation engine for flat/mult model"
```

---

### Task 4: Rewrite `tick()` and `collectIncome()`

**Files:**
- Modify: `functions/lib/starting-five.js:170-318` (tick and collectIncome)

Update the income accrual logic to handle two lineups, bench slots, and the new flat x mult model.

- [ ] **Step 1: Update the lineup query in `tick()` (lines 172-195)**

Add `lineup_type` to the query and results:

```js
const cards = await sql`
  SELECT l.role AS slot_role, l.lineup_type, c.*, pd.best_god_name, pd.team_id AS team_id,
    pu.discord_id AS player_discord_id, pu.discord_avatar AS player_discord_avatar,
    COALESCE(pup.allow_discord_avatar, true) AS allow_discord_avatar,
    g.id AS god_id, g.rarity AS god_rarity, g.holo_type AS god_holo_type,
    g.card_type AS god_card_type, g.role AS god_role, g.card_data AS god_card_data,
    g.god_name AS god_god_name, g.god_class AS god_god_class, g.image_url AS god_image_url,
    g.holo_effect AS god_holo_effect, g.serial_number AS god_serial_number, g.god_id AS god_god_id,
    g.ability AS god_ability, g.def_id AS god_def_id, g.is_first_edition AS god_is_first_edition,
    i.id AS item_id, i.rarity AS item_rarity, i.holo_type AS item_holo_type,
    i.card_type AS item_card_type, i.card_data AS item_card_data,
    i.god_name AS item_god_name, i.god_class AS item_god_class, i.image_url AS item_image_url,
    i.holo_effect AS item_holo_effect, i.serial_number AS item_serial_number, i.god_id AS item_god_id,
    i.def_id AS item_def_id, i.is_first_edition AS item_is_first_edition
  FROM cc_lineups l
  JOIN cc_cards c ON l.card_id = c.id
  LEFT JOIN cc_player_defs pd ON c.def_id = pd.id AND c.card_type = 'player'
  LEFT JOIN users pu ON pu.linked_player_id = pd.player_id
  LEFT JOIN user_preferences pup ON pup.user_id = pu.id
  LEFT JOIN cc_cards g ON l.god_card_id = g.id
  LEFT JOIN cc_cards i ON l.item_card_id = i.id
  WHERE l.user_id = ${userId} AND l.card_id IS NOT NULL
`
```

- [ ] **Step 1b: Fix early-return paths**

The existing `tick()` has two early returns (no cards / elapsed < 0.001) that return `{ cards, ... }`. Update these to include the new fields expected by `formatS5Response()`:

```js
// Empty state helper (used by early returns)
const emptyOutput = { coresPerDay: 0, passionPerDay: 0 }
const emptyReturn = {
  cards, csCards: [], asCards: [],
  csOutput: emptyOutput, asOutput: emptyOutput,
  passionPending: Number(state?.passion_pending) || 0,
  coresPending: Number(state?.cores_pending) || 0,
  lastTick: state?.last_tick || new Date().toISOString(),
  passionCap: 0, coresCap: 0,
  consumableCard: consumableCard || null,
}
```

Use this for both early returns (no cards, elapsed < 0.001).

- [ ] **Step 1c: Export `checkSynergy`**

`formatS5Response()` in vault.js needs to call `checkSynergy()`. Change from local function to export:

```js
export function checkSynergy(playerCard, godCard) {
```

- [ ] **Step 2: Split cards by lineup and calculate per-lineup output**

Replace the accrual logic (lines 241-268) with:

```js
// Tag bench cards and split by lineup
for (const card of cards) {
  card.isBench = card.slot_role === 'bench'
  const { godCard, itemCard } = reshapeAttachments(card)
  card._godCard = godCard
  card._itemCard = itemCard
}

const csCards = cards.filter(c => c.lineup_type === 'current')
const asCards = cards.filter(c => c.lineup_type === 'allstar')

// Team synergy counts starters only (not bench)
function getTeamCounts(lineupCards) {
  const counts = {}
  for (const card of lineupCards) {
    if (card.isBench || isRoleMismatch(card)) continue
    if (card.team_id) counts[card.team_id] = (counts[card.team_id] || 0) + 1
  }
  return counts
}

const csTeamCounts = getTeamCounts(csCards)
const asTeamCounts = getTeamCounts(asCards)

const csOutput = calculateLineupOutput(csCards, csTeamCounts)
const asOutput = calculateLineupOutput(asCards, asTeamCounts)

// All-Star gets modifier applied
const combinedCoresPerDay = csOutput.coresPerDay + asOutput.coresPerDay * S5_ALLSTAR_MODIFIER
const combinedPassionPerDay = csOutput.passionPerDay + asOutput.passionPerDay * S5_ALLSTAR_MODIFIER

// Accrued based on elapsed time
let coresAccrued = (combinedCoresPerDay / HOURS_PER_DAY) * elapsedHours
let passionAccrued = (combinedPassionPerDay / HOURS_PER_DAY) * elapsedHours

// Cap uses combined rate before consumable (lineup rates already exclude consumable)
const combinedUnboostedCores = csOutput.coresPerDay + asOutput.coresPerDay * S5_ALLSTAR_MODIFIER
const combinedUnboostedPassion = csOutput.passionPerDay + asOutput.passionPerDay * S5_ALLSTAR_MODIFIER
const coresCap = combinedUnboostedCores * CAP_DAYS
const passionCap = combinedUnboostedPassion * CAP_DAYS

// Consumable boosts accrued (not cap)
if (consumableCard?.card_data?.consumableId) {
  const boost = getConsumableBoost(consumableCard.card_data.consumableId, consumableCard.rarity)
  passionAccrued *= (1 + boost.passionBoost)
  coresAccrued *= (1 + boost.coresBoost)
}

let newPassion = Math.min((Number(state.passion_pending) || 0) + passionAccrued, passionCap)
let newCores = Math.min((Number(state.cores_pending) || 0) + coresAccrued, coresCap)
```

- [ ] **Step 3: Update return values to include per-lineup data**

```js
return {
  cards,
  csCards, asCards,
  csOutput, asOutput,
  passionPending: newPassion,
  coresPending: newCores,
  lastTick: now.toISOString(),
  passionCap, coresCap,
  consumableCard: consumableCard || null,
}
```

- [ ] **Step 4: `collectIncome()` stays mostly the same** — it calls `tick()` and grants the integer amounts. No structural changes needed, just verify it still works with the updated `tick()` return shape.

- [ ] **Step 5: Test locally**

Start dev server, open the vault, check the Starting 5 page loads without errors. Existing lineups should now appear under `lineup_type = 'current'`. Income accrual should work with the new math.

- [ ] **Step 6: Commit**

```bash
git add functions/lib/starting-five.js
git commit -m "feat(s5): rewrite tick() for two-lineup flat/mult accrual"
```

---

### Task 5: Update Slot/Unslot Handlers

**Files:**
- Modify: `functions/lib/starting-five.js:320-502` (slotCard, unslotCard, unslotAttachment, slotConsumable)
- Modify: `functions/api/vault.js:1657-1739` (API handler wrappers)

Add `lineupType` parameter and `'bench'` role support to all slot/unslot operations.

- [ ] **Step 1: Update `slotCard()` (lines 320-425)**

Add `lineupType` parameter. Update `validRoles` to include `'bench'`. Add card exclusivity check across lineups.

```js
export async function slotCard(sql, userId, cardId, role, slotType = 'player', lineupType = 'current') {
  const validRoles = ['solo', 'jungle', 'mid', 'support', 'adc', 'bench']
  if (!validRoles.includes(role)) throw new Error('Invalid role')
  if (!['current', 'allstar'].includes(lineupType)) throw new Error('Invalid lineup type')

  // ... existing card fetch and validation ...

  if (slotType === 'player') {
    // ... existing holo_type and card_type checks ...

    // Role matching: bench allows any role, starters require match
    if (role !== 'bench' && card.role !== role && card.role !== 'fill') {
      throw new Error(`Card role (${card.role}) does not match slot (${role})`)
    }

    // Card exclusivity: check BOTH lineups
    const [existing] = await sql`
      SELECT role, lineup_type FROM cc_lineups
      WHERE user_id = ${userId} AND card_id = ${cardId}
    `
    if (existing) throw new Error(`Card is already slotted in ${existing.lineup_type}/${existing.role}`)

    await collectIncome(sql, userId)

    await sql`
      INSERT INTO cc_lineups (user_id, lineup_type, role, card_id, slotted_at)
      VALUES (${userId}, ${lineupType}, ${role}, ${cardId}, NOW())
      ON CONFLICT (user_id, lineup_type, role)
      DO UPDATE SET card_id = ${cardId}, slotted_at = NOW()
    `

    // Rarity floor checks — update to include lineup_type
    const [slot] = await sql`
      SELECT god_card_id, item_card_id FROM cc_lineups
      WHERE user_id = ${userId} AND lineup_type = ${lineupType} AND role = ${role}
    `
    // ... same rarity floor logic, just update WHERE clauses to include lineup_type ...
  } else {
    // Attachment slotting — update WHERE clauses to include lineupType
    const [playerSlot] = await sql`
      SELECT card_id FROM cc_lineups
      WHERE user_id = ${userId} AND lineup_type = ${lineupType} AND role = ${role} AND card_id IS NOT NULL
    `
    // ... rest of attachment logic with lineup_type in all queries ...
  }

  return await tick(sql, userId)
}
```

- [ ] **Step 2: Update `unslotCard()` and `unslotAttachment()`**

Add `lineupType` parameter to both. Update SQL WHERE clauses.

```js
export async function unslotCard(sql, userId, role, lineupType = 'current') {
  const validRoles = ['solo', 'jungle', 'mid', 'support', 'adc', 'bench']
  if (!validRoles.includes(role)) throw new Error('Invalid role')

  await collectIncome(sql, userId)

  await sql`
    UPDATE cc_lineups
    SET card_id = NULL, slotted_at = NULL, god_card_id = NULL, item_card_id = NULL
    WHERE user_id = ${userId} AND lineup_type = ${lineupType} AND role = ${role}
  `
  return await tick(sql, userId)
}

export async function unslotAttachment(sql, userId, role, slotType, lineupType = 'current') {
  // Same pattern — add lineupType to WHERE clause
}
```

- [ ] **Step 3: Update API handlers in `vault.js`**

The handlers at lines 1657-1739 need to pass `lineupType` from the request body:

```js
async function handleSlotCard(event) {
  const { cardId, role, slotType, lineupType } = event.body
  // ... existing auth ...
  const state = await slotCard(sql, userId, cardId, role, slotType || 'player', lineupType || 'current')
  // ...
}

async function handleUnslotCard(event) {
  const { role, lineupType } = event.body
  const state = await unslotCard(sql, userId, role, lineupType || 'current')
  // ...
}

async function handleUnslotAttachment(event) {
  const { role, slotType, lineupType } = event.body
  const state = await unslotAttachment(sql, userId, role, slotType, lineupType || 'current')
  // ...
}
```

- [ ] **Step 4: Test slot/unslot locally**

Test via the UI or API calls that:
- Slotting a card to 'current' lineup works
- Same card cannot be slotted to 'allstar' lineup (exclusivity)
- Bench role accepts any card role
- Unslotting works with lineup_type

- [ ] **Step 5: Commit**

```bash
git add functions/lib/starting-five.js functions/api/vault.js
git commit -m "feat(s5): add lineup_type and bench to slot/unslot handlers"
```

---

### Task 6: Update API Response Formatting

**Files:**
- Modify: `functions/api/vault.js:1497-1655` (formatS5Response, handleStartingFive, handleS5Leaderboard)

Update the response to include per-lineup data and the new rate model.

- [ ] **Step 1: Rewrite `formatS5Response()` (lines 1497-1566)**

The response needs to expose per-lineup rates with the flat/mult breakdown:

```js
function formatS5Response(state, extra = {}) {
  const { csCards = [], asCards = [], csOutput, asOutput, consumableCard } = state

  function formatLineup(lineupCards, output) {
    const slots = {}
    for (const card of lineupCards) {
      const synergy = checkSynergy(card, card._godCard)
      const contrib = getCardContribution(card.holo_type, card.rarity, card.isBench ? S5_BENCH_EFFECTIVENESS : 1.0)
      slots[card.slot_role] = {
        card: formatCard(card),
        godCard: card._godCard ? formatCard(card._godCard) : null,
        itemCard: card._itemCard ? formatCard(card._itemCard) : null,
        contribution: contrib,
        synergy,
        isBench: card.isBench,
      }
    }
    return { slots, output }
  }

  // Apply consumable to display rates
  let consumableBoost = { passionBoost: 0, coresBoost: 0 }
  if (consumableCard?.card_data?.consumableId) {
    consumableBoost = getConsumableBoost(consumableCard.card_data.consumableId, consumableCard.rarity)
  }

  const combined = {
    coresPerDay: (csOutput?.coresPerDay || 0) + (asOutput?.coresPerDay || 0) * S5_ALLSTAR_MODIFIER,
    passionPerDay: (csOutput?.passionPerDay || 0) + (asOutput?.passionPerDay || 0) * S5_ALLSTAR_MODIFIER,
  }

  return {
    currentSeason: formatLineup(csCards || [], csOutput),
    allStar: formatLineup(asCards || [], asOutput),
    combined,
    boostedCoresPerDay: combined.coresPerDay * (1 + consumableBoost.coresBoost),
    boostedPassionPerDay: combined.passionPerDay * (1 + consumableBoost.passionBoost),
    passionPending: state.passionPending,
    coresPending: state.coresPending,
    passionCap: state.passionCap,
    coresCap: state.coresCap,
    consumableCard: consumableCard || null,
    ...extra,
  }
}
```

Note: `formatCard()` is a helper that extracts the display fields from a card row. Check if one already exists in vault.js or create a minimal one.

- [ ] **Step 2: Update `handleS5Leaderboard()` (lines 1573-1655)**

The leaderboard should rank by combined daily rate. Update the query to aggregate across both lineup types.

- [ ] **Step 3: Test the response**

Hit `GET /api/vault?action=starting-five` and verify the response includes `currentSeason`, `allStar`, and `combined` fields with correct rate data.

- [ ] **Step 4: Commit**

```bash
git add functions/api/vault.js
git commit -m "feat(s5): rewrite API response for two-lineup flat/mult model"
```

---

### Task 7: Update Service Layer

**Files:**
- Modify: `src/services/database.js` (Starting 5 API calls, ~lines 1056-1076)

Add `lineupType` parameter to slot/unslot API calls.

- [ ] **Step 1: Update API call functions**

```js
export async function slotCard(cardId, role, slotType, lineupType = 'current') {
  return apiPost('vault', { action: 'slot-card' }, { cardId, role, slotType, lineupType })
}

export async function unslotCard(role, lineupType = 'current') {
  return apiPost('vault', { action: 'unslot-card' }, { role, lineupType })
}

export async function unslotAttachment(role, slotType, lineupType = 'current') {
  return apiPost('vault', { action: 'unslot-attachment' }, { role, slotType, lineupType })
}
```

`loadStartingFive`, `loadS5Leaderboard`, `collectIncome`, `slotConsumable` — no parameter changes needed.

- [ ] **Step 2: Commit**

```bash
git add src/services/database.js
git commit -m "feat(s5): add lineupType param to service layer calls"
```

---

### Task 8: Frontend — VaultContext State

**Files:**
- Modify: `src/pages/vault/VaultContext.jsx` (lines ~24, 250-312)

Update state management to handle the new response shape.

- [ ] **Step 1: Update state and methods**

The `startingFive` state already holds the full API response. Since we changed the response shape, update the methods that call slot/unslot to pass `lineupType`:

```js
const slotS5Card = async (cardId, role, slotType, lineupType = 'current') => {
  const data = await db.slotCard(cardId, role, slotType, lineupType)
  setStartingFive(data)
  // ... existing challenge/balance refresh ...
}

const unslotS5Card = async (role, lineupType = 'current') => {
  const data = await db.unslotCard(role, lineupType)
  setStartingFive(data)
  // ...
}

const unslotS5Attachment = async (role, slotType, lineupType = 'current') => {
  const data = await db.unslotAttachment(role, slotType, lineupType)
  setStartingFive(data)
  // ...
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/vault/VaultContext.jsx
git commit -m "feat(s5): update VaultContext for two-lineup state"
```

---

### Task 9: Frontend — CCStartingFive Component

**Files:**
- Modify: `src/pages/vault/CCStartingFive.jsx`

This is the largest frontend change. The component needs two lineup tabs, bench slots, and updated rate displays.

**Approach:** Given the component is ~1600 lines, modify in place rather than splitting (follow existing patterns). Add a lineup tab switcher at the top, duplicate the slot rendering for both lineups, and update the rate display to show the flat + mult breakdown.

- [ ] **Step 0: Update imports and local calculation functions**

The component imports old constant names at line 3. Update to new constants:

```jsx
import { RARITIES, S5_FLAT_CORES, S5_FLAT_PASSION, S5_REVERSE_MULT, S5_FULL_RATIO,
  S5_BENCH_EFFECTIVENESS, S5_ATT_FLAT, S5_ATT_MULT, S5_FULL_ATT_RATIO,
  STARTING_FIVE_CAP_DAYS, GOD_SYNERGY_BONUS, TEAM_SYNERGY_BONUS,
  getConsumableBoost, getHoloEffect } from '../../data/vault/economy'
```

Also rewrite local functions `getIncomeRate()` (line 72-85), `getAttachmentBonus()` (line 87-105), and `getEffectiveIncomeRate()` (line 107-117) to use the new flat/mult model. These are used for the live rate display in the UI. The new versions should show flat contribution and multiplier contribution separately.

- [ ] **Step 1: Add lineup tab state and switcher**

Add state for active lineup tab:

```jsx
const [activeLineup, setActiveLineup] = useState('current')
```

Add tab switcher UI above the lineup grid:

```jsx
<div className="flex gap-2 mb-4">
  <button
    onClick={() => setActiveLineup('current')}
    className={`px-4 py-2 rounded ${activeLineup === 'current' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
  >
    Current Season
  </button>
  <button
    onClick={() => setActiveLineup('allstar')}
    className={`px-4 py-2 rounded ${activeLineup === 'allstar' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300'}`}
  >
    All-Star
  </button>
</div>
```

- [ ] **Step 2: Update slot rendering to use lineup data**

The current code reads slots from `startingFive.cards` and maps by role. Update to read from `startingFive.currentSeason.slots` or `startingFive.allStar.slots` based on `activeLineup`:

```jsx
const lineupData = activeLineup === 'current'
  ? startingFive?.currentSeason
  : startingFive?.allStar

const slots = lineupData?.slots || {}
```

- [ ] **Step 3: Add bench slot**

Add a 6th slot after the 5 role slots. The bench slot uses `role = 'bench'` and shows "(any role)" label:

```jsx
{/* After the 5 role slots */}
<div className="mt-4 border-t border-gray-700 pt-4">
  <h3 className="text-sm text-gray-400 mb-2">Bench (50% effectiveness)</h3>
  {/* Same slot component as starters, but with role='bench' */}
</div>
```

- [ ] **Step 4: Update rate display**

Replace the old passion/cores per hour display with the new flat + mult breakdown. Show:
- Per-slot contribution (flat amount or multiplier)
- Lineup total (flat x mult)
- Combined total (Current Season + All-Star)
- Consumable boost applied

Reference the "How It Adds Up" section in the spec for the display format.

- [ ] **Step 5: Update card filtering for slot picker**

When the user opens the card picker to fill a slot:
- Filter out cards already slotted in EITHER lineup (card exclusivity)
- For bench slot: don't filter by role
- Show a warning if a card's holo type mismatches the lineup strategy

- [ ] **Step 6: Pass `lineupType` to all slot/unslot calls**

Every call to `slotS5Card`, `unslotS5Card`, `unslotS5Attachment` needs to include the current `activeLineup`:

```jsx
slotS5Card(cardId, role, slotType, activeLineup)
```

- [ ] **Step 7: Test the full flow**

1. Load Starting 5 page — should show two tabs
2. Switch between Current Season and All-Star
3. Slot a holo card in Current Season — see flat income appear
4. Slot a reverse card — see multiplier appear
5. Try to slot same card in All-Star — should be blocked
6. Slot a bench card (any role) — see 50% reduced contribution
7. Collect income — verify amounts match expected rates
8. Check leaderboard still works

- [ ] **Step 8: Commit**

```bash
git add src/pages/vault/CCStartingFive.jsx
git commit -m "feat(s5): two lineup tabs, bench slot, flat/mult rate display"
```

---

### Task 10: Data Migration & Cleanup

**Files:**
- Modify: `functions/lib/starting-five.js` (any remaining cleanup)
- Modify: `src/data/vault/economy.js` (remove old commented-out constants)

- [ ] **Step 1: Collect all users' pending income before deploying**

The rate change means existing pending income was accrued at old rates. Before deploying, add a one-time migration that:
1. Ticks all active users to collect pending income at old rates
2. Resets `last_tick` to NOW() so new rates start fresh

This can be a manual SQL script or a one-time API call.

```sql
-- Grant pending income to all users before rate change
-- (Run this BEFORE deploying the new code)
-- The actual granting should be done via the API to properly credit Passion/Cores
```

- [ ] **Step 2: Communicate the change**

All-reverse lineups will earn zero after the update. Players need to be notified to re-slot holo cards. Consider:
- A banner on the Starting 5 page explaining the change
- A Discord announcement
- Auto-unslot all-reverse lineups with a notification

- [ ] **Step 3: Remove old constants**

Remove any commented-out old `STARTING_FIVE_RATES` and `ATTACHMENT_BONUSES` from both economy.js and starting-five.js.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(s5): cleanup old constants, finalize reward redesign"
```

---

## Implementation Notes

- **No backend tests exist** for CF Workers in this project. Test via the running dev server (`npm start`) and manual API calls.
- **Frontend tests**: If existing tests reference Starting 5 rates or components, update them to use the new constants.
- **Deploy order**: Run the DB migration FIRST, then deploy code. The migration is backward-compatible (adds column with default, doesn't break existing queries).
- **Rollback**: If issues arise, the old constants are in git history. The DB migration is additive (no destructive changes) so rolling back code is safe.
- **Staff card**: The `staff_card_id` column is added but unused. Implementation will come in a separate spec/plan.

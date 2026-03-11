# Starting 5 Attachments Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add god and item attachment slots to each Starting 5 role, providing multiplicative income bonuses based on attachment rarity and holo type.

**Architecture:** Two new nullable FK columns on `cc_lineups` (god_card_id, item_card_id) with partial unique indexes. Backend `getSlotRates()` computes effective rates by multiplying base player rates with attachment bonuses. Frontend expands each slot to show player + god + item with filtered picker modals.

**Tech Stack:** PostgreSQL (Neon), Cloudflare Pages Functions, React 19, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-03-11-starting-five-attachments-design.md`

---

## Chunk 1: Backend — Constants, Rate Calculation, Migration

### Task 1: Database Migration

**Files:**
- Create: `database/migrations/094-starting-five-attachments.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Add god and item attachment columns to cc_lineups
ALTER TABLE cc_lineups ADD COLUMN IF NOT EXISTS god_card_id INTEGER REFERENCES cc_cards(id) ON DELETE SET NULL;
ALTER TABLE cc_lineups ADD COLUMN IF NOT EXISTS item_card_id INTEGER REFERENCES cc_cards(id) ON DELETE SET NULL;

-- Prevent same card from being attached in multiple slots
CREATE UNIQUE INDEX IF NOT EXISTS cc_lineups_god_uniq ON cc_lineups(god_card_id) WHERE god_card_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cc_lineups_item_uniq ON cc_lineups(item_card_id) WHERE item_card_id IS NOT NULL;
```

- [ ] **Step 2: Run migration against dev database**

Run: `psql $DATABASE_URL -f database/migrations/094-starting-five-attachments.sql`
Expected: ALTER TABLE and CREATE INDEX succeed

- [ ] **Step 3: Commit**

```bash
git add database/migrations/094-starting-five-attachments.sql
git commit -m "feat: add god/item attachment columns to cc_lineups"
```

---

### Task 2: Economy Constants

**Files:**
- Modify: `src/data/vault/economy.js:57-67`

- [ ] **Step 1: Add attachment bonus constants**

After the existing `STARTING_FIVE_RATES` object (line 65), add:

```javascript
// Attachment bonuses — percentage multipliers on the player's base income
// God cards give larger bonuses than items; cores bonuses are higher than passion
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

export const FULL_HOLO_ATTACHMENT_RATIO = 0.6;
```

- [ ] **Step 2: Commit**

```bash
git add src/data/vault/economy.js
git commit -m "feat: add Starting 5 attachment bonus constants"
```

---

### Task 3: Backend Rate Calculation

**Files:**
- Modify: `functions/lib/starting-five.js`

- [ ] **Step 1: Add attachment bonus constants (server-side copy)**

At the top of `starting-five.js`, after the existing `RATES` object (line 12), add:

```javascript
const ATTACHMENT_BONUSES = {
  god: {
    passion: { uncommon: 0.08, rare: 0.14, epic: 0.22, legendary: 0.38, mythic: 0.50 },
    cores:   { uncommon: 0.15, rare: 0.25, epic: 0.40, legendary: 0.65, mythic: 0.80 },
  },
  item: {
    passion: { uncommon: 0.03, rare: 0.07, epic: 0.14, legendary: 0.22, mythic: 0.30 },
    cores:   { uncommon: 0.08, rare: 0.16, epic: 0.30, legendary: 0.48, mythic: 0.60 },
  },
}
const FULL_HOLO_RATIO = 0.6

// Rarity tier: lower = better (matches RARITIES in economy.js)
const RARITY_TIER = { common: 5, uncommon: 4, rare: 3, epic: 2, legendary: 1, mythic: 0 }
```

- [ ] **Step 2: Add `getAttachmentMultiplier` helper**

After `getCardRates` (line 32), add:

```javascript
function getAttachmentMultiplier(attachment, type) {
  // type is 'god' or 'item'
  if (!attachment || !attachment.holo_type || !attachment.rarity) return { passionMult: 1, coresMult: 1 }
  const bonuses = ATTACHMENT_BONUSES[type]
  if (!bonuses) return { passionMult: 1, coresMult: 1 }

  const passionBonus = bonuses.passion[attachment.rarity] || 0
  const coresBonus = bonuses.cores[attachment.rarity] || 0

  let passionMult = 1, coresMult = 1
  if (attachment.holo_type === 'holo') {
    passionMult = 1 + passionBonus
  } else if (attachment.holo_type === 'reverse') {
    coresMult = 1 + coresBonus
  } else if (attachment.holo_type === 'full') {
    passionMult = 1 + passionBonus * FULL_HOLO_RATIO
    coresMult = 1 + coresBonus * FULL_HOLO_RATIO
  }
  return { passionMult, coresMult }
}
```

- [ ] **Step 3: Add `getSlotRates` export**

After the new helper:

```javascript
export function getSlotRates(playerCard, godCard, itemCard) {
  const base = getCardRates(playerCard.holo_type, playerCard.rarity)
  const god = getAttachmentMultiplier(godCard, 'god')
  const item = getAttachmentMultiplier(itemCard, 'item')
  return {
    passionPerHour: base.passionPerHour * god.passionMult * item.passionMult,
    coresPerHour: base.coresPerHour * god.coresMult * item.coresMult,
  }
}
```

- [ ] **Step 4: Add `reshapeAttachments` helper for query row reshaping**

```javascript
function reshapeAttachments(row) {
  const godCard = row.god_id ? { id: row.god_id, rarity: row.god_rarity, holo_type: row.god_holo_type, card_type: row.god_card_type, role: row.god_role, card_data: row.god_card_data, god_name: row.god_god_name, god_class: row.god_god_class, image_url: row.god_image_url, holo_effect: row.god_holo_effect, serial_number: row.god_serial_number, god_id: row.god_god_id, ability: row.god_ability, def_id: row.god_def_id, is_first_edition: row.god_is_first_edition } : null
  const itemCard = row.item_id ? { id: row.item_id, rarity: row.item_rarity, holo_type: row.item_holo_type, card_type: row.item_card_type, card_data: row.item_card_data, god_name: row.item_god_name, god_class: row.item_god_class, image_url: row.item_image_url, holo_effect: row.item_holo_effect, serial_number: row.item_serial_number, god_id: row.item_god_id, def_id: row.item_def_id, is_first_edition: row.item_is_first_edition } : null
  return { godCard, itemCard }
}
```

- [ ] **Step 5: Update `tick()` query to JOIN god/item cards**

Replace the query at lines 55-60:

```javascript
  const cards = await sql`
    SELECT l.role AS slot_role, c.*,
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
    LEFT JOIN cc_cards g ON l.god_card_id = g.id
    LEFT JOIN cc_cards i ON l.item_card_id = i.id
    WHERE l.user_id = ${userId} AND l.card_id IS NOT NULL
  `
```

- [ ] **Step 6: Update tick() accrual loop to use `getSlotRates`**

Replace the accrual loop at lines 93-98:

```javascript
  let passionAccrued = 0, coresAccrued = 0
  for (const card of cards) {
    const { godCard, itemCard } = reshapeAttachments(card)
    const { passionPerHour, coresPerHour } = getSlotRates(card, godCard, itemCard)
    passionAccrued += passionPerHour * elapsedHours
    coresAccrued += coresPerHour * elapsedHours
  }
```

- [ ] **Step 7: Update `getTotalDailyRates` to use `getSlotRates`**

Replace the function at lines 34-42:

```javascript
function getTotalDailyRates(cards) {
  let totalPassion = 0, totalCores = 0
  for (const card of cards) {
    const { godCard, itemCard } = reshapeAttachments(card)
    const { passionPerHour, coresPerHour } = getSlotRates(card, godCard, itemCard)
    totalPassion += passionPerHour * HOURS_PER_DAY
    totalCores += coresPerHour * HOURS_PER_DAY
  }
  return { totalPassionPerDay: totalPassion, totalCoresPerDay: totalCores }
}
```

- [ ] **Step 8: Update tick() return to include attachment data**

In both early returns and the main return at end of `tick()`, include the reshaped card data. Add a helper at the top of tick to enrich cards after the query:

After the query, add:

```javascript
  // Attach reshaped god/item data to each card row
  for (const card of cards) {
    const { godCard, itemCard } = reshapeAttachments(card)
    card._godCard = godCard
    card._itemCard = itemCard
  }
```

- [ ] **Step 9: Update `slotCard` to handle slotType parameter**

Modify `slotCard` to accept `slotType` and handle god/item attachment:

```javascript
export async function slotCard(sql, userId, cardId, role, slotType = 'player') {
  const validRoles = ['solo', 'jungle', 'mid', 'support', 'adc']
  if (!validRoles.includes(role)) throw new Error('Invalid role')

  const [card] = await sql`
    SELECT id, rarity, holo_type, role, card_type
    FROM cc_cards WHERE id = ${cardId} AND owner_id = ${userId}
  `
  if (!card) throw new Error('Card not found')

  // Check not listed on marketplace
  const [listing] = await sql`
    SELECT id FROM cc_market_listings
    WHERE card_id = ${cardId} AND status = 'active'
  `
  if (listing) throw new Error('Card is listed on marketplace — unlist it first')

  if (slotType === 'player') {
    // Preserve existing behavior: commons (holo_type=NULL) allowed for player cards
    if (!card.holo_type && card.rarity !== 'common') throw new Error('Card has no holo type')
    if (card.card_type !== 'player') throw new Error('Only player cards can be slotted')
    if (card.role !== role) throw new Error(`Card role (${card.role}) does not match slot (${role})`)

    const [existing] = await sql`
      SELECT role FROM cc_lineups
      WHERE user_id = ${userId} AND card_id = ${cardId}
    `
    if (existing) throw new Error(`Card is already slotted in ${existing.role}`)

    await collectIncome(sql, userId)

    await sql`
      INSERT INTO cc_lineups (user_id, role, card_id, slotted_at)
      VALUES (${userId}, ${role}, ${cardId}, NOW())
      ON CONFLICT (user_id, role)
      DO UPDATE SET card_id = ${cardId}, slotted_at = NOW()
    `

    // Check if existing attachments still meet rarity floor after player swap
    const [lineup] = await sql`
      SELECT god_card_id, item_card_id FROM cc_lineups WHERE user_id = ${userId} AND role = ${role}
    `
    if (lineup) {
      const playerTier = RARITY_TIER[card.rarity]
      // Check god attachment
      if (lineup.god_card_id) {
        const [godCard] = await sql`SELECT rarity FROM cc_cards WHERE id = ${lineup.god_card_id}`
        if (!godCard || RARITY_TIER[godCard.rarity] > playerTier) {
          await sql`UPDATE cc_lineups SET god_card_id = NULL WHERE user_id = ${userId} AND role = ${role}`
        }
      }
      // Check item attachment
      if (lineup.item_card_id) {
        const [itemCard] = await sql`SELECT rarity FROM cc_cards WHERE id = ${lineup.item_card_id}`
        if (!itemCard || RARITY_TIER[itemCard.rarity] > playerTier) {
          await sql`UPDATE cc_lineups SET item_card_id = NULL WHERE user_id = ${userId} AND role = ${role}`
        }
      }
    }
  } else if (slotType === 'god' || slotType === 'item') {
    // Attachments require holo type (commons cannot be attached)
    if (!card.holo_type) throw new Error('Attachment must have a holo type')
    if (card.card_type !== slotType) throw new Error(`Card must be a ${slotType} card`)
    if (slotType === 'god' && card.role !== role) throw new Error(`God role (${card.role}) does not match slot (${role})`)

    // Must have a player card in the slot first
    const [lineup] = await sql`
      SELECT card_id FROM cc_lineups WHERE user_id = ${userId} AND role = ${role}
    `
    if (!lineup || !lineup.card_id) throw new Error('Slot a player card first')

    // Check rarity floor: attachment must be >= player rarity
    // RARITY_TIER: lower number = higher rarity (mythic=0, common=5)
    // So attachment tier > player tier means attachment is WORSE rarity
    const [playerCard] = await sql`SELECT rarity FROM cc_cards WHERE id = ${lineup.card_id}`
    if (!playerCard) throw new Error('Player card not found')
    if (RARITY_TIER[card.rarity] > RARITY_TIER[playerCard.rarity]) {
      throw new Error(`Attachment must be at least ${playerCard.rarity} rarity`)
    }

    // Check not already attached elsewhere (use separate queries to avoid dynamic column issues with neon tagged templates)
    if (slotType === 'god') {
      const [alreadyAttached] = await sql`
        SELECT role FROM cc_lineups WHERE user_id = ${userId} AND god_card_id = ${cardId}
      `
      if (alreadyAttached) throw new Error(`Card is already attached in ${alreadyAttached.role}`)
    } else {
      const [alreadyAttached] = await sql`
        SELECT role FROM cc_lineups WHERE user_id = ${userId} AND item_card_id = ${cardId}
      `
      if (alreadyAttached) throw new Error(`Card is already attached in ${alreadyAttached.role}`)
    }

    await collectIncome(sql, userId)

    if (slotType === 'god') {
      await sql`UPDATE cc_lineups SET god_card_id = ${cardId} WHERE user_id = ${userId} AND role = ${role}`
    } else {
      await sql`UPDATE cc_lineups SET item_card_id = ${cardId} WHERE user_id = ${userId} AND role = ${role}`
    }
  } else {
    throw new Error('Invalid slotType')
  }

  return await tick(sql, userId)
}
```

**Note on dynamic column check:** The `sql(col)` syntax uses neon's identifier escaping for safe dynamic column references. If this doesn't work with neon's tagged template, use two separate queries instead (one for god, one for item) gated by the slotType check.

- [ ] **Step 10: Update `unslotCard` to cascade-clear attachments**

Replace the UPDATE query at lines 199-203:

```javascript
  await sql`
    UPDATE cc_lineups
    SET card_id = NULL, slotted_at = NULL, god_card_id = NULL, item_card_id = NULL
    WHERE user_id = ${userId} AND role = ${role}
  `
```

- [ ] **Step 11: Add `unslotAttachment` export**

After `unslotCard`:

```javascript
export async function unslotAttachment(sql, userId, role, slotType) {
  const validRoles = ['solo', 'jungle', 'mid', 'support', 'adc']
  if (!validRoles.includes(role)) throw new Error('Invalid role')
  if (slotType !== 'god' && slotType !== 'item') throw new Error('slotType must be god or item')

  await collectIncome(sql, userId)

  if (slotType === 'god') {
    await sql`UPDATE cc_lineups SET god_card_id = NULL WHERE user_id = ${userId} AND role = ${role}`
  } else {
    await sql`UPDATE cc_lineups SET item_card_id = NULL WHERE user_id = ${userId} AND role = ${role}`
  }

  return await tick(sql, userId)
}
```

- [ ] **Step 12: Commit**

```bash
git add functions/lib/starting-five.js
git commit -m "feat: attachment rate calculation, slot/unslot logic, rarity validation"
```

---

### Task 4: API Layer Changes

**Files:**
- Modify: `functions/api/vault.js:11,61-62,967-1027`

- [ ] **Step 1: Update imports**

Line 11, add `unslotAttachment` and `getSlotRates` to the import:

```javascript
import { tick, collectIncome, slotCard, unslotCard, unslotAttachment, getCardRates, getSlotRates, getAttachmentBonusInfo } from '../lib/starting-five.js'
```

- [ ] **Step 2: Add `unslot-attachment` case to POST switch**

After line 62 (`case 'unslot-card'`), add:

```javascript
        case 'unslot-attachment': return await handleUnslotAttachment(sql, user, body)
```

- [ ] **Step 3: Update `formatS5Response` to include attachment data**

Replace the function at lines 967-992:

```javascript
function getAttachmentBonusInfo(card, type) {
  // Returns the active bonus percentages for the response (per spec)
  const { passionMult, coresMult } = getSlotRates._getAttachmentMultiplier
    ? { passionMult: 1, coresMult: 1 } // fallback
    : (() => {
        const bonuses = { god: { passion: { uncommon: 0.08, rare: 0.14, epic: 0.22, legendary: 0.38, mythic: 0.50 }, cores: { uncommon: 0.15, rare: 0.25, epic: 0.40, legendary: 0.65, mythic: 0.80 } }, item: { passion: { uncommon: 0.03, rare: 0.07, epic: 0.14, legendary: 0.22, mythic: 0.30 }, cores: { uncommon: 0.08, rare: 0.16, epic: 0.30, legendary: 0.48, mythic: 0.60 } } }
        const b = bonuses[type]
        if (!b || !card.holo_type) return { passionBonus: 0, coresBonus: 0 }
        const pB = b.passion[card.rarity] || 0, cB = b.cores[card.rarity] || 0
        if (card.holo_type === 'holo') return { passionBonus: pB, coresBonus: 0 }
        if (card.holo_type === 'reverse') return { passionBonus: 0, coresBonus: cB }
        if (card.holo_type === 'full') return { passionBonus: +(pB * 0.6).toFixed(4), coresBonus: +(cB * 0.6).toFixed(4) }
        return { passionBonus: 0, coresBonus: 0 }
      })()
}
```

Actually, simplify this — export `getAttachmentBonusInfo` from `starting-five.js` alongside `getSlotRates`. In `starting-five.js`, add after `getSlotRates`:

```javascript
export function getAttachmentBonusInfo(attachment, type) {
  if (!attachment || !attachment.holo_type) return { passionBonus: 0, coresBonus: 0 }
  const bonuses = ATTACHMENT_BONUSES[type]
  if (!bonuses) return { passionBonus: 0, coresBonus: 0 }
  const pB = bonuses.passion[attachment.rarity] || 0
  const cB = bonuses.cores[attachment.rarity] || 0
  if (attachment.holo_type === 'holo') return { passionBonus: pB, coresBonus: 0 }
  if (attachment.holo_type === 'reverse') return { passionBonus: 0, coresBonus: cB }
  if (attachment.holo_type === 'full') return { passionBonus: +(pB * FULL_HOLO_RATIO).toFixed(4), coresBonus: +(cB * FULL_HOLO_RATIO).toFixed(4) }
  return { passionBonus: 0, coresBonus: 0 }
}
```

Then import it in `vault.js` alongside the other imports. The `formatS5Response` simply calls it:

```javascript
function formatS5Response(state, extra = {}) {
  const cardsWithRates = state.cards.map(c => {
    const { godCard, itemCard } = { godCard: c._godCard || null, itemCard: c._itemCard || null }
    const baseRates = getCardRates(c.holo_type, c.rarity)
    const effectiveRates = getSlotRates(c, godCard, itemCard)

    return {
      ...formatCard(c),
      slotRole: c.slot_role,
      passionPerHour: baseRates.passionPerHour,
      coresPerHour: baseRates.coresPerHour,
      effectivePassionPerHour: effectiveRates.passionPerHour,
      effectiveCoresPerHour: effectiveRates.coresPerHour,
      godCard: godCard ? { ...formatCard(godCard), ...getAttachmentBonusInfo(godCard, 'god') } : null,
      itemCard: itemCard ? { ...formatCard(itemCard), ...getAttachmentBonusInfo(itemCard, 'item') } : null,
    }
  })

  const totalPassionPerHour = cardsWithRates.reduce((s, c) => s + c.effectivePassionPerHour, 0)
  const totalCoresPerHour = cardsWithRates.reduce((s, c) => s + c.effectiveCoresPerHour, 0)

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
```

- [ ] **Step 4: Update `handleSlotCard` to pass slotType**

Replace lines 999-1012:

```javascript
async function handleSlotCard(sql, user, body) {
  const { cardId, role, slotType } = body
  if (!cardId || !role) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'cardId and role required' }) }
  }
  const state = await slotCard(sql, user.id, cardId, role, slotType || 'player')

  getVaultStats(sql, user.id)
    .then(stats => pushChallengeProgress(sql, user.id, stats))
    .catch(err => console.error('Vault challenge push (slot) failed:', err))

  return formatS5Response(state)
}
```

- [ ] **Step 5: Add `handleUnslotAttachment`**

After `handleUnslotCard`:

```javascript
async function handleUnslotAttachment(sql, user, body) {
  const { role, slotType } = body
  if (!role || !slotType) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'role and slotType required' }) }
  }
  const state = await unslotAttachment(sql, user.id, role, slotType)

  getVaultStats(sql, user.id)
    .then(stats => pushChallengeProgress(sql, user.id, stats))
    .catch(err => console.error('Vault challenge push (unslot-attachment) failed:', err))

  return formatS5Response(state)
}
```

- [ ] **Step 6: Commit**

```bash
git add functions/api/vault.js
git commit -m "feat: API handlers for attachment slot/unslot, updated response format"
```

---

### Task 5: Cross-Cutting Lineup Checks

**Files:**
- Modify: `functions/api/vault.js:909-912` (dismantle)
- Modify: `functions/lib/marketplace.js:31-33,112`
- Modify: `functions/lib/trading.js:115-117,277,283`

- [ ] **Step 1: Update dismantle handler lineup check**

Replace lines 909-912 in `vault.js`:

```sql
      AND NOT EXISTS (
        SELECT 1 FROM cc_lineups l
        WHERE (l.card_id = c.id OR l.god_card_id = c.id OR l.item_card_id = c.id) AND l.user_id = ${user.id}
      )
```

- [ ] **Step 2: Update marketplace listing validation**

Replace lines 31-33 in `marketplace.js`:

```javascript
  const [slotted] = await sql`
    SELECT role FROM cc_lineups
    WHERE user_id = ${userId} AND (card_id = ${cardId} OR god_card_id = ${cardId} OR item_card_id = ${cardId})
  `
```

- [ ] **Step 3: Update marketplace purchase lineup cleanup**

Replace line 112 in `marketplace.js`:

```javascript
  await tx`UPDATE cc_lineups SET card_id = NULL, slotted_at = NULL, god_card_id = NULL, item_card_id = NULL WHERE card_id = ${listing.card_id}`
  await tx`UPDATE cc_lineups SET god_card_id = NULL WHERE god_card_id = ${listing.card_id}`
  await tx`UPDATE cc_lineups SET item_card_id = NULL WHERE item_card_id = ${listing.card_id}`
```

- [ ] **Step 4: Update trading validation lineup check**

Replace lines 115-117 in `trading.js`:

```javascript
  const [inLineup] = await tx`
    SELECT role FROM cc_lineups
    WHERE (card_id = ${cardId} OR god_card_id = ${cardId} OR item_card_id = ${cardId}) AND user_id = ${userId}
    LIMIT 1
  `
```

- [ ] **Step 5: Update trade execution lineup cleanup**

Replace lines 277 and 283 in `trading.js`. For each side's card transfer, add god/item cleanup:

Line 277 area:
```javascript
    await tx`UPDATE cc_lineups SET card_id = NULL, slotted_at = NULL, god_card_id = NULL, item_card_id = NULL WHERE card_id = ANY(${aCardIds})`
    await tx`UPDATE cc_lineups SET god_card_id = NULL WHERE god_card_id = ANY(${aCardIds})`
    await tx`UPDATE cc_lineups SET item_card_id = NULL WHERE item_card_id = ANY(${aCardIds})`
```

Line 283 area:
```javascript
    await tx`UPDATE cc_lineups SET card_id = NULL, slotted_at = NULL, god_card_id = NULL, item_card_id = NULL WHERE card_id = ANY(${bCardIds})`
    await tx`UPDATE cc_lineups SET god_card_id = NULL WHERE god_card_id = ANY(${bCardIds})`
    await tx`UPDATE cc_lineups SET item_card_id = NULL WHERE item_card_id = ANY(${bCardIds})`
```

- [ ] **Step 6: Commit**

```bash
git add functions/api/vault.js functions/lib/marketplace.js functions/lib/trading.js
git commit -m "feat: update lineup checks for god/item attachments across marketplace, trading, dismantle"
```

---

## Chunk 2: Frontend — Service Layer, Context, UI

### Task 6: Service Layer

**Files:**
- Modify: `src/services/database.js:1036-1041`

- [ ] **Step 1: Update `slotCard` to accept slotType**

Replace line 1036-1038:

```javascript
    slotCard(cardId, role, slotType = 'player') {
        return apiPost('vault', { action: 'slot-card' }, { cardId, role, slotType })
    },
```

- [ ] **Step 2: Add `unslotAttachment` method**

After `unslotCard` (line 1041), add:

```javascript
    unslotAttachment(role, slotType) {
        return apiPost('vault', { action: 'unslot-attachment' }, { role, slotType })
    },
```

- [ ] **Step 3: Commit**

```bash
git add src/services/database.js
git commit -m "feat: service layer methods for attachment slot/unslot"
```

---

### Task 7: VaultContext Updates

**Files:**
- Modify: `src/pages/vault/VaultContext.jsx:123-133`

- [ ] **Step 1: Update `slotS5Card` to accept slotType**

Replace lines 123-127:

```javascript
  const slotS5Card = useCallback(async (cardId, role, slotType = 'player') => {
    const data = await vaultService.slotCard(cardId, role, slotType)
    setStartingFive(data)
    return data
  }, [])
```

- [ ] **Step 2: Add `unslotS5Attachment` callback**

After `unslotS5Card` (line 133), add:

```javascript
  const unslotS5Attachment = useCallback(async (role, slotType) => {
    const data = await vaultService.unslotAttachment(role, slotType)
    setStartingFive(data)
    return data
  }, [])
```

- [ ] **Step 3: Add to context value export**

Find the context value object (around line 221) and add `unslotS5Attachment` to it.

- [ ] **Step 4: Commit**

```bash
git add src/pages/vault/VaultContext.jsx
git commit -m "feat: context methods for attachment slot/unslot"
```

---

### Task 8: Frontend UI — Attachment Slots

**Files:**
- Modify: `src/pages/vault/CCStartingFive.jsx`

This is the largest frontend task. The changes are:

1. Update `getIncomeRate` to compute effective rates with attachments
2. Add attachment-aware `slottedCardIds` set (for filtering)
3. Add attachment slot/unslot handlers
4. Expand each `FilledSlot` to show god/item attachment areas
5. Add an attachment picker modal (reuse `CardPicker` pattern)
6. Update rate display to show effective rates

- [ ] **Step 1: Import `ATTACHMENT_BONUSES` and `FULL_HOLO_ATTACHMENT_RATIO`**

Update line 3:

```javascript
import { RARITIES, STARTING_FIVE_RATES, STARTING_FIVE_CAP_DAYS, ATTACHMENT_BONUSES, FULL_HOLO_ATTACHMENT_RATIO, getHoloEffect } from '../../data/vault/economy'
```

- [ ] **Step 2: Add `getEffectiveIncomeRate` function**

After `getIncomeRate` (line 71), add:

```javascript
function getAttachmentBonus(attachment, type) {
  if (!attachment) return { passionMult: 1, coresMult: 1 }
  const bonuses = ATTACHMENT_BONUSES[type]
  if (!bonuses) return { passionMult: 1, coresMult: 1 }
  const pBonus = bonuses.passion[attachment.rarity] || 0
  const cBonus = bonuses.cores[attachment.rarity] || 0
  let passionMult = 1, coresMult = 1
  if (attachment.holoType === 'holo') passionMult = 1 + pBonus
  else if (attachment.holoType === 'reverse') coresMult = 1 + cBonus
  else if (attachment.holoType === 'full') {
    passionMult = 1 + pBonus * FULL_HOLO_ATTACHMENT_RATIO
    coresMult = 1 + cBonus * FULL_HOLO_ATTACHMENT_RATIO
  }
  return { passionMult, coresMult }
}

function getEffectiveIncomeRate(card) {
  const base = getIncomeRate(card)
  const god = getAttachmentBonus(card.godCard, 'god')
  const item = getAttachmentBonus(card.itemCard, 'item')
  return {
    passion: base.passion * god.passionMult * item.passionMult,
    cores: base.cores * god.coresMult * item.coresMult,
  }
}
```

- [ ] **Step 3: Update `slottedCards` memo to track all slotted IDs**

After the existing `slottedCards` memo (line 180-187), add:

```javascript
  const allSlottedIds = useMemo(() => {
    if (!startingFive?.cards) return new Set()
    const ids = new Set()
    for (const card of startingFive.cards) {
      ids.add(card.id)
      if (card.godCard) ids.add(card.godCard.id)
      if (card.itemCard) ids.add(card.itemCard.id)
    }
    return ids
  }, [startingFive?.cards])
```

- [ ] **Step 4: Add attachment slot/unslot handlers**

After `handleUnslot` (line 215), add:

```javascript
  const [attachPickerState, setAttachPickerState] = useState(null) // { role, slotType }

  const handleAttachSlot = useCallback(async (cardId, role, slotType) => {
    setSlotting(true)
    try {
      await slotS5Card(cardId, role, slotType)
      const card = collection.find(c => c.id === cardId)
      if (card) {
        setSlotAnimation({ role, rarity: card.rarity, color: RARITIES[card.rarity]?.color || '#9ca3af', isAttachment: true })
        setTimeout(() => setSlotAnimation(null), 800)
      }
      setAttachPickerState(null)
    } catch (err) {
      console.error('Failed to attach card:', err)
    } finally {
      setSlotting(false)
    }
  }, [slotS5Card, collection])

  const handleAttachUnslot = useCallback(async (role, slotType) => {
    try {
      await unslotS5Attachment(role, slotType)
    } catch (err) {
      console.error('Failed to unslot attachment:', err)
    }
  }, [unslotS5Attachment])
```

Update the destructuring at line 141 to include `unslotS5Attachment`:

```javascript
  const { collection, startingFive, slotS5Card, unslotS5Card, unslotS5Attachment, collectS5Income, getDefOverride } = useVault()
```

- [ ] **Step 5: Add `AttachmentSlot` component**

After the `FilledSlot` component (after line 572), add:

```javascript
function AttachmentSlot({ attachment, slotType, role, playerRarity, onAttach, onRemove, size = 170, getDefOverride }) {
  const attachSize = Math.round(size * 0.4)

  if (!attachment) {
    return (
      <button
        onClick={onAttach}
        className="group flex flex-col items-center justify-center rounded-lg border border-dashed border-white/[0.06] bg-white/[0.01] hover:border-[var(--cd-cyan)]/20 hover:bg-[var(--cd-cyan)]/[0.02] transition-all cursor-pointer"
        style={{ width: attachSize, height: Math.round(attachSize * 88 / 63) }}
        title={`Attach ${slotType}`}
      >
        <Plus size={10} className="text-white/15 group-hover:text-[var(--cd-cyan)]/40 transition-colors" />
        <span className="text-[7px] text-white/15 group-hover:text-[var(--cd-cyan)]/40 font-bold cd-head tracking-wider mt-0.5 transition-colors">
          {slotType === 'god' ? 'GOD' : 'ITEM'}
        </span>
      </button>
    )
  }

  const color = RARITIES[attachment.rarity]?.color || '#9ca3af'
  const type = getCardType(attachment)
  const override = getDefOverride?.(attachment)

  return (
    <div className="relative group">
      <div className="cursor-pointer" style={{ width: attachSize }}>
        <TradingCardHolo rarity={getHoloEffect(attachment.rarity)} role={(attachment.role || attachment.cardData?.role || 'adc').toUpperCase()} holoType={attachment.holoType || 'reverse'} size={attachSize}>
          <GameCard type={type} rarity={attachment.rarity} data={toGameCardData(attachment, override)} size={attachSize} />
        </TradingCardHolo>
      </div>
      <div className="text-center mt-0.5">
        <div className="text-[7px] font-bold text-white/50 truncate cd-head" style={{ maxWidth: attachSize }}>{attachment.godName}</div>
        <div className="text-[7px] font-bold cd-head" style={{ color }}>{RARITIES[attachment.rarity]?.name}</div>
      </div>
      {/* Remove button on hover */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
        title="Remove"
      >
        <X size={8} className="text-white" />
      </button>
    </div>
  )
}
```

- [ ] **Step 6: Update `FilledSlot` to render attachment slots below**

In the `FilledSlot` component, after the income display section (after line 544, the closing `</div>` of the `mt-2 text-center` block), add the attachment slots:

```jsx
      {/* Attachment slots */}
      <div className="flex items-start justify-center gap-2 mt-2">
        <AttachmentSlot
          attachment={card.godCard}
          slotType="god"
          role={role.key}
          playerRarity={card.rarity}
          onAttach={() => onAttachPicker(role.key, 'god')}
          onRemove={() => onAttachRemove(role.key, 'god')}
          size={size}
          getDefOverride={getDefOverride}
        />
        <AttachmentSlot
          attachment={card.itemCard}
          slotType="item"
          role={role.key}
          playerRarity={card.rarity}
          onAttach={() => onAttachPicker(role.key, 'item')}
          onRemove={() => onAttachRemove(role.key, 'item')}
          size={size}
          getDefOverride={getDefOverride}
        />
      </div>
```

Update the `FilledSlot` function signature to accept the new props:

```javascript
function FilledSlot({ card, role, isAnimating, animConfig, onSwap, onRemove, onZoom, optionsOpen, onToggleOptions, size = 170, override, onAttachPicker, onAttachRemove, getDefOverride }) {
```

Update the income display (lines 531-544) to use effective rates:

```javascript
        const income = getEffectiveIncomeRate(card)
```

(Replace the line `const income = getIncomeRate(card)` at line 488.)

- [ ] **Step 7: Update `FilledSlot` call site to pass new props**

In the main component's JSX (around line 371-383), update the `FilledSlot` call:

```jsx
                  <FilledSlot
                    card={card}
                    role={role}
                    isAnimating={isAnimating}
                    animConfig={isAnimating ? getAnimationConfig(slotAnimation.rarity) : null}
                    onSwap={() => setPickerRole(role.key)}
                    onRemove={() => handleUnslot(role.key)}
                    onZoom={() => { setOptionsRole(null); setZoomedCard(card) }}
                    optionsOpen={optionsRole === role.key}
                    onToggleOptions={() => setOptionsRole(optionsRole === role.key ? null : role.key)}
                    size={slotSize}
                    override={getDefOverride(card)}
                    onAttachPicker={(r, st) => setAttachPickerState({ role: r, slotType: st })}
                    onAttachRemove={(r, st) => handleAttachUnslot(r, st)}
                    getDefOverride={getDefOverride}
                  />
```

- [ ] **Step 8: Add `AttachmentPicker` modal**

After the existing `CardPicker` component (after line 754), add:

```javascript
function AttachmentPicker({ role, slotType, collection, allSlottedIds, playerRarity, onSelect, onClose, slotting, getDefOverride }) {
  const roleInfo = ROLES.find(r => r.key === role)
  const Icon = roleInfo?.icon || Shield
  const playerTier = RARITY_TIER[playerRarity] || 0

  const eligibleCards = useMemo(() => {
    return collection
      .filter(card => {
        const type = getCardType(card)
        if (type !== slotType) return false
        if (!card.holoType) return false
        if ((RARITY_TIER[card.rarity] || 0) < playerTier) return false // must be >= player rarity
        if (slotType === 'god') {
          const cardRole = (card.role || card.cardData?.role || '').toLowerCase()
          if (cardRole !== role) return false
        }
        if (allSlottedIds.has(card.id)) return false
        return true
      })
      .sort((a, b) => {
        const rDiff = (RARITY_TIER[b.rarity] || 0) - (RARITY_TIER[a.rarity] || 0)
        if (rDiff !== 0) return rDiff
        return (a.godName || '').localeCompare(b.godName || '')
      })
  }, [collection, allSlottedIds, role, slotType, playerTier])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      style={{ animation: 'cd-fade-in 0.2s ease-out' }}
    >
      <div
        className="relative w-full max-w-2xl max-h-[100dvh] sm:max-h-[80vh] bg-[var(--cd-surface)] border border-[var(--cd-border)] sm:rounded-xl rounded-none overflow-hidden sm:mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--cd-border)]">
          <div className="flex items-center gap-2">
            <Icon size={18} className="text-[var(--cd-cyan)]" />
            <h3 className="text-base font-bold cd-head text-[var(--cd-text)] tracking-wider">
              Attach {slotType === 'god' ? 'God' : 'Item'}{slotType === 'god' ? ` — ${roleInfo?.label}` : ''}
            </h3>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 70px)' }}>
          {eligibleCards.length === 0 ? (
            <div className="text-center py-12 text-white/30">
              <Icon size={40} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm cd-head tracking-wider">No eligible {slotType} cards</p>
              <p className="text-xs text-white/20 mt-1">
                {slotType === 'god'
                  ? `Need a holo god card with ${roleInfo?.label} role, ${playerRarity}+ rarity`
                  : `Need a holo item card, ${playerRarity}+ rarity`
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
              {eligibleCards.map(card => (
                <PickerCard
                  key={card.id}
                  card={card}
                  onSelect={() => onSelect(card.id, role, slotType)}
                  disabled={slotting}
                  override={getDefOverride(card)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 9: Render `AttachmentPicker` modal in the main component**

After the existing `CardPicker` render (around line 404), add:

```jsx
      {attachPickerState && (
        <AttachmentPicker
          role={attachPickerState.role}
          slotType={attachPickerState.slotType}
          collection={collection}
          allSlottedIds={allSlottedIds}
          playerRarity={slottedCards[attachPickerState.role]?.rarity}
          onSelect={handleAttachSlot}
          onClose={() => setAttachPickerState(null)}
          slotting={slotting}
          getDefOverride={getDefOverride}
        />
      )}
```

- [ ] **Step 9b: Update existing `CardPicker` to exclude attachment IDs**

The existing `CardPicker` component (line 671) builds `slottedIds` from `Object.values(slottedCards)` which only has player card IDs. Attached god/item cards could appear as eligible for player slotting. Update the `CardPicker` to also accept and use `allSlottedIds`:

Update the `CardPicker` call at line 395-404 to pass `allSlottedIds`:

```jsx
      {pickerRole && (
        <CardPicker
          role={pickerRole}
          collection={collection}
          slottedCards={slottedCards}
          allSlottedIds={allSlottedIds}
          onSelect={handleSlot}
          onClose={() => setPickerRole(null)}
          slotting={slotting}
          getDefOverride={getDefOverride}
        />
      )}
```

Update the `CardPicker` function signature and filter (line 671-704). Replace the `slottedIds` construction:

```javascript
function CardPicker({ role, collection, slottedCards, allSlottedIds, onSelect, onClose, slotting, getDefOverride }) {
  // ...
  const eligibleCards = useMemo(() => {
    const currentPlayerInSlot = slottedCards[role]?.id
    return collection
      .filter(card => {
        const cardRole = (card.role || card.cardData?.role || '').toLowerCase()
        if (cardRole !== role) return false
        if (!card.holoType && card.rarity !== 'common') return false
        const type = getCardType(card)
        if (type !== 'player') return false
        // Exclude if slotted anywhere (as player, god, or item) — but allow the card currently in THIS slot (swap)
        if (card.id !== currentPlayerInSlot && allSlottedIds.has(card.id)) return false
        return true
      })
      // ... existing sort unchanged
```

- [ ] **Step 10: Commit**

```bash
git add src/pages/vault/CCStartingFive.jsx
git commit -m "feat: attachment UI — slots, picker modal, effective rate display"
```

---

### Task 9: Manual Testing

- [ ] **Step 1: Start dev server**

Run: `npm start`

- [ ] **Step 2: Test attachment flow**

1. Navigate to Card Clash → Starting 5
2. Slot a player card in any role
3. Verify the god/item attachment slots appear below the player card
4. Click the god "+" button — verify only matching-role god cards at >= player rarity appear
5. Click the item "+" button — verify only item cards at >= player rarity appear (any role)
6. Attach a god card — verify the effective rate updates in the income display
7. Attach an item card — verify rates stack multiplicatively
8. Collect income — verify the collected amount matches the effective rate
9. Swap the player for a lower-rarity one — verify attachments that don't meet the new rarity floor get removed
10. Unslot the player — verify both attachments are also removed
11. Try to list an attached card on marketplace — verify error
12. Try to trade an attached card — verify error
13. Try to dismantle an attached card — verify it's excluded

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during manual testing"
```

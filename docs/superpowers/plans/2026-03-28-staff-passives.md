# Staff Passives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the 7 staff card passives that activate from the Starting 5 staff slot, backed by a new dynamic odds engine that replaces the static rarity/holo roll system.

**Architecture:** New `functions/lib/odds.js` provides composable OddsContext objects. New `functions/lib/passives.js` holds all passive tuning tables and state management. Both integrate into the existing pack opening pipeline in `functions/lib/vault.js`. Frontend gets a PassivePanel in Starting 5 and reroll UI in PackOpening.

**Tech Stack:** PostgreSQL (Neon), Cloudflare Pages Functions, React 19, Vite, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-03-28-staff-passives-design.md`
**Tuning:** `docs/superpowers/specs/2026-03-28-staff-passives-tuning.md`

---

### Task 1: Database Migration

**Files:**
- Create: `database/migrations/150-staff-passives-state.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Passive state: charge tracking, cooldowns, toggles
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

-- Generated cards from Card Generator passive
CREATE TABLE cc_generated_cards (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  card_data JSONB NOT NULL,
  rarity TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_at TIMESTAMPTZ
);
CREATE INDEX idx_cc_generated_cards_user ON cc_generated_cards(user_id) WHERE claimed_at IS NULL;

-- Pack sessions for reroll state
CREATE TABLE cc_pack_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  cards JSONB NOT NULL,
  odds_context JSONB NOT NULL,
  reroll_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '10 minutes'
);
CREATE INDEX idx_cc_pack_sessions_user ON cc_pack_sessions(user_id);

-- Custom odds per pack type
ALTER TABLE cc_pack_types ADD COLUMN IF NOT EXISTS odds_config JSONB;

-- Holo choice on lineup slot (for Holo Boost passive)
ALTER TABLE cc_lineups ADD COLUMN IF NOT EXISTS holo_choice TEXT;
```

- [ ] **Step 2: Run the migration against the database**

```bash
# From .dev.vars, get DATABASE_URL and run:
psql "$DATABASE_URL" -f database/migrations/150-staff-passives-state.sql
```

Verify: all 3 tables created, 2 columns added.

- [ ] **Step 3: Commit**

```bash
git add database/migrations/150-staff-passives-state.sql
git commit -m "feat(passives): add migration for passive state, generated cards, pack sessions"
```

---

### Task 2: Dynamic Odds Engine (`functions/lib/odds.js`)

**Files:**
- Create: `functions/lib/odds.js`

This is the core engine that replaces static `rollRarity()` and `rollHoloType()` in `vault.js`. All rarity/holo rolling goes through OddsContext objects.

- [ ] **Step 1: Create the odds engine**

```js
// Dynamic odds engine — composable OddsContext for rarity, holo, and card pool rolls

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'unique']

const BASE_RARITY_WEIGHTS = {
  common: 0.60, uncommon: 0.30, rare: 0.06, epic: 0.035,
  legendary: 0.0065, mythic: 0.00075, unique: 0.00035,
}

const BASE_HOLO_WEIGHTS = { holo: 1, reverse: 1, full: 1 }

export { RARITY_ORDER }

// ════════════════════════════════════════════
// Context creation
// ════════════════════════════════════════════

export function createOddsContext(overrides = {}) {
  return {
    rarity: { ...BASE_RARITY_WEIGHTS },
    minRarity: 'common',
    maxRarity: null,
    blockedRarities: [],
    holoType: { ...BASE_HOLO_WEIGHTS },
    cardType: { god: null, item: null, consumable: null, player: null, collection: null },
    ownedDefIds: null,
    collectorBoost: 0,
    ...overrides,
  }
}

// ════════════════════════════════════════════
// Pack-level overrides
// ════════════════════════════════════════════

export function applyPackOverrides(ctx, oddsConfig) {
  if (!oddsConfig) return ctx
  const next = { ...ctx }

  if (oddsConfig.rarity) {
    next.rarity = { ...ctx.rarity }
    for (const [k, v] of Object.entries(oddsConfig.rarity)) {
      if (next.rarity[k] !== undefined && typeof v === 'number' && v >= 0) {
        next.rarity[k] = v
      }
    }
  }

  if (oddsConfig.holoType) {
    next.holoType = { ...ctx.holoType }
    for (const [k, v] of Object.entries(oddsConfig.holoType)) {
      if (next.holoType[k] !== undefined && typeof v === 'number' && v >= 0) {
        next.holoType[k] = v
      }
    }
  }

  if (oddsConfig.cardType) {
    next.cardType = { ...ctx.cardType }
    for (const [k, v] of Object.entries(oddsConfig.cardType)) {
      if (next.cardType[k] !== undefined) {
        next.cardType[k] = typeof v === 'number' && v >= 0 ? v : null
      }
    }
  }

  if (oddsConfig.minRarity && RARITY_ORDER.includes(oddsConfig.minRarity)) {
    next.minRarity = oddsConfig.minRarity
  }
  if (oddsConfig.maxRarity && RARITY_ORDER.includes(oddsConfig.maxRarity)) {
    next.maxRarity = oddsConfig.maxRarity
  }

  return next
}

// ════════════════════════════════════════════
// Rarity rolling
// ════════════════════════════════════════════

export function rollRarityFromContext(ctx, minRarityOverride = null, maxRarityOverride = null) {
  const minR = minRarityOverride || ctx.minRarity || 'common'
  const maxR = maxRarityOverride || ctx.maxRarity || null
  const minIdx = RARITY_ORDER.indexOf(minR)
  const maxIdx = maxR ? RARITY_ORDER.indexOf(maxR) : RARITY_ORDER.length - 1

  const eligible = RARITY_ORDER.slice(minIdx, maxIdx + 1)
    .filter(r => !ctx.blockedRarities.includes(r))

  if (eligible.length === 0) return minR

  // Redistribute blocked weight
  let redistributed = 0
  let uniqueRedirectPct = 0
  if (ctx.blockedRarities.length > 0 && ctx._uniqueRedirectPct) {
    for (const blocked of ctx.blockedRarities) {
      redistributed += ctx.rarity[blocked] || 0
    }
    uniqueRedirectPct = ctx._uniqueRedirectPct
  }

  const weights = {}
  for (const r of eligible) {
    weights[r] = ctx.rarity[r] || 0
  }

  // Apply Unique Hunter redistribution
  if (redistributed > 0) {
    const toUnique = redistributed * uniqueRedirectPct
    const toLower = redistributed - toUnique
    if (eligible.includes('unique')) {
      weights['unique'] = (weights['unique'] || 0) + toUnique
    }
    // Spread toLower proportionally across non-unique eligible
    const lowerRarities = eligible.filter(r => r !== 'unique')
    const lowerTotal = lowerRarities.reduce((sum, r) => sum + (weights[r] || 0), 0)
    if (lowerTotal > 0) {
      for (const r of lowerRarities) {
        weights[r] += toLower * ((weights[r] || 0) / lowerTotal)
      }
    }
  }

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0)
  if (totalWeight <= 0) return eligible[0]

  let roll = Math.random() * totalWeight
  for (const r of eligible) {
    roll -= weights[r]
    if (roll <= 0) return r
  }
  return eligible[eligible.length - 1]
}

// ════════════════════════════════════════════
// Holo type rolling
// ════════════════════════════════════════════

export function rollHoloTypeFromContext(ctx, rarity) {
  if (rarity === 'common') return null
  const types = Object.keys(ctx.holoType)
  const weights = types.map(t => ctx.holoType[t] || 0)
  const total = weights.reduce((a, b) => a + b, 0)
  if (total <= 0) return types[0]

  let roll = Math.random() * total
  for (let i = 0; i < types.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return types[i]
  }
  return types[types.length - 1]
}

// ════════════════════════════════════════════
// Card pool selection with Collector Boost
// ════════════════════════════════════════════

export function selectFromPool(ctx, pool, defIdField = 'id') {
  if (!pool || pool.length === 0) return null
  if (!ctx.ownedDefIds || ctx.collectorBoost <= 0) {
    return pool[Math.floor(Math.random() * pool.length)]
  }

  // Weight un-owned higher
  const weights = pool.map(item => {
    const defId = item[defIdField]
    return ctx.ownedDefIds.has(defId) ? 1 : ctx.collectorBoost
  })
  const total = weights.reduce((a, b) => a + b, 0)
  let roll = Math.random() * total
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return pool[i]
  }
  return pool[pool.length - 1]
}

// ════════════════════════════════════════════
// Card type selection from context
// ════════════════════════════════════════════

export function pickWeightedTypeFromContext(ctx, types, fallbackPoolSizes) {
  const weights = types.map(t => {
    if (ctx.cardType[t] != null) return ctx.cardType[t]
    return fallbackPoolSizes[t] || 10
  })
  const total = weights.reduce((a, b) => a + b, 0)
  if (total <= 0) return types[0]

  let roll = Math.random() * total
  for (let i = 0; i < types.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return types[i]
  }
  return types[types.length - 1]
}
```

- [ ] **Step 2: Commit**

```bash
git add functions/lib/odds.js
git commit -m "feat(odds): add dynamic OddsContext engine"
```

---

### Task 3: Passive Engine (`functions/lib/passives.js`)

**Files:**
- Create: `functions/lib/passives.js`

All tuning tables, passive state management, and the function that applies a passive to an OddsContext.

- [ ] **Step 1: Create the passives engine**

```js
// Staff card passive engine — tuning tables, state management, context modifiers

// ════════════════════════════════════════════
// Tuning Tables (see staff-passives-tuning.md)
// ════════════════════════════════════════════

const ODDS_BOOST = {
  uncommon: 1.05, rare: 1.10, epic: 1.18, legendary: 1.28, mythic: 1.40, unique: 1.55,
}

const HOLO_BOOST_WEIGHT = {
  uncommon: 1.5, rare: 2.0, epic: 3.0, legendary: 4.5, mythic: 6.0, unique: 8.0,
}

const UNIQUE_HUNTER_REDIRECT = {
  uncommon: 0.15, rare: 0.25, epic: 0.35, legendary: 0.50, mythic: 0.65, unique: 0.80,
}

const COLLECTOR_BOOST_MULT = {
  uncommon: 1.5, rare: 2.0, epic: 3.0, legendary: 4.5, mythic: 6.5, unique: 9.0,
}

const CARD_REROLL = {
  uncommon: { hoursPerCharge: 48, maxCharges: 1 },
  rare:      { hoursPerCharge: 36, maxCharges: 2 },
  epic:      { hoursPerCharge: 24, maxCharges: 2 },
  legendary: { hoursPerCharge: 18, maxCharges: 3 },
  mythic:    { hoursPerCharge: 12, maxCharges: 3 },
  unique:    { hoursPerCharge: 8,  maxCharges: 4 },
}

const PACK_REROLL = {
  uncommon: { hoursPerCharge: 72, maxCharges: 1, lowCardLossBias: 0.55 },
  rare:      { hoursPerCharge: 48, maxCharges: 1, lowCardLossBias: 0.65 },
  epic:      { hoursPerCharge: 36, maxCharges: 2, lowCardLossBias: 0.72 },
  legendary: { hoursPerCharge: 24, maxCharges: 2, lowCardLossBias: 0.80 },
  mythic:    { hoursPerCharge: 18, maxCharges: 3, lowCardLossBias: 0.88 },
  unique:    { hoursPerCharge: 12, maxCharges: 3, lowCardLossBias: 0.93 },
}

const CARD_GENERATOR = {
  uncommon: { hoursPerCharge: 72, maxCharges: 1, rarityCap: 'uncommon' },
  rare:      { hoursPerCharge: 48, maxCharges: 2, rarityCap: 'rare' },
  epic:      { hoursPerCharge: 36, maxCharges: 2, rarityCap: 'epic' },
  legendary: { hoursPerCharge: 24, maxCharges: 3, rarityCap: 'legendary' },
  mythic:    { hoursPerCharge: 16, maxCharges: 3, rarityCap: 'mythic' },
  unique:    { hoursPerCharge: 10, maxCharges: 4, rarityCap: 'unique' },
}

const SWAP_COOLDOWN_HOURS = {
  odds_boost: 12, holo_boost: 12, card_reroll: 24, pack_reroll: 24,
  unique_hunter: 6, collector_boost: 12, card_generator: 48,
}

export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'unique']

// ════════════════════════════════════════════
// Passive state: read
// ════════════════════════════════════════════

function getChargeConfig(passiveName, staffRarity) {
  if (passiveName === 'card_reroll') return CARD_REROLL[staffRarity]
  if (passiveName === 'pack_reroll') return PACK_REROLL[staffRarity]
  if (passiveName === 'card_generator') return CARD_GENERATOR[staffRarity]
  return null
}

function computeCharges(state, config) {
  if (!config) return { charges: 0, maxCharges: 0, chargeProgressPct: 0, nextChargeIn: null }

  const now = Date.now()
  const lastCharged = new Date(state.last_charged_at).getTime()
  const elapsedMs = Math.max(0, now - lastCharged)
  const msPerCharge = config.hoursPerCharge * 3600_000

  const earnedCharges = Math.floor(elapsedMs / msPerCharge)
  const totalCharges = Math.min(state.charges + earnedCharges, config.maxCharges)
  const atMax = totalCharges >= config.maxCharges

  const remainderMs = atMax ? 0 : elapsedMs - (earnedCharges * msPerCharge)
  const progressPct = atMax ? 1 : remainderMs / msPerCharge
  const nextChargeMs = atMax ? null : msPerCharge - remainderMs

  return {
    charges: totalCharges,
    maxCharges: config.maxCharges,
    chargeProgressPct: Math.round(progressPct * 100) / 100,
    nextChargeIn: nextChargeMs ? formatDuration(nextChargeMs) : null,
  }
}

function formatDuration(ms) {
  const hours = Math.floor(ms / 3600_000)
  const minutes = Math.floor((ms % 3600_000) / 60_000)
  if (hours > 0) return `${hours}h`
  return `${minutes}m`
}

export async function getActivePassive(sql, userId) {
  const rows = await sql`
    SELECT l.card_id, l.holo_choice, c.rarity, sp.name AS passive_name
    FROM cc_lineups l
    JOIN cc_cards c ON l.card_id = c.id
    JOIN cc_staff_passives sp ON c.passive_id = sp.id
    WHERE l.user_id = ${userId}
      AND l.lineup_type = 'current'
      AND l.role = 'staff'
      AND l.card_id IS NOT NULL
  `
  if (rows.length === 0) return null

  const row = rows[0]
  const state = await getPassiveState(sql, userId, row.passive_name)
  const config = getChargeConfig(row.passive_name, row.rarity)
  const chargeInfo = config ? computeCharges(state, config) : null

  return {
    passiveName: row.passive_name,
    staffRarity: row.rarity,
    cardId: row.card_id,
    holoChoice: row.holo_choice || state.holo_choice,
    enabled: state.enabled,
    charges: chargeInfo?.charges ?? null,
    maxCharges: chargeInfo?.maxCharges ?? null,
    chargeProgressPct: chargeInfo?.chargeProgressPct ?? null,
    nextChargeIn: chargeInfo?.nextChargeIn ?? null,
  }
}

async function getPassiveState(sql, userId, passiveName) {
  const rows = await sql`
    SELECT * FROM cc_passive_state
    WHERE user_id = ${userId} AND passive_name = ${passiveName}
  `
  if (rows.length > 0) return rows[0]

  // No row yet — return defaults (row created on first slot)
  return { charges: 0, last_charged_at: new Date(), cooldown_until: null, enabled: true, holo_choice: null }
}

// ════════════════════════════════════════════
// Passive state: write
// ════════════════════════════════════════════

export async function initPassiveState(sql, userId, passiveName) {
  await sql`
    INSERT INTO cc_passive_state (user_id, passive_name, charges, last_charged_at, enabled)
    VALUES (${userId}, ${passiveName}, 0, NOW(), true)
    ON CONFLICT (user_id, passive_name) DO NOTHING
  `
}

export async function spendCharge(sql, userId, passiveName, staffRarity) {
  const config = getChargeConfig(passiveName, staffRarity)
  if (!config) throw new Error('Passive has no charges')

  const state = await getPassiveState(sql, userId, passiveName)
  const { charges } = computeCharges(state, config)
  if (charges <= 0) throw new Error('No charges available')

  // Materialize computed charges minus one, reset timer for partial progress
  const now = new Date()
  const lastCharged = new Date(state.last_charged_at)
  const msPerCharge = config.hoursPerCharge * 3600_000
  const elapsedMs = Math.max(0, now.getTime() - lastCharged.getTime())
  const earnedCharges = Math.floor(elapsedMs / msPerCharge)
  const newCharges = Math.min(state.charges + earnedCharges, config.maxCharges) - 1

  // Preserve partial progress toward next charge
  const remainderMs = elapsedMs - (earnedCharges * msPerCharge)
  const newLastCharged = new Date(now.getTime() - remainderMs)

  await sql`
    UPDATE cc_passive_state
    SET charges = ${newCharges}, last_charged_at = ${newLastCharged}
    WHERE user_id = ${userId} AND passive_name = ${passiveName}
  `

  return newCharges
}

export async function applySwapCooldown(sql, userId, passiveName) {
  const hours = SWAP_COOLDOWN_HOURS[passiveName]
  if (!hours) return

  await sql`
    INSERT INTO cc_passive_state (user_id, passive_name, cooldown_until)
    VALUES (${userId}, ${passiveName}, NOW() + ${hours + ' hours'}::interval)
    ON CONFLICT (user_id, passive_name)
    DO UPDATE SET cooldown_until = NOW() + ${hours + ' hours'}::interval
  `
}

export async function checkSwapCooldown(sql, userId) {
  const rows = await sql`
    SELECT passive_name, cooldown_until FROM cc_passive_state
    WHERE user_id = ${userId} AND cooldown_until > NOW()
    ORDER BY cooldown_until DESC LIMIT 1
  `
  if (rows.length === 0) return null
  return { passiveName: rows[0].passive_name, cooldownUntil: rows[0].cooldown_until }
}

export async function toggleUniqueHunter(sql, userId, enabled) {
  await sql`
    UPDATE cc_passive_state
    SET enabled = ${enabled}
    WHERE user_id = ${userId} AND passive_name = 'unique_hunter'
  `
}

export async function setHoloChoice(sql, userId, holoChoice) {
  if (!['holo', 'reverse', 'full'].includes(holoChoice)) throw new Error('Invalid holo choice')
  await sql`
    UPDATE cc_lineups SET holo_choice = ${holoChoice}
    WHERE user_id = ${userId} AND lineup_type = 'current' AND role = 'staff'
  `
  await sql`
    UPDATE cc_passive_state SET holo_choice = ${holoChoice}
    WHERE user_id = ${userId} AND passive_name = 'holo_boost'
  `
}

// ════════════════════════════════════════════
// Card Generator
// ════════════════════════════════════════════

export async function getGeneratedCards(sql, userId) {
  return await sql`
    SELECT id, card_data, rarity, created_at
    FROM cc_generated_cards
    WHERE user_id = ${userId} AND claimed_at IS NULL
    ORDER BY created_at DESC
  `
}

export async function claimGeneratedCard(sql, userId, generatedCardId) {
  const [gen] = await sql`
    SELECT * FROM cc_generated_cards
    WHERE id = ${generatedCardId} AND user_id = ${userId} AND claimed_at IS NULL
  `
  if (!gen) throw new Error('Card not found or already claimed')

  const cardData = gen.card_data

  const [inserted] = await sql`
    INSERT INTO cc_cards (
      owner_id, original_owner_id, god_id, god_name, god_class, role, rarity,
      serial_number, holo_effect, holo_type, image_url, acquired_via, card_type,
      card_data, def_id, blueprint_id, depicted_user_id
    ) VALUES (
      ${userId}, ${userId}, ${cardData.god_id}, ${cardData.god_name}, ${cardData.god_class},
      ${cardData.role}, ${cardData.rarity}, ${cardData.serial_number},
      ${cardData.holo_effect}, ${cardData.holo_type}, ${cardData.image_url},
      'passive_generator', ${cardData.card_type},
      ${cardData.card_data ? JSON.stringify(cardData.card_data) : null}::jsonb,
      ${cardData.def_id || null}, ${cardData.blueprint_id || null},
      ${cardData.depicted_user_id || null}
    ) RETURNING *
  `

  await sql`UPDATE cc_generated_cards SET claimed_at = NOW() WHERE id = ${generatedCardId}`

  return inserted
}

// ════════════════════════════════════════════
// Apply passive to OddsContext
// ════════════════════════════════════════════

export function applyPassiveToContext(ctx, passiveName, staffRarity, passiveState) {
  if (!passiveName || !staffRarity) return ctx
  const next = { ...ctx, rarity: { ...ctx.rarity }, holoType: { ...ctx.holoType } }

  switch (passiveName) {
    case 'odds_boost': {
      const mult = ODDS_BOOST[staffRarity] || 1
      for (const r of RARITY_ORDER) {
        if (r !== 'common') next.rarity[r] *= mult
      }
      break
    }

    case 'holo_boost': {
      const weight = HOLO_BOOST_WEIGHT[staffRarity] || 1
      const choice = passiveState?.holoChoice
      if (choice && next.holoType[choice] !== undefined) {
        next.holoType[choice] = weight
      }
      break
    }

    case 'unique_hunter': {
      if (passiveState?.enabled !== false) {
        next.blockedRarities = ['legendary', 'mythic']
        next._uniqueRedirectPct = UNIQUE_HUNTER_REDIRECT[staffRarity] || 0
      }
      break
    }

    case 'collector_boost': {
      next.collectorBoost = COLLECTOR_BOOST_MULT[staffRarity] || 1
      break
    }

    // card_reroll, pack_reroll, card_generator don't modify odds context
    // They are handled separately during pack opening
  }

  return next
}

// ════════════════════════════════════════════
// Pack Reroll: card removal weighting
// ════════════════════════════════════════════

export function pickCardToRemove(cards, staffRarity, rerollCount) {
  const config = PACK_REROLL[staffRarity]
  if (!config) return 0 // fallback: remove first

  // Sort indices by rarity (lowest first)
  const rarityIdx = Object.fromEntries(RARITY_ORDER.map((r, i) => [r, i]))
  const indices = cards.map((_, i) => i)
  indices.sort((a, b) => (rarityIdx[cards[a].rarity] || 0) - (rarityIdx[cards[b].rarity] || 0))

  // Base bias toward low-rarity cards, eroded by +15% per reroll toward rarest
  const baseBias = config.lowCardLossBias
  const erosion = rerollCount * 0.15
  const effectiveBias = Math.max(0.1, baseBias - erosion)

  // Split into bottom half and top half
  const midpoint = Math.ceil(indices.length / 2)
  const bottomHalf = indices.slice(0, midpoint)
  const topHalf = indices.slice(midpoint)

  if (Math.random() < effectiveBias) {
    return bottomHalf[Math.floor(Math.random() * bottomHalf.length)]
  } else {
    return topHalf[Math.floor(Math.random() * topHalf.length)]
  }
}

// Export tuning tables for frontend display
export { CARD_REROLL, PACK_REROLL, CARD_GENERATOR, SWAP_COOLDOWN_HOURS }
```

- [ ] **Step 2: Commit**

```bash
git add functions/lib/passives.js
git commit -m "feat(passives): add passive engine with tuning tables and state management"
```

---

### Task 4: Integrate Odds Engine into vault.js

**Files:**
- Modify: `functions/lib/vault.js`

Replace all static `rollRarity()`, `rollRarityBounded()`, `rollHoloType()` calls with OddsContext-based versions. Card generation functions accept a context parameter.

- [ ] **Step 1: Add imports and update rollRarity/rollHoloType functions**

At the top of `functions/lib/vault.js`, add the import:

```js
import { createOddsContext, applyPackOverrides, rollRarityFromContext, rollHoloTypeFromContext, rollHoloEffect as rollHoloEffectBase, selectFromPool, pickWeightedTypeFromContext, RARITY_ORDER } from './odds.js'
```

Remove the existing `RARITY_ORDER` constant (line 17) and the following local functions (replace with thin wrappers for backward compat within the file):

- `rollRarity()` (lines 19-29) — replace with:
```js
function rollRarity(minRarity = 'common', ctx = null) {
  if (ctx) return rollRarityFromContext(ctx, minRarity)
  return rollRarityFromContext(createOddsContext(), minRarity)
}
```

- `rollRarityBounded()` (lines 31-44) — replace with:
```js
function rollRarityBounded(minRarity = 'common', maxRarity = null, ctx = null) {
  if (ctx) return rollRarityFromContext(ctx, minRarity, maxRarity)
  return rollRarityFromContext(createOddsContext(), minRarity, maxRarity)
}
```

- `rollHoloType()` (lines 56-60) — replace the export with:
```js
export function rollHoloType(rarity, ctx = null) {
  if (ctx) return rollHoloTypeFromContext(ctx, rarity)
  if (rarity === 'common') return null
  const types = ['holo', 'reverse', 'full']
  return types[Math.floor(Math.random() * types.length)]
}
```

Keep `RARITIES` (line 6-15), `RARITY_HOLO_MAP` (line 47-50), and `rollHoloEffect` (line 52-54) unchanged — they serve the catalog/display, not odds rolling.

- [ ] **Step 2: Update card generation functions to accept optional context**

For each of `generateCard()`, `generateItemCard()`, `generateConsumableCard()`:
- Add optional `ctx` parameter
- Replace `rollHoloType(rarity)` with `rollHoloType(rarity, ctx)`

Example for `generateCard()` (line 62):
```js
function generateCard(rarity, ctx = null) {
  if (rarity === 'unique') rarity = 'mythic'
  const god = ctx ? selectFromPool(ctx, GODS, 'slug') || GODS[Math.floor(Math.random() * GODS.length)]
    : GODS[Math.floor(Math.random() * GODS.length)]
  // ... rest unchanged except:
  // holo_type: rollHoloType(rarity, ctx),
```

For `generatePlayerCard()` — add `ctx` parameter, use for holo type roll:
```js
async function generatePlayerCard(sql, rarity, leagueId, ctx = null) {
  // ... existing logic, but:
  // holo_type: rollHoloType(rarity, ctx),
```

For `generateCardByType()` — thread `ctx` through:
```js
function generateCardByType(type, rarity, ctx = null) {
  if (type === 'god') return generateCard(rarity, ctx)
  if (type === 'item') return generateItemCard(rarity, ctx)
  if (type === 'consumable') return generateConsumableCard(rarity, ctx)
  return generateCard(rarity, ctx)
}
```

- [ ] **Step 3: Update pack generation functions to accept and use context**

Update `generateRarityPack()`:
```js
function generateRarityPack(pack, ctx = null) {
  const cards = []
  const guarantees = normalizeGuarantees(pack.guarantees)
  for (const g of guarantees) {
    for (let i = 0; i < g.count; i++) {
      cards.push(generateCard(rollRarity(g.minRarity, ctx), ctx))
    }
  }
  while (cards.length < pack.cards) {
    cards.push(generateCard(rollRarity('common', ctx), ctx))
  }
  return cards
}
```

Update `generateMixedPack()` — add `ctx` parameter, use in rarity/type rolls:
```js
async function generateMixedPack(sql, leagueId, ctx = null) {
  // ... existing setup ...
  for (let i = 0; i < 6; i++) {
    const minRarity = i === 4 ? 'uncommon' : 'common'
    const rarity = rollRarity(minRarity, ctx)
    // ... type selection uses ctx if cardType weights set ...
    const card = type === 'player'
      ? await generatePlayerCard(sql, rarity, leagueId, ctx)
      : generateCardByType(type, rarity, ctx)
    // ...
  }
}
```

Update `generateConfiguredPack()` — same pattern, add `ctx` parameter, thread through.

- [ ] **Step 4: Update openPack() to build and use OddsContext**

In `openPack()` (line 427), after loading the pack, build the context:

```js
export async function openPack(sql, userId, packType, { skipPayment = false, passive = null } = {}) {
  const [pack] = skipPayment
    ? await sql`SELECT * FROM cc_pack_types WHERE id = ${packType}`
    : await sql`SELECT * FROM cc_pack_types WHERE id = ${packType} AND enabled = true`
  if (!pack) throw new Error('Invalid pack type')

  // ... payment check unchanged ...

  // Build odds context
  let ctx = createOddsContext()
  ctx = applyPackOverrides(ctx, pack.odds_config)
  if (passive) {
    const { applyPassiveToContext } = await import('./passives.js')
    ctx = applyPassiveToContext(ctx, passive.passiveName, passive.staffRarity, passive)
  }

  // Load owned card def IDs for Collector Boost
  if (ctx.collectorBoost > 0) {
    const owned = await sql`SELECT DISTINCT def_id FROM cc_cards WHERE owner_id = ${userId} AND def_id IS NOT NULL`
    ctx.ownedDefIds = new Set(owned.map(r => r.def_id))
  }

  let cards
  if (pack.slots && pack.slots.length > 0) {
    cards = await generateConfiguredPack(sql, pack, ctx)
  } else if (pack.category === 'mixed') {
    cards = await generateMixedPack(sql, pack.league_id, ctx)
  } else {
    cards = generateRarityPack({ cards: pack.cards_per_pack, guarantees: pack.guarantees || [] }, ctx)
  }

  // ... rest of openPack unchanged (card insertion, stats, etc.) ...
```

- [ ] **Step 5: Verify the dev server starts without errors**

```bash
npm run dev:api
```

Confirm no import errors or runtime crashes. The existing behavior should be unchanged (context defaults to base rates).

- [ ] **Step 6: Commit**

```bash
git add functions/lib/vault.js
git commit -m "feat(odds): integrate OddsContext into vault.js pack generation pipeline"
```

---

### Task 5: Integrate Passives into Starting Five Slot/Unslot

**Files:**
- Modify: `functions/lib/starting-five.js`

Add swap cooldown checks on slot, cooldown application on unslot, and holo_choice saving.

- [ ] **Step 1: Add imports**

At the top of `functions/lib/starting-five.js`:
```js
import { checkSwapCooldown, applySwapCooldown, initPassiveState, setHoloChoice } from './passives.js'
```

- [ ] **Step 2: Modify slotCard() for staff role**

In `slotCard()` (line 459), inside the `if (role === 'cheerleader' || role === 'staff')` block (line 483), after the marketplace/binder checks and before the `collectIncome` call (line 496), add swap cooldown check:

```js
// Check swap cooldown before slotting staff card
if (role === 'staff') {
  const cooldown = await checkSwapCooldown(sql, userId)
  if (cooldown) {
    const remaining = Math.ceil((new Date(cooldown.cooldownUntil).getTime() - Date.now()) / 3600_000)
    throw new Error(`Staff slot on cooldown — ${remaining}h remaining`)
  }
}
```

After the INSERT/upsert (line 498-503), add passive state initialization:

```js
// Initialize passive state for the newly slotted staff card
if (role === 'staff') {
  const [staffCard] = await sql`
    SELECT sp.name AS passive_name FROM cc_cards c
    JOIN cc_staff_passives sp ON c.passive_id = sp.id
    WHERE c.id = ${cardId}
  `
  if (staffCard) {
    await initPassiveState(sql, userId, staffCard.passive_name)
  }
}
```

- [ ] **Step 3: Modify unslotCard() for staff role**

In `unslotCard()` (line 598), before the UPDATE statement (line 604), add cooldown application for staff slot:

```js
// Apply swap cooldown when unslotting a staff card
if (role === 'staff') {
  const [staffSlot] = await sql`
    SELECT c.passive_id, sp.name AS passive_name
    FROM cc_lineups l
    JOIN cc_cards c ON l.card_id = c.id
    JOIN cc_staff_passives sp ON c.passive_id = sp.id
    WHERE l.user_id = ${userId} AND l.lineup_type = ${lineupType} AND l.role = 'staff'
      AND l.card_id IS NOT NULL
  `
  if (staffSlot) {
    await applySwapCooldown(sql, userId, staffSlot.passive_name)
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add functions/lib/starting-five.js
git commit -m "feat(passives): add swap cooldown and passive state init to slot/unslot"
```

---

### Task 6: API Endpoints — Pack Opening with Passives + Reroll Actions

**Files:**
- Modify: `functions/api/vault.js`

Wire up passive loading into pack opening, add reroll-card, reroll-pack, claim-generated-card, and toggle-unique-hunter actions.

- [ ] **Step 1: Import passives in vault.js API**

At the top of `functions/api/vault.js`, add:
```js
import { getActivePassive, spendCharge, getGeneratedCards, claimGeneratedCard, toggleUniqueHunter, setHoloChoice, pickCardToRemove } from '../lib/passives.js'
```

- [ ] **Step 2: Modify the pack opening handler to load and pass passive**

In the `handleOpenPack()` function (around line 531 in vault.js API), before calling `openPack()`, load the active passive:

```js
// Load active passive for odds modification
const passive = await getActivePassive(sql, user.id)

const result = await openPack(sql, user.id, packType, { skipPayment: isStaff, passive })
```

After getting the result, compute reroll eligibility and create pack session if needed:

```js
let rerollState = null
if (passive) {
  const cardRerollCharges = passive.passiveName === 'card_reroll' ? passive.charges : 0
  const packRerollCharges = passive.passiveName === 'pack_reroll' ? passive.charges : 0

  if (cardRerollCharges > 0 || packRerollCharges > 0) {
    // Create pack session for rerolls
    const rarityIdx = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5, unique: 6 }
    const staffRarityIdx = rarityIdx[passive.staffRarity] || 0

    const eligibleCardIndices = result.cards
      .map((c, i) => ({ i, rarity: c.rarity }))
      .filter(c => (rarityIdx[c.rarity] || 0) <= staffRarityIdx)
      .map(c => c.i)

    const [session] = await sql`
      INSERT INTO cc_pack_sessions (user_id, cards, odds_context, reroll_count)
      VALUES (${user.id}, ${JSON.stringify(result.cards)}::jsonb, ${JSON.stringify({})}::jsonb, 0)
      RETURNING id
    `

    rerollState = {
      sessionId: session.id,
      cardRerollCharges,
      packRerollCharges,
      eligibleCardIndices,
    }
  }
}

// Include rerollState in response
return { statusCode: 200, headers, body: JSON.stringify({ ...result, rerollState }) }
```

- [ ] **Step 3: Add reroll-card action handler**

Add a new action case in the main handler switch:

```js
case 'reroll-card': {
  const { sessionId, cardIndex } = body
  const user = await requireAuth(event)
  const sql = neon(event)

  const passive = await getActivePassive(sql, user.id)
  if (!passive || passive.passiveName !== 'card_reroll') {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'No card reroll passive active' }) }
  }

  const [session] = await sql`
    SELECT * FROM cc_pack_sessions
    WHERE id = ${sessionId} AND user_id = ${user.id} AND expires_at > NOW()
  `
  if (!session) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Pack session expired' }) }

  const cards = session.cards
  if (cardIndex < 0 || cardIndex >= cards.length) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid card index' }) }
  }

  // Check rarity eligibility
  const rarityIdx = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5, unique: 6 }
  if ((rarityIdx[cards[cardIndex].rarity] || 0) > (rarityIdx[passive.staffRarity] || 0)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Card rarity too high for reroll' }) }
  }

  const chargesRemaining = await spendCharge(sql, user.id, 'card_reroll', passive.staffRarity)

  // Generate replacement card with same odds context
  const { createOddsContext } = await import('../lib/odds.js')
  const { applyPassiveToContext } = await import('../lib/passives.js')
  const { generateCardForReroll } = await import('../lib/vault.js')

  let ctx = createOddsContext()
  ctx = applyPassiveToContext(ctx, passive.passiveName, passive.staffRarity, passive)

  const newCard = await generateCardForReroll(sql, user.id, cards[cardIndex].rarity, ctx)

  // Update session
  cards[cardIndex] = newCard
  await sql`UPDATE cc_pack_sessions SET cards = ${JSON.stringify(cards)}::jsonb WHERE id = ${sessionId}`

  return { statusCode: 200, headers, body: JSON.stringify({ newCard, chargesRemaining }) }
}
```

Note: `generateCardForReroll` is a new export from vault.js — a thin wrapper around `generateCard` that also inserts into `cc_cards`. Add to vault.js:

```js
export async function generateCardForReroll(sql, userId, oldRarity, ctx) {
  const rarity = rollRarity(oldRarity, ctx)
  const card = generateCard(rarity, ctx)
  card.holo_type = rollHoloType(rarity, ctx)

  const [inserted] = await sql`
    INSERT INTO cc_cards (owner_id, original_owner_id, god_id, god_name, god_class, role, rarity,
      serial_number, holo_effect, holo_type, image_url, acquired_via, card_type, card_data)
    VALUES (${userId}, ${userId}, ${card.god_id}, ${card.god_name}, ${card.god_class}, ${card.role},
      ${card.rarity}, ${card.serial_number}, ${card.holo_effect}, ${card.holo_type}, ${card.image_url},
      'reroll', ${card.card_type}, ${card.card_data ? JSON.stringify(card.card_data) : null}::jsonb)
    RETURNING *
  `
  return inserted
}
```

- [ ] **Step 4: Add reroll-pack action handler**

```js
case 'reroll-pack': {
  const { sessionId } = body
  const user = await requireAuth(event)
  const sql = neon(event)

  const passive = await getActivePassive(sql, user.id)
  if (!passive || passive.passiveName !== 'pack_reroll') {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'No pack reroll passive active' }) }
  }

  const [session] = await sql`
    SELECT * FROM cc_pack_sessions
    WHERE id = ${sessionId} AND user_id = ${user.id} AND expires_at > NOW()
  `
  if (!session) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Pack session expired' }) }

  // Spend charge only on first reroll of a pack (multiple rerolls per charge)
  if (session.reroll_count === 0) {
    await spendCharge(sql, user.id, 'pack_reroll', passive.staffRarity)
  }

  const oldCards = session.cards

  // Pick card to remove
  const removeIdx = pickCardToRemove(oldCards, passive.staffRarity, session.reroll_count)
  const remaining = oldCards.filter((_, i) => i !== removeIdx)

  // Delete the removed card from cc_cards
  if (oldCards[removeIdx]?.id) {
    await sql`DELETE FROM cc_cards WHERE id = ${oldCards[removeIdx].id} AND owner_id = ${user.id}`
  }

  // Re-generate remaining cards with same rarities
  const { createOddsContext, rollRarityFromContext } = await import('../lib/odds.js')
  const { applyPassiveToContext } = await import('../lib/passives.js')
  let ctx = createOddsContext()
  ctx = applyPassiveToContext(ctx, passive.passiveName, passive.staffRarity, passive)

  const { generateCardForReroll } = await import('../lib/vault.js')
  const newCards = []
  for (const oldCard of remaining) {
    // Delete old card, generate new one at same rarity
    if (oldCard.id) {
      await sql`DELETE FROM cc_cards WHERE id = ${oldCard.id} AND owner_id = ${user.id}`
    }
    const newCard = await generateCardForReroll(sql, user.id, oldCard.rarity, ctx)
    newCards.push(newCard)
  }

  // Update session
  const newRerollCount = session.reroll_count + 1
  await sql`
    UPDATE cc_pack_sessions
    SET cards = ${JSON.stringify(newCards)}::jsonb, reroll_count = ${newRerollCount}
    WHERE id = ${sessionId}
  `

  return { statusCode: 200, headers, body: JSON.stringify({
    cards: newCards,
    chargesRemaining: passive.charges - (session.reroll_count === 0 ? 1 : 0),
  })}
}
```

- [ ] **Step 5: Add claim-generated-card and toggle-unique-hunter actions**

```js
case 'claim-generated-card': {
  const { generatedCardId } = body
  const user = await requireAuth(event)
  const sql = neon(event)
  const card = await claimGeneratedCard(sql, user.id, generatedCardId)
  return { statusCode: 200, headers, body: JSON.stringify({ card }) }
}

case 'toggle-unique-hunter': {
  const { enabled } = body
  const user = await requireAuth(event)
  const sql = neon(event)
  await toggleUniqueHunter(sql, user.id, !!enabled)
  return { statusCode: 200, headers, body: JSON.stringify({ enabled: !!enabled }) }
}

case 'set-holo-choice': {
  const { holoChoice } = body
  const user = await requireAuth(event)
  const sql = neon(event)
  await setHoloChoice(sql, user.id, holoChoice)
  return { statusCode: 200, headers, body: JSON.stringify({ holoChoice }) }
}
```

- [ ] **Step 6: Extend Starting 5 fetch with passive state**

In the Starting 5 handler (`handleStartingFive()`), after fetching lineup data, add:

```js
const passiveData = await getActivePassive(sql, user.id)
const generatedCards = passiveData?.passiveName === 'card_generator'
  ? await getGeneratedCards(sql, user.id)
  : []

// Include in response
passiveState: passiveData ? {
  name: passiveData.passiveName,
  staffRarity: passiveData.staffRarity,
  charges: passiveData.charges,
  maxCharges: passiveData.maxCharges,
  chargeProgressPct: passiveData.chargeProgressPct,
  nextChargeIn: passiveData.nextChargeIn,
  cooldownUntil: null, // fetched separately if needed
  enabled: passiveData.enabled,
  holoChoice: passiveData.holoChoice,
  generatedCards: generatedCards.map(g => ({ id: g.id, rarity: g.rarity, createdAt: g.created_at })),
} : null
```

- [ ] **Step 7: Commit**

```bash
git add functions/api/vault.js functions/lib/vault.js
git commit -m "feat(passives): add reroll, claim, toggle endpoints and passive-aware pack opening"
```

---

### Task 7: Card Generator Background Generation

**Files:**
- Modify: `functions/lib/passives.js`
- Modify: `functions/api/vault.js`

The Card Generator creates cards passively. Since CF has no cron, generation is triggered on Starting 5 fetch — if enough time has passed and charges are available, generate the card immediately.

- [ ] **Step 1: Add generatePassiveCard to passives.js**

```js
export async function generatePassiveCard(sql, userId, staffRarity) {
  const config = CARD_GENERATOR[staffRarity]
  if (!config) return null

  const { createOddsContext, rollRarityFromContext, rollHoloTypeFromContext } = await import('./odds.js')
  const { GODS, CLASS_ROLE, getGodImageUrl } = await import('./vault-data.js')
  const { rollHoloEffect } = await import('./vault.js')

  // Build boosted context capped at staff rarity
  let ctx = createOddsContext()
  const oddsBoostMult = ODDS_BOOST[staffRarity] || 1
  for (const r of RARITY_ORDER) {
    if (r !== 'common') ctx.rarity[r] *= oddsBoostMult
  }

  const rarity = rollRarityFromContext(ctx, 'common', config.rarityCap)
  const god = GODS[Math.floor(Math.random() * GODS.length)]
  const role = god.role || CLASS_ROLE[god.class] || 'mid'

  const cardData = {
    card_type: 'god',
    god_id: god.slug,
    god_name: god.name,
    god_class: god.class,
    role,
    rarity,
    serial_number: Math.floor(Math.random() * 9999) + 1,
    holo_effect: rollHoloEffect(rarity),
    holo_type: rollHoloTypeFromContext(ctx, rarity),
    image_url: getGodImageUrl(god),
  }

  const [gen] = await sql`
    INSERT INTO cc_generated_cards (user_id, card_data, rarity)
    VALUES (${userId}, ${JSON.stringify(cardData)}::jsonb, ${rarity})
    RETURNING id, rarity, created_at
  `

  return gen
}
```

- [ ] **Step 2: Add generation trigger to Starting 5 fetch**

In the Starting 5 handler in `functions/api/vault.js`, after loading passive state, check if Card Generator should fire:

```js
// Trigger Card Generator if applicable
if (passiveData?.passiveName === 'card_generator' && passiveData.charges > 0) {
  const { spendCharge, generatePassiveCard } = await import('../lib/passives.js')
  try {
    await spendCharge(sql, user.id, 'card_generator', passiveData.staffRarity)
    const newGen = await generatePassiveCard(sql, user.id, passiveData.staffRarity)
    if (newGen) generatedCards.unshift(newGen)
    // Refresh passive data after spending
    const refreshed = await getActivePassive(sql, user.id)
    if (refreshed) Object.assign(passiveData, refreshed)
  } catch (e) {
    // Charge may have been spent between check and spend — ignore
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add functions/lib/passives.js functions/api/vault.js
git commit -m "feat(passives): card generator creates cards on Starting 5 fetch"
```

---

### Task 8: Frontend — Passive Panel in Starting 5

**Files:**
- Create: `src/pages/vault/starting-five/PassivePanel.jsx`
- Modify: `src/pages/vault/CCStartingFive.jsx`
- Modify: `src/pages/vault/starting-five/PassivesGuide.jsx`
- Modify: `src/services/database.js`

- [ ] **Step 1: Add service functions**

In `src/services/database.js`, inside the `vaultService` object (around line 1009), add:

```js
toggleUniqueHunter: (enabled) => apiPost('vault', { action: 'toggle-unique-hunter' }, { enabled }),
setHoloChoice: (holoChoice) => apiPost('vault', { action: 'set-holo-choice' }, { holoChoice }),
claimGeneratedCard: (generatedCardId) => apiPost('vault', { action: 'claim-generated-card' }, { generatedCardId }),
rerollCard: (sessionId, cardIndex) => apiPost('vault', { action: 'reroll-card' }, { sessionId, cardIndex }),
rerollPack: (sessionId) => apiPost('vault', { action: 'reroll-pack' }, { sessionId }),
```

- [ ] **Step 2: Create PassivePanel component**

```jsx
import { useState, useCallback } from 'react'
import { PassiveIcon, getPassiveInfo } from '../../../data/vault/passives'
import { vaultService } from '../../../services/database'
import { Zap, Clock, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react'

const RARITY_LABEL = {
  uncommon: 'Minor', rare: 'Moderate', epic: 'Notable',
  legendary: 'Strong', mythic: 'Major', unique: 'Major',
}

export default function PassivePanel({ passiveState, onUpdate }) {
  if (!passiveState) return null

  const { name, staffRarity, charges, maxCharges, chargeProgressPct, nextChargeIn, enabled, holoChoice, generatedCards } = passiveState
  const info = getPassiveInfo(name)
  if (!info) return null

  const label = RARITY_LABEL[staffRarity] || ''

  return (
    <div className="cd-panel cd-corners rounded-xl p-4 mt-4">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="text-cyan-400">
          <PassiveIcon passive={name} size={20} />
        </div>
        <div>
          <div className="text-sm font-bold text-white/90">{info.name}</div>
          <div className="text-xs text-white/40">{label} boost</div>
        </div>
      </div>

      {/* Charge pips for charge-based passives */}
      {maxCharges > 0 && (
        <ChargePips charges={charges} maxCharges={maxCharges} progressPct={chargeProgressPct} nextChargeIn={nextChargeIn} />
      )}

      {/* Holo Boost selector */}
      {name === 'holo_boost' && (
        <HoloSelector current={holoChoice} onSelect={onUpdate} />
      )}

      {/* Unique Hunter toggle */}
      {name === 'unique_hunter' && (
        <UniqueHunterToggle enabled={enabled} onToggle={onUpdate} />
      )}

      {/* Card Generator claimables */}
      {name === 'card_generator' && generatedCards?.length > 0 && (
        <GeneratedCards cards={generatedCards} onClaim={onUpdate} />
      )}
    </div>
  )
}

function ChargePips({ charges, maxCharges, progressPct, nextChargeIn }) {
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="flex gap-1">
        {Array.from({ length: maxCharges }).map((_, i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              i < charges ? 'bg-cyan-400' : 'bg-white/10'
            }`}
          />
        ))}
      </div>
      {nextChargeIn && charges < maxCharges && (
        <span className="text-[10px] text-white/30 flex items-center gap-1">
          <Clock size={10} /> {nextChargeIn}
        </span>
      )}
    </div>
  )
}

function HoloSelector({ current, onSelect }) {
  const [loading, setLoading] = useState(false)
  const types = ['holo', 'reverse', 'full']
  const labels = { holo: 'Holo', reverse: 'Reverse', full: 'Full Art' }

  const handleSelect = useCallback(async (type) => {
    if (type === current || loading) return
    setLoading(true)
    try {
      await vaultService.setHoloChoice(type)
      onUpdate?.()
    } finally {
      setLoading(false)
    }
  }, [current, loading, onSelect])

  return (
    <div className="flex gap-2 mt-3">
      {types.map(t => (
        <button
          key={t}
          onClick={() => handleSelect(t)}
          disabled={loading}
          className={`px-3 py-1.5 text-xs rounded-lg transition-all cursor-pointer ${
            t === current
              ? 'bg-cyan-400/20 text-cyan-300 border border-cyan-400/30'
              : 'bg-white/5 text-white/40 border border-white/5 hover:bg-white/10'
          }`}
        >
          {labels[t]}
        </button>
      ))}
    </div>
  )
}

function UniqueHunterToggle({ enabled, onToggle }) {
  const [loading, setLoading] = useState(false)

  const handleToggle = useCallback(async () => {
    if (loading) return
    setLoading(true)
    try {
      await vaultService.toggleUniqueHunter(!enabled)
      onToggle?.()
    } finally {
      setLoading(false)
    }
  }, [enabled, loading, onToggle])

  const Icon = enabled ? ToggleRight : ToggleLeft

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className="flex items-center gap-2 mt-3 cursor-pointer"
    >
      <Icon size={24} className={enabled ? 'text-cyan-400' : 'text-white/20'} />
      <span className={`text-xs ${enabled ? 'text-cyan-300' : 'text-white/40'}`}>
        {loading ? 'Updating...' : enabled ? 'Active' : 'Inactive'}
      </span>
    </button>
  )
}

function GeneratedCards({ cards, onClaim }) {
  const [claiming, setClaiming] = useState(null)

  const handleClaim = useCallback(async (id) => {
    if (claiming) return
    setClaiming(id)
    try {
      await vaultService.claimGeneratedCard(id)
      onClaim?.()
    } finally {
      setClaiming(null)
    }
  }, [claiming, onClaim])

  return (
    <div className="flex gap-2 mt-3 flex-wrap">
      {cards.map(c => (
        <button
          key={c.id}
          onClick={() => handleClaim(c.id)}
          disabled={!!claiming}
          className="w-12 h-16 rounded-lg bg-gradient-to-b from-cyan-400/20 to-cyan-400/5 border border-cyan-400/20 animate-pulse hover:animate-none hover:border-cyan-400/50 transition-colors cursor-pointer flex items-center justify-center"
        >
          {claiming === c.id ? <Loader2 size={14} className="animate-spin text-cyan-400" /> : <Zap size={14} className="text-cyan-400" />}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Integrate PassivePanel into CCStartingFive**

In `CCStartingFive.jsx`, add import at the top:
```js
import PassivePanel from './starting-five/PassivePanel'
```

Find where the staff slots render (around line 850) and add the PassivePanel after the staff slot section. The `passiveState` will come from the Starting 5 API response — add it to the destructured data from the fetch:

```jsx
{/* After staff slot cards */}
<PassivePanel
  passiveState={lineupData?.passiveState}
  onUpdate={() => refetchLineup()}
/>
```

- [ ] **Step 4: Update PassivesGuide — remove "Coming soon"**

In `src/pages/vault/starting-five/PassivesGuide.jsx`, remove lines 28-31 (the amber "Coming soon" banner):

```jsx
// DELETE THIS BLOCK:
<div className="flex items-center gap-2 mt-3 mb-4 px-3 py-2 rounded-lg bg-amber-400/10 border border-amber-400/20">
  <Clock size={14} className="text-amber-400 shrink-0" />
  <span className="text-xs text-amber-300/90 font-medium">Coming soon — passives are not yet active</span>
</div>
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/vault/starting-five/PassivePanel.jsx src/pages/vault/CCStartingFive.jsx src/pages/vault/starting-five/PassivesGuide.jsx src/services/database.js
git commit -m "feat(passives): add PassivePanel UI in Starting 5 with holo selector, toggle, and generator claims"
```

---

### Task 9: Frontend — Pack Opening Reroll UI

**Files:**
- Modify: `src/pages/vault/components/PackOpening.jsx`

Add card reroll button on flipped cards and pack reroll button in summary.

- [ ] **Step 1: Add reroll state to PackOpening**

In the main PackOpening component, add state for reroll tracking:

```jsx
const [rerollState, setRerollState] = useState(null) // from API response
const [rerollingCard, setRerollingCard] = useState(null) // index being rerolled
const [rerollingPack, setRerollingPack] = useState(false)
const [packRerollCount, setPackRerollCount] = useState(0)
```

When the pack is opened and the API returns `rerollState`, store it:
```jsx
// In the pack open handler, after receiving result:
if (result.rerollState) setRerollState(result.rerollState)
```

- [ ] **Step 2: Add card reroll handler**

```jsx
const handleCardReroll = useCallback(async (cardIndex) => {
  if (!rerollState || rerollingCard !== null) return
  setRerollingCard(cardIndex)

  try {
    const result = await vaultService.rerollCard(rerollState.sessionId, cardIndex)

    // Flip card back (triggers re-flip animation)
    setFlippedCards(prev => {
      const next = new Set(prev)
      next.delete(cardIndex)
      return next
    })

    // Replace card data after brief delay for flip-back
    setTimeout(() => {
      setCards(prev => {
        const next = [...prev]
        next[cardIndex] = result.newCard
        return next
      })
      setRerollState(prev => ({
        ...prev,
        cardRerollCharges: result.chargesRemaining,
        eligibleCardIndices: result.chargesRemaining > 0 ? prev.eligibleCardIndices : [],
      }))
      // Re-flip after card data updated
      setTimeout(() => {
        setRerollingCard(null)
      }, 300)
    }, 600)
  } catch (e) {
    setRerollingCard(null)
  }
}, [rerollState, rerollingCard])
```

- [ ] **Step 3: Render reroll icon on eligible cards**

In the card rendering within the stack/summary phase, after a card is flipped, conditionally show a reroll icon:

```jsx
{rerollState?.cardRerollCharges > 0
  && rerollState.eligibleCardIndices.includes(cardIndex)
  && flippedCards.has(cardIndex)
  && rerollingCard === null && (
  <button
    onClick={(e) => { e.stopPropagation(); handleCardReroll(cardIndex) }}
    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-cyan-400/20 border border-cyan-400/30 flex items-center justify-center hover:bg-cyan-400/30 transition-colors cursor-pointer z-10"
    title="Reroll"
  >
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} className="text-cyan-300">
      <path d="M1 4v6h6M23 20v-6h-6" />
      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" />
    </svg>
  </button>
)}
```

- [ ] **Step 4: Add pack reroll handler and button**

```jsx
const handlePackReroll = useCallback(async () => {
  if (!rerollState || rerollingPack) return
  setRerollingPack(true)

  try {
    const result = await vaultService.rerollPack(rerollState.sessionId)

    // Reset to pre-flip state — replay full animation
    setPhase('emerging')
    setFlippedCards(new Set())
    setCards(result.cards)
    setPackRerollCount(prev => prev + 1)
    setRerollState(prev => ({
      ...prev,
      packRerollCharges: result.chargesRemaining,
    }))
  } catch (e) {
    // ignore
  } finally {
    setRerollingPack(false)
  }
}, [rerollState, rerollingPack])
```

In the summary view, after the card grid, add the pack reroll button:

```jsx
{rerollState?.packRerollCharges > 0 && !rerollingPack && (
  <button
    onClick={handlePackReroll}
    className="mt-4 px-5 py-2.5 rounded-xl bg-cyan-400/10 border border-cyan-400/20 text-cyan-300 text-sm font-medium hover:bg-cyan-400/20 transition-colors cursor-pointer"
  >
    {packRerollCount === 0 ? 'Reroll Pack' : packRerollCount === 1 ? 'Reroll Again' : 'Reroll Once More'}
  </button>
)}
{rerollingPack && (
  <div className="mt-4 flex items-center gap-2 text-white/40 text-sm">
    <Loader2 size={16} className="animate-spin" /> Rerolling...
  </div>
)}
```

- [ ] **Step 5: Add Loader2 import**

Ensure `Loader2` is imported from lucide-react at the top of PackOpening.jsx:
```jsx
import { Loader2 } from 'lucide-react'
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/vault/components/PackOpening.jsx
git commit -m "feat(passives): add card reroll and pack reroll UI in pack opening"
```

---

### Task 10: Frontend — Mini Pack Flip for Card Generator

**Files:**
- Create: `src/pages/vault/components/MiniPackFlip.jsx`
- Modify: `src/pages/vault/starting-five/PassivePanel.jsx`

- [ ] **Step 1: Create MiniPackFlip modal**

```jsx
import { useState, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import GameCard from './GameCard'
import VaultCard from './VaultCard'
import TradingCardHolo from '../../../components/TradingCardHolo'

const ANTICIPATION_MS = { common: 0, uncommon: 300, rare: 600, epic: 1000, legendary: 1400, mythic: 1800, unique: 2000 }
const RARITY_COLORS = { common: '#9ca3af', uncommon: '#22c55e', rare: '#3b82f6', epic: '#a855f7', legendary: '#ff8c00', mythic: '#ef4444', unique: '#e8e8ff' }

export default function MiniPackFlip({ card, onClose }) {
  const [flipped, setFlipped] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 300)
    return () => clearTimeout(t)
  }, [])

  const handleFlip = useCallback(() => {
    if (flipped || !ready) return
    const delay = ANTICIPATION_MS[card.rarity] || 0
    setTimeout(() => setFlipped(true), delay)
  }, [flipped, ready, card.rarity])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-8 -right-8 text-white/40 hover:text-white/70 cursor-pointer">
          <X size={20} />
        </button>

        <div
          onClick={handleFlip}
          className="cursor-pointer transition-transform duration-700"
          style={{ perspective: '1000px' }}
        >
          {!flipped ? (
            <div className="w-48 h-64 rounded-xl bg-gradient-to-b from-cyan-400/30 to-cyan-400/5 border border-cyan-400/30 flex items-center justify-center animate-pulse">
              <span className="text-cyan-300 text-xs font-medium">Tap to reveal</span>
            </div>
          ) : (
            <div className="w-48 animate-in fade-in zoom-in-95 duration-500">
              <VaultCard card={card} size="md" />
              <div className="text-center mt-3">
                <span className="text-xs font-bold" style={{ color: RARITY_COLORS[card.rarity] }}>
                  {card.rarity?.charAt(0).toUpperCase() + card.rarity?.slice(1)}
                </span>
                <div className="text-xs text-white/50 mt-1">{card.god_name}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Integrate MiniPackFlip into PassivePanel's GeneratedCards**

Update the `GeneratedCards` sub-component in `PassivePanel.jsx` to open the modal on claim:

```jsx
import MiniPackFlip from '../components/MiniPackFlip'

// Inside GeneratedCards:
const [claimedCard, setClaimedCard] = useState(null)

const handleClaim = useCallback(async (id) => {
  if (claiming) return
  setClaiming(id)
  try {
    const result = await vaultService.claimGeneratedCard(id)
    setClaimedCard(result.card)
    setClaiming(null)
  } catch {
    setClaiming(null)
  }
}, [claiming])

// In the return, add:
{claimedCard && (
  <MiniPackFlip card={claimedCard} onClose={() => { setClaimedCard(null); onClaim?.() }} />
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/vault/components/MiniPackFlip.jsx src/pages/vault/starting-five/PassivePanel.jsx
git commit -m "feat(passives): add MiniPackFlip modal for Card Generator claims"
```

---

### Task 11: Frontend Economy Data — Update Passives Display

**Files:**
- Modify: `src/data/vault/passives.jsx`

Update the passive descriptions to use qualitative language and add the rarity label map for UI consumption.

- [ ] **Step 1: Update passives.jsx**

Replace the `STAFF_PASSIVES` object with richer descriptions:

```jsx
export const RARITY_LABEL = {
  uncommon: 'Minor', rare: 'Moderate', epic: 'Notable',
  legendary: 'Strong', mythic: 'Major', unique: 'Major',
}

export const STAFF_PASSIVES = {
  odds_boost:      { name: 'Odds Boost',      description: 'Increases card pull odds across all rarities' },
  holo_boost:      { name: 'Holo Boost',       description: 'Boosts your chosen holo type when opening packs' },
  card_reroll:     { name: 'Card Reroll',       description: 'Re-flip a card during pack opening for a new pull' },
  pack_reroll:     { name: 'Pack Reroll',       description: 'Reopen your entire pack for fresh cards' },
  unique_hunter:   { name: 'Unique Hunter',     description: 'Sacrifice rare pulls for a better shot at unique cards' },
  collector_boost: { name: 'Collector Boost',   description: 'Increases your chances of pulling cards you don\'t own' },
  card_generator:  { name: 'Card Generator',    description: 'Generates claimable cards over time' },
}
```

- [ ] **Step 2: Commit**

```bash
git add src/data/vault/passives.jsx
git commit -m "feat(passives): update passive descriptions with qualitative language"
```

---

### Task 12: Cleanup Expired Pack Sessions

**Files:**
- Modify: `functions/api/vault.js`

Add cleanup of expired pack sessions when opening a new pack.

- [ ] **Step 1: Add cleanup in handleOpenPack**

At the start of `handleOpenPack()`, before creating any new session:

```js
// Cleanup expired pack sessions (opportunistic)
event.waitUntil(sql`DELETE FROM cc_pack_sessions WHERE expires_at < NOW()`)
```

This uses `waitUntil` so it doesn't block the pack opening response.

- [ ] **Step 2: Commit**

```bash
git add functions/api/vault.js
git commit -m "chore(passives): cleanup expired pack sessions on pack open"
```

---

### Task 13: End-to-End Verification

**Files:** None (testing only)

- [ ] **Step 1: Start the dev server**

```bash
npm start
```

- [ ] **Step 2: Verify Starting 5 passive display**

Navigate to the Vault → Starting 5. Slot a staff card in the staff slot. Verify:
- PassivePanel appears with the card's passive name and icon
- Charge pips display correctly (initially 0)
- If Holo Boost: holo type selector renders and saves choice
- If Unique Hunter: toggle renders and persists state

- [ ] **Step 3: Verify passive-modified pack opening**

Open a pack with an active passive. Verify:
- Cards generate without errors
- If Card Reroll active with charges: reroll icon appears on eligible cards after flip
- If Pack Reroll active with charges: reroll button appears in summary
- Reroll triggers re-animation (not instant swap)

- [ ] **Step 4: Verify swap cooldown**

Unslot the staff card. Verify:
- Cooldown is applied (check cc_passive_state table)
- Attempting to slot a new staff card within the cooldown period is blocked with a message

- [ ] **Step 5: Verify Card Generator**

Slot a staff card with Card Generator passive. Manually set `last_charged_at` to a past time in the DB to simulate charge accumulation. Refresh Starting 5. Verify:
- Generated card appears as a glowing card-back in the PassivePanel
- Tapping opens the MiniPackFlip modal
- Claiming inserts the card into cc_cards

- [ ] **Step 6: Commit any fixes found during verification**

```bash
git add -A
git commit -m "fix(passives): end-to-end verification fixes"
```

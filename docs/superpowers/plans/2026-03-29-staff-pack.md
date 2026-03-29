# Staff Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Staff Pack (10 Cores, 6 cards) with guaranteed 2 staff cards at boosted rarity odds, 1 player card, 2 god/item/consumable, and 1 wildcard.

**Architecture:** Extend the odds engine with per-type rarity overrides (`typeOdds`), add a `generateStaffCard` function to vault.js that queries approved staff blueprints, wire it into the configured pack generator, and insert the pack type via migration.

**Tech Stack:** PostgreSQL (Neon), Cloudflare Pages Functions, odds.js / vault.js

**Spec:** `docs/superpowers/specs/2026-03-29-staff-pack-design.md`

---

### Task 1: Add `typeOdds` support to odds engine

**Files:**
- Modify: `functions/lib/odds.js:36-75` (applyPackOverrides)

- [ ] **Step 1: Add `typeOdds` storage to `applyPackOverrides`**

In `functions/lib/odds.js`, add handling for `typeOdds` at the end of `applyPackOverrides`, before the `return next` line:

```javascript
  if (oddsConfig.typeOdds && typeof oddsConfig.typeOdds === 'object') {
    next.typeOdds = {}
    for (const [type, overrides] of Object.entries(oddsConfig.typeOdds)) {
      if (overrides?.rarity && typeof overrides.rarity === 'object') {
        next.typeOdds[type] = { rarity: {} }
        for (const [k, v] of Object.entries(overrides.rarity)) {
          if (BASE_RARITY_WEIGHTS[k] !== undefined && typeof v === 'number' && v >= 0) {
            next.typeOdds[type].rarity[k] = v
          }
        }
      }
    }
  }
```

- [ ] **Step 2: Add `getContextForType` export**

Add this new function after `applyPackOverrides` in `functions/lib/odds.js`:

```javascript
export function getContextForType(ctx, type) {
  if (!ctx.typeOdds || !ctx.typeOdds[type]) return ctx
  const next = { ...ctx, rarity: { ...ctx.rarity } }
  for (const [k, v] of Object.entries(ctx.typeOdds[type].rarity)) {
    next.rarity[k] = v
  }
  return next
}
```

- [ ] **Step 3: Commit**

```bash
git add functions/lib/odds.js
git commit -m "feat(odds): add typeOdds support for per-card-type rarity overrides"
```

---

### Task 2: Add `generateStaffCard` to vault.js

**Files:**
- Modify: `functions/lib/vault.js:376-382` (generateCardByType)
- Modify: `functions/lib/vault.js:5` (imports)
- Add new function after `generateCollectionCard` (~line 874)

- [ ] **Step 1: Add `getContextForType` to imports**

In `functions/lib/vault.js` line 5, add `getContextForType` to the odds.js import:

```javascript
import { createOddsContext, applyPackOverrides, rollRarityFromContext, rollHoloTypeFromContext, selectFromPool, getContextForType, RARITY_ORDER as OddsRarityOrder } from './odds.js'
```

- [ ] **Step 2: Add `generateStaffCard` function**

Add this function after `generateCollectionCard` (after line 874) in `functions/lib/vault.js`:

```javascript
async function generateStaffCard(sql, rarity, ctx = null) {
  const blueprints = await sql`
    SELECT id, name, card_type, depicted_user_id, template_data
    FROM cc_card_blueprints
    WHERE card_type = 'staff' AND status = 'approved'
  `
  if (blueprints.length === 0) return generateCard(rarity, ctx)

  const blueprint = ctx ? selectFromPool(ctx, blueprints) : blueprints[Math.floor(Math.random() * blueprints.length)]
  const td = typeof blueprint.template_data === 'string' ? JSON.parse(blueprint.template_data) : blueprint.template_data
  const displayName = td?.cardData?.name
    || td?.elements?.find(el => el.type === 'name-banner')?.playerName
    || blueprint.name
  const holoEffect = rollHoloEffect(rarity)
  const holoType = rollHoloType(rarity)

  return {
    god_id: `blueprint-${blueprint.id}`,
    god_name: displayName,
    god_class: 'staff',
    role: 'staff',
    rarity,
    serial_number: Math.floor(Math.random() * 9999) + 1,
    holo_effect: holoEffect,
    holo_type: holoType,
    image_url: null,
    acquired_via: 'pack',
    card_type: 'staff',
    card_data: {},
    def_id: null,
    blueprint_id: blueprint.id,
    depicted_user_id: blueprint.depicted_user_id || null,
  }
}
```

- [ ] **Step 3: Wire `staff` into `generateCardByType`**

Replace the `generateCardByType` function (lines 376-382) to handle staff (requires `sql` param now):

```javascript
async function generateCardByType(type, rarity, ctx = null, sql = null) {
  switch (type) {
    case 'item': return generateItemCard(rarity, ctx)
    case 'consumable': return generateConsumableCard(rarity, ctx)
    case 'staff': return sql ? generateStaffCard(sql, rarity, ctx) : generateCard(rarity, ctx)
    default: return generateCard(rarity, ctx)
  }
}
```

- [ ] **Step 4: Update `generateConfiguredPack` to pass `sql` and use `typeOdds`**

In `generateConfiguredPack`, update the card generation block (lines 811-824). Replace:

```javascript
    const rarity = rollRarityBounded(slot.minRarity || 'common', slot.maxRarity || null, ctx)
    const type = forcedTypes[i] || pickTypeForSlot(slot)

    let card
    if (type === 'collection') {
      card = await generateCollectionCard(sql, slot.collectionIds || [], rarity)
      if (!card) card = generateCardByType('god', rarity, ctx) // fallback if no collection entries
    } else if (type === 'player') {
      card = divisionIds.length > 0
        ? await generatePlayerCardByDivisions(sql, rarity, divisionIds, ctx)
        : await generatePlayerCard(sql, rarity, pack.league_id, ctx)
    } else {
      card = generateCardByType(type, rarity, ctx)
    }
```

With:

```javascript
    const type = forcedTypes[i] || pickTypeForSlot(slot)
    const typeCtx = getContextForType(ctx, type)
    const rarity = rollRarityBounded(slot.minRarity || 'common', slot.maxRarity || null, typeCtx)

    let card
    if (type === 'collection') {
      card = await generateCollectionCard(sql, slot.collectionIds || [], rarity)
      if (!card) card = await generateCardByType('god', rarity, typeCtx, sql)
    } else if (type === 'player') {
      card = divisionIds.length > 0
        ? await generatePlayerCardByDivisions(sql, rarity, divisionIds, typeCtx)
        : await generatePlayerCard(sql, rarity, pack.league_id, typeCtx)
    } else {
      card = await generateCardByType(type, rarity, typeCtx, sql)
    }
```

Key changes: (1) resolve `type` before `rarity` so we can apply `typeOdds`, (2) use `getContextForType` to get type-specific odds, (3) pass `sql` to `generateCardByType`, (4) await all `generateCardByType` calls since it's now async.

- [ ] **Step 5: Update other callers of `generateCardByType` to await**

There are two other call sites in vault.js that call `generateCardByType`. Both already use it in async contexts, just need `await`:

In `generateMixedPack` (~line 620-627), find:

```javascript
      : generateCardByType(type, rarity, ctx)
```

Replace with:

```javascript
      : await generateCardByType(type, rarity, ctx)
```

In `generateGiftPack` (~line 898-903), find:

```javascript
      : generateCardByType(type, rarity)
```

Replace with:

```javascript
      : await generateCardByType(type, rarity)
```

- [ ] **Step 6: Commit**

```bash
git add functions/lib/vault.js
git commit -m "feat(vault): add generateStaffCard and wire typeOdds into configured packs"
```

---

### Task 3: Add migration for staff-mixed pack type

**Files:**
- Create: `database/migrations/151-staff-pack.sql`

- [ ] **Step 1: Write the migration**

Create `database/migrations/151-staff-pack.sql`:

```sql
-- Staff Pack: 6 cards, 2 guaranteed staff (boosted rarity), 1 player, 2 random, 1 wildcard
INSERT INTO cc_pack_types (id, name, description, cost, cards_per_pack, category, slots, group_constraints, odds_config, enabled, rotation_only, sort_order)
VALUES (
  'staff-mixed',
  'Staff Pack',
  '2 staff cards with boosted rarity, 1 player card, and a wildcard',
  10,
  6,
  'configured',
  '[{"types":["god","item","consumable","player","staff"],"group":"A","minRarity":"common"},{"types":["god","item","consumable","player","staff"],"group":"A","minRarity":"common"},{"types":["god","item","consumable","player","staff"],"group":"A","minRarity":"common"},{"types":["god","item","consumable","player","staff"],"group":"A","minRarity":"common"},{"types":["god","item","consumable","player","staff"],"group":"A","minRarity":"uncommon"},{"types":["god","item","consumable","player","staff"],"group":"W","minRarity":"common"}]'::jsonb,
  '{"A":[{"type":"staff","min":2,"max":2},{"type":"player","min":1,"max":1}]}'::jsonb,
  '{"typeOdds":{"staff":{"rarity":{"common":0.55,"uncommon":0.30,"rare":0.08,"epic":0.05,"legendary":0.01,"mythic":0.004,"unique":0.001}}}}'::jsonb,
  true,
  false,
  10
)
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 2: Run the migration against local dev**

```bash
cd C:/Users/Eric/WebstormProjects/tierlist-maker
# Run via wrangler or direct psql — depends on local setup
```

- [ ] **Step 3: Commit**

```bash
git add database/migrations/151-staff-pack.sql
git commit -m "feat(db): add staff-mixed pack type migration"
```

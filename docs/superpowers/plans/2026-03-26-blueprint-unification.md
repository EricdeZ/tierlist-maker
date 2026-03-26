# Blueprint Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge `cc_card_templates` + `cc_card_drafts` into a unified `cc_card_blueprints` table, eliminate `card_type='collection'` in favor of real card types, and update all backend/frontend code to use the new schema.

**Architecture:** Single database migration creates `cc_card_blueprints`, backfills all data, adds `blueprint_id` to `cc_cards`/`cc_collection_entries`/`cc_promo_gifts`. Backend switches all queries to `cc_card_blueprints`. Frontend renames `templateId` → `blueprintId` and `_templateData` → `_blueprintData` everywhere.

**Tech Stack:** PostgreSQL (Neon), Cloudflare Pages Functions, React 19, Vite 7

**Spec:** `docs/superpowers/specs/2026-03-26-blueprint-unification-design.md`

---

### Task 1: Database Migration

**Files:**
- Create: `database/migrations/148-blueprint-unification.sql`

- [ ] **Step 1: Create the migration file with the cc_card_blueprints table**

```sql
-- 148-blueprint-unification.sql
-- Merge cc_card_templates + cc_card_drafts into cc_card_blueprints

-- 1. Create unified blueprints table
CREATE TABLE cc_card_blueprints (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    card_type TEXT NOT NULL,
    rarity TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    template_data JSONB NOT NULL DEFAULT '{}',
    thumbnail_url TEXT,
    target_player_id INTEGER,
    rejection_reason TEXT,
    depicted_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_by INTEGER REFERENCES users(id),
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    source TEXT NOT NULL,
    legacy_template_id INTEGER,
    legacy_draft_id INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cc_card_blueprints_status ON cc_card_blueprints(status);
CREATE INDEX idx_cc_card_blueprints_created_by ON cc_card_blueprints(created_by);
CREATE INDEX idx_cc_card_blueprints_status_creator ON cc_card_blueprints(status, created_by);

-- 2. Copy templates
INSERT INTO cc_card_blueprints (name, description, card_type, rarity, status, template_data, thumbnail_url, rejection_reason, depicted_user_id, created_by, approved_by, approved_at, source, legacy_template_id, created_at, updated_at)
SELECT name, description, card_type, rarity, status, template_data, thumbnail_url, rejection_reason, depicted_user_id, created_by, approved_by, approved_at, 'template', id, created_at, updated_at
FROM cc_card_templates;

-- 3. Copy drafts
INSERT INTO cc_card_blueprints (name, description, card_type, rarity, status, template_data, thumbnail_url, target_player_id, rejection_reason, depicted_user_id, created_by, approved_by, approved_at, source, legacy_draft_id, created_at, updated_at)
SELECT COALESCE(notes, 'Untitled'), NULL, card_type, rarity, status, template_data, thumbnail_url, target_player_id, rejection_reason, depicted_user_id, created_by, approved_by, approved_at, 'draft', id, created_at, updated_at
FROM cc_card_drafts;

-- 4. Add blueprint_id to cc_collection_entries
ALTER TABLE cc_collection_entries ADD COLUMN blueprint_id INTEGER REFERENCES cc_card_blueprints(id) ON DELETE RESTRICT;

UPDATE cc_collection_entries ce
SET blueprint_id = bp.id
FROM cc_card_blueprints bp
WHERE ce.template_id IS NOT NULL AND bp.legacy_template_id = ce.template_id AND bp.source = 'template';

UPDATE cc_collection_entries ce
SET blueprint_id = bp.id
FROM cc_card_blueprints bp
WHERE ce.draft_id IS NOT NULL AND bp.legacy_draft_id = ce.draft_id AND bp.source = 'draft';

CREATE UNIQUE INDEX idx_cc_collection_entries_blueprint ON cc_collection_entries(collection_id, blueprint_id) WHERE blueprint_id IS NOT NULL;

-- 5. Add blueprint_id to cc_cards
ALTER TABLE cc_cards ADD COLUMN blueprint_id INTEGER REFERENCES cc_card_blueprints(id) ON DELETE SET NULL;

-- Backfill cards that have template_id (template-sourced collection cards)
UPDATE cc_cards c
SET blueprint_id = bp.id
FROM cc_card_blueprints bp
WHERE c.template_id IS NOT NULL AND bp.legacy_template_id = c.template_id AND bp.source = 'template';

-- Backfill draft-sourced collection cards via god_id pattern 'collection-{draft_id}'
-- These cards have template_id=NULL but god_id='collection-{id}' where id is the draft id
UPDATE cc_cards c
SET blueprint_id = bp.id
FROM cc_card_blueprints bp
WHERE c.card_type = 'collection'
  AND c.template_id IS NULL
  AND c.blueprint_id IS NULL
  AND c.god_id LIKE 'collection-%'
  AND bp.legacy_draft_id = CAST(SUBSTRING(c.god_id FROM 'collection-(.+)') AS INTEGER)
  AND bp.source = 'draft';

-- Backfill card_type from blueprint for all collection cards
UPDATE cc_cards c
SET card_type = bp.card_type
FROM cc_card_blueprints bp
WHERE c.card_type = 'collection' AND c.blueprint_id = bp.id;

CREATE INDEX idx_cc_cards_blueprint ON cc_cards(blueprint_id);

-- 6. Add blueprint_id to cc_promo_gifts
ALTER TABLE cc_promo_gifts ADD COLUMN blueprint_id INTEGER REFERENCES cc_card_blueprints(id);

UPDATE cc_promo_gifts pg
SET blueprint_id = bp.id
FROM cc_card_blueprints bp
WHERE pg.template_id IS NOT NULL AND bp.legacy_template_id = pg.template_id AND bp.source = 'template';
```

- [ ] **Step 2: Run the migration**

Run: `psql $DATABASE_URL -f database/migrations/148-blueprint-unification.sql`

Verify with:
```sql
SELECT count(*) FROM cc_card_blueprints;
SELECT count(*) FROM cc_card_templates;
SELECT count(*) FROM cc_card_drafts;
-- blueprints count should equal templates + drafts

SELECT count(*) FROM cc_collection_entries WHERE blueprint_id IS NULL;
-- should be 0

SELECT count(*) FROM cc_cards WHERE card_type = 'collection';
-- should be 0 (all backfilled to real types)

SELECT count(*) FROM cc_cards WHERE blueprint_id IS NOT NULL;
-- should match the old count of cards with template_id + draft-sourced cards
```

- [ ] **Step 3: Update database-schema.md**

Add the `cc_card_blueprints` table definition and note the new `blueprint_id` columns on `cc_cards`, `cc_collection_entries`, and `cc_promo_gifts`.

- [ ] **Step 4: Commit**

```bash
git add database/migrations/148-blueprint-unification.sql database-schema.md
git commit -m "feat(vault): add blueprint unification migration"
```

---

### Task 2: Backend — Core Card Generation (`functions/lib/vault.js`)

**Files:**
- Modify: `functions/lib/vault.js:448-500` (card insertion + first-edition), `functions/lib/vault.js:753-793` (generateCollectionCard)

- [ ] **Step 1: Update `generateCollectionCard` to use blueprints**

Replace the function at lines 753-793:

```javascript
async function generateCollectionCard(sql, collectionId) {
  const entries = await sql`
    SELECT bp.id, bp.name, bp.card_type, bp.depicted_user_id
    FROM cc_collection_entries e
    JOIN cc_card_blueprints bp ON e.blueprint_id = bp.id AND bp.status = 'approved'
    JOIN cc_collections c ON e.collection_id = c.id
    WHERE e.collection_id = ${collectionId}
      AND c.status = 'active'
  `
  if (entries.length === 0) return null

  const blueprint = entries[Math.floor(Math.random() * entries.length)]
  const rarity = rollRarity('common')
  const holoEffect = rollHoloEffect(rarity)
  const holoType = rollHoloType(rarity)

  const [col] = await sql`SELECT name FROM cc_collections WHERE id = ${collectionId}`

  return {
    god_id: `blueprint-${blueprint.id}`,
    god_name: blueprint.name,
    god_class: blueprint.card_type || 'custom',
    role: blueprint.card_type || 'custom',
    rarity,
    serial_number: Math.floor(Math.random() * 9999) + 1,
    holo_effect: holoEffect,
    holo_type: holoType,
    image_url: null,
    acquired_via: 'pack',
    card_type: blueprint.card_type,
    card_data: { collectionId, collectionName: col?.name || 'Collection' },
    def_id: null,
    blueprint_id: blueprint.id,
    depicted_user_id: blueprint.depicted_user_id || null,
  }
}
```

- [ ] **Step 2: Update card insertion to use blueprint_id**

At line 459-461, change the first-edition check:

```javascript
    const checkFE = process.env.VAULT_OPEN === 'true' && (
      (card.card_type === 'player' && !!card.def_id) ||
      (!!card.blueprint_id)
    )
```

At line 468-486, update the INSERT to use `blueprint_id` instead of `template_id`:

```javascript
    const [inserted] = await sql`
      INSERT INTO cc_cards (owner_id, original_owner_id, god_id, god_name, god_class, role, rarity, serial_number, holo_effect, holo_type, image_url, acquired_via, card_type, card_data, def_id, blueprint_id, is_first_edition, depicted_user_id, passive_id)
      SELECT ${userId}, ${userId}, ${card.god_id}, ${card.god_name}, ${card.god_class}, ${card.role}, ${card.rarity},
             ${card.serial_number}, ${card.holo_effect}, ${card.holo_type}, ${card.image_url},
             ${card.acquired_via}, ${card.card_type}, ${card.card_data ? JSON.stringify(card.card_data) : null}::jsonb,
             ${card.def_id || null},
             ${card.blueprint_id || null},
             ${checkFE}::boolean AND NOT EXISTS (
               SELECT 1 FROM cc_cards
               WHERE rarity = ${card.rarity}
                 AND (
                   (${card.blueprint_id || null}::int IS NOT NULL AND blueprint_id = ${card.blueprint_id || 0})
                   OR (${card.blueprint_id || null}::int IS NULL AND def_id = ${card.def_id || 0})
                 )
             ),
             ${card.depicted_user_id || null},
             ${passiveId}
      RETURNING *
    `
```

- [ ] **Step 3: Commit**

```bash
git add functions/lib/vault.js
git commit -m "feat(vault): update card generation to use blueprints"
```

---

### Task 3: Backend — Vault API Endpoints (`functions/api/vault.js`)

**Files:**
- Modify: `functions/api/vault.js:52-72` (inlineTemplateData → inlineBlueprintData), `functions/api/vault.js:306-325` (initial load template cache → blueprint cache), `functions/api/vault.js:878-948` (collection ownership), `functions/api/vault.js:2403-2431` (showcase), `functions/api/vault.js:2622-2655` (binder), `functions/api/vault.js:2792-2908` (promo gifts), `functions/api/vault.js:2911-2949` (formatCard)

- [ ] **Step 1: Update `inlineTemplateData` → `inlineBlueprintData`**

Replace lines 52-72:

```javascript
async function inlineBlueprintData(sql, formattedCards) {
  const bpCards = formattedCards.filter(c => c.blueprintId)
  if (bpCards.length === 0) return
  const bids = [...new Set(bpCards.map(c => c.blueprintId))]
  const blueprints = await sql`
    SELECT id, card_type, template_data FROM cc_card_blueprints WHERE id = ANY(${bids})
  `
  const cache = {}
  for (const bp of blueprints) {
    const td = typeof bp.template_data === 'string' ? JSON.parse(bp.template_data) : bp.template_data
    cache[bp.id] = {
      cardData: td?.cardData || {},
      elements: td?.elements || [],
      border: td?.border || null,
      cardType: bp.card_type || 'custom',
    }
  }
  for (const card of bpCards) {
    if (cache[card.blueprintId]) card._blueprintData = cache[card.blueprintId]
  }
}
```

- [ ] **Step 2: Update all calls from `inlineTemplateData` to `inlineBlueprintData`**

Search for `inlineTemplateData` in the file and replace all calls with `inlineBlueprintData`.

- [ ] **Step 3: Update `formatCard`**

At lines 2911-2949, change `templateId` to `blueprintId`:

```javascript
function formatCard(row) {
  return {
    id: row.id,
    godId: row.god_id,
    godName: row.god_name,
    godClass: row.god_class,
    role: row.role,
    rarity: row.rarity,
    power: row.power,
    level: row.level,
    xp: row.xp,
    serialNumber: row.serial_number,
    holoEffect: row.holo_effect,
    holoType: row.holo_type,
    imageUrl: row.card_type === 'player'
      ? ('player_discord_id' in row
        ? (row.allow_discord_avatar && row.player_discord_id && row.player_discord_avatar
          ? `https://cdn.discordapp.com/avatars/${row.player_discord_id}/${row.player_discord_avatar}.webp?size=256`
          : '')
        : (row.image_url || ''))
      : row.image_url,
    ability: row.ability,
    metadata: row.metadata || {},
    acquiredVia: row.acquired_via,
    acquiredAt: row.created_at,
    cardType: row.card_type || 'god',
    cardData: row.card_data || null,
    defId: row.def_id || null,
    isFirstEdition: row.is_first_edition || false,
    isConnected: row.card_data?.isConnected ?? null,
    bestGodName: row.best_god_name || null,
    bestGodFull: row._bestGodFull || null,
    teamId: row.team_id || row.card_data?.teamId || null,
    defPlayerId: row.def_player_id || null,
    signatureUrl: row.signature_url || null,
    blueprintId: row.blueprint_id || null,
    tradeLocked: row.trade_locked || false,
  }
}
```

- [ ] **Step 4: Update initial vault load — blueprint cache**

Replace lines 306-325 (template cache building):

```javascript
  // Build blueprint cache for blueprint-sourced cards
  const blueprintIds = [...new Set(
    collection.filter(c => c.blueprint_id)
      .map(c => c.blueprint_id)
  )]
  let blueprintCache = {}
  if (blueprintIds.length > 0) {
    const blueprints = await sql`
      SELECT id, card_type, template_data FROM cc_card_blueprints WHERE id = ANY(${blueprintIds})
    `
    for (const bp of blueprints) {
      const td = typeof bp.template_data === 'string' ? JSON.parse(bp.template_data) : bp.template_data
      blueprintCache[bp.id] = {
        cardData: td?.cardData || {},
        elements: td?.elements || [],
        border: td?.border || null,
        cardType: bp.card_type || 'custom',
      }
    }
  }
```

And in the response body at line 331, change `templateCache` to `blueprintCache`.

Also update the SELECT for the collection query to include `blueprint_id` instead of `template_id`. Find the main collection SELECT (should be around line 250-280) and ensure it selects `c.blueprint_id` instead of `c.template_id`.

- [ ] **Step 5: Update binder endpoint**

Replace lines 2627 (`c.template_id`) with `c.blueprint_id` in the SELECT.

Replace lines 2643-2655 (binder template cache):

```javascript
  // Inline blueprint data for blueprint-sourced cards in binder
  const bpBinder = cards.filter(c => c.blueprint_id)
  let binderBlueprintCache = {}
  if (bpBinder.length > 0) {
    const bids = [...new Set(bpBinder.map(c => c.blueprint_id))]
    const blueprints = await sql`
      SELECT id, card_type, template_data FROM cc_card_blueprints WHERE id = ANY(${bids})
    `
    for (const bp of blueprints) {
      const td = typeof bp.template_data === 'string' ? JSON.parse(bp.template_data) : bp.template_data
      binderBlueprintCache[bp.id] = { cardData: td?.cardData || {}, elements: td?.elements || [], border: td?.border || null, cardType: bp.card_type || 'custom' }
    }
  }
```

Update the card formatting loop that uses `binderTemplateCache` — it attaches `_templateData` to cards. Change it to use `binderBlueprintCache` and `_blueprintData`:

```javascript
  if (c.blueprint_id && binderBlueprintCache[c.blueprint_id]) {
    // attach _blueprintData inline
  }
```

- [ ] **Step 6: Update collection ownership endpoint**

Replace `handleCollectionCollections` (lines 878-948):

```javascript
async function handleCollectionCollections(sql, user) {
  const ownedRows = await sql`
    SELECT blueprint_id, array_agg(rarity) AS rarities
    FROM cc_cards
    WHERE owner_id = ${user.id} AND blueprint_id IS NOT NULL
    GROUP BY blueprint_id
  `
  if (ownedRows.length === 0) {
    return { statusCode: 200, headers, body: JSON.stringify({ collections: [], owned: {} }) }
  }

  const ownedBlueprintIds = ownedRows.map(r => r.blueprint_id)

  const collectionIds = await sql`
    SELECT DISTINCT collection_id FROM cc_collection_entries
    WHERE blueprint_id = ANY(${ownedBlueprintIds})
  `
  if (collectionIds.length === 0) {
    return { statusCode: 200, headers, body: JSON.stringify({ collections: [], owned: {} }) }
  }

  const cIds = collectionIds.map(r => r.collection_id)

  const [collections, entries] = await Promise.all([
    sql`
      SELECT id, name, description, cover_image_url
      FROM cc_collections
      WHERE id = ANY(${cIds}) AND status != 'archived'
    `,
    sql`
      SELECT ce.collection_id, ce.blueprint_id,
             bp.name, bp.card_type, bp.template_data
      FROM cc_collection_entries ce
      JOIN cc_card_blueprints bp ON bp.id = ce.blueprint_id
      WHERE ce.collection_id = ANY(${cIds})
      ORDER BY ce.id
    `,
  ])

  const collectionMap = new Map()
  for (const col of collections) {
    collectionMap.set(col.id, {
      id: col.id,
      name: col.name,
      description: col.description,
      coverImageUrl: col.cover_image_url,
      entries: [],
    })
  }

  for (const e of entries) {
    const col = collectionMap.get(e.collection_id)
    if (!col) continue
    col.entries.push({
      blueprintId: e.blueprint_id,
      name: e.name,
      cardType: e.card_type,
      templateData: e.template_data,
    })
  }

  const owned = {}
  for (const r of ownedRows) owned[r.blueprint_id] = r.rarities

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      collections: [...collectionMap.values()].filter(c => c.entries.length > 0),
      owned,
    }),
  }
}
```

- [ ] **Step 7: Update showcase collection endpoint**

Replace `handleShowcaseCollection` (lines 2403-2431):

```javascript
async function handleShowcaseCollection(sql, params) {
  const { slug } = params || {}
  if (!slug) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Slug required' }) }

  const [collection] = await sql`
    SELECT id, name, description, cover_image_url, slug
    FROM cc_collections WHERE slug = ${slug} AND status = 'active'
  `
  if (!collection) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Collection not found' }) }

  const entries = await sql`
    SELECT e.id, e.blueprint_id,
           bp.name AS template_name,
           bp.card_type,
           bp.template_data,
           bp.thumbnail_url
    FROM cc_collection_entries e
    JOIN cc_card_blueprints bp ON e.blueprint_id = bp.id
    WHERE e.collection_id = ${collection.id}
    ORDER BY e.added_at ASC
  `

  return {
    statusCode: 200, headers,
    body: JSON.stringify({ collection, entries }),
  }
}
```

- [ ] **Step 8: Update promo gift endpoints**

In `handleSendPromoGift` (lines 2792-2830):

1. Remove `'collection'` from `validTypes` array (line 2803)
2. Replace the `cardType === 'collection'` branch (lines 2812-2816):

```javascript
  if (body.blueprintId) {
    const [bp] = await sql`SELECT id FROM cc_card_blueprints WHERE id = ${body.blueprintId} AND status = 'approved'`
    if (!bp) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Blueprint not found or not approved' }) }
  }
```

3. In the INSERT (line 2820-2823), change `template_id` to `blueprint_id`:

```javascript
  const [gift] = await sql`
    INSERT INTO cc_promo_gifts (recipient_id, card_type, rarity, blueprint_id, card_config, message, tradeable, created_by)
    VALUES (${recipientId}, ${cardType}, ${rarity}, ${body.blueprintId || null}, ${JSON.stringify(cardConfig)}, ${trimmedMsg}, ${tradeable !== false}, ${user.id})
    RETURNING id
  `
```

In `handleClaimPromoGift` (lines 2833-2908):

1. Change first-edition check (line 2851) from `gift.template_id` to `gift.blueprint_id`:

```javascript
    if (gift.blueprint_id) {
      const [existing] = await tx`
        SELECT 1 FROM cc_cards WHERE blueprint_id = ${gift.blueprint_id} AND rarity = ${gift.rarity} LIMIT 1
      `
      isFirstEdition = !existing
    } else if (gift.card_type === 'player' && config.def_id) {
```

2. Change the INSERT (lines 2869-2884) to use `blueprint_id` instead of `template_id`:

```javascript
    const [c] = await tx`
      INSERT INTO cc_cards (
        owner_id, original_owner_id, god_id, god_name, god_class, role, rarity,
        serial_number, holo_effect, holo_type, image_url, acquired_via, card_type,
        card_data, def_id, blueprint_id, is_first_edition, depicted_user_id, trade_locked, passive_id
      ) VALUES (
        ${user.id}, ${user.id}, ${config.god_id || null}, ${config.god_name || null},
        ${config.god_class || null}, ${config.role || null}, ${gift.rarity},
        ${serialNumber}, ${holoEffect}, ${holoType},
        ${config.image_url || null}, 'gift', ${gift.card_type},
        ${JSON.stringify(config.card_data || {})}, ${config.def_id || null},
        ${gift.blueprint_id || null}, ${isFirstEdition},
        ${config.depicted_user_id || null}, ${!gift.tradeable}, ${passiveId}
      )
      RETURNING *
    `
```

- [ ] **Step 9: Commit**

```bash
git add functions/api/vault.js
git commit -m "feat(vault): update vault API to use blueprints"
```

---

### Task 4: Backend — Vault Dashboard API (`functions/api/vault-dashboard.js`)

**Files:**
- Modify: `functions/api/vault-dashboard.js` (entire file — all CRUD operations switch to `cc_card_blueprints`)

- [ ] **Step 1: Update action routing**

At lines 23-51, consolidate the route table. Replace template/draft actions with unified blueprint actions:

```javascript
// GET
case 'blueprints': return getBlueprints(sql, event, user, canApprove)
case 'blueprint': return getBlueprint(sql, event, user, canApprove)
// Keep 'templates' and 'drafts' as aliases that call getBlueprints with a source filter
case 'templates': return getBlueprints(sql, event, user, canApprove)
case 'drafts': return getBlueprints(sql, event, user, canApprove)
// ...existing: search-users, assets, asset, collections, collection

// POST
case 'save-blueprint': return saveBlueprint(sql, body, user, canApprove)
// Keep old actions as aliases
case 'save-template': return saveBlueprint(sql, body, user, canApprove)
case 'save-draft': return saveBlueprint(sql, body, user, canApprove)
case 'submit-for-review': return submitForReview(sql, body, user)
case 'approve': return approveItem(sql, body, user, canApprove)
case 'reject': return rejectItem(sql, body, user, canApprove)
case 'archive': return archiveBlueprint(sql, body, canApprove)
case 'archive-template': return archiveBlueprint(sql, body, canApprove)
case 'delete-item': return deleteBlueprint(sql, body, user, canApprove)
case 'rename-item': return renameBlueprint(sql, body, user, canApprove)
// ...existing: delete-asset, save-collection, add-collection-entries, etc.
```

- [ ] **Step 2: Replace `getTemplates`/`getDrafts` with unified `getBlueprints`**

Replace lines 64-166:

```javascript
async function getBlueprints(sql, event, user, canApprove) {
    const { status, rarity, card_type, creator } = event.queryStringParameters || {}
    let rows
    if (canApprove) {
        rows = await sql`
            SELECT bp.*, u.discord_username AS creator_name,
                   du.discord_username AS depicted_username, du.discord_avatar AS depicted_avatar,
                   du.discord_id AS depicted_discord_id, dp.name AS depicted_player_name
            FROM cc_card_blueprints bp
            LEFT JOIN users u ON u.id = bp.created_by
            LEFT JOIN users du ON du.id = bp.depicted_user_id
            LEFT JOIN players dp ON dp.id = du.linked_player_id
            WHERE (${status || null}::text IS NULL OR bp.status = ${status})
              AND (${rarity || null}::text IS NULL OR bp.rarity = ${rarity})
              AND (${card_type || null}::text IS NULL OR bp.card_type = ${card_type})
              AND (${creator ? parseInt(creator) : null}::int IS NULL OR bp.created_by = ${creator ? parseInt(creator) : 0})
            ORDER BY bp.updated_at DESC
        `
    } else {
        rows = await sql`
            SELECT bp.*, u.discord_username AS creator_name,
                   du.discord_username AS depicted_username, du.discord_avatar AS depicted_avatar,
                   du.discord_id AS depicted_discord_id, dp.name AS depicted_player_name
            FROM cc_card_blueprints bp
            LEFT JOIN users u ON u.id = bp.created_by
            LEFT JOIN users du ON du.id = bp.depicted_user_id
            LEFT JOIN players dp ON dp.id = du.linked_player_id
            WHERE bp.created_by = ${user.id}
              AND (${status || null}::text IS NULL OR bp.status = ${status})
              AND (${rarity || null}::text IS NULL OR bp.rarity = ${rarity})
              AND (${card_type || null}::text IS NULL OR bp.card_type = ${card_type})
            ORDER BY bp.updated_at DESC
        `
    }
    return ok({ blueprints: rows })
}

async function getBlueprint(sql, event, user, canApprove) {
    const id = parseInt(event.queryStringParameters?.id)
    if (!id) return err('id required')
    const [row] = await sql`
        SELECT bp.*, du.discord_username AS depicted_username, du.discord_avatar AS depicted_avatar,
               du.discord_id AS depicted_discord_id, dp.name AS depicted_player_name
        FROM cc_card_blueprints bp
        LEFT JOIN users du ON du.id = bp.depicted_user_id
        LEFT JOIN players dp ON dp.id = du.linked_player_id
        WHERE bp.id = ${id}
    `
    if (!row) return err('Blueprint not found', 404)
    if (!canApprove && row.created_by !== user.id) return err('Not authorized', 403)
    return ok({ blueprint: row })
}
```

- [ ] **Step 3: Replace `saveTemplate`/`saveDraft` with unified `saveBlueprint`**

Replace lines 213-283:

```javascript
async function saveBlueprint(sql, body, user, canApprove) {
    const { id, name, description, card_type, rarity, template_data, target_player_id, depicted_user_id } = body
    if (!card_type || !rarity || !template_data) return err('card_type, rarity, template_data required')

    let resolvedTargetPlayerId = target_player_id || null
    if (depicted_user_id && !target_player_id) {
        const [depictedUser] = await sql`SELECT linked_player_id FROM users WHERE id = ${depicted_user_id}`
        if (depictedUser?.linked_player_id) resolvedTargetPlayerId = depictedUser.linked_player_id
    }

    if (id) {
        const [existing] = await sql`SELECT * FROM cc_card_blueprints WHERE id = ${id}`
        if (!existing) return err('Blueprint not found', 404)
        if (!canApprove && existing.created_by !== user.id) return err('Not authorized', 403)
        if (!canApprove && existing.status !== 'draft' && existing.status !== 'rejected') return err('Can only edit drafts or rejected blueprints')

        const [row] = await sql`
            UPDATE cc_card_blueprints
            SET name = ${(name || 'Untitled').trim()}, description = ${description || null}, card_type = ${card_type},
                rarity = ${rarity}, template_data = ${JSON.stringify(template_data)},
                target_player_id = ${resolvedTargetPlayerId},
                depicted_user_id = ${depicted_user_id !== undefined ? (depicted_user_id || null) : existing.depicted_user_id},
                status = ${existing.status === 'rejected' ? 'draft' : existing.status},
                rejection_reason = ${existing.status === 'rejected' ? null : existing.rejection_reason},
                updated_at = NOW()
            WHERE id = ${id}
            RETURNING *
        `
        return ok({ blueprint: row })
    } else {
        const [row] = await sql`
            INSERT INTO cc_card_blueprints (name, description, card_type, rarity, template_data, target_player_id, created_by, depicted_user_id, source)
            VALUES (${(name || 'Untitled').trim()}, ${description || null}, ${card_type}, ${rarity}, ${JSON.stringify(template_data)}, ${resolvedTargetPlayerId}, ${user.id}, ${depicted_user_id || null}, 'blueprint')
            RETURNING *
        `
        return ok({ blueprint: row })
    }
}
```

- [ ] **Step 4: Update `submitForReview`, `approveItem`, `rejectItem`**

All three now operate on `cc_card_blueprints` directly — no more dynamic table selection:

```javascript
async function submitForReview(sql, body, user) {
    const { id } = body
    if (!id) return err('id required')

    const [row] = await sql`SELECT * FROM cc_card_blueprints WHERE id = ${id}`
    if (!row) return err('Not found', 404)
    if (row.created_by !== user.id) return err('Not authorized', 403)
    if (row.status !== 'draft' && row.status !== 'rejected') return err('Only drafts or rejected items can be submitted')

    await sql`UPDATE cc_card_blueprints SET status = 'pending_review', rejection_reason = NULL, updated_at = NOW() WHERE id = ${id}`
    return ok({ success: true })
}

async function approveItem(sql, body, user, canApprove) {
    if (!canApprove) return err('Not authorized', 403)
    const { id } = body
    if (!id) return err('id required')

    const [row] = await sql`SELECT * FROM cc_card_blueprints WHERE id = ${id}`
    if (!row) return err('Not found', 404)
    if (row.status !== 'pending_review') return err('Only pending items can be approved')

    // Auto-increment footer counters
    const td = typeof row.template_data === 'string' ? JSON.parse(row.template_data) : row.template_data
    if (td?.elements) {
        let changed = false
        for (const el of td.elements) {
            if (el.type !== 'footer' || !el.rightText) continue
            const label = el.rightText.toUpperCase()
            const pad = el.counterPad ?? 3
            const [counter] = await sql`
                INSERT INTO cc_footer_counters (label, next_serial)
                VALUES (${label}, 2)
                ON CONFLICT (label) DO UPDATE SET next_serial = cc_footer_counters.next_serial + 1
                RETURNING next_serial - 1 AS serial
            `
            el.leftText = `#${String(counter.serial).padStart(pad, '0')}`
            changed = true
        }
        if (changed) {
            await sql`UPDATE cc_card_blueprints SET template_data = ${JSON.stringify(td)}, status = 'approved', approved_by = ${user.id}, approved_at = NOW(), updated_at = NOW() WHERE id = ${id}`
            return ok({ success: true })
        }
    }

    await sql`UPDATE cc_card_blueprints SET status = 'approved', approved_by = ${user.id}, approved_at = NOW(), updated_at = NOW() WHERE id = ${id}`
    return ok({ success: true })
}

async function rejectItem(sql, body, user, canApprove) {
    if (!canApprove) return err('Not authorized', 403)
    const { id, reason } = body
    if (!id) return err('id required')

    const [row] = await sql`SELECT * FROM cc_card_blueprints WHERE id = ${id}`
    if (!row) return err('Not found', 404)
    if (row.status !== 'pending_review') return err('Only pending items can be rejected')

    await sql`UPDATE cc_card_blueprints SET status = 'rejected', rejection_reason = ${reason || null}, updated_at = NOW() WHERE id = ${id}`
    return ok({ success: true })
}
```

- [ ] **Step 5: Update `archiveTemplate`, `deleteItem`, `renameItem`**

```javascript
async function archiveBlueprint(sql, body, canApprove) {
    if (!canApprove) return err('Not authorized', 403)
    const { id } = body
    if (!id) return err('id required')
    await sql`UPDATE cc_card_blueprints SET status = 'archived', updated_at = NOW() WHERE id = ${id}`
    return ok({ success: true })
}

async function deleteBlueprint(sql, body, user, canApprove) {
    const { id } = body
    if (!id) return err('id required')

    const [row] = await sql`SELECT * FROM cc_card_blueprints WHERE id = ${id}`
    if (!row) return err('Not found', 404)
    if (!canApprove && row.created_by !== user.id) return err('Not authorized', 403)

    await sql`DELETE FROM cc_card_blueprints WHERE id = ${id}`
    return ok({ success: true })
}

async function renameBlueprint(sql, body, user, canApprove) {
    const { id, name } = body
    if (!id) return err('id required')
    if (!name?.trim()) return err('name required')

    const [row] = await sql`SELECT * FROM cc_card_blueprints WHERE id = ${id}`
    if (!row) return err('Not found', 404)
    if (!canApprove && row.created_by !== user.id) return err('Not authorized', 403)

    await sql`UPDATE cc_card_blueprints SET name = ${name.trim()}, updated_at = NOW() WHERE id = ${id}`
    return ok({ success: true })
}
```

- [ ] **Step 6: Update `getCollection` entries query**

Replace lines 432-447:

```javascript
    const entries = await sql`
        SELECT e.*, bp.name AS template_name,
               bp.card_type, bp.rarity, bp.thumbnail_url, bp.template_data,
               u.discord_username AS added_by_name
        FROM cc_collection_entries e
        JOIN cc_card_blueprints bp ON e.blueprint_id = bp.id
        LEFT JOIN users u ON e.added_by = u.id
        WHERE e.collection_id = ${id}
        ORDER BY e.added_at DESC
    `
```

- [ ] **Step 7: Update `addCollectionEntries`**

Replace lines 476-509:

```javascript
async function addCollectionEntries(sql, body, user, canApprove) {
    if (!canApprove) return err('Requires vault_approve', 403)
    const { collection_id, blueprint_ids } = body
    if (!collection_id || !blueprint_ids?.length) return err('Missing collection_id or blueprint_ids')
    let added = 0
    const approved = await sql`
        SELECT id FROM cc_card_blueprints WHERE id = ANY(${blueprint_ids}) AND status = 'approved'
    `
    for (const { id } of approved) {
        await sql`
            INSERT INTO cc_collection_entries (collection_id, blueprint_id, added_by)
            VALUES (${collection_id}, ${id}, ${user.id})
            ON CONFLICT DO NOTHING
        `
        added++
    }
    if (added === 0) return err('No approved blueprints found')
    return ok({ added })
}
```

- [ ] **Step 8: Update `getAsset` usage counting**

Find the asset usage query (around line 200-208) and change both template/draft counts to a single blueprint count:

```javascript
    const [usage] = await sql`
        SELECT COUNT(*) AS count FROM cc_card_blueprints
        WHERE template_data::text LIKE ${'%' + assetId + '%'}
    `
```

- [ ] **Step 9: Commit**

```bash
git add functions/api/vault-dashboard.js
git commit -m "feat(vault): update vault dashboard API to use blueprints"
```

---

### Task 5: Backend — Upload API (`functions/api/vault-dashboard-upload.js`)

**Files:**
- Modify: `functions/api/vault-dashboard-upload.js:101-102`

- [ ] **Step 1: Update thumbnail upload to use cc_card_blueprints**

Replace lines 101-102:

```javascript
    await sql`UPDATE cc_card_blueprints SET thumbnail_url = ${publicUrl}, updated_at = NOW() WHERE id = ${id}`
```

Remove the dynamic table selection (`const table = type === 'template' ? ...`).

- [ ] **Step 2: Commit**

```bash
git add functions/api/vault-dashboard-upload.js
git commit -m "feat(vault): update upload API to use blueprints"
```

---

### Task 6: Frontend — Service Layer (`src/services/database.js`)

**Files:**
- Modify: `src/services/database.js:1507-1573` (vaultDashboardService)

- [ ] **Step 1: Update vaultDashboardService**

Replace the templates/drafts section (lines 1507-1573). Keep old methods as aliases for backwards compatibility during rollout:

```javascript
export const vaultDashboardService = {
    // Blueprints (unified)
    async getBlueprints(params = {}) { return apiCall('vault-dashboard', { action: 'blueprints', ...params }) },
    async getBlueprint(id) { return apiCall('vault-dashboard', { action: 'blueprint', id }) },
    async saveBlueprint(data) { return apiPost('vault-dashboard', { action: 'save-blueprint' }, data) },

    // Aliases for backwards compatibility
    async getTemplates(params = {}) { return this.getBlueprints(params) },
    async getDrafts(params = {}) { return this.getBlueprints(params) },
    async saveTemplate(data) { return this.saveBlueprint(data) },
    async saveDraft(data) { return this.saveBlueprint(data) },

    async searchUsers(q) { return apiCall('vault-dashboard', { action: 'search-users', q }) },

    // Review workflow
    async submitForReview(id) { return apiPost('vault-dashboard', { action: 'submit-for-review' }, { id }) },
    async approve(id) { return apiPost('vault-dashboard', { action: 'approve' }, { id }) },
    async reject(id, reason) { return apiPost('vault-dashboard', { action: 'reject' }, { id, reason }) },
    async archiveBlueprint(id) { return apiPost('vault-dashboard', { action: 'archive' }, { id }) },
    async deleteBlueprint(id) { return apiPost('vault-dashboard', { action: 'delete-item' }, { id }) },
    async renameBlueprint(id, name) { return apiPost('vault-dashboard', { action: 'rename-item' }, { id, name }) },

    // Assets (unchanged)
    async getAssets(params = {}) { return apiCall('vault-dashboard', { action: 'assets', ...params }) },
    async getAsset(id) { return apiCall('vault-dashboard', { action: 'asset', id }) },
    async deleteAsset(id) { return apiPost('vault-dashboard', { action: 'delete-asset' }, { id }) },

    // Collections
    async getCollections() { return apiCall('vault-dashboard', { action: 'collections' }) },
    async getCollection(id) { return apiCall('vault-dashboard', { action: 'collection', id }) },
    async saveCollection(data) { return apiPost('vault-dashboard', { action: 'save-collection' }, data) },
    async addCollectionEntries(collectionId, blueprintIds) {
        return apiPost('vault-dashboard', { action: 'add-collection-entries' }, { collection_id: collectionId, blueprint_ids: blueprintIds })
    },
    async removeCollectionEntry(id) { return apiPost('vault-dashboard', { action: 'remove-collection-entry' }, { id }) },
    async setCollectionStatus(id, status) { return apiPost('vault-dashboard', { action: 'collection-status' }, { id, status }) },

    // Uploads (unchanged)
    async uploadAsset(file, { name, category, tags }) {
        const form = new FormData()
        form.append('file', file)
        form.append('name', name || file.name)
        form.append('category', category || 'background')
        if (tags) form.append('tags', tags.join(','))
        const token = localStorage.getItem('auth_token')
        const res = await fetch('/api/vault-dashboard-upload?action=upload-asset', {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: form,
        })
        return res.json()
    },

    async exportThumbnail(file, id) {
        const form = new FormData()
        form.append('file', file)
        const token = localStorage.getItem('auth_token')
        const res = await fetch(`/api/vault-dashboard-upload?action=export-thumbnail&id=${id}`, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: form,
        })
        return res.json()
    },

    async sendPromoGift(data) {
        return apiPost('vault', { action: 'send-promo-gift' }, data)
    },
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/database.js
git commit -m "feat(vault): update service layer for blueprints"
```

---

### Task 7: Frontend — VaultContext + VaultCard (`src/pages/vault/VaultContext.jsx`, `src/pages/vault/components/VaultCard.jsx`)

**Files:**
- Modify: `src/pages/vault/VaultContext.jsx:30,79,128-130,208-209,481,499`
- Modify: `src/pages/vault/components/VaultCard.jsx:36-114`

- [ ] **Step 1: Update VaultContext — rename template cache to blueprint cache**

At line 30: `const [blueprintCache, setBlueprintCache] = useState({})`

At line 79: `setBlueprintCache(ccData.blueprintCache || {})`

At lines 128-130:
```javascript
  const getBlueprint = useCallback((blueprintId) => {
    return blueprintCache[blueprintId] || null
  }, [blueprintCache])
```

At lines 208-209:
```javascript
      if (card._blueprintData && card.blueprintId) {
        newBlueprints[card.blueprintId] = card._blueprintData
      }
```

At lines 481,499: Replace `templateCache, getTemplate` with `blueprintCache, getBlueprint` in the context value.

- [ ] **Step 2: Update VaultCard — rename props**

Replace line 36-38:

```javascript
export default function VaultCard({ card, getBlueprint, size, holo }) {
    const bid = card.blueprintId || card.blueprint_id
    const blueprint = card._blueprintData || getBlueprint?.(bid)
```

Replace all references to `template` variable with `blueprint` throughout the function (lines 40-113):
- `template?.elements` → `blueprint?.elements`
- `template?.cardData` → `blueprint?.cardData`
- `template.elements` → `blueprint.elements`
- `template.border` → `blueprint.border`
- `template.cardData` → `blueprint.cardData`
- `template.cardType` → `blueprint.cardType`

- [ ] **Step 3: Update all `useVault()` destructuring across vault components**

Every file that does `const { getTemplate } = useVault()` needs to change to `const { getBlueprint } = useVault()`. This affects:
- CCBinder.jsx (lines 512, 644)
- CCMarketplace.jsx (line 56)
- CCStartingFive.jsx
- CCSignatureRequests.jsx (lines 13, 51)
- CCSignatureApprovals.jsx
- Tradematch: CardPicker.jsx (line 58), MatchSplash.jsx (line 25), Negotiation.jsx, Swiper.jsx (line 592), MatchesAndLikes.jsx
- TradePileManager.jsx

- [ ] **Step 4: Commit**

```bash
git add src/pages/vault/VaultContext.jsx src/pages/vault/components/VaultCard.jsx
git commit -m "feat(vault): rename VaultCard and VaultContext to use blueprints"
```

---

### Task 8: Frontend — Main Vault Pages

**Files:**
- Modify: `src/pages/vault/CCBinder.jsx`
- Modify: `src/pages/vault/CCMarketplace.jsx`
- Modify: `src/pages/vault/CCDismantle.jsx`
- Modify: `src/pages/vault/CCStartingFive.jsx`
- Modify: `src/pages/vault/CCSignatureRequests.jsx`
- Modify: `src/pages/vault/CCSignatureApprovals.jsx`
- Modify: `src/pages/vault/BinderSharePage.jsx`
- Modify: `src/pages/vault/CollectionShowcasePage.jsx`
- Modify: `src/pages/vault/CCUniqueCards.jsx`

- [ ] **Step 1: Update CCBinder.jsx**

Line 512: `const { getBlueprint } = useVault()`
Line 520: no change needed (filters by cardType which is now real)
Line 588: `const isCollection = !!card.blueprintId`
Line 596-597: `<VaultCard card={card} getBlueprint={getBlueprint} size={130} holo={false} />`
Line 644: `const { getBlueprint } = useVault()`
Line 645: `if (card.blueprintId) {`
Line 646: `return <VaultCard card={card} getBlueprint={getBlueprint} holo={false} />`

- [ ] **Step 2: Update CCMarketplace.jsx**

Line 56: `const { getDefOverride, getBlueprint } = useVault()`
Line 58: `if (card.blueprintId) {`
Line 59: `return <VaultCard card={card} getBlueprint={getBlueprint} size={size} holo={false} />`

- [ ] **Step 3: Update CCDismantle.jsx**

Find all `card.templateId` references and replace with `card.blueprintId`.
Find all `getTemplate` references and replace with `getBlueprint`.

- [ ] **Step 4: Update CCStartingFive.jsx**

Line 988: `collectionCard={zoomedCard.blueprintId ? zoomedCard : undefined}`
Line 990: `gameCard={getCardType(zoomedCard) !== 'player' && !zoomedCard.blueprintId ? {...} : undefined}`
Lines 1504-1505: `{card.blueprintId ? (<VaultCard card={card} getBlueprint={getBlueprint} size={size} holo />) : ...`
Lines 1596-1597: same pattern

- [ ] **Step 5: Update CCSignatureRequests.jsx**

Line 13: `const { getBlueprint } = useVault()`
Line 14: `if (req.blueprintId) {`
Line 15: `return <VaultCard card={req} getBlueprint={getBlueprint} size={size} holo />`
Line 51: `const { getBlueprint } = useVault()`
Line 52: `if (req.blueprintId) {`
Line 53: `return <VaultCard card={req} getBlueprint={getBlueprint} holo={false} />`

- [ ] **Step 6: Update CCSignatureApprovals.jsx**

Line 89: `{req.blueprintId ? (`
Line 90: `<VaultCard card={req} getBlueprint={getBlueprint} size={200} holo />`

- [ ] **Step 7: Update BinderSharePage.jsx**

Line 77: `if (card.blueprintId && card._blueprintData) {`
Line 78: `return <VaultCard card={card} holo={false} />`

- [ ] **Step 8: Update CollectionShowcasePage.jsx**

In `buildFakeCard` (lines 145-158):

```javascript
function buildFakeCard(entry, rarity) {
    const td = typeof entry.template_data === 'string' ? JSON.parse(entry.template_data) : entry.template_data
    return {
        rarity,
        blueprintId: entry.blueprint_id,
        cardType: entry.card_type || 'custom',
        _blueprintData: td ? {
            elements: td.elements,
            border: td.border,
            cardData: td.cardData,
            cardType: entry.card_type || 'custom',
        } : null,
    }
}
```

Line 167: `<span className="text-[10px] text-white/30 uppercase tracking-wider">{entry.card_type}</span>`
Line 178: `<VaultCard card={card} size={CARD_SIZE} />` (no change needed, VaultCard reads `_blueprintData`)

- [ ] **Step 9: Update CCUniqueCards.jsx**

Find all `templateId` references and replace with `blueprintId`.
Find all `getTemplate` references and replace with `getBlueprint`.

- [ ] **Step 10: Commit**

```bash
git add src/pages/vault/CCBinder.jsx src/pages/vault/CCMarketplace.jsx src/pages/vault/CCDismantle.jsx src/pages/vault/CCStartingFive.jsx src/pages/vault/CCSignatureRequests.jsx src/pages/vault/CCSignatureApprovals.jsx src/pages/vault/BinderSharePage.jsx src/pages/vault/CollectionShowcasePage.jsx src/pages/vault/CCUniqueCards.jsx
git commit -m "feat(vault): update main vault pages to use blueprints"
```

---

### Task 9: Frontend — Tradematch Components

**Files:**
- Modify: `src/pages/vault/tradematch/CardPicker.jsx`
- Modify: `src/pages/vault/tradematch/MatchSplash.jsx`
- Modify: `src/pages/vault/tradematch/Negotiation.jsx`
- Modify: `src/pages/vault/tradematch/Swiper.jsx`
- Modify: `src/pages/vault/tradematch/MatchesAndLikes.jsx`
- Modify: `src/pages/vault/tradematch/TradePileManager.jsx`

All tradematch components use snake_case from the API. The pattern is the same in each:

- [ ] **Step 1: Update CardPicker.jsx**

Line 58: `const { getDefOverride, getBlueprint } = useVault()`
Line 61: `const isCollection = !!card.blueprint_id || !!cd._blueprintData`
Line 70: `card={{ ...card, cardType: card.card_type, blueprintId: card.blueprint_id, _blueprintData: cd._blueprintData }}`
Line 71: `getBlueprint={getBlueprint}`

- [ ] **Step 2: Update MatchSplash.jsx**

Line 25: `const { getDefOverride, getBlueprint } = useVault()`
Line 27: `const isCollection = !!card.blueprint_id`
Line 36: `card={{ ...card, cardType: card.card_type, blueprintId: card.blueprint_id, _blueprintData: (card.card_data || {})._blueprintData }}`
Line 37: `getBlueprint={getBlueprint}`

- [ ] **Step 3: Update Negotiation.jsx**

Line 44: `const isCollection = !!card.blueprint_id || !!cd._blueprintData`
Line 54: `card={{ ...card, cardType: card.card_type, blueprintId: card.blueprint_id, _blueprintData: cd._blueprintData }}`
Replace `getTemplate={getTemplate}` with `getBlueprint={getBlueprint}`

- [ ] **Step 4: Update Swiper.jsx**

Line 592: `const { getDefOverride, getBlueprint } = useVault()`
Line 600: `if (card.blueprint_id || cd._blueprintData) {`
Line 603: `card={{ ...card, cardType: card.card_type, blueprintId: card.blueprint_id, _blueprintData: cd._blueprintData }}`
Line 604: `getBlueprint={getBlueprint}`

- [ ] **Step 5: Update MatchesAndLikes.jsx**

Line 79: `const isCollection = !!card.blueprint_id || !!cd._blueprintData`
Line 89: `card={{ ...card, cardType: card.card_type, blueprintId: card.blueprint_id, _blueprintData: cd._blueprintData }}`
Replace `getTemplate={getTemplate}` with `getBlueprint={getBlueprint}`

- [ ] **Step 6: Update TradePileManager.jsx**

Line 300: `(card.blueprintId || card.cardData?._blueprintData) ? (`
Line 301: `<VaultCard card={card} getBlueprint={getBlueprint} size={CARD_SIZE} holo={false} />`

- [ ] **Step 7: Commit**

```bash
git add src/pages/vault/tradematch/CardPicker.jsx src/pages/vault/tradematch/MatchSplash.jsx src/pages/vault/tradematch/Negotiation.jsx src/pages/vault/tradematch/Swiper.jsx src/pages/vault/tradematch/MatchesAndLikes.jsx src/pages/vault/tradematch/TradePileManager.jsx
git commit -m "feat(vault): update tradematch components to use blueprints"
```

---

### Task 10: Frontend — Vault Dashboard Pages

**Files:**
- Modify: `src/pages/vault-dashboard/CardCreator.jsx`
- Modify: `src/pages/vault-dashboard/TemplatesPage.jsx`
- Modify: `src/pages/vault-dashboard/CollectionsPage.jsx`
- Modify: `src/pages/vault-dashboard/CollectionShowcase.jsx`

- [ ] **Step 1: Update CardCreator.jsx — single save flow**

Replace the `handleSave` function (lines 413-451). Remove the `type` parameter — it's always a blueprint now:

```javascript
    const handleSave = useCallback(async () => {
        setSaving(true)
        setError(null)
        try {
            const cleanElements = elements.map(({ _pendingFile, ...el }) => {
                if (el.type === 'image' && el.url?.startsWith('blob:') && !el.assetId) {
                    return { ...el, url: null }
                }
                return el
            })
            const templateData = { elements: cleanElements, border, cardData }
            const payload = {
                name: name || 'Untitled',
                card_type: cardType,
                rarity,
                template_data: templateData,
                depicted_user_id: depictedUser?.id || null,
            }
            if (saveTarget?.id) payload.id = saveTarget.id
            const res = await vaultDashboardService.saveBlueprint(payload)
            setSaveTarget({ id: res.blueprint?.id })
            setStatus(res.blueprint?.status || 'draft')
            setDirty(false)
        } catch (e) {
            console.error('Save failed:', e)
            setError(e.message)
        } finally {
            setSaving(false)
        }
    }, [name, cardType, rarity, elements, border, saveTarget, depictedUser])
```

Update `handleSubmit` (line 453-457):
```javascript
    const handleSubmit = useCallback(async () => {
        if (!saveTarget) return
        await vaultDashboardService.submitForReview(saveTarget.id)
        setStatus('pending_review')
    }, [saveTarget])
```

Replace the two save buttons (lines 516-521) with a single one:
```jsx
<button onClick={handleSave} disabled={saving}
  className="...">
  {saving ? 'Saving...' : 'Save Blueprint'}
</button>
```

Update line 93 — `saveTarget` no longer needs `type`:
```javascript
const draft = { name, cardType, rarity, elements, border, saveTarget, status, cardData, depictedUser }
```

- [ ] **Step 2: Update TemplatesPage.jsx — unified blueprint list**

Rename component or keep name. Update the fetch:

```javascript
    const fetchBlueprints = useCallback(async () => {
        setLoading(true)
        try {
            const params = {}
            if (filterStatus) params.status = filterStatus
            if (filterRarity) params.rarity = filterRarity
            if (filterType) params.card_type = filterType
            const data = await vaultDashboardService.getBlueprints(params)
            setTemplates(data.blueprints || [])
        } catch (err) {
            console.error('Failed to load blueprints:', err)
        } finally {
            setLoading(false)
        }
    }, [filterStatus, filterRarity, filterType])
```

Update action handlers that call `deleteItem`, `renameItem`, `archiveTemplate` to use the new methods:
- `vaultDashboardService.deleteBlueprint(id)`
- `vaultDashboardService.renameBlueprint(id, name)`
- `vaultDashboardService.archiveBlueprint(id)`
- `vaultDashboardService.approve(id)`
- `vaultDashboardService.reject(id, reason)`
- `vaultDashboardService.submitForReview(id)`

Note: these no longer need a `type` parameter.

- [ ] **Step 3: Update CollectionsPage.jsx — unified browser**

Replace `handleAddEntries` (lines 211-220):

```javascript
    const handleAddEntries = async (selectedItems) => {
        if (!collection.id) return
        try {
            const blueprintIds = selectedItems.map(i => i.id)
            await vaultDashboardService.addCollectionEntries(collection.id, blueprintIds)
            const data = await vaultDashboardService.getCollection(collection.id)
            setEntries(data.entries || [])
        } catch (err) {
            console.error('Add failed:', err)
        }
    }
```

Update `TemplateBrowser` (lines 417-460) — no more template/draft distinction:

```javascript
function TemplateBrowser({ existingEntries, onAdd, onClose }) {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)
    const [selected, setSelected] = useState(new Map())
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState('')

    useEffect(() => {
        vaultDashboardService.getBlueprints({ status: 'approved' }).then(data => {
            setItems(data.blueprints || [])
            setLoading(false)
        }).catch(() => setLoading(false))
    }, [])

    const existingKeys = useMemo(() =>
        new Set(existingEntries.map(e => e.blueprint_id)),
        [existingEntries]
    )

    const filtered = useMemo(() => {
        let list = items.filter(i => !existingKeys.has(i.id))
        if (search.trim()) {
            const q = search.toLowerCase()
            list = list.filter(i => i.name?.toLowerCase().includes(q))
        }
        if (typeFilter) list = list.filter(i => i.card_type === typeFilter)
        return list
    }, [items, existingKeys, search, typeFilter])

    const toggleSelect = (item) => {
        setSelected(prev => {
            const next = new Map(prev)
            next.has(item.id) ? next.delete(item.id) : next.set(item.id, { id: item.id })
            return next
        })
    }
```

Update the existing entries mapping (line 408):
```javascript
existingEntries={entries}
```

Remove the "draft" badge (line 535) — no more `_type === 'draft'` distinction.

Remove the `sourceFilter` state and filter UI.

The `onAdd` callback now receives items with just `{ id }` instead of `{ id, type }`.

- [ ] **Step 4: Update CollectionShowcase.jsx**

Line 56: `const blueprintId = entry.blueprint_id`

Remove lines 63-65 (draft badge).

Line 76: `blueprintId: entry.blueprint_id,`

Replace `_templateData` with `_blueprintData`:
```javascript
<VaultCard
    card={{
        rarity,
        cardType: entry.card_type || 'custom',
        blueprintId: entry.blueprint_id,
        _blueprintData: {
            elements: td.elements,
            border: td.border,
            cardData: td.cardData,
            cardType: entry.card_type || 'custom',
        },
    }}
    size={CARD_SIZE}
/>
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/vault-dashboard/CardCreator.jsx src/pages/vault-dashboard/TemplatesPage.jsx src/pages/vault-dashboard/CollectionsPage.jsx src/pages/vault-dashboard/CollectionShowcase.jsx
git commit -m "feat(vault): update vault dashboard pages for blueprints"
```

---

### Task 11: Frontend — Promo Gift Admin

**Files:**
- Modify: `src/pages/admin/vault/CCAdminPromoGift.jsx`

- [ ] **Step 1: Update CARD_TYPES — remove 'collection' option**

Replace lines 7-13. The concept of "From Collection" as a card type goes away. Instead, the promo gift form should let the user pick a blueprint directly (regardless of type):

```javascript
const CARD_TYPES = [
  { value: 'god', label: 'God' },
  { value: 'item', label: 'Item' },
  { value: 'player', label: 'Player' },
  { value: 'staff', label: 'Staff' },
  { value: 'custom', label: 'Custom' },
  { value: 'blueprint', label: 'From Blueprint' },
]
```

- [ ] **Step 2: Update the collection/blueprint branch logic**

Rename state: `selectedCollectionId` → stays (still selecting from collections), but the data flow changes.

Line 120: `if (cardType !== 'blueprint') return` (was `'collection'`)
Lines 179-186: Update the blueprint branch:

```javascript
    if (cardType === 'blueprint') {
      if (!selectedEntry) { setError('Select a blueprint from the collection'); setSending(false); return }
      sendCardType = selectedEntry.card_type || 'custom'
      blueprintId = selectedEntry.blueprint_id
      cardConfig.god_id = `blueprint-${blueprintId}`
      cardConfig.god_name = selectedEntry.template_name
      cardConfig.god_class = selectedEntry.card_type
      cardConfig.role = selectedEntry.card_type || 'custom'
    }
```

Update the API call to send `blueprintId` instead of `templateId`:
```javascript
await vaultDashboardService.sendPromoGift({
  recipientId, cardType: sendCardType, rarity, blueprintId, cardConfig, message, tradeable,
})
```

Line 222: `cardType === 'blueprint' ? !!selectedEntry : !!godName`
Line 311: `{cardType === 'blueprint' ? (...) : (...)}`

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/vault/CCAdminPromoGift.jsx
git commit -m "feat(vault): update promo gift admin for blueprints"
```

---

### Task 12: Frontend — Remaining References + Cleanup

**Files:**
- Modify: `src/pages/vault/CCCollection.jsx` (verify COLLECTION_TYPES still works)
- Modify: `src/pages/vault/components/PackOpening.jsx` (check for templateId references)
- Modify: `src/pages/vault/bounty/BountyGrid.jsx` (remove 'collection' from filters if present)
- Modify: `src/pages/vault/bounty/CreateBountyForm.jsx` (verify no 'collection' type)
- Modify: `src/data/vault/economy.js` (remove 'collection' from any type lists)
- Modify: `functions/lib/vault-defs.js` (check for template_id references)

- [ ] **Step 1: Verify CCCollection.jsx**

`COLLECTION_TYPES = ['god', 'item', 'consumable']` — no change needed. Blueprint-sourced cards now have their real type, so staff cards with `card_type='staff'` still won't appear here (which is correct).

- [ ] **Step 2: Check PackOpening.jsx for template references**

Search for `templateId`, `template_id`, `_templateData` in PackOpening.jsx. If found, rename to `blueprintId`, `blueprint_id`, `_blueprintData`.

- [ ] **Step 3: Check vault-defs.js**

Search for `template_id` references. If found, rename to `blueprint_id`.

- [ ] **Step 4: Grep the entire codebase for remaining references**

```bash
grep -rn "templateId\|template_id\|_templateData\|getTemplate\|templateCache\|card_type.*collection\|cardType.*collection" src/pages/vault/ functions/api/vault*.js functions/lib/vault*.js --include="*.js" --include="*.jsx"
```

Fix any remaining occurrences.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(vault): final cleanup of template/collection references"
```

---

### Task 13: Smoke Test

- [ ] **Step 1: Start dev server**

Run: `npm start`

- [ ] **Step 2: Test vault studio**

1. Open Vault Dashboard → Blueprints list loads (was Templates page)
2. Create a new blueprint → saves successfully
3. Submit for review → status updates
4. Approve → status updates

- [ ] **Step 3: Test collections**

1. Open Collections page
2. Add blueprints to a collection (browser shows unified list, no template/draft distinction)
3. Activate collection

- [ ] **Step 4: Test pack opening**

1. Open a pack that has a collection slot
2. Verify the card comes out with its real card_type (e.g., 'staff'), not 'collection'
3. Verify the card renders correctly via VaultCard

- [ ] **Step 5: Test card display everywhere**

1. Check binder — blueprint cards render
2. Check marketplace — blueprint cards show correctly
3. Check tradematch — cards display properly
4. Check signatures — blueprint card preview works
5. Check collection showcase page — entries display
6. Check Starting Five — blueprint cards work in lineup

- [ ] **Step 6: Test promo gifts**

1. Send a "From Blueprint" gift
2. Claim it → card renders correctly with real card_type

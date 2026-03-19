# Vault Collections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a collections system that bridges approved studio card designs into packs, with full rendering support across all vault UI locations.

**Architecture:** Collections are DB-backed groupings of approved templates. Packs gain a `collection` slot type. Collection cards store `template_id` + rolled rarity in `cc_cards`. Frontend renders via StructuredCard with template data cached in VaultContext, wrapped in error boundaries for crash safety.

**Tech Stack:** React 19, Cloudflare Pages Functions, PostgreSQL/Neon, existing StructuredCard + GameCard.css rendering

**Spec:** `docs/superpowers/specs/2026-03-18-vault-collections-design.md`

---

## File Structure

### New Files
- `database/migrations/123-collections.sql` — cc_collections + cc_collection_entries tables
- `src/pages/vault/components/VaultCard.jsx` — unified card renderer (collection branch + error boundary)
- `src/pages/vault/components/EmptyCardSlot.jsx` — defensive placeholder for missing template data
- `src/pages/vault-dashboard/CollectionsPage.jsx` — admin collection manager (list + editor)

### Modified Files
- `functions/api/vault-dashboard.js` — add collection CRUD actions
- `functions/lib/vault.js:421-464` — modify `openPack` INSERT + first-edition check + add `generateCollectionCard`
- `functions/lib/vault.js:588+` — modify `generateConfiguredPack` to handle collection slot type
- `functions/api/vault.js:2173-2207` — add `templateId` to `formatCard`
- `functions/api/vault.js:115-241` — modify `handleLoad` to include `templateCache`
- `functions/api/vault.js:320-345` — modify `handleOpenPack` to inline template data on collection cards
- `functions/api/vault.js:245-273` — modify `handleOpenInventoryPack` to inline template data
- `functions/api/vault.js:350-425` — modify `handleSalePurchase` to inline template data
- `functions/api/vault.js:2028-2055` — modify `handleBinderView` to add `c.template_id` to SELECT + inline template data
- `src/pages/vault/VaultContext.jsx:68-95` — add `templateCache` state + `getTemplate()` helper
- `src/pages/vault/components/PackOpening.jsx:72-99` — use VaultCard for collection cards
- `src/pages/vault/components/CardZoomModal.jsx` — add collection card branch
- `src/pages/vault/CCCollection.jsx` — handle collection card type in grid
- `src/pages/vault/CCCardCatalog.jsx` — handle collection card type
- `src/pages/vault/CCStartingFive.jsx` — handle collection cards in slots
- `src/pages/vault/CCBinder.jsx` — handle collection cards in binder
- `src/pages/vault/CCDismantle.jsx` — handle collection cards in dismantle grid
- `src/pages/vault/CCTrading.jsx` — handle collection cards in trade offers
- `src/pages/vault/CCMarketplace.jsx` — handle collection cards in listings
- `src/pages/vault/CCBlackMarket.jsx` — handle collection cards
- `src/pages/vault/CCBountyBoard.jsx` — handle collection cards in bounty listings
- `src/pages/vault/CCSignatureRequests.jsx` — handle collection cards in signature display
- `src/pages/vault/BinderSharePage.jsx` — handle collection cards with inline template data
- `src/pages/admin/PackCreator.jsx:5,13,15-148` — add `collection` slot type + collection picker
- `src/components/layout/VaultDashboardNavbar.jsx:9-14` — add Collections tab
- `src/App.jsx:213-214` — add collections route
- `src/services/database.js` — add collection management service methods

**Not modified (known limitation):** `CardSharePage.jsx` — currently player-card only (JWT contains `playerSlug`). Collection card sharing would need a new share mechanism. Out of scope for this plan.

---

## Task 1: Database Migration

**Files:**
- Create: `database/migrations/123-collections.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Collections: curated groups of approved templates for pack distribution
CREATE TABLE cc_collections (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    cover_image_url TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_cc_collections_status ON cc_collections(status);

CREATE TABLE cc_collection_entries (
    id SERIAL PRIMARY KEY,
    collection_id INTEGER NOT NULL REFERENCES cc_collections(id) ON DELETE CASCADE,
    template_id INTEGER NOT NULL REFERENCES cc_card_templates(id) ON DELETE RESTRICT,
    added_by INTEGER REFERENCES users(id),
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(collection_id, template_id)
);
CREATE INDEX idx_cc_collection_entries_collection ON cc_collection_entries(collection_id);
```

- [ ] **Step 2: Run migration against local DB**

Run: `psql $DATABASE_URL -f database/migrations/123-collections.sql`
Expected: CREATE TABLE, CREATE INDEX (x3) — no errors

- [ ] **Step 3: Commit**

```bash
git add database/migrations/123-collections.sql
git commit -m "feat(vault): add cc_collections and cc_collection_entries tables"
```

---

## Task 2: Collection CRUD API

**Files:**
- Modify: `functions/api/vault-dashboard.js:21-47` (add GET/POST actions)
- Modify: `src/services/database.js` (add collection service methods to `vaultDashboardService`)

- [ ] **Step 1: Add GET actions to vault-dashboard.js**

In the GET switch block (`functions/api/vault-dashboard.js:22-30`), add cases:

```javascript
case 'collections': return getCollections(sql, user, canApprove)
case 'collection': return getCollection(sql, event, user, canApprove)
```

Implement at the bottom of the file:

```javascript
// ─── Collection Handlers ───

async function getCollections(sql, user, canApprove) {
    const rows = await sql`
        SELECT c.*, u.discord_username AS creator_name,
               COUNT(e.id)::int AS entry_count
        FROM cc_collections c
        LEFT JOIN users u ON c.created_by = u.id
        LEFT JOIN cc_collection_entries e ON e.collection_id = c.id
        GROUP BY c.id, u.discord_username
        ORDER BY c.updated_at DESC
    `
    return ok({ collections: rows })
}

async function getCollection(sql, event, user, canApprove) {
    const { id } = event.queryStringParameters || {}
    if (!id) return err('Missing id')
    const [collection] = await sql`SELECT * FROM cc_collections WHERE id = ${id}`
    if (!collection) return err('Not found', 404)
    const entries = await sql`
        SELECT e.*, t.name AS template_name, t.card_type, t.rarity, t.thumbnail_url,
               t.template_data, u.discord_username AS added_by_name
        FROM cc_collection_entries e
        JOIN cc_card_templates t ON e.template_id = t.id
        LEFT JOIN users u ON e.added_by = u.id
        WHERE e.collection_id = ${id}
        ORDER BY e.added_at DESC
    `
    return ok({ collection, entries })
}
```

- [ ] **Step 2: Add POST actions to vault-dashboard.js**

In the POST switch block (`functions/api/vault-dashboard.js:35-44`), add cases:

```javascript
case 'save-collection': return saveCollection(sql, body, user, canApprove)
case 'add-collection-entries': return addCollectionEntries(sql, body, user, canApprove)
case 'remove-collection-entry': return removeCollectionEntry(sql, body, canApprove)
case 'collection-status': return setCollectionStatus(sql, body, canApprove)
```

Implement:

```javascript
async function saveCollection(sql, body, user, canApprove) {
    if (!canApprove) return err('Requires vault_approve', 403)
    const { id, name, description, cover_image_url } = body
    if (!name?.trim()) return err('Name required')
    if (id) {
        const [row] = await sql`
            UPDATE cc_collections SET name = ${name.trim()}, description = ${description || null},
                cover_image_url = ${cover_image_url || null}, updated_at = NOW()
            WHERE id = ${id} RETURNING *
        `
        return ok({ collection: row })
    }
    const [row] = await sql`
        INSERT INTO cc_collections (name, description, cover_image_url, created_by)
        VALUES (${name.trim()}, ${description || null}, ${cover_image_url || null}, ${user.id})
        RETURNING *
    `
    return ok({ collection: row })
}

async function addCollectionEntries(sql, body, user, canApprove) {
    if (!canApprove) return err('Requires vault_approve', 403)
    const { collection_id, template_ids } = body
    if (!collection_id || !template_ids?.length) return err('Missing collection_id or template_ids')
    const approved = await sql`
        SELECT id FROM cc_card_templates WHERE id = ANY(${template_ids}) AND status = 'approved'
    `
    const approvedIds = approved.map(r => r.id)
    if (approvedIds.length === 0) return err('No approved templates found')
    for (const tid of approvedIds) {
        await sql`
            INSERT INTO cc_collection_entries (collection_id, template_id, added_by)
            VALUES (${collection_id}, ${tid}, ${user.id})
            ON CONFLICT (collection_id, template_id) DO NOTHING
        `
    }
    return ok({ added: approvedIds.length })
}

async function removeCollectionEntry(sql, body, canApprove) {
    if (!canApprove) return err('Requires vault_approve', 403)
    const { id } = body
    if (!id) return err('Missing id')
    await sql`DELETE FROM cc_collection_entries WHERE id = ${id}`
    return ok({ removed: true })
}

async function setCollectionStatus(sql, body, canApprove) {
    if (!canApprove) return err('Requires vault_approve', 403)
    const { id, status } = body
    if (!id || !['draft', 'active', 'archived'].includes(status)) return err('Invalid params')
    const [row] = await sql`
        UPDATE cc_collections SET status = ${status}, updated_at = NOW()
        WHERE id = ${id} RETURNING *
    `
    return ok({ collection: row })
}
```

- [ ] **Step 3: Add frontend service methods to `src/services/database.js`**

Find the `vaultDashboardService` object and add:

```javascript
// Collections
async getCollections() { return apiCall('vault-dashboard', { action: 'collections' }) },
async getCollection(id) { return apiCall('vault-dashboard', { action: 'collection', id }) },
async saveCollection(data) { return apiPost('vault-dashboard', { action: 'save-collection' }, data) },
async addCollectionEntries(collectionId, templateIds) {
    return apiPost('vault-dashboard', { action: 'add-collection-entries' }, { collection_id: collectionId, template_ids: templateIds })
},
async removeCollectionEntry(id) { return apiPost('vault-dashboard', { action: 'remove-collection-entry' }, { id }) },
async setCollectionStatus(id, status) { return apiPost('vault-dashboard', { action: 'collection-status' }, { id, status }) },
```

- [ ] **Step 4: Verify API works**

Run: `npm run dev:api`
Test with curl or browser: `GET /api/vault-dashboard?action=collections` (with auth header)
Expected: `{ "collections": [] }`

- [ ] **Step 5: Commit**

```bash
git add functions/api/vault-dashboard.js src/services/database.js
git commit -m "feat(vault): add collection CRUD API endpoints"
```

---

## Task 3: Pack Generation — Collection Slot Type

**Files:**
- Modify: `functions/lib/vault.js:421-464` (openPack INSERT + first-edition)
- Modify: `functions/lib/vault.js:588+` (generateConfiguredPack)

- [ ] **Step 1: Add `generateCollectionCard` helper**

Add this function near the other card generators in `functions/lib/vault.js` (after `generateConfiguredPack`):

```javascript
async function generateCollectionCard(sql, collectionId) {
    const entries = await sql`
        SELECT t.id, t.name, t.card_type
        FROM cc_collection_entries e
        JOIN cc_card_templates t ON e.template_id = t.id
        JOIN cc_collections c ON e.collection_id = c.id
        WHERE e.collection_id = ${collectionId}
          AND c.status = 'active'
          AND t.status = 'approved'
    `
    if (entries.length === 0) return null

    const template = entries[Math.floor(Math.random() * entries.length)]
    const rarity = rollRarity('common')
    const holoEffect = getHoloEffect(rarity)
    const holoType = rarity !== 'common' ? ['holo', 'reverse', 'full'][Math.floor(Math.random() * 3)] : 'common'

    const [col] = await sql`SELECT name FROM cc_collections WHERE id = ${collectionId}`

    return {
        god_id: `collection-${template.id}`,
        god_name: template.name,
        god_class: template.card_type || 'custom',
        role: 'collection',
        rarity,
        serial_number: Math.floor(Math.random() * 9999) + 1,
        holo_effect: holoEffect,
        holo_type: holoType,
        image_url: null,
        acquired_via: 'pack',
        card_type: 'collection',
        card_data: { collectionId, collectionName: col?.name || 'Collection' },
        def_id: null,
        template_id: template.id,
    }
}
```

- [ ] **Step 2: Add collection slot handling to `generateConfiguredPack`**

In `generateConfiguredPack` (`functions/lib/vault.js:588`), inside the per-slot `for` loop (around line 681, after `const slot = slots[i]`), add before the existing `rollRarityBounded` call:

```javascript
// Handle collection slots — skip normal type-picking entirely
if (slot.type === 'collection' && slot.collectionId) {
    const card = await generateCollectionCard(sql, slot.collectionId)
    if (card) {
        card._revealOrder = i
        cards.push(card)
    }
    continue
}
```

- [ ] **Step 3: Modify `openPack` INSERT to include `template_id`**

In `functions/lib/vault.js:447`, modify the INSERT column list to add `template_id`:

Change line 447 from:
```sql
INSERT INTO cc_cards (owner_id, original_owner_id, god_id, god_name, god_class, role, rarity, serial_number, holo_effect, holo_type, image_url, acquired_via, card_type, card_data, def_id, is_first_edition)
```
To:
```sql
INSERT INTO cc_cards (owner_id, original_owner_id, god_id, god_name, god_class, role, rarity, serial_number, holo_effect, holo_type, image_url, acquired_via, card_type, card_data, def_id, template_id, is_first_edition)
```

In the VALUES (line 448-454), add `${card.template_id || null},` after `${card.def_id || null},` and before the `is_first_edition` expression.

- [ ] **Step 4: Expand first-edition check to include collection cards**

In `functions/lib/vault.js:444`, change:
```javascript
const checkFE = card.card_type === 'player' && !!card.def_id && process.env.VAULT_OPEN === 'true'
```
To:
```javascript
const checkFE = process.env.VAULT_OPEN === 'true' && (
    (card.card_type === 'player' && !!card.def_id) ||
    (card.card_type === 'collection' && !!card.template_id)
)
```

Update the `NOT EXISTS` subquery (line 452-454) to use OR-based logic instead of CASE (CASE expects scalar results, not boolean predicates):

```javascript
${checkFE}::boolean AND NOT EXISTS (
    SELECT 1 FROM cc_cards
    WHERE rarity = ${card.rarity}
      AND (
        (${card.card_type} = 'collection' AND template_id = ${card.template_id || 0})
        OR (${card.card_type} != 'collection' AND def_id = ${card.def_id || 0})
      )
)
```

- [ ] **Step 5: Commit**

```bash
git add functions/lib/vault.js
git commit -m "feat(vault): add collection slot type to pack generation"
```

---

## Task 4: formatCard + Template Data Delivery

**Files:**
- Modify: `functions/api/vault.js:2173-2207` (formatCard)
- Modify: `functions/api/vault.js:115-241` (handleLoad)
- Modify: `functions/api/vault.js:320-345` (handleOpenPack)
- Modify: `functions/api/vault.js:245-273` (handleOpenInventoryPack)
- Modify: `functions/api/vault.js:350-425` (handleSalePurchase)
- Modify: `functions/api/vault.js:2028-2055` (handleBinderView)

- [ ] **Step 1: Add `templateId` to `formatCard`**

In `functions/api/vault.js:2173-2207`, add after the `signatureUrl` line (line 2205):

```javascript
templateId: row.template_id || null,
```

- [ ] **Step 2: Modify `handleLoad` to include `templateCache`**

In `handleLoad` (`functions/api/vault.js:115`), after the `Promise.all` resolves (around line 185, after all the data is fetched), add before the response is constructed:

```javascript
// Build template cache for collection cards
const collectionTemplateIds = [...new Set(
    collection.filter(c => c.card_type === 'collection' && c.template_id)
        .map(c => c.template_id)
)]
let templateCache = {}
if (collectionTemplateIds.length > 0) {
    const templates = await sql`
        SELECT id, card_type, template_data FROM cc_card_templates WHERE id = ANY(${collectionTemplateIds})
    `
    for (const t of templates) {
        const td = typeof t.template_data === 'string' ? JSON.parse(t.template_data) : t.template_data
        templateCache[t.id] = {
            cardData: td?.cardData || {},
            cardType: t.card_type || 'custom',
        }
    }
}
```

Add `templateCache` to the response JSON alongside `collection`, `stats`, etc.

- [ ] **Step 3: Create shared helper for inlining template data on formatted cards**

Add a helper function near the top of `functions/api/vault.js` (after imports) to avoid duplicating the inline logic across 3 pack-open handlers:

```javascript
async function inlineTemplateData(sql, formattedCards) {
    const collectionCards = formattedCards.filter(c => c.cardType === 'collection' && c.templateId)
    if (collectionCards.length === 0) return
    const tids = [...new Set(collectionCards.map(c => c.templateId))]
    const templates = await sql`
        SELECT id, card_type, template_data FROM cc_card_templates WHERE id = ANY(${tids})
    `
    const cache = {}
    for (const t of templates) {
        const td = typeof t.template_data === 'string' ? JSON.parse(t.template_data) : t.template_data
        cache[t.id] = {
            cardData: td?.cardData || {},
            cardType: t.card_type || 'custom',
        }
    }
    for (const card of collectionCards) {
        if (cache[card.templateId]) card._templateData = cache[card.templateId]
    }
}
```

- [ ] **Step 4: Inline template data in all 3 pack-open response paths**

In `handleOpenPack` (`functions/api/vault.js:329-333`), after `const cards = result.cards.map(...)`, add:
```javascript
await inlineTemplateData(sql, cards)
```

In `handleOpenInventoryPack` (`functions/api/vault.js:257-261`), after `const cards = result.cards.map(...)`, add:
```javascript
await inlineTemplateData(sql, cards)
```

In `handleSalePurchase` (`functions/api/vault.js:410-414`), after `const cards = result.cards.map(...)`, add:
```javascript
await inlineTemplateData(sql, cards)
```

Note: `handleSalePurchase` is inside a `transaction()` callback — `sql` is `tx` there. Use `sql` (the outer connection) for the template lookup since it's read-only and happens after the transaction completes.

- [ ] **Step 5: Add `template_id` to `handleBinderView` SELECT and inline template data**

In `handleBinderView` (`functions/api/vault.js:2040-2044`), the SELECT uses explicit columns. Add `c.template_id` to the column list:

```sql
c.god_id, c.god_name, c.god_class, c.role, c.rarity, c.serial_number,
c.holo_effect, c.holo_type, c.image_url, c.card_type, c.card_data,
c.ability, c.metadata, c.def_id, c.is_first_edition, c.acquired_via, c.created_at,
c.template_id,
```

After the cards are fetched (around line 2055), inline template data for any collection cards:

```javascript
const collBinder = cards.filter(c => c.card_type === 'collection' && c.template_id)
let binderTemplateCache = {}
if (collBinder.length > 0) {
    const tids = [...new Set(collBinder.map(c => c.template_id))]
    const templates = await sql`
        SELECT id, card_type, template_data FROM cc_card_templates WHERE id = ANY(${tids})
    `
    for (const t of templates) {
        const td = typeof t.template_data === 'string' ? JSON.parse(t.template_data) : t.template_data
        binderTemplateCache[t.id] = { cardData: td?.cardData || {}, cardType: t.card_type || 'custom' }
    }
}
```

Then in the response `cards.map()` (around line 2066), include `_templateData: binderTemplateCache[c.template_id] || null` for collection cards.

- [ ] **Step 6: Commit**

```bash
git add functions/api/vault.js
git commit -m "feat(vault): add templateId to formatCard and template cache to load/pack/binder responses"
```

---

## Task 5: EmptyCardSlot + CardErrorBoundary + VaultCard

**Files:**
- Create: `src/pages/vault/components/EmptyCardSlot.jsx`
- Create: `src/pages/vault/components/VaultCard.jsx`

- [ ] **Step 1: Create EmptyCardSlot**

```jsx
import '../../vault/components/GameCard.css'
import { RARITIES } from '../../../data/vault/economy'

export default function EmptyCardSlot({ rarity = 'common', size }) {
    const rarityInfo = RARITIES[rarity] || RARITIES.common
    const scale = size ? parseFloat(size) / 240 : 1
    return (
        <div
            className="game-card"
            data-rarity={rarity}
            style={{ '--card-scale': scale, ...(size ? { width: size } : {}) }}
        >
            <div className="game-card__border">
                <div className="game-card__body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '3.45cqi', color: 'var(--text-dim)', opacity: 0.5 }}>
                        {rarityInfo.name} Card
                    </span>
                </div>
            </div>
        </div>
    )
}
```

- [ ] **Step 2: Create VaultCard with error boundary**

VaultCard handles ONLY the collection card rendering branch. Each render location keeps its existing player/game card code and adds a collection check that delegates to VaultCard. This avoids a massive refactor of all 15+ files' card conversion logic.

```jsx
import { Component } from 'react'
import StructuredCard from '../../vault-dashboard/preview/StructuredCard'
import EmptyCardSlot from './EmptyCardSlot'
import TradingCardHolo from '../../../components/TradingCardHolo'
import { getHoloEffect } from '../../../data/vault/economy'

class CardErrorBoundary extends Component {
    state = { hasError: false }
    static getDerivedStateFromError() { return { hasError: true } }
    render() {
        if (this.state.hasError) return this.props.fallback
        return this.props.children
    }
}

/**
 * Renders collection cards via StructuredCard with error boundary protection.
 * Only handles card_type='collection' — parent components handle player/game cards.
 *
 * @param {object} card - card object (must have templateId or template_id)
 * @param {function} getTemplate - template cache lookup from VaultContext (id => data | null)
 * @param {number} size - card size in px
 * @param {boolean} holo - wrap in TradingCardHolo (only for interactive contexts)
 */
export default function VaultCard({ card, getTemplate, size, holo }) {
    const tid = card.templateId || card.template_id
    const template = card._templateData || getTemplate?.(tid)
    if (!template?.cardData) return <EmptyCardSlot rarity={card.rarity} size={size} />

    const structured = (
        <CardErrorBoundary fallback={<EmptyCardSlot rarity={card.rarity} size={size} />}>
            <StructuredCard
                cardData={template.cardData}
                rarity={card.rarity}
                cardType={template.cardType || 'custom'}
                size={size}
            />
        </CardErrorBoundary>
    )

    if (holo) {
        const holoEffect = getHoloEffect(card.rarity)
        const holoType = card.holoType || card.holo_type || 'reverse'
        return (
            <TradingCardHolo rarity={holoEffect} holoType={holoType} size={size}>
                {structured}
            </TradingCardHolo>
        )
    }
    return structured
}
```

Note: StructuredCard does NOT accept a `border` prop — borders are CSS-driven via `data-rarity` attribute and `game-card__border` class. No `border` data needs to be passed.

- [ ] **Step 3: Commit**

```bash
git add src/pages/vault/components/EmptyCardSlot.jsx src/pages/vault/components/VaultCard.jsx
git commit -m "feat(vault): add VaultCard wrapper with error boundary and EmptyCardSlot"
```

---

## Task 6: VaultContext — Template Cache

**Files:**
- Modify: `src/pages/vault/VaultContext.jsx`

- [ ] **Step 1: Add templateCache state**

After line 27 (`const [binder, setBinder] = useState(null)`), add:

```javascript
const [templateCache, setTemplateCache] = useState({})
```

- [ ] **Step 2: Process templateCache from load response**

In the `Promise.all` handler (line 71-89), after `setCollection(ccData.collection || [])`, add:

```javascript
setTemplateCache(ccData.templateCache || {})
```

- [ ] **Step 3: Add getTemplate helper**

After `getDefOverride` (line 106-116), add:

```javascript
const getTemplate = useCallback((templateId) => {
    return templateCache[templateId] || null
}, [templateCache])
```

- [ ] **Step 4: Merge template data from pack/gift results**

In `buyPack`, `openInventoryPack`, `buySalePack`, `openGift` — after `setCollection(prev => [...prev, ...result.cards])`, add:

```javascript
// Merge inline template data from new collection cards into cache
const newTemplates = {}
for (const card of result.cards) {
    if (card._templateData && card.templateId) {
        newTemplates[card.templateId] = card._templateData
    }
}
if (Object.keys(newTemplates).length > 0) {
    setTemplateCache(prev => ({ ...prev, ...newTemplates }))
}
```

This must be added in all 4 locations:
- `buyPack` (line 352)
- `openInventoryPack` (line 365)
- `buySalePack` (line 382)
- `openGift` (line 158)

- [ ] **Step 5: Expose in context value**

Add `templateCache, getTemplate` to the value useMemo (line 400-421) and its dependency array.

- [ ] **Step 6: Commit**

```bash
git add src/pages/vault/VaultContext.jsx
git commit -m "feat(vault): add template cache to VaultContext for collection card rendering"
```

---

## Task 7: Patch Rendering Locations

This is the largest task. Each file needs a collection card check before its existing player/game card rendering. The pattern is the same everywhere:

```jsx
import VaultCard from './components/VaultCard'  // (adjust path)
import { useVault } from './VaultContext'        // (if not already imported)

// In the component:
const { getTemplate } = useVault()

// Where cards are rendered, add before existing player/game logic:
const cardType = card.cardType || card.card_type || 'god'
if (cardType === 'collection') {
    return <VaultCard card={card} getTemplate={getTemplate} size={size} holo={holoForThisLocation} />
}
// ... existing player/game rendering unchanged
```

**Files:** Listed below with location-specific notes.

- [ ] **Step 1: PackOpening.jsx** (`src/pages/vault/components/PackOpening.jsx:72-99`)

In the `PackCard` component (line 72), add `getTemplate` from `useVault()` (already imported). Before the existing `isPlayer` check (line 74), add:

```jsx
if (type === 'collection') {
    return <VaultCard card={card} getTemplate={getTemplate} size={size} holo={holo} />
}
```

In `SummaryView` (line 101), same pattern for collection cards in the grid and the zoom overlay.

- [ ] **Step 2: CardZoomModal.jsx** (`src/pages/vault/components/CardZoomModal.jsx`)

Add a third prop path `collectionCard` alongside `gameCard` and `playerCard`. When `collectionCard` is provided, render VaultCard with `holo={true}` inside the modal. Use the same rarity switcher UI for owned rarities. The parent component that opens the modal must detect `cardType === 'collection'` and pass `collectionCard` prop instead of `gameCard`/`playerCard`.

- [ ] **Step 3: CCCollection.jsx**

In the card grid rendering, add before the existing GameCard: if `cardType === 'collection'`, render VaultCard with `holo={false}`.

- [ ] **Step 4: CCStartingFive.jsx**

Where slotted cards are rendered, add collection card check with `holo={true}`.

- [ ] **Step 5: CCBinder.jsx**

In binder slot rendering, add collection card check with `holo={false}`.

- [ ] **Step 6: CCDismantle.jsx**

In the dismantleable card grid, add collection card check with `holo={false}`.

- [ ] **Step 7: CCTrading.jsx**

In trade offer card display, add collection card check with `holo={false}`.

- [ ] **Step 8: CCMarketplace.jsx**

In marketplace listing display, add collection card check with `holo={false}`.

- [ ] **Step 9: CCBlackMarket.jsx**

Add collection card check where bounty reward cards are shown.

- [ ] **Step 10: CCCardCatalog.jsx**

Add collection card check in catalog grid.

- [ ] **Step 11: CCBountyBoard.jsx**

Add collection card check where bounty listing cards are shown, with `holo={false}`.

- [ ] **Step 12: CCSignatureRequests.jsx**

Add collection card check in signature request card display.

- [ ] **Step 13: BinderSharePage.jsx**

This page doesn't use VaultContext. For collection cards, use `card._templateData` (inlined by backend in Task 4 Step 5) directly:

```jsx
if ((card.cardType || card.card_type) === 'collection' && card._templateData) {
    return <VaultCard card={card} holo={false} />
}
```

VaultCard already checks `card._templateData` before `getTemplate`.

- [ ] **Step 14: Commit**

```bash
git add src/pages/vault/components/PackOpening.jsx src/pages/vault/components/CardZoomModal.jsx
git add src/pages/vault/CCCollection.jsx src/pages/vault/CCStartingFive.jsx src/pages/vault/CCBinder.jsx
git add src/pages/vault/CCDismantle.jsx src/pages/vault/CCTrading.jsx src/pages/vault/CCMarketplace.jsx
git add src/pages/vault/CCBlackMarket.jsx src/pages/vault/CCCardCatalog.jsx
git add src/pages/vault/CCBountyBoard.jsx src/pages/vault/CCSignatureRequests.jsx
git add src/pages/vault/BinderSharePage.jsx
git commit -m "feat(vault): add collection card rendering to all vault UI locations"
```

---

## Task 8: Pack Type Editor — Collection Slot Support

**Files:**
- Modify: `src/pages/admin/PackCreator.jsx:5,13,15-148`

- [ ] **Step 1: Add `collection` to slot type options**

At the top of `PackCreator.jsx`, add to `CARD_TYPES` (line 5):

```javascript
const CARD_TYPES = ['god', 'item', 'consumable', 'player', 'collection']
```

- [ ] **Step 2: Add collection picker to SlotEditor**

In `SlotEditor` (line 15-148), when the slot has only `'collection'` in its types array (`slot.types.length === 1 && slot.types[0] === 'collection'`), show a collection dropdown instead of the normal rarity/weight controls.

Add state for available collections at the PackForm level, fetch on mount:

```javascript
const [collections, setCollections] = useState([])
useEffect(() => {
    vaultDashboardService.getCollections()
        .then(r => setCollections(r.collections?.filter(c => c.status === 'active') || []))
        .catch(() => {})
}, [])
```

Pass `collections` to SlotEditor. In SlotEditor, when the collection type is the only selected type, render:

```jsx
{slot.types.length === 1 && slot.types[0] === 'collection' && (
    <div>
        <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Collection</div>
        <select
            value={slot.collectionId || ''}
            onChange={e => onChange({ ...slot, type: 'collection', collectionId: parseInt(e.target.value) || null })}
            className="px-2 py-1 rounded bg-white/5 border border-white/10 text-xs text-white w-full"
        >
            <option value="">Select collection...</option>
            {collections.map(c => <option key={c.id} value={c.id}>{c.name} ({c.entry_count} cards)</option>)}
        </select>
    </div>
)}
```

When saving, if the slot type is collection, the slot JSON should be: `{ type: 'collection', collectionId: N }` (not the usual `{ types: [...], minRarity, maxRarity }` shape).

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/PackCreator.jsx
git commit -m "feat(vault): add collection slot type to pack editor"
```

---

## Task 9: Admin Collections Page + Route

**Files:**
- Create: `src/pages/vault-dashboard/CollectionsPage.jsx`
- Modify: `src/components/layout/VaultDashboardNavbar.jsx:9-14`
- Modify: `src/App.jsx:213-214`

- [ ] **Step 1: Create CollectionsPage**

Build the admin collection manager following the same patterns as `TemplatesPage.jsx` and `DraftsPage.jsx`:

- **List view**: table of collections with name, status badge (draft/active/archived), entry count, created by, date. Filter by status. Create new button.
- **Collection editor** (click a collection or create new):
  - Name/description fields
  - Status control buttons (draft → active → archived)
  - **Card browser panel**: fetch approved templates with `vaultDashboardService.getTemplates({ status: 'approved' })`, filterable by card_type and name search. Checkboxes for bulk selection, "Add selected" button.
  - **Current entries panel**: shows cards in collection with template name, card type, thumbnail. Remove button per entry.

- [ ] **Step 2: Add route to App.jsx**

In `src/App.jsx:213-214`, add between the assets route and closing tag:

```jsx
<Route path="collections" element={<Suspense fallback={null}><CollectionsPage /></Suspense>} />
```

Add the lazy import at the top with the other vault-dashboard imports:

```javascript
const CollectionsPage = lazy(() => import('./pages/vault-dashboard/CollectionsPage'))
```

- [ ] **Step 3: Add tab to VaultDashboardNavbar**

In `src/components/layout/VaultDashboardNavbar.jsx:9-14`, add to the `tabs` array:

```javascript
{ path: '/vault-dashboard/collections', label: 'Collections' },
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/vault-dashboard/CollectionsPage.jsx src/App.jsx src/components/layout/VaultDashboardNavbar.jsx
git commit -m "feat(vault): add admin collections page with route and navbar tab"
```

---

## Task 10: End-to-End Verification

- [ ] **Step 1: Create a test collection via the admin UI**

1. Navigate to `/vault-dashboard/collections`
2. Create a new collection named "Test Collection"
3. Add 2-3 approved templates to it
4. Set status to `active`

- [ ] **Step 2: Configure a pack with a collection slot**

1. Navigate to the pack creator
2. Edit an existing pack type or create a new one
3. Add a slot with type `collection`, pick "Test Collection"
4. Save the pack type

- [ ] **Step 3: Open a pack and verify collection cards render**

1. Open the configured pack
2. Verify collection cards appear in the pack opening reveal with StructuredCard rendering
3. Verify they show correct rarity holo in the reveal
4. Verify the summary view shows them correctly
5. Check the collection tab shows the new cards

- [ ] **Step 4: Verify all secondary locations**

1. Click a collection card to open zoom modal — verify it renders with holo
2. Check it appears in the dismantle grid
3. Slot it in a binder — verify it renders
4. Verify no console errors anywhere

- [ ] **Step 5: Test defensive rendering**

1. Manually delete a template from the DB: `DELETE FROM cc_card_templates WHERE id = X` (will fail if it's in a collection entry due to ON DELETE RESTRICT — remove the entry first, then delete template)
2. Or: directly set `template_id = NULL` on a cc_cards row that references a template
3. Reload the vault
4. Verify EmptyCardSlot appears instead of a crash
5. Verify no console errors that break the page

---

## Known Limitations

- **CardSharePage.jsx** — currently player-card only (JWT contains `playerSlug`, `handleSharedCard` only queries player data). Collection card sharing would need a new share mechanism. Out of scope.
- **Gift packs** — `handleOpenGift` has its own INSERT at `vault.js:1046` that bypasses `openPack()` and doesn't include `template_id`. Gifts currently only generate god/item/consumable/player cards, so this is safe. If collection cards are added to gifts in the future, that INSERT needs updating.
- **VaultOverview.jsx** (dashboard widget) — renders TradingCard for Starting Five preview. If a collection card is slotted in Starting Five, it would need the same collection card check. This file exists at `src/pages/dashboard/VaultOverview.jsx` but is a summary widget, not a full card renderer. Address if needed after initial deployment.

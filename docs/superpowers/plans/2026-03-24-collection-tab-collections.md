# Collection Tab — Owned Collections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show studio-created collections in the Collection tab when a user owns cards from them, with the same owned/unowned UX as game cards.

**Architecture:** New backend endpoint returns collections the user has cards from + template entries + ownership map. Frontend adds collection sections to CCCollection.jsx sidebar nav and content area, rendering cards via VaultCard/CanvasCard.

**Tech Stack:** PostgreSQL (Neon), Cloudflare Pages Functions, React 19, VaultCard/CanvasCard

**Spec:** `docs/superpowers/specs/2026-03-24-collection-tab-collections-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| **Modify** | `functions/api/vault.js` | Add `handleCollectionCollections` endpoint |
| **Modify** | `src/services/database.js` | Add `getOwnedCollections()` service method |
| **Modify** | `src/pages/vault/CCCollection.jsx` | Add collection sections to nav + content |

---

### Task 1: Backend endpoint — `collection-collections`

**Files:**
- Modify: `functions/api/vault.js`

**Reference:** Read the existing `handleCollectionCatalog` (line ~734) and `handleCollectionOwned` (line ~772) for patterns.

- [ ] **Step 1: Add route case**

In the GET switch block (around line 100), add after the `collection-search` case:

```js
case 'collection-collections': return await handleCollectionCollections(sql, user)
```

- [ ] **Step 2: Add handler function**

Add this function near the other collection handlers (after `handleCollectionOwned`):

```js
// ═══ GET: Collections the user owns cards from ═══
async function handleCollectionCollections(sql, user) {
  // 1. Get all collection-type cards the user owns, grouped by template_id
  const ownedRows = await sql`
    SELECT template_id, array_agg(rarity) AS rarities
    FROM cc_cards
    WHERE owner_id = ${user.id} AND card_type = 'collection' AND template_id IS NOT NULL
    GROUP BY template_id
  `
  if (ownedRows.length === 0) {
    return { statusCode: 200, headers, body: JSON.stringify({ collections: [], owned: {} }) }
  }

  const ownedTemplateIds = ownedRows.map(r => r.template_id)

  // 2. Find which collections contain these templates
  const collectionIds = await sql`
    SELECT DISTINCT collection_id FROM cc_collection_entries
    WHERE template_id = ANY(${ownedTemplateIds})
  `
  if (collectionIds.length === 0) {
    return { statusCode: 200, headers, body: JSON.stringify({ collections: [], owned: {} }) }
  }

  const cIds = collectionIds.map(r => r.collection_id)

  // 3. Get collection metadata + all entries (including ones user doesn't own)
  const [collections, entries] = await Promise.all([
    sql`
      SELECT id, name, description, cover_image_url
      FROM cc_collections
      WHERE id = ANY(${cIds}) AND status = 'active'
    `,
    sql`
      SELECT ce.collection_id, ce.template_id, ce.draft_id,
             COALESCE(t.name, d.name) AS name,
             COALESCE(t.card_type, d.card_type) AS card_type,
             COALESCE(t.template_data, d.template_data) AS template_data
      FROM cc_collection_entries ce
      LEFT JOIN cc_card_templates t ON t.id = ce.template_id
      LEFT JOIN cc_card_drafts d ON d.id = ce.draft_id
      WHERE ce.collection_id = ANY(${cIds})
      ORDER BY ce.id
    `,
  ])

  // Build response
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
      templateId: e.template_id || e.draft_id,
      isDraft: !e.template_id,
      name: e.name,
      cardType: e.card_type,
      templateData: e.template_data,
    })
  }

  // Ownership map: templateId -> [rarities]
  const owned = {}
  for (const r of ownedRows) owned[r.template_id] = r.rarities

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      collections: [...collectionMap.values()].filter(c => c.entries.length > 0),
      owned,
    }),
  }
}
```

- [ ] **Step 3: Verify the build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add functions/api/vault.js
git commit -m "feat(vault): add collection-collections endpoint for owned collections"
```

---

### Task 2: Frontend service method

**Files:**
- Modify: `src/services/database.js`

- [ ] **Step 1: Add service method**

In the `vaultService` object (around line 1035, after `getCollectionSet`), add:

```js
async getOwnedCollections() {
    return apiCall('vault', { action: 'collection-collections' })
},
```

- [ ] **Step 2: Commit**

```bash
git add src/services/database.js
git commit -m "feat(vault): add getOwnedCollections service method"
```

---

### Task 3: CCCollection.jsx — Add collection sections

**Files:**
- Modify: `src/pages/vault/CCCollection.jsx`

This is the largest task. Read the full file first. Changes span imports, state, data loading, sidebar nav, content area, and a new grid component.

- [ ] **Step 1: Add imports**

Add VaultCard import near the top (after the existing card imports around line 8-10):

```jsx
import VaultCard from './components/VaultCard'
```

Add `Package` to the lucide-react import (used as collection section icon):

```jsx
import { Library, Trophy, Eye, EyeOff, ChevronDown, ChevronRight, Search, X, Clock, ArrowUpDown, Package } from 'lucide-react'
```

- [ ] **Step 2: Add state for collection sets**

Inside the `CCCollection` function, after the existing state declarations (around line 101), add:

```jsx
const [collectionSets, setCollectionSets] = useState(null)
```

- [ ] **Step 3: Load collection sets on mount**

In the `loadData` async function (around line 111-131), add the `getOwnedCollections` call. Modify the data loading to include it:

After the existing `Promise.all` that resolves `ownedPromise` and `overridesPromise`, add:

```jsx
// After setDefOverrides(overridesData.overrides || {})
vaultService.getOwnedCollections().then(data => setCollectionSets(data)).catch(() => {})
```

This fires in parallel and doesn't block the initial render — collection sections appear once loaded.

- [ ] **Step 4: Derive collection nav items and totals**

After the existing `totalPlayerCollected` computation (around line 259), add:

```jsx
const collectionNavItems = useMemo(() => {
  if (!collectionSets?.collections) return []
  return collectionSets.collections.map(col => {
    const collected = col.entries.filter(e => collectionSets.owned[e.templateId]?.length > 0).length
    return { ...col, collected, total: col.entries.length }
  })
}, [collectionSets])

const totalCollectionCards = collectionNavItems.reduce((s, c) => s + c.total, 0)
const totalCollectionCollected = collectionNavItems.reduce((s, c) => s + c.collected, 0)
```

- [ ] **Step 5: Integrate into filteredEntries**

In the `filteredEntries` useMemo (around line 300-339), add a branch for collection sections. After the `else if (activeSection.startsWith('player:'))` block and before the `else { return [] }`, add:

```jsx
} else if (activeSection.startsWith('col:')) {
  const colId = parseInt(activeSection.replace('col:', ''), 10)
  const col = collectionSets?.collections?.find(c => c.id === colId)
  if (!col) return []
  entries = col.entries.map(e => ({
    templateId: e.templateId,
    name: e.name,
    cardType: e.cardType,
    templateData: e.templateData,
    collected: (collectionSets.owned[e.templateId]?.length || 0) > 0,
    ownedRarities: collectionSets.owned[e.templateId] || [],
  }))
```

Also add `collectionSets` to the useMemo dependency array.

- [ ] **Step 6: Add collection pills to mobile nav**

In the mobile nav section (around line 444, after the player set pills), add collection pills:

```jsx
{collectionNavItems.map(col => {
  const active = activeSection === `col:${col.id}`
  return (
    <button
      key={`col-${col.id}`}
      onClick={() => switchSection(`col:${col.id}`)}
      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer cd-head ${
        active
          ? 'bg-[var(--cd-cyan)]/15 text-[var(--cd-cyan)] border border-[var(--cd-cyan)]/25'
          : 'bg-white/[0.04] text-[var(--cd-text-mid)] hover:bg-white/[0.06]'
      }`}
    >
      <Package className="w-3 h-3" />
      <span>{col.name}</span>
    </button>
  )
})}
```

- [ ] **Step 7: Add collection items to desktop sidebar**

In the desktop sidebar (around line 508, after the game card buttons and before the Player Sets section), add:

```jsx
{collectionNavItems.length > 0 && (
  <>
    <div className="text-[10px] text-[var(--cd-text-dim)] uppercase tracking-wider font-bold mt-4 mb-2 cd-head">Collections</div>
    {collectionNavItems.map(col => {
      const active = activeSection === `col:${col.id}`
      return (
        <button
          key={`col-${col.id}`}
          onClick={() => switchSection(`col:${col.id}`)}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer cd-head text-left ${
            active
              ? 'bg-[var(--cd-cyan)]/10 text-[var(--cd-cyan)] border border-[var(--cd-cyan)]/20'
              : 'text-[var(--cd-text-mid)] hover:bg-white/[0.03] hover:text-[var(--cd-text)]'
          }`}
        >
          <Package className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1 truncate">{col.name}</span>
          <span className="text-xs cd-num text-[var(--cd-text)]">{col.collected}/{col.total}</span>
        </button>
      )
    })}
  </>
)}
```

- [ ] **Step 8: Add header stat for collections**

In the stats bar (around line 396-407), after the Player Cards stat, add:

```jsx
{totalCollectionCards > 0 && (
  <div className="text-[var(--cd-text-mid)]">
    Collections: <span className="text-[var(--cd-cyan)] cd-num font-bold">{totalCollectionCollected}</span>
    <span className="text-[var(--cd-text-dim)]">/{totalCollectionCards}</span>
  </div>
)}
```

- [ ] **Step 9: Add collection grid rendering in content area**

In the main content area (around line 618, after the GameCardGrid rendering and before the player:all section), add:

```jsx
{activeSection.startsWith('col:') && collectionSets && (
  <CollectionCardGrid
    collection={collectionNavItems.find(c => `col:${c.id}` === activeSection)}
    entries={filteredEntries.slice(0, displayLimit)}
    owned={collectionSets.owned}
    onZoom={setZoomedCard}
  />
)}
```

- [ ] **Step 10: Add CardZoomModal collection support**

Update the CardZoomModal usage (around line 680-687) to pass `collectionCard`:

```jsx
{zoomedCard && (
  <CardZoomModal
    onClose={() => setZoomedCard(null)}
    collectionCard={zoomedCard.collectionCard}
    gameCard={zoomedCard.gameCard}
    playerCard={zoomedCard.playerCard}
    canSell={zoomedCard.canSell}
  />
)}
```

- [ ] **Step 11: Add CollectionCardGrid component**

Add this new component at the bottom of CCCollection.jsx (before the closing of the file, after the PlayerSlot component around line 1084):

```jsx
// ═══ Collection card grid ═══

function CollectionCardGrid({ collection, entries, owned, onZoom }) {
  if (!collection) return null

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-lg font-bold cd-head text-[var(--cd-text)]">{collection.name}</h2>
        {collection.collected === collection.total && collection.total > 0 && (
          <Trophy className="w-4 h-4 text-[var(--cd-gold)]" />
        )}
      </div>
      {collection.description && (
        <p className="text-sm text-[var(--cd-text-dim)] mb-2">{collection.description}</p>
      )}
      <ProgressBar collected={collection.collected} total={collection.total} />

      {entries.length === 0 ? (
        <div className="text-center py-12 text-[var(--cd-text-dim)]">
          <Library className="w-10 h-10 mx-auto mb-2 opacity-20" />
          <p className="text-sm font-bold cd-head">No cards {viewMode === 'owned' ? 'owned' : 'found'}</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
          {entries.map(entry => (
            <CollectionEntrySlot key={entry.templateId} entry={entry} onZoom={onZoom} />
          ))}
        </div>
      )}
    </div>
  )
}

function CollectionEntrySlot({ entry, onZoom }) {
  if (entry.collected) {
    const rarity = highestRarity(entry.ownedRarities)
    const td = typeof entry.templateData === 'string' ? JSON.parse(entry.templateData) : entry.templateData

    const handleZoom = () => onZoom({
      collectionCard: {
        templateId: entry.templateId,
        _templateData: td,
        rarity,
        cardType: 'collection',
      },
      canSell: true,
    })

    return (
      <div className="flex flex-col items-center card-zoomable" onClick={handleZoom}>
        <div className="relative">
          <VaultCard
            card={{
              templateId: entry.templateId,
              _templateData: td,
              rarity,
              cardType: 'collection',
            }}
            size={CARD_SIZE}
            holo={false}
          />
          <DuplicateCount ownedRarities={entry.ownedRarities} />
        </div>
        <RarityPips ownedRarities={entry.ownedRarities} />
      </div>
    )
  }

  // Unowned — grey placeholder
  return (
    <div className="flex flex-col items-center">
      <div
        className="rounded-lg border border-[var(--cd-border)] bg-[var(--cd-surface)]/40 flex flex-col items-center justify-center"
        style={{ width: CARD_SIZE, aspectRatio: '5/7' }}
      >
        <Package className="w-6 h-6 text-[var(--cd-text-dim)]/30 mb-1" />
        <div className="text-[11px] font-bold text-[var(--cd-text-dim)] cd-head text-center px-2 leading-tight">{entry.name}</div>
        <div className="text-[10px] text-[var(--cd-text-dim)]/60 mt-0.5">???</div>
      </div>
    </div>
  )
}
```

Note: The `viewMode` variable is referenced in CollectionCardGrid's empty state message. Since CollectionCardGrid is defined inside the same file and `viewMode` is in the parent scope, it can be passed as a prop or accessed via closure. Pass it as a prop for cleanliness — update the JSX call in step 9:

```jsx
<CollectionCardGrid
  collection={collectionNavItems.find(c => `col:${c.id}` === activeSection)}
  entries={filteredEntries.slice(0, displayLimit)}
  owned={collectionSets.owned}
  onZoom={setZoomedCard}
  viewMode={viewMode}
/>
```

And update the function signature to accept `viewMode`.

- [ ] **Step 12: Verify the build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 13: Commit**

```bash
git add src/pages/vault/CCCollection.jsx
git commit -m "feat(vault): show owned collections in collection tab"
```

---

### Task 4: Final verification

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: Clean build

- [ ] **Step 2: Manual smoke test**

Start dev server: `npm start`

1. Open the vault Collection tab
2. If you own any collection cards, verify the collection appears in the sidebar
3. Click a collection — see all template entries with owned ones rendered and unowned greyed out
4. Verify rarity pips show correct owned rarities
5. Verify clicking an owned card opens CardZoomModal
6. Verify viewMode (all/owned) filter works
7. Verify rarity filter works
8. Verify mobile pill nav shows collection pills
